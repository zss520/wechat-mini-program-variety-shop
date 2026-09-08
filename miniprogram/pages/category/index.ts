import { request } from "../../utils/request";
import { syncTabBar } from "../../utils/tabbar";
import { track } from "../../utils/tracker";

type Cat = { value: string; label: string; id: number };

const ALL: Cat = { value: "0", label: "全部", id: 0 };

Page({
  data: {
    cats: [ALL] as Cat[],
    list: [] as any[],
    sideBarValue: "0",
    catId: 0,
    sort: "composite",
    loading: true,
    sortOptions: [
      { label: "综合", value: "composite" },
      { label: "销量", value: "sales" },
      { label: "价格", value: "price_asc" },
      { label: "上新", value: "new" },
    ],
  },
  loadSeq: 0,
  catsReady: false,
  onLoad() {
    this.initCats();
  },
  onShow() {
    syncTabBar(this, "category");
    track("page_view");
    if (this.catsReady) this.loadGoods();
  },
  async initCats() {
    const raw = ((await request("/categories")) || []) as { id: number; name: string }[];
    const cats: Cat[] = [
      ALL,
      ...raw.map((c) => ({ value: String(c.id), label: c.name, id: Number(c.id) })),
    ];
    this.catsReady = true;
    this.setData({ cats });
    this.loadGoods();
  },
  async loadGoods() {
    const seq = ++this.loadSeq;
    try {
      const q = `?sort=${this.data.sort}&pageSize=50${this.data.catId ? `&categoryId=${this.data.catId}` : ""}`;
      const d = await request(`/goods${q}`);
      if (seq !== this.loadSeq) return;
      this.setData({ list: d.list || [], loading: false });
    } catch (e: any) {
      if (seq !== this.loadSeq) return;
      this.setData({ loading: false });
      wx.showToast({ title: e.message || "加载失败", icon: "none" });
    }
  },
  onSideBarChange(e: any) {
    const value = String(e.detail.value);
    if (value === this.data.sideBarValue) return;
    const cat = this.data.cats.find((c) => c.value === value);
    const id = cat ? cat.id : 0;
    track("category_click", { extra: { category_id: id } });
    this.setData({ sideBarValue: value, catId: id });
    this.loadGoods();
  },
  onSort(e: any) {
    const sort = String(e.detail.value || this.data.sort);
    if (sort === this.data.sort) return;
    this.setData({ sort });
    this.loadGoods();
  },
});
