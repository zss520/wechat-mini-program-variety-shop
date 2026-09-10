import { Box, Button, TextField, Typography } from "@mui/material";
import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { useFeedback } from "../components/FeedbackProvider";
import { formatDateTime } from "../utils/datetime";
import {
  asArray,
  asRecord,
  displayActivityType,
  displayCouponUsed,
  displayFulfillType,
  displayMinusYuan,
  displayNumber,
  displayPointsUsed,
  displayText,
  displayYuan,
  toFiniteNumber,
} from "../utils/display";

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

function formatAddress(o: Record<string, any>): string {
  const snap = asRecord(o.address_snapshot);
  if (o.fulfill_type === "DELIVERY") {
    return displayText(
      [snap.contact_name, snap.phone, snap.province, snap.city, snap.district, snap.detail].filter(Boolean).join(" "),
      ""
    );
  }
  return displayText([snap.pickup_address, snap.hours, snap.phone].filter(Boolean).join(" · "), "");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 2.5, pb: 2.5, borderBottom: "1px solid #f0f0f0" }}>
      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function MetaGrid({ items }: { items: { k: string; v: string }[] }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 2 }}>
      {items.map((m) => (
        <Box key={m.k}>
          <Typography color="text.secondary" sx={{ fontSize: 13, mb: 0.5 }}>
            {m.k}
          </Typography>
          <Typography sx={{ fontWeight: 600, wordBreak: "break-all" }}>{m.v}</Typography>
        </Box>
      ))}
    </Box>
  );
}

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
  const user = asRecord(o.user);
  const address = displayText(o.fulfill_text, "") || formatAddress(o);
  const discountCent = toFiniteNumber(o.discount_cent) || 0;
  const timePoints = asArray(o.time_points).map((p: Record<string, any>) => ({
    k: displayText(p.label),
    v: formatDateTime(p.at, true),
  }));
  const timeline = asArray(o.timeline);
  const overview = [
    { k: "状态", v: STATUS[o.status] || displayText(o.status) },
    { k: "履约", v: displayFulfillType(o.fulfill_type) },
    { k: "提货码", v: displayText(o.pickup_code) },
    { k: "活动", v: displayActivityType(o.activity_type) },
    { k: "支付单号", v: displayText(o.wx_transaction_id) },
    ...(o.cancel_reason ? [{ k: "取消原因", v: displayText(o.cancel_reason) }] : []),
  ];
  const userMeta = [
    { k: "昵称", v: displayText(user.nickname) },
    { k: "手机", v: displayText(user.phone) },
    { k: "会员编号", v: displayText(user.id) },
    { k: "当前积分", v: displayNumber(user.points_balance) },
    { k: "注册时间", v: formatDateTime(user.created_at) },
    { k: o.fulfill_type === "DELIVERY" ? "收货地址" : "自提信息", v: address || "—" },
  ];
  const amountMeta = [
    { k: "货款", v: displayYuan(o.goods_amount_cent) },
    { k: "运费", v: displayYuan(o.freight_cent) },
    { k: "优惠券", v: displayCouponUsed(o.coupon_name, o.coupon_discount_cent) },
    { k: "积分抵扣", v: displayPointsUsed(o.points_used, o.points_discount_cent) },
    ...(discountCent > 0 ? [{ k: "优惠合计", v: displayMinusYuan(o.discount_cent) }] : []),
    { k: "实付", v: displayYuan(o.pay_amount_cent) },
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
      <Section title="订单信息">
        <MetaGrid items={overview} />
      </Section>
      <Section title="顾客信息">
        <MetaGrid items={userMeta} />
        {o.remark ? (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: "#fff7ed", borderRadius: 1 }}>
            <Typography color="text.secondary" sx={{ fontSize: 13, mb: 0.5 }}>
              用户备注
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>{displayText(o.remark)}</Typography>
          </Box>
        ) : null}
      </Section>
      <Section title="优惠与金额">
        <MetaGrid items={amountMeta} />
      </Section>
      <Section title="履约时间">
        {timePoints.length ? <MetaGrid items={timePoints} /> : <Typography color="text.secondary">暂无时间记录</Typography>}
      </Section>
      <Section title="状态记录">
        {timeline.length ? (
          <DataTable>
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>记录</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {timeline.map((l: Record<string, any>) => (
                <TableRow key={l.id || `${l.to_status}-${l.created_at}`}>
                  <TableCell>{formatDateTime(l.created_at, true)}</TableCell>
                  <TableCell>{displayText(l.note || STATUS[l.to_status])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <Typography color="text.secondary">暂无状态记录</Typography>
        )}
      </Section>
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
