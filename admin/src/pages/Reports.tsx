import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import dayjs from "dayjs";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import ListPagination, { DEFAULT_PAGE_SIZE, lastPageOf, readPaged, useClientPager } from "../components/ListPagination";
import { asArray, asRecord, displayNumber, displayPercent, displayText, displayYuan } from "../utils/display";
import { useFeedback } from "../components/FeedbackProvider";

type FunnelStep = { key?: string; name: string; uv: number };
type Signal = { type?: string; goodsId?: number; name?: string; message?: string };
type GoodsRow = {
  id: number;
  name: string;
  cover_url?: string;
  category_name?: string;
  expose_uv?: number;
  ctr?: number;
  cartRate?: number;
  cvr?: number;
  exposeCvr?: number;
  pay_qty?: number;
  pay_amount_cent?: number;
  heat_score?: number;
  manual_weight?: number;
  ctrSampleOk?: boolean;
  cartSampleOk?: boolean;
  cvrSampleOk?: boolean;
  exposeCvrSampleOk?: boolean;
};

const SIGNAL_TYPES = [
  { key: "HOT_LOW_STOCK", label: "热度高库存低", color: "error" as const, hint: "热销可能断货，建议补货" },
  { key: "LOW_CTR", label: "高曝光低点击", color: "warning" as const, hint: "检查主图与价格" },
  { key: "LOW_CVR", label: "高点击低购买", color: "warning" as const, hint: "检查详情或售价" },
  { key: "NO_EXPOSE", label: "有货无曝光", color: "default" as const, hint: "考虑加入推荐或提高权重" },
] as const;

type SignalFilter = "ALL" | "URGENT" | (typeof SIGNAL_TYPES)[number]["key"];

const URGENT_TYPES = new Set(["HOT_LOW_STOCK", "LOW_CTR", "LOW_CVR"]);

function todayStr() {
  return dayjs().format("YYYY-MM-DD");
}

function convRate(curr: number, prev: number | undefined) {
  if (prev == null) return null;
  if (!(prev > 0)) return null;
  return curr / prev;
}

function convColor(rate: number | null) {
  if (rate == null) return "text.secondary";
  if (rate >= 0.5) return "success.main";
  if (rate >= 0.2) return "text.primary";
  if (rate > 0) return "warning.main";
  return "error.main";
}

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

function signalMeta(type: string | undefined) {
  return SIGNAL_TYPES.find((t) => t.key === type) || SIGNAL_TYPES[3];
}

function HeatBar({ value }: { value: unknown }) {
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 96 }}>
      <Box sx={{ flex: 1, height: 6, bgcolor: "#f5f5f5", borderRadius: 1, overflow: "hidden" }}>
        <Box sx={{ width: `${n}%`, height: "100%", bgcolor: n >= 70 ? "error.main" : "primary.main", borderRadius: 1 }} />
      </Box>
      <Typography variant="body2" sx={{ width: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {displayNumber(n, "0")}
      </Typography>
    </Stack>
  );
}

