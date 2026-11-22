import * as THREE from 'three';
import { instanced } from './instancing.js';

// Small metal hardware shared by many assets.

/**
 * A straight run of interlocking oval links from `from` to `to` (each link turned a quarter turn
 * from its neighbours, as in a real chain).
 */
export function chain(parent, { from, to, link = 0.011, wire = 0.12, material, name = 'chain' }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const n = Math.max(2, Math.round(len / link));
  const along = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const quarter = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  // Oval ring elongated along local y, sized so neighbours overlap and interlock.
  const geometry = new THREE.TorusGeometry(link * 0.42, link * wire, 6, 18).scale(0.72, 1.3, 1);
  const items = [];
  for (let i = 0; i < n; i++) {
    const p = a.clone().addScaledVector(dir, (len * (i + 0.5)) / n);
    const q = along.clone();
    if (i % 2) q.multiply(quarter);
    items.push({ p: [p.x, p.y, p.z], r: q });
  }
  const mesh = instanced(geometry, material, items, { name });
  parent.add(mesh);
  return mesh;
}
