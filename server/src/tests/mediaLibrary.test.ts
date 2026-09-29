import fs from "fs";
import path from "path";
import { db } from "../db";
import { config } from "../config";
import { deleteMedia, listMedia, mediaRelFromUrl, safeUploadRel } from "../mediaLibrary";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function run() {
  assert(mediaRelFromUrl("http://127.0.0.1:3000/uploads/a.jpg") === "a.jpg", "absolute upload url");
  assert(mediaRelFromUrl("/uploads/thumbs/t_x.jpg") === "thumbs/t_x.jpg", "thumb path");
  assert(mediaRelFromUrl("/uploads/../.env") === "", "reject traversal");
  assert(safeUploadRel("thumbs/../../.env") === "", "reject nested traversal");
  assert(mediaRelFromUrl("/static/placeholders/p1.png") === "", "static files are not uploads");

  const name = `gallery_test_${Date.now()}.jpg`;
  const abs = path.join(config.uploadDir, name);
  fs.mkdirSync(config.uploadDir, { recursive: true });
  fs.writeFileSync(abs, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  let bannerId = 0;
  try {
    const orphan = await listMedia({ page: 1, pageSize: 50, usage: "orphan", keyword: name });
    assert(orphan.list.some((item) => item.key === name && item.refs.length === 0 && item.url === `/uploads/${name}`), "orphan upload is listed");
    const counts = await listMedia({ page: 1, pageSize: 20, usage: "used", keyword: name });
    assert(counts.used === 0 && counts.orphan === 1 && counts.total === 0, "usage filter does not zero the other count");
    await deleteMedia(name);
    assert(!fs.existsSync(abs), "orphan file deleted");

    fs.writeFileSync(abs, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const inserted = await db("banners").insert({
      image_url: `/uploads/${name}`,
      title: "图库测试",
      link_type: "NONE",
      link_value: "",
      sort: 0,
      enabled: 0,
    });
    bannerId = Number(inserted[0]);
    const used = await listMedia({ page: 1, pageSize: 20, usage: "used", keyword: name });
    const item = used.list.find((row) => row.key === name);
    assert(item && item.refs.some((ref) => ref.kind === "banner" && ref.to === "/contents/banners"), "banner reference");
    let blocked = false;
    try {
      await deleteMedia(name);
    } catch (e) {
      blocked = e instanceof Error && e.message.includes("不能删除");
    }
    assert(blocked && fs.existsSync(abs), "used image stays on disk");
  } finally {
    if (bannerId) await db("banners").where({ id: bannerId }).delete();
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
  await db.destroy();
  console.log("media library tests passed");
}

run().catch(async (e) => {
  console.error(e);
  try {
    await db.destroy();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
