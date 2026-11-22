// Boot and the one loop: renderer, golden-hour lighting, follow camera, and a fixed 1/60 s simulation.
// ?seed=N fixes the random world; ?shot=cover|combat|harbor|title (start|play|end are aliases) stages
// that scene instead of the loop, renders it twice and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { LANDMARKS, ROADS, STEP } from './config.js';
import { createRandom } from './random.js';
import { glowTexture } from './textures.js';
import { buildCity } from './city.js';
import { createVehicles, setGlowTexture } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPeds } from './pedestrians.js';
import { createFx, createCombat } from './combat.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createActivities } from './activities.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createSave } from './save.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const SUN = new THREE.Vector3(-0.75, 0.3, 0.55).normalize();
const MAX_FRAME = 0.25;
const IDLE = { mouse: { left: false, right: false }, down: () => false, take: () => false, look: () => ({ dx: 0, dy: 0 }) };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(shot ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#ffb585', 150, 760);
const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.3, 2000);
const rng = createRandom(seed);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 horizon = vec3(1.0,0.62,0.42); vec3 gold = vec3(1.0,0.80,0.52); vec3 mid = vec3(0.36,0.80,0.82); vec3 zen = vec3(0.06,0.44,0.70);
        vec3 c = mix(horizon, gold, smoothstep(-0.02,0.07,h)); c = mix(c, mid, smoothstep(0.05,0.40,h)); c = mix(c, zen, smoothstep(0.32,0.95,h));
        if (h < 0.0) c = mix(horizon, vec3(0.6,0.38,0.30), smoothstep(0.0,-0.4,h));
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += vec3(1.0,0.60,0.28)*pow(s,5.0)*0.5 + vec3(1.0,0.84,0.55)*pow(s,50.0)*0.9 + vec3(1.0,0.97,0.86)*smoothstep(0.9988,0.9996,s)*3.0;
        gl_FragColor = vec4(c, 1.0); }`,
  }),
);
sky.renderOrder = -10;
sky.frustumCulled = false;
scene.add(sky);

const sun = new THREE.DirectionalLight('#ffbe80', 3.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -80;
sc.right = 80;
sc.top = 80;
sc.bottom = -80;
sc.near = 10;
sc.far = 420;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight('#7fd4e8', '#e9a272', 1.15));

try {
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.geometry, sky.material));
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.7;
} catch {
  scene.environment = null;
}

const glowTex = glowTexture();
setGlowTexture(glowTex);
const G = { scene, camera, renderer, rng, glowTex, camYaw: Math.PI, mapOpen: false, shakeMag: 0, sun, SUN };
G.shake = (m) => {
  G.shakeMag = Math.max(G.shakeMag, m);
};
G.audio = createAudio();
G.city = buildCity(scene, rng);
G.fx = createFx(G, glowTex);
G.vehicles = createVehicles(G);
G.peds = createPeds(G);
G.combat = createCombat(G);
G.police = createPolice(G);
G.player = createPlayer(G);
G.traffic = createTraffic(G);
G.missions = createMissions(G);
G.activities = createActivities(G);
G.save = createSave(G);
G.hud = createHud(G);
G.blast = (x, z, r, dmg, src) => G.combat.blast(x, z, r, dmg, src);
G.alarm = (x, z, r) => {
  G.peds.alarm(x, z, r);
  G.traffic.alarm(x, z);
};
G.alarmCrash = (x, z, v) => {
  G.peds.alarm(x, z, 22);
  if (v && v.driver === 'player' && G.vehicles.list.some((o) => o.owner === 'traffic' && Math.hypot(o.x - x, o.z - z) < 5)) G.police.addHeat(0.6);
};
G.player.z = LANDMARKS.start.z - 18;
G.player.camYaw = 0;

let t = 0;
const sim = (dt, input, live) => {
  t += dt;
  G.player.step(dt, t, input);
  if (live) {
    G.activities.step(dt, t, input);
    G.missions.step_(dt, t);
  }
  G.vehicles.step(dt, t);
  G.traffic.step(dt);
  G.peds.step(dt, t);
  G.police.step(dt, t);
  G.combat.step(dt, t);
  G.fx.update(dt);
  G.city.update(t);
};
G.stepWorld = (dt = STEP) => sim(dt, IDLE, false);
G.time = () => t;

function seedWorld() {
  for (let i = 0; i < 60; i += 1) {
    G.traffic.step(STEP);
    G.peds.step(STEP, 0);
  }
  const specs = ['solara', 'vipera', 'aurelia', 'cargo'];
  for (let k = 0; k < 10; k += 1) {
    const c = ROADS.x[k % 5];
    const z = -240 + k * 42 + (k % 3) * 9;
    if (ROADS.z.some((r) => Math.abs(r - z) < 16)) continue;
    const v = G.vehicles.spawn(specs[k % 4], c + 5.9 * (k % 2 ? 1 : -1), z, k % 2 ? 0 : Math.PI, { owner: 'parked', color: rng.pick(['#1f8fff', '#e8eef5', '#ff6fa8', '#38d6a0', '#d93a3a']) });
    v.sleep = true;
  }
  G.vehicles.step(STEP, 0);
}

function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  G.fx.setScale(h * renderer.getPixelRatio(), camera.fov);
}
window.addEventListener('resize', layout);

function render() {
  sky.position.copy(camera.position);
  const f = new THREE.Vector3();
  camera.getWorldDirection(f);
  sun.position.set(camera.position.x + f.x * 30 + SUN.x * 260, SUN.y * 260, camera.position.z + f.z * 30 + SUN.z * 260);
  sun.target.position.set(camera.position.x + f.x * 30, 0, camera.position.z + f.z * 30);
  renderer.render(scene, camera);
}
G.render = render;
G.layout = layout;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
let camInit = false;

function followCamera(dt) {
  const p = G.player;
  const v = p.vehicle;
  const speed = v ? Math.abs(v.speed) : 0;
  if (v && p.lookT <= 0 && speed > 3) p.camYaw += wrap(v.heading - p.camYaw) * Math.min(1, dt * (v.speed < 0 ? 0.6 : 2.6));
  G.camYaw = p.camYaw;
  const dist = v ? 9.5 + v.spec.len * 0.45 + speed * 0.07 : 6.4;
  const pitch = v ? 0.2 + p.camPitch * 0.35 : p.camPitch;
  const baseY = v ? v.y + 1.4 : 1.55;
  const tx = p.x;
  const tz = p.z;
  let d = dist;
  const dx = -Math.sin(p.camYaw) * Math.cos(pitch);
  const dz = -Math.cos(p.camYaw) * Math.cos(pitch);
  const dy = Math.sin(pitch);
  for (let s = d; s > 1.6; s -= 0.8) {
    const cx = tx + dx * s;
    const cz = tz + dz * s;
    const cy = baseY + dy * s + 0.6;
    let hit = false;
    for (const c of G.city.collidersNear(cx, cz, 2)) if (cx > c.x0 - 0.4 && cx < c.x1 + 0.4 && cz > c.z0 - 0.4 && cz < c.z1 + 0.4 && cy < c.h + 0.5) hit = true;
    if (!hit) {
      d = s;
      break;
    }
    d = s - 0.8;
  }
  const shoulder = v ? 0 : 0.9;
  const rx = Math.cos(p.camYaw) * -shoulder;
  const rz = Math.sin(p.camYaw) * shoulder;
  const want = new THREE.Vector3(tx + dx * d + rx, baseY + dy * d + (v ? 1.0 : 0.5), tz + dz * d + rz);
  const look = new THREE.Vector3(tx + Math.sin(p.camYaw) * (v ? 3 : 2) + rx * 0.4, baseY + (v ? 0.4 : 0.35), tz + Math.cos(p.camYaw) * (v ? 3 : 2) + rz * 0.4);
  if (!camInit) {
    camPos.copy(want);
    camLook.copy(look);
    camInit = true;
  }
  const k = 1 - Math.exp(-dt * (v ? 7 : 12));
  camPos.lerp(want, k);
  camLook.lerp(look, 1 - Math.exp(-dt * 14));
  G.shakeMag = Math.max(0, G.shakeMag - dt * 1.6);
  camera.position.copy(camPos);
  if (G.shakeMag > 0.01) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * G.shakeMag, (Math.random() - 0.5) * G.shakeMag, (Math.random() - 0.5) * G.shakeMag));
  camera.lookAt(camLook);
  const fov = 62 + (v ? Math.min(16, speed * 0.28) + (v.boosting ? 8 : 0) : 0);
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }
}

function titleCamera(time) {
  const a = 0.35 + Math.sin(time * 0.05) * 0.08;
  camera.position.set(300 + Math.sin(a) * 20, 96, 150 + Math.cos(a) * 14);
  camera.lookAt(20, 34, -90);
  camera.fov = 60;
  camera.updateProjectionMatrix();
  G.camYaw = Math.PI;
}
G.titleCamera = titleCamera;

function announce(msg) {
  statusEl.textContent = msg;
}

function runShot(name) {
  layout();
  stageShot(name, G);
  let painted = 0;
  function paint() {
    render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  layout();
  const input = createInput(canvas);
  let mode = 'title';
  let selected = 0;
  let acc = 0;
  let last = performance.now();
  seedWorld();
  G.hud.refreshSlots(selected);
  announce('Solaris Coast. Press Enter to start.');

  function begin(slot, fresh) {
    selected = slot;
    G.audio.unlock();
    if (fresh) {
      G.save.fresh(slot);
      G.player.cash = 1500;
      G.player.reset();
      G.missions.reset(0);
      G.activities.load({ respect: { mirador: 0, crown: 0, harbor: 0, palma: 0 }, stuntBest: 0 });
    } else if (!G.save.load(slot)) {
      G.save.slot = slot;
    }
    G.player.x = LANDMARKS.start.x;
    G.player.z = LANDMARKS.start.z - 18;
    G.player.camYaw = 0;
    camInit = false;
    mode = 'play';
    announce('Playing.');
  }

  const newest = () => {
    const slots = G.save.slots();
    let best = -1;
    slots.forEach((s, i) => {
      if (s && (best < 0 || s.when > slots[best].when)) best = i;
    });
    return best;
  };
  G.hud.btnContinue.onclick = () => {
    const n = newest();
    begin(n < 0 ? 0 : n, n < 0);
  };
  G.hud.btnNew.onclick = () => begin(selected, true);
  G.hud.slotEls.forEach((b, i) => {
    b.onclick = () => {
      selected = i;
      if (G.save.slots()[i]) begin(i, false);
      else begin(i, true);
    };
  });
  canvas.addEventListener('click', () => {
    if (mode === 'play') input.lock();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'play') mode = 'paused';
  });
  const status = () => (mode === 'title' ? 'title' : mode);

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (mode === 'title') {
      for (let i = 1; i <= 3; i += 1) {
        if (input.take(`Digit${i}`)) {
          selected = i - 1;
          G.hud.refreshSlots(selected);
        }
      }
      if (input.take('Enter') || input.take('Space')) {
        const n = newest();
        begin(n < 0 ? selected : n, n < 0);
      }
      if (input.take('KeyN')) begin(selected, true);
      acc += dt;
      while (acc >= STEP) {
        sim(STEP, IDLE, false);
        acc -= STEP;
      }
      titleCamera(t);
    } else if (mode === 'play') {
      if (input.take('Escape')) {
        if (G.mapOpen) G.mapOpen = false;
        else if (G.activities.garage.open) G.activities.garage.open = false;
        else mode = 'paused';
        if (document.pointerLockElement) document.exitPointerLock();
      }
      if (input.take('KeyM')) G.mapOpen = !G.mapOpen;
      if (input.take('KeyR')) G.hud.toast(G.audio.toggleRadio());
      acc += dt;
      while (acc >= STEP) {
        sim(STEP, input, true);
        acc -= STEP;
      }
      input.clearEdges();
      followCamera(dt);
      const v = G.player.vehicle;
      G.audio.engine(v ? v.speed : 0, v ? v.boosting : false, !!v);
      const near = G.vehicles.list.some((c) => c.owner === 'police' && !c.dead && !c.leaving && Math.hypot(c.x - G.player.x, c.z - G.player.z) < 90);
      G.audio.siren(near ? 1 : 0);
    } else if (mode === 'paused') {
      if (input.take('Escape') || input.take('Enter')) mode = 'play';
      input.clearEdges();
      acc = 0;
    }
    G.hud.update(dt, t, status());
    render();
  }
  requestAnimationFrame(frame);
  window.__solaris = G;
}

if (shot) runShot(shot);
else runGame();
