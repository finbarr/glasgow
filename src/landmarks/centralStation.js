// Glasgow Central Station: the Central Hotel with its clock tower on the
// Gordon Street / Hope Street corner, the Gordon Street entrance and canopy,
// the Union Street frontage, the concourse with its curved timber
// information building and departure boards, the ridge-and-furrow train shed,
// the Hielanman's Umbrella over Argyle Street, and the viaduct and bridge
// carrying the tracks over the Clyde.
import * as THREE from 'three';
import { Frame } from '../core/batch.js';
import { RNG } from '../core/rng.js';
import { STATION, RIVER, KERB, groundHeight, viaductExtent } from '../city/layout.js';
import { buildFacade, rectRoof, chimney, archOpening, plainWall } from '../city/facade.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DECK = STATION.deck; // concourse & platform level
const RAIL_TOP = DECK - 0.92;
const BED = DECK - 1.1;
const GUTTER = 14;
const RIDGE = 19.5;
const SHED = { x0: -71, x1: 53, z0: -111, z1: 141 };
const HOTEL_RED = [1.0, 0.94, 0.9];

export const STATION_INFO = {
  shed: SHED, deck: DECK,
  // on the deck inside the station; over Argyle Street only if already above street level
  walkable: (x, z, y = 10) => x > STATION.x0 && x < STATION.x1 && z > STATION.z0 && (z < 119 || (z < SHED.z1 && y > -3)),
};

/** Sub-frame starting at u along an existing frame. */
function subFrame(fr, u) {
  const p = fr.p(u, 0, 0);
  return new Frame(p.x, p.z, fr.tx, fr.tz);
}

/** Split a long facade on sloping ground into stepped segments sharing a roof line. */
function steppedFacade(ctx, fr, u0, u1, segLen, top, specBase, perSeg = () => ({})) {
  const n = Math.max(1, Math.round((u1 - u0) / segLen));
  const L = (u1 - u0) / n;
  for (let i = 0; i < n; i++) {
    const a = u0 + i * L;
    const sf = subFrame(fr, a);
    const pa = fr.p(a, 0, 0), pb = fr.p(a + L, 0, 0), pm = fr.p(a + L / 2, 0, 0);
    const ga = groundHeight(pa.x, pa.z), gb = groundHeight(pb.x, pb.z), gm = groundHeight(pm.x, pm.z);
    const base = Math.min(DECK, gm + KERB);
    const floorH = specBase.floorH || 3.8;
    const minGround = specBase.minGround || 4.4;
    const nUpper = Math.max(0, Math.floor((top - base - minGround) / floorH));
    const groundH = top - base - nUpper * floorH;
    const extra = perSeg(i, n, { base, groundH });
    ctx.batch.setChunkFrom(pm.x, pm.z);
    ctx.batch.setColor(...(specBase.tint || [1, 1, 1]));
    wrapTint(ctx, specBase.tint, () => buildFacade(ctx, sf, L, {
      ...specBase, base, plinth: Math.min(ga, gb) - 0.3, groundH, nUpper, ...extra,
    }));
  }
}

function wrapTint(ctx, tint, fn) {
  const b = ctx.batch;
  const t = tint || [1, 1, 1];
  const orig = b.resetColor;
  b.resetColor = function () { this.color = [t[0], t[1], t[2]]; };
  b.setColor(...t);
  const r = fn();
  b.resetColor = orig;
  b.resetColor();
  return r;
}

export function buildCentralStation(ctx) {
  const rng = new RNG(1879);
  const c = { ...ctx, rng };
  buildHotel(c);
  buildGordonStreetFrontage(c);
  buildUnionStreetFrontage(c);
  buildHopeStreetWall(c);
  buildConcourse(c);
  buildPlatformsAndTracks(c);
  buildShedRoof(c);
  buildArgyleBridge(c);
  buildViaductAndBridge(c);
  buildTrains(c);
}

// ---------------------------------------------------------------------------
// Central Hotel (1883, Rowand Anderson; red sandstone, Queen Anne style)
// ---------------------------------------------------------------------------

function buildHotel(ctx) {
  const { batch } = ctx;
  const stone = 'stoneRed';
  const hotelTop = DECK + 5.4 + 4 * 4.1; // 21.8
  const spec = {
    style: 'rich', stone, tint: HOTEL_RED, groundH: 5.4, floorH: 4.1, nUpper: 4, bayW: 3.4, winW: 1.3,
    ground: 'windows', groundStone: 'stoneRed', parapet: 0.6, corniceScale: 1.3, surrounds: true, pediments: true,
  };
  // Gordon Street wing: x -69..-8, z -129..-111 (tower occupies the corner)
  batch.setChunkFrom(-40, -120);
  const gw = { x0: -69, x1: -8, z0: -129, z1: -111 };
  const frN = new Frame(gw.x1, gw.z0, -1, 0); // facing Gordon St
  wrapTint(ctx, HOTEL_RED, () => buildFacade(ctx, frN, gw.x1 - gw.x0, { ...spec, base: DECK, plinth: -0.5 }));
  // courtyard-side (concourse) elevation
  const frS = new Frame(gw.x0 + 9, gw.z1, 1, 0);
  wrapTint(ctx, HOTEL_RED, () => buildFacade(ctx, frS, gw.x1 - gw.x0 - 9, { ...spec, pediments: false, surrounds: false, ground: 'blank', base: DECK }));
  // Hope Street wing: x -78..-60, z -120..-45
  const hw = { x0: -78, x1: -60, z0: -120, z1: -45 };
  batch.setChunkFrom(-70, -80);
  const frW = new Frame(hw.x0, hw.z0, 0, 1); // facing Hope St (west)
  wrapTint(ctx, HOTEL_RED, () => buildFacade(ctx, frW, hw.z1 - hw.z0, { ...spec, base: DECK, plinth: groundHeight(-80, -45) - 0.3 }));
  const frE = new Frame(hw.x1, hw.z1, 0, -1);
  wrapTint(ctx, HOTEL_RED, () => buildFacade(ctx, frE, hw.z1 - hw.z0 - 9, { ...spec, pediments: false, surrounds: false, ground: 'blank', base: DECK }));
  const frHS = new Frame(hw.x0, hw.z1, 1, 0);
  batch.setColor(...HOTEL_RED);
  plainWall(ctx, frHS, hw.x1 - hw.x0, groundHeight(-78, -45) - 0.3, hotelTop + 0.8, stone, { floorH: 4.1, firstFloor: 7.9 });
  batch.resetColor();

  // steep slate roofs with dormers and tall chimney stacks
  batch.setColor(...HOTEL_RED);
  const dormersN = [], dormersW = [];
  for (let u = 3; u < gw.x1 - gw.x0 - 2; u += 6.8) dormersN.push({ frame: frN, u, w: 1.8 });
  for (let u = 12; u < hw.z1 - hw.z0 - 2; u += 6.8) dormersW.push({ frame: frW, u, w: 1.8 });
  rectRoof(ctx, gw, hotelTop + 0.1, { type: 'mansard', ridgeAxis: 'x', maxRise: 5.5, stone, dormers: dormersN, chimneys: false });
  rectRoof(ctx, hw, hotelTop + 0.1, { type: 'mansard', ridgeAxis: 'z', maxRise: 5.5, stone, dormers: dormersW, chimneys: false });
  for (let x = -60; x < -10; x += 12.5) chimney(ctx, x, -120, 1.2, 3.6, hotelTop + 3, hotelTop + 8.5, stone);
  for (let z = -105; z < -50; z += 13) chimney(ctx, -69, z, 3.6, 1.2, hotelTop + 3, hotelTop + 8.5, stone);
  // projecting pilaster strips marking the bays of the Gordon St and Hope St elevations
  for (const u of [5, 13.6, 22.2, 30.8, 39.4, 48, 56.6]) frN.box(batch, stone, u - 0.45, u + 0.45, DECK + 5.4, hotelTop - 0.6, 0, 0.22);
  for (const u of [9, 18, 27, 36, 45, 54, 63, 72]) frW.box(batch, stone, u - 0.45, u + 0.45, DECK + 5.4, hotelTop - 0.6, 0, 0.22);
  // Dutch gables on Gordon Street
  for (const gx of [-52, -24]) {
    const fr = subFrame(frN, gw.x1 - gx - 4);
    fr.box(batch, stone, 0, 8, hotelTop, hotelTop + 4.2, -0.4, 0.2);
    const tri = (y0, h, w0) => {
      batch.tri(stone, fr.p(4 - w0 / 2, y0, 0.2), fr.p(4 + w0 / 2, y0, 0.2), fr.p(4, y0 + h, 0.2));
    };
    tri(hotelTop + 4.2, 3.2, 8);
    fr.box(batch, stone, 3.6, 4.4, hotelTop + 7.2, hotelTop + 8.4, -0.2, 0.25);
    // gable window
    batch.setColor(0.5, 0.45, 0.4);
    fr.rect(batch, 'glass', 2.6, hotelTop + 0.8, 5.4, hotelTop + 3.6, 0.21);
    batch.setColor(...HOTEL_RED);
  }
  batch.resetColor();

  // hotel entrance porch on Gordon Street
  const pe = subFrame(frN, 26);
  batch.setColor(...HOTEL_RED);
  pe.box(batch, stone, 0, 9, DECK, DECK + 0.4, 0, 2.6);
  for (const u of [0.4, 8.6]) pe.box(batch, stone, u - 0.35, u + 0.35, DECK + 0.4, DECK + 5.0, 1.9, 2.6);
  pe.box(batch, stone, -0.2, 9.2, DECK + 5.0, DECK + 5.9, 0, 2.8);
  batch.resetColor();
  batch.quad('hotelSign', pe.p(1.2, DECK + 5.1, 2.81), pe.p(7.8, DECK + 5.1, 2.81), pe.p(7.8, DECK + 5.8, 2.81), pe.p(1.2, DECK + 5.8, 2.81), [0, 0, 1, 0, 1, 1, 0, 1]);

  buildClockTower(ctx, hotelTop);
}

