// C9 support: decode Chrome PNG screenshots (zero deps) and test whether canvas content touches an edge.
import { inflateSync } from 'node:zlib';

/** Decodes 8-bit, non-interlaced RGB/RGBA PNGs (what Chrome's captureScreenshot produces). */
export function decodePng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('Not a PNG');
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG (bitDepth ${bitDepth}, colorType ${colorType}, interlace ${interlace})`);
  }
  const ch = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[dst + x - ch] : 0;
      const b = y > 0 ? out[dst - stride + x] : 0;
      const c = x >= ch && y > 0 ? out[dst - stride + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { width, height, channels: ch, data: out };
}

/**
 * Share of "foreground" pixels in a strip: pixels far (RGB distance > threshold) from the strip's dominant colour.
 * A full-bleed background gives ~0; a visual cut by the edge gives a clear share.
 */
export function stripForeground(img, x0, y0, x1, y1, threshold = 48) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(img.width, Math.ceil(x1)); y1 = Math.min(img.height, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return 0;
  const { data, channels: ch, width } = img;
  const buckets = new Map();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * ch;
    const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  let mode = 0, best = -1;
  for (const [k, n] of buckets) if (n > best) { best = n; mode = k; }
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * ch;
    const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    if (k === mode) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  }
  r /= n; g /= n; b /= n;
  let fg = 0, total = 0;
  const t2 = threshold * threshold;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * ch;
    const dr = data[i] - r, dg = data[i + 1] - g, db = data[i + 2] - b;
    if (dr * dr + dg * dg + db * db > t2) fg++;
    total++;
  }
  return fg / total;
}

/** Foreground share on each side of a canvas's visible rect (8px strips). */
export function edgeContact(img, rect, strip = 8) {
  const { left: l, top: t, right: r, bottom: b } = rect;
  return {
    left: stripForeground(img, l, t, l + strip, b),
    right: stripForeground(img, r - strip, t, r, b),
    top: stripForeground(img, l, t, r, t + strip),
    bottom: stripForeground(img, l, b - strip, r, b),
  };
}

export const CONTACT_MIN = 0.03;
