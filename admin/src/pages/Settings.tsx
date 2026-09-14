import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { useFeedback } from "../components/FeedbackProvider";
import { isCnMobile, isValidNonNegInt } from "../utils/message";
import { asRecord } from "../utils/display";

type ShopForm = {
  shop_name: string;
  logo_url: string;
  intro: string;
  phone: string;
  wechat_id: string;
  pickup_address: string;
  business_hours: string;
  delivery_enabled: boolean;
  freight_cent: number;
  free_freight_over_cent: number;
  pay_timeout_minutes: number;
  pause_order: boolean;
  low_stock_threshold: number;
  primary_color: string;
  points_enabled: boolean;
  points_earn_per_yuan: number;
  points_redeem_rate: number;
};

const EMPTY: ShopForm = {
  shop_name: "社区杂货铺",
  logo_url: "",
  intro: "",
  phone: "",
  wechat_id: "",
  pickup_address: "",
  business_hours: "08:00-21:00",
  delivery_enabled: true,
  freight_cent: 0,
  free_freight_over_cent: 0,
  pay_timeout_minutes: 15,
  pause_order: false,
  low_stock_threshold: 5,
  primary_color: "#C2410C",
  points_enabled: true,
  points_earn_per_yuan: 1,
  points_redeem_rate: 100,
};

const KEYS = Object.keys(EMPTY) as (keyof ShopForm)[];

function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

function asNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalize(raw: unknown): ShopForm {
  const rec = asRecord(raw);
  const src = rec.shop_name != null || rec.logo_url != null ? rec : asRecord(rec.data);
  return {
    shop_name: String(src.shop_name ?? EMPTY.shop_name),
    logo_url: String(src.logo_url ?? ""),
    intro: String(src.intro ?? ""),
    phone: String(src.phone ?? ""),
    wechat_id: String(src.wechat_id ?? ""),
    pickup_address: String(src.pickup_address ?? ""),
    business_hours: String(src.business_hours ?? EMPTY.business_hours),
    delivery_enabled: src.delivery_enabled == null ? EMPTY.delivery_enabled : asBool(src.delivery_enabled),
    freight_cent: asNum(src.freight_cent, EMPTY.freight_cent),
    free_freight_over_cent: asNum(src.free_freight_over_cent, EMPTY.free_freight_over_cent),
    pay_timeout_minutes: asNum(src.pay_timeout_minutes, EMPTY.pay_timeout_minutes),
    pause_order: src.pause_order == null ? EMPTY.pause_order : asBool(src.pause_order),
    low_stock_threshold: asNum(src.low_stock_threshold, EMPTY.low_stock_threshold),
    primary_color: String(src.primary_color ?? EMPTY.primary_color),
    points_enabled: src.points_enabled == null ? EMPTY.points_enabled : asBool(src.points_enabled),
    points_earn_per_yuan: asNum(src.points_earn_per_yuan, EMPTY.points_earn_per_yuan),
    points_redeem_rate: asNum(src.points_redeem_rate, EMPTY.points_redeem_rate),
  };
}

