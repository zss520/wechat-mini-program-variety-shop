import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import LockOutlined from "@mui/icons-material/LockOutlined";
import PersonOutline from "@mui/icons-material/PersonOutline";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

const REMEMBER_KEY = "vs_admin_remember";

type Remembered = { username?: string; password?: string; remember?: boolean };

function readRemembered(): Remembered {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return { username: "admin", password: "admin123", remember: true };
    const parsed = JSON.parse(raw) as Remembered;
    return {
      username: String(parsed.username || "admin"),
      password: parsed.remember ? String(parsed.password || "") : "",
      remember: parsed.remember !== false,
    };
  } catch {
    return { username: "admin", password: "admin123", remember: true };
  }
}

const SLIDES = [
  {
    title: "商品上架，邻里即达",
    desc: "分类、改价、库存一眼看清，特价与活动按时间窗自动生效。",
    art: (
      <svg width="220" height="150" viewBox="0 0 220 150" fill="none" aria-hidden>
        <rect x="38" y="28" width="144" height="96" rx="10" fill="#fff" fillOpacity="0.12" />
        <rect x="54" y="44" width="52" height="36" rx="6" fill="#FB923C" />
        <rect x="114" y="44" width="52" height="36" rx="6" fill="#FDBA74" />
        <rect x="54" y="88" width="112" height="10" rx="5" fill="#fff" fillOpacity="0.35" />
        <rect x="54" y="104" width="72" height="8" rx="4" fill="#fff" fillOpacity="0.22" />
      </svg>
    ),
  },
  {
    title: "接单备货，核销配送",
    desc: "待备货、待自提、配送中状态清晰，提货码核销一步完成。",
    art: (
      <svg width="220" height="150" viewBox="0 0 220 150" fill="none" aria-hidden>
        <rect x="46" y="24" width="128" height="102" rx="10" fill="#fff" fillOpacity="0.12" />
        <rect x="62" y="40" width="96" height="12" rx="6" fill="#FB923C" />
        <rect x="62" y="62" width="70" height="8" rx="4" fill="#fff" fillOpacity="0.3" />
        <rect x="62" y="78" width="86" height="8" rx="4" fill="#fff" fillOpacity="0.22" />
        <circle cx="148" cy="104" r="16" fill="#EA580C" />
        <path d="M141 104h14M148 97v14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "数据看店，服务邻里",
    desc: "销售、会员与复购集中在工作台，方便店主每天开店决策。",
    art: (
      <svg width="220" height="150" viewBox="0 0 220 150" fill="none" aria-hidden>
        <rect x="40" y="86" width="22" height="36" rx="4" fill="#FDBA74" />
        <rect x="74" y="62" width="22" height="60" rx="4" fill="#FB923C" />
        <rect x="108" y="40" width="22" height="82" rx="4" fill="#EA580C" />
        <rect x="142" y="54" width="22" height="68" rx="4" fill="#FDBA74" />
        <path d="M48 48h108" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" />
      </svg>
    ),
  },
];

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    height: 40,
    backgroundColor: "#F7F8FA",
    "& fieldset": { borderColor: "transparent" },
    "&:hover fieldset": { borderColor: "transparent" },
    "&.Mui-focused fieldset": { borderColor: "#C2410C", borderWidth: 1 },
    "&.Mui-error fieldset": { borderColor: "#ff4d4f" },
  },
  "& .MuiFormHelperText-root": { mx: 0, mt: 0.75 },
};

