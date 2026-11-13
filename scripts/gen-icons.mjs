/**
 * F-010: PWA icon generator — pure Node (no canvas dependency).
 * Draws the darkmic phone icon (dark bg + green mic) with 4x supersampling
 * and writes PNGs via a minimal zlib-based encoder.
 *
 * Usage: node scripts/gen-icons.mjs   → public/icons/icon-192.png, icon-512.png
 *
 * Shape layout (normalized, maskable safe zone = center 80%):
 *   capsule  center (0.50, 0.40), w 0.20, h 0.34, r 0.10
 *   stem     center (0.50, 0.635), w 0.022, h 0.09
 *   base bar center (0.50, 0.715), w 0.26, h 0.035, r 0.0175
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── minimal PNG encoder ──────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  // filter 0 on every scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── shape rasterization ──────────────────────────────────────────────

const BG = [0x11, 0x11, 0x11];
const FG = [0x22, 0xc5, 0x5e]; // brand green (matches the Start button)

/** Signed distance to a rounded rectangle, <0 inside. */
function sdRoundRect(px, py, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(px - cx) - (halfW - r);
  const qy = Math.abs(py - cy) - (halfH - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function insideMic(nx, ny) {
  if (sdRoundRect(nx, ny, 0.50, 0.40, 0.10, 0.17, 0.10) < 0) return true; // capsule
  if (sdRoundRect(nx, ny, 0.50, 0.635, 0.011, 0.045, 0.011) < 0) return true; // stem
  if (sdRoundRect(nx, ny, 0.50, 0.715, 0.13, 0.0175, 0.0175) < 0) return true; // base bar
  return false;
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4; // supersampling grid per axis
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let fgHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size;
          const ny = (y + (sy + 0.5) / SS) / size;
          if (insideMic(nx, ny)) fgHits++;
        }
      }
      const a = fgHits / (SS * SS);
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(FG[0] * a + BG[0] * (1 - a));
      rgba[i + 1] = Math.round(FG[1] * a + BG[1] * (1 - a));
      rgba[i + 2] = Math.round(FG[2] * a + BG[2] * (1 - a));
      rgba[i + 3] = 0xff;
    }
  }
  return encodePng(size, size, rgba);
}

// ── main ─────────────────────────────────────────────────────────────

const outDir = join(ROOT, 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = renderIcon(size);
  const path = join(outDir, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}
