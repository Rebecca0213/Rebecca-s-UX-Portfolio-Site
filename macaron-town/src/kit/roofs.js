import * as THREE from 'three';
import { add, group } from './place.js';
import { roundedBox, cylinder, lathe, spline, tube, sphere } from './geometry.js';
import { instanced } from './instancing.js';

// Remap an extruded tile's UVs to 0..1 over its outline so the UV-mapped slate texture fits each tile.
function normalizeUVs(geometry) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - b.min.x) / (b.max.x - b.min.x), (pos.getY(i) - b.min.y) / (b.max.y - b.min.y));
  }
  uv.needsUpdate = true;
  return geometry;
}

// One slate: nailed edge at the top (y = h), exposed edge at y = 0; face toward +z.
// kind 'scale' = rounded fish-scale tail, 'square' = straight cut, 'diamond' = clipped corners.
// light: an unbevelled, coarser slate (~30 triangles instead of ~370) for roofs seen from afar.
export function slateGeometry(w, h, thickness, kind = 'scale', { light = false } = {}) {
  const s = new THREE.Shape();
  const hw = w / 2;
  if (kind === 'scale') {
    s.moveTo(-hw, h);
    s.lineTo(-hw, hw);
    s.absarc(0, hw, hw, Math.PI, Math.PI * 2, false);
    s.lineTo(hw, h);
  } else if (kind === 'diamond') {
    s.moveTo(-hw, h);
    s.lineTo(-hw, hw * 0.9);
    s.lineTo(0, 0);
    s.lineTo(hw, hw * 0.9);
    s.lineTo(hw, h);
  } else {
    s.moveTo(-hw, h);
    s.lineTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, h);
  }
  s.closePath();
  const g = light
    ? new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 5 })
    : new THREE.ExtrudeGeometry(s, { depth: thickness * 0.6, bevelEnabled: true, bevelThickness: thickness * 0.2, bevelSize: thickness * 0.35, bevelSegments: 2, curveSegments: 14 });
  return normalizeUVs(g);
}

// Clay barrel tile: an arched band tapering along its length (y), convex toward +z.
export function barrelTileGeometry(length, width, thickness, taper = 0.82) {
  const r = width / 2;
  const s = new THREE.Shape();
  s.moveTo(r, 0);
  s.absarc(0, 0, r, 0, Math.PI, false);
  s.lineTo(-(r - thickness), 0);
  s.absarc(0, 0, r - thickness, Math.PI, 0, true);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: true, bevelThickness: thickness * 0.3, bevelSize: thickness * 0.25, bevelSegments: 2, curveSegments: 20 });
  // Extrusion runs along z: turn it so the tile runs along +y with its crown toward +z.
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / length, 0, 1);
    const k = 1 + (taper - 1) * t;
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return normalizeUVs(g);
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _jitter = new THREE.Quaternion();
const _axisZ = new THREE.Vector3(0, 0, 1);

// Each tile rests its tail on the course below and its head on the deck, so it leans with the head
// tucked in (the up-slope axis tilts toward the roof). That keeps every course's tail on top of the
// head of the course beneath it, as on a real roof.
function tileItem(origin, u, v, n, x, y, lift, kick, spin, rng, color) {
  const cv = Math.cos(kick);
  const sv = Math.sin(kick);
  const vk = v.clone().multiplyScalar(cv).addScaledVector(n, -sv);
  const nk = n.clone().multiplyScalar(cv).addScaledVector(v, sv);
  _m.makeBasis(u, vk, nk);
  _q.setFromRotationMatrix(_m);
  _jitter.setFromAxisAngle(_axisZ, spin);
  _q.multiply(_jitter);
  _p.copy(origin).addScaledVector(u, x).addScaledVector(v, y).addScaledVector(n, lift);
  return { p: [_p.x, _p.y, _p.z], r: _q.clone(), s: 1, color };
}

/**
 * Lay overlapping tiles over a planar face. frame: { origin (eave centre), u (along eave), v (up slope), n (out) }.
 * The face is `width` wide at the eave narrowing to `width * taper` at `length` up the slope.
 */
