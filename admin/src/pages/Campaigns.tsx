import { Box, Button, Chip, IconButton, TextField, Typography } from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import PageContainer from "../components/PageContainer";
import InlineForm from "../components/InlineForm";
import { DataTable, EmptyRow, TableBody, TableCell, TableHead, TableRow } from "../components/DataTable";
import { useFeedback } from "../components/FeedbackProvider";
import GoodsByCategoryPicker, { PickerCat, PickerGoods } from "../components/GoodsByCategoryPicker";
import { formatDateRange } from "../utils/datetime";
import { asArray, displayNumber, displayText, displayYuan } from "../utils/display";
import { isValidNonNegInt, isValidYuan } from "../utils/message";

const MAX_IMAGE_BYTES = 400 * 1024;
const MAX_COMBO = 8;

type ComboItem = {
  goodsId: number;
  name: string;
  originPriceCent: number;
  groupPriceCent: number;
  coverUrl: string;
};

const emptyGroup = {
  title: "",
  categoryId: 0,
  goodsId: 0,
  itemPriceCent: 0,
  requiredCount: 2,
  perUserLimit: 1,
  expireHours: 24,
  startAt: "",
  endAt: "",
  coverUrl: "",
};
const emptySeckill = {
  title: "",
  categoryId: 0,
  goodsId: 0,
  seckillPriceCent: 0,
  seckillStock: 10,
  perUserLimit: 1,
  startAt: "",
  endAt: "",
};

