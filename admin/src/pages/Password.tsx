import { Button, Stack, TextField } from "@mui/material";
import { FormEvent, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { useFeedback } from "../components/FeedbackProvider";

export default function Password() {
  const fb = useFeedback();
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      await fb.alert("请填写原密码", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (newPassword.length < 8) {
      await fb.alert("新密码至少 8 位，建议字母与数字组合", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (newPassword === oldPassword) {
      await fb.alert("新密码不能与原密码相同", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      await api.post("/auth/password", { oldPassword, newPassword });
      setOld("");
      setNew("");
      await fb.success("密码已更新");
    } catch (ex) {
      await fb.error(ex);
    }
  };
  return (
    <PageContainer title="修改密码">
      <form onSubmit={submit} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <TextField required type="password" label="原密码" value={oldPassword} onChange={(e) => setOld(e.target.value)} helperText="必填" autoComplete="current-password" />
          <TextField required type="password" label="新密码" value={newPassword} onChange={(e) => setNew(e.target.value)} helperText="必填，至少 8 位" autoComplete="new-password" />
          <Button type="submit" variant="contained">
            保存
          </Button>
        </Stack>
      </form>
    </PageContainer>
  );
}
