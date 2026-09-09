import { db } from "../db";
import { ingestEvents, goodsReport, recomputeHeat } from "../analytics";
import { memberPersona } from "../persona";
import { personalizedGoods } from "../personalize";
import { todayShanghai } from "../http";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const cat = await db("categories").whereNull("deleted_at").first();
  if (!cat) throw new Error("need category");
  const stamp = Date.now();
  const [gid] = await db("goods").insert({
    category_id: cat.id,
    name: `__an_${stamp}`,
    price_cent: 199,
    unit: "件",
    stock: 10,
    on_sale: 1,
    cover_url: "/static/placeholders/empty.png",
  });
  const [gid2] = await db("goods").insert({
    category_id: cat.id,
    name: `__an2_${stamp}`,
    price_cent: 299,
    unit: "件",
    stock: 10,
    on_sale: 1,
    cover_url: "/static/placeholders/empty.png",
  });
  const [uid] = await db("users").insert({
    openid: `an_${stamp}`,
    nickname: "画像测试",
    phone: "13900001111",
    points_balance: 10,
  });

  const base = {
    ts: Date.now(),
    anonymous_id: `a_${stamp}`,
    session_id: `s_${stamp}`,
    page: "pages/home/index",
  };
  await ingestEvents(
    [
      { ...base, event: "goods_expose", goods_id: gid, slot_id: "home_recommend", position: 1 },
      { ...base, event: "goods_expose", goods_id: gid, slot_id: "home_recommend", position: 1 },
    ],
    uid
  );
  const today = todayShanghai();
  const st = await db("goods_stats_daily").where({ stat_date: today, goods_id: gid }).first();
  assert(Number(st?.expose_pv) === 1, `30s expose pv should be 1 got ${st?.expose_pv}`);
  assert(Number(st?.expose_uv) === 1, `expose uv should be 1 got ${st?.expose_uv}`);

  await ingestEvents(
    [{ ...base, event: "goods_expose", goods_id: gid, slot_id: "home_deal", position: 2, session_id: `s2_${stamp}`, anonymous_id: `a2_${stamp}` }],
    undefined
  );
  const st2 = await db("goods_stats_daily").where({ stat_date: today, goods_id: gid }).first();
  assert(Number(st2?.expose_pv) === 2, `second session pv 2 got ${st2?.expose_pv}`);
  assert(Number(st2?.expose_uv) === 2, `second identity uv 2 got ${st2?.expose_uv}`);

  await ingestEvents(
    [
      { ...base, event: "goods_click", goods_id: gid, slot_id: "home_recommend" },
      { ...base, event: "goods_click", goods_id: gid, slot_id: "home_recommend" },
    ],
    uid
  );
  const st3 = await db("goods_stats_daily").where({ stat_date: today, goods_id: gid }).first();
  assert(Number(st3?.click_pv) === 2, `click pv 2 got ${st3?.click_pv}`);
  assert(Number(st3?.click_uv) === 1, `click uv 1 got ${st3?.click_uv}`);

  const report = await goodsReport({ from: today, to: today, page: 1, pageSize: 200 });
  const row = report.list.find((g: { id: number }) => Number(g.id) === Number(gid));
  assert(row, "goods report should include test sku");
  assert(row.sampleInsufficient === true, "small sample flag");
  assert(row.cvrSampleOk === false, "cvr sample");

  await recomputeHeat();
  const g1 = await db("goods").where({ id: gid }).first();
  const g2 = await db("goods").where({ id: gid2 }).first();
  assert(Number(g1.heat_score) >= 0 && Number(g1.heat_score) <= 100, "heat range g1");
  assert(Number(g2.heat_score) >= 0 && Number(g2.heat_score) <= 100, "heat range g2");

  const rec = await personalizedGoods(uid, 4);
  assert(Array.isArray(rec) && rec.length > 0, "personalized list");

  await db("orders").insert({
    order_no: `AN${stamp}`,
    user_id: uid,
    status: "PENDING_PACK",
    fulfill_type: "PICKUP",
    goods_amount_cent: 199,
    freight_cent: 0,
    discount_cent: 0,
    pay_amount_cent: 199,
    paid_at: new Date(),
  });
  const order = await db("orders").where({ order_no: `AN${stamp}` }).first();
  await db("order_items").insert({
    order_id: order.id,
    goods_id: gid,
    name_snapshot: "t",
    price_cent: 199,
    qty: 1,
    amount_cent: 199,
  });
  const persona = await memberPersona(uid);
  assert(persona.member.phone.includes("****"), "phone masked");
  assert(!(persona as any).member.openid, "no openid");
  assert(persona.summary.orderCount === 1, "one paid order");
  assert(persona.tags.some((t) => t.key === "new"), "new customer tag");

  await db("analytics_events").where({ user_id: uid }).delete();
  await db("analytics_events").whereIn("anonymous_id", [`a_${stamp}`, `a2_${stamp}`]).delete();
  await db("analytics_events").whereIn("session_id", [`s_${stamp}`, `s2_${stamp}`]).delete();
  await db("goods_stats_daily").whereIn("goods_id", [gid, gid2]).delete();
  await db("order_items").where({ order_id: order.id }).delete();
  await db("orders").where({ id: order.id }).delete();
  await db("users").where({ id: uid }).delete();
  await db("goods").whereIn("id", [gid, gid2]).delete();
  await db.destroy();
  console.log("analytics/persona tests passed");
}

run().catch(async (e) => {
  console.error(e);
  await db.destroy();
  process.exit(1);
});
