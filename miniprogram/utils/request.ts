import { API_BASE } from "./config";

function token(): string {
  return wx.getStorageSync("token") || "";
}

export function request<T = any>(path: string, method: "GET" | "POST" | "PUT" | "DELETE" = "GET", data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method,
      data,
      header: {
        "content-type": "application/json",
        Authorization: token() ? `Bearer ${token()}` : "",
      },
      success(res: any) {
        const body = res.data || {};
        if (res.statusCode === 401) {
          wx.removeStorageSync("token");
          reject(new Error("请先登录"));
          return;
        }
        if (body.code !== 0) {
          reject(new Error(body.message || "请求失败"));
          return;
        }
        resolve(body.data as T);
      },
      fail() {
        reject(new Error("网络异常"));
      },
    });
  });
}

export async function ensureLogin(): Promise<void> {
  if (token()) return;
  const login = await new Promise<any>((resolve, reject) => {
    wx.login({ success: resolve, fail: reject });
  });
  const data = await request<{ token: string; user: any }>("/auth/wx-login", "POST", { code: login.code || `dev_${Date.now()}` });
  wx.setStorageSync("token", data.token);
  wx.setStorageSync("user", data.user);
}

export async function ensurePhone(): Promise<void> {
  await ensureLogin();
  const user = wx.getStorageSync("user") || {};
  if (user.phoneBound || user.phone) return;
  const phone = await new Promise<string>((resolve, reject) => {
    wx.showModal({
      title: "绑定手机号",
      editable: true,
      placeholderText: "请输入手机号",
      success(r: any) {
        if (r.confirm && r.content) resolve(r.content);
        else reject(new Error("需要手机号才能下单"));
      },
    });
  });
  const d = await request("/auth/wx-phone", "POST", { phone });
  wx.setStorageSync("user", { ...user, ...d, phone, phoneBound: true });
}
