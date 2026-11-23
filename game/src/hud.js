// HUD: mission card, SCMPD response table, status strip, weapon hotbar, crew cards, minimap, radio dialogue,
// vehicle telemetry, aiming reticle, target markers, garage panel, title menu with save slot cards, and pause.
import * as THREE from 'three';
import { DISTRICTS, WEAPONS, districtAt } from './config.js';
import { GARAGE_SERVICES } from './activities.js';
import { SPEAKERS, getCrewCards, getSpeakerPortrait } from './crew.js';
import { getChaseStatus, getTacticalUnits } from './police.js';
import { RELIC_SPOTS, summarizeSlot, weaponUnlocked } from './progression.js';
import { buildStaticMap } from './atlas.js';
import { drawMinimap } from './minimap.js';

const MINI = 200;
const MARK_RANGE = 70;
const markPos = new THREE.Vector3();

function el(tag, id, parent, cls) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
}

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const clock = (t) => {
  const m = Math.floor(18 * 60 + 42 + t * 0.5) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createHud(G) {
  const root = document.getElementById('hud');
  const H = {};
  const staticMap = buildStaticMap();

  const marks = el('canvas', 'marks', root);
  const reticle = el('div', 'reticle', root);
  for (let i = 0; i < 4; i += 1) el('i', null, reticle);
  el('b', null, reticle);

  const topLeft = el('div', 'topLeft', root);
  const mission = el('div', 'mission', topLeft, 'glass');
  const response = el('div', 'response', topLeft, 'glass');
  const stuntEl = el('div', 'stunt', topLeft);

  const topRight = el('div', 'topRight', root);
  const status = el('div', 'statusStrip', topRight, 'glass');
  const hotbar = el('div', 'hotbar', topRight, 'glass');
  const crew = el('div', 'crew', topRight);

  const bottomLeft = el('div', 'bottomLeft', root);
  const mini = el('canvas', 'minimap', bottomLeft, 'glass');
  mini.width = MINI;
  mini.height = MINI;
  const info = el('div', 'info', bottomLeft, 'glass');

  const bottomRight = el('div', 'bottomRight', root);
  const radio = el('div', 'radio', bottomRight, 'glass');
  const tele = el('div', 'tele', bottomRight, 'glass');

  const center = el('div', 'center', root);
  const prompt = el('div', 'prompt', center, 'glass');
  const dialogue = el('div', 'dialogue', center, 'glass');
  const toastEl = el('div', 'toast', root);
  const bannerEl = el('div', 'banner', root);
  const raceBox = el('div', 'raceBox', root, 'glass');
  const flash = el('div', 'hitFlash', root);
  const garage = el('div', 'garage', root, 'glass');
  garage.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) G.activities.garageAct(Number(b.dataset.i));
  });

  const title = el('div', 'title', root);
  const box = el('div', 'titleBox', title);
  el('div', 'logo', box).innerHTML = 'SOLARIS<br>COAST';
  const btnContinue = el('button', null, box, 'menuBtn');
  const btnNew = el('button', null, box, 'menuBtn');
  const btnAtlas = el('button', null, box, 'menuBtn');
  const btnControls = el('button', null, box, 'menuBtn');
  btnContinue.textContent = 'CONTINUE';
  btnNew.textContent = 'NEW CAREER';
  btnAtlas.innerHTML = 'WORLD ATLAS<small>M</small>';
  btnControls.textContent = 'CONTROLS';
  const slotsBox = el('div', 'slots', title);
  const slotEls = [0, 1, 2].map(() => el('button', null, slotsBox, 'slotCard'));
  const pause = el('div', 'pause', root);
  el('div', 'pauseBox', pause, 'glass').innerHTML = '<h1>PAUSED</h1><p>ESC RESUME</p><p>M WORLD ATLAS</p>';

  H.title = title;
  H.slotEls = slotEls;
  H.btnContinue = btnContinue;
  H.btnNew = btnNew;
  H.btnAtlas = btnAtlas;
  H.btnControls = btnControls;

  let toastT = 0;
  let bannerT = 0;
  const cache = {};
  const set = (key, node, html) => {
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

  H.refreshSlots = (selected) => {
    const slots = G.save.slots();
    const any = slots.some(Boolean);
    slots.forEach((d, i) => {
      const s = summarizeSlot(d);
      slotEls[i].innerHTML = s
        ? `<b>SLOT ${i + 1}</b><span>${s.district.toUpperCase()}</span><span>${s.rank}</span><span>${money(s.cash)}</span><i><u style="width:${s.pct}%"></u></i><em>${s.pct.toFixed(1)}% COMPLETE</em>`
        : `<b>SLOT ${i + 1}</b><span class="empty">EMPTY SLOT</span>`;
      slotEls[i].classList.toggle('sel', !any && i === selected);
      slotEls[i].classList.toggle('cur', any && i === selected);
    });
    btnContinue.style.opacity = any ? '1' : '0.45';
    btnContinue.classList.toggle('sel', any);
  };

  const barHtml = (label, value, cls, text = Math.ceil(Math.max(0, value))) => `<div class="bRow"><span>${label}</span><i><b class="${cls}" style="width:${Math.max(0, Math.min(100, value))}%"></b></i><em>${text}</em></div>`;

  function missionHtml() {
    const m = G.missions.info();
    const n = Math.min(G.missions.done + 1, 8);
    const stage = m.totalStages ? `<b>STAGE ${Math.max(1, m.stage)}/${m.totalStages}</b>` : '';
    const dist = m.dist === null ? '' : `<span>${Math.round(m.dist)} m</span>`;
    let pace = '';
    if (m.elapsed !== null) {
      const k = m.elapsed / m.par;
      pace = `<div class="mBar"><i style="width:${Math.min(100, k * 100)}%;background:${k < 0.7 ? '#6fe08a' : k < 1 ? '#ffc24a' : '#ff5a5a'}"></i></div><div class="mTime">${mmss(m.elapsed)} / PAR ${mmss(m.par)}</div>`;
    }
    return `<div class="mHead"><span>CONTRACT ${n}/8</span>${stage}</div><div class="mTitle">${m.title.toUpperCase()}</div><div class="mObj">${m.text}</div><div class="mNext"><span>${m.nextText}</span>${dist}</div>${pace}`;
  }

  function responseHtml() {
    const chase = getChaseStatus(G);
    const rows = getTacticalUnits(G).map((u) => `<div class="rRow"><span>${u.callsign}</span><em>${u.dist}m</em><b style="background:${u.color}">${u.state}</b></div>`).join('');
    return `<div class="rHead"><span>SCMPD RESPONSE</span><b class="pill ${chase.label.replace(' ', '').toLowerCase()}">${chase.text}</b></div>${rows}`;
  }

  function statusHtml(t) {
    const stc = G.police.stars;
    const stars = Array.from({ length: 5 }, (_, i) => `<i class="star${i < stc ? ' on' : ''}${i < stc && G.police.seen ? ' flash' : ''}"></i>`).join('');
    const chase = getChaseStatus(G);
    const rk = G.progress.rank();
    return `<div class="sRow"><span class="clock">${clock(t)}</span><span class="cash">${money(G.player.cash)}</span><span class="stars">${stars}</span></div>`
      + `<div class="sRow"><b class="pill ${chase.label.replace(' ', '').toLowerCase()}">${chase.label}</b><span class="rank">${rk.label}</span></div><div class="rp"><i style="width:${Math.round(rk.pct * 100)}%"></i></div>`;
  }

  function hotbarHtml() {
    const pl = G.player;
    return WEAPONS.map((w, i) => {
      const locked = !weaponUnlocked(G.progress.rp, i);
      const st = pl.weapons[i];
      const ammo = locked ? `RANK ${w.rank}` : i === 0 ? '--' : `${st.mag}/${st.reserve}`;
      return `<div class="slot${i === pl.weapon ? ' on' : ''}${locked ? ' lock' : ''}"><kbd>${i + 1}</kbd><b>${w.short}</b><span>${ammo}</span></div>`;
    }).join('');
  }

  function crewHtml() {
    return getCrewCards(G).map((c) => `<div class="card ${c.ready ? 'ready' : 'cool'}${c.active ? ' act' : ''}"><div class="cp">${c.portrait}</div><kbd>${c.slot}</kbd><b>${c.skill}</b><span>${c.active ? 'ACTIVE' : c.label}</span><i style="height:${Math.round(c.pct * 100)}%"></i></div>`).join('');
  }

  function infoHtml() {
    const pl = G.player;
    const did = districtAt(pl.x, pl.z);
    const d = DISTRICTS.find((x) => x.id === did);
    return `<div class="dName" style="color:${d.color}">${d.name.toUpperCase()}</div><div class="dSub">RELICS ${G.progress.relics.length}/${RELIC_SPOTS.length}<span>RESPECT LV ${G.activities.level(did)}</span></div>`
      + barHtml('HEALTH', pl.hp, 'hp') + barHtml('ARMOR', pl.armor, 'arm');
  }

  function teleHtml() {
    const pl = G.player;
    const v = pl.vehicle;
    if (!v) {
      const w = WEAPONS[pl.weapon];
      const st = pl.weapons[pl.weapon];
      return `<div class="tName">ON FOOT</div><div class="tWeapon">${w.name.toUpperCase()}</div><div class="tAmmo">${pl.weapon === 0 ? 'MELEE' : `${st.mag} / ${st.reserve}`}</div>`;
    }
    const gear = v.gear === 'R' || v.gear === 'N' ? v.gear : `D${v.gear}`;
    return `<div class="tName">${v.spec.name.toUpperCase()}</div>${barHtml('CONDITION', v.conditionPct, 'cond', `${v.conditionPct}%`)}`
      + `<div class="tSpeed"><b>${v.kmh}</b><small>KM/H</small><span class="gear">${gear}</span></div>${v.spec.nitro ? barHtml('NITRO', v.nitroPct, 'nitro', '') : ''}`;
  }

  function dialogueHtml(line) {
    const sp = SPEAKERS[line[0]];
    return `<div class="dPort">${getSpeakerPortrait(line[0], 'say-')}</div><div class="dTxt"><div class="dWho"><b style="color:${sp.color}">${sp.name}</b><em>${sp.role}</em></div><p>${line[1]}</p></div>`;
  }

  function drawMarks() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (marks.width !== w || marks.height !== h) {
      marks.width = w;
      marks.height = h;
    }
    const g = marks.getContext('2d');
    g.clearRect(0, 0, w, h);
    for (const e of G.combat.enemies) {
      if (e.hp <= 0 || Math.hypot(e.x - G.player.x, e.z - G.player.z) > MARK_RANGE) continue;
      markPos.set(e.x, 2.2, e.z).project(G.camera);
      if (markPos.z > 1 || Math.abs(markPos.x) > 1 || Math.abs(markPos.y) > 1) continue;
      const x = (markPos.x * 0.5 + 0.5) * w;
      const y = (-markPos.y * 0.5 + 0.5) * h;
      g.fillStyle = '#ff2a3a';
      g.strokeStyle = 'rgba(30,0,6,.9)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 9, y - 9);
      g.lineTo(x, y + 2);
      g.lineTo(x + 9, y - 9);
      g.lineTo(x, y - 3);
      g.closePath();
      g.fill();
      g.stroke();
      const k = Math.max(0, Math.min(1, e.hp / (e.maxHp || 60)));
      g.fillStyle = 'rgba(20,0,6,.75)';
      g.fillRect(x - 13, y - 17, 26, 4);
      g.fillStyle = '#ff5a6a';
      g.fillRect(x - 13, y - 17, 26 * k, 4);
    }
  }

  H.update = (dt, t, mode) => {
    const pl = G.player;
    const atlasOpen = G.atlas.open;
    title.classList.toggle('hidden', mode !== 'title' || atlasOpen);
    pause.classList.toggle('hidden', mode !== 'paused');
    root.style.visibility = 'visible';
    const hudOn = mode !== 'title' && !atlasOpen;
    for (const n of [topLeft, topRight, bottomLeft, bottomRight, center, marks]) n.style.display = hudOn ? '' : 'none';
    if (!hudOn) {
      reticle.style.display = 'none';
      garage.classList.add('hidden');
      raceBox.classList.add('hidden');
      return;
    }
    set('mission', mission, missionHtml());
    const chasing = G.police.stars > 0;
    response.style.display = chasing ? '' : 'none';
    if (chasing) set('response', response, responseHtml());
    set('status', status, statusHtml(t));
    set('hotbar', hotbar, hotbarHtml());
    set('crew', crew, crewHtml());
    set('info', info, infoHtml());
    set('tele', tele, teleHtml());
    set('radio', radio, `<kbd>R</kbd>${G.audio.nowPlaying()}`);
    drawMinimap(mini.getContext('2d'), G, staticMap, t);
    flash.style.boxShadow = pl.hurtT > 0 ? 'inset 0 0 120px 30px rgba(255,30,60,.55)' : 'inset 0 0 120px 30px rgba(255,30,60,0)';

    const showAim = !pl.vehicle && !pl.wasted;
    reticle.style.display = showAim ? '' : 'none';
    if (showAim) {
      const w = WEAPONS[pl.weapon];
      reticle.style.setProperty('--gap', `${Math.round(6 + w.spread * 90 + G.combat.shotT * 60 + pl.walkSpeed * 1.2)}px`);
      reticle.classList.toggle('hit', G.combat.hitT > 0);
    }
    drawMarks();

    let promptText = pl.wasted ? '' : pl.prompt || G.activities.prompt();
    if (G.activities.garage.open) promptText = '';
    prompt.style.display = promptText ? '' : 'none';
    const m = /^\[(\w)\]\s*(.*)$/.exec(promptText);
    set('prompt', prompt, m ? `<b>${m[1]}</b>${m[2]}` : promptText);
    const line = G.missions.lines[0];
    dialogue.style.display = line ? '' : 'none';
    if (line) set('dialogue', dialogue, dialogueHtml(line));
    toastT = Math.max(0, toastT - dt);
    if (toastT <= 0) toastEl.style.opacity = '0';
    bannerT = Math.max(0, bannerT - dt);
    if (bannerT <= 0) bannerEl.style.opacity = '0';
    const race = G.activities.race;
    raceBox.classList.toggle('hidden', !race);
    if (race) raceBox.textContent = `${Math.max(0, race.time).toFixed(1)}s  CP ${race.idx + 1}/5`;
    set('stunt', stuntEl, G.activities.stuntBest ? `BEST JUMP ${G.activities.stuntBest} m` : '');
    const ga = G.activities.garage;
    garage.classList.toggle('hidden', !ga.open);
    if (ga.open) {
      const prices = G.activities.garagePrices(pl.vehicle);
      const rows = GARAGE_SERVICES.map((s, i) => `<button data-i="${i}"><kbd>${i + 1}</kbd>${s.label}<em>${prices[s.id] === null ? 'MAX' : money(prices[s.id])}</em></button>`).join('');
      set('garage', garage, `<h2>CREW GARAGE</h2>${rows}<small>${ga.msg || 'KEYS 1-7'}  /  E CLOSE</small>`);
    }
  };

  return H;
}
