// Hand-authored street network for central Glasgow around Central Station.
//
// Coordinates are metres in a local tangent plane: +x = east, +z = south,
// +y = up. The origin is roughly the middle of Central Station
// (55.8591 N, 4.2581 W). The city-centre grid is close enough to
// north-aligned that streets are treated as axis aligned.
//
// Positions are approximations from maps; running `npm run fetch-osm` with
// network access replaces building footprints with OpenStreetMap data.

export const ORIGIN = { lat: 55.8591, lon: -4.2581 };

// Extent of the detailed model.
export const BOUNDS = { x0: -400, x1: 320, z0: -490, z1: 380 };

// North-south streets: x centre, width (building line to building line), z extent.
export const NS_STREETS = [
  { name: 'West Campbell Street', x: -292, w: 18, z0: -490, z1: 130 },
  { name: 'York Street', x: -292, w: 16, z0: 130, z1: 360 },
  { name: 'Wellington Street', x: -196, w: 18, z0: -490, z1: 130 },
  { name: 'Robertson Street', x: -196, w: 18, z0: 130, z1: 360 },
  { name: 'Hope Street', x: -88, w: 20, z0: -490, z1: 130, bus: true },
  { name: 'Oswald Street', x: -104, w: 18, z0: 130, z1: 360 },
  { name: 'Renfield Street', x: 78, w: 20, z0: -490, z1: -140, bus: true },
  { name: 'Union Street', x: 78, w: 20, z0: -140, z1: 130, bus: true },
  { name: 'Jamaica Street', x: 78, w: 22, z0: 130, z1: 360 },
  { name: 'West Nile Street', x: 172, w: 16, z0: -490, z1: -140 },
  { name: 'Mitchell Street', x: 150, w: 9, z0: -140, z1: 130, oneway: true },
  { name: 'Dixon Street', x: 172, w: 12, z0: 130, z1: 360 },
  { name: 'Buchanan Street', x: 248, w: 24, z0: -490, z1: 130, pedestrian: true },
  { name: 'St Enoch Square', x: 262, w: 40, z0: 130, z1: 250, pedestrian: true },
  { name: 'James Watt Street', x: -350, w: 14, z0: 130, z1: 360 },
];

// East-west streets.
export const EW_STREETS = [
  { name: 'West Regent Street', z: -480, w: 18, x0: -400, x1: 320 },
  { name: 'West George Street', z: -362, w: 22, x0: -400, x1: 320 },
  { name: 'St Vincent Street', z: -252, w: 22, x0: -400, x1: 320 },
  { name: 'Bothwell Street', z: -140, w: 24, x0: -400, x1: -88 },
  { name: 'Gordon Street', z: -140, w: 22, x0: -88, x1: 248 },
  { name: 'Waterloo Street', z: -30, w: 16, x0: -400, x1: -88 },
  { name: 'Argyle Street', z: 130, w: 22, x0: -400, x1: 320, bus: true },
  { name: 'Midland Street', z: 222, w: 10, x0: -104, x1: 78 },
  { name: 'Howard Street', z: 250, w: 14, x0: 78, x1: 320 },
  { name: 'Broomielaw', z: 358, w: 26, x0: -400, x1: 78, quay: true },
  { name: 'Clyde Street', z: 358, w: 26, x0: 78, x1: 320, quay: true },
];

// River Clyde.
export const RIVER = { zNorth: 373, zSouth: 486, water: -13.2, bed: -17, quayTop: -10 };

// Central Station footprint (building lines) and deck level.
export const STATION = { x0: -78, x1: 68, z0: -129, z1: 119, deck: 0 };

// Railway viaduct south of Argyle Street to the Clyde bridge.
export const VIADUCT = {
  z0: 141, z1: RIVER.zNorth,
  // x-extent at the north (Argyle St) and at the river
  north: [-74, 58], south: [-38, 30],
};

export function viaductExtent(z) {
  const t = Math.min(1, Math.max(0, (z - VIADUCT.z0) / (VIADUCT.z1 - VIADUCT.z0)));
  const s = t * t * (3 - 2 * t);
  return [
    VIADUCT.north[0] + (VIADUCT.south[0] - VIADUCT.north[0]) * s,
    VIADUCT.north[1] + (VIADUCT.south[1] - VIADUCT.north[1]) * s,
  ];
}

/**
 * Natural ground height. The city falls from Blythswood Hill in the north
 * down to the Clyde; Gordon Street is at the station deck level (0) and
 * Argyle Street passes about 7 m lower beneath the station's bridge.
 */
export function groundHeight(x, z) {
  let h;
  if (z <= -140) h = Math.min((-140 - z) * 0.028, 12);
  else if (z <= 130) h = (-7 * (z + 140)) / 270;
  else if (z <= RIVER.zNorth) h = -7 - (3 * (z - 130)) / (RIVER.zNorth - 130);
  else if (z < RIVER.zSouth) h = RIVER.bed;
  else h = RIVER.quayTop;
  // Blythswood Hill to the north-west
  const dx = x + 300, dz = z + 470;
  h += 5 * Math.exp(-(dx * dx + dz * dz) / (2 * 170 * 170));
  return h;
}

