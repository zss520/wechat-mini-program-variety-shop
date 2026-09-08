import { Button, Stack, Switch, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";

type Cat = { id: number; name: string; sort: number; enabled: number };

export default function Categories() {
  const [list, setList] = useState<Cat[]>([]);
  const [name, setName] = useState("");
  const load = () => api.get("/categories").then(setList);
  useEffect(() => {
    load();
  }, []);
  return (
    <PageContainer title="分类">
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <TextField size="small" label="名称" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name && api.post("/categories", { name }).then(() => { setName(""); load(); })} />
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
      <DataTable>
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
          {!list.length && <EmptyRow cols={4} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
