// Civilian traffic: lane-following cars that turn at intersections, yield, and panic when hit or shot at.
import { CAR_COLORS, ROADS, TRAFFIC_SPECS, WORLD } from './config.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Centre of the lane used when travelling `sign` along `axis` on the road at `c`. */
function laneAt(axis, c, sign) {
  if (axis === 'z') return c + (sign > 0 ? -3.5 : 3.5);
  return c + (sign > 0 ? 3.5 : -3.5);
}

function limit(axis, sign, p) {
  return axis === 'z' ? (sign > 0 ? p > WORLD.maxZ - 3 : p < WORLD.minZ + 3) : sign > 0 ? p > 133 : p < WORLD.minX + 3;
}

export function createTraffic(G) {
  const T = {};
  const rng = G.rng;

  function makeAi(state) {
    return (v, dt) => {
      const s = state;
      const along = s.axis === 'z' ? v.z : v.x;
      const across = s.axis === 'z' ? v.x : v.z;
      const inp = v.input;
      if (limit(s.axis, s.sign, along)) {
        v.despawn = true;
        return;
      }
      const crossings = s.axis === 'z' ? ROADS.z : ROADS.x;
      for (const c of crossings) {
        if (s.last === c || (c - along) * s.sign < 0 || (c - along) * s.sign > 10) continue;
        s.last = c;
        const roll = rng.next();
        const fx = s.axis === 'z' ? 0 : s.sign;
        const fz = s.axis === 'z' ? s.sign : 0;
        const right = [-fz, fx];
        let turn = roll < 0.58 ? 0 : roll < 0.8 ? -1 : 1;
        if (turn !== 0) {
          const nx = turn > 0 ? right[0] : -right[0];
          const nz = turn > 0 ? right[1] : -right[1];
          const ns = s.axis === 'z' ? nx : nz;
          const probe = (s.axis === 'z' ? v.x : v.z) + ns * 20;
          if (limit(s.axis === 'z' ? 'x' : 'z', ns, probe)) turn = 0;
          else {
            s.axis = s.axis === 'z' ? 'x' : 'z';
            s.sign = ns;
            s.center = c;
          }
        }
        break;
      }
      const speedAbs = Math.abs(v.speed);
      const look = 9 + speedAbs * 0.5;
      const ta = along + s.sign * look;
      const tl = laneAt(s.axis, s.center, s.sign);
      const tx = s.axis === 'z' ? tl : ta;
      const tz = s.axis === 'z' ? ta : tl;
      const err = wrap(Math.atan2(tx - v.x, tz - v.z) - v.heading);
      inp.steer = Math.max(-1, Math.min(1, -err * 2.2));
      let target = v.spec.maxSpeed * 0.4 * (v.spec.kind === 'truck' ? 0.9 : 1);
      if (v.panic > 0) {
        v.panic -= dt;
        target *= 1.7;
      }
      const sx = Math.sin(v.heading);
      const sz = Math.cos(v.heading);
      const block = (ox, oz, osp, extra) => {
        const dx = ox - v.x;
        const dz = oz - v.z;
        const f = dx * sx + dz * sz;
        const l = dx * sz - dz * sx;
        if (f > 0 && f < 16 + speedAbs * 0.6 && Math.abs(l) < 2.4 + extra) target = Math.min(target, f < 6 ? 0 : Math.max(0, osp - 2));
      };
      for (const o of G.vehicles.list) if (o !== v) block(o.x, o.z, Math.max(0, o.speed), 0);
      for (const p of G.peds.list) if (p.state !== 'dead') block(p.x, p.z, 0, -0.6);
      if (G.player.inVehicle === false) block(G.player.x, G.player.z, 0, -0.6);
      if (Math.abs(across - tl) > 6 && (v.air || speedAbs < 0.5) && v.stuck > 1.5) {
        inp.throttle = -1;
        inp.steer = -inp.steer;
      } else {
        inp.throttle = Math.max(-1, Math.min(1, (target - v.speed) * 0.5));
      }
      inp.brake = inp.throttle < 0 && v.speed > 1 ? -inp.throttle : 0;
      if (inp.throttle < 0 && v.speed > 1) inp.throttle = 0;
      v.stuck = speedAbs < 0.4 && target > 2 ? (v.stuck || 0) + dt : 0;
      if (v.stuck > 5) v.despawn = true;
    };
  }

  T.spawnOnRoad = (specId, axis, c, along, sign, color, owner = 'traffic') => {
    const lane = laneAt(axis, c, sign);
    const x = axis === 'z' ? lane : along;
    const z = axis === 'z' ? along : lane;
    const heading = axis === 'z' ? (sign > 0 ? 0 : Math.PI) : sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    const state = { axis, sign, center: c, last: null };
    const v = G.vehicles.spawn(specId, x, z, heading, { color, owner, ai: makeAi(state) });
    v.driver = 'ai';
    const sp = v.spec.maxSpeed * 0.35;
    v.vx = Math.sin(heading) * sp;
    v.vz = Math.cos(heading) * sp;
    v.state = state;
    return v;
  };

  function spawnOne() {
    const px = G.player.x;
    const pz = G.player.z;
    const axis = rng.chance(0.5) ? 'z' : 'x';
    const c = rng.pick(axis === 'z' ? ROADS.x : ROADS.z);
    const sign = rng.sign();
    const along = (axis === 'z' ? pz : px) + rng.range(-120, 120);
    const x = axis === 'z' ? c : along;
    const z = axis === 'z' ? along : c;
    if (limit(axis, 1, along) || limit(axis, -1, along)) return;
    if (Math.hypot(x - px, z - pz) < 55) return;
    const crossing = (axis === 'z' ? ROADS.z : ROADS.x).some((r) => Math.abs(r - along) < 12);
    if (crossing) return;
    if (G.vehicles.list.some((o) => Math.hypot(o.x - x, o.z - z) < 14)) return;
    T.spawnOnRoad(rng.pick(TRAFFIC_SPECS), axis, c, along, sign, rng.pick(CAR_COLORS));
  }

  T.step = (dt) => {
    let count = 0;
    for (const v of G.vehicles.list) if (v.owner === 'traffic' && v.ai) count += 1;
    if (count < 24 && rng.chance(0.5)) spawnOne();
    for (const v of [...G.vehicles.list]) {
      if (v.owner !== 'traffic') continue;
      const far = Math.hypot(v.x - G.player.x, v.z - G.player.z);
      if (v.despawn || far > 190) G.vehicles.remove(v);
    }
  };

  T.alarm = (x, z) => {
    for (const v of G.vehicles.list) if (v.owner === 'traffic' && Math.hypot(v.x - x, v.z - z) < 26) v.panic = 5;
  };

  return T;
}
