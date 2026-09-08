import { Button, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";

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
    <>
      <Typography variant="h5" gutterBottom>
        轮播图（最多启用 5 张）
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" label="图片 URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} sx={{ flex: 1 }} />
        <Button component="label" variant="outlined">
          上传
          <input hidden type="file" accept="image/*" onChange={(e) => e.target.files && upload(e.target.files[0])} />
        </Button>
        <TextField size="small" label="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button variant="contained" onClick={() => api.post("/banners", { imageUrl, title }).then(() => { setTitle(""); load(); })}>
          新增
        </Button>
      </Stack>
      <Table size="small">
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
              <TableCell>{b.image_url && <img src={b.image_url} alt="" width={80} />}</TableCell>
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
        </TableBody>
      </Table>
    </>
  );
}
