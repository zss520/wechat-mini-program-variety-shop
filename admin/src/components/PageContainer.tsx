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
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">{title}</Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
        {extra && <Box sx={{ flexShrink: 0 }}>{extra}</Box>}
      </Stack>
      {card ? (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          {children}
        </Paper>
      ) : (
        children
      )}
    </Box>
  );
}
