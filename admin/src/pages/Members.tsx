import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, asRecord, displayNumber, displayText, displayYuan } from "../utils/display";

type Row = { id: number; nickname: string; phone: string; points_balance: number; orderCount: number; payAmountCent: number };

type Persona = {
  member: { id: number; nickname: string; phone: string; pointsBalance: number; registeredAt: string };
  tags: { key: string; label: string }[];
  rfm: { recencyDays: number | null; frequency90: number; monetaryFen90: number; recencyScore: number; frequencyScore: number; monetaryScore: number };
  prefs: { categoryId: number; categoryName: string; payQty: number; clickCount: number; affinity: number }[];
  last30d: { exposePv: number; clickPv: number; detailPv: number; cartPv: number; payOrders: number; payAmountCent: number };
  summary: { orderCount: number; payAmountCent: number; avgOrderCent: number; lastActivityDays: number };
  lastOrder: { id: number; paidAt: string; amountCent: number; itemQty: number; fulfillType: string } | null;
};

const TAG_COLOR: Record<string, "default" | "primary" | "success" | "warning" | "info"> = {
  new: "info",
  repeat: "primary",
  high_value: "success",
  sleeping: "warning",
  loyal: "success",
  browser: "default",
  potential: "info",
  normal: "default",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Grid item xs={6} sm={4}>
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    </Grid>
  );
}

