// Every texture is painted on a Canvas 2D at boot; nothing is loaded from disk or the network.
import * as THREE from 'three';
import { mulberry32 } from './random.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function noise(g, w, h, rnd, amount, count) {
  for (let i = 0; i < count; i += 1) {
    const v = Math.floor(rnd() * 255);
    g.fillStyle = `rgba(${v},${v},${v},${amount})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/** Road segment: u across the 14 m width, v along 28 m. Edge lines and a dashed yellow centre. */
export function roadTexture() {
  const c = canvas(256, 512);
  const g = c.getContext('2d');
  const rnd = mulberry32(11);
  g.fillStyle = '#3a3d46';
  g.fillRect(0, 0, 256, 512);
  noise(g, 256, 512, rnd, 0.07, 5000);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(70, 0, 22, 512);
  g.fillRect(164, 0, 22, 512);
  g.fillStyle = '#e9ecef';
  g.fillRect(14, 0, 6, 512);
  g.fillRect(236, 0, 6, 512);
  g.fillStyle = '#f2c230';
  g.fillRect(124, 40, 8, 190);
  g.fillRect(124, 300, 8, 190);
  return toTexture(c);
}

/** Intersection square: asphalt with zebra crossings on all four edges. */
export function intersectionTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const rnd = mulberry32(12);
  g.fillStyle = '#3a3d46';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, rnd, 0.07, 2500);
  g.fillStyle = 'rgba(235,238,242,0.9)';
  for (let i = 0; i < 9; i += 1) {
    const p = 18 + i * 26;
    g.fillRect(p, 4, 14, 34);
    g.fillRect(p, 218, 14, 34);
    g.fillRect(4, p, 34, 14);
    g.fillRect(218, p, 34, 14);
  }
  return toTexture(c);
}

export function asphaltTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const rnd = mulberry32(13);
  g.fillStyle = '#3c3f48';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, rnd, 0.08, 4000);
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 5;
  for (let x = 0; x <= 256; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  return toTexture(c);
}

/** Pavers for sidewalks and plazas; tint is the base colour. */
export function paverTexture(tint) {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const rnd = mulberry32(14);
  g.fillStyle = tint;
  g.fillRect(0, 0, 128, 128);
  noise(g, 128, 128, rnd, 0.1, 1200);
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 128);
    g.moveTo(0, i);
    g.lineTo(128, i);
    g.stroke();
  }
  return toTexture(c);
}

export function sandTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const rnd = mulberry32(15);
  g.fillStyle = '#e8c98a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i += 1) {
    const l = 55 + rnd() * 35;
    g.fillStyle = `hsla(38,60%,${l}%,0.35)`;
    g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
  }
  return toTexture(c);
}

export function lawnTexture() {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const rnd = mulberry32(16);
  g.fillStyle = '#6a9a4a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2500; i += 1) {
    g.fillStyle = `hsla(${80 + rnd() * 30},45%,${30 + rnd() * 25}%,0.5)`;
    g.fillRect(rnd() * 128, rnd() * 128, 2, 3);
  }
  return toTexture(c);
}

/** Glass tower facade: 4 columns x 8 floors per tile, plus a matching lit-window emissive map. */
export function glassFacade(hue, seed) {
  const rnd = mulberry32(seed);
  const map = canvas(256, 512);
  const emi = canvas(256, 512);
  const g = map.getContext('2d');
  const e = emi.getContext('2d');
  g.fillStyle = `hsl(${hue},25%,22%)`;
  g.fillRect(0, 0, 256, 512);
  e.fillStyle = '#000';
  e.fillRect(0, 0, 256, 512);
  for (let r = 0; r < 8; r += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = col * 64 + 6;
      const y = r * 64 + 8;
      const grad = g.createLinearGradient(0, y, 0, y + 48);
      grad.addColorStop(0, `hsl(${hue},55%,${48 + r * 2}%)`);
      grad.addColorStop(1, `hsl(${hue + 20},60%,24%)`);
      g.fillStyle = grad;
      g.fillRect(x, y, 52, 48);
      if (rnd() < 0.42) {
        const warm = rnd() < 0.7;
        e.fillStyle = warm ? `hsl(${38 + rnd() * 14},95%,${58 + rnd() * 12}%)` : `hsl(${hue},80%,70%)`;
        e.fillRect(x, y, 52, 48);
      }
    }
  }
  return { map: toTexture(map), emissive: toTexture(emi) };
}

/** Art-deco pastel facade with window strips and a thin trim line. */
export function decoFacade(color, seed) {
  const rnd = mulberry32(seed);
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, rnd, 0.05, 1500);
  for (let col = 0; col < 4; col += 1) {
    const x = col * 64 + 12;
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillRect(x - 3, 10, 46, 236);
    for (let r = 0; r < 4; r += 1) {
      const y = 18 + r * 58;
      g.fillStyle = '#245870';
      g.beginPath();
      g.moveTo(x, y + 44);
      g.lineTo(x, y + 12);
      g.quadraticCurveTo(x + 20, y - 6, x + 40, y + 12);
      g.lineTo(x + 40, y + 44);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 4, y + 14, 8, 28);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 0, 256, 6);
  return toTexture(c);
}

export function warehouseTexture(color) {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 8) {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(x, 0, 3, 256);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(x + 3, 0, 2, 256);
  }
  g.fillStyle = 'rgba(30,34,40,0.9)';
  g.fillRect(40, 120, 70, 136);
  g.fillRect(146, 120, 70, 136);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let y = 126; y < 256; y += 12) {
    g.fillRect(40, y, 70, 2);
    g.fillRect(146, y, 70, 2);
  }
  g.fillStyle = '#ffb347';
  g.fillRect(0, 100, 256, 6);
  return toTexture(c);
}

/** Grey corrugated container; the instance colour tints it. */
export function containerTexture() {
  const c = canvas(256, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#d9d9d9';
  g.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 8) {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x, 0, 3, 128);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(x + 4, 0, 2, 128);
  }
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(24, 18, 72, 22);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.font = 'bold 16px sans-serif';
  g.fillText('SOLARIS', 28, 35);
  return toTexture(c);
}

/** Turquoise water with bright ripple lines; scrolled by the city update. */
export function oceanTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  const rnd = mulberry32(21);
  g.fillStyle = '#17b3c4';
  g.fillRect(0, 0, 256, 256);
  g.lineWidth = 2;
  for (let i = 0; i < 70; i += 1) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const w = 14 + rnd() * 30;
    g.strokeStyle = `rgba(255,255,255,${0.12 + rnd() * 0.22})`;
    for (const dx of [-256, 0, 256]) {
      g.beginPath();
      g.moveTo(x + dx, y);
      g.quadraticCurveTo(x + dx + w / 2, y - 4, x + dx + w, y);
      g.stroke();
    }
  }
  return toTexture(c);
}

/** Neon sign on a transparent background; text glows in `color`. */
export function neonSign(text, color, w = 512, h = 128) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(8,10,20,0.78)';
  g.beginPath();
  g.roundRect(6, 6, w - 12, h - 12, 18);
  g.fill();
  g.shadowColor = color;
  g.shadowBlur = 22;
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.beginPath();
  g.roundRect(14, 14, w - 28, h - 28, 14);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.floor(h * 0.5)}px "Arial Black", Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
  g.shadowBlur = 36;
  g.fillStyle = color;
  g.globalAlpha = 0.65;
  g.fillText(text, w / 2, h / 2 + 3);
  return toTexture(c, { repeat: false });
}

/** Soft round blob for halos, sparks and smoke. */
export function glowTexture() {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c, { repeat: false });
}

/** Vertical fade for light beams. */
export function beamTexture() {
  const c = canvas(4, 128);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  return toTexture(c, { repeat: false });
}

export function deckTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#50545e';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#e9ecef';
  g.fillRect(0, 100, 256, 5);
  g.fillRect(0, 151, 256, 5);
  g.fillStyle = '#f2c230';
  g.fillRect(0, 126, 256, 4);
  return toTexture(c);
}
