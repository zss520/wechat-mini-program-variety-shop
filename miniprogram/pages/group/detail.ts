import { request, ensureMember } from "../../utils/request";
import { asArray, asRecord, toFiniteNumber } from "../../utils/display";

type Slot = { id: number; filled: boolean; leader: boolean; name: string; avatar: string };

function buildView(act: any, team: any) {
  const a = asRecord<any>(act);
  const goods = asRecord<any>(a.goods || (team && team.goods));
  const required = Math.max(2, toFiniteNumber(a.required_count) || 2);
  const members = asArray<any>(team && team.members);
  const paid = team ? Math.max(0, toFiniteNumber(team.paidCount) ?? members.length) : 0;
  const remain = Math.max(0, required - paid);
  const origin = toFiniteNumber(goods.listPriceCent) || toFiniteNumber(goods.originPriceCent) || 0;
  const group = toFiniteNumber(a.group_price_cent) || 0;
  const save = origin > group ? origin - group : 0;
  const showN = Math.min(required, 8);
  const slots: Slot[] = [];
  for (let i = 0; i < showN; i++) {
    const m = asRecord<any>(members[i]);
    const filled = i < paid;
    slots.push({
      id: i,
      filled,
      leader: filled && (m.leader === true || i === 0),
      name: filled ? String(m.nickname || (i === 0 ? "团长" : "邻居")) : "待参团",
      avatar: filled ? String(m.avatarUrl || "") : "",
    });
  }
  const cover = String(goods.coverUrl || goods.thumbUrl || "");
  return {
    cover,
    thumb: String(goods.thumbUrl || goods.coverUrl || ""),
    title: String(a.title || ""),
    goodsId: toFiniteNumber(goods.id) || 0,
    goodsName: String(goods.name || ""),
    goodsSubtitle: String(goods.subtitle || ""),
    goodsUnit: String(goods.unit || "件"),
    groupCent: group,
    originCent: origin,
    saveCent: save,
    required,
    paid,
    remain,
    progress: paid ? Math.max(8, Math.round((paid / required) * 100)) : 0,
    perUserLimit: Math.max(1, toFiniteNumber(a.per_user_limit) || 1),
    expireHours: Math.max(1, toFiniteNumber(a.expire_hours) || 24),
    slots,
  };
}

Page({
  data: {
    activityId: 0,
    teamId: 0,
    act: null as any,
    team: null as any,
    remainMs: 0,
    view: buildView(null, null),
  },
  async onLoad(q: any) {
    const activityId = Number(q.activityId || 0);
    const teamId = Number(q.teamId || 0);
    this.setData({ activityId, teamId });
    const list = asArray(await request("/group-buys"));
    let act: any = list.find((x: any) => Number(x.id) === activityId) || list[0] || null;
    let team: any = null;
    if (teamId) {
      try {
        team = asRecord(await request(`/group-buys/teams/${teamId}`));
        const activity = asRecord<any>(team.activity);
        if (activity.id) {
          act = { ...(act || {}), ...activity, goods: team.goods || (act && act.goods) };
        }
      } catch {
        team = null;
      }
    }
    this.setData({
      act,
      team,
      activityId: act ? Number(act.id) : activityId,
      remainMs: act?.end_at ? Math.max(0, new Date(act.end_at).getTime() - Date.now()) : 0,
      view: buildView(act, team),
    });
  },
  goGoods() {
    const id = this.data.view.goodsId;
    if (!id) return;
    wx.navigateTo({ url: `/pages/goods/detail?id=${id}` });
  },
  async payAfter(res: any) {
    const order = res.order;
    const pay = await request(`/orders/${order.id}/pay`, "POST");
    if (pay.mockPay) {
      await request(`/orders/${order.id}/mock-pay`, "POST");
      wx.redirectTo({ url: `/pages/order/result?id=${order.id}&ok=1` });
      return;
    }
    wx.requestPayment({
      ...pay,
      success: () => wx.redirectTo({ url: `/pages/order/result?id=${order.id}&ok=1` }),
    });
  },
  async open() {
    try {
      if (!(await ensureMember())) return;
      if (!this.data.remainMs) {
        wx.showToast({ title: "活动已结束", icon: "none" });
        return;
      }
      const res = await request(`/group-buys/${this.data.activityId}/open`, "POST", { qty: 1, fulfillType: "PICKUP" });
      await this.payAfter(res);
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
  async join() {
    try {
      if (!(await ensureMember())) return;
      if (!this.data.remainMs) {
        wx.showToast({ title: "活动已结束", icon: "none" });
        return;
      }
      const res = await request(`/group-buys/teams/${this.data.teamId}/join`, "POST", { qty: 1, fulfillType: "PICKUP" });
      await this.payAfter(res);
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
});
