import axios from "axios";
import { config } from "./config";
import { getSettings } from "./settings";
import { reserveAmapCall } from "./amapQuota";

export type GeocodeParts = {
  available: true;
  province: string;
  city: string;
  district: string;
  street: string;
  streetNumber: string;
  recommend: string;
  address: string;
};

export type GeocodeMiss = {
  available: false;
  reason: "quota" | "unconfigured" | "failed";
};

function clip(v: unknown, max: number) {
  if (Array.isArray(v)) return "";
  return String(v || "").trim().slice(0, max);
}

export function mapAmapRegeo(body: any): GeocodeParts | null {
  if (!body || String(body.status) !== "1" || !body.regeocode) return null;
  const c = body.regeocode.addressComponent || {};
  const province = clip(c.province, 32);
  const cityRaw = clip(c.city, 32);
  const city = cityRaw || province;
  const district = clip(c.district, 32);
  const sn = c.streetNumber && typeof c.streetNumber === "object" ? c.streetNumber : {};
  const street = clip(sn.street, 64) || clip(c.township, 32);
  const streetNumber = clip(sn.number, 32);
  return {
    available: true,
    province,
    city,
    district,
    street,
    streetNumber,
    recommend: "",
    address: clip(body.regeocode.formatted_address, 120),
  };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeParts | GeocodeMiss> {
  if (!String(config.amapWebKey || "").trim()) return { available: false, reason: "unconfigured" };
  const settings = await getSettings();
  const reserved = await reserveAmapCall(settings.amap_monthly_limit);
  if (reserved === "exhausted") return { available: false, reason: "quota" };
  try {
    const { data } = await axios.get("https://restapi.amap.com/v3/geocode/regeo", {
      timeout: 5000,
      params: {
        key: config.amapWebKey,
        location: `${longitude},${latitude}`,
        extensions: "base",
        output: "JSON",
      },
    });
    const mapped = mapAmapRegeo(data);
    if (!mapped) return { available: false, reason: "failed" };
    return mapped;
  } catch {
    return { available: false, reason: "failed" };
  }
}
