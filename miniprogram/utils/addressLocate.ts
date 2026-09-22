export type AddressDraft = {
  province: string;
  city: string;
  district: string;
  detail: string;
};

function clip(v: unknown, max: number) {
  return String(v || "").trim().slice(0, max);
}

/** 把「省市区 + 详细地址」拼成一行，直辖市不重复市名。 */
export function formatAddressLine(input: {
  province?: string;
  city?: string;
  district?: string;
  detail?: string;
}) {
  const province = clip(input.province, 32);
  const city = clip(input.city, 32);
  const district = clip(input.district, 32);
  const detail = clip(input.detail, 120);
  const parts = [province];
  if (city && city !== province) parts.push(city);
  if (district) parts.push(district);
  if (detail) parts.push(detail);
  return parts.join("");
}

/** 从微信地图返回的地址文本里拆出省市区，其余留给用户改。 */
export function splitCnAddress(address: string, name?: string): AddressDraft {
  let rest = clip(address, 200);
  const poi = clip(name, 40);
  let province = "";
  let city = "";
  let district = "";
  const muni = rest.match(/^(北京市|上海市|天津市|重庆市)/);
  if (muni) {
    province = muni[1];
    city = muni[1];
    rest = rest.slice(province.length);
  } else {
    const pm = rest.match(/^(.+?(?:省|自治区|特别行政区))/);
    if (pm) {
      province = pm[1];
      rest = rest.slice(province.length);
    }
    const cm = rest.match(/^(.+?(?:自治州|地区|盟|市))/);
    if (cm) {
      city = cm[1];
      rest = rest.slice(city.length);
    }
  }
  const dm = rest.match(/^(.+?(?:自治县|区|县|旗))/);
  if (dm) {
    district = dm[1];
    rest = rest.slice(district.length);
  }
  let detail = rest.trim();
  if (poi && detail.indexOf(poi) < 0) detail = `${detail}${detail ? " " : ""}${poi}`;
  if (!detail) detail = formatAddressLine({ province, city, district });
  return {
    province: clip(province, 32),
    city: clip(city, 32),
    district: clip(district, 32),
    detail: clip(detail, 120),
  };
}

export function draftFromParts(input: {
  province?: string;
  city?: string;
  district?: string;
  street?: string;
  streetNumber?: string;
  recommend?: string;
  address?: string;
  name?: string;
}): AddressDraft {
  const province = clip(input.province, 32);
  const city = clip(input.city || (province.endsWith("市") ? province : ""), 32);
  const district = clip(input.district, 32);
  let detail = `${clip(input.street, 64)}${clip(input.streetNumber, 32)}`.trim();
  const poi = clip(input.name, 40);
  if (!detail) return splitCnAddress(String(input.address || input.recommend || ""), poi);
  if (poi && detail.indexOf(poi) < 0) detail = `${detail} ${poi}`;
  return {
    province,
    city,
    district,
    detail: clip(detail, 120),
  };
}

function callWx<T>(fn: (opts: Record<string, unknown>) => void, opts: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    fn({
      ...opts,
      success: (res: T) => resolve(res),
      fail: (err: { errMsg?: string }) => reject(err || new Error("定位失败")),
    });
  });
}

function privacyAuthorize() {
  const fn = (wx as any).requirePrivacyAuthorize as undefined | ((opts: Record<string, unknown>) => void);
  if (typeof fn !== "function") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    fn({
      success: () => resolve(),
      fail: () => reject(new Error("请先同意隐私协议后再定位")),
    });
  });
}

function askOpenSetting() {
  return new Promise<boolean>((resolve) => {
    wx.showModal({
      title: "需要定位权限",
      content: "允许后将根据当前位置生成收货地址，你仍可修改和补充。",
      confirmText: "去开启",
      cancelText: "手动填写",
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    });
  });
}

export async function ensureUserLocation(): Promise<"ok" | "deny"> {
  await privacyAuthorize();
  const setting = await callWx<{ authSetting?: Record<string, boolean> }>(wx.getSetting);
  const granted = setting.authSetting ? setting.authSetting["scope.userLocation"] : undefined;
  if (granted === true) return "ok";
  if (granted === false) {
    const agree = await askOpenSetting();
    if (!agree) return "deny";
    const opened = await callWx<{ authSetting?: Record<string, boolean> }>(wx.openSetting);
    return opened.authSetting && opened.authSetting["scope.userLocation"] ? "ok" : "deny";
  }
  try {
    await callWx(wx.authorize, { scope: "scope.userLocation" });
    return "ok";
  } catch {
    return "deny";
  }
}

export function readLocation() {
  return callWx<{ latitude: number; longitude: number }>(wx.getLocation, {
    type: "gcj02",
    isHighAccuracy: true,
    highAccuracyExpireTime: 3000,
  });
}
