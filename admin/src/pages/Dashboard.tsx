import { Card, CardContent, Grid, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function Dashboard() {
  const [d, setD] = useState({ pendingPack: 0, waitPickup: 0, todayOrders: 0, todayAmountCent: 0, lowStock: 0 });
  useEffect(() => {
    api.get("/dashboard/summary").then(setD).catch(() => undefined);
  }, []);
  const cards = [
    { t: "待备货", v: d.pendingPack },
    { t: "待自提", v: d.waitPickup },
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
    </>
  );
}
