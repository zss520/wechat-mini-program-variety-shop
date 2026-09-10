import { MenuItem, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import { asArray, asRecord, displayText } from "../utils/display";
import { useFeedback } from "./FeedbackProvider";

export type PickerCat = { id: number; name: string };
export type PickerGoods = { id: number; name: string; price_cent: number; category_id?: number; stock?: number };

export default function GoodsByCategoryPicker({
  cats,
  categoryId,
  goodsId,
  onCategory,
  onGoods,
}: {
  cats: PickerCat[];
  categoryId: number;
  goodsId: number;
  onCategory: (id: number) => void;
  onGoods: (g: PickerGoods | null) => void;
}) {
  const fb = useFeedback();
  const [goods, setGoods] = useState<PickerGoods[]>([]);

  useEffect(() => {
    if (!categoryId) {
      setGoods([]);
      return;
    }
    let cancelled = false;
    api
      .get("/goods", { params: { categoryId, pageSize: 100 } })
      .then((d) => {
        if (cancelled) return;
        const list = asArray<PickerGoods>(asRecord(d).list);
        setGoods(list);
        if (goodsId && !list.some((x) => Number(x.id) === Number(goodsId))) onGoods(null);
      })
      .catch((e) => fb.error(e));
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  return (
    <>
      <TextField
        required
        select
        size="small"
        label="分类"
        value={categoryId ? String(categoryId) : ""}
        onChange={(e) => {
          onCategory(Number(e.target.value) || 0);
          onGoods(null);
        }}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="">请选择分类</MenuItem>
        {cats.map((c) => (
          <MenuItem key={c.id} value={String(c.id)}>
            {displayText(c.name)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        required
        select
        size="small"
        label="商品"
        value={goodsId ? String(goodsId) : ""}
        disabled={!categoryId}
        onChange={(e) => {
          const id = Number(e.target.value) || 0;
          onGoods(goods.find((x) => Number(x.id) === id) || null);
        }}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="">{categoryId ? "请选择商品" : "先选分类"}</MenuItem>
        {goods.map((x) => (
          <MenuItem key={x.id} value={String(x.id)}>
            {displayText(x.name)}
          </MenuItem>
        ))}
      </TextField>
    </>
  );
}
