// Humanoid meshes plus the sidewalk crowd: walking, panic on gunfire and crashes, cash drops.
import * as THREE from 'three';
import { ROADS, WORLD } from './config.js';
import { mergeGeos, placed, tint } from './geometry.js';
import { shadowDiscTexture } from './textures.js';

const BODY_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.05 });
const GUN_MAT = new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.45, metalness: 0.6 });
const SHADOW_GEO = new THREE.PlaneGeometry(1.7, 1.7);
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowDiscTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const cache = new Map();
const flatShadow = new THREE.Matrix4();
const flatTurn = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const box = (w, h, d, x, y, z, c, rx = 0, rz = 0) => tint(placed(new THREE.BoxGeometry(w, h, d), x, y, z, 0, rx, rz), c);
const ball = (r, sx, sy, sz, x, y, z, c) => tint(placed(new THREE.SphereGeometry(r, 10, 8).scale(sx, sy, sz), x, y, z), c);

/** Head, hair or headgear, and the collared torso: one merged mesh per outfit. */
function bodyGeo(o) {
  const { kind, shirt, skin, hair, hat } = o;
  const dark = shade(shirt, 0.6);
  const parts = [
    box(0.46, 0.3, 0.25, 0, 1.31, 0, shirt),
    box(0.38, 0.34, 0.22, 0, 1.0, 0, shirt),
    box(0.42, 0.06, 0.24, 0, 0.88, 0, '#1a1a1e'),
    box(0.06, 0.05, 0.02, 0, 0.88, 0.125, '#c9ccd2'),
    tint(placed(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 8), 0, 1.5, 0), skin),
    box(0.1, 0.05, 0.12, -0.075, 1.47, 0.04, dark, 0, 0.55),
    box(0.1, 0.05, 0.12, 0.075, 1.47, 0.04, dark, 0, -0.55),
    ball(0.13, 0.95, 1.08, 1, 0, 1.64, 0, skin),
    ball(0.03, 1, 1, 1, -0.135, 1.63, 0, skin),
    ball(0.03, 1, 1, 1, 0.135, 1.63, 0, skin),
    box(0.03, 0.05, 0.05, 0, 1.62, 0.13, shade(skin, 0.9)),
  ];
  if (kind !== 'swat') {
    parts.push(ball(0.016, 1, 1, 1, -0.05, 1.655, 0.12, '#14100e'), ball(0.016, 1, 1, 1, 0.05, 1.655, 0.12, '#14100e'));
  }
  if (kind === 'civ') {
    parts.push(ball(0.14, 1, 0.72, 1.06, 0, 1.69, -0.015, hair), box(0.2, 0.05, 0.05, 0, 1.73, 0.1, hair));
  } else if (kind === 'hero') {
    parts.push(
      ball(0.14, 1, 0.74, 1.06, 0, 1.69, -0.015, hair),
      box(0.16, 0.07, 0.16, 0, 1.78, 0.06, hair, -0.4),
      box(0.27, 0.05, 0.03, 0, 1.65, 0.125, '#0a0c10'),
      box(0.4, 0.03, 0.26, 0, 1.43, 0, '#f2f4f8'),
      box(0.02, 0.5, 0.01, 0, 1.17, 0.13, '#f2f4f8'),
      box(0.1, 0.4, 0.05, -0.15, 1.2, 0.12, shade(shirt, 0.75), 0, 0.12),
      box(0.1, 0.4, 0.05, 0.15, 1.2, 0.12, shade(shirt, 0.75), 0, -0.12),
    );
  } else if (kind === 'cop') {
    parts.push(
      tint(placed(new THREE.CylinderGeometry(0.15, 0.155, 0.1, 12), 0, 1.745, 0), hat),
      box(0.24, 0.025, 0.12, 0, 1.69, 0.15, '#0c0e14'),
      box(0.04, 0.04, 0.01, 0, 1.75, 0.155, '#e8c24a'),
      box(0.5, 0.4, 0.28, 0, 1.2, 0, shade(hat, 0.7)),
      box(0.06, 0.06, 0.01, 0.1, 1.32, 0.145, '#e8c24a'),
      box(0.05, 0.1, 0.04, -0.12, 1.4, 0.15, '#0c0e14'),
    );
  } else if (kind === 'swat') {
    parts.push(
      ball(0.17, 1, 0.86, 1.1, 0, 1.69, -0.01, hat),
      box(0.25, 0.07, 0.06, 0, 1.655, 0.14, '#0a2236'),
      box(0.2, 0.08, 0.05, 0, 1.55, 0.11, '#0b0d12'),
      box(0.54, 0.46, 0.32, 0, 1.2, 0, '#0d1017'),
      box(0.14, 0.12, 0.07, -0.13, 1.1, 0.18, '#171b25'),
      box(0.14, 0.12, 0.07, 0.13, 1.1, 0.18, '#171b25'),
      ball(0.09, 1, 0.8, 1, -0.3, 1.43, 0, '#0d1017'),
      ball(0.09, 1, 0.8, 1, 0.3, 1.43, 0, '#0d1017'),
    );
  } else {
    parts.push(
      ball(0.145, 1, 0.8, 1.06, 0, 1.7, -0.01, hat),
      box(0.3, 0.04, 0.27, 0, 1.63, -0.005, hat),
      box(0.2, 0.08, 0.05, 0, 1.55, 0.11, '#0c0a10'),
      ball(0.2, 1, 0.55, 0.8, 0, 1.46, -0.1, hat),
    );
  }
  return mergeGeos(parts);
}

