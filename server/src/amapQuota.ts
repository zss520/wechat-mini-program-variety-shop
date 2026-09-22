import { db } from "./db";
import { config } from "./config";
import { getSettings } from "./settings";

export function shanghaiMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  return `${year}-${month}`;
}

export async function readAmapUsage(month = shanghaiMonth()) {
  const row = await db("amap_usage").where({ month }).first();
  return { month, used: Number(row?.call_count || 0) };
}

/** 占用一次调用额度。已达上限或上限为 0 时不增加计数。 */
export async function reserveAmapCall(limit: number, month = shanghaiMonth()): Promise<"ok" | "exhausted"> {
  const cap = Math.max(0, Math.floor(Number(limit) || 0));
  if (cap <= 0) return "exhausted";
  return db.transaction(async (trx) => {
    await trx.raw("SET @amap_granted := 1");
    await trx.raw(
      `INSERT INTO amap_usage (\`month\`, call_count, updated_at)
       VALUES (?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         call_count = IF(@amap_granted := (call_count < ?), call_count + 1, call_count),
         updated_at = IF(@amap_granted, NOW(), updated_at)`,
      [month, cap]
    );
    const selected = await trx.raw("SELECT @amap_granted AS granted");
    const rows = Array.isArray(selected) ? selected[0] : selected;
    const granted = Number(Array.isArray(rows) ? rows[0]?.granted : rows?.granted);
    return granted === 1 ? "ok" : "exhausted";
  });
}

export async function amapLocateStatus() {
  const settings = await getSettings();
  const limit = Math.max(0, Math.floor(Number(settings.amap_monthly_limit) || 0));
  const usage = await readAmapUsage();
  const configured = Boolean(String(config.amapWebKey || "").trim());
  const reason = !configured ? "unconfigured" : usage.used >= limit ? "quota" : "ok";
  return {
    online: reason === "ok",
    reason,
    limit,
    used: usage.used,
    month: usage.month,
  };
}

export async function settingsForAdmin() {
  const settings = await getSettings();
  const usage = await readAmapUsage();
  return { ...settings, amap_month: usage.month, amap_month_used: usage.used };
}
