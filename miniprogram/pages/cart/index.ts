import { request, ensureMember, isMember, tryRestoreMember } from "../../utils/request";
import { asArray, asRecord } from "../../utils/display";
import { applyCartSelection, cartItemId, nextCheckedIds } from "../../utils/cartSelect";
import { syncTabBar } from "../../utils/tabbar";
import { track } from "../../utils/tracker";

Page({
  data: {
    list: [] as any[],
    checked: [] as number[],
    total: 0,
    upsell: { suggestions: [] as any[], target: {} as any },
    allChecked: false,
    needLogin: false,
  },
  onShow() {
    syncTabBar(this, "cart");
    this.load();
  },
  applyChecked(list: any[], checkedIds: unknown[]) {
    const next = applyCartSelection(list, checkedIds);
    this.setData(next);
  },
  async load() {
    if (!isMember()) {
      const restored = await tryRestoreMember();
      if (!restored) {
        this.setData({
          needLogin: true,
          list: [],
          checked: [],
          total: 0,
          allChecked: false,
          upsell: { suggestions: [], target: {} },
        });
        return;
      }
    }
    try {
      this.setData({ needLogin: false });
      const list = asArray(await request("/cart"));
      const validIds = list.filter((x: any) => !x.invalid).map((x: any) => cartItemId(x.id));
      const prev = (this.data.checked || []).map(cartItemId).filter((id) => id > 0);
      const inited = (this.data.list || []).length > 0;
      const checked = inited ? validIds.filter((id) => prev.indexOf(id) >= 0) : validIds;
      this.applyChecked(list, checked);
      const rawUpsell = asRecord(await request("/cart/upsell"));
      const upsell = {
        suggestions: asArray(rawUpsell.suggestions),
        target: asRecord(rawUpsell.target),
      };
      this.setData({ upsell });
      if (upsell?.suggestions?.length) track("cart_upsell", { extra: { remain: upsell.target?.remainCent } });
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
  onToggle(e: any) {
    const id = cartItemId(e.currentTarget?.dataset?.id ?? e.detail?.context?.value);
    if (!id) return;
    const want = e.detail && typeof e.detail.checked === "boolean" ? e.detail.checked : undefined;
    this.applyChecked(this.data.list, nextCheckedIds(this.data.checked, id, want));
  },
  toggleAll(e: any) {
    const validIds = this.data.list.filter((x: any) => !x.invalid).map((x: any) => cartItemId(x.id));
    const want = e?.detail && typeof e.detail.checked === "boolean" ? e.detail.checked : !this.data.allChecked;
    this.applyChecked(this.data.list, want ? validIds : []);
  },
  async changeQty(e: any) {
    const { id, d } = e.currentTarget.dataset;
    const row = this.data.list.find((x: any) => cartItemId(x.id) === cartItemId(id));
    if (!row) return;
    const qty = Math.max(1, row.qty + Number(d));
    await request(`/cart/${id}`, "PUT", { qty });
    this.load();
  },
  async onQtyChange(e: any) {
    const id = e.currentTarget.dataset.id;
    const qty = Math.max(1, Number(e.detail.value));
    const row = this.data.list.find((x: any) => cartItemId(x.id) === cartItemId(id));
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
  async login() {
    if (await ensureMember()) this.load();
  },
  settle() {
    const items = this.data.list.filter((x: any) => x.selected && !x.invalid);
    if (!items.length) {
      wx.showToast({ title: "请先选择商品", icon: "none" });
      return;
    }
    track("cart_settle_click", { extra: { sku_count: items.length } });
    wx.setStorageSync("checkout_items", items.map((x: any) => ({ goodsId: x.goodsId, qty: x.qty })));
    wx.navigateTo({ url: "/pages/order/confirm?from=CART" });
  },
});
