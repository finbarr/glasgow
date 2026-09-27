// Procedural PBR texture sets (albedo / normal / roughness), generated at load
// time so the project has no external asset dependencies. Every texture is
// tileable and described by its physical size in metres, because geometry UVs
// are world-anchored metres.
import * as THREE from 'three';
import { Noise, hash2 } from './noise.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

let maxAniso = 8;
export function setMaxAnisotropy(a) { maxAniso = a; }

class Canvas {
  constructor(w, h = w) {
    this.w = w; this.h = h;
    this.albedo = new Float32Array(w * h * 3);
    this.height = new Float32Array(w * h);
    this.rough = new Float32Array(w * h).fill(0.85);
    this.alpha = null;
  }
}

function toTexture(data, w, h, channels, srgb) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    if (channels === 3) {
      d[j] = data[i * 3] * 255; d[j + 1] = data[i * 3 + 1] * 255; d[j + 2] = data[i * 3 + 2] * 255; d[j + 3] = 255;
    } else if (channels === 4) {
      d[j] = data[i * 4] * 255; d[j + 1] = data[i * 4 + 1] * 255; d[j + 2] = data[i * 4 + 2] * 255; d[j + 3] = data[i * 4 + 3] * 255;
    } else {
      const v = data[i] * 255; d[j] = v; d[j + 1] = v; d[j + 2] = v; d[j + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function normalFromHeight(hgt, w, h, strength) {
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const ym = ((y - 1 + h) % h) * w, yp = ((y + 1) % h) * w, yc = y * w;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w, xp = (x + 1) % w;
      const dx = (hgt[yc + xp] - hgt[yc + xm]) * strength;
      const dy = (hgt[yp + x] - hgt[ym + x]) * strength;
      // canvas y goes down; texture v goes up -> flip dy
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (yc + x) * 3;
      out[i] = (nx / l) * 0.5 + 0.5; out[i + 1] = (ny / l) * 0.5 + 0.5; out[i + 2] = (nz / l) * 0.5 + 0.5;
    }
  }
  return out;
}

/** Finish a canvas into a texture set sized sx by sy metres. */
function finish(c, sx, sy, normalStrength = 2) {
  let map;
  if (c.alpha) {
    const rgba = new Float32Array(c.w * c.h * 4);
    for (let i = 0; i < c.w * c.h; i++) {
      rgba[i * 4] = clamp(c.albedo[i * 3]); rgba[i * 4 + 1] = clamp(c.albedo[i * 3 + 1]);
      rgba[i * 4 + 2] = clamp(c.albedo[i * 3 + 2]); rgba[i * 4 + 3] = clamp(c.alpha[i]);
    }
    map = toTexture(rgba, c.w, c.h, 4, true);
  } else {
    for (let i = 0; i < c.albedo.length; i++) c.albedo[i] = clamp(c.albedo[i]);
    map = toTexture(c.albedo, c.w, c.h, 3, true);
  }
  for (let i = 0; i < c.rough.length; i++) c.rough[i] = clamp(c.rough[i]);
  const normalMap = toTexture(normalFromHeight(c.height, c.w, c.h, normalStrength), c.w, c.h, 3, false);
  const roughnessMap = toTexture(c.rough, c.w, c.h, 1, false);
  for (const t of [map, normalMap, roughnessMap]) t.repeat.set(1 / sx, 1 / sy);
  return { map, normalMap, roughnessMap, size: [sx, sy] };
}

const srgbToLin = (c) => c; // colours below are authored as display-ish values 0..1

function setPx(c, i, r, g, b) { c.albedo[i * 3] = r; c.albedo[i * 3 + 1] = g; c.albedo[i * 3 + 2] = b; }

// ---------------------------------------------------------------------------

