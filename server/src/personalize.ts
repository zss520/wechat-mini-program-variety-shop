import { db } from "./db";
import { getSettings } from "./settings";
import { publicGoods } from "./recommend";
import { salePriceOf } from "./pricing";
import { decayWeight, pickDiverse } from "./scoring";

const W_AFFINITY = 0.3;
const W_COPURCHASE = 0.16;
const W_HEAT = 0.22;
const W_WEIGHT = 0.12;
const W_CLICK = 0.14;
const W_REPEAT = 0.06;

type Sig = {
  affinity: Record<number, number>;
  copurchase: Record<number, number>;
  maxCo: number;
  clickScore: Record<number, number>;
  maxClick: number;
  lastPaidAt: Record<number, number>;
  buyCount: Record<number, number>;
  repeatCat: Record<number, number>;
};

async function userSignals(userId: number): Promise<Sig> {
  const paid = await db("order_items")
    .join("orders", "orders.id", "order_items.order_id")
    .join("goods", "goods.id", "order_items.goods_id")
    .where("orders.user_id", userId)
    .whereNotNull("orders.paid_at")
    .whereNot("orders.status", "CANCELLED")
    .select(
      "order_items.goods_id",
      "order_items.qty",
      "goods.category_id",
      "orders.id as order_id",
      "orders.paid_at"
    );
  const since = new Date(Date.now() - 30 * 86400000);
  const clicks = await db("analytics_events")
    .where({ user_id: userId, event: "goods_click" })
    .where("ts", ">=", since)
    .select("goods_id", "ts");

  const catPay: Record<number, number> = {};
  const lastPaidAt: Record<number, number> = {};
  const buyCount: Record<number, number> = {};
  const bought = new Set<number>();
  let payTotal = 0;
  for (const r of paid) {
    const gid = Number(r.goods_id);
    const cat = Number(r.category_id);
    bought.add(gid);
    catPay[cat] = (catPay[cat] || 0) + Number(r.qty);
    payTotal += Number(r.qty);
    buyCount[gid] = (buyCount[gid] || 0) + 1;
    const ts = new Date(r.paid_at).getTime();
    if (!lastPaidAt[gid] || ts > lastPaidAt[gid]) lastPaidAt[gid] = ts;
  }
  const repeatCat: Record<number, number> = {};
  for (const [cat, qty] of Object.entries(catPay)) {
    if (Number(qty) >= 2) repeatCat[Number(cat)] = Number(qty);
  }

  const catClick: Record<number, number> = {};
  const clickScore: Record<number, number> = {};
  const clickGoods = clicks.map((c) => Number(c.goods_id)).filter(Boolean);
  if (clickGoods.length) {
    const gs = await db("goods").whereIn("id", Array.from(new Set(clickGoods))).select("id", "category_id");
    const cmap: Record<number, number> = {};
    for (const g of gs) cmap[Number(g.id)] = Number(g.category_id);
    for (const c of clicks) {
      const gid = Number(c.goods_id);
      if (!gid) continue;
      const cat = cmap[gid];
      if (cat) catClick[cat] = (catClick[cat] || 0) + 1;
      const daysAgo = Math.max(0, (Date.now() - new Date(c.ts).getTime()) / 86400000);
      clickScore[gid] = (clickScore[gid] || 0) + decayWeight(daysAgo, 7);
    }
  }
  const clickTotal = Object.values(catClick).reduce((s, n) => s + n, 0) || 1;
  const affinity: Record<number, number> = {};
  const cats = new Set([...Object.keys(catPay), ...Object.keys(catClick)].map(Number));
  for (const cat of cats) {
    const p = payTotal ? (catPay[cat] || 0) / payTotal : 0;
    const c = (catClick[cat] || 0) / clickTotal;
    const repeatBoost = (repeatCat[cat] || 0) >= 3 ? 0.15 : (repeatCat[cat] || 0) >= 2 ? 0.08 : 0;
    affinity[cat] = Math.min(1, 0.55 * p + 0.35 * c + repeatBoost);
  }

  const copurchase: Record<number, number> = {};
  if (bought.size) {
    const orderIds = Array.from(new Set(paid.map((r) => Number(r.order_id))));
    if (orderIds.length) {
      const others = await db("order_items").whereIn("order_id", orderIds).whereNotIn("goods_id", Array.from(bought));
      for (const r of others) copurchase[Number(r.goods_id)] = (copurchase[Number(r.goods_id)] || 0) + 1;
    }
    const global = await db("order_items")
      .join("orders", "orders.id", "order_items.order_id")
      .whereNotNull("orders.paid_at")
      .whereNot("orders.status", "CANCELLED")
      .whereIn("order_items.order_id", function () {
        this.select("order_id").from("order_items").whereIn("goods_id", Array.from(bought));
      })
      .whereNotIn("order_items.goods_id", Array.from(bought))
      .select("order_items.goods_id")
      .limit(500);
    for (const r of global) copurchase[Number(r.goods_id)] = (copurchase[Number(r.goods_id)] || 0) + 1;
  }
  const maxCo = Math.max(1, ...Object.values(copurchase), 1);
  const maxClick = Math.max(1, ...Object.values(clickScore), 1);
  return { affinity, copurchase, maxCo, clickScore, maxClick, lastPaidAt, buyCount, repeatCat };
}

