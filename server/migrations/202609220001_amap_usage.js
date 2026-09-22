/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable("amap_usage", (t) => {
    t.string("month", 7).primary();
    t.integer("call_count").notNullable().defaultTo(0);
    t.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("amap_usage");
};
