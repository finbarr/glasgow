// Terrain, carriageways, pavements, kerbs, road markings, the Clyde and its
// quays and road bridges.
import * as THREE from 'three';
import {
  BOUNDS, NS_STREETS, EW_STREETS, RIVER, STATION, KERB, groundHeight, streetAt,
} from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const gy = (x, z, off = 0) => groundHeight(x, z) + off;

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

export function buildTerrain(M) {
  const FAR = 4200;
  const xs = [], zs = [];
  for (let x = -FAR; x < BOUNDS.x0; x += 100) xs.push(x);
  for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 4) xs.push(x);
  for (let x = BOUNDS.x1; x <= FAR; x += 100) xs.push(x);
  for (let z = -FAR; z < BOUNDS.z0; z += 100) zs.push(z);
  for (let z = BOUNDS.z0; z < BOUNDS.z1; z += 4) zs.push(z);
  for (let z = BOUNDS.z1; z <= FAR; z += 50) zs.push(z);
  zs.push(RIVER.zNorth, RIVER.zNorth + 0.05, RIVER.zSouth - 0.05, RIVER.zSouth);
  zs.sort((a, b) => a - b);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const x = xs[i], z = zs[j];
    pos[k * 3] = x; pos[k * 3 + 1] = groundHeight(x, z); pos[k * 3 + 2] = z;
    uv[k * 2] = x; uv[k * 2 + 1] = -z;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const col = new Float32Array(nx * nz * 3).fill(1);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, M.asphalt);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// ---------------------------------------------------------------------------
// Pavements
// ---------------------------------------------------------------------------

export function pavementWidth(s) {
  if (!s) return 0;
  if (s.pedestrian) return 0;
  if (s.quay) return 6;
  return Math.max(1, Math.min(4.8, (s.w - 7) / 2));
}

/** Subdivided terrain-following surface over a rectangle. */
function surface(batch, mat, x0, x1, z0, z1, off, step = 8) {
  const nx = Math.max(1, Math.ceil((x1 - x0) / step)), nz = Math.max(1, Math.ceil((z1 - z0) / step));
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const ax = x0 + ((x1 - x0) * i) / nx, bx = x0 + ((x1 - x0) * (i + 1)) / nx;
    const az = z0 + ((z1 - z0) * j) / nz, bz = z0 + ((z1 - z0) * (j + 1)) / nz;
    batch.quad(mat, V(ax, gy(ax, bz, off), bz), V(bx, gy(bx, bz, off), bz), V(bx, gy(bx, az, off), az), V(ax, gy(ax, az, off), az));
  }
}

/** Vertical kerb face along an axis-aligned edge, facing direction (nx,nz). */
function kerbFace(batch, mat, x0, z0, x1, z1, nx, nz, h, step = 8) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.ceil(L / step));
  for (let i = 0; i < n; i++) {
    const ax = x0 + ((x1 - x0) * i) / n, az = z0 + ((z1 - z0) * i) / n;
    const bx = x0 + ((x1 - x0) * (i + 1)) / n, bz = z0 + ((z1 - z0) * (i + 1)) / n;
    // choose winding so the face points along (nx,nz)
    const a0 = V(ax, gy(ax, az, -0.05), az), b0 = V(bx, gy(bx, bz, -0.05), bz);
    const a1 = V(ax, gy(ax, az, h), az), b1 = V(bx, gy(bx, bz, h), bz);
    const tx = bx - ax, tz = bz - az;
    // outward normal of (a0->b0, up) is (-tz, tx)
    if (-tz * nx + tx * nz >= 0) batch.quad(mat, a0, b0, b1, a1);
    else batch.quad(mat, b0, a0, a1, b1);
  }
}

