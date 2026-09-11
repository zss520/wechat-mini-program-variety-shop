import { Button, FormControlLabel, MenuItem, Switch, TextField } from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import ListPagination, { DEFAULT_PAGE_SIZE, lastPageOf, readPaged } from "../components/ListPagination";
import { useFeedback } from "../components/FeedbackProvider";
import { formatDateRange } from "../utils/datetime";
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
  totalLimit: 100,
  startAt: "",
  endAt: "",
  enabled: true,
};

export default function Coupons() {
  const fb = useFeedback();
  const [list, setList] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(empty);
  const load = (p = page, size = pageSize) =>
    api
      .get("/coupons", { params: { page: p, pageSize: size } })
      .then((d) => {
        const data = readPaged<any>(d);
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
    if (!form.startAt || !form.endAt) return fb.alert("请填写有效期开始和结束时间", { title: "请完善信息", severity: "warning" });
    if (form.startAt >= form.endAt) return fb.alert("结束时间须晚于开始时间", { title: "请完善信息", severity: "warning" });
    try {
      await api.post("/coupons", { ...form, name: form.name.trim() });
      setForm(empty);
      if (page !== 1) setPage(1);
      else load(1, pageSize);
      await fb.success("优惠券已创建");
    } catch (err) {
      await fb.error(err);
    }
  };

  const voidCoupon = async (c: any) => {
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

  return (
    <PageContainer title="优惠券" description="带 * 为必填。金额填「分」。折扣 BP：9000 = 9 折。">
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
          <TextField required size="small" type="datetime-local" label="开始" InputLabelProps={{ shrink: true }} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
          <TextField required size="small" type="datetime-local" label="结束" InputLabelProps={{ shrink: true }} value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
          <FormControlLabel control={<Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />} label="启用" />
          <Button type="submit" variant="contained">
            新建
          </Button>
        </InlineForm>
      </form>
      <DataTable
        footer={<ListPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
      >
        <TableHead>
          <TableRow>
            <TableCell>名称</TableCell>
            <TableCell>类型</TableCell>
            <TableCell>门槛/优惠</TableCell>
            <TableCell>已领</TableCell>
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
              <TableCell>{displayNumber(c.claimed_count)}</TableCell>
              <TableCell>{formatDateRange(c.start_at, c.end_at)}</TableCell>
              <TableCell>
                <Button size="small" color="error" onClick={() => voidCoupon(c)}>
                  作废
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!list.length && <EmptyRow cols={6} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