function buildClockTower(ctx, hotelTop) {
  const { batch } = ctx;
  const stone = 'stoneRed';
  const x0 = -79, x1 = -69, z0 = -130, z1 = -120; // 10 x 10, proud of the building lines
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  batch.setChunkFrom(cx, cz);
  const shaftTop = 36;
  const base = groundHeight(x0, z1) - 0.3;
  batch.setColor(...HOTEL_RED);
  const faces = [
    new Frame(x0, z1, 1, 0), // south
    new Frame(x1, z1, 0, -1), // east
    new Frame(x1, z0, -1, 0), // north
    new Frame(x0, z0, 0, 1), // west
  ];
  for (const fr of faces) {
    // shaft with a vertical line of windows
    const W = 10;
    const holes = [];
    for (let y = DECK + 6.6; y < 25; y += 4.1) holes.push({ u0: 3.9, u1: 6.1, v0: y, v1: y + 2.3 });
    let yPrev = base;
    for (const h of holes) {
      fr.rect(batch, stone, 0, yPrev, W, h.v0);
      fr.rect(batch, stone, 0, h.v0, h.u0, h.v1);
      fr.rect(batch, stone, h.u1, h.v0, W, h.v1);
      windowWrap(ctx, fr, h);
      yPrev = h.v1;
    }
    fr.rect(batch, stone, 0, yPrev, W, shaftTop);
    // quoins / corner pilasters
    fr.box(batch, stone, -0.3, 0.9, base, shaftTop, 0, 0.3);
    fr.box(batch, stone, W - 0.9, W + 0.3, base, shaftTop, 0, 0.3);
    // string courses
    for (const y of [DECK + 5.4, hotelTop - 0.3, 26.2, 31.8]) fr.box(batch, stone, -0.35, W + 0.35, y - 0.2, y + 0.25, 0, 0.4);
    // clock face (diameter 3.4) in a stone surround
    fr.box(batch, stone, 2.9, 7.1, 26.8, 31.2, 0, 0.25);
    const r = 1.7, cyc = 29.0, seg = 24;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [5 + Math.cos(a0) * r, cyc + Math.sin(a0) * r], p1 = [5 + Math.cos(a1) * r, cyc + Math.sin(a1) * r];
      batch.raw('clockFace',
        [...fr.p(5, cyc, 0.27).toArray(), ...fr.p(p0[0], p0[1], 0.27).toArray(), ...fr.p(p1[0], p1[1], 0.27).toArray()],
        [fr.nx, 0, fr.nz, fr.nx, 0, fr.nz, fr.nx, 0, fr.nz],
        [0.5, 0.5, 0.5 + Math.cos(a0) * 0.47, 0.5 + Math.sin(a0) * 0.47, 0.5 + Math.cos(a1) * 0.47, 0.5 + Math.sin(a1) * 0.47],
        [0, 1, 2]);
    }
    // belfry stage with arched openings
    fr.rect(batch, stone, 0, shaftTop, 1.6, shaftTop + 6.5, -0.6);
    fr.rect(batch, stone, W - 1.6, shaftTop, W, shaftTop + 6.5, -0.6);
    archOpening(ctx, subFrameD(fr, -0.6), 1.6, W - 1.6, shaftTop, shaftTop + 6.5, { stone, reveal: 0.8 }, 'ironDark');
    // balustraded parapet at belfry base
    fr.box(batch, stone, -0.2, W + 0.2, shaftTop - 0.2, shaftTop + 0.3, 0, 0.35);
    for (let u = 0.6; u < W - 0.3; u += 0.7) fr.box(batch, stone, u - 0.12, u + 0.12, shaftTop + 0.3, shaftTop + 1.2, 0.05, 0.25);
    fr.box(batch, stone, -0.2, W + 0.2, shaftTop + 1.2, shaftTop + 1.45, 0, 0.35);
    // belfry cornice
    fr.box(batch, stone, -0.6, W + 0.6, shaftTop + 6.5, shaftTop + 7.2, -0.6, 0.0);
    // corner pinnacles
    for (const u of [0, W]) {
      const p = fr.p(u, 0, 0);
      batch.box(stone, p.x, shaftTop + 2.3, p.z, 0.7, 2.0, 0.7);
      batch.cylinder('lead', p.x, shaftTop + 3.3, p.z, 0.32, 1.6, 8, 0.02, false);
    }
  }
  // lead roof: pyramid rising into an ogee lantern
  const yb = shaftTop + 7.2;
  const hs = 5.4;
  batch.resetColor();
  batch.setColor(0.8, 0.82, 0.84);
  const pts = [[cx - hs, cz + hs], [cx + hs, cz + hs], [cx + hs, cz - hs], [cx - hs, cz - hs]];
  const apex = V(cx, yb + 5.6, cz);
  const top = 2.0;
  const tp = [[cx - top, cz + top], [cx + top, cz + top], [cx + top, cz - top], [cx - top, cz - top]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    batch.quad('lead', V(pts[i][0], yb, pts[i][1]), V(pts[j][0], yb, pts[j][1]), V(tp[j][0], yb + 4.2, tp[j][1]), V(tp[i][0], yb + 4.2, tp[i][1]));
  }
  void apex;
  // lantern
  batch.box('lead', cx, yb + 5.2, cz, 3.6, 2.0, 3.6);
  batch.box('ironDark', cx, yb + 5.2, cz, 3.7, 1.4, 1.2);
  batch.box('ironDark', cx, yb + 5.2, cz, 1.2, 1.4, 3.7);
  batch.lathe('lead', cx, yb + 6.2, cz, [[2.1, 0], [2.0, 0.6], [1.5, 1.4], [0.8, 2.2], [0.35, 3.0], [0.4, 3.4], [0.12, 3.8], [0.06, 5.6], [0, 5.7]], 16);
  batch.resetColor();
}

function subFrameD(fr, d) {
  const p = fr.p(0, 0, d);
  return new Frame(p.x, p.z, fr.tx, fr.tz);
}

