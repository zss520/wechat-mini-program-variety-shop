import { buildPackSubscribeData, clipCode, clipThing, goodsLabel, packTip } from "../subscribeMessage";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const names = goodsLabel(["土鸡蛋", "青菜"]);
  assert(names === "土鸡蛋、青菜", "short goods join");
  const first = "一二三四五六七八九十一二三四五六七八九十";
  const long = goodsLabel([first, "青菜"]);
  assert(Array.from(first).length === 20, "fixture is 20 chars");
  assert(long === `${Array.from(first).slice(0, 19).join("")}等`, "long goods truncated");
  assert(clipThing("  小区 东门 ", "到店自提") === "小区东门", "thing strips spaces");
  assert(Array.from(clipThing("一二三四五六七八九十一二三四五六七八九十多余", "到店自提")).length === 20, "thing max 20");
  assert(clipCode("提货码808") === "808", "code keeps digits");
  assert(packTip("08:00-21:00") === "请于08:00-21:00到店取货", "tip uses hours");
  assert(packTip("这是一段长得超过微信温馨提示上限的营业时间说明") === "商品已备好，请到店取货", "long hours use default tip");

  const data = buildPackSubscribeData({
    goodsNames: ["团购鸡蛋"],
    pickupCode: "808",
    place: "xx小区底商xx店",
    orderNo: "E12121212",
    hours: "08:00-21:00",
  });
  assert(data && data.thing4.value === "团购鸡蛋", "goods field");
  assert(data && data.character_string12.value === "808", "pickup code field");
  assert(data && data.thing5.value === "xx小区底商xx店", "place field");
  assert(data && data.character_string11.value === "E12121212", "order no field");
  assert(data && data.thing8.value === "请于08:00-21:00到店取货", "tip field");
  assert(buildPackSubscribeData({ goodsNames: ["鸡蛋"], pickupCode: "", place: "店", orderNo: "1" }) === null, "missing code skips");
  console.log("subscribe message tests passed");
}

run();
