// Turns city blocks into lots and lots into buildings.
import * as THREE from 'three';
import { Frame } from '../core/batch.js';
import { RNG, hashSeed } from '../core/rng.js';
import { groundHeight, KERB } from './layout.js';
import { buildFacade, plainWall, rectRoof, cornerTurret } from './facade.js';

// Glasgow sandstone palette (vertex-colour tints over the base textures).
const RED_TINTS = [[1, 1, 1], [0.92, 0.88, 0.86], [1.05, 0.98, 0.95], [0.85, 0.8, 0.8], [0.95, 0.9, 0.85]];
const BLOND_TINTS = [[1, 1, 1], [0.9, 0.88, 0.84], [1.08, 1.04, 0.98], [0.78, 0.76, 0.72], [0.96, 0.92, 0.85], [0.7, 0.68, 0.64]];

/** Architectural character by location. */
function zoneOf(x, z) {
  // riverside and the west end of Bothwell/Waterloo St carry modern offices
  if (z > 250) return 'riverside';
  if (x < -210 && z > -300) return 'business';
  if (x < -120 && z > -200 && z < 130) return 'mixed';
  return 'heritage';
}

function pickStyle(rng, zone) {
  const table = {
    heritage: [['victorian', 5], ['rich', 3], ['warehouse', 1], ['seventies', 0.4], ['modern', 0.3]],
    mixed: [['victorian', 3], ['rich', 1.5], ['warehouse', 1], ['seventies', 1], ['modern', 1.2]],
    business: [['victorian', 1.5], ['rich', 1], ['seventies', 1], ['modern', 3]],
    riverside: [['victorian', 1], ['warehouse', 1.5], ['seventies', 1], ['modern', 3]],
  }[zone];
  return rng.weighted(table);
}

function specFor(rng, style) {
  const stoneKind = style === 'modern' ? 'panel' : style === 'seventies' ? rng.pick(['concrete', 'concrete', 'brick']) : rng.chance(0.45) ? 'stoneRed' : 'stoneBlond';
  const tintSet = stoneKind === 'stoneRed' ? RED_TINTS : BLOND_TINTS;
  const tint = stoneKind === 'panel' ? [1, 1, 1] : rng.pick(tintSet);
  const s = { style, stone: stoneKind, tint };
  switch (style) {
    case 'victorian':
      s.nUpper = rng.int(3, 5); s.floorH = rng.range(3.5, 3.9); s.groundH = rng.range(4.3, 5.0);
      s.ground = rng.chance(0.85) ? 'shops' : 'windows';
      s.roof = rng.weighted([['pitched', 5], ['mansard', 2], ['flat', 1]]);
      s.bayW = rng.range(2.8, 3.5); s.turret = rng.chance(0.3);
      break;
    case 'rich':
      s.nUpper = rng.int(4, 6); s.floorH = rng.range(3.8, 4.2); s.groundH = rng.range(4.8, 5.6);
      s.ground = rng.chance(0.7) ? 'shops' : 'windows';
      s.roof = rng.weighted([['mansard', 3], ['pitched', 2], ['hipped', 1]]);
      s.bayW = rng.range(3.0, 3.6); s.turret = rng.chance(0.55);
      break;
    case 'warehouse':
      s.nUpper = rng.int(3, 5); s.floorH = rng.range(3.6, 4.1); s.groundH = 4.8;
      s.ground = 'shops'; s.roof = rng.chance(0.6) ? 'pitched' : 'flat';
      s.bayW = rng.range(2.3, 2.9);
      if (rng.chance(0.4)) s.stone = 'brick';
      break;
    case 'modern':
      s.nUpper = rng.int(5, 9); s.floorH = 3.8; s.groundH = 5.2; s.roof = 'flat';
      s.mullion = rng.pick([1.2, 1.5, 1.8]);
      s.glassTint = rng.pick([[1, 1, 1], [0.8, 0.95, 1.0], [0.9, 1.0, 0.92], [1.0, 0.95, 0.85]]);
      break;
    case 'seventies':
      s.nUpper = rng.int(4, 7); s.floorH = 3.5; s.groundH = 4.5; s.roof = 'flat';
      break;
  }
  return s;
}

