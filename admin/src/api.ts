import axios from "axios";

const TOKEN_KEY = "vs_admin_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({ baseURL: "/api/admin" }) as any;
api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(
  (r) => {
    const body = r.data;
    if (body && typeof body.code === "number" && body.code !== 0) {
      return Promise.reject(new Error(body.message || "请求失败"));
    }
    return body.data;
  },
  (err) => {
    if (err?.response?.status === 401) {
      clearToken();
      if (!location.hash.includes("/login") && !location.pathname.includes("/login")) {
        location.href = "/login";
      }
    }
    const msg = err?.response?.data?.message || err.message || "网络异常";
    return Promise.reject(new Error(msg));
  }
);
