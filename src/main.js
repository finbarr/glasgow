import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { createMaterials, applyNight } from './materials/library.js';
import { Environment } from './engine/environment.js';
import { buildWorld } from './world.js';
import { groundHeight, KERB } from './city/layout.js';
import { STATION_INFO, PLATFORM_LAYOUT } from './landmarks/centralStation.js';

const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const loading = $('#loading'), loadMsg = $('#load-msg'), loadBar = $('#load-bar');
const progress = (msg, f) => { loadMsg.textContent = msg; loadBar.style.width = `${Math.round(f * 100)}%`; };

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, params.has('shot') ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.4, 12000);

// Street-level height for walking and for placing viewpoints.
function floorAt(x, z) {
  if (STATION_INFO.walkable(x, z)) return STATION_INFO.deck;
  return groundHeight(x, z) + KERB;
}

// Viewpoints: [camera x, z, height-above-ground or absolute y], [target x, y, z]
const island = PLATFORM_LAYOUT.platforms[3];
const VIEWS = {
  tower: { label: 'Clock tower', pos: [-106, 1.7, -149.5], target: [-76, 22, -127], street: true },
  entrance: { label: 'Gordon St entrance', pos: [14, 1.7, -148.5], target: [2, 7, -126], street: true },
  concourse: { label: 'Concourse', pos: [-30, 1.7, -106], target: [0, 6, -52], street: true },
  platforms: { label: 'Platforms', pos: [island.x1 - 2.2, 1.7, -40], target: [island.x1 - 3, 4, 60], street: true },
  umbrella: { label: "Hielanman's Umbrella", pos: [97, 1.7, 121.6], target: [40, -1, 130], street: true },
  union: { label: 'Union Street', pos: [85, 1.7, -10], target: [66, 9, -70], street: true },
  hope: { label: 'Hope Street', pos: [-95.5, 1.7, 70], target: [-80, 4, -60], street: true },
  roofs: { label: 'Station roof', pos: [-190, 95, -10], target: [-10, 8, 10] },
  clyde: { label: 'River Clyde', pos: [-94, -8.1, 452], target: [-10, -4, 425] },
  aerial: { label: 'Aerial', pos: [330, 300, -480], target: [-10, 0, 20] },
};

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------
let composer, gtao, bloom, smaa;
let quality = params.get('quality') || 'high';
function setupComposer() {
  const w = window.innerWidth, h = window.innerHeight;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, w, h);
  gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 2.0, scale: 1.2 });
  gtao.blendIntensity = 0.9;
  composer.addPass(gtao);
  bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.18, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  smaa = new SMAAPass(w, h);
  composer.addPass(smaa);
  applyQuality();
}
function applyQuality() {
  const hi = quality === 'high';
  gtao.enabled = hi;
  env.sun.shadow.mapSize.set(hi ? 4096 : 2048, hi ? 4096 : 2048);
  if (env.sun.shadow.map) { env.sun.shadow.map.dispose(); env.sun.shadow.map = null; }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxPolarAngle = Math.PI * 0.9;
orbit.minDistance = 1;
orbit.maxDistance = 3000;
orbit.screenSpacePanning = false;

const walk = new PointerLockControls(camera, document.body);
const keys = {};
let mode = 'orbit';
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyF' && !e.repeat) toggleWalk();
  if (e.code === 'KeyH' && !e.repeat) $('#panel').classList.toggle('hidden');
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
function toggleWalk() {
  if (mode === 'orbit') {
    mode = 'walk';
    const p = camera.position;
    p.y = floorAt(p.x, p.z) + 1.7;
    walk.lock();
    $('#mode').textContent = 'Walking — WASD to move, Shift to run, F to exit';
  } else {
    mode = 'orbit';
    walk.unlock();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    orbit.target.copy(camera.position).addScaledVector(dir, 20);
    $('#mode').textContent = '';
  }
}
walk.addEventListener('unlock', () => { if (mode === 'walk') toggleWalk(); });

let flight = null;
function setView(name, instant = false) {
  lastPoolUpdate = -1e9;
  if (name.startsWith('cam:')) {
    const [x, y, z, tx, ty, tz] = name.slice(4).split(',').map(Number);
    camera.position.set(x, y, z); orbit.target.set(tx, ty, tz); orbit.update();
    return;
  }
  const v = VIEWS[name];
  if (!v) return;
  const pos = new THREE.Vector3(...v.pos);
  if (v.street) pos.y = floorAt(pos.x, pos.z) + v.pos[1];
  const tgt = new THREE.Vector3(...v.target);
  if (instant) {
    camera.position.copy(pos); orbit.target.copy(tgt); orbit.update();
  } else {
    flight = { t: 0, p0: camera.position.clone(), t0: orbit.target.clone(), p1: pos, t1: tgt };
  }
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
let env, world, M;
const clock = new THREE.Timer();

async function init() {
  const mats = await createMaterials(renderer, progress);
  M = mats.M;
  env = new Environment(renderer, scene);
  world = await buildWorld(scene, M, progress);
  setupComposer();
  setupLightPool();

  const month = Number(params.get('month') || 6);
  const time = Number(params.get('time') || 17.5);
  const weather = params.get('weather') || 'clear';
  setLighting({ month, time, weather });
  setView(params.get('view') || 'tower', true);
  buildUI({ month, time, weather });
  addEventListener('resize', onResize);
  loading.classList.add('done');
  renderer.setAnimationLoop(frame);

  // API for automation / screenshots
  window.__glasgow = { setView, setLighting, VIEWS, scene, camera, renderer, frames: 0 };
  if (world.usingOSM) $('#credit').textContent = 'Buildings © OpenStreetMap contributors';
}

function setLighting(opts) {
  env.set(opts);
  applyNight(M, env.night);
  bloom.strength = 0.16 + env.night * 0.22;
  bloom.threshold = env.night > 0.5 ? 0.85 : 0.95;
  bloom.radius = 0.35;
  M.glazingGlass.emissiveIntensity = 0.25 * (1 - env.night);
  lastPoolUpdate = -1e9;
}

// Night-time: a small pool of real point lights moved to the lamps nearest the camera.
const POOL = 16;
const pool = [];
let lastPoolUpdate = -1e9;
function setupLightPool() {
  for (let i = 0; i < POOL; i++) {
    const l = new THREE.PointLight(0xffe2c0, 0, 32, 2);
    l.castShadow = false;
    pool.push(l); scene.add(l);
  }
}
function updateLightPool(focus) {
  const n = env.night;
  if (n < 0.05) { if (pool[0].intensity !== 0) pool.forEach((l) => { l.intensity = 0; }); return; }
  const lamps = world.lamps;
  const scored = lamps.map((l) => [l, l.p.distanceToSquared(focus)]).sort((a, b) => a[1] - b[1]).slice(0, POOL);
  scored.forEach(([lamp], i) => {
    const l = pool[i];
    l.position.copy(lamp.p);
    if (lamp.kind === 'flood') { l.intensity = 120 * n; l.distance = 46; l.color.setHex(0xfff1e0); }
    else if (lamp.kind === 'heritage') { l.intensity = 45 * n; l.distance = 24; l.color.setHex(0xffd9a8); }
    else { l.intensity = 70 * n; l.distance = 30; l.color.setHex(0xffe8cc); }
  });
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}

const tmp = new THREE.Vector3();
function frame() {
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.1);
  if (flight) {
    flight.t = Math.min(1, flight.t + dt / 2.2);
    const e = flight.t < 0.5 ? 4 * flight.t ** 3 : 1 - (-2 * flight.t + 2) ** 3 / 2;
    camera.position.lerpVectors(flight.p0, flight.p1, e);
    // lift the path over rooftops when travelling far
    const d = flight.p0.distanceTo(flight.p1);
    camera.position.y += Math.sin(e * Math.PI) * Math.min(120, d * 0.25);
    orbit.target.lerpVectors(flight.t0, flight.t1, e);
    if (flight.t >= 1) flight = null;
  }
  if (mode === 'walk') {
    const speed = (keys.ShiftLeft || keys.ShiftRight ? 9 : 3.2) * dt;
    if (keys.KeyW || keys.ArrowUp) walk.moveForward(speed);
    if (keys.KeyS || keys.ArrowDown) walk.moveForward(-speed);
    if (keys.KeyA || keys.ArrowLeft) walk.moveRight(-speed);
    if (keys.KeyD || keys.ArrowRight) walk.moveRight(speed);
    const p = camera.position;
    p.y += (floorAt(p.x, p.z) + 1.7 - p.y) * Math.min(1, dt * 10);
  } else {
    orbit.update();
    const minY = floorAt(camera.position.x, camera.position.z) + 0.8;
    if (camera.position.y < minY) camera.position.y = minY;
  }
  // shadows follow the view
  const target = mode === 'walk' ? camera.getWorldDirection(tmp).multiplyScalar(40).add(camera.position) : orbit.target;
  env.follow(target, mode === 'walk' ? 60 : camera.position.distanceTo(orbit.target));
  if (window.__glasgow && window.__glasgow.frames - lastPoolUpdate > 20) {
    lastPoolUpdate = window.__glasgow.frames;
    updateLightPool(mode === 'walk' ? camera.position : orbit.target.clone().lerp(camera.position, 0.3));
  }
  // water ripples
  if (M.water.normalMap) M.water.normalMap.offset.x += dt * 0.004;
  composer.render(dt);
  if (window.__glasgow) window.__glasgow.frames++;
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
function buildUI(init) {
  const views = $('#views');
  for (const [k, v] of Object.entries(VIEWS)) {
    const b = document.createElement('button');
    b.textContent = v.label; b.dataset.view = k;
    b.onclick = () => setView(k);
    views.appendChild(b);
  }
  const time = $('#time'), timeLabel = $('#time-label'), month = $('#month'), weather = $('#weather'), q = $('#quality');
  time.value = init.time; month.value = init.month; weather.value = init.weather; q.value = quality;
  const fmt = (t) => `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;
  timeLabel.textContent = fmt(init.time);
  let pending = null;
  const update = () => {
    timeLabel.textContent = fmt(Number(time.value));
    clearTimeout(pending);
    pending = setTimeout(() => setLighting({ time: Number(time.value), month: Number(month.value), weather: weather.value }), 60);
  };
  time.oninput = update; month.onchange = update; weather.onchange = update;
  q.onchange = () => { quality = q.value; applyQuality(); };
  $('#walk').onclick = () => toggleWalk();
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('active', b.dataset.view === (params.get('view') || 'tower')));
  if (params.has('shot')) $('#panel').classList.add('hidden');
}

init().catch((e) => {
  console.error(e);
  loadMsg.textContent = 'Error: ' + e.message;
});
