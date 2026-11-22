import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm3 } from './noise.js';

// The sculpted surface point of a puff along unit direction v (relative to the puff's centre):
// noise-driven cauliflower lobes, optionally flattened underneath. Shared by puffGeometry and by
// anything that must sit exactly on a puff (blossoms on a tree crown).
export function puffPoint(v, { radius = 1, lumps = 0.16, frequency = 1.7, seed = 1, flatten = 0.35, squash = 1 } = {}, out = new THREE.Vector3()) {
  const big = fbm3(v.x * frequency + seed * 3.1, v.y * frequency + seed * 1.7, v.z * frequency + seed * 2.3, 4, seed);
  const small = fbm3(v.x * frequency * 4 + seed, v.y * frequency * 4, v.z * frequency * 4, 3, seed + 9);
  const r = radius * (1 + lumps * (Math.max(big, -0.2) * 1.2) + lumps * 0.25 * small);
  let y = v.y * r * squash;
  if (flatten > 0 && v.y < 0) y *= 1 - flatten * Math.min(1, -v.y * 1.4);
  return out.set(v.x * r, y, v.z * r);
}

// One cumulus puff: a finely tessellated sphere sculpted by noise into cauliflower lobes,
// optionally flattened underneath. Each call sculpts a unique puff from its seed.
export function puffGeometry({ radius = 1, detail = 12, lumps = 0.16, frequency = 1.7, seed = 1, flatten = 0.35, squash = 1 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const p = new THREE.Vector3();
  const spec = { radius, lumps, frequency, seed, flatten, squash };
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    puffPoint(v, spec, p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}
