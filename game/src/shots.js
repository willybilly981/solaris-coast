// Deterministic scenes behind ?shot=cover|combat|atlas|title (start|play|map are aliases). Each one places real
// world entities, advances the simulation a fixed number of steps so particles, traffic and lights settle,
// then aims the camera and refreshes the HUD. The same seed always gives the same frame.
import { STEP } from './config.js';

const ALIAS = { start: 'cover', play: 'combat', map: 'atlas' };
const ALL_DISTRICTS = ['mirador', 'crown', 'harbor', 'palma'];
const IDLE_INPUT = { mouse: { left: false }, down: () => false, take: () => false, look: () => ({ dx: 0, dy: 0 }) };

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

/** A mid-campaign career, so the progression UI shows real numbers instead of an empty profile. */
const CAMPAIGN = {
  rp: 1650, relics: ['r1', 'r2', 'r3', 'r5', 'r7', 'r9', 'r11'], grades: { m1: 'G', m2: 'S', m3: 'G', m4: 'B', m5: 'S' },
  garage: { repair: true, respray: true, tune: true, armor: true }, explored: ALL_DISTRICTS, races: 2, stunts: 3, evades: 6,
  stats: { distance: 48210, topSpeed: 214, takedowns: 17, maxHeat: 4, earned: 126450 },
};

const seedCareer = (G) => G.progress.load(CAMPAIGN);

/** A save-slot record for the menu and atlas previews; `n` overrides the campaign's rank and relic count. */
const slotRecord = (missions, rp, where, cash, relics) => ({
  when: '2026-11-22 20:41', cash, missions, where, activities: { respect: {}, stuntBest: 0 }, progress: { ...CAMPAIGN, rp, relics: CAMPAIGN.relics.slice(0, relics) },
});

function cover(G) {
  const P = G.police;
  P.frozen = true;
  seedCareer(G);
  G.player.x = 131;
  G.player.z = -58;
  G.missions.reset(0);
  G.missions.start();
  G.missions.jump(2);
  G.progress.run.t0 -= 71;
  G.missions.lines.length = 0;
  G.missions.say([['elena', 'Cops are on your tail, Kai. Hit the garage in Palma Heights.']]);
  G.crew.cd.X = 22;
  G.player.weapon = 2;
  G.player.cash = 18450;
  G.activities.respect.mirador = 130;
  const hero = G.vehicles.spawn('solara', 131, -58, 0.3, { owner: 'player' });
  hero.hp = 78;
  G.player.enter(hero);
  const chase = [
    G.vehicles.spawn('interceptor', 130.5, -69, 0, { owner: 'police' }),
    G.vehicles.spawn('interceptor', 136, -80, 0, { owner: 'police' }),
    G.vehicles.spawn('interceptor', 126, -96, 0, { owner: 'police' }),
  ];
  for (const v of chase) {
    v.sirens = true;
    v.driver = 'ai';
  }
  P.addHeat(110);
  P.radio('Dispatch: vehicle theft in progress, Mirador Beachfront.');
  P.forced = true;
  run(G, 90, () => {
    clearTraffic(G, 130, -70, 120);
    pin(hero, 131, -58, 0.3, 40, -0.3);
    hero.input.steer = 0.5;
    hero.steer = 0.25;
    pin(chase[0], 130.5, -69, 0.02, 40);
    pin(chase[1], 136, -80, -0.04, 40);
    pin(chase[2], 126, -96, 0.03, 40);
    G.player.x = hero.x;
    G.player.z = hero.z;
    const h = P.heli;
    if (h) {
      h.pos.set(129, 19, -78);
      h.aim.set(131, 0, -58);
      h.g.rotation.y = 0.15;
    }
  });
  G.hud.toast('');
  aim(G, [126.4, 1.7, -43], [131.5, 5.2, -64], 58);
}

