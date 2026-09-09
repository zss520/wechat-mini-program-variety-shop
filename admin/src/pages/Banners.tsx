import { Button, Switch, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, displayText } from "../utils/display";

export default function Banners() {
  const fb = useFeedback();
  const [list, setList] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const load = () => api.get("/banners").then((d) => setList(asArray(d))).catch((e) => fb.error(e));
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
    try {
      await api.post("/banners", { imageUrl: imageUrl.trim(), title: title.trim() });
      setTitle("");
      setImageUrl("");
      load();
      await fb.success("轮播图已新增");
    } catch (e) {
      await fb.error(e);
    }
  };

  const remove = async (b: any) => {
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

  return (
    <PageContainer title="轮播图" description="图片地址必填。最多同时启用 5 张。">
      <InlineForm>
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
        <Button variant="contained" onClick={add}>
          新增
        </Button>
      </InlineForm>
      <DataTable>
        <TableHead>
          <TableRow>
            <TableCell>预览</TableCell>
            <TableCell>标题</TableCell>
            <TableCell>启用</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((b) => (
            <TableRow key={b.id}>
              <TableCell>{b.image_url && <img src={b.image_url} alt="" width={80} style={{ borderRadius: 6 }} />}</TableCell>
              <TableCell>{displayText(b.title)}</TableCell>
              <TableCell>
                <Switch checked={!!b.enabled} onChange={(e) => api.put(`/banners/${b.id}`, { enabled: e.target.checked }).then(load).catch((err) => fb.error(err))} />
              </TableCell>
              <TableCell>
                <Button color="error" onClick={() => remove(b)}>
                  删除
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!list.length && <EmptyRow cols={4} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
