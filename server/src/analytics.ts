import { Knex } from "knex";
import { db } from "./db";
import { todayShanghai } from "./http";
import {
  addHeat,
  asIsoDate,
  decayWeight,
  diffIsoDays,
  emptyHeat,
  heatRaw,
  mixHeat,
  rateMetrics,
  scaleByP95,
  shiftIsoDate,
  type HeatStats,
} from "./scoring";

export const EVENT_NAMES = new Set([
  "app_launch",
  "app_show",
  "app_hide",
  "page_view",
  "page_leave",
  "goods_expose",
  "goods_click",
  "goods_detail_view",
  "goods_detail_leave",
  "add_to_cart",
  "buy_now_click",
  "cart_settle_click",
  "order_submit",
  "pay_invoke",
  "pay_result",
  "pay_success",
  "order_cancel",
  "rebuy_click",
  "search_submit",
  "search_no_result",
  "banner_expose",
  "banner_click",
  "category_click",
  "share_click",
  "contact_shop",
  "pickup_code_view",
  "cart_upsell",
  "group_click",
  "seckill_click",
]);

const SENSITIVE = /phone|openid|mobile|address|token|password/i;

function sanitizePayload(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE.test(k)) continue;
    if (typeof v === "string" && v.length > 200) out[k] = v.slice(0, 200);
    else out[k] = v;
  }
  return out;
}

async function ensureDailyRow(trx: Knex | Knex.Transaction, goodsId: number, date = todayShanghai()) {
  await trx("goods_stats_daily")
    .insert({
      stat_date: date,
      goods_id: goodsId,
    })
    .onConflict(["stat_date", "goods_id"])
    .ignore();
}

export async function bumpPayStats(
  trx: Knex | Knex.Transaction,
  goodsId: number,
  userId: number,
  qty: number,
  amountCent: number,
  orderId?: number
) {
  await ensureDailyRow(trx, goodsId);
  const date = todayShanghai();
  let incUv = 1;
  if (userId) {
    const prev = await trx("order_items")
      .join("orders", "orders.id", "order_items.order_id")
      .where("order_items.goods_id", goodsId)
      .where("orders.user_id", userId)
      .whereNotNull("orders.paid_at")
      .whereNot("orders.status", "CANCELLED")
      .whereRaw("DATE(orders.paid_at) = ?", [date])
      .modify((b) => {
        if (orderId) b.whereNot("orders.id", orderId);
      })
      .select("orders.id as paid_order_id")
      .first();
    if (prev) incUv = 0;
  }
  const q = trx("goods_stats_daily").where({ stat_date: date, goods_id: goodsId });
  await q.clone().increment("pay_qty", qty).increment("pay_amount_cent", amountCent);
  if (incUv) await q.clone().increment("pay_uv", 1);
}

