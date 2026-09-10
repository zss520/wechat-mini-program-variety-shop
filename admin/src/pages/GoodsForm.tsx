import { Box, Button, Chip, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, displayText } from "../utils/display";
import { goodsUnitOptions, isValidNonNegInt, isValidYuan } from "../utils/message";

type Cat = { id: number; name: string };

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 400 * 1024;

function parseGoodsImages(g: Record<string, unknown>): string[] {
  let images: string[] = [];
  const raw = g.images;
  if (Array.isArray(raw)) images = raw.map((u) => String(u || "").trim()).filter(Boolean);
  const cover = String(g.cover_url || "").trim();
  if (cover) images = [cover, ...images.filter((u) => u !== cover)];
  return images.slice(0, MAX_IMAGES);
}

export default function GoodsForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const fb = useFeedback();
  const [cats, setCats] = useState<Cat[]>([]);
  const [urlDraft, setUrlDraft] = useState("");
  const [form, setForm] = useState({
    name: "",
    subtitle: "",
    categoryId: 0,
    priceYuan: 0,
    originPriceYuan: 0,
    unit: "件",
    stock: 0,
    images: [] as string[],
    detail: "",
    onSale: true,
    sort: 0,
    manualWeight: 0,
    specialPriceYuan: 0,
    specialStart: "",
    specialEnd: "",
  });
  useEffect(() => {
    api.get("/categories").then((list: Cat[]) => {
      const cats = asArray<Cat>(list);
      setCats(cats);
      if (!id && cats[0]) setForm((f) => ({ ...f, categoryId: cats[0].id }));
    });
    if (id) {
      api.get(`/goods/${id}`).then((g: Record<string, unknown>) => {
        setForm({
          name: String(g.name || ""),
          subtitle: String(g.subtitle || ""),
          categoryId: Number(g.category_id),
          priceYuan: Number(g.price_cent) / 100,
          originPriceYuan: g.origin_price_cent ? Number(g.origin_price_cent) / 100 : 0,
          unit: String(g.unit || "件"),
          stock: Number(g.stock || 0),
          images: parseGoodsImages(g),
          detail: String(g.detail || ""),
          onSale: Boolean(g.on_sale),
          sort: Number(g.sort || 0),
          manualWeight: Number(g.manual_weight || 0),
          specialPriceYuan: g.special_price_cent ? Number(g.special_price_cent) / 100 : 0,
          specialStart: g.special_start ? String(g.special_start).slice(0, 16).replace(" ", "T") : "",
          specialEnd: g.special_end ? String(g.special_end).slice(0, 16).replace(" ", "T") : "",
        });
      }).catch((e) => fb.error(e, "商品加载失败"));
    }
  }, [id]);

  const setImages = (images: string[]) => setForm((f) => ({ ...f, images }));

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) {
      await fb.alert("最多上传 6 张图片", { title: "请注意", severity: "warning" });
      return;
    }
    const files = Array.from(fileList).slice(0, room);
    if (fileList.length > room) {
      await fb.alert(`还能再上传 ${room} 张，已忽略多余文件`, { title: "请注意", severity: "warning" });
    }
    const added: string[] = [];
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        await fb.alert(`「${file.name}」超过 400KB，请压缩后再传`, { title: "请完善信息", severity: "warning" });
        continue;
      }
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
        if (r?.url) added.push(r.url);
      } catch (e) {
        await fb.error(e, "图片上传失败");
      }
    }
    if (added.length) {
      setForm((f) => ({ ...f, images: [...f.images, ...added].slice(0, MAX_IMAGES) }));
      await fb.success(added.length === 1 ? "图片已上传" : `已上传 ${added.length} 张图片`);
    }
  };

  const addImageUrl = async () => {
    const u = urlDraft.trim();
    if (!u) return;
    if (form.images.length >= MAX_IMAGES) {
      await fb.alert("最多上传 6 张图片", { title: "请注意", severity: "warning" });
      return;
    }
    if (!/^https?:\/\//i.test(u) && !u.startsWith("/")) {
      await fb.alert("请填写以 / 或 http 开头的图片地址", { title: "请完善信息", severity: "warning" });
      return;
    }
    if (form.images.includes(u)) {
      await fb.alert("该图片已添加", { title: "请注意", severity: "warning" });
      return;
    }
    setImages([...form.images, u]);
    setUrlDraft("");
  };

  const validate = (): string | null => {
    const name = form.name.trim();
    if (!name) return "请填写商品名称";
    if (name.length > 40) return "商品名称最多 40 个字";
    if (form.subtitle.length > 80) return "副标题最多 80 个字";
    if (!form.categoryId) return "请选择分类";
    if (!isValidYuan(form.priceYuan)) return "售价须为大于 0 的数字，最多两位小数";
    if (form.originPriceYuan && !isValidYuan(form.originPriceYuan)) return "划线价须大于 0，不填请留空或填 0";
    if (!form.unit) return "请选择单位";
    if (!isValidNonNegInt(form.stock)) return "库存须为大于等于 0 的整数";
    if (!form.images.length) return "请至少上传一张商品图片，第一张为主图";
    if (form.images.length > MAX_IMAGES) return "商品图片最多 6 张";
    if (!Number.isInteger(form.manualWeight) || form.manualWeight < -50 || form.manualWeight > 50) {
      return "排序加权须为 -50 到 50 的整数";
    }
    if (form.specialPriceYuan > 0) {
      if (!isValidYuan(form.specialPriceYuan)) return "特价须大于 0";
      if (!form.specialStart || !form.specialEnd) return "设置特价时请同时填写开始和结束时间";
      if (form.specialStart >= form.specialEnd) return "特价结束时间须晚于开始时间";
    }
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      await fb.alert(msg, { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        coverUrl: form.images[0],
        images: form.images,
        originPriceYuan: form.originPriceYuan || null,
        specialPriceYuan: form.specialPriceYuan || null,
        specialStart: form.specialStart || null,
        specialEnd: form.specialEnd || null,
      };
      if (id) await api.put(`/goods/${id}`, payload);
      else await api.post("/goods", payload);
      await fb.success(id ? "商品已保存" : "商品已新增");
      nav("/goods");
    } catch (ex) {
      await fb.error(ex);
    }
  };

  const units = goodsUnitOptions(form.unit);

  return (
    <PageContainer
      title={id ? "编辑商品" : "新建商品"}
      extra={
        <Button variant="outlined" onClick={() => nav("/goods")}>
          返回列表
        </Button>
      }
    >
      <form onSubmit={submit} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 640, width: "100%" }}>
          <TextField
            required
            label="名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            helperText="必填，最多 40 个字"
            inputProps={{ maxLength: 40 }}
          />
          <TextField
            label="副标题"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            helperText="选填，最多 80 个字"
            inputProps={{ maxLength: 80 }}
          />
          <TextField
            required
            select
            label="分类"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
            helperText="必填，请先在分类页创建"
          >
            {cats.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {displayText(c.name)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            type="number"
            label="售价（元）"
            value={form.priceYuan}
            onChange={(e) => setForm({ ...form, priceYuan: Number(e.target.value) })}
            helperText="必填，大于 0，最多两位小数，如 15.9"
            inputProps={{ min: 0.01, step: "0.01" }}
          />
          <TextField
            type="number"
            label="划线价（元）"
            value={form.originPriceYuan}
            onChange={(e) => setForm({ ...form, originPriceYuan: Number(e.target.value) })}
            helperText="选填，须大于售价才展示划线；0 表示不设"
            inputProps={{ min: 0, step: "0.01" }}
          />
          <TextField
            required
            select
            label="单位"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            helperText="必填，顾客端价格后展示，如 /瓶"
          >
            {units.map((u) => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            type="number"
            label="库存"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            helperText="必填，整数，0 表示售罄"
            inputProps={{ min: 0, step: 1 }}
          />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              商品图片 <Typography component="span" color="error">*</Typography>
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              最多 6 张，每张不超过 400KB，支持 jpg/png/webp。第一张为主图，保存时会按主图自动生成列表缩略图。
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              {form.images.map((url, idx) => (
                <Box
                  key={`${url}-${idx}`}
                  sx={{
                    position: "relative",
                    width: 96,
                    height: 96,
                    borderRadius: 1,
                    overflow: "hidden",
                    border: idx === 0 ? "2px solid #1976d2" : "1px solid #e0e0e0",
                    bgcolor: "#fafafa",
                  }}
                >
                  <Box
                    component="img"
                    src={url}
                    alt=""
                    sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  {idx === 0 && (
                    <Chip
                      label="主图"
                      size="small"
                      color="primary"
                      sx={{ position: "absolute", left: 4, bottom: 4, height: 20, fontSize: 11 }}
                    />
                  )}
                  <IconButton
                    size="small"
                    aria-label="删除图片"
                    onClick={() => setImages(form.images.filter((_, i) => i !== idx))}
                    sx={{ position: "absolute", top: 0, right: 0, bgcolor: "rgba(0,0,0,0.45)", color: "#fff", p: 0.25, "&:hover": { bgcolor: "rgba(0,0,0,0.65)" } }}
                  >
                    <CloseOutlined sx={{ fontSize: 16 }} />
                  </IconButton>
                  {idx > 0 && (
                    <Button
                      size="small"
                      onClick={() => {
                        const next = [...form.images];
                        const [picked] = next.splice(idx, 1);
                        next.unshift(picked);
                        setImages(next);
                      }}
                      sx={{ position: "absolute", left: 0, right: 0, bottom: 0, minWidth: 0, py: 0, fontSize: 11, bgcolor: "rgba(255,255,255,0.9)" }}
                    >
                      设为主图
                    </Button>
                  )}
                </Box>
              ))}
              {form.images.length < MAX_IMAGES && (
                <Button
                  component="label"
                  variant="outlined"
                  sx={{ width: 96, height: 96, minWidth: 96, borderStyle: "dashed" }}
                >
                  上传
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => {
                      uploadFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </Button>
              )}
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }} alignItems={{ sm: "flex-start" }}>
              <TextField
                size="small"
                fullWidth
                label="添加图片地址"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addImageUrl();
                  }
                }}
                helperText="选填，可粘贴已有图片 URL"
              />
              <Button variant="outlined" onClick={addImageUrl} sx={{ whiteSpace: "nowrap", height: 40, mt: { sm: "1px" }, width: { xs: "100%", sm: "auto" } }}>
                添加
              </Button>
            </Stack>
          </Box>
          <TextField
            multiline
            minRows={3}
            label="详情"
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
            helperText="选填，商品说明文案"
          />
          <TextField
            type="number"
            label="排序加权"
            value={form.manualWeight}
            onChange={(e) => setForm({ ...form, manualWeight: Number(e.target.value) })}
            helperText="选填，整数 -50 ~ 50，越大越靠前"
            inputProps={{ min: -50, max: 50, step: 1 }}
          />
          <TextField
            type="number"
            label="限时特价（元）"
            value={form.specialPriceYuan}
            onChange={(e) => setForm({ ...form, specialPriceYuan: Number(e.target.value) })}
            helperText="选填，大于 0 且须同时填写特价时间；0 为关闭"
            inputProps={{ min: 0, step: "0.01" }}
          />
          <TextField
            type="datetime-local"
            label="特价开始"
            InputLabelProps={{ shrink: true }}
            value={form.specialStart}
            onChange={(e) => setForm({ ...form, specialStart: e.target.value })}
            helperText="格式：年-月-日 时:分"
          />
          <TextField
            type="datetime-local"
            label="特价结束"
            InputLabelProps={{ shrink: true }}
            value={form.specialEnd}
            onChange={(e) => setForm({ ...form, specialEnd: e.target.value })}
            helperText="须晚于开始时间"
          />
          <FormControlLabel control={<Switch checked={form.onSale} onChange={(e) => setForm({ ...form, onSale: e.target.checked })} />} label="上架销售" />
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained">
              保存
            </Button>
            <Button variant="outlined" onClick={() => nav("/goods")}>
              取消
            </Button>
          </Stack>
        </Stack>
      </form>
    </PageContainer>
  );
}
