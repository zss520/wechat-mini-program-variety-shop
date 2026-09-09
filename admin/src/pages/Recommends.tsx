import { Button, MenuItem, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, asRecord, displayNumber, displayText } from "../utils/display";

export default function Recommends() {
  const fb = useFeedback();
  const [slot, setSlot] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [goods, setGoods] = useState<any[]>([]);
  const [pick, setPick] = useState<number>(0);
  const load = () => {
    api.get("/recommend-slots/home_recommend").then((d) => {
      const data = asRecord(d);
      if (data.slot && typeof data.slot === "object") setSlot(asRecord(data.slot));
      setItems(asArray(data.items));
    }).catch((e) => fb.error(e));
    api.get("/recommend-slots/home_recommend/preview").then((d) => setPreview(asArray(asRecord(d).list))).catch((e) => fb.error(e));
    api.get("/goods", { params: { pageSize: 100, onSale: 1 } }).then((d) => setGoods(asArray(asRecord(d).list))).catch((e) => fb.error(e));
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (nextItems = items, silent = false) => {
    if (!slot) return;
    const title = String(slot.title || "").trim();
    if (!title) {
      await fb.alert("请填写推荐位标题", { title: "请完善信息", severity: "warning" });
      return;
    }
    const capacity = Number(slot.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      await fb.alert("容量须为大于 0 的整数", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (nextItems.length > capacity) {
      await fb.alert(`置顶数量不能超过容量 ${capacity}`, { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      await api.put("/recommend-slots/home_recommend", {
        title,
        capacity,
        strategy: slot.strategy,
        enabled: !!slot.enabled,
        pins: nextItems.map((it, i) => ({ goodsId: it.goods_id, pinOrder: i + 1 })),
      });
      load();
      if (!silent) await fb.success("推荐位已保存");
    } catch (e) {
      await fb.error(e);
    }
  };

  const addPin = async () => {
    if (!pick) {
      await fb.alert("请先选择要置顶的商品", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (items.some((it) => it.goods_id === pick)) {
      await fb.alert("该商品已在置顶列表中", { title: "请注意", severity: "warning" });
      return;
    }
    const g = goods.find((x) => x.id === pick);
    if (!g) return;
    await save([...items, { goods_id: g.id, name: g.name, cover_url: g.cover_url, stock: g.stock, heat_score: g.heat_score }], true);
    setPick(0);
    await fb.success("已加入置顶");
  };

  const removePin = async (it: any, idx: number) => {
    const ok = await fb.confirm(`确定移除置顶「${it.name}」？`, { title: "移除置顶", danger: true, confirmText: "移除" });
    if (!ok) return;
    await save(items.filter((_, i) => i !== idx), true);
    await fb.success("已移除置顶");
  };

  if (!slot) return null;
  return (
    <PageContainer title="首页推荐位" description="标题、容量必填。容量为正整数，置顶数不能超过容量。">
      <InlineForm>
        <TextField required size="small" label="标题" placeholder="最多 20 字" value={slot.title || ""} onChange={(e) => setSlot({ ...slot, title: e.target.value })} inputProps={{ maxLength: 20 }} />
        <TextField required size="small" type="number" label="容量" placeholder="正整数" value={slot.capacity} onChange={(e) => setSlot({ ...slot, capacity: Number(e.target.value) })} inputProps={{ min: 1, step: 1 }} sx={{ width: 100 }} />
        <TextField required select size="small" label="策略" value={slot.strategy} onChange={(e) => setSlot({ ...slot, strategy: e.target.value })} sx={{ minWidth: 200 }}>
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
              {displayText(g.name)}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" onClick={addPin}>
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
              <TableCell>{displayText(it.name)}</TableCell>
              <TableCell>{displayNumber(it.stock)}</TableCell>
              <TableCell>{displayNumber(it.heat_score)}</TableCell>
              <TableCell>
                <Button
                  disabled={idx === 0}
                  onClick={() => {
                    const n = [...items];
                    [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
                    save(n, true);
                  }}
                >
                  上移
                </Button>
                <Button onClick={() => removePin(it, idx)}>移除</Button>
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
            {displayText(g.name)} {g.pin ? "（置顶）" : ""} 库存 {displayNumber(g.stock)}
          </li>
        ))}
      </ol>
    </PageContainer>
  );
}