function windowWrap(ctx, fr, h) {
  const { batch } = ctx;
  const d = -0.35;
  const s = 'stoneRed';
  batch.quad(s, fr.p(h.u0, h.v0, 0), fr.p(h.u0, h.v0, d), fr.p(h.u0, h.v1, d), fr.p(h.u0, h.v1, 0));
  batch.quad(s, fr.p(h.u1, h.v0, d), fr.p(h.u1, h.v0, 0), fr.p(h.u1, h.v1, 0), fr.p(h.u1, h.v1, d));
  batch.quad(s, fr.p(h.u0, h.v1, 0), fr.p(h.u0, h.v1, d), fr.p(h.u1, h.v1, d), fr.p(h.u1, h.v1, 0));
  batch.quad(s, fr.p(h.u0, h.v0, d), fr.p(h.u0, h.v0, 0), fr.p(h.u1, h.v0, 0), fr.p(h.u1, h.v0, d));
  batch.setColor(0.4, 0.4, 0.45);
  batch.quad('glass', fr.p(h.u0, h.v0, d), fr.p(h.u1, h.v0, d), fr.p(h.u1, h.v1, d), fr.p(h.u0, h.v1, d), [0, 0, 1, 0, 1, 1, 0, 1]);
  batch.setColor(...HOTEL_RED);
  ctx.inst.add('frameCasement', fr.matrix((h.u0 + h.u1) / 2, h.v0, d + 0.02, h.u1 - h.u0, h.v1 - h.v0, 1));
}

// ---------------------------------------------------------------------------
// Gordon Street entrance, canopy and station offices
// ---------------------------------------------------------------------------

function buildGordonStreetFrontage(ctx) {
  const { batch } = ctx;
  const stone = 'stoneRed';
  const top = 21.8;
  // entrance block x -8..22
  batch.setChunkFrom(7, -120);
  const frE = new Frame(22, -129, -1, 0);
  // upper floors via facade generator with a blank ground floor, then carve a grand arch
  wrapTint(ctx, HOTEL_RED, () => buildFacade(ctx, frE, 30, {
    style: 'rich', stone, tint: HOTEL_RED, base: DECK, groundH: 9.4, floorH: 4.1, nUpper: 3, bayW: 3.2, ground: 'none', parapet: 0.9, corniceScale: 1.2,
  }));
  batch.setColor(...HOTEL_RED);
  // ground: three arched openings into the concourse
  const arches = [[1.5, 8.5], [11, 19], [21.5, 28.5]];
  let u = 0;
  for (const [a, b] of arches) {
    frE.rect(batch, stone, u, DECK, a, DECK + 9.4);
    archOpening(ctx, frE, a, b, DECK, DECK + 9.0, { stone, reveal: 1.2 }, 'glazingGlass', { headroom: 0.2 });
    frE.rect(batch, stone, a, DECK + 9.0, b, DECK + 9.4);
    u = b;
  }
  frE.rect(batch, stone, u, DECK, 30, DECK + 9.4);
  // pilasters
  for (const p of [0, 9.75, 20.25, 30]) frE.box(batch, stone, p - 0.5, p + 0.5, DECK, DECK + 9.4, 0, 0.35);
  batch.resetColor();
  // roof
  batch.setColor(...HOTEL_RED);
  rectRoof(ctx, { x0: -8, x1: 22, z0: -129, z1: -113 }, top + 0.1, { type: 'mansard', ridgeAxis: 'x', maxRise: 4.5, stone, chimneys: false });
  batch.resetColor();

  // Canopy (porte-cochère) over the pavement with CENTRAL STATION lettering
  const cz0 = -135.4, cz1 = -129, cx0 = -10, cx1 = 26, cy = DECK + 5.6;
  batch.setChunkFrom(8, -132);
  // columns at the kerb
  for (let x = cx0 + 1; x <= cx1 - 0.9; x += 6.8) {
    batch.cylinder('ironDark', x, groundHeight(x, cz0 + 0.5) + KERB, cz0 + 0.5, 0.16, cy - DECK - KERB, 10);
    batch.cylinder('ironDark', x, groundHeight(x, cz0 + 0.5) + KERB, cz0 + 0.5, 0.3, 0.8, 10);
    batch.box('ironDark', x, cy - 0.35, cz0 + 0.5, 0.5, 0.4, 0.5);
  }
  // deep fascia with lettering
  batch.box('ironDark', (cx0 + cx1) / 2, cy + 0.55, cz0, cx1 - cx0, 1.3, 0.25);
  batch.quad('stationSign', V(cx1 - 4, cy + 0.05, cz0 - 0.13), V(cx0 + 4, cy + 0.05, cz0 - 0.13), V(cx0 + 4, cy + 1.05, cz0 - 0.13), V(cx1 - 4, cy + 1.05, cz0 - 0.13), [0, 0, 1, 0, 1, 1, 0, 1]);
  for (const x of [cx0, cx1]) batch.box('ironDark', x, cy + 0.55, (cz0 + cz1) / 2, 0.25, 1.3, cz1 - cz0);
  // glazed pitched canopy roof
  for (let x = cx0; x < cx1 - 0.1; x += 4.5) {
    const xa = x, xb = Math.min(cx1, x + 4.5), xm = (xa + xb) / 2;
    for (const [m, alpha] of [['glazingGlass', 0], ['glazingBars', 0]]) {
      batch.quad(m, V(xa, cy + 1.2, cz1), V(xm, cy + 2.2, cz1), V(xm, cy + 2.2, cz0), V(xa, cy + 1.2, cz0));
      batch.quad(m, V(xm, cy + 2.2, cz1), V(xb, cy + 1.2, cz1), V(xb, cy + 1.2, cz0), V(xm, cy + 2.2, cz0));
      void alpha;
    }
    batch.beam('ironDark', V(xa, cy + 1.2, cz0), V(xa, cy + 1.2, cz1), 0.12, 0.2);
  }

  // Station offices x 22..68 (corner with Union St)
  batch.setChunkFrom(45, -120);
  const offices = { x0: 22, x1: 68, z0: -129, z1: -111 };
  const frON = new Frame(68, -129, -1, 0);
  const specO = { style: 'rich', stone, tint: HOTEL_RED, base: DECK, groundH: 5.4, floorH: 4.1, nUpper: 4, ground: 'shops', bayW: 3.2, parapet: 0.9, corniceScale: 1.2 };
  wrapTint(ctx, HOTEL_RED, () => buildFacade(ctx, frON, 46, specO));
  const frOE = new Frame(68, -111, 0, -1);
  wrapTint(ctx, HOTEL_RED, () => buildFacade(ctx, frOE, 18, specO));
  const frOS = new Frame(22, -111, 1, 0);
  batch.setColor(...HOTEL_RED);
  plainWall(ctx, frOS, 32, DECK, top + 1, stone, { floorH: 4.1, firstFloor: 5.4 });
  rectRoof(ctx, offices, top + 0.1, { type: 'mansard', ridgeAxis: 'x', maxRise: 4.5, stone, chimneys: true });
  batch.resetColor();
}

// ---------------------------------------------------------------------------
// Union Street frontage (x = 68) with its entrance arch
// ---------------------------------------------------------------------------

function buildUnionStreetFrontage(ctx) {
  const { batch } = ctx;
  const stone = 'stoneRed';
  const top = 17.5;
  const fr = new Frame(68, 119, 0, -1); // faces east; u runs north from Argyle St
  const L = 119 - -111;
  steppedFacade(ctx, fr, 0, L, 23, top, {
    style: 'victorian', stone, tint: [0.95, 0.9, 0.88], floorH: 3.8, bayW: 3.0, ground: 'shops', parapet: 0.8, corniceScale: 1.1, strings: true,
  }, (i, n) => (i === n - 2 ? { ground: 'arcade', arcadeW: 11, arcadeFill: 'ironDark' } : {}));
  // inner (west) wall facing the platforms
  const frW = new Frame(54, -111, 0, 1);
  batch.setChunkFrom(54, 0);
  batch.setColor(0.9, 0.86, 0.84);
  plainWall(ctx, frW, L, BED, top + 0.8, stone, { floorH: 3.8, firstFloor: 5 });
  // south end at Argyle St
  const frS = new Frame(54, 119, 1, 0);
  plainWall(ctx, frS, 14, groundHeight(60, 119) - 0.3, top + 0.8, stone, { floorH: 3.8, firstFloor: 7 });
  rectRoof(ctx, { x0: 54, x1: 68, z0: -111, z1: 119 }, top + 0.1, { type: 'pitched', ridgeAxis: 'z', stone, chimneys: false, maxRise: 3.5 });
  for (let z = -95; z < 110; z += 23) chimney(ctx, 61, z, 3, 0.9, top + 2, top + 5.5, stone);
  batch.resetColor();
}

