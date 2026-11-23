// Crew tactical abilities on Z, X and C, plus the procedural SVG portraits used by crew cards and the radio box.

export const PLATE_MASK = 12;
export const JAM_TIME = 10;

export const SPEAKERS = {
  kai: { name: 'KAI VALE', role: 'DRIVER', color: '#ff9a5a' },
  sofia: { name: 'SOFIA CRUZ', role: 'FORGER', color: '#ff6fb4' },
  marco: { name: 'MARCO REYES', role: 'MECHANIC', color: '#5fe0d0' },
  elena: { name: 'ELENA VANCE', role: 'HACKER', color: '#6fe8ff' },
  harper: { name: 'CHIEF HARPER', role: 'SCMPD CHIEF', color: '#ffd24a' },
};

export const CREW = [
  { slot: 'Z', code: 'KeyZ', id: 'sofia', skill: 'SWAP PLATES', cd: 45 },
  { slot: 'X', code: 'KeyX', id: 'marco', skill: 'QUICK FIX', cd: 35 },
  { slot: 'C', code: 'KeyC', id: 'elena', skill: 'SIGNAL JAM', cd: 50 },
];

const el = (tag, attrs) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
const path = (d, fill, extra = {}) => el('path', { d, fill, ...extra });
const eyes = (color, y = 29) => el('ellipse', { cx: 28, cy: y, rx: 1.7, ry: 1.3, fill: color }) + el('ellipse', { cx: 36, cy: y, rx: 1.7, ry: 1.3, fill: color });
const head = (skin) => path('M28 36h8v9h-8z', skin) + path('M28 36h8v9h-8z', '#000', { opacity: 0.15 }) + el('ellipse', { cx: 32, cy: 28, rx: 11, ry: 13, fill: skin });
const shoulders = (fill) => path('M4 64C6 49 19 44 32 44s26 5 28 20z', fill);

const PORTRAITS = {
  kai: () => [
    '#ffb36b', '#e8603a',
    shoulders('#ff7a3a') + path('M24 44l8 10 8-10 3 2-11 14-11-14z', '#f4f6fa') + head('#d9a77b')
    + path('M20 27C19 12 28 10 33 10s13 3 12 17c-2-6-5-9-13-9s-11 3-12 9z', '#1b1410')
    + path('M25 36c2 6 12 6 14 0-2 3-12 3-14 0z', '#1b1410', { opacity: .45 })
    + el('rect', { x: 22.5, y: 26.5, width: 19, height: 6, rx: 2.5, fill: '#0a0c10' })
    + path('M25 28h6l-1 2h-5z', '#7fe3ff', { opacity: .6 }) + el('rect', { x: 29, y: 38.5, width: 6, height: 1.2, rx: .6, fill: '#8a4a3a' }),
  ],
  sofia: () => [
    '#ff9ad0', '#8a2a78',
    path('M18 30C16 8 48 8 46 30l2 22H16z', '#150d12') + shoulders('#d6347f') + head('#c98d62')
    + path('M21 26C21 13 43 13 43 26c-4-3-8-8-11-8s-8 4-11 8z', '#150d12')
    + eyes('#1a1010', 30) + el('circle', { cx: 21, cy: 35, r: 3, fill: 'none', stroke: '#ffd24a', 'stroke-width': 1.2 })
    + el('circle', { cx: 43, cy: 35, r: 3, fill: 'none', stroke: '#ffd24a', 'stroke-width': 1.2 })
    + path('M29 38c2 2 4 2 6 0-2 3-4 3-6 0z', '#c4203c') + path('M26 27.5q2-1.6 4 0M34 27.5q2-1.6 4 0', 'none', { stroke: '#150d12', 'stroke-width': 1 }),
  ],
  marco: () => [
    '#6fe8d8', '#1f6a7a',
    shoulders('#2a7f8f') + path('M22 46l10 4 10-4v5l-10 5-10-5z', '#ff9a3a') + head('#8a5a3a')
    + path('M22 34c1 9 19 9 20 0-3 5-17 5-20 0z', '#17100c') + path('M20 25C20 11 44 11 44 25z', '#1f9aa6')
    + path('M19 24h26c2 0 3 1 3 2H17c0-1 1-2 2-2z', '#157680')
    + el('circle', { cx: 27, cy: 18, r: 3.4, fill: '#12303a', stroke: '#ffd24a', 'stroke-width': 1.2 })
    + el('circle', { cx: 37, cy: 18, r: 3.4, fill: '#12303a', stroke: '#ffd24a', 'stroke-width': 1.2 })
    + eyes('#140c08', 30) + el('rect', { x: 29, y: 37, width: 6, height: 1.2, rx: .6, fill: '#f2d6c0' }),
  ],
  elena: () => [
    '#8ff0ff', '#2a3f7a',
    shoulders('#232a3b') + path('M27 46v8M37 46v8', 'none', { stroke: '#27e3ff', 'stroke-width': 1.4 })
    + path('M19 30C16 12 48 12 45 30l1 9c-5 1-6-6-6-10H24c0 4-1 11-6 10z', '#b03a2e') + head('#f1cdb0')
    + path('M21 27C22 14 42 14 43 27c-5-2-8-6-11-6s-6 4-11 6z', '#b03a2e')
    + eyes('#2a9a6a', 30) + el('path', { d: 'M19 29a13 13 0 0 1 26 0', fill: 'none', stroke: '#27e3ff', 'stroke-width': 2 })
    + el('rect', { x: 17, y: 27, width: 4, height: 8, rx: 2, fill: '#27e3ff' }) + path('M19 35q2 6 9 6', 'none', { stroke: '#27e3ff', 'stroke-width': 1 })
    + el('rect', { x: 29, y: 37.5, width: 6, height: 1.2, rx: .6, fill: '#c0605a' }),
  ],
  harper: () => [
    '#ffe18a', '#3a4f8a',
    shoulders('#14284f') + path('M8 56l6-8 4 3-6 9zM56 56l-6-8-4 3 6 9z', '#e8c24a') + head('#e3b99a')
    + path('M20 26h-2v6c1 2 3 2 3 0zM44 26h2v6c-1 2-3 2-3 0z', '#9aa3ad')
    + path('M20 24C20 10 44 10 44 24z', '#14284f') + el('rect', { x: 18, y: 22, width: 28, height: 4, rx: 1.5, fill: '#0c1830' })
    + path('M29 14l3-3 3 3-3 4z', '#e8c24a') + path('M24 27.5l6 1.4M40 27.5l-6 1.4', 'none', { stroke: '#4a4a52', 'stroke-width': 1.6 })
    + eyes('#1a1a20', 31) + el('rect', { x: 28, y: 38.5, width: 8, height: 1.3, rx: .6, fill: '#a86a5a' }),
  ],
};

