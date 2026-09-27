// Assembles the whole scene: terrain, streets, buildings, the station and props.
import * as THREE from 'three';
import { Batch, InstanceSet } from './core/batch.js';
import { RNG } from './core/rng.js';
import { computeBlocks, STATION } from './city/layout.js';
import { buildTerrain, buildPavement, pavementsFor, buildPedestrianStreets, buildMarkings, buildRiver, buildQuayRailing, buildRoadBridges } from './city/streets.js';
import { buildBlock } from './city/buildings.js';
import { buildDistantCity } from './city/distant.js';
import { placeFurniture, placeVehicles } from './city/furniture.js';
import * as P from './city/props.js';
import { buildCentralStation } from './landmarks/centralStation.js';
import { landmarkOverrides } from './landmarks/neighbours.js';
import { loadOSM, buildOSMBuildings, buildOSMRoads } from './city/osm.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function buildWorld(scene, M, progress) {
  const batch = new Batch({ chunkSize: 160 });
  const inst = new InstanceSet();
  const ctx = { batch, inst, rng: new RNG(1) };

  progress('Laying out streets', 0.05); await tick();
  const osm = await loadOSM();
  const terrain = buildTerrain(M);
  if (osm) terrain.material = M.paving;
  scene.add(terrain);
  const water = buildRiver(batch, M);
  scene.add(water);

  const { blocks } = computeBlocks();

  progress('Paving streets', 0.1); await tick();
  if (osm) {
    buildOSMRoads(batch, osm);
  } else {
    for (const b of blocks) buildPavement(batch, b, pavementsFor(b, b.front));
    buildPedestrianStreets(batch);
    buildMarkings(batch);
  }
  buildPavement(batch, STATION, pavementsFor(STATION));
  buildQuayRailing(batch, inst);
  buildRoadBridges(batch);

  progress('Building Glasgow Central Station', 0.2); await tick();
  buildCentralStation(ctx);

  if (osm) {
    progress(`Building ${osm.buildings.length} OpenStreetMap buildings`, 0.35); await tick();
    buildOSMBuildings(ctx, osm);
  } else {
    const overrides = landmarkOverrides();
    for (let i = 0; i < blocks.length; i++) {
      if (i % 6 === 0) { progress(`Building city blocks (${i}/${blocks.length})`, 0.35 + 0.4 * (i / blocks.length)); await tick(); }
      buildBlock(ctx, blocks[i], i, overrides);
    }
  }

  progress('Street furniture and traffic', 0.8); await tick();
  if (!osm) {
    placeFurniture(inst);
    placeVehicles(inst);
  }

  progress('Merging geometry', 0.85); await tick();
  const city = batch.build(M);
  city.name = 'city';
  scene.add(city);

  // instanced props
  const frames = P.frameGeometries();
  const lamp = P.lampPost();
  const heritage = P.heritageLamp();
  const sig = P.trafficSignal();
  const tree = P.treeGeometries(7);
  const veh = P.vehicleGeometries();
  const potMat = new THREE.MeshStandardMaterial({ color: 0x8e5236, roughness: 0.9 });
  const sigRed = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2010, emissiveIntensity: 2.5 });
  const sigGreen = new THREE.MeshStandardMaterial({ color: 0x002010, emissive: 0x20ff80, emissiveIntensity: 2.5 });
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x6f7478, roughness: 0.5, metalness: 0.6 });
  const sleeperGeom = new THREE.BoxGeometry(2.6, 0.16, 0.26);
  const sleeperMat = M.concrete.clone(); sleeperMat.vertexColors = false; sleeperMat.color.setRGB(0.55, 0.54, 0.52);
  const defs = {
    frameSash: { geometry: frames.sash, material: M.frame },
    frameCasement: { geometry: frames.casement, material: M.frame },
    frameDark: { geometry: frames.dark, material: M.frameDark },
    chimneyPot: { geometry: P.chimneyPot(), material: potMat },
    lampPole: { geometry: lamp.pole, material: lampPoleMat },
    lampGlow: { geometry: lamp.glow, material: M.lampGlow, castShadow: false },
    heritageLamp: { geometry: heritage.pole, material: M.frameDark },
    heritageGlow: { geometry: heritage.glow, material: M.lampGlow, castShadow: false },
    signalPole: { geometry: sig.pole, material: M.frameDark },
    signalRed: { geometry: sig.red, material: sigRed, castShadow: false },
    signalGreen: { geometry: sig.green, material: sigGreen, castShadow: false },
    railPost: { geometry: P.railPost(), material: M.ironDark },
    treeTrunk: { geometry: tree.trunk, material: M.bark },
    treeCrown: { geometry: tree.crown, material: M.tree },
    sleeper: { geometry: sleeperGeom, material: sleeperMat, castShadow: false },
  };
  const bodyMat = M.carPaint;
  for (const [k, v] of Object.entries(veh)) {
    defs[k + '_body'] = { geometry: v.body, material: bodyMat };
    defs[k + '_glass'] = { geometry: v.glass, material: M.carGlass };
    defs[k + '_wheels'] = { geometry: v.wheels, material: M.tyre };
  }
  // light positions for the night-time light pool
  const lamps = [];
  const v = new THREE.Vector3();
  for (const [key, local, kind] of [['lampGlow', [0, 7.7, 1.55], 'street'], ['heritageGlow', [0, 5.0, 0], 'heritage']]) {
    const set = inst.sets.get(key);
    if (!set) continue;
    for (const m of set.m) { v.set(...local).applyMatrix4(m); lamps.push({ p: v.clone(), kind }); }
  }
  for (let x = -55; x <= 50; x += 21) for (let z = -100; z <= 110; z += 26) lamps.push({ p: new THREE.Vector3(x, 11.5, z), kind: 'flood' });
  const props = inst.build(defs);
  props.name = 'props';
  scene.add(props);

  scene.add(buildDistantCity());
  progress('Lighting', 0.95); await tick();
  return { water, city, props, lamps, usingOSM: !!osm };
}