// ---------------------------------------------------------------------------
// Hope Street side: arcaded screen wall stepping down towards Argyle Street
// ---------------------------------------------------------------------------

function buildHopeStreetWall(ctx) {
  const { batch } = ctx;
  const stone = 'stoneRed';
  const top = 9.5;
  const fr = new Frame(-78, -45, 0, 1); // faces west, u runs south
  steppedFacade(ctx, fr, 0, 164, 16.4, top, {
    style: 'victorian', stone, tint: [0.92, 0.86, 0.84], floorH: 4.0, minGround: 6, ground: 'arcade', arcadeW: 5.4, arcadeFill: 'shopGlass', parapet: 1.1, corniceScale: 1.0, strings: true, bayW: 2.8,
  });
  // inner face towards platforms
  batch.setChunkFrom(-72, 40);
  batch.setColor(0.9, 0.85, 0.82);
  const frI = new Frame(-71, 119, 0, -1);
  plainWall(ctx, frI, 164, BED, top + 1.2, stone, { windows: false });
  // wall top
  batch.quad(stone, V(-78, top + 1.2, 119), V(-71, top + 1.2, 119), V(-71, top + 1.2, -45), V(-78, top + 1.2, -45));
  batch.resetColor();
}

// ---------------------------------------------------------------------------
// Concourse
// ---------------------------------------------------------------------------

function buildConcourse(ctx) {
  const { batch, inst } = ctx;
  batch.setChunkFrom(0, -80);
  // floor
  batch.quad('terrazzo', V(-60, DECK + 0.01, -46), V(54, DECK + 0.01, -46), V(54, DECK + 0.01, -111), V(-60, DECK + 0.01, -111));
  batch.quad('terrazzo', V(-8, DECK + 0.01, -111), V(22, DECK + 0.01, -111), V(22, DECK + 0.01, -113), V(-8, DECK + 0.01, -113));

  // Curved timber information building (the "Central Station boards" building)
  const cx = -2, cz = -99, R = 15;
  const a0 = Math.PI * 0.2, a1 = Math.PI * 0.8, seg = 14;
  const H1 = 3.9, H2 = 7.8;
  const chordZ = cz + Math.sin(a0) * R;
  for (let i = 0; i < seg; i++) {
    const t0 = a0 + ((a1 - a0) * i) / seg, t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
    const p0 = [cx + Math.cos(t0) * R, cz + Math.sin(t0) * R];
    const p1 = [cx + Math.cos(t1) * R, cz + Math.sin(t1) * R];
    // outward facing (away from centre = +z roughly): points ordered p1 -> p0 gives normal outward
    const fr = new Frame(p1[0], p1[1], p0[0] - p1[0], p0[1] - p1[1]);
    const L = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]);
    batch.setColor(1, 1, 1);
    // stall board, glazing and fascias for two storeys
    fr.rect(batch, 'timber', 0, DECK, L, DECK + 0.9);
    batch.setColor(0.9, 0.8, 0.6);
    fr.rect(batch, 'shopGlass', 0, DECK + 0.9, L, DECK + H1 - 0.7, -0.05);
    batch.setColor(1, 1, 1);
    fr.rect(batch, 'timber', 0, DECK + H1 - 0.7, L, DECK + H1 + 0.3);
    batch.setColor(0.6, 0.55, 0.5);
    fr.rect(batch, 'glass', 0, DECK + H1 + 0.3, L, DECK + H2 - 0.8, -0.05);
    batch.setColor(1, 1, 1);
    fr.rect(batch, 'timber', 0, DECK + H2 - 0.8, L, DECK + H2);
    // mullions
    fr.box(batch, 'timber', -0.08, 0.08, DECK, DECK + H2, -0.05, 0.12);
    // cornice
    fr.box(batch, 'timber', -0.1, L + 0.1, DECK + H2, DECK + H2 + 0.35, 0, 0.35, { left: false, right: false });
    fr.box(batch, 'timber', -0.1, L + 0.1, DECK + H1 - 0.1, DECK + H1 + 0.1, 0, 0.2, { left: false, right: false });
    // roof segment (fan to the middle of the back wall)
    batch.triN('lead', V(p0[0], DECK + H2 + 0.35, p0[1]), V(p1[0], DECK + H2 + 0.35, p1[1]), V(cx, DECK + H2 + 0.35, chordZ), 0, 1, 0);
  }
  // back (north) wall along the chord, facing the Gordon Street entrance
  {
    const xe = cx + Math.cos(a0) * R, xw = cx + Math.cos(a1) * R;
    const fb = new Frame(xe, chordZ, -1, 0);
    const L = xe - xw;
    fb.rect(batch, 'timber', 0, DECK, L, DECK + 0.9);
    for (let u = 0.6; u < L - 3; u += 4.2) {
      batch.setColor(1, 0.86, 0.62);
      fb.rect(batch, 'shopGlass', u, DECK + 0.9, u + 3.4, DECK + 3.2, 0.02);
      batch.setColor(1, 1, 1);
      fb.box(batch, 'timber', u + 3.4, u + 4.2, DECK + 0.9, DECK + 3.2, 0, 0.1);
    }
    fb.rect(batch, 'timber', 0, DECK + 0.9, 0.6, DECK + 3.2);
    fb.rect(batch, 'timber', 0, DECK + 3.2, L, DECK + H2 + 0.35);
    for (let u = 1; u < L - 1; u += 2.4) {
      batch.setColor(0.55, 0.5, 0.45);
      fb.rect(batch, 'glass', u, DECK + 4.4, u + 1.4, DECK + 6.8, 0.02);
      batch.setColor(1, 1, 1);
    }
    fb.box(batch, 'timber', -0.1, L + 0.1, DECK + H2, DECK + H2 + 0.35, 0, 0.35);
  }
  // clock on top of the building
  batch.box('timber', cx, DECK + H2 + 1.2, cz + R - 0.4, 2.2, 2.0, 0.6);
  batch.raw('clockFace', ...discArrays(V(cx, DECK + H2 + 1.25, cz + R - 0.09), 0.8, [0, 0, 1]));

  // Departure boards hung above the concourse, facing the entrance (north)
  const bx = -3, bz = -58, bw = 26, bh = 4.4, by = 7.4;
  batch.box('ironDark', bx, by + bh / 2, bz + 0.25, bw + 0.6, bh + 0.5, 0.45);
  batch.quad('departures', V(bx + bw / 2, by, bz - 0.01), V(bx - bw / 2, by, bz - 0.01), V(bx - bw / 2, by + bh, bz - 0.01), V(bx + bw / 2, by + bh, bz - 0.01), [0, 0, 1, 0, 1, 1, 0, 1]);
  for (const x of [bx - bw / 2 + 1, bx, bx + bw / 2 - 1]) batch.beam('steel', V(x, by + bh + 0.2, bz + 0.25), V(x, 12.2, bz + 0.25), 0.05);
  // hanging clock
  batch.beam('ironDark', V(bx, 6.3, bz - 5 - 0.02), V(bx, 6.3, bz - 5 + 0.35), 1.45, 1.45);
  batch.raw('clockFace', ...discArrays(V(bx, 6.3, bz - 5 - 0.01), 0.68, [0, 0, -1]));
  batch.raw('clockFace', ...discArrays(V(bx, 6.3, bz - 5 + 0.36), 0.68, [0, 0, 1]));
  batch.beam('steel', V(bx, 6.65, bz - 5 + 0.17), V(bx, 12.2, bz - 5 + 0.17), 0.04);

  // Gateline across the platform ends
  for (let x = -66; x < 52; x += 1.6) {
    const isGate = Math.floor((x + 66) / 1.6) % 5 !== 0;
    if (isGate) {
      batch.box('ironGrey', x, DECK + 0.5, -47, 0.3, 1.0, 1.4);
      batch.box('glazingGlass', x + 0.8, DECK + 0.65, -47, 0.02, 1.0, 1.0);
    } else {
      batch.box('ironDark', x + 0.8, DECK + 1.1, -47, 1.6, 2.2, 0.08);
    }
  }
  // "The Shell": WWI shell on a plinth
  batch.box('granite', 24, DECK + 0.6, -74, 1.4, 1.2, 1.4);
  batch.lathe('steel', 24, DECK + 1.2, -74, [[0.38, 0], [0.4, 0.2], [0.4, 1.2], [0.33, 1.55], [0.18, 1.8], [0.04, 1.95], [0, 1.96]], 20);
  // benches and kiosks
  for (let i = 0; i < 6; i++) {
    const x = -48 + i * 18;
    batch.box('timber', x, DECK + 0.45, -66, 3, 0.08, 0.5);
    batch.box('ironDark', x, DECK + 0.22, -66, 2.8, 0.44, 0.08);
  }
  // concourse shops along the Union Street inner wall
  const frShops = new Frame(53.9, -111, 0, 1);
  frShops.rect(batch, 'stoneRed', 0, DECK, 64, DECK + 0.6);
  for (let u = 2; u < 60; u += 8) {
    batch.setColor(1, 0.85, 0.6);
    frShops.rect(batch, 'shopGlass', u, DECK + 0.6, u + 6.5, DECK + 3.6, 0.02);
    batch.resetColor();
    const [a, b, cc, d] = [frShops.p(u, DECK + 3.7, 0.3), frShops.p(u + 6.5, DECK + 3.7, 0.3), frShops.p(u + 6.5, DECK + 4.5, 0.3), frShops.p(u, DECK + 4.5, 0.3)];
    const k = (u * 7) % 32;
    const cols = 4, rows = 8, q = k % cols, r = Math.floor(k / cols);
    batch.quad('fascia', a, b, cc, d, [q / cols, 1 - (r + 1) / rows, (q + 1) / cols, 1 - (r + 1) / rows, (q + 1) / cols, 1 - r / rows, q / cols, 1 - r / rows]);
  }
  // concourse lamps
  for (let x = -50; x < 50; x += 20) {
    for (const z of [-100, -72]) {
      inst.add('heritageLamp', new THREE.Matrix4().makeTranslation(x + 10, DECK, z));
      inst.add('heritageGlow', new THREE.Matrix4().makeTranslation(x + 10, DECK, z));
    }
  }
}

