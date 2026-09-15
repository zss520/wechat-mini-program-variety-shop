/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn("user_coupons", "source");
  if (!has) {
    await knex.schema.alterTable("user_coupons", (t) => {
      t.string("source", 16).notNullable().defaultTo("CLAIM");
    });
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  const has = await knex.schema.hasColumn("user_coupons", "source");
  if (has) {
    await knex.schema.alterTable("user_coupons", (t) => {
      t.dropColumn("source");
    });
  }
};
