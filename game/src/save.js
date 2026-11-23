// Three save slots in localStorage; falls back to memory when storage is blocked.
import { districtAt } from './config.js';

const KEY = 'solaris-coast.slot';
const memory = {};

const valid = (d) => Boolean(d && typeof d === 'object' && !Array.isArray(d) && Number.isFinite(d.cash) && Number.isFinite(d.missions));

function read(i) {
  try {
    const raw = window.localStorage.getItem(`${KEY}${i}`);
    if (raw) {
      const data = JSON.parse(raw);
      return valid(data) ? data : null;
    }
  } catch {
    // storage blocked or corrupt: use the in-memory copy
  }
  return valid(memory[i]) ? memory[i] : null;
}

function write(i, data) {
  memory[i] = data;
  try {
    window.localStorage.setItem(`${KEY}${i}`, JSON.stringify(data));
  } catch {
    // memory copy keeps this visit playable
  }
}

export function createSave(G) {
  const S = { slot: 0 };
  S.slots = () => [0, 1, 2].map(read);
  S.snapshot = () => ({
    when: new Date().toISOString().slice(0, 16).replace('T', ' '),
    cash: G.player.cash,
    missions: G.missions.done,
    where: districtAt(G.player.x, G.player.z),
    activities: G.activities.state(),
    progress: G.progress.state(),
    ammo: G.player.weapons.map((w) => [w.mag, w.reserve]),
  });
  S.autosave = () => write(S.slot, S.snapshot());
  S.saveTo = (i) => {
    S.slot = i;
    S.autosave();
  };
  S.load = (i) => {
    const d = read(i);
    if (!d) return false;
    S.slot = i;
    G.player.cash = d.cash;
    G.missions.reset(d.missions);
    G.activities.load(d.activities);
    G.progress.load(d.progress);
    (d.ammo || []).forEach((a, k) => {
      if (G.player.weapons[k] && Array.isArray(a) && Number.isFinite(a[0]) && Number.isFinite(a[1])) [G.player.weapons[k].mag, G.player.weapons[k].reserve] = a;
    });
    return true;
  };
  S.fresh = (i) => {
    S.slot = i;
    memory[i] = null;
    try {
      window.localStorage.removeItem(`${KEY}${i}`);
    } catch {
      // nothing stored
    }
  };
  return S;
}
