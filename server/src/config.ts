import fs from "fs";
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
  tencentMapKey: process.env.TENCENT_MAP_KEY || "",
  amapWebKey: process.env.AMAP_WEB_KEY || "",
  uploadDir: path.resolve(__dirname, "../uploads"),
  staticDir: path.resolve(__dirname, "../static"),
};

function amapKeyFromEnvFile(file: string) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const matched = trimmed.match(/^AMAP_WEB_KEY\s*=\s*(.*)$/);
      if (!matched) continue;
      let value = matched[1].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1).trim();
      }
      return value;
    }
  } catch {
    return "";
  }
  return "";
}

/** 每次定位时读取，避免进程启动后才写入 .env 时仍被视为未配置。 */
export function readAmapWebKey() {
  const fromProcess = String(process.env.AMAP_WEB_KEY || "").trim();
  if (fromProcess) return fromProcess;
  const files = [path.resolve(__dirname, "../../.env"), path.resolve(__dirname, "../.env")];
  for (const file of files) {
    const value = amapKeyFromEnvFile(file);
    if (value) return value;
  }
  return String(config.amapWebKey || "").trim();
}

export function publicUrl(p?: string | null) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${config.publicUrl}${p.startsWith("/") ? p : "/" + p}`;
}
