// Career progression: ranks and RP, Solaris Relics, mission grades, career stats and the completion formula.
import * as THREE from 'three';
import { DISTRICTS, MISSIONS, WEAPONS, districtAt } from './config.js';

export const RANKS = [
  { name: 'DRIFTER', rp: 0 }, { name: 'RUNNER', rp: 250 }, { name: 'FIXER', rp: 700 },
  { name: 'ENFORCER', rp: 1400 }, { name: 'KINGPIN', rp: 2500 }, { name: 'LEGEND', rp: 4200 },
];

export const RELIC_REWARD = { cash: 1500, rp: 120 };

// every spot sits on a road or promenade centre line, so no building ever covers a relic
export const RELIC_SPOTS = [
  { id: 'r1', name: 'Lifeguard Tower', area: 'OCEANFRONT', x: 195, z: 40 },
  { id: 'r2', name: 'Boardwalk Rail', area: 'OCEANFRONT', x: 180, z: -30 },
  { id: 'r3', name: 'Plaza Overlook', area: 'DOWNTOWN', x: 60, z: -65 },
  { id: 'r4', name: 'Avenue Three Junction', area: 'DOWNTOWN', x: -20, z: -110 },
  { id: 'r5', name: 'Race Marina Gate', area: 'MARINA', x: 130, z: 100 },
  { id: 'r6', name: 'Fuel Pier', area: 'MARINA', x: 60, z: 78 },
  { id: 'r7', name: 'Depot Dock', area: 'INDUSTRIAL DOCKS', x: 95, z: 105 },
  { id: 'r8', name: 'Quay Gantry', area: 'INDUSTRIAL DOCKS', x: -20, z: 150 },
  { id: 'r9', name: 'Neon Corner', area: 'SUNSET STRIP', x: -115, z: 20 },
  { id: 'r10', name: 'Sunset Overlook', area: 'SUNSET STRIP', x: -115, z: -60 },
  { id: 'r11', name: 'Plaza Palms', area: 'PALMS PLAZA', x: -200, z: -60 },
  { id: 'r12', name: 'Garage Alley', area: 'PALMS PLAZA', x: -170, z: -38 },
].map((r) => ({ ...r, district: districtAt(r.x, r.z) }));

export const GARAGE_IDS = ['repair', 'respray', 'tune', 'armor', 'nitro', 'ammo', 'clear'];
const SIDE_TARGETS = { races: 3, stunts: 5, takedowns: 25 };
const EVADE_TARGET = 10;
export const WEIGHTS = { contracts: 30, relics: 20, districts: 5, garage: 10, sideOps: 12, evades: 8, rank: 15 };
const GRADE_RP = { G: 100, S: 50, B: 0 };

/** Coerces untrusted save data (localStorage can hold anything) into a well-formed progress record. */
export function normalizeProgress(s) {
  const d = s && typeof s === 'object' ? s : {};
  const n = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : {});
  const grades = Object.fromEntries(Object.entries(obj(d.grades)).filter(([, g]) => typeof g === 'string' && Object.hasOwn(GRADE_RP, g)));
  const ids = (v, ok) => (Array.isArray(v) ? [...new Set(v.filter((x) => ok.includes(x)))] : []);
  const st = obj(d.stats);
  return {
    rp: n(d.rp), relics: ids(d.relics, RELIC_SPOTS.map((r) => r.id)), grades, garage: obj(d.garage),
    explored: ids(d.explored, DISTRICTS.map((x) => x.id)), races: n(d.races), stunts: n(d.stunts), evades: n(d.evades),
    stats: { distance: n(st.distance), topSpeed: n(st.topSpeed), takedowns: n(st.takedowns), maxHeat: n(st.maxHeat), earned: n(st.earned) },
  };
}

export function getRankInfo(rp) {
  let i = 0;
  RANKS.forEach((r, k) => {
    if (rp >= r.rp) i = k;
  });
  const floor = RANKS[i].rp;
  const next = i < RANKS.length - 1 ? RANKS[i + 1].rp : null;
  return {
    rank: i + 1, name: RANKS[i].name, label: `RANK ${i + 1} - ${RANKS[i].name}`, rp, floor, next,
    pct: next === null ? 1 : (rp - floor) / (next - floor),
  };
}

