import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { ReactNode } from "react";

export function DataTable({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return (
    <TableContainer sx={{ border: "1px solid #f0f0f0", borderRadius: 1, overflowX: "auto", maxWidth: "100%" }}>
      <Table size="small" sx={{ minWidth }}>
        {children}
      </Table>
    </TableContainer>
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
