import { request, ensurePhone } from "../../utils/request";

Page({
  data: { activityId: 0, teamId: 0, act: null as any, team: null as any },
  async onLoad(q: any) {
    this.setData({ activityId: Number(q.activityId || 0), teamId: Number(q.teamId || 0) });
    const list = await request("/group-buys");
    const act = list.find((x: any) => x.id === Number(q.activityId)) || list[0];
    this.setData({ act, activityId: act ? act.id : Number(q.activityId) });
    if (q.teamId) {
      const team = await request(`/group-buys/teams/${q.teamId}`);
      this.setData({ team, activityId: team.activity.id });
    }
  },
  async payAfter(res: any) {
    const order = res.order;
    const pay = await request(`/orders/${order.id}/pay`, "POST");
    if (pay.mockPay) {
      await request(`/orders/${order.id}/mock-pay`, "POST");
      wx.redirectTo({ url: `/pages/order/result?id=${order.id}&ok=1` });
      return;
    }
    wx.requestPayment({
      ...pay,
      success: () => wx.redirectTo({ url: `/pages/order/result?id=${order.id}&ok=1` }),
    });
  },
  async open() {
    try {
      await ensurePhone();
      const res = await request(`/group-buys/${this.data.activityId}/open`, "POST", { qty: 1, fulfillType: "PICKUP" });
      await this.payAfter(res);
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
  async join() {
    try {
      await ensurePhone();
      const res = await request(`/group-buys/teams/${this.data.teamId}/join`, "POST", { qty: 1, fulfillType: "PICKUP" });
      await this.payAfter(res);
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
});
