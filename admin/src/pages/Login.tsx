import { Box, Button, TextField, Typography } from "@mui/material";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api";
import { useFeedback } from "../components/FeedbackProvider";

export default function Login() {
  const nav = useNavigate();
  const fb = useFeedback();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      await fb.alert("请填写账号", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (!password) {
      await fb.alert("请填写密码", { title: "请完善信息", severity: "warning" });
      return;
    }
    setLoading(true);
    try {
      const data = await api.post("/auth/login", { username: username.trim(), password });
      setToken(data.token);
      nav("/");
    } catch (ex) {
      await fb.error(ex, "账号或密码错误");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Box sx={{ minHeight: "100vh", display: "flex" }}>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          width: "42%",
          background: "linear-gradient(160deg, #9A3412 0%, #C2410C 48%, #EA580C 100%)",
          color: "#fff",
          flexDirection: "column",
          justifyContent: "center",
          px: 8,
        }}
      >
        <Box sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.2)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 22, mb: 3 }}>
          铺
        </Box>
        <Typography sx={{ fontSize: 28, fontWeight: 600, mb: 1.5 }}>社区杂货铺</Typography>
        <Typography sx={{ opacity: 0.85, maxWidth: 360, lineHeight: 1.7 }}>
          店主工作台：管商品、接订单、看数据。布局与操作参考 Ant Design 后台习惯，品牌色保持杂货铺橙。
        </Typography>
      </Box>
      <Box sx={{ flex: 1, display: "grid", placeItems: "center", bgcolor: "#f5f5f5", p: 3 }}>
        <Box sx={{ width: "100%", maxWidth: 368 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 600, mb: 0.5 }}>店主登录</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            使用管理账号进入后台
          </Typography>
          <form onSubmit={onSubmit} noValidate>
            <TextField required fullWidth label="账号" value={username} onChange={(e) => setUsername(e.target.value)} sx={{ mb: 2 }} autoComplete="username" helperText="必填" />
            <TextField required fullWidth type="password" label="密码" value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 3 }} autoComplete="current-password" helperText="必填" />
            <Button type="submit" fullWidth variant="contained" disabled={loading} sx={{ height: 40 }}>
              {loading ? "登录中…" : "登录"}
            </Button>
          </form>
        </Box>
      </Box>
    </Box>
  );
}
