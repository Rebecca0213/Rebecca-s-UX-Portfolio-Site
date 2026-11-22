import * as THREE from 'three';

// Exact picking against the town's buildings, cheap enough for every pointer move. A ray is tested
// against each asset's box, then its parts' boxes nearest first, then the triangles of only those
// parts it could still meet nearer than anything found so far. A part's triangles are kept in runs of
// 64 in their own order, each run with its bounds: procedural parts are laid out in strips, so a run is
// compact, and even a part of tens of thousands of triangles costs a few hundred box tests. Runs are
// built the first time a ray reaches a part, once per geometry. Instanced micro-parts (tiles, petals,
// cobbles) are left out: what they cover is modelled beneath them, and leaving them out changes the
// answer at well under one point in a hundred.

const RUN = 64;
const runCache = new WeakMap(); // geometry -> its runs
const _inverse = new THREE.Matrix4();
const _linear = new THREE.Matrix3();
const _box = new THREE.Box3();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

// Distance along a ray (origin o, direction d, any length) to where it enters an axis-aligned box given
// as min/max in `b` from `k`, or Infinity if it misses it or enters beyond `far`.
function slab(ox, oy, oz, dx, dy, dz, b, k, far) {
  let near = 0;
  let t0 = (b[k] - ox) / dx;
  let t1 = (b[k + 3] - ox) / dx;
  if (t0 > t1) [t0, t1] = [t1, t0];
  near = Math.max(near, t0);
  far = Math.min(far, t1);
  t0 = (b[k + 1] - oy) / dy;
  t1 = (b[k + 4] - oy) / dy;
  if (t0 > t1) [t0, t1] = [t1, t0];
  near = Math.max(near, t0);
  far = Math.min(far, t1);
  t0 = (b[k + 2] - oz) / dz;
  t1 = (b[k + 5] - oz) / dz;
  if (t0 > t1) [t0, t1] = [t1, t0];
  near = Math.max(near, t0);
  far = Math.min(far, t1);
  return near <= far ? near : Infinity;
}

const boxArray = (box, out = new Float32Array(6)) => {
  out.set([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]);
  return out;
};

// A geometry's triangles in runs, with each run's bounds (in the geometry's own space).
export function runsOf(geometry) {
  let runs = runCache.get(geometry);
  if (runs) return runs;
  const p = geometry.attributes.position;
  // Positions as a plain xyz array (a copy only if the attribute is interleaved, strided or packed).
  let xyz = p.array;
  if (p.isInterleavedBufferAttribute || p.itemSize !== 3 || p.normalized || xyz.length !== p.count * 3) {
    xyz = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) xyz.set([p.getX(i), p.getY(i), p.getZ(i)], i * 3);
  }
  const index = geometry.index ? geometry.index.array : null;
  const count = Math.floor((index ? index.length : p.count) / 3);
  const n = Math.ceil(count / RUN);
  const bounds = new Float32Array(n * 6);
  for (let r = 0; r < n; r++) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let v = r * RUN * 3, end = Math.min((r + 1) * RUN, count) * 3; v < end; v++) {
      const i = (index ? index[v] : v) * 3;
      const x = xyz[i], y = xyz[i + 1], z = xyz[i + 2];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    bounds.set([x0, y0, z0, x1, y1, z1], r * 6);
  }
  runs = { bounds, n, count, index, xyz };
  runCache.set(geometry, runs);
  return runs;
}

// Nearest triangle of a run a ray meets (both faces count), or Infinity. Möller–Trumbore.
function nearestInRun(runs, r, ox, oy, oz, dx, dy, dz, far) {
  const { index, xyz, count } = runs;
  let best = far;
  for (let t = r * RUN, end = Math.min((r + 1) * RUN, count); t < end; t++) {
    const ia = (index ? index[t * 3] : t * 3) * 3;
    const ib = (index ? index[t * 3 + 1] : t * 3 + 1) * 3;
    const ic = (index ? index[t * 3 + 2] : t * 3 + 2) * 3;
    const ax = xyz[ia], ay = xyz[ia + 1], az = xyz[ia + 2];
    const e1x = xyz[ib] - ax, e1y = xyz[ib + 1] - ay, e1z = xyz[ib + 2] - az;
    const e2x = xyz[ic] - ax, e2y = xyz[ic + 1] - ay, e2z = xyz[ic + 2] - az;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    const sx = ox - ax, sy = oy - ay, sz = oz - az;
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (d > 0 && d < best) best = d;
  }
  return best;
}

