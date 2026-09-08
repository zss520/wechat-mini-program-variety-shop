import { Button, FormControlLabel, MenuItem, Switch, TextField } from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { formatDateRange } from "../utils/datetime";

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
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState(empty);
  const load = () => api.get("/coupons").then((d: { list: any[] }) => setList(d.list));
  useEffect(() => {
    load();
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post("/coupons", form);
    setForm(empty);
    load();
  };
  return (
    <PageContainer title="优惠券">
      <form onSubmit={submit}>
        <InlineForm>
          <TextField required size="small" label="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField select size="small" label="类型" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} sx={{ minWidth: 120 }}>
            <MenuItem value="FULL_REDUCE">满减</MenuItem>
            <MenuItem value="DISCOUNT">折扣</MenuItem>
          </TextField>
          <TextField size="small" type="number" label="门槛(分)" value={form.minAmountCent} onChange={(e) => setForm({ ...form, minAmountCent: Number(e.target.value) })} />
          {form.type === "FULL_REDUCE" ? (
            <TextField size="small" type="number" label="减免(分)" value={form.reduceCent} onChange={(e) => setForm({ ...form, reduceCent: Number(e.target.value) })} />
          ) : (
            <>
              <TextField size="small" type="number" label="折扣BP(9000=9折)" value={form.discountBp} onChange={(e) => setForm({ ...form, discountBp: Number(e.target.value) })} />
              <TextField size="small" type="number" label="封顶(分)" value={form.discountCapCent} onChange={(e) => setForm({ ...form, discountCapCent: Number(e.target.value) })} />
            </>
          )}
          <TextField size="small" type="datetime-local" label="开始" InputLabelProps={{ shrink: true }} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
          <TextField size="small" type="datetime-local" label="结束" InputLabelProps={{ shrink: true }} value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
          <FormControlLabel control={<Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />} label="启用" />
          <Button type="submit" variant="contained">
            新建
          </Button>
        </InlineForm>
      </form>
      <DataTable>
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
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.type === "DISCOUNT" ? "折扣" : "满减"}</TableCell>
              <TableCell>
                满{(c.min_amount_cent / 100).toFixed(0)}
                {c.type === "DISCOUNT" ? ` 打${(c.discount_bp / 1000).toFixed(1)}折` : ` 减${(c.reduce_cent / 100).toFixed(0)}`}
              </TableCell>
              <TableCell>{c.claimed_count}</TableCell>
              <TableCell>
                {formatDateRange(c.start_at, c.end_at)}
              </TableCell>
              <TableCell>
                <Button size="small" color="error" onClick={() => api.delete(`/coupons/${c.id}`).then(load)}>
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
