import { request, ensureLogin } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: { item: {} as any, qty: 1, slot: "", id: 0 },
  onLoad(q: any) {
    this.setData({ id: Number(q.id), slot: q.slot || "" });
    this.load();
  },
  async load() {
    try {
      const item = await request(`/goods/${this.data.id}`);
      this.setData({ item });
      track("goods_detail_view", { goods_id: item.id, extra: { from_slot: this.data.slot } });
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
  add() {
    const max = this.data.item.stock || 1;
    this.setData({ qty: Math.min(max, this.data.qty + 1) });
  },
  sub() {
    this.setData({ qty: Math.max(1, this.data.qty - 1) });
  },
  async addCart() {
    await ensureLogin();
    await request("/cart", "POST", { goodsId: this.data.item.id, qty: this.data.qty });
    track("add_to_cart", { goods_id: this.data.item.id, extra: { qty: this.data.qty } });
    wx.showToast({ title: "已加入购物车" });
  },
  async buy() {
    if (this.data.item.soldOut) return;
    await ensureLogin();
    track("buy_now_click", { goods_id: this.data.item.id });
    wx.navigateTo({
      url: `/pages/order/confirm?from=BUY_NOW&goodsId=${this.data.item.id}&qty=${this.data.qty}`,
    });
  },
});
