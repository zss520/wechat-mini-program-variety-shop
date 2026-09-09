import { toFiniteNumber } from "../../utils/display";

Component({
  properties: {
    item: { type: Object, value: {} },
    slotId: { type: String, value: "" },
    position: { type: Number, value: 0 },
    /** grid：两列封面卡；row：特价专区横排 */
    layout: { type: String, value: "grid" },
  },
  data: {
    coverW: "100%",
    coverH: "220rpx",
    saveText: "",
  },
  observers: {
    layout(layout: string) {
      const row = layout === "row";
      this.setData({
        coverW: row ? "176rpx" : "100%",
        coverH: row ? "176rpx" : "220rpx",
      });
    },
    "item.originPriceCent, item.priceCent, item.specialActive"(origin: number, price: number, special: boolean) {
      const o = toFiniteNumber(origin);
      const p = toFiniteNumber(price);
      let saveText = "";
      if (special && o != null && p != null && o > p && p > 0) {
        const n = (o - p) / 100;
        saveText = `省¥${Number.isInteger(n) ? n : n.toFixed(1)}`;
      }
      this.setData({ saveText });
    },
  },
  lifetimes: {
    ready() {
      const io = this.createIntersectionObserver({ thresholds: [0.5] });
      io.relativeToViewport().observe(".card", (res: any) => {
        if (res.intersectionRatio >= 0.5) {
          if (this.data._timer) return;
          this.data._timer = setTimeout(() => {
            this.data._timer = null;
            const { track, shouldTrackExpose } = require("../../utils/tracker");
            const item = this.data.item || {};
            if (!shouldTrackExpose(item.id, this.data.slotId)) return;
            track("goods_expose", {
              goods_id: item.id,
              slot_id: this.data.slotId,
              position: this.data.position,
            });
          }, 300);
        } else if (this.data._timer) {
          clearTimeout(this.data._timer);
          this.data._timer = null;
        }
      });
      this.data._io = io;
    },
    detached() {
      if (this.data._timer) clearTimeout(this.data._timer);
      if (this.data._io) this.data._io.disconnect();
    },
  },
  methods: {
    onTap() {
      const { track } = require("../../utils/tracker");
      const item = this.data.item;
      track("goods_click", { goods_id: item.id, slot_id: this.data.slotId, position: this.data.position });
      wx.navigateTo({
        url: `/pages/goods/detail?id=${item.id}&slot=${this.data.slotId}&pos=${this.data.position}`,
      });
    },
  },
});
