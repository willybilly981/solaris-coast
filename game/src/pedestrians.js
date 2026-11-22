// Humanoid meshes plus the sidewalk crowd: walking, panic on gunfire and crashes, cash drops.
import * as THREE from 'three';
import { ROADS, WORLD } from './config.js';

const cache = new Map();
function mat(color) {
  if (!cache.has(color)) cache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 }));
  return cache.get(color);
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const HEAD = new THREE.SphereGeometry(0.15, 10, 8);

function limb(w, h, d, color, y) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(BOX, mat(color));
  m.scale.set(w, h, d);
  m.position.y = -h / 2;
  m.castShadow = true;
  pivot.add(m);
  pivot.position.y = y;
  return pivot;
}

export function createHumanoid({ shirt = '#e85d75', pants = '#2b3a55', skin = '#d9a77b', hair = '#2a1a10', hat = null, gun = false } = {}) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(BOX, mat(shirt));
  torso.scale.set(0.46, 0.64, 0.26);
  torso.position.y = 1.12;
  torso.castShadow = true;
  const head = new THREE.Mesh(HEAD, mat(skin));
  head.position.y = 1.62;
  head.castShadow = true;
  const cap = new THREE.Mesh(HEAD, mat(hat || hair));
  cap.scale.set(1.05, hat ? 0.7 : 0.8, 1.05);
  cap.position.set(0, hat ? 1.72 : 1.68, -0.02);
  const legL = limb(0.18, 0.8, 0.2, pants, 0.8);
  const legR = limb(0.18, 0.8, 0.2, pants, 0.8);
  legL.position.x = -0.12;
  legR.position.x = 0.12;
  const armL = limb(0.14, 0.62, 0.16, shirt, 1.4);
  const armR = limb(0.14, 0.62, 0.16, shirt, 1.4);
  armL.position.x = -0.31;
  armR.position.x = 0.31;
  const weapon = new THREE.Mesh(BOX, mat('#16181d'));
  weapon.scale.set(0.07, 0.1, 0.5);
  weapon.position.set(0, -0.6, 0.22);
  weapon.visible = gun;
  armR.add(weapon);
  g.add(torso, head, cap, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, weapon, phase: Math.random() * 6 };
  return g;
}

/** Swing limbs by walking speed; aiming raises the weapon arm. */
export function animateHumanoid(h, speed, t, aiming) {
  const u = h.userData;
  const k = Math.min(1, speed / 3) * Math.sin(t * Math.min(12, 4 + speed * 1.6) + u.phase);
  u.legL.rotation.x = k * 0.9;
  u.legR.rotation.x = -k * 0.9;
  u.armL.rotation.x = -k * 0.8;
  u.armR.rotation.x = aiming ? -1.45 : k * 0.8;
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
    const mesh = createHumanoid({ shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), skin: rng.pick(SKINS), hair: rng.pick(['#2a1a10', '#111', '#8a5a2a', '#d9b44a']) });
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
    if (x < WORLD.minX || x > 134 || z < WORLD.minZ || z > WORLD.maxZ) return;
    if (Math.hypot(x - px, z - pz) < 25) return;
    const p = P.spawnAt(x, z);
    p.axis = q.axis;
    p.line = q.line;
    if (q.axis === 'z') p.x = q.line;
    else p.z = q.line;
  }

  P.alarm = (x, z, radius) => {
    for (const p of list) {
      if (p.state === 'dead' || Math.hypot(p.x - x, p.z - z) > radius) continue;
      p.state = 'flee';
      p.fleeT = rng.range(5, 9);
      const away = p.axis === 'z' ? p.z - z : p.x - x;
      p.dir = away >= 0 ? 1 : -1;
    }
  };

  P.kill = (p, byPlayer) => {
    if (p.state === 'dead') return;
    p.state = 'dead';
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
    const speed = p.state === 'flee' ? 6.2 : p.speed;
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
    if (p.x < WORLD.minX + 2 || p.x > 134 || p.z < WORLD.minZ + 2 || p.z > WORLD.maxZ - 2) p.dir = -p.dir;
  }

  P.step = (dt, t) => {
    if (list.length < 30 && rng.chance(0.35)) spawnNear();
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
        if (p.fleeT <= 0) p.state = 'walk';
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
      animateHumanoid(p.mesh, p.state === 'flee' ? 6 : p.speed, t, false);
    }
  };

  return P;
}
