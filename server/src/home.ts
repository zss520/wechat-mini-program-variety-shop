import { db } from "./db";
import { publicUrl } from "./config";
import { fillRecommend, publicGoods } from "./recommend";
import { listActiveGroupBuys, listActiveSeckills } from "./campaigns";
import { personalizedGoods } from "./personalize";

export type HomeBlock<T = unknown> = {
  key: string;
  title: string;
  list: T[];
};

export type HomePayload = {
  banner: HomeBlock;
  seckill: HomeBlock;
  group: HomeBlock;
  deal: HomeBlock;
  forYou: HomeBlock;
  recommend: HomeBlock & { slotId: string };
};

function block<T>(key: string, title: string, list: T[]): HomeBlock<T> {
  return { key, title, list };
}

function remainMs(endAt?: string | Date | null) {
  if (!endAt) return 0;
  return Math.max(0, new Date(endAt).getTime() - Date.now());
}

/** 与小程序首页展示块一一对应，顺序即页面自上而下（搜索条仍由前端写死）。 */
export async function buildHome(userId: number | null): Promise<HomePayload> {
  const now = new Date();
  const [bannerRows, dealRows, rec, forYou, seckillRows, groupRows] = await Promise.all([
    db("banners").where({ enabled: 1 }).orderBy("sort", "desc").limit(5),
    db("goods")
      .where({ on_sale: 1 })
      .whereNull("deleted_at")
      .whereNotNull("special_price_cent")
      .where("special_start", "<=", now)
      .where("special_end", ">=", now)
      .orderBy("sort", "desc")
      .limit(12),
    fillRecommend("home_recommend"),
    personalizedGoods(userId, 8),
    listActiveSeckills(),
    listActiveGroupBuys(),
  ]);

  const banner = block(
    "banner",
    "",
    bannerRows.map((b: { image_url: string }) => ({ ...b, image_url: publicUrl(b.image_url) }))
  );
  const seckill = block(
    "seckill",
    "限时秒杀",
    seckillRows.map((x: { end_at?: string | Date }) => ({ ...x, remainMs: remainMs(x.end_at) }))
  );
  const group = block("group", "拼团", groupRows);
  const deal = block("deal", "特价专区", dealRows.map(publicGoods));
  const forYouBlock = block("forYou", "为你推荐", forYou);
  const recommend = {
    ...block("recommend", rec.slot?.title || "本店推荐", rec.list.map(publicGoods)),
    slotId: "home_recommend",
  };

  return {
    banner,
    seckill,
    group,
    deal,
    forYou: forYouBlock,
    recommend,
  };
}
