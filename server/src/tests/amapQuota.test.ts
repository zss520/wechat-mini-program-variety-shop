import { db } from "../db";
import { amapLocateStatus, readAmapUsage, reserveAmapCall, shanghaiMonth } from "../amapQuota";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const months = ["2099-01", "2099-02", "2099-03"];

async function run() {
  await db("amap_usage").whereIn("month", months).delete();
  try {
    assert(shanghaiMonth(new Date("2026-09-22T00:30:00+08:00")) === "2026-09", "shanghai month shape");
    assert(shanghaiMonth(new Date("2026-09-30T16:30:00Z")) === "2026-10", "shanghai month crosses utc date");

    const first = await reserveAmapCall(1, "2099-01");
    const second = await reserveAmapCall(1, "2099-01");
    const used = await readAmapUsage("2099-01");
    assert(first === "ok" && second === "exhausted" && used.used === 1, "limit 1 allows a single call");

    const blocked = await reserveAmapCall(0, "2099-02");
    const zero = await readAmapUsage("2099-02");
    assert(blocked === "exhausted" && zero.used === 0, "limit 0 does not increment");

    const raced = await Promise.all(Array.from({ length: 8 }, () => reserveAmapCall(3, "2099-03")));
    const granted = raced.filter((r) => r === "ok").length;
    const racedUsed = await readAmapUsage("2099-03");
    assert(granted === 3 && racedUsed.used === 3, "concurrent reserves stop at the cap");

    const before = await readAmapUsage();
    const status = await amapLocateStatus();
    const after = await readAmapUsage();
    assert(after.used === before.used, "quota status does not consume a call");
    assert(status.month === shanghaiMonth() && status.used === before.used, "status reports current month");
    assert(status.limit >= 0 && (status.online === true || status.online === false), "status shape");
  } finally {
    await db("amap_usage").whereIn("month", months).delete();
  }
  await db.destroy();
  console.log("amap quota tests passed");
}

run().catch(async (e) => {
  console.error(e);
  try {
    await db("amap_usage").whereIn("month", months).delete();
    await db.destroy();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
