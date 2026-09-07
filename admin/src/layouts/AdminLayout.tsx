import { PropsWithChildren, useEffect, useState } from "react";
import { AppBar, Badge, Box, Drawer, IconButton, List, ListItemButton, ListItemText, Toolbar, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { api, clearToken } from "../api";

const WIDTH = 220;
const menus = [
  { to: "/", label: "工作台" },
  { to: "/goods", label: "商品" },
  { to: "/categories", label: "分类" },
  { to: "/orders", label: "订单" },
  { to: "/contents/banners", label: "轮播" },
  { to: "/contents/recommends", label: "推荐位" },
  { to: "/reports", label: "数据分析" },
  { to: "/shop/settings", label: "店铺设置" },
  { to: "/account/password", label: "修改密码" },
];

export default function AdminLayout({ children }: PropsWithChildren) {
  const nav = useNavigate();
  const loc = useLocation();
  const [badge, setBadge] = useState(0);
  useEffect(() => {
    api.get("/dashboard/summary").then((d: { pendingPack: number; waitPickup: number }) => {
      setBadge((d.pendingPack || 0) + (d.waitPickup || 0));
    }).catch(() => undefined);
  }, [loc.pathname]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flex: 1 }}>
            社区杂货铺 · 管理后台
          </Typography>
          <IconButton color="inherit" onClick={() => { clearToken(); nav("/login"); }}>
            <Typography variant="body2">退出</Typography>
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" sx={{ width: WIDTH, [`& .MuiDrawer-paper`]: { width: WIDTH, top: 64, height: "calc(100% - 64px)" } }}>
        <List>
          {menus.map((m) => (
            <ListItemButton key={m.to} selected={loc.pathname === m.to} onClick={() => nav(m.to)}>
              {m.to === "/orders" ? (
                <Badge color="error" badgeContent={badge} max={99}>
                  <ListItemText primary={m.label} />
                </Badge>
              ) : (
                <ListItemText primary={m.label} />
              )}
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flex: 1, p: 3, mt: 8, ml: `${WIDTH}px` }}>
        {children}
      </Box>
    </Box>
  );
}
