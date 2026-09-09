import { request } from "../../utils/request";
import { asArray, asRecord, displayText } from "../../utils/display";
import { syncTabBar } from "../../utils/tabbar";
import { track } from "../../utils/tracker";

function readBlock(raw: unknown, fallbackTitle = "") {
  const b = asRecord(raw);
  return {
    title: displayText(b.title, fallbackTitle),
    list: asArray(b.list),
  };
}

Page({
  data: {
    banners: [] as any[],
    bannerImages: [] as string[],
    deals: [] as any[],
    recommend: [] as any[],
    forYou: [] as any[],
    seckills: [] as any[],
    groups: [] as any[],
    seckillTitle: "限时秒杀",
    groupTitle: "拼团",
    dealTitle: "特价专区",
    forYouTitle: "为你推荐",
    recommendTitle: "本店推荐",
    settings: {} as any,
    shopHint: "",
    nav: { type: "dots-bar" },
  },
  onShow() {
    syncTabBar(this, "home");
    track("page_view");
    this.load();
  },
  async load() {
    const parts = await Promise.allSettled([
      this.loadBootstrap(),
      this.loadBanner(),
      this.loadSeckill(),
      this.loadGroup(),
      this.loadDeal(),
      this.loadForYou(),
      this.loadRecommend(),
    ]);
    const blockFails = parts.slice(1).filter((p) => p.status === "rejected");
    if (blockFails.length === 6) {
      const first = blockFails[0] as PromiseRejectedResult;
      const msg = first.reason?.message || "首页加载失败";
      wx.showToast({ title: msg, icon: "none" });
    }
  },
  async loadBootstrap() {
    const boot = asRecord(await request("/shop/bootstrap"));
    const settings = asRecord(boot.settings);
    this.setData({
      settings,
      shopHint: [settings.pickup_address, settings.business_hours].filter(Boolean).join(" · "),
    });
    if (settings.shop_name) wx.setNavigationBarTitle({ title: String(settings.shop_name) });
  },
  async loadBanner() {
    const banner = readBlock(await request("/home/banner"));
    this.setData({
      banners: banner.list,
      bannerImages: banner.list.map((b: any) => b.image_url).filter(Boolean),
    });
  },
  async loadSeckill() {
    const seckill = readBlock(await request("/home/seckill"), "限时秒杀");
    this.setData({
      seckillTitle: seckill.title,
      seckills: seckill.list.map((x: any) => ({
        ...x,
        remainMs: x.end_at ? Math.max(0, new Date(x.end_at).getTime() - Date.now()) : Number(x.remainMs) || 0,
      })),
    });
  },
  async loadGroup() {
    const group = readBlock(await request("/home/group"), "拼团");
    this.setData({ groupTitle: group.title, groups: group.list });
  },
  async loadDeal() {
    const deal = readBlock(await request("/home/deal"), "特价专区");
    this.setData({ dealTitle: deal.title, deals: deal.list });
  },
  async loadForYou() {
    const forYou = readBlock(await request("/home/for-you"), "为你推荐");
    this.setData({ forYouTitle: forYou.title, forYou: forYou.list });
  },
  async loadRecommend() {
    const recommend = readBlock(await request("/home/recommend"), "本店推荐");
    this.setData({ recommendTitle: recommend.title, recommend: recommend.list });
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },
  goSearch() {
    wx.navigateTo({ url: "/pages/search/index" });
  },
  goCat() {
    wx.switchTab({ url: "/pages/category/index" });
  },
  goGroups() {
    wx.navigateTo({ url: "/pages/group/list" });
  },
  goSeckill() {
    wx.navigateTo({ url: "/pages/seckill/list" });
  },
  openGroup(e: any) {
    wx.navigateTo({ url: `/pages/group/detail?activityId=${e.currentTarget.dataset.id}` });
  },
  openSeckill(e: any) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({
      url: `/pages/order/confirm?from=SECKILL&activityId=${item.id}&goodsId=${item.goods_id}&qty=1`,
    });
  },
  onBanner(e: any) {
    const idx = Number(e.detail?.index ?? e.detail?.current ?? 0);
    const item = this.data.banners[idx] || e.currentTarget.dataset.item || {};
    track("banner_click", { extra: { banner_id: item.id, link_type: item.link_type } });
    if (item.link_type === "GOODS" && item.link_value) {
      wx.navigateTo({ url: `/pages/goods/detail?id=${item.link_value}&slot=banner&pos=1` });
    } else if (item.link_type === "CATEGORY") {
      wx.switchTab({ url: "/pages/category/index" });
    }
  },
});
