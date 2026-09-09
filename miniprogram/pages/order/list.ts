import { request, ensureLogin } from "../../utils/request";
import { asArray, asRecord, displayText } from "../../utils/display";

const MAP: Record<string, string> = {
  PENDING_PAY: "待付款",
  GROUPING: "拼团中",
  PENDING_PACK: "备货中",
  WAIT_PICKUP: "待取货",
  WAIT_DELIVER: "待配送",
  DELIVERING: "配送中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

Page({
  data: { list: [] as any[], status: "", tab: "ALL" },
  onShow() {
    this.load();
  },
  async load() {
    await ensureLogin();
    const q = this.data.status ? `?status=${this.data.status}` : "";
    const d = asRecord(await request(`/orders${q}`));
    this.setData({
      list: asArray(d.list).map((o: any) => ({ ...o, statusText: MAP[o.status] || displayText(o.status) })),
    });
  },
  tab(e: any) {
    this.setData({ status: e.currentTarget.dataset.s });
    this.load();
  },
  onTab(e: any) {
    const tab = e.detail.value;
    this.setData({ tab, status: tab === "ALL" ? "" : tab });
    this.load();
  },
  open(e: any) {
    wx.navigateTo({ url: `/pages/order/detail?id=${e.currentTarget.dataset.id}` });
  },
});
