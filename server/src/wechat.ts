import axios from "axios";
import { config } from "./config";
import { HttpError } from "./http";

type TokenCache = { token: string; expireAt: number };
let accessTokenCache: TokenCache = { token: "", expireAt: 0 };

export async function code2session(
  code: string,
  deviceId?: string
): Promise<{ openid: string; unionid?: string }> {
  if (config.mockWx) {
    const key = String(deviceId || code || "guest")
      .replace(/[^\w-]/g, "")
      .slice(0, 48) || "guest";
    return { openid: `mock_${key}`.slice(0, 64) };
  }
  if (!config.wxAppId || !config.wxSecret) throw new HttpError(500, "未配置微信 AppId / Secret");
  if (!code) throw new HttpError(400, "缺少微信登录凭证");
  const { data } = await axios.get("https://api.weixin.qq.com/sns/jscode2session", {
    params: {
      appid: config.wxAppId,
      secret: config.wxSecret,
      js_code: code,
      grant_type: "authorization_code",
    },
    timeout: 8000,
  });
  if (!data.openid) throw new HttpError(400, data.errmsg || "微信登录失败");
  return { openid: data.openid, unionid: data.unionid };
}

export async function getAccessToken(): Promise<string> {
  if (config.mockWx) return "mock_access_token";
  if (!config.wxAppId || !config.wxSecret) throw new HttpError(500, "未配置微信 AppId / Secret");
  if (accessTokenCache.token && Date.now() < accessTokenCache.expireAt) return accessTokenCache.token;
  const { data } = await axios.get("https://api.weixin.qq.com/cgi-bin/token", {
    params: { grant_type: "client_credential", appid: config.wxAppId, secret: config.wxSecret },
    timeout: 8000,
  });
  if (!data.access_token) throw new HttpError(500, data.errmsg || "获取微信接口凭证失败");
  accessTokenCache = {
    token: data.access_token,
    expireAt: Date.now() + Math.max(60, Number(data.expires_in || 7200) - 200) * 1000,
  };
  return accessTokenCache.token;
}

export async function getWxPhone(phoneCode?: string, mockPhone?: string): Promise<string> {
  if (config.mockWx) {
    const p = String(mockPhone || "13800138000").replace(/\D/g, "");
    if (!/^1[3-9]\d{9}$/.test(p)) throw new HttpError(400, "模拟手机号格式不正确");
    return p;
  }
  if (!phoneCode) throw new HttpError(400, "缺少手机号授权凭证");
  const token = await getAccessToken();
  const { data } = await axios.post(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(token)}`,
    { code: phoneCode },
    { timeout: 8000 }
  );
  if (data.errcode && Number(data.errcode) !== 0) {
    throw new HttpError(400, data.errmsg || "微信手机号授权失败");
  }
  const info = data.phone_info || {};
  const phone = String(info.purePhoneNumber || info.phoneNumber || "").replace(/\D/g, "");
  const cn = phone.length > 11 ? phone.slice(-11) : phone;
  if (!/^1[3-9]\d{9}$/.test(cn)) throw new HttpError(400, "未获取到有效手机号");
  return cn;
}

export function mockPayParams(orderNo: string) {
  return {
    mockPay: true,
    timeStamp: String(Math.floor(Date.now() / 1000)),
    nonceStr: `mock${Date.now()}`,
    package: `prepay_id=mock_${orderNo}`,
    signType: "RSA",
    paySign: "MOCK",
  };
}
