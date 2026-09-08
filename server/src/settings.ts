import { db } from "./db";

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
};

const defaults: ShopSettings = {
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
};

function parseValue(key: keyof ShopSettings, raw: string | null): unknown {
  if (raw == null) return defaults[key];
  if (typeof defaults[key] === "boolean") return raw === "true" || raw === "1";
  if (typeof defaults[key] === "number") return Number(raw) || 0;
  return raw;
}

export async function getSettings(): Promise<ShopSettings> {
  const rows = await db("shop_settings").select("skey", "svalue");
  const map: Record<string, string> = {};
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
    const v = patch[k];
    const svalue = typeof v === "boolean" ? (v ? "true" : "false") : String(v ?? "");
    const exists = await db("shop_settings").where({ skey: k }).first();
    if (exists) await db("shop_settings").where({ skey: k }).update({ svalue, updated_at: db.fn.now() });
    else await db("shop_settings").insert({ skey: k, svalue });
  }
  return getSettings();
}
