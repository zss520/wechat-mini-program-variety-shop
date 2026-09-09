export function cartItemId(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function applyCartSelection(list: any[], checkedIds: unknown[]) {
  const set = new Set((checkedIds || []).map(cartItemId).filter((id) => id > 0));
  const next = (list || []).map((x) => ({
    ...x,
    selected: !x.invalid && set.has(cartItemId(x.id)),
  }));
  const checked = next.filter((x) => x.selected).map((x) => cartItemId(x.id));
  const valid = next.filter((x) => !x.invalid);
  const total = next
    .filter((x) => x.selected)
    .reduce((s: number, x) => s + Number(x.priceCent || 0) * Number(x.qty || 0), 0);
  return {
    list: next,
    checked,
    total,
    allChecked: valid.length > 0 && valid.every((x) => x.selected),
  };
}

export function nextCheckedIds(
  current: unknown[],
  id: unknown,
  want?: boolean
): number[] {
  const itemId = cartItemId(id);
  const ids = (current || []).map(cartItemId).filter((x) => x > 0);
  if (!itemId) return ids;
  const has = ids.indexOf(itemId) >= 0;
  const selected = typeof want === "boolean" ? want : !has;
  if (selected) return has ? ids : ids.concat(itemId);
  return ids.filter((x) => x !== itemId);
}
