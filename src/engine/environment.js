// Sky, sun and atmosphere for Glasgow (55.86 N, 4.26 W), with real solar
// geometry and weather presets.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const LAT = 55.8609 * Math.PI / 180;
const LON = -4.2514;

/** Solar elevation/azimuth (radians; azimuth clockwise from north). */
export function sunPosition(month, clockHours) {
  const day = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1];
  const bst = month >= 4 && month <= 10 ? 1 : 0;
  const solar = clockHours - bst + LON / 15;
  const decl = -23.44 * Math.PI / 180 * Math.cos((2 * Math.PI / 365) * (day + 10));
  const H = (15 * (solar - 12)) * Math.PI / 180;
  const sinEl = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H);
  const el = Math.asin(sinEl);
  const az = Math.atan2(-Math.cos(decl) * Math.sin(H), Math.sin(decl) * Math.cos(LAT) - Math.cos(decl) * Math.sin(LAT) * Math.cos(H));
  return { el, az: (az + Math.PI * 2) % (Math.PI * 2) };
}

export function sunDirection(el, az) {
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

function gradientSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(0.55, 0.58, 0.63) },
      horizon: { value: new THREE.Color(0.8, 0.82, 0.84) },
      ground: { value: new THREE.Color(0.25, 0.25, 0.26) },
      intensity: { value: 1.0 },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunGlow: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground; uniform float intensity; uniform vec3 sunDir; uniform float sunGlow; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 c = y > 0.0 ? mix(horizon, zenith, pow(y, 0.45)) : mix(horizon, ground, pow(min(-y * 4.0, 1.0), 0.6));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(1.0, 0.8, 0.6) * pow(s, 8.0) * sunGlow;
        gl_FragColor = vec4(c * intensity, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  mesh.scale.setScalar(9000);
  mesh.frustumCulled = false;
  return mesh;
}

export const WEATHER = ['clear', 'hazy', 'overcast', 'night'];

