import { db } from "./db";
import { HttpError, maskPhone } from "./http";
import { ST } from "./orderService";
import { buildPersonaTags, rfmScores } from "./scoring";

function daysSince(d: Date | string | null | undefined) {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export async function memberPersona(userId: number) {
  const user = await db("users").where({ id: userId }).first();
  if (!user) throw new HttpError(404, "会员不存在");

  const paidOrders = await db("orders")
    .where({ user_id: userId })
    .whereNotNull("paid_at")
    .whereNot("status", ST.CANCELLED)
    .select("id", "paid_at", "pay_amount_cent", "fulfill_type", "status")
    .orderBy("paid_at", "desc");

  const last90 = new Date(Date.now() - 90 * 86400000);
  const last30 = new Date(Date.now() - 30 * 86400000);
  const orders90 = paidOrders.filter((o) => new Date(o.paid_at).getTime() >= last90.getTime());
  const orders30 = paidOrders.filter((o) => new Date(o.paid_at).getTime() >= last30.getTime());
  const monetaryFen90 = orders90.reduce((s, o) => s + Number(o.pay_amount_cent || 0), 0);
  const monetaryFenAll = paidOrders.reduce((s, o) => s + Number(o.pay_amount_cent || 0), 0);
  const lastOrder = paidOrders[0] || null;
  const recencyDays = lastOrder ? daysSince(lastOrder.paid_at) : null;

  const itemRows = paidOrders.length
    ? await db("order_items")
        .join("orders", "orders.id", "order_items.order_id")
        .join("goods", "goods.id", "order_items.goods_id")
        .leftJoin("categories as c", "c.id", "goods.category_id")
        .whereIn(
          "order_items.order_id",
          paidOrders.map((o) => o.id)
        )
        .select(
          "order_items.order_id",
          "order_items.goods_id",
          "order_items.qty",
          "goods.category_id",
          "c.name as category_name"
        )
    : [];

  const catPay: Record<number, { name: string; qty: number; orders: Set<number> }> = {};
  let payQty = 0;
  for (const r of itemRows) {
    const cat = Number(r.category_id || 0);
    if (!catPay[cat]) catPay[cat] = { name: String(r.category_name || "未分类"), qty: 0, orders: new Set() };
    catPay[cat].qty += Number(r.qty || 0);
    catPay[cat].orders.add(Number(r.order_id));
    payQty += Number(r.qty || 0);
  }

  const clickRows = await db("analytics_events")
    .where({ user_id: userId, event: "goods_click" })
    .where("ts", ">=", last30)
    .whereNotNull("goods_id")
    .select("goods_id");
  const clickGoodsIds = clickRows.map((r) => Number(r.goods_id)).filter(Boolean);
  const catClick: Record<number, number> = {};
  if (clickGoodsIds.length) {
    const gs = await db("goods").whereIn("id", Array.from(new Set(clickGoodsIds))).select("id", "category_id");
    const cmap: Record<number, number> = {};
    for (const g of gs) cmap[Number(g.id)] = Number(g.category_id);
    for (const gid of clickGoodsIds) {
      const cat = cmap[gid];
      if (!cat) continue;
      catClick[cat] = (catClick[cat] || 0) + 1;
    }
  }
  const clickTotal = Object.values(catClick).reduce((s, n) => s + n, 0) || 1;
  const cats = new Set([...Object.keys(catPay), ...Object.keys(catClick)].map(Number));
  const prefs = Array.from(cats)
    .map((cat) => {
      const pay = catPay[cat];
      const p = payQty ? (pay?.qty || 0) / payQty : 0;
      const c = (catClick[cat] || 0) / clickTotal;
      return {
        categoryId: cat,
        categoryName: pay?.name || "未分类",
        payQty: pay?.qty || 0,
        clickCount: catClick[cat] || 0,
        affinity: Math.round((0.6 * p + 0.4 * c) * 100),
      };
    })
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, 5);

  const eventRows = await db("analytics_events")
    .where({ user_id: userId })
    .where("ts", ">=", last30)
    .whereIn("event", ["goods_expose", "goods_click", "add_to_cart", "goods_detail_view"])
    .select("event")
    .count({ c: "*" })
    .groupBy("event");
  const ev: Record<string, number> = {};
  for (const r of eventRows as Array<{ event: string; c: number }>) ev[r.event] = Number(r.c || 0);

  const lastEvent = await db("analytics_events").where({ user_id: userId }).orderBy("ts", "desc").first();
  const lastActivityAt = [lastOrder?.paid_at, lastEvent?.ts, user.created_at].filter(Boolean).sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0];
  const lastActivityDays = daysSince(lastActivityAt as string) ?? daysSince(user.created_at) ?? 0;
  const registeredDays = daysSince(user.created_at) ?? 0;

  const last30ClickPv = ev.goods_click || 0;
  const tags = buildPersonaTags({
    registeredDays,
    orderCount: paidOrders.length,
    recencyDays,
    frequency90: orders90.length,
    monetaryFen90,
    last30ClickPv,
    last30PayOrders: orders30.length,
    lastActivityDays,
  });
  const rfm = rfmScores(recencyDays, orders90.length, monetaryFen90);

  let lastOrderOut: Record<string, unknown> | null = null;
  if (lastOrder) {
    const cnt = itemRows.filter((r) => Number(r.order_id) === Number(lastOrder.id)).reduce((s, r) => s + Number(r.qty || 0), 0);
    lastOrderOut = {
      id: lastOrder.id,
      paidAt: lastOrder.paid_at,
      amountCent: Number(lastOrder.pay_amount_cent || 0),
      itemQty: cnt,
      fulfillType: lastOrder.fulfill_type,
    };
  }

  return {
    member: {
      id: user.id,
      nickname: user.nickname || "",
      phone: maskPhone(user.phone),
      pointsBalance: Number(user.points_balance || 0),
      registeredAt: user.created_at,
    },
    tags,
    rfm: {
      recencyDays,
      frequency90: orders90.length,
      monetaryFen90,
      ...rfm,
    },
    prefs,
    last30d: {
      exposePv: ev.goods_expose || 0,
      clickPv: last30ClickPv,
      detailPv: ev.goods_detail_view || 0,
      cartPv: ev.add_to_cart || 0,
      payOrders: orders30.length,
      payAmountCent: orders30.reduce((s, o) => s + Number(o.pay_amount_cent || 0), 0),
    },
    summary: {
      orderCount: paidOrders.length,
      payAmountCent: monetaryFenAll,
      avgOrderCent: paidOrders.length ? Math.round(monetaryFenAll / paidOrders.length) : 0,
      lastActivityDays,
    },
    lastOrder: lastOrderOut,
  };
}
