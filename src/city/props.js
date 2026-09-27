// Unit geometries for instanced props: window frames, chimney pots, street
// furniture, trees and vehicles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function clean(g) {
  // mergeGeometries requires consistent attributes
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(k)) out.deleteAttribute(k);
  return out;
}

function merge(list) {
  return mergeGeometries(list.map(clean), false);
}

/** Window frames in unit space: x in [-0.5,0.5], y in [0,1], z >= 0. */
export function frameGeometries() {
  const bar = 0.055, rail = 0.035, d = 0.07;
  const outer = [
    box(bar, 1, d, -0.5 + bar / 2, 0.5, d / 2),
    box(bar, 1, d, 0.5 - bar / 2, 0.5, d / 2),
    box(1, rail * 1.2, d, 0, 1 - rail * 0.6, d / 2),
    box(1, rail * 1.5, d, 0, rail * 0.75, d / 2),
  ];
  const sash = merge([...outer, box(1, rail, d * 1.4, 0, 0.52, d * 0.7)]);
  const casement = merge([...outer, box(1, rail, d, 0, 0.7, d / 2), box(bar * 0.7, 1, d, 0, 0.5, d / 2)]);
  const dark = merge([...outer, box(1, rail, d, 0, 0.72, d / 2), box(bar * 0.6, 1, d, -0.17, 0.5, d / 2), box(bar * 0.6, 1, d, 0.17, 0.5, d / 2)]);
  return { sash, casement, dark };
}

export function chimneyPot() {
  const g = new THREE.CylinderGeometry(0.13, 0.16, 0.7, 8, 1, true);
  g.translate(0, 0.35, 0);
  const rim = new THREE.CylinderGeometry(0.17, 0.17, 0.08, 8);
  rim.translate(0, 0.68, 0);
  return merge([g, rim]);
}

/** Modern Glasgow street light: column with outreach arm; head separate. Local +z = towards road. */
export function lampPost() {
  const col = new THREE.CylinderGeometry(0.07, 0.11, 8, 8);
  col.translate(0, 4, 0);
  const base = new THREE.CylinderGeometry(0.16, 0.18, 0.9, 8);
  base.translate(0, 0.45, 0);
  const arm = box(0.07, 0.07, 1.6, 0, 7.95, 0.75);
  const head = box(0.32, 0.12, 0.75, 0, 7.9, 1.55);
  return { pole: merge([col, base, arm, head]), glow: box(0.26, 0.02, 0.62, 0, 7.83, 1.55) };
}

/** Traditional black lantern standard, used around the station. */
export function heritageLamp() {
  const base = new THREE.CylinderGeometry(0.22, 0.28, 1.0, 10); base.translate(0, 0.5, 0);
  const col = new THREE.CylinderGeometry(0.06, 0.1, 3.6, 10); col.translate(0, 2.8, 0);
  const collar = new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10); collar.translate(0, 4.6, 0);
  const cap = new THREE.ConeGeometry(0.34, 0.35, 8); cap.translate(0, 5.55, 0);
  const frame = new THREE.CylinderGeometry(0.28, 0.2, 0.08, 8); frame.translate(0, 4.75, 0);
  const glow = new THREE.CylinderGeometry(0.26, 0.19, 0.6, 8); glow.translate(0, 5.08, 0);
  return { pole: merge([base, col, collar, cap, frame]), glow };
}

export function trafficSignal() {
  const pole = new THREE.CylinderGeometry(0.06, 0.07, 3.2, 8); pole.translate(0, 1.6, 0);
  const head = box(0.3, 0.9, 0.22, 0, 3.0, 0.14);
  const hood = box(0.34, 0.95, 0.04, 0, 3.0, 0.02);
  const lens = new THREE.CircleGeometry(0.09, 12);
  const lensR = lens.clone(); lensR.translate(0, 3.28, 0.26);
  const lensA = lens.clone(); lensA.translate(0, 3.0, 0.26);
  const lensG = lens.clone(); lensG.translate(0, 2.72, 0.26);
  return { pole: merge([pole, head, hood]), red: lensR, green: lensG, amber: lensA };
}

export function railPost() {
  const g = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6);
  g.translate(0, 0.55 - 0.25, 0);
  return g;
}

export function bollard() {
  const g = new THREE.CylinderGeometry(0.1, 0.12, 0.95, 10);
  g.translate(0, 0.475, 0);
  return g;
}

/** Deciduous street tree: trunk + lumpy crown. */
export function treeGeometries(seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const trunk = new THREE.CylinderGeometry(0.14, 0.22, 4.2, 7);
  trunk.translate(0, 2.1, 0);
  const blobs = [];
  for (let i = 0; i < 7; i++) {
    const r = 1.4 + rnd() * 1.1;
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const f = 0.8 + rnd() * 0.4;
      p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * 0.85, p.getZ(k) * f);
    }
    const a = (i / 7) * Math.PI * 2;
    const rr = i === 0 ? 0 : 1.3;
    g.translate(Math.cos(a) * rr, 5.2 + rnd() * 1.6 + (i === 0 ? 1 : 0), Math.sin(a) * rr);
    g.computeVertexNormals();
    blobs.push(g);
  }
  return { trunk, crown: merge(blobs) };
}

// ---------------------------------------------------------------------------
// Vehicles (length along +z, width along x, origin at ground centre)
// ---------------------------------------------------------------------------

