import { request, ensureMember } from "../../utils/request";
import { asArray, displayText } from "../../utils/display";
import { decorateCouponView } from "../../utils/coupon";

Page({
  data: { tab: "shop", mineTab: "UNUSED", shop: [] as any[], mine: [] as any[], mineFiltered: [] as any[] },
  onShow() {
    this.load();
  },
  filterMine(mine: any[], mineTab: string) {
    return mine.filter((x) => x.displayStatus === mineTab);
  },
  async load() {
    if (!(await ensureMember())) return;
    const shop = asArray(await request("/coupons")).map((x: any) => ({
      ...decorateCouponView(x),
      btnText: x.remain > 0 ? "领取" : x.soldOut ? "已领完" : "已领",
    }));
    const mine = asArray(await request("/me/coupons")).map((x: any) => ({
      ...decorateCouponView(x),
      displayStatus: x.displayStatus || x.status,
      statusText: x.statusLabel || displayText(x.status),
      sourceText: x.sourceLabel || "",
    }));
    this.setData({ shop, mine, mineFiltered: this.filterMine(mine, this.data.mineTab) });
  },
  setTab(e: any) {
    this.setData({ tab: e.currentTarget.dataset.t });
  },
  onTab(e: any) {
    this.setData({ tab: e.detail.value });
  },
  onMineTab(e: any) {
    const mineTab = e.detail.value;
    this.setData({ mineTab, mineFiltered: this.filterMine(this.data.mine, mineTab) });
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
