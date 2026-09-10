import { request, ensureMember } from "../../utils/request";
import { asArray, asRecord } from "../../utils/display";
import { track } from "../../utils/tracker";

const POINTS_STEP = 100;

function snapPoints(raw: number, max: number) {
  if (max < POINTS_STEP) return 0;
  let n = Math.round(Number(raw || 0) / POINTS_STEP) * POINTS_STEP;
  if (n < POINTS_STEP) n = POINTS_STEP;
  if (n > max) n = Math.floor(max / POINTS_STEP) * POINTS_STEP;
  return n;
}

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
    coupons: [] as any[],
    userCouponId: 0,
    usePoints: false,
    pointsToUse: 0,
    pointsMax: 0,
    canUsePoints: false,
    pointsHint: "满100积分可抵扣，须为100的倍数",
    activityType: "NORMAL",
    activityId: 0,
    teamId: 0,
    fulfillOptions: [
      { label: "到店自提", value: "PICKUP" },
      { label: "配送到家", value: "DELIVERY" },
    ],
  },
  async onLoad(q: any) {
    if (!(await ensureMember())) return;
    const settings = wx.getStorageSync("settings") || {};
    const fulfillOptions = settings.delivery_enabled
      ? [
          { label: "到店自提", value: "PICKUP" },
          { label: "配送到家", value: "DELIVERY" },
        ]
      : [{ label: "到店自提", value: "PICKUP" }];
    let items: any[] = [];
    if (q.from === "BUY_NOW" || q.from === "SECKILL") items = [{ goodsId: Number(q.goodsId), qty: Number(q.qty || 1) }];
    else items = wx.getStorageSync("checkout_items") || [];
    const coupons = asArray(await request("/me/coupons?status=UNUSED").catch(() => []));
    this.setData({
      items,
      settings,
      fulfillOptions,
      from: q.from || "CART",
      fulfillType: "PICKUP",
      coupons,
      activityType: q.from === "SECKILL" ? "SECKILL" : "NORMAL",
      activityId: Number(q.activityId || 0),
      teamId: Number(q.teamId || 0),
    });
    const addresses = asArray(await request("/addresses"));
    const def = addresses.find((a: any) => a.is_default) || addresses[0];
    this.setData({ addresses, addressId: def ? def.id : 0 });
    this.refresh();
  },
  extra() {
    return {
      userCouponId: this.data.userCouponId || null,
      usePoints: this.data.usePoints,
      pointsToUse: this.data.usePoints ? this.data.pointsToUse : 0,
      activityType: this.data.activityType,
      activityId: this.data.activityId || null,
      teamId: this.data.teamId || null,
    };
  },
  async refresh() {
    try {
      const preview = asRecord(await request("/orders/preview", "POST", {
        fulfillType: this.data.fulfillType,
        addressId: this.data.fulfillType === "DELIVERY" ? this.data.addressId : null,
        items: this.data.items,
        ...this.extra(),
      }));
      const pointsMax = Number(preview.pointsMax || 0);
      const canUsePoints = Boolean(preview.pointsCanUse) && pointsMax >= POINTS_STEP;
      let usePoints = this.data.usePoints && canUsePoints;
      let pointsToUse = usePoints ? Number(preview.pointsUsed || 0) : 0;
      if (usePoints) pointsToUse = snapPoints(pointsToUse || pointsMax, pointsMax);
      if (!canUsePoints) usePoints = false;
      const pointsHint = !canUsePoints
        ? "满100积分可抵扣，须为100的倍数"
        : usePoints
          ? `本次使用 ${pointsToUse} 积分`
          : `可用 ${Number(preview.pointsBalance || 0)}，可抵最多 ${pointsMax}`;
      this.setData({
        preview: {
          ...preview,
          items: asArray(preview.items),
          address: asRecord(preview.address),
        },
        pointsMax,
        canUsePoints,
        usePoints,
        pointsToUse,
        pointsHint,
      });
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
  setType(e: any) {
    this.setData({ fulfillType: e.currentTarget.dataset.t });
    this.refresh();
  },
  onType(e: any) {
    this.setType({ currentTarget: { dataset: { t: e.detail.value } } });
  },
  onPoints(e: any) {
    const on = !!(e && e.detail && e.detail.value);
    if (on && this.data.pointsMax < POINTS_STEP) {
      wx.showToast({ title: "满100积分才可抵扣", icon: "none" });
      this.setData({ usePoints: false, pointsToUse: 0 });
      return;
    }
    this.setData({ usePoints: on, pointsToUse: on ? this.data.pointsMax : 0 });
    this.refresh();
  },
  onPointsQty(e: any) {
    if (!this.data.usePoints) return;
    const pointsToUse = snapPoints(Number(e.detail.value), this.data.pointsMax);
    if (pointsToUse === this.data.pointsToUse) return;
    if (!pointsToUse) {
      this.setData({ usePoints: false, pointsToUse: 0 });
      this.refresh();
      return;
    }
    this.setData({ pointsToUse });
    this.refresh();
  },
  pickCoupon(e: any) {
    const idx = Number(e.detail.value);
    const c = this.data.coupons[idx];
    this.setData({ userCouponId: c ? c.id : 0 });
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
        ...this.extra(),
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
