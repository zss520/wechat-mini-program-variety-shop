import { draftFromParts, formatAddressLine, splitCnAddress } from "../../../miniprogram/utils/addressLocate";
import { mapBigDataCloud, mapTencentGeocoder } from "../geo";

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

  const mapped = mapTencentGeocoder({
    status: 0,
    result: {
      address: "广东省深圳市南山区科苑路15号",
      formatted_addresses: { recommend: "南山区科苑路15号" },
      address_component: {
        province: "广东省",
        city: "深圳市",
        district: "南山区",
        street: "科苑路",
        street_number: "15号",
      },
    },
  });
  assert(mapped && mapped.available && mapped.street === "科苑路" && mapped.recommend === "南山区科苑路15号", "tencent mapper");
  assert(mapTencentGeocoder({ status: 310, message: "key error" }) === null, "failed geocoder");

  const coarse = draftFromParts({
    province: "北京市",
    city: "北京市",
    district: "东城区",
    street: "",
    streetNumber: "",
  });
  assert(coarse.province === "北京市" && coarse.district === "东城区" && coarse.detail === "", "coarse locate keeps region and leaves street empty");

  const cloud = mapBigDataCloud({
    principalSubdivision: "北京市",
    city: "北京市",
    locality: "東城區",
  });
  assert(cloud && cloud.district === "东城区" && cloud.city === "北京市", "traditional district simplified");

  console.log("address locate tests passed");
}

run();
