import fs from "fs";
import path from "path";
import { db } from "./db";
import { config } from "./config";
import { HttpError } from "./http";
import { imagePathname } from "./image";

export type MediaRef = {
  kind: "goods" | "banner" | "logo" | "group" | "avatar";
  role: string;
  id: number;
  label: string;
  to: string;
};

export type MediaItem = {
  key: string;
  url: string;
  name: string;
  folder: string;
  bytes: number;
  updatedAt: string;
  refs: MediaRef[];
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export function safeUploadRel(raw: string) {
  let rel = String(raw || "").trim().replace(/\\/g, "/");
  try {
    rel = decodeURIComponent(rel);
  } catch {
    return "";
  }
  rel = rel.replace(/^\/+/, "");
  if (rel.startsWith("uploads/")) rel = rel.slice("uploads/".length);
  if (!rel || rel.split("/").some((part) => !part || part === "." || part === "..")) return "";
  return rel;
}

export function mediaRelFromUrl(url: unknown) {
  const pathname = imagePathname(String(url || ""));
  if (!pathname.startsWith("/uploads/")) return "";
  return safeUploadRel(pathname.slice("/uploads/".length));
}

function uploadPublicPath(rel: string) {
  return `/uploads/${rel.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function absFromRel(rel: string) {
  const safe = safeUploadRel(rel);
  if (!safe) return "";
  const root = path.resolve(config.uploadDir);
  const abs = path.resolve(root, safe);
  if (abs !== root && !abs.startsWith(root + path.sep)) return "";
  return abs;
}

function pushRef(map: Map<string, MediaRef[]>, url: unknown, ref: MediaRef) {
  const rel = mediaRelFromUrl(url);
  if (!rel) return;
  const list = map.get(rel) || [];
  const sig = `${ref.kind}:${ref.id}:${ref.role}`;
  if (list.some((item) => `${item.kind}:${item.id}:${item.role}` === sig)) {
    map.set(rel, list);
    return;
  }
  list.push(ref);
  map.set(rel, list);
}

function asImageList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((item) => String(item || ""));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((item) => String(item || "")) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function loadRefMap() {
  const map = new Map<string, MediaRef[]>();
  const goods = await db("goods").select("id", "name", "cover_url", "thumb_url", "images", "deleted_at");
  for (const row of goods) {
    const deleted = Boolean(row.deleted_at);
    const label = `${String(row.name || "未命名商品")}${deleted ? "（已删除）" : ""}`;
    const to = deleted ? "" : `/goods/${row.id}`;
    const coverRel = mediaRelFromUrl(row.cover_url);
    pushRef(map, row.cover_url, { kind: "goods", role: "封面", id: Number(row.id), label, to });
    pushRef(map, row.thumb_url, { kind: "goods", role: "缩略图", id: Number(row.id), label, to });
    for (const image of asImageList(row.images)) {
      if (mediaRelFromUrl(image) && mediaRelFromUrl(image) === coverRel) continue;
      pushRef(map, image, { kind: "goods", role: "图集", id: Number(row.id), label, to });
    }
  }

  const banners = await db("banners").select("id", "title", "image_url");
  for (const row of banners) {
    const title = String(row.title || "").trim() || `轮播 #${row.id}`;
    pushRef(map, row.image_url, {
      kind: "banner",
      role: "轮播",
      id: Number(row.id),
      label: title,
      to: "/contents/banners",
    });
  }

  const logo = await db("shop_settings").where({ skey: "logo_url" }).first();
  if (logo?.svalue) {
    pushRef(map, logo.svalue, {
      kind: "logo",
      role: "店铺 Logo",
      id: 0,
      label: "店铺设置",
      to: "/shop/settings",
    });
  }

  const groups = await db("group_buy_activities").select("id", "title", "cover_url", "deleted_at");
  for (const row of groups) {
    if (!row.cover_url) continue;
    const deleted = Boolean(row.deleted_at);
    pushRef(map, row.cover_url, {
      kind: "group",
      role: "拼团封面",
      id: Number(row.id),
      label: `${String(row.title || "拼团")}${deleted ? "（已删除）" : ""}`,
      to: deleted ? "" : "/marketing/campaigns",
    });
  }

  const users = await db("users").select("id", "nickname", "avatar_url");
  for (const row of users) {
    if (!row.avatar_url) continue;
    pushRef(map, row.avatar_url, {
      kind: "avatar",
      role: "会员头像",
      id: Number(row.id),
      label: String(row.nickname || `会员 #${row.id}`),
      to: "/members",
    });
  }
  return map;
}

async function walkUploads(dir: string, prefix: string, out: { rel: string; bytes: number; mtimeMs: number }[]) {
  let entries: fs.Dirent[] = [];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkUploads(abs, rel, out);
      continue;
    }
    if (!entry.isFile() || !IMAGE_EXT.test(entry.name)) continue;
    try {
      const stat = await fs.promises.stat(abs);
      out.push({ rel: rel.split(path.sep).join("/"), bytes: stat.size, mtimeMs: stat.mtimeMs });
    } catch {
      /* skip unreadable */
    }
  }
}

export async function listMedia(query: { page: number; pageSize: number; usage?: string; keyword?: string }) {
  const files: { rel: string; bytes: number; mtimeMs: number }[] = [];
  await walkUploads(config.uploadDir, "", files);
  const refs = await loadRefMap();
  const keyword = String(query.keyword || "").trim().toLowerCase();
  const usage = query.usage === "used" || query.usage === "orphan" ? query.usage : "all";
  const matched = files
    .map((file) => {
      const itemRefs = refs.get(file.rel) || [];
      const folder = file.rel.includes("/") ? file.rel.slice(0, file.rel.lastIndexOf("/")) : "";
      return {
        key: file.rel,
        url: uploadPublicPath(file.rel),
        name: path.posix.basename(file.rel),
        folder,
        bytes: file.bytes,
        updatedAt: new Date(file.mtimeMs).toISOString(),
        refs: itemRefs,
        mtimeMs: file.mtimeMs,
      };
    })
    .filter((item) => {
      if (!keyword) return true;
      const hay = [item.key, item.name, ...item.refs.map((ref) => `${ref.role}${ref.label}`)].join(" ").toLowerCase();
      return hay.includes(keyword);
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const used = matched.filter((item) => item.refs.length > 0).length;
  const orphan = matched.length - used;
  const all =
    usage === "used" ? matched.filter((item) => item.refs.length > 0) : usage === "orphan" ? matched.filter((item) => item.refs.length === 0) : matched;

  const start = (query.page - 1) * query.pageSize;
  const list: MediaItem[] = all.slice(start, start + query.pageSize).map(({ mtimeMs: _mtime, ...item }) => item);
  return { list, page: query.page, pageSize: query.pageSize, total: all.length, used, orphan };
}

export async function deleteMedia(key: string) {
  const rel = safeUploadRel(key);
  const abs = absFromRel(rel);
  if (!rel || !abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new HttpError(404, "图片不存在");
  const refs = (await loadRefMap()).get(rel) || [];
  if (refs.length) {
    const where = refs
      .map((ref) => `${ref.role} ${ref.label}`)
      .slice(0, 4)
      .join("、");
    throw new HttpError(409, `图片仍在使用，不能删除：${where}`);
  }
  await fs.promises.unlink(abs);
  return true;
}
