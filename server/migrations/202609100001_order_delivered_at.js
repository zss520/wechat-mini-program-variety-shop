/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn("orders", "delivered_at");
  if (!has) {
    await knex.schema.alterTable("orders", (t) => {
      t.datetime("delivered_at").nullable();
    });
  }
  await knex.raw(`
    UPDATE orders o
    INNER JOIN (
      SELECT order_id, MIN(created_at) AS started_at
      FROM order_logs
      WHERE to_status = 'DELIVERING'
      GROUP BY order_id
    ) l ON l.order_id = o.id
    SET o.delivered_at = l.started_at
    WHERE o.delivered_at IS NULL
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  const has = await knex.schema.hasColumn("orders", "delivered_at");
  if (has) {
    await knex.schema.alterTable("orders", (t) => {
      t.dropColumn("delivered_at");
    });
  }
};
