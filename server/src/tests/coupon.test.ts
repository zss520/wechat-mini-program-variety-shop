import {
  couponBlockReason,
  couponThresholdText,
  couponTypeText,
  decorateCouponView,
  usableCoupons,
} from "../../../miniprogram/utils/coupon";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  assert(couponTypeText("FULL_REDUCE") === "满减券", "full reduce label");
  assert(couponTypeText("DISCOUNT") === "折扣券", "discount label");
  assert(couponThresholdText(0) === "无使用门槛", "no threshold");
  assert(couponThresholdText(1000) === "满¥10可用", "threshold 10 yuan");
  assert(couponThresholdText(1050) === "满¥10.5可用", "threshold 10.5 yuan");

  const view = decorateCouponView({
    name: "满10减2",
    type: "FULL_REDUCE",
    min_amount_cent: 1000,
    start_at: "2026-01-01 00:00:00",
    end_at: "2026-12-31 23:59:00",
  });
  assert(view.typeText === "满减券", "view type");
  assert(view.thresholdText === "满¥10可用", "view threshold");
  assert(String(view.startText).indexOf("2026-01-01") === 0, "view start");
  assert(String(view.endText).indexOf("2026-12-31") === 0, "view end");
  assert(String(view.periodText).indexOf("至") >= 0, "view period");

  const start = new Date(Date.now() - 60 * 1000).toISOString();
  const end = new Date(Date.now() + 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();

  const ok = { id: 1, name: "可用", type: "FULL_REDUCE", min_amount_cent: 1000, start_at: start, end_at: end };
  const low = { id: 2, name: "门槛", type: "FULL_REDUCE", min_amount_cent: 5000, start_at: start, end_at: end };
  const soon = { id: 3, name: "未开始", type: "FULL_REDUCE", min_amount_cent: 0, start_at: future, end_at: end };
  const expired = { id: 4, name: "过期", type: "FULL_REDUCE", min_amount_cent: 0, start_at: past, end_at: past };
  const disc = {
    id: 5,
    name: "折扣",
    type: "DISCOUNT",
    min_amount_cent: 0,
    start_at: start,
    end_at: end,
  };
  const preview = { goodsAmountCent: 2000, items: [{ isPromo: false, amountCent: 2000 }] };

  assert(!couponBlockReason(ok, preview), "usable full reduce");
  assert(couponBlockReason(low, preview).indexOf("门槛") >= 0, "below threshold");
  assert(couponBlockReason(soon, preview) === "未到可用时间", "not started");
  assert(couponBlockReason(expired, preview) === "已过期", "expired");
  assert(couponBlockReason(disc, { goodsAmountCent: 1500, items: [{ isPromo: true, amountCent: 1500 }] }) === "折扣券不与特价/拼团/秒杀叠加", "discount no stack");

  const usable = usableCoupons([ok, low, soon, expired, disc], preview);
  assert(usable.length === 2 && usable[0].id === 1 && usable[1].id === 5, "checkout only lists coupons that meet conditions");

  console.log("coupon util tests passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