export async function ingestEvents(
  events: unknown[],
  userId?: number
): Promise<{ accepted: number; dropped: number }> {
  if (!Array.isArray(events) || events.length === 0) return { accepted: 0, dropped: 0 };
  const batch = events.slice(0, 20);
  let accepted = 0;
  let dropped = events.length - batch.length;
  const rows = [];
  const now = new Date();
  for (const raw of batch) {
    if (!raw || typeof raw !== "object") {
      dropped += 1;
      continue;
    }
    const e = raw as Record<string, unknown>;
    const name = String(e.event || "");
    if (!EVENT_NAMES.has(name)) {
      dropped += 1;
      continue;
    }
    const goodsId = e.goods_id != null ? Number(e.goods_id) : null;
    const known = new Set([
      "event",
      "ts",
      "anonymous_id",
      "session_id",
      "page",
      "scene",
      "goods_id",
      "slot_id",
      "position",
      "order_no",
      "payload",
      "extra",
      "app_version",
    ]);
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(e)) {
      if (!known.has(k)) rest[k] = v;
    }
    const payload = sanitizePayload({
      ...rest,
      ...((e.extra && typeof e.extra === "object" ? e.extra : {}) as Record<string, unknown>),
      ...((e.payload && typeof e.payload === "object" ? e.payload : {}) as Record<string, unknown>),
    });
    rows.push({
      event: name,
      ts: e.ts ? new Date(Number(e.ts) || String(e.ts)) : now,
      received_at: now,
      anonymous_id: e.anonymous_id ? String(e.anonymous_id).slice(0, 64) : null,
      session_id: e.session_id ? String(e.session_id).slice(0, 64) : null,
      user_id: userId || null,
      page: e.page ? String(e.page).slice(0, 64) : null,
      scene: e.scene != null ? Number(e.scene) : null,
      goods_id: goodsId && Number.isFinite(goodsId) ? goodsId : null,
      slot_id: e.slot_id ? String(e.slot_id).slice(0, 32) : null,
      position: e.position != null ? Number(e.position) : null,
      order_no: e.order_no ? String(e.order_no).slice(0, 32) : null,
      payload: payload ? JSON.stringify(payload) : null,
      app_version: e.app_version ? String(e.app_version).slice(0, 16) : null,
    });
    accepted += 1;
  }
  const persist: typeof rows = [];
  const exposeSeen = new Set<string>();
  const uvSeen = new Set<string>();
  const today = todayShanghai();
  const since30 = new Date(Date.now() - 30 * 1000);

  for (const r of rows) {
    let skipExpose = false;
    if (r.event === "goods_expose" && r.goods_id && r.session_id) {
      const ek = `${r.session_id}|${r.goods_id}|${r.slot_id || ""}`;
      if (exposeSeen.has(ek)) skipExpose = true;
      else {
        const hit = await db("analytics_events")
          .where({
            event: "goods_expose",
            session_id: r.session_id,
            goods_id: r.goods_id,
          })
          .where("ts", ">=", since30)
          .modify((b) => {
            if (r.slot_id) b.where("slot_id", r.slot_id);
            else b.where(function () {
              this.whereNull("slot_id").orWhere("slot_id", "");
            });
          })
          .first("id");
        if (hit) skipExpose = true;
        else exposeSeen.add(ek);
      }
    }
    if (!skipExpose) persist.push(r);
    if (skipExpose || !r.goods_id) continue;
    const pair =
      r.event === "goods_expose"
        ? { pv: "expose_pv", uv: "expose_uv" }
        : r.event === "goods_click"
        ? { pv: "click_pv", uv: "click_uv" }
        : r.event === "add_to_cart"
        ? { pv: "cart_pv", uv: "cart_uv" }
        : r.event === "goods_detail_view"
        ? { pv: null as string | null, uv: "detail_uv" }
        : null;
    if (!pair) continue;
    const idPart = r.user_id || r.anonymous_id || r.session_id;
    let incUv = false;
    if (idPart) {
      const uk = `${r.event}|${r.goods_id}|${idPart}|${today}`;
      if (!uvSeen.has(uk)) {
        const q = db("analytics_events").where({ event: r.event, goods_id: r.goods_id }).where("ts", ">=", `${today} 00:00:00`);
        if (r.user_id) q.andWhere("user_id", r.user_id);
        else if (r.anonymous_id) q.andWhere("anonymous_id", r.anonymous_id);
        else q.andWhere("session_id", r.session_id);
        const existed = await q.first("id");
        if (!existed) incUv = true;
        uvSeen.add(uk);
      }
    }
    const incPv = !!pair.pv;
    if (!incPv && !incUv) continue;
    const insert: Record<string, unknown> = { stat_date: today, goods_id: r.goods_id };
    const merge: Record<string, unknown> = {};
    if (incPv && pair.pv) {
      insert[pair.pv] = 1;
      merge[pair.pv] = db.raw("?? + 1", [pair.pv]);
    }
    if (incUv) {
      insert[pair.uv] = 1;
      merge[pair.uv] = db.raw("?? + 1", [pair.uv]);
    } else {
      insert[pair.uv] = 0;
    }
    if (Object.keys(merge).length) {
      await db("goods_stats_daily").insert(insert).onConflict(["stat_date", "goods_id"]).merge(merge);
    }
  }
  if (persist.length) await db("analytics_events").insert(persist);
  return { accepted, dropped };
}

