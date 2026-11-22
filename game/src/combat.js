// Combat: particles and explosions, weapons and hitscan, pickups, Obsidian Syndicate gunmen.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { animateHumanoid, createHumanoid } from './pedestrians.js';

const VERT = `
attribute float size; attribute float alpha; attribute vec3 pcolor;
uniform float scale; varying float vA; varying vec3 vC;
void main(){ vA=alpha; vC=pcolor; vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_PointSize=size*scale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const FRAG = `
uniform sampler2D map; varying float vA; varying vec3 vC;
void main(){ float a=texture2D(map,gl_PointCoord).a*vA; gl_FragColor=vec4(vC,a); }`;

function makePool(scene, max, additive, tex) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('pcolor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 500 } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  scene.add(points);
  const items = [];
  let cursor = 0;
  return {
    material,
    add(p) {
      p.life = p.max;
      if (items.length < max) items.push(p);
      else {
        items[cursor] = p;
        cursor = (cursor + 1) % max;
      }
    },
    update(dt) {
      let n = 0;
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const p = items[i];
        p.life -= dt;
        if (p.life <= 0) {
          items[i] = items[items.length - 1];
          items.pop();
          continue;
        }
      }
      for (const p of items) {
        const k = 1 - p.life / p.max;
        p.vy += (p.grav || 0) * dt;
        const d = Math.exp(-(p.drag || 0) * dt);
        p.vx *= d;
        p.vy *= d;
        p.vz *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        pos[n * 3] = p.x;
        pos[n * 3 + 1] = p.y;
        pos[n * 3 + 2] = p.z;
        col[n * 3] = p.r;
        col[n * 3 + 1] = p.g;
        col[n * 3 + 2] = p.b;
        size[n] = p.s0 + (p.s1 - p.s0) * k;
        alpha[n] = p.a * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
        n += 1;
      }
      for (let i = n; i < max; i += 1) alpha[i] = 0;
      g.attributes.position.needsUpdate = true;
      g.attributes.pcolor.needsUpdate = true;
      g.attributes.size.needsUpdate = true;
      g.attributes.alpha.needsUpdate = true;
    },
  };
}

export function createFx(G, glow) {
  const soft = makePool(G.scene, 700, false, glow);
  const hot = makePool(G.scene, 900, true, glow);
  const c = new THREE.Color();
  const rnd = (a) => (Math.random() - 0.5) * a;
  const part = (pool, x, y, z, vx, vy, vz, life, s0, s1, color, a, grav = 0, drag = 0) => {
    c.set(color);
    pool.add({ x, y, z, vx, vy, vz, max: life, s0, s1, r: c.r, g: c.g, b: c.b, a, grav, drag });
  };
  const balls = [];
  const flash = new THREE.PointLight('#ffb060', 0, 40, 1.6);
  G.scene.add(flash);
  const muzzle = new THREE.PointLight('#ffd080', 0, 14, 2);
  G.scene.add(muzzle);
  const tracers = [];
  const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 48; i += 1) {
    const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: '#fff0a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false;
    G.scene.add(m);
    tracers.push({ m, life: 0 });
  }
  let tracerAt = 0;
  let flashT = 0;
  let muzzleT = 0;

  const fx = {
    soft, hot,
    smoke: (x, y, z, s = 1, dark = false) => part(soft, x + rnd(0.5), y, z + rnd(0.5), rnd(0.8), 1.6 + Math.random(), rnd(0.8), 1.7 + Math.random() * 0.8, 1.2 * s, 4.2 * s, dark ? '#1a1816' : '#9a9690', dark ? 0.7 : 0.45, 0.2, 0.3),
    fire: (x, y, z) => part(hot, x, y, z, rnd(1.2), 2.4 + Math.random() * 2, rnd(1.2), 0.5 + Math.random() * 0.3, 1.5, 0.3, Math.random() < 0.5 ? '#ff7a1a' : '#ffc23a', 0.95, 0, 0.5),
    // Burning wreck: layered flames (red base, orange body, yellow core), billowing dark smoke, flying embers.
    blaze: (x, y, z, heading, len, k = 1) => {
      const sx = Math.sin(heading);
      const sz = Math.cos(heading);
      const at = () => {
        const u = rnd(len * 0.8);
        const w = rnd(1.3);
        return [x + sx * u + sz * w, z + sz * u - sx * w];
      };
      let [px, pz] = at();
      part(hot, px, y + 0.5, pz, rnd(0.8), 1.8 + Math.random() * 2, rnd(0.8), 0.6 + Math.random() * 0.4, 2.4 * k, 0.5, '#ff3a0a', 0.55, 0, 0.5);
      [px, pz] = at();
      part(hot, px, y + 0.7, pz, rnd(0.6), 2.6 + Math.random() * 2.6, rnd(0.6), 0.5 + Math.random() * 0.35, 1.8 * k, 0.35, Math.random() < 0.5 ? '#ff7a1a' : '#ff9d2a', 0.9, 0, 0.5);
      if (Math.random() < 0.7) {
        [px, pz] = at();
        part(hot, px, y + 0.9, pz, rnd(0.3), 3.4 + Math.random() * 2, rnd(0.3), 0.35 + Math.random() * 0.25, 1.1 * k, 0.2, Math.random() < 0.5 ? '#ffd75a' : '#fff2b0', 0.95, 0, 0.4);
      }
      if (Math.random() < 0.55) part(soft, x + rnd(1.6), y + 1.6, z + rnd(1.6), 0.7 + rnd(0.6), 2.6 + Math.random() * 1.6, rnd(0.8), 2.6 + Math.random() * 1.6, 1.4 * k, 6.5 * k, Math.random() < 0.5 ? '#1c1a19' : '#4a4743', 0.62, 0.15, 0.35);
      if (Math.random() < 0.2) part(hot, x + rnd(1.2), y + 1, z + rnd(1.6), rnd(5), 4 + Math.random() * 6, rnd(5), 0.7 + Math.random() * 0.6, 0.28, 0.08, '#ffb040', 1, -9, 0.3);
      if (Math.random() < 0.25) part(hot, x, y + 1.2, z, 0, 0.3, 0, 0.5, 6 * k, 6 * k, '#ff6a1a', 0.18);
    },
    spark: (x, y, z, n = 6) => {
      for (let i = 0; i < n; i += 1) part(hot, x, y, z, rnd(9), 2 + Math.random() * 5, rnd(9), 0.25 + Math.random() * 0.3, 0.35, 0.1, '#ffd470', 1, -16, 0.5);
    },
    dust: (x, y, z, n = 6) => {
      for (let i = 0; i < n; i += 1) part(soft, x + rnd(1.5), y, z + rnd(1.5), rnd(4), 0.8 + Math.random(), rnd(4), 0.9, 0.8, 3.2, '#b8a58a', 0.4, 0, 1.2);
    },
    muzzle: (x, y, z, color) => {
      part(hot, x, y, z, 0, 0, 0, 0.07, 0.7, 1.1, color, 0.85);
      muzzle.position.set(x, y, z);
      muzzle.color.set(color);
      muzzleT = 0.06;
    },
    tracer: (a, b, color, w = 0.05) => {
      const t = tracers[tracerAt];
      tracerAt = (tracerAt + 1) % tracers.length;
      const len = Math.max(0.1, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
      t.m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      t.m.scale.set(w, w, len);
      t.m.lookAt(b.x, b.y, b.z);
      t.m.material.color.set(color);
      t.m.visible = true;
      t.life = 0.09;
    },
    explosion: (x, y, z, size = 1) => {
      for (let i = 0; i < 34; i += 1) {
        const a = Math.random() * 6.28;
        const sp = (3 + Math.random() * 9) * size;
        part(hot, x, y, z, Math.cos(a) * sp, 2 + Math.random() * 9 * size, Math.sin(a) * sp, 0.6 + Math.random() * 0.7, 3.2 * size, 0.6, Math.random() < 0.4 ? '#ff5a12' : '#ffb830', 0.95, -3, 1.4);
      }
      for (let i = 0; i < 22; i += 1) part(soft, x + rnd(3), y + Math.random() * 2, z + rnd(3), rnd(5), 3 + Math.random() * 4, rnd(5), 2.4 + Math.random() * 1.6, 3 * size, 8 * size, '#22201e', 0.75, 0.3, 0.6);
      fx.spark(x, y, z, 30);
      const ball = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex, color: '#ff9a3a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      ball.position.set(x, y, z);
      G.scene.add(ball);
      balls.push({ m: ball, t: 0, size: 4.5 * size });
      flash.position.set(x, y + 2, z);
      flashT = 0.6;
      G.shake(0.9 * size);
    },
  };

  fx.update = (dt) => {
    soft.update(dt);
    hot.update(dt);
    for (let i = balls.length - 1; i >= 0; i -= 1) {
      const b = balls[i];
      b.t += dt;
      const k = b.t / 0.55;
      b.m.scale.setScalar(b.size * (0.5 + Math.sqrt(Math.min(1, k)) * 1.6));
      b.m.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) {
        G.scene.remove(b.m);
        b.m.material.dispose();
        balls.splice(i, 1);
      }
    }
    flashT = Math.max(0, flashT - dt);
    flash.intensity = flashT * 520;
    muzzleT = Math.max(0, muzzleT - dt);
    muzzle.intensity = muzzleT > 0 ? 18 : 0;
    for (const t of tracers) {
      if (t.life > 0) {
        t.life -= dt;
        if (t.life <= 0) t.m.visible = false;
      }
    }
  };
  fx.setScale = (h, fov) => {
    const s = h / (2 * Math.tan((fov * Math.PI) / 360));
    soft.material.uniforms.scale.value = s;
    hot.material.uniforms.scale.value = s;
  };
  return fx;
}

export function newWeaponState() {
  return WEAPONS.map((w) => ({ id: w.id, mag: w.mag, reserve: w.reserve, cd: 0, reload: 0 }));
}

function rayCircle(ox, oz, dx, dz, cx, cz, r) {
  const fx = cx - ox;
  const fz = cz - oz;
  const t = fx * dx + fz * dz;
  if (t < 0) return -1;
  const d2 = fx * fx + fz * fz - t * t;
  if (d2 > r * r) return -1;
  return t - Math.sqrt(r * r - d2);
}

function rayBox(ox, oz, dx, dz, c) {
  let t0 = 0;
  let t1 = 1e9;
  for (const [o, d, lo, hi] of [[ox, dx, c.x0, c.x1], [oz, dz, c.z0, c.z1]]) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return -1;
    } else {
      let a = (lo - o) / d;
      let b = (hi - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return -1;
    }
  }
  return t0;
}

export function createCombat(G) {
  const C = { enemies: [], pickups: [] };
  const rng = G.rng;
  const pickupGeo = new THREE.OctahedronGeometry(0.42);
  const PK = { health: '#ff4a6a', armor: '#4aa8ff', ammo: '#ffd24a', cash: '#4aff7a' };

  C.spawnPickup = (kind, x, z, value) => {
    const m = new THREE.Mesh(pickupGeo, new THREE.MeshStandardMaterial({ color: PK[kind], emissive: PK[kind], emissiveIntensity: 0.9, roughness: 0.3 }));
    m.position.set(x, 0.9, z);
    m.castShadow = false;
    G.scene.add(m);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex, color: PK[kind], transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(2.4, 2.4, 1);
    m.add(halo);
    C.pickups.push({ kind, x, z, value, m, t: rng.range(0, 6), life: kind === 'cash' ? 40 : 1e9 });
  };

  function targets(faction) {
    const out = [];
    if (faction !== 'enemy') for (const e of C.enemies) if (e.hp > 0) out.push({ x: e.x, z: e.z, r: 0.5, kind: 'enemy', ref: e });
    if (faction !== 'police') for (const o of G.police.officers) if (o.hp > 0) out.push({ x: o.x, z: o.z, r: 0.5, kind: 'officer', ref: o });
    for (const p of G.peds.list) if (p.state !== 'dead') out.push({ x: p.x, z: p.z, r: 0.45, kind: 'ped', ref: p });
    for (const v of G.vehicles.list) {
      if (v.dead && faction !== 'player') continue;
      const sx = Math.sin(v.heading);
      const sz = Math.cos(v.heading);
      for (const off of [-0.3, 0, 0.3]) out.push({ x: v.x + sx * v.spec.len * off, z: v.z + sz * v.spec.len * off, r: v.spec.wid * 0.55, kind: 'vehicle', ref: v });
    }
    if (faction !== 'player' && !G.player.inVehicle) out.push({ x: G.player.x, z: G.player.z, r: 0.5, kind: 'player', ref: G.player });
    return out;
  }

  C.damageTarget = (hit, dmg, faction) => {
    const t = hit.ref;
    if (hit.kind === 'enemy') C.hurtEnemy(t, dmg, faction === 'player');
    else if (hit.kind === 'officer') G.police.hurtOfficer(t, dmg, faction === 'player');
    else if (hit.kind === 'ped') G.peds.damage(t, dmg, faction === 'player');
    else if (hit.kind === 'vehicle') {
      if (faction === 'player' && t.driver !== 'player') {
        if (t.owner === 'police') G.police.addHeat(4, 'police vehicle fired on');
        else if (t.owner === 'traffic' && t.driver) G.police.addHeat(1.2, 'shots at vehicle');
        t.panic = 4;
      }
      if (t.driver === 'player') G.player.hurt(dmg * 0.35, 'bullet');
      G.vehicles.damage(t, dmg * 0.6, faction === 'player' ? 'player' : 'bullet');
    } else if (hit.kind === 'player') G.player.hurt(dmg, 'bullet');
  };

  /** Hitscan from (ox, oy, oz) along heading `dir`. Returns the end point. */
  C.shoot = (ox, oy, oz, dir, weapon, faction, ignore) => {
    const list = targets(faction);
    const end = { x: 0, y: oy, z: 0 };
    for (let n = 0; n < weapon.pellets; n += 1) {
      const a = dir + (Math.random() - 0.5) * 2 * weapon.spread;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      let best = weapon.range;
      let hit = null;
      for (const t of list) {
        if (t.ref === ignore) continue;
        const d = rayCircle(ox, oz, dx, dz, t.x, t.z, t.r);
        if (d >= 0 && d < best) {
          best = d;
          hit = t;
        }
      }
      for (const c of G.city.collidersNear(ox + dx * best * 0.5, oz + dz * best * 0.5, best * 0.5 + 6)) {
        if (c.h < 1.2) continue;
        const d = rayBox(ox, oz, dx, dz, c);
        if (d >= 0 && d < best) {
          best = d;
          hit = null;
        }
      }
      end.x = ox + dx * best;
      end.z = oz + dz * best;
      if (hit) {
        C.damageTarget(hit, weapon.dmg, faction);
        G.fx.spark(end.x, oy, end.z, 3);
      } else if (best < weapon.range) G.fx.spark(end.x, oy, end.z, 4);
      const tracerColor = weapon.color;
      G.fx.tracer({ x: ox + dx * 1.2, y: oy, z: oz + dz * 1.2 }, end, tracerColor, weapon.id === 'pulse' ? 0.12 : 0.05);
    }
    G.audio.shot(weapon.id);
    G.alarm(ox, oz, 38);
    return end;
  };

  /** Best target near the aim line, so a keyboard player can hit. */
  C.aimAssist = (x, z, dir, range) => {
    let best = null;
    let bd = 0.2;
    for (const t of targets('player')) {
      if (t.kind === 'vehicle' || t.kind === 'ped') continue;
      const dx = t.x - x;
      const dz = t.z - z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 1) continue;
      let diff = Math.atan2(dx, dz) - dir;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) < bd) {
        bd = Math.abs(diff);
        best = Math.atan2(dx, dz);
      }
    }
    return best === null ? dir : best;
  };

  C.hurtEnemy = (e, dmg, byPlayer) => {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.alert = 8;
    if (e.hp <= 0) {
      e.dead = 0;
      C.spawnPickup(rng.chance(0.5) ? 'ammo' : 'cash', e.x, e.z, rng.int(20, 80));
      if (byPlayer) G.missions.onKill(e);
    }
  };

  C.spawnEnemy = (x, z, o = {}) => {
    const mesh = createHumanoid({ shirt: '#3a1f52', pants: '#16131c', skin: rng.pick(['#e9b88f', '#b57a54', '#8a5a3a']), hair: '#0c0c10', hat: '#2a1740', gun: true, kind: 'thug' });
    G.scene.add(mesh);
    const e = { mesh, x, z, hp: o.hp || 60, dir: rng.range(0, 6.28), cd: rng.range(0.4, 1.2), alert: o.alert || 0, dead: -1, strafe: rng.sign(), t: 0, mission: !!o.mission };
    C.enemies.push(e);
    return e;
  };

  C.blast = (x, z, r, dmg, src) => {
    for (const e of C.enemies) {
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < r && e.hp > 0) C.hurtEnemy(e, dmg * (1 - d / r), src && src.driver === 'player' || src === 'player');
    }
    for (const p of G.peds.list) if (p.state !== 'dead' && Math.hypot(p.x - x, p.z - z) < r) G.peds.kill(p, false);
    for (const o of G.police.officers) {
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < r && o.hp > 0) G.police.hurtOfficer(o, dmg * (1 - d / r), false);
    }
    const d = Math.hypot(G.player.x - x, G.player.z - z);
    if (d < r && !G.player.inVehicle) G.player.hurt(dmg * 0.6 * (1 - d / r), 'blast');
    else if (d < r * 0.6 && G.player.inVehicle && G.player.vehicle !== src) G.player.hurt(dmg * 0.25, 'blast');
  };

  C.enemyShoot = (fromX, fromZ, toX, toZ, dmg, spread, faction) => {
    const dir = Math.atan2(toX - fromX, toZ - fromZ);
    const w = { pellets: 1, spread, range: 70, dmg, color: faction === 'police' ? '#ffd0a0' : '#ff80ff', id: 'enemy' };
    return C.shoot(fromX, 1.35, fromZ, dir, w, faction, null);
  };

  C.step = (dt, t) => {
    for (let i = C.enemies.length - 1; i >= 0; i -= 1) {
      const e = C.enemies[i];
      if (e.hp <= 0) {
        e.dead += dt;
        e.mesh.rotation.x = -Math.min(1, e.dead * 4) * Math.PI / 2;
        e.mesh.position.set(e.x, 0.25 * Math.min(1, e.dead * 4) + 0.2, e.z);
        if (e.dead > 10) {
          G.scene.remove(e.mesh);
          C.enemies.splice(i, 1);
        }
        continue;
      }
      const dx = G.player.x - e.x;
      const dz = G.player.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 40 || e.alert > 0) e.alert = Math.max(e.alert, dist < 40 ? 3 : 0);
      e.alert -= dt;
      let speed = 0;
      if (e.alert > 0 && dist < 60) {
        const face = Math.atan2(dx, dz);
        e.dir = face;
        if (dist > 17) speed = 3.4;
        else if (dist < 9) speed = -2.4;
        else speed = 0;
        const sx = Math.cos(face) * e.strafe * 1.4;
        const sz = -Math.sin(face) * e.strafe * 1.4;
        e.x += (Math.sin(face) * speed + sx) * dt;
        e.z += (Math.cos(face) * speed + sz) * dt;
        e.t -= dt;
        if (e.t <= 0) {
          e.t = rng.range(1.5, 3);
          e.strafe = -e.strafe;
        }
        e.cd -= dt;
        if (e.cd <= 0 && dist < 48) {
          e.cd = rng.range(0.5, 0.9);
          C.enemyShoot(e.x, e.z, G.player.x, G.player.z, 5, 0.09, 'enemy');
          G.fx.muzzle(e.x + Math.sin(face), 1.4, e.z + Math.cos(face), '#ff80ff');
        }
      }
      for (const c of G.city.collidersNear(e.x, e.z, 3)) {
        if (e.x > c.x0 - 0.5 && e.x < c.x1 + 0.5 && e.z > c.z0 - 0.5 && e.z < c.z1 + 0.5) {
          const cx = (c.x0 + c.x1) / 2;
          const cz = (c.z0 + c.z1) / 2;
          if (Math.abs(e.x - cx) / (c.x1 - c.x0) > Math.abs(e.z - cz) / (c.z1 - c.z0)) e.x = e.x > cx ? c.x1 + 0.5 : c.x0 - 0.5;
          else e.z = e.z > cz ? c.z1 + 0.5 : c.z0 - 0.5;
        }
      }
      e.mesh.position.set(e.x, 0.2, e.z);
      e.mesh.rotation.y = e.dir;
      animateHumanoid(e.mesh, Math.abs(speed) + 1, t, e.alert > 0);
    }
    for (let i = C.pickups.length - 1; i >= 0; i -= 1) {
      const p = C.pickups[i];
      p.t += dt;
      p.life -= dt;
      p.m.rotation.y += dt * 2.2;
      p.m.position.y = 0.9 + Math.sin(p.t * 3) * 0.12;
      const d = Math.hypot(G.player.x - p.x, G.player.z - p.z);
      if (d < 1.9 || (G.player.inVehicle && d < 3.4) || p.life <= 0) {
        if (p.life > 0) G.player.collect(p);
        G.scene.remove(p.m);
        p.m.material.dispose();
        C.pickups.splice(i, 1);
      }
    }
  };

  return C;
}
