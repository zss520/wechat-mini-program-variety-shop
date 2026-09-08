import { Button, MenuItem, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";

export default function Recommends() {
  const [slot, setSlot] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [goods, setGoods] = useState<any[]>([]);
  const [pick, setPick] = useState<number>(0);
  const load = () => {
    api.get("/recommend-slots/home_recommend").then((d) => {
      setSlot(d.slot);
      setItems(d.items);
    });
    api.get("/recommend-slots/home_recommend/preview").then((d) => setPreview(d.list || []));
    api.get("/goods", { params: { pageSize: 100, onSale: 1 } }).then((d) => setGoods(d.list));
  };
  useEffect(() => {
    load();
  }, []);
  const save = async (nextItems = items) => {
    await api.put("/recommend-slots/home_recommend", {
      title: slot.title,
      capacity: slot.capacity,
      strategy: slot.strategy,
      enabled: !!slot.enabled,
      pins: nextItems.map((it, i) => ({ goodsId: it.goods_id, pinOrder: i + 1 })),
    });
    load();
  };
  if (!slot) return null;
  return (
    <PageContainer title="首页推荐位">
      <InlineForm>
        <TextField size="small" label="标题" value={slot.title} onChange={(e) => setSlot({ ...slot, title: e.target.value })} />
        <TextField size="small" type="number" label="容量" value={slot.capacity} onChange={(e) => setSlot({ ...slot, capacity: Number(e.target.value) })} />
        <TextField select size="small" label="策略" value={slot.strategy} onChange={(e) => setSlot({ ...slot, strategy: e.target.value })} sx={{ minWidth: 200 }}>
          <MenuItem value="PIN_THEN_HEAT">置顶+热度补齐</MenuItem>
          <MenuItem value="PIN_THEN_SALES">置顶+销量</MenuItem>
          <MenuItem value="PIN_THEN_NEW">置顶+上新</MenuItem>
          <MenuItem value="MANUAL_ONLY">仅置顶</MenuItem>
        </TextField>
        <Button variant="contained" onClick={() => save()}>
          保存配置
        </Button>
      </InlineForm>
      <InlineForm>
        <TextField select size="small" label="添加置顶" value={pick} onChange={(e) => setPick(Number(e.target.value))} sx={{ minWidth: 240 }}>
          <MenuItem value={0}>选择商品</MenuItem>
          {goods.map((g) => (
            <MenuItem key={g.id} value={g.id}>
              {g.name}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          onClick={() => {
            if (!pick) return;
            const g = goods.find((x) => x.id === pick);
            if (!g) return;
            save([...items, { goods_id: g.id, name: g.name, cover_url: g.cover_url, stock: g.stock, heat_score: g.heat_score }]);
          }}
        >
          加入置顶
        </Button>
      </InlineForm>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        置顶
      </Typography>
      <DataTable>
        <TableHead>
          <TableRow>
            <TableCell>商品</TableCell>
            <TableCell>库存</TableCell>
            <TableCell>热度</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((it, idx) => (
            <TableRow key={it.goods_id}>
              <TableCell>{it.name}</TableCell>
              <TableCell>{it.stock}</TableCell>
              <TableCell>{it.heat_score}</TableCell>
              <TableCell>
                <Button
                  disabled={idx === 0}
                  onClick={() => {
                    const n = [...items];
                    [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
                    save(n);
                  }}
                >
                  上移
                </Button>
                <Button onClick={() => save(items.filter((_, i) => i !== idx))}>移除</Button>
              </TableCell>
            </TableRow>
          ))}
          {!items.length && <EmptyRow cols={4} text="暂无置顶商品" />}
        </TableBody>
      </DataTable>
      <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
        预览（小程序将展示）
      </Typography>
      <ol style={{ margin: 0, paddingLeft: 20, color: "rgba(0,0,0,0.88)" }}>
        {preview.map((g) => (
          <li key={g.id} style={{ marginBottom: 6 }}>
            {g.name} {g.pin ? "（置顶）" : ""} 库存 {g.stock}
          </li>
        ))}
      </ol>
    </PageContainer>
  );
}
