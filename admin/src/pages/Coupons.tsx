import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableContainer,
  TextField,
} from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import ListPagination, { DEFAULT_PAGE_SIZE, lastPageOf, readPaged } from "../components/ListPagination";
import { useFeedback } from "../components/FeedbackProvider";
import { formatDateRange, formatDateTime } from "../utils/datetime";
import { displayCouponRule, displayNumber, displayText } from "../utils/display";
import { isValidNonNegInt } from "../utils/message";

const empty = {
  name: "",
  type: "FULL_REDUCE",
  minAmountCent: 3000,
  reduceCent: 500,
  discountBp: 9000,
  discountCapCent: 0,
  perUserLimit: 1,
  totalLimit: 0,
  startAt: "",
  endAt: "",
  enabled: true,
};

type Coupon = {
  id: number;
  name: string;
  type: string;
  claimed_count: number;
  per_user_limit: number;
  total_limit: number | null;
  start_at: string;
  end_at: string;
  enabled: number;
  unusedCount?: number;
  usedCount?: number;
  expiredCount?: number;
  issuedCount?: number;
};

type MemberOpt = { id: number; nickname: string; phone: string };
type Holder = {
  id: number;
  userId: number;
  nickname: string;
  phone: string;
  status: string;
  statusLabel: string;
  source: string;
  sourceLabel: string;
  claimedAt: string;
  usedAt?: string | null;
};

