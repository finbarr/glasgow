// Procedural facade and roof construction for Glasgow's Victorian and
// Edwardian sandstone commercial blocks (and some modern infill).
//
// Facades are built from front-face rectangles around recessed window
// openings, so reveals give real depth and pick up ambient occlusion and
// shadow. Window frames are instanced.
import * as THREE from 'three';
import { Frame } from '../core/batch.js';
import { fasciaUV } from '../materials/signs.js';

export const STYLE_DEFAULTS = {
  victorian: {
    groundH: 4.6, floorH: 3.7, bayW: 3.1, winW: 1.15, winH: 0.6, sill: 0.85, reveal: 0.24,
    cornice: true, strings: true, parapet: 0.9, frame: 'sash', surrounds: false, pediments: false,
  },
  rich: {
    groundH: 5.0, floorH: 4.0, bayW: 3.3, winW: 1.25, winH: 0.6, sill: 0.8, reveal: 0.28,
    cornice: true, strings: true, parapet: 1.0, frame: 'sash', surrounds: true, pediments: true,
  },
  warehouse: {
    groundH: 4.8, floorH: 3.9, bayW: 2.6, winW: 1.7, winH: 0.66, sill: 0.8, reveal: 0.2,
    cornice: true, strings: false, parapet: 0.8, frame: 'dark', surrounds: false, pediments: false,
  },
  modern: {
    groundH: 5.0, floorH: 3.8, curtain: true, parapet: 1.1,
  },
  seventies: {
    groundH: 4.5, floorH: 3.5, strip: true, parapet: 0.9,
  },
};

function glassColor(rng, litP = 0.35) {
  if (rng.chance(litP)) {
    const k = rng.range(0.85, 1.0);
    return rng.chance(0.2) ? [0.8 * k, 0.9 * k, 1.0 * k] : [1.0 * k, 0.82 * k, 0.58 * k];
  }
  const g = rng.range(0.25, 0.62);
  return [g, g * rng.range(0.95, 1.05), g * rng.range(1.0, 1.12)];
}

/** Place a recessed window opening; front surface around it is the caller's job. */
function windowOpening(ctx, fr, u0, u1, v0, v1, spec, opts = {}) {
  const { batch, inst, rng } = ctx;
  const d = -(spec.reveal ?? 0.22);
  const stone = spec.stone;
  // reveals
  batch.quad(stone, fr.p(u0, v0, 0), fr.p(u0, v0, d), fr.p(u0, v1, d), fr.p(u0, v1, 0)); // left jamb faces +t
  batch.quad(stone, fr.p(u1, v0, d), fr.p(u1, v0, 0), fr.p(u1, v1, 0), fr.p(u1, v1, d)); // right jamb
  batch.quad(stone, fr.p(u0, v1, 0), fr.p(u0, v1, d), fr.p(u1, v1, d), fr.p(u1, v1, 0)); // soffit faces down
  batch.quad(stone, fr.p(u0, v0, d), fr.p(u0, v0, 0), fr.p(u1, v0, 0), fr.p(u1, v0, d)); // sill face up
  // glass
  const gc = opts.glassColor || glassColor(rng, opts.litP ?? 0.35);
  batch.setColor(gc[0], gc[1], gc[2]);
  const gm = opts.glassMat || 'glass';
  batch.quad(gm, fr.p(u0, v0, d), fr.p(u1, v0, d), fr.p(u1, v1, d), fr.p(u0, v1, d), [0, 0, 1, 0, 1, 1, 0, 1]);
  batch.resetColor();
  // frame
  const ft = opts.frame ?? spec.frame;
  if (ft && ft !== 'none') {
    const key = ft === 'dark' ? 'frameDark' : ft === 'casement' ? 'frameCasement' : 'frameSash';
    inst.add(key, fr.matrix((u0 + u1) / 2, v0, d + 0.02, u1 - u0, v1 - v0, 1));
  }
}

