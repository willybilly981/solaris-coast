// World atlas: the shared city map bitmap, road-grid GPS routing, and the full-screen career hub (key M).
import { DISTRICTS, LANDMARKS, MISSIONS, RADIO, ROADS, VEHICLE_SPAWNS, WORLD, districtAt } from './config.js';
import { CREW, SPEAKERS, getSpeakerPortrait } from './crew.js';
import { GARAGE_IDS, RANKS, RELIC_SPOTS, WEIGHTS, summarizeSlot } from './progression.js';

export const MAP_S = 1.2;
export const MAP_PX = Math.round(500 * MAP_S);
const STREET_END = 137;
const TINT = { mirador: '#ff9a6a', crown: '#4fb8e0', harbor: '#e8b73c', palma: '#b98cf2' };
const AVENUES = ['AVE 1', 'AVE 2', 'AVE 3', 'AVE 4', 'OCEAN DRIVE'];
const STREETS = ['NORTH ST', 'CROWN HWY', 'MAIN ST', 'CALDERA RD', 'QUAY RD'];
const GRADE_COLOR = { G: '#ffd24a', S: '#d5dde8', B: '#e08a4a' };

export const toMap = (x, z) => [(x + 280) * MAP_S, (z + 280) * MAP_S];

/** Garage, hospital, safehouse, time-trial start and showroom cars: one list for the atlas and the minimap. */
export const SERVICE_MARKERS = [
  [LANDMARKS.garage, 'G', '#27e3ff'], [LANDMARKS.hospital, 'H', '#ff6a7a'], [LANDMARKS.safehouse, 'S', '#9dff5a'], [LANDMARKS.raceStart, 'T', '#ff7ad0'],
  ...VEHICLE_SPAWNS.map((v) => [v, 'V', '#ffa84a']),
];

let mapBitmap = null;

/** Painted once; the HUD minimap and the atlas read the same bitmap. */
export function buildStaticMap() {
  if (mapBitmap) return mapBitmap;
  const c = document.createElement('canvas');
  c.width = MAP_PX;
  c.height = MAP_PX;
  const g = c.getContext('2d');
  g.fillStyle = '#0b6f93';
  g.fillRect(0, 0, MAP_PX, MAP_PX);
  const [lx, lz] = toMap(WORLD.minX, WORLD.minZ);
  g.fillStyle = '#232b3a';
  g.fillRect(lx, lz, (WORLD.maxX - WORLD.minX) * MAP_S, (WORLD.maxZ - WORLD.minZ) * MAP_S);
  const xs = [WORLD.minX, ...ROADS.x, WORLD.maxX];
  const zs = [WORLD.minZ, ...ROADS.z, WORLD.maxZ];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < zs.length - 1; j += 1) {
      const east = i === xs.length - 2;
      const x0 = i === 0 ? xs[0] : xs[i] + ROADS.half;
      const x1 = east ? xs[xs.length - 1] : xs[i + 1] - ROADS.half;
      const z0 = j === 0 ? zs[0] : zs[j] + ROADS.half;
      const z1 = j === zs.length - 2 ? zs[zs.length - 1] : zs[j + 1] - ROADS.half;
      const [px, pz] = toMap(x0, z0);
      g.fillStyle = east ? '#e9d29b' : TINT[districtAt((x0 + x1) / 2, (z0 + z1) / 2)];
      g.globalAlpha = east ? 0.95 : 0.62;
      g.fillRect(px, pz, (x1 - x0) * MAP_S, (z1 - z0) * MAP_S);
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = '#c9d1df';
  for (const a of ROADS.x) {
    const [px, pz] = toMap(a - ROADS.half, WORLD.minZ);
    g.fillRect(px, pz, ROADS.half * 2 * MAP_S, (WORLD.maxZ - WORLD.minZ) * MAP_S);
  }
  for (const r of ROADS.z) {
    const [px, pz] = toMap(WORLD.minX, r - ROADS.half);
    g.fillRect(px, pz, (STREET_END - WORLD.minX) * MAP_S, ROADS.half * 2 * MAP_S);
  }
  g.strokeStyle = '#f2c230';
  g.lineWidth = 1.5;
  g.setLineDash([7, 6]);
  for (const a of ROADS.x) {
    const [px, pz] = toMap(a, WORLD.minZ);
    g.beginPath();
    g.moveTo(px, pz);
    g.lineTo(px, pz + (WORLD.maxZ - WORLD.minZ) * MAP_S);
    g.stroke();
  }
  for (const r of ROADS.z) {
    const [px, pz] = toMap(WORLD.minX, r);
    g.beginPath();
    g.moveTo(px, pz);
    g.lineTo(px + (STREET_END - WORLD.minX) * MAP_S, pz);
    g.stroke();
  }
  g.setLineDash([]);
  mapBitmap = c;
  return c;
}