export function buildPavement(batch, r, pw) {
  // r = building-line rect; pw = {n,s,e,w} pavement widths
  const x0 = r.x0 - pw.w, x1 = r.x1 + pw.e, z0 = r.z0 - pw.n, z1 = r.z1 + pw.s;
  batch.setChunkFrom((x0 + x1) / 2, (z0 + z1) / 2);
  const k = 0.3; // granite kerbstone width
  batch.setColor(1, 1, 1);
  surface(batch, 'paving', x0 + k, x1 - k, z0 + k, z1 - k, KERB);
  batch.setColor(0.8, 0.8, 0.8);
  surface(batch, 'granite', x0, x1, z0, z0 + k, KERB, 12);
  surface(batch, 'granite', x0, x1, z1 - k, z1, KERB, 12);
  surface(batch, 'granite', x0, x0 + k, z0 + k, z1 - k, KERB, 12);
  surface(batch, 'granite', x1 - k, x1, z0 + k, z1 - k, KERB, 12);
  kerbFace(batch, 'granite', x0, z1, x1, z1, 0, 1, KERB);
  kerbFace(batch, 'granite', x1, z0, x0, z0, 0, -1, KERB);
  kerbFace(batch, 'granite', x1, z1, x1, z0, 1, 0, KERB);
  kerbFace(batch, 'granite', x0, z0, x0, z1, -1, 0, KERB);
  batch.resetColor();
  return { x0, x1, z0, z1 };
}

/** Pavement widths for a block rect by probing the streets beside it. */
export function pavementsFor(r, front) {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const f = front || { n: true, s: true, e: true, w: true };
  return {
    n: f.n ? pavementWidth(streetAt(cx, r.z0 - 2)) : 0,
    s: f.s ? pavementWidth(streetAt(cx, r.z1 + 2)) : 0,
    w: f.w ? pavementWidth(streetAt(r.x0 - 2, cz)) : 0,
    e: f.e ? pavementWidth(streetAt(r.x1 + 2, cz)) : 0,
  };
}

export function buildPedestrianStreets(batch) {
  for (const s of NS_STREETS) {
    if (!s.pedestrian) continue;
    const x0 = s.x - s.w / 2, x1 = s.x + s.w / 2;
    const z0 = Math.max(BOUNDS.z0, s.z0 - 11), z1 = s.z1 + 11;
    batch.setChunkFrom(s.x, (z0 + z1) / 2);
    surface(batch, 'granitePave', x0, x1, z0, z1, KERB, 8);
  }
}

// ---------------------------------------------------------------------------
// Road markings
// ---------------------------------------------------------------------------

function crossingsNS(s) {
  const out = [];
  for (const e of EW_STREETS) {
    if (s.x >= e.x0 - 10 && s.x <= e.x1 + 10 && e.z >= s.z0 - 12 && e.z <= s.z1 + 12) out.push([e.z - e.w / 2, e.z + e.w / 2, e]);
  }
  return out;
}
function crossingsEW(s) {
  const out = [];
  for (const n of NS_STREETS) {
    if (s.z >= n.z0 - 12 && s.z <= n.z1 + 12 && n.x >= s.x0 - 10 && n.x <= s.x1 + 10) out.push([n.x - n.w / 2, n.x + n.w / 2, n]);
  }
  return out;
}

function freeSegments(a, b, blocked) {
  const segs = [];
  const bl = [...blocked].sort((p, q) => p[0] - q[0]);
  let p = a;
  for (const [c, d] of bl) {
    if (d <= p) continue;
    if (c > p) segs.push([p, Math.min(c, b)]);
    p = Math.max(p, d);
    if (p >= b) break;
  }
  if (p < b) segs.push([p, b]);
  return segs.filter(([c, d]) => d - c > 6);
}

/**
 * Lay a flat strip along a street axis. For 'ns' streets `along` is z and
 * `across` is x; for 'ew' the reverse.
 */
function strip(batch, mat, kind, acrossC, halfW, a, b, off = 0.012, step = 6) {
  const n = Math.max(1, Math.ceil((b - a) / step));
  for (let i = 0; i < n; i++) {
    const p = a + ((b - a) * i) / n, q = a + ((b - a) * (i + 1)) / n;
    if (kind === 'ns') {
      const x0 = acrossC - halfW, x1 = acrossC + halfW;
      batch.quad(mat, V(x0, gy(x0, q, off), q), V(x1, gy(x1, q, off), q), V(x1, gy(x1, p, off), p), V(x0, gy(x0, p, off), p));
    } else {
      const z0 = acrossC - halfW, z1 = acrossC + halfW;
      batch.quad(mat, V(p, gy(p, z1, off), z1), V(q, gy(q, z1, off), z1), V(q, gy(q, z0, off), z0), V(p, gy(p, z0, off), z0));
    }
  }
}

