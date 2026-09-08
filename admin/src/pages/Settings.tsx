import { Alert, Button, Stack, Switch, TextField, Typography, FormControlLabel } from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";

export default function Settings() {
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api.get("/settings").then(setForm);
  }, []);
  if (!form) return null;
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    await api.put("/settings", form);
    setMsg("已保存");
  };
  return (
    <>
      <Typography variant="h5" gutterBottom>
        店铺设置
      </Typography>
      {msg && <Alert severity="success">{msg}</Alert>}
      <form onSubmit={submit}>
        <Stack spacing={2} sx={{ maxWidth: 560 }}>
          <TextField label="店铺名称" value={form.shop_name} onChange={(e) => set("shop_name", e.target.value)} />
          <TextField label="店铺简介" value={form.intro || ""} onChange={(e) => set("intro", e.target.value)} />
          <TextField label="电话" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          <TextField label="微信号" value={form.wechat_id} onChange={(e) => set("wechat_id", e.target.value)} />
          <TextField label="自提地址" value={form.pickup_address} onChange={(e) => set("pickup_address", e.target.value)} />
          <TextField label="营业时间" value={form.business_hours} onChange={(e) => set("business_hours", e.target.value)} />
          <TextField type="number" label="配送费(分)" value={form.freight_cent} onChange={(e) => set("freight_cent", Number(e.target.value))} />
          <TextField type="number" label="满额免运费(分)" value={form.free_freight_over_cent} onChange={(e) => set("free_freight_over_cent", Number(e.target.value))} />
          <TextField type="number" label="待付款超时(分钟)" value={form.pay_timeout_minutes} onChange={(e) => set("pay_timeout_minutes", Number(e.target.value))} />
          <TextField type="number" label="低库存阈值" value={form.low_stock_threshold} onChange={(e) => set("low_stock_threshold", Number(e.target.value))} />
          <FormControlLabel control={<Switch checked={!!form.points_enabled} onChange={(e) => set("points_enabled", e.target.checked)} />} label="开启积分" />
          <TextField type="number" label="每实付1元赠积分" value={form.points_earn_per_yuan || 1} onChange={(e) => set("points_earn_per_yuan", Number(e.target.value))} />
          <TextField type="number" label="多少积分抵1元" value={form.points_redeem_rate || 100} onChange={(e) => set("points_redeem_rate", Number(e.target.value))} />
          <FormControlLabel control={<Switch checked={!!form.delivery_enabled} onChange={(e) => set("delivery_enabled", e.target.checked)} />} label="开启配送" />
          <FormControlLabel control={<Switch checked={!!form.pause_order} onChange={(e) => set("pause_order", e.target.checked)} />} label="暂停接单" />
          <Button type="submit" variant="contained">
            保存
          </Button>
        </Stack>
      </form>
    </>
  );
}
