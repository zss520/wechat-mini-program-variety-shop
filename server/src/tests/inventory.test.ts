import { db } from "../db";

async function run() {
  const cat = await db("categories").whereNull("deleted_at").first();
  if (!cat) throw new Error("need seed category");
  const [gid] = await db("goods").insert({
    category_id: cat.id,
    name: `__stock_test_${Date.now()}`,
    price_cent: 100,
    unit: "件",
    stock: 1,
    on_sale: 1,
    cover_url: "/static/placeholders/empty.png",
  });
  const userIds: number[] = [];
  for (let i = 0; i < 2; i++) {
    const openid = `test_stock_${Date.now()}_${i}`;
    const [id] = await db("users").insert({ openid, nickname: "t", phone: "13800000000" });
    userIds.push(id);
  }
  const { createOrder } = await import("../orderService");
  const results = await Promise.allSettled(
    userIds.map((uid) =>
      createOrder({
        userId: uid,
        items: [{ goodsId: gid, qty: 1 }],
        fulfillType: "PICKUP",
      })
    )
  );
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const fail = results.filter((r) => r.status === "rejected").length;
  const fresh = await db("goods").where({ id: gid }).first();
  const passed = ok === 1 && fail === 1 && Number(fresh.stock) === 0;
  const orderIds = (await db("orders").whereIn("user_id", userIds).select("id")).map((o: { id: number }) => o.id);
  if (orderIds.length) {
    await db("order_items").whereIn("order_id", orderIds).delete();
    await db("order_logs").whereIn("order_id", orderIds).delete();
    await db("orders").whereIn("id", orderIds).delete();
  }
  await db("users").whereIn("id", userIds).delete();
  await db("goods").where({ id: gid }).delete();
  await db.destroy();
  if (!passed) {
    console.error({ ok, fail, stock: fresh.stock, results });
    throw new Error("inventory concurrency test failed");
  }
  console.log("inventory concurrency test passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
