import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Divider,
  IconButton,
  Link as MLink,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import ViewCarouselOutlined from "@mui/icons-material/ViewCarouselOutlined";
import StarBorderOutlined from "@mui/icons-material/StarBorderOutlined";
import BarChartOutlined from "@mui/icons-material/BarChartOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import ConfirmationNumberOutlined from "@mui/icons-material/ConfirmationNumberOutlined";
import FlashOnOutlined from "@mui/icons-material/FlashOnOutlined";
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import MenuOpenOutlined from "@mui/icons-material/MenuOpenOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { api, clearToken } from "../api";

const EXPANDED = 220;
const COLLAPSED = 72;

type Item = { to: string; label: string; icon: typeof DashboardOutlined; badge?: boolean };
type Group = { title: string; items: Item[] };

const groups: Group[] = [
  {
    title: "概览",
    items: [{ to: "/", label: "工作台", icon: DashboardOutlined }],
  },
  {
    title: "货架",
    items: [
      { to: "/goods", label: "商品", icon: Inventory2Outlined },
      { to: "/categories", label: "分类", icon: CategoryOutlined },
    ],
  },
  {
    title: "交易",
    items: [{ to: "/orders", label: "订单", icon: ReceiptLongOutlined, badge: true }],
  },
  {
    title: "运营",
    items: [
      { to: "/contents/banners", label: "轮播", icon: ViewCarouselOutlined },
      { to: "/contents/recommends", label: "推荐位", icon: StarBorderOutlined },
      { to: "/reports", label: "数据分析", icon: BarChartOutlined },
    ],
  },
  {
    title: "营销",
    items: [
      { to: "/members", label: "会员", icon: PeopleOutlined },
      { to: "/marketing/coupons", label: "优惠券", icon: ConfirmationNumberOutlined },
      { to: "/marketing/campaigns", label: "拼团秒杀", icon: FlashOnOutlined },
      { to: "/marketing/notices", label: "订阅通知", icon: NotificationsNoneOutlined },
    ],
  },
  {
    title: "店铺",
    items: [
      { to: "/shop/settings", label: "店铺设置", icon: StorefrontOutlined },
      { to: "/account/password", label: "修改密码", icon: LockOutlined },
    ],
  },
];

