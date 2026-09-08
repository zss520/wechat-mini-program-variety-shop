import { request, ensureLogin } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: { list: [] as any[], checked: [] as number[], total: 0, upsell: null as any, allChecked: false },
  onShow() {
    this.load();
  },
  async load() {
    try {
      await ensureLogin();
      const list = await request("/cart");
      const checked = list.filter((x: any) => !x.invalid).map((x: any) => x.id);
      this.setData({ list, checked });
      this.calc(list, checked);
      const upsell = await request("/cart/upsell");
      this.setData({ upsell });
      if (upsell?.suggestions?.length) track("cart_upsell", { extra: { remain: upsell.target?.remainCent } });
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
  calc(list = this.data.list, checked = this.data.checked) {
    const valid = list.filter((x: any) => !x.invalid);
    const total = list.filter((x: any) => checked.includes(x.id) && !x.invalid).reduce((s: number, x: any) => s + x.priceCent * x.qty, 0);
    this.setData({ total, allChecked: valid.length > 0 && valid.every((x: any) => checked.includes(x.id)) });
  },
  toggle(e: any) {
    const id = e.currentTarget.dataset.id;
    let checked = this.data.checked.slice();
    if (checked.includes(id)) checked = checked.filter((x) => x !== id);
    else checked.push(id);
    this.setData({ checked });
    this.calc(this.data.list, checked);
  },
  onToggle(e: any) {
    this.toggle({ currentTarget: { dataset: { id: e.currentTarget.dataset.id } } });
  },
  toggleAll() {
    const validIds = this.data.list.filter((x: any) => !x.invalid).map((x: any) => x.id);
    const checked = this.data.allChecked ? [] : validIds;
    this.setData({ checked });
    this.calc(this.data.list, checked);
  },
  async changeQty(e: any) {
    const { id, d } = e.currentTarget.dataset;
    const row = this.data.list.find((x: any) => x.id === id);
    if (!row) return;
    const qty = Math.max(1, row.qty + Number(d));
    await request(`/cart/${id}`, "PUT", { qty });
    this.load();
  },
  async onQtyChange(e: any) {
    const id = e.currentTarget.dataset.id;
    const qty = Math.max(1, Number(e.detail.value));
    const row = this.data.list.find((x: any) => x.id === id);
    if (!row || row.qty === qty) return;
    await request(`/cart/${id}`, "PUT", { qty });
    this.load();
  },
  async del(e: any) {
    await request(`/cart/${e.currentTarget.dataset.id}`, "DELETE");
    this.load();
  },
  addUpsell(e: any) {
    const id = e.currentTarget.dataset.id;
    request("/cart", "POST", { goodsId: id, qty: 1 }).then(() => this.load());
  },
  settle() {
    const items = this.data.list.filter((x: any) => this.data.checked.includes(x.id) && !x.invalid);
    if (!items.length) return;
    track("cart_settle_click", { extra: { sku_count: items.length } });
    wx.setStorageSync("checkout_items", items.map((x: any) => ({ goodsId: x.goodsId, qty: x.qty })));
    wx.navigateTo({ url: "/pages/order/confirm?from=CART" });
  },
});
