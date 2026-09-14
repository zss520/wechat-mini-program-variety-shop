import { Box, MenuItem, Pagination, Select, Typography } from "@mui/material";
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
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: { xs: "center", sm: "flex-end" },
        flexWrap: "wrap",
        gap: { xs: 1, sm: 1.5 },
        px: 1.5,
        py: 1,
        borderTop: "1px solid #f0f0f0",
        bgcolor: "#fff",
        flexShrink: 0,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        共 {total} 条
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography variant="body2" color="text.secondary">
          每页
        </Typography>
        <Select
          size="small"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          sx={{
            height: 32,
            fontSize: 13,
            ".MuiSelect-select": { py: 0.75, pr: 3 },
          }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <MenuItem key={n} value={n}>
              {n} 条
            </MenuItem>
          ))}
        </Select>
      </Box>
      <Pagination
        color="primary"
        size="small"
        shape="rounded"
        count={last}
        page={safePage}
        disabled={total <= 0}
        onChange={(_, next) => onPageChange(next)}
        showFirstButton
        showLastButton
        siblingCount={1}
        boundaryCount={1}
      />
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 84 }}>
        第 {safePage} / {last} 页
      </Typography>
    </Box>
  );
}
