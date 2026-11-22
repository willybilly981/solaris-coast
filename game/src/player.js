// Mateo Vance: on-foot movement, driving input, weapons, health, enter/exit and respawn.
import { LANDMARKS, WEAPONS, WORLD } from './config.js';
import { newWeaponState } from './combat.js';
import { animateHumanoid, createHumanoid } from './pedestrians.js';

export function createPlayer(G) {
  const mesh = createHumanoid({ shirt: '#ff7a3a', pants: '#1d2a44', skin: '#d9a77b', hair: '#1a100a', gun: true, kind: 'hero' });
  G.scene.add(mesh);
  const P = {
    mesh, x: LANDMARKS.start.x, z: LANDMARKS.start.z, y: 0.2, heading: Math.PI, camYaw: Math.PI, camPitch: 0.28, lookT: 0,
    hp: 100, armor: 0, cash: 1500, weapons: newWeaponState(), weapon: 1, wheelT: 0, inVehicle: false, vehicle: null,
    walkSpeed: 0, hurtT: 0, dead: 0, wasted: false, fireHeld: false, prompt: '', aiming: false, nearVehicle: null,
  };

  P.reset = () => {
    P.hp = 100;
    P.armor = 0;
    P.weapons = newWeaponState();
    P.weapon = 1;
    P.wasted = false;
    P.dead = 0;
  };

  P.hurt = (dmg, why) => {
    if (P.wasted || dmg <= 0) return;
    const soak = Math.min(P.armor, dmg * 0.7);
    P.armor -= soak;
    P.hp -= dmg - soak;
    P.hurtT = 0.35;
    if (P.hp <= 0) P.die(why);
  };

  P.die = () => {
    P.hp = 0;
    P.wasted = true;
    P.dead = 0;
    if (P.inVehicle) P.exit(true);
    G.hud.banner('WASTED', '#ff3a4a');
  };

  P.arrest = () => {
    if (P.wasted) return;
    P.wasted = true;
    P.dead = 0;
    P.cash = Math.floor(P.cash * 0.9);
    G.hud.banner('BUSTED', '#4a8cff');
  };

  function respawn() {
    const s = LANDMARKS.safehouse;
    P.x = s.x;
    P.z = s.z + 4;
    P.heading = 0;
    P.camYaw = 0;
    P.hp = 100;
    P.wasted = false;
    G.police.clear();
    G.hud.banner('', '#fff');
    if (P.inVehicle) P.exit(true);
    P.cash = Math.max(0, P.cash - 250);
  }

  P.collect = (p) => {
    G.audio.pickup();
    if (p.kind === 'health') P.hp = Math.min(100, P.hp + 35);
    else if (p.kind === 'armor') P.armor = Math.min(100, P.armor + 40);
    else if (p.kind === 'cash') P.cash += p.value;
    else {
      const w = P.weapons[P.weapon > 0 ? P.weapon : 1];
      w.reserve += WEAPONS[P.weapon > 0 ? P.weapon : 1].mag * 2;
    }
  };

  P.vehicleDestroyed = () => P.hurt(75, 'explosion');

  P.enter = (v) => {
    if (v.driver === 'ai') {
      const side = Math.cos(v.heading);
      G.peds.spawnAt(v.x + side * 2.4, v.z - Math.sin(v.heading) * 2.4, { flee: true });
      G.police.addHeat(v.owner === 'police' ? 22 : 6, 'vehicle theft');
      G.audio.crash(0.3);
    }
    v.ai = null;
    v.driver = 'player';
    v.owner = 'player';
    v.sleep = false;
    P.inVehicle = true;
    P.vehicle = v;
    mesh.visible = false;
    G.missions.onEnterVehicle(v);
    G.hud.toast(v.spec.name);
  };

  P.exit = (force) => {
    const v = P.vehicle;
    if (!v) return;
    if (!force && Math.hypot(v.vx, v.vz) > 9) return;
    const side = Math.cos(v.heading);
    P.x = v.x + side * (v.spec.wid / 2 + 1.1);
    P.z = v.z - Math.sin(v.heading) * (v.spec.wid / 2 + 1.1);
    P.heading = v.heading;
    P.camYaw = v.heading;
    v.driver = null;
    v.owner = 'parked';
    v.input = { throttle: 0, brake: 0.5, steer: 0, hand: false, nitro: false };
    P.inVehicle = false;
    P.vehicle = null;
    mesh.visible = true;
  };

  function selectWeapon(i) {
    if (i === P.weapon) return;
    P.weapon = i;
    P.wheelT = 1.6;
    G.audio.click();
  }

  function fire(dt, input) {
    const w = P.weapons[P.weapon];
    const spec = WEAPONS[P.weapon];
    w.cd -= dt;
    if (w.reload > 0) {
      w.reload -= dt;
      if (w.reload <= 0) {
        const n = Math.min(spec.mag, w.reserve);
        w.mag = n;
        w.reserve -= n;
      }
      return;
    }
    if (P.weapon !== 0 && w.mag <= 0 && w.reserve > 0) {
      w.reload = 1.1;
      return;
    }
    const wants = input.mouse.left || (!P.inVehicle && input.down('Space'));
    const trigger = spec.auto ? wants : wants && !P.fireHeld;
    P.fireHeld = wants;
    if (!trigger || w.cd > 0) return;
    const dir = P.camYaw;
    const aim = G.combat.aimAssist(P.x, P.z, dir, spec.range);
    const ox = P.x + Math.sin(aim) * 0.8;
    const oz = P.z + Math.cos(aim) * 0.8;
    if (P.weapon === 0) {
      w.cd = spec.rate;
      for (const t of [...G.combat.enemies, ...G.police.officers]) {
        if (t.hp > 0 && Math.hypot(t.x - P.x, t.z - P.z) < spec.range + 0.5) {
          if (t.mission !== undefined) G.combat.hurtEnemy(t, spec.dmg, true);
          else G.police.hurtOfficer(t, spec.dmg, true);
        }
      }
      for (const p of G.peds.list) if (p.state !== 'dead' && Math.hypot(p.x - P.x, p.z - P.z) < spec.range) G.peds.damage(p, spec.dmg, true);
      P.punchT = 0.25;
      return;
    }
    if (w.mag <= 0) return;
    w.mag -= 1;
    w.cd = spec.rate;
    P.heading = aim;
    G.fx.muzzle(ox, 1.4, oz, spec.color);
    G.combat.shoot(ox, 1.4, oz, aim, spec, 'player', P);
  }

  P.step = (dt, t, input) => {
    P.wheelT = Math.max(0, P.wheelT - dt);
    P.hurtT = Math.max(0, P.hurtT - dt);
    if (P.wasted) {
      P.dead += dt;
      if (P.dead > 2.6) respawn();
      return;
    }
    if (P.hp < 100 && !P.inVehicle) P.hp = Math.min(100, P.hp + dt * 0.3);
    for (let i = 0; i < 5; i += 1) if (input.take(`Digit${i + 1}`)) selectWeapon(i);
    if (input.take('KeyQ')) {
      selectWeapon((P.weapon + 1) % WEAPONS.length);
      P.wheelT = 1.6;
    }
    if (input.down('KeyQ')) P.wheelT = Math.max(P.wheelT, 0.6);
    if (input.down('ArrowLeft')) P.camYaw += dt * 2.2;
    if (input.down('ArrowRight')) P.camYaw -= dt * 2.2;
    if (input.down('ArrowUp')) P.camPitch = Math.min(0.9, P.camPitch + dt * 1.2);
    if (input.down('ArrowDown')) P.camPitch = Math.max(0.05, P.camPitch - dt * 1.2);
    const look = input.look();
    if (look.dx || look.dy) {
      P.camYaw -= look.dx * 0.0035;
      P.camPitch = Math.max(0.05, Math.min(0.9, P.camPitch + look.dy * 0.003));
      P.lookT = 1.4;
    }
    P.lookT = Math.max(0, P.lookT - dt);
    const wantsEnter = input.take('KeyF');
    P.nearVehicle = P.inVehicle ? null : G.vehicles.nearest(P.x, P.z);
    P.prompt = '';
    if (P.inVehicle) {
      const v = P.vehicle;
      const inp = v.input;
      const up = input.down('KeyW');
      const dn = input.down('KeyS');
      inp.throttle = up ? 1 : dn ? -1 : 0;
      inp.brake = 0;
      const want = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
      inp.steer += (want - inp.steer) * Math.min(1, dt * 7);
      inp.hand = input.down('Space');
      inp.nitro = input.down('ShiftLeft') || input.down('ShiftRight');
      P.x = v.x;
      P.z = v.z;
      P.y = v.y;
      P.heading = v.heading;
      if (wantsEnter) P.exit(false);
      if (input.mouse.left || input.down('ControlLeft')) fireFromVehicle(dt, input);
      else P.fireHeld = false;
      P.weapons[P.weapon].cd -= dt;
    } else {
      onFoot(dt, t, input);
      if (wantsEnter && P.nearVehicle) P.enter(P.nearVehicle);
      if (P.nearVehicle && !P.wasted) P.prompt = `[F] ${P.nearVehicle.driver === 'ai' ? 'HIJACK' : 'ENTER'} ${P.nearVehicle.spec.name.toUpperCase()}`;
      fire(dt, input);
    }
  };

  function fireFromVehicle(dt, input) {
    const w = P.weapons[P.weapon];
    const spec = WEAPONS[P.weapon];
    if (P.weapon === 0 || P.weapon === 3 || w.mag <= 0) {
      if (w.mag <= 0 && w.reserve > 0 && P.weapon !== 0) {
        const n = Math.min(spec.mag, w.reserve);
        w.mag = n;
        w.reserve -= n;
      }
      return;
    }
    if (w.cd > 0) return;
    const v = P.vehicle;
    const side = Math.sin(P.camYaw - v.heading) > 0 ? 1 : -1;
    const ox = v.x + Math.cos(v.heading) * side * 1.1;
    const oz = v.z - Math.sin(v.heading) * side * 1.1;
    w.mag -= 1;
    w.cd = spec.rate * 1.4;
    G.fx.muzzle(ox, 1.3, oz, spec.color);
    G.combat.shoot(ox, 1.3, oz, P.camYaw, spec, 'player', v);
  }

  function onFoot(dt, t, input) {
    const fwd = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const str = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    let mx = Math.sin(P.camYaw) * fwd - Math.cos(P.camYaw) * str;
    let mz = Math.cos(P.camYaw) * fwd + Math.sin(P.camYaw) * str;
    const len = Math.hypot(mx, mz);
    let speed = 0;
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      speed = sprint ? 6.4 : 3.8;
      P.x += mx * speed * dt;
      P.z += mz * speed * dt;
      if (!input.mouse.left && !input.down('Space')) {
        let d = Math.atan2(mx, mz) - P.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        P.heading += d * Math.min(1, dt * 12);
      }
    }
    P.walkSpeed = speed;
    for (const c of G.city.collidersNear(P.x, P.z, 3)) {
      if (c.h < 0.5) continue;
      const px = Math.max(c.x0, Math.min(P.x, c.x1));
      const pz = Math.max(c.z0, Math.min(P.z, c.z1));
      const dx = P.x - px;
      const dz = P.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < 0.5 && d > 1e-4) {
        P.x += (dx / d) * (0.5 - d);
        P.z += (dz / d) * (0.5 - d);
      }
    }
    for (const v of G.vehicles.list) {
      if (Math.abs(v.x - P.x) > 5 || Math.abs(v.z - P.z) > 5) continue;
      const sx = Math.sin(v.heading);
      const sz = Math.cos(v.heading);
      for (const off of [-0.3, 0, 0.3]) {
        const cx = v.x + sx * v.spec.len * off;
        const cz = v.z + sz * v.spec.len * off;
        const d = Math.hypot(P.x - cx, P.z - cz);
        const r = v.spec.wid * 0.5 + 0.4;
        if (d < r && d > 1e-4) {
          P.x += ((P.x - cx) / d) * (r - d);
          P.z += ((P.z - cz) / d) * (r - d);
          const sp = Math.hypot(v.vx, v.vz);
          if (sp > 6 && !v.dead) P.hurt(sp * 1.2, 'hit by car');
        }
      }
    }
    P.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, P.x));
    P.z = Math.max(WORLD.minZ, Math.min(WORLD.maxZ, P.z));
    P.y = 0.2;
    mesh.position.set(P.x, 0.2, P.z);
    mesh.rotation.y = P.heading;
    const wpn = WEAPONS[P.weapon];
    mesh.userData.weapon.visible = P.weapon !== 0;
    P.aiming = input.mouse.left || input.down('Space') || P.weapon !== 0;
    animateHumanoid(mesh, speed, t, P.aiming && P.weapon !== 0);
    if (P.punchT > 0) {
      P.punchT -= dt;
      mesh.userData.armR.rotation.x = -1.4;
    }
    return wpn;
  }

  return P;
}
