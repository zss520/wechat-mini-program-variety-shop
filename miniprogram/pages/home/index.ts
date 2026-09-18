import { request } from "../../utils/request";
import { asArray, asRecord, displayText, toFiniteNumber } from "../../utils/display";
import { applyShopChrome, contactShop, isPaused, mediaUrl, shopHint, shareShop } from "../../utils/shop";
import { openAnnouncement } from "../../utils/jump";
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
    announcements: [] as any[],
    announcementTexts: "" as string | string[],
    announcementIndex: 0,
    announcementVertical: false,
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
    logoUrl: "",
    paused: false,
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
      this.loadAnnouncements(),
      this.loadSeckill(),
      this.loadGroup(),
      this.loadDeal(),
      this.loadForYou(),
      this.loadRecommend(),
    ]);
    const blockFails = parts.slice(1).filter((p) => p.status === "rejected");
    if (blockFails.length === 7) {
      const first = blockFails[0] as PromiseRejectedResult;
      const msg = first.reason?.message || "首页加载失败";
      wx.showToast({ title: msg, icon: "none" });
    }
  },
  async loadBootstrap() {
    const boot = asRecord(await request("/shop/bootstrap"));
    const settings = asRecord(boot.settings);
    wx.setStorageSync("settings", { ...settings, privacyUrl: boot.privacyUrl });
    wx.setStorageSync("mockWx", !!boot.mockWx);
    this.setData({
      settings,
      shopHint: shopHint(settings),
      logoUrl: mediaUrl(settings.logo_url),
      paused: isPaused(settings),
    });
    applyShopChrome(settings);
  },
  async loadBanner() {
    const banner = readBlock(await request("/home/banner"));
    this.setData({
      banners: banner.list,
      bannerImages: banner.list.map((b: any) => mediaUrl(b.image_url)).filter(Boolean),
    });
  },
  async loadAnnouncements() {
    const block = readBlock(await request("/home/announcements"), "通知公告");
    const list = block.list;
    const texts = list.map((a: any) => String(a.title || a.content || "").trim()).filter(Boolean);
    this.setData({
      announcements: list,
      announcementTexts: texts.length <= 1 ? texts[0] || "" : texts,
      announcementVertical: texts.length > 1,
      announcementIndex: 0,
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
    this.setData({
      groupTitle: group.title,
      groups: group.list.map((item: any) => {
        const row = asRecord<any>(item);
        const goodsList = asArray<any>(row.goodsList);
        const progress = asRecord<any>(row.progress);
        const required = toFiniteNumber(progress.required) || toFiniteNumber(row.required_count) || 0;
        const paid = toFiniteNumber(progress.paidCount) || 0;
        const endAt = row.end_at ? new Date(row.end_at).getTime() : 0;
        return {
          ...row,
          cover: String(row.coverUrl || row.goods?.thumbUrl || row.goods?.coverUrl || ""),
          goodsList,
          goodsPreview: goodsList.slice(0, 4),
          goodsMore: Math.max(0, goodsList.length - 4),
          goodsCount: goodsList.length || toFiniteNumber(row.goodsCount) || 0,
          totalCent:
            toFiniteNumber(row.totalGroupPriceCent) ||
            toFiniteNumber(row.minGroupPriceCent) ||
            toFiniteNumber(row.group_price_cent) ||
            0,
          originCent: toFiniteNumber(row.originTotalCent) || 0,
          remainMs: toFiniteNumber(row.remainMs) || (endAt ? Math.max(0, endAt - Date.now()) : 0),
          hasProgress: Boolean(progress.teamId),
          paid,
          required,
          remain: Math.max(0, required - paid),
          progressPct: required && paid ? Math.max(8, Math.round((paid / required) * 100)) : 0,
        };
      }),
    });
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
    const id = e.currentTarget.dataset.id;
    track("group_click", { extra: { activity_id: id, from: "home" } });
    wx.navigateTo({ url: `/pages/group/detail?activityId=${id}` });
  },
  openSeckill(e: any) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({
      url: `/pages/order/confirm?from=SECKILL&activityId=${item.id}&goodsId=${item.goods_id}&qty=1`,
    });
  },
  contact() {
    contactShop(this.data.settings);
  },
  onShareAppMessage() {
    return shareShop(this.data.settings);
  },
  goNotices() {
    wx.navigateTo({ url: "/pages/notice/list" });
  },
  onAnnouncementChange(e: any) {
    const idx = Number(e.detail?.current ?? 0);
    this.setData({ announcementIndex: Number.isFinite(idx) ? idx : 0 });
  },
  onAnnouncement(e: any) {
    const trigger = String(e.detail?.trigger || "");
    if (trigger === "suffix-icon" || trigger === "operation") {
      this.goNotices();
      return;
    }
    const list = this.data.announcements || [];
    const item = list[this.data.announcementIndex] || list[0];
    if (!item) {
      this.goNotices();
      return;
    }
    openAnnouncement(item);
  },
  onBanner(e: any) {
    const idx = Number(e.detail?.index ?? e.detail?.current ?? 0);
    const item = this.data.banners[idx] || e.currentTarget.dataset.item || {};
    track("banner_click", { extra: { banner_id: item.id, link_type: item.link_type } });
    if (item.link_type === "GOODS" && item.link_value) {
      wx.navigateTo({ url: `/pages/goods/detail?id=${item.link_value}&slot=banner&pos=1` });
    } else if (item.link_type === "PATH" && item.link_value) {
      wx.navigateTo({ url: String(item.link_value) });
    } else if (item.link_type === "CATEGORY") {
      wx.switchTab({ url: "/pages/category/index" });
    }
  },
});
