import { db } from "./db";
import { HttpError } from "./http";

export type ShopSettings = {
  shop_name: string;
  logo_url: string;
  intro: string;
  phone: string;
  wechat_id: string;
  pickup_address: string;
  business_hours: string;
  delivery_enabled: boolean;
  freight_cent: number;
  free_freight_over_cent: number;
  pay_timeout_minutes: number;
  pause_order: boolean;
  low_stock_threshold: number;
  primary_color: string;
  points_enabled: boolean;
  points_earn_per_yuan: number;
  points_redeem_rate: number;
  amap_monthly_limit: number;
};

export const SETTINGS_DEFAULTS: ShopSettings = {
  shop_name: "社区杂货铺",
  logo_url: "",
  intro: "",
  phone: "",
  wechat_id: "",
  pickup_address: "",
  business_hours: "08:00-21:00",
  delivery_enabled: true,
  freight_cent: 0,
  free_freight_over_cent: 0,
  pay_timeout_minutes: 15,
  pause_order: false,
  low_stock_threshold: 5,
  primary_color: "#C2410C",
  points_enabled: true,
  points_earn_per_yuan: 1,
  points_redeem_rate: 100,
  amap_monthly_limit: 1200000,
};

const defaults = SETTINGS_DEFAULTS;

function asText(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) return raw.toString("utf8");
  return String(raw);
}

function parseBool(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

function parseValue(key: keyof ShopSettings, raw: unknown): unknown {
  if (raw == null) return defaults[key];
  const text = asText(raw);
  if (typeof defaults[key] === "boolean") return parseBool(text);
  if (typeof defaults[key] === "number") {
    const n = Number(text);
    return Number.isFinite(n) ? n : defaults[key];
  }
  return text;
}

function toStoreValue(key: keyof ShopSettings, v: unknown): string {
  if (typeof defaults[key] === "boolean") {
    return v === true || v === 1 || v === "true" || v === "1" ? "true" : "false";
  }
  if (typeof defaults[key] === "number") {
    const n = Number(v);
    return String(Number.isFinite(n) ? n : defaults[key]);
  }
  return asText(v ?? "");
}

export async function getSettings(): Promise<ShopSettings> {
  const rows = await db("shop_settings").select("skey", "svalue");
  const map: Record<string, unknown> = {};
  for (const r of rows) map[r.skey] = r.svalue;
  const out = { ...defaults };
  (Object.keys(defaults) as (keyof ShopSettings)[]).forEach((k) => {
    if (map[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = parseValue(k, map[k]);
  });
  return out;
}

export async function saveSettings(patch: Partial<ShopSettings>) {
  const keys = Object.keys(patch) as (keyof ShopSettings)[];
  for (const k of keys) {
    if (!(k in defaults)) continue;
    if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
    const v = patch[k];
    if (v === undefined) continue;
    if (k === "amap_monthly_limit") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 10000000) {
        throw new HttpError(400, "每月在线定位次数须为 0 到 10000000 的整数");
      }
    }
    const svalue = toStoreValue(k, v);
    const exists = await db("shop_settings").where({ skey: k }).first();
    if (exists) await db("shop_settings").where({ skey: k }).update({ svalue, updated_at: db.fn.now() });
    else await db("shop_settings").insert({ skey: k, svalue });
  }
  return getSettings();
}
