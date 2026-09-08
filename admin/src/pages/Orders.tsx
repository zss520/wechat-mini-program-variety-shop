import { Button, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const STATUS: Record<string, string> = {
  PENDING_PAY: "待付款",
  GROUPING: "拼团中",
  PENDING_PACK: "待备货",
  WAIT_PICKUP: "待自提",
  WAIT_DELIVER: "待配送",
  DELIVERING: "配送中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

type Row = { id: number; order_no: string; status: string; pay_amount_cent: number; fulfill_type: string; nickname?: string; phone?: string; created_at: string };

export default function Orders() {
  const nav = useNavigate();
  const [status, setStatus] = useState("");
  const [list, setList] = useState<Row[]>([]);
  const load = () => api.get("/orders", { params: { status, pageSize: 50 } }).then((d: { list: Row[] }) => setList(d.list));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Typography variant="h5" gutterBottom>
        订单
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField select size="small" label="状态" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">全部</MenuItem>
          {Object.entries(STATUS).map(([k, v]) => (
            <MenuItem key={k} value={k}>
              {v}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={load}>筛选</Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>单号</TableCell>
            <TableCell>顾客</TableCell>
            <TableCell>金额</TableCell>
            <TableCell>履约</TableCell>
            <TableCell>状态</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((o) => (
            <TableRow key={o.id}>
              <TableCell>{o.order_no}</TableCell>
              <TableCell>
                {o.nickname} {o.phone}
              </TableCell>
              <TableCell>¥{(o.pay_amount_cent / 100).toFixed(2)}</TableCell>
              <TableCell>{o.fulfill_type === "PICKUP" ? "自提" : "配送"}</TableCell>
              <TableCell>{STATUS[o.status] || o.status}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => nav(`/orders/${o.id}`)}>
                  详情
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
