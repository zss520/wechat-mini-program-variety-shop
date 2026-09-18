import { db } from "./db";

export const MAX_ENABLED_ANNOUNCEMENTS = 20;

export function announcementMpPath(linkType: string, linkValue?: string | null, slot = "announce") {
  const type = String(linkType || "NONE");
  const value = String(linkValue || "").trim();
  if (type === "GOODS" && value) return `/pages/goods/detail?id=${value}&slot=${slot}&pos=1`;
  if (type === "PATH" && value.startsWith("/pages/")) return value;
  if (type === "CATEGORY") return "/pages/category/index";
  return "";
}

export function publicAnnouncement(row: Record<string, any>) {
  const linkType = String(row.link_type || "NONE");
  const linkValue = String(row.link_value || "");
  const mpPath = announcementMpPath(linkType, linkValue);
  return {
    id: Number(row.id),
    title: String(row.title || ""),
    content: String(row.content || ""),
    linkType,
    linkValue,
    canJump: Boolean(mpPath),
    mpPath,
    sort: Number(row.sort || 0),
    enabled: Number(row.enabled || 0),
  };
}

export async function listPublicAnnouncements() {
  const rows = await db("announcements").where({ enabled: 1 }).orderBy("sort", "desc").orderBy("id", "desc").limit(MAX_ENABLED_ANNOUNCEMENTS);
  return rows.map(publicAnnouncement);
}

export async function loadPublicAnnouncement(id: number) {
  const row = await db("announcements").where({ id, enabled: 1 }).first();
  return row ? publicAnnouncement(row) : null;
}
