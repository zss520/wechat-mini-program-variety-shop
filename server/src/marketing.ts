import type { Knex } from "knex";
import { db } from "./db";
import { HttpError, maskPhone, parsePage, requirePositiveInt } from "./http";
import { couponDiscount, toSqlDateTime, type PricedLine } from "./pricing";

export const POINTS_REASON_LABELS: Record<string, string> = {
  PAY_EARN: "消费获得",
  REDEEM: "下单抵扣",
  REDEEM_REVERSE: "取消订单退回",
  REFUND_REVERSE: "退款退回",
  ADMIN_ADJUST: "店主调整",
};

export const USER_COUPON_STATUS_LABELS: Record<string, string> = {
  UNUSED: "未使用",
  USED: "已使用",
  EXPIRED: "已过期",
};

export const COUPON_SOURCE_LABELS: Record<string, string> = {
  CLAIM: "自行领取",
  ADMIN_GRANT: "店主发放",
};

export type CouponSource = "CLAIM" | "ADMIN_GRANT";

export function pointsReasonLabel(reason: string) {
  return POINTS_REASON_LABELS[reason] || reason;
}

export function couponSourceLabel(source?: string | null) {
  return COUPON_SOURCE_LABELS[source || "CLAIM"] || "自行领取";
}

let userCouponSourceColumn: boolean | undefined;
async function userCouponsHasSource(trx: Knex | Knex.Transaction = db) {
  if (userCouponSourceColumn === undefined) {
    userCouponSourceColumn = await trx.schema.hasColumn("user_coupons", "source");
  }
  return userCouponSourceColumn;
}

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

export async function queryPointsLedger(opts: {
  userId: number;
  page?: number;
  pageSize?: number;
  reason?: string;
  from?: string;
  to?: string;
}) {
  const userId = requirePositiveInt(opts.userId, "用户");
  const user = await db("users").where({ id: userId }).first();
  if (!user) throw new HttpError(404, "用户不存在");
  const { page, pageSize, offset } = parsePage({
    page: opts.page,
    pageSize: opts.pageSize,
  });
  const applyFilters = (b: Knex.QueryBuilder) => {
    b.where("points_ledger.user_id", userId);
    if (opts.reason) b.where("points_ledger.reason", String(opts.reason));
    if (opts.from) b.where("points_ledger.created_at", ">=", `${opts.from} 00:00:00`);
    if (opts.to) b.where("points_ledger.created_at", "<=", `${opts.to} 23:59:59`);
  };
  const filtered = db("points_ledger").modify(applyFilters);
  const totalRow = await filtered.clone().count({ c: "*" }).first();
  const allSummary = await db("points_ledger")
    .where({ user_id: userId })
    .select(
      db.raw("COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as earned"),
      db.raw("COALESCE(SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END), 0) as spent")
    )
    .first();
  const list = await db("points_ledger")
    .leftJoin("orders", "orders.id", "points_ledger.order_id")
    .modify(applyFilters)
    .select("points_ledger.*", "orders.order_no as order_no")
    .orderBy("points_ledger.id", "desc")
    .offset(offset)
    .limit(pageSize);
  const rows = list.map((row: any) => ({
    ...row,
    reasonLabel: pointsReasonLabel(row.reason),
  }));
  return {
    balance: Number(user.points_balance || 0),
    summary: {
      earned: Number(allSummary?.earned || 0),
      spent: Number(allSummary?.spent || 0),
    },
    list: rows,
    ledger: rows,
    page,
    pageSize,
    total: Number(totalRow?.c || 0),
  };
}

function couponEnded(coupon: { end_at: string | Date }, now = Date.now()) {
  return now > new Date(coupon.end_at).getTime();
}

function couponNotStarted(coupon: { start_at: string | Date }, now = Date.now()) {
  return now < new Date(coupon.start_at).getTime();
}