export async function goodsReport(opts: { from: string; to: string; categoryId?: number; keyword?: string; page: number; pageSize: number }) {
  const q = db("goods")
    .whereNull("goods.deleted_at")
    .modify((b) => {
      if (opts.categoryId) b.where("goods.category_id", opts.categoryId);
      if (opts.keyword) b.where("goods.name", "like", `%${opts.keyword}%`);
    })
    .leftJoin(
      db("goods_stats_daily")
        .select("goods_id")
        .sum({ expose_pv: "expose_pv" })
        .sum({ expose_uv: "expose_uv" })
        .sum({ click_pv: "click_pv" })
        .sum({ click_uv: "click_uv" })
        .sum({ cart_uv: "cart_uv" })
        .sum({ pay_qty: "pay_qty" })
        .sum({ pay_uv: "pay_uv" })
        .sum({ pay_amount_cent: "pay_amount_cent" })
        .whereBetween("stat_date", [opts.from, opts.to])
        .groupBy("goods_id")
        .as("s"),
      "s.goods_id",
      "goods.id"
    )
    .leftJoin("categories as c", "c.id", "goods.category_id")
    .select(
      "goods.id",
      "goods.name",
      "goods.cover_url",
      "goods.price_cent",
      "goods.stock",
      "goods.on_sale",
      "goods.heat_score",
      "goods.manual_weight",
      "goods.created_at",
      "c.name as category_name",
      db.raw("IFNULL(s.expose_uv,0) as expose_uv"),
      db.raw("IFNULL(s.expose_pv,0) as expose_pv"),
      db.raw("IFNULL(s.click_uv,0) as click_uv"),
      db.raw("IFNULL(s.click_pv,0) as click_pv"),
      db.raw("IFNULL(s.cart_uv,0) as cart_uv"),
      db.raw("IFNULL(s.pay_uv,0) as pay_uv"),
      db.raw("IFNULL(s.pay_qty,0) as pay_qty"),
      db.raw("IFNULL(s.pay_amount_cent,0) as pay_amount_cent")
    );

  const totalRow = await q.clone().clearSelect().clearOrder().count({ c: "*" }).first();
  const total = Number(totalRow?.c || 0);
  const list = await q
    .orderBy("goods.heat_score", "desc")
    .offset((opts.page - 1) * opts.pageSize)
    .limit(opts.pageSize);

  const mapped = list.map((r: Record<string, unknown>) => {
    const exposeUv = Number(r.expose_uv || 0);
    const clickUv = Number(r.click_uv || 0);
    const rates = rateMetrics(exposeUv, clickUv, Number(r.cart_uv || 0), Number(r.pay_uv || 0));
    return {
      ...r,
      ...rates,
    };
  });
  return { list: mapped, page: opts.page, pageSize: opts.pageSize, total };
}

export async function funnelReport(from: string, to: string) {
  const uv = async (event: string) => {
    const row = await db("analytics_events")
      .where({ event })
      .whereBetween("ts", [`${from} 00:00:00`, `${to} 23:59:59`])
      .countDistinct({ c: db.raw("IFNULL(user_id, anonymous_id)") })
      .first();
    return Number(row?.c || 0);
  };
  const launch = await uv("app_launch");
  const expose = await uv("goods_expose");
  const detail = await uv("goods_detail_view");
  const cart = await uv("add_to_cart");
  const submit = await uv("order_submit");
  const pay = await db("orders")
    .whereNotNull("paid_at")
    .whereBetween("paid_at", [`${from} 00:00:00`, `${to} 23:59:59`])
    .countDistinct({ c: "user_id" })
    .first();
  return {
    steps: [
      { key: "launch", name: "打开小程序", uv: launch },
      { key: "expose", name: "看到商品", uv: expose },
      { key: "detail", name: "进入详情", uv: detail },
      { key: "cart", name: "加购", uv: cart },
      { key: "submit", name: "提交订单", uv: submit },
      { key: "pay", name: "支付成功", uv: Number(pay?.c || 0) },
    ],
  };
}

