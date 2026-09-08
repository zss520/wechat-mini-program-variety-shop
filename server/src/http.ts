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

export function maskPhone(phone?: string | null) {
  if (!phone) return "";
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
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