export async function grantCouponToUser(
  trx: Knex | Knex.Transaction,
  opts: { userId: number; couponId: number; source: CouponSource }
) {
  const user = await trx("users").where({ id: opts.userId }).first();
  if (!user) throw new HttpError(404, "用户不存在");
  const coupon = await trx("coupons").where({ id: opts.couponId }).whereNull("deleted_at").forUpdate().first();
  if (!coupon || !coupon.enabled) throw new HttpError(404, "优惠券不存在");
  const now = Date.now();
  if (couponEnded(coupon, now)) throw new HttpError(409, "优惠券已过期");
  if (opts.source === "CLAIM" && couponNotStarted(coupon, now)) {
    throw new HttpError(409, "不在领取时间内");
  }
  if (coupon.total_limit != null && Number(coupon.claimed_count) >= Number(coupon.total_limit)) {
    throw new HttpError(409, "优惠券已领完");
  }
  const mine = await trx("user_coupons").where({ user_id: opts.userId, coupon_id: opts.couponId }).count({ c: "*" }).first();
  if (Number(mine?.c || 0) >= Number(coupon.per_user_limit || 1)) {
    throw new HttpError(409, "已达个人领取上限");
  }
  const [id] = await trx("user_coupons").insert({
    user_id: opts.userId,
    coupon_id: opts.couponId,
    status: "UNUSED",
    claimed_at: trx.fn.now(),
    ...((await userCouponsHasSource(trx)) ? { source: opts.source } : {}),
  });
  await trx("coupons").where({ id: opts.couponId }).increment("claimed_count", 1);
  return trx("user_coupons").where({ id }).first();
}

export async function claimCoupon(userId: number, couponId: number) {
  return db.transaction(async (trx) => grantCouponToUser(trx, { userId, couponId, source: "CLAIM" }));
}

export async function adminGrantCoupon(couponId: number, body: { userIds?: number[]; grantAll?: boolean }) {
  const id = requirePositiveInt(couponId, "优惠券");
  const uniqueIds = [...new Set((body.userIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  return db.transaction(async (trx) => {
    const coupon = await trx("coupons").where({ id }).whereNull("deleted_at").first();
    if (!coupon) throw new HttpError(404, "优惠券不存在");
    if (!coupon.enabled) throw new HttpError(409, "优惠券已停用");
    if (couponEnded(coupon)) throw new HttpError(409, "优惠券已过期");

    let userIds = uniqueIds;
    if (body.grantAll) {
      const users = await trx("users").select("id").orderBy("id", "asc");
      userIds = users.map((u: { id: number }) => Number(u.id));
    }
    if (!userIds.length) throw new HttpError(400, "请选择要发放的会员");

    let granted = 0;
    let skipped = 0;
    let stopTotal = false;
    for (const userId of userIds) {
      if (stopTotal) {
        skipped += 1;
        continue;
      }
      try {
        await grantCouponToUser(trx, { userId, couponId: id, source: "ADMIN_GRANT" });
        granted += 1;
      } catch (e) {
        if (e instanceof HttpError && e.message === "优惠券已领完") {
          skipped += 1;
          stopTotal = true;
          continue;
        }
        if (e instanceof HttpError && (e.status === 409 || e.status === 404)) {
          skipped += 1;
          continue;
        }
        throw e;
      }
    }
    return { granted, skipped, grantAll: !!body.grantAll };
  });
}

export async function expireUserCoupons() {
  const now = new Date();
  return db("user_coupons")
    .where("user_coupons.status", "UNUSED")
    .whereExists(function exists() {
      this.select(db.raw("1"))
        .from("coupons")
        .whereRaw("coupons.id = user_coupons.coupon_id")
        .andWhere((w) => {
          w.where("coupons.end_at", "<", now).orWhereNotNull("coupons.deleted_at").orWhere("coupons.enabled", 0);
        });
    })
    .update({ status: "EXPIRED" });
}

export async function voidCoupon(couponId: number) {
  const id = requirePositiveInt(couponId, "优惠券");
  return db.transaction(async (trx) => {
    const coupon = await trx("coupons").where({ id }).whereNull("deleted_at").first();
    if (!coupon) throw new HttpError(404, "优惠券不存在");
    await trx("coupons").where({ id }).update({ deleted_at: trx.fn.now(), enabled: 0 });
    await trx("user_coupons").where({ coupon_id: id, status: "UNUSED" }).update({ status: "EXPIRED" });
    return true;
  });
}

export async function attachCouponStats<T extends { id: number }>(list: T[]) {
  const ids = list.map((c) => c.id);
  if (!ids.length) return list.map((c) => ({ ...c, issuedCount: 0, unusedCount: 0, usedCount: 0, expiredCount: 0 }));
  const rows = await db("user_coupons")
    .whereIn("coupon_id", ids)
    .select("coupon_id", "status")
    .count({ c: "*" })
    .groupBy("coupon_id", "status");
  const map: Record<number, { issued: number; unused: number; used: number; expired: number }> = {};
  for (const id of ids) map[id] = { issued: 0, unused: 0, used: 0, expired: 0 };
  for (const r of rows as any[]) {
    const m = map[Number(r.coupon_id)];
    if (!m) continue;
    const n = Number(r.c || 0);
    m.issued += n;
    if (r.status === "UNUSED") m.unused += n;
    else if (r.status === "USED") m.used += n;
    else if (r.status === "EXPIRED") m.expired += n;
  }
  return list.map((c) => {
    const s = map[c.id] || { issued: 0, unused: 0, used: 0, expired: 0 };
    return {
      ...c,
      issuedCount: s.issued,
      unusedCount: s.unused,
      usedCount: s.used,
      expiredCount: s.expired,
    };
  });
}

export async function listCouponHolders(couponId: number, opts: { page?: number; pageSize?: number; status?: string }) {
  const id = requirePositiveInt(couponId, "优惠券");
  const coupon = await db("coupons").where({ id }).first();
  if (!coupon) throw new HttpError(404, "优惠券不存在");
  const { page, pageSize, offset } = parsePage({ page: opts.page, pageSize: opts.pageSize });
  const status = opts.status && opts.status !== "ALL" ? String(opts.status) : "";
  const apply = (b: Knex.QueryBuilder) => {
    b.where("user_coupons.coupon_id", id);
    if (status) b.where("user_coupons.status", status);
  };
  const total = await db("user_coupons")
    .leftJoin("users", "users.id", "user_coupons.user_id")
    .modify(apply)
    .count({ c: "*" })
    .first();
  const list = await db("user_coupons")
    .leftJoin("users", "users.id", "user_coupons.user_id")
    .modify(apply)
    .select("user_coupons.*", "users.nickname as nickname", "users.phone as phone")
    .orderBy("user_coupons.id", "desc")
    .offset(offset)
    .limit(pageSize);
  return {
    coupon: { id: coupon.id, name: coupon.name, claimed_count: coupon.claimed_count },
    list: list.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      nickname: r.nickname,
      phone: maskPhone(r.phone),
      status: r.status,
      statusLabel: USER_COUPON_STATUS_LABELS[r.status] || r.status,
      source: r.source || "CLAIM",
      sourceLabel: couponSourceLabel(r.source),
      claimedAt: r.claimed_at,
      usedAt: r.used_at,
      orderId: r.order_id,
    })),
    page,
    pageSize,
    total: Number(total?.c || 0),
  };
}

