import { db } from "./db";
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
  const members = await db("group_buy_members").where({ team_id: teamId }).orderBy("id", "asc");
  const goods = act ? await db("goods").where({ id: act.goods_id }).first() : null;
  return {
    ...team,
    activity: act,
    goods: goods ? publicGoods(goods) : null,
    members,
    paidCount: members.length,
    remain: Math.max(0, Number(act?.required_count || 0) - members.length),
  };
}

export function campaignBody(kind: "GROUP" | "SECKILL", body: Record<string, unknown>) {
  const base = {
    goods_id: Number(body.goodsId ?? body.goods_id),
    title: String(body.title || "").slice(0, 40),
    start_at: toSqlDateTime(String(body.startAt ?? body.start_at)),
    end_at: toSqlDateTime(String(body.endAt ?? body.end_at)),
    enabled: body.enabled === false || body.enabled === 0 ? 0 : 1,
  };
  if (kind === "GROUP") {
    return {
      ...base,
      required_count: Math.max(2, Number(body.requiredCount ?? body.required_count ?? 2)),
      group_price_cent: Number(body.groupPriceCent ?? body.group_price_cent),
      expire_hours: Math.max(1, Number(body.expireHours ?? body.expire_hours ?? 24)),
    };
  }
  return {
    ...base,
    seckill_price_cent: Number(body.seckillPriceCent ?? body.seckill_price_cent),
    seckill_stock: Math.max(0, Number(body.seckillStock ?? body.seckill_stock ?? 0)),
    per_user_limit: Math.max(1, Number(body.perUserLimit ?? body.per_user_limit ?? 1)),
  };
}
