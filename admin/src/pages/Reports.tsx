import { Button, Card, CardContent, Grid, TextField, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import dayjs from "dayjs";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { asArray, asRecord, displayNumber, displayPercent, displayText } from "../utils/display";
import { useFeedback } from "../components/FeedbackProvider";

function rateCell(ok: boolean, value: unknown) {
  if (!ok) {
    return (
      <Typography component="span" color="text.secondary" sx={{ fontSize: 13 }}>
        样本少
      </Typography>
    );
  }
  return displayPercent(value);
}

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
      description="曝光按会话 30 秒去重；购买率以支付成功人数为准。人数不足 10 标「样本少」。热度 0–100，近 7 日为主并做转化平滑，按分位缩放以免爆款压扁其余商品。"
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
            <TableCell>
              <Tooltip title="去重后的曝光人数">
                <span>曝光UV</span>
              </Tooltip>
            </TableCell>
            <TableCell>
              <Tooltip title="点击人数 / 曝光人数">
                <span>CTR</span>
              </Tooltip>
            </TableCell>
            <TableCell>
              <Tooltip title="加购人数 / 点击人数">
                <span>加购率</span>
              </Tooltip>
            </TableCell>
            <TableCell>
              <Tooltip title="支付成功人数 / 点击人数，不以客户端 pay_success 为准">
                <span>点击购买率</span>
              </Tooltip>
            </TableCell>
            <TableCell>
              <Tooltip title="支付成功人数 / 曝光人数，衡量坑位质量">
                <span>曝光购买率</span>
              </Tooltip>
            </TableCell>
            <TableCell>支付件数</TableCell>
            <TableCell>
              <Tooltip title="0–100，近7日 50% + 当日 30% + 30日衰减 20%；含平滑 CTR/CVR">
                <span>热度</span>
              </Tooltip>
            </TableCell>
            <TableCell>加权</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {goods.map((g) => (
            <TableRow key={g.id}>
              <TableCell>{displayText(g.name)}</TableCell>
              <TableCell>{displayNumber(g.expose_uv)}</TableCell>
              <TableCell>{rateCell(!!g.ctrSampleOk, g.ctr)}</TableCell>
              <TableCell>{rateCell(!!g.cartSampleOk, g.cartRate)}</TableCell>
              <TableCell>{rateCell(!!g.cvrSampleOk, g.cvr)}</TableCell>
              <TableCell>{rateCell(!!g.exposeCvrSampleOk, g.exposeCvr)}</TableCell>
              <TableCell>{displayNumber(g.pay_qty)}</TableCell>
              <TableCell>{displayNumber(g.heat_score)}</TableCell>
              <TableCell>{displayNumber(g.manual_weight)}</TableCell>
            </TableRow>
          ))}
          {!goods.length && <EmptyRow cols={9} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
