/** 公众平台模板编号 25930「提货通知」。关键词顺序即消息卡片顺序。管理端未保存时的默认值。 */
export const PACK_SUBSCRIBE_TEMPLATE_ID = "ns36Dhhg3tY_GKQ_cR3vSn2e290x_25kDs8Pbz4aS7A";

export type MiniprogramState = "developer" | "trial" | "formal";

/** 数据库还没有这两项时，才读环境变量。管理端保存后以店铺设置为准。 */
export function fallbackSubscribeTemplateId() {
  const fromEnv = String(process.env.WX_SUBSCRIBE_PACK_TMPL || "").trim();
  return fromEnv || PACK_SUBSCRIBE_TEMPLATE_ID;
}

export function fallbackMiniprogramState(): MiniprogramState {
  const fromEnv = String(process.env.WX_MINIPROGRAM_STATE || "").trim();
  if (fromEnv === "developer" || fromEnv === "trial" || fromEnv === "formal") return fromEnv;
  return process.env.NODE_ENV === "production" ? "formal" : "developer";
}

export function asMiniprogramState(raw: unknown): MiniprogramState {
  const value = String(raw || "").trim();
  if (value === "developer" || value === "trial" || value === "formal") return value;
  return fallbackMiniprogramState();
}

const THING_MAX = 20;
const CODE_MAX = 32;

export function clipThing(raw: unknown, fallback: string) {
  const text = String(raw || "")
    .replace(/[\r\n\t]+/g, "")
    .replace(/\s+/g, "")
    .trim();
  const value = Array.from(text || fallback).slice(0, THING_MAX).join("");
  return value || Array.from(fallback).slice(0, THING_MAX).join("");
}

/** character_string 只能是数字、字母和常见符号，不能含中文。 */
export function clipCode(raw: unknown) {
  return String(raw || "")
    .replace(/[^0-9A-Za-z_-]/g, "")
    .slice(0, CODE_MAX);
}

export function goodsLabel(names: string[]) {
  const list = names.map((name) => String(name || "").trim()).filter(Boolean);
  if (!list.length) return "到店商品";
  if (list.length === 1) return clipThing(list[0], "到店商品");
  const joined = list.join("、");
  if (Array.from(joined).length <= THING_MAX) return joined;
  const head = Array.from(list[0]).slice(0, THING_MAX - 1).join("");
  return clipThing(`${head}等`, "到店商品");
}

export function packTip(hours?: string) {
  const span = String(hours || "").replace(/\s+/g, "").trim();
  const withHours = span ? `请于${span}到店取货` : "";
  if (withHours && Array.from(withHours).length <= THING_MAX) return withHours;
  return "商品已备好，请到店取货";
}

export function buildPackSubscribeData(input: {
  goodsNames: string[];
  pickupCode: unknown;
  place: unknown;
  orderNo: unknown;
  hours?: string;
}) {
  const pickupCode = clipCode(input.pickupCode);
  const orderNo = clipCode(input.orderNo);
  if (!pickupCode || !orderNo) return null;
  return {
    thing4: { value: goodsLabel(input.goodsNames) },
    character_string12: { value: pickupCode },
    thing5: { value: clipThing(input.place, "到店自提") },
    character_string11: { value: orderNo },
    thing8: { value: packTip(input.hours) },
  };
}
