const bcrypt = require("bcryptjs");

/** @param {import('knex').Knex} knex */
exports.seed = async function seed(knex) {
  const username = process.env.ADMIN_SEED_USERNAME || "admin";
  const password = process.env.ADMIN_SEED_PASSWORD || "admin123";
  const name = process.env.ADMIN_SEED_NAME || "店主";
  const exists = await knex("admin_users").where({ username }).first();
  if (!exists) {
    await knex("admin_users").insert({
      username,
      password_hash: bcrypt.hashSync(password, 10),
      display_name: name,
      status: 1,
    });
  }

  const settings = {
    shop_name: "社区杂货铺",
    logo_url: "",
    intro: "邻里便利，线上下单，到店自提",
    phone: "13800000000",
    wechat_id: "variety-shop",
    pickup_address: "小区东门杂货铺",
    business_hours: "07:00-22:00",
    delivery_enabled: "true",
    freight_cent: "300",
    free_freight_over_cent: "3000",
    pay_timeout_minutes: "15",
    pause_order: "false",
    low_stock_threshold: "5",
    primary_color: "#C2410C",
  };
  for (const [skey, svalue] of Object.entries(settings)) {
    const row = await knex("shop_settings").where({ skey }).first();
    if (!row) await knex("shop_settings").insert({ skey, svalue });
  }

  const slot = await knex("recommend_slots").where({ slot_id: "home_recommend" }).first();
  if (!slot) {
    await knex("recommend_slots").insert({
      slot_id: "home_recommend",
      title: "本店推荐",
      capacity: 8,
      strategy: "PIN_THEN_HEAT",
      enabled: 1,
    });
  }

  const covers = [
    "/static/placeholders/p1.png",
    "/static/placeholders/p2.png",
    "/static/placeholders/p3.png",
    "/static/placeholders/p4.png",
    "/static/placeholders/p5.png",
    "/static/placeholders/p6.png",
    "/static/placeholders/p7.png",
    "/static/placeholders/p8.png",
  ];
  const missingCover = await knex("goods").where(function () {
    this.whereNull("cover_url").orWhere("cover_url", "");
  });
  for (let i = 0; i < missingCover.length; i++) {
    await knex("goods").where({ id: missingCover[i].id }).update({ cover_url: covers[i % covers.length] });
  }

  const bannerCount = await knex("banners").count({ c: "*" }).first();
  if (!Number(bannerCount.c)) {
    await knex("banners").insert({
      image_url: "/static/placeholders/p1.png",
      title: "邻里好货",
      link_type: "NONE",
      sort: 10,
      enabled: 1,
    });
  }

  if ((await knex("categories").count({ c: "*" }).first()).c > 0) return;

  const catIds = await knex("categories").insert([
    { name: "粮油调味", sort: 100, enabled: 1 },
    { name: "休闲零食", sort: 90, enabled: 1 },
    { name: "日用百货", sort: 80, enabled: 1 },
    { name: "酒水饮料", sort: 70, enabled: 1 },
  ]);
  // mysql2 insert with multiple rows may return [firstId]
  const firstId = Array.isArray(catIds) ? catIds[0] : catIds;
  const cats = await knex("categories").orderBy("id", "asc");

  const goods = [
    { category_id: cats[0].id, name: "五常大米 5kg", subtitle: "东北香米", price_cent: 3290, origin_price_cent: 3990, unit: "袋", stock: 40, sold_count: 12, on_sale: 1, sort: 100, detail: "真空包装，煮粥香软。", cover_url: "/static/placeholders/p1.png" },
    { category_id: cats[0].id, name: "鲁花花生油 900ml", subtitle: "物理压榨", price_cent: 2590, unit: "瓶", stock: 25, sold_count: 8, on_sale: 1, sort: 90, detail: "日常炒菜用油。", cover_url: "/static/placeholders/p2.png" },
    { category_id: cats[1].id, name: "每日坚果 30包", subtitle: "混合坚果", price_cent: 3990, origin_price_cent: 4590, unit: "盒", stock: 18, sold_count: 20, on_sale: 1, sort: 100, detail: "办公室零食。", cover_url: "/static/placeholders/p3.png" },
    { category_id: cats[1].id, name: "苏打饼干 400g", subtitle: "无蔗糖", price_cent: 890, unit: "包", stock: 50, sold_count: 30, on_sale: 1, sort: 80, cover_url: "/static/placeholders/p4.png" },
    { category_id: cats[2].id, name: "抽纸 3层 10包", subtitle: "家庭装", price_cent: 1290, unit: "提", stock: 35, sold_count: 16, on_sale: 1, sort: 90, cover_url: "/static/placeholders/p5.png" },
    { category_id: cats[2].id, name: "洗衣液 2kg", subtitle: "留香", price_cent: 1990, unit: "瓶", stock: 22, sold_count: 9, on_sale: 1, sort: 70, cover_url: "/static/placeholders/p6.png" },
    { category_id: cats[3].id, name: "矿泉水 550ml*12", subtitle: "整箱", price_cent: 1590, unit: "箱", stock: 40, sold_count: 22, on_sale: 1, sort: 100, cover_url: "/static/placeholders/p7.png" },
    { category_id: cats[3].id, name: "鲜榨豆浆 300ml", subtitle: "冷藏", price_cent: 600, unit: "瓶", stock: 0, sold_count: 5, on_sale: 1, sort: 60, detail: "售罄示例。", cover_url: "/static/placeholders/p8.png" },
  ];
  await knex("goods").insert(goods);

  const water = await knex("goods").where({ name: "矿泉水 550ml*12" }).first();
  const rice = await knex("goods").where({ name: "五常大米 5kg" }).first();
  if (water && rice) {
    const pinCount = await knex("recommend_slot_items").where({ slot_id: "home_recommend" }).count({ c: "*" }).first();
    if (!Number(pinCount.c)) {
      await knex("recommend_slot_items").insert([
        { slot_id: "home_recommend", goods_id: rice.id, pin_order: 1 },
        { slot_id: "home_recommend", goods_id: water.id, pin_order: 2 },
      ]);
    }
  }
};