const num = (a, b) => a - b;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Nearest point on the avenue/street grid, tagged with the road line it sits on. */
function snapToRoad(p) {
  let best = null;
  const offer = (x, z, axis) => {
    const d = Math.hypot(p.x - x, p.z - z);
    if (!best || d < best.d) best = { x, z, axis, d };
  };
  for (const c of ROADS.x) offer(c, clamp(p.z, WORLD.minZ, WORLD.maxZ), 'x');
  for (const r of ROADS.z) offer(clamp(p.x, WORLD.minX, STREET_END), r, 'z');
  return best;
}

/** A* over the avenue/street lattice with the two snapped ends spliced in. Returns the polyline and its length. */
export function planRoute(from, to) {
  const s = snapToRoad(from);
  const t = snapToRoad(to);
  const extraX = new Set();
  const extraZ = new Set();
  for (const q of [s, t]) (q.axis === 'x' ? extraZ : extraX).add(q.axis === 'x' ? q.z : q.x);
  const xs = [...new Set([...ROADS.x, ...extraX])].sort(num);
  const key = (x, z) => `${x},${z}`;
  const nodes = new Map();
  const link = (ax, az, bx, bz) => {
    for (const [x, z] of [[ax, az], [bx, bz]]) if (!nodes.has(key(x, z))) nodes.set(key(x, z), { x, z, adj: [] });
    const w = Math.hypot(bx - ax, bz - az);
    nodes.get(key(ax, az)).adj.push([key(bx, bz), w]);
    nodes.get(key(bx, bz)).adj.push([key(ax, az), w]);
  };
  const aveZs = [...new Set([...ROADS.z, ...extraZ])].sort(num);
  for (const c of ROADS.x) for (let i = 0; i < aveZs.length - 1; i += 1) link(c, aveZs[i], c, aveZs[i + 1]);
  for (const r of ROADS.z) for (let i = 0; i < xs.length - 1; i += 1) link(xs[i], r, xs[i + 1], r);
  const goal = key(t.x, t.z);
  const open = new Map([[key(s.x, s.z), 0]]);
  const cost = new Map(open);
  const prev = new Map();
  const h = (n) => Math.abs(n.x - t.x) + Math.abs(n.z - t.z);
  const done = new Set();
  while (open.size) {
    let cur = null;
    for (const [k, f] of open) if (cur === null || f + h(nodes.get(k)) < open.get(cur) + h(nodes.get(cur))) cur = k;
    if (cur === goal) break;
    open.delete(cur);
    done.add(cur);
    for (const [nk, w] of nodes.get(cur).adj) {
      if (done.has(nk)) continue;
      const c = cost.get(cur) + w;
      if (!cost.has(nk) || c < cost.get(nk)) {
        cost.set(nk, c);
        prev.set(nk, cur);
        open.set(nk, c);
      }
    }
  }
  const road = [];
  for (let k = goal; k !== undefined; k = prev.get(k)) road.push({ x: nodes.get(k).x, z: nodes.get(k).z });
  road.reverse();
  const points = [{ x: from.x, z: from.z }, ...road, { x: to.x, z: to.z }];
  let length = 0;
  for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return { points, length };
}

/** The waypoint if one is set, else the active objective; null when neither exists. */
export function routeTarget(G) {
  if (G.waypoint) return { x: G.waypoint.x, z: G.waypoint.z, kind: 'WAYPOINT' };
  const info = G.missions.info();
  return info.x === null || info.x === undefined ? null : { x: info.x, z: info.z, kind: 'OBJECTIVE' };
}

