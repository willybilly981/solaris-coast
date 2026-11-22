// Vehicles: multi-part meshes, arcade driving physics (drift, nitro, ramps), damage, enter and exit.
import * as THREE from 'three';
import { VEHICLES, WORLD } from './config.js';
import { boxGeo, mergeGeos, placed } from './geometry.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });
const SHARED = {
  glass: std('#0d2230', { metalness: 0.85, roughness: 0.08 }),
  trim: std('#14161b', { roughness: 0.7 }),
  tire: std('#0e0e10', { roughness: 0.95 }),
  rim: std('#cfd5de', { metalness: 0.9, roughness: 0.25 }),
  white: std('#eef2f6', { metalness: 0.3, roughness: 0.35 }),
  head: new THREE.MeshBasicMaterial({ color: '#fff4cc' }),
  tail: new THREE.MeshBasicMaterial({ color: '#ff2630' }),
  steel: std('#59616c', { metalness: 0.7, roughness: 0.4 }),
};
let glowTex = null;
const glowMat = (color, opacity) => new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

export function setGlowTexture(t) {
  glowTex = t;
}

/** Side profile (u along the car, y up) extruded across the width, nose toward +z. */
function profile(pts, len, depth) {
  const s = new THREE.Shape();
  pts.forEach(([u, y], i) => (i ? s.lineTo(u * len, y) : s.moveTo(u * len, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

function wheelMesh(r, w) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), SHARED.tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 10), SHARED.rim);
  tire.rotation.z = Math.PI / 2;
  rim.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  spin.add(tire, rim);
  g.add(spin);
  g.userData.spin = spin;
  return g;
}

const SHAPES = {
  solara: { low: [[-0.5, 0.3], [0.5, 0.3], [0.5, 0.54], [0.42, 0.64], [0.24, 0.72], [-0.14, 0.76], [-0.4, 0.74], [-0.5, 0.64]], cab: [[-0.2, 0.74], [-0.1, 1.24], [0.1, 1.24], [0.3, 0.74]] },
  vipera: { low: [[-0.5, 0.3], [0.5, 0.3], [0.5, 0.62], [0.4, 0.78], [0.1, 0.82], [-0.3, 0.8], [-0.5, 0.72]], cab: [[-0.26, 0.8], [-0.16, 1.28], [0.06, 1.28], [0.22, 0.8]] },
  aurelia: { low: [[-0.5, 0.28], [0.5, 0.28], [0.5, 0.46], [0.36, 0.58], [0.1, 0.66], [-0.2, 0.7], [-0.5, 0.6]], cab: [[-0.12, 0.68], [-0.02, 1.08], [0.14, 1.08], [0.3, 0.64]] },
  interceptor: { low: [[-0.5, 0.32], [0.5, 0.32], [0.5, 0.62], [0.38, 0.78], [-0.38, 0.8], [-0.5, 0.7]], cab: [[-0.3, 0.78], [-0.2, 1.36], [0.14, 1.36], [0.28, 0.78]] },
};

function addLight(group, x, y, z, color, size, opacity) {
  const s = new THREE.Sprite(glowMat(color, opacity));
  s.scale.set(size, size, 1);
  s.position.set(x, y, z);
  group.add(s);
  return s;
}

