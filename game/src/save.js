// Three save slots in localStorage; falls back to memory when storage is blocked.

const KEY = 'solaris-coast.slot';
const memory = {};

function read(i) {
  try {
    const raw = window.localStorage.getItem(`${KEY}${i}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // storage blocked or corrupt: use the in-memory copy
  }
  return memory[i] || null;
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
    activities: G.activities.state(),
    ammo: G.player.weapons.map((w) => [w.mag, w.reserve]),
  });
  S.autosave = () => write(S.slot, S.snapshot());
  S.load = (i) => {
    const d = read(i);
    if (!d) return false;
    S.slot = i;
    G.player.cash = d.cash;
    G.missions.reset(d.missions);
    G.activities.load(d.activities);
    (d.ammo || []).forEach((a, k) => {
      if (G.player.weapons[k]) [G.player.weapons[k].mag, G.player.weapons[k].reserve] = a;
    });
    return true;
  };
  S.fresh = (i) => {
    S.slot = i;
    write(i, null);
    memory[i] = null;
    try {
      window.localStorage.removeItem(`${KEY}${i}`);
    } catch {
      // nothing stored
    }
  };
  return S;
}
