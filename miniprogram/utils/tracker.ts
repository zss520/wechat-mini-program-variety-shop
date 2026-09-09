import { request } from "./request";

const KEY = "anon_id";
let queue: any[] = [];
let timer: any = null;
const exposeAt: Record<string, number> = {};

/** 同一会话 + 商品 + 坑位 30 秒内只报一次曝光 */
export function shouldTrackExpose(goodsId: unknown, slotId: unknown) {
  const key = `${session()}|${goodsId || ""}|${slotId || ""}`;
  const now = Date.now();
  const last = exposeAt[key] || 0;
  if (now - last < 30000) return false;
  exposeAt[key] = now;
  const keys = Object.keys(exposeAt);
  if (keys.length > 200) {
    for (const k of keys.slice(0, keys.length - 200)) delete exposeAt[k];
  }
  return true;
}

function anon() {
  let id = wx.getStorageSync(KEY);
  if (!id) {
    id = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    wx.setStorageSync(KEY, id);
  }
  return id;
}

function session() {
  let s = wx.getStorageSync("sid");
  const ts = wx.getStorageSync("sid_ts") || 0;
  if (!s || Date.now() - ts > 30 * 60 * 1000) {
    s = `s_${Date.now()}`;
    wx.setStorageSync("sid", s);
  }
  wx.setStorageSync("sid_ts", Date.now());
  return s;
}

export function track(event: string, extra: Record<string, any> = {}) {
  const pages = getCurrentPages();
  const page = pages.length ? pages[pages.length - 1].route : "";
  queue.push({
    event,
    ts: Date.now(),
    anonymous_id: anon(),
    session_id: session(),
    page,
    ...extra,
  });
  if (queue.length >= 10) flush();
  else if (!timer) timer = setTimeout(flush, 5000);
}

export function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue.slice(0, 20);
  queue = queue.slice(events.length);
  request("/events", "POST", { events }).catch(() => {
    queue = events.concat(queue).slice(0, 50);
  });
}
