import { Router } from "express";
import { z } from "zod";
import { db } from "./db";
import { ok, HttpError, parsePage } from "./http";
import { optionalUser, requireRole, signToken } from "./auth";
import { getSettings } from "./settings";
import { applyGoodsSort, fillRecommend, publicGoods } from "./recommend";
import { ingestEvents } from "./analytics";
import { code2session, mockPayParams } from "./wechat";
import { cancelOrder, createOrder, loadOrderDetail, markPaid, previewOrder, ST } from "./orderService";
import { config, publicUrl } from "./config";
import { claimCoupon, listClaimableCoupons } from "./marketing";
import { activityWindowOk, listActiveGroupBuys, listActiveSeckills, loadTeam } from "./campaigns";
import { cartUpsell, personalizedGoods, relatedGoods } from "./personalize";
import { listNotifyLogs, setSubscribe } from "./notify";
import { salePriceOf } from "./pricing";

export const appRouter = Router();

appRouter.get("/shop/bootstrap", async (_req, res, next) => {
  try {
    const settings = await getSettings();
    const categories = await db("categories").where({ enabled: 1 }).whereNull("deleted_at").orderBy("sort", "desc");
    ok(res, {
      settings,
      categories,
      mockWx: config.mockWx,
      mockPay: config.mockPay,
      privacyUrl: `${config.publicUrl}/privacy`,
    });
  } catch (e) {
    next(e);
  }
});

appRouter.post("/auth/wx-login", async (req, res, next) => {
  try {
    const body = z.object({ code: z.string().min(1), nickname: z.string().optional(), avatarUrl: z.string().optional() }).parse(req.body);
    const sess = await code2session(body.code);
    let user = await db("users").where({ openid: sess.openid }).first();
    if (!user) {
      const [id] = await db("users").insert({
        openid: sess.openid,
        unionid: sess.unionid || null,
        nickname: body.nickname || "微信用户",
        avatar_url: body.avatarUrl || "",
      });
      user = await db("users").where({ id }).first();
    } else if (body.nickname || body.avatarUrl) {
      await db("users")
        .where({ id: user.id })
        .update({
          nickname: body.nickname || user.nickname,
          avatar_url: body.avatarUrl || user.avatar_url,
        });
      user = await db("users").where({ id: user.id }).first();
    }
    const token = signToken({ id: user.id, role: "user" });
    ok(res, {
      token,
      user: { id: user.id, nickname: user.nickname, avatarUrl: user.avatar_url, phone: user.phone, phoneBound: Boolean(user.phone) },
    });
  } catch (e) {
    next(e);
  }
});

appRouter.post("/auth/wx-phone", requireRole("user"), async (req, res, next) => {
  try {
    const body = z.object({ phone: z.string().min(6), code: z.string().optional() }).parse(req.body);
    if (!config.mockWx && !body.code) throw new HttpError(400, "缺少手机号凭证");
    await db("users").where({ id: req.auth!.id }).update({ phone: body.phone, phone_bound_at: db.fn.now() });
    const user = await db("users").where({ id: req.auth!.id }).first();
    ok(res, { phone: user.phone, phoneBound: true });
  } catch (e) {
    next(e);
  }
});

appRouter.get("/home", optionalUser, async (req, res, next) => {
  try {
    const banners = await db("banners").where({ enabled: 1 }).orderBy("sort", "desc").limit(5);
    const now = new Date();
    const deals = await db("goods")
      .where({ on_sale: 1 })
      .whereNull("deleted_at")
      .whereNotNull("special_price_cent")
      .where("special_start", "<=", now)
      .where("special_end", ">=", now)
      .orderBy("sort", "desc")
      .limit(12);
    const rec = await fillRecommend("home_recommend");
    const forYou = await personalizedGoods(req.auth?.id || null, 8);
    ok(res, {
      banners: banners.map((b: { image_url: string }) => ({ ...b, image_url: publicUrl(b.image_url) })),
      deals: deals.map(publicGoods),
      seckills: await listActiveSeckills(),
      groups: await listActiveGroupBuys(),
      forYou,
      recommendTitle: rec.slot?.title || "本店推荐",
      recommend: rec.list.map(publicGoods),
    });
  } catch (e) {
    next(e);
  }
});

appRouter.get("/categories", async (_req, res, next) => {
  try {
    ok(res, await db("categories").where({ enabled: 1 }).whereNull("deleted_at").orderBy("sort", "desc"));
  } catch (e) {
    next(e);
  }
});

