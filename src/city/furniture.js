// Street furniture and traffic: street lights, signals, trees, vehicles.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { BOUNDS, NS_STREETS, EW_STREETS, RIVER, STATION, groundHeight, KERB } from './layout.js';
import { pavementWidth } from './streets.js';

const e = new THREE.Euler();
function place(x, y, z, rotY, pitch = 0, scale = 1) {
  e.set(pitch, rotY, 0, 'YXZ');
  const m = new THREE.Matrix4().makeRotationFromEuler(e);
  if (scale !== 1) m.scale(new THREE.Vector3(scale, scale, scale));
  m.setPosition(x, y, z);
  return m;
}

function blockedNS(s) {
  const out = [];
  for (const w of EW_STREETS) if (s.x >= w.x0 - 10 && s.x <= w.x1 + 10 && w.z >= s.z0 - 12 && w.z <= s.z1 + 12) out.push([w.z - w.w / 2, w.z + w.w / 2]);
  return out;
}
function blockedEW(s) {
  const out = [];
  for (const n of NS_STREETS) if (s.z >= n.z0 - 12 && s.z <= n.z1 + 12 && n.x >= s.x0 - 10 && n.x <= s.x1 + 10) out.push([n.x - n.w / 2, n.x + n.w / 2]);
  return out;
}
function free(a, b, bl) {
  const segs = []; let p = a;
  for (const [c, d] of [...bl].sort((u, v) => u[0] - v[0])) {
    if (d <= p) continue;
    if (c > p) segs.push([p, Math.min(c, b)]);
    p = Math.max(p, d);
  }
  if (p < b) segs.push([p, b]);
  return segs.filter(([c, d]) => d - c > 8);
}

function streetList() {
  return [
    ...NS_STREETS.map((s) => ({ s, kind: 'ns', c: s.x, a: Math.max(BOUNDS.z0, s.z0 - 11), b: Math.min(RIVER.zNorth - 3, s.z1 + 11), bl: blockedNS(s) })),
    ...EW_STREETS.map((s) => ({ s, kind: 'ew', c: s.z, a: Math.max(BOUNDS.x0, s.x0 - 10), b: Math.min(BOUNDS.x1, s.x1 + 10), bl: blockedEW(s) })),
  ];
}

const nearStation = (x, z) => x > STATION.x0 - 30 && x < STATION.x1 + 30 && z > STATION.z0 - 30 && z < STATION.z1 + 30;

