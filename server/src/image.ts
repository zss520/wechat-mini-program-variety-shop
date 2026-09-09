import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import Jimp from "jimp";
import { config, publicUrl } from "./config";
import { HttpError } from "./http";

export const MAX_GOODS_IMAGES = 6;
export const MAX_IMAGE_BYTES = 400 * 1024;
export const THUMB_SIZE = 200;

const thumbsDir = path.join(config.uploadDir, "thumbs");

export function ensureUploadDirs() {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  fs.mkdirSync(thumbsDir, { recursive: true });
}

export function imagePathname(url?: string | null): string {
  const s = String(url || "").trim();
  if (!s) return "";
  try {
    if (/^https?:\/\//i.test(s)) {
      return new URL(s).pathname.replace(/\/+$/, "") || "/";
    }
  } catch {
    return "";
  }
  const noQuery = s.split("?")[0];
  return noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
}

export function sameImageUrl(a?: string | null, b?: string | null) {
  const pa = imagePathname(a);
  const pb = imagePathname(b);
  return Boolean(pa && pb && pa === pb);
}

function isInside(root: string, candidate: string) {
  const r = path.resolve(root);
  const c = path.resolve(candidate);
  return c === r || c.startsWith(r + path.sep);
}

export function resolveLocalImagePath(url: string): string | null {
  const pathname = imagePathname(url);
  if (!pathname) return null;
  if (pathname.startsWith("/uploads/")) {
    const rel = pathname.slice("/uploads/".length);
    const abs = path.resolve(config.uploadDir, rel);
    return isInside(config.uploadDir, abs) ? abs : null;
  }
  if (pathname.startsWith("/static/")) {
    const rel = pathname.slice("/static/".length);
    const abs = path.resolve(config.staticDir, rel);
    return isInside(config.staticDir, abs) ? abs : null;
  }
  return null;
}

export function normalizeGoodsImages(coverUrl: string, images?: string[] | null) {
  const raw = [coverUrl, ...(images || [])].map((u) => String(u || "").trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of raw) {
    const key = imagePathname(u) || u;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= MAX_GOODS_IMAGES) break;
  }
  if (!out.length) throw new HttpError(400, "请至少上传一张商品图片");
  return { coverUrl: out[0], images: out };
}

async function readCoverBuffer(coverUrl: string): Promise<Buffer> {
  const local = resolveLocalImagePath(coverUrl);
  if (local && fs.existsSync(local)) {
    return fs.promises.readFile(local);
  }
  const abs = /^https?:\/\//i.test(coverUrl) ? coverUrl : publicUrl(coverUrl);
  const resp = await axios.get<ArrayBuffer>(abs, {
    responseType: "arraybuffer",
    timeout: 15000,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 5 * 1024 * 1024,
  });
  return Buffer.from(resp.data);
}

export async function makeThumbFromCover(coverUrl: string): Promise<string> {
  const src = String(coverUrl || "").trim();
  if (!src) return "";
  ensureUploadDirs();
  const hash = crypto.createHash("sha1").update(imagePathname(src) || src).digest("hex").slice(0, 16);
  const filename = `t_${hash}.jpg`;
  const dest = path.join(thumbsDir, filename);
  const rel = `/uploads/thumbs/${filename}`;
  try {
    const buf = await readCoverBuffer(src);
    const image = await Jimp.read(buf);
    image.cover(THUMB_SIZE, THUMB_SIZE);
    image.quality(82);
    await image.writeAsync(dest);
    return rel;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("makeThumbFromCover failed", src, e);
    return "";
  }
}

export async function ensureGoodsThumb(
  coverUrl: string,
  existing?: { cover_url?: string | null; thumb_url?: string | null }
) {
  if (existing?.thumb_url && sameImageUrl(existing.cover_url, coverUrl)) {
    const local = resolveLocalImagePath(existing.thumb_url);
    if (local && fs.existsSync(local)) return existing.thumb_url;
    if (/^https?:\/\//i.test(existing.thumb_url) || existing.thumb_url.startsWith("/uploads/")) {
      return existing.thumb_url;
    }
  }
  return (await makeThumbFromCover(coverUrl)) || existing?.thumb_url || "";
}

export async function backfillMissingThumbs() {
  const { db } = await import("./db");
  const rows = await db("goods")
    .whereNull("deleted_at")
    .where(function () {
      this.whereNull("thumb_url").orWhere("thumb_url", "");
    })
    .select("id", "cover_url");
  for (const r of rows) {
    if (!r.cover_url) continue;
    const thumb = await makeThumbFromCover(r.cover_url);
    if (thumb) await db("goods").where({ id: r.id }).update({ thumb_url: thumb });
  }
}
