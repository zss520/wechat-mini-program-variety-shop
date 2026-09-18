import { request } from "../../utils/request";
import { asRecord } from "../../utils/display";
import { openMpPath } from "../../utils/jump";

Page({
  data: { item: {} as any, canJump: false },
  async onLoad(q: any) {
    const id = Number(q.id || 0);
    if (!id) {
      wx.showToast({ title: "公告不存在", icon: "none" });
      return;
    }
    try {
      const item = asRecord(await request(`/announcements/${id}`));
      this.setData({ item, canJump: Boolean(item.canJump && item.mpPath) });
      if (item.title) wx.setNavigationBarTitle({ title: String(item.title).slice(0, 16) });
    } catch (e: any) {
      wx.showToast({ title: e.message || "公告不存在", icon: "none" });
    }
  },
  jump() {
    const item = this.data.item || {};
    if (!item.mpPath) return;
    openMpPath(String(item.mpPath));
  },
});
