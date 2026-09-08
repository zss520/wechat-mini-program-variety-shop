import { Button, Card, CardContent, Grid, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import dayjs from "dayjs";
import PageContainer from "../components/PageContainer";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";

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
    <PageContainer
      title="数据分析"
      extra={
        <Stack direction="row" spacing={1.5}>
          <TextField type="date" size="small" label="从" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField type="date" size="small" label="到" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outlined" onClick={load}>
            查询
          </Button>
          <Button variant="contained" onClick={() => api.post("/jobs/recompute-heat").then(load)}>
            重算热度
          </Button>
        </Stack>
      }
    >
      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        漏斗
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {funnel.steps.map((s) => (
          <Grid item xs={6} sm={4} md={2} key={s.name}>
            <Card>
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                  {s.name}
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 600 }}>{s.uv}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {!!signals.length && (
        <>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            异常信号
          </Typography>
          {signals.map((s, i) => (
            <Typography key={i} sx={{ mb: 0.5 }}>
              {s.name}：{s.message}
            </Typography>
          ))}
        </>
      )}
      <Typography variant="subtitle1" sx={{ mt: 1, mb: 1.5 }}>
        商品分析
      </Typography>
      <DataTable>
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
          {!goods.length && <EmptyRow cols={7} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
