import { Button, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";

type Goods = { id: number; name: string };

export default function Campaigns() {
  const [goods, setGoods] = useState<Goods[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [seckills, setSeckills] = useState<any[]>([]);
  const [g, setG] = useState({ title: "", goodsId: 0, requiredCount: 2, groupPriceCent: 0, expireHours: 24, startAt: "", endAt: "" });
  const [s, setS] = useState({ title: "", goodsId: 0, seckillPriceCent: 0, seckillStock: 10, perUserLimit: 1, startAt: "", endAt: "" });
  const load = () => {
    api.get("/goods", { params: { pageSize: 100 } }).then((d: { list: Goods[] }) => {
      setGoods(d.list);
      if (!g.goodsId && d.list[0]) setG((x) => ({ ...x, goodsId: d.list[0].id }));
      if (!s.goodsId && d.list[0]) setS((x) => ({ ...x, goodsId: d.list[0].id }));
    });
    api.get("/group-buys").then(setGroups);
    api.get("/seckills").then(setSeckills);
  };
  useEffect(() => {
    load();
  }, []);
  const addGroup = async (e: FormEvent) => {
    e.preventDefault();
    await api.post("/group-buys", g);
    load();
  };
  const addSeckill = async (e: FormEvent) => {
    e.preventDefault();
    await api.post("/seckills", s);
    load();
  };
  return (
    <>
      <Typography variant="h5" gutterBottom>
        拼团
      </Typography>
      <form onSubmit={addGroup}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <TextField required size="small" label="标题" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} />
          <TextField select size="small" label="商品" value={g.goodsId} onChange={(e) => setG({ ...g, goodsId: Number(e.target.value) })} sx={{ minWidth: 180 }}>
            {goods.map((x) => (
              <MenuItem key={x.id} value={x.id}>
                {x.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="number" label="成团人数" value={g.requiredCount} onChange={(e) => setG({ ...g, requiredCount: Number(e.target.value) })} />
          <TextField size="small" type="number" label="团价(分)" value={g.groupPriceCent} onChange={(e) => setG({ ...g, groupPriceCent: Number(e.target.value) })} />
          <TextField size="small" type="datetime-local" label="开始" InputLabelProps={{ shrink: true }} value={g.startAt} onChange={(e) => setG({ ...g, startAt: e.target.value })} />
          <TextField size="small" type="datetime-local" label="结束" InputLabelProps={{ shrink: true }} value={g.endAt} onChange={(e) => setG({ ...g, endAt: e.target.value })} />
          <Button type="submit" variant="contained">
            新建拼团
          </Button>
        </Stack>
      </form>
      <Table size="small" sx={{ mb: 4 }}>
        <TableHead>
          <TableRow>
            <TableCell>标题</TableCell>
            <TableCell>人数/团价</TableCell>
            <TableCell>时间</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((x) => (
            <TableRow key={x.id}>
              <TableCell>{x.title}</TableCell>
              <TableCell>
                {x.required_count}人 / ¥{(x.group_price_cent / 100).toFixed(2)}
              </TableCell>
              <TableCell>
                {String(x.start_at).slice(0, 16)} ~ {String(x.end_at).slice(0, 16)}
              </TableCell>
              <TableCell>
                <Button size="small" onClick={() => api.delete(`/group-buys/${x.id}`).then(load)}>
                  下线
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Typography variant="h5" gutterBottom>
        秒杀
      </Typography>
      <form onSubmit={addSeckill}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <TextField required size="small" label="标题" value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
          <TextField select size="small" label="商品" value={s.goodsId} onChange={(e) => setS({ ...s, goodsId: Number(e.target.value) })} sx={{ minWidth: 180 }}>
            {goods.map((x) => (
              <MenuItem key={x.id} value={x.id}>
                {x.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="number" label="秒杀价(分)" value={s.seckillPriceCent} onChange={(e) => setS({ ...s, seckillPriceCent: Number(e.target.value) })} />
          <TextField size="small" type="number" label="秒杀库存" value={s.seckillStock} onChange={(e) => setS({ ...s, seckillStock: Number(e.target.value) })} />
          <TextField size="small" type="datetime-local" label="开始" InputLabelProps={{ shrink: true }} value={s.startAt} onChange={(e) => setS({ ...s, startAt: e.target.value })} />
          <TextField size="small" type="datetime-local" label="结束" InputLabelProps={{ shrink: true }} value={s.endAt} onChange={(e) => setS({ ...s, endAt: e.target.value })} />
          <Button type="submit" variant="contained">
            新建秒杀
          </Button>
        </Stack>
      </form>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>标题</TableCell>
            <TableCell>价格/库存</TableCell>
            <TableCell>时间</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {seckills.map((x) => (
            <TableRow key={x.id}>
              <TableCell>{x.title}</TableCell>
              <TableCell>
                ¥{(x.seckill_price_cent / 100).toFixed(2)} / 剩{x.seckill_stock}
              </TableCell>
              <TableCell>
                {String(x.start_at).slice(0, 16)} ~ {String(x.end_at).slice(0, 16)}
              </TableCell>
              <TableCell>
                <Button size="small" onClick={() => api.delete(`/seckills/${x.id}`).then(load)}>
                  下线
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