/** Coursed ashlar sandstone. col: [r,g,b] base. */
export function ashlar({ seed = 1, col = [0.6, 0.3, 0.24], varAmt = 0.12, course = 0.35, sizeM = 4.2, res = 1024, soot = 0.35, joint = 0.012, rustic = false }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  const ppm = res / sizeM;
  const courses = Math.round(sizeM / course);
  const ch = res / courses;
  // per-course block joints
  const rows = [];
  for (let r = 0; r < courses; r++) {
    const joints = [];
    let x = hash2(r, 7, seed) * sizeM;
    const start = x;
    while (x < start + sizeM - 0.4) {
      joints.push((x % sizeM) * ppm);
      x += mix(0.9, 1.8, hash2(r, joints.length, seed + 3));
    }
    rows.push(joints.sort((a, b) => a - b));
  }
  const jw = Math.max(1.2, joint * ppm);
  for (let y = 0; y < res; y++) {
    const r = Math.floor(y / ch);
    const fy = y - r * ch;
    const joints = rows[r];
    for (let x = 0; x < res; x++) {
      // distance to nearest vertical joint (wrap)
      let dmin = 1e9, bi = 0;
      for (let k = 0; k < joints.length; k++) {
        let d = Math.abs(x - joints[k]);
        d = Math.min(d, res - d);
        if (d < dmin) { dmin = d; }
        if (x >= joints[k]) bi = k;
      }
      const dy = Math.min(fy, ch - fy);
      const dj = Math.min(dmin, dy);
      const u = x / res, v = y / res;
      const blockTint = (hash2(r, bi, seed + 11) - 0.5) * varAmt * (1 + 0.6 * N.n(u * 3, v * 3, 3));
      const grain = N.fbm(u, v, 64, 3) - 0.5;
      const big = N.fbm(u, v, 3, 4) - 0.5;
      // soot: vertical streaks + dirt under blocks
      const streak = N.fbm(u, v, 24, 3, 0.5, 2);
      const sootAmt = clamp(soot * (smooth(0.35, 0.8, streak) * 0.9 + big * 0.8 + smooth(ch * 0.5, 0, ch - fy) * 0.35));
      let tone = 1 + blockTint + grain * 0.12 + big * 0.18;
      let rr = col[0] * tone, gg = col[1] * tone, bb = col[2] * tone;
      // bedding lines in sandstone
      const bed = Math.sin((y / ch) * Math.PI * 9 + N.n(u * 20, v * 20, 20) * 4) * 0.025;
      rr += bed; gg += bed; bb += bed;
      rr = mix(rr, 0.13, sootAmt); gg = mix(gg, 0.11, sootAmt); bb = mix(bb, 0.10, sootAmt);
      let h = 1;
      const jwk = rustic ? jw * 3 : jw;
      if (dj < jwk) {
        const t = dj / jwk;
        h = rustic ? t : smooth(0, 1, t) * 0.8;
        if (rustic) { rr *= mix(0.8, 1, t); gg *= mix(0.8, 1, t); bb *= mix(0.8, 1, t); }
        else { rr = mix(rr * 1.08 + 0.03, rr, t); gg = mix(gg * 1.08 + 0.03, gg, t); bb = mix(bb * 1.08 + 0.03, bb, t); }
      }
      // pitted, tooled surface
      h += grain * 0.15 + (N.n(u * 180, v * 180, 180) - 0.5) * 0.05;
      if (rustic && dj >= jwk) h += 0.2 + big * 0.4;
      const i = y * res + x;
      setPx(c, i, rr, gg, bb);
      c.height[i] = h;
      c.rough[i] = 0.82 + grain * 0.2 + sootAmt * 0.08;
    }
  }
  return finish(c, sizeM, sizeM, rustic ? 5 : 1.6);
}

export function slate({ seed = 5, sizeM = 3.08, res = 1024 }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  const rowsN = 14, colsN = 10;
  const rh = res / rowsN, cw = res / colsN;
  for (let y = 0; y < res; y++) {
    const r = Math.floor(y / rh), fy = (y - r * rh) / rh;
    const off = (r % 2) * cw * 0.5;
    for (let x = 0; x < res; x++) {
      const xx = (x + off) % res;
      const k = Math.floor(xx / cw), fx = (xx - k * cw) / cw;
      const u = x / res, v = y / res;
      const tint = hash2(r, k, seed) - 0.5;
      const g = N.fbm(u, v, 48, 3) - 0.5;
      const lichen = smooth(0.62, 0.8, N.fbm(u, v, 6, 4));
      let base = 0.2 + tint * 0.07 + g * 0.05;
      let rr = base * 0.95, gg = base * 1.0, bb = base * 1.12;
      rr = mix(rr, 0.38, lichen * 0.35); gg = mix(gg, 0.36, lichen * 0.35); bb = mix(bb, 0.26, lichen * 0.35);
      const edge = Math.min(fx, 1 - fx) * cw;
      let h = 0.3 + fy * 0.7; // thicker at the tail (bottom of slate, canvas y downward = down slope)
      if (edge < 1.2) { h -= 0.3; rr *= 0.6; gg *= 0.6; bb *= 0.6; }
      if (fy > 0.95) { rr *= 0.55; gg *= 0.55; bb *= 0.55; }
      h += g * 0.2;
      const i = y * res + x;
      setPx(c, i, rr, gg, bb);
      c.height[i] = h;
      c.rough[i] = 0.55 + g * 0.3 + lichen * 0.3 + tint * 0.1;
    }
  }
  return finish(c, sizeM, sizeM, 4);
}

