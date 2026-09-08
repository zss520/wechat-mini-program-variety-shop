import { Alert, Button, Stack, TextField } from "@mui/material";
import { FormEvent, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";

export default function Password() {
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await api.post("/auth/password", { oldPassword, newPassword });
      setMsg("密码已更新");
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };
  return (
    <PageContainer title="修改密码">
      {msg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {msg}
        </Alert>
      )}
      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}
      <form onSubmit={submit}>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <TextField type="password" label="原密码" value={oldPassword} onChange={(e) => setOld(e.target.value)} />
          <TextField type="password" label="新密码（至少 8 位）" value={newPassword} onChange={(e) => setNew(e.target.value)} />
          <Button type="submit" variant="contained">
            保存
          </Button>
        </Stack>
      </form>
    </PageContainer>
  );
}