function sideExtrude(points, width, bevel = 0.06, segs = 2) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 6 });
  // shape x -> world z (length), shape y -> y, extrusion -> world x
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

/** Pull the sides in above y0 (tumblehome) so bodies are not slab-sided. */
function taper(g, y0, y1, k) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > y0) {
      const t = Math.min(1, (y - y0) / (y1 - y0));
      p.setX(i, p.getX(i) * (1 - k * t));
    }
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function wheels(len, width, r = 0.32, inset = 0.75) {
  const list = [];
  for (const zz of [len / 2 - inset, -len / 2 + inset]) {
    for (const xx of [-width / 2 + 0.14, width / 2 - 0.14]) {
      const w = new THREE.CylinderGeometry(r, r, 0.24, 16);
      w.rotateZ(Math.PI / 2);
      w.translate(xx, r, zz);
      list.push(w);
    }
  }
  return merge(list);
}

/**
 * body: side profile [z,y] of the painted lower body; glass: profile of the
 * glasshouse; roof: a thin painted cap over the glass.
 */
function carFromProfile(body, glass, len, width, wheelR = 0.32, belt = 0.95, roofY = 1.45) {
  const b = taper(sideExtrude(body, width, 0.12, 3), belt - 0.25, belt + 0.1, 0.04);
  const g = taper(sideExtrude(glass, width - 0.1, 0.05, 2), belt, roofY, 0.16);
  // painted roof panel: top slice of the glass profile
  const roofPts = glass.filter(([, y]) => y > roofY - 0.2);
  let roof = null;
  if (roofPts.length >= 2) {
    const zs = roofPts.map(([z]) => z);
    const za = Math.min(...zs) + 0.12, zb = Math.max(...zs) - 0.12;
    roof = taper(sideExtrude([[za, roofY - 0.06], [zb, roofY - 0.06], [zb - 0.05, roofY + 0.03], [za + 0.05, roofY + 0.03]], width - 0.14, 0.05, 2), 0, 10, 0.0);
    roof.scale(0.84, 1, 1);
  }
  return { body: roof ? merge([b, roof]) : b, glass: g, wheels: wheels(len, width, wheelR) };
}

function roundedBox(w, h, l, r = 0.25) {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, y0 = 0, y1 = h;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: l - 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(l - 0.2) / 2);
  return g;
}

export function vehicleGeometries() {
  const hatch = carFromProfile(
    [[-2.0, 0.28], [2.0, 0.28], [2.05, 0.55], [1.95, 0.85], [1.1, 1.0], [-1.95, 1.02], [-2.05, 0.7]],
    [[1.1, 0.98], [0.35, 1.45], [-1.55, 1.46], [-1.95, 1.0]],
    4.1, 1.78, 0.32, 0.98, 1.46);
  const saloon = carFromProfile(
    [[-2.35, 0.3], [2.35, 0.3], [2.4, 0.55], [2.25, 0.78], [1.3, 0.92], [-1.6, 0.95], [-2.35, 0.9], [-2.4, 0.6]],
    [[1.3, 0.9], [0.45, 1.38], [-0.95, 1.4], [-1.65, 0.93]],
    4.8, 1.82, 0.32, 0.92, 1.4);
  const suv = carFromProfile(
    [[-2.2, 0.38], [2.2, 0.38], [2.25, 0.7], [2.1, 1.02], [1.3, 1.15], [-2.15, 1.18], [-2.25, 0.8]],
    [[1.3, 1.13], [0.6, 1.68], [-1.95, 1.7], [-2.15, 1.16]],
    4.5, 1.9, 0.36, 1.15, 1.7);
  const taxi = carFromProfile(
    [[-2.2, 0.3], [2.2, 0.3], [2.25, 0.6], [2.05, 0.95], [1.3, 1.05], [-2.1, 1.05], [-2.2, 0.75]],
    [[1.3, 1.03], [0.7, 1.72], [-1.95, 1.76], [-2.1, 1.05]],
    4.5, 1.85, 0.33, 1.05, 1.76);
  // double-decker bus
  const L = 10.8, W = 2.55;
  const ddBody = roundedBox(W, 4.05, L, 0.3);
  ddBody.translate(0, 0.32, 0);
  const ddGlass = merge([
    box(W + 0.03, 1.0, L - 1.2, 0, 1.75, -0.35), // lower deck side windows
    box(W - 0.3, 1.25, 0.1, 0, 1.75, L / 2 + 0.02), // windscreen
    box(W + 0.03, 1.0, L - 0.6, 0, 3.35, 0), // upper deck (wraps the front)
    box(W - 0.3, 0.95, 0.1, 0, 3.35, L / 2 + 0.02),
    box(0.9, 1.9, 0.1, W / 2 - 0.55, 1.35, L / 2 - 2.0), // door (near side)
  ]);
  const dd = { body: ddBody, glass: ddGlass, wheels: wheels(L, W, 0.5, 2.1) };
  // single-deck bus
  const L2 = 12;
  const sdBody = roundedBox(W, 2.9, L2, 0.25);
  sdBody.translate(0, 0.3, 0);
  const sdGlass = merge([box(W + 0.03, 1.1, L2 - 1.0, 0, 1.95, -0.2), box(W - 0.3, 1.5, 0.1, 0, 1.8, L2 / 2 + 0.02)]);
  const sd = { body: sdBody, glass: sdGlass, wheels: wheels(L2, W, 0.5, 2.4) };
  return { hatch, saloon, suv, taxi, dd, sd };
}