export class Environment {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sky = new Sky();
    this.sky.scale.setScalar(9000);
    this.sky.frustumCulled = false;
    this.sky.material.uniforms.showSunDisc.value = 0.002;
    this.grad = gradientSky();
    scene.add(this.sky, this.grad);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.35;
    const cam = this.sun.shadow.camera;
    cam.near = 1; cam.far = 3000;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a342c, 0.0);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0xb8c4d0, 0.0004);
    this.envRT = null;
    this.state = { month: 6, time: 18.5, weather: 'clear' };
    this.night = 0;
    this.shadowSize = 200;
  }

  set(opts) {
    Object.assign(this.state, opts);
    const { month, time, weather } = this.state;
    const { el, az } = sunPosition(month, time);
    this.el = el; this.az = az;
    const dir = sunDirection(el, az);
    this.sunDir = dir;
    const elDeg = el * 180 / Math.PI;
    const r = this.renderer;
    const U = this.sky.material.uniforms;
    const dayness = THREE.MathUtils.smoothstep(elDeg, -6, 8);
    let night = 1 - THREE.MathUtils.smoothstep(elDeg, -8, 3);
    if (weather === 'night') night = 1;
    this.night = night;

    if (weather === 'clear' || weather === 'hazy') {
      this.sky.visible = true; this.grad.visible = false;
      U.turbidity.value = weather === 'hazy' ? 7 : 2.6;
      U.rayleigh.value = weather === 'hazy' ? 2.2 : 1.4;
      U.mieCoefficient.value = weather === 'hazy' ? 0.012 : 0.004;
      U.mieDirectionalG.value = 0.82;
      U.sunPosition.value.copy(dir);
      const low = 1 - THREE.MathUtils.smoothstep(elDeg, 2, 30);
      const col = new THREE.Color(1, 0.96, 0.9).lerp(new THREE.Color(1, 0.62, 0.36), low * 0.9);
      this.sun.color.copy(col);
      this.sun.intensity = 3.2 * THREE.MathUtils.smoothstep(elDeg, -1, 6) * (weather === 'hazy' ? 0.7 : 1);
      r.toneMappingExposure = THREE.MathUtils.lerp(1.6, 0.62, dayness);
      this.scene.fog.color.setRGB(0.62, 0.68, 0.76).lerp(new THREE.Color(0.85, 0.66, 0.5), low * 0.5).multiplyScalar(THREE.MathUtils.lerp(0.08, 1, dayness));
      this.scene.fog.density = weather === 'hazy' ? 0.0008 : 0.00035;
      this.hemi.intensity = 0.0;
      this.envIntensity = weather === 'hazy' ? 0.5 : 0.38;
      this.sun.castShadow = elDeg > -1;
    } else {
      this.sky.visible = false; this.grad.visible = true;
      const G = this.grad.material.uniforms;
      if (weather === 'overcast') {
        const k = THREE.MathUtils.lerp(0.05, 1, dayness);
        G.zenith.value.setRGB(0.52, 0.55, 0.6).multiplyScalar(k);
        G.horizon.value.setRGB(0.78, 0.8, 0.82).multiplyScalar(k);
        G.ground.value.setRGB(0.22, 0.22, 0.23).multiplyScalar(k);
        G.intensity.value = 1.6;
        G.sunDir.value.copy(dir); G.sunGlow.value = 0.15 * dayness;
        this.sun.intensity = 0.35 * dayness;
        this.sun.color.setRGB(0.95, 0.96, 1.0);
        this.sun.castShadow = true;
        r.toneMappingExposure = THREE.MathUtils.lerp(1.8, 0.95, dayness);
        this.scene.fog.color.setRGB(0.72, 0.74, 0.77).multiplyScalar(k * 1.3);
        this.scene.fog.density = 0.0012;
        this.envIntensity = 1.0;
      } else {
        // night
        G.zenith.value.setRGB(0.004, 0.007, 0.018);
        G.horizon.value.setRGB(0.03, 0.028, 0.03);
        G.ground.value.setRGB(0.01, 0.01, 0.01);
        G.intensity.value = 1;
        G.sunGlow.value = 0;
        this.sun.intensity = 0.06;
        this.sun.color.setRGB(0.6, 0.7, 1.0);
        this.sun.castShadow = false;
        r.toneMappingExposure = 1.6;
        this.scene.fog.color.setRGB(0.03, 0.03, 0.035);
        this.scene.fog.density = 0.0009;
        this.envIntensity = 1.0;
      }
    }
    // moonlight / skylight direction for night
    const lightDir = weather === 'night' || elDeg < -2 ? new THREE.Vector3(0.4, 0.8, 0.3).normalize() : dir;
    this.lightDir = lightDir;
    this.updateEnvMap();
  }

  updateEnvMap() {
    const envScene = new THREE.Scene();
    const skyObj = this.sky.visible ? this.sky : this.grad;
    const clone = skyObj.clone();
    clone.material = skyObj.material;
    envScene.add(clone);
    const disc = this.sky.material.uniforms.showSunDisc.value;
    this.sky.material.uniforms.showSunDisc.value = 0;
    // dark ground so reflections below the horizon are not sky-coloured
    const ground = new THREE.Mesh(new THREE.CircleGeometry(8000, 32), new THREE.MeshBasicMaterial({ color: 0x2a2a2a }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -40;
    const k = this.sky.visible ? THREE.MathUtils.clamp(Math.sin(this.el) * 4 + 0.05, 0.02, 1) : 0.4;
    ground.material.color.multiplyScalar(k);
    envScene.add(ground);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0, 1, 20000);
    this.sky.material.uniforms.showSunDisc.value = disc;
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = this.envIntensity ?? 1;
    ground.geometry.dispose(); ground.material.dispose();
  }

  /** Keep the shadow frustum centred on what the camera is looking at. */
  follow(target, cameraDistance) {
    const size = THREE.MathUtils.clamp(cameraDistance * 1.1, 70, 520);
    const cam = this.sun.shadow.camera;
    if (Math.abs(size - this.shadowSize) > 5) {
      this.shadowSize = size;
      cam.left = -size; cam.right = size; cam.top = size; cam.bottom = -size;
      cam.updateProjectionMatrix();
    }
    // snap to texel grid to avoid shimmering
    const texel = (2 * this.shadowSize) / this.sun.shadow.mapSize.x;
    const t = target.clone();
    t.x = Math.round(t.x / texel) * texel;
    t.z = Math.round(t.z / texel) * texel;
    const dir = this.lightDir || new THREE.Vector3(0, 1, 0);
    this.sun.position.copy(t).addScaledVector(dir, 1200);
    this.sun.target.position.copy(t);
    this.sun.target.updateMatrixWorld();
  }
}
