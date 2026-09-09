import { Button, Card, CardContent, Grid, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import dayjs from "dayjs";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { asArray, asRecord, displayNumber, displayPercent, displayText } from "../utils/display";
import { useFeedback } from "../components/FeedbackProvider";

export default function Reports() {
  const fb = useFeedback();
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [funnel, setFunnel] = useState<{ steps: { name: string; uv: number }[] }>({ steps: [] });
  const [goods, setGoods] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const load = async () => {
    if (!from || !to) {
      await fb.alert("请选择查询起止日期，格式为年-月-日", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (from > to) {
      await fb.alert("结束日期不能早于开始日期", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      const [funnelData, goodsData, signalData] = await Promise.all([
        api.get("/reports/funnel", { params: { from, to } }),
        api.get("/reports/goods", { params: { from, to, pageSize: 50 } }),
        api.get("/reports/signals", { params: { from, to } }),
      ]);
      setFunnel({ steps: asArray(asRecord(funnelData).steps) });
      setGoods(asArray(asRecord(goodsData).list));
      setSignals(asArray(signalData));
    } catch (e) {
      await fb.error(e);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <PageContainer
      title="数据分析"
      extra={
        <InlineForm sx={{ mb: 0 }}>
          <TextField required type="date" size="small" label="从" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField required type="date" size="small" label="到" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outlined" onClick={load}>
            查询
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                await api.post("/jobs/recompute-heat");
                await load();
                await fb.success("热度已重算");
              } catch (e) {
                await fb.error(e);
              }
            }}
          >
            重算热度
          </Button>
        </InlineForm>
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
                  {displayText(s.name)}
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 600 }}>{displayNumber(s.uv)}</Typography>
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
              {displayText(s.name)}：{displayText(s.message)}
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
              <TableCell>{displayText(g.name)}</TableCell>
              <TableCell>{displayNumber(g.expose_uv)}</TableCell>
              <TableCell>{g.sampleInsufficient ? "样本少" : displayPercent(g.ctr)}</TableCell>
              <TableCell>{g.sampleInsufficient ? "样本少" : displayPercent(g.cvr)}</TableCell>
              <TableCell>{displayNumber(g.pay_qty)}</TableCell>
              <TableCell>{displayNumber(g.heat_score)}</TableCell>
              <TableCell>{displayNumber(g.manual_weight)}</TableCell>
            </TableRow>
          ))}
          {!goods.length && <EmptyRow cols={7} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
