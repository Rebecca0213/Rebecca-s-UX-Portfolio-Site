import * as THREE from 'three';

// Vertex-clustering simplification, for the distant levels of detail of a part. Vertices are snapped
// to a grid of `cell` (in the geometry's own units) and, within a cell, to the dominant axis of their
// normal (so the two faces of a thin panel or the sides of a crease stay apart); each cluster becomes
// one vertex with the cluster's averaged position, normal, uv and colour, and triangles that collapse
// are dropped. Linear time and robust on any mesh; meant only for parts seen a few pixels across.
// `cell` is one size, or [x, y, z] sizes for a grid fitted to the part's own extents (a thin slat
// then keeps a cell or two across its thickness instead of collapsing to nothing).
export function clusterGeometry(geometry, cell) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const n = pos.count;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const [cx, cy, cz] = Array.isArray(cell) ? cell : [cell, cell, cell];
  const ix = 1 / cx;
  const iy = 1 / cy;
  const iz = 1 / cz;
  const dx = Math.floor((max.x - min.x) * ix) + 1;
  const dy = Math.floor((max.y - min.y) * iy) + 1;
  const names = Object.keys(geometry.attributes);
  const sizes = names.map((k) => geometry.attributes[k].itemSize);
  const sources = names.map((k) => geometry.attributes[k]);
  const cluster = new Int32Array(n);
  const ids = new Map();
  const sums = names.map(() => []);
  const counts = [];
  for (let i = 0; i < n; i++) {
    const x = Math.floor((pos.getX(i) - min.x) * ix);
    const y = Math.floor((pos.getY(i) - min.y) * iy);
    const z = Math.floor((pos.getZ(i) - min.z) * iz);
    let bin = 0;
    if (nor) {
      const ax = Math.abs(nor.getX(i));
      const ay = Math.abs(nor.getY(i));
      const az = Math.abs(nor.getZ(i));
      bin = ax >= ay && ax >= az ? (nor.getX(i) < 0 ? 1 : 0) : ay >= az ? (nor.getY(i) < 0 ? 3 : 2) : nor.getZ(i) < 0 ? 5 : 4;
    }
    const key = ((z * dy + y) * dx + x) * 6 + bin;
    let c = ids.get(key);
    if (c === undefined) {
      c = counts.length;
      ids.set(key, c);
      counts.push(0);
      for (let a = 0; a < names.length; a++) for (let k = 0; k < sizes[a]; k++) sums[a].push(0);
    }
    cluster[i] = c;
    counts[c]++;
    for (let a = 0; a < names.length; a++) {
      const s = sizes[a];
      const src = sources[a];
      const base = c * s;
      sums[a][base] += src.getX(i);
      if (s > 1) sums[a][base + 1] += src.getY(i);
      if (s > 2) sums[a][base + 2] += src.getZ(i);
      if (s > 3) sums[a][base + 3] += src.getW(i);
    }
  }
  const out = new THREE.BufferGeometry();
  const m = counts.length;
  names.forEach((name, a) => {
    const s = sizes[a];
    const data = new Float32Array(m * s);
    for (let c = 0; c < m; c++) for (let k = 0; k < s; k++) data[c * s + k] = sums[a][c * s + k] / counts[c];
    if (name === 'normal') {
      for (let c = 0; c < m; c++) {
        const x = data[c * 3];
        const y = data[c * 3 + 1];
        const z = data[c * 3 + 2];
        const l = Math.hypot(x, y, z) || 1;
        data[c * 3] = x / l;
        data[c * 3 + 1] = y / l;
        data[c * 3 + 2] = z / l;
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, s, sources[a].normalized));
  });
  const index = geometry.index ? geometry.index.array : null;
  const tris = index ? index.length / 3 : n / 3;
  const kept = [];
  for (let t = 0; t < tris; t++) {
    const a = cluster[index ? index[t * 3] : t * 3];
    const b = cluster[index ? index[t * 3 + 1] : t * 3 + 1];
    const c = cluster[index ? index[t * 3 + 2] : t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    kept.push(a, b, c);
  }
  out.setIndex(kept.length ? kept : [0, 0, 0]);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

export const triangleCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

// Two coarser levels for a part: [medium, far]. Cells are set from the part's own size, so a
// part's levels keep its silhouette at the screen sizes they are used at (see Lod).
//
// `micro`: an instanced micro-part repeated hundreds or thousands of times. Even a 16-triangle leaf
// is worth coarsening when it is drawn a pixel across, so light geometry gets much coarser cells:
// scattered organs (`micro: 'scatter'`: blossoms, leaves) one cell size, hard parts (`micro: 'hard'`:
// shutter slats, balusters) a grid fitted to their own extents, so they coarsen to a hull instead of
// vanishing. A level never collapses to nothing (a crown must not lose its flowers at distance): one
// that keeps fewer than two triangles, or saves under a fifth, is dropped.
export function levelsOf(geometry, { micro = false } = {}) {
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const r = geometry.boundingSphere.radius || 1;
  const tris = triangleCount(geometry);
  if (tris < (micro ? 12 : 160)) return null; // already light
  const light = micro && tris < 160;
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const fitted = (k) => [size.x, size.y, size.z].map((e) => Math.max(e, r * 1e-3) / k);
  const levels = [];
  let last = tris;
  let collapsed = false;
  for (const cells of light ? [3.2, 1.4] : [9, 2.6]) {
    const level = clusterGeometry(geometry, light && micro === 'hard' ? fitted(cells) : r / cells);
    const t = triangleCount(level);
    collapsed ||= t < 2;
    if (t < 2 || t > last * 0.8) continue;
    levels.push(level);
    last = t;
  }
  if (!levels.length) return null;
  // A thin part (a rod, a slat) whose far level vanished: it may be culled a little earlier instead.
  levels.collapsed = collapsed && !micro;
  return levels;
}