function payload(form: ShopForm): ShopForm {
  const out = { ...EMPTY };
  for (const k of KEYS) (out as Record<string, unknown>)[k] = form[k];
  return out;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

export default function Settings() {
  const fb = useFeedback();
  const [form, setForm] = useState<ShopForm>(EMPTY);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoadState("loading");
    try {
      const data = await api.get("/settings");
      setForm(normalize(data));
      setLoadState("ok");
    } catch (e) {
      setForm(EMPTY);
      setLoadState("error");
      await fb.error(e, "设置加载失败");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const set = (k: keyof ShopForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (r?.url) {
        set("logo_url", r.url);
        await fb.success("Logo 已上传");
      }
    } catch (e) {
      await fb.error(e, "Logo 上传失败");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loadState !== "ok") {
      await fb.alert("店铺设置尚未加载成功，请先重试加载，避免用空表单覆盖已有内容", {
        title: "请完善信息",
        severity: "warning",
      });
      return;
    }
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
    if (form.points_enabled) {
      if (!Number.isInteger(form.points_earn_per_yuan) || form.points_earn_per_yuan < 1) {
        await fb.alert("每实付 1 元赠积分须为正整数", { title: "请完善信息", severity: "warning" });
        return;
      }
      if (!Number.isInteger(form.points_redeem_rate) || form.points_redeem_rate < 1) {
        await fb.alert("积分抵扣比例须为正整数", { title: "请完善信息", severity: "warning" });
        return;
      }
    }
    setSaving(true);
    try {
      const saved = await api.put("/settings", payload(form));
      setForm(normalize(saved));
      await fb.success("店铺设置已保存");
    } catch (err) {
      await fb.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="店铺设置" description="带 * 为必填。金额类字段单位是「分」，100 分 = ¥1。保存后顾客端在缓存到期后更新。">
      {loadState === "loading" && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} />
        </Stack>
      )}
      {loadState === "error" && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void load()}>
              重新加载
            </Button>
          }
        >
          店铺设置加载失败。为避免覆盖已有内容，请先重新加载后再保存。
        </Alert>
      )}
      {loadState !== "loading" && (
        <form onSubmit={submit} noValidate>
          <Stack spacing={3} sx={{ maxWidth: 640, width: "100%" }} divider={<Divider />}>
            <Section title="基础信息">
              <TextField
                required
                label="店铺名称"
                value={form.shop_name}
                onChange={(e) => set("shop_name", e.target.value)}
                helperText="必填，顾客端导航栏标题"
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                <Box
                  sx={{
                    width: 88,
                    height: 88,
                    flexShrink: 0,
                    borderRadius: 1,
                    border: "1px dashed #d9d9d9",
                    bgcolor: "#fafafa",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {form.logo_url ? (
                    <Box component="img" src={form.logo_url} alt="店铺 Logo" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      暂无 Logo
                    </Typography>
                  )}
                </Box>
                <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Button component="label" variant="outlined" disabled={uploading}>
                      {uploading ? "上传中…" : "上传 Logo"}
                      <input
                        hidden
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadLogo(file);
                        }}
                      />
                    </Button>
                    {form.logo_url ? (
                      <Button color="inherit" onClick={() => set("logo_url", "")}>
                        移除
                      </Button>
                    ) : null}
                  </Stack>
                  <TextField
                    size="small"
                    label="Logo 地址"
                    value={form.logo_url}
                    onChange={(e) => set("logo_url", e.target.value)}
                    helperText="选填，可上传或粘贴以 / 或 http 开头的图片地址"
                  />
                </Stack>
              </Stack>
              <TextField label="店铺简介" value={form.intro} onChange={(e) => set("intro", e.target.value)} helperText="选填，展示给顾客的一句话介绍" />
            </Section>

            <Section title="联系方式">
              <TextField
                label="电话"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                helperText="选填，11 位手机号，用于顾客联系店主"
                inputProps={{ maxLength: 11 }}
              />
              <TextField label="微信号" value={form.wechat_id} onChange={(e) => set("wechat_id", e.target.value)} helperText="选填" />
            </Section>

            <Section title="自提">
              <TextField
                label="自提地址"
                value={form.pickup_address}
                onChange={(e) => set("pickup_address", e.target.value)}
                helperText="选填，到店自提时展示"
              />
              <TextField
                label="营业时间"
                value={form.business_hours}
                onChange={(e) => set("business_hours", e.target.value)}
                helperText="选填，如 09:00-21:00"
              />
            </Section>

            <Section title="配送">
              <FormControlLabel
                control={<Switch checked={form.delivery_enabled} onChange={(e) => set("delivery_enabled", e.target.checked)} />}
                label="开启配送"
              />
              <TextField
                required
                type="number"
                label="配送费（分）"
                value={form.freight_cent}
                onChange={(e) => set("freight_cent", Number(e.target.value))}
                helperText="必填，整数。300 表示 ¥3.00"
                inputProps={{ min: 0, step: 1 }}
                disabled={!form.delivery_enabled}
              />
              <TextField
                required
                type="number"
                label="满额免运费（分）"
                value={form.free_freight_over_cent}
                onChange={(e) => set("free_freight_over_cent", Number(e.target.value))}
                helperText="必填，整数。3000 表示满 ¥30 免运费"
                inputProps={{ min: 0, step: 1 }}
                disabled={!form.delivery_enabled}
              />
            </Section>

            <Section title="交易">
              <TextField
                required
                type="number"
                label="待付款超时（分钟）"
                value={form.pay_timeout_minutes}
                onChange={(e) => set("pay_timeout_minutes", Number(e.target.value))}
                helperText="必填，正整数"
                inputProps={{ min: 1, step: 1 }}
              />
              <TextField
                required
                type="number"
                label="低库存阈值"
                value={form.low_stock_threshold}
                onChange={(e) => set("low_stock_threshold", Number(e.target.value))}
                helperText="必填，整数。工作台按此预警"
                inputProps={{ min: 0, step: 1 }}
              />
              <FormControlLabel
                control={<Switch checked={form.pause_order} onChange={(e) => set("pause_order", e.target.checked)} />}
                label="暂停接单（顾客可浏览，不可提交订单）"
              />
            </Section>

            <Section title="积分">
              <FormControlLabel
                control={<Switch checked={form.points_enabled} onChange={(e) => set("points_enabled", e.target.checked)} />}
                label="开启积分"
              />
              <TextField
                type="number"
                label="每实付 1 元赠积分"
                value={form.points_earn_per_yuan}
                onChange={(e) => set("points_earn_per_yuan", Number(e.target.value))}
                helperText="正整数，默认 1"
                inputProps={{ min: 1, step: 1 }}
                disabled={!form.points_enabled}
              />
              <TextField
                type="number"
                label="多少积分抵 1 元"
                value={form.points_redeem_rate}
                onChange={(e) => set("points_redeem_rate", Number(e.target.value))}
                helperText="正整数，默认 100"
                inputProps={{ min: 1, step: 1 }}
                disabled={!form.points_enabled}
              />
            </Section>

            <Button type="submit" variant="contained" disabled={saving || loadState !== "ok"}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </Stack>
        </form>
      )}
    </PageContainer>
  );
}
