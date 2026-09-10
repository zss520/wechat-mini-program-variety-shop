import { Box, Paper, Stack, Typography } from "@mui/material";
import { ReactNode } from "react";

type Props = {
  title: string;
  extra?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** 内容是否包在白底卡片中，默认 true */
  card?: boolean;
};

export default function PageContainer({ title, extra, description, children, card = true }: Props) {
  return (
    <Box sx={{ minWidth: 0, width: "100%" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ wordBreak: "break-word" }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
        {extra && <Box sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" }, maxWidth: "100%" }}>{extra}</Box>}
      </Stack>
      {card ? (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2, overflow: "hidden" }}>
          {children}
        </Paper>
      ) : (
        children
      )}
    </Box>
  );
}
