import { Alert, Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await api.post("/auth/login", { username, password });
      setToken(data.token);
      nav("/");
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#F8F4F0" }}>
      <Card sx={{ width: 380 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            店主登录
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            社区杂货铺管理后台
          </Typography>
          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          <form onSubmit={onSubmit}>
            <TextField fullWidth label="账号" value={username} onChange={(e) => setUsername(e.target.value)} sx={{ mb: 2 }} />
            <TextField fullWidth type="password" label="密码" value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 2 }} />
            <Button type="submit" fullWidth variant="contained" disabled={loading}>
              登录
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
