import { db } from "../db";
import {
  buildBannerBlock,
  buildDealBlock,
  buildForYouBlock,
  buildGroupBlock,
  buildRecommendBlock,
  buildSeckillBlock,
} from "../home";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const banner = await buildBannerBlock();
  const seckill = await buildSeckillBlock();
  const group = await buildGroupBlock();
  const deal = await buildDealBlock();
  const forYou = await buildForYouBlock(null);
  const recommend = await buildRecommendBlock();

  const blocks = [
    ["banner", banner],
    ["seckill", seckill],
    ["group", group],
    ["deal", deal],
    ["forYou", forYou],
    ["recommend", recommend],
  ] as const;

  for (const [key, block] of blocks) {
    assert(block.key === key, `${key} key`);
    assert(typeof block.title === "string", `${key} title`);
    assert(Array.isArray(block.list), `${key} list`);
  }
  assert(recommend.slotId === "home_recommend", "recommend slotId");

  await db.destroy();
  console.log("home block apis test passed", {
    banner: banner.list.length,
    seckill: seckill.list.length,
    group: group.list.length,
    deal: deal.list.length,
    forYou: forYou.list.length,
    recommend: recommend.list.length,
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
