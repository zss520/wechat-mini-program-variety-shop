export type TabName = "home" | "category" | "cart" | "mine";

export function syncTabBar(page: { getTabBar?: () => { setData: (d: Record<string, any>) => void } }, value: TabName) {
  const bar = typeof page.getTabBar === "function" ? page.getTabBar() : null;
  if (bar) bar.setData({ value });
}
