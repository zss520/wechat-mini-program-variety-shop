import { FILE_BASE } from "./config";
import { track } from "./tracker";

export type ShopSettings = Record<string, any>;

export function readSettings(): ShopSettings {
  return wx.getStorageSync("settings") || getApp()?.globalData?.settings || {};
}

export function mediaUrl(path: unknown) {
  const s = String(path || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("/")) return `${FILE_BASE}${s}`;
  return `${FILE_BASE}/${s}`;
}

export function yuanText(cent: unknown) {
  const n = Number(cent);
  if (!Number.isFinite(n)) return "";
  return (n / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function isPaused(settings: ShopSettings = readSettings()) {
  return settings.pause_order === true || settings.pause_order === 1 || settings.pause_order === "true" || settings.pause_order === "1";
}

export function shopHint(settings: ShopSettings) {
  const parts: string[] = [];
  const pickup = String(settings.pickup_address || "").trim();
  const hours = String(settings.business_hours || "").trim();
  if (pickup && hours) parts.push(`到店自提 ${pickup}（${hours}）`);
  else if (pickup) parts.push(`到店自提 ${pickup}`);
  else if (hours) parts.push(`营业时间 ${hours}`);
  else parts.push("本店支持到店自提");
  if (settings.delivery_enabled) {
    const freight = Number(settings.freight_cent) || 0;
    const free = Number(settings.free_freight_over_cent) || 0;
    let d = "支持配送";
    if (freight > 0) d += `，运费¥${yuanText(freight)}`;
    else d += "，免运费";
    if (free > 0) d += `，满¥${yuanText(free)}免运费`;
    parts.push(d);
  }
  return parts.join("；");
}

export function freightNote(settings: ShopSettings) {
  if (!settings.delivery_enabled) return "";
  const freight = Number(settings.freight_cent) || 0;
  const free = Number(settings.free_freight_over_cent) || 0;
  const bits: string[] = [];
  if (freight > 0) bits.push(`配送费¥${yuanText(freight)}`);
  else bits.push("配送免运费");
  if (free > 0) bits.push(`满¥${yuanText(free)}免运费`);
  return bits.join("，");
}

export function payTimeoutHint(settings: ShopSettings) {
  const n = Number(settings.pay_timeout_minutes);
  if (!Number.isInteger(n) || n < 1) return "";
  return `请在 ${n} 分钟内完成支付，超时将自动取消`;
}

export function pointsRule(settings: ShopSettings) {
  if (settings.points_enabled === false || settings.points_enabled === 0 || settings.points_enabled === "false") {
    return "";
  }
  const earn = Number(settings.points_earn_per_yuan) || 1;
  const rate = Number(settings.points_redeem_rate) || 100;
  return `每实付 1 元赠 ${earn} 积分，${rate} 积分抵 1 元`;
}

export function applyShopNavColor(settings: ShopSettings = readSettings()) {
  const color = String(settings.primary_color || "").trim();
  if (/^#([0-9a-fA-F]{6})$/.test(color)) {
    wx.setNavigationBarColor({ frontColor: "#ffffff", backgroundColor: color });
  }
}

export function applyShopChrome(settings: ShopSettings = readSettings()) {
  const name = String(settings.shop_name || "").trim();
  if (name) wx.setNavigationBarTitle({ title: name });
  applyShopNavColor(settings);
}

export function shareShop(settings: ShopSettings = readSettings()) {
  const title = String(settings.shop_name || "社区杂货铺").trim();
  const intro = String(settings.intro || "").trim();
  const imageUrl = mediaUrl(settings.logo_url);
  return {
    title: intro ? `${title} · ${intro}` : title,
    path: "/pages/home/index",
    imageUrl: imageUrl || undefined,
  };
}

export function guardOpenOrder(settings: ShopSettings = readSettings()) {
  if (!isPaused(settings)) return true;
  wx.showToast({ title: "店主休息中，暂不接单", icon: "none" });
  return false;
}

export function contactShop(settings: ShopSettings = readSettings()) {
  const phone = String(settings.phone || "").trim();
  const wechat = String(settings.wechat_id || "").trim();
  const itemList: string[] = [];
  if (phone) itemList.push("打电话");
  if (wechat) itemList.push("复制微信号");
  if (!itemList.length) {
    wx.showToast({ title: "店主暂未填写联系方式", icon: "none" });
    return;
  }
  const run = (label: string) => {
    if (label === "打电话") {
      track("contact_shop", { extra: { action: "phone" } });
      wx.makePhoneCall({ phoneNumber: phone });
      return;
    }
    track("contact_shop", { extra: { action: "wechat" } });
    wx.setClipboardData({
      data: wechat,
      success: () => wx.showToast({ title: "微信号已复制", icon: "none" }),
    });
  };
  if (itemList.length === 1) {
    run(itemList[0]);
    return;
  }
  wx.showActionSheet({
    itemList,
    success: (res) => run(itemList[res.tapIndex]),
  });
}

export function copyWechat(settings: ShopSettings = readSettings()) {
  const wechat = String(settings.wechat_id || "").trim();
  if (!wechat) {
    wx.showToast({ title: "店主暂未填写微信号", icon: "none" });
    return;
  }
  track("contact_shop", { extra: { action: "wechat" } });
  wx.setClipboardData({
    data: wechat,
    success: () => wx.showToast({ title: "微信号已复制", icon: "none" }),
  });
}
