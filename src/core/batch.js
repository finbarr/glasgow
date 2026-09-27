import * as THREE from 'three';

// Growable typed array.
class FloatBuf {
  constructor(n = 1024) { this.a = new Float32Array(n); this.len = 0; }
  push3(x, y, z) {
    if (this.len + 3 > this.a.length) this.grow();
    this.a[this.len++] = x; this.a[this.len++] = y; this.a[this.len++] = z;
  }
  push2(x, y) {
    if (this.len + 2 > this.a.length) this.grow();
    this.a[this.len++] = x; this.a[this.len++] = y;
  }
  grow() {
    const b = new Float32Array(this.a.length * 2);
    b.set(this.a); this.a = b;
  }
  view() { return this.a.subarray(0, this.len); }
}

class IndexBuf {
  constructor(n = 1024) { this.a = new Uint32Array(n); this.len = 0; }
  push(i) {
    if (this.len + 1 > this.a.length) {
      const b = new Uint32Array(this.a.length * 2); b.set(this.a); this.a = b;
    }
    this.a[this.len++] = i;
  }
  view() { return this.a.subarray(0, this.len); }
}

class Group {
  constructor() {
    this.pos = new FloatBuf(); this.nrm = new FloatBuf(); this.uv = new FloatBuf(); this.col = new FloatBuf();
    this.idx = new IndexBuf(); this.count = 0;
  }
}

const _up = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
const _t = new THREE.Vector3(), _bt = new THREE.Vector3();

/**
 * Collects geometry into per-material (and per-spatial-chunk) buffers,
 * then produces a small number of merged meshes. UVs are world-anchored in
 * metres so textures line up across neighbouring pieces.
 */
export class Batch {
  constructor({ chunkSize = 160 } = {}) {
    this.groups = new Map();
    this.chunkSize = chunkSize;
    this.chunk = '0,0';
    this.color = [1, 1, 1];
    this.uvOffset = [0, 0];
  }

  setChunkFrom(x, z) {
    const s = this.chunkSize;
    this.chunk = `${Math.floor(x / s)},${Math.floor(z / s)}`;
  }

  setColor(r, g, b) { this.color = [r, g, b]; }
  resetColor() { this.color = [1, 1, 1]; }

  _group(mat) {
    const key = mat + '|' + this.chunk;
    let g = this.groups.get(key);
    if (!g) { g = new Group(); this.groups.set(key, g); }
    return g;
  }

  /** Quad a-b-c-d counter-clockwise when seen from the front. Optional explicit uvs [u0,v0,u1,v1,...]. */
  quad(mat, a, b, c, d, uvs) {
    _a.subVectors(b, a); _b.subVectors(d, a);
    _n.crossVectors(_a, _b);
    const len = _n.length();
    if (len < 1e-9) return;
    _n.multiplyScalar(1 / len);
    const g = this._group(mat);
    const base = g.count;
    const pts = [a, b, c, d];
    if (!uvs) this._frame(_n);
    const col = this.color;
    for (let i = 0; i < 4; i++) {
      const p = pts[i];
      g.pos.push3(p.x, p.y, p.z);
      g.nrm.push3(_n.x, _n.y, _n.z);
      if (uvs) g.uv.push2(uvs[i * 2], uvs[i * 2 + 1]);
      else g.uv.push2(p.dot(_t) + this.uvOffset[0], p.dot(_bt) + this.uvOffset[1]);
      g.col.push3(col[0], col[1], col[2]);
    }
    g.idx.push(base); g.idx.push(base + 1); g.idx.push(base + 2);
    g.idx.push(base); g.idx.push(base + 2); g.idx.push(base + 3);
    g.count += 4;
  }

  /** Quad whose winding is chosen so its normal points along (nx,ny,nz). */
  quadN(mat, a, b, c, d, nx, ny, nz, uvs) {
    _a.subVectors(b, a); _b.subVectors(d, a);
    _n.crossVectors(_a, _b);
    if (_n.x * nx + _n.y * ny + _n.z * nz >= 0) this.quad(mat, a, b, c, d, uvs);
    else this.quad(mat, d, c, b, a, uvs ? [uvs[6], uvs[7], uvs[4], uvs[5], uvs[2], uvs[3], uvs[0], uvs[1]] : undefined);
  }

