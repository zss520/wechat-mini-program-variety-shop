/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable("goods", (t) => {
    t.string("thumb_url", 512).nullable().after("cover_url");
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.alterTable("goods", (t) => {
    t.dropColumn("thumb_url");
  });
};