function crossBar(batch, mat, kind, alongC, halfLen, from, to, off = 0.013) {
  // a bar perpendicular to the street axis, centred on alongC with thickness 2*halfLen, spanning across [from,to]
  if (kind === 'ns') strip(batch, mat, 'ew', alongC, halfLen, from, to, off, 4);
  else strip(batch, mat, 'ns', alongC, halfLen, from, to, off, 4);
}

function dashed(batch, mat, kind, acrossC, halfW, a, b, dash, gap, off) {
  for (let p = a + gap / 2; p + dash <= b; p += dash + gap) strip(batch, mat, kind, acrossC, halfW, p, p + dash, off);
}

export function buildMarkings(batch) {
  const streets = [
    ...NS_STREETS.map((s) => ({ s, kind: 'ns', c: s.x, a: Math.max(BOUNDS.z0, s.z0 - 11), b: Math.min(RIVER.zNorth - 2, s.z1 + 11), cross: crossingsNS(s) })),
    ...EW_STREETS.map((s) => ({ s, kind: 'ew', c: s.z, a: Math.max(BOUNDS.x0, s.x0 - 10), b: Math.min(BOUNDS.x1, s.x1 + 10), cross: crossingsEW(s) })),
  ];
  for (const { s, kind, c, a, b, cross } of streets) {
    if (s.pedestrian) continue;
    const pw = pavementWidth(s);
    const half = s.w / 2 - pw; // half carriageway
    const segs = freeSegments(a, b, cross.map(([p, q]) => [p, q]));
    batch.setChunkFrom(kind === 'ns' ? c : (a + b) / 2, kind === 'ns' ? (a + b) / 2 : c);
    for (const [p, q] of segs) {
      // lines at ends adjoining a junction?
      const atA = cross.some(([, d]) => Math.abs(d - p) < 0.5);
      const atB = cross.some(([cc]) => Math.abs(cc - q) < 0.5);
      const pA = atA ? p + 6.5 : p, qB = atB ? q - 6.5 : q;
      // double yellow lines along both kerbs
      for (const sgn of [-1, 1]) {
        const k = c + sgn * (half - 0.28);
        const k2 = c + sgn * (half - 0.45);
        strip(batch, 'markYellow', kind, k, 0.05, p + 1, q - 1);
        strip(batch, 'markYellow', kind, k2, 0.05, p + 1, q - 1);
      }
      if (!s.oneway && half > 3) {
        dashed(batch, 'markWhite', kind, c, 0.07, pA, qB, 3, 6, 0.013);
        // hatched approach: solid near junctions
        if (atA) strip(batch, 'markWhite', kind, c, 0.07, p + 6.5, Math.min(q, p + 16));
        if (atB) strip(batch, 'markWhite', kind, c, 0.07, Math.max(p, q - 16), q - 6.5);
      }
      // bus lane on the kerbside of one direction
      if (s.bus && half > 5.5 && q - p > 30) {
        const lw = 3.1;
        // UK: drive on the left. For NS streets southbound (+z) uses +x side; for EW eastbound (+x) uses -z side
        const sgn = kind === 'ns' ? 1 : -1;
        const lc = c + sgn * (half - lw / 2);
        strip(batch, 'busLane', kind, lc, lw / 2, pA + 10, qB - 4, 0.008);
        strip(batch, 'markWhite', kind, c + sgn * (half - lw), 0.12, pA + 10, qB - 4);
      }
      // stop lines and signal crossings (studs as dashed lines)
      if (atB) {
        const sgn = kind === 'ns' ? 1 : -1; // approach lane side for travel towards +axis
        const from = sgn > 0 ? c : c - half, to = sgn > 0 ? c + half : c;
        crossBar(batch, 'markWhite', kind, q - 6.2, 0.15, from, to);
        crossingDashes(batch, kind, q - 4.2, q - 1.2, c - half, c + half);
      }
      if (atA) {
        const sgn = kind === 'ns' ? -1 : 1;
        const from = sgn > 0 ? c : c - half, to = sgn > 0 ? c + half : c;
        crossBar(batch, 'markWhite', kind, p + 6.2, 0.15, from, to);
        crossingDashes(batch, kind, p + 1.2, p + 4.2, c - half, c + half);
      }
    }
  }
}

