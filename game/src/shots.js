// Deterministic scenes behind ?shot=cover|combat|harbor|title (start|play|end are aliases). Each one places real
// world entities, advances the simulation a fixed number of steps so particles, traffic and lights settle,
// then aims the camera and refreshes the HUD. The same seed always gives the same frame.
import { STEP } from './config.js';

const ALIAS = { start: 'cover', play: 'combat', end: 'harbor' };

/** Run n simulation steps; `each` re-pins staged entities before every step. */
function run(G, n, each) {
  for (let i = 0; i < n; i += 1) {
    if (each) each(i, n);
    G.stepWorld(STEP);
  }
}

function aim(G, pos, look, fov = 60) {
  G.camera.fov = fov;
  G.camera.updateProjectionMatrix();
  G.camera.position.set(pos[0], pos[1], pos[2]);
  G.camera.lookAt(look[0], look[1], look[2]);
  G.camYaw = Math.atan2(look[0] - pos[0], look[2] - pos[2]);
}

function pin(v, x, z, heading, speed, drift = 0) {
  v.x = x;
  v.z = z;
  v.heading = heading;
  v.vx = Math.sin(heading + drift) * speed;
  v.vz = Math.cos(heading + drift) * speed;
  v.speed = speed;
}

function clearTraffic(G, x, z, r) {
  for (const v of [...G.vehicles.list]) if (v.owner === 'traffic' && Math.hypot(v.x - x, v.z - z) < r) G.vehicles.remove(v);
}

function cover(G) {
  const P = G.police;
  P.frozen = true;
  G.player.x = 132;
  G.player.z = -48;
  G.missions.start();
  G.missions.jump(2);
  G.missions.lines.length = 0;
  G.missions.say([['Elena', 'Cops are on your tail, Mateo. Hit the garage in Palma Heights.']]);
  const hero = G.vehicles.spawn('solara', 133.5, -40, Math.PI, { owner: 'player' });
  G.player.enter(hero);
  G.player.cash = 4280;
  G.activities.respect.mirador = 130;
  const chase = [
    G.vehicles.spawn('interceptor', 126.5, -27, Math.PI, { owner: 'police' }),
    G.vehicles.spawn('interceptor', 133.5, -22, Math.PI, { owner: 'police' }),
  ];
  const block = [
    G.vehicles.spawn('interceptor', 127.5, -98, Math.PI / 2 + 0.35, { owner: 'police' }),
    G.vehicles.spawn('interceptor', 133.5, -98, Math.PI / 2 - 0.3, { owner: 'police' }),
  ];
  for (const v of [...chase, ...block]) {
    v.sirens = true;
    v.driver = 'ai';
  }
  P.spawnOfficer(131, -102, 'patrol').hold = 1;
  P.spawnOfficer(125, -102, 'tactical').hold = 1;
  P.addHeat(110);
  P.radio('Dispatch: vehicle theft in progress, Mirador Beachfront.');
  P.radio('All units: suspect in a stolen Solara GT, northbound.');
  P.radio('CONDOR-1 has visual. Searchlight on the suspect.');
  P.forced = true;
  const heli = () => P.heli;
  run(G, 90, () => {
    clearTraffic(G, 130, -60, 110);
    pin(hero, 133.5, -40, Math.PI + 0.4, 30, -0.4);
    hero.input.nitro = true;
    pin(chase[0], 126.5, -27, Math.PI + 0.03, 30);
    pin(chase[1], 133.5, -22, Math.PI - 0.02, 30);
    for (const b of block) {
      b.vx = 0;
      b.vz = 0;
    }
    G.player.x = hero.x;
    G.player.z = hero.z;
    const h = heli();
    if (h) {
      h.pos.set(131, 21, -72);
      h.aim.set(133.5, 0, -47);
      h.g.rotation.y = Math.PI + 0.25;
      h.pos.y = 29;
    }
  });
  hero.parts.flame.material.opacity = 0.95;
  hero.parts.flame.scale.setScalar(5);
  hero.boosting = true;
  hero.input.steer = -0.6;
  hero.steer = -0.3;
  G.hud.toast('');
  aim(G, [130, 2.9, -12], [131.5, 7.2, -60], 46);
}

