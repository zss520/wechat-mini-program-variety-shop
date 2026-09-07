Page({
  data: { ok: true, id: 0 },
  onLoad(q: any) {
    this.setData({ ok: q.ok === "1", id: q.id });
  },
  go() {
    wx.redirectTo({ url: `/pages/order/detail?id=${this.data.id}` });
  },
});