  triN(mat, a, b, c, nx, ny, nz) {
    _a.subVectors(b, a); _b.subVectors(c, a);
    _n.crossVectors(_a, _b);
    if (_n.x * nx + _n.y * ny + _n.z * nz >= 0) this.tri(mat, a, b, c);
    else this.tri(mat, a, c, b);
  }

  tri(mat, a, b, c) {
    _a.subVectors(b, a); _b.subVectors(c, a);
    _n.crossVectors(_a, _b);
    const len = _n.length();
    if (len < 1e-9) return;
    _n.multiplyScalar(1 / len);
    this._frame(_n);
    const g = this._group(mat);
    const base = g.count;
    const col = this.color;
    for (const p of [a, b, c]) {
      g.pos.push3(p.x, p.y, p.z);
      g.nrm.push3(_n.x, _n.y, _n.z);
      g.uv.push2(p.dot(_t) + this.uvOffset[0], p.dot(_bt) + this.uvOffset[1]);
      g.col.push3(col[0], col[1], col[2]);
    }
    g.idx.push(base); g.idx.push(base + 1); g.idx.push(base + 2);
    g.count += 3;
  }

  /** Raw smooth-shaded geometry (positions/normals arrays, triangle indices). */
  raw(mat, positions, normals, uvs, indices) {
    const g = this._group(mat);
    const base = g.count;
    const col = this.color;
    for (let i = 0; i < positions.length; i += 3) {
      g.pos.push3(positions[i], positions[i + 1], positions[i + 2]);
      g.nrm.push3(normals[i], normals[i + 1], normals[i + 2]);
      g.col.push3(col[0], col[1], col[2]);
    }
    for (let i = 0; i < uvs.length; i += 2) g.uv.push2(uvs[i], uvs[i + 1]);
    for (const i of indices) g.idx.push(base + i);
    g.count += positions.length / 3;
  }

