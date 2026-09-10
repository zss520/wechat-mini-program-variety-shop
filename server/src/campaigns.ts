import { publicUrl } from "./config";
import { db } from "./db";
import { HttpError } from "./http";
import { publicGoods } from "./recommend";
import { toSqlDateTime } from "./pricing";

export const GROUP_PAID_STATUSES = ["GROUPING", "PENDING_PACK", "WAIT_PICKUP", "WAIT_DELIVER", "DELIVERING", "COMPLETED"];
export const MAX_GROUP_COMBO = 8;

export function activityWindowOk(row: { start_at: string | Date; end_at: string | Date; enabled?: number }) {
  if (row.enabled === 0) return false;
  const now = Date.now();
  return now >= new Date(row.start_at).getTime() && now <= new Date(row.end_at).getTime();
}

function asInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
}

function clampInt(v: unknown, fallback: number, min: number, max: number) {
  const n = asInt(v, fallback);
  return Math.min(max, Math.max(min, n));
}

export function comboTotalCent(items: Array<{ group_price_cent?: number; groupPriceCent?: number }>) {
  return items.reduce((s, x) => s + Number(x.group_price_cent ?? x.groupPriceCent ?? 0), 0);
}

export type GroupGoodsItem = { goods_id: number; group_price_cent: number; sort?: number };

export function parseGroupGoodsItems(body: Record<string, unknown>): GroupGoodsItem[] {
  const raw = body.goodsItems ?? body.goods_items;
  const out: GroupGoodsItem[] = [];
  const seen = new Set<number>();
  if (Array.isArray(raw)) {
    raw.forEach((item, idx) => {
      const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const goodsId = asInt(row.goodsId ?? row.goods_id, 0);
      const price = asInt(row.groupPriceCent ?? row.group_price_cent, 0);
      if (!goodsId || price < 1 || seen.has(goodsId)) return;
      seen.add(goodsId);
      out.push({ goods_id: goodsId, group_price_cent: price, sort: idx });
    });
  }
  if (!out.length) {
    const goodsId = asInt(body.goodsId ?? body.goods_id, 0);
    const price = asInt(body.groupPriceCent ?? body.group_price_cent, 0);
    if (goodsId && price > 0) out.push({ goods_id: goodsId, group_price_cent: price, sort: 0 });
  }
  return out.slice(0, MAX_GROUP_COMBO);
}

export async function replaceActivityGoods(activityId: number, items: GroupGoodsItem[]) {
  await db("group_buy_activity_goods").where({ activity_id: activityId }).delete();
  if (!items.length) return;
  await db("group_buy_activity_goods").insert(
    items.map((it, idx) => ({
      activity_id: activityId,
      goods_id: it.goods_id,
      group_price_cent: it.group_price_cent,
      sort: it.sort ?? idx,
    }))
  );
}

export function comboLineItems(combo: Array<{ goods_id?: number; id?: number }>, qty: number) {
  return combo.map((g) => ({ goodsId: Number(g.goods_id || g.id), qty }));
}

export async function loadGroupGoodsRows(activityId: number) {
  const rows = await db("group_buy_activity_goods as ag")
    .join("goods as g", "g.id", "ag.goods_id")
    .where("ag.activity_id", activityId)
    .whereNull("g.deleted_at")
    .orderBy("ag.sort", "asc")
    .orderBy("ag.id", "asc")
    .select("ag.goods_id", "ag.group_price_cent", "ag.sort", "g.*");
  if (rows.length) return rows;
  const act = await db("group_buy_activities").where({ id: activityId }).first();
  if (!act) return [];
  const g = await db("goods").where({ id: act.goods_id }).whereNull("deleted_at").first();
  return g ? [{ ...g, goods_id: g.id, group_price_cent: act.group_price_cent, sort: 0 }] : [];
}

function publicComboGoods(row: { group_price_cent: number; goods_id?: number } & Record<string, unknown>) {
  return {
    ...publicGoods(row),
    groupPriceCent: Number(row.group_price_cent || 0),
  };
}

export async function publicGroupGoodsList(activityId: number) {
  const rows = await loadGroupGoodsRows(activityId);
  return rows.map(publicComboGoods);
}

function coverOfActivity(act: { cover_url?: string | null }, goodsList: { coverUrl?: string; thumbUrl?: string }[]) {
  return publicUrl(act.cover_url) || goodsList[0]?.coverUrl || goodsList[0]?.thumbUrl || "";
}

async function loadOpenTeamSummaries(activityIds: number[]) {
  const map = new Map<number, any[]>();
  if (!activityIds.length) return map;
  const teams = await db("group_buy_teams")
    .whereIn("activity_id", activityIds)
    .where({ status: "OPEN" })
    .orderBy("paid_count", "desc")
    .orderBy("member_count", "desc")
    .orderBy("id", "desc");
  for (const team of teams) {
    const required = Math.max(0, Number(team.required_count || 0));
    const paid = Math.max(0, Number(team.paid_count || 0));
    const members = Math.max(0, Number(team.member_count || 0));
    const item = {
      teamId: Number(team.id),
      status: team.status,
      memberCount: members,
      paidCount: paid,
      required,
      remain: Math.max(0, required - paid),
      expireAt: team.expire_at,
    };
    const list = map.get(Number(team.activity_id)) || [];
    list.push(item);
    map.set(Number(team.activity_id), list);
  }
  return map;
}

