// Material library. All physically based (MeshStandard / MeshPhysical) so the
// sky-derived environment map and the sun produce consistent lighting.
import * as THREE from 'three';
import * as T from './textures.js';
import * as S from './signs.js';

export const nightUniform = { value: 0 };
export const timeUniform = { value: 0 };

function std(opts, set) {
  const m = new THREE.MeshStandardMaterial(opts);
  if (set) {
    m.map = set.map; m.normalMap = set.normalMap; m.roughnessMap = set.roughnessMap;
  }
  return m;
}

/** Lit-window emissive driven by vertex colour and a global night factor. */
function nightGlow(material, strength = 1, power = 4, glow = [1.0, 0.76, 0.48]) {
  material.emissive.setRGB(0, 0, 0);
  const g = glow.map((v) => v.toFixed(3)).join(', ');
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightUniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        #ifdef USE_COLOR
          vec3 glowCol = pow(vColor.rgb, vec3(${power.toFixed(1)})) * vec3(${g});
          totalEmissiveRadiance += glowCol * uNight * ${strength.toFixed(2)};
        #endif`,
      );
  };
  material.customProgramCacheKey = () => 'nightglow' + strength + power + g;
  return material;
}

export async function createMaterials(renderer, progress = () => {}) {
  T.setMaxAnisotropy(Math.min(16, renderer.capabilities.getMaxAnisotropy()));
  const steps = [];
  const sets = {};
  const step = (name, fn) => steps.push([name, fn]);

  step('red sandstone', () => (sets.red = T.ashlar({ seed: 3, col: [0.6, 0.3, 0.24], soot: 0.22, course: 0.42, sizeM: 5.04, varAmt: 0.07 })));
  step('blond sandstone', () => (sets.blond = T.ashlar({ seed: 7, col: [0.74, 0.65, 0.5], soot: 0.4, course: 0.42, sizeM: 5.04, varAmt: 0.07 })));
  step('rusticated stone', () => (sets.rustic = T.ashlar({ seed: 11, col: [0.66, 0.58, 0.46], soot: 0.4, course: 0.5, sizeM: 4, rustic: true, res: 512 })));
  step('slate', () => (sets.slate = T.slate({})));
  step('asphalt', () => (sets.asphalt = T.asphalt({})));
  step('paving', () => (sets.paving = T.paving({})));
  step('granite paving', () => (sets.granitePave = T.paving({ seed: 14, col: [0.6, 0.58, 0.56], fw: 0.9, fh: 0.45, stagger: true, sizeM: 3.6 })));
  step('granite', () => (sets.granite = T.granite({})));
  step('brick', () => (sets.brick = T.brick({})));
  step('concrete', () => (sets.concrete = T.concrete({})));
  step('ballast', () => (sets.ballast = T.ballast({})));
  step('terrazzo', () => (sets.terrazzo = T.terrazzo({})));
  step('glazing', () => (sets.glazing = T.glazing({})));
  step('timber', () => (sets.timber = T.timber({})));
  step('grime', () => (sets.grime = T.grime({})));
  step('panels', () => (sets.panels = T.panels({})));
  step('water', () => (sets.water = T.waterNormal({})));

  for (let i = 0; i < steps.length; i++) {
    progress(`Generating textures: ${steps[i][0]}`, i / steps.length);
    await new Promise((r) => setTimeout(r, 0));
    steps[i][1]();
  }
  progress('Building materials', 1);

  const M = {};
  M.stoneRed = std({ vertexColors: true }, sets.red);
  M.stoneBlond = std({ vertexColors: true }, sets.blond);
  M.stoneRustic = std({ vertexColors: true }, sets.rustic);
  M.slate = std({ vertexColors: true, roughness: 1 }, sets.slate);
  M.lead = std({ color: 0x6d7275, roughness: 0.55, metalness: 0.6, vertexColors: true, roughnessMap: sets.grime.roughnessMap, map: sets.grime.map });
  M.copper = std({ color: 0x6f9e8a, roughness: 0.6, metalness: 0.2, vertexColors: true, map: sets.grime.map });
  M.brick = std({ vertexColors: true }, sets.brick);
  M.concrete = std({ vertexColors: true }, sets.concrete);
  M.render = std({ color: 0xd8d2c4, vertexColors: true, roughness: 0.95, map: sets.grime.map });
  M.panel = std({ vertexColors: true, metalness: 0.5 }, sets.panels);

  M.glass = nightGlow(std({ color: 0x151b20, roughness: 0.05, metalness: 0.1, vertexColors: true, envMapIntensity: 2.2 }), 1.4, 4);
  M.curtainGlass = nightGlow(std({ color: 0x223840, roughness: 0.04, metalness: 0.5, vertexColors: true, envMapIntensity: 2.0 }), 0.9, 5, [1.0, 0.95, 0.85]);
  M.shopGlass = nightGlow(std({ color: 0x1c2428, roughness: 0.03, metalness: 0.15, vertexColors: true, envMapIntensity: 2.2 }), 2.2, 2, [1.0, 0.92, 0.8]);
  M.frame = std({ color: 0xe9e6de, roughness: 0.55, map: sets.grime.map });
  M.frameDark = std({ color: 0x23282a, roughness: 0.5, metalness: 0.3 });
  M.ironDark = std({ color: 0x1f2826, roughness: 0.45, metalness: 0.5, vertexColors: true, map: sets.grime.map, roughnessMap: sets.grime.roughnessMap });
  M.ironGrey = std({ color: 0x8d9399, roughness: 0.5, metalness: 0.4, vertexColors: true, map: sets.grime.map, roughnessMap: sets.grime.roughnessMap });
  M.ironCream = std({ color: 0xb9b8b0, roughness: 0.5, metalness: 0.2, vertexColors: true, map: sets.grime.map, roughnessMap: sets.grime.roughnessMap });
  M.steel = std({ color: 0xb8bcc0, roughness: 0.3, metalness: 1.0 });
  M.rail = std({ color: 0x9a9690, roughness: 0.3, metalness: 0.95, map: sets.grime.map });
  M.timber = std({ vertexColors: true }, sets.timber);
  M.paint = std({ vertexColors: true, roughness: 0.5, map: sets.grime.map });

  M.asphalt = std({ vertexColors: true }, sets.asphalt);
  M.paving = std({ vertexColors: true }, sets.paving);
  M.granitePave = std({ vertexColors: true }, sets.granitePave);
  M.granite = std({ vertexColors: true }, sets.granite);
  M.markWhite = std({ color: 0xe8e6df, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, map: sets.grime.map });
  M.markYellow = std({ color: 0xe3b420, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, map: sets.grime.map });
  M.busLane = std({ color: 0xb04030, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, map: sets.asphalt.map, normalMap: sets.asphalt.normalMap });
  M.ballast = std({ vertexColors: true }, sets.ballast);
  M.terrazzo = std({ vertexColors: true }, sets.terrazzo);

  M.glazingBars = std({ vertexColors: true, map: sets.glazing.map, alphaTest: 0.9, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 });
  M.glazingGlass = std({ color: 0xe4ebee, transparent: true, opacity: 1, roughness: 0.35, metalness: 0.0, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2, emissive: 0xdfe6ea, emissiveIntensity: 0.25 });
  M.glazingGlass.userData.noShadow = true;
  // glass panes in the glazing texture: use alpha map from glazing so dirt shows
  M.glazingGlass.map = sets.glazing.map;
  M.glazingGlass.transparent = true;
  M.glazingGlass.opacity = 1;

  const water = new THREE.MeshStandardMaterial({ color: 0x1e2b2c, roughness: 0.12, metalness: 0.1, normalMap: sets.water, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.2 });
  water.userData.noShadow = true;
  M.water = water;

  // lettering / graphics
  const stationTex = S.lettering('CENTRAL STATION', { bg: '#0f1d33', fg: '#f1e5c0', border: '#b8a36a' });
  M.stationSign = std({ map: stationTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: stationTex, emissiveIntensity: 0 });
  M.stationSign.userData.nightEmissive = 0.6;
  const hotelTex = S.lettering('GRAND CENTRAL HOTEL', { bg: '#1a1a1a', fg: '#e6d39a', w: 2048, h: 200 });
  M.hotelSign = std({ map: hotelTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: hotelTex, emissiveIntensity: 0 });
  M.hotelSign.userData.nightEmissive = 0.5;
  const board = S.departureBoard();
  M.departures = std({ map: board, emissive: 0xffffff, emissiveMap: board, emissiveIntensity: 0.9, roughness: 0.3 });
  const clock = S.clockFace();
  M.clockFace = std({ map: clock, roughness: 0.4, emissive: 0xffffff, emissiveMap: clock, emissiveIntensity: 0 });
  M.clockFace.userData.nightEmissive = 0.5;
  const atlas = S.fasciaAtlas();
  M.fascia = std({ map: atlas, roughness: 0.45, emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: 0 });
  M.fascia.userData.nightEmissive = 0.35;
  const livery = S.trainLivery();
  M.train = std({ map: livery, roughness: 0.35, metalness: 0.3 });
  M.trainGrey = std({ color: 0x3a3d42, roughness: 0.5, metalness: 0.5 });
  M.trainYellow = std({ color: 0xe8b400, roughness: 0.4 });
  M.lampGlow = std({ color: 0xfff0d8, emissive: 0xffd9a0, emissiveIntensity: 0 });
  M.lampGlow.userData.nightEmissive = 6;
  M.carPaint = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.carGlass = std({ color: 0x0a0d10, roughness: 0.05, metalness: 0.3 });
  M.tyre = std({ color: 0x151515, roughness: 0.9 });
  M.tree = std({ color: 0xffffff, roughness: 0.9 });
  M.bark = std({ color: 0x3b3027, roughness: 0.95 });
  M.ground = std({ color: 0x4d5a3a, roughness: 1 });

  return { M, sets };
}

/** Update emissive intensities for materials that glow at night. */
export function applyNight(M, night) {
  nightUniform.value = night;
  for (const m of Object.values(M)) {
    if (m.userData && m.userData.nightEmissive !== undefined) m.emissiveIntensity = m.userData.nightEmissive * night;
  }
}