export class Picker {
  // items: [{ id, box (world), roots: [objects whose meshes are the item's parts], moving }]. A moving
  // item (an animated asset) has its parts' boxes refreshed whenever a ray reaches it.
  constructor(items) {
    this.items = items.map(({ id, box, roots, moving = false }) => {
      const parts = [];
      for (const root of roots) {
        root.traverse((o) => {
          if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes.position) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          parts.push({ mesh: o, bounds: new Float32Array(6) });
        });
      }
      const item = { id, bounds: boxArray(box), parts, moving };
      this.refresh(item);
      return item;
    });
    // Parts whose runs are still to be built ahead of the first ray (see `prepare`).
    this.unprepared = this.items.flatMap((item) => item.parts.map((part) => part.mesh.geometry));
  }

  // Build runs ahead of need, for up to `budget` ms (so the first hover over a building never waits).
  // Returns true once every part is ready.
  prepare(budget = 2) {
    const end = performance.now() + budget;
    while (this.unprepared.length && performance.now() < end) runsOf(this.unprepared.pop());
    return this.unprepared.length === 0;
  }

  // Each part's world box, from its geometry's box under its current world matrix (only for parts
  // that moved since their box was taken).
  refresh(item) {
    for (const part of item.parts) {
      const e = part.mesh.matrixWorld.elements;
      if (part.seen && part.seen.every((v, i) => v === e[i])) continue;
      (part.seen ??= new Float64Array(16)).set(e);
      boxArray(_box.copy(part.mesh.geometry.boundingBox).applyMatrix4(part.mesh.matrixWorld), part.bounds);
    }
  }

  // The nearest item a ray meets and how far along the ray, or null.
  nearest(ray) {
    const { x: ox, y: oy, z: oz } = ray.origin;
    const { x: dx, y: dy, z: dz } = ray.direction;
    const order = [];
    for (const item of this.items) {
      const t = slab(ox, oy, oz, dx, dy, dz, item.bounds, 0, Infinity);
      if (t < Infinity) order.push([t, item]);
    }
    order.sort((a, b) => a[0] - b[0]);
    let best = Infinity;
    let found = null;
    for (const [t, item] of order) {
      if (t >= best) break;
      const d = this.reach(item, ray, best);
      if (d < best) {
        best = d;
        found = item;
      }
    }
    return found ? { id: found.id, distance: best } : null;
  }

  // How far along the ray it meets one of an item's parts (if nearer than `far`), else Infinity.
  reach(item, ray, far) {
    if (item.moving) this.refresh(item);
    const { x: ox, y: oy, z: oz } = ray.origin;
    const { x: dx, y: dy, z: dz } = ray.direction;
    const order = [];
    for (const part of item.parts) {
      const t = slab(ox, oy, oz, dx, dy, dz, part.bounds, 0, far);
      if (t < Infinity) order.push([t, part]);
    }
    order.sort((a, b) => a[0] - b[0]);
    let best = far;
    for (const [t, part] of order) {
      if (t >= best) break;
      // Into the part's own space: the direction keeps its scale, so distances along it stay world ones.
      _inverse.copy(part.mesh.matrixWorld).invert();
      _o.copy(ray.origin).applyMatrix4(_inverse);
      _d.copy(ray.direction).applyMatrix3(_linear.setFromMatrix4(_inverse));
      const runs = runsOf(part.mesh.geometry);
      for (let r = 0; r < runs.n; r++) {
        if (slab(_o.x, _o.y, _o.z, _d.x, _d.y, _d.z, runs.bounds, r * 6, best) === Infinity) continue;
        best = Math.min(best, nearestInRun(runs, r, _o.x, _o.y, _o.z, _d.x, _d.y, _d.z, best));
      }
    }
    return best;
  }
}
