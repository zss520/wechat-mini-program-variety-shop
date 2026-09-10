import { publicUrl } from "./config";
import { db } from "./db";
import { HttpError } from "./http";
import { publicGoods } from "./recommend";
import { toSqlDateTime } from "./pricing";

export function activityWindowOk(row: { start_at: string | Date; end_at: string | Date; enabled?: number }) {
  if (row.enabled === 0) return false;
  const now = Date.now();
  return now >= new Date(row.start_at).getTime() && now <= new Date(row.end_at).getTime();
}

export async function listActiveGroupBuys() {
  const now = new Date();
  const rows = await db("group_buy_activities")
    .where({ enabled: 1 })
    .whereNull("deleted_at")
    .where("start_at", "<=", now)
    .where("end_at", ">=", now);
  const out = [];
  for (const a of rows) {
    const g = await db("goods").where({ id: a.goods_id }).whereNull("deleted_at").first();
    if (!g || !g.on_sale) continue;
    out.push({ ...a, goods: publicGoods(g) });
  }
  return out;
}

export async function listActiveSeckills() {
  const now = new Date();
  const rows = await db("seckill_activities")
    .where({ enabled: 1 })
    .whereNull("deleted_at")
    .where("start_at", "<=", now)
    .where("end_at", ">=", now);
  const out = [];
  for (const a of rows) {
    const g = await db("goods").where({ id: a.goods_id }).whereNull("deleted_at").first();
    if (!g) continue;
    out.push({ ...a, goods: publicGoods({ ...g, price_cent: a.seckill_price_cent, origin_price_cent: g.price_cent }) });
  }
  return out;
}

export async function loadTeam(teamId: number) {
  const team = await db("group_buy_teams").where({ id: teamId }).first();
  if (!team) return null;
  const act = await db("group_buy_activities").where({ id: team.activity_id }).first();
  const rows = await db("group_buy_members as m")
    .leftJoin("users as u", "u.id", "m.user_id")
    .where("m.team_id", teamId)
    .select("m.id", "m.user_id", "m.order_id", "m.joined_at", "u.nickname", "u.avatar_url")
    .orderBy("m.id", "asc");
  const goods = act ? await db("goods").where({ id: act.goods_id }).first() : null;
  const members = rows.map((m: { id: number; user_id: number; nickname?: string; avatar_url?: string }) => ({
    id: m.id,
    userId: m.user_id,
    nickname: String(m.nickname || "").trim() || "邻居",
    avatarUrl: publicUrl(m.avatar_url) || "",
    leader: Number(m.user_id) === Number(team.leader_user_id),
  }));
  return {
    ...team,
    activity: act,
    goods: goods ? publicGoods(goods) : null,
    members,
    paidCount: members.length,
    remain: Math.max(0, Number(act?.required_count || 0) - members.length),
  };
}

function asInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
}

function clampInt(v: unknown, fallback: number, min: number, max: number) {
  const n = asInt(v, fallback);
  return Math.min(max, Math.max(min, n));
}

export function campaignBody(kind: "GROUP" | "SECKILL", body: Record<string, unknown>) {
  const base = {
    goods_id: asInt(body.goodsId ?? body.goods_id, 0),
    title: String(body.title || "").trim().slice(0, 40),
    start_at: toSqlDateTime(String(body.startAt ?? body.start_at ?? "")),
    end_at: toSqlDateTime(String(body.endAt ?? body.end_at ?? "")),
    enabled: body.enabled === false || body.enabled === 0 ? 0 : 1,
    per_user_limit: clampInt(body.perUserLimit ?? body.per_user_limit ?? 1, 1, 1, 99),
  };
  if (kind === "GROUP") {
    return {
      ...base,
      required_count: clampInt(body.requiredCount ?? body.required_count ?? 2, 2, 2, 99),
      group_price_cent: asInt(body.groupPriceCent ?? body.group_price_cent, 0),
      expire_hours: clampInt(body.expireHours ?? body.expire_hours ?? 24, 24, 1, 168),
    };
  }
  return {
    ...base,
    seckill_price_cent: asInt(body.seckillPriceCent ?? body.seckill_price_cent, 0),
    seckill_stock: clampInt(body.seckillStock ?? body.seckill_stock ?? 0, 0, 0, 999999),
  };
}

export async function saveCampaignPayload(kind: "GROUP" | "SECKILL", body: Record<string, unknown>) {
  const payload = campaignBody(kind, body);
  if (!payload.title) throw new HttpError(400, "请填写标题");
  if (!payload.goods_id) throw new HttpError(400, "请选择商品");
  const goods = await db("goods").where({ id: payload.goods_id }).whereNull("deleted_at").first();
  if (!goods) throw new HttpError(400, "商品不存在");
  if (!payload.start_at || !payload.end_at) throw new HttpError(400, "请填写开始和结束时间");
  if (String(payload.start_at) >= String(payload.end_at)) throw new HttpError(400, "结束时间须晚于开始时间");
  if (kind === "GROUP") {
    const row = payload as typeof payload & { required_count: number; group_price_cent: number };
    if (row.required_count < 2) throw new HttpError(400, "成团人数须为不小于 2 的整数");
    if (row.group_price_cent < 1) throw new HttpError(400, "团价须为大于 0 的整数，单位是分");
  } else {
    const row = payload as typeof payload & { seckill_price_cent: number; seckill_stock: number };
    if (row.seckill_price_cent < 1) throw new HttpError(400, "秒杀价须为大于 0 的整数，单位是分");
    if (row.seckill_stock < 1) throw new HttpError(400, "秒杀库存须为大于 0 的整数");
  }
  return { payload, goods };
}

export function campaignAdminQuery(kind: "GROUP" | "SECKILL") {
  const table = kind === "GROUP" ? "group_buy_activities" : "seckill_activities";
  return db(`${table} as a`)
    .leftJoin("goods as g", "g.id", "a.goods_id")
    .leftJoin("categories as c", "c.id", "g.category_id")
    .whereNull("a.deleted_at")
    .select(
      "a.*",
      "g.name as goods_name",
      "g.price_cent as origin_price_cent",
      "g.category_id as goods_category_id",
      "c.name as category_name"
    )
    .orderBy("a.id", "desc");
}
