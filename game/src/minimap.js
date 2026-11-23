// Corner minimap: rotating city bitmap with the GPS route, police search zone, relics, services and nearby units.
import { MAP_S, SERVICE_MARKERS, currentRoute, drawBadge, drawRelicDiamond, drawRoute, drawSearchZone, routeTarget } from './atlas.js';
import { RELIC_SPOTS } from './progression.js';

const ZOOM = 1.05;
const SERVICE_RANGE = 130;

export function drawMinimap(g, G, staticMap, t) {
  const size = g.canvas.width;
  const c = size / 2;
  const pl = G.player;
  const a = G.camYaw - Math.PI;
  const k = MAP_S * ZOOM;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const to = (x, z) => {
    const dx = (x - pl.x) * k;
    const dz = (z - pl.z) * k;
    return [c + dx * cos - dz * sin, c + dx * sin + dz * cos];
  };
  const edge = ([x, y]) => {
    const m = Math.max(Math.abs(x - c), Math.abs(y - c));
    const f = m > c - 14 ? (c - 14) / m : 1;
    return [c + (x - c) * f, c + (y - c) * f];
  };
  const flash = Math.floor(t * 5) % 2 === 0;
  const onMap = ([x, y], pad = 8) => x > pad && y > pad && x < size - pad && y < size - pad;

  g.clearRect(0, 0, size, size);
  g.save();
  g.beginPath();
  g.roundRect(0, 0, size, size, 16);
  g.clip();
  g.translate(c, c);
  g.rotate(a);
  g.scale(ZOOM, ZOOM);
  g.drawImage(staticMap, -(pl.x + 280) * MAP_S, -(pl.z + 280) * MAP_S);
  g.setTransform(1, 0, 0, 1, 0, 0);

  const zone = G.police.searchZone();
  if (zone) drawSearchZone(g, zone, to, k, t);
  const route = currentRoute(G);
  if (route) drawRoute(g, route.points, to, 4);
  for (const r of RELIC_SPOTS) {
    const p = to(r.x, r.z);
    if (onMap(p) && !G.progress.relics.includes(r.id)) drawRelicDiamond(g, p[0], p[1], false, 6);
  }
  for (const [pos, letter, color] of SERVICE_MARKERS) {
    if (Math.hypot(pos.x - pl.x, pos.z - pl.z) < SERVICE_RANGE) drawBadge(g, ...edge(to(pos.x, pos.z)), letter, color, 8);
  }
  for (const e of G.combat.enemies) {
    if (e.hp > 0) {
      const p = to(e.x, e.z);
      if (onMap(p)) drawBadge(g, p[0], p[1], '', '#c05aff', 4);
    }
  }
  const cop = flash ? '#ff3a4a' : '#3a6bff';
  for (const v of G.vehicles.list) {
    if (v.owner === 'police' && !v.dead) {
      const p = to(v.x, v.z);
      if (onMap(p, 4)) drawBadge(g, p[0], p[1], 'P', cop, 7);
    }
  }
  for (const o of G.police.officers) {
    if (o.hp > 0) {
      const p = to(o.x, o.z);
      if (onMap(p, 4)) drawBadge(g, p[0], p[1], '', cop, 4);
    }
  }
  const heli = G.police.heli;
  if (heli) {
    const p = to(heli.pos.x, heli.pos.z);
    if (onMap(p, 4)) drawBadge(g, p[0], p[1], 'C', cop, 8);
  }
  const tg = routeTarget(G);
  if (tg) drawBadge(g, ...edge(to(tg.x, tg.z)), tg.kind === 'WAYPOINT' ? 'W' : '!', tg.kind === 'WAYPOINT' ? '#b46bff' : '#ffd23a', 9);

  g.translate(c, c);
  g.rotate(pl.heading - G.camYaw + Math.PI);
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
  g.setTransform(1, 0, 0, 1, 0, 0);
  const nx = c + Math.sin(a) * (c - 12);
  const ny = c - Math.cos(a) * (c - 12);
  g.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,.85)';
  g.strokeText('N', nx, ny);
  g.fillStyle = '#ffffff';
  g.fillText('N', nx, ny);
  g.restore();
}
