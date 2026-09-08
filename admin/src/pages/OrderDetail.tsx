import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { formatDateTime } from "../utils/datetime";

const STATUS: Record<string, string> = {
  PENDING_PAY: "待付款",
  PENDING_PACK: "待备货",
  WAIT_PICKUP: "待自提",
  WAIT_DELIVER: "待配送",
  DELIVERING: "配送中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [o, setO] = useState<Record<string, any> | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const load = () =>
    api.get(`/orders/${id}`).then((d) => {
      setO(d);
      setCode(d.pickup_code || "");
    });
  useEffect(() => {
    load();
  }, [id]);
  const act = async (path: string, body?: unknown) => {
    setErr("");
    try {
      await api.post(`/orders/${id}${path}`, body || {});
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  if (!o) return null;
  const meta = [
    { k: "履约", v: o.fulfill_type === "PICKUP" ? "自提" : "配送" },
    { k: "实付", v: `¥${(o.pay_amount_cent / 100).toFixed(2)}` },
    { k: "提货码", v: o.pickup_code || "-" },
    { k: "状态", v: STATUS[o.status] || o.status },
    { k: "下单时间", v: formatDateTime(o.created_at, true) },
  ];
  return (
    <PageContainer
      title={`订单 ${o.order_no}`}
      extra={
        <Button variant="outlined" onClick={() => nav("/orders")}>
          返回列表
        </Button>
      }
    >
      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}
      <Box
        sx={{
          display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 2,
          mb: 2.5,
          pb: 2.5,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        {meta.map((m) => (
          <Box key={m.k}>
            <Typography color="text.secondary" sx={{ fontSize: 13, mb: 0.5 }}>
              {m.k}
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>{m.v}</Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        商品明细
      </Typography>
      <DataTable>
        <TableHead>
          <TableRow>
            <TableCell>商品</TableCell>
            <TableCell>单价</TableCell>
            <TableCell>数量</TableCell>
            <TableCell>小计</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(o.items || []).map((it: Record<string, any>) => (
            <TableRow key={it.id}>
              <TableCell>{it.name_snapshot}</TableCell>
              <TableCell>¥{(it.price_cent / 100).toFixed(2)}</TableCell>
              <TableCell>{it.qty}</TableCell>
              <TableCell>¥{(it.amount_cent / 100).toFixed(2)}</TableCell>
            </TableRow>
          ))}
          {!(o.items || []).length && <EmptyRow cols={4} />}
        </TableBody>
      </DataTable>
      <InlineForm sx={{ mt: 2.5, mb: 0 }}>
        {o.status === "PENDING_PAY" && (
          <Button variant="outlined" onClick={() => act("/mock-pay")}>
            模拟支付（开发）
          </Button>
        )}
        {o.status === "PENDING_PACK" && (
          <Button variant="contained" onClick={() => act("/pack")}>
            备货完成
          </Button>
        )}
        {o.status === "WAIT_PICKUP" && (
          <>
            <TextField size="small" label="提货码" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button variant="contained" onClick={() => act("/pickup", { code })}>
              核销
            </Button>
          </>
        )}
        {o.status === "WAIT_DELIVER" && (
          <Button variant="contained" onClick={() => act("/deliver/start")}>
            开始配送
          </Button>
        )}
        {o.status === "DELIVERING" && (
          <Button variant="contained" onClick={() => act("/deliver/complete")}>
            确认送达
          </Button>
        )}
        {(o.status === "PENDING_PAY" || o.status === "PENDING_PACK") && (
          <Button color="error" variant="outlined" onClick={() => act("/cancel", { reason: "店主取消" })}>
            取消订单
          </Button>
        )}
      </InlineForm>
    </PageContainer>
  );
}
