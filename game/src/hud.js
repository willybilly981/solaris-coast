// HUD: minimap and full map, wanted stars, speedometer, weapon wheel, mission tracker, dispatch feed, menus.
import { DISTRICTS, LANDMARKS, RESPECT_LEVELS, ROADS, WEAPONS, WORLD, districtAt } from './config.js';

const MAP_S = 1.2;
const MAP_SIZE = 560 * MAP_S;
const TINT = { mirador: '#e8a074', crown: '#4fa6c8', harbor: '#d4a43c', palma: '#9a74c8' };

function el(tag, id, parent, cls) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
}

function buildStaticMap() {
  const c = document.createElement('canvas');
  c.width = MAP_SIZE;
  c.height = MAP_SIZE;
  const g = c.getContext('2d');
  const p = (x, z) => [(x + 280) * MAP_S, (z + 280) * MAP_S];
  g.fillStyle = '#0a5a74';
  g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  const [lx, lz] = p(WORLD.minX, WORLD.minZ);
  g.fillStyle = '#1d2531';
  g.fillRect(lx, lz, (WORLD.maxX - WORLD.minX) * MAP_S, (WORLD.maxZ - WORLD.minZ) * MAP_S);
  const xs = [WORLD.minX, ...ROADS.x.map((a) => a), WORLD.maxX];
  const zs = [WORLD.minZ, ...ROADS.z.map((a) => a), WORLD.maxZ];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < zs.length - 1; j += 1) {
      const x0 = i === 0 ? xs[0] : xs[i] + ROADS.half;
      const x1 = i === xs.length - 2 ? xs[xs.length - 1] : xs[i + 1] - ROADS.half;
      const z0 = j === 0 ? zs[0] : zs[j] + ROADS.half;
      const z1 = j === zs.length - 2 ? zs[zs.length - 1] : zs[j + 1] - ROADS.half;
      const d = districtAt((x0 + x1) / 2, (z0 + z1) / 2);
      const [px, pz] = p(x0, z0);
      g.fillStyle = i === xs.length - 2 ? '#c9ad74' : TINT[d];
      g.globalAlpha = i === xs.length - 2 ? 0.8 : 0.4;
      g.fillRect(px, pz, (x1 - x0) * MAP_S, (z1 - z0) * MAP_S);
      g.globalAlpha = 1;
    }
  }
  g.fillStyle = '#8a93a4';
  for (const a of ROADS.x) {
    const [px, pz] = p(a - ROADS.half, WORLD.minZ);
    g.fillRect(px, pz, ROADS.half * 2 * MAP_S, (WORLD.maxZ - WORLD.minZ) * MAP_S);
  }
  for (const r of ROADS.z) {
    const [px, pz] = p(WORLD.minX, r - ROADS.half);
    g.fillRect(px, pz, (137 - WORLD.minX) * MAP_S, ROADS.half * 2 * MAP_S);
  }
  g.fillStyle = 'rgba(0,0,0,.35)';
  const [hx, hz] = p(WORLD.minX, -110 - 1);
  g.fillRect(hx, hz, (137 - WORLD.minX) * MAP_S, 2 * MAP_S);
  return c;
}

