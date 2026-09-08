import { Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import dayjs from "dayjs";

export default function Reports() {
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [funnel, setFunnel] = useState<{ steps: { name: string; uv: number }[] }>({ steps: [] });
  const [goods, setGoods] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const load = () => {
    api.get("/reports/funnel", { params: { from, to } }).then(setFunnel);
    api.get("/reports/goods", { params: { from, to, pageSize: 50 } }).then((d) => setGoods(d.list));
    api.get("/reports/signals", { params: { from, to } }).then(setSignals);
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Typography variant="h5" gutterBottom>
        数据分析
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField type="date" size="small" label="从" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField type="date" size="small" label="到" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={load}>查询</Button>
        <Button onClick={() => api.post("/jobs/recompute-heat").then(load)}>重算热度</Button>
      </Stack>
      <Typography variant="h6">漏斗</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {funnel.steps.map((s) => (
          <div key={s.name}>
            <Typography color="text.secondary">{s.name}</Typography>
            <Typography variant="h6">{s.uv}</Typography>
          </div>
        ))}
      </Stack>
      {!!signals.length && (
        <>
          <Typography variant="h6">异常信号</Typography>
          {signals.map((s, i) => (
            <Typography key={i}>
              {s.name}：{s.message}
            </Typography>
          ))}
        </>
      )}
      <Typography variant="h6" sx={{ mt: 2 }}>
        商品分析
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>商品</TableCell>
            <TableCell>曝光UV</TableCell>
            <TableCell>CTR</TableCell>
            <TableCell>购买率</TableCell>
            <TableCell>支付件数</TableCell>
            <TableCell>热度</TableCell>
            <TableCell>加权</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {goods.map((g) => (
            <TableRow key={g.id}>
              <TableCell>{g.name}</TableCell>
              <TableCell>{g.expose_uv}</TableCell>
              <TableCell>{g.sampleInsufficient ? "样本少" : g.ctr != null ? `${(g.ctr * 100).toFixed(1)}%` : "—"}</TableCell>
              <TableCell>{g.sampleInsufficient ? "样本少" : g.cvr != null ? `${(g.cvr * 100).toFixed(1)}%` : "—"}</TableCell>
              <TableCell>{g.pay_qty}</TableCell>
              <TableCell>{g.heat_score}</TableCell>
              <TableCell>{g.manual_weight}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
