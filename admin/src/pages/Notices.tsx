import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import ListPagination, { DEFAULT_PAGE_SIZE, lastPageOf, readPaged } from "../components/ListPagination";
import { formatDateTime } from "../utils/datetime";
import { displayNumber, displayText } from "../utils/display";

export default function Notices() {
  const [list, setList] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const load = (p = page, size = pageSize) => {
    api
      .get("/notices", { params: { page: p, pageSize: size } })
      .then((d) => {
        const data = readPaged<any>(d);
        setList(data.list);
        setTotal(data.total);
        const last = lastPageOf(data.total, size);
        if (p > last) setPage(last);
      })
      .catch(() => undefined);
  };
  useEffect(() => {
    load(page, pageSize);
  }, [page, pageSize]);
  return (
    <PageContainer title="订阅通知记录" description="开发环境写入本地记录，不调用微信模板。顾客同意「备货完成」后，店主核销前备货会记一条 SENT。">
      <DataTable
        footer={<ListPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
      >
        <TableHead>
          <TableRow>
            <TableCell>用户</TableCell>
            <TableCell>场景</TableCell>
            <TableCell>标题</TableCell>
            <TableCell>状态</TableCell>
            <TableCell>时间</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((n) => (
            <TableRow key={n.id}>
              <TableCell>{displayNumber(n.user_id)}</TableCell>
              <TableCell>{displayText(n.scene)}</TableCell>
              <TableCell>
                {displayText(n.title)} {displayText(n.body, "")}
              </TableCell>
              <TableCell>{n.status === "SENT" ? "已记发送" : "未订阅跳过"}</TableCell>
              <TableCell>{formatDateTime(n.created_at, true)}</TableCell>
            </TableRow>
          ))}
          {!list.length && <EmptyRow cols={5} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
