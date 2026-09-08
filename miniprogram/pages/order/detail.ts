import { request, ensureLogin } from "../../utils/request";
import { track } from "../../utils/tracker";

const MAP: Record<string, string> = {
  PENDING_PAY: "待付款",
  GROUPING: "拼团中，待成团",
  PENDING_PACK: "商家备货中",
  WAIT_PICKUP: "待取货",
  WAIT_DELIVER: "待配送",
  DELIVERING: "配送中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

Page({
  data: { o: {} as any, statusText: "", settings: {} as any, id: 0 },
  onLoad(q: any) {
    this.setData({ id: Number(q.id), settings: wx.getStorageSync("settings") || {} });
  },
  onShow() {
    this.load();
  },
  async load() {
    await ensureLogin();
    const o = await request(`/orders/${this.data.id}`);
    this.setData({ o, statusText: MAP[o.status] || o.status });
    if (o.pickup_code) track("pickup_code_view", { order_no: o.order_no });
  },
  async pay() {
    const pay = await request(`/orders/${this.data.o.id}/pay`, "POST");
    if (pay.mockPay) {
      await request(`/orders/${this.data.o.id}/mock-pay`, "POST");
      this.load();
      return;
    }
    wx.requestPayment({ ...pay, success: () => this.load() });
  },
  async cancel() {
    await request(`/orders/${this.data.o.id}/cancel`, "POST");
    this.load();
  },
  call() {
    const phone = this.data.settings.phone;
    if (phone) wx.makePhoneCall({ phoneNumber: phone });
  },
});