/**
 * Build one rectangular building.
 * fronts: {n,s,e,w} which sides are street facades.
 */
export function buildRectBuilding(ctx, r, fronts, spec) {
  const { batch } = ctx;
  batch.setChunkFrom((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
  const corners = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];
  const hs = corners.map(([x, z]) => groundHeight(x, z));
  const gMin = Math.min(...hs), gMax = Math.max(...hs);
  const gMid = (gMin + gMax) / 2;
  const base = spec.base ?? gMid + KERB;
  const plinth = gMin - 0.3;
  const top = base + spec.groundH + spec.nUpper * spec.floorH;
  const tint = spec.tint || [1, 1, 1];

  const sides = {
    s: { fr: new Frame(r.x0, r.z1, 1, 0), L: r.x1 - r.x0 },
    e: { fr: new Frame(r.x1, r.z1, 0, -1), L: r.z1 - r.z0 },
    n: { fr: new Frame(r.x1, r.z0, -1, 0), L: r.x1 - r.x0 },
    w: { fr: new Frame(r.x0, r.z0, 0, 1), L: r.z1 - r.z0 },
  };
  let facadeSpec = null;
  for (const k of ['n', 's', 'e', 'w']) {
    const { fr, L } = sides[k];
    batch.setColor(...tint);
    if (fronts[k]) {
      const sp = { ...spec, base, plinth };
      // pass tint through by vertex colour: windows reset colour, so re-apply per call
      facadeSpec = buildFacadeTinted(ctx, fr, L, sp, tint);
    } else {
      const backMat = spec.style === 'modern' ? 'panel' : spec.stone === 'stoneRed' && ctx.rng.chance(0.5) ? 'stoneRed' : ctx.rng.chance(0.5) ? 'brick' : spec.stone;
      batch.setColor(...(backMat === spec.stone ? tint : [0.9, 0.9, 0.9]));
      plainWall(ctx, fr, L, plinth, top + 0.9, backMat, { windows: fronts.any !== false, floorH: spec.floorH, firstFloor: base - plinth + spec.groundH });
    }
    batch.resetColor();
  }

  // Roof
  const roofType = spec.roof || 'flat';
  const frontSides = ['n', 's', 'e', 'w'].filter((k) => fronts[k]);
  const ridgeAxis = frontSides.length === 1 ? (frontSides[0] === 'n' || frontSides[0] === 's' ? 'x' : 'z') : (r.x1 - r.x0 >= r.z1 - r.z0 ? 'x' : 'z');
  batch.setColor(...tint);
  let dormers = null;
  if ((roofType === 'pitched' || roofType === 'mansard') && facadeSpec && spec.style !== 'modern') {
    dormers = [];
    for (const k of frontSides) {
      const { fr, L } = sides[k];
      // only slopes that run along the facade get dormers
      const along = (k === 'n' || k === 's') ? 'x' : 'z';
      if (along !== ridgeAxis && roofType === 'pitched') continue;
      const nd = Math.floor((L - 3) / (spec.bayW * 2));
      for (let i = 0; i < nd; i++) dormers.push({ frame: fr, u: 1.5 + (L - 3) * ((i + 0.5) / nd), w: 1.5 });
    }
  }
  if (roofType === 'flat') {
    rectRoof(ctx, r, top + 0.05, { type: 'flat' });
    // roof plant / lift overrun
    if (ctx.rng.chance(0.7)) {
      const w = Math.min(8, (r.x1 - r.x0) * 0.4), d = Math.min(6, (r.z1 - r.z0) * 0.4);
      const cx = ctx.rng.range(r.x0 + w / 2 + 1, r.x1 - w / 2 - 1), cz = ctx.rng.range(r.z0 + d / 2 + 1, r.z1 - d / 2 - 1);
      batch.setColor(0.8, 0.8, 0.8);
      if (w > 1 && d > 1) batch.box('concrete', cx, top + 1.5, cz, w, 3, d);
      batch.resetColor();
    }
  } else {
    rectRoof(ctx, r, top + 0.1, {
      type: roofType, ridgeAxis, stone: spec.stone === 'panel' ? 'concrete' : spec.stone,
      maxRise: roofType === 'mansard' ? 3.6 : 4.5, dormers, chimneys: spec.style !== 'modern',
      slope: roofType === 'hipped' ? 35 : 42,
    });
  }
  batch.resetColor();

  // Corner turret
  if (spec.turret && spec.cornerAt) {
    const [cx, cz] = spec.cornerAt;
    batch.setColor(...tint);
    const rad = 2.4;
    const ox = cx + (cx === r.x0 ? 0.6 : -0.6), oz = cz + (cz === r.z0 ? 0.6 : -0.6);
    cornerTurret(ctx, ox, oz, base + spec.groundH, top + 1.5, rad, spec.stone, ctx.rng.chance(0.6) ? 'lead' : 'copper');
    batch.resetColor();
  }
  return { top, base };
}

function buildFacadeTinted(ctx, fr, L, sp, tint) {
  // Facade code resets vertex colour after coloured glass; wrap the batch so
  // resetColor() restores the building's stone tint instead of white.
  const b = ctx.batch;
  const orig = b.resetColor;
  b.resetColor = function () { this.color = [tint[0], tint[1], tint[2]]; };
  b.setColor(...tint);
  const r = buildFacade(ctx, fr, L, sp);
  b.resetColor = orig;
  b.resetColor();
  return r;
}

/** Subdivide a block into lots and build them. */
export function buildBlock(ctx, block, idx, overrides = []) {
  const rng = new RNG(hashSeed('block', idx, block.x0, block.z0));
  const lctx = { ...ctx, rng };
  const { x0, x1, z0, z1, front } = block;
  const W = x1 - x0, H = z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const zone = zoneOf(cx, cz);
  const anyFront = front.n || front.s || front.e || front.w;
  if (!anyFront) return;

  // whole-block modern office?
  if ((zone === 'business' || zone === 'riverside') && rng.chance(0.35) && W < 120 && H < 120) {
    const spec = specFor(rng, 'modern');
    buildRectBuilding(lctx, block, front, spec);
    return;
  }

  const D = Math.min(17, W / 2, H / 2);
  const lots = [];
  // corner lots
  const cornerSize = Math.min(D + rng.range(2, 6), W / 2, H / 2);
  const corner = {
    nw: front.n && front.w, ne: front.n && front.e, se: front.s && front.e, sw: front.s && front.w,
  };
  if (corner.nw) lots.push({ r: { x0, x1: x0 + cornerSize, z0, z1: z0 + cornerSize }, fronts: { n: true, w: true }, cornerAt: [x0, z0] });
  if (corner.ne) lots.push({ r: { x0: x1 - cornerSize, x1, z0, z1: z0 + cornerSize }, fronts: { n: true, e: true }, cornerAt: [x1, z0] });
  if (corner.se) lots.push({ r: { x0: x1 - cornerSize, x1, z0: z1 - cornerSize, z1 }, fronts: { s: true, e: true }, cornerAt: [x1, z1] });
  if (corner.sw) lots.push({ r: { x0, x1: x0 + cornerSize, z0: z1 - cornerSize, z1 }, fronts: { s: true, w: true }, cornerAt: [x0, z1] });

  const split = (a, b, isModern) => {
    const out = [];
    let p = a;
    while (b - p > 0.5) {
      let w = isModern ? rng.range(24, 45) : rng.range(9, 24);
      if (b - (p + w) < 7) w = b - p;
      out.push([p, p + w]);
      p += w;
    }
    return out;
  };

  // edge lots along each front
  // north
  if (front.n) {
    const a = corner.nw ? x0 + cornerSize : x0 + (front.w ? 0 : 0);
    const b = corner.ne ? x1 - cornerSize : x1;
    const depth = front.s ? Math.min(D, H / 2) : Math.min(D, H);
    for (const [p, q] of split(a, b, false)) lots.push({ r: { x0: p, x1: q, z0, z1: z0 + depth }, fronts: { n: true } });
  }
  if (front.s) {
    const a = corner.sw ? x0 + cornerSize : x0;
    const b = corner.se ? x1 - cornerSize : x1;
    const depth = front.n ? Math.min(D, H / 2) : Math.min(D, H);
    for (const [p, q] of split(a, b, false)) lots.push({ r: { x0: p, x1: q, z0: z1 - depth, z1 }, fronts: { s: true } });
  }
  if (front.w) {
    const a = corner.nw ? z0 + cornerSize : z0 + (front.n ? D : 0);
    const b = corner.sw ? z1 - cornerSize : z1 - (front.s ? D : 0);
    const depth = front.e ? Math.min(D, W / 2) : Math.min(D, W);
    for (const [p, q] of split(a, b, false)) lots.push({ r: { x0, x1: x0 + depth, z0: p, z1: q }, fronts: { w: true } });
  }
  if (front.e) {
    const a = corner.ne ? z0 + cornerSize : z0 + (front.n ? D : 0);
    const b = corner.se ? z1 - cornerSize : z1 - (front.s ? D : 0);
    const depth = front.w ? Math.min(D, W / 2) : Math.min(D, W);
    for (const [p, q] of split(a, b, false)) lots.push({ r: { x0: x1 - depth, x1, z0: p, z1: q }, fronts: { e: true } });
  }

  for (const lot of lots) {
    const lr = lot.r;
    if (lr.x1 - lr.x0 < 3 || lr.z1 - lr.z0 < 3) continue;
    // landmark override?
    const ov = overrides.find((o) => o.test(lr, lot));
    if (ov) { ov.build(lctx, lr, lot); continue; }
    const lz = zoneOf((lr.x0 + lr.x1) / 2, (lr.z0 + lr.z1) / 2);
    const style = pickStyle(rng, lz);
    const spec = specFor(rng, style);
    spec.cornerAt = lot.cornerAt;
    if (!lot.cornerAt) spec.turret = false;
    buildRectBuilding(lctx, lr, lot.fronts, spec);
  }

  // back court outbuildings (stores, workshops, light wells) so courts are not empty
  const inner = { x0: x0 + D + 1, x1: x1 - D - 1, z0: z0 + D + 1, z1: z1 - D - 1 };
  if (inner.x1 - inner.x0 > 8 && inner.z1 - inner.z0 > 8) {
    ctx.batch.setChunkFrom(cx, cz);
    const n = Math.floor(((inner.x1 - inner.x0) * (inner.z1 - inner.z0)) / 260);
    for (let i = 0; i < n; i++) {
      if (!rng.chance(0.6)) continue;
      const w = rng.range(5, 14), d = rng.range(4, 10), h = rng.range(3, 7.5);
      const bx = rng.range(inner.x0 + w / 2, inner.x1 - w / 2), bz = rng.range(inner.z0 + d / 2, inner.z1 - d / 2);
      if (inner.x1 - inner.x0 < w || inner.z1 - inner.z0 < d) continue;
      const g = groundHeight(bx, bz) + KERB;
      const mat = rng.pick(['brick', 'brick', 'render', 'stoneBlond']);
      ctx.batch.setColor(...(mat === 'stoneBlond' ? [0.75, 0.72, 0.68] : [0.9, 0.9, 0.9]));
      ctx.batch.box(mat, bx, g + h / 2 - 0.2, bz, w, h + 0.4, d, 0, { bottom: false });
      ctx.batch.setColor(0.6, 0.6, 0.6);
      if (rng.chance(0.5)) {
        // glazed roof light
        ctx.batch.box('lead', bx, g + h + 0.05, bz, w + 0.2, 0.1, d + 0.2);
        ctx.batch.box('glass', bx, g + h + 0.4, bz, w * 0.6, 0.6, d * 0.6, 0, { bottom: false });
      } else {
        ctx.batch.box('concrete', bx, g + h + 0.05, bz, w + 0.2, 0.12, d + 0.2);
      }
      ctx.batch.resetColor();
    }
  }

  // back court ground
  ctx.batch.setChunkFrom(cx, cz);
  ctx.batch.setColor(0.7, 0.7, 0.7);
  const y = groundHeight(cx, cz) + KERB + 0.02;
  const V = (x, z) => new THREE.Vector3(x, groundHeight(x, z) + KERB + 0.02, z);
  ctx.batch.quad('concrete', V(x0, z1), V(x1, z1), V(x1, z0), V(x0, z0));
  ctx.batch.resetColor();
  void y;
}
