import { Button, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";

type Row = { id: number; nickname: string; phone: string; points_balance: number; orderCount: number; payAmountCent: number };

export default function Members() {
  const [keyword, setKeyword] = useState("");
  const [list, setList] = useState<Row[]>([]);
  const load = () => api.get("/members", { params: { keyword, pageSize: 50 } }).then((d: { list: Row[] }) => setList(d.list));
  useEffect(() => {
    load();
  }, []);
  const adjust = async (id: number) => {
    const raw = window.prompt("积分增减（如 20 或 -10）");
    if (!raw) return;
    const delta = Number(raw);
    if (!delta) return;
    const note = window.prompt("备注") || "店主调整";
    await api.post(`/members/${id}/points`, { delta, note });
    load();
  };
  return (
    <PageContainer title="会员">
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <TextField size="small" label="昵称/手机" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <Button variant="outlined" onClick={load}>
          查询
        </Button>
      </Stack>
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
              <TableCell>{u.nickname}</TableCell>
              <TableCell>{u.phone}</TableCell>
              <TableCell>{u.points_balance}</TableCell>
              <TableCell>{u.orderCount}</TableCell>
              <TableCell>¥{(u.payAmountCent / 100).toFixed(2)}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => adjust(u.id)}>
                  调积分
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