/** Front face with rectangular holes: rows of [v0,v1] bands each with list of openings [u0,u1]. */
function wallWithOpenings(ctx, fr, L, v0, v1, holes, mat) {
  // holes: [{u0,u1,v0,v1}] all within [v0,v1]; assume holes in a row share v extents
  if (!holes.length) { fr.rect(ctx.batch, mat, 0, v0, L, v1); return; }
  const hv0 = Math.min(...holes.map((h) => h.v0));
  const hv1 = Math.max(...holes.map((h) => h.v1));
  fr.rect(ctx.batch, mat, 0, v0, L, hv0);
  fr.rect(ctx.batch, mat, 0, hv1, L, v1);
  const sorted = [...holes].sort((a, b) => a.u0 - b.u0);
  let u = 0;
  for (const h of sorted) {
    fr.rect(ctx.batch, mat, u, hv0, h.u0, hv1);
    // fill above/below if this hole is shorter than band
    if (h.v0 > hv0) fr.rect(ctx.batch, mat, h.u0, hv0, h.u1, h.v0);
    if (h.v1 < hv1) fr.rect(ctx.batch, mat, h.u0, h.v1, h.u1, hv1);
    u = h.u1;
  }
  fr.rect(ctx.batch, mat, u, hv0, L, hv1);
}

/** Semicircular-headed opening: fills the wall around it within [u0,u1]x[v0,vTop]. */
export function archOpening(ctx, fr, u0, u1, v0, vTop, spec, fill = 'glass', opts = {}) {
  const { batch } = ctx;
  const w = u1 - u0, r = w / 2, cu = (u0 + u1) / 2;
  const spring = vTop - r - (opts.headroom ?? 0.3);
  const d = -(spec.reveal ?? 0.3);
  const stone = spec.stone;
  const seg = 10;
  // jambs up to springing line
  batch.quad(stone, fr.p(u0, v0, 0), fr.p(u0, v0, d), fr.p(u0, spring, d), fr.p(u0, spring, 0));
  batch.quad(stone, fr.p(u1, v0, d), fr.p(u1, v0, 0), fr.p(u1, spring, 0), fr.p(u1, spring, d));
  // spandrels and arch soffit
  for (let i = 0; i < seg; i++) {
    const a0 = Math.PI - (i / seg) * Math.PI, a1 = Math.PI - ((i + 1) / seg) * Math.PI;
    const pu0 = cu + Math.cos(a0) * r, pv0 = spring + Math.sin(a0) * r;
    const pu1 = cu + Math.cos(a1) * r, pv1 = spring + Math.sin(a1) * r;
    // spandrel quad from arc to top
    batch.quad(stone, fr.p(pu0, pv0, 0), fr.p(pu1, pv1, 0), fr.p(pu1, vTop, 0), fr.p(pu0, vTop, 0));
    // soffit
    batch.quad(stone, fr.p(pu0, pv0, 0), fr.p(pu0, pv0, d), fr.p(pu1, pv1, d), fr.p(pu1, pv1, 0));
    // fill (glass / dark) at depth
    batch.tri(fill, fr.p(cu, spring, d), fr.p(pu1, pv1, d), fr.p(pu0, pv0, d));
  }
  // voussoir keystone
  fr.box(batch, stone, cu - 0.25, cu + 0.25, spring + r - 0.1, spring + r + 0.45, 0, 0.08);
  // rectangular part fill + sill face
  batch.quad(fill, fr.p(u0, v0, d), fr.p(u1, v0, d), fr.p(u1, spring, d), fr.p(u0, spring, d));
  batch.quad(stone, fr.p(u0, v0, d), fr.p(u0, v0, 0), fr.p(u1, v0, 0), fr.p(u1, v0, d));
  if (opts.frame) {
    ctx.inst.add('frameDark', fr.matrix(cu, v0, d + 0.02, w, spring - v0, 1));
  }
}

function cornice(ctx, fr, L, y, mat, scale = 1, ends = true) {
  const b = ctx.batch;
  const f = ends ? null : { left: false, right: false };
  fr.box(b, mat, 0, L, y - 0.55 * scale, y - 0.35 * scale, 0, 0.12 * scale, f);
  fr.box(b, mat, -0.05, L + 0.05, y - 0.35 * scale, y - 0.12 * scale, 0, 0.3 * scale, f);
  fr.box(b, mat, -0.1, L + 0.1, y - 0.12 * scale, y + 0.08 * scale, 0, 0.5 * scale, f);
  // dentils/modillions as a darker shadow band are implied by AO under the drip
}

function stringCourse(ctx, fr, L, y, mat, h = 0.22, d = 0.09) {
  fr.box(ctx.batch, mat, 0, L, y - h / 2, y + h / 2, 0, d);
}

/**
 * Build a single street facade.
 * spec: { style, stone, base, plinth, groundH, floorH, nUpper, ground, ... }
 */
