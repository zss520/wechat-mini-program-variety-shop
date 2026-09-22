import { currentUser, request } from "../../utils/request";
import {
  draftFromParts,
  ensureUserLocation,
  readLocation,
  splitCnAddress,
} from "../../utils/addressLocate";

Page({
  data: {
    id: 0,
    isNew: true,
    contactName: "",
    phone: "",
    province: "",
    city: "",
    district: "",
    detail: "",
    isDefault: true,
    locating: false,
    locateHint: "",
    touched: false,
  },
  async onLoad(q: any) {
    const user = currentUser();
    if (q.id) {
      const id = Number(q.id);
      wx.setNavigationBarTitle({ title: "编辑地址" });
      const list = await request("/addresses");
      const a = (list || []).find((x: any) => Number(x.id) === id);
      if (a) {
        this.setData({
          id,
          isNew: false,
          contactName: a.contact_name || "",
          phone: a.phone || "",
          province: a.province || "",
          city: a.city || "",
          district: a.district || "",
          detail: a.detail || "",
          isDefault: !!a.is_default,
        });
      } else this.setData({ id, isNew: false });
      return;
    }
    wx.setNavigationBarTitle({ title: "新增地址" });
    if (user && user.phone) this.setData({ phone: String(user.phone) });
    this.fillByLocation();
  },
  onInput(e: any) {
    const key = e.currentTarget.dataset.k;
    const patch: Record<string, unknown> = { [key]: e.detail.value };
    if (key === "province" || key === "city" || key === "district" || key === "detail") patch.touched = true;
    this.setData(patch);
  },
  onDefault(e: any) {
    this.setData({ isDefault: !!e.detail.value });
  },
  onLocate() {
    if (this.data.locating) return;
    this.setData({ locating: true, locateHint: "请允许定位，并在地图上确认位置" });
    wx.chooseLocation({
      success: (picked) => {
        this.applyDraft(splitCnAddress(picked.address || "", picked.name || ""));
      },
      fail: (err) => {
        const msg = String((err && err.errMsg) || "");
        this.setData({
          locating: false,
          locateHint: /cancel/i.test(msg) ? "未确认位置，可手动填写" : "未授权定位或定位失败，可手动填写",
        });
      },
    });
  },
  applyDraft(draft: { province: string; city: string; district: string; detail: string }) {
    this.setData({
      province: draft.province,
      city: draft.city,
      district: draft.district,
      detail: draft.detail,
      locateHint: draft.detail ? "已根据当前位置填入，可修改或补充门牌号" : "已定位到所在区域，请补充街道和门牌号",
      locating: false,
    });
  },
  async fillByLocation() {
    if (this.data.locating) return;
    this.setData({ locating: true, locateHint: "正在请求定位授权…" });
    try {
      const auth = await ensureUserLocation();
      if (auth !== "ok") {
        this.setData({ locating: false, locateHint: "未授权定位，可手动填写，或点上方按钮重新授权" });
        return;
      }
      this.setData({ locateHint: "正在根据当前位置生成地址…" });
      const loc = await readLocation();
      const geo = await request("/geo/reverse", "POST", {
        latitude: loc.latitude,
        longitude: loc.longitude,
      }).catch(() => null);
      if (!geo || !geo.available) {
        this.setData({
          locating: false,
          locateHint: "已授权定位。请点上方按钮，在地图上确认后填入地址，仍可修改",
        });
        return;
      }
      if (this.data.touched) {
        this.setData({ locating: false, locateHint: "已保留你修改的地址" });
        return;
      }
      this.applyDraft(draftFromParts(geo));
    } catch (e: any) {
      const msg = String((e && (e.errMsg || e.message)) || "");
      this.setData({
        locating: false,
        locateHint: /privacy|隐私/.test(msg) ? "请先同意隐私协议后再定位" : "定位失败，请手动填写或点上方按钮重试",
      });
    }
  },
  async save() {
    const contactName = String(this.data.contactName || "").trim();
    const phone = String(this.data.phone || "").trim();
    const detail = String(this.data.detail || "").trim();
    if (!contactName) {
      wx.showToast({ title: "请填写联系人", icon: "none" });
      return;
    }
    if (phone.length < 6) {
      wx.showToast({ title: "请填写手机号", icon: "none" });
      return;
    }
    if (!detail) {
      wx.showToast({ title: "请填写详细地址", icon: "none" });
      return;
    }
    const body = {
      contactName,
      phone,
      province: String(this.data.province || "").trim(),
      city: String(this.data.city || "").trim(),
      district: String(this.data.district || "").trim(),
      detail,
      isDefault: this.data.isDefault,
    };
    try {
      if (this.data.id) await request(`/addresses/${this.data.id}`, "PUT", body);
      else await request("/addresses", "POST", body);
      wx.navigateBack();
    } catch (e: any) {
      wx.showToast({ title: e.message || "保存失败", icon: "none" });
    }
  },
});