export function asphalt({ seed = 9, sizeM = 8, res = 1024, base = 0.19 }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const u = x / res, v = y / res;
      const big = N.fbm(u, v, 4, 5) - 0.5;
      const mid = N.fbm(u, v, 32, 3) - 0.5;
      const agg = hash2(x, y, seed);
      const stone = agg > 0.93 ? 0.12 : agg < 0.05 ? -0.06 : 0;
      const patch = smooth(0.58, 0.62, N.fbm(u, v, 3, 3, 0.6));
      let t = base + big * 0.06 + mid * 0.04 + stone - patch * 0.04;
      const oil = smooth(0.62, 0.75, N.fbm(u + 0.3, v * 0.5, 5, 4)) * 0.05;
      t -= oil;
      const i = y * res + x;
      setPx(c, i, t, t * 0.99, t * 0.97);
      c.height[i] = mid * 0.5 + stone * 2 + hash2(x, y, seed + 1) * 0.25;
      c.rough[i] = 0.88 - oil * 3 + stone * 0.3 - patch * 0.05;
    }
  }
  return finish(c, sizeM, sizeM, 1.5);
}

/** Concrete paving flags, fw x fh metres. */
export function paving({ seed = 13, sizeM = 3.6, res = 1024, fw = 0.6, fh = 0.6, col = [0.52, 0.51, 0.48], stagger = false }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  const ppm = res / sizeM;
  for (let y = 0; y < res; y++) {
    const r = Math.floor(y / (fh * ppm));
    const fy = y - r * fh * ppm;
    const off = stagger && r % 2 ? fw * ppm * 0.5 : 0;
    for (let x = 0; x < res; x++) {
      const xx = (x + off) % res;
      const k = Math.floor(xx / (fw * ppm));
      const fx = xx - k * fw * ppm;
      const u = x / res, v = y / res;
      const tint = (hash2(r, k, seed) - 0.5) * 0.12;
      const g = N.fbm(u, v, 40, 3) - 0.5;
      const stain = smooth(0.55, 0.8, N.fbm(u, v, 5, 4)) * 0.18;
      const gum = hash2(x >> 2, y >> 2, seed + 5) > 0.9985 ? 0.25 : 0;
      const d = Math.min(fx, fw * ppm - fx, fy, fh * ppm - fy);
      let t = 1 + tint + g * 0.14 - stain - gum;
      let rr = col[0] * t, gg = col[1] * t, bb = col[2] * t;
      let h = 1 + g * 0.2;
      if (d < 2) { rr *= 0.55; gg *= 0.55; bb *= 0.55; h = 0.3; }
      const i = y * res + x;
      setPx(c, i, rr, gg, bb);
      c.height[i] = h;
      c.rough[i] = 0.8 + g * 0.2 - stain * 0.5;
    }
  }
  return finish(c, sizeM, sizeM, 2.5);
}

export function granite({ seed = 17, sizeM = 1.2, res = 512, col = [0.55, 0.54, 0.53] }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const u = x / res, v = y / res;
      const h = hash2(x, y, seed);
      const speck = h > 0.8 ? -0.25 : h > 0.7 ? 0.15 : 0;
      const g = N.fbm(u, v, 16, 3) - 0.5;
      const t = 1 + speck + g * 0.2;
      const i = y * res + x;
      setPx(c, i, col[0] * t, col[1] * t, col[2] * t * 1.02);
      c.height[i] = g * 0.3 + speck * 0.2;
      c.rough[i] = 0.7 + speck * 0.3;
    }
  }
  return finish(c, sizeM, sizeM, 1);
}

