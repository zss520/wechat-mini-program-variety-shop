/** 接口字段缺失、非法时的展示兜底，避免页面出现 NaN / undefined */

export const DISPLAY_FALLBACK = "—";

export function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

export function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() === "") return null;
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function asRecord<T extends Record<string, any>>(v: unknown, fallback: T = {} as T): T {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as T) : fallback;
}

export function displayText(v: unknown, fallback = DISPLAY_FALLBACK): string {
  if (isBlank(v)) return fallback;
  if (typeof v === "number" && !Number.isFinite(v)) return fallback;
  const s = String(v).trim();
  if (!s || s === "undefined" || s === "null" || s === "NaN" || s === "Invalid Date") return fallback;
  return s;
}

export function displayNumber(v: unknown, fallback = DISPLAY_FALLBACK): string {
  const n = toFiniteNumber(v);
  return n == null ? fallback : String(n);
}

export function displayYuan(cent: unknown, digits = 2, fallback = DISPLAY_FALLBACK): string {
  const n = toFiniteNumber(cent);
  if (n == null) return fallback;
  return `¥${(n / 100).toFixed(digits)}`;
}

export function displayYuanInt(cent: unknown, fallback = DISPLAY_FALLBACK): string {
  const n = toFiniteNumber(cent);
  if (n == null) return fallback;
  return String(Math.round(n / 100));
}

export function displayDiscountFold(bp: unknown, fallback = DISPLAY_FALLBACK): string {
  const n = toFiniteNumber(bp);
  if (n == null) return fallback;
  return (n / 1000).toFixed(1);
}

export function displayPercent(ratio: unknown, digits = 1, fallback = DISPLAY_FALLBACK): string {
  const n = toFiniteNumber(ratio);
  if (n == null) return fallback;
  return `${(n * 100).toFixed(digits)}%`;
}

export function displayJoin(...parts: unknown[]): string {
  const s = parts.map((p) => displayText(p, "")).filter(Boolean).join(" ");
  return s || DISPLAY_FALLBACK;
}

export function displayFulfillType(v: unknown): string {
  if (v === "PICKUP") return "自提";
  if (v === "DELIVERY") return "配送";
  return displayText(v);
}

export function displayCouponRule(c: {
  type?: string;
  min_amount_cent?: unknown;
  discount_bp?: unknown;
  reduce_cent?: unknown;
}): string {
  const min = displayYuanInt(c.min_amount_cent);
  const minPart = `满${min}`;
  if (c.type === "DISCOUNT") return `${minPart} 打${displayDiscountFold(c.discount_bp)}折`;
  return `${minPart} 减${displayYuanInt(c.reduce_cent)}`;
}
