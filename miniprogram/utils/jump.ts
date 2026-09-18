const TAB_PAGES = ["/pages/home/index", "/pages/category/index", "/pages/cart/index", "/pages/mine/index"];

export function openMpPath(path: string) {
  const url = String(path || "").trim();
  if (!url) return false;
  const pathOnly = url.split("?")[0];
  if (TAB_PAGES.indexOf(pathOnly) >= 0) {
    wx.switchTab({ url: pathOnly });
    return true;
  }
  wx.navigateTo({ url });
  return true;
}

export function openAnnouncement(item: { id?: number; canJump?: boolean; mpPath?: string }) {
  if (item && item.canJump && item.mpPath) {
    return openMpPath(item.mpPath);
  }
  if (item && item.id) {
    wx.navigateTo({ url: `/pages/notice/detail?id=${item.id}` });
    return true;
  }
  return false;
}
