import { request } from "../../utils/request";
import { asArray } from "../../utils/display";

Page({
  data: { list: [] as any[] },
  onShow() {
    this.load();
  },
  async load() {
    try {
      const list = asArray(await request("/announcements"));
      this.setData({ list });
    } catch (e: any) {
      wx.showToast({ title: e.message || "加载失败", icon: "none" });
    }
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },
  open(e: any) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/notice/detail?id=${id}` });
  },
});
