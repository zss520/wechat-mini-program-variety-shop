/** 真机 / 开发者工具访问本机服务用局域网 IP；须与电脑当前 IP 一致 */
export const API_BASE = "http://10.0.8.98:3000/api/app";
export const FILE_BASE = "http://10.0.8.98:3000";
/** 提货通知，公众平台模板编号 25930 */
export const PACK_SUBSCRIBE_TMPL = "ns36Dhhg3tY_GKQ_cR3vSn2e290x_25kDs8Pbz4aS7A";

function isLoopbackHost(host: string) {
  const h = host.toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h.startsWith("127.0.0.1:") || h.startsWith("localhost:");
}

/** 把本机回环地址改成局域网 FILE_BASE，真机才能加载图片 */
export function toDeviceMediaUrl(path: unknown) {
  const s = String(path || "").trim();
  if (!s) return "";
  if (s.startsWith("wxfile://") || s.startsWith("http://tmp/") || s.startsWith("https://tmp/")) return s;
  if (s.startsWith("/assets/")) return s;
  if (s.startsWith("//")) return toDeviceMediaUrl(`https:${s}`);
  const abs = s.match(/^https?:\/\/([^/]+)(\/.*)?$/i);
  if (abs) {
    if (isLoopbackHost(abs[1])) return `${FILE_BASE}${abs[2] || ""}`;
    return s;
  }
  if (s.startsWith("/")) return `${FILE_BASE}${s}`;
  return `${FILE_BASE}/${s}`;
}
