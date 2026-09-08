import type { Knex } from "knex";
import { db } from "./db";

export async function setSubscribe(userId: number, scene: string, accepted: boolean) {
  const row = await db("user_subscribes").where({ user_id: userId, scene }).first();
  if (row) {
    await db("user_subscribes").where({ id: row.id }).update({ accepted: accepted ? 1 : 0 });
  } else {
    await db("user_subscribes").insert({ user_id: userId, scene, accepted: accepted ? 1 : 0, template_id: null });
  }
  return db("user_subscribes").where({ user_id: userId, scene }).first();
}

export async function notifyPackReady(trx: Knex | Knex.Transaction, order: { id: number; user_id: number; pickup_code?: string | null; fulfill_type: string }) {
  if (order.fulfill_type !== "PICKUP") return;
  const sub = await trx("user_subscribes").where({ user_id: order.user_id, scene: "PACK_READY", accepted: 1 }).first();
  await trx("notify_logs").insert({
    user_id: order.user_id,
    scene: "PACK_READY",
    order_id: order.id,
    title: "商品已备好，请来店取货",
    body: order.pickup_code ? `提货码 ${order.pickup_code}` : "请到订单详情查看",
    status: sub ? "SENT" : "SKIPPED",
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
