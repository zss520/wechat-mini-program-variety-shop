import { db } from "../db";
import { buildHome } from "../home";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const home = await buildHome(null);
  const keys = ["banner", "seckill", "group", "deal", "forYou", "recommend"] as const;
  for (const k of keys) {
    const block = home[k];
    assert(block && block.key === k, `${k} key`);
    assert(typeof block.title === "string", `${k} title`);
    assert(Array.isArray(block.list), `${k} list`);
  }
  assert(home.recommend.slotId === "home_recommend", "recommend slotId");
  await db.destroy();
  console.log("home blocks test passed", {
    banner: home.banner.list.length,
    seckill: home.seckill.list.length,
    group: home.group.list.length,
    deal: home.deal.list.length,
    forYou: home.forYou.list.length,
    recommend: home.recommend.list.length,
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
