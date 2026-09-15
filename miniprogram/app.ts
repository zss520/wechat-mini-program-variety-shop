import { request } from "./utils/request";
import { applyShopNavColor } from "./utils/shop";
import { track, flush } from "./utils/tracker";

App({
  globalData: {
    settings: null as any,
    cartCount: 0,
  },
  onLaunch() {
    track("app_launch", { scene: wx.getLaunchOptionsSync()?.scene });
    this.loadBootstrap();
  },
  onShow() {
    track("app_show");
  },
  onHide() {
    track("app_hide");
    flush();
  },
  async loadBootstrap() {
    try {
      const data = await request("/shop/bootstrap");
      const settings = { ...(data.settings || {}), privacyUrl: data.privacyUrl };
      this.globalData.settings = settings;
      wx.setStorageSync("settings", settings);
      wx.setStorageSync("mockWx", !!data.mockWx);
      applyShopNavColor(settings);
    } catch (e) {
      console.error(e);
    }
  },
});