export default function Campaigns() {
  const fb = useFeedback();
  const [cats, setCats] = useState<PickerCat[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [seckills, setSeckills] = useState<any[]>([]);
  const [g, setG] = useState(emptyGroup);
  const [s, setS] = useState(emptySeckill);
  const [gGoods, setGGoods] = useState<PickerGoods | null>(null);
  const [sGoods, setSGoods] = useState<PickerGoods | null>(null);
  const [combo, setCombo] = useState<ComboItem[]>([]);

  const load = () => {
    api
      .get("/categories")
      .then((d) => setCats(asArray<PickerCat>(d)))
      .catch((e) => fb.error(e));
    api.get("/group-buys").then((d) => setGroups(asArray(d))).catch((e) => fb.error(e));
    api.get("/seckills").then((d) => setSeckills(asArray(d))).catch((e) => fb.error(e));
  };
  useEffect(() => {
    load();
  }, []);

  const uploadCover = async (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      await fb.alert("标题图不超过 400KB，请压缩后再传", { title: "请完善信息", severity: "warning" });
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (r?.url) {
        setG((x) => ({ ...x, coverUrl: r.url }));
        await fb.success("标题图已上传");
      }
    } catch (e) {
      await fb.error(e, "图片上传失败");
    }
  };

  const addComboItem = async () => {
    if (!g.categoryId) return fb.alert("请选择分类", { title: "请完善信息", severity: "warning" });
    if (!g.goodsId || !gGoods) return fb.alert("请选择要加入组合的商品", { title: "请完善信息", severity: "warning" });
    if (combo.some((x) => x.goodsId === g.goodsId)) return fb.alert("该商品已在组合中", { title: "请完善信息", severity: "warning" });
    if (combo.length >= MAX_COMBO) return fb.alert("一组最多 8 件商品", { title: "请完善信息", severity: "warning" });
    if (!isValidYuan(g.itemPriceCent / 100)) return fb.alert("该商品团价须为大于 0 的整数，单位是分，如 3290 表示 ¥32.90", { title: "请完善信息", severity: "warning" });
    setCombo((list) => [
      ...list,
      {
        goodsId: g.goodsId,
        name: gGoods.name,
        originPriceCent: Number(gGoods.price_cent || 0),
        groupPriceCent: g.itemPriceCent,
        coverUrl: String((gGoods as PickerGoods & { cover_url?: string }).cover_url || ""),
      },
    ]);
    setG((x) => ({ ...x, goodsId: 0, itemPriceCent: 0 }));
    setGGoods(null);
  };

  const addGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!g.title.trim()) return fb.alert("请填写拼团标题", { title: "请完善信息", severity: "warning" });
    if (!combo.length) return fb.alert("请至少加入一件商品到组合", { title: "请完善信息", severity: "warning" });
    if (!Number.isInteger(g.requiredCount) || g.requiredCount < 2) return fb.alert("成团人数须为不小于 2 的整数", { title: "请完善信息", severity: "warning" });
    if (!Number.isInteger(g.perUserLimit) || g.perUserLimit < 1 || g.perUserLimit > 99) {
      return fb.alert("每人限购须为 1～99 的整数", { title: "请完善信息", severity: "warning" });
    }
    if (!g.startAt || !g.endAt) return fb.alert("请填写开始和结束时间", { title: "请完善信息", severity: "warning" });
    if (g.startAt >= g.endAt) return fb.alert("结束时间须晚于开始时间", { title: "请完善信息", severity: "warning" });
    try {
      await api.post("/group-buys", {
        title: g.title.trim(),
        coverUrl: g.coverUrl.trim(),
        requiredCount: g.requiredCount,
        perUserLimit: g.perUserLimit,
        expireHours: g.expireHours,
        startAt: g.startAt,
        endAt: g.endAt,
        goodsId: combo[0].goodsId,
        groupPriceCent: Math.min(...combo.map((x) => x.groupPriceCent)),
        goodsItems: combo.map((x) => ({ goodsId: x.goodsId, groupPriceCent: x.groupPriceCent })),
      });
      setG({ ...emptyGroup });
      setGGoods(null);
      setCombo([]);
      load();
      await fb.success("拼团已创建");
    } catch (err) {
      await fb.error(err);
    }
  };

  const addSeckill = async (e: FormEvent) => {
    e.preventDefault();
    if (!s.title.trim()) return fb.alert("请填写秒杀标题", { title: "请完善信息", severity: "warning" });
    if (!s.categoryId) return fb.alert("请选择分类", { title: "请完善信息", severity: "warning" });
    if (!s.goodsId) return fb.alert("请选择商品", { title: "请完善信息", severity: "warning" });
    if (!isValidYuan(s.seckillPriceCent / 100)) return fb.alert("秒杀价须为大于 0 的整数，单位是分，如 1290 表示 ¥12.90", { title: "请完善信息", severity: "warning" });
    if (!isValidNonNegInt(s.seckillStock) || s.seckillStock < 1) return fb.alert("秒杀库存须为大于 0 的整数", { title: "请完善信息", severity: "warning" });
    if (!Number.isInteger(s.perUserLimit) || s.perUserLimit < 1 || s.perUserLimit > 99) {
      return fb.alert("每人限购须为 1～99 的整数", { title: "请完善信息", severity: "warning" });
    }
    if (!s.startAt || !s.endAt) return fb.alert("请填写开始和结束时间", { title: "请完善信息", severity: "warning" });
    if (s.startAt >= s.endAt) return fb.alert("结束时间须晚于开始时间", { title: "请完善信息", severity: "warning" });
    try {
      await api.post("/seckills", { ...s, title: s.title.trim() });
      setS({ ...emptySeckill, categoryId: s.categoryId });
      setSGoods(null);
      load();
      await fb.success("秒杀已创建");
    } catch (err) {
      await fb.error(err);
    }
  };

  const offline = async (kind: "group" | "seckill", id: number, title: string) => {
    const ok = await fb.confirm(`确定下线「${title}」？下线后顾客端不再展示。`, { title: "下线活动", danger: true, confirmText: "下线" });
    if (!ok) return;
    try {
      await api.delete(kind === "group" ? `/group-buys/${id}` : `/seckills/${id}`);
      load();
      await fb.success("活动已下线");
    } catch (e) {
      await fb.error(e);
    }
  };

  return (
    <PageContainer title="拼团秒杀" description="拼团可上传标题图、加入多件商品组合；每位商品单独填团价（单位「分」）。列表会显示团内商品和进行中团的支付进度。">
      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        拼团
      </Typography>
      <form onSubmit={addGroup} noValidate>
        <InlineForm>
          <TextField required size="small" label="标题" placeholder="最多 40 字" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} inputProps={{ maxLength: 40 }} />
          <Button component="label" variant="outlined" size="small">
            {g.coverUrl ? "更换标题图" : "上传标题图"}
            <input
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadCover(file);
              }}
            />
          </Button>
          {g.coverUrl ? (
            <Box sx={{ position: "relative", width: 40, height: 40, borderRadius: 1, overflow: "hidden", border: "1px solid #eee" }}>
              <Box component="img" src={g.coverUrl} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <IconButton
                size="small"
                aria-label="删除标题图"
                onClick={() => setG({ ...g, coverUrl: "" })}
                sx={{ position: "absolute", top: -6, right: -6, bgcolor: "rgba(0,0,0,0.45)", color: "#fff", p: 0.1, "&:hover": { bgcolor: "rgba(0,0,0,0.65)" } }}
              >
                <CloseOutlined sx={{ fontSize: 12 }} />
              </IconButton>
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary">
              可选，不传则用组合首图
            </Typography>
          )}
          <TextField required size="small" type="number" label="成团人数" placeholder="≥2 的整数" value={g.requiredCount} onChange={(e) => setG({ ...g, requiredCount: Number(e.target.value) })} inputProps={{ min: 2, step: 1 }} sx={{ width: 120 }} />
          <TextField required size="small" type="number" label="每人限购" placeholder="1～99" value={g.perUserLimit} onChange={(e) => setG({ ...g, perUserLimit: Number(e.target.value) })} inputProps={{ min: 1, max: 99, step: 1 }} sx={{ width: 120 }} />
          <TextField required size="small" type="datetime-local" label="开始" InputLabelProps={{ shrink: true }} value={g.startAt} onChange={(e) => setG({ ...g, startAt: e.target.value })} />
          <TextField required size="small" type="datetime-local" label="结束" InputLabelProps={{ shrink: true }} value={g.endAt} onChange={(e) => setG({ ...g, endAt: e.target.value })} />
        </InlineForm>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          商品组合
        </Typography>
        <InlineForm>
          <GoodsByCategoryPicker
            cats={cats}
            categoryId={g.categoryId}
            goodsId={g.goodsId}
            onCategory={(id) => {
              setG((x) => ({ ...x, categoryId: id, goodsId: 0 }));
              setGGoods(null);
            }}
            onGoods={(item) => {
              setG((x) => ({ ...x, goodsId: item?.id || 0 }));
              setGGoods(item);
            }}
          />
          <TextField size="small" label="原价" value={gGoods ? displayYuan(gGoods.price_cent) : "选商品后预览"} InputProps={{ readOnly: true }} sx={{ width: 140 }} />
          <TextField required size="small" type="number" label="该商品团价(分)" placeholder="如 3290" value={g.itemPriceCent} onChange={(e) => setG({ ...g, itemPriceCent: Number(e.target.value) })} inputProps={{ min: 1, step: 1 }} sx={{ width: 160 }} />
          <Button type="button" variant="outlined" onClick={() => void addComboItem()}>
            加入组合
          </Button>
          <Button type="submit" variant="contained">
            新建拼团
          </Button>
        </InlineForm>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          {combo.map((item) => (
            <Chip
              key={item.goodsId}
              label={`${displayText(item.name)} ${displayYuan(item.originPriceCent)} / ${displayYuan(item.groupPriceCent)}`}
              onDelete={() => setCombo((list) => list.filter((x) => x.goodsId !== item.goodsId))}
            />
          ))}
          {!combo.length && (
            <Typography variant="caption" color="text.secondary">
              先选分类和商品，填该件团价后点「加入组合」，可加入多件
            </Typography>
          )}
        </Box>
      </form>
      <DataTable minWidth={980}>
        <TableHead>
          <TableRow>
            <TableCell>标题</TableCell>
            <TableCell>商品组合</TableCell>
            <TableCell>原价/团价</TableCell>
            <TableCell>人数/限购</TableCell>
            <TableCell>进度</TableCell>
            <TableCell>时间</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((x) => {
            const items = asArray<{ goods_name?: string; origin_price_cent?: number; group_price_cent?: number }>(x.goods_items);
            const names = displayText(x.goods_names || items.map((i) => i.goods_name).join("、") || x.goods_name);
            const origin = items.length ? Math.min(...items.map((i) => Number(i.origin_price_cent || 0))) : x.origin_price_cent;
            const groupPrice = items.length ? Math.min(...items.map((i) => Number(i.group_price_cent || 0))) : x.group_price_cent;
            const openN = Number(x.open_team_count || 0);
            const paid = Number(x.progress_paid || 0);
            const need = Number(x.progress_required || x.required_count || 0);
            return (
              <TableRow key={x.id}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {x.cover_url ? (
                      <Box component="img" src={x.cover_url} alt="" sx={{ width: 36, height: 36, objectFit: "cover", borderRadius: 1 }} />
                    ) : null}
                    {displayText(x.title)}
                  </Box>
                </TableCell>
                <TableCell>{names}</TableCell>
                <TableCell>
                  {items.length > 1
                    ? `${items.length}件 · 团价${displayYuan(groupPrice)}起`
                    : `${displayYuan(origin)} / ${displayYuan(groupPrice)}`}
                </TableCell>
                <TableCell>
                  {displayNumber(x.required_count)}人 / 限{displayNumber(x.per_user_limit)}
                </TableCell>
                <TableCell>
                  {openN ? `进行中${openN}团 · 已支付${paid}/${need}` : "暂无开团"}
                </TableCell>
                <TableCell>{formatDateRange(x.start_at, x.end_at)}</TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={() => offline("group", x.id, x.title)}>
                    下线
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {!groups.length && <EmptyRow cols={7} />}
        </TableBody>
      </DataTable>

      <Typography variant="subtitle1" sx={{ mt: 4, mb: 1.5 }}>
        秒杀
      </Typography>
      <form onSubmit={addSeckill} noValidate>
        <InlineForm>
          <TextField required size="small" label="标题" placeholder="最多 40 字" value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} inputProps={{ maxLength: 40 }} />
          <GoodsByCategoryPicker
            cats={cats}
            categoryId={s.categoryId}
            goodsId={s.goodsId}
            onCategory={(id) => {
              setS((x) => ({ ...x, categoryId: id, goodsId: 0 }));
              setSGoods(null);
            }}
            onGoods={(item) => {
              setS((x) => ({ ...x, goodsId: item?.id || 0 }));
              setSGoods(item);
            }}
          />
          <TextField size="small" label="原价" value={sGoods ? displayYuan(sGoods.price_cent) : "选商品后预览"} InputProps={{ readOnly: true }} sx={{ width: 140 }} />
          <TextField required size="small" type="number" label="秒杀价(分)" placeholder="如 1290" value={s.seckillPriceCent} onChange={(e) => setS({ ...s, seckillPriceCent: Number(e.target.value) })} inputProps={{ min: 1, step: 1 }} sx={{ width: 140 }} />
          <TextField required size="small" type="number" label="秒杀库存" placeholder="正整数" value={s.seckillStock} onChange={(e) => setS({ ...s, seckillStock: Number(e.target.value) })} inputProps={{ min: 1, step: 1 }} sx={{ width: 120 }} />
          <TextField required size="small" type="number" label="每人限购" placeholder="1～99" value={s.perUserLimit} onChange={(e) => setS({ ...s, perUserLimit: Number(e.target.value) })} inputProps={{ min: 1, max: 99, step: 1 }} sx={{ width: 120 }} />
          <TextField required size="small" type="datetime-local" label="开始" InputLabelProps={{ shrink: true }} value={s.startAt} onChange={(e) => setS({ ...s, startAt: e.target.value })} />
          <TextField required size="small" type="datetime-local" label="结束" InputLabelProps={{ shrink: true }} value={s.endAt} onChange={(e) => setS({ ...s, endAt: e.target.value })} />
          <Button type="submit" variant="contained">
            新建秒杀
          </Button>
        </InlineForm>
      </form>
      <DataTable minWidth={880}>
        <TableHead>
          <TableRow>
            <TableCell>标题</TableCell>
            <TableCell>商品</TableCell>
            <TableCell>原价/秒杀价</TableCell>
            <TableCell>库存/限购</TableCell>
            <TableCell>时间</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {seckills.map((x) => (
            <TableRow key={x.id}>
              <TableCell>{displayText(x.title)}</TableCell>
              <TableCell>{displayText(x.goods_name)}</TableCell>
              <TableCell>
                {displayYuan(x.origin_price_cent)} / {displayYuan(x.seckill_price_cent)}
              </TableCell>
              <TableCell>
                剩{displayNumber(x.seckill_stock)} / 限{displayNumber(x.per_user_limit)}
              </TableCell>
              <TableCell>{formatDateRange(x.start_at, x.end_at)}</TableCell>
              <TableCell>
                <Button size="small" color="error" onClick={() => offline("seckill", x.id, x.title)}>
                  下线
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!seckills.length && <EmptyRow cols={6} />}
        </TableBody>
      </DataTable>
    </PageContainer>
  );
}
