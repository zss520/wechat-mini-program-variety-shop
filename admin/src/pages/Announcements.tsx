import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import JumpPicker, { Cat, goodsDetailPath } from "../components/JumpPicker";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import ListPagination, { useClientPager } from "../components/ListPagination";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, displayText } from "../utils/display";

type Announcement = {
  id: number;
  title: string;
  content: string;
  link_type: string;
  link_value: string;
  sort: number;
  enabled: number;
  goods_name?: string;
  category_id?: number | null;
  mp_path?: string;
};

function parseSort(raw: string) {
  const t = raw.trim();
  if (t === "") return 0;
  const v = Number(t);
  return Number.isInteger(v) ? v : null;
}

export default function Announcements() {
  const fb = useFeedback();
  const [list, setList] = useState<Announcement[]>([]);
  const pager = useClientPager(list);
  const [cats, setCats] = useState<Cat[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sort, setSort] = useState("0");
  const [categoryId, setCategoryId] = useState(0);
  const [goodsId, setGoodsId] = useState(0);
  const [edit, setEdit] = useState<Announcement | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCat, setEditCat] = useState(0);
  const [editGoods, setEditGoods] = useState(0);

  const load = () => {
    api.get("/announcements").then((d) => setList(asArray(d))).catch((e) => fb.error(e));
    api.get("/categories").then((d) => setCats(asArray<Cat>(d))).catch((e) => fb.error(e));
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!title.trim()) {
      await fb.alert("请填写公告标题", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (title.trim().length > 40) {
      await fb.alert("标题最多 40 个字", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (!content.trim()) {
      await fb.alert("请填写公告内容", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (content.trim().length > 200) {
      await fb.alert("内容最多 200 个字", { title: "请完善信息", severity: "warning" });
      return;
    }
    const s = parseSort(sort);
    if (s == null) {
      await fb.alert("排序须为整数，数字越大越靠前", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (categoryId && !goodsId) {
      await fb.alert("请选择要跳转的商品，或不选分类表示不跳转", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      await api.post("/announcements", {
        title: title.trim(),
        content: content.trim(),
        sort: s,
        linkType: goodsId ? "GOODS" : "NONE",
        linkValue: goodsId ? String(goodsId) : "",
      });
      setTitle("");
      setContent("");
      setSort("0");
      setCategoryId(0);
      setGoodsId(0);
      load();
      await fb.success("公告已发布");
    } catch (e) {
      await fb.error(e);
    }
  };

  const saveSort = async (row: Announcement, raw: string) => {
    const s = parseSort(raw);
    if (s == null) {
      await fb.alert("排序须为整数，数字越大越靠前", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (s === row.sort) return;
    try {
      await api.put(`/announcements/${row.id}`, { sort: s });
      load();
    } catch (e) {
      await fb.error(e);
    }
  };

  const openEdit = (row: Announcement) => {
    setEdit(row);
    setEditTitle(row.title || "");
    setEditContent(row.content || "");
    setEditCat(Number(row.category_id) || 0);
    setEditGoods(row.link_type === "GOODS" ? Number(row.link_value) || 0 : 0);
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!editTitle.trim()) {
      await fb.alert("请填写公告标题", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (!editContent.trim()) {
      await fb.alert("请填写公告内容", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (editCat && !editGoods) {
      await fb.alert("请选择要跳转的商品，或不选分类表示不跳转", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      await api.put(`/announcements/${edit.id}`, {
        title: editTitle.trim(),
        content: editContent.trim(),
        linkType: editGoods ? "GOODS" : "NONE",
        linkValue: editGoods ? String(editGoods) : "",
      });
      setEdit(null);
      load();
      await fb.success("公告已保存");
    } catch (e) {
      await fb.error(e);
    }
  };

  const copyPath = async (path: string) => {
    if (!path) {
      await fb.alert("当前公告未配置跳转", { title: "请注意", severity: "warning" });
      return;
    }
    try {
      await navigator.clipboard.writeText(path);
      await fb.success("已复制小程序地址");
    } catch {
      await fb.alert(path, { title: "小程序地址" });
    }
  };

  const remove = async (row: Announcement) => {
    const ok = await fb.confirm(`确定删除公告「${row.title || "未命名"}」？`, { title: "删除公告", danger: true, confirmText: "删除" });
    if (!ok) return;
    try {
      await api.delete(`/announcements/${row.id}`);
      load();
      await fb.success("公告已删除");
    } catch (e) {
      await fb.error(e);
    }
  };

  const previewPath = goodsId ? goodsDetailPath(goodsId, "announce") : "";
  const editPath = editGoods ? goodsDetailPath(editGoods, "announce") : "";

  return (
    <PageContainer title="通知公告" description="可同时发布并启用多条，最多 20 条。标题会在小程序首页滚动展示，点进列表可看全文。跳转与轮播相同：不选分类表示不跳转，选分类后再选商品。">
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <InlineForm sx={{ mb: 0 }}>
          <TextField
            required
            size="small"
            label="标题"
            placeholder="最多 40 字"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            inputProps={{ maxLength: 40 }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            required
            size="small"
            label="内容"
            placeholder="首页滚动展示，最多 200 字"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            inputProps={{ maxLength: 200 }}
            sx={{ flex: 1, minWidth: 240 }}
          />
          <TextField
            size="small"
            type="number"
            label="排序"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            sx={{ width: 100 }}
            inputProps={{ step: 1, title: "整数，越大越靠前" }}
          />
          <Button variant="contained" onClick={add}>
            发布
          </Button>
        </InlineForm>
        <InlineForm sx={{ mb: 0 }}>
          <JumpPicker
            cats={cats}
            categoryId={categoryId}
            goodsId={goodsId}
            onCategory={setCategoryId}
            onGoods={setGoodsId}
            slot="announce"
            helperText="顾客点击公告将打开该商品详情"
          />
          <Button variant="outlined" disabled={!previewPath} onClick={() => copyPath(previewPath)}>
            复制地址
          </Button>
        </InlineForm>
      </Stack>
      <DataTable
        footer={<ListPagination page={pager.page} pageSize={pager.pageSize} total={pager.total} onPageChange={pager.setPage} onPageSizeChange={pager.setPageSize} />}
      >
        <TableHead>
          <TableRow>
            <TableCell>标题</TableCell>
            <TableCell>内容</TableCell>
            <TableCell>跳转</TableCell>
            <TableCell>排序</TableCell>
            <TableCell>启用</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pager.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{displayText(row.title)}</TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {displayText(row.content)}
                </Typography>
              </TableCell>
              <TableCell>
                {row.link_type === "GOODS" && row.mp_path ? (
                  <Box>
                    <Typography variant="body2">{displayText(row.goods_name, "已选商品")}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                      {row.mp_path}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    不跳转
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <TextField
                  key={`${row.id}-${row.sort}`}
                  size="small"
                  type="number"
                  defaultValue={row.sort}
                  sx={{ width: 88 }}
                  inputProps={{ step: 1, title: "整数，越大越靠前，失焦保存" }}
                  onBlur={(e) => saveSort(row, e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Switch checked={!!row.enabled} onChange={(e) => api.put(`/announcements/${row.id}`, { enabled: e.target.checked }).then(load).catch((err) => fb.error(err))} />
              </TableCell>
              <TableCell>
                <Button size="small" onClick={() => openEdit(row)}>
                  编辑
                </Button>
                <Button size="small" disabled={!row.mp_path} onClick={() => copyPath(row.mp_path || "")}>
                  复制地址
                </Button>
                <Button color="error" onClick={() => remove(row)}>
                  删除
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!pager.total && <EmptyRow cols={6} />}
        </TableBody>
      </DataTable>

      <Dialog open={!!edit} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>编辑公告</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              required
              size="small"
              label="标题"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              inputProps={{ maxLength: 40 }}
            />
            <TextField
              required
              size="small"
              label="内容"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              inputProps={{ maxLength: 200 }}
              multiline
              minRows={2}
            />
            <JumpPicker
              cats={cats}
              categoryId={editCat}
              goodsId={editGoods}
              onCategory={setEditCat}
              onGoods={setEditGoods}
              slot="announce"
              helperText="顾客点击公告将打开该商品详情"
            />
            {editPath ? (
              <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                预览：{editPath}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                当前为不跳转，顾客可在公告列表阅读全文。
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEdit(null)}>取消</Button>
          <Button disabled={!editPath} onClick={() => copyPath(editPath)}>
            复制地址
          </Button>
          <Button variant="contained" onClick={saveEdit}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
