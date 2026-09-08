import { request } from "../../utils/request";
import { track } from "../../utils/tracker";

Page({
  data: { cats: [] as any[], list: [] as any[], catId: 0, sort: "composite" },
  onShow() {
    track("page_view");
    this.init();
  },
  async init() {
    const cats = await request("/categories");
    this.setData({ cats });
    this.load();
  },
  async load() {
    const q = `?sort=${this.data.sort}&pageSize=50${this.data.catId ? `&categoryId=${this.data.catId}` : ""}`;
    const d = await request(`/goods${q}`);
    this.setData({ list: d.list || [] });
  },
  pickCat(e: any) {
    const id = Number(e.currentTarget.dataset.id || 0);
    track("category_click", { extra: { category_id: id } });
    this.setData({ catId: id });
    this.load();
  },
  pickSort(e: any) {
    this.setData({ sort: e.currentTarget.dataset.sort });
    this.load();
  },
});