  /** Append a THREE.BufferGeometry transformed by matrix. */
  geometry(mat, geom, matrix) {
    const g = geom.index ? geom : geom;
    const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const P = [], N = [], U = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z);
      if (uv) U.push(uv.getX(i), uv.getY(i)); else U.push(0, 0);
    }
    let I;
    if (g.index) I = Array.from(g.index.array);
    else { I = []; for (let i = 0; i < pos.count; i++) I.push(i); }
    this.raw(mat, P, N, U, I);
  }

  _frame(n) {
    if (Math.abs(n.y) > 0.999) _t.set(1, 0, 0);
    else _t.crossVectors(_up, n).normalize();
    _bt.crossVectors(n, _t);
  }

  /**
   * Axis-aligned-in-local-frame box. center (cx,cy,cz), size (sx,sy,sz),
   * rotated about Y by angle `ry`. faces: object to skip faces e.g. {bottom:false}.
   */
  box(mat, cx, cy, cz, sx, sy, sz, ry = 0, faces = null) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const c = Math.cos(ry), s = Math.sin(ry);
    const P = (x, y, z) => new THREE.Vector3(cx + x * c + z * s, cy + y, cz - x * s + z * c);
    const p000 = P(-hx, -hy, -hz), p100 = P(hx, -hy, -hz), p110 = P(hx, hy, -hz), p010 = P(-hx, hy, -hz);
    const p001 = P(-hx, -hy, hz), p101 = P(hx, -hy, hz), p111 = P(hx, hy, hz), p011 = P(-hx, hy, hz);
    const f = faces || {};
    if (f.front !== false) this.quad(mat, p001, p101, p111, p011); // +z
    if (f.back !== false) this.quad(mat, p100, p000, p010, p110); // -z
    if (f.right !== false) this.quad(mat, p101, p100, p110, p111); // +x
    if (f.left !== false) this.quad(mat, p000, p001, p011, p010); // -x
    if (f.top !== false) this.quad(mat, p011, p111, p110, p010);
    if (f.bottom !== false) this.quad(mat, p000, p100, p101, p001);
  }

  /** Box between two points (for beams/struts) with square section w x h. */
  beam(mat, p0, p1, w, h = w) {
    const d = new THREE.Vector3().subVectors(p1, p0);
    const L = d.length();
    if (L < 1e-6) return;
    const dir = d.clone().multiplyScalar(1 / L);
    const ref = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(dir, ref).normalize();
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();
    const hw = w / 2, hh = h / 2;
    const corner = (p, a, b) => p.clone().addScaledVector(side, a).addScaledVector(up, b);
    const q = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    const s0 = q.map(([a, b]) => corner(p0, a, b));
    const s1 = q.map(([a, b]) => corner(p1, a, b));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(mat, s0[j], s0[i], s1[i], s1[j]);
    }
    this.quad(mat, s0[0], s0[1], s0[2], s0[3]);
    this.quad(mat, s1[3], s1[2], s1[1], s1[0]);
  }

  /** Vertical prism (cylinder approximation) centred at x,z from y0 to y1. */
  cylinder(mat, x, y0, z, r, h, seg = 12, rTop = r, caps = true) {
    const P = [], N = [], U = [], I = [];
    const slope = (r - rTop) / h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const cx = Math.cos(a), sz = Math.sin(a);
      const nl = Math.hypot(1, slope);
      P.push(x + cx * r, y0, z + sz * r, x + cx * rTop, y0 + h, z + sz * rTop);
      N.push(cx / nl, slope / nl, sz / nl, cx / nl, slope / nl, sz / nl);
      const u = (i / seg) * Math.PI * 2 * r;
      U.push(u, y0, u, y0 + h);
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2;
      I.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    this.raw(mat, P, N, U, I);
    if (caps && rTop > 0) this.disc(mat, x, y0 + h, z, rTop, seg, 1);
    if (caps && r > 0) this.disc(mat, x, y0, z, r, seg, -1);
  }

  disc(mat, x, y, z, r, seg = 12, dir = 1) {
    const P = [x, y, z], N = [0, dir, 0], U = [x, -z], I = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      P.push(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      N.push(0, dir, 0);
      U.push(x + Math.cos(a) * r, -(z + Math.sin(a) * r));
    }
    for (let i = 1; i <= seg; i++) {
      if (dir > 0) I.push(0, i + 1, i); else I.push(0, i, i + 1);
    }
    this.raw(mat, P, N, U, I);
  }

  /** Dome / onion profile revolved: profile = [[r, y], ...] bottom->top */
  lathe(mat, x, y0, z, profile, seg = 16) {
    const P = [], N = [], U = [], I = [];
    const rows = profile.length;
    for (let j = 0; j < rows; j++) {
      const [r, y] = profile[j];
      // normal from neighbouring profile points
      const [r0, y0p] = profile[Math.max(0, j - 1)];
      const [r1, y1p] = profile[Math.min(rows - 1, j + 1)];
      let dr = r1 - r0, dy = y1p - y0p;
      const l = Math.hypot(dr, dy) || 1;
      const nr = dy / l, ny = -dr / l;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        P.push(x + c * r, y0 + y, z + s * r);
        N.push(c * nr, ny, s * nr);
        U.push((i / seg) * 6, y);
      }
    }
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * (seg + 1) + i, b = a + seg + 1;
        I.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.raw(mat, P, N, U, I);
  }

  /** Flat polygon (XZ) at height y, pts [[x,z],...] CCW seen from above. */
  polygon(mat, pts, y, up = true) {
    const shape = pts.map(([x, z]) => new THREE.Vector2(x, -z));
    const tris = THREE.ShapeUtils.triangulateShape(shape, []);
    for (const [i, j, k] of tris) {
      const a = new THREE.Vector3(pts[i][0], y, pts[i][1]);
      const b = new THREE.Vector3(pts[j][0], y, pts[j][1]);
      const c = new THREE.Vector3(pts[k][0], y, pts[k][1]);
      // ensure orientation
      const nY = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
      const faceUp = nY < 0; // (b-a)x(c-a) y-component = dz*dx... sign check
      if (faceUp === up) this.tri(mat, a, b, c); else this.tri(mat, a, c, b);
    }
  }

  /** Build meshes. materials: {key: Material}. Returns THREE.Group */
  build(materials, { castShadow = true, receiveShadow = true, noShadow = [] } = {}) {
    const root = new THREE.Group();
    for (const [key, g] of this.groups) {
      if (g.count === 0) continue;
      const matKey = key.split('|')[0];
      const material = materials[matKey];
      if (!material) { console.warn('missing material', matKey); continue; }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(g.pos.view().slice(), 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(g.nrm.view().slice(), 3));
      geom.setAttribute('uv', new THREE.BufferAttribute(g.uv.view().slice(), 2));
      geom.setAttribute('color', new THREE.BufferAttribute(g.col.view().slice(), 3));
      geom.setIndex(new THREE.BufferAttribute(g.idx.view().slice(), 1));
      geom.computeBoundingSphere();
      geom.computeBoundingBox();
      const mesh = new THREE.Mesh(geom, material);
      mesh.name = key;
      const ns = noShadow.includes(matKey) || material.userData.noShadow;
      mesh.castShadow = castShadow && !ns && !material.transparent;
      mesh.receiveShadow = receiveShadow;
      if (material.userData.castShadow !== undefined) mesh.castShadow = material.userData.castShadow;
      root.add(mesh);
    }
    this.groups.clear();
    return root;
  }
}

