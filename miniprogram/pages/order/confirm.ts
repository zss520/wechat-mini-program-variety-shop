import { request, ensurePhone } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: {
    from: "CART",
    fulfillType: "PICKUP",
    items: [] as any[],
    preview: {} as any,
    remark: "",
    addresses: [] as any[],
    addressId: 0 as number,
    settings: {} as any,
  },
  async onLoad(q: any) {
    await ensurePhone();
    const settings = wx.getStorageSync("settings") || {};
    let items: any[] = [];
    if (q.from === "BUY_NOW") items = [{ goodsId: Number(q.goodsId), qty: Number(q.qty || 1) }];
    else items = wx.getStorageSync("checkout_items") || [];
    this.setData({ items, settings, from: q.from || "CART", fulfillType: "PICKUP" });
    const addresses = await request("/addresses");
    const def = addresses.find((a: any) => a.is_default) || addresses[0];
    this.setData({ addresses, addressId: def ? def.id : 0 });
    this.refresh();
  },
  async refresh() {
    try {
      const preview = await request("/orders/preview", "POST", {
        fulfillType: this.data.fulfillType,
        addressId: this.data.fulfillType === "DELIVERY" ? this.data.addressId : null,
        items: this.data.items,
      });
      this.setData({ preview });
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
  setType(e: any) {
    this.setData({ fulfillType: e.currentTarget.dataset.t });
    this.refresh();
  },
  remark(e: any) {
    this.setData({ remark: e.detail.value });
  },
  goAddr() {
    wx.navigateTo({ url: "/pages/address/list" });
  },
  async submit() {
    try {
      const order = await request("/orders", "POST", {
        fulfillType: this.data.fulfillType,
        addressId: this.data.fulfillType === "DELIVERY" ? this.data.addressId : null,
        items: this.data.items,
        remark: this.data.remark,
        from: this.data.from || "CART",
      });
      track("order_submit", { order_no: order.order_no });
      const pay = await request(`/orders/${order.id}/pay`, "POST");
      track("pay_invoke", { order_no: order.order_no });
      if (pay.mockPay) {
        await request(`/orders/${order.id}/mock-pay`, "POST");
        track("pay_result", { order_no: order.order_no, extra: { result: "ok" } });
        wx.redirectTo({ url: `/pages/order/result?id=${order.id}&ok=1` });
        return;
      }
      wx.requestPayment({
        ...pay,
        success: () => wx.redirectTo({ url: `/pages/order/result?id=${order.id}&ok=1` }),
        fail: () => wx.redirectTo({ url: `/pages/order/detail?id=${order.id}` }),
      });
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
});
