/** 后台金额录入统一用「元」，提交时换成「分」给接口。 */

const EPS = 1e-6;

export function yuanToCent(yuan: unknown): number {
  const n = Number(yuan);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centToYuanNumber(cent: unknown): number {
  const n = Number(cent);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
}

function atMostTwoDecimals(n: number) {
  return Math.abs(Math.round(n * 100) - n * 100) < EPS;
}

/** 大于 0，最多两位小数 */
export function isValidYuan(v: unknown): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && atMostTwoDecimals(n);
}

/** 大于等于 0，最多两位小数（运费、券门槛、封顶可为 0） */
export function isValidNonNegYuan(v: unknown): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && atMostTwoDecimals(n);
}
