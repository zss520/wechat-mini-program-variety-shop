import { Button, MenuItem, TextField } from "@mui/material";
import { KeyboardEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import ListPagination, { DEFAULT_PAGE_SIZE, lastPageOf, readPaged } from "../components/ListPagination";
import { formatDateTime } from "../utils/datetime";
import { displayFulfillType, displayJoin, displayNumber, displayText, displayYuan } from "../utils/display";
import { useFeedback } from "../components/FeedbackProvider";

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

type Row = { id: number; order_no: string; status: string; pay_amount_cent: number; fulfill_type: string; pickup_code?: string | null; nickname?: string; phone?: string; created_at: string };

export default function Orders() {
  const nav = useNavigate();
  const fb = useFeedback();
  const [status, setStatus] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [customer, setCustomer] = useState("");
  const [pickupCode, setPickupCode] = useState("");
  const [list, setList] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const load = (p = page, size = pageSize) =>
    api
      .get("/orders", {
        params: {
          status: status || undefined,
          orderNo: orderNo.trim() || undefined,
          customer: customer.trim() || undefined,
          pickupCode: pickupCode.trim() || undefined,
          page: p,
          pageSize: size,
        },
      })
      .then((d) => {
        const data = readPaged<Row>(d);
        setList(data.list);
        setTotal(data.total);
        const last = lastPageOf(data.total, size);
        if (p > last) setPage(last);
      })
      .catch((e) => fb.error(e, "订单加载失败"));
  useEffect(() => {
    load(page, pageSize);
  }, [page, pageSize]);
  const query = () => {
    if (page !== 1) setPage(1);
    else load(1, pageSize);
  };
  const onEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      query();
    }
  };
  return (
    <PageContainer title="订单" description={`履约与售后从详情页操作。共 ${displayNumber(total, "0")} 单。`}>
      <InlineForm>
        <TextField size="small" label="单号" placeholder="支持模糊" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} onKeyDown={onEnter} sx={{ minWidth: 180 }} />
        <TextField
          size="small"
          label="顾客"
          placeholder="用户名或手机号"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          onKeyDown={onEnter}
          sx={{ minWidth: 180 }}
        />
        <TextField size="small" label="取货码" placeholder="支持模糊" value={pickupCode} onChange={(e) => setPickupCode(e.target.value)} onKeyDown={onEnter} sx={{ minWidth: 140 }} />
        <TextField select size="small" label="状态" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">全部</MenuItem>
          {Object.entries(STATUS).map(([k, v]) => (
            <MenuItem key={k} value={k}>
              {v}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" onClick={query}>
          查询
        </Button>
      </InlineForm>
      <DataTable
        minWidth={880}
        footer={<ListPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
      >
        <TableHead>
          <TableRow>
            <TableCell>单号</TableCell>
            <TableCell>顾客</TableCell>
            <TableCell>金额</TableCell>
            <TableCell>履约</TableCell>
            <TableCell>取货码</TableCell>
            <TableCell>状态</TableCell>
            <TableCell>下单时间</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((o) => (
            <TableRow key={o.id} hover sx={{ cursor: "pointer" }} onClick={() => nav(`/orders/${o.id}`)}>
              <TableCell>{displayText(o.order_no)}</TableCell>
              <TableCell>
                {displayJoin(o.nickname, o.phone)}
              </TableCell>
              <TableCell>{displayYuan(o.pay_amount_cent)}</TableCell>
              <TableCell>{displayFulfillType(o.fulfill_type)}</TableCell>
              <TableCell sx={{ fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: o.pickup_code ? "0.12em" : 0, fontWeight: o.pickup_code ? 700 : 400 }}>
                {displayText(o.pickup_code)}
              </TableCell>
              <TableCell>{STATUS[o.status] || displayText(o.status)}</TableCell>
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
          {!list.length && <EmptyRow cols={8} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
