import { request } from "../../utils/request";

Page({
  data: { id: 0, contactName: "", phone: "", detail: "", isDefault: true },
  async onLoad(q: any) {
    if (q.id) {
      const id = Number(q.id);
      const list = await request("/addresses");
      const a = (list || []).find((x: any) => Number(x.id) === id);
      if (a) {
        this.setData({
          id,
          contactName: a.contact_name,
          phone: a.phone,
          detail: a.detail,
          isDefault: !!a.is_default,
        });
      } else this.setData({ id });
    }
  },
  onInput(e: any) {
    this.setData({ [e.currentTarget.dataset.k]: e.detail.value });
  },
  onDefault(e: any) {
    this.setData({ isDefault: !!e.detail.value });
  },
  async save() {
    const body = {
      contactName: this.data.contactName,
      phone: this.data.phone,
      detail: this.data.detail,
      isDefault: this.data.isDefault,
    };
    if (this.data.id) await request(`/addresses/${this.data.id}`, "PUT", body);
    else await request("/addresses", "POST", body);
    wx.navigateBack();
  },
});
