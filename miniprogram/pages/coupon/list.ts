import { request, ensureLogin } from "../../utils/request";

Page({
  data: { tab: "shop", shop: [] as any[], mine: [] as any[] },
  onShow() {
    this.load();
  },
  async load() {
    await ensureLogin();
    const shop = await request("/coupons");
    const mine = await request("/me/coupons");
    this.setData({ shop, mine });
  },
  setTab(e: any) {
    this.setData({ tab: e.currentTarget.dataset.t });
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