export function createHud(G) {
  const root = document.getElementById('hud');
  const H = {};
  const staticMap = buildStaticMap();

  const topRight = el('div', 'topRight', root, 'glass');
  const cash = el('div', 'cash', topRight);
  const stars = el('div', 'stars', topRight);
  const starEls = Array.from({ length: 5 }, () => el('div', null, stars, 'star'));
  const wantedLabel = el('div', 'wantedLabel', topRight);
  const district = el('div', 'district', topRight);
  const respect = el('div', 'respect', topRight);
  const respectBar = el('div', 'respectBar', respect);
  const respectText = el('div', 'respectText', topRight);
  const weapon = el('div', 'weapon', topRight);

  const topLeft = el('div', 'topLeft', root);
  const mission = el('div', 'mission', topLeft, 'panel');
  const missionTitle = el('div', 'missionTitle', mission);
  const missionText = el('div', 'missionText', mission);
  const missionDist = el('div', 'missionDist', mission);
  const dispatch = el('div', 'dispatch', topLeft, 'panel');
  el('div', 'dispatchHead', dispatch).textContent = 'SCMPD DISPATCH';
  const dlines = Array.from({ length: 4 }, () => el('div', null, dispatch, 'dline'));

  const bottomLeft = el('div', 'bottomLeft', root);
  const mapWrap = el('div', 'mapWrap', bottomLeft);
  const mini = el('canvas', 'minimap', mapWrap);
  mini.width = 210;
  mini.height = 210;
  const bars = el('div', 'bars', bottomLeft, 'glass');
  const barRow = (label, barId) => {
    const row = el('div', null, bars, 'barRow');
    el('span', null, row, 'barLabel').textContent = label;
    const track = el('div', null, row, 'bar');
    return [el('i', barId, track), el('span', null, row, 'barVal')];
  };
  const [hpBar, hpVal] = barRow('HP', 'hpBar');
  const [armBar, armVal] = barRow('ARMOR', 'armBar');

  const bottomRight = el('div', 'bottomRight', root);
  const vehName = el('div', 'vehName', bottomRight);
  const speed = el('div', 'speed', bottomRight);
  const nitroWrap = el('div', 'nitroWrap', bottomRight);
  const nitroBar = el('div', 'nitroBar', nitroWrap);
  const nitroLabel = el('div', 'nitroLabel', bottomRight);
  nitroLabel.textContent = 'NITRO [SHIFT]';
  const radioName = el('div', 'radioName', bottomRight);

  const center = el('div', 'center', root);
  const prompt = el('div', 'prompt', center, 'panel');
  center.appendChild(document.createElement('br'));
  const dialogue = el('div', 'dialogue', center, 'panel');
  const toastEl = el('div', 'toast', root);
  const bannerEl = el('div', 'banner', root);
  const raceBox = el('div', 'raceBox', root, 'panel');
  const stuntEl = el('div', 'stunt', topLeft);
  const flash = el('div', 'hitFlash', root);

  const wheel = el('canvas', 'wheel', root);
  wheel.width = 440;
  wheel.height = 440;
  const full = el('div', 'fullmap', root);
  const fullCanvas = el('canvas', null, full);
  fullCanvas.width = MAP_SIZE;
  fullCanvas.height = MAP_SIZE;
  const garage = el('div', 'garage', root, 'panel');

  const title = el('div', 'title', root);
  const box = el('div', 'titleBox', title);
  el('div', 'logo', box).innerHTML = 'SOLARIS<br>COAST';
  el('div', 'tag', box).textContent = 'BAHIA SOLARIS  /  SUNSET EDITION';
  const btnContinue = el('button', null, box, 'menuBtn');
  const btnNew = el('button', null, box, 'menuBtn');
  btnContinue.textContent = 'CONTINUE';
  btnNew.textContent = 'NEW GAME';
  const slotEls = [0, 1, 2].map(() => el('button', null, box, 'menuBtn'));
  const legend = el('div', 'legend', box, 'panel');
  legend.innerHTML = [
    ['WASD', 'move / drive'], ['Shift', 'sprint / nitro'], ['F', 'enter / hijack'], ['Space', 'handbrake / fire'],
    ['Mouse', 'aim and fire'], ['Arrows', 'camera'], ['Q, 1-5', 'weapon wheel'], ['R', 'radio'],
    ['E', 'garage / safehouse'], ['M', 'map'], ['Esc', 'pause'], ['Enter', 'start'],
  ].map(([k, v]) => `<div><b>${k}</b>${v}</div>`).join('');
  const pause = el('div', 'pause', root);
  const pauseBox = el('div', 'pauseBox', pause, 'panel');
  pauseBox.innerHTML = '<h1>PAUSED</h1>Esc resume<br>Mateo and Elena Vance are waiting.';

  H.title = title;
  H.slotEls = slotEls;
  H.btnContinue = btnContinue;
  H.btnNew = btnNew;

  let toastT = 0;
  let bannerT = 0;
  const cache = {};
  const set = (key, node, value) => {
    if (cache[key] !== value) {
      cache[key] = value;
      node.textContent = value;
    }
  };

  const setHtml = (key, node, html) => {
    if (cache[key] !== html) {
      cache[key] = html;
      node.innerHTML = html;
    }
  };

  H.toast = (text) => {
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    toastT = 2.6;
  };
  H.banner = (text, color, sub = '') => {
    bannerEl.style.color = color;
    bannerEl.innerHTML = text ? `${text}<div id="bannerSub">${sub}</div>` : '';
    bannerEl.style.opacity = text ? '1' : '0';
    bannerT = text ? 3.2 : 0;
  };

  const slotLevel = (s) => Math.max(0, ...Object.values((s.activities && s.activities.respect) || {}).map((v) => RESPECT_LEVELS.filter((r) => v >= r).length - 1));
  H.refreshSlots = (selected) => {
    const slots = G.save.slots();
    const any = slots.some(Boolean);
    slots.forEach((s, i) => {
      const info = s ? `Mission ${Math.min(s.missions + 1, 8)}/8 - $${s.cash.toLocaleString('en-US')} - Respect Lv ${slotLevel(s)}` : 'empty';
      slotEls[i].innerHTML = `SLOT ${i + 1}<small>${info}</small>`;
      slotEls[i].classList.toggle('sel', !any && i === selected);
      slotEls[i].classList.toggle('cur', any && i === selected);
    });
    btnContinue.style.opacity = any ? '1' : '0.45';
    btnContinue.classList.toggle('sel', any);
  };

  function drawBlip(g, x, y, color, r) {
    g.fillStyle = color;
    g.strokeStyle = 'rgba(0,0,0,.8)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y, r, 0, 6.283);
    g.fill();
    g.stroke();
  }

  function drawMinimap(t) {
    const g = mini.getContext('2d');
    const pl = G.player;
    const yaw = G.camYaw;
    const zoom = 1.05;
    g.clearRect(0, 0, 210, 210);
    g.save();
    g.translate(105, 105);
    g.rotate(yaw - Math.PI);
    g.scale(zoom, zoom);
    g.drawImage(staticMap, -(pl.x + 280) * MAP_S, -(pl.z + 280) * MAP_S);
    const to = (x, z) => [(x - pl.x) * MAP_S, (z - pl.z) * MAP_S];
    const flashRed = Math.floor(t * 5) % 2 === 0;
    for (const v of G.vehicles.list) {
      if (v.owner === 'police' && !v.dead) {
        const [x, y] = to(v.x, v.z);
        drawBlip(g, x, y, flashRed ? '#ff2a3a' : '#3a6bff', 6);
      }
    }
    for (const o of G.police.officers) {
      if (o.hp > 0) {
        const [x, y] = to(o.x, o.z);
        drawBlip(g, x, y, flashRed ? '#ff4a5a' : '#5a86ff', 4);
      }
    }
    for (const e of G.combat.enemies) {
      if (e.hp > 0) {
        const [x, y] = to(e.x, e.z);
        drawBlip(g, x, y, '#c05aff', 4);
      }
    }
    const heli = G.police.heli;
    if (heli) {
      const [ax, ay] = to(heli.aim.x, heli.aim.z);
      const [hx, hy] = to(heli.pos.x, heli.pos.z);
      g.fillStyle = 'rgba(255,245,200,.35)';
      g.beginPath();
      g.arc(ax, ay, 12 * MAP_S, 0, 6.283);
      g.fill();
      g.fillStyle = 'rgba(255,245,200,.2)';
      g.beginPath();
      g.moveTo(hx, hy);
      const ang = Math.atan2(ay - hy, ax - hx);
      g.arc(hx, hy, Math.hypot(ax - hx, ay - hy) + 14, ang - 0.12, ang + 0.12);
      g.closePath();
      g.fill();
      drawBlip(g, hx, hy, flashRed ? '#ff2a3a' : '#3a6bff', 6);
    }
    const info = G.missions.info();
    if (info.x !== null && info.x !== undefined) {
      let [mx, my] = to(info.x, info.z);
      const d = Math.hypot(mx, my);
      const lim = 88 / zoom;
      if (d > lim) {
        mx = (mx / d) * lim;
        my = (my / d) * lim;
      }
      g.fillStyle = '#ffd23a';
      g.strokeStyle = '#000';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(mx, my - 8);
      g.lineTo(mx + 7, my);
      g.lineTo(mx, my + 8);
      g.lineTo(mx - 7, my);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();
    g.save();
    g.translate(105, 105);
    g.rotate(pl.heading - yaw + Math.PI);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#102030';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -11);
    g.lineTo(8, 9);
    g.lineTo(0, 4);
    g.lineTo(-8, 9);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    const na = yaw - Math.PI;
    const nx = 105 + Math.sin(na) * 92;
    const ny = 105 - Math.cos(na) * 92;
    g.save();
    g.font = 'bold 13px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,.85)';
    g.strokeText('N', nx, ny);
    g.fillStyle = '#ffffff';
    g.fillText('N', nx, ny);
    g.restore();
  }

  function drawFullMap() {
    const g = fullCanvas.getContext('2d');
    g.drawImage(staticMap, 0, 0);
    const p = (x, z) => [(x + 280) * MAP_S, (z + 280) * MAP_S];
    g.font = 'bold 20px Arial';
    g.textAlign = 'center';
    for (const d of DISTRICTS) {
      const [x, y] = p(d.cx, d.cz);
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillText(d.name.toUpperCase(), x + 1, y + 1);
      g.fillStyle = '#ffffff';
      g.fillText(d.name.toUpperCase(), x, y);
    }
    const pin = (pos, color, label) => {
      const [x, y] = p(pos.x, pos.z);
      drawBlip(g, x, y, color, 8);
      g.font = 'bold 14px Arial';
      g.fillStyle = '#fff';
      g.fillText(label, x, y - 12);
    };
    pin(LANDMARKS.garage, '#27e3ff', 'GARAGE');
    pin(LANDMARKS.safehouse, '#9dff5a', 'SAFEHOUSE');
    pin(LANDMARKS.raceStart, '#ff3fb4', 'RACE');
    const info = G.missions.info();
    if (info.x !== null && info.x !== undefined) pin({ x: info.x, z: info.z }, '#ffd23a', 'OBJECTIVE');
    const pl = G.player;
    const [px, py] = p(pl.x, pl.z);
    g.save();
    g.translate(px, py);
    g.rotate(-pl.heading + Math.PI);
    g.fillStyle = '#fff';
    g.strokeStyle = '#000';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -12);
    g.lineTo(9, 10);
    g.lineTo(0, 5);
    g.lineTo(-9, 10);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  // weapon silhouettes as [x, y, w, h, radius] boxes around the origin, one list per WEAPONS entry
  const ICONS = [
    [[-14, -8, 24, 16, 6], [8, -5, 9, 10, 3]],
    [[-20, -8, 36, 9, 2], [-6, 0, 11, 18, 2], [16, -6, 7, 5, 1]],
    [[-24, -6, 44, 10, 2], [-8, 4, 8, 16, 2], [4, 3, 6, 9, 2], [-31, -5, 8, 8, 1], [20, -4, 11, 5, 1]],
    [[-26, -3, 52, 6, 2], [-4, 3, 18, 6, 3], [-31, -6, 14, 12, 3]],
    [[-26, -7, 48, 13, 4], [-12, 5, 9, 13, 2], [22, -4, 11, 5, 2]],
  ];

  let wheelSig = '';

  function drawWheel(mode) {
    const sig = `${mode}|${G.player.weapon}|${G.player.weapons.map((w) => `${w.mag}/${w.reserve}`).join(',')}`;
    if (sig === wheelSig) return;
    wheelSig = sig;
    const g = wheel.getContext('2d');
    const S = 440;
    const C = S / 2;
    const R1 = 206;
    const R0 = 84;
    const seg = (Math.PI * 2) / WEAPONS.length;
    const cur = G.player.weapon;
    g.clearRect(0, 0, S, S);
    const ring = (i) => {
      const a0 = -Math.PI / 2 + (i - 0.5) * seg;
      g.beginPath();
      g.arc(C, C, R1, a0, a0 + seg);
      g.arc(C, C, R0, a0 + seg, a0, true);
      g.closePath();
    };
    for (let i = 0; i < WEAPONS.length; i += 1) {
      ring(i);
      g.fillStyle = i === cur ? 'rgba(10,44,60,.93)' : 'rgba(8,13,24,.86)';
      g.fill();
    }
    g.strokeStyle = 'rgba(150,205,235,.4)';
    g.lineWidth = 2;
    for (let i = 0; i < WEAPONS.length; i += 1) {
      const a = -Math.PI / 2 + (i - 0.5) * seg;
      g.beginPath();
      g.moveTo(C + Math.cos(a) * R0, C + Math.sin(a) * R0);
      g.lineTo(C + Math.cos(a) * R1, C + Math.sin(a) * R1);
      g.stroke();
    }
    g.beginPath();
    g.arc(C, C, R1, 0, 6.283);
    g.stroke();
    ring(cur);
    g.save();
    g.shadowColor = '#27e3ff';
    g.shadowBlur = 22;
    g.strokeStyle = '#4ff0ff';
    g.lineWidth = 4;
    g.stroke();
    g.restore();
    g.textAlign = 'center';
    for (let i = 0; i < WEAPONS.length; i += 1) {
      const am = -Math.PI / 2 + i * seg;
      const cx = C + Math.cos(am) * 146;
      const cy = C + Math.sin(am) * 146;
      const on = i === cur;
      const w = WEAPONS[i];
      const st = G.player.weapons[i];
      g.save();
      g.translate(cx, cy - 28);
      g.fillStyle = on ? '#8ff6ff' : '#d4e4f0';
      if (on) {
        g.shadowColor = '#27e3ff';
        g.shadowBlur = 14;
      }
      for (const [x, y, bw, bh, r] of ICONS[i]) {
        g.beginPath();
        g.roundRect(x, y, bw, bh, r);
        g.fill();
      }
      g.restore();
      g.fillStyle = '#ffffff';
      g.font = 'bold 15px "Segoe UI", Arial, sans-serif';
      g.fillText(`${i + 1}  ${w.name}`, cx, cy + 10);
      g.font = 'bold 19px "Segoe UI", Arial, sans-serif';
      g.fillStyle = on ? '#8ff6ff' : '#9fd2ea';
      g.fillText(i === 0 ? 'MELEE' : `${st.mag} / ${st.reserve}`, cx, cy + 34);
    }
    g.beginPath();
    g.arc(C, C, R0 - 12, 0, 6.283);
    g.fillStyle = 'rgba(6,11,20,.9)';
    g.fill();
    g.strokeStyle = 'rgba(150,205,235,.5)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#cfe3f0';
    g.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    g.fillText('WEAPONS', C, C - 8);
    g.fillStyle = '#4ff0ff';
    g.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    g.fillText(WEAPONS[cur].name.toUpperCase(), C, C + 14);
  }

  H.update = (dt, t, mode) => {
    const pl = G.player;
    title.classList.toggle('hidden', mode !== 'title');
    pause.classList.toggle('hidden', mode !== 'paused');
    root.style.visibility = 'visible';
    for (const n of [topRight, topLeft, bottomLeft, center]) n.style.display = mode === 'title' ? 'none' : '';
    if (mode === 'title') {
      full.classList.add('hidden');
      wheel.style.opacity = '0';
      garage.classList.add('hidden');
      raceBox.classList.add('hidden');
      bottomRight.style.display = 'none';
      return;
    }
    set('cash', cash, `$${pl.cash.toLocaleString('en-US')}`);
    const stc = G.police.stars;
    starEls.forEach((s, i) => {
      s.classList.toggle('on', i < stc);
      s.classList.toggle('flash', i < stc && G.police.seen);
    });
    set('wl', wantedLabel, stc ? ['', 'PATROL PURSUIT', 'INTERCEPTORS', 'ROADBLOCKS + TACTICAL', 'CONDOR-1 AIRBORNE', 'BASTION BLOCKADE'][stc] : '');
    const did = districtAt(pl.x, pl.z);
    const d = DISTRICTS.find((x) => x.id === did);
    set('district', district, d.name.toUpperCase());
    district.style.color = d.color;
    const rv = G.activities.respect[did];
    const lvl = G.activities.level(did);
    const next = RESPECT_LEVELS[Math.min(RESPECT_LEVELS.length - 1, lvl + 1)];
    const prev = RESPECT_LEVELS[lvl];
    respectBar.style.width = `${next > prev ? Math.min(100, ((rv - prev) / (next - prev)) * 100) : 100}%`;
    set('rt', respectText, `RESPECT LV ${lvl}   ${rv} pts`);
    const w = WEAPONS[pl.weapon];
    const ws = pl.weapons[pl.weapon];
    setHtml('weapon', weapon, `${w.name.toUpperCase()}  <span>${pl.weapon === 0 ? '-' : `${ws.mag}`}</span> / ${pl.weapon === 0 ? '-' : ws.reserve}`);
    const info = G.missions.info();
    set('mt', missionTitle, `MISSION  ${Math.min(G.missions.done + 1, 8)}/8  ${info.title.toUpperCase()}`);
    set('mx', missionText, info.text);
    set('md', missionDist, info.dist === null ? '' : `${Math.round(info.dist)} m`);
    const log = G.police.log.slice(-4);
    dlines.forEach((n, i) => {
      const entry = log[i - (4 - log.length)];
      n.textContent = entry ? entry.text : '';
      n.style.opacity = entry ? String(Math.max(0.35, 1 - (G.police.clock - entry.t) / 40)) : '0';
      n.classList.toggle('hot', !!entry && /CONDOR|roadblock|Bastion/i.test(entry.text));
    });
    dispatch.style.display = log.length ? '' : 'none';
    drawMinimap(t);
    hpBar.style.width = `${Math.max(0, pl.hp)}%`;
    armBar.style.width = `${pl.armor}%`;
    set('hpv', hpVal, String(Math.max(0, Math.ceil(pl.hp))));
    set('arv', armVal, String(Math.ceil(pl.armor)));
    flash.style.boxShadow = pl.hurtT > 0 ? 'inset 0 0 120px 30px rgba(255,30,60,.55)' : 'inset 0 0 120px 30px rgba(255,30,60,0)';
    const v = pl.vehicle;
    bottomRight.style.display = v ? '' : 'none';
    if (v) {
      set('veh', vehName, v.spec.name.toUpperCase());
      setHtml('speed', speed, `${Math.round(Math.abs(v.speed) * 3.6)}<small> km/h</small>`);
      nitroBar.style.width = `${v.nitro * 100}%`;
      nitroWrap.style.display = v.spec.nitro ? '' : 'none';
      nitroLabel.style.display = v.spec.nitro ? '' : 'none';
      set('radio', radioName, `[R] ${G.audio.radioName}`);
    }
    let promptText = pl.wasted ? '' : pl.prompt || G.activities.prompt();
    if (G.activities.garage.open) promptText = '';
    prompt.style.display = promptText ? '' : 'none';
    const m = /^\[(\w)\]\s*(.*)$/.exec(promptText);
    setHtml('prompt', prompt, m ? `<b>[${m[1]}]</b> ${m[2]}` : promptText);
    const line = G.missions.lines[0];
    dialogue.style.display = line ? '' : 'none';
    if (line) setHtml('dialogue', dialogue, `<b style="color:${line[0] === 'Elena' ? '#6fe8ff' : '#ffb06a'}">${line[0].toUpperCase()}</b>${line[1]}`);
    toastT = Math.max(0, toastT - dt);
    if (toastT <= 0) toastEl.style.opacity = '0';
    bannerT = Math.max(0, bannerT - dt);
    if (bannerT <= 0) bannerEl.style.opacity = '0';
    const race = G.activities.race;
    raceBox.classList.toggle('hidden', !race);
    if (race) raceBox.textContent = `${Math.max(0, race.time).toFixed(1)}s  CP ${race.idx + 1}/5`;
    set('stunt', stuntEl, G.activities.stuntBest ? `Best stunt jump ${G.activities.stuntBest} m` : '');
    wheel.style.opacity = pl.wheelT > 0 ? '1' : '0';
    if (pl.wheelT > 0 || mode === 'shot') drawWheel(mode);
    const ga = G.activities.garage;
    garage.classList.toggle('hidden', !ga.open);
    if (ga.open) {
      const gp = G.activities.garagePrices(pl.vehicle);
      setHtml('garage', garage, `<h2>CREW GARAGE</h2>1  Repair  $${gp.repair}<br>2  Respray  $${gp.respray}<br>3  Tune  engine +7%  ${gp.tune === null ? 'MAX' : `$${gp.tune}`}<br>4  Clear heat  $${gp.clear}<br><small>${ga.msg}  /  E close</small>`);
    }
    full.classList.toggle('hidden', !G.mapOpen);
    if (G.mapOpen) drawFullMap();
  };

  return H;
}
