import { request } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: { keyword: "", list: [] as any[], history: [] as string[] },
  onLoad() {
    this.setData({ history: wx.getStorageSync("search_history") || [] });
  },
  onInput(e: any) {
    this.setData({ keyword: e.detail.value });
  },
  async search() {
    const keyword = this.data.keyword.trim();
    if (!keyword) return;
    const hist = [keyword].concat(this.data.history.filter((x) => x !== keyword)).slice(0, 10);
    wx.setStorageSync("search_history", hist);
    const d = await request(`/goods?keyword=${encodeURIComponent(keyword)}&sort=composite`);
    track("search_submit", { keyword, extra: { result_count: d.total } });
    if (!d.total) track("search_no_result", { extra: { keyword } });
    this.setData({ list: d.list || [], history: hist });
  },
  tapHist(e: any) {
    this.setData({ keyword: e.currentTarget.dataset.k });
    this.search();
  },
  clear() {
    wx.removeStorageSync("search_history");
    this.setData({ history: [] });
  },
});
