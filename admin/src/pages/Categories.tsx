import { Button, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";

type Cat = { id: number; name: string; sort: number; enabled: number };

export default function Categories() {
  const [list, setList] = useState<Cat[]>([]);
  const [name, setName] = useState("");
  const load = () => api.get("/categories").then(setList);
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Typography variant="h5" gutterBottom>
        分类
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" label="名称" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          variant="contained"
          onClick={() => {
            if (!name) return;
            api.post("/categories", { name }).then(() => {
              setName("");
              load();
            });
          }}
        >
          新增
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>名称</TableCell>
            <TableCell>排序</TableCell>
            <TableCell>启用</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.sort}</TableCell>
              <TableCell>
                <Switch checked={!!c.enabled} onChange={(e) => api.put(`/categories/${c.id}`, { enabled: e.target.checked }).then(load)} />
              </TableCell>
              <TableCell>
                <Button color="error" onClick={() => api.delete(`/categories/${c.id}`).then(load).catch((e) => alert(e.message))}>
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