export function decorateUserCoupon(row: {
  status: string;
  end_at?: string | Date;
  source?: string | null;
  [k: string]: unknown;
}) {
  const ended = row.end_at ? couponEnded({ end_at: row.end_at }) : false;
  const displayStatus = row.status === "UNUSED" && ended ? "EXPIRED" : row.status;
  return {
    ...row,
    displayStatus,
    statusLabel: USER_COUPON_STATUS_LABELS[displayStatus] || displayStatus,
    sourceLabel: couponSourceLabel(row.source as string),
  };
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
  const decorate = (c: any, claimed: number) => {
    const soldOut = c.total_limit != null && Number(c.claimed_count) >= Number(c.total_limit);
    const userRemain = Math.max(0, Number(c.per_user_limit || 1) - claimed);
    return {
      ...c,
      claimed,
      soldOut,
      remain: soldOut ? 0 : userRemain,
    };
  };
  if (!userId) return list.map((c) => decorate(c, 0));
  const mine = await db("user_coupons").where({ user_id: userId }).select("coupon_id");
  const count: Record<number, number> = {};
  for (const r of mine) count[r.coupon_id] = (count[r.coupon_id] || 0) + 1;
  return list.map((c) => decorate(c, count[c.id] || 0));
}

export function couponPayload(body: Record<string, unknown>) {
  const totalRaw = body.totalLimit ?? body.total_limit;
  const totalNum = totalRaw == null || totalRaw === "" ? null : Number(totalRaw);
  return {
    name: String(body.name || "").slice(0, 40),
    type: body.type === "DISCOUNT" ? "DISCOUNT" : "FULL_REDUCE",
    min_amount_cent: Number(body.minAmountCent ?? body.min_amount_cent ?? 0),
    reduce_cent: Number(body.reduceCent ?? body.reduce_cent ?? 0),
    discount_bp: Number(body.discountBp ?? body.discount_bp ?? 10000),
    discount_cap_cent: body.discountCapCent == null && body.discount_cap_cent == null ? null : Number(body.discountCapCent ?? body.discount_cap_cent),
    per_user_limit: Math.max(1, Number(body.perUserLimit ?? body.per_user_limit ?? 1) || 1),
    total_limit: totalNum == null || !Number.isFinite(totalNum) || totalNum <= 0 ? null : totalNum,
    start_at: toSqlDateTime(String(body.startAt ?? body.start_at)),
    end_at: toSqlDateTime(String(body.endAt ?? body.end_at)),
    enabled: body.enabled === false || body.enabled === 0 ? 0 : 1,
  };
}
