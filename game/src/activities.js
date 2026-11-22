// Side activities: street race, stunt jumps, crew garage, safehouse, district respect.
import { CAR_COLORS, DISTRICTS, LANDMARKS, RESPECT_LEVELS } from './config.js';
import { makeBeacon, setBeacon } from './missions.js';

const RACE = {
  limit: 48, cash: 1200, respect: 40,
  points: [[130, -110], [60, -110], [60, 60], [130, 60], [130, -20]],
};

export function createActivities(G) {
  const A = {
    respect: Object.fromEntries(DISTRICTS.map((d) => [d.id, 0])),
    stuntBest: 0, stuntLast: 0, race: null, garage: { open: false, msg: '' }, safeMsg: '', launch: null,
  };
  const garageB = makeBeacon('#27e3ff');
  const safeB = makeBeacon('#9dff5a');
  const raceB = makeBeacon('#ff3fb4');
  const cpB = makeBeacon('#ffe14a');
  G.scene.add(garageB, safeB, raceB, cpB);
  setBeacon(garageB, LANDMARKS.garage.x, LANDMARKS.garage.z, 5);
  setBeacon(safeB, LANDMARKS.safehouse.x, LANDMARKS.safehouse.z, 4.5);
  setBeacon(raceB, LANDMARKS.raceStart.x, LANDMARKS.raceStart.z, 5);
  for (const b of [garageB, safeB, raceB]) b.userData.beam.scale.y = 0.3;

  A.level = (id) => RESPECT_LEVELS.filter((r) => A.respect[id] >= r).length - 1;
  A.addRespect = (id, n) => {
    const before = A.level(id);
    A.respect[id] += n;
    if (A.level(id) > before) G.hud.toast(`${DISTRICTS.find((d) => d.id === id).name}: respect level ${A.level(id)}`);
  };
  const discount = () => 1 - 0.08 * Math.max(0, A.level('palma'));

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
    G.player.cash += A.stuntLast * 8;
    G.hud.toast(`STUNT JUMP ${A.stuntLast} m  +$${A.stuntLast * 8}`);
    A.addRespect('mirador', 5);
  };

  function buy(cost, fn) {
    const price = Math.round(cost * discount());
    if (G.player.cash < price) {
      A.garage.msg = `Need $${price}`;
      return;
    }
    G.player.cash -= price;
    A.garage.msg = fn();
    G.audio.click();
  }

  function garageAction(input) {
    const v = G.player.vehicle;
    if (input.take('Digit1')) {
      buy(120, () => {
        v.hp = v.maxHp;
        v.burning = 0;
        return 'Repaired';
      });
    } else if (input.take('Digit2')) {
      buy(80, () => {
        const c = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
        v.parts.paint.color.set(c);
        return 'Resprayed';
      });
    } else if (input.take('Digit3')) {
      buy(400 * Math.round((v.tune - 1) / 0.07 + 1), () => {
        if (v.tune > 1.19) return 'Fully tuned';
        v.tune += 0.07;
        return `Tuned to level ${Math.round((v.tune - 1) / 0.07)}`;
      });
    } else if (input.take('Digit4')) {
      buy(500, () => {
        G.police.clear();
        return 'Heat cleared';
      });
    }
  }

  A.step = (dt, t, input) => {
    const pl = G.player;
    for (const b of [garageB, safeB, raceB, cpB]) {
      b.userData.arrow.position.y = 6 + Math.sin(t * 3) * 0.5;
      b.userData.arrow.rotation.y = t * 1.6;
    }
    const dg = Math.hypot(pl.x - LANDMARKS.garage.x, pl.z - LANDMARKS.garage.z);
    const ds = Math.hypot(pl.x - LANDMARKS.safehouse.x, pl.z - LANDMARKS.safehouse.z);
    const dr = Math.hypot(pl.x - LANDMARKS.raceStart.x, pl.z - LANDMARKS.raceStart.z);
    A.nearGarage = dg < 6 && pl.inVehicle;
    A.nearSafe = ds < 6;
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
      } else if (A.nearRace) startRace();
    }
    if (pl.wasted) A.race = null;
    stepRace(dt);
    cpB.visible = !!A.race;
    raceB.visible = !A.race;
  };

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
    if (A.nearRace) return '[E] START STREET RACE';
    return '';
  };
  return A;
}
