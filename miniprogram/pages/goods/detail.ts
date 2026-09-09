import { request, ensureLogin } from "../../utils/request";
import { asArray, asRecord } from "../../utils/display";
import { track } from "../../utils/tracker";

Page({
  data: { item: {} as any, related: [] as any[], qty: 1, slot: "", id: 0, detailImages: [] as string[], nav: { type: "dots-bar" } },
  onLoad(q: any) {
    this.setData({ id: Number(q.id), slot: q.slot || "" });
    this.load();
  },
  async load() {
    try {
      const item = asRecord(await request(`/goods/${this.data.id}`));
      const images = (asArray(item.images).length ? asArray<string>(item.images) : item.coverUrl ? [item.coverUrl] : []).slice(0, 6);
      this.setData({ item, related: asArray(item.related), detailImages: images });
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
  onQty(e: any) {
    const max = this.data.item.stock || 1;
    this.setData({ qty: Math.min(max, Math.max(1, Number(e.detail.value))) });
  },
  async addCart() {
    await ensureLogin();
    await request("/cart", "POST", { goodsId: this.data.item.id, qty: this.data.qty });
    track("add_to_cart", { goods_id: this.data.item.id, extra: { qty: this.data.qty } });
    wx.showToast({ title: "已加入购物车" });
  },
  goRel(e: any) {
    wx.redirectTo({ url: `/pages/goods/detail?id=${e.currentTarget.dataset.id}&slot=detail_related` });
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
