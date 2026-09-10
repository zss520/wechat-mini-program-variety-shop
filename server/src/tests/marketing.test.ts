import { db } from "../db";
import { previewOrder, createOrder, markPaid, ST, promoteGroupIfReady, loadOrderDetail, orderTimePoints, applyOrderListFilters } from "../orderService";
import { claimCoupon } from "../marketing";
import { couponDiscount, pointsRedeem } from "../pricing";
import { personalizedGoods, relatedGoods, cartUpsell } from "../personalize";
import { campaignBody, loadTeam, listActiveGroupBuys, refreshTeamProgress, replaceActivityGoods, saveCampaignPayload } from "../campaigns";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const cat = await db("categories").whereNull("deleted_at").first();
  if (!cat) throw new Error("need category");
  const [gid] = await db("goods").insert({
    category_id: cat.id,
    name: `__mkt_${Date.now()}`,
    price_cent: 2000,
    unit: "件",
    stock: 20,
    on_sale: 1,
    cover_url: "/static/placeholders/empty.png",
    special_price_cent: 1500,
    special_start: new Date(Date.now() - 86400000),
    special_end: new Date(Date.now() + 86400000),
  });
  const [uid] = await db("users").insert({
    openid: `mkt_${Date.now()}`,
    nickname: `__buyer_${Date.now()}`,
    phone: "13900000001",
    points_balance: 200,
  });

  const previewSpecial = await previewOrder(uid, [{ goodsId: gid, qty: 1 }], "PICKUP");
  assert(previewSpecial.goodsAmountCent === 1500, `special price expected 1500 got ${previewSpecial.goodsAmountCent}`);

  const disc = couponDiscount(
    { type: "DISCOUNT", min_amount_cent: 0, reduce_cent: 0, discount_bp: 9000, discount_cap_cent: null },
    previewSpecial.items,
    previewSpecial.goodsAmountCent
  );
  assert(!disc.ok && disc.discount === 0, "discount coupon should not stack with special");

  const [cid] = await db("coupons").insert({
    name: "满10减2",
    type: "FULL_REDUCE",
    min_amount_cent: 1000,
    reduce_cent: 200,
    discount_bp: 10000,
    per_user_limit: 2,
    start_at: new Date(Date.now() - 86400000),
    end_at: new Date(Date.now() + 86400000),
    enabled: 1,
  });
  const uc = await claimCoupon(uid, cid);
  const previewCoupon = await previewOrder(uid, [{ goodsId: gid, qty: 1 }], "PICKUP", null, { userCouponId: uc.id });
  assert(previewCoupon.couponDiscountCent === 200, `full reduce expected 200 got ${previewCoupon.couponDiscountCent}`);
  assert(previewCoupon.payAmountCent === 1300, `pay after coupon expected 1300 got ${previewCoupon.payAmountCent}`);

  const couponOrder = await createOrder({
    userId: uid,
    items: [{ goodsId: gid, qty: 1 }],
    fulfillType: "PICKUP",
    userCouponId: uc.id,
  });
  const couponDetail = await loadOrderDetail(couponOrder.id);
  assert(couponDetail && couponDetail.coupon_name === "满10减2", "order detail should expose coupon name");
  assert(couponDetail.coupon_type === "FULL_REDUCE", "order detail should expose coupon type");
  assert(Number(couponDetail.coupon_discount_cent) === 200, "order detail should keep coupon discount");
  assert(Number(couponDetail.goods_amount_cent) === 1500, "order detail should keep goods amount");
  const pts = orderTimePoints({ created_at: "t0", packed_at: "t1", delivered_at: null, completed_at: "" });
  assert(pts.map((p) => p.key).join(",") === "created_at,packed_at", "time points should skip empty timestamps");
  assert(Array.isArray(couponDetail.time_points) && couponDetail.time_points[0]?.key === "created_at", "detail exposes time points");
  assert(Array.isArray(couponDetail.timeline) && couponDetail.timeline.length > 0, "detail exposes timeline");

  const listBase = () => db("orders").leftJoin("users", "users.id", "orders.user_id").where("orders.id", couponOrder.id);
  const byNo = await listBase().modify((b) => applyOrderListFilters(b, { orderNo: String(couponOrder.order_no).slice(-4) })).first();
  assert(byNo, "order list can filter by order no");
  const byNick = await listBase().modify((b) => applyOrderListFilters(b, { customer: String(couponDetail.user.nickname).slice(0, 8) })).first();
  assert(byNick, "order list can filter by nickname");
  const byPhone = await listBase().modify((b) => applyOrderListFilters(b, { customer: "1390000" })).first();
  assert(byPhone, "order list can filter by phone fragment");
  const byCode = await listBase().modify((b) => applyOrderListFilters(b, { pickupCode: String(couponOrder.pickup_code) })).first();
  assert(byCode, "order list can filter by pickup code");
  const miss = await listBase().modify((b) => applyOrderListFilters(b, { customer: "NO_SUCH_USER_XYZ" })).first();
  assert(!miss, "unknown customer should not match");

  const previewPts = await previewOrder(uid, [{ goodsId: gid, qty: 1 }], "PICKUP", null, { usePoints: true });
  assert(previewPts.pointsUsed === 200 && previewPts.payAmountCent === 1300, "200 points should offset 2 yuan on 15 yuan special");
  assert(previewPts.pointsMax === 200 && previewPts.pointsStep === 100 && previewPts.pointsCanUse, "preview should expose redeem limits");
  const previewPts100 = await previewOrder(uid, [{ goodsId: gid, qty: 1 }], "PICKUP", null, { usePoints: true, pointsToUse: 100 });
  assert(previewPts100.pointsUsed === 100 && previewPts100.payAmountCent === 1400, "100 points should offset 1 yuan");
  let badPts = false;
  try {
    await previewOrder(uid, [{ goodsId: gid, qty: 1 }], "PICKUP", null, { usePoints: true, pointsToUse: 50 });
  } catch (e: any) {
    badPts = String(e.message || "").includes("100");
  }
  assert(badPts, "less than 100 points should be rejected");
  const low = pointsRedeem(80, 100, 1500);
  assert(low.usePoints === 0 && low.maxPoints === 0, "below 100 balance cannot redeem");
  const snap = pointsRedeem(350, 100, 1500, 150);
  assert(snap.usePoints === 100 && snap.maxPoints === 300, "requested points should snap down to 100 step and cap by max");

  const [sgid] = await db("goods").insert({
    category_id: cat.id,
    name: `__sk_${Date.now()}`,
    price_cent: 990,
    unit: "件",
    stock: 5,
    on_sale: 1,
    cover_url: "/static/placeholders/empty.png",
  });
  const [sid] = await db("seckill_activities").insert({
    goods_id: sgid,
    title: "t",
    seckill_price_cent: 100,
    seckill_stock: 1,
    per_user_limit: 1,
    start_at: new Date(Date.now() - 86400000),
    end_at: new Date(Date.now() + 86400000),
    enabled: 1,
  });
  const [uid2] = await db("users").insert({ openid: `mkt2_${Date.now()}`, nickname: "m2", phone: "13900000002" });
  const results = await Promise.allSettled([
    createOrder({ userId: uid, items: [{ goodsId: sgid, qty: 1 }], fulfillType: "PICKUP", activityType: "SECKILL", activityId: sid }),
    createOrder({ userId: uid2, items: [{ goodsId: sgid, qty: 1 }], fulfillType: "PICKUP", activityType: "SECKILL", activityId: sid }),
  ]);
  const okN = results.filter((r) => r.status === "fulfilled").length;
  const failN = results.filter((r) => r.status === "rejected").length;
  assert(okN === 1 && failN === 1, `seckill stock 1 should allow one order, got ok=${okN} fail=${failN}`);

  const [ggid] = await db("goods").insert({
    category_id: cat.id,
    name: `__gb_${Date.now()}`,
    price_cent: 2000,
    unit: "件",
    stock: 10,
    on_sale: 1,
    cover_url: "/static/placeholders/empty.png",
  });
  const [aid] = await db("group_buy_activities").insert({
    goods_id: ggid,
    title: "2人团",
    required_count: 2,
    group_price_cent: 1200,
    expire_hours: 24,
    per_user_limit: 2,
    start_at: new Date(Date.now() - 86400000),
    end_at: new Date(Date.now() + 86400000),
    enabled: 1,
  });
  const expire = new Date(Date.now() + 86400000);
  const [teamId] = await db("group_buy_teams").insert({
    activity_id: aid,
    leader_user_id: uid,
    status: "OPEN",
    expire_at: expire,
  });
  const o1 = await createOrder({
    userId: uid,
    items: [{ goodsId: ggid, qty: 1 }],
    fulfillType: "PICKUP",
    activityType: "GROUP_BUY",
    activityId: aid,
    teamId,
  });
  const o2 = await createOrder({
    userId: uid2,
    items: [{ goodsId: ggid, qty: 1 }],
    fulfillType: "PICKUP",
    activityType: "GROUP_BUY",
    activityId: aid,
    teamId,
  });
  await db("group_buy_members").insert([
    { team_id: teamId, user_id: uid, order_id: o1.id, joined_at: new Date() },
    { team_id: teamId, user_id: uid2, order_id: o2.id, joined_at: new Date() },
  ]);
  await markPaid(o1.id, "m1");
  let t1 = await db("orders").where({ id: o1.id }).first();
  assert(t1.status === ST.GROUPING, `first pay should GROUPING got ${t1.status}`);
  await markPaid(o2.id, "m2");
  await promoteGroupIfReady(teamId);
  t1 = await db("orders").where({ id: o1.id }).first();
  const t2 = await db("orders").where({ id: o2.id }).first();
  assert(t1.status === ST.PENDING_PACK && t2.status === ST.PENDING_PACK, "group success should pack both");
  const loadedTeam = await loadTeam(teamId);
  assert(loadedTeam && loadedTeam.members.length >= 2, "loadTeam should expose members");
  assert(typeof loadedTeam.members[0].nickname === "string", "member should have nickname");
  assert("avatarUrl" in loadedTeam.members[0], "member should have avatarUrl");
  assert(Array.isArray(loadedTeam.progressLog), "loadTeam should expose progress log");
  assert(loadedTeam.progressLog.some((x: { event: string }) => x.event === "PAY"), "pay progress should be recorded");
  assert(loadedTeam.progressLog.some((x: { event: string }) => x.event === "SUCCESS"), "success progress should be recorded");
  assert(Number(loadedTeam.paidCount) >= 2, "paid count should persist on team");

  const gbBody = campaignBody("GROUP", {
    title: "限购团",
    goodsId: ggid,
    requiredCount: 2,
    groupPriceCent: 1100,
    perUserLimit: 3,
    coverUrl: "/static/placeholders/empty.png",
    startAt: "2026-09-01T00:00",
    endAt: "2026-09-10T00:00",
  });
  assert(gbBody.per_user_limit === 3, "group body keeps per-user limit");
  assert(gbBody.cover_url === "/static/placeholders/empty.png", "group body keeps cover");
  assert(gbBody.goods_id === ggid, "single goods still maps to goods_id");

  const [ggidLimit] = await db("goods").insert({
    category_id: cat.id,
    name: `__gbl_${Date.now()}`,
    price_cent: 1800,
    unit: "件",
    stock: 10,
    on_sale: 1,
    cover_url: "/static/placeholders/empty.png",
  });
  const [aidLimit] = await db("group_buy_activities").insert({
    goods_id: ggidLimit,
    title: "限购1件",
    required_count: 2,
    group_price_cent: 900,
    expire_hours: 24,
    per_user_limit: 1,
    start_at: new Date(Date.now() - 86400000),
    end_at: new Date(Date.now() + 86400000),
    enabled: 1,
  });
  const [teamLimit] = await db("group_buy_teams").insert({
    activity_id: aidLimit,
    leader_user_id: uid,
    status: "OPEN",
    expire_at: expire,
  });
  await createOrder({
    userId: uid,
    items: [{ goodsId: ggidLimit, qty: 1 }],
    fulfillType: "PICKUP",
    activityType: "GROUP_BUY",
    activityId: aidLimit,
    teamId: teamLimit,
  });
  let groupLimited = false;
  try {
    await createOrder({
      userId: uid,
      items: [{ goodsId: ggidLimit, qty: 1 }],
      fulfillType: "PICKUP",
      activityType: "GROUP_BUY",
      activityId: aidLimit,
      teamId: teamLimit,
    });
  } catch (e: any) {
    groupLimited = String(e.message || "").includes("限购");
  }
  assert(groupLimited, "group per-user limit should block second order");

  const [ggidCombo] = await db("goods").insert({
    category_id: cat.id,
    name: `__gbc_${Date.now()}`,
    price_cent: 1600,
    unit: "件",
    stock: 10,
    on_sale: 1,
    cover_url: "/static/placeholders/empty.png",
  });
  const savedCombo = await saveCampaignPayload("GROUP", {
    title: "坚果组合团",
    coverUrl: "/static/placeholders/empty.png",
    requiredCount: 2,
    perUserLimit: 2,
    goodsItems: [
      { goodsId: ggid, groupPriceCent: 1100 },
      { goodsId: ggidCombo, groupPriceCent: 700 },
    ],
    startAt: new Date(Date.now() - 86400000).toISOString().slice(0, 16),
    endAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  });
  assert(savedCombo.items.length === 2, "saveCampaignPayload keeps combo items");
  assert(Number(savedCombo.payload.group_price_cent) === 1800, "activity price is combo total");
  const [comboAid] = await db("group_buy_activities").insert(savedCombo.payload);
  await replaceActivityGoods(Number(comboAid), savedCombo.items);
  const listed = await listActiveGroupBuys();
  const found = listed.find((x: { id: number }) => Number(x.id) === Number(comboAid));
  assert(found && Array.isArray(found.goodsList) && found.goodsList.length === 2, "active list exposes combo goods");
  assert(found.coverUrl, "active list exposes cover url");
  assert(Number(found.totalGroupPriceCent) === 1800, "public combo price is sum of item group prices");
  assert(Number(found.group_price_cent) === 1800, "group_price_cent is combo total");
  const comboItems = [
    { goodsId: ggid, qty: 1 },
    { goodsId: ggidCombo, qty: 1 },
  ];
  let needAll = false;
  try {
    await previewOrder(uid, [{ goodsId: ggidCombo, qty: 1 }], "PICKUP", null, {
      activityType: "GROUP_BUY",
      activityId: Number(comboAid),
    });
  } catch (e: any) {
    needAll = String(e.message || "").includes("整单购买");
  }
  assert(needAll, "partial combo should be rejected");
  const previewCombo = await previewOrder(uid, comboItems, "PICKUP", null, {
    activityType: "GROUP_BUY",
    activityId: Number(comboAid),
  });
  assert(previewCombo.items.length === 2, "combo preview includes every item");
  assert(previewCombo.goodsAmountCent === 1800, `combo total should be 1800, got ${previewCombo.goodsAmountCent}`);
  let wrongGoods = false;
  try {
    await previewOrder(uid, [{ goodsId: ggid, qty: 1 }, { goodsId: gid, qty: 1 }], "PICKUP", null, {
      activityType: "GROUP_BUY",
      activityId: Number(comboAid),
    });
  } catch (e: any) {
    wrongGoods = String(e.message || "").includes("活动商品");
  }
  assert(wrongGoods, "goods outside combo should be rejected");
  let qtyMismatch = false;
  try {
    await previewOrder(
      uid,
      [
        { goodsId: ggid, qty: 1 },
        { goodsId: ggidCombo, qty: 2 },
      ],
      "PICKUP",
      null,
      { activityType: "GROUP_BUY", activityId: Number(comboAid) }
    );
  } catch (e: any) {
    qtyMismatch = String(e.message || "").includes("数量须一致");
  }
  assert(qtyMismatch, "combo qty mismatch should be rejected");
  const [comboTeam] = await db("group_buy_teams").insert({
    activity_id: comboAid,
    leader_user_id: uid,
    status: "OPEN",
    expire_at: expire,
    required_count: 2,
  });
  const comboOrder = await createOrder({
    userId: uid,
    items: comboItems,
    fulfillType: "PICKUP",
    activityType: "GROUP_BUY",
    activityId: Number(comboAid),
    teamId: Number(comboTeam),
  });
  const comboLines = await db("order_items").where({ order_id: comboOrder.id });
  assert(comboLines.length === 2, "combo order stores every goods line");
  assert(
    comboLines.reduce((s: number, l: { amount_cent: number }) => s + Number(l.amount_cent || 0), 0) === 1800,
    "combo order amount is item totals"
  );
  const comboOrder2 = await createOrder({
    userId: uid,
    items: comboItems,
    fulfillType: "PICKUP",
    activityType: "GROUP_BUY",
    activityId: Number(comboAid),
    teamId: Number(comboTeam),
  });
  assert(comboOrder2 && comboOrder2.id, "bundle limit counts orders not summed line qty");
  let comboLimited = false;
  try {
    await createOrder({
      userId: uid,
      items: comboItems,
      fulfillType: "PICKUP",
      activityType: "GROUP_BUY",
      activityId: Number(comboAid),
      teamId: Number(comboTeam),
    });
  } catch (e: any) {
    comboLimited = String(e.message || "").includes("限购");
  }
  assert(comboLimited, "third combo bundle should hit per-user limit");
  await db("group_buy_members").insert({
    team_id: comboTeam,
    user_id: uid,
    order_id: comboOrder.id,
    joined_at: new Date(),
  });
  await refreshTeamProgress(Number(comboTeam), "OPEN", { userId: uid, orderId: comboOrder.id, note: "发起拼团" });
  const comboTeamLoaded = await loadTeam(Number(comboTeam));
  assert(comboTeamLoaded && comboTeamLoaded.goodsList.length === 2, "team exposes combo goods");
  assert(comboTeamLoaded.progressLog.some((x: { event: string }) => x.event === "OPEN"), "open event recorded");
  assert(Number(comboTeamLoaded.memberCount) === 1, "member count persisted");

  const rec = await personalizedGoods(uid, 4);
  assert(Array.isArray(rec), "personalized should return list");
  const rel = await relatedGoods(gid, uid, 4);
  assert(Array.isArray(rel), "related should return list");
  await db("cart_items").insert({ user_id: uid, goods_id: gid, qty: 1 });
  const up = await cartUpsell(uid);
  assert(up.suggestions, "upsell should return suggestions");

  console.log("marketing tests passed");
  await db.destroy();
}

run().catch(async (e) => {
  console.error(e);
  await db.destroy();
  process.exit(1);
});
