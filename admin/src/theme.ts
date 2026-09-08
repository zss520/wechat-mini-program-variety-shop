import { createTheme } from "@mui/material/styles";

/** Ant Design Pro 交互密度 + 杂货铺品牌色 */
export const theme = createTheme({
  palette: {
    primary: { main: "#C2410C", light: "#EA580C", dark: "#9A3412", contrastText: "#fff" },
    success: { main: "#52c41a", contrastText: "#fff" },
    warning: { main: "#faad14", contrastText: "#fff" },
    error: { main: "#ff4d4f", contrastText: "#fff" },
    info: { main: "#1677ff", contrastText: "#fff" },
    text: {
      primary: "rgba(0,0,0,0.88)",
      secondary: "rgba(0,0,0,0.65)",
      disabled: "rgba(0,0,0,0.25)",
    },
    divider: "#f0f0f0",
    background: { default: "#f5f5f5", paper: "#ffffff" },
    action: { hover: "rgba(0,0,0,0.04)", selected: "#fff7ed" },
  },
  shape: { borderRadius: 6 },
  spacing: 8,
  typography: {
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
    fontSize: 14,
    h5: { fontSize: "20px", fontWeight: 600, lineHeight: 1.4, color: "rgba(0,0,0,0.88)" },
    h6: { fontSize: "16px", fontWeight: 600, lineHeight: 1.5, color: "rgba(0,0,0,0.88)" },
    subtitle1: { fontSize: "14px", fontWeight: 600 },
    body1: { fontSize: "14px", lineHeight: 1.5714 },
    body2: { fontSize: "14px", lineHeight: 1.5714 },
    button: { textTransform: "none", fontWeight: 400, fontSize: "14px" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "#f5f5f5" },
        "*::-webkit-scrollbar": { width: 8, height: 8 },
        "*::-webkit-scrollbar-thumb": { background: "#d9d9d9", borderRadius: 4 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, size: "small" },
      styleOverrides: {
        root: {
          borderRadius: 6,
          minWidth: 64,
          padding: "4px 15px",
          height: 32,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        sizeSmall: { height: 32, padding: "4px 15px" },
        containedPrimary: {
          "&:hover": { backgroundColor: "#EA580C" },
        },
        outlined: {
          borderColor: "#d9d9d9",
          color: "rgba(0,0,0,0.88)",
          "&:hover": { borderColor: "#C2410C", color: "#C2410C", backgroundColor: "#fff7ed" },
        },
        text: { color: "#C2410C", "&:hover": { backgroundColor: "#fff7ed" } },
        textError: { color: "#ff4d4f", "&:hover": { backgroundColor: "#fff2f0" } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small", variant: "outlined" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: "#fff",
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#C2410C" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#C2410C", borderWidth: 1 },
        },
        notchedOutline: { borderColor: "#d9d9d9" },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: { fontSize: 14 },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: "#f0f0f0" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          boxShadow: "0 1px 2px 0 rgba(0,0,0,0.03)",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: "#fafafa",
          "& .MuiTableCell-head": {
            fontWeight: 600,
            color: "rgba(0,0,0,0.88)",
            backgroundColor: "#fafafa",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "#f0f0f0",
          padding: "12px 16px",
          fontSize: 14,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: "#fafafa" },
          "&:last-child td": { borderBottom: 0 },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, height: 22, fontSize: 12 },
        sizeSmall: { height: 22 },
      },
    },
    MuiSwitch: {
      defaultProps: { size: "small", color: "primary" },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 12, backgroundColor: "rgba(0,0,0,0.85)" },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
  },
});