export function buildFacade(ctx, fr, L, specIn) {
  const spec = { ...STYLE_DEFAULTS[specIn.style || 'victorian'], ...specIn };
  const { batch, rng } = ctx;
  const stone = spec.stone;
  const base = spec.base;
  const plinth = spec.plinth ?? base;
  const top = base + spec.groundH + spec.nUpper * spec.floorH;
  spec.top = top;

  if (base - plinth > 0.02) {
    fr.rect(batch, spec.plinthMat || 'stoneRustic', 0, plinth, L, base);
  }

  if (spec.curtain) return curtainFacade(ctx, fr, L, spec);
  if (spec.strip) return stripFacade(ctx, fr, L, spec);

  // ---------------- ground floor ----------------
  const gTop = base + spec.groundH;
  groundFloor(ctx, fr, L, base, gTop, spec);

  // ---------------- upper floors ----------------
  const endPier = Math.min(1.0, L * 0.1);
  const usable = L - 2 * endPier;
  const nb = Math.max(1, Math.floor(usable / spec.bayW));
  const spacing = usable / nb;
  const ww = Math.max(0.5, Math.min(spec.winW, spacing - 0.55));
  // occasionally paired windows (Glasgow "tripartite" windows) on rich facades
  for (let f = 0; f < spec.nUpper; f++) {
    const fy = gTop + f * spec.floorH;
    const diminish = f === spec.nUpper - 1 && spec.nUpper > 2 ? 0.85 : f === 0 && spec.surrounds ? 1.08 : 1;
    const wh = spec.floorH * spec.winH * diminish;
    const sy = fy + spec.sill;
    const holes = [];
    for (let k = 0; k < nb; k++) {
      const c = endPier + spacing * (k + 0.5);
      holes.push({ u0: c - ww / 2, u1: c + ww / 2, v0: sy, v1: sy + wh });
    }
    wallWithOpenings(ctx, fr, L, fy, fy + spec.floorH, holes, stone);
    for (const h of holes) {
      windowOpening(ctx, fr, h.u0, h.u1, h.v0, h.v1, spec);
      // projecting sill
      fr.box(batch, stone, h.u0 - 0.12, h.u1 + 0.12, h.v0 - 0.14, h.v0 + 0.02, 0, 0.11);
      if (spec.surrounds) {
        const s = 0.16;
        fr.box(batch, stone, h.u0 - s, h.u0, h.v0, h.v1, 0, 0.06);
        fr.box(batch, stone, h.u1, h.u1 + s, h.v0, h.v1, 0, 0.06);
        fr.box(batch, stone, h.u0 - s, h.u1 + s, h.v1, h.v1 + s, 0, 0.06);
      }
      if (spec.pediments && f === 0) {
        pediment(ctx, fr, h.u0 - 0.25, h.u1 + 0.25, h.v1 + 0.16, stone, (Math.floor(h.u0 / spacing) % 2) === 0);
      } else if (f < spec.nUpper - 1 && (spec.hoods ?? rng.chance(0.0))) {
        fr.box(batch, stone, h.u0 - 0.15, h.u1 + 0.15, h.v1 + 0.05, h.v1 + 0.25, 0, 0.12);
      }
    }
    if (spec.strings && f > 0) stringCourse(ctx, fr, L, fy, stone, 0.18, 0.06);
  }
  if (spec.strings) stringCourse(ctx, fr, L, gTop, stone, 0.35, 0.14);

  // quoins / pilasters at facade ends for richer styles
  if (spec.surrounds) {
    fr.box(batch, stone, 0, 0.55, gTop, top - 0.5, 0, 0.08, { left: false });
    fr.box(batch, stone, L - 0.55, L, gTop, top - 0.5, 0, 0.08, { right: false });
  }

  // ---------------- cornice & parapet ----------------
  if (spec.cornice) cornice(ctx, fr, L, top, stone, spec.corniceScale ?? 1, spec.corniceEnds ?? false);
  const ph = spec.parapet ?? 0;
  if (ph > 0) {
    fr.box(batch, stone, 0, L, top + 0.08, top + 0.08 + ph, -0.35, 0, { back: true, left: false, right: false });
    fr.box(batch, stone, -0.02, L + 0.02, top + 0.08 + ph, top + 0.2 + ph, -0.4, 0.06, { back: true, left: false, right: false });
  }
  return spec;
}