function matchPath(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function crumbs(pathname: string): { label: string; to?: string }[] {
  const home = { label: "工作台", to: "/" };
  if (pathname === "/") return [{ label: "工作台" }];
  if (pathname === "/goods/new") return [home, { label: "商品", to: "/goods" }, { label: "新建商品" }];
  if (pathname.startsWith("/goods/") && pathname !== "/goods") return [home, { label: "商品", to: "/goods" }, { label: "编辑商品" }];
  if (pathname.startsWith("/orders/") && pathname !== "/orders") return [home, { label: "订单", to: "/orders" }, { label: "订单详情" }];
  for (const g of groups) {
    for (const it of g.items) {
      if (matchPath(pathname, it.to) && it.to !== "/") return [home, { label: it.label }];
    }
  }
  return [home];
}

export default function AdminLayout({ children }: PropsWithChildren) {
  const nav = useNavigate();
  const loc = useLocation();
  const [badge, setBadge] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const width = collapsed ? COLLAPSED : EXPANDED;
  const trail = useMemo(() => crumbs(loc.pathname), [loc.pathname]);

  useEffect(() => {
    api
      .get("/dashboard/summary")
      .then((d: { pendingPack: number; waitPickup: number }) => {
        setBadge((d.pendingPack || 0) + (d.waitPickup || 0));
      })
      .catch(() => undefined);
  }, [loc.pathname]);

  const logout = () => {
    clearToken();
    nav("/login");
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Box
        component="aside"
        sx={{
          width,
          flexShrink: 0,
          bgcolor: "#001529",
          color: "rgba(255,255,255,0.65)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          inset: "0 auto 0 0",
          zIndex: 1200,
          transition: "width 0.2s ease",
        }}
      >
        <Box
          onClick={() => nav("/")}
          sx={{
            height: 56,
            px: collapsed ? 1 : 2,
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            cursor: "pointer",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: "primary.main",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            铺
          </Box>
          {!collapsed && (
            <Typography sx={{ color: "#fff", fontWeight: 600, fontSize: 15, whiteSpace: "nowrap" }}>
              杂货铺后台
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
          {groups.map((g) => (
            <Box key={g.title} sx={{ mb: 0.5 }}>
              {!collapsed && (
                <Typography
                  sx={{
                    px: 2.5,
                    py: 0.75,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: 0.5,
                  }}
                >
                  {g.title}
                </Typography>
              )}
              <List disablePadding>
                {g.items.map((m) => {
                  const selected = matchPath(loc.pathname, m.to);
                  const icon = (
                    <m.icon sx={{ fontSize: 18, color: selected ? "#fff" : "inherit" }} />
                  );
                  const button = (
                    <ListItemButton
                      key={m.to}
                      selected={selected}
                      onClick={() => nav(m.to)}
                      sx={{
                        mx: 1,
                        mb: 0.25,
                        minHeight: 40,
                        justifyContent: collapsed ? "center" : "flex-start",
                        px: collapsed ? 1 : 1.5,
                        "&.Mui-selected": {
                          bgcolor: "primary.main",
                          color: "#fff",
                          "&:hover": { bgcolor: "primary.light" },
                        },
                        "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "#fff" },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 32, color: "inherit", justifyContent: "center" }}>
                        {m.badge ? (
                          <Badge color="error" badgeContent={badge} max={99} sx={{ "& .MuiBadge-badge": { fontSize: 10, height: 16, minWidth: 16 } }}>
                            {icon}
                          </Badge>
                        ) : (
                          icon
                        )}
                      </ListItemIcon>
                      {!collapsed && <ListItemText primary={m.label} primaryTypographyProps={{ fontSize: 14 }} />}
                    </ListItemButton>
                  );
                  return collapsed ? (
                    <Tooltip key={m.to} title={m.label} placement="right">
                      {button}
                    </Tooltip>
                  ) : (
                    button
                  );
                })}
              </List>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, ml: `${width}px`, display: "flex", flexDirection: "column", minWidth: 0, transition: "margin 0.2s ease" }}>
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1100,
            height: 56,
            px: 2,
            bgcolor: "#fff",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <IconButton size="small" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? <MenuOutlined /> : <MenuOpenOutlined />}
          </IconButton>
          <Breadcrumbs sx={{ flex: 1, "& .MuiBreadcrumbs-separator": { mx: 0.75 } }}>
            {trail.map((c, i) =>
              c.to && i < trail.length - 1 ? (
                <MLink key={c.label} underline="hover" color="inherit" sx={{ cursor: "pointer", fontSize: 14 }} onClick={() => nav(c.to!)}>
                  {c.label}
                </MLink>
              ) : (
                <Typography key={c.label} color="text.primary" sx={{ fontSize: 14 }}>
                  {c.label}
                </Typography>
              )
            )}
          </Breadcrumbs>
          <Box
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer", px: 1, py: 0.5, borderRadius: 1, "&:hover": { bgcolor: "action.hover" } }}
          >
            <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main", fontSize: 13 }}>店</Avatar>
            <Typography sx={{ fontSize: 14 }}>店主</Typography>
          </Box>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
            <MenuItem
              onClick={() => {
                setAnchor(null);
                nav("/account/password");
              }}
            >
              修改密码
            </MenuItem>
            <Divider />
            <MenuItem onClick={logout}>
              <LogoutOutlined sx={{ fontSize: 16, mr: 1 }} /> 退出登录
            </MenuItem>
          </Menu>
        </Box>
        <Box component="main" sx={{ flex: 1, p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
