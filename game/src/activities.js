// Side activities: street race, stunt jumps, crew garage, hospital, safehouse, district respect.
import { CAR_COLORS, DISTRICTS, LANDMARKS, RESPECT_LEVELS, WEAPONS } from './config.js';
import { makeBeacon, setBeacon } from './missions.js';

const RACE = {
  limit: 48, cash: 1200, respect: 40,
  points: [[130, -110], [60, -110], [60, 60], [130, 60], [130, -20]],
};
const HOSPITAL_FEE = 150;
const MAX_UPGRADE = 3;

/** The seven crew garage actions, keys 1-7; `base` is the price before the Palma discount. */
export const GARAGE_SERVICES = [
  { id: 'repair', label: 'REPAIR', base: 120 },
  { id: 'respray', label: 'RESPRAY', base: 80 },
  { id: 'tune', label: 'STAGE TUNE', base: 400, maxMsg: 'Fully tuned' },
  { id: 'armor', label: 'ARMOR PLATING', base: 350, maxMsg: 'Plating maxed' },
  { id: 'nitro', label: 'NITRO SYSTEM', base: 300, maxMsg: 'Nitro maxed' },
  { id: 'ammo', label: 'AMMO + ARMOR', base: 250 },
  { id: 'clear', label: 'CLEAR HEAT', base: 500 },
];

