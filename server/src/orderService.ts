import type { Knex } from "knex";
import { db } from "./db";
import { HttpError } from "./http";
import { getSettings } from "./settings";
import { bumpPayStats } from "./analytics";
import { changePoints, loadUsableCoupon } from "./marketing";
import { activityWindowOk } from "./campaigns";
import { notifyPackReady } from "./notify";
import { pointsRedeem, salePriceOf, type LineInput, type PricedLine } from "./pricing";

export const ST = {
  PENDING_PAY: "PENDING_PAY",
  GROUPING: "GROUPING",
  PENDING_PACK: "PENDING_PACK",
  WAIT_PICKUP: "WAIT_PICKUP",
  WAIT_DELIVER: "WAIT_DELIVER",
  DELIVERING: "DELIVERING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof ST)[keyof typeof ST];

export type OrderExtras = {
  userCouponId?: number | null;
  usePoints?: boolean;
  activityType?: "NORMAL" | "GROUP_BUY" | "SECKILL";
  activityId?: number | null;
  teamId?: number | null;
};

async function logStatus(
  trx: Knex | Knex.Transaction,
  orderId: number,
  fromStatus: string | null,
  toStatus: string,
  operatorType: string,
  operatorId?: number | null,
  note?: string
) {
  await trx("order_logs").insert({
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    operator_type: operatorType,
    operator_id: operatorId || null,
    note: note || null,
  });
}

export async function nextOrderNo(trx: Knex.Transaction) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
  const prefix = day;
  const row = await trx("orders")
    .where("order_no", "like", `${prefix}%`)
    .orderBy("order_no", "desc")
    .first();
  let seq = 1;
  if (row?.order_no) seq = Number(row.order_no.slice(8)) + 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

async function uniquePickupCode(trx: Knex.Transaction) {
  for (let i = 0; i < 20; i++) {
    const code = String(100000 + Math.floor(Math.random() * 900000));
    const clash = await trx("orders")
      .where({ pickup_code: code })
      .whereNotIn("status", [ST.COMPLETED, ST.CANCELLED])
      .first();
    if (!clash) return code;
  }
  throw new HttpError(500, "提货码生成失败");
}

async function resolveActivity(extras: OrderExtras, items: LineInput[]) {
  const type = extras.activityType || "NORMAL";
  if (type === "NORMAL") return { type, group: null as any, seckill: null as any };
  if (type === "GROUP_BUY") {
    const act = await db("group_buy_activities").where({ id: extras.activityId || 0 }).whereNull("deleted_at").first();
    if (!act || !act.enabled || !activityWindowOk(act)) throw new HttpError(409, "拼团活动未开始或已结束");
    if (items.length !== 1 || items[0].goodsId !== act.goods_id) throw new HttpError(400, "拼团订单只能包含活动商品");
    if (extras.teamId) {
      const team = await db("group_buy_teams").where({ id: extras.teamId }).first();
      if (!team || team.status !== "OPEN") throw new HttpError(409, "该团不可加入");
      if (new Date(team.expire_at).getTime() < Date.now()) throw new HttpError(409, "该团已过期");
    }
    return { type, group: act, seckill: null as any };
  }
  const act = await db("seckill_activities").where({ id: extras.activityId || 0 }).whereNull("deleted_at").first();
  if (!act || !act.enabled || !activityWindowOk(act)) throw new HttpError(409, "秒杀活动未开始或已结束");
  if (items.length !== 1 || items[0].goodsId !== act.goods_id) throw new HttpError(400, "秒杀订单只能包含活动商品");
  if (Number(act.seckill_stock) < items[0].qty) throw new HttpError(409, "秒杀库存不足", 10001);
  return { type, group: null as any, seckill: act };
}

export async function previewOrder(
  userId: number,
  items: LineInput[],
  fulfillType: string,
  addressId?: number | null,
  extras: OrderExtras = {}
) {
  const settings = await getSettings();
  if (settings.pause_order) throw new HttpError(409, "店主休息中，暂不接单", 10005);
  if (!items.length) throw new HttpError(400, "请选择商品");
  if (fulfillType === "DELIVERY" && !settings.delivery_enabled) throw new HttpError(409, "本店暂不支持配送");
  const act = await resolveActivity(extras, items);

  const lines: PricedLine[] = [];
  let goodsAmount = 0;
  for (const it of items) {
    if (it.qty < 1) throw new HttpError(400, "数量不合法");
    const g = await db("goods").where({ id: it.goodsId }).whereNull("deleted_at").first();
    if (!g || !g.on_sale) throw new HttpError(409, "商品已下架", 10002);
    if (g.stock < it.qty) throw new HttpError(409, `「${g.name}」库存不足`, 10001);
    const sale = salePriceOf(g);
    let price = sale.priceCent;
    let isSpecial = sale.isSpecial;
    let isSeckill = false;
    let isGroup = false;
    if (act.seckill) {
      price = Number(act.seckill.seckill_price_cent);
      isSeckill = true;
      isSpecial = false;
    } else if (act.group) {
      price = Number(act.group.group_price_cent);
      isGroup = true;
      isSpecial = false;
    }
    const amount = price * it.qty;
    goodsAmount += amount;
    lines.push({
      goodsId: g.id,
      name: g.name,
      coverUrl: g.cover_url,
      unit: g.unit,
      qty: it.qty,
      stock: g.stock,
      listPriceCent: Number(g.price_cent),
      priceCent: price,
      amountCent: amount,
      isSpecial,
      isSeckill,
      isGroup,
      isPromo: isSpecial || isSeckill || isGroup,
    });
  }
  let freight = 0;
  let address = null;
  if (fulfillType === "DELIVERY") {
    if (!addressId) throw new HttpError(400, "请选择收货地址");
    address = await db("addresses").where({ id: addressId, user_id: userId }).first();
    if (!address) throw new HttpError(400, "地址无效");
    freight = settings.freight_cent;
    if (settings.free_freight_over_cent > 0 && goodsAmount >= settings.free_freight_over_cent) freight = 0;
  }

  let couponDiscountCent = 0;
  let couponName: string | null = null;
  if (extras.userCouponId) {
    const applied = await loadUsableCoupon(userId, extras.userCouponId, lines, goodsAmount);
    couponDiscountCent = applied.discount;
    couponName = applied.coupon.name;
  }

  const afterCoupon = Math.max(0, goodsAmount + freight - couponDiscountCent);
  const user = await db("users").where({ id: userId }).first();
  const redeem = extras.usePoints
    ? pointsRedeem(Number(user?.points_balance || 0), settings.points_redeem_rate, afterCoupon)
    : { usePoints: 0, useCent: 0 };
  const payAmount = Math.max(0, afterCoupon - redeem.useCent);

  return {
    fulfillType,
    items: lines,
    goodsAmountCent: goodsAmount,
    freightCent: freight,
    discountCent: couponDiscountCent + redeem.useCent,
    couponDiscountCent,
    pointsDiscountCent: redeem.useCent,
    pointsUsed: redeem.usePoints,
    pointsBalance: Number(user?.points_balance || 0),
    couponName,
    payAmountCent: payAmount,
    address,
    pickup: fulfillType === "PICKUP" ? { address: settings.pickup_address, hours: settings.business_hours, phone: settings.phone } : null,
    pauseOrder: settings.pause_order,
    activityType: act.type,
  };
}

export async function createOrder(params: {
  userId: number;
  items: LineInput[];
  fulfillType: "PICKUP" | "DELIVERY";
  addressId?: number | null;
  remark?: string;
  from?: string;
} & OrderExtras) {
  const extras: OrderExtras = {
    userCouponId: params.userCouponId,
    usePoints: params.usePoints,
    activityType: params.activityType,
    activityId: params.activityId,
    teamId: params.teamId,
  };
  const preview = await previewOrder(params.userId, params.items, params.fulfillType, params.addressId, extras);
  const user = await db("users").where({ id: params.userId }).first();
  if (!user?.phone) throw new HttpError(401, "请先微信授权登录", 10010);

  return db.transaction(async (trx) => {
    if (extras.activityType === "SECKILL" && extras.activityId) {
      const used = await trx("order_items")
        .join("orders", "orders.id", "order_items.order_id")
        .where("orders.user_id", params.userId)
        .where("orders.activity_type", "SECKILL")
        .where("orders.activity_id", extras.activityId)
        .whereNot("orders.status", ST.CANCELLED)
        .sum({ q: "order_items.qty" })
        .first();
      const act = await trx("seckill_activities").where({ id: extras.activityId }).forUpdate().first();
      if (!act) throw new HttpError(409, "秒杀活动不存在");
      const already = Number(used?.q || 0);
      const qty = preview.items[0].qty;
      if (already + qty > Number(act.per_user_limit)) throw new HttpError(409, "超出秒杀限购");
      const n = await trx("seckill_activities")
        .where({ id: extras.activityId })
        .where("seckill_stock", ">=", qty)
        .decrement("seckill_stock", qty);
      if (!n) throw new HttpError(409, "秒杀库存不足", 10001);
    }

    for (const line of preview.items) {
      const n = await trx("goods")
        .where({ id: line.goodsId })
        .where("stock", ">=", line.qty)
        .where("on_sale", 1)
        .whereNull("deleted_at")
        .decrement("stock", line.qty);
      if (!n) throw new HttpError(409, `「${line.name}」库存不足`, 10001);
    }
    const orderNo = await nextOrderNo(trx);
    const pickupCode = params.fulfillType === "PICKUP" ? await uniquePickupCode(trx) : null;
    const snapshot =
      params.fulfillType === "DELIVERY"
        ? preview.address
        : { pickup_address: preview.pickup?.address, phone: preview.pickup?.phone, hours: preview.pickup?.hours };
    const [orderId] = await trx("orders").insert({
      order_no: orderNo,
      user_id: params.userId,
      status: ST.PENDING_PAY,
      fulfill_type: params.fulfillType,
      goods_amount_cent: preview.goodsAmountCent,
      freight_cent: preview.freightCent,
      discount_cent: preview.discountCent,
      coupon_discount_cent: preview.couponDiscountCent,
      points_used: preview.pointsUsed,
      points_discount_cent: preview.pointsDiscountCent,
      pay_amount_cent: preview.payAmountCent,
      remark: (params.remark || "").slice(0, 80) || null,
      pickup_code: pickupCode,
      address_snapshot: JSON.stringify(snapshot),
      user_coupon_id: extras.userCouponId || null,
      activity_type: extras.activityType || "NORMAL",
      activity_id: extras.activityId || null,
      team_id: extras.teamId || null,
    });
    await trx("order_items").insert(
      preview.items.map((l) => ({
        order_id: orderId,
        goods_id: l.goodsId,
        name_snapshot: l.name,
        cover_snapshot: l.coverUrl,
        unit_snapshot: l.unit,
        price_cent: l.priceCent,
        qty: l.qty,
        amount_cent: l.amountCent,
      }))
    );
    if (extras.userCouponId) {
      await trx("user_coupons").where({ id: extras.userCouponId, user_id: params.userId, status: "UNUSED" }).update({
        status: "USED",
        used_at: trx.fn.now(),
        order_id: orderId,
      });
    }
    if (preview.pointsUsed > 0) {
      await changePoints(trx, params.userId, -preview.pointsUsed, "REDEEM", orderId, "下单抵扣");
    }
    await logStatus(trx, orderId, null, ST.PENDING_PAY, "USER", params.userId, "创建订单");
    if (params.from === "CART") {
      const ids = preview.items.map((l) => l.goodsId);
      await trx("cart_items").where({ user_id: params.userId }).whereIn("goods_id", ids).delete();
    }
    return trx("orders").where({ id: orderId }).first();
  });
}

export async function restoreStock(trx: Knex.Transaction, orderId: number) {
  const order = await trx("orders").where({ id: orderId }).first();
  const items = await trx("order_items").where({ order_id: orderId });
  for (const it of items) {
    await trx("goods").where({ id: it.goods_id }).increment("stock", it.qty);
  }
  if (order?.activity_type === "SECKILL" && order.activity_id) {
    const qty = items.reduce((s: number, it: { qty: number }) => s + Number(it.qty), 0);
    await trx("seckill_activities").where({ id: order.activity_id }).increment("seckill_stock", qty);
  }
}

export async function promoteGroupIfReady(teamId: number) {
  const team = await db("group_buy_teams").where({ id: teamId }).first();
  if (!team || team.status !== "OPEN") return team;
  const act = await db("group_buy_activities").where({ id: team.activity_id }).first();
  const paid = await db("orders")
    .where({ team_id: teamId })
    .whereIn("status", [ST.GROUPING, ST.PENDING_PACK, ST.WAIT_PICKUP, ST.WAIT_DELIVER, ST.DELIVERING, ST.COMPLETED]);
  if (!act || paid.length < Number(act.required_count)) return team;
  await db.transaction(async (trx) => {
    await trx("group_buy_teams").where({ id: teamId, status: "OPEN" }).update({ status: "SUCCESS", success_at: trx.fn.now() });
    const grouping = await trx("orders").where({ team_id: teamId, status: ST.GROUPING });
    for (const o of grouping) {
      await trx("orders").where({ id: o.id }).update({ status: ST.PENDING_PACK });
      await logStatus(trx, o.id, ST.GROUPING, ST.PENDING_PACK, "SYSTEM", null, "拼团成功");
    }
  });
  return db("group_buy_teams").where({ id: teamId }).first();
}

export async function expireGroupTeams() {
  const teams = await db("group_buy_teams").where({ status: "OPEN" }).where("expire_at", "<", db.fn.now());
  let n = 0;
  for (const team of teams) {
    const act = await db("group_buy_activities").where({ id: team.activity_id }).first();
    const paid = await db("orders").where({ team_id: team.id }).whereIn("status", [ST.GROUPING, ST.PENDING_PACK]);
    if (act && paid.length >= Number(act.required_count)) {
      await promoteGroupIfReady(team.id);
      continue;
    }
    await db("group_buy_teams").where({ id: team.id }).update({ status: "FAILED" });
    const orders = await db("orders").where({ team_id: team.id }).whereIn("status", [ST.PENDING_PAY, ST.GROUPING]);
    for (const o of orders) {
      try {
        await cancelOrder({ orderId: o.id, operatorType: "SYSTEM", reason: "拼团未成团" });
      } catch {
        /* ignore */
      }
    }
    n += 1;
  }
  return n;
}

export async function markPaid(orderId: number, txId: string, raw?: unknown) {
  const paid = await db.transaction(async (trx) => {
    const order = await trx("orders").where({ id: orderId }).forUpdate().first();
    if (!order) throw new HttpError(404, "订单不存在");
    if ([ST.GROUPING, ST.PENDING_PACK, ST.WAIT_PICKUP, ST.WAIT_DELIVER, ST.COMPLETED].includes(order.status)) {
      return order;
    }
    if (order.status !== ST.PENDING_PAY) throw new HttpError(409, "订单状态不允许支付", 10003);
    const next = order.activity_type === "GROUP_BUY" ? ST.GROUPING : ST.PENDING_PACK;
    await trx("orders").where({ id: orderId }).update({
      status: next,
      paid_at: trx.fn.now(),
      wx_transaction_id: txId,
    });
    await trx("payments").insert({
      order_id: orderId,
      channel: "WECHAT",
      prepay_id: null,
      status: "SUCCESS",
      amount_cent: order.pay_amount_cent,
      raw_notify: raw ? JSON.stringify(raw) : null,
    });
    const items = await trx("order_items").where({ order_id: orderId });
    for (const it of items) {
      await trx("goods").where({ id: it.goods_id }).increment("sold_count", it.qty);
      await bumpPayStats(trx, it.goods_id, order.user_id, it.qty, it.amount_cent, orderId);
    }
    const settings = await getSettings();
    const earn = Math.floor(Number(order.pay_amount_cent || 0) / 100) * Number(settings.points_earn_per_yuan || 1);
    if (earn > 0 && settings.points_enabled) {
      await changePoints(trx, order.user_id, earn, "PAY_EARN", orderId, "支付赠送");
    }
    await logStatus(trx, orderId, ST.PENDING_PAY, next, "SYSTEM", null, next === ST.GROUPING ? "支付成功，等待成团" : "支付成功");
    return trx("orders").where({ id: orderId }).first();
  });
  if (paid?.activity_type === "GROUP_BUY" && paid.team_id) {
    await promoteGroupIfReady(Number(paid.team_id));
    return db("orders").where({ id: orderId }).first();
  }
  return paid;
}

export async function cancelOrder(opts: {
  orderId: number;
  operatorType: "USER" | "ADMIN" | "SYSTEM";
  operatorId?: number;
  reason?: string;
}) {
  return db.transaction(async (trx) => {
    const order = await trx("orders").where({ id: opts.orderId }).forUpdate().first();
    if (!order) throw new HttpError(404, "订单不存在");
    if (order.status === ST.CANCELLED) return order;
    const userCancelable = [ST.PENDING_PAY, ST.PENDING_PACK, ST.GROUPING];
    if (opts.operatorType === "USER") {
      if (!userCancelable.includes(order.status)) throw new HttpError(409, "当前状态请联系店主取消", 10003);
    } else if (![ST.PENDING_PAY, ST.PENDING_PACK, ST.GROUPING].includes(order.status)) {
      throw new HttpError(409, "当前状态不可取消", 10003);
    }
    const from = order.status;
    await restoreStock(trx, order.id);
    if (from === ST.PENDING_PACK || from === ST.GROUPING) {
      await trx("payments").where({ order_id: order.id, status: "SUCCESS" }).update({ status: "REFUND" });
      const earn = await trx("points_ledger").where({ order_id: order.id, reason: "PAY_EARN" }).first();
      if (earn) await changePoints(trx, order.user_id, -Number(earn.delta), "REFUND_REVERSE", order.id, "取消回退赠送积分");
    }
    if (Number(order.points_used) > 0) {
      await changePoints(trx, order.user_id, Number(order.points_used), "REDEEM_REVERSE", order.id, "取消退回抵扣积分");
    }
    if (order.user_coupon_id) {
      await trx("user_coupons").where({ id: order.user_coupon_id }).update({ status: "UNUSED", used_at: null, order_id: null });
    }
    await trx("orders").where({ id: order.id }).update({
      status: ST.CANCELLED,
      cancelled_at: trx.fn.now(),
      cancel_reason: (opts.reason || "取消").slice(0, 80),
    });
    await logStatus(trx, order.id, from, ST.CANCELLED, opts.operatorType, opts.operatorId, opts.reason);
    return trx("orders").where({ id: order.id }).first();
  });
}

export async function closeExpiredOrders() {
  const settings = await getSettings();
  const minutes = settings.pay_timeout_minutes || 15;
  const rows = await db("orders")
    .where({ status: ST.PENDING_PAY })
    .whereRaw("created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)", [minutes]);
  for (const o of rows) {
    try {
      await cancelOrder({ orderId: o.id, operatorType: "SYSTEM", reason: "超时未支付" });
    } catch {
      /* ignore */
    }
  }
  return rows.length;
}

export async function packOrder(orderId: number, adminId: number) {
  return db.transaction(async (trx) => {
    const order = await trx("orders").where({ id: orderId }).forUpdate().first();
    if (!order) throw new HttpError(404, "订单不存在");
    if (order.status !== ST.PENDING_PACK) throw new HttpError(409, "订单状态不允许备货", 10003);
    const next = order.fulfill_type === "PICKUP" ? ST.WAIT_PICKUP : ST.WAIT_DELIVER;
    await trx("orders").where({ id: orderId }).update({ status: next, packed_at: trx.fn.now() });
    await logStatus(trx, orderId, ST.PENDING_PACK, next, "ADMIN", adminId, "备货完成");
    const fresh = await trx("orders").where({ id: orderId }).first();
    await notifyPackReady(trx, fresh);
    return fresh;
  });
}

export async function pickupOrder(orderId: number, code: string, adminId: number) {
  return db.transaction(async (trx) => {
    const order = await trx("orders").where({ id: orderId }).forUpdate().first();
    if (!order) throw new HttpError(404, "订单不存在");
    if (order.status !== ST.WAIT_PICKUP) throw new HttpError(409, "订单状态不允许核销", 10003);
    if (String(code) !== String(order.pickup_code)) throw new HttpError(409, "提货码错误", 10004);
    await trx("orders").where({ id: orderId }).update({ status: ST.COMPLETED, completed_at: trx.fn.now() });
    await logStatus(trx, orderId, ST.WAIT_PICKUP, ST.COMPLETED, "ADMIN", adminId, "核销完成");
    return trx("orders").where({ id: orderId }).first();
  });
}

export async function startDeliver(orderId: number, adminId: number) {
  return db.transaction(async (trx) => {
    const order = await trx("orders").where({ id: orderId }).forUpdate().first();
    if (!order) throw new HttpError(404, "订单不存在");
    if (order.status !== ST.WAIT_DELIVER) throw new HttpError(409, "订单状态不允许配送", 10003);
    await trx("orders").where({ id: orderId }).update({ status: ST.DELIVERING, delivered_at: trx.fn.now() });
    await logStatus(trx, orderId, ST.WAIT_DELIVER, ST.DELIVERING, "ADMIN", adminId, "开始配送");
    return trx("orders").where({ id: orderId }).first();
  });
}

export async function completeDeliver(orderId: number, adminId: number) {
  return db.transaction(async (trx) => {
    const order = await trx("orders").where({ id: orderId }).forUpdate().first();
    if (!order) throw new HttpError(404, "订单不存在");
    if (order.status !== ST.DELIVERING) throw new HttpError(409, "订单状态不允许送达", 10003);
    await trx("orders").where({ id: orderId }).update({ status: ST.COMPLETED, completed_at: trx.fn.now() });
    await logStatus(trx, orderId, ST.DELIVERING, ST.COMPLETED, "ADMIN", adminId, "确认送达");
    return trx("orders").where({ id: orderId }).first();
  });
}

function asAddressSnap(v: unknown): Record<string, any> {
  if (!v) return {};
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>;
  return {};
}

export function formatOrderAddress(order: Record<string, any>): string {
  const snap = asAddressSnap(order.address_snapshot);
  if (order.fulfill_type === "DELIVERY") {
    return [snap.contact_name, snap.phone, snap.province, snap.city, snap.district, snap.detail].filter(Boolean).join(" ");
  }
  return [snap.pickup_address, snap.hours, snap.phone].filter(Boolean).join(" · ");
}

export function orderTimePoints(order: Record<string, any>) {
  return [
    { key: "created_at", label: "下单时间", at: order.created_at || null },
    { key: "paid_at", label: "支付时间", at: order.paid_at || null },
    { key: "packed_at", label: "备货完成时间", at: order.packed_at || null },
    { key: "delivered_at", label: "开始配送时间", at: order.delivered_at || null },
    { key: "completed_at", label: "完成时间", at: order.completed_at || null },
    { key: "cancelled_at", label: "取消时间", at: order.cancelled_at || null },
  ].filter((x) => x.at);
}

export function orderTimeline(logs: Record<string, any>[]) {
  return (logs || []).map((l) => ({
    id: l.id,
    note: l.note || "",
    from_status: l.from_status || "",
    to_status: l.to_status || "",
    operator_type: l.operator_type || "",
    created_at: l.created_at,
  }));
}

export async function loadOrderDetail(orderId: number) {
  const order = await db("orders").where({ id: orderId }).first();
  if (!order) return null;
  const items = await db("order_items").where({ order_id: orderId });
  const logs = await db("order_logs").where({ order_id: orderId }).orderBy("id", "asc");
  const user = await db("users").where({ id: order.user_id }).first();
  if (typeof order.address_snapshot === "string") {
    try {
      order.address_snapshot = JSON.parse(order.address_snapshot);
    } catch {
      /* keep */
    }
  }
  let coupon_name = "";
  let coupon_type = "";
  if (order.user_coupon_id) {
    const row = await db("user_coupons")
      .leftJoin("coupons", "coupons.id", "user_coupons.coupon_id")
      .where("user_coupons.id", order.user_coupon_id)
      .select("coupons.name as coupon_name", "coupons.type as coupon_type")
      .first();
    coupon_name = String(row?.coupon_name || "");
    coupon_type = String(row?.coupon_type || "");
  }
  return {
    ...order,
    items,
    logs,
    user,
    coupon_name,
    coupon_type,
    fulfill_text: formatOrderAddress(order),
    time_points: orderTimePoints(order),
    timeline: orderTimeline(logs),
  };
}
