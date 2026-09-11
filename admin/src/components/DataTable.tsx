import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { ReactNode } from "react";

export function DataTable({
  children,
  minWidth = 640,
  footer,
}: {
  children: ReactNode;
  minWidth?: number;
  footer?: ReactNode;
}) {
  return (
    <Box sx={{ border: "1px solid #f0f0f0", borderRadius: 1, overflow: "hidden", maxWidth: "100%" }}>
      <TableContainer sx={{ overflowX: "auto", maxWidth: "100%" }}>
        <Table size="small" sx={{ minWidth }}>
          {children}
        </Table>
      </TableContainer>
      {footer}
    </Box>
  );
}

export function EmptyRow({ cols, text = "暂无数据" }: { cols: number; text?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} align="center" sx={{ color: "text.secondary", py: 8, borderBottom: 0 }}>
        {text}
      </TableCell>
    </TableRow>
  );
}

export { TableHead, TableBody, TableRow, TableCell };
