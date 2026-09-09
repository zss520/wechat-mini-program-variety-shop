import { Button, FormControlLabel, MenuItem, Stack, Switch, TextField } from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import { useFeedback } from "../components/FeedbackProvider";
import { asArray, displayText } from "../utils/display";
import { goodsUnitOptions, isValidNonNegInt, isValidYuan } from "../utils/message";

type Cat = { id: number; name: string };

export default function GoodsForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const fb = useFeedback();
  const [cats, setCats] = useState<Cat[]>([]);
  const [form, setForm] = useState({
    name: "",
    subtitle: "",
    categoryId: 0,
    priceYuan: 0,
    originPriceYuan: 0,
    unit: "件",
    stock: 0,
    coverUrl: "",
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
          coverUrl: String(g.cover_url || ""),
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

  const upload = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, coverUrl: r.url }));
      await fb.success("主图已上传");
    } catch (e) {
      await fb.error(e, "图片上传失败");
    }
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
    if (!form.coverUrl.trim()) return "请上传主图或填写图片地址";
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
        <Stack spacing={2} sx={{ maxWidth: 640 }}>
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
          <TextField
            required
            label="主图地址"
            value={form.coverUrl}
            onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
            helperText="必填，可上传或粘贴图片 URL"
          />
          <Button component="label" variant="outlined">
            上传主图
            <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files && upload(e.target.files[0])} />
          </Button>
          {form.coverUrl && <img src={form.coverUrl} alt="" style={{ width: 120, borderRadius: 6 }} />}
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
