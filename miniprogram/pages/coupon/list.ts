import { request, ensureMember } from "../../utils/request";
import { formatDateTime } from "../../utils/datetime";
import { asArray, displayText } from "../../utils/display";

Page({
  data: { tab: "shop", shop: [] as any[], mine: [] as any[] },
  onShow() {
    this.load();
  },
  async load() {
    if (!(await ensureMember())) return;
    const shop = asArray(await request("/coupons"));
    const ST: Record<string, string> = { UNUSED: "未使用", USED: "已使用", EXPIRED: "已过期" };
    const mine = asArray(await request("/me/coupons")).map((x: any) => ({
      ...x,
      statusText: ST[x.status] || displayText(x.status),
      endAtText: formatDateTime(x.end_at),
    }));
    this.setData({ shop, mine });
  },
  setTab(e: any) {
    this.setData({ tab: e.currentTarget.dataset.t });
  },
  onTab(e: any) {
    this.setData({ tab: e.detail.value });
  },
  async claim(e: any) {
    try {
      await request(`/coupons/${e.currentTarget.dataset.id}/claim`, "POST");
      wx.showToast({ title: "已领取" });
      this.load();
    } catch (err: any) {
      wx.showToast({ title: err.message, icon: "none" });
    }
  },
});