/** Inline SVG markup, 64x64, for a speaker id (kai, sofia, marco, elena, harper). */
export function getSpeakerPortrait(id) {
  const [top, bottom, body] = PORTRAITS[id]();
  const g = `pg-${id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${SPEAKERS[id].name}">`
    + `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>`
    + `<rect width="64" height="64" rx="8" fill="url(#${g})"/>${body}</svg>`;
}

export function createCrewState() {
  return { cd: { Z: 0, X: 0, C: 0 } };
}

const ABILITIES = {
  Z(G) {
    const P = G.police;
    const before = P.stars;
    P.dropStars(2);
    P.maskT = PLATE_MASK;
    return before > P.stars ? `Plates swapped. Heat down ${before - P.stars}.` : `Plates masked for ${PLATE_MASK} seconds.`;
  },
  X(G) {
    const v = G.player.vehicle;
    if (v) {
      v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.45);
      if (!v.dead) v.burning = 0;
      return `Hull patched to ${Math.round((v.hp / v.maxHp) * 100)} percent.`;
    }
    G.player.armor = Math.min(100, G.player.armor + 35);
    G.player.hp = Math.min(100, G.player.hp + 25);
    return 'Patched you up. Armor and health restored.';
  },
  C(G) {
    G.police.jam(JAM_TIME);
    return `Dispatch scrambled for ${JAM_TIME} seconds.`;
  },
};

/** Fires one ability if its cooldown is done; returns whether it ran. */
export function triggerCrewAbility(G, slot) {
  const c = CREW.find((x) => x.slot === slot);
  if (!c || G.crew.cd[slot] > 0 || G.player.wasted) return false;
  const line = ABILITIES[slot](G);
  G.crew.cd[slot] = c.cd;
  G.audio.click();
  G.missions.say([[c.id, line]], true);
  return true;
}

export function tickCrew(G, dt) {
  for (const slot of Object.keys(G.crew.cd)) G.crew.cd[slot] = Math.max(0, G.crew.cd[slot] - dt);
}

export function crewKeys(G, input) {
  for (const c of CREW) if (input.take(c.code)) triggerCrewAbility(G, c.slot);
}

export function getCrewCards(G) {
  return CREW.map((c) => {
    const left = G.crew.cd[c.slot];
    const active = (c.slot === 'Z' && G.police.maskT > 0) || (c.slot === 'C' && G.police.jamT > 0);
    return {
      slot: c.slot, id: c.id, name: SPEAKERS[c.id].name, skill: c.skill, active,
      ready: left <= 0, secs: Math.ceil(left), pct: left / c.cd, label: left <= 0 ? 'READY' : `${Math.ceil(left)}s`,
      portrait: getSpeakerPortrait(c.id),
    };
  });
}