function pediment(ctx, fr, u0, u1, v, mat, triangular) {
  const b = ctx.batch;
  const d0 = 0, d1 = 0.16;
  fr.box(b, mat, u0, u1, v, v + 0.14, d0, d1);
  if (triangular) {
    const h = (u1 - u0) * 0.28;
    const cu = (u0 + u1) / 2;
    b.tri(mat, fr.p(u0, v + 0.14, d1), fr.p(u1, v + 0.14, d1), fr.p(cu, v + 0.14 + h, d1));
    b.quad(mat, fr.p(u0, v + 0.14, d0), fr.p(u0, v + 0.14, d1), fr.p(cu, v + 0.14 + h, d1), fr.p(cu, v + 0.14 + h, d0));
    b.quad(mat, fr.p(cu, v + 0.14 + h, d0), fr.p(cu, v + 0.14 + h, d1), fr.p(u1, v + 0.14, d1), fr.p(u1, v + 0.14, d0));
  } else {
    // segmental: approximate with a raised block
    fr.box(b, mat, u0 + 0.2, u1 - 0.2, v + 0.14, v + 0.4, d0, d1 * 0.8);
  }
}

function groundFloor(ctx, fr, L, base, gTop, spec) {
  const { batch, rng } = ctx;
  const stone = spec.stone;
  const kind = spec.ground || 'shops';
  if (kind === 'shops') {
    const n = Math.max(1, Math.round(L / rng.range(6, 9)));
    const uw = L / n;
    const pier = Math.min(0.75, uw * 0.12);
    const fasciaTop = gTop - 0.45, fasciaBot = gTop - 1.25;
    const glassTop = fasciaBot - 0.05, riser = base + 0.5;
    // band above fascia
    fr.rect(batch, stone, 0, fasciaTop, L, gTop);
    for (let i = 0; i < n; i++) {
      const u0 = i * uw, u1 = (i + 1) * uw;
      const a = u0 + (i === 0 ? pier : pier / 2), b = u1 - (i === n - 1 ? pier : pier / 2);
      // piers
      fr.rect(batch, stone, u0, base, a, fasciaTop);
      fr.rect(batch, stone, b, base, u1, fasciaTop);
      fr.box(batch, stone, u0 + (i === 0 ? 0 : -pier / 2 - 0.05), u0 + (i === 0 ? pier + 0.05 : pier / 2 + 0.05), base, fasciaTop - 0.1, 0, 0.1);
      // fascia board (projects)
      const idx = ctx.rng.int(0, 1000);
      const [fu0, fv0, fu1, fv1] = fasciaUV(idx);
      const d = 0.14;
      batch.quad('fascia', fr.p(a, fasciaBot, d), fr.p(b, fasciaBot, d), fr.p(b, fasciaTop, d), fr.p(a, fasciaTop, d), [fu0, fv0, fu1, fv0, fu1, fv1, fu0, fv1]);
      fr.box(batch, 'paint', a, b, fasciaBot, fasciaTop, 0, d - 0.001, { front: false });
      fr.box(batch, 'paint', a - 0.05, b + 0.05, fasciaTop, fasciaTop + 0.12, 0, d + 0.06);
      // stall riser
      batch.setColor(0.35, 0.33, 0.3);
      fr.rect(batch, 'granite', a, base, b, riser, -0.05);
      batch.resetColor();
      // shop window: recessed glass with dark frame
      const holes = [{ u0: a, u1: b, v0: riser, v1: glassTop }];
      windowOpening(ctx, fr, a, b, riser, glassTop, { ...spec, reveal: 0.18 }, { glassMat: 'shopGlass', frame: 'none', litP: 0.8 });
      // transom strip between glass and fascia
      fr.rect(batch, 'paint', a, glassTop, b, fasciaBot, -0.05);
      // mullion(s)
      const mulls = Math.max(1, Math.round((b - a) / 2.2)) - 1;
      for (let m = 1; m <= mulls; m++) {
        const um = a + ((b - a) * m) / (mulls + 1);
        fr.box(batch, 'ironDark', um - 0.04, um + 0.04, riser, glassTop, -0.18, -0.1);
      }
      // front face under riser line gets the riser rect above, around shop window
      void holes;
    }
  } else if (kind === 'arcade') {
    const n = Math.max(1, Math.round(L / (spec.arcadeW || 4.2)));
    const uw = L / n;
    const pier = uw * 0.28;
    const gs = spec.groundStone || stone;
    const aspec = { ...spec, stone: gs };
    for (let i = 0; i < n; i++) {
      const u0 = i * uw, u1 = (i + 1) * uw;
      fr.rect(batch, gs, u0, base, u0 + pier / 2, gTop);
      fr.rect(batch, gs, u1 - pier / 2, base, u1, gTop);
      archOpening(ctx, fr, u0 + pier / 2, u1 - pier / 2, base, gTop - 0.2, aspec, spec.arcadeFill || 'shopGlass', { frame: true });
      fr.rect(batch, gs, u0 + pier / 2, gTop - 0.2, u1 - pier / 2, gTop);
    }
    fr.box(batch, 'stoneRustic', 0, L, base, base + 0.6, 0, 0.08);
  } else if (kind === 'windows') {
    const nb = Math.max(1, Math.floor((L - 1.6) / spec.bayW));
    const sp = (L - 1.6) / nb;
    const ww = Math.min(spec.winW * 1.1, sp - 0.6);
    const holes = [];
    for (let k = 0; k < nb; k++) {
      const c = 0.8 + sp * (k + 0.5);
      holes.push({ u0: c - ww / 2, u1: c + ww / 2, v0: base + 1.1, v1: gTop - 0.9 });
    }
    wallWithOpenings(ctx, fr, L, base, gTop, holes, spec.groundStone || 'stoneRustic');
    for (const h of holes) windowOpening(ctx, fr, h.u0, h.u1, h.v0, h.v1, { ...spec, stone: spec.groundStone || 'stoneRustic' });
  } else if (kind === 'lobby') {
    // modern glazed ground floor
    fr.rect(batch, 'panel', 0, gTop - 0.8, L, gTop);
    const holes = [{ u0: 0.4, u1: L - 0.4, v0: base + 0.1, v1: gTop - 0.8 }];
    wallWithOpenings(ctx, fr, L, base, gTop - 0.8, holes, 'panel');
    windowOpening(ctx, fr, 0.4, L - 0.4, base + 0.1, gTop - 0.8, { ...spec, stone: 'panel', reveal: 0.4 }, { glassMat: 'shopGlass', frame: 'none', litP: 0.9 });
    for (let u = 2.4; u < L - 1; u += 2.4) fr.box(batch, 'ironGrey', u - 0.04, u + 0.04, base, gTop - 0.8, -0.4, -0.3);
  } else if (kind === 'blank') {
    fr.rect(batch, spec.groundStone || stone, 0, base, L, gTop);
  }
}

