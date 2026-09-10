import { request } from "../../utils/request";
import { asArray, asRecord, toFiniteNumber } from "../../utils/display";
import { track } from "../../utils/tracker";

Page({
  data: { list: [] as any[] },
  async onShow() {
    const raw = asArray(await request("/group-buys"));
    const list = raw.map((item: any) => {
      const row = asRecord<any>(item);
      const goodsList = asArray<any>(row.goodsList);
      const progress = asRecord<any>(row.progress);
      const required = toFiniteNumber(progress.required) || toFiniteNumber(row.required_count) || 0;
      const paid = toFiniteNumber(progress.paidCount) || 0;
      return {
        ...row,
        cover: String(row.coverUrl || row.goods?.thumbUrl || row.goods?.coverUrl || ""),
        goodsList,
        goodsCount: goodsList.length || toFiniteNumber(row.goodsCount) || 0,
        minGroupPriceCent: toFiniteNumber(row.minGroupPriceCent) || toFiniteNumber(row.group_price_cent) || 0,
        hasProgress: Boolean(progress.teamId),
        teamId: toFiniteNumber(progress.teamId) || 0,
        paid,
        required,
        remain: Math.max(0, required - paid),
        progressPct: required && paid ? Math.max(8, Math.round((paid / required) * 100)) : 0,
      };
    });
    this.setData({ list });
  },
  open(e: any) {
    const id = e.currentTarget.dataset.id;
    const teamId = e.currentTarget.dataset.teamId;
    track("group_click", { extra: { activity_id: id, team_id: teamId } });
    const q = teamId ? `&teamId=${teamId}` : "";
    wx.navigateTo({ url: `/pages/group/detail?activityId=${id}${q}` });
  },
});