/** Disc as raw arrays for batch.raw(): returns [positions, normals, uvs, indices]. */
function discArrays(center, r, n, rot = 0, seg = 24) {
  const N = new THREE.Vector3(...n).normalize();
  const t = Math.abs(N.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), N).normalize();
  const b = new THREE.Vector3().crossVectors(N, t);
  const P = [center.x, center.y, center.z], NN = [N.x, N.y, N.z], U = [0.5, 0.5], I = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2 + rot;
    const p = center.clone().addScaledVector(t, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r);
    P.push(p.x, p.y, p.z); NN.push(N.x, N.y, N.z);
    U.push(0.5 + Math.cos(a - rot) * 0.47, 0.5 + Math.sin(a - rot) * 0.47);
  }
  for (let i = 1; i <= seg; i++) I.push(0, i, i + 1);
  return [P, NN, U, I];
}

// ---------------------------------------------------------------------------
// Platforms and tracks
// ---------------------------------------------------------------------------

export const PLATFORM_LAYOUT = (() => {
  // east -> west: side platform, then 7 island platforms separated by pairs of tracks
  const items = [];
  let x = SHED.x1;
  const side = 6, track = 4.6, island = 7.6;
  items.push({ kind: 'platform', x0: x - side, x1: x }); x -= side;
  items.push({ kind: 'track', c: x - track / 2 }); x -= track;
  for (let i = 0; i < 7; i++) {
    items.push({ kind: 'platform', x0: x - island, x1: x }); x -= island;
    if (i < 6) {
      items.push({ kind: 'track', c: x - track / 2 }); x -= track;
      items.push({ kind: 'track', c: x - track / 2 }); x -= track;
    } else {
      items.push({ kind: 'track', c: x - track / 2 }); x -= track;
    }
  }
  const platforms = items.filter((i) => i.kind === 'platform');
  const tracks = items.filter((i) => i.kind === 'track').map((t) => t.c);
  return { platforms, tracks, westEdge: x };
})();

function trackX(i, z) {
  const xs = PLATFORM_LAYOUT.tracks[i];
  const n = PLATFORM_LAYOUT.tracks.length;
  const lanes = 8;
  const j = Math.round((i * (lanes - 1)) / (n - 1));
  const [a, b] = viaductExtent(RIVER.zNorth);
  const laneX = b - 3 - (j * (b - a - 6)) / (lanes - 1);
  const t = Math.min(1, Math.max(0, (z - 180) / (RIVER.zNorth - 30 - 180)));
  const s = t * t * (3 - 2 * t);
  return xs + (laneX - xs) * s;
}

function buildPlatformsAndTracks(ctx) {
  const { batch, inst } = ctx;
  const { platforms, tracks } = PLATFORM_LAYOUT;
  const zStart = -46;
  // track bed across the whole shed and bridge
  batch.setChunkFrom(0, 40);
  for (let z = zStart; z < 141; z += 20) {
    const z1 = Math.min(141, z + 20);
    batch.quad('ballast', V(SHED.x0, BED, z1), V(SHED.x1, BED, z1), V(SHED.x1, BED, z), V(SHED.x0, BED, z));
  }
  // platforms
  platforms.forEach((p, i) => {
    const z1 = i % 2 === 0 ? 172 : 150;
    batch.setChunkFrom((p.x0 + p.x1) / 2, 40);
    for (let z = zStart; z < z1; z += 25) {
      const zb = Math.min(z1, z + 25);
      batch.quad('paving', V(p.x0 + 0.5, DECK, zb), V(p.x1 - 0.5, DECK, zb), V(p.x1 - 0.5, DECK, z), V(p.x0 + 0.5, DECK, z));
    }
    // copings and edge faces
    for (const [xe, dir] of [[p.x0, -1], [p.x1, 1]]) {
      if (xe >= SHED.x1 - 0.1) continue;
      const xi = xe - dir * 0.5;
      batch.setColor(0.85, 0.85, 0.82);
      batch.quad('concrete', V(Math.min(xe, xi), DECK, z1), V(Math.max(xe, xi), DECK, z1), V(Math.max(xe, xi), DECK, zStart), V(Math.min(xe, xi), DECK, zStart));
      batch.resetColor();
      // yellow safety line
      const xl = xe - dir * 0.75;
      batch.quad('markYellow', V(xl - 0.05, DECK + 0.004, z1), V(xl + 0.05, DECK + 0.004, z1), V(xl + 0.05, DECK + 0.004, zStart), V(xl - 0.05, DECK + 0.004, zStart));
      // vertical face down to track bed (slightly overhung)
      if (dir > 0) batch.quad('concrete', V(xe, BED, z1), V(xe, BED, zStart), V(xe, DECK, zStart), V(xe, DECK, z1));
      else batch.quad('concrete', V(xe, BED, zStart), V(xe, BED, z1), V(xe, DECK, z1), V(xe, DECK, zStart));
    }
    // platform ends
    batch.quad('concrete', V(p.x0, BED, z1), V(p.x1, BED, z1), V(p.x1, DECK, z1), V(p.x0, DECK, z1));
    // platform number signs & furniture
    for (let z = -20; z < z1 - 20; z += 30) {
      const xc = (p.x0 + p.x1) / 2;
      batch.box('ironDark', xc, DECK + 1.5, z, 0.12, 3.0, 0.12);
      batch.box('paint', xc, DECK + 2.9, z, 0.08, 0.5, 1.8);
      batch.box('timber', xc, DECK + 0.45, z + 8, 0.5, 0.06, 2.4);
    }
  });
  // rails and sleepers
  const sleeperEvery = 0.7;
  tracks.forEach((tx, i) => {
    const zEnd = 700;
    let prev = null;
    for (let z = zStart + 2; z < zEnd; z += sleeperEvery) {
      const x = trackX(i, z);
      if (z > RIVER.zSouth + 120) break;
      const m = new THREE.Matrix4();
      const ang = prev ? Math.atan2(x - prev, sleeperEvery) : 0;
      m.makeRotationY(ang);
      m.setPosition(x, BED + 0.08, z);
      inst.add('sleeper', m);
      prev = x;
    }
    // rails as segments
    let zPrev = zStart + 1.5, xPrev = trackX(i, zPrev);
    for (let z = zPrev + 6; z < RIVER.zSouth + 120; z += 6) {
      const x = trackX(i, z);
      batch.setChunkFrom(x, z);
      for (const g of [-0.7175, 0.7175]) {
        batch.beam('rail', V(xPrev + g, RAIL_TOP - 0.08, zPrev), V(x + g, RAIL_TOP - 0.08, z), 0.07, 0.15);
      }
      zPrev = z; xPrev = x;
    }
    // buffer stop
    batch.setChunkFrom(tx, -45);
    batch.box('ironDark', tx, BED + 0.6, zStart + 0.4, 2.2, 1.2, 0.6);
    batch.box('paint', tx, BED + 1.0, zStart + 0.8, 1.9, 0.3, 0.2);
    batch.setColor(0.9, 0.1, 0.1);
    batch.box('paint', tx, BED + 1.4, zStart + 0.75, 0.3, 0.3, 0.1);
    batch.resetColor();
  });
}