export function createActivities(G) {
  const A = {
    respect: Object.fromEntries(DISTRICTS.map((d) => [d.id, 0])),
    stuntBest: 0, stuntLast: 0, race: null, garage: { open: false, msg: '' }, safeMsg: '', launch: null,
  };
  const garageB = makeBeacon('#27e3ff');
  const safeB = makeBeacon('#9dff5a');
  const hospB = makeBeacon('#ff6a7a');
  const raceB = makeBeacon('#ff3fb4');
  const cpB = makeBeacon('#ffe14a');
  G.scene.add(garageB, safeB, hospB, raceB, cpB);
  setBeacon(garageB, LANDMARKS.garage.x, LANDMARKS.garage.z, 5);
  setBeacon(safeB, LANDMARKS.safehouse.x, LANDMARKS.safehouse.z, 4.5);
  setBeacon(hospB, LANDMARKS.hospital.x, LANDMARKS.hospital.z, 4);
  setBeacon(raceB, LANDMARKS.raceStart.x, LANDMARKS.raceStart.z, 5);
  for (const b of [garageB, safeB, hospB, raceB]) b.userData.beam.scale.y = 0.3;

  A.level = (id) => RESPECT_LEVELS.filter((r) => A.respect[id] >= r).length - 1;
  A.addRespect = (id, n) => {
    const before = A.level(id);
    A.respect[id] += n;
    if (A.level(id) > before) G.hud.toast(`${DISTRICTS.find((d) => d.id === id).name}: respect level ${A.level(id)}`);
  };
  const discount = () => 1 - 0.08 * Math.max(0, A.level('palma'));

  /** Price per service id, or null when that upgrade is maxed (or there is no car). */
  A.garagePrices = (v) => {
    const tier = (n) => (!v || n >= MAX_UPGRADE ? null : n + 1);
    const tuneLvl = v ? Math.round((v.tune - 1) / 0.07) : 0;
    const mult = { tune: tier(tuneLvl), armor: tier(v ? v.plating : 0), nitro: tier(v ? v.nitroLvl : 0) };
    return Object.fromEntries(GARAGE_SERVICES.map((s) => [s.id, s.id in mult ? (mult[s.id] === null ? null : Math.round(s.base * mult[s.id] * discount())) : Math.round(s.base * discount())]));
  };

  A.onLaunch = (v) => {
    if (v.driver === 'player') A.launch = { x: v.x, z: v.z };
  };
  A.onLand = (v) => {
    if (v.driver !== 'player' || !A.launch) return;
    const d = Math.hypot(v.x - A.launch.x, v.z - A.launch.z);
    A.launch = null;
    if (d < 9) return;
    A.stuntLast = Math.round(d);
    A.stuntBest = Math.max(A.stuntBest, A.stuntLast);
    G.progress.onStunt();
    G.player.cash += A.stuntLast * 8;
    G.hud.toast(`STUNT JUMP ${A.stuntLast} m  +$${A.stuntLast * 8}`);
    A.addRespect('mirador', 5);
  };

  const EFFECTS = {
    repair(v) {
      v.hp = v.maxHp;
      v.burning = 0;
      return 'Repaired';
    },
    respray(v) {
      v.paintIdx = ((v.paintIdx ?? -1) + 1) % CAR_COLORS.length;
      v.parts.paint.color.set(CAR_COLORS[v.paintIdx]);
      const stars = G.police.stars;
      G.police.dropStars(1);
      return stars > G.police.stars ? 'Resprayed, one star shed' : 'Resprayed';
    },
    tune(v) {
      v.tune += 0.07;
      return `Tuned to level ${Math.round((v.tune - 1) / 0.07)}`;
    },
    armor(v) {
      const add = v.spec.hp * 0.25;
      v.plating += 1;
      v.maxHp += add;
      v.hp += add;
      return `Armor plating level ${v.plating}`;
    },
    nitro(v) {
      v.nitroLvl += 1;
      v.nitro = 1;
      return `Nitro system level ${v.nitroLvl}`;
    },
    ammo() {
      G.player.weapons.forEach((w, i) => {
        if (i === 0) return;
        w.mag = WEAPONS[i].mag;
        w.reserve = WEAPONS[i].reserve;
      });
      G.player.armor = 100;
      return 'Ammo and armor topped up';
    },
    clear() {
      G.police.clear();
      return 'Heat cleared';
    },
  };

  /** Runs garage service `i` (0-6) for the car the player is in; used by keys 1-7 and the panel buttons. */
  A.garageAct = (i) => {
    const s = GARAGE_SERVICES[i];
    const v = G.player.vehicle;
    const price = A.garagePrices(v)[s.id];
    if (price === null) {
      A.garage.msg = s.maxMsg;
      return;
    }
    if (G.player.cash < price) {
      A.garage.msg = `Need $${price}`;
      return;
    }
    G.player.cash -= price;
    A.garage.msg = EFFECTS[s.id](v);
    G.progress.onGarage(s.id);
    G.audio.click();
  };

  function garageAction(input) {
    GARAGE_SERVICES.forEach((_, i) => {
      if (input.take(`Digit${i + 1}`)) A.garageAct(i);
    });
  }

  A.step = (dt, t, input) => {
    const pl = G.player;
    for (const b of [garageB, safeB, hospB, raceB, cpB]) {
      b.userData.arrow.position.y = 6 + Math.sin(t * 3) * 0.5;
      b.userData.arrow.rotation.y = t * 1.6;
    }
    const dg = Math.hypot(pl.x - LANDMARKS.garage.x, pl.z - LANDMARKS.garage.z);
    const ds = Math.hypot(pl.x - LANDMARKS.safehouse.x, pl.z - LANDMARKS.safehouse.z);
    const dh = Math.hypot(pl.x - LANDMARKS.hospital.x, pl.z - LANDMARKS.hospital.z);
    const dr = Math.hypot(pl.x - LANDMARKS.raceStart.x, pl.z - LANDMARKS.raceStart.z);
    A.nearGarage = dg < 6 && pl.inVehicle;
    A.nearSafe = ds < 6;
    A.nearHospital = dh < 5 && !pl.inVehicle;
    A.nearRace = dr < 7 && pl.inVehicle && !A.race;
    if (A.garage.open) {
      if (!A.nearGarage || input.take('KeyE') || input.take('Escape')) {
        A.garage.open = false;
      } else {
        pl.vehicle.input.throttle = 0;
        pl.vehicle.input.brake = 1;
        garageAction(input);
      }
    } else if (input.take('KeyE')) {
      if (A.nearGarage) {
        A.garage.open = true;
        A.garage.msg = '';
      } else if (A.nearSafe) {
        pl.hp = 100;
        pl.armor = Math.max(pl.armor, 50);
        G.save.autosave();
        G.hud.toast('Safehouse: rested and saved');
      } else if (A.nearHospital) treat();
      else if (A.nearRace) startRace();
    }
    if (pl.wasted) A.race = null;
    stepRace(dt);
    cpB.visible = !!A.race;
    raceB.visible = !A.race;
  };

  function treat() {
    const pl = G.player;
    if (pl.hp >= 100 && pl.armor >= 50) G.hud.toast('Hospital: no treatment needed');
    else if (pl.cash < HOSPITAL_FEE) G.hud.toast(`Hospital: need $${HOSPITAL_FEE}`);
    else {
      pl.cash -= HOSPITAL_FEE;
      pl.hp = 100;
      pl.armor = Math.max(pl.armor, 50);
      G.audio.click();
      G.hud.toast(`Hospital: treated  -$${HOSPITAL_FEE}`);
    }
  }

  function startRace() {
    A.race = { idx: 0, time: RACE.limit };
    setBeacon(cpB, RACE.points[0][0], RACE.points[0][1], 6);
    G.hud.toast('STREET RACE: hit every checkpoint');
    G.police.radio('Dispatch: illegal street race reported on Mirador Boulevard.');
  }

  function stepRace(dt) {
    const r = A.race;
    if (!r) return;
    const pl = G.player;
    r.time -= dt;
    const p = RACE.points[r.idx];
    if (!pl.inVehicle) {
      A.race = null;
      G.hud.toast('Race abandoned');
      return;
    }
    if (Math.hypot(pl.x - p[0], pl.z - p[1]) < 8) {
      r.idx += 1;
      G.audio.click();
      if (r.idx >= RACE.points.length) {
        pl.cash += RACE.cash;
        G.progress.onRace();
        A.addRespect('mirador', RACE.respect);
        G.hud.banner('RACE WON', '#ff3fb4', `+$${RACE.cash}`);
        A.race = null;
        return;
      }
      setBeacon(cpB, RACE.points[r.idx][0], RACE.points[r.idx][1], 6);
    }
    if (r.time <= 0) {
      G.hud.banner('RACE LOST', '#ff3a4a');
      A.race = null;
    }
  }

  A.state = () => ({ respect: A.respect, stuntBest: A.stuntBest });
  A.load = (s) => {
    if (!s) return;
    Object.assign(A.respect, s.respect || {});
    A.stuntBest = s.stuntBest || 0;
  };
  A.prompt = () => {
    if (A.garage.open) return '';
    if (A.nearGarage) return '[E] CREW GARAGE';
    if (A.nearSafe) return '[E] SAFEHOUSE  REST AND SAVE';
    if (A.nearHospital) return `[E] HOSPITAL  TREAT $${HOSPITAL_FEE}`;
    if (A.nearRace) return '[E] START STREET RACE';
    return '';
  };
  return A;
}
