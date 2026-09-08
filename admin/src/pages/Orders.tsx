import { Button, MenuItem, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { formatDateTime } from "../utils/datetime";

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
    <PageContainer title="订单" description="履约与售后从详情页操作">
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <TextField select size="small" label="状态" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">全部</MenuItem>
          {Object.entries(STATUS).map(([k, v]) => (
            <MenuItem key={k} value={k}>
              {v}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" onClick={load}>
          查询
        </Button>
      </Stack>
      <DataTable>
        <TableHead>
          <TableRow>
            <TableCell>单号</TableCell>
            <TableCell>顾客</TableCell>
            <TableCell>金额</TableCell>
            <TableCell>履约</TableCell>
            <TableCell>状态</TableCell>
            <TableCell>下单时间</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((o) => (
            <TableRow key={o.id} hover sx={{ cursor: "pointer" }} onClick={() => nav(`/orders/${o.id}`)}>
              <TableCell>{o.order_no}</TableCell>
              <TableCell>
                {o.nickname} {o.phone}
              </TableCell>
              <TableCell>¥{(o.pay_amount_cent / 100).toFixed(2)}</TableCell>
              <TableCell>{o.fulfill_type === "PICKUP" ? "自提" : "配送"}</TableCell>
              <TableCell>{STATUS[o.status] || o.status}</TableCell>
              <TableCell>{formatDateTime(o.created_at)}</TableCell>
              <TableCell>
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    nav(`/orders/${o.id}`);
                  }}
                >
                  详情
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!list.length && <EmptyRow cols={7} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
