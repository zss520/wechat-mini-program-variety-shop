/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable("admin_users", (t) => {
    t.bigIncrements("id");
    t.string("username", 32).notNullable().unique();
    t.string("password_hash", 100).notNullable();
    t.string("display_name", 32).notNullable();
    t.tinyint("status").notNullable().defaultTo(1);
    t.timestamps(true, true);
  });

  await knex.schema.createTable("users", (t) => {
    t.bigIncrements("id");
    t.string("openid", 64).notNullable().unique();
    t.string("unionid", 64).nullable();
    t.string("nickname", 64).nullable();
    t.string("avatar_url", 512).nullable();
    t.string("phone", 20).nullable();
    t.datetime("phone_bound_at").nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("shop_settings", (t) => {
    t.string("skey", 64).primary();
    t.text("svalue").nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("categories", (t) => {
    t.bigIncrements("id");
    t.string("name", 20).notNullable();
    t.integer("sort").notNullable().defaultTo(0);
    t.string("icon_url", 512).nullable();
    t.tinyint("enabled").notNullable().defaultTo(1);
    t.datetime("deleted_at").nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("goods", (t) => {
    t.bigIncrements("id");
    t.bigInteger("category_id").unsigned().notNullable();
    t.string("name", 40).notNullable();
    t.string("subtitle", 80).nullable();
    t.integer("price_cent").notNullable();
    t.integer("origin_price_cent").nullable();
    t.string("unit", 8).notNullable().defaultTo("件");
    t.integer("stock").notNullable().defaultTo(0);
    t.integer("sold_count").notNullable().defaultTo(0);
    t.string("cover_url", 512).nullable();
    t.json("images").nullable();
    t.text("detail").nullable();
    t.tinyint("on_sale").notNullable().defaultTo(1);
    t.integer("sort").notNullable().defaultTo(0);
    t.smallint("manual_weight").notNullable().defaultTo(0);
    t.smallint("heat_score").notNullable().defaultTo(0);
    t.datetime("heat_updated_at").nullable();
    t.datetime("deleted_at").nullable();
    t.timestamps(true, true);
    t.index(["on_sale", "category_id", "sort"]);
    t.index(["on_sale", "heat_score"]);
  });

  await knex.schema.createTable("cart_items", (t) => {
    t.bigIncrements("id");
    t.bigInteger("user_id").unsigned().notNullable();
    t.bigInteger("goods_id").unsigned().notNullable();
    t.integer("qty").notNullable();
    t.timestamps(true, true);
    t.unique(["user_id", "goods_id"]);
  });

  await knex.schema.createTable("addresses", (t) => {
    t.bigIncrements("id");
    t.bigInteger("user_id").unsigned().notNullable();
    t.string("contact_name", 32).notNullable();
    t.string("phone", 20).notNullable();
    t.string("province", 32).nullable();
    t.string("city", 32).nullable();
    t.string("district", 32).nullable();
    t.string("detail", 120).notNullable();
    t.tinyint("is_default").notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.index(["user_id"]);
  });

  await knex.schema.createTable("orders", (t) => {
    t.bigIncrements("id");
    t.string("order_no", 32).notNullable().unique();
    t.bigInteger("user_id").unsigned().notNullable();
    t.string("status", 20).notNullable();
    t.string("fulfill_type", 16).notNullable();
    t.integer("goods_amount_cent").notNullable();
    t.integer("freight_cent").notNullable().defaultTo(0);
    t.integer("discount_cent").notNullable().defaultTo(0);
    t.integer("pay_amount_cent").notNullable();
    t.string("remark", 80).nullable();
    t.string("pickup_code", 8).nullable();
    t.json("address_snapshot").nullable();
    t.datetime("paid_at").nullable();
    t.datetime("packed_at").nullable();
    t.datetime("completed_at").nullable();
    t.datetime("cancelled_at").nullable();
    t.string("cancel_reason", 80).nullable();
    t.string("wx_transaction_id", 64).nullable();
    t.timestamps(true, true);
    t.index(["user_id", "status"]);
    t.index(["status", "created_at"]);
  });

  await knex.schema.createTable("order_items", (t) => {
    t.bigIncrements("id");
    t.bigInteger("order_id").unsigned().notNullable();
    t.bigInteger("goods_id").unsigned().notNullable();
    t.string("name_snapshot", 40).notNullable();
    t.string("cover_snapshot", 512).nullable();
    t.string("unit_snapshot", 8).nullable();
    t.integer("price_cent").notNullable();
    t.integer("qty").notNullable();
    t.integer("amount_cent").notNullable();
    t.index(["order_id"]);
    t.index(["goods_id"]);
  });

  await knex.schema.createTable("payments", (t) => {
    t.bigIncrements("id");
    t.bigInteger("order_id").unsigned().notNullable();
    t.string("channel", 16).notNullable().defaultTo("WECHAT");
    t.string("prepay_id", 128).nullable();
    t.string("status", 16).notNullable();
    t.integer("amount_cent").notNullable();
    t.json("raw_notify").nullable();
    t.timestamps(true, true);
    t.index(["order_id"]);
  });

  await knex.schema.createTable("order_logs", (t) => {
    t.bigIncrements("id");
    t.bigInteger("order_id").unsigned().notNullable();
    t.string("from_status", 20).nullable();
    t.string("to_status", 20).notNullable();
    t.string("operator_type", 16).notNullable();
    t.bigInteger("operator_id").unsigned().nullable();
    t.string("note", 120).nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.index(["order_id"]);
  });

  await knex.schema.createTable("banners", (t) => {
    t.bigIncrements("id");
    t.string("image_url", 512).notNullable();
    t.string("title", 40).nullable();
    t.string("link_type", 16).notNullable().defaultTo("NONE");
    t.string("link_value", 128).nullable();
    t.integer("sort").notNullable().defaultTo(0);
    t.tinyint("enabled").notNullable().defaultTo(1);
    t.timestamps(true, true);
  });

  await knex.schema.createTable("analytics_events", (t) => {
    t.bigIncrements("id");
    t.string("event", 32).notNullable();
    t.datetime("ts").notNullable();
    t.datetime("received_at").notNullable();
    t.string("anonymous_id", 64).nullable();
    t.string("session_id", 64).nullable();
    t.bigInteger("user_id").unsigned().nullable();
    t.string("page", 64).nullable();
    t.integer("scene").nullable();
    t.bigInteger("goods_id").unsigned().nullable();
    t.string("slot_id", 32).nullable();
    t.integer("position").nullable();
    t.string("order_no", 32).nullable();
    t.json("payload").nullable();
    t.string("app_version", 16).nullable();
    t.index(["event", "ts"]);
    t.index(["goods_id", "event", "ts"]);
    t.index(["session_id", "ts"]);
  });

  await knex.schema.createTable("goods_stats_daily", (t) => {
    t.date("stat_date").notNullable();
    t.bigInteger("goods_id").unsigned().notNullable();
    t.integer("expose_pv").notNullable().defaultTo(0);
    t.integer("expose_uv").notNullable().defaultTo(0);
    t.integer("click_pv").notNullable().defaultTo(0);
    t.integer("click_uv").notNullable().defaultTo(0);
    t.integer("detail_uv").notNullable().defaultTo(0);
    t.integer("cart_pv").notNullable().defaultTo(0);
    t.integer("cart_uv").notNullable().defaultTo(0);
    t.integer("pay_qty").notNullable().defaultTo(0);
    t.integer("pay_uv").notNullable().defaultTo(0);
    t.integer("pay_amount_cent").notNullable().defaultTo(0);
    t.primary(["stat_date", "goods_id"]);
  });

  await knex.schema.createTable("recommend_slots", (t) => {
    t.string("slot_id", 32).primary();
    t.string("title", 40).notNullable();
    t.integer("capacity").notNullable().defaultTo(8);
    t.string("strategy", 32).notNullable().defaultTo("PIN_THEN_HEAT");
    t.tinyint("enabled").notNullable().defaultTo(1);
    t.timestamps(true, true);
  });

  await knex.schema.createTable("recommend_slot_items", (t) => {
    t.bigIncrements("id");
    t.string("slot_id", 32).notNullable();
    t.bigInteger("goods_id").unsigned().notNullable();
    t.integer("pin_order").notNullable().defaultTo(0);
    t.unique(["slot_id", "goods_id"]);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  const tables = [
    "recommend_slot_items",
    "recommend_slots",
    "goods_stats_daily",
    "analytics_events",
    "banners",
    "order_logs",
    "payments",
    "order_items",
    "orders",
    "addresses",
    "cart_items",
    "goods",
    "categories",
    "shop_settings",
    "users",
    "admin_users",
  ];
  for (const t of tables) await knex.schema.dropTableIfExists(t);
};
