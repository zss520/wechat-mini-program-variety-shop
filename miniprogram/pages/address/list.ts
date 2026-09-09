import { request, ensureLogin } from "../../utils/request";
import { asArray } from "../../utils/display";

Page({
  data: { list: [] as any[] },
  onShow() {
    this.load();
  },
  async load() {
    await ensureLogin();
    this.setData({ list: asArray(await request("/addresses")) });
  },
  add() {
    wx.navigateTo({ url: "/pages/address/edit" });
  },
  edit(e: any) {
    wx.navigateTo({ url: `/pages/address/edit?id=${e.currentTarget.dataset.id}` });
  },
});
