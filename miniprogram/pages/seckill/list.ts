import { request } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: { list: [] as any[] },
  async onShow() {
    this.setData({ list: await request("/seckills") });
  },
  buy(e: any) {
    const item = e.currentTarget.dataset.item;
    track("seckill_click", { extra: { activity_id: item.id } });
    wx.navigateTo({
      url: `/pages/order/confirm?from=SECKILL&activityId=${item.id}&goodsId=${item.goods_id}&qty=1`,
    });
  },
});
