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

function block<T>(key: string, title: string, list: T[]): HomeBlock<T> {
  return { key, title, list };
}

function remainMs(endAt?: string | Date | null) {
  if (!endAt) return 0;
  return Math.max(0, new Date(endAt).getTime() - Date.now());
}

export async function buildBannerBlock() {
  const rows = await db("banners").where({ enabled: 1 }).orderBy("sort", "desc").limit(5);
  return block(
    "banner",
    "",
    rows.map((b: { image_url: string }) => ({ ...b, image_url: publicUrl(b.image_url) }))
  );
}

export async function buildSeckillBlock() {
  const rows = await listActiveSeckills();
  return block(
    "seckill",
    "限时秒杀",
    rows.map((x: { end_at?: string | Date }) => ({ ...x, remainMs: remainMs(x.end_at) }))
  );
}

export async function buildGroupBlock() {
  return block("group", "拼团", await listActiveGroupBuys());
}

export async function buildDealBlock() {
  const now = new Date();
  const rows = await db("goods")
    .where({ on_sale: 1 })
    .whereNull("deleted_at")
    .whereNotNull("special_price_cent")
    .where("special_start", "<=", now)
    .where("special_end", ">=", now)
    .orderBy("sort", "desc")
    .limit(12);
  return block("deal", "特价专区", rows.map(publicGoods));
}

export async function buildForYouBlock(userId: number | null) {
  return block("forYou", "为你推荐", await personalizedGoods(userId, 8));
}

export async function buildRecommendBlock() {
  const rec = await fillRecommend("home_recommend");
  return {
    ...block("recommend", rec.slot?.title || "本店推荐", rec.list.map(publicGoods)),
    slotId: "home_recommend",
  };
}
