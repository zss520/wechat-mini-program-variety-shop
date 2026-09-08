import { request } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: { list: [] as any[] },
  async onShow() {
    const list = await request("/group-buys");
    this.setData({ list });
  },
  open(e: any) {
    track("group_click", { extra: { activity_id: e.currentTarget.dataset.id } });
    wx.navigateTo({ url: `/pages/group/detail?activityId=${e.currentTarget.dataset.id}` });
  },
});
