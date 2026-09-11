import { TablePagination } from "@mui/material";
import { useState } from "react";

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export type Paged<T> = { list: T[]; total: number; page: number; pageSize: number };

export function readPaged<T>(d: unknown): Paged<T> {
  const data = d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
  const list = Array.isArray(data.list) ? (data.list as T[]) : [];
  const total = Number(data.total);
  const page = Number(data.page);
  const pageSize = Number(data.pageSize);
  return {
    list,
    total: Number.isFinite(total) && total >= 0 ? total : list.length,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

export function lastPageOf(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)) || 1);
}

/** 前端已拿到全量数据时的分页切片 */
export function useClientPager<T>(items: T[], initialSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const total = items.length;
  const safePage = Math.min(page, lastPageOf(total, pageSize));
  const start = (safePage - 1) * pageSize;
  return {
    rows: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
  };
}

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export default function ListPagination({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const last = lastPageOf(total, pageSize);
  const safePage = total <= 0 ? 1 : Math.min(Math.max(1, page), last);
  return (
    <TablePagination
      component="div"
      count={total}
      page={total <= 0 ? 0 : safePage - 1}
      onPageChange={(_, next) => onPageChange(next + 1)}
      rowsPerPage={pageSize}
      onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
      rowsPerPageOptions={PAGE_SIZE_OPTIONS}
      labelRowsPerPage="每页"
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
      showFirstButton
      showLastButton
      getItemAriaLabel={(type) => (type === "first" ? "首页" : type === "last" ? "末页" : type === "next" ? "下一页" : "上一页")}
      sx={{
        width: "100%",
        overflow: "hidden",
        borderTop: "1px solid #f0f0f0",
        ".MuiTablePagination-toolbar": {
          minHeight: 52,
          px: 1,
          flexWrap: "wrap",
          justifyContent: { xs: "center", sm: "flex-end" },
          gap: 0.5,
        },
        ".MuiTablePagination-spacer": { display: { xs: "none", sm: "flex" } },
        ".MuiTablePagination-displayedRows, .MuiTablePagination-selectLabel": { m: 0 },
      }}
    />
  );
}