function limbGeos(o) {
  const long = o.kind !== 'civ' && o.kind !== 'hero';
  const sleeve = o.kind === 'swat' ? '#0d1017' : o.shirt;
  const glove = o.kind === 'swat' ? '#0b0d12' : o.skin;
  const bare = long ? sleeve : o.skin;
  const boot = o.kind === 'civ' || o.kind === 'hero' ? '#2a2420' : '#0e0f13';
  return {
    upper: mergeGeos([box(0.12, 0.3, 0.13, 0, -0.15, 0, sleeve), ball(0.075, 1, 1, 1, 0, 0, 0, sleeve)]),
    fore: mergeGeos([box(0.1, 0.28, 0.11, 0, -0.14, 0, bare), ball(0.052, 1, 1, 1, 0, -0.3, 0, glove)]),
    thigh: mergeGeos([box(0.17, 0.46, 0.19, 0, -0.23, 0, o.pants)]),
    shin: mergeGeos([box(0.15, 0.4, 0.17, 0, -0.2, 0, o.pants), box(0.16, 0.08, 0.29, 0, -0.42, 0.05, boot)]),
  };
}

// built along +z, then turned so the barrel points down the forearm (-y)
const WEAPON_GEO = mergeGeos([
  box(0.06, 0.1, 0.32, 0, 0, 0.12, '#1a1d24'),
  box(0.035, 0.035, 0.3, 0, 0.015, 0.42, '#0c0e12'),
  box(0.05, 0.13, 0.07, 0, -0.1, 0.04, '#14161c', 0.2),
  box(0.05, 0.14, 0.06, 0, -0.1, 0.2, '#101216'),
  box(0.05, 0.09, 0.16, 0, -0.01, -0.12, '#14161c'),
]).rotateX(Math.PI / 2);

export function createHumanoid({ shirt = '#e85d75', pants = '#2b3a55', skin = '#d9a77b', hair = '#2a1a10', hat = null, gun = false, kind = 'civ', phase = 0 } = {}) {
  const o = { kind, shirt, pants, skin, hair, hat: hat || hair };
  const key = [kind, shirt, pants, skin, hair, hat].join('|');
  if (!cache.has(key)) cache.set(key, { body: bodyGeo(o), ...limbGeos(o) });
  const geo = cache.get(key);
  const g = new THREE.Group();
  const mesh = (geometry) => {
    const m = new THREE.Mesh(geometry, BODY_MAT);
    m.castShadow = true;
    return m;
  };
  const joint = (upperGeo, lowerGeo, x, y, drop) => {
    const top = new THREE.Group();
    top.position.set(x, y, 0);
    const low = new THREE.Group();
    low.position.y = drop;
    top.add(mesh(upperGeo), low);
    low.add(mesh(lowerGeo));
    g.add(top);
    return [top, low];
  };
  const [legL, shinL] = joint(geo.thigh, geo.shin, -0.1, 0.9, -0.46);
  const [legR, shinR] = joint(geo.thigh, geo.shin, 0.1, 0.9, -0.46);
  const [armL, foreL] = joint(geo.upper, geo.fore, -0.29, 1.42, -0.3);
  const [armR, foreR] = joint(geo.upper, geo.fore, 0.29, 1.42, -0.3);
  const weapon = new THREE.Mesh(WEAPON_GEO, GUN_MAT);
  weapon.position.set(0, -0.3, 0.02);
  weapon.castShadow = true;
  weapon.visible = gun;
  foreR.add(weapon);
  const shadow = new THREE.Mesh(SHADOW_GEO, shadowMat);
  shadow.renderOrder = 1;
  // stays flat on the ground in world space, even when the body topples
  shadow.updateMatrixWorld = function flat() {
    flatShadow.makeTranslation(this.parent.position.x, 0.235, this.parent.position.z);
    this.matrixWorld.multiplyMatrices(flatShadow, flatTurn);
  };
  g.add(mesh(geo.body), shadow);
  g.userData = { legL, legR, shinL, shinR, armL, armR, foreL, foreR, weapon, phase };
  return g;
}