function crossingDashes(batch, kind, a, b, from, to) {
  // two lines of square studs across the road bounding the crossing
  for (const along of [a, b]) {
    for (let t = from + 0.3; t < to - 0.3; t += 1.0) {
      crossBar(batch, 'markWhite', kind, along, 0.1, t, t + 0.5, 0.014);
    }
  }
}

// ---------------------------------------------------------------------------
// River Clyde
// ---------------------------------------------------------------------------

export function buildRiver(batch, M) {
  const FAR = 4200;
  const g = new THREE.PlaneGeometry(FAR * 2, RIVER.zSouth - RIVER.zNorth, 1, 1);
  g.rotateX(-Math.PI / 2);
  // uv in metres for the tiled normal map
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
  const water = new THREE.Mesh(g, M.water);
  water.position.set(0, RIVER.water, (RIVER.zNorth + RIVER.zSouth) / 2);
  water.receiveShadow = true;
  water.name = 'river';
  // quay walls
  for (let x = -FAR; x < FAR; x += 200) {
    batch.setChunkFrom(Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, x)), RIVER.zNorth);
    const x1 = x + 200;
    batch.setColor(0.75, 0.72, 0.68);
    batch.quad('stoneRustic', V(x, RIVER.bed, RIVER.zNorth), V(x1, RIVER.bed, RIVER.zNorth), V(x1, gy(x1, RIVER.zNorth - 0.01), RIVER.zNorth), V(x, gy(x, RIVER.zNorth - 0.01), RIVER.zNorth));
    batch.quad('stoneRustic', V(x1, RIVER.bed, RIVER.zSouth), V(x, RIVER.bed, RIVER.zSouth), V(x, RIVER.quayTop, RIVER.zSouth), V(x1, RIVER.quayTop, RIVER.zSouth));
    batch.resetColor();
    // coping
    batch.setColor(0.7, 0.7, 0.7);
    batch.box('granite', (x + x1) / 2, gy(x, RIVER.zNorth - 1) + 0.25, RIVER.zNorth - 0.3, 200, 0.5, 0.6);
    batch.box('granite', (x + x1) / 2, RIVER.quayTop + 0.25, RIVER.zSouth + 0.3, 200, 0.5, 0.6);
    batch.resetColor();
  }
  return water;
}

/** Railings along the river walkway (instanced posts + merged rails). */
export function buildQuayRailing(batch, inst) {
  const z = RIVER.zNorth - 0.5;
  for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 2.5) {
    const y = gy(x, z, 0);
    inst.add('railPost', new THREE.Matrix4().makeTranslation(x, y + 0.25, z));
  }
  batch.setChunkFrom(0, RIVER.zNorth);
  for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 40) {
    const y = gy(x, z);
    batch.box('ironDark', x + 20, y + 1.35, z, 40, 0.06, 0.06);
    batch.box('ironDark', x + 20, y + 0.55, z, 40, 0.05, 0.05);
  }
}

