import * as THREE from 'three';

// Scene-graph helpers: every call creates one independent mesh with its own transform.

export function mesh(geometry, material, { p, r, s, cast = true, receive = true, name } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2], r[3] ?? 'XYZ');
  if (s !== undefined) {
    if (Array.isArray(s)) m.scale.set(s[0], s[1], s[2]);
    else m.scale.setScalar(s);
  }
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}

export function add(parent, geometry, material, options) {
  const m = mesh(geometry, material, options);
  parent.add(m);
  return m;
}

export function group(parent, { p, r, s, name } = {}) {
  const g = new THREE.Group();
  if (p) g.position.set(p[0], p[1], p[2]);
  if (r) g.rotation.set(r[0], r[1], r[2], r[3] ?? 'XYZ');
  if (s !== undefined) {
    if (Array.isArray(s)) g.scale.set(s[0], s[1], s[2]);
    else g.scale.setScalar(s);
  }
  if (name) g.name = name;
  if (parent) parent.add(g);
  return g;
}
