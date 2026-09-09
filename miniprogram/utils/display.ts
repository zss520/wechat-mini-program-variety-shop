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
