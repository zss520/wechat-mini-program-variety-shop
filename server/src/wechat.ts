import axios from "axios";
import { config } from "./config";
import { HttpError } from "./http";

export async function code2session(code: string): Promise<{ openid: string; unionid?: string }> {
  if (config.mockWx) {
    return { openid: `mock_${code || "guest"}`.slice(0, 64) };
  }
  if (!config.wxAppId || !config.wxSecret) throw new HttpError(500, "未配置微信 AppId");
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
