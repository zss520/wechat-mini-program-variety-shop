import { request, ensureLogin } from "../../utils/request";

const MAP: Record<string, string> = {
  PENDING_PAY: "待付款",
  PENDING_PACK: "备货中",
  WAIT_PICKUP: "待取货",
  WAIT_DELIVER: "待配送",
  DELIVERING: "配送中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

Page({
  data: { list: [] as any[], status: "" },
  onShow() {
    this.load();
  },
  async load() {
    await ensureLogin();
    const q = this.data.status ? `?status=${this.data.status}` : "";
    const d = await request(`/orders${q}`);
    this.setData({
      list: (d.list || []).map((o: any) => ({ ...o, statusText: MAP[o.status] || o.status })),
    });
  },
  tab(e: any) {
    this.setData({ status: e.currentTarget.dataset.s });
    this.load();
  },
  open(e: any) {
    wx.navigateTo({ url: `/pages/order/detail?id=${e.currentTarget.dataset.id}` });
  },
});