// exclude(x, y): optional test in face coordinates (x along the eave, y up the slope) that skips
// tiles where something else covers the roof (dormers, chimneys).
export function tilePlane(parent, { origin, u, v, n, width, length, taper = 1, tileW, exposure, geometry, material, rng, colors, stagger = true, kick = 0.06, lift = 0.006, exclude = null }) {
  const items = [];
  const rows = Math.ceil(length / exposure);
  const minCut = tileW * 0.38;
  for (let r = 0; r < rows; r++) {
    const y = r * exposure;
    // On a tapering face (a hip), end slates are cut to the width at the top of their exposed band,
    // so neither their exposed corners nor their covered heads stray past the hip roll.
    const half = (width * (1 + (taper - 1) * Math.min((y + exposure) / length, 1))) / 2;
    // Courses break joint by half a slate; at the verges (or hips) the end slates are cut to the
    // edge, and a sliver too narrow to nail is replaced by widening its neighbour, as slaters do.
    const spans = [];
    for (let e = -half - (stagger && r % 2 ? tileW / 2 : 0); e < half - 1e-6; e += tileW) {
      spans.push([Math.max(e, -half), Math.min(e + tileW, half)]);
    }
    if (spans.length > 1 && spans[0][1] - spans[0][0] < minCut) spans[1][0] = spans.shift()[0];
    if (spans.length > 1 && spans[spans.length - 1][1] - spans[spans.length - 1][0] < minCut) spans[spans.length - 2][1] = spans.pop()[1];
    for (const [a, b] of spans) {
      const x = (a + b) / 2;
      if (exclude && exclude(x, y)) continue;
      const color = new THREE.Color(rng.pick(colors)).offsetHSL(rng.range(-0.006, 0.006), rng.range(-0.03, 0.03), rng.range(-0.035, 0.035));
      const item = tileItem(origin, u, v, n, x, y, lift + r * 0.00012 + rng.range(0, 0.0015), kick + rng.range(-0.015, 0.015), rng.range(-0.02, 0.02), rng, color);
      item.s = [(b - a) / tileW, 1, 1];
      items.push(item);
    }
  }
  const mesh = instanced(geometry, material, items, { name: 'tiles', tiling: true });
  parent.add(mesh);
  return mesh;
}

/**
 * Lay tiles on a cone (turret roof) of base `radius` and `height`, apex up, base at y = baseY.
 */
export function tileCone(parent, { radius, height, baseY = 0, tileW, exposure, geometry, material, rng, colors, lift = 0.004, kick = 0.07 }) {
  const slant = Math.hypot(radius, height);
  const items = [];
  const rows = Math.ceil((slant * 0.97) / exposure);
  const up = new THREE.Vector3();
  for (let r = 0; r < rows; r++) {
    const s = r * exposure;
    const t = s / slant;
    const ringR = radius * (1 - t);
    const y = baseY + height * t;
    const count = Math.max(4, Math.round((Math.PI * 2 * ringR) / tileW));
    const phase = (r % 2) * (Math.PI / count);
    for (let c = 0; c < count; c++) {
      const a = (c / count) * Math.PI * 2 + phase;
      const radial = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const u = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
      up.copy(radial).multiplyScalar(-radius).add(new THREE.Vector3(0, height, 0)).normalize();
      const n = new THREE.Vector3().crossVectors(u, up).normalize();
      const origin = radial.clone().multiplyScalar(ringR).add(new THREE.Vector3(0, y, 0));
      const color = new THREE.Color(rng.pick(colors)).offsetHSL(0, rng.range(-0.03, 0.03), rng.range(-0.035, 0.035));
      const scale = Math.max(0.35, Math.min(1, (ringR * Math.PI * 2) / count / tileW));
      const item = tileItem(origin, u, up, n, 0, 0, lift + r * 0.0001, kick + rng.range(-0.015, 0.015), rng.range(-0.02, 0.02), rng, color);
      item.s = [scale, 1, 1];
      items.push(item);
    }
  }
  const mesh = instanced(geometry, material, items, { name: 'coneTiles', tiling: true });
  parent.add(mesh);
  return mesh;
}

/**
 * Spanish pan-and-cover barrel tiles over a planar slope: concave pans in columns, convex covers over the joints.
 */
export function barrelPlane(parent, { origin, u, v, n, width, length, tileW, tileL, overlap = 0.3, material, rng, colors }) {
  const pan = barrelTileGeometry(tileL, tileW, tileW * 0.09, 0.86);
  const cover = barrelTileGeometry(tileL, tileW * 0.82, tileW * 0.08, 0.8);
  const exposure = tileL * (1 - overlap);
  const rows = Math.ceil(length / exposure);
  const cols = Math.floor(width / tileW);
  const pans = [];
  const covers = [];
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  for (let r = 0; r < rows; r++) {
    const y = r * exposure;
    for (let c = 0; c < cols; c++) {
      const x = -width / 2 + tileW * (c + 0.5);
      const tint = () => new THREE.Color(rng.pick(colors)).offsetHSL(rng.range(-0.01, 0.01), rng.range(-0.05, 0.05), rng.range(-0.05, 0.04));
      const p = tileItem(origin, u, v, n, x, y, 0.004 + r * 0.0002, 0.05, rng.range(-0.015, 0.015), rng, tint());
      p.r.multiply(flip);
      pans.push(p);
      if (c < cols - 1) covers.push(tileItem(origin, u, v, n, x + tileW / 2, y, 0.016 + r * 0.0002, 0.05, rng.range(-0.02, 0.02), rng, tint()));
    }
  }
  parent.add(instanced(pan, material, pans, { name: 'pans', tiling: true }));
  parent.add(instanced(cover, material, covers, { name: 'covers', tiling: true }));
}

