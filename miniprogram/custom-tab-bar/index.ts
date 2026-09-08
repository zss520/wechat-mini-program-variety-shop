const TABS: Record<string, string> = {
  home: "/pages/home/index",
  category: "/pages/category/index",
  cart: "/pages/cart/index",
  mine: "/pages/mine/index",
};

Component({
  data: {
    value: "home",
  },
  methods: {
    onChange(e: any) {
      const value = String(e.detail.value || "");
      this.setData({ value });
      const url = TABS[value];
      if (url) wx.switchTab({ url });
    },
  },
});
