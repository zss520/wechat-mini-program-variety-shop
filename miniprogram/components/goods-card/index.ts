Component({
  properties: {
    item: { type: Object, value: {} },
    slotId: { type: String, value: "" },
    position: { type: Number, value: 0 },
  },
  lifetimes: {
    ready() {
      const io = this.createIntersectionObserver({ thresholds: [0.5] });
      io.relativeToViewport().observe(".card", (res: any) => {
        if (res.intersectionRatio >= 0.5 && !this.data._exposed) {
          this.data._timer = setTimeout(() => {
            this.setData({ _exposed: true });
            const { track } = require("../../utils/tracker");
            track("goods_expose", {
              goods_id: this.data.item.id,
              slot_id: this.data.slotId,
              position: this.data.position,
            });
          }, 300);
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
