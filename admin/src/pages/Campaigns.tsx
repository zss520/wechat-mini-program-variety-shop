import { Button, TextField, Typography } from "@mui/material";
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

const emptyGroup = {
  title: "",
  categoryId: 0,
  goodsId: 0,
  requiredCount: 2,
  groupPriceCent: 0,
  perUserLimit: 1,
  expireHours: 24,
  startAt: "",
  endAt: "",
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

  const addGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!g.title.trim()) return fb.alert("请填写拼团标题", { title: "请完善信息", severity: "warning" });
    if (!g.categoryId) return fb.alert("请选择分类", { title: "请完善信息", severity: "warning" });
    if (!g.goodsId) return fb.alert("请选择商品", { title: "请完善信息", severity: "warning" });
    if (!Number.isInteger(g.requiredCount) || g.requiredCount < 2) return fb.alert("成团人数须为不小于 2 的整数", { title: "请完善信息", severity: "warning" });
    if (!isValidYuan(g.groupPriceCent / 100)) return fb.alert("团价须为大于 0 的整数，单位是分，如 3290 表示 ¥32.90", { title: "请完善信息", severity: "warning" });
    if (!Number.isInteger(g.perUserLimit) || g.perUserLimit < 1 || g.perUserLimit > 99) {
      return fb.alert("每人限购须为 1～99 的整数", { title: "请完善信息", severity: "warning" });
    }
    if (!g.startAt || !g.endAt) return fb.alert("请填写开始和结束时间", { title: "请完善信息", severity: "warning" });
    if (g.startAt >= g.endAt) return fb.alert("结束时间须晚于开始时间", { title: "请完善信息", severity: "warning" });
    try {
      await api.post("/group-buys", { ...g, title: g.title.trim() });
      setG({ ...emptyGroup, categoryId: g.categoryId });
      setGGoods(null);
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
    <PageContainer title="拼团秒杀" description="先选分类再选商品，选完后显示原价。价格填「分」，如 3290 = ¥32.90。每人限购 1～99。时间格式为 年-月-日 时:分。">
      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        拼团
      </Typography>
      <form onSubmit={addGroup} noValidate>
        <InlineForm>
          <TextField required size="small" label="标题" placeholder="最多 40 字" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} inputProps={{ maxLength: 40 }} />
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
          <TextField required size="small" type="number" label="成团人数" placeholder="≥2 的整数" value={g.requiredCount} onChange={(e) => setG({ ...g, requiredCount: Number(e.target.value) })} inputProps={{ min: 2, step: 1 }} sx={{ width: 120 }} />
          <TextField required size="small" type="number" label="团价(分)" placeholder="如 3290" value={g.groupPriceCent} onChange={(e) => setG({ ...g, groupPriceCent: Number(e.target.value) })} inputProps={{ min: 1, step: 1 }} sx={{ width: 140 }} />
          <TextField required size="small" type="number" label="每人限购" placeholder="1～99" value={g.perUserLimit} onChange={(e) => setG({ ...g, perUserLimit: Number(e.target.value) })} inputProps={{ min: 1, max: 99, step: 1 }} sx={{ width: 120 }} />
          <TextField required size="small" type="datetime-local" label="开始" InputLabelProps={{ shrink: true }} value={g.startAt} onChange={(e) => setG({ ...g, startAt: e.target.value })} />
          <TextField required size="small" type="datetime-local" label="结束" InputLabelProps={{ shrink: true }} value={g.endAt} onChange={(e) => setG({ ...g, endAt: e.target.value })} />
          <Button type="submit" variant="contained">
            新建拼团
          </Button>
        </InlineForm>
      </form>
      <DataTable minWidth={880}>
        <TableHead>
          <TableRow>
            <TableCell>标题</TableCell>
            <TableCell>商品</TableCell>
            <TableCell>原价/团价</TableCell>
            <TableCell>人数/限购</TableCell>
            <TableCell>时间</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((x) => (
            <TableRow key={x.id}>
              <TableCell>{displayText(x.title)}</TableCell>
              <TableCell>{displayText(x.goods_name)}</TableCell>
              <TableCell>
                {displayYuan(x.origin_price_cent)} / {displayYuan(x.group_price_cent)}
              </TableCell>
              <TableCell>
                {displayNumber(x.required_count)}人 / 限{displayNumber(x.per_user_limit)}
              </TableCell>
              <TableCell>{formatDateRange(x.start_at, x.end_at)}</TableCell>
              <TableCell>
                <Button size="small" color="error" onClick={() => offline("group", x.id, x.title)}>
                  下线
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!groups.length && <EmptyRow cols={6} />}
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
