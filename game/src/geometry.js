// Small geometry helpers: merge many placed parts into one draw call, tile UVs by world size.
import * as THREE from 'three';

const matrix = new THREE.Matrix4();
const quat = new THREE.Quaternion();
const euler = new THREE.Euler();
const one = new THREE.Vector3(1, 1, 1);

/** Box whose base sits on y = 0. */
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

/** Copy of geo moved to (x, y, z), turned ry about Y (then rx, rz). */
export function placed(geo, x, y, z, ry = 0, rx = 0, rz = 0) {
  const g = geo.clone();
  euler.set(rx, ry, rz, 'YXZ');
  quat.setFromEuler(euler);
  matrix.compose(new THREE.Vector3(x, y, z), quat, one);
  g.applyMatrix4(matrix);
  return g;
}

/** Concatenate geometries (position, normal, uv, optional color) into one non-indexed geometry. */
export function mergeGeos(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const col = parts.some((g) => g.attributes.color) ? new Float32Array(count * 3).fill(1) : null;
  let at = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, at * 3);
    nor.set(g.attributes.normal.array, at * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, at * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, at * 3);
    at += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Paint every vertex of geo in one colour (for merged multi-colour meshes). */
export function tint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/** World-space UVs for axis-aligned boxes: one texture repeat per tu x tv metres. */
export function tileUV(geo, tu, tv = tu) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x / tu, z / tu);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z / tu, y / tv);
    else uv.setXY(i, x / tu, y / tv);
  }
  uv.needsUpdate = true;
  return geo;
}

/** One InstancedMesh from a list of [x, y, z, ry, scale] rows. */
export function instances(geo, mat, rows, shadow = true) {
  const mesh = new THREE.InstancedMesh(geo, mat, rows.length);
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  rows.forEach((r, i) => {
    quat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r[3] || 0);
    const k = r[4] === undefined ? 1 : r[4];
    s.set(k, k, k);
    p.set(r[0], r[1], r[2]);
    matrix.compose(p, quat, s);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
