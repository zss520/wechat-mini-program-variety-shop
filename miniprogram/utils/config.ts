/** 线上域名。体验版和正式版须在公众平台配置此 HTTPS 域名。 */
export const API_BASE = "https://www.jinhaogou.cn/api/app";
export const FILE_BASE = "https://www.jinhaogou.cn";
/** 管理端尚未下发模板 ID 时的兜底。正式值以店铺设置里的提货通知模板为准。 */
export const PACK_SUBSCRIBE_TMPL = "ns36Dhhg3tY_GKQ_cR3vSn2e290x_25kDs8Pbz4aS7A";

function isLegacyMediaHost(host: string) {
  const h = host.toLowerCase();
  return (
    h === "127.0.0.1" ||
    h === "localhost" ||
    h.startsWith("127.0.0.1:") ||
    h.startsWith("localhost:") ||
    h === "114.55.125.157" ||
    h.startsWith("114.55.125.157:") ||
    h === "www.jinhaogou.cn" ||
    h.startsWith("www.jinhaogou.cn:")
  );
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
    if (isLegacyMediaHost(abs[1])) return `${FILE_BASE}${abs[2] || ""}`;
    return s;
  }
  if (s.startsWith("/")) return `${FILE_BASE}${s}`;
  return `${FILE_BASE}/${s}`;
}
