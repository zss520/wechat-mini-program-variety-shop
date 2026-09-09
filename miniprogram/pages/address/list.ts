import { request, ensureMember } from "../../utils/request";
import { asArray } from "../../utils/display";

Page({
  data: { list: [] as any[] },
  onShow() {
    this.load();
  },
  async load() {
    if (!(await ensureMember())) return;
    this.setData({ list: asArray(await request("/addresses")) });
  },
  add() {
    wx.navigateTo({ url: "/pages/address/edit" });
  },
  edit(e: any) {
    wx.navigateTo({ url: `/pages/address/edit?id=${e.currentTarget.dataset.id}` });
  },
});