function buildMesh(specId, colorHex) {
  const spec = VEHICLES[specId];
  const L = spec.len;
  const W = spec.wid;
  const root = new THREE.Group();
  const paint = std(colorHex, { metalness: 0.3, roughness: 0.36, envMapIntensity: 1.2, emissive: colorHex, emissiveIntensity: 0.12 });
  const parts = { paint: [], glass: [], trim: [], white: [], head: [], tail: [], steel: [] };
  const part = (k, g) => parts[k].push(g);
  const wheels = [];
  const front = [];
  let wheelR = 0.36;
  let axles = [L * 0.31, -L * 0.3];
  let track = W / 2 - 0.1;
  let lightbar = null;
  let turret = null;

  if (spec.kind === 'truck') {
    wheelR = 0.5;
    axles = [L * 0.3, -L * 0.24, -L * 0.4];
    part('paint', placed(boxGeo(W - 0.2, 2.5, 2.2), 0, 0.5, L * 0.32));
    part('glass', placed(boxGeo(W - 0.25, 0.9, 0.12), 0, 1.7, L * 0.32 + 1.1));
    part('white', placed(boxGeo(W, 2.7, L * 0.55), 0, 0.9, -L * 0.2));
    part('paint', placed(boxGeo(W + 0.04, 0.5, L * 0.55), 0, 1.9, -L * 0.2));
    part('trim', placed(boxGeo(W - 0.2, 0.5, L * 0.95), 0, 0.5, 0));
    part('head', placed(boxGeo(0.4, 0.25, 0.1), -0.8, 0.95, L * 0.5 + 0.02));
    part('head', placed(boxGeo(0.4, 0.25, 0.1), 0.8, 0.95, L * 0.5 + 0.02));
    part('tail', placed(boxGeo(0.4, 0.3, 0.1), -0.9, 0.9, -L * 0.5 - 0.02));
    part('tail', placed(boxGeo(0.4, 0.3, 0.1), 0.9, 0.9, -L * 0.5 - 0.02));
  } else if (spec.kind === 'apc') {
    wheelR = 0.58;
    axles = [L * 0.3, 0, -L * 0.3];
    track = W / 2 - 0.05;
    const hull = profile([[-0.5, 0.55], [0.5, 0.55], [0.5, 1.5], [0.34, 2.3], [-0.5, 2.3]], L, W - 0.3);
    part('paint', hull);
    part('glass', placed(boxGeo(W - 0.8, 0.35, 0.12), 0, 1.7, L * 0.45 - 0.2, 0, -0.5));
    part('trim', placed(boxGeo(W - 0.5, 0.4, L * 0.96), 0, 0.3, 0));
    part('steel', placed(new THREE.CylinderGeometry(0.95, 1.05, 0.55, 14), 0, 2.3, -0.4));
    part('head', placed(boxGeo(0.5, 0.3, 0.1), -1.0, 1.0, L * 0.5 + 0.1));
    part('head', placed(boxGeo(0.5, 0.3, 0.1), 1.0, 1.0, L * 0.5 + 0.1));
    part('tail', placed(boxGeo(0.4, 0.3, 0.1), -1.1, 1.1, -L * 0.5 - 0.1));
    part('tail', placed(boxGeo(0.4, 0.3, 0.1), 1.1, 1.1, -L * 0.5 - 0.1));
    turret = new THREE.Group();
    turret.position.set(0, 2.9, -0.4);
    const barrel = new THREE.Mesh(boxGeo(0.22, 0.22, 2.2), SHARED.steel);
    barrel.position.set(0, 0.1, 1.3);
    barrel.castShadow = true;
    turret.add(barrel);
    root.add(turret);
  } else {
    const sh = SHAPES[specId];
    part('paint', profile(sh.low, L, W - 0.1));
    part('glass', profile(sh.cab, L, W - 0.34));
    const peak = sh.cab[1][1];
    part('paint', placed(boxGeo(L * 0.2, 0.06, W - 0.5), 0, peak - 0.01, L * (sh.cab[1][0] + sh.cab[2][0]) / 2));
    part('trim', placed(boxGeo(W - 0.2, 0.16, 0.2), 0, 0.3, L * 0.5 + 0.05));
    part('trim', placed(boxGeo(W - 0.2, 0.22, 0.2), 0, 0.32, -L * 0.5 - 0.05));
    part('head', placed(boxGeo(0.46, 0.14, 0.08), -W * 0.32, 0.55, L * 0.5 + 0.06));
    part('head', placed(boxGeo(0.46, 0.14, 0.08), W * 0.32, 0.55, L * 0.5 + 0.06));
    part('tail', placed(boxGeo(W * 0.78, 0.12, 0.08), 0, 0.64, -L * 0.5 - 0.06));
    if (specId !== 'interceptor') {
      part('trim', placed(boxGeo(W - 0.2, 0.06, 0.5), 0, 0.82, -L * 0.5 + 0.1));
      part('trim', placed(boxGeo(0.08, 0.28, 0.4), -W * 0.38, 0.7, -L * 0.5 + 0.1));
      part('trim', placed(boxGeo(0.08, 0.28, 0.4), W * 0.38, 0.7, -L * 0.5 + 0.1));
    } else {
      part('white', placed(boxGeo(0.06, 0.4, L * 0.32), W / 2 - 0.02, 0.4, 0.05));
      part('white', placed(boxGeo(0.06, 0.4, L * 0.32), -W / 2 + 0.02, 0.4, 0.05));
      part('white', placed(boxGeo(W - 0.4, 0.04, L * 0.18), 0, 0.8, L * 0.34));
      part('white', placed(boxGeo(W - 0.5, 0.04, L * 0.16), 0, 0.8, -L * 0.36));
      part('white', placed(boxGeo(W - 0.3, 0.3, 0.05), 0, 0.82, -L * 0.5 - 0.02));
      lightbar = new THREE.Group();
      lightbar.position.set(0, 1.4, -0.1);
      const red = new THREE.Mesh(boxGeo(0.7, 0.16, 0.26), new THREE.MeshBasicMaterial({ color: '#ff1c2b' }));
      const blue = new THREE.Mesh(boxGeo(0.7, 0.16, 0.26), new THREE.MeshBasicMaterial({ color: '#2a5cff' }));
      red.position.x = 0.4;
      blue.position.x = -0.4;
      lightbar.add(red, blue);
      lightbar.userData = { red, blue, redGlow: addLight(lightbar, 0.55, 0.25, 0, '#ff2030', 3.2, 0.9), blueGlow: addLight(lightbar, -0.55, 0.25, 0, '#3a6bff', 3.2, 0.9) };
      root.add(lightbar);
    }
  }
  for (const k of Object.keys(parts)) {
    if (!parts[k].length) continue;
    const mat = k === 'paint' ? paint : SHARED[k];
    const mesh = new THREE.Mesh(mergeGeos(parts[k]), mat);
    mesh.castShadow = k !== 'head' && k !== 'tail';
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  if (spec.kind === 'car' || spec.kind === 'police') {
    addLight(root, 0, 0.64, -L * 0.5 - 0.2, '#ff2a30', 2.6, 0.8);
    addLight(root, -W * 0.32, 0.55, L * 0.5 + 0.2, '#ffe9b0', 1.6, 0.55);
    addLight(root, W * 0.32, 0.55, L * 0.5 + 0.2, '#ffe9b0', 1.6, 0.55);
  }
  axles.forEach((az, i) => {
    for (const side of [-1, 1]) {
      const w = wheelMesh(wheelR, 0.3);
      w.position.set(side * track, wheelR, az);
      root.add(w);
      wheels.push(w);
      if (i === 0) front.push(w);
    }
  });
  const flame = addLight(root, 0, 0.6, -L * 0.5 - 1.2, '#ffa030', 3.2, 0);
  return { root, paint, wheels, front, lightbar, turret, flame };
}

let nextId = 1;

export function createVehicles(G) {
  const list = [];
  const M = { list };

  M.spawn = (specId, x, z, heading, o = {}) => {
    const spec = VEHICLES[specId];
    const color = o.color || spec.color;
    const m = buildMesh(specId, color);
    m.root.position.set(x, 0.2, z);
    m.root.rotation.y = heading;
    G.scene.add(m.root);
    const v = {
      id: nextId++, specId, spec, mesh: m.root, parts: m, color,
      x, z, y: 0.2, vy: 0, heading, vx: 0, vz: 0, speed: 0, yaw: 0, steer: 0, rise: 0,
      hp: spec.hp, maxHp: spec.hp, nitro: 1, boosting: false, burning: 0, dead: false, wreckTime: 0,
      input: { throttle: 0, brake: 0, steer: 0, hand: false, nitro: false }, driver: null, owner: o.owner || 'traffic',
      ai: o.ai || null, air: false, sleep: false, smokeT: 0, tune: 1, radius: spec.wid * 0.55, label: o.label || '',
    };
    list.push(v);
    return v;
  };

  M.remove = (v) => {
    G.scene.remove(v.mesh);
    v.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
  };

  M.damage = (v, amount, source) => {
    if (v.dead || amount <= 0) return;
    v.hp -= amount * (v.spec.kind === 'apc' ? 0.35 : 1);
    v.sleep = false;
    if (v.hp <= 0 && !v.burning) {
      v.hp = 0;
      v.burning = 2.2;
      if (source === 'player') G.police.addHeat(8, 'vehicle destroyed');
    }
  };

  M.explode = (v) => {
    if (v.dead) return;
    v.dead = true;
    v.burning = 0;
    G.fx.explosion(v.x, v.y + 0.8, v.z, 1);
    G.audio.explosion();
    v.parts.paint.color.set('#15110f');
    v.parts.paint.metalness = 0.1;
    v.mesh.position.y += 0.15;
    v.vx *= 0.3;
    v.vz *= 0.3;
    for (const o of list) {
      if (o === v) continue;
      const d = Math.hypot(o.x - v.x, o.z - v.z);
      if (d < 9) {
        M.damage(o, (9 - d) * 14, 'blast');
        const k = (9 - d) * 1.4;
        o.vx += ((o.x - v.x) / (d + 0.1)) * k;
        o.vz += ((o.z - v.z) / (d + 0.1)) * k;
      }
    }
    G.blast(v.x, v.z, 9, 70, v);
    if (v.driver === 'player') G.player.vehicleDestroyed();
  };

  function stepVehicle(v, dt) {
    const s = v.spec;
    const inp = v.input;
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    const lx = fz;
    const lz = -fx;
    let vf = v.vx * fx + v.vz * fz;
    let vl = v.vx * lx + v.vz * lz;
    const boost = inp.nitro && s.nitro && v.nitro > 0.02 && vf > 2;
    v.boosting = boost;
    if (boost) v.nitro = Math.max(0, v.nitro - 0.3 * dt);
    else v.nitro = Math.min(1, v.nitro + 0.05 * dt);
    const maxSpeed = s.maxSpeed * v.tune * (boost ? 1.45 : 1) * (v.cap || 1);
    if (v.air) {
      v.vy -= 24 * dt;
    } else {
      const handbrake = inp.hand;
      if (inp.throttle > 0) {
        const room = Math.max(0, 1 - Math.max(0, vf) / maxSpeed);
        vf += s.accel * v.tune * (boost ? 2.2 : 1) * inp.throttle * (vf < 0 ? 1.8 : room) * dt;
      } else if (inp.throttle < 0) {
        if (vf > 0.6) vf -= 34 * dt;
        else vf = Math.max(-maxSpeed * 0.35, vf - s.accel * 0.7 * dt);
      }
      if (inp.brake > 0) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 36 * inp.brake * dt);
      vf -= vf * 0.07 * dt;
      if (Math.abs(inp.throttle) < 0.05 && !inp.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 3.2 * dt);
      const speedK = Math.min(1, Math.abs(vf) / 7);
      const hi = 1 - 0.38 * Math.min(1, Math.abs(vf) / maxSpeed);
      const turn = s.turn * speedK * hi * (handbrake ? 1.55 : 1);
      const dh = inp.steer * turn * Math.sign(vf || 1) * dt;
      if (handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
      // velocity stays in world space while the nose turns, so the car slides until grip pulls it straight
      const wx = fx * vf + lx * vl;
      const wz = fz * vf + lz * vl;
      v.heading -= dh;
      const nfx = Math.sin(v.heading);
      const nfz = Math.cos(v.heading);
      vf = wx * nfx + wz * nfz;
      vl = wx * nfz - wz * nfx;
      vl *= Math.exp(-s.grip * 2.2 * (handbrake ? 0.14 : 1) * dt);
      v.vx = nfx * vf + nfz * vl;
      v.vz = nfz * vf - nfx * vl;
    }
    v.x += v.vx * dt;
    v.z += v.vz * dt;
    v.speed = vf;
    v.slip = Math.abs(vl);
    const g = G.city.rampHeight(v.x, v.z);
    if (v.air) {
      v.y += v.vy * dt;
      if (v.y <= g) {
        const impact = -v.vy;
        v.y = g;
        v.vy = 0;
        v.air = false;
        if (impact > 7) {
          M.damage(v, (impact - 7) * 4, 'fall');
          G.fx.dust(v.x, 0.3, v.z, 8);
        }
        G.activities.onLand(v);
      }
    } else {
      const rise = (g - v.y) / dt;
      if (g < v.y - 0.08) {
        v.air = true;
        v.vy = Math.max(0, v.rise);
        G.activities.onLaunch(v);
      } else {
        v.rise = rise;
        v.y = g;
      }
    }
    for (const c of G.city.collidersNear(v.x, v.z, 8)) {
      if (v.y > c.h + 0.3) continue;
      for (const off of [-v.spec.len * 0.32, 0, v.spec.len * 0.32]) {
        const cx = v.x + Math.sin(v.heading) * off;
        const cz = v.z + Math.cos(v.heading) * off;
        const px = Math.max(c.x0, Math.min(cx, c.x1));
        const pz = Math.max(c.z0, Math.min(cz, c.z1));
        let dx = cx - px;
        let dz = cz - pz;
        let d = Math.hypot(dx, dz);
        const r = v.radius;
        if (d >= r) continue;
        if (d < 1e-4) {
          dx = cx - (c.x0 + c.x1) / 2;
          dz = cz - (c.z0 + c.z1) / 2;
          d = Math.hypot(dx, dz) || 1;
        }
        const nx = dx / d;
        const nz = dz / d;
        v.x += nx * (r - d);
        v.z += nz * (r - d);
        const vn = v.vx * nx + v.vz * nz;
        if (vn < 0) {
          v.vx -= (1.35 * vn) * nx;
          v.vz -= (1.35 * vn) * nz;
          if (vn < -5) {
            M.damage(v, (-vn - 4) * 2.4 / Math.sqrt(v.spec.mass), 'crash');
            G.fx.spark(cx - nx * r, v.y + 0.6, cz - nz * r, 6);
            G.audio.crash(Math.min(1, -vn / 20));
            G.alarmCrash(v.x, v.z, v);
          }
        }
      }
    }
    v.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, v.x));
    v.z = Math.max(WORLD.minZ, Math.min(WORLD.maxZ, v.z));
  }

  function collideVehicles(dt) {
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        if (Math.abs(a.x - b.x) > 7 || Math.abs(a.z - b.z) > 7) continue;
        if (Math.abs(a.y - b.y) > 2) continue;
        for (const oa of [-a.spec.len * 0.28, a.spec.len * 0.28]) {
          for (const ob of [-b.spec.len * 0.28, b.spec.len * 0.28]) {
            const ax = a.x + Math.sin(a.heading) * oa;
            const az = a.z + Math.cos(a.heading) * oa;
            const bx = b.x + Math.sin(b.heading) * ob;
            const bz = b.z + Math.cos(b.heading) * ob;
            const dx = bx - ax;
            const dz = bz - az;
            const d = Math.hypot(dx, dz) || 0.01;
            const r = a.radius + b.radius;
            if (d >= r) continue;
            const nx = dx / d;
            const nz = dz / d;
            const total = a.spec.mass + b.spec.mass;
            const pa = (b.spec.mass / total) * (r - d);
            const pb = (a.spec.mass / total) * (r - d);
            a.x -= nx * pa;
            a.z -= nz * pa;
            b.x += nx * pb;
            b.z += nz * pb;
            const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
            if (rel < 0) {
              const imp = (-1.45 * rel) / (1 / a.spec.mass + 1 / b.spec.mass);
              a.vx -= (imp * nx) / a.spec.mass;
              a.vz -= (imp * nz) / a.spec.mass;
              b.vx += (imp * nx) / b.spec.mass;
              b.vz += (imp * nz) / b.spec.mass;
              a.sleep = false;
              b.sleep = false;
              if (rel < -4) {
                const dmg = (-rel - 3) * 2.2;
                M.damage(a, (dmg * b.spec.mass) / total * 1.6, b.driver === 'player' ? 'player' : 'crash');
                M.damage(b, (dmg * a.spec.mass) / total * 1.6, a.driver === 'player' ? 'player' : 'crash');
                G.fx.spark((ax + bx) / 2, a.y + 0.6, (az + bz) / 2, 5);
                G.audio.crash(Math.min(1, -rel / 20));
                G.alarmCrash(a.x, a.z, a.driver === 'player' ? a : b);
                if (a.owner === 'police' || b.owner === 'police') G.police.onRam(a, b);
              }
            }
          }
        }
      }
    }
  }

  function visuals(v, t, dt) {
    const m = v.mesh;
    m.position.set(v.x, v.y, v.z);
    const slope = v.air ? Math.atan2(v.vy, Math.max(4, Math.abs(v.speed))) : Math.atan2(v.rise, Math.max(4, Math.abs(v.speed)));
    m.rotation.set(-slope * 0.9, v.heading, 0, 'YXZ');
    const spin = v.speed * dt / 0.4;
    v.steer += (v.input.steer * 0.45 - v.steer) * Math.min(1, dt * 10);
    for (const w of v.parts.wheels) w.userData.spin.rotation.x += spin;
    for (const w of v.parts.front) w.rotation.y = -v.steer;
    if (v.parts.lightbar && v.owner === 'police') {
      const on = v.sirens !== false;
      const ph = Math.floor(t * 8) % 2;
      const d = v.parts.lightbar.userData;
      d.red.material.color.set(on && ph ? '#ff2a38' : '#3a0a10');
      d.blue.material.color.set(on && !ph ? '#3a6bff' : '#0a1030');
      d.redGlow.material.opacity = on && ph ? 1 : 0.05;
      d.blueGlow.material.opacity = on && !ph ? 1 : 0.05;
    }
    if (v.parts.turret && v.turretAim !== undefined) v.parts.turret.rotation.y = v.turretAim - v.heading;
    v.parts.flame.material.opacity = v.boosting ? 0.9 + Math.sin(t * 60) * 0.1 : 0;
    v.parts.flame.scale.setScalar(v.boosting ? 4.2 + Math.sin(t * 50) * 0.8 : 1);
    const hurt = v.hp / v.maxHp;
    if (!v.dead && hurt < 0.45 && v.hp > 0) {
      v.smokeT -= dt;
      if (v.smokeT <= 0) {
        v.smokeT = 0.09;
        G.fx.smoke(v.x + Math.sin(v.heading) * v.spec.len * 0.35, v.y + 1, v.z + Math.cos(v.heading) * v.spec.len * 0.35, hurt < 0.2 ? 1.4 : 0.9, hurt < 0.2);
      }
    }
    if (v.burning || v.dead) {
      v.smokeT -= dt;
      if (v.smokeT <= 0) {
        v.smokeT = 0.05;
        G.fx.fire(v.x + (Math.random() - 0.5) * 1.4, v.y + 0.9, v.z + (Math.random() - 0.5) * 1.8);
        if (Math.random() < 0.5) G.fx.smoke(v.x, v.y + 1.4, v.z, 1.6, true);
      }
    }
  }

  M.step = (dt, t) => {
    for (const v of list) {
      if (v.ai) v.ai(v, dt);
      if (v.dead) {
        v.input.throttle = 0;
        v.input.brake = 0.3;
        v.wreckTime += dt;
      } else if (v.burning > 0) {
        v.burning -= dt;
        if (v.burning <= 0) M.explode(v);
      }
      const idle = !v.driver && !v.ai && Math.abs(v.vx) + Math.abs(v.vz) < 0.05 && !v.air;
      if (idle && v.sleep) continue;
      stepVehicle(v, dt);
      if (idle) v.sleep = true;
    }
    collideVehicles(dt);
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const v = list[i];
      visuals(v, t, dt);
      if (v.dead && v.wreckTime > 45 && v.driver !== 'player' && Math.hypot(v.x - G.player.x, v.z - G.player.z) > 60) M.remove(v);
    }
  };

  M.nearest = (x, z, r = 3.6) => {
    let best = null;
    let bd = r;
    for (const v of list) {
      if (v.dead || v.driver === 'player' || v.owner === 'enemy') continue;
      const d = Math.hypot(v.x - x, v.z - z) - v.spec.wid * 0.4;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  };

  return M;
}
