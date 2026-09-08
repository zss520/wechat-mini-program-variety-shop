import { request } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: {
    banners: [] as any[],
    bannerImages: [] as string[],
    deals: [] as any[],
    recommend: [] as any[],
    forYou: [] as any[],
    seckills: [] as any[],
    groups: [] as any[],
    recommendTitle: "本店推荐",
    settings: {} as any,
    shopHint: "",
    nav: { type: "dots-bar" },
  },
  onShow() {
    track("page_view");
    this.load();
  },
  async load() {
    try {
      const home = await request("/home");
      const boot = await request("/shop/bootstrap");
      const banners = home.banners || [];
      const settings = boot.settings || {};
      const seckills = (home.seckills || []).map((x: any) => ({
        ...x,
        remainMs: x.end_at ? Math.max(0, new Date(x.end_at).getTime() - Date.now()) : 0,
      }));
      this.setData({
        banners,
        bannerImages: banners.map((b: any) => b.image_url).filter(Boolean),
        deals: home.deals || [],
        recommend: home.recommend || [],
        forYou: home.forYou || [],
        seckills,
        groups: home.groups || [],
        recommendTitle: home.recommendTitle,
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
