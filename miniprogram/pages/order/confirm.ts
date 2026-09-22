import { request, ensureMember } from "../../utils/request";
import { asArray, asRecord } from "../../utils/display";
import { contactShop, freightNote, guardOpenOrder, isPaused, payTimeoutHint, readSettings } from "../../utils/shop";
import { couponBlockReason, usableCoupons } from "../../utils/coupon";
import { formatAddressLine } from "../../utils/addressLocate";
import { track } from "../../utils/tracker";

const POINTS_STEP = 100;

type CouponOption = { id: number; label: string; blocked: boolean; reason: string };

function snapPoints(raw: number, max: number) {
  if (max < POINTS_STEP) return 0;
  let n = Math.round(Number(raw || 0) / POINTS_STEP) * POINTS_STEP;
  if (n < POINTS_STEP) n = POINTS_STEP;
  if (n > max) n = Math.floor(max / POINTS_STEP) * POINTS_STEP;
  return n;
}

function yuanLabel(cent: number) {
  const n = Math.round(Number(cent || 0)) / 100;
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function buildCouponUi(coupons: any[], preview: any, appliedId: number) {
  const usable = usableCoupons(coupons, preview);
  const blocked = (coupons || []).filter((c) => couponBlockReason(c, preview));
  const options: CouponOption[] = [{ id: 0, label: "不使用优惠券", blocked: false, reason: "" }];
  for (const c of usable) {
    options.push({
      id: Number(c.id || 0),
      label: String(c.name || "优惠券"),
      blocked: false,
      reason: "",
    });
  }
  const hasUsable = usable.length > 0;
  const appliedName = String(preview.couponName || "");
  const discount = Number(preview.couponDiscountCent || 0);
  let couponNote = "未选";
  if (appliedId && appliedName) {
    couponNote = discount > 0 ? `${appliedName} -¥${yuanLabel(discount)}` : appliedName;
  } else if (!hasUsable) {
    if (blocked.length && blocked.every((c) => couponBlockReason(c, preview).indexOf("门槛") >= 0)) {
      couponNote = "暂无满足门槛的优惠券";
    } else {
      couponNote = "暂无可用优惠券";
    }
  }
  const couponPickerIndex = appliedId ? Math.max(0, options.findIndex((o) => o.id === appliedId)) : 0;
  return { couponOptions: options, couponNote, couponPickerIndex };
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
    addressText: "",
    settings: {} as any,
    coupons: [] as any[],
    couponOptions: [] as CouponOption[],
    couponNote: "未选",
    couponPickerIndex: 0,
    userCouponId: 0,
    remarkAutosize: { minHeight: 48, maxHeight: 120 },
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
    paused: false,
    pickupAddress: "",
    pickupHours: "",
    pickupPhone: "",
    freightHint: "",
    payHint: "",
  },
  async onLoad(q: any) {
    if (!(await ensureMember())) return;
    const settings = readSettings();
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
      paused: isPaused(settings),
      freightHint: freightNote(settings),
      payHint: payTimeoutHint(settings),
      pickupAddress: String(settings.pickup_address || "").trim(),
      pickupHours: String(settings.business_hours || "").trim(),
      pickupPhone: String(settings.phone || "").trim(),
    });
    const addresses = asArray(await request("/addresses"));
    const def = addresses.find((a: any) => a.is_default) || addresses[0];
    this.setData({ addresses, addressId: def ? def.id : 0 });
    this.refresh();
  },
  extra(submit = false) {
    const preview = this.data.preview || {};
    const selected = this.data.userCouponId || 0;
    const applied = Boolean(preview.couponName) || Number(preview.couponDiscountCent || 0) > 0;
    return {
      userCouponId: submit ? (applied ? selected : null) : selected || null,
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
      const pickup = asRecord(preview.pickup);
      const priced = {
        ...preview,
        items: asArray(preview.items),
        address: asRecord(preview.address),
      };
      const addressText = formatAddressLine(priced.address);
      const appliedId = Number(preview.userCouponId || 0);
      const couponUi = buildCouponUi(this.data.coupons, priced, appliedId);
      this.setData({
        preview: priced,
        addressText,
        pointsMax,
        canUsePoints,
        usePoints,
        pointsToUse,
        pointsHint,
        pickupAddress: String(pickup.address || this.data.settings.pickup_address || "").trim(),
        pickupHours: String(pickup.hours || this.data.settings.business_hours || "").trim(),
        pickupPhone: String(pickup.phone || this.data.settings.phone || "").trim(),
        paused: preview.pauseOrder != null ? Boolean(preview.pauseOrder) : isPaused(this.data.settings),
        userCouponId: appliedId,
        ...couponUi,
      });
    } catch (e: any) {
      const msg = String((e && e.message) || "预览失败");
      if (this.data.userCouponId && /优惠券|门槛|叠加/.test(msg)) {
        this.setData({ userCouponId: 0 });
        await this.refresh();
        return;
      }
      wx.showToast({ title: msg, icon: "none" });
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
    const c = (this.data.couponOptions || [])[idx];
    if (!c || !c.id) {
      this.setData({ userCouponId: 0, couponPickerIndex: 0 }, () => this.refresh());
      return;
    }
    if (c.blocked) {
      this.setData({
        userCouponId: 0,
        couponPickerIndex: 0,
        couponNote: /门槛/.test(c.reason) ? "未满门槛" : "暂不可用",
      });
      return;
    }
    this.setData({ userCouponId: c.id }, () => this.refresh());
  },
  remark(e: any) {
    this.setData({ remark: e.detail.value });
  },
  goAddr() {
    wx.navigateTo({ url: "/pages/address/list" });
  },
  callShop() {
    contactShop(this.data.settings);
  },
  async submit() {
    if (!guardOpenOrder(this.data.settings)) return;
    try {
      const order = await request("/orders", "POST", {
        fulfillType: this.data.fulfillType,
        addressId: this.data.fulfillType === "DELIVERY" ? this.data.addressId : null,
        items: this.data.items,
        remark: this.data.remark,
        from: this.data.from || "CART",
        ...this.extra(true),
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
