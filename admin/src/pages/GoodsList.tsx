import {
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

type Goods = {
  id: number;
  name: string;
  cover_url: string;
  price_cent: number;
  stock: number;
  on_sale: number;
  category_name: string;
  heat_score: number;
  manual_weight: number;
};

export default function GoodsList() {
  const nav = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [onSale, setOnSale] = useState("");
  const [list, setList] = useState<Goods[]>([]);
  const [total, setTotal] = useState(0);
  const load = () => {
    api
      .get("/goods", { params: { keyword, onSale, pageSize: 50 } })
      .then((d: { list: Goods[]; total: number }) => {
        setList(d.list);
        setTotal(d.total);
      });
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">商品（{total}）</Typography>
        <Button variant="contained" onClick={() => nav("/goods/new")}>
          新建商品
        </Button>
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" label="名称" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>上架</InputLabel>
          <Select label="上架" value={onSale} onChange={(e) => setOnSale(String(e.target.value))}>
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="1">上架</MenuItem>
            <MenuItem value="0">下架</MenuItem>
          </Select>
        </FormControl>
        <Button onClick={load}>筛选</Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>商品</TableCell>
            <TableCell>分类</TableCell>
            <TableCell>价格</TableCell>
            <TableCell>库存</TableCell>
            <TableCell>热度</TableCell>
            <TableCell>加权</TableCell>
            <TableCell>状态</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((g) => (
            <TableRow key={g.id}>
              <TableCell>{g.name}</TableCell>
              <TableCell>{g.category_name}</TableCell>
              <TableCell>¥{(g.price_cent / 100).toFixed(2)}</TableCell>
              <TableCell>{g.stock}</TableCell>
              <TableCell>{g.heat_score}</TableCell>
              <TableCell>
                <TextField
                  size="small"
                  type="number"
                  defaultValue={g.manual_weight}
                  sx={{ width: 80 }}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v === g.manual_weight) return;
                    api.patch(`/goods/${g.id}/weight`, { manualWeight: v }).then(load);
                  }}
                />
              </TableCell>
              <TableCell>
                <Chip size="small" label={g.on_sale ? "上架" : "下架"} color={g.on_sale ? "success" : "default"} />
              </TableCell>
              <TableCell>
                <Button size="small" onClick={() => nav(`/goods/${g.id}`)}>
                  编辑
                </Button>
                <Button
                  size="small"
                  onClick={() => api.patch(`/goods/${g.id}/on-sale`, { onSale: !g.on_sale }).then(load)}
                >
                  {g.on_sale ? "下架" : "上架"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
