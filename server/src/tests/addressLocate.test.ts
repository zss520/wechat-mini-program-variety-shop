import { draftFromParts, formatAddressLine, splitCnAddress } from "../../../miniprogram/utils/addressLocate";
import { mapAmapRegeo } from "../geo";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const sz = splitCnAddress("广东省深圳市南山区科苑路15号", "腾讯大厦");
  assert(sz.province === "广东省" && sz.city === "深圳市" && sz.district === "南山区", "guangdong parts");
  assert(sz.detail === "科苑路15号 腾讯大厦", "street plus poi");

  const bj = splitCnAddress("北京市海淀区中关村大街1号");
  assert(bj.province === "北京市" && bj.city === "北京市" && bj.district === "海淀区", "municipality");
  assert(bj.detail === "中关村大街1号", "beijing street");
  assert(formatAddressLine(bj) === "北京市海淀区中关村大街1号", "municipality line does not repeat city");

  const gx = splitCnAddress("广西壮族自治区南宁市青秀区民族大道1号");
  assert(gx.province === "广西壮族自治区" && gx.city === "南宁市" && gx.district === "青秀区", "autonomous region");

  const fromApi = draftFromParts({
    province: "广东省",
    city: "深圳市",
    district: "南山区",
    street: "科苑路",
    streetNumber: "15号",
    recommend: "深圳市南山区科苑路15号",
  });
  assert(fromApi.detail === "科苑路15号", "street detail does not repeat city from recommend");
  assert(formatAddressLine(fromApi) === "广东省深圳市南山区科苑路15号", "full line");

  const mapped = mapAmapRegeo({
    status: "1",
    regeocode: {
      formatted_address: "广东省深圳市南山区科苑路15号",
      addressComponent: {
        province: "广东省",
        city: "深圳市",
        district: "南山区",
        township: "粤海街道",
        streetNumber: { street: "科苑路", number: "15号" },
      },
    },
  });
  assert(mapped && mapped.available && mapped.street === "科苑路" && mapped.streetNumber === "15号", "amap street");
  assert(mapped && mapped.city === "深圳市" && mapped.address === "广东省深圳市南山区科苑路15号", "amap city");
  assert(mapAmapRegeo({ status: "0", info: "INVALID_USER_KEY" }) === null, "failed geocoder");

  const coarse = draftFromParts({
    province: "北京市",
    city: "北京市",
    district: "东城区",
    street: "",
    streetNumber: "",
  });
  assert(coarse.province === "北京市" && coarse.district === "东城区" && coarse.detail === "", "coarse locate keeps region and leaves street empty");

  const muni = mapAmapRegeo({
    status: "1",
    regeocode: {
      formatted_address: "北京市东城区东华门街道",
      addressComponent: {
        province: "北京市",
        city: [],
        district: "东城区",
        township: "东华门街道",
        streetNumber: { street: [], number: [] },
      },
    },
  });
  assert(muni && muni.city === "北京市" && muni.district === "东城区" && muni.street === "东华门街道", "municipality city array falls back");
  const muniDraft = draftFromParts(muni || {});
  assert(muniDraft.detail === "东华门街道" && formatAddressLine(muniDraft) === "北京市东城区东华门街道", "municipality draft");

  console.log("address locate tests passed");
}

run();