export const weaponUnlocked = (rp, i) => getRankInfo(rp).rank >= WEAPONS[i].rank;

/** Gold needs a fast, clean, low-heat run; each axis scores 0 to 2 and 5 or more of 6 is gold. */
export function gradeMission({ time, par, damage, stars }) {
  const t = time <= par ? 2 : time <= par * 1.6 ? 1 : 0;
  const d = damage < 20 ? 2 : damage < 50 ? 1 : 0;
  const s = stars === 0 ? 2 : stars <= 2 ? 1 : 0;
  const total = t + d + s;
  return total >= 5 ? 'G' : total >= 3 ? 'S' : 'B';
}

/** Weighted completion from one save record; every part is 0..1 and the weights sum to 100. */
export function computeCompletion(save) {
  const p = normalizeProgress(save.progress);
  const st = p.stats;
  const part = (n, of) => Math.min(1, n / of);
  const parts = {
    contracts: part(Number.isFinite(save.missions) ? save.missions : 0, MISSIONS.length),
    relics: part(p.relics.length, RELIC_SPOTS.length),
    districts: part(p.explored.length, DISTRICTS.length),
    garage: part(GARAGE_IDS.filter((id) => p.garage[id]).length, GARAGE_IDS.length),
    sideOps: (part(p.races, SIDE_TARGETS.races) + part(p.stunts, SIDE_TARGETS.stunts) + part(st.takedowns, SIDE_TARGETS.takedowns)) / 3,
    evades: part(p.evades, EVADE_TARGET),
    rank: part(p.rp, RANKS[RANKS.length - 1].rp),
  };
  const pct = Object.keys(WEIGHTS).reduce((a, k) => a + parts[k] * WEIGHTS[k], 0);
  return { pct: Math.round(pct * 10) / 10, parts };
}

/** Title and save-tab card data for one slot record, or null for an empty slot. */
export function summarizeSlot(d) {
  if (!d) return null;
  return {
    district: (DISTRICTS.find((x) => x.id === d.where) || DISTRICTS[0]).name, rank: getRankInfo(normalizeProgress(d.progress).rp).label,
    cash: d.cash, pct: computeCompletion(d).pct,
  };
}

const relicGeo = {
  core: new THREE.OctahedronGeometry(0.7),
  orbit: new THREE.TorusGeometry(1.05, 0.07, 8, 28),
  ground: new THREE.RingGeometry(1.5, 1.85, 40),
};
const relicMat = {
  core: new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#ff9a1a', emissiveIntensity: 1.2, roughness: 0.25, metalness: 0.6 }),
  orbit: new THREE.MeshBasicMaterial({ color: '#fff0b0' }),
  ground: new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
};

function buildRelic(G, spot) {
  const g = new THREE.Group();
  g.position.set(spot.x, 0, spot.z);
  const core = new THREE.Mesh(relicGeo.core, relicMat.core);
  const orbit = new THREE.Mesh(relicGeo.orbit, relicMat.orbit);
  const ground = new THREE.Mesh(relicGeo.ground, relicMat.ground);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex, color: '#ffc24a', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(4.2, 4.2, 1);
  core.position.y = 1.5;
  orbit.position.y = 1.5;
  glow.position.y = 1.5;
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.32;
  g.add(core, orbit, glow, ground);
  g.userData = { core, orbit, ground, glow };
  G.scene.add(g);
  return g;
}

