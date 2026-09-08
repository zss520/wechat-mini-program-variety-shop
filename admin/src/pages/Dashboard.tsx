import { Card, CardContent, Grid, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function Dashboard() {
  const [d, setD] = useState({ pendingPack: 0, waitPickup: 0, grouping: 0, todayOrders: 0, todayAmountCent: 0, lowStock: 0 });
  const [low, setLow] = useState<{ list: any[]; threshold: number }>({ list: [], threshold: 5 });
  useEffect(() => {
    api.get("/dashboard/summary").then(setD).catch(() => undefined);
    api.get("/dashboard/low-stock").then(setLow).catch(() => undefined);
  }, []);
  const cards = [
    { t: "待备货", v: d.pendingPack },
    { t: "待自提", v: d.waitPickup },
    { t: "拼团中", v: d.grouping },
    { t: "今日订单", v: d.todayOrders },
    { t: "今日销售额(元)", v: (d.todayAmountCent / 100).toFixed(2) },
    { t: "低库存商品", v: d.lowStock },
  ];
  return (
    <>
      <Typography variant="h5" gutterBottom>
        工作台
      </Typography>
      <Grid container spacing={2}>
        {cards.map((c) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={c.t}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">{c.t}</Typography>
                <Typography variant="h4">{c.v}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
        库存预警（≤{low.threshold}）
      </Typography>
      {low.list.map((g) => (
        <Typography key={g.id} variant="body2">
          {g.name} 剩余 {g.stock}
        </Typography>
      ))}
      {!low.list.length && (
        <Typography variant="body2" color="text.secondary">
          暂无低于阈值的在售商品
        </Typography>
      )}
    </>
  );
}
