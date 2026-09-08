import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { db } from "./db";
import { ok } from "./http";
import { HttpError } from "./http";
import { parsePage, maskPhone, yuanToCent } from "./http";
import { requireRole, signToken } from "./auth";
import { getSettings, saveSettings } from "./settings";
import {
  cancelOrder,
  completeDeliver,
  loadOrderDetail,
  packOrder,
  pickupOrder,
  startDeliver,
  ST,
} from "./orderService";
import { markPaid } from "./orderService";
import { funnelReport, goodsReport, recomputeHeat, signals } from "./analytics";
import { fillRecommend } from "./recommend";
import { config } from "./config";

const uploadDir = config.uploadDir;
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 8) || ".jpg";
      cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(new Error("仅支持 jpg/png/webp"));
    else cb(null, true);
  },
});

export const adminRouter = Router();

adminRouter.post("/auth/login", async (req, res, next) => {
  try {
    const body = z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(req.body);
    const user = await db("admin_users").where({ username: body.username, status: 1 }).first();
    if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
      throw new HttpError(400, "账号或密码错误");
    }
    const token = signToken({ id: user.id, role: "admin" });
    ok(res, { token, admin: { id: user.id, username: user.username, displayName: user.display_name } });
  } catch (e) {
    next(e);
  }
});

adminRouter.use(requireRole("admin"));