// Run of rounded ridge caps between two points (world-up axis assumed vertical).
export function ridgeCaps(parent, { from, to, radius, material, rng, colors, pieceLength = 0.09 }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const count = Math.max(1, Math.round(len / pieceLength));
  // Half cylinder (x >= 0) turned so its axis runs along x and its crown faces up.
  const geometry = cylinder(radius, radius * 0.92, len / count + 0.004, 20, 1, false, 0, Math.PI);
  geometry.rotateZ(Math.PI / 2);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  const items = [];
  for (let i = 0; i < count; i++) {
    const p = a.clone().addScaledVector(dir, (len * (i + 0.5)) / count);
    items.push({ p: [p.x, p.y, p.z], r: q.clone(), color: new THREE.Color(rng.pick(colors)).offsetHSL(0, 0, rng.range(-0.03, 0.03)) });
  }
  const mesh = instanced(geometry, material, items, { name: 'ridge', tiling: true });
  parent.add(mesh);
  return mesh;
}

// Half-round gutter along an eave from `from` to `to`, open side up, with brackets and end caps.
export function gutter(parent, { from, to, radius = 0.018, material }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const g = group(parent, { name: 'gutter' });
  const dir = b.clone().sub(a).normalize();
  g.position.copy(a);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  // Solid half-annulus section (open side up) extruded along the eave.
  const section = new THREE.Shape();
  section.moveTo(-radius, 0);
  section.absarc(0, 0, radius, Math.PI, Math.PI * 2, false);
  section.lineTo(radius - 0.0025, 0);
  section.absarc(0, 0, radius - 0.0025, 0, -Math.PI, true);
  section.closePath();
  const trough = new THREE.ExtrudeGeometry(section, { depth: len, bevelEnabled: false, curveSegments: 28 });
  trough.rotateY(Math.PI / 2);
  add(g, trough, material);
  add(g, cylinder(radius * 0.18, radius * 0.18, len, 10), material, { p: [len / 2, 0, -radius], r: [0, 0, Math.PI / 2] });
  // End caps: half discs on the lower (y <= 0) side once the cylinder axis is turned onto x.
  for (const end of [0, len]) add(g, cylinder(radius, radius, 0.003, 28, 1, false, Math.PI, Math.PI), material, { p: [end, 0, 0], r: [0, 0, Math.PI / 2] });
  const brackets = Math.max(2, Math.round(len / 0.35));
  for (let i = 0; i <= brackets; i++) {
    add(g, tube([[0, 0.004, radius * 1.15], [0, -radius * 0.9, radius * 0.6], [0, -radius * 1.05, 0], [0, -radius * 0.9, -radius * 0.7], [0, 0.004, -radius * 1.15]].map(([x, y, z]) => [x + (len * i) / brackets, y, z]), 0.0022, { tubular: 24, radial: 6 }), material);
  }
  return g;
}

// Downpipe from a gutter outlet down to the ground, with swan-neck offset, wall clips and a shoe.
export function downpipe(parent, { top, bottom, offset = 0.04, radius = 0.011, material }) {
  const [x, yTop, z] = top;
  const yBot = bottom;
  const pts = [
    [x, yTop, z],
    [x, yTop - 0.03, z],
    [x, yTop - 0.07, z - offset * 0.7],
    [x, yTop - 0.11, z - offset],
    [x, yBot + 0.05, z - offset],
    [x, yBot + 0.02, z - offset + 0.01],
    [x, yBot + 0.008, z - offset + 0.035],
  ];
  add(parent, tube(pts, radius, { tubular: 120, radial: 16, tension: 'catmullrom' }), material);
  const clips = Math.max(2, Math.round((yTop - yBot) / 0.3));
  for (let i = 1; i < clips; i++) {
    const yy = yBot + 0.08 + ((yTop - 0.15 - yBot - 0.08) * i) / clips;
    add(parent, cylinder(radius * 1.3, radius * 1.3, 0.012, 20), material, { p: [x, yy, z - offset] });
  }
}