export function brick({ seed = 21, sizeM = 1.8, res = 1024, col = [0.45, 0.2, 0.14] }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  const courses = 24, bricks = 8;
  const chh = res / courses, bw = res / bricks;
  for (let y = 0; y < res; y++) {
    const r = Math.floor(y / chh), fy = y - r * chh;
    const off = (r % 2) * bw * 0.5;
    for (let x = 0; x < res; x++) {
      const xx = (x + off) % res;
      const k = Math.floor(xx / bw), fx = xx - k * bw;
      const u = x / res, v = y / res;
      const tint = (hash2(r, k, seed) - 0.5) * 0.3;
      const g = N.fbm(u, v, 64, 2) - 0.5;
      const soot = N.fbm(u, v, 4, 4) - 0.5;
      let rr = col[0] * (1 + tint + g * 0.2), gg = col[1] * (1 + tint * 0.8 + g * 0.2), bb = col[2] * (1 + tint * 0.6 + g * 0.2);
      rr *= 1 - soot * 0.5; gg *= 1 - soot * 0.5; bb *= 1 - soot * 0.5;
      let h = 1 + g * 0.2;
      if (fy < 2.5 || fx < 2.5) { rr = 0.42; gg = 0.4; bb = 0.37; h = 0.2; }
      const i = y * res + x;
      setPx(c, i, rr, gg, bb);
      c.height[i] = h;
      c.rough[i] = 0.85 + g * 0.1;
    }
  }
  return finish(c, sizeM, sizeM, 3);
}

export function concrete({ seed = 25, sizeM = 4, res = 512, col = [0.55, 0.54, 0.51], panel = 1.2 }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  const ppm = res / sizeM;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const u = x / res, v = y / res;
      const g = N.fbm(u, v, 24, 4) - 0.5;
      const stain = smooth(0.5, 0.85, N.fbm(u, v, 3, 4, 0.5, 8)) * 0.3;
      let t = 1 + g * 0.15 - stain;
      let h = g * 0.3;
      const py = (y % (panel * ppm));
      if (py < 1.5) { t *= 0.8; h -= 0.3; }
      const i = y * res + x;
      setPx(c, i, col[0] * t, col[1] * t, col[2] * t);
      c.height[i] = h;
      c.rough[i] = 0.9 + g * 0.1;
    }
  }
  return finish(c, sizeM, sizeM, 1.5);
}

export function ballast({ seed = 29, sizeM = 2, res = 512 }) {
  const c = new Canvas(res);
  const cells = 40; // stones across
  const cs = res / cells;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const gx = Math.floor(x / cs), gy = Math.floor(y / cs);
      let d1 = 1e9, d2 = 1e9, id = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const cx = gx + ox, cy = gy + oy;
        const wx = ((cx % cells) + cells) % cells, wy = ((cy % cells) + cells) % cells;
        const px = (cx + hash2(wx, wy, seed)) * cs, py = (cy + hash2(wx, wy, seed + 1)) * cs;
        const d = Math.hypot(x - px, y - py);
        if (d < d1) { d2 = d1; d1 = d; id = wx * 131 + wy; } else if (d < d2) d2 = d;
      }
      const edge = (d2 - d1) / cs;
      const tint = hash2(id, 3, seed);
      let t = 0.28 + tint * 0.22;
      const rust = hash2(id, 9, seed) > 0.7 ? 0.06 : 0;
      let h = clamp(edge * 2.5);
      if (edge < 0.08) t *= 0.3;
      const i = y * res + x;
      setPx(c, i, t + rust, t * 0.97, t * 0.93 - rust * 0.5);
      c.height[i] = h;
      c.rough[i] = 0.9;
    }
  }
  return finish(c, sizeM, sizeM, 6);
}

export function terrazzo({ seed = 33, sizeM = 4.8, res = 1024, col = [0.78, 0.74, 0.66], tile = 1.2 }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  const ppm = res / sizeM;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const u = x / res, v = y / res;
      const h = hash2(x, y, seed);
      const chip = h > 0.92 ? -0.3 : h > 0.86 ? 0.1 : 0;
      const g = N.fbm(u, v, 12, 3) - 0.5;
      const wear = smooth(0.4, 0.7, N.fbm(u, v, 2, 3)) * 0.1;
      const fx = x % (tile * ppm), fy = y % (tile * ppm);
      const k = Math.floor(x / (tile * ppm)) + Math.floor(y / (tile * ppm));
      const checker = (k % 2) * 0.05;
      let t = 1 + chip + g * 0.1 - wear - checker;
      let hh = 1;
      if (fx < 1.5 || fy < 1.5) { t *= 0.6; hh = 0.4; }
      const i = y * res + x;
      setPx(c, i, col[0] * t, col[1] * t, col[2] * t);
      c.height[i] = hh;
      c.rough[i] = 0.35 + g * 0.2 + wear;
    }
  }
  return finish(c, sizeM, sizeM, 1.5);
}