export async function recomputeHeat() {
  const goods = await db("goods").whereNull("deleted_at").where({ on_sale: 1 });
  const end = todayShanghai();
  const from7 = shiftIsoDate(end, -6);
  const from30 = shiftIsoDate(end, -29);

  const eventRows = await db("analytics_events")
    .whereIn("event", ["goods_expose", "goods_click", "add_to_cart", "goods_detail_view"])
    .whereNotNull("goods_id")
    .whereBetween("ts", [`${from30} 00:00:00`, `${end} 23:59:59`])
    .select(
      db.raw("DATE_FORMAT(ts, '%Y-%m-%d') as d"),
      "goods_id",
      "event",
      db.raw("COUNT(DISTINCT IFNULL(user_id, anonymous_id)) as uv"),
      db.raw("COUNT(*) as pv")
    )
    .groupByRaw("DATE_FORMAT(ts, '%Y-%m-%d'), goods_id, event");
  for (const r of eventRows as Array<{ d: string; goods_id: number; event: string; uv: number; pv: number }>) {
    await ensureDailyRow(db, r.goods_id, String(r.d).slice(0, 10));
    const patch: Record<string, number> = {};
    if (r.event === "goods_expose") {
      patch.expose_uv = Number(r.uv);
      patch.expose_pv = Number(r.pv);
    } else if (r.event === "goods_click") {
      patch.click_uv = Number(r.uv);
      patch.click_pv = Number(r.pv);
    } else if (r.event === "add_to_cart") {
      patch.cart_uv = Number(r.uv);
      patch.cart_pv = Number(r.pv);
    } else if (r.event === "goods_detail_view") {
      patch.detail_uv = Number(r.uv);
    }
    if (Object.keys(patch).length) {
      await db("goods_stats_daily").where({ stat_date: String(r.d).slice(0, 10), goods_id: r.goods_id }).update(patch);
    }
  }

  const payRows = await db("order_items")
    .join("orders", "orders.id", "order_items.order_id")
    .whereNotNull("orders.paid_at")
    .whereNot("orders.status", "CANCELLED")
    .whereBetween("orders.paid_at", [`${from30} 00:00:00`, `${end} 23:59:59`])
    .select(
      db.raw("DATE_FORMAT(orders.paid_at, '%Y-%m-%d') as d"),
      "order_items.goods_id",
      db.raw("COUNT(DISTINCT orders.user_id) as pay_uv"),
      db.raw("SUM(order_items.qty) as pay_qty"),
      db.raw("SUM(order_items.amount_cent) as pay_amount_cent")
    )
    .groupByRaw("DATE_FORMAT(orders.paid_at, '%Y-%m-%d'), order_items.goods_id");
  for (const r of payRows as Array<{ d: string; goods_id: number; pay_uv: number; pay_qty: number; pay_amount_cent: number }>) {
    await ensureDailyRow(db, r.goods_id, String(r.d).slice(0, 10));
    await db("goods_stats_daily")
      .where({ stat_date: String(r.d).slice(0, 10), goods_id: r.goods_id })
      .update({
        pay_uv: Number(r.pay_uv || 0),
        pay_qty: Number(r.pay_qty || 0),
        pay_amount_cent: Number(r.pay_amount_cent || 0),
      });
  }

  const daily = (await db("goods_stats_daily")
    .whereBetween("stat_date", [from30, end])
    .select(
      "stat_date",
      "goods_id",
      "expose_uv",
      "click_uv",
      "cart_uv",
      "pay_uv",
      "pay_qty"
    )) as Array<HeatStats & { stat_date: string; goods_id: number }>;

  const byGoods: Record<number, HeatStats> = {};
  const s7: Record<number, HeatStats> = {};
  const s1: Record<number, HeatStats> = {};
  for (const r of daily) {
    const gid = Number(r.goods_id);
    const day = asIsoDate(r.stat_date);
    if (!gid || !day) continue;
    const stats: HeatStats = {
      expose_uv: Number(r.expose_uv || 0),
      click_uv: Number(r.click_uv || 0),
      cart_uv: Number(r.cart_uv || 0),
      pay_uv: Number(r.pay_uv || 0),
      pay_qty: Number(r.pay_qty || 0),
    };
    const w = decayWeight(diffIsoDays(day, end), 7);
    byGoods[gid] = addHeat(byGoods[gid] || emptyHeat(), stats, w);
    if (day >= from7) s7[gid] = addHeat(s7[gid] || emptyHeat(), stats, 1);
    if (day === end) s1[gid] = addHeat(s1[gid] || emptyHeat(), stats, 1);
  }

  const raws1 = goods.map((g) => heatRaw(s1[g.id]));
  const raws7 = goods.map((g) => heatRaw(s7[g.id]));
  const raws30 = goods.map((g) => heatRaw(byGoods[g.id]));
  const heat1 = scaleByP95(raws1);
  const heat7 = scaleByP95(raws7);
  const heat30 = scaleByP95(raws30);
  for (let i = 0; i < goods.length; i++) {
    const score = mixHeat(heat1[i], heat7[i], heat30[i]);
    await db("goods").where({ id: goods[i].id }).update({ heat_score: score, heat_updated_at: db.fn.now() });
  }
}