// ---------------------------------------------------------------------------
// Ridge-and-furrow roof over concourse, train shed and bridge
// ---------------------------------------------------------------------------

function roofSection(batch, z0, z1, gutter, ridge, southGable) {
  const nR = 10;
  const span = (SHED.x1 - SHED.x0) / nR;
  for (let k = 0; k < nR; k++) {
    const xa = SHED.x0 + k * span, xb = xa + span, xm = (xa + xb) / 2;
    for (let z = z0; z < z1; z += 42) {
      const zb = Math.min(z1, z + 42);
      batch.setChunkFrom(xm, (z + zb) / 2);
      // glazed slopes (west slope faces -x/up, east slope faces +x/up)
      for (const m of ['glazingGlass', 'glazingBars']) {
        batch.quad(m, V(xa + 0.3, gutter + 0.25, zb), V(xm - 0.3, ridge - 0.2, zb), V(xm - 0.3, ridge - 0.2, z), V(xa + 0.3, gutter + 0.25, z));
        batch.quad(m, V(xm + 0.3, ridge - 0.2, zb), V(xb - 0.3, gutter + 0.25, zb), V(xb - 0.3, gutter + 0.25, z), V(xm + 0.3, ridge - 0.2, z));
      }
      batch.box('lead', xm, ridge - 0.05, (z + zb) / 2, 0.9, 0.3, zb - z);
      batch.box('ironGrey', xa, gutter + 0.1, (z + zb) / 2, 0.8, 0.5, zb - z);
      batch.box('ironCream', xm, ridge - 0.5, (z + zb) / 2, 0.25, 0.4, zb - z);
    }
    if (southGable) {
      batch.setChunkFrom(xm, z1);
      for (const m of ['glazingGlass', 'glazingBars']) batch.tri(m, V(xa, gutter, z1), V(xb, gutter, z1), V(xm, ridge, z1));
      batch.beam('ironCream', V(xa, gutter, z1), V(xm, ridge, z1), 0.3, 0.3);
      batch.beam('ironCream', V(xm, ridge, z1), V(xb, gutter, z1), 0.3, 0.3);
      batch.box('ironCream', xm, gutter - 0.6, z1 + 0.05, span, 1.2, 0.08);
    }
  }
  batch.box('ironCream', SHED.x1, gutter + 0.1, (z0 + z1) / 2, 0.8, 0.5, z1 - z0);
  return span;
}

const BRIDGE_TOP = DECK + 9.6;

function buildShedRoof(ctx) {
  const { batch } = ctx;
  const z0 = SHED.z0, z1 = 119;
  const nR = 10;
  const span = roofSection(batch, z0, z1, GUTTER, RIDGE, true);
  // glazed screen between the lower bridge roof and the main shed gutter
  batch.setChunkFrom(0, z1);
  for (const m of ['glazingGlass', 'glazingBars']) {
    batch.quad(m, V(SHED.x0, BRIDGE_TOP + 2.2, z1), V(SHED.x1, BRIDGE_TOP + 2.2, z1), V(SHED.x1, GUTTER, z1), V(SHED.x0, GUTTER, z1));
  }
  batch.box('ironCream', (SHED.x0 + SHED.x1) / 2, GUTTER - 0.2, z1, SHED.x1 - SHED.x0, 0.4, 0.4);
  // lower roof over the Argyle Street bridge
  roofSection(batch, z1, SHED.z1, BRIDGE_TOP, BRIDGE_TOP + 2.4, false);
  // transverse lattice girders
  const girderStep = 8.4;
  void nR;
  for (let z = z0 + girderStep; z < z1 - 1; z += girderStep) {
    batch.setChunkFrom(0, z);
    const top = GUTTER, bot = GUTTER - 1.7;
    batch.box('ironCream', (SHED.x0 + SHED.x1) / 2, top - 0.15, z, SHED.x1 - SHED.x0, 0.3, 0.35);
    batch.box('ironCream', (SHED.x0 + SHED.x1) / 2, bot + 0.12, z, SHED.x1 - SHED.x0, 0.24, 0.35);
    const pitch = span / 4;
    for (let x = SHED.x0; x <= SHED.x1 + 0.01; x += pitch) {
      batch.beam('ironCream', V(x, bot + 0.2, z), V(x, top - 0.3, z), 0.12, 0.2);
      if (x + pitch <= SHED.x1 + 0.01) {
        const up = Math.round((x - SHED.x0) / pitch) % 2 === 0;
        batch.beam('ironCream', V(x, up ? bot + 0.2 : top - 0.3, z), V(x + pitch, up ? top - 0.3 : bot + 0.2, z), 0.1, 0.16);
      }
    }
    // arched ribs rising to each ridge (rafters)
    for (let k = 0; k < nR; k++) {
      const xa = SHED.x0 + k * span, xm = xa + span / 2, xb = xa + span;
      batch.beam('ironCream', V(xa, GUTTER, z), V(xm, RIDGE - 0.4, z), 0.14, 0.3);
      batch.beam('ironCream', V(xm, RIDGE - 0.4, z), V(xb, GUTTER, z), 0.14, 0.3);
      batch.beam('ironCream', V(xa + span * 0.25, GUTTER + (RIDGE - GUTTER) * 0.45, z), V(xm, GUTTER, z), 0.07, 0.1);
      batch.beam('ironCream', V(xb - span * 0.25, GUTTER + (RIDGE - GUTTER) * 0.45, z), V(xm, GUTTER, z), 0.07, 0.1);
    }
  }
  // columns on platforms under every other girder line
  const { platforms } = PLATFORM_LAYOUT;
  let gi = 0;
  for (let z = z0 + girderStep; z < z1 - 1; z += girderStep, gi++) {
    if (gi % 2 === 1) continue;
    const inBridge = z > 118 && z < 142;
    const inConcourse = z < -47;
    const colX = inConcourse ? [-37, -3, 31] : platforms.map((p) => (p.x0 + p.x1) / 2).filter((x) => x < SHED.x1 - 4);
    for (const x of colX) {
      if (inBridge) continue;
      batch.setChunkFrom(x, z);
      batch.cylinder('ironCream', x, DECK, z, 0.26, 0.9, 12);
      batch.cylinder('ironCream', x, DECK + 0.9, z, 0.19, GUTTER - 1.7 - DECK - 1.6, 12, 0.17);
      batch.cylinder('ironCream', x, GUTTER - 3.3, z, 0.2, 0.6, 12, 0.45);
      batch.box('ironCream', x, GUTTER - 2.3, z, 1.0, 1.4, 0.35);
      // decorative brackets
      batch.beam('ironCream', V(x, GUTTER - 3.6, z), V(x - 1.8, GUTTER - 1.7, z), 0.08, 0.12);
      batch.beam('ironCream', V(x, GUTTER - 3.6, z), V(x + 1.8, GUTTER - 1.7, z), 0.08, 0.12);
    }
  }
}

