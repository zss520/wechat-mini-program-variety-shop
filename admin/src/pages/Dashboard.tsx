import { Card, CardContent, Grid, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { asArray, asRecord, displayNumber, displayText, displayYuan } from "../utils/display";

export default function Dashboard() {
  const nav = useNavigate();
  const [d, setD] = useState({ pendingPack: 0, waitPickup: 0, grouping: 0, todayOrders: 0, todayAmountCent: 0, lowStock: 0 });
  const [low, setLow] = useState<{ list: any[]; threshold: number }>({ list: [], threshold: 5 });
  useEffect(() => {
    api.get("/dashboard/summary").then((raw) => setD(asRecord(raw, { pendingPack: 0, waitPickup: 0, grouping: 0, todayOrders: 0, todayAmountCent: 0, lowStock: 0 }))).catch(() => undefined);
    api.get("/dashboard/low-stock").then((raw) => setLow(asRecord(raw, { list: [], threshold: 5 }))).catch(() => undefined);
  }, []);
  const cards = [
    { t: "待备货", v: displayNumber(d.pendingPack), to: "/orders" },
    { t: "待自提", v: displayNumber(d.waitPickup), to: "/orders" },
    { t: "拼团中", v: displayNumber(d.grouping), to: "/marketing/campaigns" },
    { t: "今日订单", v: displayNumber(d.todayOrders), to: "/orders" },
    { t: "今日销售额", v: displayYuan(d.todayAmountCent), to: "/reports" },
    { t: "低库存商品", v: displayNumber(d.lowStock), to: "/goods" },
  ];
  return (
    <PageContainer title="工作台" description="今日经营概览，点击卡片可跳转对应业务。" card={false}>
      <Grid container spacing={2}>
        {cards.map((c) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={c.t}>
            <Card
              sx={{ cursor: "pointer", transition: "box-shadow .2s", "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" } }}
              onClick={() => nav(c.to)}
            >
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                  {c.t}
                </Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 600, mt: 0.5, color: "rgba(0,0,0,0.88)" }}>{c.v}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          库存预警
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          在售商品库存 ≤ {displayNumber(low.threshold)}
        </Typography>
        <DataTable>
          <TableHead>
            <TableRow>
              <TableCell>商品</TableCell>
              <TableCell>剩余库存</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {asArray(low.list).map((g: any) => (
              <TableRow key={g.id} hover sx={{ cursor: "pointer" }} onClick={() => nav(`/goods/${g.id}`)}>
                <TableCell>{displayText(g.name)}</TableCell>
                <TableCell sx={{ color: "error.main", fontWeight: 600 }}>{displayNumber(g.stock)}</TableCell>
              </TableRow>
            ))}
            {!asArray(low.list).length && <EmptyRow cols={2} text="暂无低于阈值的在售商品" />}
          </TableBody>
        </DataTable>
      </Paper>
    </PageContainer>
  );
}