function curtainFacade(ctx, fr, L, spec) {
  const { batch, rng } = ctx;
  const base = spec.base;
  const gTop = base + spec.groundH;
  groundFloor(ctx, fr, L, base, gTop, { ...spec, ground: 'lobby' });
  const top = spec.top;
  const tint = spec.glassTint || [1, 1, 1];
  for (let f = 0; f < spec.nUpper; f++) {
    const fy = gTop + f * spec.floorH;
    fr.rect(batch, 'panel', 0, fy, L, fy + 0.9);
    // glass band recessed slightly
    const c = glassColor(rng, 0.3);
    batch.setColor(c[0] * tint[0], c[1] * tint[1], c[2] * tint[2]);
    fr.rect(batch, 'curtainGlass', 0, fy + 0.9, L, fy + spec.floorH, -0.08);
    batch.resetColor();
    fr.box(batch, 'panel', 0, L, fy + 0.84, fy + 0.9, -0.08, 0, { left: false, right: false });
  }
  // mullions spanning all upper floors
  const step = spec.mullion || 1.5;
  for (let u = 0; u <= L + 1e-3; u += step) {
    const uu = Math.min(u, L);
    fr.box(batch, 'ironGrey', uu - 0.05, uu + 0.05, gTop, top, -0.08, 0.1, { bottom: false });
  }
  const ph = spec.parapet ?? 1;
  fr.box(batch, 'panel', 0, L, top, top + ph, -0.3, 0.1, { back: true, left: false, right: false });
  return spec;
}

function stripFacade(ctx, fr, L, spec) {
  const { batch, rng } = ctx;
  const base = spec.base;
  const gTop = base + spec.groundH;
  groundFloor(ctx, fr, L, base, gTop, { ...spec, ground: rng.chance(0.5) ? 'lobby' : 'shops', stone: spec.stone });
  const mat = spec.stone;
  for (let f = 0; f < spec.nUpper; f++) {
    const fy = gTop + f * spec.floorH;
    const v0 = fy + 1.0, v1 = fy + spec.floorH - 0.4;
    fr.rect(batch, mat, 0, fy, L, v0);
    fr.rect(batch, mat, 0, v1, L, fy + spec.floorH);
    fr.rect(batch, mat, 0, v0, 0.6, v1);
    fr.rect(batch, mat, L - 0.6, v0, L, v1);
    windowOpening(ctx, fr, 0.6, L - 0.6, v0, v1, { ...spec, reveal: 0.35 }, { frame: 'none' });
    for (let u = 0.6 + 1.8; u < L - 0.8; u += 1.8) fr.box(batch, 'frameDark', u - 0.04, u + 0.04, v0, v1, -0.35, -0.28);
    fr.box(batch, mat, 0, L, fy + 0.85, fy + 1.0, 0, 0.3);
  }
  const top = spec.top;
  fr.box(batch, mat, 0, L, top, top + (spec.parapet ?? 0.9), -0.3, 0.2, { back: true, left: false, right: false });
  return spec;
}