export default function Login() {
  const nav = useNavigate();
  const remembered = useMemo(() => readRemembered(), []);
  const [username, setUsername] = useState(remembered.username || "");
  const [password, setPassword] = useState(remembered.password || "");
  const [remember, setRemember] = useState(remembered.remember !== false);
  const [showPwd, setShowPwd] = useState(false);
  const [userError, setUserError] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => window.clearInterval(t);
  }, []);

  const validateUser = (v = username) => {
    if (!v.trim()) {
      setUserError("账号不能为空");
      return false;
    }
    setUserError("");
    return true;
  };
  const validatePwd = (v = password) => {
    if (!v) {
      setPwdError("密码不能为空");
      return false;
    }
    setPwdError("");
    return true;
  };

  const persistRemember = () => {
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username: username.trim(), password, remember: true }));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const okUser = validateUser();
    const okPwd = validatePwd();
    if (!okUser || !okPwd) return;
    setLoading(true);
    try {
      const data = await api.post("/auth/login", { username: username.trim(), password });
      persistRemember();
      setToken(data.token);
      nav("/");
    } catch (ex) {
      setPwdError(ex instanceof Error ? ex.message : "账号或密码错误");
    } finally {
      setLoading(false);
    }
  };

  const current = SLIDES[slide];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "#fff" }}>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          width: { md: "40%" },
          flexShrink: 0,
          background: "linear-gradient(180deg, #9A3412 0%, #7C2D12 46%, #431407 100%)",
          color: "#fff",
          flexDirection: "column",
          position: "relative",
          px: 4,
          py: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: "rgba(255,255,255,0.18)",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            铺
          </Box>
          <Typography sx={{ fontWeight: 600, fontSize: 16 }}>社区杂货铺</Typography>
        </Box>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", px: 6 }}>
          <IconButton
            onClick={() => setSlide((s) => (s + SLIDES.length - 1) % SLIDES.length)}
            sx={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#fff",
              bgcolor: "rgba(255,255,255,0.12)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
            }}
            size="small"
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            onClick={() => setSlide((s) => (s + 1) % SLIDES.length)}
            sx={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#fff",
              bgcolor: "rgba(255,255,255,0.12)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
            }}
            size="small"
          >
            <ChevronRight />
          </IconButton>
          <Box sx={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
            <Typography sx={{ fontSize: 20, fontWeight: 600, mb: 1 }}>{current.title}</Typography>
            <Typography sx={{ opacity: 0.78, fontSize: 13, lineHeight: 1.7, mb: 3, minHeight: 44 }}>{current.desc}</Typography>
            <Box sx={{ display: "flex", justifyContent: "center" }}>{current.art}</Box>
          </Box>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1, pb: 1 }}>
          {SLIDES.map((_, i) => (
            <Box
              key={i}
              onClick={() => setSlide(i)}
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                cursor: "pointer",
                bgcolor: i === slide ? "#fff" : "rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: "grid", placeItems: "center", position: "relative", p: { xs: 2, sm: 3 }, minWidth: 0 }}>
        <Box sx={{ width: "100%", maxWidth: 360 }}>
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1, mb: 3 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: "#C2410C", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
              铺
            </Box>
            <Typography sx={{ fontWeight: 600 }}>社区杂货铺</Typography>
          </Box>
          <Typography sx={{ fontSize: 20, fontWeight: 600, color: "rgba(0,0,0,0.88)", mb: 0.75 }}>登录社区杂货铺后台</Typography>
          <Typography sx={{ color: "rgba(0,0,0,0.45)", fontSize: 14, mb: 3 }}>使用店主账号进入工作台</Typography>
          <form onSubmit={onSubmit} noValidate>
            <TextField
              fullWidth
              hiddenLabel
              placeholder="账号：admin"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (userError) validateUser(e.target.value);
              }}
              onBlur={() => validateUser()}
              error={!!userError}
              helperText={userError || undefined}
              autoComplete="username"
              sx={{ ...fieldSx, mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutline sx={{ color: "#86909C", fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              hiddenLabel
              type={showPwd ? "text" : "password"}
              placeholder="密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (pwdError) validatePwd(e.target.value);
              }}
              onBlur={() => validatePwd()}
              error={!!pwdError}
              helperText={pwdError || undefined}
              autoComplete="current-password"
              sx={{ ...fieldSx, mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ color: "#86909C", fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPwd((v) => !v)} edge="end" tabIndex={-1}>
                      {showPwd ? <VisibilityOff sx={{ fontSize: 18, color: "#86909C" }} /> : <Visibility sx={{ fontSize: 18, color: "#86909C" }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, mt: 0.5 }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                label="记住密码"
                sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: 14, color: "rgba(0,0,0,0.88)" } }}
              />
              <Link component="button" type="button" onClick={() => setForgotOpen(true)} underline="none" sx={{ fontSize: 14 }}>
                忘记密码
              </Link>
            </Box>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ height: 40, fontSize: 14, fontWeight: 500 }}
            >
              {loading ? <CircularProgress size={18} color="inherit" /> : "登录"}
            </Button>
          </form>
          <Typography sx={{ mt: 2, textAlign: "center", color: "rgba(0,0,0,0.45)", fontSize: 13 }}>仅店主账号可登录</Typography>
        </Box>
        <Typography sx={{ position: "absolute", right: { xs: 16, sm: 24 }, bottom: { xs: 12, sm: 20 }, color: "#C9CDD4", fontSize: 12 }}>社区杂货铺</Typography>
      </Box>

      <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)}>
        <DialogTitle>忘记密码</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "rgba(0,0,0,0.65)" }}>
            后台不提供自助找回。请使用部署时的店主账号登录，进入后可在「修改密码」中更换。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setForgotOpen(false)}>
            知道了
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