export const KERB = 0.13; // pavement height above carriageway

// ---------------------------------------------------------------------------
// Rasterised occupancy grid -> city blocks
// ---------------------------------------------------------------------------

export const CELL = { STREET: 1, RESERVED: 2, RIVER: 3, STATION: 4 };

export function streetRects() {
  const rects = [];
  for (const s of NS_STREETS) {
    rects.push({ ...s, kind: 'ns', x0: s.x - s.w / 2, x1: s.x + s.w / 2, zz0: s.z0 - 12, zz1: s.z1 + 12 });
  }
  for (const s of EW_STREETS) {
    rects.push({ ...s, kind: 'ew', xx0: s.x0 - 12, xx1: s.x1 + 12, z0: s.z - s.w / 2, z1: s.z + s.w / 2 });
  }
  return rects;
}

function rasterize() {
  const { x0, x1, z0, z1 } = BOUNDS;
  const W = x1 - x0, H = z1 - z0;
  const grid = new Uint8Array(W * H);
  const fill = (ax0, ax1, az0, az1, v) => {
    const i0 = Math.max(0, Math.floor(ax0 - x0)), i1 = Math.min(W, Math.ceil(ax1 - x0));
    const j0 = Math.max(0, Math.floor(az0 - z0)), j1 = Math.min(H, Math.ceil(az1 - z0));
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) grid[j * W + i] = v;
  };
  for (const s of NS_STREETS) fill(s.x - s.w / 2, s.x + s.w / 2, s.z0 - (s.z0 <= BOUNDS.z0 ? 0 : 11), s.z1 + 11, CELL.STREET);
  for (const s of EW_STREETS) fill(s.x0 - (s.x0 <= BOUNDS.x0 ? 0 : 10), s.x1 + 10, s.z - s.w / 2, s.z + s.w / 2, CELL.STREET);
  // station and viaduct
  fill(STATION.x0, STATION.x1, STATION.z0, STATION.z1, CELL.STATION);
  for (let z = VIADUCT.z0 - 11; z < VIADUCT.z1; z++) {
    const [a, b] = viaductExtent(z);
    fill(a, b, z, z + 1, CELL.RESERVED);
  }
  // re-stamp Midland street over viaduct? it passes underneath: keep reserved.
  fill(BOUNDS.x0, BOUNDS.x1, RIVER.zNorth, BOUNDS.z1, CELL.RIVER);
  return { grid, W, H };
}

/** Decompose free space into rectangular blocks. */
export function computeBlocks() {
  const { grid, W, H } = rasterize();
  const { x0, z0 } = BOUNDS;
  const seen = new Uint8Array(W * H);
  const blocks = [];
  // greedy maximal rectangles over free cells
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (grid[k] !== 0 || seen[k]) continue;
      // extend right
      let i1 = i;
      while (i1 < W && grid[j * W + i1] === 0 && !seen[j * W + i1]) i1++;
      // extend down while full row free
      let j1 = j + 1;
      outer: while (j1 < H) {
        for (let ii = i; ii < i1; ii++) {
          const kk = j1 * W + ii;
          if (grid[kk] !== 0 || seen[kk]) break outer;
        }
        j1++;
      }
      for (let jj = j; jj < j1; jj++) for (let ii = i; ii < i1; ii++) seen[jj * W + ii] = 1;
      const w = i1 - i, h = j1 - j;
      if (w < 6 || h < 6) continue;
      blocks.push({ x0: x0 + i, x1: x0 + i1, z0: z0 + j, z1: z0 + j1 });
    }
  }
  // Which sides face a street (vs. railway / another block)?
  const at = (x, z) => {
    const i = Math.floor(x - x0), j = Math.floor(z - z0);
    if (i < 0 || j < 0 || i >= W || j >= H) return -1;
    return grid[j * W + i];
  };
  for (const b of blocks) {
    const probe = (side) => {
      let street = 0, total = 0;
      const n = 12;
      for (let s = 0; s < n; s++) {
        const t = (s + 0.5) / n;
        let x, z;
        if (side === 'n') { x = b.x0 + (b.x1 - b.x0) * t; z = b.z0 - 2; }
        if (side === 's') { x = b.x0 + (b.x1 - b.x0) * t; z = b.z1 + 2; }
        if (side === 'w') { x = b.x0 - 2; z = b.z0 + (b.z1 - b.z0) * t; }
        if (side === 'e') { x = b.x1 + 2; z = b.z0 + (b.z1 - b.z0) * t; }
        const v = at(x, z);
        total++;
        if (v === CELL.STREET || v === CELL.RIVER || v === -1) street++;
      }
      return street / total > 0.5;
    };
    b.front = { n: probe('n'), s: probe('s'), w: probe('w'), e: probe('e') };
  }
  return { blocks, grid, W, H, at };
}

export function streetAt(x, z) {
  for (const s of NS_STREETS) if (Math.abs(x - s.x) <= s.w / 2 && z >= s.z0 - 11 && z <= s.z1 + 11) return s;
  for (const s of EW_STREETS) if (Math.abs(z - s.z) <= s.w / 2 && x >= s.x0 - 10 && x <= s.x1 + 10) return s;
  return null;
}
