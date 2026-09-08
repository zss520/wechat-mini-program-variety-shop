import { request, ensureLogin } from "../../utils/request";

Page({
  data: { balance: 0, ledger: [] as any[] },
  async onShow() {
    await ensureLogin();
    const d = await request("/me/points");
    this.setData({ balance: d.balance, ledger: d.ledger || [] });
  },
});