/** Roof glazing: returns alpha-mapped texture with glazing bars. */
export function glazing({ seed = 37, sizeM = 2.4, res = 512, barSpacing = 0.6, crossSpacing = 2.4 }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  c.alpha = new Float32Array(res * res);
  const ppm = res / sizeM;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const u = x / res, v = y / res;
      const bx = x % (barSpacing * ppm), by = y % (crossSpacing * ppm);
      const bar = bx < 5 || by < 4;
      const dirt = N.fbm(u, v, 6, 4);
      const i = y * res + x;
      if (bar) {
        setPx(c, i, 0.32, 0.33, 0.34); c.alpha[i] = 1; c.height[i] = 1; c.rough[i] = 0.5;
      } else {
        const t = 0.78 - dirt * 0.25;
        setPx(c, i, t * 0.96, t * 0.98, t);
        c.alpha[i] = 0.55 + smooth(0.35, 0.8, dirt) * 0.3;
        c.height[i] = 0; c.rough[i] = 0.15 + dirt * 0.3;
      }
    }
  }
  return finish(c, sizeM, sizeM, 1);
}

export function timber({ seed = 41, sizeM = 1.5, res = 512, col = [0.36, 0.2, 0.1] }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const u = x / res, v = y / res;
      const w = N.fbm(u, v, 12, 3, 0.5, 1);
      const ring = Math.sin((u * 40 + w * 8) * Math.PI) * 0.5 + 0.5;
      const t = 1 + (ring - 0.5) * 0.25 + (N.fbm(u, v, 64, 2, 0.5, 4) - 0.5) * 0.15;
      const i = y * res + x;
      setPx(c, i, col[0] * t, col[1] * t, col[2] * t);
      c.height[i] = ring * 0.2;
      c.rough[i] = 0.45 + ring * 0.15;
    }
  }
  return finish(c, sizeM, sizeM, 1);
}

/** Tileable ripple height -> normal map for water. */
export function waterNormal({ seed = 45, res = 512, sizeM = 24 }) {
  const N = new Noise(seed);
  const hgt = new Float32Array(res * res);
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
    const u = x / res, v = y / res;
    hgt[y * res + x] = N.fbm(u, v, 8, 5, 0.55) + N.fbm(u, v, 3, 3, 0.5, 6) * 0.5;
  }
  const n = normalFromHeight(hgt, res, res, 12);
  const t = toTexture(n, res, res, 3, false);
  t.repeat.set(1 / sizeM, 1 / sizeM);
  return t;
}

/** Generic grime roughness/normal for painted metal etc. */
export function grime({ seed = 49, res = 256, sizeM = 3 }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
    const u = x / res, v = y / res;
    const g = N.fbm(u, v, 8, 4);
    const i = y * res + x;
    const t = 0.9 + g * 0.2;
    setPx(c, i, t, t, t);
    c.height[i] = g * 0.2;
    c.rough[i] = 0.4 + g * 0.35;
  }
  return finish(c, sizeM, sizeM, 0.5);
}

/** Curtain-wall spandrel / cladding panels. */
export function panels({ seed = 53, res = 512, sizeM = 3, pw = 1.5, ph = 1.0, col = [0.3, 0.31, 0.33] }) {
  const N = new Noise(seed);
  const c = new Canvas(res);
  const ppm = res / sizeM;
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
    const u = x / res, v = y / res;
    const g = N.fbm(u, v, 6, 3);
    const fx = x % (pw * ppm), fy = y % (ph * ppm);
    const i = y * res + x;
    let t = 0.9 + g * 0.2;
    let h = 1;
    if (fx < 2 || fy < 2) { t *= 0.5; h = 0; }
    setPx(c, i, col[0] * t, col[1] * t, col[2] * t);
    c.height[i] = h;
    c.rough[i] = 0.35 + g * 0.2;
  }
  return finish(c, sizeM, sizeM, 1);
}
