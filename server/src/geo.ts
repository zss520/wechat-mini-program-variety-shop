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
  if (!config.tencentMapKey) return { available: false as const };
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
