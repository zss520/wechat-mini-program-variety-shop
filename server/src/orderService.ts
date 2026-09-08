import type { Knex } from "knex";
import { db } from "./db";
import { HttpError } from "./http";
import { getSettings } from "./settings";
import { bumpPayStats } from "./analytics";

export const ST = {
  PENDING_PAY: "PENDING_PAY",
  PENDING_PACK: "PENDING_PACK",
  WAIT_PICKUP: "WAIT_PICKUP",
  WAIT_DELIVER: "WAIT_DELIVER",
  DELIVERING: "DELIVERING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof ST)[keyof typeof ST];

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

export type OrderItemInput = { goodsId: number; qty: number };

export async function previewOrder(userId: number, items: OrderItemInput[], fulfillType: string, addressId?: number | null) {
  const settings = await getSettings();
  if (settings.pause_order) throw new HttpError(409, "店主休息中，暂不接单", 10005);
  if (!items.length) throw new HttpError(400, "请选择商品");
  if (fulfillType === "DELIVERY" && !settings.delivery_enabled) throw new HttpError(409, "本店暂不支持配送");

  const lines = [];
  let goodsAmount = 0;
  for (const it of items) {
    if (it.qty < 1) throw new HttpError(400, "数量不合法");
    const g = await db("goods").where({ id: it.goodsId }).whereNull("deleted_at").first();
    if (!g || !g.on_sale) throw new HttpError(409, "商品已下架", 10002);
    if (g.stock < it.qty) throw new HttpError(409, `「${g.name}」库存不足`, 10001);
    const amount = g.price_cent * it.qty;
    goodsAmount += amount;
    lines.push({
      goodsId: g.id,
      name: g.name,
      coverUrl: g.cover_url,
      unit: g.unit,
      priceCent: g.price_cent,
      qty: it.qty,
      amountCent: amount,
      stock: g.stock,
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
  const payAmount = goodsAmount + freight;
  return {
    fulfillType,
    items: lines,
    goodsAmountCent: goodsAmount,
    freightCent: freight,
    discountCent: 0,
    payAmountCent: payAmount,
    address,
    pickup: fulfillType === "PICKUP" ? { address: settings.pickup_address, hours: settings.business_hours, phone: settings.phone } : null,
    pauseOrder: settings.pause_order,
  };
}

export async function createOrder(params: {
  userId: number;
  items: OrderItemInput[];
  fulfillType: "PICKUP" | "DELIVERY";
  addressId?: number | null;
  remark?: string;
  from?: string;
}) {
  const preview = await previewOrder(params.userId, params.items, params.fulfillType, params.addressId);
  const user = await db("users").where({ id: params.userId }).first();
  if (!user?.phone) throw new HttpError(400, "下单前请绑定手机号");

  return db.transaction(async (trx) => {
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
      discount_cent: 0,
      pay_amount_cent: preview.payAmountCent,
      remark: (params.remark || "").slice(0, 80) || null,
      pickup_code: pickupCode,
      address_snapshot: JSON.stringify(snapshot),
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
    await logStatus(trx, orderId, null, ST.PENDING_PAY, "USER", params.userId, "创建订单");
    if (params.from === "CART") {
      const ids = preview.items.map((l) => l.goodsId);
      await trx("cart_items").where({ user_id: params.userId }).whereIn("goods_id", ids).delete();
    }
    return trx("orders").where({ id: orderId }).first();
  });
}

export async function restoreStock(trx: Knex.Transaction, orderId: number) {
  const items = await trx("order_items").where({ order_id: orderId });
  for (const it of items) {
    await trx("goods").where({ id: it.goods_id }).increment("stock", it.qty);
  }
}

export async function markPaid(orderId: number, txId: string, raw?: unknown) {
  return db.transaction(async (trx) => {
    const order = await trx("orders").where({ id: orderId }).forUpdate().first();
    if (!order) throw new HttpError(404, "订单不存在");
    if (order.status === ST.PENDING_PACK || order.status === ST.WAIT_PICKUP || order.status === ST.WAIT_DELIVER) {
      return order; // idempotent
    }
    if (order.status !== ST.PENDING_PAY) throw new HttpError(409, "订单状态不允许支付", 10003);
    await trx("orders").where({ id: orderId }).update({
      status: ST.PENDING_PACK,
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
      await bumpPayStats(trx, it.goods_id, order.user_id, it.qty, it.amount_cent);
    }
    await logStatus(trx, orderId, ST.PENDING_PAY, ST.PENDING_PACK, "SYSTEM", null, "支付成功");
    return trx("orders").where({ id: orderId }).first();
  });
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
    if (opts.operatorType === "USER") {
      if (![ST.PENDING_PAY, ST.PENDING_PACK].includes(order.status)) {
        throw new HttpError(409, "当前状态请联系店主取消", 10003);
      }
    } else if (![ST.PENDING_PAY, ST.PENDING_PACK].includes(order.status)) {
      throw new HttpError(409, "当前状态不可取消", 10003);
    }
    const from = order.status;
    await restoreStock(trx, order.id);
    if (from === ST.PENDING_PACK) {
      await trx("payments").where({ order_id: order.id, status: "SUCCESS" }).update({ status: "REFUND" });
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
    return trx("orders").where({ id: orderId }).first();
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
    await trx("orders").where({ id: orderId }).update({ status: ST.DELIVERING });
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
  return { ...order, items, logs, user };
}