/** Stride with knee and elbow bend; aiming raises both arms into a two-handed hold, handsUp into a panicked wave. */
export function animateHumanoid(h, speed, t, aiming, handsUp = false) {
  const u = h.userData;
  const amp = Math.min(1, speed / 3);
  const ph = t * Math.min(12, 4 + speed * 1.6) + u.phase;
  const s = Math.sin(ph) * amp;
  const c = Math.cos(ph) * amp;
  u.legL.rotation.x = s * 0.85;
  u.legR.rotation.x = -s * 0.85;
  u.shinL.rotation.x = Math.max(0, -c) * 1.05;
  u.shinR.rotation.x = Math.max(0, c) * 1.05;
  if (handsUp) {
    const wave = Math.sin(t * 9 + u.phase) * 0.14;
    u.armL.rotation.set(-2.75 + wave, 0, 0.32);
    u.armR.rotation.set(-2.75 - wave, 0, -0.32);
    u.foreL.rotation.x = -0.22;
    u.foreR.rotation.x = -0.22;
    return;
  }
  if (aiming) {
    u.armR.rotation.set(-1.42, 0, -0.04);
    u.foreR.rotation.x = -0.12;
    u.armL.rotation.set(-1.25, 0, 0.4);
    u.foreL.rotation.x = -0.35;
    return;
  }
  u.armL.rotation.set(-s * 0.7, 0, 0.05);
  u.armR.rotation.set(s * 0.7, 0, -0.05);
  u.foreL.rotation.x = -0.18 - Math.max(0, s) * 0.5;
  u.foreR.rotation.x = -0.18 - Math.max(0, -s) * 0.5;
}

const SHIRTS = ['#e85d75', '#4aa8ff', '#f2c94c', '#6bd68a', '#c58bff', '#ff8f4a', '#f4f4f4', '#2dc7c7'];
const PANTS = ['#2b3a55', '#3b3b3b', '#6b5a43', '#1f2a44', '#8a8a8a'];
const SKINS = ['#e9b88f', '#d9a77b', '#b57a54', '#8a5a3a', '#f1c9a5'];

