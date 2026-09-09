import { Box, Button, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { useFeedback } from "../components/FeedbackProvider";
import { formatDateTime } from "../utils/datetime";
import { asArray, asRecord, displayFulfillType, displayNumber, displayText, displayYuan } from "../utils/display";

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
  const fb = useFeedback();
  const [o, setO] = useState<Record<string, any> | null>(null);
  const [code, setCode] = useState("");
  const load = () =>
    api
      .get(`/orders/${id}`)
      .then((d) => {
        setO(asRecord(d));
        setCode(asRecord(d).pickup_code || "");
      })
      .catch((e) => fb.error(e, "订单加载失败"));
  useEffect(() => {
    load();
  }, [id]);

  const act = async (path: string, body?: unknown, success = "操作已完成") => {
    try {
      await api.post(`/orders/${id}${path}`, body || {});
      load();
      await fb.success(success);
    } catch (e) {
      await fb.error(e);
    }
  };

  if (!o) return null;
  const meta = [
    { k: "履约", v: displayFulfillType(o.fulfill_type) },
    { k: "实付", v: displayYuan(o.pay_amount_cent) },
    { k: "提货码", v: displayText(o.pickup_code) },
    { k: "状态", v: STATUS[o.status] || displayText(o.status) },
    { k: "下单时间", v: formatDateTime(o.created_at, true) },
  ];
  return (
    <PageContainer
      title={`订单 ${displayText(o.order_no)}`}
      extra={
        <Button variant="outlined" onClick={() => nav("/orders")}>
          返回列表
        </Button>
      }
    >
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
          {asArray(o.items).map((it: Record<string, any>) => (
            <TableRow key={it.id}>
              <TableCell>{displayText(it.name_snapshot)}</TableCell>
              <TableCell>{displayYuan(it.price_cent)}</TableCell>
              <TableCell>{displayNumber(it.qty)}</TableCell>
              <TableCell>{displayYuan(it.amount_cent)}</TableCell>
            </TableRow>
          ))}
          {!asArray(o.items).length && <EmptyRow cols={4} />}
        </TableBody>
      </DataTable>
      <InlineForm sx={{ mt: 2.5, mb: 0 }}>
        {o.status === "PENDING_PAY" && (
          <Button
            variant="outlined"
            onClick={async () => {
              const ok = await fb.confirm("仅开发环境可用。确定模拟支付该订单？", { title: "模拟支付" });
              if (ok) act("/mock-pay", {}, "已模拟支付");
            }}
          >
            模拟支付（开发）
          </Button>
        )}
        {o.status === "PENDING_PACK" && (
          <Button
            variant="contained"
            onClick={async () => {
              const ok = await fb.confirm("确认备货完成？顾客将收到待取货状态。", { title: "备货完成" });
              if (ok) act("/pack", {}, "已标记备货完成");
            }}
          >
            备货完成
          </Button>
        )}
        {o.status === "WAIT_PICKUP" && (
          <>
            <TextField
              required
              size="small"
              label="提货码"
              placeholder="顾客出示的编码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={async () => {
                const v = code.trim();
                if (!v) {
                  await fb.alert("请填写提货码", { title: "请完善信息", severity: "warning" });
                  return;
                }
                act("/pickup", { code: v }, "核销成功");
              }}
            >
              核销
            </Button>
          </>
        )}
        {o.status === "WAIT_DELIVER" && (
          <Button
            variant="contained"
            onClick={async () => {
              const ok = await fb.confirm("确认开始配送？", { title: "开始配送" });
              if (ok) act("/deliver/start", {}, "已开始配送");
            }}
          >
            开始配送
          </Button>
        )}
        {o.status === "DELIVERING" && (
          <Button
            variant="contained"
            onClick={async () => {
              const ok = await fb.confirm("确认顾客已收到货物？", { title: "确认送达" });
              if (ok) act("/deliver/complete", {}, "已确认送达");
            }}
          >
            确认送达
          </Button>
        )}
        {(o.status === "PENDING_PAY" || o.status === "PENDING_PACK") && (
          <Button
            color="error"
            variant="outlined"
            onClick={async () => {
              const ok = await fb.confirm("取消后库存将回滚，确定取消该订单？", { title: "取消订单", danger: true, confirmText: "取消订单" });
              if (ok) act("/cancel", { reason: "店主取消" }, "订单已取消");
            }}
          >
            取消订单
          </Button>
        )}
      </InlineForm>
    </PageContainer>
  );
}