/** Cached per player move, so the minimap can ask every frame. */
export function currentRoute(G) {
  const tg = routeTarget(G);
  if (!tg) return null;
  const c = G.routeCache;
  const moved = c ? Math.hypot(G.player.x - c.px, G.player.z - c.pz) : 1e9;
  if (!c || moved > 4 || Math.hypot(c.tx - tg.x, c.tz - tg.z) > 4) {
    G.routeCache = { px: G.player.x, pz: G.player.z, tx: tg.x, tz: tg.z, route: planRoute(G.player, tg) };
  }
  return G.routeCache.route;
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pctText = (v) => `${Math.round(v * 100)}%`;

/** Everything the hub shows, read from live game and save state. */
export function getAtlasState(G) {
  const prog = G.progress;
  const done = G.missions.done;
  const comp = prog.completion();
  const p = comp.parts;
  const st = prog.stats;
  const rank = prog.rank();
  const bars = [
    ['CONTRACTS', p.contracts, `${done}/${MISSIONS.length}`],
    ['RELICS', p.relics, `${prog.relics.length}/${RELIC_SPOTS.length}`],
    ['DISTRICTS', p.districts, `${prog.explored.length}/${DISTRICTS.length}`],
    ['GARAGE', p.garage, `${GARAGE_IDS.filter((id) => prog.garage[id]).length}/${GARAGE_IDS.length}`],
    ['SIDE OPS', p.sideOps, pctText(p.sideOps)],
    ['HEAT EVADES', p.evades, `${prog.evades}/10`],
    ['RANK RP', p.rank, `${fmt(prog.rp)}`],
  ].map(([label, value, text]) => ({ label, value, text }));
  const contracts = MISSIONS.map((m, i) => ({
    n: i + 1, title: m.title, cash: m.cash, grade: prog.grades[m.id] || '',
    status: i < done ? 'DONE' : i === done ? (G.missions.active ? 'ACTIVE' : 'OPEN') : 'LOCKED',
  }));
  const stats = [
    ['CASH EARNED', `$${fmt(st.earned)}`], ['CONTRACTS CLEARED', `${done}`], ['RELICS FOUND', `${prog.relics.length}/${RELIC_SPOTS.length}`],
    ['TOP SPEED', `${Math.round(st.topSpeed)} KM/H`], ['DISTANCE DRIVEN', `${(st.distance / 1000).toFixed(1)} KM`], ['HEAT SURVIVED', `${st.maxHeat} STARS`],
  ].map(([label, value]) => ({ label, value }));
  const slots = G.save.slots().map((d, i) => ({ slot: i + 1, summary: summarizeSlot(d), current: G.save.slot === i }));
  return { completion: comp.pct, bars, contracts, rank, stats, slots, parts: comp.parts, target: routeTarget(G), route: currentRoute(G) };
}

const KEYS = [
  ['WASD', 'MOVE / DRIVE'], ['SHIFT', 'SPRINT / NITRO'], ['SPACE', 'HANDBRAKE / FIRE'], ['MOUSE', 'AIM AND FIRE'],
  ['F', 'ENTER / EXIT'], ['E', 'GARAGE / SAFEHOUSE'], ['1-5, Q', 'WEAPONS'], ['Z X C', 'CREW ABILITIES'],
  ['R', 'RADIO'], ['M', 'WORLD ATLAS'], ['ARROWS', 'CAMERA'], ['ESC', 'PAUSE'],
];
const CREW_BLURB = { Z: 'CLEARS 1-2 STARS, MASKS PLATES', X: 'REPAIRS CAR 45% OR HEALS', C: 'JAMS SCMPD AND CONDOR' };
const TABS = ['MAP', 'STATS', 'CREW', 'CONTROLS', 'SAVE'];

export function drawBadge(g, x, y, letter, fill, r = 9) {
  g.fillStyle = fill;
  g.strokeStyle = '#0a1220';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(x, y, r, 0, 6.283);
  g.fill();
  g.stroke();
  g.fillStyle = '#0a1220';
  g.font = `bold ${Math.round(r * 1.2)}px "Segoe UI", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, x, y + 0.5);
}

export function drawRelicDiamond(g, x, y, got, s = 8) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.lineTo(x + s * 0.85, y);
  g.lineTo(x, y + s);
  g.lineTo(x - s * 0.85, y);
  g.closePath();
  g.fillStyle = got ? '#3a4558' : '#ffd24a';
  g.strokeStyle = got ? '#8d99ad' : '#5a3a00';
  g.lineWidth = 2;
  g.fill();
  g.stroke();
}

export function drawRoute(g, points, mapPoint, width = 5) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const [w, color] of [[width + 4, '#2a0f4a'], [width, '#b46bff']]) {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    points.forEach((q, i) => {
      const [x, y] = mapPoint(q.x, q.z);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
  }
}

export function drawSearchZone(g, zone, mapPoint, scale, t) {
  const [x, y] = mapPoint(zone.x, zone.z);
  const r = zone.r * scale * (1 + Math.sin(t * 3.2) * 0.03);
  g.fillStyle = 'rgba(255,60,90,.14)';
  g.strokeStyle = 'rgba(255,90,110,.9)';
  g.lineWidth = 3;
  g.setLineDash([10, 7]);
  g.beginPath();
  g.arc(x, y, r, 0, 6.283);
  g.fill();
  g.stroke();
  g.setLineDash([]);
}

export function createAtlas(G) {
  const root = document.createElement('div');
  root.id = 'atlas';
  root.className = 'hidden';
  document.getElementById('hud').appendChild(root);
  const A = { open: false, tab: 'MAP', onLoad: () => {}, canSave: () => false };
  const staticMap = buildStaticMap();
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = MAP_PX;
  mapCanvas.height = MAP_PX;
  mapCanvas.className = 'atlasMap';
  mapCanvas.addEventListener('click', (e) => {
    const r = mapCanvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * MAP_PX / MAP_S - 280;
    const z = ((e.clientY - r.top) / r.height) * MAP_PX / MAP_S - 280;
    G.waypoint = Math.hypot(x - (G.waypoint ? G.waypoint.x : 1e9), z - (G.waypoint ? G.waypoint.z : 1e9)) < 12 ? null : { x, z };
    G.hud.toast(G.waypoint ? 'WAYPOINT SET' : 'WAYPOINT CLEARED');
    A.render();
  });

  const donut = (pct) => {
    const C = 2 * Math.PI * 44;
    return `<svg class="donut" viewBox="0 0 110 110" role="img" aria-label="${pct}% complete"><circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="11"/>`
      + `<circle cx="55" cy="55" r="44" fill="none" stroke="url(#dg)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * pct) / 100} ${C}" transform="rotate(-90 55 55)"/>`
      + '<defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd24a"/><stop offset="1" stop-color="#ff5fb0"/></linearGradient></defs>'
      + `<text x="55" y="55" text-anchor="middle" class="dnum">${pct.toFixed(1)}%</text><text x="55" y="72" text-anchor="middle" class="dlab">COMPLETE</text></svg>`;
  };
  const bar = (b) => `<div class="abar"><span>${b.label}</span><i><b style="width:${Math.round(b.value * 100)}%"></b></i><em>${b.text}</em></div>`;
  const contract = (c) => `<div class="crow ${c.status.toLowerCase()}"><span class="cn">${String(c.n).padStart(2, '0')}</span><span class="ct">${c.title.toUpperCase()}</span><span class="cs">${c.status}</span>`
    + `<span class="cc">$${fmt(c.cash)}</span><span class="cg" style="${c.grade ? `background:${GRADE_COLOR[c.grade]}` : ''}">${c.grade || '-'}</span></div>`;
  const slotRow = (s) => `<div class="srow${s.current ? ' cur' : ''}"><div><b>SLOT ${s.slot}</b>${s.summary ? `<span>${s.summary.district}</span>` : '<span>EMPTY SLOT</span>'}`
    + `<small>${s.summary ? `${s.summary.rank}  $${fmt(s.summary.cash)}  ${s.summary.pct.toFixed(1)}%` : 'NO CAREER'}</small></div>`
    + `<button data-act="load" data-slot="${s.slot - 1}"${s.summary ? '' : ' disabled'}>LOAD</button><button data-act="save" data-slot="${s.slot - 1}"${A.canSave() ? '' : ' disabled'}>SAVE</button></div>`;

  function mapTab(S) {
    const rk = S.rank;
    const legend = '<div class="alegend"><i class="lg">G</i>GARAGE<i class="lh">H</i>HOSPITAL<i class="ls">S</i>SAFEHOUSE<i class="lv">V</i>CAR<i class="lt">T</i>TRIAL<i class="lr">&#9670;</i>RELIC<button data-act="clearwp">CLEAR WP</button></div>';
    return `<div class="agrid"><div class="acol"><section class="ap"><h3>COMPLETION</h3><div class="dwrap">${donut(S.completion)}</div>${S.bars.map(bar).join('')}</section>`
      + `<section class="ap"><h3>STORY CONTRACTS</h3>${S.contracts.map(contract).join('')}</section></div>`
      + `<section class="ap mapPanel"><h3>BAHIA SOLARIS${S.target ? `<small>${S.target.kind} ${fmt(S.route ? S.route.length : 0)} M</small>` : ''}</h3><div class="mapHolder"></div>${legend}</section>`
      + `<div class="acol"><section class="ap"><h3>CAREER</h3><div class="rank">${rk.label}</div><div class="rpbar"><b style="width:${Math.round(rk.pct * 100)}%"></b></div><div class="rptxt">${fmt(rk.rp)} RP${rk.next === null ? '' : ` / ${fmt(rk.next)}`}</div>`
      + `<div class="stats">${S.stats.map((s) => `<div><small>${s.label}</small><b>${s.value}</b></div>`).join('')}</div></section>`
      + `<section class="ap"><h3>SAVE SLOTS</h3>${S.slots.map(slotRow).join('')}</section></div></div>`;
  }

  function statsTab(S) {
    const more = [['TAKEDOWNS', G.progress.stats.takedowns], ['WANTED EVADES', G.progress.evades], ['RACES WON', G.progress.races], ['STUNT JUMPS', G.progress.stunts]];
    return `<div class="agrid two"><section class="ap"><h3>CAREER STATS</h3><div class="stats big">${[...S.stats.map((s) => [s.label, s.value]), ...more].map(([l, v]) => `<div><small>${l}</small><b>${v}</b></div>`).join('')}</div></section>`
      + `<section class="ap"><h3>COMPLETION ${S.completion.toFixed(1)}%</h3>${S.bars.map((b, i) => `<div class="abar wide">${bar(b)}<small>${Object.values(WEIGHTS)[i]} PTS</small></div>`).join('')}<div class="rptxt">RANKS: ${RANKS.map((r) => `${r.name} ${fmt(r.rp)}`).join('  /  ')}</div></section></div>`;
  }

  function crewTab() {
    const cards = CREW.map((c) => `<div class="ccard"><div class="cport">${getSpeakerPortrait(c.id, 'atlas-')}</div><div><b>${SPEAKERS[c.id].name}</b><small>${SPEAKERS[c.id].role}</small><span><kbd>${c.slot}</kbd>${c.skill}</span><em>${CREW_BLURB[c.slot]}</em><em>COOLDOWN ${c.cd}S</em></div></div>`);
    const others = ['kai', 'harper'].map((id) => `<div class="ccard"><div class="cport">${getSpeakerPortrait(id, 'atlas-')}</div><div><b>${SPEAKERS[id].name}</b><small>${SPEAKERS[id].role}</small></div></div>`);
    return `<div class="agrid one"><section class="ap"><h3>CREW AND CONTACTS</h3><div class="ccards">${[...cards, ...others].join('')}</div></section></div>`;
  }

  const controlsTab = () => `<div class="agrid one"><section class="ap"><h3>CONTROLS</h3><div class="keys">${KEYS.map(([k, v]) => `<div><kbd>${k}</kbd>${v}</div>`).join('')}</div>`
    + `<h3>RADIO</h3><div class="keys">${RADIO.map((r) => `<div><kbd>R</kbd>${r.name}</div>`).join('')}</div></section></div>`;

  const saveTab = (S) => `<div class="agrid one"><section class="ap"><h3>SAVE SLOTS</h3>${S.slots.map(slotRow).join('')}</section></div>`;

  A.render = () => {
    const S = getAtlasState(G);
    const body = { MAP: mapTab, STATS: statsTab, CREW: crewTab, CONTROLS: controlsTab, SAVE: saveTab }[A.tab](S);
    root.innerHTML = `<div class="atop"><div class="atitle">WORLD ATLAS</div><div class="tabs">${TABS.map((t, i) => `<button data-tab="${t}" class="${t === A.tab ? 'on' : ''}">${i + 1} ${t}</button>`).join('')}</div><button data-act="close">M CLOSE</button></div>${body}`;
    const holder = root.querySelector('.mapHolder');
    if (holder) holder.appendChild(mapCanvas);
    A.state = S;
  };

  A.draw = (t) => {
    if (!A.open || A.tab !== 'MAP') return;
    const S = A.state;
    const g = mapCanvas.getContext('2d');
    g.drawImage(staticMap, 0, 0);
    g.font = 'bold 17px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(8,14,28,.85)';
    for (const d of DISTRICTS) {
      const [x, y] = toMap(d.cx, d.cz);
      g.strokeText(d.name.toUpperCase(), x, y);
      g.fillStyle = '#ffffff';
      g.fillText(d.name.toUpperCase(), x, y);
    }
    g.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    g.lineWidth = 3;
    ROADS.x.forEach((a, i) => {
      const [x, y] = toMap(a, WORLD.minZ + 9);
      g.strokeText(AVENUES[i], x, y);
      g.fillStyle = '#ffe9b0';
      g.fillText(AVENUES[i], x, y);
    });
    g.textAlign = 'left';
    ROADS.z.forEach((r, i) => {
      const [x, y] = toMap(WORLD.minX + 3, r - 10);
      g.strokeText(STREETS[i], x, y);
      g.fillStyle = '#ffe9b0';
      g.fillText(STREETS[i], x, y);
    });
    const zone = G.police.searchZone();
    if (zone) drawSearchZone(g, zone, toMap, MAP_S, t);
    if (S.route) drawRoute(g, S.route.points, toMap, 5);
    const prog = G.progress;
    for (const r of RELIC_SPOTS) {
      const [x, y] = toMap(r.x, r.z);
      drawRelicDiamond(g, x, y, prog.relics.includes(r.id));
    }
    for (const [pos, letter, color] of SERVICE_MARKERS) {
      const [x, y] = toMap(pos.x, pos.z);
      drawBadge(g, x, y, letter, color, 10);
    }
    const info = G.missions.info();
    if (info.x !== null && info.x !== undefined) {
      const [x, y] = toMap(info.x, info.z);
      drawBadge(g, x, y, '!', '#ffd23a', 11);
    }
    if (G.waypoint) {
      const [x, y] = toMap(G.waypoint.x, G.waypoint.z);
      drawBadge(g, x, y, 'W', '#b46bff', 11);
    }
    const pl = G.player;
    const [px, py] = toMap(pl.x, pl.z);
    g.save();
    g.translate(px, py);
    g.rotate(-pl.heading + Math.PI);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#0a1220';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -13);
    g.lineTo(10, 11);
    g.lineTo(0, 5);
    g.lineTo(-10, 11);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  };

  A.show = (tab = 'MAP') => {
    A.open = true;
    A.tab = tab;
    root.classList.remove('hidden');
    A.render();
  };
  A.hide = () => {
    A.open = false;
    root.classList.add('hidden');
  };
  A.toggle = (tab) => (A.open ? A.hide() : A.show(tab));

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) A.show(b.dataset.tab);
    else if (b.dataset.act === 'close') A.hide();
    else if (b.dataset.act === 'clearwp') {
      G.waypoint = null;
      A.render();
    } else if (b.dataset.act === 'load') A.onLoad(Number(b.dataset.slot));
    else if (b.dataset.act === 'save') {
      G.save.saveTo(Number(b.dataset.slot));
      G.hud.toast('GAME SAVED');
      A.render();
    }
  });

  A.key = (code) => {
    const n = Number(code.replace('Digit', ''));
    if (n >= 1 && n <= TABS.length) A.show(TABS[n - 1]);
  };

  return A;
}
