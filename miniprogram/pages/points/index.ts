import { request, ensureMember } from "../../utils/request";
import { formatDateTime } from "../../utils/datetime";
import { asArray, asRecord, toFiniteNumber } from "../../utils/display";
import { pointsRule, readSettings } from "../../utils/shop";

const PAGE_SIZE = 20;

Page({
  data: {
    balance: 0,
    earned: 0,
    spent: 0,
    ledger: [] as any[],
    rule: "",
    page: 1,
    total: 0,
    loadingMore: false,
  },
  async onShow() {
    if (!(await ensureMember())) return;
    this.load(true);
  },
  async onReachBottom() {
    if (this.data.loadingMore) return;
    if (this.data.ledger.length >= this.data.total) return;
    this.load(false);
  },
  async load(reset: boolean) {
    if (this.data.loadingMore) return;
    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loadingMore: true });
    try {
      const d = asRecord(await request(`/me/points?page=${page}&pageSize=${PAGE_SIZE}`));
      const summary = asRecord(d.summary);
      const rows = asArray(d.list || d.ledger).map((x: any) => ({
        ...x,
        reasonText: x.reasonLabel || x.reason,
        createdAtText: formatDateTime(x.created_at, true),
      }));
      const total = toFiniteNumber(d.total) || rows.length;
      this.setData({
        balance: toFiniteNumber(d.balance) || 0,
        earned: toFiniteNumber(summary.earned) || 0,
        spent: toFiniteNumber(summary.spent) || 0,
        ledger: reset ? rows : this.data.ledger.concat(rows),
        page: toFiniteNumber(d.page) || page,
        total,
        rule: pointsRule(readSettings()),
        loadingMore: false,
      });
    } catch {
      this.setData({ loadingMore: false });
    }
  },
});
