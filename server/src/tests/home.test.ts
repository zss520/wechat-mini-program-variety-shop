import { db } from "../db";
import {
  buildAnnouncementBlock,
  buildBannerBlock,
  buildDealBlock,
  buildForYouBlock,
  buildGroupBlock,
  buildRecommendBlock,
  buildSeckillBlock,
} from "../home";
import { announcementMpPath } from "../announcements";

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
  for (const item of group.list as Array<{
    remainMs?: number;
    goodsCount?: number;
    goodsList?: Array<{ groupPriceCent?: number }>;
    group_price_cent?: number;
    totalGroupPriceCent?: number;
  }>) {
    assert(typeof item.remainMs === "number", "group remainMs");
    assert(Array.isArray(item.goodsList), "group goodsList");
    if (Number(item.goodsCount) > 1) {
      const sum = (item.goodsList || []).reduce((s, g) => s + Number(g.groupPriceCent || 0), 0);
      assert(Number(item.totalGroupPriceCent) === sum, "home group combo uses total price");
      assert(Number(item.group_price_cent) === sum, "home group_price_cent is combo total");
    }
  }

  assert(announcementMpPath("NONE", "1") === "", "none jump empty path");
  assert(announcementMpPath("GOODS", "9") === "/pages/goods/detail?id=9&slot=announce&pos=1", "goods jump path");
  assert(announcementMpPath("PATH", "/pages/coupon/list") === "/pages/coupon/list", "custom path");
  assert(announcementMpPath("PATH", "https://example.com") === "", "reject non-page path");
  assert(announcementMpPath("CATEGORY") === "/pages/category/index", "category jump");

  const stamp = Date.now();
  assert(await db.schema.hasTable("announcements"), "announcements table exists");
  const goods = await db("goods").whereNull("deleted_at").first();
  const inserted: number[] = [];
  try {
    const [idA] = await db("announcements").insert({
      title: `公告A_${stamp}`,
      content: "内容A",
      link_type: "NONE",
      link_value: "",
      sort: 20,
      enabled: 1,
    });
    inserted.push(Number(idA));
    const [idB] = await db("announcements").insert({
      title: `公告B_${stamp}`,
      content: "内容B",
      link_type: goods ? "GOODS" : "NONE",
      link_value: goods ? String(goods.id) : "",
      sort: 10,
      enabled: 1,
    });
    inserted.push(Number(idB));
    const [idOff] = await db("announcements").insert({
      title: `公告关_${stamp}`,
      content: "已下架",
      link_type: "NONE",
      link_value: "",
      sort: 99,
      enabled: 0,
    });
    inserted.push(Number(idOff));

    const announcement = await buildAnnouncementBlock();
    assert(announcement.key === "announcement", "announcement key");
    assert(announcement.title === "通知公告", "announcement title");
    assert(Array.isArray(announcement.list), "announcement list");
    const titles = announcement.list.map((x: { title?: string }) => String(x.title || ""));
    assert(titles.includes(`公告A_${stamp}`), "enabled announcement listed");
    assert(titles.includes(`公告B_${stamp}`), "second enabled announcement listed");
    assert(!titles.includes(`公告关_${stamp}`), "disabled announcement hidden");
    const a = announcement.list.find((x: { title?: string }) => x.title === `公告A_${stamp}`) as {
      canJump?: boolean;
      content?: string;
      mpPath?: string;
    };
    assert(a && a.canJump === false && a.content === "内容A" && !a.mpPath, "plain announcement no jump");
    if (goods) {
      const b = announcement.list.find((x: { title?: string }) => x.title === `公告B_${stamp}`) as {
        canJump?: boolean;
        mpPath?: string;
        linkType?: string;
      };
      assert(b && b.canJump === true && String(b.mpPath).indexOf(`/pages/goods/detail?id=${goods.id}`) === 0, "goods announcement can jump");
      assert(b.linkType === "GOODS", "goods link type");
    }
  } finally {
    if (inserted.length) await db("announcements").whereIn("id", inserted).delete();
  }

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

run().catch(async (e) => {
  console.error(e);
  try {
    await db.destroy();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