function recentBuyFactor(sig: Sig, goodsId: number) {
  const last = sig.lastPaidAt[goodsId];
  if (last && Date.now() - last < 3 * 86400000) return 0.35;
  if ((sig.buyCount[goodsId] || 0) >= 2) return 1.22;
  return 1;
}

function scoreGoods(
  g: { id: number; category_id: number; heat_score: number; manual_weight: number },
  sig: Sig | null
) {
  const heat = Number(g.heat_score || 0) / 100;
  const weight = (Number(g.manual_weight || 0) + 50) / 100;
  if (!sig) return 100 * (W_HEAT * heat + W_WEIGHT * weight + 0.4 * heat);
  const aff = sig.affinity[Number(g.category_id)] || 0;
  const co = (sig.copurchase[Number(g.id)] || 0) / sig.maxCo;
  const click = (sig.clickScore[Number(g.id)] || 0) / sig.maxClick;
  const repeat = (sig.repeatCat[Number(g.category_id)] || 0) >= 2 ? 1 : 0;
  const base =
    100 *
    (W_AFFINITY * aff + W_COPURCHASE * co + W_HEAT * heat + W_WEIGHT * weight + W_CLICK * click + W_REPEAT * repeat);
  return base * recentBuyFactor(sig, Number(g.id));
}

export async function personalizedGoods(userId: number | null, limit = 8, exclude: number[] = []) {
  let q = db("goods").where({ on_sale: 1 }).whereNull("deleted_at").where("stock", ">", 0);
  if (exclude.length) q = q.whereNotIn("id", exclude);
  const candidates = await q.orderBy("heat_score", "desc").orderBy("sold_count", "desc").orderBy("id", "desc").limit(80);
  const sig = userId ? await userSignals(userId) : null;
  const ranked = candidates
    .map((g) => ({ g, score: scoreGoods(g, sig) }))
    .sort((a, b) => b.score - a.score);
  const picked = pickDiverse(ranked, limit, limit <= 8 ? 2 : 3);
  return picked.map((r, i) =>
    publicGoods({ ...r.g, slot_id: "for_you", position: i + 1, pin: false, personal_score: Math.round(r.score) })
  );
}

