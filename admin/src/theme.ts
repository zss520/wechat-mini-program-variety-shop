import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#C2410C" },
    secondary: { main: "#B45309" },
    background: { default: "#F8F4F0" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Roboto","PingFang SC","Microsoft YaHei",sans-serif',
  },
});
