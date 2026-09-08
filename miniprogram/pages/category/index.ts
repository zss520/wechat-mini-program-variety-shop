import { request } from "../../utils/request";
import { syncTabBar } from "../../utils/tabbar";
import { track } from "../../utils/tracker";

Page({
  data: {
    cats: [{ id: 0, name: "全部" }] as { id: number; name: string }[],
    list: [] as any[],
    catId: 0,
    sort: "composite",
    sortOptions: [
      { label: "综合", value: "composite" },
      { label: "销量", value: "sales" },
      { label: "价格", value: "price_asc" },
      { label: "上新", value: "new" },
    ],
  },
  onShow() {
    syncTabBar(this, "category");
    track("page_view");
    this.init();
  },
  async init() {
    const cats = (await request("/categories")) || [];
    this.setData({ cats: [{ id: 0, name: "全部" }, ...cats] });
    this.load();
  },
  async load() {
    const q = `?sort=${this.data.sort}&pageSize=50${this.data.catId ? `&categoryId=${this.data.catId}` : ""}`;
    const d = await request(`/goods${q}`);
    this.setData({ list: d.list || [] });
  },
  pickCat(e: any) {
    const id = Number(e.currentTarget.dataset.id || 0);
    if (id === this.data.catId) return;
    track("category_click", { extra: { category_id: id } });
    this.setData({ catId: id });
    this.load();
  },
  pickSort(e: any) {
    this.setData({ sort: e.currentTarget.dataset.sort });
    this.load();
  },
  onSort(e: any) {
    this.pickSort({ currentTarget: { dataset: { sort: e.detail.value } } });
  },
});