/**
 * Local facade frame: origin O at bottom-left (seen from outside) of a wall,
 * t = along-wall direction (to the viewer's right), n = outward normal.
 */
export class Frame {
  constructor(ox, oz, tx, tz) {
    this.ox = ox; this.oz = oz;
    const l = Math.hypot(tx, tz);
    this.tx = tx / l; this.tz = tz / l;
    // outward normal: t = (nz, -nx) => n = (-tz, tx)
    this.nx = -this.tz; this.nz = this.tx;
  }
  p(u, v, d = 0) {
    return new THREE.Vector3(
      this.ox + this.tx * u + this.nx * d,
      v,
      this.oz + this.tz * u + this.nz * d,
    );
  }
  // rect on the wall plane at depth d (front-facing along n)
  rect(batch, mat, u0, v0, u1, v1, d = 0) {
    if (u1 - u0 < 1e-4 || v1 - v0 < 1e-4) return;
    batch.quad(mat, this.p(u0, v0, d), this.p(u1, v0, d), this.p(u1, v1, d), this.p(u0, v1, d));
  }
  // box in local coords: u range, v range, d range (d positive = outwards)
  box(batch, mat, u0, u1, v0, v1, d0, d1, faces = null) {
    const f = faces || {};
    const P = (u, v, d) => this.p(u, v, d);
    if (u1 - u0 < 1e-4 || v1 - v0 < 1e-4 || d1 - d0 < 1e-4) return;
    if (f.front !== false) batch.quad(mat, P(u0, v0, d1), P(u1, v0, d1), P(u1, v1, d1), P(u0, v1, d1));
    if (f.back) batch.quad(mat, P(u1, v0, d0), P(u0, v0, d0), P(u0, v1, d0), P(u1, v1, d0));
    if (f.left !== false) batch.quad(mat, P(u0, v0, d0), P(u0, v0, d1), P(u0, v1, d1), P(u0, v1, d0));
    if (f.right !== false) batch.quad(mat, P(u1, v0, d1), P(u1, v0, d0), P(u1, v1, d0), P(u1, v1, d1));
    if (f.top !== false) batch.quad(mat, P(u0, v1, d1), P(u1, v1, d1), P(u1, v1, d0), P(u0, v1, d0));
    if (f.bottom !== false) batch.quad(mat, P(u0, v0, d0), P(u1, v0, d0), P(u1, v0, d1), P(u0, v0, d1));
  }
  // matrix for an instanced unit object: X along t scaled sx, Y up sy, Z along n sz
  matrix(u, v, d, sx, sy, sz) {
    const m = new THREE.Matrix4();
    m.set(
      this.tx * sx, 0, this.nx * sz, this.ox + this.tx * u + this.nx * d,
      0, sy, 0, v,
      this.tz * sx, 0, this.nz * sz, this.oz + this.tz * u + this.nz * d,
      0, 0, 0, 1,
    );
    return m;
  }
}

/** Collects instance transforms for a given unit geometry. */
export class InstanceSet {
  constructor() { this.sets = new Map(); }
  add(key, matrix, color = null) {
    let s = this.sets.get(key);
    if (!s) { s = { m: [], c: [] }; this.sets.set(key, s); }
    s.m.push(matrix);
    s.c.push(color);
  }
  build(defs) {
    // defs: {key: {geometry, material, castShadow}}
    const root = new THREE.Group();
    for (const [key, s] of this.sets) {
      const def = defs[key];
      if (!def) { console.warn('missing instance def', key); continue; }
      const mesh = new THREE.InstancedMesh(def.geometry, def.material, s.m.length);
      const hasColor = s.c.some((c) => c);
      for (let i = 0; i < s.m.length; i++) {
        mesh.setMatrixAt(i, s.m[i]);
        if (hasColor) mesh.setColorAt(i, s.c[i] || new THREE.Color(1, 1, 1));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = def.castShadow !== false;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.name = 'inst:' + key;
      root.add(mesh);
    }
    this.sets.clear();
    return root;
  }
}
