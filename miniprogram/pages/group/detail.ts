import { request, ensureMember } from "../../utils/request";
import { asArray, asRecord, toFiniteNumber } from "../../utils/display";

type Slot = { id: number; filled: boolean; leader: boolean; name: string; avatar: string; paid: boolean };
type GoodsPick = { id: number; name: string; coverUrl: string; thumbUrl: string; groupPriceCent: number; originCent: number; selected: boolean };
type TeamPick = { teamId: number; paidCount: number; memberCount: number; required: number; remain: number };
type LogItem = { id: number; label: string; note: string; counts: string };

const EVENT_LABEL: Record<string, string> = {
  OPEN: "发起拼团",
  JOIN: "参加拼团",
  PAY: "完成支付",
  SUCCESS: "拼团成功",
  FAIL: "未成团",
  CANCEL: "取消订单",
};

function buildView(act: any, team: any, selectedGoodsId: number) {
  const a = asRecord<any>(act);
  const goodsList = asArray<any>(a.goodsList || (team && team.goodsList));
  const fallbackGoods = asRecord<any>(a.goods || (team && team.goods));
  const picks: GoodsPick[] = (goodsList.length ? goodsList : fallbackGoods.id ? [fallbackGoods] : []).map((g: any) => {
    const row = asRecord<any>(g);
    const id = toFiniteNumber(row.id) || 0;
    return {
      id,
      name: String(row.name || ""),
      coverUrl: String(row.coverUrl || ""),
      thumbUrl: String(row.thumbUrl || row.coverUrl || ""),
      groupPriceCent: toFiniteNumber(row.groupPriceCent) || toFiniteNumber(a.group_price_cent) || 0,
      originCent: toFiniteNumber(row.listPriceCent) || toFiniteNumber(row.originPriceCent) || 0,
      selected: false,
    };
  });
  const chosen = picks.find((g) => g.id === selectedGoodsId) || picks[0];
  const selectedId = chosen ? chosen.id : 0;
  const goods = chosen || asRecord<any>({});
  picks.forEach((g) => {
    g.selected = g.id === selectedId;
  });
  const required = Math.max(2, toFiniteNumber(team && team.requiredCount) || toFiniteNumber(a.required_count) || 2);
  const members = asArray<any>(team && team.members);
  const paid = team ? Math.max(0, toFiniteNumber(team.paidCount) ?? members.filter((m) => asRecord(m).paid).length) : 0;
  const memberCount = team ? Math.max(0, toFiniteNumber(team.memberCount) ?? members.length) : 0;
  const remain = Math.max(0, required - paid);
  const origin = toFiniteNumber(goods.originCent) || 0;
  const group = toFiniteNumber(goods.groupPriceCent) || toFiniteNumber(a.minGroupPriceCent) || toFiniteNumber(a.group_price_cent) || 0;
  const save = origin > group ? origin - group : 0;
  const showN = Math.min(required, 8);
  const slots: Slot[] = [];
  for (let i = 0; i < showN; i++) {
    const m = asRecord<any>(members[i]);
    const filled = i < members.length;
    slots.push({
      id: i,
      filled,
      leader: filled && (m.leader === true || i === 0),
      paid: filled && m.paid === true,
      name: filled ? String(m.nickname || (i === 0 ? "团长" : "邻居")) : "待参团",
      avatar: filled ? String(m.avatarUrl || "") : "",
    });
  }
  const cover = String(a.coverUrl || (team && team.coverUrl) || goods.coverUrl || goods.thumbUrl || "");
  const openTeams: TeamPick[] = asArray<any>(a.openTeams).map((t: any) => {
    const row = asRecord<any>(t);
    return {
      teamId: toFiniteNumber(row.teamId) || 0,
      paidCount: toFiniteNumber(row.paidCount) || 0,
      memberCount: toFiniteNumber(row.memberCount) || 0,
      required: toFiniteNumber(row.required) || required,
      remain: toFiniteNumber(row.remain) || 0,
    };
  });
  const logs: LogItem[] = asArray<any>(team && team.progressLog).map((x: any) => {
    const row = asRecord<any>(x);
    const ev = String(row.event || "");
    return {
      id: toFiniteNumber(row.id) || 0,
      label: EVENT_LABEL[ev] || ev,
      note: String(row.note || ""),
      counts: `${toFiniteNumber(row.paidCount) || 0}/${toFiniteNumber(row.requiredCount) || required}`,
    };
  });
  return {
    cover,
    thumb: String(goods.thumbUrl || goods.coverUrl || ""),
    title: String(a.title || ""),
    goodsId: selectedId,
    goodsName: String(goods.name || ""),
    goodsSubtitle: String(fallbackGoods.subtitle || ""),
    goodsUnit: String(fallbackGoods.unit || goodsList[0]?.unit || "件"),
    goodsList: picks,
    multiGoods: picks.length > 1,
    groupCent: group,
    originCent: origin,
    saveCent: save,
    required,
    paid,
    memberCount,
    remain,
    progress: paid ? Math.max(8, Math.round((paid / required) * 100)) : 0,
    perUserLimit: Math.max(1, toFiniteNumber(a.per_user_limit) || 1),
    expireHours: Math.max(1, toFiniteNumber(a.expire_hours) || 24),
    slots,
    openTeams,
    logs,
  };
}

