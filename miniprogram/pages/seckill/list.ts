import { request } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: { list: [] as any[] },
  async onShow() {
    const list = (await request("/seckills")).map((x: any) => ({
      ...x,
      remainMs: x.end_at ? Math.max(0, new Date(x.end_at).getTime() - Date.now()) : 0,
    }));
    this.setData({ list });
  },
  buy(e: any) {
    const item = e.currentTarget.dataset.item;
    track("seckill_click", { extra: { activity_id: item.id } });
    wx.navigateTo({
      url: `/pages/order/confirm?from=SECKILL&activityId=${item.id}&goodsId=${item.goods_id}&qty=1`,
    });
  },
});
