import { Alert, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

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
  return (
    <>
      <Typography variant="h5" gutterBottom>
        订单 {o.order_no} · {STATUS[o.status]}
      </Typography>
      {err && <Alert severity="error">{err}</Alert>}
      <Typography sx={{ mb: 1 }}>
        履约：{o.fulfill_type === "PICKUP" ? "自提" : "配送"} ｜ 实付 ¥{(o.pay_amount_cent / 100).toFixed(2)} ｜ 提货码 {o.pickup_code || "-"}
      </Typography>
      <Table size="small" sx={{ mb: 2 }}>
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
        </TableBody>
      </Table>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
          <Button color="error" onClick={() => act("/cancel", { reason: "店主取消" })}>
            取消订单
          </Button>
        )}
      </Stack>
    </>
  );
}
