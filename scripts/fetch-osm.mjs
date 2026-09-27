#!/usr/bin/env node
// Download OpenStreetMap buildings and roads around Glasgow Central Station
// from the Overpass API and convert them to the model's local metre grid.
//
//   npm run fetch-osm              # default 700 m radius
//   npm run fetch-osm -- 1200      # custom radius in metres
//   npm run fetch-osm -- --from overpass.json   # convert a saved response
//
// Output: public/data/osm.json (loaded automatically by the app; add ?osm=0
// to the URL to force the hand-authored layout).
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = { lat: 55.8591, lon: -4.2581 };
const args = process.argv.slice(2);
const fromIdx = args.indexOf('--from');
const radius = Number(args.find((a) => /^\d+$/.test(a)) || 700);
const ENDPOINT = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

const R = 6378137;
const k = Math.cos((ORIGIN.lat * Math.PI) / 180);
export function toLocal(lat, lon) {
  const x = ((lon - ORIGIN.lon) * Math.PI / 180) * R * k;
  const z = -((lat - ORIGIN.lat) * Math.PI / 180) * R; // +z = south
  return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
}

function bbox() {
  const dLat = (radius / R) * 180 / Math.PI;
  const dLon = dLat / k;
  return [ORIGIN.lat - dLat, ORIGIN.lon - dLon, ORIGIN.lat + dLat, ORIGIN.lon + dLon];
}

async function download() {
  const [s, w, n, e] = bbox();
  const q = `[out:json][timeout:120];
(
  way["building"](${s},${w},${n},${e});
  relation["building"](${s},${w},${n},${e});
  way["highway"](${s},${w},${n},${e});
);
out body;
>;
out skel qt;`;
  console.log(`Querying Overpass for ${radius} m around Glasgow Central...`);
  const res = await fetch(ENDPOINT, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`Overpass error ${res.status}: ${await res.text()}`);
  return res.json();
}

const ROAD_WIDTH = { primary: 12, secondary: 10, tertiary: 9, residential: 7, unclassified: 7, service: 5, pedestrian: 8, footway: 3, living_street: 6, trunk: 14 };

function parseHeight(v) {
  if (!v) return undefined;
  const m = String(v).match(/([\d.]+)/);
  return m ? Number(m[1]) : undefined;
}

export function convert(data) {
  const nodes = new Map();
  for (const el of data.elements) if (el.type === 'node') nodes.set(el.id, el);
  const ways = new Map();
  for (const el of data.elements) if (el.type === 'way') ways.set(el.id, el);
  const buildings = [], roads = [];
  const ring = (ids) => ids.map((id) => nodes.get(id)).filter(Boolean).map((n) => toLocal(n.lat, n.lon));
  const pushBuilding = (id, pts, t) => {
    if (pts.length > 3 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts = pts.slice(0, -1);
    if (pts.length < 3) return;
    buildings.push({
      id, pts,
      height: parseHeight(t.height), levels: parseHeight(t['building:levels']),
      minHeight: parseHeight(t.min_height), material: t['building:material'], colour: t['building:colour'],
      roof: t['roof:shape'], name: t.name, kind: t.building,
    });
  };
  for (const el of data.elements) {
    const t = el.tags || {};
    if (el.type === 'way' && t.building && t.building !== 'no') pushBuilding(el.id, ring(el.nodes), t);
    if (el.type === 'relation' && t.building) {
      for (const m of el.members || []) {
        if (m.type === 'way' && m.role === 'outer' && ways.has(m.ref)) pushBuilding(`${el.id}-${m.ref}`, ring(ways.get(m.ref).nodes), t);
      }
    }
    if (el.type === 'way' && t.highway && ROAD_WIDTH[t.highway]) {
      roads.push({ id: el.id, name: t.name, type: t.highway, pts: ring(el.nodes), width: parseHeight(t.width) || ROAD_WIDTH[t.highway] * (t.lanes ? Math.max(1, Number(t.lanes) / 2) : 1), pedestrian: ['pedestrian', 'footway'].includes(t.highway) });
    }
  }
  return { origin: ORIGIN, generated: new Date().toISOString(), source: '© OpenStreetMap contributors (ODbL)', buildings, roads };
}

async function main() {
  const raw = fromIdx >= 0 ? JSON.parse(fs.readFileSync(args[fromIdx + 1], 'utf8')) : await download();
  const out = convert(raw);
  const file = path.resolve('public/data/osm.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`Wrote ${out.buildings.length} buildings and ${out.roads.length} roads to ${file}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
