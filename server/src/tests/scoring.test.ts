import {
  asIsoDate,
  buildPersonaTags,
  decayWeight,
  heatRaw,
  mixHeat,
  pickDiverse,
  rateMetrics,
  scaleByP95,
  shiftIsoDate,
  smoothCtr,
  smoothCvr,
} from "../scoring";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function nearly(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

async function run() {
  assert(asIsoDate(new Date(2026, 8, 9)) === "2026-09-09", "asIsoDate");
  assert(asIsoDate("2026-09-09T12:00:00") === "2026-09-09", "asIsoDate string");
  assert(shiftIsoDate("2026-03-01", -1) === "2026-02-28", "shift month");
  assert(nearly(decayWeight(0), 1), "decay today");
  assert(nearly(decayWeight(7), 0.5), "half life 7d");

  assert(nearly(smoothCtr(0, 0), 2 / 20), "ctr prior");
  assert(nearly(smoothCvr(0, 0), 1 / 25), "cvr prior");

  const quiet = heatRaw({ expose_uv: 20, click_uv: 4, cart_uv: 1, pay_uv: 1, pay_qty: 1 });
  const star = heatRaw({ expose_uv: 800, click_uv: 200, cart_uv: 80, pay_uv: 60, pay_qty: 90 });
  assert(star > quiet, "star raw higher");

  const heats = scaleByP95([quiet, quiet * 1.05, quiet * 0.95, star]);
  assert(heats[0] >= 1, `quiet heat should not be 0, got ${heats[0]}`);
  assert(heats[3] === 100, `star should cap 100 got ${heats[3]}`);

  const mixed = mixHeat(80, 60, 40);
  assert(mixed === Math.round(0.3 * 80 + 0.5 * 60 + 0.2 * 40), "mix weights");

  const low = rateMetrics(9, 4, 1, 0);
  assert(low.sampleInsufficient && !low.ctrSampleOk && !low.cvrSampleOk, "small sample");
  const ctrOk = rateMetrics(12, 4, 1, 0);
  assert(ctrOk.ctrSampleOk && !ctrOk.cvrSampleOk && ctrOk.sampleInsufficient, "ctr ok cvr not");
  const full = rateMetrics(20, 10, 3, 2);
  assert(full.ctrSampleOk && full.cvrSampleOk && nearly(full.cvr || 0, 0.2), "cvr 20%");
  assert(nearly(full.exposeCvr || 0, 0.1), "expose cvr");

  const tagsNew = buildPersonaTags({
    registeredDays: 3,
    orderCount: 0,
    recencyDays: null,
    frequency90: 0,
    monetaryFen90: 0,
    last30ClickPv: 0,
    last30PayOrders: 0,
    lastActivityDays: 1,
  });
  assert(tagsNew.some((t) => t.key === "new"), "new tag");

  const tagsRepeat = buildPersonaTags({
    registeredDays: 80,
    orderCount: 4,
    recencyDays: 5,
    frequency90: 4,
    monetaryFen90: 40000,
    last30ClickPv: 6,
    last30PayOrders: 2,
    lastActivityDays: 2,
  });
  assert(tagsRepeat.some((t) => t.key === "repeat"), "repeat");
  assert(tagsRepeat.some((t) => t.key === "high_value"), "high value");

  const tagsSleep = buildPersonaTags({
    registeredDays: 200,
    orderCount: 3,
    recencyDays: 60,
    frequency90: 0,
    monetaryFen90: 0,
    last30ClickPv: 0,
    last30PayOrders: 0,
    lastActivityDays: 60,
  });
  assert(tagsSleep.some((t) => t.key === "sleeping"), "sleeping");
  assert(!tagsSleep.some((t) => t.key === "new"), "sleeping is not new");

  const ranked = [
    { g: { category_id: 1 }, score: 10 },
    { g: { category_id: 1 }, score: 9 },
    { g: { category_id: 1 }, score: 8 },
    { g: { category_id: 2 }, score: 7 },
  ];
  const picked = pickDiverse(ranked, 3, 2);
  const c1 = picked.filter((p) => p.g.category_id === 1).length;
  assert(c1 === 2 && picked.some((p) => p.g.category_id === 2), "diversity then backfill");

  console.log("scoring tests passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