export function createPeds(G) {
  const list = [];
  const P = { list };
  const rng = G.rng;

  function pickLine() {
    const axis = rng.chance(0.5) ? 'z' : 'x';
    const centers = axis === 'z' ? ROADS.x : ROADS.z;
    const c = rng.pick(centers);
    return { axis, line: c + rng.sign() * ROADS.walk };
  }

  P.spawnAt = (x, z, o = {}) => {
    const mesh = createHumanoid({ shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), skin: rng.pick(SKINS), hair: rng.pick(['#2a1a10', '#111', '#8a5a2a', '#d9b44a']), phase: rng.range(0, 6) });
    G.scene.add(mesh);
    const near = pickLine();
    const p = { mesh, x, z, axis: near.axis, line: near.line, dir: rng.sign(), speed: rng.range(1.3, 2.1), hp: 30, state: o.flee ? 'flee' : 'walk', fleeT: o.flee ? 6 : 0, dead: 0, lastC: null, cash: rng.int(8, 60), rot: 0 };
    list.push(p);
    return p;
  };

  function spawnNear() {
    const q = pickLine();
    const px = G.player.x;
    const pz = G.player.z;
    const ahead = rng.range(-70, 70);
    const x = q.axis === 'z' ? q.line : px + ahead;
    const z = q.axis === 'z' ? pz + ahead : q.line;
    if (x < WORLD.minX || x > 144 || z < WORLD.minZ || z > WORLD.maxZ) return;
    if (Math.hypot(x - px, z - pz) < 25) return;
    const p = P.spawnAt(x, z);
    p.axis = q.axis;
    p.line = q.line;
    if (q.axis === 'z') p.x = q.line;
    else p.z = q.line;
  }

  /** Everyone in range flees; those right next to the noise freeze, hands up, and back away instead of sprinting. */
  P.alarm = (x, z, radius) => {
    for (const p of list) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (p.state === 'dead' || d > radius) continue;
      p.state = 'flee';
      p.handsUp = d < radius * 0.4 && rng.chance(0.6);
      p.fleeT = rng.range(5, 9);
      const away = p.axis === 'z' ? p.z - z : p.x - x;
      p.dir = away >= 0 ? 1 : -1;
    }
  };

  P.kill = (p, byPlayer) => {
    if (p.state === 'dead') return;
    p.state = 'dead';
    p.handsUp = false;
    p.dead = 0;
    G.combat.spawnPickup('cash', p.x, p.z, p.cash);
    if (byPlayer) G.police.addHeat(12, 'civilian down');
    G.alarm(p.x, p.z, 30);
  };

  P.damage = (p, dmg, byPlayer) => {
    p.hp -= dmg;
    if (p.hp <= 0) P.kill(p, byPlayer);
    else {
      p.state = 'flee';
      p.fleeT = 7;
    }
  };

  function walk(p, dt) {
    const speed = p.state === 'flee' ? (p.handsUp ? 4.4 : 6.2) : p.speed;
    const c = p.axis === 'z' ? p.z : p.x;
    const next = c + p.dir * speed * dt;
    const crossings = p.axis === 'z' ? ROADS.z : ROADS.x;
    for (const r of crossings) {
      const corner = r - p.dir * ROADS.walk;
      if (p.lastC !== r && (c - corner) * p.dir < 0 && (next - corner) * p.dir >= 0) {
        p.lastC = r;
        if (rng.chance(0.4) && p.state === 'walk') {
          const crossLine = p.axis === 'z' ? p.x : p.z;
          const centers = p.axis === 'z' ? ROADS.x : ROADS.z;
          const c0 = centers.find((a) => Math.abs(a - crossLine) < ROADS.walk + 0.1);
          if (c0 !== undefined) {
            const newDir = rng.sign();
            if (p.axis === 'z') {
              p.z = corner;
              p.axis = 'x';
              p.line = corner;
            } else {
              p.x = corner;
              p.axis = 'z';
              p.line = corner;
            }
            p.dir = newDir;
            p.lastC = null;
            return;
          }
        }
      }
    }
    if (p.axis === 'z') {
      p.z = next;
      p.x += (p.line - p.x) * Math.min(1, dt * 4);
    } else {
      p.x = next;
      p.z += (p.line - p.z) * Math.min(1, dt * 4);
    }
    if (p.x < WORLD.minX + 2 || p.x > 144 || p.z < WORLD.minZ + 2 || p.z > WORLD.maxZ - 2) p.dir = -p.dir;
  }

  P.step = (dt, t) => {
    if (list.length < 46 && rng.chance(0.5)) spawnNear();
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      const far = Math.hypot(p.x - G.player.x, p.z - G.player.z);
      if (far > 120 || (p.state === 'dead' && p.dead > 14)) {
        G.scene.remove(p.mesh);
        list.splice(i, 1);
        continue;
      }
      if (p.state === 'dead') {
        p.dead += dt;
        p.rot = Math.min(1, p.rot + dt * 3);
        p.mesh.rotation.x = -p.rot * Math.PI / 2;
        p.mesh.position.set(p.x, 0.25 * p.rot + 0.2, p.z);
        continue;
      }
      if (p.state === 'flee') {
        p.fleeT -= dt;
        if (p.fleeT <= 0) {
          p.state = 'walk';
          p.handsUp = false;
        }
      }
      walk(p, dt);
      for (const v of G.vehicles.list) {
        if (Math.abs(v.x - p.x) > 5 || Math.abs(v.z - p.z) > 5) continue;
        const sp = Math.hypot(v.vx, v.vz);
        if (sp > 3.2 && Math.hypot(v.x - p.x, v.z - p.z) < v.spec.len * 0.5 + 0.2) {
          P.kill(p, v.driver === 'player');
          break;
        }
      }
      const heading = p.axis === 'z' ? (p.dir > 0 ? 0 : Math.PI) : p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.mesh.position.set(p.x, 0.2, p.z);
      p.mesh.rotation.y = heading;
      animateHumanoid(p.mesh, p.state === 'flee' ? 6 : p.speed, t, false, p.handsUp);
    }
  };

  return P;
}
