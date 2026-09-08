/** @param {import('knex').Knex} knex */
exports.seed = async function seed(knex) {
  const extraSettings = {
    points_enabled: "true",
    points_earn_per_yuan: "1",
    points_redeem_rate: "100",
  };
  for (const [skey, svalue] of Object.entries(extraSettings)) {
    const row = await knex("shop_settings").where({ skey }).first();
    if (!row) await knex("shop_settings").insert({ skey, svalue });
  }

  const rice = await knex("goods").where({ name: "五常大米 5kg" }).first();
  const nuts = await knex("goods").where({ name: "每日坚果 30包" }).first();
  const water = await knex("goods").where({ name: "矿泉水 550ml*12" }).first();
  const biscuit = await knex("goods").where({ name: "苏打饼干 400g" }).first();
  if (rice) {
    await knex("goods").where({ id: rice.id }).update({
      special_price_cent: 2890,
      special_start: knex.raw("DATE_SUB(NOW(), INTERVAL 1 DAY)"),
      special_end: knex.raw("DATE_ADD(NOW(), INTERVAL 14 DAY)"),
    });
  }
  if (biscuit) {
    await knex("goods").where({ id: biscuit.id }).update({
      special_price_cent: 690,
      special_start: knex.raw("DATE_SUB(NOW(), INTERVAL 1 DAY)"),
      special_end: knex.raw("DATE_ADD(NOW(), INTERVAL 7 DAY)"),
    });
  }

  const couponCount = await knex("coupons").count({ c: "*" }).first();
  if (!Number(couponCount.c)) {
    await knex("coupons").insert([
      {
        name: "满30减5",
        type: "FULL_REDUCE",
        min_amount_cent: 3000,
        reduce_cent: 500,
        discount_bp: 10000,
        per_user_limit: 2,
        total_limit: 200,
        start_at: knex.raw("DATE_SUB(NOW(), INTERVAL 1 DAY)"),
        end_at: knex.raw("DATE_ADD(NOW(), INTERVAL 30 DAY)"),
        enabled: 1,
      },
      {
        name: "正价9折",
        type: "DISCOUNT",
        min_amount_cent: 0,
        reduce_cent: 0,
        discount_bp: 9000,
        discount_cap_cent: 800,
        per_user_limit: 1,
        total_limit: 100,
        start_at: knex.raw("DATE_SUB(NOW(), INTERVAL 1 DAY)"),
        end_at: knex.raw("DATE_ADD(NOW(), INTERVAL 30 DAY)"),
        enabled: 1,
      },
    ]);
  }

  if (nuts && !(await knex("group_buy_activities").first())) {
    await knex("group_buy_activities").insert({
      goods_id: nuts.id,
      title: "坚果 2 人团",
      required_count: 2,
      group_price_cent: 3290,
      expire_hours: 24,
      start_at: knex.raw("DATE_SUB(NOW(), INTERVAL 1 DAY)"),
      end_at: knex.raw("DATE_ADD(NOW(), INTERVAL 21 DAY)"),
      enabled: 1,
    });
  }
  if (water && !(await knex("seckill_activities").first())) {
    await knex("seckill_activities").insert({
      goods_id: water.id,
      title: "矿泉水整箱秒杀",
      seckill_price_cent: 1290,
      seckill_stock: 20,
      per_user_limit: 1,
      start_at: knex.raw("DATE_SUB(NOW(), INTERVAL 1 DAY)"),
      end_at: knex.raw("DATE_ADD(NOW(), INTERVAL 10 DAY)"),
      enabled: 1,
    });
  }
};
