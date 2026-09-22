import axios from "axios";
import { readAmapWebKey } from "./config";
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

const PLACE_CHAR: Record<string, string> = {
  東: "东",
  區: "区",
  門: "门",
  縣: "县",
  島: "岛",
  廣: "广",
  灣: "湾",
  龍: "龙",
  雲: "云",
  後: "后",
  國: "国",
  內: "内",
  臺: "台",
  萬: "万",
};

function simplifyPlace(v: unknown) {
  return clip(v, 32).replace(/[東區門縣島廣灣龍雲後國內臺萬]/g, (ch) => PLACE_CHAR[ch] || ch);
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

export function mapBigDataCloud(body: any): GeocodeParts | null {
  if (!body || typeof body !== "object") return null;
  const province = simplifyPlace(body.principalSubdivision);
  const city = simplifyPlace(body.city) || province;
  let district = simplifyPlace(body.locality);
  if (!province && !city && !district) return null;
  if (district === city || district === province) district = "";
  return {
    available: true,
    province,
    city,
    district,
    street: "",
    streetNumber: "",
    recommend: "",
    address: "",
  };
}

async function reverseByAmap(latitude: number, longitude: number, key: string): Promise<GeocodeParts | null> {
  const { data } = await axios.get("https://restapi.amap.com/v3/geocode/regeo", {
    timeout: 5000,
    params: {
      key,
      location: `${longitude},${latitude}`,
      extensions: "base",
      output: "JSON",
    },
  });
  return mapAmapRegeo(data);
}

async function reverseByCloud(latitude: number, longitude: number): Promise<GeocodeParts | null> {
  try {
    const { data } = await axios.get("https://api.bigdatacloud.net/data/reverse-geocode-client", {
      timeout: 5000,
      params: { latitude, longitude, localityLanguage: "zh" },
    });
    return mapBigDataCloud(data);
  } catch {
    return null;
  }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeParts | GeocodeMiss> {
  const key = readAmapWebKey();
  if (key) {
    const settings = await getSettings();
    const reserved = await reserveAmapCall(settings.amap_monthly_limit);
    if (reserved === "exhausted") return { available: false, reason: "quota" };
    try {
      const mapped = await reverseByAmap(latitude, longitude, key);
      if (mapped) return mapped;
    } catch {
      /* 高德失败时改用无 Key 的区域解析 */
    }
  }
  const cloud = await reverseByCloud(latitude, longitude);
  if (cloud) return cloud;
  return { available: false, reason: key ? "failed" : "unconfigured" };
}
