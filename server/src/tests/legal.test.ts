import { buildLegalDoc, renderLegalHtml, shopContactLine } from "../legal";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const doc = buildLegalDoc({
    shop_name: "巷口杂货",
    phone: "13800138000",
    wechat_id: "shop_wx",
    pickup_address: "社区1号",
  });
  const text = doc.sections.map((s) => `${s.heading}\n${s.paragraphs.join("\n")}`).join("\n");
  assert(doc.title.indexOf("巷口杂货") >= 0, "title uses shop name");
  assert(shopContactLine({ shop_name: "巷口杂货", phone: "13800138000" }).indexOf("13800138000") >= 0, "contact phone");
  assert(text.indexOf("个人信息处理者") >= 0, "privacy controller");
  assert(text.indexOf("不保存手机号、微信 openid 和昵称") >= 0, "analytics boundary");
  assert(text.indexOf("不把你的个人信息出售") >= 0, "no sale of personal data");
  assert(text.indexOf("退出登录") >= 0 && text.indexOf("不会删除店铺已保存的订单") >= 0, "logout keeps orders");
  assert(text.indexOf("法律边界") >= 0, "legal boundary section");
  assert(text.indexOf("免责声明") >= 0, "disclaimer section");
  assert(text.indexOf("不能免除或限制的责任") >= 0, "mandatory liability stays");
  assert(text.indexOf("已备货、配送中或已完成") >= 0, "cancel boundary");
  assert(text.indexOf("每月在线定位次数") >= 0, "location quota boundary");

  const html = renderLegalHtml(
    buildLegalDoc({ shop_name: `<script>alert(1)</script>` })
  );
  assert(html.indexOf("<script>alert") < 0, "shop name is escaped");
  assert(html.indexOf("&lt;script&gt;") >= 0, "escaped script text remains");
  assert(html.indexOf("免责声明") >= 0, "html has disclaimer");
  console.log("legal text tests passed");
}

run();
