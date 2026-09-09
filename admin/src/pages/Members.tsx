import { Button, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, asRecord, displayNumber, displayText, displayYuan } from "../utils/display";

type Row = { id: number; nickname: string; phone: string; points_balance: number; orderCount: number; payAmountCent: number };

export default function Members() {
  const fb = useFeedback();
  const [keyword, setKeyword] = useState("");
  const [list, setList] = useState<Row[]>([]);
  const load = () =>
    api
      .get("/members", { params: { keyword, pageSize: 50 } })
      .then((d: { list: Row[] }) => setList(asArray(asRecord(d).list)))
      .catch((e) => fb.error(e));
  useEffect(() => {
    load();
  }, []);

  const adjust = async (u: Row) => {
    const values = await fb.prompt({
      title: `调整积分 · ${u.nickname || u.phone || "会员"}`,
      message: "增减数量为整数：正数增加，负数扣减，不能为 0。",
      fields: [
        { name: "delta", label: "积分增减", required: true, placeholder: "20 或 -10", helperText: "必填，整数，如 20 或 -10" },
        { name: "note", label: "备注", placeholder: "店主调整", helperText: "选填，最多 80 字", defaultValue: "店主调整" },
      ],
      confirmText: "提交",
    });
    if (!values) return;
    const delta = Number(values.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      await fb.alert("积分增减须为非 0 整数", { title: "请完善信息", severity: "warning" });
      return;
    }
    const note = (values.note || "店主调整").trim().slice(0, 80);
    try {
      await api.post(`/members/${u.id}/points`, { delta, note });
      load();
      await fb.success("积分已调整");
    } catch (e) {
      await fb.error(e);
    }
  };

  return (
    <PageContainer title="会员">
      <InlineForm>
        <TextField
          size="small"
          label="昵称/手机"
          placeholder="选填，回车查询"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <Button variant="outlined" onClick={load}>
          查询
        </Button>
      </InlineForm>
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
              <TableCell>{displayText(u.nickname)}</TableCell>
              <TableCell>{displayText(u.phone)}</TableCell>
              <TableCell>{displayNumber(u.points_balance)}</TableCell>
              <TableCell>{displayNumber(u.orderCount)}</TableCell>
              <TableCell>{displayYuan(u.payAmountCent)}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => adjust(u)}>
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
