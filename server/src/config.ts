import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function bool(v: string | undefined, d = false): boolean {
  if (v === undefined) return d;
  return v === "1" || v === "true" || v === "TRUE";
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  publicUrl: (process.env.PUBLIC_URL || "http://127.0.0.1:3000").replace(/\/$/, ""),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpires: process.env.JWT_EXPIRES || "7d",
  mockWx: bool(process.env.MOCK_WX, true),
  mockPay: bool(process.env.MOCK_PAY, true),
  wxAppId: process.env.WX_APPID || "",
  wxSecret: process.env.WX_SECRET || "",
  wxMchId: process.env.WX_MCHID || "",
  wxPayKey: process.env.WX_PAY_API_V3_KEY || "",
  wxNotifyUrl: process.env.WX_PAY_NOTIFY_URL || "",
  uploadDir: path.resolve(__dirname, "../uploads"),
  staticDir: path.resolve(__dirname, "../static"),
};

export function publicUrl(p?: string | null) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${config.publicUrl}${p.startsWith("/") ? p : "/" + p}`;
}
