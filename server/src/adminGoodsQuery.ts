import type { Knex } from "knex";

export function applyAdminGoodsFilters(b: Knex.QueryBuilder, query: Record<string, unknown>, now = new Date()) {
  const keyword = String(query.keyword || "").trim();
  if (keyword) b.where("goods.name", "like", `%${keyword}%`);
  if (query.categoryId) b.where("goods.category_id", Number(query.categoryId));
  if (query.onSale === "1" || query.onSale === "0") b.where("goods.on_sale", Number(query.onSale));
  if (query.onSpecial === "1") {
    b.where("goods.special_price_cent", ">", 0)
      .where("goods.special_start", "<=", now)
      .where("goods.special_end", ">=", now);
  }
}
