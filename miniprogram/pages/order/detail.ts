import { request, ensureMember } from "../../utils/request";
import { asArray, asRecord, displayText } from "../../utils/display";
import { formatDateTime } from "../../utils/datetime";
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

function activityText(v: unknown) {
  if (v === "GROUP_BUY") return "拼团";
  if (v === "SECKILL") return "秒杀";
  return "普通";
}

Page({
  data: {
    o: {} as any,
    statusText: "",
    settings: {} as any,
    id: 0,
    showCode: false,
    fulfillTypeText: "",
    fulfillTitle: "履约信息",
    fulfillText: "",
    activityText: "普通",
    times: [] as { key: string; label: string; time: string }[],
    timeline: [] as { id: number; title: string; time: string }[],
  },
  onLoad(q: any) {
    this.setData({ id: Number(q.id), settings: wx.getStorageSync("settings") || {} });
  },
  onShow() {
    this.load();
  },
  async load() {
    if (!(await ensureMember())) return;
    const o = asRecord(await request(`/orders/${this.data.id}`));
    const showCode = Boolean(o.pickup_code && (o.status === "WAIT_PICKUP" || o.status === "PENDING_PACK"));
    const times = asArray(o.time_points).map((p: any) => ({
      key: String(p.key || ""),
      label: displayText(p.label),
      time: formatDateTime(p.at, true),
    }));
    const timeline = asArray(o.timeline).map((l: any, i: number) => ({
      id: Number(l.id || i + 1),
      title: displayText(l.note || MAP[l.to_status]),
      time: formatDateTime(l.created_at, true),
    }));
    this.setData({
      o: { ...o, items: asArray(o.items) },
      statusText: MAP[o.status] || displayText(o.status),
      showCode,
      fulfillTypeText: o.fulfill_type === "DELIVERY" ? "配送" : "自提",
      fulfillTitle: o.fulfill_type === "DELIVERY" ? "收货地址" : "自提信息",
      fulfillText: displayText(o.fulfill_text),
      activityText: activityText(o.activity_type),
      times,
      timeline,
    });
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
