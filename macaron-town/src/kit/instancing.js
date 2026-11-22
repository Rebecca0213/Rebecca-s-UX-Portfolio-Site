import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * GPU-instanced micro-parts (each tile, cobble, petal or leaf is still placed, oriented, sized and
 * tinted individually). items: [{ p: [x,y,z], r?: [x,y,z] | Quaternion, s?: number | [x,y,z], color?: Color|string }]
 * When items carry colours, give the material a white base colour: instance colour multiplies it.
 * `tiling`: the instances tile a surface edge to edge (roof tiles, shingles, setts), so their distant
 * levels of detail must stay fine enough to keep interlocking (see Batcher).
 */
export function instanced(geometry, material, items, { cast = true, receive = true, name, tiling = false } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  items.forEach((item, i) => {
    _p.set(item.p[0], item.p[1], item.p[2]);
    if (item.r?.isQuaternion) _q.copy(item.r);
    else if (item.r) _q.setFromEuler(_e.set(item.r[0], item.r[1], item.r[2], item.r[3] ?? 'XYZ'));
    else _q.identity();
    if (Array.isArray(item.s)) _s.set(item.s[0], item.s[1], item.s[2]);
    else _s.setScalar(item.s ?? 1);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    if (item.color !== undefined) mesh.setColorAt(i, _c.set(item.color));
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.computeBoundingBox();
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (name) mesh.name = name;
  if (tiling) mesh.userData.tiling = true;
  return mesh;
}

// Slight hue/lightness jitter around a base colour, for natural variation between instances.
export function jitterColor(base, rng, { hue = 0.01, sat = 0.04, light = 0.04 } = {}) {
  const c = new THREE.Color(base);
  c.offsetHSL((rng() - 0.5) * hue * 2, (rng() - 0.5) * sat * 2, (rng() - 0.5) * light * 2);
  return c;
}
