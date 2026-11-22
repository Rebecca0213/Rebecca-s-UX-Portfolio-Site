import * as THREE from 'three';

// Profile sweeps for architectural mouldings. A profile is a list of [out, up] points in the
// moulding's own cross-section; frames say where that cross-section sits along a path.

function buildSweep(profile, frames, { closedPath = false } = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const n = profile.length;

  const profileV = [0];
  for (let i = 1; i < n; i++) {
    profileV.push(profileV[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  }

  const p = new THREE.Vector3();
  for (const f of frames) {
    for (let i = 0; i < n; i++) {
      p.copy(f.origin).addScaledVector(f.out, profile[i][0]).addScaledVector(f.up, profile[i][1]);
      positions.push(p.x, p.y, p.z);
      uvs.push(f.u, profileV[i]);
    }
  }

  const rings = frames.length;
  for (let j = 0; j < rings - 1; j++) {
    if (frames[j].break) continue;
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = (j + 1) * n + i;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (closedPath) {
    const j = rings - 1;
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = i;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Flat end caps closing a straight or open sweep (the profile polygon itself).
function capGeometry(profile, frame, flip) {
  const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const cap = new THREE.ShapeGeometry(shape, 1);
  const pos = cap.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.copy(frame.origin).addScaledVector(frame.out, pos.getX(i)).addScaledVector(frame.up, pos.getY(i));
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  if (flip) {
    const index = cap.index.array;
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  }
  cap.computeVertexNormals();
  return cap;
}

// Appends caps into one geometry with the sweep (they are part of the same moulding object).
function withCaps(sweep, caps) {
  const parts = [sweep, ...caps].map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((sum, g) => sum + g.attributes.position.count, 0);
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let offset = 0;
  for (const g of parts) {
    position.set(g.attributes.position.array, offset * 3);
    normal.set(g.attributes.normal.array, offset * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, offset * 2);
    offset += g.attributes.position.count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

const UP = new THREE.Vector3(0, 1, 0);

// Moulding running along +x from 0 to `length`, projecting toward +z, with closed ends.
export function moldingRun(profile, length) {
  const frames = [
    { origin: new THREE.Vector3(0, 0, 0), out: new THREE.Vector3(0, 0, 1), up: UP.clone(), u: 0 },
    { origin: new THREE.Vector3(length, 0, 0), out: new THREE.Vector3(0, 0, 1), up: UP.clone(), u: length },
  ];
  return withCaps(buildSweep(profile, frames), [capGeometry(profile, frames[0], false), capGeometry(profile, frames[1], true)]);
}

// Moulding wrapped around a w x d rectangle (centred, at y = 0) with true mitred corners.
export function moldingLoop(profile, width, depth) {
  const hw = width / 2;
  const hd = depth / 2;
  const corners = [
    [-hw, hd],
    [hw, hd],
    [hw, -hd],
    [-hw, -hd],
  ];
  const frames = [];
  let u = 0;
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side];
    const [bx, bz] = corners[(side + 1) % 4];
    const mitreA = new THREE.Vector3(Math.sign(ax), 0, Math.sign(az));
    const mitreB = new THREE.Vector3(Math.sign(bx), 0, Math.sign(bz));
    const length = Math.hypot(bx - ax, bz - az);
    frames.push({ origin: new THREE.Vector3(ax, 0, az), out: mitreA, up: UP.clone(), u });
    frames.push({ origin: new THREE.Vector3(bx, 0, bz), out: mitreB, up: UP.clone(), u: u + length, break: true });
    u += length;
  }
  return buildSweep(profile, frames);
}

// Moulding following a 2D polyline in the XY (wall) plane: profile x = offset away from the outline
// (to the outline's outside), profile y = projection out of the wall (+z). Sharp corners are mitred
// and split so they shade crisply; gentle curves stay smooth.
export function moldingAlong(points, profile, { closed = false, sharpAngle = 0.5 } = {}) {
  const pts = points.map((p) => new THREE.Vector2(p.x, p.y));
  const count = pts.length;
  const segDir = (i) => {
    const a = pts[i];
    const b = pts[(i + 1) % count];
    return new THREE.Vector2().subVectors(b, a).normalize();
  };
  const frames = [];
  let u = 0;
  const OUT_OF_WALL = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < count; i++) {
    if (i > 0) u += pts[i].distanceTo(pts[i - 1]);
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < count - 1;
    const dPrev = hasPrev ? segDir((i - 1 + count) % count) : segDir(i);
    const dNext = hasNext ? segDir(i) : dPrev;
    // Outline runs counter-clockwise, so the outside is to the right of the direction of travel.
    const nPrev = new THREE.Vector2(dPrev.y, -dPrev.x);
    const nNext = new THREE.Vector2(dNext.y, -dNext.x);
    const turn = Math.acos(THREE.MathUtils.clamp(dPrev.dot(dNext), -1, 1));
    const origin = new THREE.Vector3(pts[i].x, pts[i].y, 0);
    if (turn > sharpAngle && hasPrev && hasNext) {
      const bis = nPrev.clone().add(nNext).normalize();
      const scale = 1 / Math.max(Math.cos(turn / 2), 0.2);
      const out = new THREE.Vector3(bis.x * scale, bis.y * scale, 0);
      frames.push({ origin, out, up: OUT_OF_WALL.clone(), u, break: true });
      frames.push({ origin: origin.clone(), out: out.clone(), up: OUT_OF_WALL.clone(), u });
    } else {
      const bis = nPrev.clone().add(nNext).normalize();
      const scale = 1 / Math.max(Math.cos(turn / 2), 0.2);
      frames.push({ origin, out: new THREE.Vector3(bis.x * scale, bis.y * scale, 0), up: OUT_OF_WALL.clone(), u });
    }
  }
  if (frames[0].break) frames[0].break = false;
  const sweep = buildSweep(profile, frames, { closedPath: closed });
  if (closed) return sweep;
  const first = frames[0];
  const last = frames[frames.length - 1];
  return withCaps(sweep, [capGeometry(profile, first, false), capGeometry(profile, last, true)]);
}

// A closed block following an arc about +y (curved kerbstones, coping stones): the profile is
// swept from angle a0 to a1 at `radius` (angles as THREE.LatheGeometry: 0 = +z, increasing toward +x),
// with flat end faces so neighbouring blocks show real joints.
export function moldingArc(profile, radius, a0, a1, { segments = 24 } = {}) {
  const frames = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + (i / segments) * (a1 - a0);
    const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    frames.push({ origin: out.clone().multiplyScalar(radius), out, up: UP.clone(), u: a * radius });
  }
  return withCaps(buildSweep(profile, frames), [capGeometry(profile, frames[0], false), capGeometry(profile, frames[segments], true)]);
}

// Moulding around a lathe axis: a profile swept a full (or partial) turn about +y at `radius`.
export function moldingRing(profile, radius, { segments = 160, arc = Math.PI * 2 } = {}) {
  const frames = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * arc;
    const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    frames.push({ origin: out.clone().multiplyScalar(radius), out, up: UP.clone(), u: a * radius });
  }
  return buildSweep(profile, frames);
}

// Moulding following a path in plan (points [x, z] at y = 0), projecting outward and rising up the
// profile like moldingLoop, with true mitres at every corner (bay windows, angled returns). The path
// must run counter-clockwise seen from above (outside on the right of travel). Open ends are left
// uncapped: they die into the wall they return to.
export function moldingPlan(profile, pts, { closed = false } = {}) {
  const n = pts.length;
  const dir = (i) => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const normal = (d) => [-d[1], d[0]];
  const segs = closed ? n : n - 1;
  const mitre = (i) => {
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;
    if (!hasPrev) return normal(dir(0));
    if (!hasNext) return normal(dir(n - 2));
    const n1 = normal(dir((i - 1 + n) % n));
    const n2 = normal(dir(i % n));
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return [(n1[0] + n2[0]) / k, (n1[1] + n2[1]) / k];
  };
  const frames = [];
  let u = 0;
  for (let s = 0; s < segs; s++) {
    const a = pts[s];
    const b = pts[(s + 1) % n];
    const ma = mitre(s);
    const mb = mitre((s + 1) % n === 0 && !closed ? n - 1 : (s + 1) % n);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    frames.push({ origin: new THREE.Vector3(a[0], 0, a[1]), out: new THREE.Vector3(ma[0], 0, ma[1]), up: UP.clone(), u });
    frames.push({ origin: new THREE.Vector3(b[0], 0, b[1]), out: new THREE.Vector3(mb[0], 0, mb[1]), up: UP.clone(), u: u + len, break: true });
    u += len;
  }
  return buildSweep(profile, frames);
}
