import { Button, FormControlLabel, Stack, Switch, TextField } from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { useFeedback } from "../components/FeedbackProvider";
import { isCnMobile, isValidNonNegInt } from "../utils/message";

export default function Settings() {
  const fb = useFeedback();
  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    api.get("/settings").then(setForm).catch((e) => fb.error(e, "设置加载失败"));
  }, []);
  if (!form) return null;
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!String(form.shop_name || "").trim()) {
      await fb.alert("请填写店铺名称", { title: "请完善信息", severity: "warning" });
      return;
    }
    const phone = String(form.phone || "").trim();
    if (phone && !isCnMobile(phone)) {
      await fb.alert("电话请填写 11 位手机号，如 13800138000", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (!isValidNonNegInt(form.freight_cent) || !isValidNonNegInt(form.free_freight_over_cent)) {
      await fb.alert("配送费、满额免运费须为大于等于 0 的整数，单位是分", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (!Number.isInteger(form.pay_timeout_minutes) || form.pay_timeout_minutes < 1) {
      await fb.alert("待付款超时须为大于 0 的整数分钟", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (!isValidNonNegInt(form.low_stock_threshold)) {
      await fb.alert("低库存阈值须为大于等于 0 的整数", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      await api.put("/settings", form);
      await fb.success("店铺设置已保存");
    } catch (err) {
      await fb.error(err);
    }
  };
  return (
    <PageContainer title="店铺设置" description="带 * 为必填。金额类字段单位是「分」，100 分 = ¥1。">
      <form onSubmit={submit} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 560 }}>
          <TextField required label="店铺名称" value={form.shop_name || ""} onChange={(e) => set("shop_name", e.target.value)} helperText="必填，顾客端导航栏标题" />
          <TextField label="店铺简介" value={form.intro || ""} onChange={(e) => set("intro", e.target.value)} helperText="选填" />
          <TextField label="电话" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} helperText="选填，11 位手机号，用于顾客联系店主" inputProps={{ maxLength: 11 }} />
          <TextField label="微信号" value={form.wechat_id || ""} onChange={(e) => set("wechat_id", e.target.value)} helperText="选填" />
          <TextField label="自提地址" value={form.pickup_address || ""} onChange={(e) => set("pickup_address", e.target.value)} helperText="选填，到店自提时展示" />
          <TextField label="营业时间" value={form.business_hours || ""} onChange={(e) => set("business_hours", e.target.value)} helperText="选填，如 09:00-21:00" />
          <TextField required type="number" label="配送费（分）" value={form.freight_cent} onChange={(e) => set("freight_cent", Number(e.target.value))} helperText="必填，整数。300 表示 ¥3.00" inputProps={{ min: 0, step: 1 }} />
          <TextField required type="number" label="满额免运费（分）" value={form.free_freight_over_cent} onChange={(e) => set("free_freight_over_cent", Number(e.target.value))} helperText="必填，整数。3000 表示满 ¥30 免运费" inputProps={{ min: 0, step: 1 }} />
          <TextField required type="number" label="待付款超时（分钟）" value={form.pay_timeout_minutes} onChange={(e) => set("pay_timeout_minutes", Number(e.target.value))} helperText="必填，正整数" inputProps={{ min: 1, step: 1 }} />
          <TextField required type="number" label="低库存阈值" value={form.low_stock_threshold} onChange={(e) => set("low_stock_threshold", Number(e.target.value))} helperText="必填，整数。工作台按此预警" inputProps={{ min: 0, step: 1 }} />
          <FormControlLabel control={<Switch checked={!!form.points_enabled} onChange={(e) => set("points_enabled", e.target.checked)} />} label="开启积分" />
          <TextField type="number" label="每实付 1 元赠积分" value={form.points_earn_per_yuan || 1} onChange={(e) => set("points_earn_per_yuan", Number(e.target.value))} helperText="正整数，默认 1" inputProps={{ min: 0, step: 1 }} />
          <TextField type="number" label="多少积分抵 1 元" value={form.points_redeem_rate || 100} onChange={(e) => set("points_redeem_rate", Number(e.target.value))} helperText="正整数，默认 100" inputProps={{ min: 1, step: 1 }} />
          <FormControlLabel control={<Switch checked={!!form.delivery_enabled} onChange={(e) => set("delivery_enabled", e.target.checked)} />} label="开启配送" />
          <FormControlLabel control={<Switch checked={!!form.pause_order} onChange={(e) => set("pause_order", e.target.checked)} />} label="暂停接单" />
          <Button type="submit" variant="contained">
            保存
          </Button>
        </Stack>
      </form>
    </PageContainer>
  );
}