export default function Members() {
  const fb = useFeedback();
  const [keyword, setKeyword] = useState("");
  const [list, setList] = useState<Row[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [personaTitle, setPersonaTitle] = useState("");
  const [loadingPersona, setLoadingPersona] = useState(false);
  const load = () =>
    api
      .get("/members", { params: { keyword, pageSize: 50 } })
      .then((d: { list: Row[] }) => setList(asArray(asRecord(d).list)))
      .catch((e) => fb.error(e));
  useEffect(() => {
    load();
  }, []);

  const openPersona = async (u: Row) => {
    setPersonaTitle(u.nickname || u.phone || "会员");
    setPersona(null);
    setLoadingPersona(true);
    try {
      const data = (await api.get(`/members/${u.id}/persona`)) as Persona;
      setPersona(asRecord(data) as Persona);
    } catch (e) {
      setLoadingPersona(false);
      await fb.error(e);
      return;
    }
    setLoadingPersona(false);
  };

  const adjust = async (u: Row) => {
    const values = await fb.prompt({
      title: `调整积分 · ${u.nickname || u.phone || "会员"}`,
      message: "增减数量为整数：正数增加，负数扣减，不能为 0。",
      fields: [
        { name: "delta", label: "积分增减", required: true, placeholder: "20 或 -10", helperText: "必填，整数，如 20 或 -10" },
        { name: "note", label: "备注", placeholder: "店主调整", helperText: "选填，最多 80 字", defaultValue: "店主调整" },
      ],
      confirmText: "提交",
    });
    if (!values) return;
    const delta = Number(values.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      await fb.alert("积分增减须为非 0 整数", { title: "请完善信息", severity: "warning" });
      return;
    }
    const note = (values.note || "店主调整").trim().slice(0, 80);
    try {
      await api.post(`/members/${u.id}/points`, { delta, note });
      load();
      await fb.success("积分已调整");
    } catch (e) {
      await fb.error(e);
    }
  };

  const closePersona = () => {
    setPersona(null);
    setLoadingPersona(false);
    setPersonaTitle("");
  };

  return (
    <PageContainer title="会员" description="人物画像为聚合标签（RFM、偏好分类、近 30 日活跃），不展示浏览轨迹和 openid。">
      <InlineForm>
        <TextField
          size="small"
          label="昵称/手机"
          placeholder="选填，回车查询"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <Button variant="outlined" onClick={load}>
          查询
        </Button>
      </InlineForm>
      <DataTable>
        <TableHead>
          <TableRow>
            <TableCell>昵称</TableCell>
            <TableCell>手机</TableCell>
            <TableCell>积分</TableCell>
            <TableCell>订单数</TableCell>
            <TableCell>实付</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{displayText(u.nickname)}</TableCell>
              <TableCell>{displayText(u.phone)}</TableCell>
              <TableCell>{displayNumber(u.points_balance)}</TableCell>
              <TableCell>{displayNumber(u.orderCount)}</TableCell>
              <TableCell>{displayYuan(u.payAmountCent)}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => openPersona(u)}>
                  画像
                </Button>
                <Button size="small" onClick={() => adjust(u)}>
                  调积分
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!list.length && <EmptyRow cols={6} />}
        </TableBody>
      </DataTable>

      <Dialog open={loadingPersona || !!persona} onClose={closePersona} fullWidth maxWidth="sm">
        <DialogTitle>人物画像 · {displayText(personaTitle)}</DialogTitle>
        <DialogContent>
          {loadingPersona && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          )}
          {persona && (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(persona.tags || []).map((t) => (
                  <Chip key={t.key} size="small" label={t.label} color={TAG_COLOR[t.key] || "default"} />
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {displayText(persona.member.phone)} · 积分 {displayNumber(persona.member.pointsBalance)}
              </Typography>
              <Grid container spacing={1.5}>
                <Metric label="近90日订单" value={displayNumber(persona.rfm.frequency90)} />
                <Metric label="近90日实付" value={displayYuan(persona.rfm.monetaryFen90)} />
                <Metric
                  label="距上次购买"
                  value={persona.rfm.recencyDays == null ? "暂无成交" : `${persona.rfm.recencyDays} 天`}
                />
                <Metric label="RFM 近度" value={displayNumber(persona.rfm.recencyScore)} />
                <Metric label="RFM 频次" value={displayNumber(persona.rfm.frequencyScore)} />
                <Metric label="RFM 金额" value={displayNumber(persona.rfm.monetaryScore)} />
                <Metric label="累计订单" value={displayNumber(persona.summary.orderCount)} />
                <Metric label="累计实付" value={displayYuan(persona.summary.payAmountCent)} />
                <Metric label="客单价" value={displayYuan(persona.summary.avgOrderCent)} />
              </Grid>
              <Typography variant="subtitle2">近 30 日行为</Typography>
              <Grid container spacing={1.5}>
                <Metric label="曝光次数" value={displayNumber(persona.last30d.exposePv)} />
                <Metric label="点击次数" value={displayNumber(persona.last30d.clickPv)} />
                <Metric label="看详情" value={displayNumber(persona.last30d.detailPv)} />
                <Metric label="加购" value={displayNumber(persona.last30d.cartPv)} />
                <Metric label="支付订单" value={displayNumber(persona.last30d.payOrders)} />
                <Metric label="支付金额" value={displayYuan(persona.last30d.payAmountCent)} />
              </Grid>
              <Typography variant="subtitle2">偏好分类</Typography>
              {(persona.prefs || []).length ? (
                (persona.prefs || []).map((p) => (
                  <Typography key={p.categoryId} variant="body2">
                    {displayText(p.categoryName)} · 亲和 {displayNumber(p.affinity)} · 购买 {displayNumber(p.payQty)} 件 · 点击{" "}
                    {displayNumber(p.clickCount)}
                  </Typography>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  暂无分类偏好
                </Typography>
              )}
              <Typography variant="subtitle2">最近一笔成交</Typography>
              {persona.lastOrder ? (
                <Typography variant="body2">
                  订单 #{displayNumber(persona.lastOrder.id)} · {displayYuan(persona.lastOrder.amountCent)} ·{" "}
                  {displayNumber(persona.lastOrder.itemQty)} 件 · {persona.lastOrder.fulfillType === "DELIVERY" ? "配送" : "自提"}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  尚未支付成功
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closePersona}>关闭</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
