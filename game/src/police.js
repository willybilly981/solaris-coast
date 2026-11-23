// SCMPD: heat and five wanted tiers, pursuit cars, roadblocks, tactical officers, CONDOR-1 and the Bastion APC.
import * as THREE from 'three';
import { DISTRICTS, ROADS, WANTED_TIERS, WORLD, districtAt } from './config.js';
import { animateHumanoid, createHumanoid } from './pedestrians.js';
import { spotTexture } from './textures.js';

const beamMaterial = (alpha, power) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color('#ffe9bd') }, uAlpha: { value: alpha }, uPow: { value: power } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying float vT;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vT = uv.y; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uAlpha; uniform float uPow; varying vec3 vN; varying vec3 vV; varying float vT;
    void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), uPow); gl_FragColor = vec4(uColor, uAlpha * f * (0.4 + 0.6 * vT)); }`,
});

const vWant = new THREE.Vector3();
const vFrom = new THREE.Vector3();
const vTo = new THREE.Vector3();
const vDir = new THREE.Vector3();
const vMid = new THREE.Vector3();
const vUp = new THREE.Vector3(0, 1, 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DISPATCH = [
  null,
  'Shots reported near {d}. Patrol units respond.',
  'Pursuit authorised. Interceptors, move in.',
  'Roadblocks and tactical teams deploying.',
  'CONDOR-1 is airborne. Suspect armed and dangerous.',
  'All units: Bastion APC to the {d} blockade.',
];

export function createPolice(G) {
  const rng = G.rng;
  const P = { heat: 0, stars: 0, officers: [], log: [], blocks: [], heli: null, seen: false, seenT: 0, forced: false, clock: 0, arrestT: 0, cooldown: 0 };

  P.radio = (text) => {
    P.log.push({ text, t: P.clock });
    if (P.log.length > 8) P.log.shift();
  };

  function tierFor(heat) {
    let t = 0;
    WANTED_TIERS.forEach((w, i) => {
      if (heat >= w.heat) t = i;
    });
    return t;
  }

  function setStarsFromHeat(announce) {
    const s = tierFor(P.heat);
    if (s > P.stars && announce) {
      const d = DISTRICTS.find((x) => x.id === districtAt(G.player.x, G.player.z));
      P.radio(`Dispatch: ${DISPATCH[s].replace('{d}', d ? d.name : 'the city')}`);
      G.audio.alert();
    }
    if (s === 0 && P.stars > 0) P.radio('Dispatch: suspect lost. Units stand down.');
    P.stars = s;
  }

  P.addHeat = (n) => {
    P.heat = Math.min(WANTED_TIERS[5].heat + 40, P.heat + n);
    P.seenT = 0;
    setStarsFromHeat(true);
  };

  P.setStars = (n) => {
    P.heat = WANTED_TIERS[n].heat;
    P.seenT = 0;
    setStarsFromHeat(true);
  };

  P.clear = () => {
    P.heat = 0;
    setStarsFromHeat(false);
    P.stars = 0;
    P.forced = false;
    for (const v of G.vehicles.list) if (v.owner === 'police') v.leaving = true;
    for (const b of P.blocks) b.done = true;
    for (const o of P.officers) o.leaving = true;
  };

  P.hurtOfficer = (o, dmg, byPlayer) => {
    if (o.hp <= 0) return;
    o.hp -= dmg;
    o.alert = 10;
    if (o.hp <= 0) {
      o.dead = 0;
      G.combat.spawnPickup(rng.chance(0.4) ? 'armor' : 'cash', o.x, o.z, rng.int(40, 120));
      if (byPlayer) P.addHeat(30, 'officer down');
    } else if (byPlayer) P.addHeat(10, 'assault on officer');
  };

  let lastRam = -9;
  P.onRam = (a, b) => {
    if ((a.driver === 'player' || b.driver === 'player') && P.clock - lastRam > 1.2) {
      lastRam = P.clock;
      P.addHeat(10);
    }
  };

  function roadPoint(min, max, tries = 16) {
    for (let k = 0; k < tries; k += 1) {
      const axis = rng.chance(0.5) ? 'z' : 'x';
      const c = rng.pick(axis === 'z' ? ROADS.x : ROADS.z);
      const px = axis === 'z' ? G.player.x : G.player.z;
      const pc = axis === 'z' ? G.player.z : G.player.x;
      const d = rng.range(min, max);
      const off = Math.abs(c - px);
      if (off > d) continue;
      const along = pc + rng.sign() * Math.sqrt(d * d - off * off);
      const x = axis === 'z' ? c : along;
      const z = axis === 'z' ? along : c;
      if (x < WORLD.minX + 8 || x > 138 || z < WORLD.minZ + 8 || z > WORLD.maxZ - 8) continue;
      const crossing = (axis === 'z' ? ROADS.z : ROADS.x).some((r) => Math.abs(r - along) < 14);
      if (crossing) continue;
      if (G.vehicles.list.some((o) => Math.hypot(o.x - x, o.z - z) < 9)) continue;
      return { x, z, axis, c, along };
    }
    return null;
  }

  function blocked(x, z) {
    for (const c of G.city.collidersNear(x, z, 2)) if (x > c.x0 - 1.2 && x < c.x1 + 1.2 && z > c.z0 - 1.2 && z < c.z1 + 1.2 && c.h > 1) return true;
    return false;
  }

  function copAi(v, dt) {
    const tier = WANTED_TIERS[P.stars];
    const pl = G.player;
    const inp = v.input;
    v.cap = v.specId === 'bastion' ? 1 : tier.speed || 0.72;
    v.sirens = !v.leaving;
    let tx = pl.x;
    let tz = pl.z;
    if (v.leaving) {
      tx = v.x + (v.x - pl.x);
      tz = v.z + (v.z - pl.z);
    }
    const dx = tx - v.x;
    const dz = tz - v.z;
    const dist = Math.hypot(dx, dz);
    let want = Math.atan2(dx, dz);
    for (const rot of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
      const a = want + rot;
      if (!blocked(v.x + Math.sin(a) * 7, v.z + Math.cos(a) * 7) && !blocked(v.x + Math.sin(a) * 13, v.z + Math.cos(a) * 13)) {
        want = a;
        break;
      }
    }
    let err = wrap(want - v.heading);
    inp.steer = Math.max(-1, Math.min(1, -err * 2));
    inp.throttle = 1;
    inp.brake = 0;
    inp.nitro = false;
    if (!v.leaving && !pl.inVehicle && dist < 15 && v.specId !== 'bastion') {
      inp.throttle = 0;
      inp.brake = 1;
      if (!v.exited && Math.hypot(v.vx, v.vz) < 3) {
        v.exited = true;
        v.ai = null;
        v.driver = null;
        inp.throttle = 0;
        inp.brake = 1;
        P.spawnOfficer(v.x + 2, v.z, 'patrol');
        P.spawnOfficer(v.x - 2, v.z + 1, 'patrol');
      }
    } else if (dist < 12 && pl.inVehicle && Math.hypot(pl.vehicle.vx, pl.vehicle.vz) < 2 && v.specId !== 'bastion') {
      inp.throttle = 0;
      inp.brake = 1;
    }
    if (Math.hypot(v.vx, v.vz) < 1.3 && inp.throttle > 0) v.jam = (v.jam || 0) + dt;
    else v.jam = Math.max(0, (v.jam || 0) - dt);
    if (v.jam > 1.2) {
      inp.throttle = -1;
      inp.steer = -inp.steer;
      if (v.jam > 2.6) v.jam = 0;
    }
    if (v.specId === 'bastion' && !v.leaving) {
      v.turretAim = Math.atan2(pl.x - v.x, pl.z - v.z);
      v.fireT = (v.fireT || 0) - dt;
      if (dist < 55 && v.fireT <= 0 && !v.dead) {
        v.fireT = 0.4;
        G.combat.enemyShoot(v.x, v.z, pl.x, pl.z, 4, 0.1, 'police');
        G.fx.muzzle(v.x + Math.sin(v.turretAim) * 2.6, 3, v.z + Math.cos(v.turretAim) * 2.6, '#ffd0a0');
      }
    }
    if (v.leaving) {
      v.leaveT = (v.leaveT || 0) + dt;
      if (v.leaveT > 25 || dist > 150) v.despawn = true;
    }
  }

  P.spawnCar = (x, z, heading, specId = 'interceptor') => {
    const v = G.vehicles.spawn(specId, x, z, heading, { owner: 'police', ai: copAi });
    v.driver = 'ai';
    v.sirens = true;
    return v;
  };

  P.spawnOfficer = (x, z, type) => {
    const tac = type === 'tactical';
    const mesh = createHumanoid({ shirt: tac ? '#1c2230' : '#2c4a8a', pants: tac ? '#161a24' : '#1b2a52', skin: rng.pick(['#e9b88f', '#b57a54']), hair: '#111', hat: tac ? '#10131b' : '#1b2a52', gun: true, kind: tac ? 'swat' : 'cop', phase: rng.range(0, 6) });
    G.scene.add(mesh);
    const o = { mesh, x, z, hp: tac ? 110 : 55, type, dir: 0, cd: rng.range(0.4, 1.2), alert: 8, dead: -1, strafe: rng.sign(), t: 0, hold: 0 };
    P.officers.push(o);
    return o;
  };

  function spawnBlock() {
    const pt = roadPoint(100, 140);
    if (!pt) return;
    const sign = rng.sign();
    const heading = pt.axis === 'z' ? (sign > 0 ? 0 : Math.PI) : sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    const cars = [];
    for (const side of [-3.6, 3.6]) {
      const x = pt.axis === 'z' ? pt.c + side : pt.along;
      const z = pt.axis === 'z' ? pt.along : pt.c + side;
      const v = G.vehicles.spawn('interceptor', x, z, heading + Math.PI / 2 + (side > 0 ? 0.35 : -0.35), { owner: 'police' });
      v.sirens = true;
      v.sleep = true;
      cars.push(v);
    }
    const bx = pt.axis === 'z' ? pt.c : pt.along;
    const bz = pt.axis === 'z' ? pt.along : pt.c;
    const back = pt.axis === 'z' ? [0, sign * -3] : [sign * -3, 0];
    P.spawnOfficer(bx + back[0] + 1, bz + back[1], 'patrol').hold = 1;
    P.spawnOfficer(bx + back[0] - 1, bz + back[1], 'tactical').hold = 1;
    P.blocks.push({ cars, x: bx, z: bz, done: false });
    P.radio('Dispatch: roadblock established ahead.');
  }

  function buildHeli() {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: '#1a2438', roughness: 0.4, metalness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: '#8fd4ff', roughness: 0.1, metalness: 0.9, emissive: '#10304a' });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), paint);
    body.scale.set(1, 0.95, 1.9);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), glass);
    cockpit.position.set(0, 0.35, 1.6);
    cockpit.scale.set(0.95, 0.8, 1);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 5.6), paint);
    boom.position.set(0, 0.35, -4.6);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.9), paint);
    fin.position.set(0, 1.0, -7.2);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.25, 2.2), new THREE.MeshBasicMaterial({ color: '#f2f6ff' }));
    stripe.position.set(0, 0.1, -0.2);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8), paint);
    mast.position.y = 1.9;
    const rotor = new THREE.Group();
    rotor.position.y = 2.35;
    for (let i = 0; i < 2; i += 1) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 13), new THREE.MeshStandardMaterial({ color: '#0c0f16' }));
      blade.rotation.y = (i * Math.PI) / 2;
      rotor.add(blade);
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(6.4, 28), new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    rotor.add(disc);
    const tail = new THREE.Group();
    tail.position.set(0.25, 1.0, -7.3);
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.2), new THREE.MeshStandardMaterial({ color: '#0c0f16' }));
    tail.add(tb);
    const skid = new THREE.BoxGeometry(0.15, 0.15, 3.4);
    for (const s of [-1.2, 1.2]) {
      const sk = new THREE.Mesh(skid, paint);
      sk.position.set(s, -1.7, 0.2);
      g.add(sk);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: '#fffbe0' }));
    lamp.position.set(0, -1.5, 1.3);
    const redL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2230' }));
    redL.position.set(0, 0.2, -7.9);
    g.add(body, cockpit, boom, fin, stripe, mast, rotor, tail, lamp, redL);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    G.scene.add(g);

    const spot = new THREE.SpotLight('#fff0cf', 5200, 150, 0.2, 0.6, 2);
    spot.target = new THREE.Object3D();
    G.scene.add(spot, spot.target);
    // two additive shells, wide haze plus a brighter core, both fading toward their silhouette so no hard cone edge shows
    const beam = new THREE.Group();
    beam.frustumCulled = false;
    for (const [top, bottom, alpha, power] of [[0.8, 9, 0.2, 1.3], [0.35, 4.2, 0.42, 2.2]]) {
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, 1, 32, 1, true), beamMaterial(alpha, power));
      shell.frustumCulled = false;
      beam.add(shell);
    }
    G.scene.add(beam);
    const spotDisc = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: spotTexture(), color: '#ffe6b0', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    spotDisc.rotation.x = -Math.PI / 2;
    G.scene.add(spotDisc);
    return { g, rotor, tail, spot, beam, spotDisc, a: 0, aim: new THREE.Vector3(G.player.x, 0, G.player.z), pos: new THREE.Vector3(G.player.x + 14, 34, G.player.z + 8) };
  }

  P.ensureHeli = (on) => {
    if (on && !P.heli) {
      P.heli = buildHeli();
      P.radio('CONDOR-1 on station. Searchlight active.');
      G.audio.heli(true);
    } else if (!on && P.heli) {
      const h = P.heli;
      const geos = new Set();
      const mats = new Set();
      const maps = new Set();
      for (const root of [h.g, h.spot, h.spot.target, h.beam, h.spotDisc]) {
        G.scene.remove(root);
        root.traverse((o) => {
          if (o.geometry && !o.isSprite) geos.add(o.geometry);
          if (!o.material) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            mats.add(m);
            if (m.map) maps.add(m.map);
          }
        });
      }
      for (const r of [...geos, ...mats, ...maps]) r.dispose();
      P.heli = null;
      G.audio.heli(false);
    }
  };

  function stepHeli(dt, t) {
    const h = P.heli;
    if (!h) return;
    h.a += dt * 0.32;
    const px = G.player.x;
    const pz = G.player.z;
    h.pos.lerp(vWant.set(px + Math.cos(h.a) * 15, 34 + Math.sin(t * 0.7) * 1.2, pz + Math.sin(h.a) * 15), Math.min(1, dt * 1.4));
    h.g.position.copy(h.pos);
    h.g.rotation.y = -h.a + 0.2;
    h.g.rotation.z = Math.sin(t * 0.9) * 0.04;
    h.rotor.rotation.y += dt * 40;
    h.tail.rotation.x += dt * 50;
    h.aim.x += (px - h.aim.x) * Math.min(1, dt * 2.4);
    h.aim.z += (pz - h.aim.z) * Math.min(1, dt * 2.4);
    const from = vFrom.set(h.pos.x, h.pos.y - 1.2, h.pos.z);
    const to = vTo.set(h.aim.x, 0.25, h.aim.z);
    h.spot.position.copy(from);
    h.spot.target.position.copy(to);
    const dir = vDir.copy(from).sub(to);
    const len = dir.length();
    h.beam.position.copy(vMid.copy(from).add(to).multiplyScalar(0.5));
    h.beam.scale.set(1, len, 1);
    h.beam.quaternion.setFromUnitVectors(vUp, dir.normalize());
    h.spotDisc.position.set(to.x, 0.32, to.z);
    if (Math.hypot(h.aim.x - px, h.aim.z - pz) < 9) P.seenT = 0;
  }

  function stepOfficers(dt, t) {
    const pl = G.player;
    let adjacent = false;
    for (let i = P.officers.length - 1; i >= 0; i -= 1) {
      const o = P.officers[i];
      if (o.hp <= 0) {
        o.dead += dt;
        const k = Math.min(1, o.dead * 4);
        o.mesh.rotation.x = -k * Math.PI / 2;
        o.mesh.position.set(o.x, 0.25 * k + 0.2, o.z);
        if (o.dead > 10) {
          G.scene.remove(o.mesh);
          P.officers.splice(i, 1);
        }
        continue;
      }
      const dx = pl.x - o.x;
      const dz = pl.z - o.z;
      const dist = Math.hypot(dx, dz);
      if (o.leaving || P.stars === 0) {
        o.leaving = true;
        o.x += ((o.x - pl.x) / (dist + 1)) * 3 * dt;
        o.z += ((o.z - pl.z) / (dist + 1)) * 3 * dt;
        if (dist > 90) {
          G.scene.remove(o.mesh);
          P.officers.splice(i, 1);
          continue;
        }
      } else {
        const face = Math.atan2(dx, dz);
        o.dir = face;
        let speed = 0;
        if (!o.hold) speed = dist > 14 ? (o.type === 'tactical' ? 4.6 : 3.8) : dist < 7 ? -2 : 0;
        o.x += Math.sin(face) * speed * dt + Math.cos(face) * o.strafe * 1.2 * dt;
        o.z += Math.cos(face) * speed * dt - Math.sin(face) * o.strafe * 1.2 * dt;
        o.t -= dt;
        if (o.t <= 0) {
          o.t = rng.range(1.5, 3.5);
          o.strafe = -o.strafe;
        }
        o.cd -= dt;
        if (o.cd <= 0 && dist < 45) {
          o.cd = o.type === 'tactical' ? rng.range(0.2, 0.4) : rng.range(0.6, 1.1);
          G.combat.enemyShoot(o.x, o.z, pl.x, pl.z, o.type === 'tactical' ? 3.5 : 5, 0.1, 'police');
          G.fx.muzzle(o.x + Math.sin(face), 1.4, o.z + Math.cos(face), '#ffd0a0');
        }
        if (dist < 2.4 && !pl.inVehicle) adjacent = true;
        animateHumanoid(o.mesh, Math.abs(speed) + 1, t, true);
      }
      for (const c of G.city.collidersNear(o.x, o.z, 3)) {
        if (o.x > c.x0 - 0.5 && o.x < c.x1 + 0.5 && o.z > c.z0 - 0.5 && o.z < c.z1 + 0.5) {
          const cx = (c.x0 + c.x1) / 2;
          const cz = (c.z0 + c.z1) / 2;
          if (Math.abs(o.x - cx) / (c.x1 - c.x0) > Math.abs(o.z - cz) / (c.z1 - c.z0)) o.x = o.x > cx ? c.x1 + 0.5 : c.x0 - 0.5;
          else o.z = o.z > cz ? c.z1 + 0.5 : c.z0 - 0.5;
        }
      }
      o.mesh.position.set(o.x, 0.2, o.z);
      o.mesh.rotation.y = o.dir;
    }
    P.arrestT = adjacent && P.stars > 0 ? P.arrestT + dt : Math.max(0, P.arrestT - dt * 2);
    if (P.arrestT > 2.4) {
      P.arrestT = 0;
      pl.arrest();
    }
  }

  P.step = (dt, t) => {
    P.clock += dt;
    const tier = WANTED_TIERS[P.stars];
    P.cooldown -= dt;
    let seen = false;
    for (const v of G.vehicles.list) if (v.owner === 'police' && !v.dead && !v.leaving && Math.hypot(v.x - G.player.x, v.z - G.player.z) < 60) seen = true;
    for (const o of P.officers) if (o.hp > 0 && Math.hypot(o.x - G.player.x, o.z - G.player.z) < 50) seen = true;
    if (P.heli && Math.hypot(P.heli.pos.x - G.player.x, P.heli.pos.z - G.player.z) < 60) seen = true;
    P.seen = seen;
    if (seen) P.seenT = 0;
    else P.seenT += dt;
    if (P.stars > 0 && P.seenT > 6 && !P.forced) {
      P.heat = Math.max(0, P.heat - dt * 3.6);
      setStarsFromHeat(false);
    }
    if (P.stars === 0) P.forced = false;
    if (P.stars > 0 && P.cooldown <= 0 && !P.frozen) {
      P.cooldown = 1.1;
      const cars = G.vehicles.list.filter((v) => v.owner === 'police' && v.ai && !v.dead && !v.leaving && v.specId === 'interceptor').length;
      if (cars < tier.cars) {
        const pt = roadPoint(85, 135);
        if (pt) {
          const heading = Math.atan2(G.player.x - pt.x, G.player.z - pt.z);
          P.spawnCar(pt.x, pt.z, heading);
        }
      }
      const foot = P.officers.filter((o) => o.type === 'tactical' && o.hp > 0 && !o.hold).length;
      if (foot < tier.foot) {
        const pt = roadPoint(40, 60);
        if (pt) P.spawnOfficer(pt.x, pt.z, 'tactical');
      }
      if (P.blocks.filter((b) => !b.done).length < tier.blocks) spawnBlock();
      if (tier.apc && !G.vehicles.list.some((v) => v.specId === 'bastion' && v.owner === 'police' && !v.dead)) {
        const pt = roadPoint(100, 140);
        if (pt) P.spawnCar(pt.x, pt.z, Math.atan2(G.player.x - pt.x, G.player.z - pt.z), 'bastion');
      }
    }
    P.ensureHeli(tier.heli);
    for (const b of P.blocks) {
      if (b.done || Math.hypot(b.x - G.player.x, b.z - G.player.z) > 260) b.done = true;
    }
    P.blocks = P.blocks.filter((b) => !b.done || b.cars.some((c) => G.vehicles.list.includes(c)));
    for (const v of [...G.vehicles.list]) {
      if (v.owner !== 'police') continue;
      const far = Math.hypot(v.x - G.player.x, v.z - G.player.z);
      if (v.despawn || (!v.ai && !v.dead && (far > 260 || (P.stars === 0 && far > 130)))) G.vehicles.remove(v);
    }
    stepOfficers(dt, t);
    stepHeli(dt, t);
  };

  return P;
}
