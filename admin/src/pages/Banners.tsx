import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import ListPagination, { useClientPager } from "../components/ListPagination";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, asRecord, displayText } from "../utils/display";

type Cat = { id: number; name: string };
type Goods = { id: number; name: string; category_id?: number };
type Banner = {
  id: number;
  image_url: string;
  title: string;
  link_type: string;
  link_value: string;
  sort: number;
  enabled: number;
  goods_name?: string;
  category_id?: number | null;
  mp_path?: string;
};

function goodsDetailPath(goodsId: number | string) {
  return `/pages/goods/detail?id=${goodsId}&slot=banner&pos=1`;
}

function parseSort(raw: string) {
  const t = raw.trim();
  if (t === "") return 0;
  const v = Number(t);
  return Number.isInteger(v) ? v : null;
}

function JumpPicker({
  cats,
  categoryId,
  goodsId,
  onCategory,
  onGoods,
}: {
  cats: Cat[];
  categoryId: number;
  goodsId: number;
  onCategory: (id: number) => void;
  onGoods: (id: number) => void;
}) {
  const fb = useFeedback();
  const [goods, setGoods] = useState<Goods[]>([]);
  useEffect(() => {
    if (!categoryId) {
      setGoods([]);
      return;
    }
    api
      .get("/goods", { params: { categoryId, pageSize: 100 } })
      .then((d) => setGoods(asArray<Goods>(asRecord(d).list)))
      .catch((e) => fb.error(e));
  }, [categoryId]);
  const path = goodsId ? goodsDetailPath(goodsId) : "";
  return (
    <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="flex-start" sx={{ width: "100%" }}>
      <FormControl size="small" sx={{ minWidth: 148 }}>
        <InputLabel>跳转分类</InputLabel>
        <Select
          label="跳转分类"
          value={categoryId ? String(categoryId) : ""}
          onChange={(e) => {
            onCategory(Number(e.target.value) || 0);
            onGoods(0);
          }}
        >
          <MenuItem value="">不跳转</MenuItem>
          {cats.map((c) => (
            <MenuItem key={c.id} value={String(c.id)}>
              {displayText(c.name)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 200 }} disabled={!categoryId}>
        <InputLabel>跳转商品</InputLabel>
        <Select
          label="跳转商品"
          value={goodsId ? String(goodsId) : ""}
          onChange={(e) => onGoods(Number(e.target.value) || 0)}
        >
          <MenuItem value="">请选择商品</MenuItem>
          {goods.map((g) => (
            <MenuItem key={g.id} value={String(g.id)}>
              {displayText(g.name)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        size="small"
        label="小程序地址预览"
        value={path || "选择商品后自动生成"}
        InputProps={{ readOnly: true }}
        sx={{ flex: 1, minWidth: 280 }}
        helperText={path ? "顾客点击轮播将打开该商品详情" : "先选分类再选商品"}
      />
    </Stack>
  );
}

export default function Banners() {
  const fb = useFeedback();
  const [list, setList] = useState<Banner[]>([]);
  const pager = useClientPager(list);
  const [cats, setCats] = useState<Cat[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [sort, setSort] = useState("0");
  const [categoryId, setCategoryId] = useState(0);
  const [goodsId, setGoodsId] = useState(0);
  const [edit, setEdit] = useState<Banner | null>(null);
  const [editCat, setEditCat] = useState(0);
  const [editGoods, setEditGoods] = useState(0);

  const load = () => {
    api.get("/banners").then((d) => setList(asArray(d))).catch((e) => fb.error(e));
    api.get("/categories").then((d) => setCats(asArray<Cat>(d))).catch((e) => fb.error(e));
  };
  useEffect(() => {
    load();
  }, []);

  const upload = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/uploads/image", fd);
      setImageUrl(r.url);
      await fb.success("图片已上传");
    } catch (e) {
      await fb.error(e, "图片上传失败");
    }
  };

  const add = async () => {
    if (!imageUrl.trim()) {
      await fb.alert("请先上传图片或填写图片地址", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (title.trim().length > 40) {
      await fb.alert("标题最多 40 个字", { title: "请完善信息", severity: "warning" });
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
      await api.post("/banners", {
        imageUrl: imageUrl.trim(),
        title: title.trim(),
        sort: s,
        linkType: goodsId ? "GOODS" : "NONE",
        linkValue: goodsId ? String(goodsId) : "",
      });
      setTitle("");
      setImageUrl("");
      setSort("0");
      setCategoryId(0);
      setGoodsId(0);
      load();
      await fb.success("轮播图已新增");
    } catch (e) {
      await fb.error(e);
    }
  };

  const saveSort = async (b: Banner, raw: string) => {
    const s = parseSort(raw);
    if (s == null) {
      await fb.alert("排序须为整数，数字越大越靠前", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (s === b.sort) return;
    try {
      await api.put(`/banners/${b.id}`, { sort: s });
      load();
    } catch (e) {
      await fb.error(e);
    }
  };

  const openEdit = (b: Banner) => {
    setEdit(b);
    setEditCat(Number(b.category_id) || 0);
    setEditGoods(b.link_type === "GOODS" ? Number(b.link_value) || 0 : 0);
  };

  const saveJump = async () => {
    if (!edit) return;
    if (editCat && !editGoods) {
      await fb.alert("请选择要跳转的商品，或不选分类表示不跳转", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      await api.put(`/banners/${edit.id}`, {
        linkType: editGoods ? "GOODS" : "NONE",
        linkValue: editGoods ? String(editGoods) : "",
      });
      setEdit(null);
      load();
      await fb.success("跳转已保存");
    } catch (e) {
      await fb.error(e);
    }
  };

  const copyPath = async (path: string) => {
    if (!path) {
      await fb.alert("请先选择跳转商品", { title: "请注意", severity: "warning" });
      return;
    }
    try {
      await navigator.clipboard.writeText(path);
      await fb.success("已复制小程序地址");
    } catch {
      await fb.alert(path, { title: "小程序地址" });
    }
  };

  const remove = async (b: Banner) => {
    const ok = await fb.confirm(`确定删除轮播「${b.title || "未命名"}」？`, { title: "删除轮播", danger: true, confirmText: "删除" });
    if (!ok) return;
    try {
      await api.delete(`/banners/${b.id}`);
      load();
      await fb.success("轮播图已删除");
    } catch (e) {
      await fb.error(e);
    }
  };

  const previewPath = goodsId ? goodsDetailPath(goodsId) : "";
  const editPath = editGoods ? goodsDetailPath(editGoods) : "";

  return (
    <PageContainer title="轮播图" description="图片地址必填。按分类选择商品后生成小程序详情页地址。排序为整数，越大越靠前。最多同时启用 5 张。">
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <InlineForm sx={{ mb: 0 }}>
          <TextField
            required
            size="small"
            label="图片地址"
            placeholder="上传或粘贴 URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
          />
          <Button component="label" variant="outlined">
            上传
            <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files && upload(e.target.files[0])} />
          </Button>
          <TextField
            size="small"
            label="标题"
            placeholder="选填，最多 40 字"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            inputProps={{ maxLength: 40 }}
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
            新增
          </Button>
        </InlineForm>
        <InlineForm sx={{ mb: 0 }}>
          <JumpPicker cats={cats} categoryId={categoryId} goodsId={goodsId} onCategory={setCategoryId} onGoods={setGoodsId} />
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
            <TableCell>预览</TableCell>
            <TableCell>标题</TableCell>
            <TableCell>跳转</TableCell>
            <TableCell>排序</TableCell>
            <TableCell>启用</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pager.rows.map((b) => (
            <TableRow key={b.id}>
              <TableCell>
                {b.image_url && <img src={b.image_url} alt="" width={80} style={{ borderRadius: 6 }} />}
              </TableCell>
              <TableCell>{displayText(b.title)}</TableCell>
              <TableCell>
                {b.link_type === "GOODS" && b.mp_path ? (
                  <Box>
                    <Typography variant="body2">{displayText(b.goods_name, "已选商品")}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                      {b.mp_path}
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
                  key={`${b.id}-${b.sort}`}
                  size="small"
                  type="number"
                  defaultValue={b.sort}
                  sx={{ width: 88 }}
                  inputProps={{ step: 1, title: "整数，越大越靠前，失焦保存" }}
                  onBlur={(e) => saveSort(b, e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Switch checked={!!b.enabled} onChange={(e) => api.put(`/banners/${b.id}`, { enabled: e.target.checked }).then(load).catch((err) => fb.error(err))} />
              </TableCell>
              <TableCell>
                <Button size="small" onClick={() => openEdit(b)}>
                  配置跳转
                </Button>
                <Button size="small" disabled={!b.mp_path} onClick={() => copyPath(b.mp_path || "")}>
                  复制地址
                </Button>
                <Button color="error" onClick={() => remove(b)}>
                  删除
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!pager.total && <EmptyRow cols={6} />}
        </TableBody>
      </DataTable>

      <Dialog open={!!edit} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>配置跳转</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            按分类选择现有商品，生成小程序详情页地址。
          </Typography>
          <Stack spacing={2}>
            <JumpPicker cats={cats} categoryId={editCat} goodsId={editGoods} onCategory={setEditCat} onGoods={setEditGoods} />
            {editPath ? (
              <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                预览：{editPath}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEdit(null)}>取消</Button>
          <Button disabled={!editPath} onClick={() => copyPath(editPath)}>
            复制地址
          </Button>
          <Button variant="contained" onClick={saveJump}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
