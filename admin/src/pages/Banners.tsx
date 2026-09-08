import { Button, Stack, Switch, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";

export default function Banners() {
  const [list, setList] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const load = () => api.get("/banners").then(setList);
  useEffect(() => {
    load();
  }, []);
  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await api.post("/uploads/image", fd);
    setImageUrl(r.url);
  };
  return (
    <PageContainer title="轮播图" description="最多同时启用 5 张">
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField size="small" label="图片 URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
        <Button component="label" variant="outlined">
          上传
          <input hidden type="file" accept="image/*" onChange={(e) => e.target.files && upload(e.target.files[0])} />
        </Button>
        <TextField size="small" label="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button variant="contained" onClick={() => api.post("/banners", { imageUrl, title }).then(() => { setTitle(""); load(); })}>
          新增
        </Button>
      </Stack>
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
              <TableCell>{b.title}</TableCell>
              <TableCell>
                <Switch checked={!!b.enabled} onChange={(e) => api.put(`/banners/${b.id}`, { enabled: e.target.checked }).then(load)} />
              </TableCell>
              <TableCell>
                <Button color="error" onClick={() => api.delete(`/banners/${b.id}`).then(load)}>
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