/** Road bridges across the Clyde: Glasgow Bridge (Jamaica St) and King George V Bridge (Oswald St). */
export function buildRoadBridges(batch) {
  const bridges = [
    { name: 'Glasgow Bridge', x: 78, w: 24, spans: 7, mat: 'granite', arch: 'round' },
    { name: 'King George V Bridge', x: -104, w: 22, spans: 3, mat: 'concrete', arch: 'flat' },
  ];
  for (const b of bridges) {
    const z0 = RIVER.zNorth - 2, z1 = RIVER.zSouth + 2;
    const L = z1 - z0;
    const deck = RIVER.quayTop + 0.1;
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
    batch.setChunkFrom(b.x, RIVER.zNorth + 20);
    // deck surface: carriageway + pavements
    const pw = 3.5;
    batch.quad('asphalt', V(x0 + pw, deck, z1), V(x1 - pw, deck, z1), V(x1 - pw, deck, z0), V(x0 + pw, deck, z0));
    batch.quad('paving', V(x0, deck + KERB, z1), V(x0 + pw, deck + KERB, z1), V(x0 + pw, deck + KERB, z0), V(x0, deck + KERB, z0));
    batch.quad('paving', V(x1 - pw, deck + KERB, z1), V(x1, deck + KERB, z1), V(x1, deck + KERB, z0), V(x1 - pw, deck + KERB, z0));
    batch.box('granite', x0 + pw - 0.15, deck + KERB / 2, (z0 + z1) / 2, 0.3, KERB, L);
    batch.box('granite', x1 - pw + 0.15, deck + KERB / 2, (z0 + z1) / 2, 0.3, KERB, L);
    // parapets
    batch.setColor(0.85, 0.85, 0.85);
    batch.box(b.mat, x0 + 0.3, deck + 0.7, (z0 + z1) / 2, 0.6, 1.2, L);
    batch.box(b.mat, x1 - 0.3, deck + 0.7, (z0 + z1) / 2, 0.6, 1.2, L);
    // spandrel faces with arches
    const spanL = (RIVER.zSouth - RIVER.zNorth) / b.spans;
    for (const side of [-1, 1]) {
      const xf = side < 0 ? x0 : x1;
      for (let i = 0; i < b.spans; i++) {
        const za = RIVER.zNorth + i * spanL, zb = za + spanL;
        const pier = spanL * 0.14;
        const zc = (za + zb) / 2, r = (spanL - pier) / 2;
        const spring = RIVER.water + 1.2;
        const rise = b.arch === 'round' ? Math.min(r, deck - 1.2 - spring) : (deck - 1.4 - spring) * 0.8;
        const seg = 12;
        for (let k = 0; k < seg; k++) {
          const a0 = Math.PI * (k / seg), a1 = Math.PI * ((k + 1) / seg);
          const pz0 = zc - Math.cos(a0) * r, py0 = spring + Math.sin(a0) * rise;
          const pz1 = zc - Math.cos(a1) * r, py1 = spring + Math.sin(a1) * rise;
          // spandrel from arch curve up to deck
          if (side < 0) batch.quad(b.mat, V(xf, py0, pz0), V(xf, py1, pz1), V(xf, deck, pz1), V(xf, deck, pz0));
          else batch.quad(b.mat, V(xf, py1, pz1), V(xf, py0, pz0), V(xf, deck, pz0), V(xf, deck, pz1));
          // soffit (only once)
          if (side > 0) batch.quad(b.mat, V(x0, py0, pz0), V(x1, py0, pz0), V(x1, py1, pz1), V(x0, py1, pz1));
        }
        // piers between arches
        if (i < b.spans) {
          const zp = zb;
          if (i < b.spans - 1 && side > 0) {
            batch.box(b.mat, b.x, (RIVER.bed + deck) / 2, zp, b.w + 1.2, deck - RIVER.bed, pier + 0.1);
            // cutwaters
            batch.box(b.mat, x0 - 1.2, (RIVER.bed + spring + 2) / 2, zp, 2.4, spring + 2 - RIVER.bed, pier * 0.7, Math.PI / 4);
            batch.box(b.mat, x1 + 1.2, (RIVER.bed + spring + 2) / 2, zp, 2.4, spring + 2 - RIVER.bed, pier * 0.7, Math.PI / 4);
          }
        }
      }
    }
    // cornice string
    batch.box(b.mat, x0 - 0.2, deck - 0.4, (z0 + z1) / 2, 0.5, 0.4, L);
    batch.box(b.mat, x1 + 0.2, deck - 0.4, (z0 + z1) / 2, 0.5, 0.4, L);
    batch.resetColor();
  }
}

export { STATION };
