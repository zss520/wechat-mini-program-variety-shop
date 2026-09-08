/** 展示用时间：去掉 ISO 的 T，统一为 YYYY-MM-DD HH:mm 或带秒 */
export function formatDateTime(input?: string | number | Date | null, withSeconds = false): string {
  if (input == null || input === "") return "—";
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return "—";
    const pad = (n: number) => String(n).padStart(2, "0");
    const s = `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())} ${pad(input.getHours())}:${pad(input.getMinutes())}${
      withSeconds ? `:${pad(input.getSeconds())}` : ""
    }`;
    return s;
  }
  const raw = String(input).trim();
  if (!raw || raw === "Invalid Date") return "—";
  let s = raw.replace("T", " ").replace(/\.\d+Z?$/i, "").replace(/Z$/i, "");
  s = s.replace(/[+-]\d{2}:\d{2}$/, "").trim();
  if (withSeconds) {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return `${s}:00`;
    return s.slice(0, 19) || "—";
  }
  return s.slice(0, 16) || "—";
}

export function formatDateRange(start?: string | number | Date | null, end?: string | number | Date | null): string {
  const a = formatDateTime(start);
  const b = formatDateTime(end);
  if (a === "—" && b === "—") return "—";
  return `${a} ~ ${b}`;
}
