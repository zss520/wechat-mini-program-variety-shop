import { Button, Switch, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import ListPagination, { useClientPager } from "../components/ListPagination";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, displayText } from "../utils/display";

type Cat = { id: number; name: string; sort: number; enabled: number };

function parseSort(raw: string) {
  const t = raw.trim();
  if (t === "") return 0;
  const v = Number(t);
  return Number.isInteger(v) ? v : null;
}

export default function Categories() {
  const fb = useFeedback();
  const [list, setList] = useState<Cat[]>([]);
  const pager = useClientPager(list);
  const [name, setName] = useState("");
  const [sort, setSort] = useState("0");
  const load = () => api.get("/categories").then((d) => setList(asArray(d))).catch((e) => fb.error(e));
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const n = name.trim();
    if (!n) {
      await fb.alert("请填写分类名称", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (n.length > 20) {
      await fb.alert("分类名称最多 20 个字", { title: "请完善信息", severity: "warning" });
      return;
    }
    const s = parseSort(sort);
    if (s == null) {
      await fb.alert("排序须为整数，数字越大越靠前", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      await api.post("/categories", { name: n, sort: s });
      setName("");
      setSort("0");
      load();
      await fb.success("分类已新增");
    } catch (e) {
      await fb.error(e);
    }
  };

  const saveSort = async (c: Cat, raw: string) => {
    const s = parseSort(raw);
    if (s == null) {
      await fb.alert("排序须为整数，数字越大越靠前", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (s === c.sort) return;
    try {
      await api.put(`/categories/${c.id}`, { sort: s });
      load();
    } catch (e) {
      await fb.error(e);
    }
  };

  const rename = async (c: Cat) => {
    const values = await fb.prompt({
      title: "修改分类名称",
      fields: [
        { name: "name", label: "名称", required: true, helperText: "必填，最多 20 个字", defaultValue: c.name },
      ],
      confirmText: "保存",
    });
    if (!values) return;
    const n = values.name.trim();
    if (!n || n.length > 20) {
      await fb.alert("分类名称须为 1～20 个字", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      await api.put(`/categories/${c.id}`, { name: n });
      load();
      await fb.success("分类已更新");
    } catch (e) {
      await fb.error(e);
    }
  };

  const remove = async (c: Cat) => {
    const ok = await fb.confirm(`确定删除「${c.name}」？若该分类下仍有商品将无法删除。`, {
      title: "删除分类",
      danger: true,
      confirmText: "删除",
    });
    if (!ok) return;
    try {
      await api.delete(`/categories/${c.id}`);
      load();
      await fb.success("分类已删除");
    } catch (e) {
      await fb.error(e);
    }
  };

  return (
    <PageContainer title="分类" description="带 * 的为必填。名称 1～20 个字。排序为整数，数字越大越靠前。">
      <InlineForm>
        <TextField
          required
          size="small"
          label="名称"
          placeholder="如 酒水饮料"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          inputProps={{ maxLength: 20 }}
        />
        <TextField
          size="small"
          type="number"
          label="排序"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          sx={{ width: 100 }}
          inputProps={{ step: 1, title: "整数，越大越靠前" }}
        />
        <Button variant="contained" onClick={add}>
          新增
        </Button>
      </InlineForm>
      <DataTable
        footer={<ListPagination page={pager.page} pageSize={pager.pageSize} total={pager.total} onPageChange={pager.setPage} onPageSizeChange={pager.setPageSize} />}
      >
        <TableHead>
          <TableRow>
            <TableCell>名称</TableCell>
            <TableCell>排序</TableCell>
            <TableCell>启用</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pager.rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{displayText(c.name)}</TableCell>
              <TableCell>
                <TextField
                  key={`${c.id}-${c.sort}`}
                  size="small"
                  type="number"
                  defaultValue={c.sort}
                  sx={{ width: 88 }}
                  inputProps={{ step: 1, title: "整数，越大越靠前，失焦保存" }}
                  onBlur={(e) => saveSort(c, e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Switch
                  checked={!!c.enabled}
                  onChange={(e) => api.put(`/categories/${c.id}`, { enabled: e.target.checked }).then(load).catch((err) => fb.error(err))}
                />
              </TableCell>
              <TableCell>
                <Button size="small" onClick={() => rename(c)}>
                  改名
                </Button>
                <Button color="error" onClick={() => remove(c)}>
                  删除
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!pager.total && <EmptyRow cols={4} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