export default function Coupons() {
  const fb = useFeedback();
  const [list, setList] = useState<Coupon[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(empty);

  const [grantCoupon, setGrantCoupon] = useState<Coupon | null>(null);
  const [grantAll, setGrantAll] = useState(false);
  const [grantKeyword, setGrantKeyword] = useState("");
  const [grantCandidates, setGrantCandidates] = useState<MemberOpt[]>([]);
  const [grantSelected, setGrantSelected] = useState<MemberOpt[]>([]);
  const [granting, setGranting] = useState(false);

  const [holdersCoupon, setHoldersCoupon] = useState<Coupon | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [holdersTotal, setHoldersTotal] = useState(0);
  const [holdersPage, setHoldersPage] = useState(1);
  const [holdersPageSize, setHoldersPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [holdersStatus, setHoldersStatus] = useState("ALL");

  const load = (p = page, size = pageSize) =>
    api
      .get("/coupons", { params: { page: p, pageSize: size } })
      .then((d) => {
        const data = readPaged<Coupon>(d);
        setList(data.list);
        setTotal(data.total);
        const last = lastPageOf(data.total, size);
        if (p > last) setPage(last);
      })
      .catch((e) => fb.error(e));
  useEffect(() => {
    load(page, pageSize);
  }, [page, pageSize]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return fb.alert("请填写优惠券名称", { title: "请完善信息", severity: "warning" });
    if (!isValidNonNegInt(form.minAmountCent)) return fb.alert("门槛须为大于等于 0 的整数，单位是分，如 3000 表示满 ¥30", { title: "请完善信息", severity: "warning" });
    if (form.type === "FULL_REDUCE" && (!Number.isInteger(form.reduceCent) || form.reduceCent <= 0)) {
      return fb.alert("减免金额须为大于 0 的整数，单位是分，如 500 表示减 ¥5", { title: "请完善信息", severity: "warning" });
    }
    if (form.type === "DISCOUNT" && (form.discountBp < 1000 || form.discountBp > 9900)) {
      return fb.alert("折扣 BP 范围为 1000～9900，9000 表示 9 折", { title: "请完善信息", severity: "warning" });
    }
    if (!Number.isInteger(form.perUserLimit) || form.perUserLimit < 1) {
      return fb.alert("每人限领须为大于等于 1 的整数", { title: "请完善信息", severity: "warning" });
    }
    if (!isValidNonNegInt(form.totalLimit)) {
      return fb.alert("发放总量须为大于等于 0 的整数，0 表示不限量", { title: "请完善信息", severity: "warning" });
    }
    if (!form.startAt || !form.endAt) return fb.alert("请填写有效期开始和结束时间", { title: "请完善信息", severity: "warning" });
    if (form.startAt >= form.endAt) return fb.alert("结束时间须晚于开始时间", { title: "请完善信息", severity: "warning" });
    try {
      await api.post("/coupons", { ...form, name: form.name.trim(), totalLimit: form.totalLimit > 0 ? form.totalLimit : null });
      setForm(empty);
      if (page !== 1) setPage(1);
      else load(1, pageSize);
      await fb.success("优惠券已创建");
    } catch (err) {
      await fb.error(err);
    }
  };

  const voidCoupon = async (c: Coupon) => {
    const ok = await fb.confirm(`确定作废「${c.name}」？已领取未使用的券也将失效。`, { title: "作废优惠券", danger: true, confirmText: "作废" });
    if (!ok) return;
    try {
      await api.delete(`/coupons/${c.id}`);
      load();
      await fb.success("优惠券已作废");
    } catch (e) {
      await fb.error(e);
    }
  };

  const searchMembers = (keyword = grantKeyword) =>
    api
      .get("/members", { params: { keyword, page: 1, pageSize: 20 } })
      .then((d) => {
        const data = readPaged<MemberOpt>(d);
        setGrantCandidates(data.list);
      })
      .catch((e) => fb.error(e));

  const openGrant = (c: Coupon) => {
    setGrantCoupon(c);
    setGrantAll(false);
    setGrantKeyword("");
    setGrantSelected([]);
    setGrantCandidates([]);
    searchMembers("");
  };

  const toggleSelect = (m: MemberOpt) => {
    setGrantSelected((cur) => (cur.some((x) => x.id === m.id) ? cur.filter((x) => x.id !== m.id) : [...cur, m]));
  };

  const submitGrant = async () => {
    if (!grantCoupon) return;
    if (!grantAll && !grantSelected.length) {
      await fb.alert("请选择要发放的会员，或勾选发放给全部会员", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (grantAll) {
      const ok = await fb.confirm(`将向全部会员发放「${grantCoupon.name}」，已达领取上限或库存不足的会自动跳过。确定发放？`, {
        title: "发放给全部会员",
        confirmText: "发放",
      });
      if (!ok) return;
    }
    setGranting(true);
    try {
      const data = (await api.post(`/coupons/${grantCoupon.id}/grant`, grantAll ? { grantAll: true } : { userIds: grantSelected.map((m) => m.id) })) as {
        granted?: number;
        skipped?: number;
      };
      setGrantCoupon(null);
      load();
      await fb.success(`已发放 ${Number(data.granted || 0)} 张，跳过 ${Number(data.skipped || 0)} 张`);
    } catch (e) {
      await fb.error(e);
    }
    setGranting(false);
  };

  const loadHolders = (c: Coupon, p = holdersPage, size = holdersPageSize, status = holdersStatus) =>
    api
      .get(`/coupons/${c.id}/holders`, { params: { page: p, pageSize: size, status: status && status !== "ALL" ? status : undefined } })
      .then((d) => {
        const data = readPaged<Holder>(d);
        setHolders(data.list);
        setHoldersTotal(data.total);
        const last = lastPageOf(data.total, size);
        if (p > last) setHoldersPage(last);
      })
      .catch((e) => fb.error(e));

  const openHolders = (c: Coupon) => {
    const id = Number(c.id);
    if (!Number.isInteger(id) || id <= 0) {
      fb.error(new Error("优惠券不存在"));
      return;
    }
    setHoldersCoupon(c);
    setHoldersPage(1);
    setHoldersStatus("ALL");
    loadHolders(c, 1, holdersPageSize, "ALL");
  };

  const limitText = (c: Coupon) => {
    const per = `每人${displayNumber(c.per_user_limit)}`;
    const total = c.total_limit == null || Number(c.total_limit) <= 0 ? "总量不限" : `总量${displayNumber(c.total_limit)}`;
    return `${per} · ${total}`;
  };

  return (
    <PageContainer title="优惠券" description="带 * 为必填。金额填「分」。折扣 BP：9000 = 9 折。总量填 0 表示不限量。发放会遵守每人限领与总量。">
      <form onSubmit={submit} noValidate>
        <InlineForm>
          <TextField required size="small" label="名称" placeholder="最多 40 字" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} inputProps={{ maxLength: 40 }} />
          <TextField required select size="small" label="类型" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} sx={{ minWidth: 120 }}>
            <MenuItem value="FULL_REDUCE">满减</MenuItem>
            <MenuItem value="DISCOUNT">折扣</MenuItem>
          </TextField>
          <TextField required size="small" type="number" label="门槛(分)" placeholder="如 3000" value={form.minAmountCent} onChange={(e) => setForm({ ...form, minAmountCent: Number(e.target.value) })} inputProps={{ min: 0, step: 1 }} sx={{ width: 130 }} />
          {form.type === "FULL_REDUCE" ? (
            <TextField required size="small" type="number" label="减免(分)" placeholder="如 500" value={form.reduceCent} onChange={(e) => setForm({ ...form, reduceCent: Number(e.target.value) })} inputProps={{ min: 1, step: 1 }} sx={{ width: 130 }} />
          ) : (
            <>
              <TextField required size="small" type="number" label="折扣BP" placeholder="9000=9折" value={form.discountBp} onChange={(e) => setForm({ ...form, discountBp: Number(e.target.value) })} inputProps={{ min: 1000, max: 9900, step: 100 }} sx={{ width: 140 }} />
              <TextField size="small" type="number" label="封顶(分)" placeholder="0 为不封顶" value={form.discountCapCent} onChange={(e) => setForm({ ...form, discountCapCent: Number(e.target.value) })} inputProps={{ min: 0, step: 1 }} sx={{ width: 130 }} />
            </>
          )}
          <TextField required size="small" type="number" label="每人限领" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })} inputProps={{ min: 1, step: 1 }} sx={{ width: 120 }} />
          <TextField size="small" type="number" label="总量(0不限)" value={form.totalLimit} onChange={(e) => setForm({ ...form, totalLimit: Number(e.target.value) })} inputProps={{ min: 0, step: 1 }} sx={{ width: 130 }} />
          <TextField required size="small" type="datetime-local" label="开始" InputLabelProps={{ shrink: true }} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
          <TextField required size="small" type="datetime-local" label="结束" InputLabelProps={{ shrink: true }} value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
          <FormControlLabel control={<Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />} label="启用" />
          <Button type="submit" variant="contained">
            新建
          </Button>
        </InlineForm>
      </form>
      <DataTable
        minWidth={960}
        footer={<ListPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
      >
        <TableHead>
          <TableRow>
            <TableCell>名称</TableCell>
            <TableCell>类型</TableCell>
            <TableCell>门槛/优惠</TableCell>
            <TableCell>限额</TableCell>
            <TableCell>领取</TableCell>
            <TableCell>有效期</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{displayText(c.name)}</TableCell>
              <TableCell>{c.type === "DISCOUNT" ? "折扣" : "满减"}</TableCell>
              <TableCell>{displayCouponRule(c)}</TableCell>
              <TableCell>{limitText(c)}</TableCell>
              <TableCell>
                已领 {displayNumber(c.claimed_count)}
                {c.unusedCount != null ? ` · 未用 ${displayNumber(c.unusedCount)}` : ""}
                {c.usedCount != null ? ` · 已用 ${displayNumber(c.usedCount)}` : ""}
              </TableCell>
              <TableCell>{formatDateRange(c.start_at, c.end_at)}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => openGrant(c)}>
                  发放
                </Button>
                <Button size="small" onClick={() => openHolders(c)}>
                  领取明细
                </Button>
                <Button size="small" color="error" onClick={() => voidCoupon(c)}>
                  作废
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!list.length && <EmptyRow cols={7} />}
        </TableBody>
      </DataTable>

      <Dialog open={!!grantCoupon} onClose={() => !granting && setGrantCoupon(null)} fullWidth maxWidth="sm">
        <DialogTitle>发放优惠券 · {displayText(grantCoupon?.name)}</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={<Switch checked={grantAll} onChange={(e) => setGrantAll(e.target.checked)} />}
            label="发放给全部会员"
          />
          {!grantAll && (
            <Box sx={{ mt: 1 }}>
              <InlineForm>
                <TextField
                  size="small"
                  label="搜索会员"
                  placeholder="昵称/手机"
                  value={grantKeyword}
                  onChange={(e) => setGrantKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchMembers()}
                />
                <Button variant="outlined" onClick={() => searchMembers()}>
                  搜索
                </Button>
              </InlineForm>
              {!!grantSelected.length && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                  {grantSelected.map((m) => (
                    <Chip key={m.id} size="small" label={displayText(m.nickname || m.phone)} onDelete={() => toggleSelect(m)} />
                  ))}
                </Stack>
              )}
              <TableContainer sx={{ maxHeight: 280, border: "1px solid #f0f0f0", borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>昵称</TableCell>
                      <TableCell>手机</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {grantCandidates.map((m) => (
                      <TableRow key={m.id} hover onClick={() => toggleSelect(m)} sx={{ cursor: "pointer" }}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={grantSelected.some((x) => x.id === m.id)} />
                        </TableCell>
                        <TableCell>{displayText(m.nickname)}</TableCell>
                        <TableCell>{displayText(m.phone)}</TableCell>
                      </TableRow>
                    ))}
                    {!grantCandidates.length && <EmptyRow cols={3} />}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGrantCoupon(null)} disabled={granting}>
            取消
          </Button>
          <Button variant="contained" onClick={submitGrant} disabled={granting}>
            {granting ? "发放中…" : "发放"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!holdersCoupon} onClose={() => setHoldersCoupon(null)} fullWidth maxWidth="md">
        <DialogTitle>领取明细 · {displayText(holdersCoupon?.name)}</DialogTitle>
        <DialogContent>
          <InlineForm>
            <TextField
              select
              size="small"
              label="状态"
              value={holdersStatus}
              onChange={(e) => setHoldersStatus(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="ALL">全部</MenuItem>
              <MenuItem value="UNUSED">未使用</MenuItem>
              <MenuItem value="USED">已使用</MenuItem>
              <MenuItem value="EXPIRED">已过期</MenuItem>
            </TextField>
            <Button
              variant="outlined"
              onClick={() => {
                if (!holdersCoupon) return;
                setHoldersPage(1);
                loadHolders(holdersCoupon, 1, holdersPageSize, holdersStatus);
              }}
            >
              筛选
            </Button>
          </InlineForm>
          <TableContainer sx={{ maxHeight: 360, border: "1px solid #f0f0f0", borderRadius: 1 }}>
            <Table size="small" stickyHeader sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>会员</TableCell>
                  <TableCell>手机</TableCell>
                  <TableCell>来源</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>领取时间</TableCell>
                  <TableCell>使用时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {holders.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{displayText(h.nickname)}</TableCell>
                    <TableCell>{displayText(h.phone)}</TableCell>
                    <TableCell>{displayText(h.sourceLabel)}</TableCell>
                    <TableCell>{displayText(h.statusLabel)}</TableCell>
                    <TableCell>{formatDateTime(h.claimedAt, true)}</TableCell>
                    <TableCell>{formatDateTime(h.usedAt, true)}</TableCell>
                  </TableRow>
                ))}
                {!holders.length && <EmptyRow cols={6} />}
              </TableBody>
            </Table>
          </TableContainer>
          <ListPagination
            page={holdersPage}
            pageSize={holdersPageSize}
            total={holdersTotal}
            onPageChange={(p) => {
              setHoldersPage(p);
              if (holdersCoupon) loadHolders(holdersCoupon, p, holdersPageSize, holdersStatus);
            }}
            onPageSizeChange={(size) => {
              setHoldersPageSize(size);
              setHoldersPage(1);
              if (holdersCoupon) loadHolders(holdersCoupon, 1, size, holdersStatus);
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setHoldersCoupon(null)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
