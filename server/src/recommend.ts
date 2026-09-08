import { db } from "./db";
import { publicUrl } from "./config";
import { salePriceOf } from "./pricing";

export async function fillRecommend(slotId = "home_recommend") {
  const slot = await db("recommend_slots").where({ slot_id: slotId }).first();
  if (!slot || !slot.enabled) return { slot: null, list: [] as unknown[] };
  const capacity = Number(slot.capacity || 8);
  const strategy: string = slot.strategy || "PIN_THEN_HEAT";

  const pins = await db("recommend_slot_items")
    .where({ slot_id: slotId })
    .orderBy("pin_order", "asc")
    .select("goods_id", "pin_order");

  const onSale = () =>
    db("goods").where({ on_sale: 1 }).whereNull("deleted_at").where("stock", ">", 0);

  const list: Record<string, unknown>[] = [];
  const used = new Set<number>();

  if (strategy !== "HEAT_ONLY") {
    for (const p of pins) {
      if (list.length >= capacity) break;
      const g = await db("goods").where({ id: p.goods_id, on_sale: 1 }).whereNull("deleted_at").first();
      if (!g) continue;
      if (g.stock <= 0) continue; // D7 skip sold out pins
      list.push({ ...g, pin: true, slot_id: slotId, position: list.length + 1 });
      used.add(g.id);
    }
  }

  if (strategy !== "MANUAL_ONLY" && list.length < capacity) {
    let q = onSale().whereNotIn("id", Array.from(used));
    if (strategy === "PIN_THEN_SALES") q = q.orderBy("sold_count", "desc");
    else if (strategy === "PIN_THEN_NEW") q = q.orderBy("created_at", "desc");
    else {
      q = q.orderByRaw(
        "(heat_score + manual_weight + IF(created_at >= DATE_SUB(NOW(), INTERVAL 72 HOUR), 8, 0)) DESC"
      );
    }
    const extra = await q.limit(capacity - list.length);
    for (const g of extra) {
      list.push({ ...g, pin: false, slot_id: slotId, position: list.length + 1 });
      used.add(g.id);
    }
  }

  if (list.length < capacity && strategy !== "MANUAL_ONLY") {
    const more = await db("goods")
      .where({ on_sale: 1 })
      .whereNull("deleted_at")
      .whereNotIn("id", Array.from(used))
      .orderBy("created_at", "desc")
      .limit(capacity - list.length);
    for (const g of more) list.push({ ...g, pin: false, slot_id: slotId, position: list.length + 1 });
  }

  return { slot, list };
}

export function applyGoodsSort(query: any, sort?: string) {
  const s = sort || "composite";
  if (s === "price_asc") return query.orderBy("price_cent", "asc");
  if (s === "price_desc") return query.orderBy("price_cent", "desc");
  if (s === "sales") return query.orderBy("sold_count", "desc");
  if (s === "new") return query.orderBy("created_at", "desc");
  return query
    .orderByRaw("IF(stock=0,1,0) ASC")
    .orderByRaw("(heat_score + manual_weight + IF(created_at >= DATE_SUB(NOW(), INTERVAL 72 HOUR), 8, 0)) DESC")
    .orderBy("sold_count", "desc")
    .orderBy("updated_at", "desc");
}

export function publicGoods(g: any) {
  let images: string[] = [];
  try {
    images = typeof g.images === "string" ? JSON.parse(g.images || "[]") : g.images || [];
  } catch {
    images = [];
  }
  const cover = publicUrl(g.cover_url) || publicUrl("/static/placeholders/empty.png");
  const sale = salePriceOf(g);
  return {
    id: g.id,
    categoryId: g.category_id,
    name: g.name,
    subtitle: g.subtitle,
    priceCent: sale.priceCent,
    originPriceCent: sale.originCent,
    listPriceCent: Number(g.price_cent),
    specialActive: sale.isSpecial,
    unit: g.unit,
    stock: g.stock,
    soldCount: g.sold_count,
    coverUrl: cover,
    images: (images.length ? images : [g.cover_url || "/static/placeholders/empty.png"]).map((u: string) => publicUrl(u)),
    detail: g.detail,
    onSale: g.on_sale,
    soldOut: Number(g.stock) <= 0,
    slotId: g.slot_id,
    position: g.position,
    pin: g.pin,
  };
}