appRouter.get("/goods", async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req.query as Record<string, unknown>);
    let q = db("goods").where({ on_sale: 1 }).whereNull("deleted_at");
    if (req.query.categoryId) q = q.where("category_id", Number(req.query.categoryId));
    if (req.query.keyword) q = q.where("name", "like", `%${String(req.query.keyword)}%`);
    q = applyGoodsSort(q, String(req.query.sort || "composite"));
    const total = await q.clone().clearSelect().clearOrder().count({ c: "*" }).first();
    const list = await q.offset(offset).limit(pageSize);
    ok(res, { list: list.map(publicGoods), page, pageSize, total: Number(total?.c || 0) });
  } catch (e) {
    next(e);
  }
});

appRouter.get("/goods/:id", optionalUser, async (req, res, next) => {
  try {
    const g = await db("goods").where({ id: Number(req.params.id), on_sale: 1 }).whereNull("deleted_at").first();
    if (!g) throw new HttpError(404, "商品已下架");
    const related = await relatedGoods(g.id, req.auth?.id || null, 8);
    ok(res, { ...publicGoods(g), related });
  } catch (e) {
    next(e);
  }
});

appRouter.get("/goods/:id/related", optionalUser, async (req, res, next) => {
  try {
    ok(res, await relatedGoods(Number(req.params.id), req.auth?.id || null, 8));
  } catch (e) {
    next(e);
  }
});

appRouter.post("/events", optionalUser, async (req, res, next) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    ok(res, await ingestEvents(events, req.auth?.id));
  } catch (e) {
    next(e);
  }
});

appRouter.get("/cart", requireRole("user"), async (req, res, next) => {
  try {
    const rows = await db("cart_items")
      .where("cart_items.user_id", req.auth!.id)
      .join("goods", "goods.id", "cart_items.goods_id")
      .select(
        "cart_items.*",
        "goods.name",
        "goods.cover_url",
        "goods.thumb_url",
        "goods.price_cent",
        "goods.stock",
        "goods.on_sale",
        "goods.unit",
        "goods.deleted_at"
      );
    ok(
      res,
      rows.map((r: Record<string, unknown>) => {
        const sale = salePriceOf(r as any);
        const cover = publicUrl(String(r.cover_url || "")) || publicUrl("/static/placeholders/empty.png");
        return {
          id: r.id,
          goodsId: r.goods_id,
          qty: r.qty,
          name: r.name,
          coverUrl: cover,
          thumbUrl: publicUrl(String(r.thumb_url || "")) || cover,
          priceCent: sale.priceCent,
          originPriceCent: sale.originCent,
          unit: r.unit,
          stock: r.stock,
          invalid: !r.on_sale || r.deleted_at || Number(r.stock) <= 0,
        };
      })
    );
  } catch (e) {
    next(e);
  }
});

