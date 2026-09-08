import { ensureLogin, request } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: { user: {} as any, settings: {} as any, subscribed: false },
  onShow() {
    track("page_view");
    this.setData({ user: wx.getStorageSync("user") || {}, settings: wx.getStorageSync("settings") || {} });
  },
  async login() {
    await ensureLogin();
    this.setData({ user: wx.getStorageSync("user") || {} });
  },
  orders() {
    wx.navigateTo({ url: "/pages/order/list" });
  },
  coupons() {
    wx.navigateTo({ url: "/pages/coupon/list" });
  },
  points() {
    wx.navigateTo({ url: "/pages/points/index" });
  },
  groups() {
    wx.navigateTo({ url: "/pages/group/list" });
  },
  seckill() {
    wx.navigateTo({ url: "/pages/seckill/list" });
  },
  async sub() {
    await ensureLogin();
    const next = !this.data.subscribed;
    await request("/subscribe", "POST", { scene: "PACK_READY", accepted: next });
    this.setData({ subscribed: next });
    wx.showToast({ title: next ? "已开启备货通知" : "已关闭" });
  },
  addr() {
    wx.navigateTo({ url: "/pages/address/list" });
  },
  call() {
    const phone = this.data.settings.phone;
    if (phone) {
      track("contact_shop", { extra: { action: "phone" } });
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },
  privacy() {
    const url = this.data.settings.privacyUrl || "http://127.0.0.1:3000/privacy";
    wx.setClipboardData({ data: url });
  },
});