function combat(G) {
  G.police.frozen = true;
  seedCareer(G);
  const p = G.player;
  p.x = -17;
  p.z = -62.5;
  p.heading = Math.PI;
  p.camYaw = Math.PI;
  p.weapon = 2;
  p.hp = 82;
  p.armor = 45;
  p.cash = 18450;
  G.activities.respect.crown = 220;
  G.missions.reset(1);
  G.missions.start();
  G.missions.jump(1);
  G.missions.lines.length = 0;
  G.missions.say([['elena', 'Two on the left, three behind the van. I have your six.']]);
  G.crew.cd.Z = 31;
  const apex = G.vehicles.spawn('aurelia', -14, -63, Math.PI, { owner: 'parked' });
  apex.sleep = true;
  apex.driver = 'ai';
  const wreck = G.vehicles.spawn('vipera', -21.5, -76, 0.5, { owner: 'parked' });
  const parked2 = G.vehicles.spawn('solara', -26.5, -50, Math.PI, { owner: 'parked', color: '#1f8fff' });
  parked2.sleep = true;
  const GM = [[-26, -91], [-13, -93], [-20, -98], [-30, -86]];
  const gunmen = G.missions.spawned.filter((e) => e.mission);
  gunmen.forEach((e, i) => {
    e.x = GM[i][0];
    e.z = GM[i][1];
    e.alert = 20;
    e.strafe = 0;
  });
  G.police.addHeat(30);
  G.police.forced = true;
  G.police.radio('Dispatch: gunfire at the Crown underpass. Units en route.');
  const ally = G.combat.ally;
  ally.x = -21.5;
  ally.z = -58;
  for (const [x, z] of [[-31, -50], [-8, -58], [-9, -80]]) {
    const ped = G.peds.spawnAt(x, z, { flee: true });
    ped.axis = 'z';
    ped.line = x;
    ped.dir = -1;
    ped.handsUp = true;
  }
  const pinAll = () => {
    clearTraffic(G, -20, -70, 90);
    p.x = -17;
    p.z = -62.5;
    p.heading = Math.PI;
    ally.x = -21.5;
    ally.z = -58;
    gunmen.forEach((e, i) => {
      e.hp = 60;
      e.alert = 20;
      e.x = GM[i][0];
      e.z = GM[i][1];
    });
  };
  run(G, 50, pinAll);
  G.vehicles.explode(wreck);
  const fire = (n) => {
    for (let k = 0; k < n; k += 1) {
      G.fx.muzzle(p.x - 0.2, 1.4, p.z - 1.0, '#ffd36a');
      G.combat.shoot(p.x - 0.1, 1.4, p.z - 0.9, Math.PI + (k - n / 2) * 0.012, { pellets: 1, spread: 0.01, range: 60, dmg: 0, color: '#ffd36a', id: 'smg' }, 'player', p);
    }
  };
  run(G, 40, (i) => {
    pinAll();
    if (i === 39) fire(4);
  });
  p.heading = Math.PI;
  p.mesh.userData.armR.rotation.x = -1.45;
  p.mesh.userData.weapon.visible = true;
  p.step(STEP, G.time(), IDLE_INPUT);
  p.mesh.userData.armR.rotation.x = -1.45;
  fire(3);
  G.combat.hitT = 0.2;
  G.combat.shotT = 0.1;
  p.hurtT = 0;
  p.hp = 82;
  G.hud.toast('');
  aim(G, [-15.2, 3.0, -52.5], [-19.5, 2.4, -80], 60);
}

function atlas(G) {
  G.police.frozen = true;
  seedCareer(G);
  G.missions.reset(5);
  G.player.x = 141;
  G.player.z = 22;
  G.player.heading = Math.PI;
  G.player.cash = 28450;
  G.waypoint = { x: -20, z: 150 };
  G.police.setStars(2);
  G.police.forced = true;
  G.police.lastSeen.x = 150;
  G.police.lastSeen.z = -10;
  G.save.slots = () => [slotRecord(5, 1650, 'mirador', 28450, 7), slotRecord(2, 520, 'palma', 9300, 3), null];
  G.save.slot = 0;
  run(G, 30);
  aim(G, [200, 70, 120], [20, 30, -60], 60);
  G.atlas.show('MAP');
  G.atlas.draw(1.2);
}

function title(G) {
  // staged campaigns for the menu preview only; the real save slots are never written
  G.save.slots = () => [slotRecord(5, 1650, 'mirador', 28450, 7), slotRecord(2, 520, 'palma', 9300, 3), slotRecord(7, 3100, 'harbor', 84200, 6)];
  run(G, 120);
  G.titleCamera(G.time());
}

export function stageShot(name, G) {
  const key = ALIAS[name] || name;
  const scenes = { cover, combat, atlas, title };
  const scene = scenes[key] || title;
  scene(G);
  if (scene !== title) {
    if (scene !== atlas) clearTraffic(G, G.camera.position.x, G.camera.position.z, 45);
    G.player.mesh.visible = !G.player.inVehicle;
    G.hud.update(STEP, G.time(), 'shot');
  } else {
    G.hud.refreshSlots(0);
    G.hud.update(STEP, G.time(), 'title');
  }
}