// Wrought-iron roof cresting: a rail with repeating fleur-de-lis style finials.
export function cresting(parent, { from, to, height = 0.06, material, spacing = 0.06 }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const dir = b.clone().sub(a).normalize();
  const g = group(parent, { name: 'cresting' });
  g.position.copy(a);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  add(g, roundedBox(len, 0.006, 0.006, 0.002, 2), material, { p: [len / 2, 0.004, 0] });
  add(g, roundedBox(len, 0.004, 0.004, 0.0015, 2), material, { p: [len / 2, height * 0.55, 0] });
  const spear = lathe(spline([[0, 0], [0.0025, 0], [0.002, height * 0.7], [0.007, height * 0.78], [0.0015, height], [0, height * 1.02]], 32), 10);
  const items = [];
  for (let s = spacing / 2; s < len; s += spacing) items.push({ p: [s, 0, 0] });
  g.add(instanced(spear, material, items, { name: 'spears' }));
  const curls = [];
  for (let s = spacing; s < len - 1e-4; s += spacing) {
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const ang = t * Math.PI * 1.4;
        pts.push([s + side * (spacing * 0.42) * (1 - Math.cos(ang) * 0.5) * (1 - t * 0.3), 0.006 + height * 0.5 * Math.sin(ang * 0.7), 0]);
      }
      curls.push(pts);
    }
  }
  for (const pts of curls) add(g, tube(pts, 0.0016, { tubular: 28, radial: 5 }), material, { cast: false });
  return g;
}

// Turned finial (ball and spire), e.g. gold on domes and turrets.
export function finial(parent, { y = 0, height = 0.16, radius = 0.025, material }) {
  const profile = spline(
    [
      [0, 0],
      [radius * 1.1, 0],
      [radius * 0.6, height * 0.12],
      [radius * 0.45, height * 0.2],
      [radius * 1.05, height * 0.34],
      [radius * 0.5, height * 0.48],
      [radius * 0.3, height * 0.55],
      [radius * 0.18, height * 0.8],
      [0.002, height],
      [0, height],
    ],
    80
  );
  add(parent, lathe(profile, 48), material, { p: [0, y, 0] });
  add(parent, sphere(radius * 0.42, 32, 24), material, { p: [0, y + height * 0.72, 0] });
}

/**
 * Lay tiles over a surface of revolution about +y (domes, bell roofs, onion domes).
 * profile(t) -> { r, y } runs from the eave (t = 0) to the crown (t = 1). Rows follow the profile's
 * arc length at `exposure` spacing; each row holds as many tiles as fit its circumference, staggered
 * by half a tile, and every tile leans with the local slope of the profile.
 */
// On a curved profile a flat slate's head lifts off the surface (by ~h^2 / 2R), so heads are tucked
// further in than on a plane: kick is the extra dive, sized for domes of ~0.3-0.6 radius.
export function tileRevolution(parent, { profile, tileW, exposure, geometry, material, rng, colors, lift = 0.004, kick = 0.16, minRadius = 0.02, name = 'domeTiles' }) {
  // Arc-length table of the profile.
  const N = 400;
  const pts = [];
  const lens = [0];
  for (let i = 0; i <= N; i++) pts.push(profile(i / N));
  for (let i = 1; i <= N; i++) lens.push(lens[i - 1] + Math.hypot(pts[i].r - pts[i - 1].r, pts[i].y - pts[i - 1].y));
  const total = lens[N];
  const at = (s) => {
    let i = 1;
    while (i < N && lens[i] < s) i++;
    const f = (s - lens[i - 1]) / Math.max(lens[i] - lens[i - 1], 1e-9);
    const a = pts[i - 1];
    const b = pts[i];
    return { r: a.r + (b.r - a.r) * f, y: a.y + (b.y - a.y) * f, dr: b.r - a.r, dy: b.y - a.y };
  };
  const items = [];
  const up = new THREE.Vector3();
  const rows = Math.floor(total / exposure);
  for (let row = 0; row < rows; row++) {
    const p = at(row * exposure);
    if (p.r < minRadius) break;
    const count = Math.max(4, Math.round((Math.PI * 2 * p.r) / tileW));
    const phase = (row % 2) * (Math.PI / count);
    const len = Math.hypot(p.dr, p.dy) || 1;
    const scaleW = Math.min(1.08, (Math.PI * 2 * p.r) / count / tileW);
    for (let c = 0; c < count; c++) {
      const a = (c / count) * Math.PI * 2 + phase;
      const radial = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const u = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
      up.copy(radial).multiplyScalar(p.dr / len).add(new THREE.Vector3(0, p.dy / len, 0)).normalize();
      const n = new THREE.Vector3().crossVectors(u, up).normalize();
      const origin = radial.clone().multiplyScalar(p.r).add(new THREE.Vector3(0, p.y, 0));
      const color = new THREE.Color(rng.pick(colors)).offsetHSL(0, rng.range(-0.03, 0.03), rng.range(-0.035, 0.035));
      const item = tileItem(origin, u, up, n, 0, 0, lift + row * 0.00025, kick + rng.range(-0.012, 0.012), rng.range(-0.02, 0.02), rng, color);
      item.s = [scaleW, 1, 1];
      items.push(item);
    }
  }
  const mesh = instanced(geometry, material, items, { name, tiling: true });
  parent.add(mesh);
  return mesh;
}
