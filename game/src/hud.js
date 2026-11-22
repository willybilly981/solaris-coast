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

  const topRight = el('div', 'topRight', root);
  const cash = el('div', 'cash', topRight);
  const stars = el('div', 'stars', topRight);
  const starEls = Array.from({ length: 5 }, () => el('div', null, stars, 'star'));
  const wantedLabel = el('div', 'wantedLabel', topRight);
  const district = el('div', 'district', topRight);
  const respect = el('div', 'respect', topRight);
  const respectBar = el('div', 'respectBar', respect);
  const respectText = el('div', 'respectText', topRight);
  const weapon = el('div', 'weapon', topRight, 'panel');

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
  const bars = el('div', 'bars', bottomLeft);
  const hpWrap = el('div', null, bars, 'bar');
  const hpBar = el('i', 'hpBar', hpWrap);
  const armWrap = el('div', null, bars, 'bar');
  const armBar = el('i', 'armBar', armWrap);

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
  wheel.width = 380;
  wheel.height = 380;
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

  H.refreshSlots = (selected) => {
    G.save.slots().forEach((s, i) => {
      slotEls[i].innerHTML = `SLOT ${i + 1}<small>${s ? `${s.when}  $${s.cash}  M${s.missions}/8` : 'empty'}</small>`;
      slotEls[i].classList.toggle('sel', i === selected);
    });
    const any = G.save.slots().some(Boolean);
    btnContinue.style.opacity = any ? '1' : '0.45';
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
    g.strokeStyle = 'rgba(255,255,255,.65)';
    g.font = 'bold 13px Arial';
    g.fillStyle = '#ffffff';
    g.fillText('N', 100, 16);
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

  function drawWheel() {
    const g = wheel.getContext('2d');
    g.clearRect(0, 0, 380, 380);
    const cur = G.player.weapon;
    for (let i = 0; i < WEAPONS.length; i += 1) {
      const a0 = -Math.PI / 2 + (i - 0.5) * (Math.PI * 2 / 5) + 0.03;
      const a1 = a0 + Math.PI * 2 / 5 - 0.06;
      g.beginPath();
      g.arc(190, 190, 176, a0, a1);
      g.arc(190, 190, 74, a1, a0, true);
      g.closePath();
      g.fillStyle = i === cur ? 'rgba(255,150,50,.78)' : 'rgba(8,16,34,.8)';
      g.fill();
      g.strokeStyle = i === cur ? '#ffd27a' : 'rgba(140,210,255,.55)';
      g.lineWidth = 2;
      g.stroke();
      const am = (a0 + a1) / 2;
      const cx = 190 + Math.cos(am) * 126;
      const cy = 190 + Math.sin(am) * 126;
      const w = WEAPONS[i];
      const st = G.player.weapons[i];
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.font = 'bold 15px Arial';
      g.fillText(`${i + 1}  ${w.name}`, cx, cy - 4);
      g.font = 'bold 18px Arial';
      g.fillStyle = i === cur ? '#fff6d0' : '#9fe0ff';
      g.fillText(i === 0 ? 'MELEE' : `${st.mag} / ${st.reserve}`, cx, cy + 20);
    }
    g.beginPath();
    g.arc(190, 190, 62, 0, 6.283);
    g.fillStyle = 'rgba(6,12,26,.7)';
    g.fill();
    g.strokeStyle = 'rgba(140,210,255,.7)';
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 14px Arial';
    g.textAlign = 'center';
    g.fillText('WEAPONS', 190, 186);
    g.fillStyle = '#ffd27a';
    g.fillText(WEAPONS[cur].name.toUpperCase(), 190, 206);
  }

  H.update = (dt, t, mode) => {
    const pl = G.player;
    title.classList.toggle('hidden', mode !== 'title');
    pause.classList.toggle('hidden', mode !== 'paused');
    const playing = mode === 'play' || mode === 'paused' || mode === 'shot';
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
    set('weapon', weapon, '');
    weapon.innerHTML = `${w.name.toUpperCase()}  <span>${pl.weapon === 0 ? '-' : `${ws.mag}`}</span> / ${pl.weapon === 0 ? '-' : ws.reserve}`;
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
    armWrap.style.display = pl.armor > 0 ? '' : 'none';
    flash.style.boxShadow = pl.hurtT > 0 ? 'inset 0 0 120px 30px rgba(255,30,60,.55)' : 'inset 0 0 120px 30px rgba(255,30,60,0)';
    const v = pl.vehicle;
    bottomRight.style.display = v ? '' : 'none';
    if (v) {
      set('veh', vehName, v.spec.name.toUpperCase());
      speed.innerHTML = `${Math.round(Math.abs(v.speed) * 3.6)}<small> km/h</small>`;
      nitroBar.style.width = `${v.nitro * 100}%`;
      nitroWrap.style.display = v.spec.nitro ? '' : 'none';
      nitroLabel.style.display = v.spec.nitro ? '' : 'none';
      set('radio', radioName, `[R] ${G.audio.radioName}`);
    }
    let promptText = pl.wasted ? '' : pl.prompt || G.activities.prompt();
    if (G.activities.garage.open) promptText = '';
    prompt.style.display = promptText ? '' : 'none';
    const m = /^\[(\w)\]\s*(.*)$/.exec(promptText);
    prompt.innerHTML = m ? `<b>[${m[1]}]</b> ${m[2]}` : promptText;
    const line = G.missions.lines[0];
    dialogue.style.display = line ? '' : 'none';
    if (line) dialogue.innerHTML = `<b style="color:${line[0] === 'Elena' ? '#6fe8ff' : '#ffb06a'}">${line[0].toUpperCase()}</b>${line[1]}`;
    toastT = Math.max(0, toastT - dt);
    if (toastT <= 0) toastEl.style.opacity = '0';
    bannerT = Math.max(0, bannerT - dt);
    if (bannerT <= 0) bannerEl.style.opacity = '0';
    const race = G.activities.race;
    raceBox.classList.toggle('hidden', !race);
    if (race) raceBox.textContent = `${Math.max(0, race.time).toFixed(1)}s  CP ${race.idx + 1}/5`;
    set('stunt', stuntEl, G.activities.stuntBest ? `Best stunt jump ${G.activities.stuntBest} m` : '');
    wheel.style.opacity = pl.wheelT > 0 ? '1' : '0';
    if (pl.wheelT > 0 || mode === 'shot') drawWheel();
    const ga = G.activities.garage;
    garage.classList.toggle('hidden', !ga.open);
    if (ga.open) {
      garage.innerHTML = `<h2>CREW GARAGE</h2>1  Repair  $120<br>2  Respray  $80<br>3  Tune  engine +7%<br>4  Clear heat  $500<br><small>${ga.msg}  /  E close</small>`;
    }
    full.classList.toggle('hidden', !G.mapOpen);
    if (G.mapOpen) drawFullMap();
    if (!playing) return;
  };

  return H;
}