export async function relatedGoods(goodsId: number, userId: number | null, limit = 8) {
  const cur = await db("goods").where({ id: goodsId }).whereNull("deleted_at").first();
  if (!cur) return [];
  const used = new Set<number>([goodsId]);
  const list: Record<string, unknown>[] = [];

  const pairs = await db("order_items as a")
    .join("order_items as b", "a.order_id", "b.order_id")
    .join("orders", "orders.id", "a.order_id")
    .where("a.goods_id", goodsId)
    .whereNot("b.goods_id", goodsId)
    .whereNotNull("orders.paid_at")
    .whereNot("orders.status", "CANCELLED")
    .select("b.goods_id")
    .count({ c: "*" })
    .groupBy("b.goods_id")
    .orderBy("c", "desc")
    .limit(limit);
  const copurchased = pairs.length
    ? await db("goods")
        .whereIn(
          "id",
          (pairs as { goods_id: number }[]).map((p) => p.goods_id)
        )
        .where({ on_sale: 1 })
        .whereNull("deleted_at")
        .where("stock", ">", 0)
    : [];

  for (const g of copurchased) {
    if (used.has(g.id) || list.length >= limit) continue;
    used.add(g.id);
    list.push(publicGoods({ ...g, slot_id: "detail_related", position: list.length + 1 }));
  }

  if (list.length < limit) {
    const same = await db("goods")
      .where({ on_sale: 1, category_id: cur.category_id })
      .whereNull("deleted_at")
      .where("stock", ">", 0)
      .whereNotIn("id", Array.from(used))
      .orderBy("heat_score", "desc")
      .limit(limit - list.length);
    for (const g of same) {
      used.add(g.id);
      list.push(publicGoods({ ...g, slot_id: "detail_related", position: list.length + 1 }));
    }
  }

  if (list.length < limit) {
    const extra = await personalizedGoods(userId, limit - list.length, Array.from(used));
    list.push(...extra.map((g, i) => ({ ...g, slotId: "detail_related", position: list.length + i + 1 })));
  }
  return list.slice(0, limit);
}

export async function cartUpsell(userId: number) {
  const settings = await getSettings();
  const rows = await db("cart_items")
    .where("cart_items.user_id", userId)
    .join("goods", "goods.id", "cart_items.goods_id")
    .select("cart_items.*", "goods.*");
  const inCart = new Set(rows.map((r) => Number(r.goods_id)));
  let subtotal = 0;
  for (const r of rows) {
    if (!r.on_sale || r.deleted_at || Number(r.stock) <= 0) continue;
    subtotal += salePriceOf(r).priceCent * Number(r.qty);
  }
  const targets: { reason: string; remainCent: number }[] = [];
  if (settings.free_freight_over_cent > 0 && subtotal < settings.free_freight_over_cent) {
    targets.push({ reason: `满¥${(settings.free_freight_over_cent / 100).toFixed(0)}免配送费`, remainCent: settings.free_freight_over_cent - subtotal });
  }
  const unused = await db("user_coupons")
    .join("coupons", "coupons.id", "user_coupons.coupon_id")
    .where({ "user_coupons.user_id": userId, "user_coupons.status": "UNUSED" })
    .where("coupons.enabled", 1)
    .whereNull("coupons.deleted_at")
    .select("coupons.name", "coupons.min_amount_cent");
  for (const c of unused) {
    const min = Number(c.min_amount_cent || 0);
    if (min > subtotal) targets.push({ reason: `凑满可享「${c.name}」`, remainCent: min - subtotal });
  }
  if (!targets.length) {
    const bucket = 1000;
    const remain = subtotal % bucket === 0 ? bucket : bucket - (subtotal % bucket);
    targets.push({ reason: "再买一件更划算", remainCent: remain });
  }
  targets.sort((a, b) => a.remainCent - b.remainCent);
  const target = targets[0];
  const suggestions = await db("goods")
    .where({ on_sale: 1 })
    .whereNull("deleted_at")
    .where("stock", ">", 0)
    .modify((b) => {
      if (inCart.size) b.whereNotIn("id", Array.from(inCart));
    })
    .orderByRaw("ABS(price_cent - ?) ASC", [target.remainCent])
    .orderBy("heat_score", "desc")
    .limit(8);
  return {
    subtotalCent: subtotal,
    target,
    suggestions: suggestions.map((g: Record<string, unknown>, i: number) => publicGoods({ ...g, slot_id: "cart_upsell", position: i + 1 })),
  };
}
