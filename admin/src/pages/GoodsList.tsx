import { Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import ListPagination, { DEFAULT_PAGE_SIZE, lastPageOf, readPaged } from "../components/ListPagination";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, displayNumber, displayText, displayYuan } from "../utils/display";

type Cat = { id: number; name: string };

type Goods = {
  id: number;
  name: string;
  cover_url: string;
  thumb_url?: string;
  price_cent: number;
  special_price_cent?: number | null;
  special_start?: string | null;
  special_end?: string | null;
  stock: number;
  on_sale: number;
  category_name: string;
  heat_score: number;
  manual_weight: number;
};

function isSpecialNow(g: Goods) {
  const sp = Number(g.special_price_cent || 0);
  if (!sp || !g.special_start || !g.special_end) return false;
  const start = new Date(g.special_start).getTime();
  const end = new Date(g.special_end).getTime();
  const now = Date.now();
  return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
}

export default function GoodsList() {
  const nav = useNavigate();
  const fb = useFeedback();
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [onSale, setOnSale] = useState("");
  const [onSpecial, setOnSpecial] = useState("");
  const [cats, setCats] = useState<Cat[]>([]);
  const [list, setList] = useState<Goods[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const load = (p = page, size = pageSize) => {
    api
      .get("/goods", {
        params: {
          keyword: keyword.trim() || undefined,
          categoryId: categoryId || undefined,
          onSale: onSale || undefined,
          onSpecial: onSpecial || undefined,
          page: p,
          pageSize: size,
        },
      })
      .then((d) => {
        const data = readPaged<Goods>(d);
        setList(data.list);
        setTotal(data.total);
        const last = lastPageOf(data.total, size);
        if (p > last) setPage(last);
      })
      .catch((e) => fb.error(e));
  };
  useEffect(() => {
    api.get("/categories").then((d) => setCats(asArray<Cat>(d))).catch((e) => fb.error(e));
  }, []);
  useEffect(() => {
    load(page, pageSize);
  }, [page, pageSize]);
  const query = () => {
    if (page !== 1) setPage(1);
    else load(1, pageSize);
  };

  const saveWeight = async (g: Goods, raw: string) => {
    const v = Number(raw);
    if (v === g.manual_weight) return;
    if (!Number.isInteger(v) || v < -50 || v > 50) {
      await fb.alert("排序加权须为 -50 到 50 的整数", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      await api.patch(`/goods/${g.id}/weight`, { manualWeight: v });
      load();
    } catch (e) {
      await fb.error(e);
    }
  };

  const toggleSale = async (g: Goods) => {
    if (g.on_sale) {
      const ok = await fb.confirm(`确定下架「${g.name}」？顾客端将不再展示。`, { title: "下架商品", danger: true, confirmText: "下架" });
      if (!ok) return;
    }
    try {
      await api.patch(`/goods/${g.id}/on-sale`, { onSale: !g.on_sale });
      load();
      await fb.success(g.on_sale ? "已下架" : "已上架");
    } catch (e) {
      await fb.error(e);
    }
  };

  return (
    <PageContainer
      title="商品"
      description={`共 ${displayNumber(total, "0")} 件。当前特价可在下方筛选查看；设置入口在商品编辑页底部「限时特价」。加权为整数 -50～50。`}
      extra={
        <Button variant="contained" onClick={() => nav("/goods/new")}>
          新建商品
        </Button>
      }
    >
      <InlineForm>
        <TextField size="small" label="名称" placeholder="选填，回车查询" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && query()} />
        <FormControl size="small" sx={{ minWidth: 148 }}>
          <InputLabel>分类</InputLabel>
          <Select label="分类" value={categoryId} onChange={(e) => setCategoryId(String(e.target.value))}>
            <MenuItem value="">全部</MenuItem>
            {cats.map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {displayText(c.name)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>上架</InputLabel>
          <Select label="上架" value={onSale} onChange={(e) => setOnSale(String(e.target.value))}>
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="1">上架</MenuItem>
            <MenuItem value="0">下架</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 148 }}>
          <InputLabel>特价</InputLabel>
          <Select label="特价" value={onSpecial} onChange={(e) => setOnSpecial(String(e.target.value))}>
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="1">当前特价</MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" onClick={query}>
          查询
        </Button>
      </InlineForm>
      <DataTable
        minWidth={800}
        footer={<ListPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
      >
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
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                  <Box
                    component="img"
                    src={g.thumb_url || g.cover_url || "/static/placeholders/empty.png"}
                    alt=""
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.onerror = null;
                      el.src = "/static/placeholders/empty.png";
                    }}
                    sx={{
                      width: 48,
                      height: 48,
                      objectFit: "cover",
                      borderRadius: 1,
                      bgcolor: "#f5f5f5",
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {displayText(g.name)}
                    </Box>
                    {isSpecialNow(g) && <Chip size="small" label="特价" color="warning" sx={{ height: 20, flexShrink: 0 }} />}
                  </Box>
                </Box>
              </TableCell>
              <TableCell>{displayText(g.category_name)}</TableCell>
              <TableCell>
                {isSpecialNow(g) ? (
                  <Box>
                    <Box sx={{ color: "primary.main", fontWeight: 600 }}>{displayYuan(g.special_price_cent)}</Box>
                    <Box sx={{ color: "text.secondary", textDecoration: "line-through", fontSize: 12 }}>{displayYuan(g.price_cent)}</Box>
                  </Box>
                ) : (
                  displayYuan(g.price_cent)
                )}
              </TableCell>
              <TableCell>{displayNumber(g.stock)}</TableCell>
              <TableCell>{displayNumber(g.heat_score)}</TableCell>
              <TableCell>
                <TextField
                  size="small"
                  type="number"
                  defaultValue={g.manual_weight}
                  sx={{ width: 88 }}
                  inputProps={{ min: -50, max: 50, step: 1, title: "整数 -50～50，失焦保存" }}
                  onBlur={(e) => saveWeight(g, e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Chip size="small" label={g.on_sale ? "上架" : "下架"} color={g.on_sale ? "success" : "default"} />
              </TableCell>
              <TableCell>
                <Button size="small" onClick={() => nav(`/goods/${g.id}`)}>
                  编辑
                </Button>
                <Button size="small" onClick={() => toggleSale(g)}>
                  {g.on_sale ? "下架" : "上架"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!list.length && <EmptyRow cols={8} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
