import { applyCartSelection, nextCheckedIds } from "../../../miniprogram/utils/cartSelect";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const list = [
    { id: 11, qty: 1, priceCent: 3290, invalid: false },
    { id: 12, qty: 1, priceCent: 890, invalid: false },
    { id: 13, qty: 1, priceCent: 1290, invalid: false },
    { id: 14, qty: 1, priceCent: 1990, invalid: false },
  ];

  const all = applyCartSelection(list, [11, 12, 13, 14]);
  assert(all.allChecked === true, "all selected => allChecked");
  assert(all.total === 7460, "sum of four items");
  assert(all.list.every((x) => x.selected === true), "each row selected flag");

  const none = applyCartSelection(list, []);
  assert(none.allChecked === false && none.total === 0 && none.list.every((x) => x.selected === false), "empty selection");

  const mixed = applyCartSelection(list, ["11", 13]);
  assert(mixed.checked.join(",") === "11,13", "string ids coerced");
  assert(mixed.list[0].selected && !mixed.list[1].selected && mixed.list[2].selected, "mixed selected flags");

  assert(nextCheckedIds([11, 12], "12", false).join(",") === "11", "uncheck by detail.checked");
  assert(nextCheckedIds([11], 12, true).join(",") === "11,12", "check by detail.checked");
  assert(nextCheckedIds(["11"], "11").join(",") === "", "toggle off with string id");

  console.log("cart select tests passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
