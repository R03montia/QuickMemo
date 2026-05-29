/**
 * QuickMemo icon generator
 * Generates app icon (256x256 PNG), tray icon (32x32 PNG), and .ico for shortcut
 * Pure Node.js — no external dependencies
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SIZES = [16, 32, 48, 64, 128, 256];
const ACCENT = '#005fb8'; // default accent for icon generation

// ====== PNG Encoder ======
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcData = Buffer.concat([t, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, t, data, crcVal]);
}

function createPNG(width, height, getPixel) {
  // Raw scanlines (filter byte 0 + RGBA pixels)
  const rawSize = height * (1 + width * 4);
  const raw = Buffer.alloc(rawSize);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const p = getPixel(x, y);
      const off = rowStart + 1 + x * 4;
      raw[off] = Math.max(0, Math.min(255, Math.round(p.r)));
      raw[off + 1] = Math.max(0, Math.min(255, Math.round(p.g)));
      raw[off + 2] = Math.max(0, Math.min(255, Math.round(p.b)));
      raw[off + 3] = Math.max(0, Math.min(255, Math.round(p.a)));
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ====== Drawing Primitives ======
function clamp(v) { return Math.max(0, Math.min(255, v)); }

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Signed distance to a rounded rectangle
function sdRoundedRect(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx) - w / 2 + r;
  const dy = Math.abs(y - cy) - h / 2 + r;
  return Math.min(Math.max(dx, dy), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - r;
}

// Signed distance to a line segment
function sdLine(px, py, x1, y1, x2, y2) {
  const abx = x2 - x1, aby = y2 - y1;
  const apx = px - x1, apy = py - y1;
  let t = (apx * abx + apy * aby) / (abx * abx + aby * aby);
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * abx, cy = y1 + t * aby;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

// ====== Icon Design ======
function createDrawer(width, height, accentHex) {
  const ar = parseInt(accentHex.slice(1,3), 16);
  const ag = parseInt(accentHex.slice(3,5), 16);
  const ab = parseInt(accentHex.slice(5,7), 16);

  return function getPixel(x, y) {
    // Always work in 256x256 coordinate space, then scale
    const scale = 256 / Math.max(width, height);
    const sx = x * scale, sy = y * scale;

    let r = 0, g = 0, b = 0, a = 0;

    // === Background: squircle (super-ellipse) ===
    const pad = 20;
    const radius = 48;
    const bgSize = 256 - pad * 2;
    const bgDist = sdRoundedRect(sx, sy, 128, 128, bgSize, bgSize, radius);
    const bgAlpha = clamp(255 * (1 - smoothstep(0, 1.5, bgDist)));

    if (bgAlpha > 0) {
      // Gradient: top-left to bottom-right
      const grad = 0.7 + 0.3 * ((sx + sy) / 512);
      r = clamp(ar * grad);
      g = clamp(ag * grad);
      b = clamp(ab * grad);
      a = bgAlpha;
    }

    // === White note page symbol ===
    const noteW = 104, noteH = 128, noteCX = 128, noteCY = 130;
    const noteDist = sdRoundedRect(sx, sy, noteCX, noteCY, noteW, noteH, 10);
    const noteAlpha = clamp(255 * (1 - smoothstep(0, 1.2, noteDist)));

    if (noteAlpha > 0 && bgAlpha > 10) {
      const blend = noteAlpha / 255;
      const bgA = bgAlpha / 255;
      r = clamp(r * (1 - blend) + 255 * blend);
      g = clamp(g * (1 - blend) + 255 * blend);
      b = clamp(b * (1 - blend) + 255 * blend);
      a = clamp(a * (1 - blend) + 255 * blend);
    }

    // === Fold effect (bottom-right corner of the note) ===
    const foldDist = sdRoundedRect(sx - 6, sy - 6, noteCX + noteW/2 - 8, noteCY + noteH/2 - 8, 24, 24, 4);
    const foldAlpha = clamp(255 * (1 - smoothstep(0, 1.2, foldDist)));
    if (foldAlpha > 0 && noteAlpha > 10) {
      const blend = foldAlpha / 255 * 0.5;
      r = clamp(r * (1 - blend));
      g = clamp(g * (1 - blend));
      b = clamp(b * (1 - blend));
    }

    // === Text lines on the note ===
    const lines = [
      { y: 102, w: 64 }, // title line (shorter, bolder)
      { y: 120, w: 76 },
      { y: 138, w: 68 },
      { y: 156, w: 72 },
    ];

    for (const line of lines) {
      const lx = noteCX, ly = line.y, lw = line.w;
      const lDist = sdRoundedRect(sx, sy, lx, ly, lw, 4, 2);
      const lAlpha = clamp(200 * (1 - smoothstep(0, 1, lDist)));
      if (lAlpha > 5 && noteAlpha > 10) {
        const blend = lAlpha / 255 * 0.85;
        r = clamp(r * (1 - blend) + ar * blend * 0.15);
        g = clamp(g * (1 - blend) + ag * blend * 0.15);
        b = clamp(b * (1 - blend) + ab * blend * 0.15);
        a = clamp(a);
      }
    }

    // === Checkmark on last line ===
    const ckSize = 10;
    const ckX = noteCX + 30, ckY = 156;
    const ckPoints = [
      [ckX - ckSize * 0.5, ckY],
      [ckX - ckSize * 0.15, ckY + ckSize * 0.5],
      [ckX + ckSize * 0.6, ckY - ckSize * 0.4],
    ];
    // Draw checkmark as two line segments
    for (let i = 0; i < 2; i++) {
      const d = sdLine(sx, sy, ckPoints[i][0], ckPoints[i][1], ckPoints[i+1][0], ckPoints[i+1][1]);
      const ckAlpha = clamp(200 * (1 - smoothstep(0, 1.2, d)));
      if (ckAlpha > 5 && noteAlpha > 10) {
        const blend = ckAlpha / 255;
        r = clamp(r * (1 - blend) + 80 * blend);
        g = clamp(g * (1 - blend) + 200 * blend);
        b = clamp(b * (1 - blend) + 80 * blend);
      }
    }

    // === Pin/reminder circle at top-right ===
    const pinCX = noteCX + noteW/2 - 14, pinCY = noteCY - noteH/2 + 14, pinR = 8;
    const pinDist = Math.sqrt((sx - pinCX) ** 2 + (sy - pinCY) ** 2) - pinR;
    const pinAlpha = clamp(255 * (1 - smoothstep(0, 1, pinDist)));
    if (pinAlpha > 5 && bgAlpha > 10) {
      const pr = 255, pg = 80, pb = 80;
      const blend = pinAlpha / 255;
      r = clamp(r * (1 - blend) + pr * blend);
      g = clamp(g * (1 - blend) + pg * blend);
      b = clamp(b * (1 - blend) + pb * blend);
      a = a; // keep original alpha
    }

    return { r, g, b, a };
  };
}

// ====== ICO Encoder ======
function createICO(pngBuffersBySize) {
  const count = pngBuffersBySize.length;
  let offset = 6 + count * 16;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type: ICO
  header.writeUInt16LE(count, 4);

  const entries = [];
  const allData = [];

  for (const { size, pngBuffer } of pngBuffersBySize) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);  // color count
    entry.writeUInt8(0, 3);  // reserved
    entry.writeUInt16LE(1, 4);  // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(pngBuffer.length, 8); // data size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    allData.push(pngBuffer);
    offset += pngBuffer.length;
  }

  return Buffer.concat([header, ...entries, ...allData]);
}

// ====== Main ======
function generateAll(assetsDir) {
  console.log('Generating QuickMemo icons...');

  // Generate various sizes
  const pngBuffers = [];
  for (const size of SIZES) {
    const getPixel = createDrawer(size, size, ACCENT);
    const png = createPNG(size, size, getPixel);
    const filename = `icon-${size}x${size}.png`;
    fs.writeFileSync(path.join(assetsDir, filename), png);
    console.log(`  ✓ ${filename}`);
    pngBuffers.push({ size, pngBuffer: png });
  }

  // Create .ico (16, 32, 48 as BMP sections; 256 as PNG section)
  const icoSizes = [16, 32, 48].map(s => pngBuffers.find(p => p.size === s));
  const ico256 = pngBuffers.find(p => p.size === 256);
  icoSizes.push(ico256); // 256x256 as PNG in ICO
  const ico = createICO(icoSizes);
  fs.writeFileSync(path.join(assetsDir, 'quickmemo.ico'), ico);
  console.log('  ✓ quickmemo.ico');

  // Copy 256x256 as app icon
  fs.copyFileSync(
    path.join(assetsDir, 'icon-256x256.png'),
    path.join(assetsDir, 'quickmemo.png')
  );
  // Copy 32x32 as tray icon
  fs.copyFileSync(
    path.join(assetsDir, 'icon-32x32.png'),
    path.join(assetsDir, 'tray.png')
  );
  console.log('  ✓ quickmemo.png');
  console.log('  ✓ tray.png');

  console.log('\nDone! Icons saved to:', assetsDir);
}

generateAll(path.join(__dirname, '..', 'assets'));