function shapeActivity(
  act: any,
  goodsList: ReturnType<typeof publicComboGoods>[],
  openTeams: any[]
) {
  const goods = goodsList[0] || null;
  const total = comboTotalCent(goodsList);
  const originTotal = goodsList.reduce((s, g) => s + Number(g.listPriceCent || g.originPriceCent || 0), 0);
  const progress = openTeams[0] || null;
  return {
    ...act,
    cover_url: act.cover_url || null,
    coverUrl: coverOfActivity(act, goodsList),
    goods,
    goodsList,
    goodsCount: goodsList.length,
    minGroupPriceCent: total,
    totalGroupPriceCent: total,
    originTotalCent: originTotal,
    group_price_cent: total,
    openTeams,
    openTeamCount: openTeams.length,
    progress,
  };
}

export async function listActiveGroupBuys() {
  const now = new Date();
  const rows = await db("group_buy_activities")
    .where({ enabled: 1 })
    .whereNull("deleted_at")
    .where("start_at", "<=", now)
    .where("end_at", ">=", now)
    .orderBy("id", "desc");
  const ids = rows.map((a: { id: number }) => Number(a.id));
  const teamMap = await loadOpenTeamSummaries(ids);
  const out = [];
  for (const a of rows) {
    const goodsList = await publicGroupGoodsList(a.id);
    if (!goodsList.length || goodsList.every((g) => Number(g.onSale) === 0)) continue;
    out.push(shapeActivity(a, goodsList, teamMap.get(Number(a.id)) || []));
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

export async function getGroupBuy(id: number) {
  const act = await db("group_buy_activities").where({ id }).whereNull("deleted_at").first();
  if (!act) return null;
  const goodsList = await publicGroupGoodsList(act.id);
  const teamMap = await loadOpenTeamSummaries([Number(act.id)]);
  return shapeActivity(act, goodsList, teamMap.get(Number(act.id)) || []);
}

export async function refreshTeamProgress(
  teamId: number,
  event: string,
  extra: { userId?: number | null; orderId?: number | null; note?: string } = {}
) {
  const team = await db("group_buy_teams").where({ id: teamId }).first();
  if (!team) return null;
  const act = await db("group_buy_activities").where({ id: team.activity_id }).first();
  const memberRow = await db("group_buy_members").where({ team_id: teamId }).count({ c: "*" }).first();
  const paidRow = await db("orders")
    .where({ team_id: teamId })
    .whereIn("status", GROUP_PAID_STATUSES)
    .count({ c: "*" })
    .first();
  const memberCount = Number(memberRow?.c || 0);
  const paidCount = Number(paidRow?.c || 0);
  const required = Number(team.required_count || act?.required_count || 0);
  await db("group_buy_teams").where({ id: teamId }).update({
    member_count: memberCount,
    paid_count: paidCount,
    required_count: required,
  });
  await db("group_buy_progress").insert({
    team_id: teamId,
    activity_id: team.activity_id,
    event,
    user_id: extra.userId ?? null,
    order_id: extra.orderId ?? null,
    member_count: memberCount,
    paid_count: paidCount,
    required_count: required,
    note: extra.note ? String(extra.note).slice(0, 80) : null,
  });
  return db("group_buy_teams").where({ id: teamId }).first();
}

export async function loadTeam(teamId: number) {
  const team = await db("group_buy_teams").where({ id: teamId }).first();
  if (!team) return null;
  const act = await db("group_buy_activities").where({ id: team.activity_id }).first();
  const rows = await db("group_buy_members as m")
    .leftJoin("users as u", "u.id", "m.user_id")
    .leftJoin("orders as o", "o.id", "m.order_id")
    .where("m.team_id", teamId)
    .select(
      "m.id",
      "m.user_id",
      "m.order_id",
      "m.joined_at",
      "u.nickname",
      "u.avatar_url",
      "o.status as order_status"
    )
    .orderBy("m.id", "asc");
  const goodsList = act ? await publicGroupGoodsList(act.id) : [];
  const members = rows.map((m: { id: number; user_id: number; nickname?: string; avatar_url?: string; order_status?: string }) => ({
    id: m.id,
    userId: m.user_id,
    nickname: String(m.nickname || "").trim() || "邻居",
    avatarUrl: publicUrl(m.avatar_url) || "",
    leader: Number(m.user_id) === Number(team.leader_user_id),
    paid: GROUP_PAID_STATUSES.includes(String(m.order_status || "")),
  }));
  const logs = await db("group_buy_progress").where({ team_id: teamId }).orderBy("id", "asc").limit(40);
  const paidCount = Number(team.paid_count || members.filter((m) => m.paid).length);
  const memberCount = Number(team.member_count || members.length);
  const required = Number(team.required_count || act?.required_count || 0);
  return {
    ...team,
    activity: act ? { ...act, coverUrl: coverOfActivity(act, goodsList) } : act,
    goods: goodsList[0] || null,
    goodsList,
    coverUrl: act ? coverOfActivity(act, goodsList) : "",
    members,
    memberCount,
    paidCount,
    requiredCount: required,
    remain: Math.max(0, required - paidCount),
    progressLog: logs.map((x: any) => ({
      id: x.id,
      event: x.event,
      userId: x.user_id,
      orderId: x.order_id,
      memberCount: Number(x.member_count || 0),
      paidCount: Number(x.paid_count || 0),
      requiredCount: Number(x.required_count || 0),
      note: x.note || "",
      createdAt: x.created_at,
    })),
  };
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
    const items = parseGroupGoodsItems(body);
    const cover = String(body.coverUrl ?? body.cover_url ?? "").trim().slice(0, 255);
    return {
      ...base,
      goods_id: items[0]?.goods_id || base.goods_id,
      required_count: clampInt(body.requiredCount ?? body.required_count ?? 2, 2, 2, 99),
      group_price_cent: items.length ? comboTotalCent(items) : asInt(body.groupPriceCent ?? body.group_price_cent, 0),
      expire_hours: clampInt(body.expireHours ?? body.expire_hours ?? 24, 24, 1, 168),
      cover_url: cover || null,
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
  const items = kind === "GROUP" ? parseGroupGoodsItems(body) : [];
  if (kind === "GROUP") {
    if (!items.length) throw new HttpError(400, "请至少选择一件拼团商品");
    for (const it of items) {
      const goods = await db("goods").where({ id: it.goods_id }).whereNull("deleted_at").first();
      if (!goods) throw new HttpError(400, "商品不存在");
    }
    payload.goods_id = items[0].goods_id;
    (payload as { group_price_cent: number }).group_price_cent = comboTotalCent(items);
  } else if (!payload.goods_id) {
    throw new HttpError(400, "请选择商品");
  }
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
  return { payload, goods, items };
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

export async function attachGroupAdminExtras(rows: any[]) {
  const ids = rows.map((r) => Number(r.id)).filter(Boolean);
  if (!ids.length) return rows;
  const goodsRows = await db("group_buy_activity_goods as ag")
    .leftJoin("goods as g", "g.id", "ag.goods_id")
    .whereIn("ag.activity_id", ids)
    .select(
      "ag.activity_id",
      "ag.goods_id",
      "ag.group_price_cent",
      "ag.sort",
      "g.name as goods_name",
      "g.price_cent as origin_price_cent",
      "g.cover_url",
      "g.thumb_url"
    )
    .orderBy("ag.sort", "asc")
    .orderBy("ag.id", "asc");
  const goodsMap = new Map<number, any[]>();
  for (const row of goodsRows) {
    const list = goodsMap.get(Number(row.activity_id)) || [];
    list.push({
      goods_id: Number(row.goods_id),
      goods_name: row.goods_name,
      group_price_cent: Number(row.group_price_cent || 0),
      origin_price_cent: Number(row.origin_price_cent || 0),
      cover_url: publicUrl(row.cover_url),
      thumb_url: publicUrl(row.thumb_url) || publicUrl(row.cover_url),
    });
    goodsMap.set(Number(row.activity_id), list);
  }
  const teamRows = await db("group_buy_teams").whereIn("activity_id", ids).select("activity_id", "status", "paid_count", "member_count", "required_count");
  const teamMap = new Map<number, { open: number; bestPaid: number; bestRequired: number }>();
  for (const t of teamRows) {
    const cur = teamMap.get(Number(t.activity_id)) || { open: 0, bestPaid: 0, bestRequired: Number(t.required_count || 0) };
    if (t.status === "OPEN") {
      cur.open += 1;
      if (Number(t.paid_count || 0) >= cur.bestPaid) {
        cur.bestPaid = Number(t.paid_count || 0);
        cur.bestRequired = Number(t.required_count || 0);
      }
    }
    teamMap.set(Number(t.activity_id), cur);
  }
  return rows.map((row) => {
    const items = goodsMap.get(Number(row.id)) || [];
    const stats = teamMap.get(Number(row.id)) || { open: 0, bestPaid: 0, bestRequired: Number(row.required_count || 0) };
    return {
      ...row,
      cover_url: publicUrl(row.cover_url) || items[0]?.cover_url || "",
      goods_items: items,
      goods_names: items.map((x) => x.goods_name).filter(Boolean).join("、") || row.goods_name,
      origin_total_cent: items.length ? items.reduce((s, x) => s + Number(x.origin_price_cent || 0), 0) : Number(row.origin_price_cent || 0),
      group_total_cent: items.length ? comboTotalCent(items) : Number(row.group_price_cent || 0),
      open_team_count: stats.open,
      progress_paid: stats.bestPaid,
      progress_required: stats.bestRequired || Number(row.required_count || 0),
    };
  });
}
