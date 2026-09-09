import { API_BASE, FILE_BASE } from "./config";

const TAB_PATHS = new Set(["pages/home/index", "pages/category/index", "pages/cart/index", "pages/mine/index"]);

function token(): string {
  return wx.getStorageSync("token") || "";
}

export function deviceId(): string {
  let id = wx.getStorageSync("anon_id");
  if (!id) {
    id = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    wx.setStorageSync("anon_id", id);
  }
  return id;
}

export function currentUser(): any {
  return wx.getStorageSync("user") || {};
}

export function isMember(): boolean {
  const u = currentUser();
  return Boolean(token() && (u.phoneBound || u.member || u.phone));
}

export function saveSession(t: string, user: any) {
  wx.setStorageSync("token", t);
  wx.setStorageSync("user", user || {});
}

export function clearSession() {
  wx.removeStorageSync("token");
  wx.removeStorageSync("user");
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
          clearSession();
          reject(new Error(body.message || "请先微信授权登录"));
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

export function wxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (r) => resolve(r.code || ""),
      fail: () => reject(new Error("微信登录失败")),
    });
  });
}

function currentPath(): string {
  const pages = getCurrentPages();
  const cur = pages.length ? pages[pages.length - 1] : null;
  if (!cur) return "";
  const opts = (cur as any).options || {};
  const q = Object.keys(opts)
    .map((k) => `${k}=${opts[k]}`)
    .join("&");
  return `/${cur.route}${q ? `?${q}` : ""}`;
}

export function goLogin(redirect?: string) {
  const r = redirect || currentPath();
  const url = r ? `/pages/auth/login?redirect=${encodeURIComponent(r)}` : "/pages/auth/login";
  wx.navigateTo({ url });
}

export function afterLoginRedirect(redirect?: string) {
  const r = decodeURIComponent(redirect || "");
  const path = r.split("?")[0].replace(/^\//, "");
  if (path && TAB_PATHS.has(path)) {
    wx.switchTab({ url: `/${path}` });
    return;
  }
  if (r) {
    wx.redirectTo({
      url: r.startsWith("/") ? r : `/${r}`,
      fail: () => wx.navigateBack({ fail: () => wx.switchTab({ url: "/pages/mine/index" }) }),
    });
    return;
  }
  wx.navigateBack({ fail: () => wx.switchTab({ url: "/pages/mine/index" }) });
}

export async function tryRestoreMember(): Promise<boolean> {
  if (isMember()) return true;
  try {
    const code = await wxLoginCode();
    const data = await request<{ token?: string; user?: any; needAuthorize?: boolean }>("/auth/wx-login", "POST", {
      code: code || `dev_${Date.now()}`,
      deviceId: deviceId(),
    });
    if (data.token && data.user && (data.user.phoneBound || data.user.member || data.user.phone)) {
      saveSession(data.token, data.user);
      return true;
    }
  } catch {
    /* 未授权则走授权页 */
  }
  return false;
}

/** 已是会员返回 true；否则跳转授权页并返回 false */
export async function ensureMember(): Promise<boolean> {
  if (await tryRestoreMember()) return true;
  goLogin();
  return false;
}

export async function ensureLogin(): Promise<boolean> {
  return ensureMember();
}

export async function ensurePhone(): Promise<boolean> {
  return ensureMember();
}

export function uploadAvatar(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${FILE_BASE}/api/app/me/avatar`,
      filePath,
      name: "file",
      header: { Authorization: token() ? `Bearer ${token()}` : "" },
      success(res) {
        try {
          const body = JSON.parse(String(res.data || "{}"));
          if (body.code !== 0) reject(new Error(body.message || "头像上传失败"));
          else resolve(body.data);
        } catch {
          reject(new Error("头像上传失败"));
        }
      },
      fail: () => reject(new Error("头像上传失败")),
    });
  });
}