// ---------------------------------------------------------------------------
// The Hielanman's Umbrella: the glazed railway bridge over Argyle Street
// ---------------------------------------------------------------------------

function buildArgyleBridge(ctx) {
  const { batch } = ctx;
  const z0 = 119, z1 = 141, x0 = -76, x1 = 60;
  const soffit = DECK - 1.6;
  const street = groundHeight(0, 130);
  batch.setChunkFrom(-8, 130);
  // deck soffit with transverse beams
  batch.quad('ironDark', V(x0, soffit, z0), V(x1, soffit, z0), V(x1, soffit, z1), V(x0, soffit, z1));
  for (let x = x0 + 2; x < x1; x += 3.2) batch.box('ironDark', x, soffit - 0.35, (z0 + z1) / 2, 0.35, 0.7, z1 - z0);
  // main longitudinal girders along the kerbs and their columns
  for (const z of [z0 + 5.4, z1 - 5.4]) {
    batch.box('ironDark', (x0 + x1) / 2, soffit - 0.55, z, x1 - x0, 1.1, 0.6);
    for (let x = x0 + 6; x < x1 - 3; x += 9.5) {
      const g = groundHeight(x, z) + KERB;
      batch.cylinder('ironDark', x, g, z, 0.2, soffit - 1.1 - g, 10);
      batch.box('ironDark', x, g + 0.3, z, 0.6, 0.6, 0.6);
      batch.box('ironDark', x, soffit - 1.3, z, 0.7, 0.4, 0.7);
    }
  }
  // Glazed end screens facing Hope Street (west) and Jamaica/Union Street (east)
  for (const [xf, dir] of [[x0, -1], [x1, 1]]) {
    // Frame: facing along dir in x
    const fr = dir > 0 ? new Frame(xf, z1, 0, -1) : new Frame(xf, z0, 0, 1);
    const W = z1 - z0;
    // plate girder band at deck level
    fr.box(batch, 'ironDark', -0.3, W + 0.3, soffit - 1.1, DECK + 0.6, -0.4, 0.2);
    // rivet strips
    for (let u = 0.4; u < W; u += 1.1) fr.box(batch, 'ironDark', u - 0.06, u + 0.06, soffit - 1.0, DECK + 0.5, 0.2, 0.26);
    // tiers of glazing in iron frames
    const tiers = [[DECK + 0.6, DECK + 3.2], [DECK + 3.5, DECK + 6.1], [DECK + 6.4, BRIDGE_TOP - 0.5]];
    const bay = W / 8;
    for (const [v0, v1] of tiers) {
      for (let b = 0; b < 8; b++) {
        const u0 = b * bay + 0.18, u1 = (b + 1) * bay - 0.18;
        batch.setColor(0.45, 0.47, 0.5);
        fr.rect(batch, 'glass', u0, v0, u1, v1, -0.15);
        batch.setColor(1, 1, 1);
        ctx.inst.add('frameDark', fr.matrix((u0 + u1) / 2, v0, -0.13, u1 - u0, v1 - v0, 1));
        // mullion
        fr.box(batch, 'ironDark', b * bay - 0.18, b * bay + 0.18, v0 - 0.15, v1 + 0.15, -0.2, 0.1);
      }
      fr.box(batch, 'ironDark', -0.2, W + 0.2, v1, v1 + 0.3, -0.2, 0.14);
      fr.box(batch, 'ironDark', -0.2, W + 0.2, v0 - 0.3, v0, -0.2, 0.14);
    }
    fr.box(batch, 'ironDark', W - 0.18, W + 0.18, DECK + 0.3, BRIDGE_TOP, -0.2, 0.1);
    // deep cornice with cresting
    fr.box(batch, 'ironDark', -0.5, W + 0.5, BRIDGE_TOP - 0.5, BRIDGE_TOP + 0.5, -0.3, 0.35);
    fr.box(batch, 'ironDark', -0.3, W + 0.3, BRIDGE_TOP + 0.5, BRIDGE_TOP + 2.0, -0.3, 0.1);
    for (let u = 0.5; u < W; u += 1.1) fr.box(batch, 'ironDark', u - 0.05, u + 0.05, BRIDGE_TOP + 2.0, BRIDGE_TOP + 2.5, -0.1, 0.0);
  }
  // shopfronts beneath the bridge on both sides of Argyle Street
  const fN = new Frame(x0, z0, 1, 0); // station side, faces south onto Argyle St
  const fS = new Frame(x1, z1, -1, 0); // south abutment faces north
  for (const fr of [fN, fS]) {
    wrapTint(ctx, [0.7, 0.66, 0.62], () => buildFacade(ctx, fr, x1 - x0, {
      style: 'victorian', stone: 'stoneRed', base: street + KERB, plinth: street - 0.3, groundH: soffit - street - KERB - 1.1, nUpper: 0,
      ground: 'shops', cornice: false, parapet: 0, strings: false,
    }));
  }
  // plate girders closing the gap between the shopfronts and the deck
  for (const fr of [fN, fS]) {
    fr.rect(batch, 'ironDark', 0, soffit - 1.25, x1 - x0, DECK + 0.4);
    for (let u = 1.6; u < x1 - x0; u += 3.2) fr.box(batch, 'ironDark', u - 0.08, u + 0.08, soffit - 1.2, DECK + 0.3, 0, 0.06);
  }
  void chimney;
}

// ---------------------------------------------------------------------------
// Viaduct to the river and the Caledonian Railway Bridge
// ---------------------------------------------------------------------------

