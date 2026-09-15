import { Response } from "express";

export class HttpError extends Error {
  status: number;
  code: number;
  constructor(status: number, message: string, code = status) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok<T>(res: Response, data: T, message = "ok") {
  return res.json({ code: 0, message, data });
}

export function fail(res: Response, status: number, message: string, code = status) {
  return res.status(status).json({ code, message, data: null });
}

export function parsePage(q: Record<string, unknown>) {
  const page = Math.max(1, Number(q.page || 1) || 1);
  let pageSize = Number(q.pageSize || 20) || 20;
  pageSize = Math.min(100, Math.max(1, pageSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** 路径参数转正整数；非法值不要交给 knex，否则 MySQL 会把 NaN 当成列名导致 500。 */
export function requirePositiveInt(raw: unknown, label = "记录") {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, `${label}不存在`);
  return n;
}

export function maskPhone(phone?: string | number | null) {
  const s = phone == null ? "" : String(phone);
  if (!s) return "";
  if (s.length < 7) return s;
  return `${s.slice(0, 3)}****${s.slice(-4)}`;
}

export function yuanToCent(yuan: number) {
  return Math.round(yuan * 100);
}

export function centToYuan(cent: number) {
  return (cent / 100).toFixed(2);
}

export function todayShanghai() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}