// ---------------------------------------------------------------------------
// Plain walls
// ---------------------------------------------------------------------------

/** Back / side wall with a scatter of simple windows (cheap). */
export function plainWall(ctx, fr, L, y0, y1, mat, { windows = true, floorH = 3.6, firstFloor = 4.5, bay = 3.2 } = {}) {
  const { batch, rng } = ctx;
  if (!windows || L < 3) { fr.rect(batch, mat, 0, y0, L, y1); return; }
  const rows = [];
  for (let y = y0 + firstFloor; y + floorH <= y1 + 0.2; y += floorH) rows.push(y);
  const nb = Math.max(1, Math.floor(L / bay));
  const sp = L / nb;
  fr.rect(batch, mat, 0, y0, L, y1);
  for (const y of rows) {
    for (let k = 0; k < nb; k++) {
      if (rng.chance(0.25)) continue;
      const c = sp * (k + 0.5);
      const w = 0.9, h = floorH * 0.5;
      const g = glassColor(rng, 0.25);
      batch.setColor(g[0], g[1], g[2]);
      fr.rect(batch, 'glass', c - w / 2, y + 0.9, c + w / 2, y + 0.9 + h, 0.02);
      batch.resetColor();
    }
  }
}

// ---------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------

/**
 * Roof on an axis-aligned rectangle. ridgeAxis 'x' or 'z'.
 * type: 'pitched' | 'hipped' | 'mansard' | 'flat'
 */
