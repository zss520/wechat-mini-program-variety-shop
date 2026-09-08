import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";

export default function Notices() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    api.get("/notices", { params: { pageSize: 50 } }).then((d: { list: any[] }) => setList(d.list));
  }, []);
  return (
    <PageContainer title="订阅通知记录" description="开发环境写入本地记录，不调用微信模板。顾客同意「备货完成」后，店主核销前备货会记一条 SENT。">
      <DataTable>
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
              <TableCell>{n.user_id}</TableCell>
              <TableCell>{n.scene}</TableCell>
              <TableCell>
                {n.title} {n.body}
              </TableCell>
              <TableCell>{n.status === "SENT" ? "已记发送" : "未订阅跳过"}</TableCell>
              <TableCell>{String(n.created_at).slice(0, 19)}</TableCell>
            </TableRow>
          ))}
          {!list.length && <EmptyRow cols={5} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