function FunnelBoard({ steps }: { steps: FunnelStep[] }) {
  const maxUv = Math.max(1, ...steps.map((s) => Number(s.uv) || 0));
  const first = Number(steps[0]?.uv) || 0;
  const last = Number(steps[steps.length - 1]?.uv) || 0;
  const overall = convRate(last, first);
  const hasTraffic = steps.some((s) => Number(s.uv) > 0);
  const inverted = steps.some((s, i) => i > 0 && Number(s.uv) > Number(steps[i - 1]?.uv));
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">转化漏斗</Typography>
          <Typography variant="body2" color="text.secondary">
            每步为去重人数。右侧比例是相对上一步的转化；上一步为 0 时显示 —。
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            打开 → 支付
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: convColor(overall), fontVariantNumeric: "tabular-nums" }}>
            {overall == null ? "—" : displayPercent(overall)}
          </Typography>
        </Box>
      </Stack>
      <Stack spacing={1.25}>
        {steps.map((s, i) => {
          const uv = Number(s.uv) || 0;
          const prev = i === 0 ? undefined : Number(steps[i - 1]?.uv) || 0;
          const rate = convRate(uv, prev);
          const pct = Math.round((uv / maxUv) * 100);
          return (
            <Stack key={s.key || s.name} direction="row" alignItems="center" spacing={1.5}>
              <Typography sx={{ width: { xs: 72, sm: 88 }, flexShrink: 0, fontSize: 13 }} noWrap title={s.name}>
                {displayText(s.name)}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0, height: 28, bgcolor: "#f5f5f5", borderRadius: 1, overflow: "hidden", position: "relative" }}>
                <Box
                  sx={{
                    width: `${pct}%`,
                    height: "100%",
                    bgcolor: i === steps.length - 1 ? "#C2410C" : "#fdba74",
                    borderRadius: 1,
                    minWidth: uv > 0 ? 4 : 0,
                    transition: "width .2s ease",
                  }}
                />
              </Box>
              <Typography sx={{ width: 40, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {displayNumber(uv, "0")}
              </Typography>
              <Typography
                sx={{
                  width: { xs: 52, sm: 64 },
                  textAlign: "right",
                  fontSize: 13,
                  color: i === 0 ? "text.secondary" : convColor(rate),
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {i === 0 ? "起点" : rate == null ? "—" : displayPercent(rate)}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
      {!steps.length && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          暂无漏斗数据
        </Typography>
      )}
      {!!steps.length && !hasTraffic && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          该时段还没有访问。小程序产生浏览后，这里会显示各步人数与转化。
        </Typography>
      )}
      {hasTraffic && first === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          打开小程序埋点为 0，整体转化暂无法计算。支付人数按订单统计，可能仍有成交。
        </Typography>
      )}
      {hasTraffic && inverted && first > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          后一步人数高于前一步时，通常是浏览埋点与订单统计口径不同，不以漏斗形状强行对齐。
        </Typography>
      )}
    </Paper>
  );
}