export function createProgress(G) {
  const R = { ...normalizeProgress(null), run: null, last: { cash: 0, x: 0, z: 0 } };
  const meshes = new Map(RELIC_SPOTS.map((s) => [s.id, buildRelic(G, s)]));
  const toastFn = (msg) => G.hud.toast(msg);

  R.rank = () => getRankInfo(R.rp);

  R.addRp = (n) => {
    const before = R.rank().rank;
    R.rp += n;
    const now = R.rank();
    if (now.rank > before) {
      const unlock = WEAPONS.filter((w) => w.rank === now.rank).map((w) => w.name.toUpperCase());
      toastFn(`${now.label}${unlock.length ? `  UNLOCKED ${unlock.join(', ')}` : ''}`);
    }
  };

  R.state = () => ({
    rp: R.rp, relics: [...R.relics], grades: { ...R.grades }, garage: { ...R.garage }, explored: [...R.explored],
    races: R.races, stunts: R.stunts, evades: R.evades, stats: { ...R.stats },
  });

  R.load = (s) => {
    Object.assign(R, normalizeProgress(s), { run: null });
    R.last.cash = G.player.cash;
    for (const [id, m] of meshes) m.visible = !R.relics.includes(id);
  };

  R.completion = () => computeCompletion({ missions: G.missions.done, progress: R.state() });

  R.startMission = () => {
    R.run = { t0: G.time(), dmg: 0, maxStars: G.police.stars };
  };

  R.onHurt = (pct) => {
    if (R.run) R.run.dmg += pct;
  };

  /** Grades the run, stores the best grade per contract and pays RP. */
  R.finishMission = (def) => {
    const run = R.run || { t0: G.time(), dmg: 0, maxStars: 0 };
    const time = G.time() - run.t0;
    const grade = gradeMission({ time, par: def.par, damage: run.dmg, stars: run.maxStars });
    const old = R.grades[def.id];
    if (!old || GRADE_RP[grade] > GRADE_RP[old]) R.grades[def.id] = grade;
    const rp = Math.round(def.cash / 8) + GRADE_RP[grade];
    R.addRp(rp);
    R.run = null;
    return { grade, rp, time };
  };

  R.onGarage = (id) => {
    R.garage[id] = true;
  };
  R.onRace = () => {
    R.races += 1;
    R.addRp(80);
  };
  R.onStunt = () => {
    R.stunts += 1;
    R.addRp(25);
  };
  R.onTakedown = () => {
    R.stats.takedowns += 1;
    R.addRp(8);
  };
  R.onEvade = (stars) => {
    R.evades += 1;
    R.stats.maxHeat = Math.max(R.stats.maxHeat, stars);
    R.addRp(40 * stars);
  };

  function collect(spot) {
    R.relics.push(spot.id);
    meshes.get(spot.id).visible = false;
    G.player.cash += RELIC_REWARD.cash;
    R.addRp(RELIC_REWARD.rp);
    G.audio.pickup();
    toastFn(`RELIC ${R.relics.length}/${RELIC_SPOTS.length}  +$${RELIC_REWARD.cash.toLocaleString('en-US')}`);
  }

  R.step = (dt, t) => {
    const pl = G.player;
    for (const spot of RELIC_SPOTS) {
      if (R.relics.includes(spot.id)) continue;
      const m = meshes.get(spot.id);
      m.userData.core.rotation.y = t * 1.8;
      m.userData.core.position.y = 1.5 + Math.sin(t * 2.4 + spot.x) * 0.15;
      m.userData.orbit.rotation.set(t * 0.9, t * 1.4, 0);
      m.userData.ground.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      if (Math.hypot(pl.x - spot.x, pl.z - spot.z) < (pl.inVehicle ? 6.5 : 2.8)) collect(spot);
    }
    const step = Math.hypot(pl.x - R.last.x, pl.z - R.last.z);
    if (pl.inVehicle && step < 8) {
      R.stats.distance += step;
      R.stats.topSpeed = Math.max(R.stats.topSpeed, Math.abs(pl.vehicle.speed) * 3.6);
    }
    R.last.x = pl.x;
    R.last.z = pl.z;
    R.stats.earned += Math.max(0, pl.cash - R.last.cash);
    R.last.cash = pl.cash;
    const did = districtAt(pl.x, pl.z);
    if (!R.explored.includes(did)) R.explored.push(did);
    if (R.run) R.run.maxStars = Math.max(R.run.maxStars, G.police.stars);
  };

  R.load(null);
  return R;
}
