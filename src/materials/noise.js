// Fast tileable value noise used by the procedural texture generators.
import { mulberry32 } from '../core/rng.js';

const SIZE = 256;

export class Noise {
  constructor(seed = 1) {
    const r = mulberry32(seed);
    this.v = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < this.v.length; i++) this.v[i] = r();
  }

  // Periodic value noise in [0,1]. x,y in lattice units, period in lattice units (int).
  n(x, y, px = SIZE, py = px) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const v = this.v;
    const a = v[(y0 & 255) * SIZE + (x0 & 255)];
    const b = v[(y0 & 255) * SIZE + (x1 & 255)];
    const c = v[(y1 & 255) * SIZE + (x0 & 255)];
    const d = v[(y1 & 255) * SIZE + (x1 & 255)];
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }

  // Fractal noise; u,v in [0,1) texture space, base = lattice cells across the tile.
  fbm(u, v, base = 4, oct = 4, gain = 0.5, baseY = base) {
    let sum = 0, amp = 1, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      sum += amp * this.n(u * base * f + o * 17.3, v * baseY * f + o * 31.7, base * f, baseY * f);
      norm += amp; amp *= gain; f *= 2;
    }
    return sum / norm;
  }
}

// Cheap integer hash -> [0,1)
export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