export async function signals(from: string, to: string) {
  const { list } = await goodsReport({ from, to, page: 1, pageSize: 200 });
  const withSample = list.filter((g: any) => !g.sampleInsufficient);
  const ctrs = withSample.map((g: any) => Number(g.ctr || 0)).sort((a: number, b: number) => a - b);
  const cvrs = withSample.map((g: any) => Number(g.cvr || 0)).sort((a: number, b: number) => a - b);
  const mid = (arr: number[]) => (arr.length ? arr[Math.floor(arr.length / 2)] : 0);
  const ctrM = mid(ctrs);
  const cvrM = mid(cvrs);
  const heatTop = [...list].sort((a, b) => Number(b.heat_score) - Number(a.heat_score)).slice(0, Math.max(1, Math.floor(list.length * 0.2)));
  const out = [];
  for (const g of list) {
    if (!g.sampleInsufficient && Number(g.expose_uv) >= 30 && Number(g.ctr) < ctrM * 0.5) {
      out.push({ type: "LOW_CTR", goodsId: g.id, name: g.name, message: "高曝光低点击，检查主图与价格" });
    }
    if (!g.sampleInsufficient && Number(g.click_uv) >= 20 && Number(g.cvr) < cvrM * 0.5) {
      out.push({ type: "LOW_CVR", goodsId: g.id, name: g.name, message: "高点击低购买，检查详情或价格" });
    }
    if (heatTop.some((h) => h.id === g.id) && Number(g.stock) <= 5) {
      out.push({ type: "HOT_LOW_STOCK", goodsId: g.id, name: g.name, message: "热度高库存低，建议补货" });
    }
    const created = g.created_at ? new Date(g.created_at as string).getTime() : 0;
    if (Number(g.on_sale) === 1 && Number(g.stock) > 0 && Number(g.expose_uv) === 0 && created && Date.now() - created >= 3 * 86400000) {
      out.push({ type: "NO_EXPOSE", goodsId: g.id, name: g.name, message: "有库存无曝光，考虑加入推荐或提高权重" });
    }
  }
  return out;
}
