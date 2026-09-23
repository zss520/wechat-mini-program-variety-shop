import { currentUser, ensureMember, goLogin, isMember, logoutLocal, request, tryRestoreMember } from "../../utils/request";
import { PACK_SUBSCRIBE_TMPL } from "../../utils/config";
import { contactShop, copyWechat, mediaUrl, readSettings } from "../../utils/shop";
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
    packTmpl: "",
    logged: false,
    phoneText: "",
    logoUrl: "",
    hasWechat: false,
    pickupAddress: "",
    businessHours: "",
  },
  onShow() {
    syncTabBar(this, "mine");
    track("page_view");
    this.refresh();
  },
  async refresh() {
    const cachedTmpl = String((readSettings() || {}).wx_subscribe_pack_tmpl || "").trim();
    if (cachedTmpl) this.setData({ packTmpl: cachedTmpl });
    if (!isMember()) await tryRestoreMember();
    const user = { ...currentUser() };
    if (user.avatarUrl) user.avatarUrl = mediaUrl(user.avatarUrl) || user.avatarUrl;
    const logged = isMember();
    const settings = readSettings();
    this.setData({
      user,
      logged,
      phoneText: logged ? maskPhone(user.phone || "") : "授权登录后同步订单与优惠券",
      settings,
      logoUrl: mediaUrl(settings.logo_url),
      hasWechat: Boolean(String(settings.wechat_id || "").trim()),
      pickupAddress: String(settings.pickup_address || "").trim(),
      businessHours: String(settings.business_hours || "").trim(),
    });
    if (logged) {
      request("/auth/me")
        .then((u: any) => {
          const next = u || {};
          if (next.avatarUrl) next.avatarUrl = mediaUrl(next.avatarUrl) || next.avatarUrl;
          wx.setStorageSync("user", next);
          this.setData({ user: next, phoneText: maskPhone(next.phone || "") });
        })
        .catch(() => undefined);
      request("/subscribe?scene=PACK_READY")
        .then((s: any) => {
          const id = String((s && s.templateId) || "").trim();
          const patch: Record<string, unknown> = { subscribed: !!(s && s.accepted) };
          if (id) patch.packTmpl = id;
          this.setData(patch);
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
  notices() {
    wx.navigateTo({ url: "/pages/notice/list" });
  },
  groups() {
    wx.navigateTo({ url: "/pages/group/list" });
  },
  seckill() {
    wx.navigateTo({ url: "/pages/seckill/list" });
  },
  onSubChange(e: any) {
    const want = !!(e && e.detail && e.detail.value);
    if (!this.data.logged) {
      this.setData({ subscribed: false });
      this.needMember();
      return;
    }
    if (!want) {
      this.setData({ subscribed: false });
      request("/subscribe", "POST", { scene: "PACK_READY", accepted: false }).catch(() => undefined);
      wx.showToast({ title: "已关闭通知", icon: "none" });
      return;
    }
    const tmpl = String(this.data.packTmpl || (readSettings() || {}).wx_subscribe_pack_tmpl || PACK_SUBSCRIBE_TMPL).trim();
    this.setData({ subscribed: false });
    if (!tmpl) {
      wx.showToast({ title: "未配置模板", icon: "none" });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [tmpl],
      success: (res: any) => {
        if (!res || res[tmpl] !== "accept") {
          wx.showToast({ title: "未同意通知", icon: "none" });
          return;
        }
        request("/subscribe", "POST", {
          scene: "PACK_READY",
          accepted: true,
          templateId: tmpl,
        })
          .then(() => {
            this.setData({ subscribed: true });
            wx.showToast({ title: "已开启通知", icon: "none" });
          })
          .catch((err: any) => wx.showToast({ title: err.message || "开启失败", icon: "none" }));
      },
      fail: () => wx.showToast({ title: "未同意通知", icon: "none" }),
    });
  },
  async addr() {
    if (!(await this.needMember())) return;
    wx.navigateTo({ url: "/pages/address/list" });
  },
  call() {
    contactShop(this.data.settings);
  },
  copyWechat() {
    copyWechat(this.data.settings);
  },
  privacy() {
    wx.navigateTo({ url: "/pages/legal/index" });
  },
  logout() {
    if (!this.data.logged) return;
    wx.showModal({
      title: "退出登录",
      content: "退出后本机不再保持登录，需要重新授权才能下单。订单、地址和优惠券仍保存在店铺，再次登录后可以继续查看。",
      confirmText: "退出",
      confirmColor: "#C2410C",
      cancelText: "取消",
      success: (r) => {
        if (!r.confirm) return;
        logoutLocal();
        this.setData({
          logged: false,
          user: {},
          phoneText: "授权登录后同步订单与优惠券",
          subscribed: false,
        });
        wx.showToast({ title: "已退出登录", icon: "none" });
      },
    });
  },
});
