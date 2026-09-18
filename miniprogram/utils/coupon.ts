import { asArray } from "./display";
import { formatDateRange, formatDateTime } from "./datetime";

export type CouponPreview = {
  goodsAmountCent?: number;
  items?: Array<{ isPromo?: boolean; amountCent?: number }>;
};

function parseTime(v: unknown): number {
  if (v == null || v === "") return NaN;
  if (v instanceof Date) return v.getTime();
  const s = String(v).trim().replace(" ", "T");
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function yuanLabel(cent: number) {
  const n = Math.round(Number(cent || 0)) / 100;
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function couponTypeText(type: unknown) {
  return String(type || "") === "DISCOUNT" ? "折扣券" : "满减券";
}

export function couponThresholdText(minCent: unknown) {
  const n = Number(minCent || 0);
  if (!Number.isFinite(n) || n <= 0) return "无使用门槛";
  return `满¥${yuanLabel(n)}可用`;
}

export function couponPeriodText(start: unknown, end: unknown) {
  return formatDateRange(start as string, end as string);
}

export function decorateCouponView(row: any) {
  return {
    ...row,
    typeText: couponTypeText(row.type),
    thresholdText: couponThresholdText(row.min_amount_cent),
    startText: formatDateTime(row.start_at),
    endText: formatDateTime(row.end_at),
    periodText: couponPeriodText(row.start_at, row.end_at),
  };
}

export function couponBlockReason(coupon: any, preview: CouponPreview): string {
  const now = Date.now();
  const start = parseTime(coupon.start_at);
  if (Number.isFinite(start) && now < start) return "未到可用时间";
  const end = parseTime(coupon.end_at);
  if (Number.isFinite(end) && now > end) return "已过期";
  const min = Number(coupon.min_amount_cent || 0);
  const goods = Number(preview.goodsAmountCent || 0);
  if (String(coupon.type || "") === "DISCOUNT") {
    const base = asArray(preview.items)
      .filter((l: any) => !l.isPromo)
      .reduce((s: number, l: any) => s + Number(l.amountCent || 0), 0);
    if (base <= 0) return "折扣券不与特价/拼团/秒杀叠加";
    if (base < min) return min > 0 ? `未满门槛，还差¥${yuanLabel(min - base)}` : "未满优惠券门槛";
    return "";
  }
  if (goods < min) return min > 0 ? `未满门槛，还差¥${yuanLabel(min - goods)}` : "未满优惠券门槛";
  return "";
}

export function usableCoupons<T extends Record<string, any>>(coupons: T[], preview: CouponPreview): T[] {
  return (coupons || []).filter((c) => !couponBlockReason(c, preview));
}
