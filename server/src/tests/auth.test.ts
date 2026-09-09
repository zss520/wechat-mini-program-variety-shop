import { db } from "../db";
import { authorizeWxMember, restoreWxSession } from "../wxAuth";
import { createOrder } from "../orderService";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const stamp = `auth_${Date.now()}`;
  const deviceId = `dev_${stamp}`;

  const miss = await restoreWxSession("code1", deviceId);
  assert(miss.needAuthorize === true && !miss.token, "new openid should need authorize");

  let badPhone = false;
  try {
    await authorizeWxMember({ loginCode: "code-bad", deviceId: `bad_${stamp}`, nickname: "测试", phone: "12345" });
  } catch (e: any) {
    badPhone = String(e.message).includes("手机号");
  }
  assert(badPhone, "invalid phone should be rejected");

  const authed = await authorizeWxMember({
    loginCode: "code1",
    deviceId,
    nickname: "阿花",
    phone: "13912345678",
  });
  assert(authed.token && authed.user?.phoneBound && authed.user.phone === "13912345678", "authorize becomes member");
  assert(authed.user?.nickname === "阿花", "nickname saved");
  assert(authed.user?.member === true, "member flag");

  const again = await restoreWxSession("code-other", deviceId);
  assert(again.needAuthorize === false && again.token && again.user?.id === authed.user?.id, "restore same mock device");

  const cat = await db("categories").whereNull("deleted_at").first();
  const [gid] = await db("goods").insert({
    category_id: cat.id,
    name: `__auth_${stamp}`,
    price_cent: 100,
    unit: "件",
    stock: 2,
    on_sale: 1,
    cover_url: "/static/placeholders/empty.png",
  });
  const [uidNoPhone] = await db("users").insert({
    openid: `nop_${stamp}`,
    nickname: "未授权",
  });
  let denied = false;
  try {
    await createOrder({ userId: uidNoPhone, items: [{ goodsId: gid, qty: 1 }], fulfillType: "PICKUP" });
  } catch (e: any) {
    denied = String(e.message).includes("授权");
  }
  assert(denied, "order without wechat phone should fail");

  const order = await createOrder({ userId: authed.user!.id, items: [{ goodsId: gid, qty: 1 }], fulfillType: "PICKUP" });
  assert(order && order.id, "authorized member can order");

  await db("order_items").where({ order_id: order.id }).delete();
  await db("order_logs").where({ order_id: order.id }).delete();
  await db("orders").where({ id: order.id }).delete();
  await db("goods").where({ id: gid }).delete();
  await db("users").whereIn("id", [authed.user!.id, uidNoPhone]).delete();
  await db.destroy();
  console.log("wx auth tests passed");
}

run().catch(async (e) => {
  console.error(e);
  await db.destroy();
  process.exit(1);
});
