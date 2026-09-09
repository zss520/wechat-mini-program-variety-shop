/** 把接口或校验异常转成店主能看懂的中文 */
export function toUserMessage(err: unknown, fallback = "操作失败，请稍后重试"): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = String(raw || "").trim();
  if (!msg) return fallback;
  if (/[\u4e00-\u9fa5]/.test(msg)) return msg;
  if (/invalid|required|expected|zod|validation/i.test(msg)) return "填写内容不符合要求，请检查必填项与格式";
  if (/network|failed to fetch|timeout/i.test(msg)) return "网络异常，请稍后重试";
  return msg.length <= 80 ? msg : fallback;
}

export const GOODS_UNITS = ["件", "斤", "份", "个", "袋", "瓶", "盒", "包", "提", "箱", "捆"];

export function goodsUnitOptions(current?: string): string[] {
  const cur = (current || "").trim();
  if (cur && !GOODS_UNITS.includes(cur)) return [cur, ...GOODS_UNITS];
  return GOODS_UNITS;
}

export function isValidYuan(v: unknown): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

export function isValidNonNegInt(v: unknown): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0;
}

export function isCnMobile(v: string): boolean {
  return /^1\d{10}$/.test(v.trim());
}
