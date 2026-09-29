import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link as MLink,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import ListPagination, { DEFAULT_PAGE_SIZE, lastPageOf, readPaged } from "../components/ListPagination";
import { useFeedback } from "../components/FeedbackProvider";
import { displayText } from "../utils/display";
import { formatDateTime } from "../utils/datetime";

type MediaRef = { kind: string; role: string; id: number; label: string; to: string };
type MediaItem = {
  key: string;
  url: string;
  name: string;
  folder: string;
  bytes: number;
  updatedAt: string;
  refs: MediaRef[];
};

function sizeText(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function folderText(folder: string) {
  if (folder === "thumbs") return "缩略图";
  if (folder === "avatars") return "头像";
  return "上传原图";
}

export default function MediaLibrary() {
  const fb = useFeedback();
  const navigate = useNavigate();
  const [list, setList] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [used, setUsed] = useState(0);
  const [orphan, setOrphan] = useState(0);
  const [usage, setUsage] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<MediaItem | null>(null);

  const load = (p = page, size = pageSize, nextUsage = usage, nextKeyword = keyword) => {
    api
      .get("/media", { params: { page: p, pageSize: size, usage: nextUsage, keyword: nextKeyword } })
      .then((d) => {
        const data = readPaged<MediaItem>(d);
        const extra = d && typeof d === "object" ? (d as { used?: number; orphan?: number }) : {};
        setList(data.list);
        setTotal(data.total);
        setUsed(Number(extra.used || 0));
        setOrphan(Number(extra.orphan || 0));
        const last = lastPageOf(data.total, size);
        if (p > last) setPage(last);
      })
      .catch((e) => fb.error(e, "图库加载失败"));
  };

  useEffect(() => {
    load(page, pageSize, usage, keyword);
  }, [page, pageSize, usage, keyword]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    setKeyword(draft.trim());
    setPage(1);
  };

  const openRef = (ref: MediaRef) => {
    if (!ref.to) return;
    setPreview(null);
    navigate(ref.to);
  };

  const onImageClick = (item: MediaItem) => {
    const links = item.refs.filter((ref) => ref.to);
    if (links.length === 1) {
      navigate(links[0].to);
      return;
    }
    setPreview(item);
  };

  const remove = async (item: MediaItem) => {
    const ok = await fb.confirm(`删除「${item.name}」后无法恢复。`, { title: "删除图片", confirmText: "删除", danger: true });
    if (!ok) return;
    try {
      await api.delete("/media", { data: { key: item.key } });
      if (preview?.key === item.key) setPreview(null);
      await fb.success("图片已删除");
      load(page, pageSize, usage, keyword);
    } catch (e) {
      await fb.error(e, "删除失败");
    }
  };

  return (
    <PageContainer
      title="图库"
      description="管理已上传的图片。点击仍在使用的图片，会打开对应的商品、轮播、拼团或店铺设置。正在使用的图片不能删除。"
      card={false}
      extra={
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={usage}
            onChange={(_e, value) => {
              if (!value) return;
              setUsage(value);
              setPage(1);
            }}
          >
            <ToggleButton value="all">全部</ToggleButton>
            <ToggleButton value="used">使用中 {used}</ToggleButton>
            <ToggleButton value="orphan">未使用 {orphan}</ToggleButton>
          </ToggleButtonGroup>
          <Box component="form" onSubmit={search} sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              placeholder="文件名或关联名称"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button type="submit" variant="outlined" size="small">
              搜索
            </Button>
          </Box>
        </Stack>
      }
    >
      {list.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
          没有符合条件的图片
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 2,
          }}
        >
          {list.map((item) => (
            <Box key={item.key} sx={{ border: "1px solid #f0f0f0", borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
              <Box
                component="button"
                type="button"
                onClick={() => onImageClick(item)}
                sx={{
                  display: "block",
                  width: "100%",
                  p: 0,
                  border: 0,
                  bgcolor: "#fafafa",
                  cursor: "pointer",
                }}
              >
                <Box
                  component="img"
                  src={item.url}
                  alt={item.name}
                  sx={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                />
              </Box>
              <Stack spacing={0.75} sx={{ p: 1.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={item.name}>
                  {item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {folderText(item.folder)} · {sizeText(item.bytes)} · {formatDateTime(item.updatedAt, true)}
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  {item.refs.length === 0 ? (
                    <Chip size="small" label="未使用" variant="outlined" />
                  ) : (
                    item.refs.slice(0, 3).map((ref) =>
                      ref.to ? (
                        <Chip
                          key={`${ref.kind}-${ref.id}-${ref.role}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          label={`${ref.role} · ${displayText(ref.label)}`}
                          onClick={() => openRef(ref)}
                        />
                      ) : (
                        <Chip key={`${ref.kind}-${ref.id}-${ref.role}`} size="small" label={`${ref.role} · ${displayText(ref.label)}`} />
                      )
                    )
                  )}
                  {item.refs.length > 3 ? <Chip size="small" label={`+${item.refs.length - 3}`} /> : null}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setPreview(item)}>
                    查看
                  </Button>
                  <Button size="small" color="error" onClick={() => void remove(item)} disabled={item.refs.length > 0}>
                    删除
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ mt: 2 }}>
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </Box>
      <Dialog open={!!preview} onClose={() => setPreview(null)} fullWidth maxWidth="sm">
        <DialogTitle>{preview?.name || "查看图片"}</DialogTitle>
        <DialogContent>
          {preview ? (
            <Stack spacing={1.5}>
              <Box
                component="img"
                src={preview.url}
                alt={preview.name}
                sx={{ width: "100%", maxHeight: 420, objectFit: "contain", bgcolor: "#fafafa", borderRadius: 1 }}
              />
              {preview.refs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  这张图片还没有被商品、轮播或其他位置使用。
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {preview.refs.map((ref) =>
                    ref.to ? (
                      <MLink
                        key={`${ref.kind}-${ref.id}-${ref.role}`}
                        component="button"
                        type="button"
                        underline="hover"
                        onClick={() => openRef(ref)}
                        sx={{ textAlign: "left" }}
                      >
                        {ref.role} · {displayText(ref.label)}
                      </MLink>
                    ) : (
                      <Typography key={`${ref.kind}-${ref.id}-${ref.role}`} variant="body2">
                        {ref.role} · {displayText(ref.label)}
                      </Typography>
                    )
                  )}
                </Stack>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