export default function Reports() {
  const fb = useFeedback();
  const nav = useNavigate();
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);
  const [funnel, setFunnel] = useState<{ steps: FunnelStep[] }>({ steps: [] });
  const [goods, setGoods] = useState<GoodsRow[]>([]);
  const [goodsTotal, setGoodsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("ALL");
  const [loading, setLoading] = useState(true);

  const load = async (p = page, size = pageSize, rangeFrom = from, rangeTo = to) => {
    if (!rangeFrom || !rangeTo) {
      await fb.alert("请选择查询起止日期，格式为年-月-日", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (rangeFrom > rangeTo) {
      await fb.alert("结束日期不能早于开始日期", { title: "请完善信息", severity: "warning" });
      return;
    }
    setLoading(true);
    try {
      const [funnelData, goodsData, signalData] = await Promise.all([
        api.get("/reports/funnel", { params: { from: rangeFrom, to: rangeTo } }),
        api.get("/reports/goods", { params: { from: rangeFrom, to: rangeTo, page: p, pageSize: size } }),
        api.get("/reports/signals", { params: { from: rangeFrom, to: rangeTo } }),
      ]);
      const paged = readPaged<GoodsRow>(goodsData);
      setFunnel({ steps: asArray<FunnelStep>(asRecord(funnelData).steps) });
      setGoods(paged.list);
      setGoodsTotal(paged.total);
      setSignals(asArray<Signal>(signalData));
      const last = lastPageOf(paged.total, size);
      if (p > last) setPage(last);
    } catch (e) {
      await fb.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(page, pageSize);
  }, [page, pageSize]);

  const query = (rangeFrom = from, rangeTo = to) => {
    if (page !== 1) setPage(1);
    else void load(1, pageSize, rangeFrom, rangeTo);
  };

  const applyPreset = (days: number) => {
    const end = todayStr();
    const start = dayjs().subtract(days - 1, "day").format("YYYY-MM-DD");
    setFrom(start);
    setTo(end);
    query(start, end);
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: signals.length, URGENT: 0 };
    for (const t of SIGNAL_TYPES) map[t.key] = 0;
    for (const s of signals) {
      const k = String(s.type || "");
      if (k in map) map[k] += 1;
      if (URGENT_TYPES.has(k)) map.URGENT += 1;
    }
    return map;
  }, [signals]);

  const filteredSignals = useMemo(() => {
    const rank = (t: string) => SIGNAL_TYPES.findIndex((x) => x.key === t);
    const list = signals.filter((s) => {
      const t = String(s.type || "");
      if (signalFilter === "ALL") return true;
      if (signalFilter === "URGENT") return URGENT_TYPES.has(t);
      return t === signalFilter;
    });
    return [...list].sort((a, b) => rank(String(a.type)) - rank(String(b.type)) || displayText(a.name).localeCompare(displayText(b.name), "zh"));
  }, [signals, signalFilter]);

  const signalPager = useClientPager(filteredSignals, 10);

  const recompute = async () => {
    try {
      setLoading(true);
      await api.post("/jobs/recompute-heat");
      await load();
      await fb.success("热度已重算");
    } catch (e) {
      await fb.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      card={false}
      title="数据分析"
      description="漏斗看从打开到支付掉在哪一步；异常按类型筛选后可点进商品处理。人数不足 10 标「样本少」。"
    >
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, mb: 2 }}>
        <InlineForm sx={{ mb: 0 }}>
          <Button variant={from === todayStr() && to === todayStr() ? "contained" : "outlined"} onClick={() => applyPreset(1)}>
            今日
          </Button>
          <Button
            variant={from === dayjs().subtract(6, "day").format("YYYY-MM-DD") && to === todayStr() ? "contained" : "outlined"}
            onClick={() => applyPreset(7)}
          >
            近 7 日
          </Button>
          <Button
            variant={from === dayjs().subtract(29, "day").format("YYYY-MM-DD") && to === todayStr() ? "contained" : "outlined"}
            onClick={() => applyPreset(30)}
          >
            近 30 日
          </Button>
          <TextField required type="date" size="small" label="从" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField required type="date" size="small" label="到" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outlined" onClick={() => query()} disabled={loading}>
            查询
          </Button>
          <Button variant="contained" onClick={() => void recompute()} disabled={loading}>
            重算热度
          </Button>
        </InlineForm>
      </Paper>
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      <FunnelBoard steps={funnel.steps} />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="h6">异常信号</Typography>
            <Typography variant="body2" color="text.secondary">
              {counts.URGENT ? `有 ${counts.URGENT} 条更需要先处理（热无货、低点击、低购买）。` : "暂无紧急异常，可查看有货却无人看到的商品。"}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            共 {displayNumber(signals.length, "0")} 条
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
          <Chip
            clickable
            size="small"
            label={`全部 ${counts.ALL || 0}`}
            color={signalFilter === "ALL" ? "primary" : "default"}
            variant={signalFilter === "ALL" ? "filled" : "outlined"}
            onClick={() => {
              setSignalFilter("ALL");
              signalPager.setPage(1);
            }}
          />
          <Chip
            clickable
            size="small"
            label={`待处理 ${counts.URGENT || 0}`}
            color={signalFilter === "URGENT" ? "error" : "default"}
            variant={signalFilter === "URGENT" ? "filled" : "outlined"}
            onClick={() => {
              setSignalFilter("URGENT");
              signalPager.setPage(1);
            }}
          />
          {SIGNAL_TYPES.map((t) => (
            <Chip
              key={t.key}
              clickable
              size="small"
              color={signalFilter === t.key ? t.color : "default"}
              variant={signalFilter === t.key ? "filled" : "outlined"}
              label={`${t.label} ${counts[t.key] || 0}`}
              onClick={() => {
                setSignalFilter(t.key);
                signalPager.setPage(1);
              }}
            />
          ))}
        </Stack>
        <DataTable
          minWidth={640}
          footer={
            <ListPagination
              page={signalPager.page}
              pageSize={signalPager.pageSize}
              total={signalPager.total}
              onPageChange={signalPager.setPage}
              onPageSizeChange={signalPager.setPageSize}
            />
          }
        >
          <TableHead>
            <TableRow>
              <TableCell>类型</TableCell>
              <TableCell>商品</TableCell>
              <TableCell>建议</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {signalPager.rows.map((s, i) => {
              const meta = signalMeta(s.type);
              const gid = Number(s.goodsId);
              return (
                <TableRow key={`${s.type}-${gid || s.name}-${i}`} hover={!!gid} sx={gid ? { cursor: "pointer" } : undefined} onClick={() => gid && nav(`/goods/${gid}`)}>
                  <TableCell>
                    <Chip size="small" color={meta.color} label={meta.label} />
                  </TableCell>
                  <TableCell>{displayText(s.name)}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13 }}>{displayText(s.message || meta.hint)}</Typography>
                  </TableCell>
                  <TableCell>
                    {gid ? (
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          nav(`/goods/${gid}`);
                        }}
                      >
                        去处理
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!signalPager.total && <EmptyRow cols={4} text="该时段没有异常信号" />}
          </TableBody>
        </DataTable>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          商品分析
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          热度 0–100。购买率以支付成功人数为准，不以客户端 pay_success 为准。
        </Typography>
        <DataTable
          minWidth={1080}
          footer={
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={goodsTotal}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          }
        >
          <TableHead>
            <TableRow>
              <TableCell>商品</TableCell>
              <TableCell>分类</TableCell>
              <TableCell>
                <Tooltip title="去重后的曝光人数">
                  <span>曝光 UV</span>
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
                <Tooltip title="支付成功人数 / 点击人数">
                  <span>点击购买率</span>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Tooltip title="支付成功人数 / 曝光人数，衡量坑位质量">
                  <span>曝光购买率</span>
                </Tooltip>
              </TableCell>
              <TableCell>支付件数</TableCell>
              <TableCell>支付金额</TableCell>
              <TableCell>
                <Tooltip title="0–100，近7日为主并做转化平滑">
                  <span>热度</span>
                </Tooltip>
              </TableCell>
              <TableCell>加权</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {goods.map((g) => (
              <TableRow key={g.id} hover sx={{ cursor: "pointer" }} onClick={() => nav(`/goods/${g.id}`)}>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                    <Box
                      component="img"
                      src={g.cover_url || "/static/placeholders/empty.png"}
                      alt=""
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.onerror = null;
                        el.src = "/static/placeholders/empty.png";
                      }}
                      sx={{ width: 40, height: 40, objectFit: "cover", borderRadius: 1, bgcolor: "#f5f5f5", flexShrink: 0 }}
                    />
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {displayText(g.name)}
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>{displayText(g.category_name)}</TableCell>
                <TableCell>{displayNumber(g.expose_uv)}</TableCell>
                <TableCell>{rateCell(!!g.ctrSampleOk, g.ctr)}</TableCell>
                <TableCell>{rateCell(!!g.cartSampleOk, g.cartRate)}</TableCell>
                <TableCell>{rateCell(!!g.cvrSampleOk, g.cvr)}</TableCell>
                <TableCell>{rateCell(!!g.exposeCvrSampleOk, g.exposeCvr)}</TableCell>
                <TableCell>{displayNumber(g.pay_qty)}</TableCell>
                <TableCell>{displayYuan(g.pay_amount_cent)}</TableCell>
                <TableCell>
                  <HeatBar value={g.heat_score} />
                </TableCell>
                <TableCell>{displayNumber(g.manual_weight)}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      nav(`/goods/${g.id}`);
                    }}
                  >
                    查看
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!goods.length && <EmptyRow cols={12} text="该时段暂无商品分析。需小程序产生浏览后出现。" />}
          </TableBody>
        </DataTable>
      </Paper>
    </PageContainer>
  );
}
