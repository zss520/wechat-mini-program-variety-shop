/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable("announcements", (t) => {
    t.bigIncrements("id");
    t.string("title", 40).notNullable();
    t.string("content", 200).notNullable();
    t.string("link_type", 16).notNullable().defaultTo("NONE");
    t.string("link_value", 128).nullable();
    t.integer("sort").notNullable().defaultTo(0);
    t.tinyint("enabled").notNullable().defaultTo(1);
    t.timestamps(true, true);
    t.index(["enabled", "sort"]);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("announcements");
};
