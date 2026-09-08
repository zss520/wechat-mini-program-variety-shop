import { request } from "./utils/request";
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
      if (data.settings?.shop_name) {
        wx.setNavigationBarTitle({ title: data.settings.shop_name });
      }
    } catch (e) {
      console.error(e);
    }
  },
});