function combat(G) {
  G.police.frozen = true;
  const p = G.player;
  p.x = -17;
  p.z = -62.5;
  p.heading = Math.PI;
  p.camYaw = Math.PI;
  p.weapon = 2;
  p.hp = 82;
  p.armor = 45;
  p.cash = 1500;
  G.activities.respect.crown = 220;
  G.missions.reset(2);
  const apex = G.vehicles.spawn('aurelia', -14, -63, Math.PI, { owner: 'parked' });
  apex.sleep = true;
  apex.driver = 'ai';
  const wreck = G.vehicles.spawn('vipera', -21.5, -76, 0.5, { owner: 'parked' });
  const parked2 = G.vehicles.spawn('solara', -26.5, -50, Math.PI, { owner: 'parked', color: '#1f8fff' });
  parked2.sleep = true;
  const GM = [[-26, -91], [-13, -93], [-20, -98], [-30, -86]];
  const gunmen = GM.map(([x, z]) => G.combat.spawnEnemy(x, z, { alert: 20 }));
  gunmen.forEach((e) => {
    e.strafe = 0;
  });
  G.police.addHeat(30);
  G.police.forced = true;
  G.police.radio('Dispatch: gunfire at the Crown underpass. Units en route.');
  for (const [x, z] of [[-31, -50], [-8, -58], [-9, -80]]) {
    const ped = G.peds.spawnAt(x, z, { flee: true });
    ped.axis = 'z';
    ped.line = x;
    ped.dir = -1;
  }
  run(G, 50, () => {
    clearTraffic(G, -20, -70, 90);
    p.x = -17;
    p.z = -62.5;
    p.heading = Math.PI;
    gunmen.forEach((e, i) => {
      e.hp = 60;
      e.alert = 20;
      e.x = GM[i][0];
      e.z = GM[i][1];
    });
  });
  G.vehicles.explode(wreck);
  const fire = (n) => {
    for (let k = 0; k < n; k += 1) {
      G.fx.muzzle(p.x - 0.2, 1.4, p.z - 1.0, '#ffd36a');
      G.combat.shoot(p.x - 0.1, 1.4, p.z - 0.9, Math.PI + (k - n / 2) * 0.012, { pellets: 1, spread: 0.01, range: 60, dmg: 0, color: '#ffd36a', id: 'smg' }, 'player', p);
    }
  };
  run(G, 14, (i) => {
    clearTraffic(G, -20, -70, 90);
    p.x = -17;
    p.z = -62.5;
    gunmen.forEach((e, k) => {
      e.hp = 60;
      e.x = GM[k][0];
      e.z = GM[k][1];
    });
    if (i === 13) fire(4);
  });
  p.heading = Math.PI;
  p.mesh.userData.armR.rotation.x = -1.45;
  p.mesh.userData.weapon.visible = true;
  G.player.step(STEP, G.time(), { mouse: { left: false }, down: () => false, take: () => false, look: () => ({ dx: 0, dy: 0 }) });
  p.mesh.userData.armR.rotation.x = -1.45;
  fire(3);
  p.hurtT = 0;
  p.hp = 82;
  G.hud.toast('');
  aim(G, [-15.2, 3.0, -52.5], [-19.5, 2.4, -80], 60);
}

function harbor(G) {
  G.police.frozen = true;
  const p = G.player;
  p.x = -20;
  p.z = 122;
  p.heading = 0;
  p.camYaw = 0;
  p.weapon = 4;
  p.wheelT = 9;
  p.hp = 100;
  p.armor = 70;
  p.cash = 12850;
  G.activities.respect.harbor = 340;
  G.missions.reset(6);
  G.missions.start();
  G.missions.jump(1);
  G.missions.target.z = 141;
  G.missions.target.x = 3;
  G.missions.lines.length = 0;
  G.missions.say([['Elena', 'It is armoured. Use the pulse rifle and keep moving.']]);
  G.police.radio('Dispatch: Syndicate armour spotted at Harbor Caldera quay.');
  const apc = G.missions.target;
  const crates = G.vehicles.spawn('cargo', -32, 118, Math.PI, { owner: 'parked' });
  crates.sleep = true;
  const gun = G.combat.spawnEnemy(-25, 141, { alert: 0 });
  gun.hp = 60;
  run(G, 40, () => {
    clearTraffic(G, -20, 140, 90);
    p.x = -20;
    p.z = 122;
    apc.vx = 0;
    apc.vz = 0;
    apc.z = 141;
    apc.x = 3;
    apc.heading = Math.PI * 1.2;
    apc.hp = apc.maxHp;
    gun.alert = 0;
  });
  G.missions.step_(STEP, G.time());
  G.hud.toast('');
  aim(G, [-20.6, 3.3, 114.5], [-17, 3.6, 165], 62);
}

function title(G) {
  run(G, 120);
  G.titleCamera(G.time());
}

export function stageShot(name, G) {
  const key = ALIAS[name] || name;
  const scenes = { cover, combat, harbor, title };
  const scene = scenes[key] || title;
  scene(G);
  if (scene !== title) {
    clearTraffic(G, G.camera.position.x, G.camera.position.z, 45);
    G.player.mesh.visible = !G.player.inVehicle;
    G.hud.update(STEP, G.time(), 'shot');
  } else {
    G.hud.refreshSlots(0);
    G.hud.update(STEP, G.time(), 'title');
  }
}
