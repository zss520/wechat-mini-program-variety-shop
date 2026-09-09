import { request } from "../../utils/request";
import { asArray, asRecord, displayText } from "../../utils/display";
import { syncTabBar } from "../../utils/tabbar";
import { track } from "../../utils/tracker";

function homeBlock(home: Record<string, unknown>, key: string, fallbackTitle = "") {
  const b = asRecord(home[key]);
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
    try {
      const home = asRecord(await request("/home"));
      const boot = asRecord(await request("/shop/bootstrap"));
      const banner = homeBlock(home, "banner");
      const seckill = homeBlock(home, "seckill", "限时秒杀");
      const group = homeBlock(home, "group", "拼团");
      const deal = homeBlock(home, "deal", "特价专区");
      const forYou = homeBlock(home, "forYou", "为你推荐");
      const recommend = homeBlock(home, "recommend", "本店推荐");
      const settings = asRecord(boot.settings);
      const seckills = seckill.list.map((x: any) => ({
        ...x,
        remainMs: x.end_at ? Math.max(0, new Date(x.end_at).getTime() - Date.now()) : Number(x.remainMs) || 0,
      }));
      this.setData({
        banners: banner.list,
        bannerImages: banner.list.map((b: any) => b.image_url).filter(Boolean),
        deals: deal.list,
        recommend: recommend.list,
        forYou: forYou.list,
        seckills,
        groups: group.list,
        seckillTitle: seckill.title,
        groupTitle: group.title,
        dealTitle: deal.title,
        forYouTitle: forYou.title,
        recommendTitle: recommend.title,
        settings,
        shopHint: [settings.pickup_address, settings.business_hours].filter(Boolean).join(" · "),
      });
      if (boot.settings?.shop_name) wx.setNavigationBarTitle({ title: boot.settings.shop_name });
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
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
