// Story missions: glowing beacons, step tracking, Elena and Mateo radio lines, rewards.
import * as THREE from 'three';
import { DISTRICTS, MISSIONS } from './config.js';
import { beamTexture } from './textures.js';

export function makeBeacon(color) {
  const g = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 80, 24, 1, true), beamMat);
  beam.position.y = 40;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.28;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 4), new THREE.MeshBasicMaterial({ color }));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 6;
  g.add(beam, ring, disc, arrow);
  g.userData = { beam, ring, disc, arrow };
  g.visible = false;
  return g;
}

export function setBeacon(b, x, z, r) {
  b.position.set(x, 0, z);
  b.userData.beam.scale.set(r * 0.8, 1, r * 0.8);
  b.userData.ring.scale.set(r, r, 1);
  b.userData.disc.scale.set(r, r, 1);
  b.visible = true;
}

export function createMissions(G) {
  const M = { done: 0, active: null, step: 0, lines: [], lineT: 0, target: null, kills: 0, objective: null, spawned: [] };
  const startB = makeBeacon('#ffc24a');
  const objB = makeBeacon('#4ae8ff');
  G.scene.add(startB, objB);

  M.say = (lines) => {
    for (const l of lines) M.lines.push(l);
  };

  M.current = () => (M.active ? M.active.def : MISSIONS[M.done] || null);

  function showStart() {
    const def = MISSIONS[M.done];
    if (def && !M.active) setBeacon(startB, def.start.x, def.start.z, 3.6);
    else startB.visible = false;
  }

  function beginStep() {
    const def = M.active.def;
    const s = def.steps[M.step];
    M.kills = 0;
    M.target = null;
    if (s.line) M.say([s.line]);
    M.objective = { text: s.text, x: s.x, z: s.z };
    if (s.type === 'getcar') {
      const v = G.vehicles.spawn(s.spec, s.x, s.z, s.heading ?? Math.PI, { owner: 'parked', color: s.color });
      M.target = v;
      M.spawned.push(v);
    } else if (s.type === 'kill') {
      for (let i = 0; i < s.n; i += 1) {
        const a = (i / s.n) * 6.28;
        const r = 9 + (i % 3) * 3;
        const e = G.combat.spawnEnemy(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, { mission: true, alert: 4 });
        M.spawned.push(e);
      }
    } else if (s.type === 'destroy') {
      const v = G.vehicles.spawn('bastion', s.x, s.z, Math.PI / 2, { owner: 'enemy' });
      v.hp = v.maxHp = 380;
      v.driver = 'ai';
      v.ai = apcAi;
      M.target = v;
      M.spawned.push(v);
    } else if (s.type === 'evade') {
      G.police.setStars(3);
      M.objective = { text: s.text, x: null, z: null };
    }
    if (s.heat && s.type !== 'getcar' && s.type !== 'evade') G.police.addHeat(s.heat);
    if (s.x !== undefined && s.type !== 'evade') setBeacon(objB, s.x, s.z, s.r || 3);
    else objB.visible = false;
  }

  function apcAi(v, dt) {
    const pl = G.player;
    const dx = pl.x - v.x;
    const dz = pl.z - v.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let err = Math.atan2(Math.sin(want - v.heading), Math.cos(want - v.heading));
    v.input.steer = Math.max(-1, Math.min(1, -err * 2));
    v.input.throttle = dist > 30 && dist < 90 ? 0.6 : 0;
    v.input.brake = dist <= 30 ? 0.5 : 0;
    v.turretAim = want;
    v.fireT = (v.fireT || 0) - dt;
    if (dist < 60 && v.fireT <= 0 && !v.dead) {
      v.fireT = 0.5;
      G.combat.enemyShoot(v.x, v.z, pl.x, pl.z, 4, 0.1, 'enemy');
      G.fx.muzzle(v.x + Math.sin(want) * 2.6, 3, v.z + Math.cos(want) * 2.6, '#ff80ff');
    }
  }

  function finishStep() {
    const def = M.active.def;
    M.step += 1;
    G.audio.click();
    if (M.step >= def.steps.length) complete();
    else beginStep();
  }

  function complete() {
    const def = M.active.def;
    M.done += 1;
    G.player.cash += def.cash;
    G.activities.addRespect(def.district, def.respect);
    G.hud.banner('MISSION PASSED', '#ffd24a', `${def.title}  +$${def.cash}`);
    M.say(def.outro);
    M.active = null;
    M.objective = null;
    objB.visible = false;
    M.target = null;
    G.save.autosave();
    showStart();
  }

  M.fail = () => {
    if (!M.active) return;
    M.active = null;
    M.objective = null;
    objB.visible = false;
    M.target = null;
    for (const e of M.spawned) {
      if (e.spec) {
        if (e !== G.player.vehicle) G.vehicles.remove(e);
      } else if (e.mesh && e.hp !== undefined) e.hp = Math.min(e.hp, 0);
    }
    M.spawned = [];
    showStart();
  };

  M.start = () => {
    const def = MISSIONS[M.done];
    if (!def || M.active) return;
    M.active = { def };
    M.step = 0;
    M.spawned = [];
    startB.visible = false;
    M.say(def.intro);
    G.hud.toast(def.title);
    beginStep();
  };

  M.onKill = (e) => {
    if (!M.active) return;
    const s = M.active.def.steps[M.step];
    if (s.type === 'kill' && e.mission) {
      M.kills += 1;
      if (M.kills >= s.n) finishStep();
    }
  };

  M.onEnterVehicle = (v) => {
    if (!M.active) return;
    const s = M.active.def.steps[M.step];
    if (s.type === 'getcar' && (v === M.target || (v.specId === s.spec && Math.hypot(v.x - s.x, v.z - s.z) < 60))) {
      if (s.heat) G.police.addHeat(s.heat);
      finishStep();
    }
  };

  M.jump = (n) => {
    if (!M.active) return;
    M.step = n;
    beginStep();
  };

  M.reset = (done) => {
    M.done = Math.max(0, Math.min(MISSIONS.length, done || 0));
    M.fail();
    M.lines = [];
    showStart();
  };

  M.step_ = (dt, t) => {
    startB.userData.arrow.position.y = 6 + Math.sin(t * 3) * 0.6;
    objB.userData.arrow.position.y = 6 + Math.sin(t * 3 + 1) * 0.6;
    startB.userData.arrow.rotation.y = t * 1.6;
    objB.userData.arrow.rotation.y = t * 1.6;
    if (M.lines.length) {
      M.lineT += dt;
      if (M.lineT > 4.4) {
        M.lines.shift();
        M.lineT = 0;
      }
    } else M.lineT = 0;
    const pl = G.player;
    if (pl.wasted) {
      if (M.active) M.fail();
      return;
    }
    if (!M.active) {
      const def = MISSIONS[M.done];
      if (def && Math.hypot(pl.x - def.start.x, pl.z - def.start.z) < 4.2) M.start();
      return;
    }
    const s = M.active.def.steps[M.step];
    if (s.type === 'getcar' && M.target && M.target.dead) {
      G.hud.banner('MISSION FAILED', '#ff3a4a', 'Target vehicle destroyed');
      M.fail();
      return;
    }
    if (s.type === 'goto' && Math.hypot(pl.x - s.x, pl.z - s.z) < (s.r || 3) + 1) finishStep();
    else if (s.type === 'evade' && G.police.stars === 0 && !G.police.forced) finishStep();
    else if (s.type === 'destroy' && M.target && M.target.dead) finishStep();
    if (s.type === 'getcar' && M.target && !M.target.dead) {
      objB.position.x = M.target.x;
      objB.position.z = M.target.z;
      M.objective.x = M.target.x;
      M.objective.z = M.target.z;
    }
    if (s.type === 'destroy' && M.target) {
      objB.position.set(M.target.x, 0, M.target.z);
      M.objective.x = M.target.x;
      M.objective.z = M.target.z;
    }
    if (s.type === 'kill') {
      const alive = M.spawned.filter((e) => e.hp > 0 && e.mission);
      if (!alive.length) {
        finishStep();
        return;
      }
      objB.position.set(alive[0].x, 0, alive[0].z);
      M.objective.x = alive[0].x;
      M.objective.z = alive[0].z;
    }
  };

  M.info = () => {
    const def = M.current();
    if (!def) return { title: 'BAHIA SOLARIS IS YOURS', text: 'All missions complete. Free roam.', dist: null, x: null, z: null, district: null };
    const dist = M.objective && M.objective.x !== null ? Math.hypot(G.player.x - M.objective.x, G.player.z - M.objective.z) : null;
    if (!M.active) return { title: def.title, text: `Go to the marker (${DISTRICTS.find((d) => d.id === def.district).name})`, dist: Math.hypot(G.player.x - def.start.x, G.player.z - def.start.z), x: def.start.x, z: def.start.z, district: def.district };
    const s = def.steps[M.step];
    const extra = s.type === 'kill' ? ` (${M.kills}/${s.n})` : '';
    return { title: def.title, text: M.objective.text + extra, dist, x: M.objective.x, z: M.objective.z, district: def.district };
  };

  showStart();
  return M;
}