appRouter.post("/cart", requireRole("user"), async (req, res, next) => {
  try {
    const body = z.object({ goodsId: z.number(), qty: z.number().int().min(1) }).parse(req.body);
    const g = await db("goods").where({ id: body.goodsId, on_sale: 1 }).whereNull("deleted_at").first();
    if (!g) throw new HttpError(409, "商品已下架", 10002);
    if (g.stock < body.qty) throw new HttpError(409, "库存不足", 10001);
    const exist = await db("cart_items").where({ user_id: req.auth!.id, goods_id: body.goodsId }).first();
    if (exist) {
      const qty = Math.min(g.stock, exist.qty + body.qty);
      await db("cart_items").where({ id: exist.id }).update({ qty });
    } else {
      await db("cart_items").insert({ user_id: req.auth!.id, goods_id: body.goodsId, qty: Math.min(g.stock, body.qty) });
    }
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

appRouter.put("/cart/:id", requireRole("user"), async (req, res, next) => {
  try {
    const body = z.object({ qty: z.number().int().min(1) }).parse(req.body);
    const row = await db("cart_items").where({ id: Number(req.params.id), user_id: req.auth!.id }).first();
    if (!row) throw new HttpError(404, "购物车项不存在");
    const g = await db("goods").where({ id: row.goods_id }).first();
    if (!g) throw new HttpError(404, "商品不存在");
    await db("cart_items").where({ id: row.id }).update({ qty: Math.min(g.stock, body.qty) });
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

appRouter.delete("/cart/:id", requireRole("user"), async (req, res, next) => {
  try {
    await db("cart_items").where({ id: Number(req.params.id), user_id: req.auth!.id }).delete();
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

appRouter.get("/addresses", requireRole("user"), async (req, res, next) => {
  try {
    ok(res, await db("addresses").where({ user_id: req.auth!.id }).orderBy("is_default", "desc").orderBy("id", "desc"));
  } catch (e) {
    next(e);
  }
});

appRouter.post("/addresses", requireRole("user"), async (req, res, next) => {
  try {
    const body = z
      .object({
        contactName: z.string().min(1).max(32),
        phone: z.string().min(6).max(20),
        province: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        detail: z.string().min(1).max(120),
        isDefault: z.boolean().optional(),
      })
      .parse(req.body);
    if (body.isDefault) await db("addresses").where({ user_id: req.auth!.id }).update({ is_default: 0 });
    const [id] = await db("addresses").insert({
      user_id: req.auth!.id,
      contact_name: body.contactName,
      phone: body.phone,
      province: body.province || "",
      city: body.city || "",
      district: body.district || "",
      detail: body.detail,
      is_default: body.isDefault ? 1 : 0,
    });
    ok(res, await db("addresses").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

appRouter.put("/addresses/:id", requireRole("user"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await db("addresses").where({ id, user_id: req.auth!.id }).first();
    if (!row) throw new HttpError(404, "地址不存在");
    const b = req.body || {};
    if (b.isDefault) await db("addresses").where({ user_id: req.auth!.id }).update({ is_default: 0 });
    await db("addresses")
      .where({ id })
      .update({
        contact_name: b.contactName ?? row.contact_name,
        phone: b.phone ?? row.phone,
        province: b.province ?? row.province,
        city: b.city ?? row.city,
        district: b.district ?? row.district,
        detail: b.detail ?? row.detail,
        is_default: b.isDefault ? 1 : row.is_default,
      });
    ok(res, await db("addresses").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

appRouter.delete("/addresses/:id", requireRole("user"), async (req, res, next) => {
  try {
    await db("addresses").where({ id: Number(req.params.id), user_id: req.auth!.id }).delete();
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

appRouter.get("/cart/upsell", requireRole("user"), async (req, res, next) => {
  try {
    ok(res, await cartUpsell(req.auth!.id));
  } catch (e) {
    next(e);
  }
});

appRouter.post("/orders/preview", requireRole("user"), async (req, res, next) => {
  try {
    const body = z
      .object({
        fulfillType: z.enum(["PICKUP", "DELIVERY"]),
        addressId: z.number().nullable().optional(),
        items: z.array(z.object({ goodsId: z.number(), qty: z.number().int().min(1) })).min(1),
        userCouponId: z.number().nullable().optional(),
        usePoints: z.boolean().optional(),
        activityType: z.enum(["NORMAL", "GROUP_BUY", "SECKILL"]).optional(),
        activityId: z.number().nullable().optional(),
        teamId: z.number().nullable().optional(),
      })
      .parse(req.body);
    ok(
      res,
      await previewOrder(req.auth!.id, body.items, body.fulfillType, body.addressId, {
        userCouponId: body.userCouponId,
        usePoints: body.usePoints,
        activityType: body.activityType,
        activityId: body.activityId,
        teamId: body.teamId,
      })
    );
  } catch (e) {
    next(e);
  }
});

appRouter.post("/orders", requireRole("user"), async (req, res, next) => {
  try {
    const body = z
      .object({
        fulfillType: z.enum(["PICKUP", "DELIVERY"]),
        addressId: z.number().nullable().optional(),
        remark: z.string().max(80).optional(),
        items: z.array(z.object({ goodsId: z.number(), qty: z.number().int().min(1) })).min(1),
        from: z.string().optional(),
        userCouponId: z.number().nullable().optional(),
        usePoints: z.boolean().optional(),
        activityType: z.enum(["NORMAL", "GROUP_BUY", "SECKILL"]).optional(),
        activityId: z.number().nullable().optional(),
        teamId: z.number().nullable().optional(),
      })
      .parse(req.body);
    const order = await createOrder({
      userId: req.auth!.id,
      items: body.items,
      fulfillType: body.fulfillType,
      addressId: body.addressId,
      remark: body.remark,
      from: body.from,
      userCouponId: body.userCouponId,
      usePoints: body.usePoints,
      activityType: body.activityType,
      activityId: body.activityId,
      teamId: body.teamId,
    });
    ok(res, order);
  } catch (e) {
    next(e);
  }
});

appRouter.get("/orders", requireRole("user"), async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req.query as Record<string, unknown>);
    const q = db("orders").where({ user_id: req.auth!.id }).modify((b) => {
      if (req.query.status) b.where({ status: String(req.query.status) });
    });
    const total = await q.clone().count({ c: "*" }).first();
    const list = await q.orderBy("id", "desc").offset(offset).limit(pageSize);
    ok(res, { list, page, pageSize, total: Number(total?.c || 0) });
  } catch (e) {
    next(e);
  }
});

appRouter.get("/orders/:id", requireRole("user"), async (req, res, next) => {
  try {
    const detail = await loadOrderDetail(Number(req.params.id));
    if (!detail || detail.user_id !== req.auth!.id) throw new HttpError(404, "订单不存在");
    ok(res, {
      ...detail,
      user: detail.user
        ? { id: detail.user.id, nickname: detail.user.nickname, phone: detail.user.phone }
        : null,
    });
  } catch (e) {
    next(e);
  }
});

appRouter.post("/orders/:id/pay", requireRole("user"), async (req, res, next) => {
  try {
    const order = await db("orders").where({ id: Number(req.params.id), user_id: req.auth!.id }).first();
    if (!order) throw new HttpError(404, "订单不存在");
    if (order.status !== ST.PENDING_PAY) throw new HttpError(409, "订单不可支付", 10003);
    if (!config.mockPay && (!config.wxMchId || !config.wxPayKey)) {
      throw new HttpError(503, "未配置微信支付，请使用 MOCK_PAY 或完成商户进件");
    }
    ok(res, mockPayParams(order.order_no));
  } catch (e) {
    next(e);
  }
});

appRouter.post("/orders/:id/mock-pay", requireRole("user"), async (req, res, next) => {
  try {
    if (!config.mockPay) throw new HttpError(403, "未开启模拟支付");
    const order = await db("orders").where({ id: Number(req.params.id), user_id: req.auth!.id }).first();
    if (!order) throw new HttpError(404, "订单不存在");
    ok(res, await markPaid(order.id, `mock_${Date.now()}`, { mock: true }));
  } catch (e) {
    next(e);
  }
});

appRouter.post("/orders/:id/cancel", requireRole("user"), async (req, res, next) => {
  try {
    const order = await db("orders").where({ id: Number(req.params.id), user_id: req.auth!.id }).first();
    if (!order) throw new HttpError(404, "订单不存在");
    ok(res, await cancelOrder({ orderId: order.id, operatorType: "USER", operatorId: req.auth!.id, reason: req.body?.reason }));
  } catch (e) {
    next(e);
  }
});

appRouter.post("/orders/:id/rebuy", requireRole("user"), async (req, res, next) => {
  try {
    const order = await db("orders").where({ id: Number(req.params.id), user_id: req.auth!.id }).first();
    if (!order) throw new HttpError(404, "订单不存在");
    const items = await db("order_items").where({ order_id: order.id });
    const skipped: string[] = [];
    for (const it of items) {
      const g = await db("goods").where({ id: it.goods_id, on_sale: 1 }).whereNull("deleted_at").first();
      if (!g || g.stock < 1) {
        skipped.push(it.name_snapshot);
        continue;
      }
      const exist = await db("cart_items").where({ user_id: req.auth!.id, goods_id: g.id }).first();
      const qty = Math.min(g.stock, it.qty);
      if (exist) await db("cart_items").where({ id: exist.id }).update({ qty });
      else await db("cart_items").insert({ user_id: req.auth!.id, goods_id: g.id, qty });
    }
    ok(res, { skipped });
  } catch (e) {
    next(e);
  }
});

appRouter.get("/coupons", optionalUser, async (req, res, next) => {
  try {
    ok(res, await listClaimableCoupons(req.auth?.id));
  } catch (e) {
    next(e);
  }
});

appRouter.post("/coupons/:id/claim", requireRole("user"), async (req, res, next) => {
  try {
    ok(res, await claimCoupon(req.auth!.id, Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

appRouter.get("/me/coupons", requireRole("user"), async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : "";
    const q = db("user_coupons")
      .join("coupons", "coupons.id", "user_coupons.coupon_id")
      .where("user_coupons.user_id", req.auth!.id)
      .modify((b) => {
        if (status) b.where("user_coupons.status", status);
      })
      .select("user_coupons.*", "coupons.name", "coupons.type", "coupons.min_amount_cent", "coupons.reduce_cent", "coupons.discount_bp", "coupons.end_at");
    ok(res, await q.orderBy("user_coupons.id", "desc"));
  } catch (e) {
    next(e);
  }
});

appRouter.get("/me/points", requireRole("user"), async (req, res, next) => {
  try {
    const user = await db("users").where({ id: req.auth!.id }).first();
    const ledger = await db("points_ledger").where({ user_id: req.auth!.id }).orderBy("id", "desc").limit(50);
    ok(res, { balance: Number(user?.points_balance || 0), ledger });
  } catch (e) {
    next(e);
  }
});

appRouter.post("/subscribe", requireRole("user"), async (req, res, next) => {
  try {
    const body = z.object({ scene: z.string().min(1), accepted: z.boolean() }).parse(req.body);
    ok(res, await setSubscribe(req.auth!.id, body.scene, body.accepted));
  } catch (e) {
    next(e);
  }
});

appRouter.get("/me/notices", requireRole("user"), async (req, res, next) => {
  try {
    const { page, pageSize } = parsePage(req.query as Record<string, unknown>);
    ok(res, await listNotifyLogs(page, pageSize, req.auth!.id));
  } catch (e) {
    next(e);
  }
});

appRouter.get("/group-buys", async (_req, res, next) => {
  try {
    ok(res, await listActiveGroupBuys());
  } catch (e) {
    next(e);
  }
});

appRouter.get("/group-buys/teams/:id", async (req, res, next) => {
  try {
    const team = await loadTeam(Number(req.params.id));
    if (!team) throw new HttpError(404, "拼团不存在");
    ok(res, team);
  } catch (e) {
    next(e);
  }
});

appRouter.post("/group-buys/:id/open", requireRole("user"), async (req, res, next) => {
  try {
    const body = z
      .object({
        qty: z.number().int().min(1).default(1),
        fulfillType: z.enum(["PICKUP", "DELIVERY"]),
        addressId: z.number().nullable().optional(),
        remark: z.string().max(80).optional(),
        userCouponId: z.number().nullable().optional(),
        usePoints: z.boolean().optional(),
      })
      .parse(req.body);
    const act = await db("group_buy_activities").where({ id: Number(req.params.id) }).whereNull("deleted_at").first();
    if (!act || !act.enabled || !activityWindowOk(act)) throw new HttpError(409, "拼团活动未开始或已结束");
    const expire = new Date(Date.now() + Number(act.expire_hours || 24) * 3600 * 1000);
    const [teamId] = await db("group_buy_teams").insert({
      activity_id: act.id,
      leader_user_id: req.auth!.id,
      status: "OPEN",
      expire_at: expire,
    });
    const order = await createOrder({
      userId: req.auth!.id,
      items: [{ goodsId: act.goods_id, qty: body.qty }],
      fulfillType: body.fulfillType,
      addressId: body.addressId,
      remark: body.remark,
      userCouponId: body.userCouponId,
      usePoints: body.usePoints,
      activityType: "GROUP_BUY",
      activityId: act.id,
      teamId,
    });
    await db("group_buy_members").insert({
      team_id: teamId,
      user_id: req.auth!.id,
      order_id: order.id,
      joined_at: db.fn.now(),
    });
    ok(res, { teamId, order });
  } catch (e) {
    next(e);
  }
});

appRouter.post("/group-buys/teams/:id/join", requireRole("user"), async (req, res, next) => {
  try {
    const body = z
      .object({
        qty: z.number().int().min(1).default(1),
        fulfillType: z.enum(["PICKUP", "DELIVERY"]),
        addressId: z.number().nullable().optional(),
        remark: z.string().max(80).optional(),
        userCouponId: z.number().nullable().optional(),
        usePoints: z.boolean().optional(),
      })
      .parse(req.body);
    const team = await db("group_buy_teams").where({ id: Number(req.params.id) }).first();
    if (!team || team.status !== "OPEN") throw new HttpError(409, "该团不可加入");
    if (new Date(team.expire_at).getTime() < Date.now()) throw new HttpError(409, "该团已过期");
    const exist = await db("group_buy_members").where({ team_id: team.id, user_id: req.auth!.id }).first();
    if (exist) throw new HttpError(409, "你已在该团中");
    const act = await db("group_buy_activities").where({ id: team.activity_id }).first();
    if (!act || !activityWindowOk(act)) throw new HttpError(409, "拼团活动已结束");
    const order = await createOrder({
      userId: req.auth!.id,
      items: [{ goodsId: act.goods_id, qty: body.qty }],
      fulfillType: body.fulfillType,
      addressId: body.addressId,
      remark: body.remark,
      userCouponId: body.userCouponId,
      usePoints: body.usePoints,
      activityType: "GROUP_BUY",
      activityId: act.id,
      teamId: team.id,
    });
    await db("group_buy_members").insert({
      team_id: team.id,
      user_id: req.auth!.id,
      order_id: order.id,
      joined_at: db.fn.now(),
    });
    ok(res, { teamId: team.id, order });
  } catch (e) {
    next(e);
  }
});

appRouter.get("/seckills", async (_req, res, next) => {
  try {
    ok(res, await listActiveSeckills());
  } catch (e) {
    next(e);
  }
});
