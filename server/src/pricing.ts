export type LineInput = { goodsId: number; qty: number };

export type PricedLine = {
  goodsId: number;
  name: string;
  coverUrl: string;
  unit: string;
  qty: number;
  stock: number;
  listPriceCent: number;
  priceCent: number;
  amountCent: number;
  isSpecial: boolean;
  isSeckill: boolean;
  isGroup: boolean;
  isPromo: boolean;
};

export function isSpecialActive(g: {
  special_price_cent?: number | null;
  special_start?: string | Date | null;
  special_end?: string | Date | null;
  price_cent: number;
}, now = Date.now()) {
  const sp = Number(g.special_price_cent || 0);
  if (!sp || !g.special_start || !g.special_end) return false;
  const start = new Date(g.special_start).getTime();
  const end = new Date(g.special_end).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end && sp < Number(g.price_cent);
}

export function salePriceOf(g: {
  price_cent: number;
  origin_price_cent?: number | null;
  special_price_cent?: number | null;
  special_start?: string | Date | null;
  special_end?: string | Date | null;
}) {
  const list = Number(g.price_cent);
  if (isSpecialActive(g)) {
    return {
      priceCent: Number(g.special_price_cent),
      originCent: list,
      isSpecial: true,
    };
  }
  return {
    priceCent: list,
    originCent: g.origin_price_cent ? Number(g.origin_price_cent) : null,
    isSpecial: false,
  };
}

export function toSqlDateTime(s?: string | null) {
  if (!s) return null;
  return s.replace("T", " ").slice(0, 19);
}

export function couponDiscount(
  coupon: {
    type: string;
    min_amount_cent: number;
    reduce_cent: number;
    discount_bp: number;
    discount_cap_cent?: number | null;
  },
  lines: PricedLine[],
  goodsAmount: number
) {
  if (coupon.type === "FULL_REDUCE") {
    if (goodsAmount < Number(coupon.min_amount_cent || 0)) return { ok: false, reason: "未满优惠券门槛", discount: 0 };
    return { ok: true, reason: "", discount: Math.min(Number(coupon.reduce_cent || 0), goodsAmount) };
  }
  if (coupon.type === "DISCOUNT") {
    const base = lines.filter((l) => !l.isPromo).reduce((s, l) => s + l.amountCent, 0);
    if (base <= 0) return { ok: false, reason: "折扣券不与特价/拼团/秒杀叠加", discount: 0 };
    if (base < Number(coupon.min_amount_cent || 0)) return { ok: false, reason: "未满优惠券门槛", discount: 0 };
    const bp = Math.min(10000, Math.max(1000, Number(coupon.discount_bp || 10000)));
    let off = Math.round((base * (10000 - bp)) / 10000);
    if (coupon.discount_cap_cent) off = Math.min(off, Number(coupon.discount_cap_cent));
    return { ok: true, reason: "", discount: Math.min(off, base) };
  }
  return { ok: false, reason: "不支持的券类型", discount: 0 };
}

export function pointsRedeem(balance: number, redeemRate: number, payableCent: number) {
  const rate = Math.max(1, Number(redeemRate || 100));
  const maxByBalance = Math.floor(Number(balance || 0) / rate) * 100;
  const useCent = Math.min(maxByBalance, Math.max(0, payableCent));
  const usePoints = Math.round((useCent / 100) * rate);
  return { usePoints, useCent };
}
