import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import { useFeedback } from "./FeedbackProvider";
import { asArray, asRecord, displayText } from "../utils/display";

export type Cat = { id: number; name: string };
export type Goods = { id: number; name: string; category_id?: number };

export function goodsDetailPath(goodsId: number | string, slot = "banner") {
  return `/pages/goods/detail?id=${goodsId}&slot=${slot}&pos=1`;
}

export default function JumpPicker({
  cats,
  categoryId,
  goodsId,
  onCategory,
  onGoods,
  slot = "banner",
  helperText,
}: {
  cats: Cat[];
  categoryId: number;
  goodsId: number;
  onCategory: (id: number) => void;
  onGoods: (id: number) => void;
  slot?: string;
  helperText?: string;
}) {
  const fb = useFeedback();
  const [goods, setGoods] = useState<Goods[]>([]);
  useEffect(() => {
    if (!categoryId) {
      setGoods([]);
      return;
    }
    api
      .get("/goods", { params: { categoryId, pageSize: 100 } })
      .then((d) => setGoods(asArray<Goods>(asRecord(d).list)))
      .catch((e) => fb.error(e));
  }, [categoryId]);
  const path = goodsId ? goodsDetailPath(goodsId, slot) : "";
  return (
    <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="flex-start" sx={{ width: "100%" }}>
      <FormControl size="small" sx={{ minWidth: 148 }}>
        <InputLabel>跳转分类</InputLabel>
        <Select
          label="跳转分类"
          value={categoryId ? String(categoryId) : ""}
          onChange={(e) => {
            onCategory(Number(e.target.value) || 0);
            onGoods(0);
          }}
        >
          <MenuItem value="">不跳转</MenuItem>
          {cats.map((c) => (
            <MenuItem key={c.id} value={String(c.id)}>
              {displayText(c.name)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 200 }} disabled={!categoryId}>
        <InputLabel>跳转商品</InputLabel>
        <Select
          label="跳转商品"
          value={goodsId ? String(goodsId) : ""}
          onChange={(e) => onGoods(Number(e.target.value) || 0)}
        >
          <MenuItem value="">请选择商品</MenuItem>
          {goods.map((g) => (
            <MenuItem key={g.id} value={String(g.id)}>
              {displayText(g.name)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        size="small"
        label="小程序地址预览"
        value={path || "选择商品后自动生成"}
        InputProps={{ readOnly: true }}
        sx={{ flex: 1, minWidth: 280 }}
        helperText={path ? helperText || "顾客点击后将打开该商品详情" : "先选分类再选商品；不选分类表示不跳转"}
      />
    </Stack>
  );
}
