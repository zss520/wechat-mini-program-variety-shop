import fs from "fs";
import path from "path";
import { config } from "../config";
import { makeThumbFromCover, normalizeGoodsImages, resolveLocalImagePath, MAX_GOODS_IMAGES } from "../image";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const n = normalizeGoodsImages("http://x/a.jpg", ["http://x/a.jpg", "http://x/b.jpg", "", "http://x/c.jpg"]);
  assert(n.coverUrl === "http://x/a.jpg", "cover should be first unique url");
  assert(n.images.length === 3, `expected 3 images got ${n.images.length}`);

  const many = Array.from({ length: 10 }, (_, i) => `http://x/${i}.jpg`);
  const capped = normalizeGoodsImages(many[0], many);
  assert(capped.images.length === MAX_GOODS_IMAGES, "images should cap at 6");

  const local = resolveLocalImagePath("/static/placeholders/p1.png");
  assert(local && fs.existsSync(local), "placeholder p1.png should exist");

  const thumb = await makeThumbFromCover("/static/placeholders/p1.png");
  assert(thumb.startsWith("/uploads/thumbs/") && thumb.endsWith(".jpg"), `unexpected thumb path ${thumb}`);
  const abs = path.join(config.uploadDir, thumb.replace(/^\/uploads\//, ""));
  assert(fs.existsSync(abs), "thumb file should be written");
  const size = fs.statSync(abs).size;
  assert(size > 0, "thumb should not be empty");
  console.log("image test passed", { thumb, size });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
