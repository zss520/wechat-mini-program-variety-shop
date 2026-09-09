import {
  afterLoginRedirect,
  deviceId,
  request,
  saveSession,
  uploadAvatar,
  wxLoginCode,
} from "../../utils/request";

Page({
  data: {
    nickname: "",
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
  onAgree() {
    this.setData({ agree: !this.data.agree });
  },
  openPrivacy() {
    const url = this.data.privacyUrl;
    if (url) wx.setClipboardData({ data: url, success: () => wx.showToast({ title: "隐私政策链接已复制" }) });
  },
  validate(): boolean {
    if (!this.data.agree) {
      wx.showToast({ title: "请先同意隐私政策", icon: "none" });
      return false;
    }
    if (!this.data.nickname.trim()) {
      wx.showToast({ title: "请填写微信昵称", icon: "none" });
      return false;
    }
    return true;
  },
  async submit(phoneCode?: string, phone?: string) {
    if (this.data.submitting) return;
    if (!this.validate()) return;
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
  onGetPhone(e: any) {
    const d = e.detail || {};
    if (d.errMsg && d.errMsg.indexOf("ok") < 0) {
      wx.showToast({ title: "需要授权手机号才能下单", icon: "none" });
      return;
    }
    if (d.code) this.submit(d.code);
    else if (this.data.mockWx) this.submit(undefined, "13800138000");
    else wx.showToast({ title: "未获取到手机号授权", icon: "none" });
  },
  onMockAuth() {
    this.submit(undefined, "13800138000");
  },
});
