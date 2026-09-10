/** 热度 / 转化率 / 画像标签的可解释计算，禁止黑盒。 */

export type HeatStats = {
  expose_uv: number;
  click_uv: number;
  cart_uv: number;
  pay_uv: number;
  pay_qty: number;
};

export type RateFlags = {
  ctr: number | null;
  cvr: number | null;
  exposeCvr: number | null;
  cartRate: number | null;
  ctrSampleOk: boolean;
  cvrSampleOk: boolean;
  exposeCvrSampleOk: boolean;
  cartSampleOk: boolean;
  /** 文档 3.1：CTR/CVR 自动排序惩罚用，新品保护 */
  sampleInsufficient: boolean;
};

export function ln1(n: number) {
  return Math.log(1 + Math.max(0, n));
}

export function asIsoDate(v: unknown): string {
  if (v instanceof Date && Number.isFinite(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v || "");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function diffIsoDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** 半衰期 7 天：7 日前权重 0.5 */
export function decayWeight(daysAgo: number, halfLifeDays = 7) {
  if (!Number.isFinite(daysAgo) || daysAgo <= 0) return 1;
  return Math.pow(0.5, daysAgo / halfLifeDays);
}

/** 弱先验约 10%，避免小样本 CTR 虚高 */
export function smoothCtr(clickUv: number, exposeUv: number) {
  return (Math.max(0, clickUv) + 2) / (Math.max(0, exposeUv) + 20);
}

/** 弱先验约 4%，购买率分子必须是支付人数 */
export function smoothCvr(payUv: number, clickUv: number) {
  return (Math.max(0, payUv) + 1) / (Math.max(0, clickUv) + 25);
}

export function emptyHeat(): HeatStats {
  return { expose_uv: 0, click_uv: 0, cart_uv: 0, pay_uv: 0, pay_qty: 0 };
}

export function addHeat(a: HeatStats, b: HeatStats, w = 1): HeatStats {
  return {
    expose_uv: a.expose_uv + b.expose_uv * w,
    click_uv: a.click_uv + b.click_uv * w,
    cart_uv: a.cart_uv + b.cart_uv * w,
    pay_uv: a.pay_uv + b.pay_uv * w,
    pay_qty: a.pay_qty + b.pay_qty * w,
  };
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function heatRaw(s?: HeatStats | null) {
  const x = s || emptyHeat();
  const ctr = smoothCtr(num(x.click_uv), num(x.expose_uv));
  const cvr = smoothCvr(num(x.pay_uv), num(x.click_uv));
  return (
    0.08 * ln1(num(x.expose_uv)) +
    0.18 * ln1(num(x.click_uv)) +
    0.2 * ln1(num(x.cart_uv)) +
    0.34 * ln1(num(x.pay_uv)) +
    0.08 * ln1(num(x.pay_qty)) +
    0.07 * ln1(ctr * 100) +
    0.05 * ln1(cvr * 100)
  );
}

/** 用 P95 缩放，避免单个爆款把其余商品压成 0 */
export function scaleByP95(raws: number[]): number[] {
  if (!raws.length) return [];
  const clean = raws.map((r) => (Number.isFinite(r) && r > 0 ? r : 0));
  const sorted = [...clean].sort((a, b) => a - b);
  const last = sorted.length - 1;
  const p95 = sorted[Math.min(last, Math.floor(last * 0.95))];
  const p50 = sorted[Math.floor(last * 0.5)];
  const scale = Math.max(p95, p50 * 3, 1e-6);
  return clean.map((r) => {
    if (r <= 0) return 0;
    return Math.max(1, Math.min(100, Math.round((100 * r) / scale)));
  });
}

export function mixHeat(heatToday: number, heat7: number, heat30: number) {
  const n = Math.round(0.3 * (heatToday || 0) + 0.5 * (heat7 || 0) + 0.2 * (heat30 || 0));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

export function rateMetrics(exposeUv: number, clickUv: number, cartUv: number, payUv: number): RateFlags {
  const e = Math.max(0, exposeUv);
  const c = Math.max(0, clickUv);
  const cart = Math.max(0, cartUv);
  const p = Math.max(0, payUv);
  return {
    ctr: e > 0 ? c / e : null,
    cvr: c > 0 ? p / c : null,
    exposeCvr: e > 0 ? p / e : null,
    cartRate: c > 0 ? cart / c : null,
    ctrSampleOk: e >= 10,
    cvrSampleOk: c >= 10,
    exposeCvrSampleOk: e >= 10,
    cartSampleOk: c >= 10,
    sampleInsufficient: e < 10 || c < 5,
  };
}

export type PersonaTag = { key: string; label: string };

export function rfmScores(recencyDays: number | null, frequency90: number, monetaryFen90: number) {
  const recencyScore =
    recencyDays == null ? 1 : recencyDays <= 7 ? 5 : recencyDays <= 14 ? 4 : recencyDays <= 30 ? 3 : recencyDays <= 60 ? 2 : 1;
  const f = Math.max(0, frequency90);
  const frequencyScore = f <= 0 ? 1 : f === 1 ? 2 : f <= 3 ? 3 : f <= 6 ? 4 : 5;
  const yuan = Math.max(0, monetaryFen90) / 100;
  const monetaryScore = yuan <= 0 ? 1 : yuan < 50 ? 2 : yuan < 150 ? 3 : yuan < 300 ? 4 : 5;
  return { recencyScore, frequencyScore, monetaryScore };
}

export type RadarAxis = { key: string; name: string; max: number };

export function clampScore(n: number, min = 1, max = 5) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function activityRadarScore(input: {
  exposePv: number;
  clickPv: number;
  detailPv: number;
  cartPv: number;
  payOrders: number;
}) {
  const hits = [input.exposePv > 0, input.clickPv > 0, input.detailPv > 0, input.cartPv > 0, input.payOrders > 0].filter(Boolean)
    .length;
  return clampScore(hits || 1);
}

export function conversionRadarScore(clickPv: number, payOrders: number) {
  if (payOrders <= 0) return clickPv > 0 ? 2 : 1;
  if (clickPv <= 0) return 4;
  const r = payOrders / Math.max(1, clickPv);
  if (r >= 0.4) return 5;
  if (r >= 0.2) return 4;
  if (r >= 0.08) return 3;
  return 2;
}

export function personaRadar(input: {
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  exposePv: number;
  clickPv: number;
  detailPv: number;
  cartPv: number;
  payOrders: number;
}) {
  const indicators: RadarAxis[] = [
    { key: "recency", name: "近度", max: 5 },
    { key: "frequency", name: "频次", max: 5 },
    { key: "monetary", name: "金额", max: 5 },
    { key: "activity", name: "活跃", max: 5 },
    { key: "conversion", name: "转化", max: 5 },
  ];
  const values = [
    clampScore(input.recencyScore),
    clampScore(input.frequencyScore),
    clampScore(input.monetaryScore),
    activityRadarScore(input),
    conversionRadarScore(input.clickPv, input.payOrders),
  ];
  return { indicators, values };
}

export function buildPersonaTags(input: {
  registeredDays: number;
  orderCount: number;
  recencyDays: number | null;
  frequency90: number;
  monetaryFen90: number;
  last30ClickPv: number;
  last30PayOrders: number;
  lastActivityDays: number;
}): PersonaTag[] {
  const tags: PersonaTag[] = [];
  const sleeping =
    (input.orderCount >= 1 && input.recencyDays != null && input.recencyDays > 45) ||
    (input.orderCount === 0 && input.lastActivityDays > 45);
  const isNew =
    !sleeping &&
    (input.orderCount === 0 && input.registeredDays <= 14
      ? true
      : input.orderCount === 1 && (input.recencyDays == null || input.recencyDays <= 30));
  if (sleeping) tags.push({ key: "sleeping", label: "沉睡" });
  else if (isNew) tags.push({ key: "new", label: "新客" });
  if (input.orderCount >= 2 && !sleeping) tags.push({ key: "repeat", label: "复购" });
  const { monetaryScore, frequencyScore } = rfmScores(input.recencyDays, input.frequency90, input.monetaryFen90);
  if (monetaryScore >= 4 && (frequencyScore >= 3 || input.orderCount >= 3)) {
    tags.push({ key: "high_value", label: "高价值" });
  }
  if (input.frequency90 >= 4 && !sleeping) tags.push({ key: "loyal", label: "常购" });
  if (input.last30PayOrders === 0 && input.last30ClickPv >= 8) tags.push({ key: "browser", label: "浏览型" });
  else if (input.orderCount === 0 && input.last30ClickPv >= 3) tags.push({ key: "potential", label: "潜力" });
  if (!tags.length) tags.push({ key: "normal", label: "普通" });
  return tags.slice(0, 4);
}

export function pickDiverse<T extends { category_id?: number }>(
  ranked: { g: T; score: number }[],
  limit: number,
  maxPerCat = 3
) {
  const out: { g: T; score: number }[] = [];
  const skipped: { g: T; score: number }[] = [];
  const catCount: Record<number, number> = {};
  for (const item of ranked) {
    if (out.length >= limit) break;
    const cat = Number(item.g.category_id || 0);
    if ((catCount[cat] || 0) >= maxPerCat) {
      skipped.push(item);
      continue;
    }
    catCount[cat] = (catCount[cat] || 0) + 1;
    out.push(item);
  }
  for (const item of skipped) {
    if (out.length >= limit) break;
    out.push(item);
  }
  return out;
}
