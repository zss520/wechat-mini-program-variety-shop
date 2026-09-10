/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const hasCover = await knex.schema.hasColumn("group_buy_activities", "cover_url");
  if (!hasCover) {
    await knex.schema.alterTable("group_buy_activities", (t) => {
      t.string("cover_url", 255).nullable();
    });
  }

  const hasGoodsTable = await knex.schema.hasTable("group_buy_activity_goods");
  if (!hasGoodsTable) {
    await knex.schema.createTable("group_buy_activity_goods", (t) => {
      t.bigIncrements("id");
      t.bigInteger("activity_id").unsigned().notNullable();
      t.bigInteger("goods_id").unsigned().notNullable();
      t.integer("group_price_cent").notNullable();
      t.integer("sort").notNullable().defaultTo(0);
      t.timestamps(true, true);
      t.unique(["activity_id", "goods_id"]);
      t.index(["goods_id"]);
    });
  }

  const existing = await knex("group_buy_activities").select("id", "goods_id", "group_price_cent");
  for (const row of existing) {
    const hit = await knex("group_buy_activity_goods")
      .where({ activity_id: row.id, goods_id: row.goods_id })
      .first();
    if (!hit) {
      await knex("group_buy_activity_goods").insert({
        activity_id: row.id,
        goods_id: row.goods_id,
        group_price_cent: row.group_price_cent,
        sort: 0,
      });
    }
  }

  const hasMemberCount = await knex.schema.hasColumn("group_buy_teams", "member_count");
  if (!hasMemberCount) {
    await knex.schema.alterTable("group_buy_teams", (t) => {
      t.integer("member_count").notNullable().defaultTo(0);
      t.integer("paid_count").notNullable().defaultTo(0);
      t.integer("required_count").notNullable().defaultTo(0);
    });
  }

  const hasProgress = await knex.schema.hasTable("group_buy_progress");
  if (!hasProgress) {
    await knex.schema.createTable("group_buy_progress", (t) => {
      t.bigIncrements("id");
      t.bigInteger("team_id").unsigned().notNullable();
      t.bigInteger("activity_id").unsigned().notNullable();
      t.string("event", 16).notNullable();
      t.bigInteger("user_id").unsigned().nullable();
      t.bigInteger("order_id").unsigned().nullable();
      t.integer("member_count").notNullable().defaultTo(0);
      t.integer("paid_count").notNullable().defaultTo(0);
      t.integer("required_count").notNullable().defaultTo(0);
      t.string("note", 80).nullable();
      t.timestamps(true, true);
      t.index(["team_id", "id"]);
      t.index(["activity_id", "id"]);
    });
  }

  const teams = await knex("group_buy_teams").select("id", "activity_id");
  for (const team of teams) {
    const act = await knex("group_buy_activities").where({ id: team.activity_id }).first();
    const memberRow = await knex("group_buy_members").where({ team_id: team.id }).count({ c: "*" }).first();
    const paidRow = await knex("orders")
      .where({ team_id: team.id })
      .whereIn("status", ["GROUPING", "PENDING_PACK", "WAIT_PICKUP", "WAIT_DELIVER", "DELIVERING", "COMPLETED"])
      .count({ c: "*" })
      .first();
    await knex("group_buy_teams")
      .where({ id: team.id })
      .update({
        member_count: Number(memberRow?.c || 0),
        paid_count: Number(paidRow?.c || 0),
        required_count: Number(act?.required_count || 0),
      });
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("group_buy_progress");
  await knex.schema.dropTableIfExists("group_buy_activity_goods");
  const hasCover = await knex.schema.hasColumn("group_buy_activities", "cover_url");
  if (hasCover) {
    await knex.schema.alterTable("group_buy_activities", (t) => {
      t.dropColumn("cover_url");
    });
  }
  const hasMemberCount = await knex.schema.hasColumn("group_buy_teams", "member_count");
  if (hasMemberCount) {
    await knex.schema.alterTable("group_buy_teams", (t) => {
      t.dropColumn("member_count");
      t.dropColumn("paid_count");
      t.dropColumn("required_count");
    });
  }
};
