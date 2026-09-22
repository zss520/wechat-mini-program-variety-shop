import { request } from "../../utils/request";

type LegalSection = { heading: string; paragraphs: string[] };
type LegalDoc = { title: string; updatedAt: string; sections: LegalSection[] };

Page({
  data: {
    doc: null as LegalDoc | null,
    error: "",
    loading: true,
  },
  onLoad() {
    this.load();
  },
  async load() {
    this.setData({ loading: true, error: "" });
    try {
      const doc = await request<LegalDoc>("/legal");
      if (!doc || !doc.sections || !doc.sections.length) throw new Error("说明加载失败");
      wx.setNavigationBarTitle({ title: "隐私与说明" });
      this.setData({ doc, loading: false });
    } catch (e: any) {
      this.setData({ loading: false, error: e.message || "说明加载失败，请稍后重试" });
    }
  },
});
