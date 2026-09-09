import { clearSession, currentUser, ensureMember, goLogin, isMember, request, tryRestoreMember } from "../../utils/request";
import { syncTabBar } from "../../utils/tabbar";
import { track } from "../../utils/tracker";

function maskPhone(p: string) {
  if (!p || p.length < 7) return p || "";
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}

Page({
  data: {
    user: {} as any,
    settings: {} as any,
    subscribed: false,
    logged: false,
    phoneText: "",
  },
  onShow() {
    syncTabBar(this, "mine");
    track("page_view");
    this.refresh();
  },
  async refresh() {
    if (!isMember()) await tryRestoreMember();
    const user = currentUser();
    const logged = isMember();
    this.setData({
      user,
      logged,
      phoneText: logged ? maskPhone(user.phone || "") : "授权登录后同步订单与优惠券",
      settings: wx.getStorageSync("settings") || {},
    });
    if (logged) {
      request("/auth/me")
        .then((u: any) => {
          wx.setStorageSync("user", u);
          this.setData({ user: u, phoneText: maskPhone(u.phone || "") });
        })
        .catch(() => undefined);
    }
  },
  login() {
    if (this.data.logged) return;
    goLogin("/pages/mine/index");
  },
  async needMember() {
    return ensureMember();
  },
  async orders() {
    if (!(await this.needMember())) return;
    wx.navigateTo({ url: "/pages/order/list" });
  },
  async coupons() {
    if (!(await this.needMember())) return;
    wx.navigateTo({ url: "/pages/coupon/list" });
  },
  async points() {
    if (!(await this.needMember())) return;
    wx.navigateTo({ url: "/pages/points/index" });
  },
  groups() {
    wx.navigateTo({ url: "/pages/group/list" });
  },
  seckill() {
    wx.navigateTo({ url: "/pages/seckill/list" });
  },
  async sub() {
    if (!(await this.needMember())) return;
    const next = !this.data.subscribed;
    await request("/subscribe", "POST", { scene: "PACK_READY", accepted: next });
    this.setData({ subscribed: next });
    wx.showToast({ title: next ? "已开启备货通知" : "已关闭" });
  },
  async addr() {
    if (!(await this.needMember())) return;
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
    const url = this.data.settings.privacyUrl || "http://10.0.8.98:3000/privacy";
    wx.setClipboardData({ data: url });
  },
  logout() {
    clearSession();
    this.refresh();
    wx.showToast({ title: "已退出", icon: "none" });
  },
});
