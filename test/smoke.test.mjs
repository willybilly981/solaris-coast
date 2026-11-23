// Offline smoke tests for the audited fixes: Node 22+ built-ins only, no renderer, no network.
// Run: node --test test/smoke.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const { createActivities, GARAGE_SERVICES } = await import('../game/src/activities.js');
const { createSave } = await import('../game/src/save.js');
const { createAudio } = await import('../game/src/audio.js');
const { CREW, SPEAKERS, createCrewState, getCrewCards, getSpeakerPortrait, tickCrew, triggerCrewAbility } = await import('../game/src/crew.js');
const { RANKS, RELIC_SPOTS, WEIGHTS, computeCompletion, createProgress, getRankInfo, gradeMission, normalizeProgress, weaponUnlocked } = await import('../game/src/progression.js');
const { buildStaticMap, currentRoute, getAtlasState, planRoute } = await import('../game/src/atlas.js');
const { updateTelemetry } = await import('../game/src/vehicles.js');
const { STATE_COLORS, getChaseStatus, getTacticalUnits } = await import('../game/src/police.js');
const { animateHumanoid, createHumanoid, createPeds } = await import('../game/src/pedestrians.js');
const { MISSIONS, RADIO, ROADS } = await import('../game/src/config.js');

function makeG(seed = 1) {
  const scene = new THREE.Scene();
  const G = { scene, rng: createRandom(seed), glowTex: new THREE.Texture(), shake: noop, alarm: noop, alarmCrash: noop, banners: [], clock: 0, waypoint: null };
  G.time = () => G.clock;
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
  G.crew = createCrewState();
  G.progress = createProgress(G);
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
  assert.deepEqual(G.activities.garagePrices(v), { repair: 110, respray: 74, tune: 368, armor: 322, nitro: 276, ammo: 230, clear: 460 });
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

test('#17 crew Z swaps plates: drops stars, masks heat gain, 45 s cooldown', () => {
  const G = makeG();
  G.police.setStars(4);
  assert.equal(triggerCrewAbility(G, 'Z'), true);
  assert.equal(G.police.stars, 2);
  assert.equal(G.police.maskT, 12);
  assert.equal(G.crew.cd.Z, 45);
  assert.equal(triggerCrewAbility(G, 'Z'), false, 'still cooling down');
  const heat = G.police.heat;
  G.police.addHeat(10);
  assert.equal(G.police.heat, heat + 4, 'masked plates build 40% heat');
  tickCrew(G, 10);
  assert.equal(G.crew.cd.Z, 35);
  tickCrew(G, 99);
  assert.equal(G.crew.cd.Z, 0);
  G.police.setStars(1);
  triggerCrewAbility(G, 'Z');
  assert.equal(G.police.stars, 0, 'a single star is cleared outright');
});

test('#18 crew X repairs the car or heals on foot, C jams dispatch and stalls escalation', () => {
  const G = makeG();
  G.player.hp = 50;
  G.player.armor = 0;
  assert.equal(triggerCrewAbility(G, 'X'), true);
  assert.deepEqual([G.player.hp, G.player.armor], [75, 35]);
  assert.equal(G.crew.cd.X, 35);

  const G2 = makeG();
  const v = G2.vehicles.spawn('solara', 141, 22, 0);
  G2.player.enter(v);
  v.hp = 40;
  triggerCrewAbility(G2, 'X');
  assert.equal(v.hp, 85);

  const G3 = makeG();
  G3.police.setStars(3);
  const cop = G3.police.spawnCar(G3.player.x + 2, G3.player.z + 7, 0);
  assert.equal(getTacticalUnits(G3)[0].state, 'RAMMING');
  assert.equal(triggerCrewAbility(G3, 'C'), true);
  assert.equal(G3.crew.cd.C, 50);
  assert.equal(getTacticalUnits(G3)[0].state, 'JAMMED');
  assert.equal(getChaseStatus(G3).label, 'JAMMED');
  const heat = G3.police.heat;
  G3.police.addHeat(50);
  assert.equal(G3.police.heat, heat, 'star escalation is stalled while jammed');
  G3.police.frozen = true;
  G3.police.jamT = 0.05;
  G3.police.step(0.1, 0);
  assert.equal(getTacticalUnits(G3)[0].state, 'SEARCHING');
  assert.ok(cop.cap === undefined || cop.cap > 0);

  const cards = getCrewCards(G3);
  assert.deepEqual(cards.map((c) => [c.slot, c.skill]), [['Z', 'SWAP PLATES'], ['X', 'QUICK FIX'], ['C', 'SIGNAL JAM']]);
  assert.equal(cards[2].ready, false);
  assert.equal(cards[2].label, '50s');
  assert.equal(cards[0].label, 'READY');
});

test('#19 portraits are original inline SVG, 64x64, one per speaker', () => {
  const ids = Object.keys(SPEAKERS);
  assert.deepEqual(ids.sort(), ['elena', 'harper', 'kai', 'marco', 'sofia']);
  assert.deepEqual(SPEAKERS.kai.name, 'KAI VALE');
  assert.equal(CREW.length, 3);
  const seen = new Set();
  for (const id of ids) {
    const svg = getSpeakerPortrait(id);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 64 64" width="64" height="64"/);
    assert.ok(!/https?:|href=/.test(svg.replace('http://www.w3.org/2000/svg', '')), 'no external references');
    seen.add(svg);
  }
  assert.equal(seen.size, 5);
});

test('#20 ranks, relics, grades and the completion formula', () => {
  const at = (rp) => getRankInfo(rp);
  assert.deepEqual([0, 249, 250, 700, 1400, 2500, 4200, 9999].map((rp) => at(rp).rank), [1, 1, 2, 3, 4, 5, 6, 6]);
  assert.equal(at(700).label, 'RANK 3 - FIXER');
  assert.equal(at(5000).next, null);
  assert.equal(at(5000).pct, 1);
  assert.equal(RANKS.length, 6);
  assert.equal(RELIC_SPOTS.length, 12);
  assert.equal(new Set(RELIC_SPOTS.map((r) => `${r.x},${r.z}`)).size, 12);

  const G = makeG();
  const spot = RELIC_SPOTS[0];
  G.player.x = spot.x;
  G.player.z = spot.z;
  const cash = G.player.cash;
  G.progress.step(0.016, 0);
  G.progress.step(0.016, 0);
  assert.deepEqual(G.progress.relics, [spot.id], 'collected once');
  assert.equal(G.player.cash, cash + 1500);
  assert.equal(G.progress.rp, 120);

  assert.equal(gradeMission({ time: 60, par: 90, damage: 5, stars: 0 }), 'G');
  assert.equal(gradeMission({ time: 100, par: 90, damage: 30, stars: 2 }), 'S');
  assert.equal(gradeMission({ time: 400, par: 90, damage: 90, stars: 5 }), 'B');
  G.progress.startMission();
  G.clock = 50;
  const res = G.progress.finishMission(MISSIONS[0]);
  assert.equal(res.grade, 'G');
  assert.equal(G.progress.grades.m1, 'G');
  assert.equal(res.rp, 200);
  G.progress.startMission();
  G.clock = 400;
  G.progress.finishMission(MISSIONS[0]);
  assert.equal(G.progress.grades.m1, 'G', 'a worse run never lowers the best grade');

  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  const full = { missions: 8, progress: { rp: 4200, relics: RELIC_SPOTS.map((r) => r.id), garage: Object.fromEntries(GARAGE_SERVICES.map((s) => [s.id, true])), explored: ['mirador', 'crown', 'harbor', 'palma'], races: 3, stunts: 5, evades: 10, stats: { takedowns: 25 } } };
  assert.equal(computeCompletion(full).pct, 100);
  assert.equal(computeCompletion({ missions: 0 }).pct, 0);
  assert.equal(computeCompletion({ missions: 4 }).pct, 15);
  assert.equal(computeCompletion({ missions: 'x', progress: { relics: 'bad', rp: NaN, stats: 7 } }).pct, 0, 'corrupt saves count as empty');
  assert.equal(weaponUnlocked(0, 3), false);
  assert.equal(weaponUnlocked(250, 3), true);
  assert.equal(weaponUnlocked(700, 4), true);
  const fresh = makeG();
  fresh.player.step(0.016, 0, makeInput(['Digit4']));
  assert.equal(fresh.player.weapon, 1, 'shotgun stays locked at rank 1');
  fresh.progress.addRp(250);
  fresh.player.step(0.016, 0, makeInput(['Digit4']));
  assert.equal(fresh.player.weapon, 3, 'rank 2 unlocks the shotgun');
});

test('#21 atlas road-grid routing and hub state', () => {
  const corner = planRoute({ x: ROADS.x[0], z: ROADS.z[0] }, { x: ROADS.x[4], z: ROADS.z[4] });
  assert.equal(corner.length, 330 + 350, 'A* finds the Manhattan length between two intersections');
  const beach = planRoute({ x: 195, z: 40 }, { x: -20, z: 150 });
  assert.equal(beach.points[0].x, 195);
  assert.deepEqual(beach.points.at(-1), { x: -20, z: 150 });
  const road = beach.points.slice(1, -1);
  for (let i = 1; i < road.length; i += 1) assert.ok(road[i].x === road[i - 1].x || road[i].z === road[i - 1].z, 'route stays on the street grid');
  assert.deepEqual(road[0], { x: 137, z: 60 }, 'the beach snaps to the nearest street end');
  assert.ok(beach.length >= Math.hypot(215, 110));
  assert.ok(planRoute({ x: 60, z: -20 }, { x: 60, z: -20 }).length < 1);

  const G = makeG();
  G.missions.reset(3);
  G.progress.grades.m1 = 'G';
  G.progress.relics.push('r1', 'r2');
  const S = getAtlasState(G);
  assert.deepEqual(S.bars.map((b) => b.label), ['CONTRACTS', 'RELICS', 'DISTRICTS', 'GARAGE', 'SIDE OPS', 'HEAT EVADES', 'RANK RP']);
  assert.equal(S.bars[0].text, '3/8');
  assert.equal(S.bars[1].text, '2/12');
  assert.deepEqual(S.contracts.map((c) => c.status), ['DONE', 'DONE', 'DONE', 'OPEN', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);
  assert.equal(S.contracts[0].grade, 'G');
  assert.equal(S.stats.length, 6);
  assert.equal(S.slots.length, 3);
  assert.equal(S.completion, G.progress.completion().pct);
  assert.equal(S.target.kind, 'OBJECTIVE');
  assert.ok(S.route.length > 0);
  G.waypoint = { x: -20, z: 150 };
  assert.equal(getAtlasState(G).target.kind, 'WAYPOINT');
});

test('#22 vehicle telemetry: condition, gear, km/h and nitro', () => {
  const G = makeG();
  const v = G.vehicles.spawn('solara', 0, 0, 0);
  v.hp = 50;
  v.speed = 30;
  v.nitro = 0.4;
  updateTelemetry(v);
  assert.deepEqual([v.conditionPct, v.kmh, v.nitroPct], [50, 108, 40]);
  const gear = (speed) => updateTelemetry(Object.assign(v, { speed })).gear;
  assert.deepEqual([-3, 0, 1, 19, 38, 60].map(gear), ['R', 'N', 1, 4, 6, 6]);
  v.hp = -5;
  assert.equal(updateTelemetry(v).conditionPct, 0);
});

test('#23 SCMPD tactical units carry callsigns and live states', () => {
  const G = makeG();
  G.player.x = 141;
  G.player.z = 22;
  G.police.setStars(4);
  const ram = G.police.spawnCar(143, 29, 0);
  const flank = G.police.spawnCar(156, 34, 0);
  const tail = G.police.spawnCar(141, 62, 0);
  G.police.ensureHeli(true);
  G.police.heli.pos.set(141, 34, 47);
  const far = G.police.spawnOfficer(141, 100, 'tactical');
  far.fireT = 1;
  const units = getTacticalUnits(G);
  assert.equal(units.length, 4, 'top four only');
  assert.deepEqual(units.map((u) => u.state), ['RAMMING', 'FLANKING', 'SPOTLIGHT', 'PURSUIT']);
  assert.equal(units[2].callsign, 'CONDOR-1');
  for (const u of units) {
    assert.match(u.callsign, /^[A-Z]+-\d+$/);
    assert.equal(u.color, STATE_COLORS[u.state]);
  }
  assert.deepEqual(units.map((u) => u.dist), [...units.map((u) => u.dist)].sort((a, b) => a - b));
  assert.ok([ram, flank, tail].every((c) => c.callsign));
  assert.equal(far.fireT, 1);
  const g2 = getTacticalUnits({ ...G, police: Object.assign(Object.create(G.police), { stars: 0 }) });
  assert.deepEqual(g2, []);

  G.police.seen = true;
  assert.equal(getChaseStatus(G).label, 'IN SIGHT');
  G.police.seen = false;
  G.police.seenT = 2;
  G.police.heat = 60;
  assert.equal(getChaseStatus(G).text, 'SEARCHING 21s');
  G.police.clear();
  assert.equal(getChaseStatus(G).label, 'CLEAR');
});

test('#24 crew garage offers seven services on keys 1-7', () => {
  const G = makeG();
  const v = driveToGarage(G);
  G.player.cash = 100000;
  assert.deepEqual(GARAGE_SERVICES.map((s) => s.label), ['REPAIR', 'RESPRAY', 'STAGE TUNE', 'ARMOR PLATING', 'NITRO SYSTEM', 'AMMO + ARMOR', 'CLEAR HEAT']);
  G.police.setStars(3);
  v.hp = 30;
  G.player.weapons[1].mag = 0;
  G.player.weapons[1].reserve = 0;
  for (let i = 0; i < 7; i += 1) G.activities.garageAct(i);
  assert.equal(v.maxHp, 125, 'armor plating adds 25% of base HP');
  assert.equal(v.hp, 125, 'repair first, then plating raises both');
  assert.equal(v.nitroLvl, 1);
  assert.ok(Math.abs(v.tune - 1.07) < 1e-9);
  assert.equal(G.player.armor, 100);
  assert.equal(G.player.weapons[1].reserve, WEAPONS[1].reserve);
  assert.equal(G.police.stars, 0);
  assert.ok(GARAGE_SERVICES.every((s) => G.progress.garage[s.id]));
  assert.equal(G.progress.completion().parts.garage, 1);
  assert.equal(G.activities.garagePrices(v).tune, 800);
  G.activities.garageAct(3);
  G.activities.garageAct(3);
  G.activities.garageAct(3);
  assert.equal(G.activities.garage.msg, 'Plating maxed');
  assert.equal(v.plating, 3);

  const G2 = makeG();
  G2.police.setStars(3);
  const v2 = driveToGarage(G2);
  G2.activities.garageAct(1);
  assert.equal(G2.police.stars, 2, 'respray sheds one star');
  assert.notEqual(v2.parts.paint.color.getHexString(), 'ff4a1c');
});

test('#25 radio stations pair with curated track names', () => {
  const realSetInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  const A = createAudio();
  try {
    assert.equal(A.nowPlaying(), 'SOLARIS FM - Sunset Boulevard');
    assert.equal(A.toggleRadio(), 'PALM WAVE 98.4 - Neon Undertow');
    assert.equal(A.toggleRadio(), 'HARBOR BASS - Concrete Tide');
    assert.equal(A.toggleRadio(), 'OFF AIR');
    assert.equal(A.toggleRadio(), 'SOLARIS FM - Sunset Boulevard');
  } finally {
    globalThis.setInterval = realSetInterval;
  }
  assert.ok(RADIO.every((r) => r.tracks.length >= 3));
});

test('#26 mission state reports stage, objective and next line', () => {
  const G = makeG();
  G.missions.reset(0);
  const idle = G.missions.info();
  assert.deepEqual([idle.stage, idle.totalStages, idle.nextText], [0, 3, 'NEXT: MEET CONTACT']);
  G.missions.start();
  let info = G.missions.info();
  assert.deepEqual([info.stage, info.totalStages, info.objectiveShort, info.nextText], [1, 3, 'MEET CONTACT', 'NEXT: TAKE SOLARA']);
  G.missions.jump(2);
  info = G.missions.info();
  assert.deepEqual([info.stage, info.nextText, info.par], [3, 'NEXT: PAYOUT', 90]);
  assert.equal(typeof info.elapsed, 'number');
});

test('#27 gunfire makes nearby pedestrians put their hands up', () => {
  const G = makeG();
  G.peds = createPeds(G);
  const near = Array.from({ length: 20 }, () => G.peds.spawnAt(1, 1));
  const far = G.peds.spawnAt(30, 0);
  G.peds.alarm(0, 0, 38);
  assert.ok(near.every((p) => p.state === 'flee'));
  assert.ok(near.some((p) => p.handsUp), 'some freeze with hands up');
  assert.ok(near.some((p) => !p.handsUp), 'others sprint away');
  assert.equal(far.state, 'flee');
  assert.equal(far.handsUp, false, 'distant pedestrians just run');
  const h = createHumanoid({});
  animateHumanoid(h, 6, 0, false, true);
  assert.ok(h.userData.armL.rotation.x < -2.5 && h.userData.armR.rotation.x < -2.5);
});

test('#28 Elena covers the player, and player shots feed the reticle timers', () => {
  const G = makeG();
  G.combat.spawnEnemy(G.player.x + 10, G.player.z + 14, { alert: 20 });
  const elena = G.combat.spawnAlly(G.player.x - 3, G.player.z - 3);
  const gunman = G.combat.enemies[0];
  let fired = false;
  for (let i = 0; i < 240 && gunman.hp > 0; i += 1) {
    G.combat.step(0.016, i * 0.016);
    fired ||= elena.fireT > 0;
  }
  assert.equal(fired, true);
  assert.ok(gunman.hp < 60, 'ally rounds land');
  assert.equal(G.police.heat, 0, 'ally fire never raises the wanted level');
  G.combat.removeAlly();
  assert.equal(G.combat.ally, null);
  G.combat.shoot(0, 1.4, 0, 0, WEAPONS[2], 'player', null);
  assert.ok(G.combat.shotT > 0);
});

test('#29 main.js registers resize only with a renderer and imports in module-plan order', () => {
  const src = readFileSync(new URL('../game/src/main.js', import.meta.url), 'utf8');
  assert.match(src, /^if \(renderer\) window\.addEventListener\('resize', layout\);$/m);
  assert.match(src, /function layout\(\) \{\n  if \(!renderer\) return;/);
  assert.doesNotMatch(src, /^window\.addEventListener\('resize'/m);
  const order = [...src.matchAll(/^import .* from '\.\/(\w+)\.js';$/gm)].map((m) => m[1]);
  assert.deepEqual(order.slice(0, 11), ['config', 'crew', 'progression', 'atlas', 'missions', 'police', 'vehicles', 'combat', 'player', 'activities', 'hud']);
});

test('#30 portrait gradient ids are unique per place and the markup is cached', () => {
  const gradientId = (svg) => /<linearGradient id="([^"]+)"/.exec(svg)[1];
  const hud = getSpeakerPortrait('elena', 'hud-');
  assert.notEqual(gradientId(hud), gradientId(getSpeakerPortrait('elena', 'atlas-')));
  assert.notEqual(gradientId(hud), gradientId(getSpeakerPortrait('elena')));
  assert.equal(getSpeakerPortrait('elena', 'hud-'), hud, 'same string back, no rebuild per frame');
  for (const c of getCrewCards(makeG())) assert.match(gradientId(c.portrait), /^pg-hud-/);
});

test('#31 player.reset leaves the car and clears the chase', () => {
  const G = makeG();
  const v = G.vehicles.spawn('solara', 141, 22, 0);
  G.player.enter(v);
  G.police.setStars(3);
  G.player.hp = 10;
  G.player.wasted = true;
  G.player.reset();
  assert.equal(G.player.inVehicle, false);
  assert.equal(v.driver, null);
  assert.equal(G.police.stars, 0);
  assert.deepEqual([G.player.hp, G.player.wasted], [100, false]);
});

test('#32 main.js resets and drops stale keys on every career start, and asks before erasing a slot', () => {
  const src = readFileSync(new URL('../game/src/main.js', import.meta.url), 'utf8');
  assert.match(src, /function begin\(slot, fresh\) \{\n    selected = slot;\n    G\.audio\.unlock\(\);\n    input\.clearEdges\(\);\n    G\.player\.reset\(\);\n    if \(fresh\) \{/);
  assert.equal(src.match(/G\.player\.reset\(\)/g).length, 1, 'one reset, shared by new and loaded careers');
  assert.match(src, /if \(input\.take\('KeyN'\)\) newCareer\(\);\n      input\.clearEdges\(\);/);
  assert.match(src, /btnNew\.onclick = newCareer;/);
  assert.equal(src.match(/begin\(selected, true\)/g).length, 1, 'only newCareer erases the selected slot');
});

test('#33 activities state is a copy and load always starts from a clean record', () => {
  const G = makeG();
  G.activities.respect.crown = 50;
  const saved = G.activities.state();
  G.activities.respect.crown = 99;
  assert.equal(saved.respect.crown, 50, 'a stored snapshot must not follow live respect');
  G.activities.load({ respect: { mirador: 12, crown: '7' }, stuntBest: 'x' });
  assert.deepEqual(G.activities.respect, { mirador: 12, crown: 0, harbor: 0, palma: 0 });
  assert.equal(G.activities.stuntBest, 0);
  G.activities.stuntBest = 40;
  G.activities.load(undefined);
  assert.deepEqual([...Object.values(G.activities.respect), G.activities.stuntBest], [0, 0, 0, 0, 0]);
});

test('#34 stored progress keeps only real grades and non-negative numbers', () => {
  const p = normalizeProgress({ grades: { m1: '<img src=x onerror=1>', m2: 'S', m3: 'toString', m4: ['G'] }, rp: -50, races: -1, stats: { distance: -9 } });
  assert.deepEqual(p.grades, { m2: 'S' });
  assert.deepEqual([p.rp, p.races, p.stats.distance], [0, 0, 0]);
});

test('#35 slot timestamps resolve to the second so Continue picks the newer save', () => {
  const RealDate = Date;
  let now = RealDate.parse('2026-01-01T10:00:05Z');
  globalThis.Date = class extends RealDate {
    constructor(...a) {
      super(...(a.length ? a : [now]));
    }
  };
  try {
    const G = makeG();
    const first = G.save.snapshot().when;
    now += 45000;
    const second = G.save.snapshot().when;
    assert.equal(first, '2026-01-01 10:00:05');
    assert.ok(second > first, `${second} must sort after ${first}`);
  } finally {
    globalThis.Date = RealDate;
  }
});

test('#36 ammo and armor pickups expire like cash', () => {
  const G = makeG();
  G.combat.spawnPickup('ammo', 1000, 1000, 5);
  G.combat.spawnPickup('armor', 1000, 1010, 5);
  const before = G.scene.children.length;
  G.combat.step(100, 0);
  assert.equal(G.combat.pickups.length, 2, 'still lying around after 100 s');
  G.combat.step(21, 0);
  assert.equal(G.combat.pickups.length, 0);
  assert.equal(G.scene.children.length, before - 2);
});

test('#37 abandoned cars out of sight are capped, oldest first', () => {
  const G = makeG();
  const far = Array.from({ length: 25 }, (_, i) => G.vehicles.spawn('solara', 400 + i * 6, 22, 0, { owner: 'parked' }));
  for (const v of far) v.abandoned = true;
  const mine = G.vehicles.spawn('solara', G.player.x, G.player.z, 0);
  G.player.enter(mine);
  G.player.exit(true);
  const left = G.vehicles.list.filter((v) => v.abandoned);
  assert.equal(left.length, 21, '20 out of sight plus the car just left');
  assert.equal(G.vehicles.list.includes(far[0]), false);
  assert.equal(G.vehicles.list.includes(far[24]), true);
  assert.equal(G.vehicles.list.includes(mine), true);
  G.player.enter(mine);
  assert.equal(mine.abandoned, false, 'driving it again clears the mark');
});

test('#38 the route is kept while the target only drifts', () => {
  const G = makeG();
  G.waypoint = { x: -20, z: 150 };
  const first = currentRoute(G);
  G.waypoint = { x: -19.5, z: 150.4 };
  assert.equal(currentRoute(G), first, 'half a metre does not re-plan');
  G.waypoint = { x: -20, z: 140 };
  assert.notEqual(currentRoute(G), first, 'ten metres does');
});

test('#39 the city bitmap is painted once and shared', () => {
  assert.equal(buildStaticMap(), buildStaticMap());
});

test('#40 a stunt pays only for the car that launched', () => {
  const G = makeG();
  const a = G.vehicles.spawn('solara', 0, 0, 0);
  const b = G.vehicles.spawn('solara', 0, 0, 0);
  a.driver = 'player';
  b.driver = 'player';
  G.activities.onLaunch(a);
  b.x = 50;
  G.activities.onLand(b);
  assert.equal(G.player.cash, 1500, 'another car landing far away earns nothing');
  a.x = 30;
  G.activities.onLand(a);
  assert.equal(G.player.cash, 1500 + 30 * 8);
  assert.equal(G.activities.stuntBest, 30);
});
