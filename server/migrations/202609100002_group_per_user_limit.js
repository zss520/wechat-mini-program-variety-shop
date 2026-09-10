/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn("group_buy_activities", "per_user_limit");
  if (!has) {
    await knex.schema.alterTable("group_buy_activities", (t) => {
      t.integer("per_user_limit").notNullable().defaultTo(1);
    });
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  const has = await knex.schema.hasColumn("group_buy_activities", "per_user_limit");
  if (has) {
    await knex.schema.alterTable("group_buy_activities", (t) => {
      t.dropColumn("per_user_limit");
    });
  }
};
