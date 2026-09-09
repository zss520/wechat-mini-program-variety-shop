import {
  afterLoginRedirect,
  deviceId,
  request,
  saveSession,
  uploadAvatar,
  wxLoginCode,
} from "../../utils/request";

function validMobile(raw: string) {
  return /^1[3-9]\d{9}$/.test(String(raw || "").replace(/\D/g, ""));
}

function phoneAuthFailReason(d: any): string {
  const errno = Number(d?.errno || 0);
  const msg = String(d?.errMsg || "");
  if (errno === 1400001) return "微信手机号次数已用完，请填写手机号登录";
  if (errno === 102 || msg.indexOf("no permission") >= 0) return "当前小程序暂未开通微信手机号，请填写手机号登录";
  if (msg.indexOf("deny") >= 0 || msg.indexOf("cancel") >= 0) return "未授权微信手机号，请填写手机号后登录";
  return "未获取到微信手机号，请填写手机号后登录";
}

Page({
  data: {
    nickname: "",
    phone: "",
    avatarUrl: "",
    avatarLocal: "",
    agree: false,
    mockWx: false,
    redirect: "",
    submitting: false,
    privacyUrl: "",
  },
  async onLoad(q: any) {
    const redirect = q.redirect ? decodeURIComponent(q.redirect) : "";
    try {
      const boot = await request("/shop/bootstrap");
      wx.setStorageSync("mockWx", !!boot.mockWx);
      const settings = { ...(boot.settings || {}), privacyUrl: boot.privacyUrl };
      wx.setStorageSync("settings", settings);
      this.setData({
        redirect,
        mockWx: !!boot.mockWx,
        privacyUrl: boot.privacyUrl || "",
      });
    } catch {
      this.setData({
        redirect,
        mockWx: !!wx.getStorageSync("mockWx"),
        privacyUrl: (wx.getStorageSync("settings") || {}).privacyUrl || "",
      });
    }
  },
  onChooseAvatar(e: any) {
    const url = e.detail?.avatarUrl || "";
    if (url) this.setData({ avatarUrl: url, avatarLocal: url });
  },
  onNick(e: any) {
    this.setData({ nickname: (e.detail?.value || "").trim() });
  },
  onPhone(e: any) {
    this.setData({ phone: String(e.detail?.value || "").replace(/\D/g, "").slice(0, 11) });
  },
  onAgree() {
    this.setData({ agree: !this.data.agree });
  },
  openPrivacy() {
    const url = this.data.privacyUrl;
    if (url) wx.setClipboardData({ data: url, success: () => wx.showToast({ title: "隐私政策链接已复制" }) });
  },
  validate(needPhone: boolean): boolean {
    if (!this.data.agree) {
      wx.showToast({ title: "请先同意隐私政策", icon: "none" });
      return false;
    }
    if (!this.data.nickname.trim()) {
      wx.showToast({ title: "请填写微信昵称", icon: "none" });
      return false;
    }
    if (this.data.phone && !validMobile(this.data.phone)) {
      wx.showToast({ title: "请填写正确手机号", icon: "none" });
      return false;
    }
    if (needPhone && !this.data.mockWx && !validMobile(this.data.phone)) {
      wx.showToast({ title: "请填写正确手机号", icon: "none" });
      return false;
    }
    return true;
  },
  async submit(phoneCode?: string, phone?: string) {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const loginCode = (await wxLoginCode()) || `dev_${Date.now()}`;
      const data = await request<{ token: string; user: any }>("/auth/wx-authorize", "POST", {
        loginCode,
        phoneCode,
        phone,
        nickname: this.data.nickname.trim(),
        deviceId: deviceId(),
      });
      saveSession(data.token, data.user);
      if (this.data.avatarLocal) {
        try {
          const u = await uploadAvatar(this.data.avatarLocal);
          saveSession(data.token, u);
        } catch {
          /* 头像失败不阻断成为会员 */
        }
      }
      wx.showToast({ title: "已开通会员", icon: "success" });
      setTimeout(() => afterLoginRedirect(this.data.redirect), 400);
    } catch (e: any) {
      wx.showToast({ title: e.message || "授权失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
  onAuthTap() {
    if (!this.validate(true)) return;
    this.submit(undefined, this.data.phone.trim() || undefined);
  },
  onWxPhoneTap() {
    this.validate(false);
  },
  onGetPhone(e: any) {
    if (!this.validate(false)) return;
    const d = e.detail || {};
    if (d.errMsg && d.errMsg.indexOf("ok") < 0) {
      wx.showToast({ title: phoneAuthFailReason(d), icon: "none" });
      return;
    }
    if (d.code) this.submit(d.code);
    else wx.showToast({ title: "未获取到微信手机号，请填写手机号后登录", icon: "none" });
  },
});
