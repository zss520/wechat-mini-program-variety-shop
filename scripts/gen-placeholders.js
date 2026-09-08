/* Generate committed PNG placeholders (no extra deps). */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(tag, data) {
  const t = Buffer.from(tag);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = row + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function fill(color) {
  return () => color;
}

function write(file, w, h, pixel) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png(w, h, pixel));
}

const colors = [
  [194, 65, 12],
  [180, 83, 9],
  [146, 64, 14],
  [120, 53, 15],
  [69, 26, 3],
  [154, 52, 18],
  [194, 120, 12],
  [124, 45, 18],
];

const dir = path.resolve(__dirname, "../server/static/placeholders");
fs.mkdirSync(dir, { recursive: true });
colors.forEach((c, i) => {
  write(
    path.join(dir, `p${i + 1}.png`),
    400,
    400,
    (x, y) => {
      const band = Math.floor(y / 40) % 2 === 0;
      const edge = x < 16 || y < 16 || x > 383 || y > 383;
      if (edge) return [255, 247, 237];
      return band ? c : [Math.min(255, c[0] + 30), Math.min(255, c[1] + 30), Math.min(255, c[2] + 20)];
    }
  );
});
write(path.join(dir, "empty.png"), 400, 400, fill([238, 238, 238]));
console.log("placeholders written", dir);
