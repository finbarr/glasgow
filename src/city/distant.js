// Low-detail surrounding city beyond the modelled area, so the model sits in
// a continuous townscape rather than an empty plane. Instanced boxes with a
// shader that draws window grids in world space.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { BOUNDS, RIVER, groundHeight } from './layout.js';
import { nightUniform } from '../materials/library.js';

function distantMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.05 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        wp4 = modelMatrix * wp4;
        vWPos = wp4.xyz;
        mat3 nm3 = mat3(modelMatrix);
        #ifdef USE_INSTANCING
          nm3 = nm3 * mat3(instanceMatrix);
        #endif
        vWNrm = normalize(nm3 * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;
        uniform float uNight;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float winMask; float winLit;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        winMask = 0.0; winLit = 0.0;
        if (abs(vWNrm.y) < 0.5) {
          float u = abs(vWNrm.x) > abs(vWNrm.z) ? vWPos.z : vWPos.x;
          vec2 cell = vec2(u / 3.2, (vWPos.y + 20.0) / 3.7);
          vec2 f = fract(cell);
          winMask = step(0.28, f.x) * step(f.x, 0.72) * step(0.3, f.y) * step(f.y, 0.82);
          float r = h21(floor(cell) + floor(vWPos.xz / 40.0));
          winLit = step(0.62, r);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.06, 0.07) + winLit * 0.04, winMask);
          // floor lines
          diffuseColor.rgb *= 1.0 - 0.15 * step(0.95, f.y);
        } else {
          diffuseColor.rgb = vec3(0.16, 0.17, 0.18);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.15, winMask);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.8, 0.55) * winMask * winLit * uNight * 1.2;`);
  };
  m.customProgramCacheKey = () => 'distant-city';
  return m;
}

export function buildDistantCity() {
  const rng = new RNG(99);
  const matrices = [], colours = [];
  const R = 2200;
  const block = 70, street = 16;
  const inner = { x0: BOUNDS.x0 - 10, x1: BOUNDS.x1 + 10, z0: BOUNDS.z0 - 10, z1: RIVER.zNorth };
  const palette = [
    [0.42, 0.22, 0.17], [0.36, 0.2, 0.16], [0.5, 0.43, 0.33], [0.42, 0.37, 0.29], [0.3, 0.28, 0.26],
    [0.46, 0.46, 0.45], [0.27, 0.3, 0.33], [0.34, 0.24, 0.2],
  ];
  for (let gz = -R; gz < R; gz += block + street) {
    for (let gx = -R; gx < R; gx += block + street) {
      const cx = gx + block / 2, cz = gz + block / 2;
      const d = Math.hypot(cx, cz);
      if (d > R) continue;
      // skip the detailed model area
      if (gx + block > inner.x0 && gx < inner.x1 && gz + block > inner.z0 && gz < inner.z1) continue;
      // skip the river corridor
      if (gz + block > RIVER.zNorth - 4 && gz < RIVER.zSouth + 4) continue;
      // parks/open land with some probability far out
      if (rng.chance(0.08 + d / R * 0.15)) continue;
      // split block into 2-6 buildings along the perimeter
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        const w = block / n;
        const along = rng.chance(0.5);
        const bx = along ? gx + i * w + w / 2 : cx, bz = along ? cz : gz + i * w + w / 2;
        const sx = along ? w - 1 : block * rng.range(0.4, 1), sz = along ? block * rng.range(0.4, 1) : w - 1;
        let h = rng.range(10, 22) * (1 - d / R * 0.4);
        if (rng.chance(0.04)) h = rng.range(35, 70);
        const y = groundHeight(bx, bz);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(bx, y + h / 2 - 1, bz), new THREE.Quaternion(), new THREE.Vector3(sx, h + 2, sz));
        matrices.push(m);
        const c = rng.pick(palette);
        const k = rng.range(0.85, 1.1);
        colours.push(new THREE.Color(c[0] * k, c[1] * k, c[2] * k));
      }
    }
  }
  const geom = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geom, distantMaterial(), matrices.length);
  matrices.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, colours[i]); });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  mesh.name = 'distant-city';
  return mesh;
}
