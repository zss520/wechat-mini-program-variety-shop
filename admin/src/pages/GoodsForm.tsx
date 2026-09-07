import { Alert, Button, MenuItem, Stack, Switch, TextField, Typography, FormControlLabel } from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

type Cat = { id: number; name: string };

export default function GoodsForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [cats, setCats] = useState<Cat[]>([]);
  const [err, setErr] = useState("");
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
  });
  useEffect(() => {
    api.get("/categories").then((list: Cat[]) => {
      setCats(list);
      if (!id && list[0]) setForm((f) => ({ ...f, categoryId: list[0].id }));
    });
    if (id) {
      api.get(`/goods/${id}`).then((g: Record<string, unknown>) => {
        setForm({
          name: String(g.name),
          subtitle: String(g.subtitle || ""),
          categoryId: Number(g.category_id),
          priceYuan: Number(g.price_cent) / 100,
          originPriceYuan: g.origin_price_cent ? Number(g.origin_price_cent) / 100 : 0,
          unit: String(g.unit),
          stock: Number(g.stock),
          coverUrl: String(g.cover_url || ""),
          detail: String(g.detail || ""),
          onSale: Boolean(g.on_sale),
          sort: Number(g.sort || 0),
          manualWeight: Number(g.manual_weight || 0),
        });
      });
    }
  }, [id]);

  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setForm((f) => ({ ...f, coverUrl: r.url }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const payload = { ...form, originPriceYuan: form.originPriceYuan || null };
      if (id) await api.put(`/goods/${id}`, payload);
      else await api.post("/goods", payload);
      nav("/goods");
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  return (
    <>
      <Typography variant="h5" gutterBottom>
        {id ? "编辑商品" : "新建商品"}
      </Typography>
      {err && <Alert severity="error">{err}</Alert>}
      <form onSubmit={submit}>
        <Stack spacing={2} sx={{ maxWidth: 640 }}>
          <TextField required label="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="副标题" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          <TextField select label="分类" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>
            {cats.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField required type="number" label="售价(元)" value={form.priceYuan} onChange={(e) => setForm({ ...form, priceYuan: Number(e.target.value) })} />
          <TextField type="number" label="划线价(元，可空)" value={form.originPriceYuan} onChange={(e) => setForm({ ...form, originPriceYuan: Number(e.target.value) })} />
          <TextField label="单位" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <TextField type="number" label="库存" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
          <TextField label="主图 URL" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} />
          <Button component="label" variant="outlined">
            上传主图
            <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files && upload(e.target.files[0])} />
          </Button>
          {form.coverUrl && <img src={form.coverUrl} alt="" style={{ width: 120 }} />}
          <TextField multiline minRows={3} label="详情" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} />
          <TextField type="number" label="排序加权(-50~50)" value={form.manualWeight} onChange={(e) => setForm({ ...form, manualWeight: Number(e.target.value) })} />
          <FormControlLabel control={<Switch checked={form.onSale} onChange={(e) => setForm({ ...form, onSale: e.target.checked })} />} label="上架" />
          <Button type="submit" variant="contained">
            保存
          </Button>
        </Stack>
      </form>
    </>
  );
}