Page({
  data: {
    activityId: 0,
    teamId: 0,
    selectedGoodsId: 0,
    act: null as any,
    team: null as any,
    remainMs: 0,
    view: buildView(null, null, 0),
  },
  async loadPage(activityId: number, teamId: number, selectedGoodsId: number) {
    let act: any = null;
    try {
      act = asRecord(await request(`/group-buys/${activityId}`));
    } catch {
      const list = asArray(await request("/group-buys"));
      act = list.find((x: any) => Number(x.id) === activityId) || list[0] || null;
    }
    let team: any = null;
    if (teamId) {
      try {
        team = asRecord(await request(`/group-buys/teams/${teamId}`));
        const activity = asRecord<any>(team.activity);
        if (activity.id) {
          act = { ...(act || {}), ...activity, goods: team.goods || (act && act.goods), goodsList: team.goodsList || (act && act.goodsList), coverUrl: team.coverUrl || (act && act.coverUrl) };
        }
      } catch {
        team = null;
      }
    }
    const goodsList = asArray<any>(act && act.goodsList);
    const nextGoodsId = selectedGoodsId || toFiniteNumber(goodsList[0]?.id) || toFiniteNumber(act?.goods?.id) || 0;
    this.setData({
      act,
      team,
      activityId: act ? Number(act.id) : activityId,
      teamId: team ? Number(team.id) : teamId,
      selectedGoodsId: nextGoodsId,
      remainMs: act?.end_at ? Math.max(0, new Date(act.end_at).getTime() - Date.now()) : 0,
      view: buildView(act, team, nextGoodsId),
    });
  },
  async onLoad(q: any) {
    const activityId = Number(q.activityId || 0);
    const teamId = Number(q.teamId || 0);
    this.setData({ activityId, teamId });
    await this.loadPage(activityId, teamId, 0);
  },
  pickGoods(e: any) {
    const id = Number(e.currentTarget.dataset.id || 0);
    if (!id) return;
    this.setData({
      selectedGoodsId: id,
      view: buildView(this.data.act, this.data.team, id),
    });
  },
  pickTeam(e: any) {
    const teamId = Number(e.currentTarget.dataset.id || 0);
    if (!teamId) return;
    this.loadPage(this.data.activityId, teamId, this.data.selectedGoodsId);
  },
  goGoods(e: any) {
    const id = Number(e.currentTarget.dataset.id || this.data.view.goodsId);
    if (!id) return;
    wx.navigateTo({ url: `/pages/goods/detail?id=${id}` });
  },
  async payAfter(res: any) {
    const order = res.order;
    const teamId = Number(res.teamId || this.data.teamId || 0);
    const pay = await request(`/orders/${order.id}/pay`, "POST");
    const back = `/pages/group/detail?activityId=${this.data.activityId}&teamId=${teamId}`;
    if (pay.mockPay) {
      await request(`/orders/${order.id}/mock-pay`, "POST");
      wx.redirectTo({ url: back });
      return;
    }
    wx.requestPayment({
      ...pay,
      success: () => wx.redirectTo({ url: back }),
    });
  },
  async open() {
    try {
      if (!(await ensureMember())) return;
      if (!this.data.remainMs) {
        wx.showToast({ title: "活动已结束", icon: "none" });
        return;
      }
      if (!this.data.view.goodsId) {
        wx.showToast({ title: "请选择商品", icon: "none" });
        return;
      }
      const res = await request(`/group-buys/${this.data.activityId}/open`, "POST", {
        qty: 1,
        goodsId: this.data.view.goodsId,
        fulfillType: "PICKUP",
      });
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
      if (!this.data.view.goodsId) {
        wx.showToast({ title: "请选择商品", icon: "none" });
        return;
      }
      const res = await request(`/group-buys/teams/${this.data.teamId}/join`, "POST", {
        qty: 1,
        goodsId: this.data.view.goodsId,
        fulfillType: "PICKUP",
      });
      await this.payAfter(res);
    } catch (e: any) {
      wx.showToast({ title: e.message, icon: "none" });
    }
  },
});