export function rectRoof(ctx, r, y0, { type = 'pitched', ridgeAxis = 'x', slope = 40, maxRise = 4.5, inset = 0.4, dormers = null, chimneys = true, mat = 'slate', stone = 'stoneBlond', flatMat = 'lead' } = {}) {
  const { batch } = ctx;
  const x0 = r.x0 + inset, x1 = r.x1 - inset, z0 = r.z0 + inset, z1 = r.z1 - inset;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  if (type === 'flat') {
    batch.setColor(0.55, 0.55, 0.55);
    batch.quad('concrete', V(r.x0, y0, r.z1), V(r.x1, y0, r.z1), V(r.x1, y0, r.z0), V(r.x0, y0, r.z0));
    batch.resetColor();
    return { ridgeY: y0 };
  }
  const tan = Math.tan((slope * Math.PI) / 180);
  const sl = type === 'mansard' ? Math.tan((68 * Math.PI) / 180) : tan;
  // depth across the ridge
  const across = ridgeAxis === 'x' ? z1 - z0 : x1 - x0;
  const along = ridgeAxis === 'x' ? x1 - x0 : z1 - z0;
  let rise = Math.min((across / 2) * sl, maxRise);
  const run = rise / sl;
  const yT = y0 + rise;
  const hip = type === 'hipped' || type === 'mansard';
  const hipRun = hip ? Math.min(run, along / 2 - 0.01) : 0;
  // top rectangle
  let tx0, tx1, tz0, tz1;
  if (ridgeAxis === 'x') { tx0 = x0 + hipRun; tx1 = x1 - hipRun; tz0 = z0 + run; tz1 = z1 - run; }
  else { tx0 = x0 + run; tx1 = x1 - run; tz0 = z0 + hipRun; tz1 = z1 - hipRun; }
  if (tz1 < tz0) { const m = (tz0 + tz1) / 2; tz0 = tz1 = m; }
  if (tx1 < tx0) { const m = (tx0 + tx1) / 2; tx0 = tx1 = m; }
  // slopes (CCW seen from outside)
  const S = V(x0, y0, z1), SE = V(x1, y0, z1), NE = V(x1, y0, z0), NW = V(x0, y0, z0);
  const tS = V(tx0, yT, tz1), tSE = V(tx1, yT, tz1), tNE = V(tx1, yT, tz0), tNW = V(tx0, yT, tz0);
  const endsHip = hip;
  if (ridgeAxis === 'x') {
    batch.quad(mat, S, SE, tSE, tS); // south slope
    batch.quad(mat, NE, NW, tNW, tNE); // north slope
    if (endsHip) {
      batch.quad(mat, SE, NE, tNE, tSE);
      batch.quad(mat, NW, S, tS, tNW);
    }
  } else {
    batch.quad(mat, SE, NE, tNE, tSE); // east slope
    batch.quad(mat, NW, S, tS, tNW); // west slope
    if (endsHip) {
      batch.quad(mat, S, SE, tSE, tS);
      batch.quad(mat, NE, NW, tNW, tNE);
    }
  }
  // flat top
  if (tx1 - tx0 > 0.05 && tz1 - tz0 > 0.05) {
    batch.setColor(0.8, 0.8, 0.8);
    batch.quad(flatMat, tS, tSE, tNE, tNW);
    batch.resetColor();
  }
  // stone gable ends for pitched roofs
  if (!endsHip) {
    if (ridgeAxis === 'x') {
      batch.quad(stone, V(x1 + inset, y0 - 0.2, z1 + inset), V(x1 + inset, y0 - 0.2, z0 - inset), V(x1 + inset, yT, tz0), V(x1 + inset, yT, tz1));
      batch.quad(stone, V(x0 - inset, y0 - 0.2, z0 - inset), V(x0 - inset, y0 - 0.2, z1 + inset), V(x0 - inset, yT, tz1), V(x0 - inset, yT, tz0));
    } else {
      batch.quad(stone, V(x0 - inset, y0 - 0.2, z1 + inset), V(x1 + inset, y0 - 0.2, z1 + inset), V(tx1, yT, z1 + inset), V(tx0, yT, z1 + inset));
      batch.quad(stone, V(x1 + inset, y0 - 0.2, z0 - inset), V(x0 - inset, y0 - 0.2, z0 - inset), V(tx0, yT, z0 - inset), V(tx1, yT, z0 - inset));
    }
  }
  // roof-level flat under inset (gutter strip behind parapet)
  batch.setColor(0.5, 0.5, 0.5);
  batch.quad('lead', V(r.x0, y0 - 0.05, r.z1), V(r.x1, y0 - 0.05, r.z1), V(r.x1, y0 - 0.05, r.z0), V(r.x0, y0 - 0.05, r.z0));
  batch.resetColor();

  if (chimneys) {
    const cy = yT;
    const place = (x, z, sx, sz) => chimney(ctx, x, z, sx, sz, y0, cy + 1.6, stone);
    if (ridgeAxis === 'x') {
      place(r.x0 + 0.5, (z0 + z1) / 2, 0.9, Math.min(3.2, across * 0.4));
      place(r.x1 - 0.5, (z0 + z1) / 2, 0.9, Math.min(3.2, across * 0.4));
    } else {
      place((x0 + x1) / 2, r.z0 + 0.5, Math.min(3.2, across * 0.4), 0.9);
      place((x0 + x1) / 2, r.z1 - 0.5, Math.min(3.2, across * 0.4), 0.9);
    }
  }
  if (dormers) {
    for (const d of dormers) dormer(ctx, d, y0, sl, rise, mat, stone, r, inset);
  }
  return { ridgeY: yT, rise, run };
}

export function chimney(ctx, x, z, sx, sz, y0, y1, stone) {
  const { batch, inst } = ctx;
  batch.box(stone, x, (y0 + y1) / 2, z, sx, y1 - y0, sz);
  batch.box(stone, x, y1 + 0.1, z, sx + 0.2, 0.2, sz + 0.2);
  // pots
  const long = sz > sx ? 'z' : 'x';
  const n = Math.max(2, Math.floor((long === 'z' ? sz : sx) / 0.45));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const px = long === 'x' ? x + t * sx : x, pz = long === 'z' ? z + t * sz : z;
    const m = new THREE.Matrix4().makeTranslation(px, y1 + 0.2, pz);
    const s = 0.8 + ctx.rng.float() * 0.5;
    m.scale(new THREE.Vector3(1, s, 1));
    inst.add('chimneyPot', m);
  }
}

