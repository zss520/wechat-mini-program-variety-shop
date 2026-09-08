/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable("users", (t) => {
    t.integer("points_balance").notNullable().defaultTo(0);
  });

  await knex.schema.alterTable("goods", (t) => {
    t.integer("special_price_cent").nullable();
    t.datetime("special_start").nullable();
    t.datetime("special_end").nullable();
  });

  await knex.schema.alterTable("orders", (t) => {
    t.bigInteger("user_coupon_id").unsigned().nullable();
    t.integer("coupon_discount_cent").notNullable().defaultTo(0);
    t.integer("points_used").notNullable().defaultTo(0);
    t.integer("points_discount_cent").notNullable().defaultTo(0);
    t.string("activity_type", 16).notNullable().defaultTo("NORMAL");
    t.bigInteger("activity_id").unsigned().nullable();
    t.bigInteger("team_id").unsigned().nullable();
    t.index(["activity_type", "activity_id"]);
    t.index(["team_id"]);
  });

  await knex.schema.createTable("coupons", (t) => {
    t.bigIncrements("id");
    t.string("name", 40).notNullable();
    t.string("type", 16).notNullable();
    t.integer("min_amount_cent").notNullable().defaultTo(0);
    t.integer("reduce_cent").notNullable().defaultTo(0);
    t.integer("discount_bp").notNullable().defaultTo(10000);
    t.integer("discount_cap_cent").nullable();
    t.integer("per_user_limit").notNullable().defaultTo(1);
    t.integer("total_limit").nullable();
    t.integer("claimed_count").notNullable().defaultTo(0);
    t.datetime("start_at").notNullable();
    t.datetime("end_at").notNullable();
    t.tinyint("enabled").notNullable().defaultTo(1);
    t.datetime("deleted_at").nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("user_coupons", (t) => {
    t.bigIncrements("id");
    t.bigInteger("user_id").unsigned().notNullable();
    t.bigInteger("coupon_id").unsigned().notNullable();
    t.string("status", 16).notNullable().defaultTo("UNUSED");
    t.datetime("claimed_at").notNullable();
    t.datetime("used_at").nullable();
    t.bigInteger("order_id").unsigned().nullable();
    t.timestamps(true, true);
    t.index(["user_id", "status"]);
    t.index(["coupon_id", "user_id"]);
  });

  await knex.schema.createTable("points_ledger", (t) => {
    t.bigIncrements("id");
    t.bigInteger("user_id").unsigned().notNullable();
    t.integer("delta").notNullable();
    t.integer("balance_after").notNullable();
    t.string("reason", 32).notNullable();
    t.bigInteger("order_id").unsigned().nullable();
    t.string("note", 80).nullable();
    t.timestamps(true, true);
    t.index(["user_id", "id"]);
  });

  await knex.schema.createTable("group_buy_activities", (t) => {
    t.bigIncrements("id");
    t.bigInteger("goods_id").unsigned().notNullable();
    t.string("title", 40).notNullable();
    t.integer("required_count").notNullable().defaultTo(2);
    t.integer("group_price_cent").notNullable();
    t.integer("expire_hours").notNullable().defaultTo(24);
    t.datetime("start_at").notNullable();
    t.datetime("end_at").notNullable();
    t.tinyint("enabled").notNullable().defaultTo(1);
    t.datetime("deleted_at").nullable();
    t.timestamps(true, true);
    t.index(["goods_id", "enabled"]);
  });

  await knex.schema.createTable("group_buy_teams", (t) => {
    t.bigIncrements("id");
    t.bigInteger("activity_id").unsigned().notNullable();
    t.bigInteger("leader_user_id").unsigned().notNullable();
    t.string("status", 16).notNullable().defaultTo("OPEN");
    t.datetime("expire_at").notNullable();
    t.datetime("success_at").nullable();
    t.timestamps(true, true);
    t.index(["activity_id", "status"]);
  });

  await knex.schema.createTable("group_buy_members", (t) => {
    t.bigIncrements("id");
    t.bigInteger("team_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.bigInteger("order_id").unsigned().notNullable();
    t.datetime("joined_at").notNullable();
    t.timestamps(true, true);
    t.unique(["team_id", "user_id"]);
    t.index(["order_id"]);
  });

  await knex.schema.createTable("seckill_activities", (t) => {
    t.bigIncrements("id");
    t.bigInteger("goods_id").unsigned().notNullable();
    t.string("title", 40).notNullable();
    t.integer("seckill_price_cent").notNullable();
    t.integer("seckill_stock").notNullable();
    t.integer("per_user_limit").notNullable().defaultTo(1);
    t.datetime("start_at").notNullable();
    t.datetime("end_at").notNullable();
    t.tinyint("enabled").notNullable().defaultTo(1);
    t.datetime("deleted_at").nullable();
    t.timestamps(true, true);
    t.index(["goods_id", "enabled"]);
  });

  await knex.schema.createTable("user_subscribes", (t) => {
    t.bigIncrements("id");
    t.bigInteger("user_id").unsigned().notNullable();
    t.string("scene", 32).notNullable();
    t.tinyint("accepted").notNullable().defaultTo(0);
    t.string("template_id", 64).nullable();
    t.timestamps(true, true);
    t.unique(["user_id", "scene"]);
  });

  await knex.schema.createTable("notify_logs", (t) => {
    t.bigIncrements("id");
    t.bigInteger("user_id").unsigned().notNullable();
    t.string("scene", 32).notNullable();
    t.bigInteger("order_id").unsigned().nullable();
    t.string("title", 80).notNullable();
    t.string("body", 200).nullable();
    t.string("status", 16).notNullable();
    t.string("channel", 16).notNullable().defaultTo("SUBSCRIBE");
    t.timestamps(true, true);
    t.index(["user_id", "id"]);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("notify_logs");
  await knex.schema.dropTableIfExists("user_subscribes");
  await knex.schema.dropTableIfExists("seckill_activities");
  await knex.schema.dropTableIfExists("group_buy_members");
  await knex.schema.dropTableIfExists("group_buy_teams");
  await knex.schema.dropTableIfExists("group_buy_activities");
  await knex.schema.dropTableIfExists("points_ledger");
  await knex.schema.dropTableIfExists("user_coupons");
  await knex.schema.dropTableIfExists("coupons");
  await knex.schema.alterTable("orders", (t) => {
    t.dropIndex(["activity_type", "activity_id"]);
    t.dropIndex(["team_id"]);
    t.dropColumn("user_coupon_id");
    t.dropColumn("coupon_discount_cent");
    t.dropColumn("points_used");
    t.dropColumn("points_discount_cent");
    t.dropColumn("activity_type");
    t.dropColumn("activity_id");
    t.dropColumn("team_id");
  });
  await knex.schema.alterTable("goods", (t) => {
    t.dropColumn("special_price_cent");
    t.dropColumn("special_start");
    t.dropColumn("special_end");
  });
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("points_balance");
  });
};
