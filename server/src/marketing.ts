import type { Knex } from "knex";
import { db } from "./db";
import { HttpError } from "./http";
import { couponDiscount, toSqlDateTime, type PricedLine } from "./pricing";

export async function changePoints(
  trx: Knex | Knex.Transaction,
  userId: number,
  delta: number,
  reason: string,
  orderId?: number | null,
  note?: string
) {
  const user = await trx("users").where({ id: userId }).forUpdate().first();
  if (!user) throw new HttpError(404, "用户不存在");
  const next = Number(user.points_balance || 0) + delta;
  if (next < 0) throw new HttpError(409, "积分不足", 10006);
  await trx("users").where({ id: userId }).update({ points_balance: next });
  await trx("points_ledger").insert({
    user_id: userId,
    delta,
    balance_after: next,
    reason,
    order_id: orderId || null,
    note: note || null,
  });
  return next;
}

export async function claimCoupon(userId: number, couponId: number) {
  return db.transaction(async (trx) => {
    const coupon = await trx("coupons").where({ id: couponId }).whereNull("deleted_at").forUpdate().first();
    if (!coupon || !coupon.enabled) throw new HttpError(404, "优惠券不存在");
    const now = Date.now();
    if (now < new Date(coupon.start_at).getTime() || now > new Date(coupon.end_at).getTime()) {
      throw new HttpError(409, "不在领取时间内");
    }
    if (coupon.total_limit != null && Number(coupon.claimed_count) >= Number(coupon.total_limit)) {
      throw new HttpError(409, "优惠券已领完");
    }
    const mine = await trx("user_coupons").where({ user_id: userId, coupon_id: couponId }).count({ c: "*" }).first();
    if (Number(mine?.c || 0) >= Number(coupon.per_user_limit || 1)) {
      throw new HttpError(409, "已达个人领取上限");
    }
    const [id] = await trx("user_coupons").insert({
      user_id: userId,
      coupon_id: couponId,
      status: "UNUSED",
      claimed_at: trx.fn.now(),
    });
    await trx("coupons").where({ id: couponId }).increment("claimed_count", 1);
    return trx("user_coupons").where({ id }).first();
  });
}

export async function loadUsableCoupon(userId: number, userCouponId: number, lines: PricedLine[], goodsAmount: number) {
  const uc = await db("user_coupons").where({ id: userCouponId, user_id: userId }).first();
  if (!uc || uc.status !== "UNUSED") throw new HttpError(409, "优惠券不可用");
  const coupon = await db("coupons").where({ id: uc.coupon_id }).whereNull("deleted_at").first();
  if (!coupon || !coupon.enabled) throw new HttpError(409, "优惠券已失效");
  const now = Date.now();
  if (now < new Date(coupon.start_at).getTime() || now > new Date(coupon.end_at).getTime()) {
    throw new HttpError(409, "优惠券已过期");
  }
  const applied = couponDiscount(coupon, lines, goodsAmount);
  if (!applied.ok) throw new HttpError(409, applied.reason);
  return { userCoupon: uc, coupon, discount: applied.discount };
}

export async function listClaimableCoupons(userId?: number) {
  const now = new Date();
  const list = await db("coupons")
    .where({ enabled: 1 })
    .whereNull("deleted_at")
    .where("start_at", "<=", now)
    .where("end_at", ">=", now);
  if (!userId) return list.map((c) => ({ ...c, claimed: 0, remain: c.per_user_limit }));
  const mine = await db("user_coupons").where({ user_id: userId }).select("coupon_id");
  const count: Record<number, number> = {};
  for (const r of mine) count[r.coupon_id] = (count[r.coupon_id] || 0) + 1;
  return list.map((c) => ({
    ...c,
    claimed: count[c.id] || 0,
    remain: Math.max(0, Number(c.per_user_limit) - (count[c.id] || 0)),
  }));
}

export function couponPayload(body: Record<string, unknown>) {
  return {
    name: String(body.name || "").slice(0, 40),
    type: body.type === "DISCOUNT" ? "DISCOUNT" : "FULL_REDUCE",
    min_amount_cent: Number(body.minAmountCent ?? body.min_amount_cent ?? 0),
    reduce_cent: Number(body.reduceCent ?? body.reduce_cent ?? 0),
    discount_bp: Number(body.discountBp ?? body.discount_bp ?? 10000),
    discount_cap_cent: body.discountCapCent == null && body.discount_cap_cent == null ? null : Number(body.discountCapCent ?? body.discount_cap_cent),
    per_user_limit: Number(body.perUserLimit ?? body.per_user_limit ?? 1),
    total_limit: body.totalLimit == null && body.total_limit == null ? null : Number(body.totalLimit ?? body.total_limit),
    start_at: toSqlDateTime(String(body.startAt ?? body.start_at)),
    end_at: toSqlDateTime(String(body.endAt ?? body.end_at)),
    enabled: body.enabled === false || body.enabled === 0 ? 0 : 1,
  };
}