adminRouter.post("/auth/password", async (req, res, next) => {
  try {
    const body = z.object({ oldPassword: z.string(), newPassword: z.string().min(8) }).parse(req.body);
    const user = await db("admin_users").where({ id: req.auth!.id }).first();
    if (!user || !bcrypt.compareSync(body.oldPassword, user.password_hash)) {
      throw new HttpError(400, "原密码错误");
    }
    await db("admin_users")
      .where({ id: user.id })
      .update({ password_hash: bcrypt.hashSync(body.newPassword, 10) });
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/dashboard/summary", async (_req, res, next) => {
  try {
    const pendingPack = await db("orders").where({ status: ST.PENDING_PACK }).count({ c: "*" }).first();
    const waitPickup = await db("orders").where({ status: ST.WAIT_PICKUP }).count({ c: "*" }).first();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
    const todayPaid = await db("orders")
      .whereNotNull("paid_at")
      .where("paid_at", ">=", `${today} 00:00:00`)
      .select(db.raw("COUNT(*) as c"), db.raw("IFNULL(SUM(pay_amount_cent),0) as amount"));
    const settings = await getSettings();
    const lowStock = await db("goods")
      .whereNull("deleted_at")
      .where({ on_sale: 1 })
      .where("stock", "<=", settings.low_stock_threshold)
      .count({ c: "*" })
      .first();
    ok(res, {
      pendingPack: Number(pendingPack?.c || 0),
      waitPickup: Number(waitPickup?.c || 0),
      todayOrders: Number(todayPaid[0]?.c || 0),
      todayAmountCent: Number(todayPaid[0]?.amount || 0),
      lowStock: Number(lowStock?.c || 0),
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/categories", async (_req, res, next) => {
  try {
    const list = await db("categories").whereNull("deleted_at").orderBy("sort", "desc").orderBy("id", "asc");
    ok(res, list);
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/categories", async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1).max(20), sort: z.number().optional(), enabled: z.boolean().optional() }).parse(req.body);
    const [id] = await db("categories").insert({
      name: body.name,
      sort: body.sort ?? 0,
      enabled: body.enabled === false ? 0 : 1,
    });
    ok(res, await db("categories").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/categories/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = z
      .object({ name: z.string().min(1).max(20).optional(), sort: z.number().optional(), enabled: z.boolean().optional() })
      .parse(req.body);
    const patch: Record<string, unknown> = {};
    if (body.name) patch.name = body.name;
    if (body.sort != null) patch.sort = body.sort;
    if (body.enabled != null) patch.enabled = body.enabled ? 1 : 0;
    await db("categories").where({ id }).update(patch);
    ok(res, await db("categories").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/categories/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const used = await db("goods").where({ category_id: id }).whereNull("deleted_at").first();
    if (used) throw new HttpError(409, "请先移动该分类下的商品");
    await db("categories").where({ id }).update({ deleted_at: db.fn.now() });
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/goods", async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req.query as Record<string, unknown>);
    const q = db("goods")
      .leftJoin("categories as c", "c.id", "goods.category_id")
      .whereNull("goods.deleted_at")
      .modify((b) => {
        if (req.query.keyword) b.where("goods.name", "like", `%${String(req.query.keyword)}%`);
        if (req.query.categoryId) b.where("goods.category_id", Number(req.query.categoryId));
        if (req.query.onSale === "1" || req.query.onSale === "0") b.where("goods.on_sale", Number(req.query.onSale));
      });
    const total = await q.clone().clearSelect().clearOrder().count({ c: "*" }).first();
    const list = await q
      .select("goods.*", "c.name as category_name")
      .orderBy("goods.id", "desc")
      .offset(offset)
      .limit(pageSize);
    ok(res, { list, page, pageSize, total: Number(total?.c || 0) });
  } catch (e) {
    next(e);
  }
});

function goodsBody(body: unknown, partial = false) {
  const base = z.object({
    name: z.string().min(1).max(40),
    subtitle: z.string().max(80).optional(),
    categoryId: z.number(),
    priceYuan: z.number().positive(),
    originPriceYuan: z.number().positive().optional().nullable(),
    unit: z.string().min(1).max(8),
    stock: z.number().int().min(0),
    coverUrl: z.string().min(1),
    images: z.array(z.string()).max(8).optional(),
    detail: z.string().optional(),
    onSale: z.boolean().optional(),
    sort: z.number().optional(),
    manualWeight: z.number().int().min(-50).max(50).optional(),
  });
  return partial ? base.partial().parse(body) : base.parse(body);
}

adminRouter.post("/goods", async (req, res, next) => {
  try {
    const body = goodsBody(req.body, false) as ReturnType<typeof goodsBody> & { priceYuan: number };
    const [id] = await db("goods").insert({
      name: body.name,
      subtitle: body.subtitle || "",
      category_id: body.categoryId,
      price_cent: yuanToCent(body.priceYuan),
      origin_price_cent: body.originPriceYuan ? yuanToCent(body.originPriceYuan) : null,
      unit: body.unit,
      stock: body.stock,
      cover_url: body.coverUrl,
      images: JSON.stringify(body.images || []),
      detail: body.detail || "",
      on_sale: body.onSale === false ? 0 : 1,
      sort: body.sort ?? 0,
      manual_weight: body.manualWeight ?? 0,
    });
    ok(res, await db("goods").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/goods/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = goodsBody(req.body, true) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.name) patch.name = body.name;
    if (body.subtitle != null) patch.subtitle = body.subtitle;
    if (body.categoryId) patch.category_id = body.categoryId;
    if (body.priceYuan != null) patch.price_cent = yuanToCent(Number(body.priceYuan));
    if (body.originPriceYuan !== undefined) {
      patch.origin_price_cent = body.originPriceYuan ? yuanToCent(Number(body.originPriceYuan)) : null;
    }
    if (body.unit) patch.unit = body.unit;
    if (body.stock != null) patch.stock = body.stock;
    if (body.coverUrl) patch.cover_url = body.coverUrl;
    if (body.images) patch.images = JSON.stringify(body.images);
    if (body.detail != null) patch.detail = body.detail;
    if (body.onSale != null) patch.on_sale = body.onSale ? 1 : 0;
    if (body.sort != null) patch.sort = body.sort;
    if (body.manualWeight != null) patch.manual_weight = body.manualWeight;
    await db("goods").where({ id }).update(patch);
    ok(res, await db("goods").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/goods/:id/on-sale", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const onSale = Boolean(req.body.onSale);
    await db("goods").where({ id }).update({ on_sale: onSale ? 1 : 0 });
    ok(res, await db("goods").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/goods/:id/weight", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const w = z.object({ manualWeight: z.number().int().min(-50).max(50) }).parse(req.body);
    await db("goods").where({ id }).update({ manual_weight: w.manualWeight });
    ok(res, await db("goods").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/goods/weight/batch", async (req, res, next) => {
  try {
    const body = z
      .object({ ids: z.array(z.number()).min(1), delta: z.number().int(), reset: z.boolean().optional() })
      .parse(req.body);
    if (body.reset) await db("goods").whereIn("id", body.ids).update({ manual_weight: 0 });
    else {
      const rows = await db("goods").whereIn("id", body.ids);
      for (const r of rows) {
        const next = Math.max(-50, Math.min(50, r.manual_weight + body.delta));
        await db("goods").where({ id: r.id }).update({ manual_weight: next });
      }
    }
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/goods/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db("goods").where({ id }).update({ deleted_at: db.fn.now(), on_sale: 0 });
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/goods/:id", async (req, res, next) => {
  try {
    const g = await db("goods").where({ id: Number(req.params.id) }).whereNull("deleted_at").first();
    if (!g) throw new HttpError(404, "商品不存在");
    try {
      g.images = typeof g.images === "string" ? JSON.parse(g.images || "[]") : g.images || [];
    } catch {
      g.images = [];
    }
    ok(res, g);
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/uploads/image", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) return next(new HttpError(400, err.message || "上传失败"));
    try {
      if (!req.file) throw new HttpError(400, "未选择文件");
      const url = `${config.publicUrl}/uploads/${req.file.filename}`;
      ok(res, { url });
    } catch (e) {
      next(e);
    }
  });
});

adminRouter.get("/orders", async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req.query as Record<string, unknown>);
    const q = db("orders")
      .leftJoin("users", "users.id", "orders.user_id")
      .modify((b) => {
        if (req.query.status) b.where("orders.status", String(req.query.status));
        if (req.query.orderNo) b.where("orders.order_no", "like", `%${String(req.query.orderNo)}%`);
        if (req.query.phone) b.where("users.phone", "like", `%${String(req.query.phone)}%`);
      });
    const total = await q.clone().clearSelect().clearOrder().count({ c: "*" }).first();
    const list = await q
      .select("orders.*", "users.nickname", "users.phone")
      .orderBy("orders.id", "desc")
      .offset(offset)
      .limit(pageSize);
    ok(res, {
      list: list.map((o: Record<string, unknown>) => ({ ...o, phone: maskPhone(String(o.phone || "")) })),
      page,
      pageSize,
      total: Number(total?.c || 0),
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/orders/:id", async (req, res, next) => {
  try {
    const detail = await loadOrderDetail(Number(req.params.id));
    if (!detail) throw new HttpError(404, "订单不存在");
    ok(res, { ...detail, user: detail.user ? { ...detail.user, phone: maskPhone(detail.user.phone), openid: undefined } : null });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/orders/:id/pack", async (req, res, next) => {
  try {
    ok(res, await packOrder(Number(req.params.id), req.auth!.id));
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/orders/:id/pickup", async (req, res, next) => {
  try {
    const code = String(req.body.code || "");
    ok(res, await pickupOrder(Number(req.params.id), code, req.auth!.id));
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/orders/:id/deliver/start", async (req, res, next) => {
  try {
    ok(res, await startDeliver(Number(req.params.id), req.auth!.id));
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/orders/:id/deliver/complete", async (req, res, next) => {
  try {
    ok(res, await completeDeliver(Number(req.params.id), req.auth!.id));
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/orders/:id/cancel", async (req, res, next) => {
  try {
    ok(res, await cancelOrder({ orderId: Number(req.params.id), operatorType: "ADMIN", operatorId: req.auth!.id, reason: req.body.reason }));
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/orders/:id/mock-pay", async (req, res, next) => {
  try {
    if (!config.mockPay) throw new HttpError(403, "未开启模拟支付");
    ok(res, await markPaid(Number(req.params.id), `mock_${Date.now()}`, { mock: true }));
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/banners", async (_req, res, next) => {
  try {
    ok(res, await db("banners").orderBy("sort", "desc").orderBy("id", "desc"));
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/banners", async (req, res, next) => {
  try {
    const body = z
      .object({
        imageUrl: z.string().min(1),
        title: z.string().max(40).optional(),
        linkType: z.enum(["NONE", "GOODS", "CATEGORY", "PATH"]).optional(),
        linkValue: z.string().optional(),
        sort: z.number().optional(),
        enabled: z.boolean().optional(),
      })
      .parse(req.body);
    if (body.enabled !== false) {
      const n = await db("banners").where({ enabled: 1 }).count({ c: "*" }).first();
      if (Number(n?.c || 0) >= 5) throw new HttpError(409, "最多启用 5 张轮播");
    }
    const [id] = await db("banners").insert({
      image_url: body.imageUrl,
      title: body.title || "",
      link_type: body.linkType || "NONE",
      link_value: body.linkValue || "",
      sort: body.sort ?? 0,
      enabled: body.enabled === false ? 0 : 1,
    });
    ok(res, await db("banners").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/banners/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const patch: Record<string, unknown> = {};
    if (body.imageUrl) patch.image_url = body.imageUrl;
    if (body.title != null) patch.title = body.title;
    if (body.linkType) patch.link_type = body.linkType;
    if (body.linkValue != null) patch.link_value = body.linkValue;
    if (body.sort != null) patch.sort = body.sort;
    if (body.enabled != null) patch.enabled = body.enabled ? 1 : 0;
    if (patch.enabled === 1) {
      const n = await db("banners").where({ enabled: 1 }).whereNot({ id }).count({ c: "*" }).first();
      if (Number(n?.c || 0) >= 5) throw new HttpError(409, "最多启用 5 张轮播");
    }
    await db("banners").where({ id }).update(patch);
    ok(res, await db("banners").where({ id }).first());
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/banners/:id", async (req, res, next) => {
  try {
    await db("banners").where({ id: Number(req.params.id) }).delete();
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/settings", async (_req, res, next) => {
  try {
    ok(res, await getSettings());
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/settings", async (req, res, next) => {
  try {
    ok(res, await saveSettings(req.body || {}));
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/reports/funnel", async (req, res, next) => {
  try {
    const from = String(req.query.from || new Date().toISOString().slice(0, 10));
    const to = String(req.query.to || from);
    ok(res, await funnelReport(from, to));
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/reports/goods", async (req, res, next) => {
  try {
    const { page, pageSize } = parsePage(req.query as Record<string, unknown>);
    const from = String(req.query.from || new Date().toISOString().slice(0, 10));
    const to = String(req.query.to || from);
    ok(
      res,
      await goodsReport({
        from,
        to,
        categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
        keyword: req.query.keyword ? String(req.query.keyword) : undefined,
        page,
        pageSize,
      })
    );
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/reports/signals", async (req, res, next) => {
  try {
    const from = String(req.query.from || new Date().toISOString().slice(0, 10));
    const to = String(req.query.to || from);
    ok(res, await signals(from, to));
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/jobs/recompute-heat", async (_req, res, next) => {
  try {
    await recomputeHeat();
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/recommend-slots/:slotId", async (req, res, next) => {
  try {
    const slotId = String(req.params.slotId);
    const slot = await db("recommend_slots").where({ slot_id: slotId }).first();
    const items = await db("recommend_slot_items")
      .where({ slot_id: slotId })
      .orderBy("pin_order", "asc")
      .join("goods", "goods.id", "recommend_slot_items.goods_id")
      .select("recommend_slot_items.*", "goods.name", "goods.cover_url", "goods.stock", "goods.heat_score");
    ok(res, { slot, items });
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/recommend-slots/:slotId", async (req, res, next) => {
  try {
    const slotId = String(req.params.slotId);
    const body = z
      .object({
        title: z.string().optional(),
        capacity: z.number().int().min(4).max(20).optional(),
        strategy: z.enum(["PIN_THEN_HEAT", "PIN_THEN_SALES", "PIN_THEN_NEW", "MANUAL_ONLY"]).optional(),
        enabled: z.boolean().optional(),
        pins: z.array(z.object({ goodsId: z.number(), pinOrder: z.number() })).optional(),
      })
      .parse(req.body);
    const slot = await db("recommend_slots").where({ slot_id: slotId }).first();
    if (!slot) throw new HttpError(404, "推荐位不存在");
    const cap = body.capacity ?? slot.capacity;
    if (body.pins && body.pins.length > cap) throw new HttpError(400, "置顶数量超过容量");
    await db("recommend_slots").where({ slot_id: slotId }).update({
      title: body.title ?? slot.title,
      capacity: cap,
      strategy: body.strategy ?? slot.strategy,
      enabled: body.enabled == null ? slot.enabled : body.enabled ? 1 : 0,
    });
    if (body.pins) {
      await db("recommend_slot_items").where({ slot_id: slotId }).delete();
      if (body.pins.length) {
        await db("recommend_slot_items").insert(
          body.pins.map((p) => ({ slot_id: slotId, goods_id: p.goodsId, pin_order: p.pinOrder }))
        );
      }
    }
    ok(res, true);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/recommend-slots/:slotId/preview", async (req, res, next) => {
  try {
    ok(res, await fillRecommend(String(req.params.slotId)));
  } catch (e) {
    next(e);
  }
});
