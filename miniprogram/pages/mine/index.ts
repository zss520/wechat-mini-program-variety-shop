import { ensureLogin } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: { user: {} as any, settings: {} as any },
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
