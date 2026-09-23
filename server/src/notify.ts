import type { Knex } from "knex";
import { db } from "./db";
import { config } from "./config";
import { getSettings } from "./settings";
import { sendSubscribeMessage } from "./wechat";
import { buildPackSubscribeData } from "./subscribeMessage";

const SCENE = "PACK_READY";

export async function setSubscribe(userId: number, scene: string, accepted: boolean, templateId?: string) {
  const row = await db("user_subscribes").where({ user_id: userId, scene }).first();
  const patch: Record<string, unknown> = { accepted: accepted ? 1 : 0 };
  const tmpl = String(templateId || "").trim();
  if (tmpl) patch.template_id = tmpl.slice(0, 64);
  if (row) await db("user_subscribes").where({ id: row.id }).update(patch);
  else await db("user_subscribes").insert({ user_id: userId, scene, template_id: tmpl || null, ...patch });
  return db("user_subscribes").where({ user_id: userId, scene }).first();
}

export async function readSubscribe(userId: number, scene = SCENE) {
  const row = await db("user_subscribes").where({ user_id: userId, scene }).first();
  return {
    scene,
    accepted: Boolean(row?.accepted),
    templateId: config.wxSubscribePackTemplateId,
  };
}

function asSnap(raw: unknown) {
  if (!raw) return {} as Record<string, string>;
  if (typeof raw === "object") return raw as Record<string, string>;
  try {
    return JSON.parse(String(raw)) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeLog(
  conn: Knex | Knex.Transaction,
  row: { user_id: number; order_id: number; title: string; body: string; status: "SENT" | "FAILED" | "SKIPPED" }
) {
  await conn("notify_logs").insert({
    user_id: row.user_id,
    scene: SCENE,
    order_id: row.order_id,
    title: row.title.slice(0, 80),
    body: row.body.slice(0, 200),
    status: row.status,
    channel: "SUBSCRIBE",
  });
}

export async function listNotifyLogs(page: number, pageSize: number, userId?: number) {
  const q = db("notify_logs").modify((b) => {
    if (userId) b.where({ user_id: userId });
  });
  const total = await q.clone().count({ c: "*" }).first();
  const list = await q.orderBy("id", "desc").offset((page - 1) * pageSize).limit(pageSize);
  return { list, page, pageSize, total: Number(total?.c || 0) };
}
export async function notifyPackReady(order: {
  id: number;
  user_id: number;
  order_no?: string | null;
  pickup_code?: string | null;
  fulfill_type: string;
  address_snapshot?: unknown;
}) {
  if (order.fulfill_type !== "PICKUP") return;
  const title = "提货通知";
  const sub = await db("user_subscribes").where({ user_id: order.user_id, scene: SCENE, accepted: 1 }).first();
  if (!sub) {
    await writeLog(db, { user_id: order.user_id, order_id: order.id, title, body: "顾客未授权本次通知", status: "SKIPPED" });
    return;
  }
  const templateId = String(config.wxSubscribePackTemplateId || "").trim();
  if (!templateId || config.mockWx || !config.wxAppId || !config.wxSecret) {
    await writeLog(db, {
      user_id: order.user_id,
      order_id: order.id,
      title,
      body: "未配置微信订阅或当前为模拟登录，未调用微信",
      status: "SKIPPED",
    });
    return;
  }
  const user = await db("users").where({ id: order.user_id }).first();
  const items = await db("order_items").where({ order_id: order.id }).select("name_snapshot");
  const settings = await getSettings();
  const snap = asSnap(order.address_snapshot);
  const data = buildPackSubscribeData({
    goodsNames: items.map((item: { name_snapshot?: string }) => String(item.name_snapshot || "")),
    pickupCode: order.pickup_code,
    place: snap.pickup_address || settings.pickup_address,
    orderNo: order.order_no,
    hours: snap.hours || settings.business_hours,
  });
  if (!data || !user?.openid) {
    await writeLog(db, { user_id: order.user_id, order_id: order.id, title, body: "缺少提货码、订单号或 openid", status: "SKIPPED" });
    return;
  }
  try {
    const result = await sendSubscribeMessage({
      openid: String(user.openid),
      templateId,
      page: `pages/order/detail?id=${order.id}`,
      data,
      miniprogramState: config.wxMiniprogramState,
    });
    if (result.errcode === 0) {
      await writeLog(db, { user_id: order.user_id, order_id: order.id, title, body: `提货码 ${data.character_string12.value}`, status: "SENT" });
      await db("user_subscribes").where({ id: sub.id }).update({ accepted: 0 });
      return;
    }
    await writeLog(db, {
      user_id: order.user_id,
      order_id: order.id,
      title,
      body: `微信返回 ${result.errcode} ${result.errmsg}`,
      status: "FAILED",
    });
    if (result.errcode === 43101) await db("user_subscribes").where({ id: sub.id }).update({ accepted: 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "发送失败";
    await writeLog(db, { user_id: order.user_id, order_id: order.id, title, body: message, status: "FAILED" });
  }
}
