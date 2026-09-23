import type { Knex } from "knex";
import { db } from "./db";
import { config } from "./config";
import { getSettings } from "./settings";
import { sendSubscribeMessage } from "./wechat";
import { asMiniprogramState, buildPackSubscribeData, isRealWxOpenId } from "./subscribeMessage";

export type NotifyResult = { status: "SENT" | "FAILED" | "SKIPPED"; body: string };

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
  const settings = await getSettings();
  return {
    scene,
    accepted: Boolean(row?.accepted),
    templateId: String(settings.wx_subscribe_pack_tmpl || "").trim(),
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

function stateLabel(state: string) {
  if (state === "trial") return "体验版";
  if (state === "formal") return "正式版";
  return "开发版";
}

async function writeLog(
  conn: Knex | Knex.Transaction,
  row: { user_id: number; order_id: number; title: string; body: string; status: NotifyResult["status"] }
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
async function finishNotify(
  order: { id: number; user_id: number },
  title: string,
  result: NotifyResult
): Promise<NotifyResult> {
  await writeLog(db, { user_id: order.user_id, order_id: order.id, title, body: result.body, status: result.status });
  return result;
}

export async function notifyPackReady(order: {
  id: number;
  user_id: number;
  order_no?: string | null;
  pickup_code?: string | null;
  fulfill_type: string;
  address_snapshot?: unknown;
}): Promise<NotifyResult | null> {
  if (order.fulfill_type !== "PICKUP") return null;
  const title = "提货通知";
  const sub = await db("user_subscribes").where({ user_id: order.user_id, scene: SCENE, accepted: 1 }).first();
  if (!sub) return finishNotify(order, title, { status: "SKIPPED", body: "顾客未授权本次通知" });
  const settings = await getSettings();
  const templateId = String(settings.wx_subscribe_pack_tmpl || "").trim();
  if (!templateId) return finishNotify(order, title, { status: "SKIPPED", body: "未配置提货通知模板，未调用微信" });
  const authorizedTemplate = String(sub.template_id || "").trim();
  if (authorizedTemplate && authorizedTemplate !== templateId) {
    await db("user_subscribes").where({ id: sub.id }).update({ accepted: 0 });
    return finishNotify(order, title, { status: "SKIPPED", body: "提货模板已更换，需顾客重新同意" });
  }
  if (!config.wxAppId || !config.wxSecret) {
    return finishNotify(order, title, { status: "SKIPPED", body: "未配置微信 AppId 或 AppSecret，未调用微信" });
  }
  const user = await db("users").where({ id: order.user_id }).first();
  const openid = String(user?.openid || "");
  if (!isRealWxOpenId(openid)) {
    return finishNotify(order, title, { status: "SKIPPED", body: "当前是模拟登录，没有微信 openid，未调用微信" });
  }
  const items = await db("order_items").where({ order_id: order.id }).select("name_snapshot");
  const snap = asSnap(order.address_snapshot);
  const data = buildPackSubscribeData({
    goodsNames: items.map((item: { name_snapshot?: string }) => String(item.name_snapshot || "")),
    pickupCode: order.pickup_code,
    place: snap.pickup_address || settings.pickup_address,
    orderNo: order.order_no,
    hours: snap.hours || settings.business_hours,
  });
  if (!data) return finishNotify(order, title, { status: "SKIPPED", body: "缺少提货码或订单号，未调用微信" });
  const miniprogramState = asMiniprogramState(settings.wx_miniprogram_state);
  try {
    const result = await sendSubscribeMessage({
      openid,
      templateId,
      page: `pages/order/detail?id=${order.id}`,
      data,
      miniprogramState,
    });
    if (result.errcode === 0) {
      await db("user_subscribes").where({ id: sub.id }).update({ accepted: 0 });
      return finishNotify(order, title, {
        status: "SENT",
        body: `提货码 ${data.character_string12.value}，发往${stateLabel(miniprogramState)}`,
      });
    }
    if (result.errcode === 43101) await db("user_subscribes").where({ id: sub.id }).update({ accepted: 0 });
    return finishNotify(order, title, { status: "FAILED", body: `微信返回 ${result.errcode} ${result.errmsg}` });
  } catch (e) {
    const message = e instanceof Error ? e.message : "发送失败";
    return finishNotify(order, title, { status: "FAILED", body: message });
  }
}