function buildViaductAndBridge(ctx) {
  const { batch } = ctx;
  const z0 = 141, z1 = RIVER.zNorth;
  const step = 8;
  const openings = [[216, 228], [344, 373]]; // Midland St, Broomielaw
  for (let z = z0; z < z1; z += step) {
    const zb = Math.min(z1, z + step);
    const [a0, b0] = viaductExtent(z), [a1, b1] = viaductExtent(zb);
    batch.setChunkFrom((a0 + b0) / 2, z);
    // ballast deck
    batch.quad('ballast', V(a0, BED, z), V(a1, BED, zb), V(b1, BED, zb), V(b0, BED, z));
    // soffit
    batch.quad('ironDark', V(a0, BED - 1.6, z), V(b0, BED - 1.6, z), V(b1, BED - 1.6, zb), V(a1, BED - 1.6, zb));
    const open = openings.some(([p, q]) => z + step / 2 > p && z + step / 2 < q);
    for (const [xa, xb, side] of [[a0, a1, -1], [b0, b1, 1]]) {
      // parapet
      const fr = side < 0 ? new Frame(xa, z, xb - xa, zb - z) : new Frame(xb, zb, xa - xb, z - zb);
      const L = Math.hypot(xb - xa, zb - z);
      // Frame(o, t): normal = (-tz, tx). For west side t points +z => normal -x (outward) OK.
      const gA = groundHeight(fr.ox, fr.oz), gB = groundHeight(fr.p(L, 0).x, fr.p(L, 0).z);
      const gmin = Math.min(gA, gB) - 0.3;
      batch.setColor(0.8, 0.75, 0.72);
      fr.box(batch, 'stoneRed', 0, L, BED, DECK + 1.2, -0.5, 0.1, { back: true, top: true });
      if (open) {
        // steel plate girder over the street
        fr.box(batch, 'ironDark', 0, L, BED - 1.6, BED, -0.3, 0.15);
      } else {
        // arcaded brick/stone viaduct wall with a blind arch per bay
        const top = BED - 0.4;
        if (top - gmin > 3.5) {
          fr.rect(batch, 'stoneRed', 0, gmin, 1.2, top);
          fr.rect(batch, 'stoneRed', L - 1.2, gmin, L, top);
          archOpening(ctx, fr, 1.2, L - 1.2, gmin, top, { stone: 'stoneRed', reveal: 0.6 }, 'brick', { headroom: 0.4 });
          fr.rect(batch, 'stoneRed', 0, top, L, BED);
        } else {
          fr.rect(batch, 'stoneRed', 0, gmin, L, BED);
        }
      }
      batch.resetColor();
    }
    // columns under the openings
    if (open) {
      for (let x = a0 + 4; x < b0 - 2; x += 8) {
        const g = groundHeight(x, (z + zb) / 2) + KERB;
        batch.cylinder('ironDark', x, g, (z + zb) / 2, 0.3, BED - 1.6 - g, 10);
      }
    }
  }

  // Caledonian Railway Bridge (1905) across the Clyde
  const [a, b] = viaductExtent(RIVER.zNorth);
  const bz0 = RIVER.zNorth, bz1 = RIVER.zSouth;
  const spans = 5;
  batch.setChunkFrom((a + b) / 2, (bz0 + bz1) / 2);
  batch.quad('ballast', V(a, BED, bz1 + 120), V(b, BED, bz1 + 120), V(b, BED, bz0), V(a, BED, bz0));
  batch.quad('ironDark', V(a, BED - 2.2, bz0), V(b, BED - 2.2, bz0), V(b, BED - 2.2, bz1), V(a, BED - 2.2, bz1));
  const spanL = (bz1 - bz0) / spans;
  for (let i = 1; i < spans; i++) {
    const z = bz0 + i * spanL;
    // granite piers with rounded cutwaters
    batch.setColor(0.8, 0.8, 0.8);
    batch.box('granite', (a + b) / 2, (RIVER.bed + BED - 2.2) / 2, z, b - a + 2, BED - 2.2 - RIVER.bed, 4.2);
    batch.cylinder('granite', a - 1, RIVER.bed, z, 2.1, BED - 2.2 - RIVER.bed, 12);
    batch.cylinder('granite', b + 1, RIVER.bed, z, 2.1, BED - 2.2 - RIVER.bed, 12);
    batch.resetColor();
    // old 1878 bridge piers standing alone to the east
    batch.setColor(0.75, 0.73, 0.7);
    batch.box('granite', b + 20, (RIVER.bed + RIVER.water + 7) / 2, z, 14, RIVER.water + 7 - RIVER.bed, 3.6);
    batch.cylinder('granite', b + 13, RIVER.bed, z, 1.8, RIVER.water + 7 - RIVER.bed, 12);
    batch.cylinder('granite', b + 27, RIVER.bed, z, 1.8, RIVER.water + 7 - RIVER.bed, 12);
    batch.resetColor();
  }
  // lattice girder sides
  for (const x of [a, b]) {
    const h0 = BED - 2.2, h1 = DECK + 2.4;
    batch.box('ironGrey', x, h1, (bz0 + bz1) / 2, 0.6, 0.5, bz1 - bz0);
    batch.box('ironGrey', x, h0 + 0.3, (bz0 + bz1) / 2, 0.6, 0.6, bz1 - bz0);
    const pitch = 3.2;
    for (let z = bz0; z < bz1 - 0.1; z += pitch) {
      batch.beam('ironGrey', V(x, h0 + 0.5, z), V(x, h1 - 0.2, z + pitch / 2), 0.16, 0.3);
      batch.beam('ironGrey', V(x, h1 - 0.2, z + pitch / 2), V(x, h0 + 0.5, z + pitch), 0.16, 0.3);
      batch.beam('ironGrey', V(x, h0 + 0.5, z), V(x, h1 - 0.2, z), 0.2, 0.3);
    }
  }
}

// ---------------------------------------------------------------------------
// Trains standing at the platforms
// ---------------------------------------------------------------------------

function buildTrains(ctx) {
  const { batch } = ctx;
  const { tracks } = PLATFORM_LAYOUT;
  const plan = [[1, 4], [3, 3], [4, 6], [7, 4], [8, 3], [11, 6], [13, 3]];
  for (const [ti, cars] of plan) {
    const x = tracks[ti];
    let z = -43.5;
    for (let c = 0; c < cars; c++) {
      const len = 23;
      carriage(batch, x, z, len, c === 0, c === cars - 1);
      z += len + 0.9;
    }
  }
}

function carriage(batch, x, z, len, frontCab, rearCab) {
  batch.setChunkFrom(x, z + len / 2);
  const w = 2.8, y0 = RAIL_TOP + 0.95, y1 = RAIL_TOP + 3.85;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z, z1 = z + len;
  const nose = 2.2;
  const zf0 = frontCab ? z0 + nose : z0, zf1 = rearCab ? z1 - nose : z1;
  // sides with livery texture (u along car)
  batch.quad('train', V(x1, y0, zf1), V(x1, y0, zf0), V(x1, y1 - 0.4, zf0), V(x1, y1 - 0.4, zf1), [1, 0, 0, 0, 0, 1, 1, 1]);
  batch.quad('train', V(x0, y0, zf0), V(x0, y0, zf1), V(x0, y1 - 0.4, zf1), V(x0, y1 - 0.4, zf0), [0, 0, 1, 0, 1, 1, 0, 1]);
  // roof (curved in 3 facets)
  batch.quad('trainGrey', V(x1, y1 - 0.4, zf1), V(x1, y1 - 0.4, zf0), V(x1 - 0.5, y1, zf0), V(x1 - 0.5, y1, zf1));
  batch.quad('trainGrey', V(x0 + 0.5, y1, zf1), V(x1 - 0.5, y1, zf1), V(x1 - 0.5, y1, zf0), V(x0 + 0.5, y1, zf0));
  batch.quad('trainGrey', V(x0, y1 - 0.4, zf0), V(x0, y1 - 0.4, zf1), V(x0 + 0.5, y1, zf1), V(x0 + 0.5, y1, zf0));
  // underframe and bogies
  batch.box('trainGrey', x, y0 - 0.35, (z0 + z1) / 2, w - 0.4, 0.7, len - 1);
  for (const zb of [z0 + 3.5, z1 - 3.5]) batch.box('ironDark', x, RAIL_TOP + 0.45, zb, 2.2, 0.8, 2.8);
  // ends / cabs
  const cab = (zEnd, zIn, sgn) => {
    const zs = zEnd - sgn * 0.35;
    const yb = y0 + 1.3;
    batch.quadN('trainYellow', V(x0, y0, zEnd), V(x1, y0, zEnd), V(x1, yb, zs), V(x0, yb, zs), 0, 0, sgn);
    batch.quadN('carGlass', V(x0 + 0.1, yb, zs), V(x1 - 0.1, yb, zs), V(x1 - 0.3, y1 - 0.35, zIn), V(x0 + 0.3, y1 - 0.35, zIn), 0, 0.4, sgn);
    batch.quadN('trainGrey', V(x0 + 0.3, y1 - 0.35, zIn), V(x1 - 0.3, y1 - 0.35, zIn), V(x1 - 0.5, y1, zIn), V(x0 + 0.5, y1, zIn), 0, 0.5, sgn);
    for (const [xs, sx] of [[x0, -1], [x1, 1]]) {
      batch.quadN('trainGrey', V(xs, y0, zEnd), V(xs, y0, zIn), V(xs, y1 - 0.4, zIn), V(xs, yb, zs), sx, 0, 0);
    }
    batch.quadN('trainYellow', V(x0, y0 - 0.2, zEnd), V(x1, y0 - 0.2, zEnd), V(x1, y0, zEnd), V(x0, y0, zEnd), 0, 0, sgn);
  };
  if (frontCab) cab(z0, zf0, -1);
  else batch.quadN('trainGrey', V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0), 0, 0, -1);
  if (rearCab) cab(z1, zf1, 1);
  else batch.quadN('trainGrey', V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z1), V(x1, y1, z1), 0, 0, 1);
}
