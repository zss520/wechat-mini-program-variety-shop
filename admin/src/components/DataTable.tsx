import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { ReactNode, useLayoutEffect, useRef, useState } from "react";

const MIN_TABLE_BOX = 280;
const VIEW_GAP = 16;

export function DataTable({
  children,
  minWidth = 640,
  footer,
}: {
  children: ReactNode;
  minWidth?: number;
  footer?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fitH, setFitH] = useState<number>();

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top;
      setFitH(Math.max(MIN_TABLE_BOX, Math.floor(window.innerHeight - top - VIEW_GAP)));
    };
    fit();
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <Box
      ref={rootRef}
      sx={{
        border: "1px solid #f0f0f0",
        borderRadius: 1,
        overflow: "hidden",
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
        maxHeight: fitH ?? "calc(100dvh - 220px)",
      }}
    >
      <TableContainer sx={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", maxWidth: "100%" }}>
        <Table stickyHeader size="small" sx={{ minWidth }}>
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