export function placeFurniture(inst) {
  const rng = new RNG(4242);
  for (const { s, kind, c, a, b, bl } of streetList()) {
    if (s.pedestrian) continue;
    const pw = pavementWidth(s);
    const half = s.w / 2 - pw;
    for (const [p, q] of free(a, b, bl)) {
      // street lights, staggered
      const spacing = 30;
      let side = 1;
      for (let t = p + 8; t < q - 4; t += spacing / 2) {
        side = -side;
        const off = half + 0.55;
        let x, z, rot;
        if (kind === 'ns') { x = c + side * off; z = t; rot = -side * Math.PI / 2; }
        else { x = t; z = c + side * off; rot = side > 0 ? Math.PI : 0; }
        // skip under the railway bridge over Argyle Street
        if (kind === 'ew' && s.name === 'Argyle Street' && x > STATION.x0 - 4 && x < STATION.x1 - 2) continue;
        const y = groundHeight(x, z) + KERB;
        if (nearStation(x, z)) {
          inst.add('heritageLamp', place(x, y, z, rot));
          inst.add('heritageGlow', place(x, y, z, rot));
        } else {
          inst.add('lampPole', place(x, y, z, rot));
          inst.add('lampGlow', place(x, y, z, rot));
        }
      }
      // bollards at junction corners
    }
  }

  // traffic signals at junctions of two vehicular streets
  for (const n of NS_STREETS) {
    if (n.pedestrian) continue;
    for (const w of EW_STREETS) {
      if (w.pedestrian) continue;
      if (!(n.x >= w.x0 - 10 && n.x <= w.x1 + 10 && w.z >= n.z0 - 12 && w.z <= n.z1 + 12)) continue;
      if (n.x < BOUNDS.x0 + 5 || n.x > BOUNDS.x1 - 5 || w.z < BOUNDS.z0 + 5) continue;
      const hn = n.w / 2 - pavementWidth(n) + 0.6, hw = w.w / 2 - pavementWidth(w) + 0.6;
      const poles = [
        [n.x + hn, w.z - hw, Math.PI], [n.x - hn, w.z + hw, 0],
        [n.x - hn, w.z - hw, -Math.PI / 2], [n.x + hn, w.z + hw, Math.PI / 2],
      ];
      const phase = rng.chance(0.5);
      poles.forEach(([x, z, rot], i) => {
        const y = groundHeight(x, z) + KERB;
        const m = place(x, y, z, rot);
        inst.add('signalPole', m);
        const green = (i < 2) === phase;
        inst.add(green ? 'signalGreen' : 'signalRed', m);
      });
    }
  }

  // trees: Broomielaw riverside walk, St Enoch Square, Buchanan Street
  const tree = (x, z) => {
    const y = groundHeight(x, z) + KERB;
    const m = place(x, y, z, rng.range(0, Math.PI * 2), 0, rng.range(0.8, 1.2));
    const col = new THREE.Color().setHSL(rng.range(0.2, 0.28), rng.range(0.35, 0.55), rng.range(0.22, 0.32));
    inst.add('treeTrunk', m);
    inst.add('treeCrown', m, col);
  };
  for (let x = BOUNDS.x0 + 10; x < BOUNDS.x1; x += 13) {
    if (Math.abs(x - 78) < 18 || Math.abs(x + 104) < 16 || (x > -45 && x < 35)) continue;
    tree(x, RIVER.zNorth - 3.5);
  }
  for (let z = 140; z < 240; z += 14) { tree(250, z); tree(274, z); }
  for (let z = -470; z < 110; z += 22) { if (Math.abs(((z + 140) % 110)) < 18) continue; tree(241, z); }
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

const CAR_COLOURS = [
  [0xf2f2f0, 20], [0x111214, 15], [0x8a8d91, 14], [0xb8bbbf, 14], [0x1d3557, 8], [0x2c4a7a, 5],
  [0x8c1c1c, 6], [0x5a5f63, 8], [0x2f4f3a, 3], [0xc9b27c, 2], [0xd96c1a, 1], [0x6b1e3b, 2],
];
const LEN = { hatch: 4.1, saloon: 4.8, suv: 4.5, taxi: 4.5, dd: 10.8, sd: 12 };

export function placeVehicles(inst) {
  const rng = new RNG(777);
  const add = (type, x, z, rot, pitch, colour) => {
    const y = groundHeight(x, z);
    const m = place(x, y, z, rot, pitch);
    inst.add(type + '_body', m, new THREE.Color(colour));
    inst.add(type + '_glass', m);
    inst.add(type + '_wheels', m);
  };
  for (const { s, kind, c, a, b, bl } of streetList()) {
    if (s.pedestrian || s.name === 'Midland Street') continue;
    const pw = pavementWidth(s);
    const half = s.w / 2 - pw;
    const lanes = s.oneway ? [[0, 1]] : [[half / 2, 1], [-half / 2, -1]];
    for (const [p, q] of free(a, b, bl)) {
      for (const [off, dir] of lanes) {
        // for NS: dir=+1 means travelling +z (southbound) on the +x side (drive on the left)
        const laneOff = kind === 'ns' ? off : -off;
        const across = c + laneOff;
        // travel direction along axis
        const tdir = kind === 'ns' ? dir : dir;
        // queue from the downstream end
        let t = tdir > 0 ? q - 8 : p + 8;
        const end = tdir > 0 ? p + 3 : q - 3;
        let queued = rng.chance(0.6);
        while (tdir > 0 ? t > end : t < end) {
          const type = s.bus && rng.chance(0.18) ? (rng.chance(0.6) ? 'dd' : 'sd')
            : rng.weighted([['hatch', 5], ['saloon', 3], ['suv', 3], ['taxi', 2]]);
          const len = LEN[type];
          const centre = t - tdir * len / 2;
          if (tdir > 0 ? centre - len / 2 < end : centre + len / 2 > end) break;
          if (queued || rng.chance(0.35)) {
            let x, z, rot, pitch;
            if (kind === 'ns') {
              x = across; z = centre; rot = tdir > 0 ? 0 : Math.PI;
              const dz = groundHeight(x, z + 1) - groundHeight(x, z - 1);
              pitch = -Math.atan2(dz, 2) * tdir;
            } else {
              x = centre; z = across; rot = tdir > 0 ? Math.PI / 2 : -Math.PI / 2;
              pitch = 0;
            }
            // skip under the Hielanman's Umbrella? traffic continues underneath: keep
            const colour = type === 'taxi' ? (rng.chance(0.85) ? 0x0c0c0c : 0x5a1a2a)
              : type === 'dd' || type === 'sd' ? rng.pick([0x5b2a86, 0x5b2a86, 0xb3202a, 0xe9e9e9, 0x1f5fa8])
              : rng.weighted(CAR_COLOURS.map(([col, w]) => [col, w]));
            add(type, x, z, rot, pitch, colour);
            t = centre - tdir * (len / 2 + (queued ? rng.range(1.2, 2.2) : rng.range(3, 20)));
            if (queued && rng.chance(0.12)) queued = false;
          } else {
            t -= tdir * rng.range(8, 30);
            queued = false;
          }
        }
      }
    }
  }
}
