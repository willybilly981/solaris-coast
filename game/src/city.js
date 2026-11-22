// World builder: roads, blocks, the four districts, ocean, props and AABB colliders.
import * as THREE from 'three';
import { LANDMARKS, RAMPS, ROADS, WORLD, districtAt } from './config.js';
import * as TX from './textures.js';
import { boxGeo, instances, mergeGeos, placed, tileUV } from './geometry.js';

export const NEON = { cyan: '#27e3ff', magenta: '#ff3fb4', amber: '#ffb23a', lime: '#9dff5a' };
const GRID = 40;
const COLS = [-280, ...ROADS.x, 215];
const ROWS = [-280, ...ROADS.z, 215];
const SIGN_TEXT = ['SOLARIS', 'AURUM', 'VELA BANK', 'NOVA', 'ORCHID', 'KAIRO', 'ZENITH', 'CROWN', 'HALCYON', 'LUMEN'];
const PASTELS = ['#f6a9c4', '#9fe6cf', '#ffc79e', '#c8b8ff', '#8fdcea'];

function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.02, ...o });
  const m = {
    road: std({ map: TX.roadTexture(), roughness: 0.9 }),
    cross: std({ map: TX.intersectionTexture(), roughness: 0.9 }),
    walk_crown: std({ map: TX.paverTexture('#a3acb6') }),
    walk_harbor: std({ map: TX.paverTexture('#8f8c86') }),
    walk_palma: std({ map: TX.paverTexture('#c19a76') }),
    walk_mirador: std({ map: TX.paverTexture('#ecd9b4') }),
    sand: std({ map: TX.sandTexture(), roughness: 1 }),
    lawn: std({ map: TX.lawnTexture(), roughness: 1 }),
    lot: std({ map: TX.asphaltTexture(), roughness: 0.9 }),
    deck: std({ map: TX.deckTexture(), roughness: 0.8 }),
    roof: std({ color: '#5b606b' }),
    concrete: std({ color: '#b2b4b8' }),
    metal: std({ color: '#8e949e', metalness: 0.5, roughness: 0.4 }),
    crane: std({ color: '#e5472a', metalness: 0.3, roughness: 0.5 }),
    wood: std({ color: '#8a6a44' }),
    wall: std({ color: '#9aa0a8' }),
    pool: new THREE.MeshStandardMaterial({ color: '#25d4e8', emissive: '#0a8fa8', emissiveIntensity: 0.9, roughness: 0.2 }),
    trimCyan: new THREE.MeshBasicMaterial({ color: NEON.cyan }),
    trimMagenta: new THREE.MeshBasicMaterial({ color: NEON.magenta }),
    trimAmber: new THREE.MeshBasicMaterial({ color: NEON.amber }),
    villa0: std({ color: '#f4efe4' }),
    villa1: std({ color: '#e7b79a' }),
    villa2: std({ color: '#d8e6ea' }),
    glassDark: std({ color: '#16303f', roughness: 0.15, metalness: 0.6 }),
  };
  [195, 212, 175, 285].forEach((hue, i) => {
    const t = TX.glassFacade(hue, 100 + i);
    m[`glass${i}`] = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.28, metalness: 0.45 });
  });
  PASTELS.forEach((c, i) => {
    m[`deco${i}`] = std({ map: TX.decoFacade(c, 200 + i), roughness: 0.7 });
  });
  ['#c5654a', '#4c8ab0', '#d9b44a'].forEach((c, i) => {
    m[`ware${i}`] = std({ map: TX.warehouseTexture(c), roughness: 0.6, metalness: 0.2 });
  });
  return m;
}