/** Dormer window on a roof slope. d: {frame (facade Frame), u, w} */
function dormer(ctx, d, y0, sl, rise, mat, stone, r, inset) {
  const { batch } = ctx;
  const fr = d.frame;
  const w = d.w || 1.5, h = Math.min(2.0, rise * 0.8);
  const dd = -(inset + 0.35); // front face just behind eaves (depth along n negative = inward)
  const depth = h / sl + 0.3;
  const u0 = d.u - w / 2, u1 = d.u + w / 2;
  const vb = y0 + 0.05, vt = vb + h;
  // cheeks and front
  const front = [{ u0: u0 + 0.25, u1: u1 - 0.25, v0: vb + 0.35, v1: vt - 0.2 }];
  // front wall around window
  fr.rect(batch, stone, u0, vb, u1, front[0].v0, dd);
  fr.rect(batch, stone, u0, front[0].v1, u1, vt, dd);
  fr.rect(batch, stone, u0, front[0].v0, front[0].u0, front[0].v1, dd);
  fr.rect(batch, stone, front[0].u1, front[0].v0, u1, front[0].v1, dd);
  // window
  const g = glassColor(ctx.rng, 0.3);
  batch.setColor(g[0], g[1], g[2]);
  fr.rect(batch, 'glass', front[0].u0, front[0].v0, front[0].u1, front[0].v1, dd - 0.12);
  batch.resetColor();
  ctx.inst.add('frameSash', fr.matrix(d.u, front[0].v0, dd - 0.1, front[0].u1 - front[0].u0, front[0].v1 - front[0].v0, 1));
  // reveal
  batch.quad(stone, fr.p(front[0].u0, front[0].v0, dd), fr.p(front[0].u0, front[0].v0, dd - 0.12), fr.p(front[0].u0, front[0].v1, dd - 0.12), fr.p(front[0].u0, front[0].v1, dd));
  batch.quad(stone, fr.p(front[0].u1, front[0].v0, dd - 0.12), fr.p(front[0].u1, front[0].v0, dd), fr.p(front[0].u1, front[0].v1, dd), fr.p(front[0].u1, front[0].v1, dd - 0.12));
  // cheeks (sides) as slate
  batch.quad(mat, fr.p(u0, vb, dd - depth), fr.p(u0, vb, dd), fr.p(u0, vt, dd), fr.p(u0, vt, dd - depth));
  batch.quad(mat, fr.p(u1, vb, dd), fr.p(u1, vb, dd - depth), fr.p(u1, vt, dd - depth), fr.p(u1, vt, dd));
  // little gabled roof
  const ph = w * 0.45;
  const cu = d.u;
  batch.quad(mat, fr.p(u0 - 0.1, vt, dd + 0.1), fr.p(cu, vt + ph, dd + 0.1), fr.p(cu, vt + ph, dd - depth), fr.p(u0 - 0.1, vt, dd - depth));
  batch.quad(mat, fr.p(cu, vt + ph, dd + 0.1), fr.p(u1 + 0.1, vt, dd + 0.1), fr.p(u1 + 0.1, vt, dd - depth), fr.p(cu, vt + ph, dd - depth));
  // pediment face
  batch.tri(stone, fr.p(u0, vt, dd), fr.p(u1, vt, dd), fr.p(cu, vt + ph - 0.05, dd));
  void r;
}

/** Octagonal corner turret with ogee dome, common on Glasgow corner blocks. */
export function cornerTurret(ctx, x, z, y0, y1, radius, stone, domeMat = 'lead') {
  const { batch } = ctx;
  batch.cylinder(stone, x, y0, z, radius, y1 - y0, 8, radius, false);
  // windows as dark bands around the turret on each floor (simple)
  for (let y = y0 + 1.2; y < y1 - 2; y += 3.8) {
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      const ri = radius * Math.cos(Math.PI / 8) + 0.02;
      const cx = x + Math.cos(a) * ri, cz = z + Math.sin(a) * ri;
      // outward normal (cos a, sin a) => tangent (sin a, -cos a)
      const fr2 = new Frame(cx, cz, Math.sin(a), -Math.cos(a));
      const g = glassColor(ctx.rng, 0.35);
      batch.setColor(g[0], g[1], g[2]);
      fr2.rect(batch, 'glass', -0.4, y, 0.4, y + 2.0, 0.02);
      batch.resetColor();
    }
  }
  batch.cylinder(stone, x, y1, z, radius + 0.25, 0.5, 8, radius + 0.25, true);
  const r = radius + 0.1;
  batch.lathe(domeMat, x, y1 + 0.5, z, [
    [r, 0], [r * 1.02, 0.8], [r * 0.95, 1.6], [r * 0.7, 2.6], [r * 0.35, 3.4], [r * 0.18, 3.9], [r * 0.25, 4.3], [0.12, 4.6], [0.05, 5.6], [0, 5.7],
  ], 16);
}
