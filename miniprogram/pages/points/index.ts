import { request, ensureMember } from "../../utils/request";
import { formatDateTime } from "../../utils/datetime";
import { asArray, asRecord, toFiniteNumber } from "../../utils/display";

Page({
  data: { balance: 0, ledger: [] as any[] },
  async onShow() {
    if (!(await ensureMember())) return;
    const d = asRecord(await request("/me/points"));
    this.setData({
      balance: toFiniteNumber(d.balance),
      ledger: asArray(d.ledger).map((x: any) => ({ ...x, createdAtText: formatDateTime(x.created_at, true) })),
    });
  },
});
