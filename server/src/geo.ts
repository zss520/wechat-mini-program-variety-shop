import axios from "axios";
import { config } from "./config";
import { HttpError } from "./http";

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

function clip(v: unknown, max: number) {
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

export function mapTencentGeocoder(body: any): GeocodeParts | null {
  if (!body || Number(body.status) !== 0 || !body.result) return null;
  const c = body.result.address_component || {};
  const recommend = body.result.formatted_addresses?.recommend || "";
  return {
    available: true,
    province: clip(c.province, 32),
    city: clip(c.city, 32),
    district: clip(c.district, 32),
    street: clip(c.street, 64),
    streetNumber: clip(c.street_number, 32),
    recommend: clip(recommend, 120),
    address: clip(body.result.address, 120),
  };
}

export async function reverseGeocode(latitude: number, longitude: number) {
  if (config.tencentMapKey) {
    const { data } = await axios.get("https://apis.map.qq.com/ws/geocoder/v1/", {
      timeout: 5000,
      params: {
        location: `${latitude},${longitude}`,
        key: config.tencentMapKey,
        get_poi: 0,
      },
    });
    const mapped = mapTencentGeocoder(data);
    if (!mapped) throw new HttpError(502, "定位地址解析失败");
    return mapped;
  }
  try {
    const { data } = await axios.get("https://api.bigdatacloud.net/data/reverse-geocode-client", {
      timeout: 5000,
      params: { latitude, longitude, localityLanguage: "zh" },
    });
    const mapped = mapBigDataCloud(data);
    if (mapped) return mapped;
  } catch {
    /* 无街道级结果时，小程序改为地图选点 */
  }
  return { available: false as const };
}
