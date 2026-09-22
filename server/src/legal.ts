export type LegalShop = {
  shop_name?: string;
  phone?: string;
  wechat_id?: string;
  pickup_address?: string;
};

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDoc = {
  title: string;
  updatedAt: string;
  shopName: string;
  contact: string;
  sections: LegalSection[];
};

export const LEGAL_UPDATED_AT = "2026-09-22";

function text(v: unknown) {
  return String(v || "").trim();
}

export function shopContactLine(shop: LegalShop = {}) {
  const name = text(shop.shop_name) || "本店";
  const bits = [
    text(shop.phone) ? `电话 ${text(shop.phone)}` : "",
    text(shop.wechat_id) ? `微信 ${text(shop.wechat_id)}` : "",
    text(shop.pickup_address) ? `自提地址 ${text(shop.pickup_address)}` : "",
  ].filter(Boolean);
  if (!bits.length) return `${name}（联系电话和微信号以小程序「我的」页展示为准）`;
  return `${name}（${bits.join("；")}）`;
}

export function buildLegalDoc(shop: LegalShop = {}): LegalDoc {
  const name = text(shop.shop_name) || "本店";
  const contact = shopContactLine(shop);
  return {
    title: `${name}隐私政策与购物说明`,
    updatedAt: LEGAL_UPDATED_AT,
    shopName: name,
    contact,
    sections: [
      {
        heading: "适用范围",
        paragraphs: [
          `本页说明 ${name} 如何处理你在本小程序中的个人信息，以及下单、履约和责任边界。登录前勾选同意，表示你同意按本页处理完成登录和下单所必需的信息。`,
          "本小程序是这家店铺向顾客卖货的工具，不是向其他商家开放入驻的电商平台。商品、价格、库存、运费和促销由该店铺自行配置并负责。",
        ],
      },
      {
        heading: "我们是谁",
        paragraphs: [
          `个人信息处理者是经营这家店的店铺：${contact}。`,
          "软件为该店铺提供浏览、下单、支付和订单管理能力，不单独向你销售商品，也不把你的个人信息出售给其他商家。",
        ],
      },
      {
        heading: "收集的信息及用途",
        paragraphs: [
          "微信标识（openid，以及微信返回的 unionid）：用来识别是不是同一个顾客，并把订单、购物车、优惠券和积分记到你的账号上。",
          "昵称和头像：用于在「我的」页展示你的账号。头像由你主动选择后上传。",
          "手机号：用于订单联系和售后。只有你主动填写，或使用微信手机号授权后，才会保存。",
          "收货地址：包括联系人、手机号、省市区和详细地址，用于配送或核对自提联系人。你可以随时修改或删除。",
          "订单、购物车、优惠券、积分和拼团记录：用于完成交易、售后和店铺配置的促销。",
          "订阅消息选择：仅在你同意接收备货通知时记录。拒绝订阅不影响浏览和下单。",
        ],
      },
      {
        heading: "位置信息",
        paragraphs: [
          "只有你在新增或编辑地址时主动授权，才会读取当前位置。位置只用来生成可修改的地址草稿，不会在后台持续定位。",
          "在线定位开启时，经纬度会发给地图服务商做逆地理编码，用来得到省市区和街道。这一步不附带你的手机号、openid 或订单。",
          "店铺可以设置每月在线定位次数。次数用完，或你拒绝授权时，改为由你手动填写地址，不影响下单。",
        ],
      },
      {
        heading: "行为分析",
        paragraphs: [
          "为改进货架和经营，我们会记录匿名设备标识、页面浏览、商品曝光和点击。这些分析事件不保存手机号、微信 openid 和昵称。",
          "管理端默认只看汇总和商品级数据，不提供某个顾客的浏览轨迹。分析数据不出售，也不用于与本店无关的广告。",
          "退出登录后，本机的匿名统计标识仍会保留，其中不含账号、手机号和地址。",
        ],
      },
      {
        heading: "共享与委托处理",
        paragraphs: [
          "微信：用于登录、手机号组件、支付和你同意的订阅消息。支付结果以微信支付为准。",
          "地图服务商：仅在你使用在线定位时接收经纬度，用于生成地址草稿。",
          "除上述完成交易所必需的处理，以及法律法规要求的情形外，不向第三方提供你的个人信息。",
        ],
      },
      {
        heading: "保存与退出登录",
        paragraphs: [
          "信息保存在店铺的服务端，保存期限以实现本页所述目的所必需的时间为限。订单和支付记录会在履行交易、售后和依法需要留存的期限内继续保存。",
          "你在「我的」中退出登录后，本机不再保持登录状态，下次需要重新授权才能下单。退出不会删除店铺已保存的订单、地址、优惠券和积分，再次登录后可以继续查看。",
          "你可以在小程序里修改地址和昵称。如需更正或删除手机号等个人信息，请通过本页的店铺联系方式提出。依法应当保留的交易记录，不因删除请求而立即销毁。",
        ],
      },
      {
        heading: "未成年人",
        paragraphs: [
          "若你未满 18 周岁，请在监护人同意和指导下使用本小程序，并由监护人完成支付。",
        ],
      },
      {
        heading: "法律边界",
        paragraphs: [
          "商品页面上的价格、库存和活动是要约邀请。买卖关系在你提交订单且支付成功后，于你和店铺之间成立。成交内容以提交时服务端确认的商品、数量、价格、运费和优惠为准。",
          "库存同时被他人买走时，提交可能失败或金额发生变化，以结算页和订单详情为准。",
          "自提地址、营业时间、是否配送、运费和满额免运费，以店铺当前配置为准。配送由店铺自行完成，不提供地图轨迹，页面上的时间不是送达承诺。",
          "待付款订单可以取消；超时未支付会关闭订单并释放库存。已支付且仍处于待备货或拼团未完成时，你可以取消。系统会退回本单使用的积分和优惠券，并把支付记录标为退款。款项是否退回，以店铺与微信支付的实际处理为准。已备货、配送中或已完成的订单，不能在小程序里单方取消，请联系店主。",
          "积分、优惠券、拼团和秒杀是店铺促销。优惠券须满足页面标明的有效期和使用门槛，积分不能兑换成现金。活动可以结束，已经按当时规则生成的订单不因此被单方改价。",
          "食品、生鲜和其他商品的品质、保质期与食用安全由店铺负责。商品介绍不是医疗、保健或功效承诺。",
        ],
      },
      {
        heading: "免责声明",
        paragraphs: [
          "在法律允许的范围内，因网络故障、微信平台、支付渠道、地图服务或不可抗力导致的短时无法下单或通知延迟，店铺按实际影响处理，不承诺赔偿间接损失或预期利润。",
          "因你填写的手机号或地址不真实、无人收货，或超出店铺配送范围仍要求配送，导致无法履约的，由你与店铺协商解决。",
          "商品图片和文字由店铺上传。店铺应保证内容合法、真实，不侵犯他人权利。软件不对店铺上传的内容另行担保。",
          "本页不影响法律规定不能免除或限制的责任，包括人身损害，以及因故意或重大过失造成的财产损失。你作为消费者依法享有的权利，不因本页而减损。",
          "因在本店购物产生的争议，请先通过本页列出的店铺联系方式协商。协商不成的，向有管辖权的人民法院起诉。本页适用中华人民共和国法律。",
        ],
      },
      {
        heading: "更新",
        paragraphs: [
          `本页更新日期为 ${LEGAL_UPDATED_AT}。变更后的文本仍发布在本页。涉及处理目的或店铺联系方式的变更，以本页最新内容为准。`,
        ],
      },
    ],
  };
}

function esc(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderLegalHtml(doc: LegalDoc) {
  const sections = doc.sections
    .map((section) => {
      const body = section.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
      return `<h2>${esc(section.heading)}</h2>${body}`;
    })
    .join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(
    doc.title
  )}</title></head><body><h1>${esc(doc.title)}</h1><p>更新日期 ${esc(doc.updatedAt)}</p>${sections}</body></html>`;
}
