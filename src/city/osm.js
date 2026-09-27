// Optional OpenStreetMap mode. If public/data/osm.json exists (produced by
// `npm run fetch-osm`), real building footprints and roads replace the
// procedural blocks. Central Station stays hand-modelled.
import * as THREE from 'three';
import { Frame } from '../core/batch.js';
import { RNG, hashSeed } from '../core/rng.js';
import { groundHeight, KERB, STATION, viaductExtent, VIADUCT } from './layout.js';
import { buildFacade, plainWall } from './facade.js';

export async function loadOSM() {
  const params = new URLSearchParams(location.search);
  if (params.get('osm') === '0') return null;
  try {
    const res = await fetch('data/osm.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.buildings || !data.buildings.length) return null;
    return data;
  } catch {
    return null;
  }
}

function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function inReserved(x, z) {
  if (x > STATION.x0 - 2 && x < STATION.x1 + 2 && z > STATION.z0 - 2 && z < STATION.z1 + 24) return true;
  if (z > VIADUCT.z0 && z < VIADUCT.z1) {
    const [a, b] = viaductExtent(z);
    if (x > a - 2 && x < b + 2) return true;
  }
  return false;
}

function styleFromTags(rng, b) {
  const mat = (b.material || '').toLowerCase();
  const colour = (b.colour || '').toLowerCase();
  if (mat.includes('glass') || b.height > 40) return 'modern';
  if (mat.includes('concrete')) return 'seventies';
  if (mat.includes('brick')) return rng.chance(0.5) ? 'warehouse' : 'seventies';
  if (mat.includes('stone') || colour) return rng.chance(0.4) ? 'rich' : 'victorian';
  return rng.weighted([['victorian', 5], ['rich', 2], ['warehouse', 1], ['modern', 1.5], ['seventies', 1]]);
}

export function buildOSMBuildings(ctx, osm) {
  for (const b of osm.buildings) {
    let pts = b.pts;
    if (pts.length < 3) continue;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    if (inReserved(cx, cz)) continue;
    // orient so Frame normals point outwards
    const [p0, p1] = pts;
    const tx = p1[0] - p0[0], tz = p1[1] - p0[1];
    const l = Math.hypot(tx, tz) || 1;
    const mx = (p0[0] + p1[0]) / 2 + (-tz / l) * 0.2, mz = (p0[1] + p1[1]) / 2 + (tx / l) * 0.2;
    if (pointInPoly(mx, mz, pts)) pts = [...pts].reverse();

    const rng = new RNG(hashSeed('osm', b.id));
    const style = styleFromTags(rng, b);
    const stone = style === 'modern' ? 'panel' : style === 'seventies' ? (b.material === 'brick' ? 'brick' : 'concrete')
      : /red|brown|#[89a-f][0-9a-f][0-5]/.test(b.colour || '') ? 'stoneRed' : rng.chance(0.45) ? 'stoneRed' : 'stoneBlond';
    const hs = pts.map(([x, z]) => groundHeight(x, z));
    const gMin = Math.min(...hs), gMid = groundHeight(cx, cz);
    const height = b.height || (b.levels ? b.levels * 3.6 + 1.2 : rng.range(14, 22));
    const groundH = style === 'modern' ? 5 : 4.6;
    const floorH = style === 'modern' ? 3.8 : style === 'rich' ? 4.0 : 3.7;
    const nUpper = Math.max(0, Math.floor((height - groundH) / floorH));
    const base = gMid + KERB;
    const top = base + groundH + nUpper * floorH;
    const tint = stone === 'panel' ? [1, 1, 1] : [rng.range(0.8, 1.05), rng.range(0.78, 1.0), rng.range(0.75, 0.98)];
    ctx.batch.setChunkFrom(cx, cz);
    const lctx = { ...ctx, rng };
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 0.2) continue;
      const fr = new Frame(a[0], a[1], c[0] - a[0], c[1] - a[1]);
      const b2 = ctx.batch;
      const orig = b2.resetColor;
      b2.resetColor = function () { this.color = [...tint]; };
      b2.setColor(...tint);
      if (L >= 4) {
        buildFacade(lctx, fr, L, {
          style, stone, base, plinth: gMin - 0.3, groundH, floorH, nUpper,
          ground: style === 'modern' ? 'lobby' : rng.chance(0.75) ? 'shops' : 'windows',
          corniceEnds: false,
        });
      } else {
        plainWall(lctx, fr, L, gMin - 0.3, top + 0.9, stone, { windows: false });
      }
      b2.resetColor = orig;
      b2.resetColor();
    }
    ctx.batch.setColor(0.55, 0.55, 0.55);
    try { ctx.batch.polygon('concrete', pts, top + 0.05, true); } catch { /* degenerate footprint */ }
    ctx.batch.resetColor();
  }
}

/** Roads from OSM centrelines as asphalt ribbons. */
export function buildOSMRoads(batch, osm) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const r of osm.roads || []) {
    const w = r.width || 7;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i + 1];
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
      if (L < 0.1) continue;
      const nx = -dz / L * w / 2, nz = dx / L * w / 2;
      batch.setChunkFrom((x0 + x1) / 2, (z0 + z1) / 2);
      const y = (x, z) => groundHeight(x, z) + 0.02;
      batch.quadN(r.pedestrian ? 'granitePave' : 'asphalt',
        V(x0 + nx, y(x0 + nx, z0 + nz), z0 + nz), V(x0 - nx, y(x0 - nx, z0 - nz), z0 - nz),
        V(x1 - nx, y(x1 - nx, z1 - nz), z1 - nz), V(x1 + nx, y(x1 + nx, z1 + nz), z1 + nz), 0, 1, 0);
    }
  }
}