export function buildCity(scene, rng) {
  const mats = makeMaterials();
  const city = { colliders: [], grid: new Map(), ramps: RAMPS, neon: [], lamps: [], mats, update: null };
  const batches = new Map();
  const palms = [];
  const root = new THREE.Group();
  scene.add(root);

  const add = (key, geo) => {
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(geo);
  };
  const box = (key, cx, y0, cz, w, h, d, tile) => {
    const g = placed(boxGeo(w, h, d), cx, y0, cz);
    if (tile) tileUV(g, tile[0], tile[1]);
    add(key, g);
  };
  const solid = (cx, cz, w, d, h) => {
    const c = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h };
    city.colliders.push(c);
    for (let gx = Math.floor(c.x0 / GRID); gx <= Math.floor(c.x1 / GRID); gx += 1) {
      for (let gz = Math.floor(c.z0 / GRID); gz <= Math.floor(c.z1 / GRID); gz += 1) {
        const k = gx * 4096 + gz;
        if (!city.grid.has(k)) city.grid.set(k, []);
        city.grid.get(k).push(c);
      }
    }
  };
  const palm = (x, z, s = 1) => {
    palms.push([x, 0, z, rng.range(0, 6.28), s * rng.range(0.85, 1.25)]);
    solid(x, z, 0.8, 0.8, 8);
  };
  const sign = (text, color, x, y, z, ry, w = 16, h = 4) => {
    const mat = new THREE.MeshBasicMaterial({ map: TX.neonSign(text, color), transparent: true, toneMapped: false });
    const geo = new THREE.PlaneGeometry(w, h);
    for (const back of [0, Math.PI]) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + Math.sin(ry + back) * 0.03, y, z + Math.cos(ry + back) * 0.03);
      mesh.rotation.y = ry + back;
      root.add(mesh);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: city.glow, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(w * 1.5, h * 2.6, 1);
    halo.position.set(x, y, z);
    root.add(halo);
    city.neon.push({ mat, halo, phase: rng.range(0, 6) });
  };
  city.glow = TX.glowTexture();

  // ---- roads ----
  const roadPos = [];
  const roadUV = [];
  const crossPos = [];
  const crossUV = [];
  const quad = (pos, uv, x0, z0, x1, z1, uvf) => {
    const pts = [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]];
    for (const [x, z] of pts) {
      pos.push(x, 0.03, z);
      uv.push(...uvf(x, z));
    }
  };
  const h = ROADS.half;
  for (const a of ROADS.x) {
    let z0 = WORLD.minZ;
    for (const r of [...ROADS.z, Infinity]) {
      const z1 = r === Infinity ? WORLD.maxZ : r - h;
      if (z1 > z0) quad(roadPos, roadUV, a - h, z0, a + h, z1, (x, z) => [(x - (a - h)) / 14, z / 28]);
      z0 = r + h;
    }
  }
  for (const r of ROADS.z) {
    let x0 = WORLD.minX;
    for (const a of ROADS.x) {
      if (a - h > x0) quad(roadPos, roadUV, x0, r - h, a - h, r + h, (x, z) => [(z - (r - h)) / 14, x / 28]);
      x0 = a + h;
    }
    for (const a of ROADS.x) quad(crossPos, crossUV, a - h, r - h, a + h, r + h, (x, z) => [(x - (a - h)) / 14, (z - (r - h)) / 14]);
  }
  const roadMesh = (pos, uv, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  roadMesh(roadPos, roadUV, mats.road);
  roadMesh(crossPos, crossUV, mats.cross);

  // ---- ground, sea, outskirts ----
  const outskirts = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: '#5d6a45', roughness: 1 }));
  outskirts.rotation.x = -Math.PI / 2;
  outskirts.position.set(WORLD.maxX - 1500, -0.06, WORLD.maxZ - 1500);
  outskirts.receiveShadow = true;
  root.add(outskirts);

  const oceanGeo = new THREE.PlaneGeometry(900, 900, 110, 110);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanTex = TX.oceanTexture();
  oceanTex.repeat.set(60, 60);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshPhongMaterial({ color: '#1ab8c8', map: oceanTex, specular: '#ffe2a8', shininess: 90, transparent: true, opacity: 0.94 }));
  ocean.position.set(180, -1, 180);
  ocean.receiveShadow = true;
  root.add(ocean);
  const oceanBase = oceanGeo.attributes.position.array.slice();
  let oceanTick = 0;

  // flat sea out to the horizon, so the animated patch never ends in a visible edge
  const farGeo = new THREE.PlaneGeometry(4200, 4200);
  farGeo.rotateX(-Math.PI / 2);
  const farUv = farGeo.attributes.uv;
  for (let i = 0; i < farUv.count; i += 1) farUv.setXY(i, farUv.getX(i) * (4200 / 900), farUv.getY(i) * (4200 / 900));
  const farSea = new THREE.Mesh(farGeo, new THREE.MeshPhongMaterial({ color: '#1ab8c8', map: oceanTex, specular: '#ffe2a8', shininess: 90 }));
  farSea.position.set(180, -1, 180);
  root.add(farSea);

  // golden sunset glitter path running out to the horizon
  const glitterTex = TX.glitterTexture();
  glitterTex.repeat.set(1, 44);
  const glitterGeo = new THREE.PlaneGeometry(110, 1500).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
  const glitter = new THREE.Mesh(glitterGeo, new THREE.MeshBasicMaterial({ map: glitterTex, color: '#ffb457', transparent: true, opacity: 0.7, depthWrite: false }));
  glitter.position.set(980, -0.1, -30);
  glitter.renderOrder = 2;
  root.add(glitter);

  const slope = new THREE.Mesh(new THREE.PlaneGeometry(18, 540, 1, 1), mats.sand);
  slope.geometry.rotateX(-Math.PI / 2);
  [0, -1.8, 0, -1.8].forEach((y, i) => slope.geometry.attributes.position.setY(i, y));
  slope.position.set(WORLD.maxX + 9, 0, -35);
  slope.receiveShadow = true;
  root.add(slope);
  const foamTex = TX.foamTexture();
  foamTex.repeat.set(1, 4);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(7, 540), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.9, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(WORLD.maxX + 9.8, -0.68, -35);
  foam.renderOrder = 1;
  root.add(foam);
  const quay = new THREE.Mesh(new THREE.BoxGeometry(520, 3.4, 1.2), mats.concrete);
  quay.position.set(-40, -1.7, WORLD.maxZ + 0.6);
  quay.receiveShadow = true;
  root.add(quay);

  // ---- blocks ----
  const cells = [];
  for (let i = 0; i < COLS.length - 1; i += 1) {
    for (let j = 0; j < ROWS.length - 1; j += 1) {
      const x0 = i === 0 ? WORLD.minX : COLS[i] + h;
      const x1 = i === COLS.length - 2 ? WORLD.maxX : COLS[i + 1] - h;
      const z0 = j === 0 ? WORLD.minZ : ROWS[j] + h;
      const z1 = j === ROWS.length - 2 ? WORLD.maxZ : ROWS[j + 1] - h;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      cells.push({ i, j, x0, x1, z0, z1, cx, cz, w: x1 - x0, d: z1 - z0, district: districtAt(cx, cz) });
    }
  }
  for (const c of cells) {
    const key = c.i === 5 ? 'sand' : `walk_${c.district}`;
    const slab = placed(boxGeo(c.w, 0.2, c.d), c.cx, 0, c.cz);
    tileUV(slab, 8, 8);
    add(key, slab);
    if (c.i === 5) box('walk_mirador', 141, 0.2, c.cz, 8, 0.04, c.d, [8, 8]);
  }

  // ---- crown towers ----
  const tower = (cx, cz, w, d, ht, matKey) => {
    box(matKey, cx, 0.2, cz, w, ht, d, [16, 32]);
    box('roof', cx, ht + 0.2, cz, w + 0.8, 0.9, d + 0.8);
    box('metal', cx - w * 0.2, ht + 1.1, cz + d * 0.1, w * 0.3, 2.4, d * 0.3);
    solid(cx, cz, w, d, ht);
    if (ht > 80) {
      box(matKey, cx, ht + 1.1, cz, w * 0.62, 7, d * 0.62, [16, 32]);
      box('metal', cx + w * 0.15, ht + 8, cz, 0.5, 14, 0.5);
    }
    if (ht > 95) {
      const col = rng.pick([NEON.cyan, NEON.magenta, NEON.amber]);
      const text = rng.pick(SIGN_TEXT);
      const y = ht + 5.5;
      sign(text, col, cx, y, cz + d / 2 + 0.6, 0, 16, 4);
      sign(text, col, cx + w / 2 + 0.6, y, cz, Math.PI / 2, 16, 4);
      const trim = col === NEON.cyan ? 'trimCyan' : col === NEON.magenta ? 'trimMagenta' : 'trimAmber';
      box(trim, cx + w / 2 + 0.25, ht * 0.15, cz + d / 2 + 0.25, 0.45, ht * 0.8, 0.45);
      box(trim, cx - w / 2 - 0.25, ht * 0.15, cz + d / 2 + 0.25, 0.45, ht * 0.8, 0.45);
    }
  };
  const midrise = (cx, cz, w, d, ht, k) => {
    box(`deco${k}`, cx, 0.2, cz, w, ht, d, [16, 16]);
    box('roof', cx, ht + 0.2, cz, w + 0.6, 0.7, d + 0.6);
    box(rng.chance(0.5) ? 'trimMagenta' : 'trimCyan', cx, ht - 0.8, cz, w + 0.3, 0.35, d + 0.3);
    solid(cx, cz, w, d, ht);
  };
  const crownCell = (c) => {
    const m = 6;
    const aw = c.w - m * 2;
    const ad = c.d - m * 2;
    const qw = aw / 2;
    const qd = ad / 2;
    for (let qx = 0; qx < 2; qx += 1) {
      for (let qz = 0; qz < 2; qz += 1) {
        const cx = c.x0 + m + qw * (qx + 0.5);
        const cz = c.z0 + m + qd * (qz + 0.5);
        const w = Math.min(qw - 2, rng.range(24, 32));
        const d = Math.min(qd - 2, rng.range(24, 32));
        if (rng.chance(0.62)) tower(cx, cz, w, d, rng.range(72, 150), `glass${rng.int(0, 3)}`);
        else if (rng.chance(0.6)) tower(cx, cz, w, d, rng.range(30, 56), `glass${rng.int(0, 3)}`);
        else midrise(cx, cz, w, d, rng.range(22, 44), rng.int(0, 4));
      }
    }
  };
  const plaza = (c) => {
    const cx = LANDMARKS.crownPlaza.x;
    const cz = LANDMARKS.crownPlaza.z;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 1.2, 28), mats.concrete);
    basin.position.set(cx, 0.8, cz);
    basin.castShadow = true;
    root.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.1, 28), mats.pool);
    water.position.set(cx, 1.4, cz);
    root.add(water);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 6, 8), new THREE.MeshBasicMaterial({ color: '#c9f6ff' }));
    jet.position.set(cx, 4, cz);
    root.add(jet);
    solid(cx, cz, 14, 14, 1.4);
    for (const [dx, dz] of [[-24, -18], [24, -18], [-24, 18], [24, 18], [0, -26], [0, 26]]) palm(cx + dx, cz + dz);
    for (const [dx, dz] of [[-12, 12], [12, 12], [-12, -12], [12, -12]]) box('wall', cx + dx, 0.2, cz + dz, 3.6, 0.7, 1);
    sign('CROWN PLAZA', NEON.magenta, cx, 7.5, c.z1 - 2, Math.PI, 14, 3.4);
    sign('CROWN PLAZA', NEON.cyan, cx, 7.5, c.z0 + 2, 0, 14, 3.4);
    box('metal', cx, 0.2, c.z1 - 2.1, 0.5, 6, 0.5);
  };

  // ---- mirador hotels ----
  const hotel = (cx, cz, w, d, k, extra) => {
    const t1 = rng.range(14, 22);
    const t2 = rng.range(8, 14);
    const t3 = rng.range(6, 10);
    box(`deco${k}`, cx, 0.2, cz, w, t1, d, [16, 16]);
    box(`deco${k}`, cx, t1 + 0.2, cz, w * 0.78, t2, d * 0.78, [16, 16]);
    box(`deco${k}`, cx, t1 + t2 + 0.2, cz, w * 0.5, t3, d * 0.5, [16, 16]);
    box('trimMagenta', cx, t1 + 0.2, cz, w + 0.5, 0.4, d + 0.5);
    box('trimCyan', cx, t1 + t2 + 0.2, cz, w * 0.78 + 0.5, 0.4, d * 0.78 + 0.5);
    box('trimAmber', cx, t1 + t2 + t3 + 0.2, cz, w * 0.5 + 0.5, 0.5, d * 0.5 + 0.5);
    box('pool', cx, t1 + 0.28, cz + d * 0.43, w * 0.55, 0.12, d * 0.1);
    solid(cx, cz, w, d, t1 + t2 + t3);
    const text = rng.pick(['HOTEL SOL', 'MIRAMAR', 'CORAL', 'LAGUNA', 'PALAZZO', 'FLAMINGO']);
    sign(text, rng.pick([NEON.magenta, NEON.cyan, NEON.amber]), cx - w / 2 - 0.6, t1 + t2 * 0.6, cz, -Math.PI / 2, d * 0.5, 3.4);
    if (extra) sign('MIRADOR', NEON.amber, cx, t1 + t2 + t3 + 3, cz + d * 0.26, 0, 12, 3);
  };
  const miradorCell = (c) => {
    if (c.i === 5) {
      const d = c.d - 16;
      hotel(165, c.cz, 34, Math.max(26, Math.min(d, 60)), (c.j + 1) % 5, c.j % 2 === 0);
      for (let z = c.z0 + 6; z < c.z1 - 4; z += 12) palm(141, z, 1);
      const inRamp = (z) => z > -90 && z < -10;
      const clear = (uz) => !inRamp(uz) && !(Math.abs(uz - LANDMARKS.beach.z) < 10);
      for (let n = 0; n < 9; n += 1) {
        const ux = rng.range(190, 203);
        const uz = rng.range(c.z0 + 6, c.z1 - 6);
        if (clear(uz)) city.umbrellas.push([ux, 0.1, uz, rng.range(0, 6.28), rng.range(0.9, 1.15), rng.int(0, 5)]);
      }
      for (let n = 0; n < 2; n += 1) {
        const uz = c.z0 + 12 + n * ((c.d - 24) / 1.5) + rng.range(-3, 3);
        if (clear(uz)) city.cabanas.push([186.5, 0.2, uz, 0, 1, rng.int(0, 3)]);
      }
    } else if (c.j === 2) {
      hotel(c.cx, c.cz, c.w - 18, c.d - 24, 2, true);
      for (let z = c.z0 + 8; z < c.z1 - 4; z += 14) palm(c.x1 - 3, z);
    } else {
      const lot = new THREE.Mesh(new THREE.PlaneGeometry(c.w - 8, c.d - 8), mats.lot);
      lot.rotation.x = -Math.PI / 2;
      lot.position.set(c.cx, 0.22, c.cz);
      lot.receiveShadow = true;
      root.add(lot);
      box('deco1', c.cx, 0.2, c.z0 + 6, c.w - 14, 7, 8, [16, 16]);
      solid(c.cx, c.z0 + 6, c.w - 14, 8, 7);
      sign('BEACH CLUB', NEON.cyan, c.cx, 9, c.z0 + 10.2, 0, 14, 3.4);
    }
  };
  city.umbrellas = [];
  city.cabanas = [];

  // ---- harbor ----
  const containers = [];
  const containerStack = (x, z, n, alongX) => {
    for (let k = 0; k < n; k += 1) containers.push([x, 0.2 + k * 2.65 + 1.3, z, alongX ? 0 : Math.PI / 2, 1, rng.int(0, 7)]);
    solid(x, z, alongX ? 12.2 : 2.6, alongX ? 2.6 : 12.2, n * 2.65);
  };
  const yard = (x0, z0, x1, z1, skipRamp) => {
    for (let z = z0; z < z1; z += 5.6) {
      if (Math.round((z - z0) / 5.6) % 4 === 3) continue;
      for (let x = x0; x < x1; x += 13.2) {
        if (rng.chance(0.28)) continue;
        if (skipRamp && Math.abs(z - skipRamp.z) < 8 && Math.abs(x - skipRamp.x) < 18) continue;
        containerStack(x + 6, z, rng.int(1, 3), true);
      }
    }
  };
  const crane = (x, z) => {
    const legs = [[-9, -8], [9, -8], [-9, 8], [9, 8]];
    for (const [dx, dz] of legs) {
      box('crane', x + dx, 0.2, z + dz, 1.4, 34, 1.4);
      solid(x + dx, z + dz, 1.4, 1.4, 34);
    }
    box('crane', x, 34.2, z - 8, 20, 1.6, 1.6);
    box('crane', x, 34.2, z + 8, 20, 1.6, 1.6);
    box('crane', x, 36.2, z + 2, 2.4, 2.4, 52);
    box('crane', x - 9, 28, z, 1.2, 6, 17);
    box('crane', x + 9, 28, z, 1.2, 6, 17);
    box('metal', x, 30.5, z + 22, 3.4, 3, 3.4);
    box('metal', x, 24, z + 22, 0.25, 6.5, 0.25);
    box('crane', x, 36.2, z - 26, 4, 3.5, 4);
    box('trimAmber', x, 38.8, z + 26, 0.8, 0.8, 0.8);
  };
  const harborCell = (c) => {
    if (c.j === 4 && c.i === 2) {
      for (let k = 0; k < 3; k += 1) {
        const cx = c.x0 + 14 + k * 24;
        box(`ware${k}`, cx, 0.2, c.cz, 20, 11, c.d - 20, [16, 16]);
        box('roof', cx, 11.2, c.cz, 20.8, 0.8, c.d - 19);
        solid(cx, c.cz, 20, c.d - 20, 11);
      }
      sign('CALDERA LOGISTICS', NEON.amber, c.cx, 14, c.z1 - 8, Math.PI, 22, 3.6);
    } else if (c.j === 4 && c.i === 3) {
      yard(c.x0 + 2, c.z0 + 5, c.x1 - 12, c.z1 - 4, null);
    } else if (c.j === 4 && c.i === 4) {
      const x = LANDMARKS.depot.x;
      const z = LANDMARKS.depot.z;
      const fence = (cx, cz, w, d) => {
        box('wall', cx, 0.2, cz, w, 2.2, d);
        solid(cx, cz, w, d, 2.2);
      };
      fence(x, z - 32, 52, 1);
      fence(x, z + 32, 52, 1);
      fence(x + 26, z, 1, 64);
      fence(x - 26, z - 20, 1, 24);
      fence(x - 26, z + 20, 1, 24);
      box('ware0', x + 14, 0.2, z - 18, 18, 8, 12, [16, 16]);
      solid(x + 14, z - 18, 18, 12, 8);
      box('roof', x + 14, 8.2, z - 18, 18.8, 0.7, 12.8);
      sign('SENTRY ARMORED', NEON.lime, x + 14, 11, z - 24.6, Math.PI, 14, 3);
      for (let k = 0; k < 3; k += 1) {
        box('metal', x + 16, 0.5, z + 6 + k * 8, 3.2, 3.4, 7);
        solid(x + 16, z + 6 + k * 8, 3.2, 7, 3.6);
      }
    } else if (c.j === 5) {
      if (c.i === 3) yard(c.x0 + 2, c.z0 + 4, c.x1 - 2, c.z1 - 22, null);
      if (c.i === 4) yard(c.x0 + 2, c.z0 + 4, c.x1 - 2, c.z1 - 22, null);
      if (c.i === 2) {
        for (let k = 0; k < 6; k += 1) containerStack(c.x0 + 8 + k * 13, c.z1 - 6, rng.int(1, 3), true);
      }
      if (c.i === 3) {
        crane(0, 196);
        crane(35, 196);
      }
      if (c.i === 4) crane(100, 196);
    }
  };

  // ---- palma heights ----
  const villa = (cx, cz, w, d, ht, platform, k) => {
    box('lawn', cx, 0.2, cz, w + 6, platform, d + 6, [8, 8]);
    box(`villa${k}`, cx, 0.2 + platform, cz, w, ht, d);
    box('roof', cx, 0.2 + platform + ht, cz, w + 1, 0.6, d + 1);
    box('glassDark', cx, 0.2 + platform + 1.4, cz + d / 2 + 0.05, w * 0.7, 2.4, 0.2);
    box('pool', cx + w * 0.1, 0.26 + platform, cz + d / 2 + 1.9, w * 0.45, 0.1, 2.4);
    solid(cx, cz, w + 6, d + 6, platform + ht);
    palm(cx - w / 2 - 1.5, cz + d / 2 + 2);
    palm(cx + w / 2 + 1.5, cz - d / 2 - 2);
  };
  const palmaCell = (c) => {
    if (c.i === 1 && c.j === 2) {
      const g = LANDMARKS.garageBuilding;
      box('ware2', g.x, 0.2, g.z, 36, 10, 26, [16, 16]);
      box('roof', g.x, 10.2, g.z, 37, 0.8, 27);
      box('glassDark', g.x, 0.5, g.z + 13.05, 30, 7, 0.2);
      for (let k = 0; k < 3; k += 1) box('trimAmber', g.x - 10 + k * 10, 8.6, g.z + 13.3, 7, 0.4, 0.3);
      solid(g.x, g.z, 36, 26, 10);
      sign('CREW GARAGE', NEON.cyan, g.x, 14, g.z + 13.4, 0, 18, 4.2);
      box('trimCyan', LANDMARKS.garage.x, 0.24, LANDMARKS.garage.z, 12, 0.03, 0.4);
    } else if (c.i === 0 && c.j === 2) {
      const s = LANDMARKS.safehouseBuilding;
      box('villa1', s.x, 0.2, s.z, 16, 6, 14);
      box('roof', s.x, 6.2, s.z, 17, 0.6, 15);
      box('glassDark', s.x, 1.2, s.z + 7.05, 6, 2.8, 0.2);
      solid(s.x, s.z, 16, 14, 6);
      sign('SAFEHOUSE', NEON.lime, s.x, 9, s.z + 7.4, 0, 10, 2.6);
      palm(s.x - 14, s.z + 8);
      palm(s.x + 14, s.z + 8);
    } else if (c.i === 1 && c.j === 3) {
      const texts = ['TACOS', 'VINYL', 'TATTOO', 'SUSHI', 'ARCADE', 'NAILS'];
      const cols = [NEON.magenta, NEON.cyan, NEON.amber, NEON.lime, NEON.magenta, NEON.cyan];
      for (let k = 0; k < 6; k += 1) {
        const x = c.x0 + 8 + k * 12.5;
        box(`deco${k % 5}`, x, 0.2, c.z0 + 9, 11.6, 6, 9, [16, 16]);
        box('roof', x, 6.2, c.z0 + 9, 12, 0.5, 9.4);
        solid(x, c.z0 + 9, 11.6, 9, 6);
        sign(texts[k], cols[k], x, 5, c.z0 + 3.9, Math.PI, 8, 2.2);
        box(`deco${(k + 2) % 5}`, x, 0.2, c.z1 - 9, 11.6, 6, 9, [16, 16]);
        box('roof', x, 6.2, c.z1 - 9, 12, 0.5, 9.4);
        solid(x, c.z1 - 9, 11.6, 9, 6);
        sign(texts[(k + 3) % 6], cols[(k + 2) % 6], x, 5, c.z1 - 3.9, 0, 8, 2.2);
      }
    } else {
      const two = c.d > 60;
      villa(c.cx - c.w * 0.18, c.z0 + c.d * 0.28, rng.range(16, 20), rng.range(14, 18), rng.range(5, 8), rng.range(1.5, 3), rng.int(0, 2));
      if (two) villa(c.cx + c.w * 0.18, c.z0 + c.d * 0.74, rng.range(16, 20), rng.range(14, 18), rng.range(5, 8), rng.range(2.5, 5), rng.int(0, 2));
    }
  };

  for (const c of cells) {
    if (c.district === 'crown') {
      if (c.i === 3 && c.j === 2) plaza(c);
      else crownCell(c);
    } else if (c.district === 'mirador') miradorCell(c);
    else if (c.district === 'harbor') harborCell(c);
    else palmaCell(c);
  }

  // ---- elevated highway over street z = -110 ----
  const hz = ROADS.z[1];
  const hx0 = WORLD.minX;
  const hx1 = ROADS.x[4] + h;
  const hl = hx1 - hx0;
  const deckGeo = new THREE.BoxGeometry(hl, 1.2, 22);
  const dec = deckGeo.attributes.uv;
  for (let i = 0; i < dec.count; i += 1) dec.setXY(i, dec.getX(i) * hl / 28, dec.getY(i));
  const deck = new THREE.Mesh(deckGeo, [mats.concrete, mats.concrete, mats.deck, mats.concrete, mats.concrete, mats.concrete]);
  deck.position.set((hx0 + hx1) / 2, 9.6, hz);
  deck.castShadow = true;
  deck.receiveShadow = true;
  root.add(deck);
  box('concrete', (hx0 + hx1) / 2, 10.2, hz - 11, hl, 1.1, 0.6);
  box('concrete', (hx0 + hx1) / 2, 10.2, hz + 11, hl, 1.1, 0.6);
  for (let x = hx0 + 15; x < hx1 - 5; x += 30) {
    if (ROADS.x.some((a) => Math.abs(x - a) < 14)) continue;
    for (const dz of [-11, 11]) {
      box('concrete', x, 0.2, hz + dz, 1.8, 9, 1.8);
      solid(x, hz + dz, 1.8, 1.8, 9);
    }
  }

  // ---- ramps ----
  const rampMat = new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#7a3a00', emissiveIntensity: 0.35, roughness: 0.6 });
  for (const r of RAMPS) {
    const shape = new THREE.Shape();
    shape.moveTo(-r.l / 2, 0);
    shape.lineTo(r.l / 2, 0);
    shape.lineTo(r.l / 2, r.h);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: r.w, bevelEnabled: false });
    g.translate(0, 0, -r.w / 2);
    g.rotateY(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, rampMat);
    mesh.position.set(r.x, 0.2, r.z);
    mesh.rotation.y = r.dir;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // ---- merged batches into meshes ----
  for (const [key, list] of batches) {
    const mesh = new THREE.Mesh(mergeGeos(list), mats[key]);
    mesh.castShadow = !key.startsWith('trim') && key !== 'pool';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
  }

  // ---- instanced props ----
  const trunk = mergeGeos([0, 1, 2, 3].map((k) => placed(new THREE.CylinderGeometry(0.2 - k * 0.025, 0.24 - k * 0.025, 2.2, 6).translate(0, 1.1 + k * 2.1, 0), Math.sin(k * 0.6) * 0.12 * k, 0, 0.1 * k)));
  const leaf = new THREE.BufferGeometry();
  {
    const pos = [];
    const segs = 5;
    for (let s = 0; s < segs; s += 1) {
      const a = s / segs;
      const b = (s + 1) / segs;
      const f = (t) => [Math.sin(t * 2.6) * 0.5 * 4.6, -t * t * 1.7 + t * 1.2, t * 4.6];
      const w = (t) => 0.9 * (1 - t) + 0.05;
      const [ax, ay, az] = f(a);
      const [bx, by, bz] = f(b);
      pos.push(-w(a), ay, az, w(a), ay, az, -w(b), by, bz, w(a), ay, az, w(b), by, bz, -w(b), by, bz);
    }
    leaf.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    leaf.computeVertexNormals();
  }
  const fronds = mergeGeos(Array.from({ length: 9 }, (_, k) => placed(leaf, 0, 8.6, 0, (k / 9) * Math.PI * 2, -0.35).setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(leaf.attributes.position.count * 2), 2))));
  const trunkMesh = instances(trunk, new THREE.MeshStandardMaterial({ color: '#8b6b47', roughness: 1 }), palms);
  const frondMesh = instances(fronds, new THREE.MeshStandardMaterial({ color: '#2f9a4a', roughness: 0.8, side: THREE.DoubleSide }), palms);
  root.add(trunkMesh, frondMesh);

  const canopy = new THREE.ConeGeometry(2.4, 1.2, 10).translate(0, 3.2, 0);
  const umbrellaGeo = mergeGeos([placed(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 5).translate(0, 1.6, 0), 0, 0, 0), canopy]);
  const umbrellas = instances(umbrellaGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), city.umbrellas);
  const beachColors = ['#ff7a8a', '#2fd0d0', '#ffd24a', '#f4f4f4', '#ff9a3a', '#b48cff'];
  city.umbrellas.forEach((u, i) => umbrellas.setColorAt(i, new THREE.Color(beachColors[u[5]])));
  root.add(umbrellas);

  // beach cabanas: timber frame with a bench, and a striped pyramid roof tinted per instance
  const cabanaFrame = mergeGeos([
    ...[[-1.3, -1.0], [-1.3, 1.0], [1.3, -1.0], [1.3, 1.0]].map(([x, z]) => placed(new THREE.BoxGeometry(0.14, 2.4, 0.14).translate(0, 1.2, 0), x, 0, z)),
    placed(new THREE.BoxGeometry(0.1, 1.5, 2.1).translate(0, 0.75, 0), -1.3, 0, 0),
    placed(new THREE.BoxGeometry(1.1, 0.12, 1.9).translate(0, 0.45, 0), -0.6, 0, 0),
    placed(new THREE.BoxGeometry(3, 0.1, 2.5).translate(0, 0.05, 0), 0, 0, 0),
  ]);
  root.add(instances(cabanaFrame, new THREE.MeshStandardMaterial({ color: '#d8b98a', roughness: 0.85 }), city.cabanas));
  const cabanaRoof = instances(new THREE.ConeGeometry(2.45, 0.95, 4).rotateY(Math.PI / 4).translate(0, 2.85, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), city.cabanas);
  city.cabanas.forEach((u, i) => cabanaRoof.setColorAt(i, new THREE.Color(beachColors[u[5]])));
  root.add(cabanaRoof);
  const loungers = [];
  for (const u of city.cabanas) for (const dz of [-3.6, 3.6]) loungers.push([u[0] + 1.6, 0.2, u[2] + dz, Math.PI / 2, 1]);
  root.add(instances(mergeGeos([placed(new THREE.BoxGeometry(0.7, 0.12, 1.9).translate(0, 0.28, 0), 0, 0, 0), placed(new THREE.BoxGeometry(0.7, 0.12, 0.7).translate(0, 0.55, 0), 0, 0, -0.9, 0, 0.7)]), new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.9 }), loungers));

  // boardwalk lamps: slim poles with warm globes and a soft additive halo
  const boardLamps = [];
  for (let z = -264; z < 204; z += 18) if (!ROADS.z.some((r) => Math.abs(z - r) < 9)) boardLamps.push([145.4, 0.2, z, 0, 1]);
  root.add(instances(mergeGeos([new THREE.CylinderGeometry(0.07, 0.1, 3.8, 6).translate(0, 1.9, 0), placed(new THREE.BoxGeometry(0.5, 0.07, 0.07).translate(0, 3.8, 0), -0.2, 0, 0)]), mats.metal, boardLamps));
  const globeRows = boardLamps.map((l) => [l[0] - 0.42, 3.62, l[2], 0, 1]);
  root.add(instances(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe3a6' }), globeRows, false));
  root.add(instances(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb25a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), globeRows, false));

  const cm = new THREE.MeshStandardMaterial({ map: TX.containerTexture(), roughness: 0.55, metalness: 0.2 });
  const cont = instances(new THREE.BoxGeometry(12, 2.6, 2.5), cm, containers.map((c) => c.slice(0, 5)));
  const palette = ['#e5472a', '#2a7bd9', '#f2b632', '#2fa86a', '#8a4fd1', '#eaeaea', '#e86a9a', '#2a8a9a'];
  cont.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(containers.length * 3), 3);
  containers.forEach((c, i) => cont.setColorAt(i, new THREE.Color(palette[c[5]])));
  cont.instanceColor.needsUpdate = true;
  root.add(cont);

  // streetlamps: pole and lit head, one instanced mesh each
  const lampRows = [];
  for (const a of ROADS.x) {
    for (let z = -260; z < 200; z += 36) {
      if (ROADS.z.some((r) => Math.abs(z - r) < 14)) continue;
      const east = Math.floor(z / 36) % 2 !== 0;
      lampRows.push([a + (east ? 8.2 : -8.2), 0.2, z, east ? Math.PI : 0, 1]);
    }
  }
  for (const r of ROADS.z) {
    for (let x = -260; x < 130; x += 36) {
      if (ROADS.x.some((a) => Math.abs(x - a) < 14)) continue;
      const south = Math.floor(x / 36) % 2 !== 0;
      lampRows.push([x, 0.2, r + (south ? 8.2 : -8.2), south ? Math.PI / 2 : -Math.PI / 2, 1]);
    }
  }
  const pole = mergeGeos([new THREE.CylinderGeometry(0.12, 0.16, 8, 6).translate(0, 4, 0), placed(new THREE.BoxGeometry(2.4, 0.15, 0.15), 1.1, 8, 0)]);
  const head = new THREE.BoxGeometry(0.9, 0.2, 0.5).translate(2.2, 7.9, 0);
  root.add(instances(pole, mats.metal, lampRows, true));
  const headMesh = instances(head, new THREE.MeshBasicMaterial({ color: '#ffe2a0' }), lampRows, false);
  root.add(headMesh);

  // hills and distant villas behind Palma Heights
  const hillGeo = new THREE.PlaneGeometry(260, 700, 52, 70);
  hillGeo.rotateX(-Math.PI / 2);
  const hp = hillGeo.attributes.position;
  for (let i = 0; i < hp.count; i += 1) {
    const x = hp.getX(i);
    const z = hp.getZ(i);
    const t = (x + 130) / 260;
    hp.setY(i, Math.pow(Math.max(0, 0.5 - t) * 2, 1.4) * 85 * (0.7 + 0.3 * Math.sin(z * 0.02 + 1) * Math.cos(x * 0.03)) - 0.12);
  }
  hillGeo.computeVertexNormals();
  const hills = new THREE.Mesh(hillGeo, new THREE.MeshStandardMaterial({ map: TX.lawnTexture(), color: '#a8c27a', roughness: 1, flatShading: true }));
  hills.position.set(-285, 0, -30);
  hills.material.map.repeat.set(30, 40);
  hills.receiveShadow = true;
  root.add(hills);

  // ---- queries ----
  city.collidersNear = (x, z, r) => {
    const out = [];
    for (let gx = Math.floor((x - r) / GRID); gx <= Math.floor((x + r) / GRID); gx += 1) {
      for (let gz = Math.floor((z - r) / GRID); gz <= Math.floor((z + r) / GRID); gz += 1) {
        const list = city.grid.get(gx * 4096 + gz);
        if (list) for (const c of list) if (!out.includes(c)) out.push(c);
      }
    }
    return out;
  };
  city.rampHeight = (x, z) => {
    for (const r of RAMPS) {
      const dx = x - r.x;
      const dz = z - r.z;
      const fx = Math.sin(r.dir);
      const fz = Math.cos(r.dir);
      const u = dx * fx + dz * fz + r.l / 2;
      const v = dx * fz - dz * fx;
      if (u >= 0 && u <= r.l && Math.abs(v) <= r.w / 2) return 0.2 + (r.h * u) / r.l;
    }
    return 0.2;
  };
  city.update = (t) => {
    oceanTex.offset.set(t * 0.012, t * 0.008);
    oceanTick += 1;
    if (oceanTick % 2 === 0) {
      const p = oceanGeo.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const x = oceanBase[i * 3] + 180;
        const z = oceanBase[i * 3 + 2] + 180;
        p.setY(i, Math.sin(x * 0.11 + t * 1.4) * 0.28 + Math.sin(z * 0.09 + t * 1.1) * 0.24 + Math.sin((x + z) * 0.05 + t * 0.8) * 0.3);
      }
      p.needsUpdate = true;
      oceanGeo.computeVertexNormals();
    }
    foamTex.offset.set(Math.sin(t * 0.9) * 0.06, t * 0.004);
    foam.material.opacity = 0.78 + Math.sin(t * 1.6) * 0.14;
    glitterTex.offset.y = -t * 0.04;
    glitter.material.opacity = 0.62 + Math.sin(t * 1.3) * 0.1;
    for (const n of city.neon) n.halo.material.opacity = 0.45 + Math.sin(t * 3 + n.phase) * 0.12;
  };
  return city;
}
