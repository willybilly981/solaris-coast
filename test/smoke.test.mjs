// Offline smoke tests for the audited fixes: Node 22+ built-ins only, no renderer, no network.
// Run: node --test test/smoke.test.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

const threeUrl = new URL('../game/vendor/three.module.min.js', import.meta.url).href;
registerHooks({
  resolve: (spec, ctx, next) => (spec === 'three' ? { url: threeUrl, shortCircuit: true } : next(spec, ctx)),
});

const noop = () => {};
const sink = () => new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : noop) });

// 2D context stand-in: every method returns itself, every number coerces to 0
const ctx2d = new Proxy(noop, {
  get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : ctx2d),
  set: () => true,
  apply: () => ctx2d,
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const store = new Map();
const localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const audioLog = { starts: [], ctxs: [] };
class MockAudioContext {
  constructor() {
    this.currentTime = 100;
    this.sampleRate = 8000;
    this.state = 'running';
    this.destination = {};
    audioLog.ctxs.push(this);
  }

  node() {
    const n = { connect: (x) => x, start: noop, stop: noop, frequency: { value: 0 }, Q: { value: 0 } };
    n.gain = { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop };
    return n;
  }

  createGain() {
    return this.node();
  }

  createBiquadFilter() {
    return this.node();
  }

  createOscillator() {
    return this.node();
  }

  createBuffer(_c, len) {
    return { getChannelData: () => new Float32Array(len) };
  }

  createBufferSource() {
    const n = this.node();
    n.start = (t) => audioLog.starts.push({ t, now: this.currentTime });
    return n;
  }

  resume() {
    return Promise.resolve();
  }
}
globalThis.window = { localStorage, AudioContext: MockAudioContext };

const THREE = await import('three');
const { createRandom } = await import('../game/src/random.js');
const { LANDMARKS, WEAPONS } = await import('../game/src/config.js');
const { createVehicles, setGlowTexture } = await import('../game/src/vehicles.js');
const { createPolice } = await import('../game/src/police.js');
const { createFx, createCombat } = await import('../game/src/combat.js');
const { createPlayer } = await import('../game/src/player.js');
const { createMissions } = await import('../game/src/missions.js');
const { createActivities } = await import('../game/src/activities.js');
const { createSave } = await import('../game/src/save.js');
const { createAudio } = await import('../game/src/audio.js');

function makeG(seed = 1) {
  const scene = new THREE.Scene();
  const G = { scene, rng: createRandom(seed), glowTex: new THREE.Texture(), shake: noop, alarm: noop, alarmCrash: noop, banners: [] };
  setGlowTexture(G.glowTex);
  G.hud = { banner: (...a) => G.banners.push(a), toast: noop };
  G.audio = sink();
  G.fx = sink();
  G.city = { collidersNear: () => [], rampHeight: () => 0 };
  G.peds = { list: [], spawnAt: noop, damage: noop, kill: noop, alarm: noop };
  G.vehicles = createVehicles(G);
  G.police = createPolice(G);
  G.combat = createCombat(G);
  G.blast = (...a) => G.combat.blast(...a);
  G.player = createPlayer(G);
  G.missions = createMissions(G);
  G.activities = createActivities(G);
  G.save = createSave(G);
  return G;
}

function makeInput(keys = []) {
  const edges = new Set(keys);
  return { edges, mouse: { left: false, right: false }, down: () => false, take: (k) => edges.delete(k), look: () => ({ dx: 0, dy: 0 }) };
}

function driveToGarage(G, tune = 1) {
  const v = G.vehicles.spawn('solara', LANDMARKS.garage.x, LANDMARKS.garage.z, 0);
  v.tune = tune;
  G.player.x = v.x;
  G.player.z = v.z;
  G.player.enter(v);
  G.activities.step(0.016, 0, makeInput(['KeyE']));
  assert.equal(G.activities.garage.open, true);
  return v;
}

test('#1 garage keys reach the garage instead of the weapon switch', () => {
  const G = makeG();
  const v = driveToGarage(G);
  v.hp = 10;
  const input = makeInput(['Digit1']);
  G.player.step(0.016, 0, input);
  assert.equal(input.edges.has('Digit1'), true, 'player.step must leave Digit1 alone');
  G.activities.step(0.016, 0, input);
  assert.equal(v.hp, v.maxHp);
  assert.equal(G.player.cash, 1500 - 120);

  const G2 = makeG();
  const input2 = makeInput(['Digit2']);
  G2.player.step(0.016, 0, input2);
  assert.equal(input2.edges.has('Digit2'), false, 'garage closed: weapon switch still takes the key');
});

test('#2 max tune costs nothing and prices follow the Palma discount', () => {
  const G = makeG();
  const v = driveToGarage(G, 1.21);
  G.activities.step(0.016, 0, makeInput(['Digit3']));
  assert.equal(G.player.cash, 1500);
  assert.equal(G.activities.garage.msg, 'Fully tuned');
  assert.equal(G.activities.garagePrices(v).tune, null);

  v.tune = 1;
  assert.equal(G.activities.garagePrices(v).tune, 400);
  G.activities.respect.palma = 100;
  assert.deepEqual(G.activities.garagePrices(v), { repair: 110, respray: 74, tune: 368, clear: 460 });
  assert.equal(G.activities.garagePrices(null).tune, null);
});

test('#3 vehicles.remove keeps shared wheel, sprite and livery resources alive', () => {
  const G = makeG();
  const disposed = new Set();
  const watch = (r) => r.addEventListener('dispose', () => disposed.add(r));
  const find = (v, pred) => {
    const out = [];
    v.mesh.traverse((o) => pred(o) && out.push(o));
    return out;
  };
  const a = G.vehicles.spawn('solara', 0, 0, 0);
  const b = G.vehicles.spawn('solara', 20, 0, 0);
  const tire = find(a, (o) => o.userData.sharedGeo)[0];
  const sprite = find(a, (o) => o.isSprite)[0];
  const body = find(a, (o) => o.isMesh && !o.userData.sharedGeo && o.material === a.parts.paint)[0];
  for (const r of [tire.geometry, tire.material, sprite.geometry, body.geometry, a.parts.paint]) watch(r);
  G.vehicles.remove(a);
  assert.equal(disposed.has(tire.geometry), false, 'wheel geometry is shared');
  assert.equal(disposed.has(tire.material), false, 'tire material is shared');
  assert.equal(disposed.has(sprite.geometry), false, 'sprite geometry is shared');
  assert.equal(disposed.has(body.geometry), true);
  assert.equal(disposed.has(a.parts.paint), true);
  assert.equal(find(b, (o) => o.userData.sharedGeo)[0].geometry, tire.geometry);

  const cop1 = G.vehicles.spawn('interceptor', 0, 30, 0);
  const cop2 = G.vehicles.spawn('interceptor', 20, 30, 0);
  const door = find(cop2, (o) => o.material?.map)[0];
  watch(door.material);
  G.vehicles.remove(cop1);
  assert.equal(disposed.has(door.material), false, 'livery material is shared');
});

test('#4 mission softlocks and spawned-vehicle cleanup', () => {
  const G = makeG();
  const M = G.missions;

  M.reset(2);
  M.start();
  const dead = M.target;
  dead.dead = true;
  M.step_(0.016, 0);
  assert.equal(M.active, null, 'dead getcar target fails the mission');
  assert.ok(G.banners.some((b) => b[0] === 'MISSION FAILED'));
  assert.equal(G.vehicles.list.includes(dead), false);

  M.start();
  const pushed = M.target;
  pushed.x += 80;
  G.player.enter(pushed);
  assert.equal(M.step, 1, 'pushed target still counts');

  M.reset(1);
  M.start();
  M.jump(1);
  const gunmen = [...G.combat.enemies].filter((e) => e.mission);
  assert.equal(gunmen.length, 4);
  for (const e of gunmen) G.combat.hurtEnemy(e, 999, false);
  assert.equal(M.done, 2, 'explosion-style kills advance the kill step');

  M.reset(1);
  M.start();
  M.jump(1);
  for (const e of G.combat.enemies) e.hp = 0;
  M.step_(0.016, 0);
  assert.equal(M.done, 2, 'kill step finishes when nobody is left');

  M.reset(6);
  M.start();
  M.jump(1);
  const apc = M.target;
  assert.equal(apc.specId, 'bastion');
  assert.equal(G.vehicles.list.includes(apc), true);
  M.fail();
  assert.equal(G.vehicles.list.includes(apc), false);
  assert.equal(M.target, null);
});

test('#5 mission 6 starts at exactly three stars', () => {
  const G = makeG();
  G.missions.reset(5);
  G.missions.start();
  assert.equal(G.police.stars, 3);
});

test('#6 corrupt localStorage never crashes slots() or load()', () => {
  const G = makeG();
  const key = (i) => `solaris-coast.slot${i}`;
  for (const raw of ['{', 'null', '{}', '{"cash":"bad"}', '[]', '42']) {
    G.save.fresh(0);
    store.set(key(0), raw);
    assert.doesNotThrow(() => G.save.slots(), raw);
    assert.equal(G.save.slots()[0], null, raw);
    assert.equal(G.save.load(0), false, raw);
  }
  G.save.fresh(0);
  store.set(key(0), JSON.stringify({ cash: 5, missions: 1, ammo: [null, [1], 'x', [3, 4]] }));
  assert.equal(G.save.load(0), true);
  assert.equal(G.player.cash, 5);
  assert.deepEqual([G.player.weapons[3].mag, G.player.weapons[3].reserve], [3, 4]);
  assert.notEqual(G.player.weapons[1].mag, 1);
  store.clear();
});

test('#9 radio drums are scheduled at the step timestamp', () => {
  const realSetInterval = globalThis.setInterval;
  let tick = null;
  globalThis.setInterval = (fn) => {
    tick = fn;
    return 0;
  };
  const A = createAudio();
  try {
    A.unlock();
  } finally {
    globalThis.setInterval = realSetInterval;
  }
  assert.equal(typeof tick, 'function');
  const ctx = audioLog.ctxs.at(-1);
  audioLog.starts.length = 0;
  for (let i = 0; i < 20; i += 1) {
    tick();
    ctx.currentTime += 0.12;
  }
  assert.ok(audioLog.starts.length > 0, 'at least one drum burst was started');
  for (const s of audioLog.starts) assert.ok(typeof s.t === 'number' && s.t >= s.now, `start(${s.t}) at ${s.now}`);
});

test('#10 ramming as the player adds debounced heat', () => {
  const G = makeG();
  const player = { driver: 'player', owner: 'player' };
  const cop = { driver: 'ai', owner: 'police' };
  G.police.onRam(player, cop);
  assert.equal(G.police.heat, 10);
  G.police.onRam(player, cop);
  assert.equal(G.police.heat, 10, 'debounced');
  G.police.clock += 2;
  G.police.onRam(cop, player);
  assert.equal(G.police.heat, 20);
  G.police.onRam(cop, { driver: 'ai', owner: 'police' });
  G.police.clock += 2;
  G.police.onRam(cop, cop);
  assert.equal(G.police.heat, 20, 'player not involved');
});

test('#13 a patrol car parks when its officers get out', () => {
  const G = makeG();
  const v = G.police.spawnCar(G.player.x + 6, G.player.z, 0);
  assert.equal(typeof v.ai, 'function');
  v.ai(v, 0.016);
  assert.equal(v.exited, true);
  assert.equal(v.ai, null);
  assert.equal(v.driver, null);
  assert.equal(v.input.throttle, 0);
  assert.equal(v.input.brake, 1);
  assert.equal(G.police.officers.length, 2);
});

function seededRun(seed) {
  const G = makeG(seed);
  G.fx = createFx(G, G.glowTex);
  G.combat.spawnEnemy(0, 6);
  G.combat.shoot(0, 1.4, 0, 0.1, WEAPONS[3], 'player', null);
  G.combat.hurtEnemy(G.combat.enemies[0], 999, true);
  G.fx.explosion(0, 1, 0, 1);
  G.combat.shoot(0, 1.4, 0, -0.2, WEAPONS[3], 'player', null);
  const tracers = G.scene.children.filter((o) => o.isMesh && o.visible && o.geometry.type === 'BoxGeometry');
  assert.ok(tracers.length > 0);
  return JSON.stringify({
    tracers: tracers.map((m) => [m.position.toArray(), m.scale.toArray()]),
    pickups: G.combat.pickups.map((p) => [p.kind, p.value, p.t]),
  });
}

test('#16 seeded fx and combat are deterministic', () => {
  assert.equal(seededRun(7), seededRun(7));
  assert.notEqual(seededRun(7), seededRun(8));
});
