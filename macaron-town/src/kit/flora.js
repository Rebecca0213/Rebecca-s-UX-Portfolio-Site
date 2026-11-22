import * as THREE from 'three';
import { instanced } from './instancing.js';
import { sphere, tube } from './geometry.js';
import { add, group } from './place.js';

// Botanical micro-models. Each generator models one organ with proper UVs for the petal/leaf textures;
// gardens place them individually (as GPU instances) with their own pose, size and tint.

// Cupped, notched petal: u across, v from claw (0) to tip (1). Length along +z, cupping toward +y.
export function petalGeometry({ length = 1, width = 0.62, cup = 0.22, notch = 0.12, curl = 0.1, segU = 10, segV = 14 } = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const outline = Math.sin(Math.PI * Math.min(v * 1.08, 1)) ** 0.8 * (0.35 + 0.65 * v ** 0.5);
    const tipNotch = v > 0.85 ? notch * ((v - 0.85) / 0.15) : 0;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const s = u * 2 - 1;
      const halfWidth = (width / 2) * outline;
      const x = s * halfWidth;
      const notchDip = tipNotch * Math.max(0, 1 - Math.abs(s) * 2.5);
      const z = v * length - notchDip * length;
      const y = cup * length * s * s * (0.3 + 0.7 * v) + curl * length * v * v;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      const b = a + segU + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Lanceolate leaf with a folded midrib and a gentle arch: length along +z. With `transfer` every
// normal is +y (normal transfer onto the mass the leaf sits on).
export function leafGeometry({ length = 1, width = 0.38, fold = 0.18, arch = 0.18, segU = 8, segV = 16, transfer = false } = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const outline = Math.sin(Math.PI * v) ** 0.75 * (1 - 0.25 * v);
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const s = u * 2 - 1;
      const x = s * (width / 2) * outline;
      const y = Math.abs(s) * fold * width * outline + arch * length * Math.sin(Math.PI * v * 0.9) - arch * length * v * v * 0.6;
      positions.push(x, y, v * length);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      const b = a + segU + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  if (transfer) {
    const n = new Float32Array(positions.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  } else g.computeVertexNormals();
  return g;
}

// Tapered, bent grass blade rising along +y.
export function grassBladeGeometry({ height = 1, width = 0.07, bend = 0.25, segments = 6 } = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= segments; j++) {
    const v = j / segments;
    const w = width * (1 - v) ** 0.9 * 0.5;
    const z = bend * height * v * v;
    for (const s of [-1, 1]) {
      positions.push(s * w, v * height, z);
      uvs.push(s < 0 ? 0 : 1, v);
    }
  }
  for (let j = 0; j < segments; j++) {
    const a = j * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// A small five-petal bloom (geranium / forget-me-not scale), petals facing +y. Single organ group.
export function bloomGeometry({ petals = 5, radius = 1, cup = 0.25, segU = 6, segV = 8 } = {}) {
  const parts = [];
  for (let i = 0; i < petals; i++) {
    const g = petalGeometry({ length: radius, width: radius * 0.8, cup, notch: 0.06, curl: -0.05, segU, segV });
    g.rotateX(-0.35);
    g.rotateY((i / petals) * Math.PI * 2);
    parts.push(g);
  }
  return joinGeometry(parts);
}

// One cherry petal as a fan from its claw (the origin) out to its rim across the angle [a0, a1]
// about +y (0 = +z): obovate, widest near the apex, with the notch at the tip that marks a cherry.
// The rim rises with the cup (y = cup * r^2 / radius). uv: u across, v claw -> rim. Vertex colours
// run from `eye` at the claw to `rim`.
function cherryPetalFan(acc, { a0, a1, radius, cup, notch, steps, eye, rim }) {
  const base = acc.position.length / 3;
  const e = new THREE.Color(eye);
  const w = new THREE.Color(rim);
  acc.position.push(0, 0, 0);
  acc.uv.push(0.5, 0);
  acc.color.push(e.r, e.g, e.b);
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * 2 - 1;
    const lobe = 0.5 + 0.5 * Math.cos((s * Math.PI) / 2) ** 0.55;
    const r = radius * (lobe - notch * Math.exp(-((s / 0.18) ** 2)));
    const a = a0 + ((s + 1) / 2) * (a1 - a0);
    acc.position.push(Math.sin(a) * r, (cup * r * r) / radius, Math.cos(a) * r);
    acc.uv.push((s + 1) / 2, r / radius);
    acc.color.push(w.r, w.g, w.b);
  }
  for (let i = 0; i < steps; i++) acc.index.push(base, base + 1 + i, base + 2 + i);
}

function fanGeometry(acc, transfer) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.position, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(acc.color, 3));
  g.setIndex(acc.index);
  if (transfer) {
    const n = new Float32Array(acc.position.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  } else g.computeVertexNormals();
  return g;
}

// Cherry blossom (Prunus serrulata): five broad, notched petals held as a shallow cup facing +y,
// blushing pink at the eye and paling to the rim. With `transfer` every normal is +y, for blossoms
// that take the normal of the crown they frost (blossom material with transfer + vertexColors).
export function cherryFlowerGeometry({ radius = 1, petals = 5, cup = 0.2, notch = 0.15, steps = 6, eye = '#EF97B0', rim = '#FFFFFF', transfer = true } = {}) {
  const acc = { position: [], uv: [], color: [], index: [] };
  const span = (Math.PI * 2) / petals;
  for (let k = 0; k < petals; k++) cherryPetalFan(acc, { a0: (k - 0.5) * span, a1: (k + 0.5) * span, radius, cup, notch, steps, eye, rim });
  return fanGeometry(acc, transfer);
}

// A single fallen cherry petal, claw at the origin, apex along +z, cupped toward +y.
export function cherryPetalGeometry({ length = 1, cup = 0.16, notch = 0.16, steps = 6, eye = '#F9CEDB', rim = '#FFFFFF', transfer = false } = {}) {
  const acc = { position: [], uv: [], color: [], index: [] };
  cherryPetalFan(acc, { a0: -0.62, a1: 0.62, radius: length, cup, notch, steps, eye, rim });
  return fanGeometry(acc, transfer);
}

// Ginkgo leaf: a fan spreading +-`spread` about +z from the top of its stalk (the origin), its
// wavy outer margin cleft at the middle into two lobes; a slender petiole runs back along -z.
// uv: u across the fan, v from the stalk to the margin (veins fan from v = 0, as on the petal
// texture). Vertex colours run from `base` at the stalk to `edge` at the margin. With `transfer`
// every normal is +y (normal transfer onto the crown the leaf sits on).
export function ginkgoLeafGeometry({ radius = 1, spread = 1.05, notch = 0.22, wave = 0.035, waves = 9, steps = 14, cup = 0.1, petiole = 0.55, base = '#D9C15C', edge = '#FFFFFF', transfer = true } = {}) {
  const acc = { position: [], uv: [], color: [], index: [] };
  const b = new THREE.Color(base);
  const e = new THREE.Color(edge);
  acc.position.push(0, 0, 0);
  acc.uv.push(0.5, 0);
  acc.color.push(b.r, b.g, b.b);
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * 2 - 1;
    const a = s * spread;
    const corner = 0.78 + 0.22 * Math.cos((s * Math.PI) / 2) ** 0.5;
    const r = radius * corner * (1 - notch * Math.exp(-((s / 0.09) ** 2))) * (1 + wave * Math.sin(s * waves * Math.PI));
    acc.position.push(Math.sin(a) * r, cup * radius * (r / radius) ** 2, Math.cos(a) * r);
    acc.uv.push((s + 1) / 2, r / radius);
    acc.color.push(e.r, e.g, e.b);
  }
  for (let i = 0; i < steps; i++) acc.index.push(0, 1 + i, 2 + i);
  // Petiole: a narrow strip from the blade's base back along -z.
  const w = radius * 0.035;
  const k = acc.position.length / 3;
  for (const [x, z] of [[-w, 0.02 * radius], [w, 0.02 * radius], [-w * 0.7, -petiole * radius], [w * 0.7, -petiole * radius]]) {
    acc.position.push(x, -0.02 * radius * (z < 0 ? 1 : 0), z);
    acc.uv.push(0.5, 0);
    acc.color.push(b.r * 0.92, b.g * 0.95, b.b * 0.8);
  }
  acc.index.push(k + 2, k, k + 1, k + 2, k + 1, k + 3);
  return fanGeometry(acc, transfer);
}

// Tulip: six tepals in two whorls of three holding a deep cup, the inner whorl standing tighter, the
// tips curving in; a small green ovary closes the base. Opening upward (+y) from the stem top (origin).
export function tulipGeometry({ radius = 1, open = 0.22 } = {}) {
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const inner = k % 2 === 1;
    const len = radius * (inner ? 0.96 : 1);
    const g = petalGeometry({ length: len, width: len * (inner ? 0.62 : 0.7), cup: 0.55, notch: 0.0, curl: 0.12, segU: 6, segV: 8 });
    g.rotateX(-(Math.PI / 2 - (inner ? open * 0.6 : open)));
    g.translate(0, 0, radius * (inner ? 0.05 : 0.08));
    g.rotateY((k * Math.PI) / 3);
    parts.push(g);
  }
  const ovary = new THREE.SphereGeometry(radius * 0.14, 10, 8);
  parts.push(ovary);
  return joinGeometry(parts);
}

// Water-lily pad: a round leaf floating flat (+y up) with the narrow cleft that runs to its stalk,
// its rim turned up a little. uv: u, v across the disc (for the leaf texture's veins).
export function lilyPadGeometry({ radius = 1, cleft = 0.3, rim = 0.04, steps = 40 } = {}) {
  const acc = { position: [], uv: [], color: [], index: [] };
  acc.position.push(0, 0, 0);
  acc.uv.push(0.5, 0.5);
  acc.color.push(1, 1, 1);
  for (let i = 0; i <= steps; i++) {
    const a = cleft / 2 + (i / steps) * (Math.PI * 2 - cleft);
    const r = radius * (0.97 + 0.03 * Math.sin(a * 7));
    acc.position.push(Math.sin(a) * r, rim * radius, Math.cos(a) * r);
    acc.uv.push(0.5 + Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5);
    acc.color.push(1, 1, 1);
  }
  for (let i = 0; i < steps; i++) acc.index.push(0, 1 + i, 2 + i);
  return fanGeometry(acc, false);
}

// Water lily (Nymphaea): three whorls of pointed, cupped petals opening from a tight inner cup to a
// flat outer star round a golden heart (the heart is a separate organ placed by the caller).
export function waterLilyGeometry({ radius = 1, petals = 8 } = {}) {
  const parts = [];
  for (let w = 0; w < 3; w++) {
    const len = radius * (0.62 + w * 0.19);
    for (let i = 0; i < petals; i++) {
      const g = petalGeometry({ length: len, width: len * 0.42, cup: 0.4, notch: 0.0, curl: 0.06 - w * 0.06, segU: 5, segV: 7 });
      g.rotateX(-(1.05 - w * 0.42));
      g.rotateY(((i + (w % 2) * 0.5) / petals) * Math.PI * 2);
      g.translate(0, radius * 0.02 * (2 - w), 0);
      parts.push(g);
    }
  }
  return joinGeometry(parts);
}

// Lawn daisy (Bellis): two whorls of narrow ray florets around a domed disc (the disc is a separate,
// yellow organ placed by the caller). Rays rise slightly so the flower reads as a shallow cup.
export function daisyGeometry({ rays = 18, radius = 1, disc = 0.2 } = {}) {
  const parts = [];
  for (let i = 0; i < rays; i++) {
    const inner = i % 2 === 1;
    const g = petalGeometry({ length: radius * (inner ? 0.86 : 1), width: radius * 0.2, cup: 0.1, notch: 0.1, curl: -0.04, segU: 4, segV: 8 });
    g.translate(0, 0, radius * disc * 0.8);
    g.rotateX(inner ? -0.32 : -0.16);
    g.rotateY((i / rays) * Math.PI * 2 + (inner ? Math.PI / rays : 0));
    if (inner) g.translate(0, radius * 0.012, 0);
    parts.push(g);
  }
  return joinGeometry(parts);
}

// White clover (Trifolium repens): a slender stalk carrying three notched, heart-shaped leaflets
// held almost flat. One plant = one model; patches of them are placed by the caller.
export function cloverGeometry({ leaflet = 1, stalk = 1.4, droop = 0.14 } = {}) {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const g = petalGeometry({ length: leaflet, width: leaflet * 0.92, cup: 0.06, notch: 0.24, curl: -droop, segU: 6, segV: 7 });
    g.rotateX(-0.12);
    g.rotateY((k / 3) * Math.PI * 2 + 0.3);
    g.translate(leaflet * 0.12, stalk, 0);
    parts.push(g);
  }
  const stem = new THREE.CylinderGeometry(leaflet * 0.035, leaflet * 0.05, stalk, 6, 4, true);
  const p = stem.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + stalk / 2;
    const t = y / stalk;
    p.setXYZ(i, p.getX(i) + Math.sin(t * Math.PI * 0.5) * leaflet * 0.12, y, p.getZ(i));
  }
  stem.computeVertexNormals();
  parts.push(stem);
  return joinGeometry(parts);
}

// White clover flower head: a globe of tubular florets on a tiny receptacle. Young florets stand up
// and outward in cream-white; the older lower ring folds down and blushes pink-tan, as in the field.
export function cloverHeadGeometry({ florets = 44, radius = 1 } = {}) {
  const parts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const young = new THREE.Color('#FFFDF5');
  const old = new THREE.Color('#EBC3BE');
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const forward = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < florets; i++) {
    const y = 1 - (i / (florets - 1)) * 1.7; // stop short of the stalk
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * golden;
    const age = THREE.MathUtils.smoothstep(-y, 0.05, 0.55);
    dir.set(Math.cos(a) * ring, y, Math.sin(a) * ring).normalize();
    // Old florets reflex downward.
    dir.y -= age * 0.9;
    dir.normalize();
    const g = petalGeometry({ length: radius * 0.62, width: radius * 0.2, cup: 0.42, notch: 0.0, curl: 0.05, segU: 3, segV: 4 });
    g.translate(0, 0, radius * 0.32);
    g.applyQuaternion(q.setFromUnitVectors(forward, dir));
    const c = young.clone().lerp(old, age);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let k = 0; k < g.attributes.position.count; k++) colors.set([c.r, c.g, c.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(g);
  }
  const core = new THREE.SphereGeometry(radius * 0.36, 10, 8);
  parts.push(core);
  return joinGeometry(parts);
}

// Concatenate the organs of ONE organism into one geometry (a bloom's petals are one model).
// Vertex colours are carried when any organ has them (organs without default to white).
export function joinGeometry(parts) {
  const prepared = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = prepared.reduce((n, g) => n + g.attributes.position.count, 0);
  const withColor = prepared.some((g) => g.attributes.color);
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const color = withColor ? new Float32Array(total * 3).fill(1) : null;
  let offset = 0;
  for (const g of prepared) {
    position.set(g.attributes.position.array, offset * 3);
    normal.set(g.attributes.normal.array, offset * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, offset * 2);
    if (color && g.attributes.color) color.set(g.attributes.color.array, offset * 3);
    offset += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (color) out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return out;
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Plants a patch of flowering foliage over a rectangle (x0..x1, z0..z1) at height y in `parent`.
 * Returns the instanced foliage, blooms and bloom hearts.
 */
export function plantPatch(ctx, parent, { x0, x1, z0, z1, y, density = 900, palette, leafColor = '#7FB27A', bloomScale = 0.018, leafScale = 0.04, rng, mound = 0.015 }) {
  const m = ctx.materials;
  const area = (x1 - x0) * (z1 - z0);
  const leaves = [];
  const blooms = [];
  const hearts = [];
  const leafCount = Math.round(area * density * 1.6);
  const bloomCount = Math.round(area * density);
  const height = (x, z) => {
    const nx = ((x - x0) / (x1 - x0)) * 2 - 1;
    const nz = ((z - z0) / (z1 - z0)) * 2 - 1;
    return y + mound * (1 - Math.min(1, nx * nx * 0.6 + nz * nz * 0.6));
  };
  for (let i = 0; i < leafCount; i++) {
    const x = rng.range(x0, x1);
    const z = rng.range(z0, z1);
    _e.set(rng.range(-0.9, -0.2), rng.range(0, Math.PI * 2), rng.range(-0.3, 0.3));
    leaves.push({ p: [x, height(x, z) - 0.004, z], r: _q.setFromEuler(_e).clone(), s: leafScale * rng.range(0.7, 1.25), color: new THREE.Color(leafColor).offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.06, 0.05)) });
  }
  for (let i = 0; i < bloomCount; i++) {
    const x = rng.range(x0, x1);
    const z = rng.range(z0, z1);
    const lift = rng.range(0.004, 0.02);
    _e.set(rng.range(-0.35, 0.35), rng.range(0, Math.PI * 2), rng.range(-0.35, 0.35));
    const q = _q.setFromEuler(_e).clone();
    const s = bloomScale * rng.range(0.75, 1.3);
    const p = [x, height(x, z) + lift, z];
    blooms.push({ p, r: q, s, color: new THREE.Color(rng.pick(palette)).offsetHSL(0, 0, rng.range(-0.04, 0.03)) });
    const heart = new THREE.Vector3(0, s * 0.18, 0).applyQuaternion(q);
    hearts.push({ p: [p[0] + heart.x, p[1] + heart.y, p[2] + heart.z], s: s * 0.22 });
  }
  const leafMesh = instanced(leafGeometry({ length: 1, width: 0.5 }), m.leaf('#FFFFFF'), leaves, { cast: false });
  const bloomMesh = instanced(bloomGeometry({ radius: 1 }), m.bloom(), blooms, { cast: false });
  const heartMesh = instanced(sphere(1, 12, 8), m.plastic('#F6CF6A'), hearts, { cast: false });
  parent.add(leafMesh, bloomMesh, heartMesh);
  return { leafMesh, bloomMesh, heartMesh };
}

// Trailing strand (ivy, petunia runners) hanging from `start` with leaves along it.
export function trailingStrand(ctx, parent, { start, length, drift = [0, 0, 0.02], leafColor = '#6FA36B', leaves = 14, rng, bloomPalette = null }) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector3(start[0] + drift[0] * t + Math.sin(t * 5 + start[0] * 40) * 0.006, start[1] - length * t, start[2] + drift[2] * Math.sin(t * Math.PI * 0.8)));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const stem = new THREE.Mesh(tube(pts, 0.0022, { tubular: 48, radial: 6 }), ctx.materials.leaf('#5E8F59'));
  stem.castShadow = true;
  parent.add(stem);
  const items = [];
  const flowers = [];
  for (let i = 0; i < leaves; i++) {
    const t = (i + 0.5) / leaves;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3().crossVectors(tangent, _up).normalize();
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    const dir = side.multiplyScalar(i % 2 ? 1 : -1).add(new THREE.Vector3(0, -0.3, 0.4)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rng.range(-0.6, 0.6)));
    items.push({ p: [p.x, p.y, p.z], r: q, s: 0.018 * rng.range(0.75, 1.15) * (1 - t * 0.35), color: new THREE.Color(leafColor).offsetHSL(0, 0, rng.range(-0.05, 0.05)) });
    if (bloomPalette && i % 3 === 1) flowers.push({ p: [p.x, p.y, p.z + 0.006], r: [rng.range(0.6, 1.2), rng.range(0, 6.28), 0], s: 0.012, color: rng.pick(bloomPalette) });
  }
  parent.add(instanced(leafGeometry({ width: 0.7 }), ctx.materials.leaf('#FFFFFF'), items, { cast: false }));
  if (flowers.length) parent.add(instanced(bloomGeometry(), ctx.materials.bloom(), flowers, { cast: false }));
}

// Garden rose: petals in a golden-angle spiral, the inner ones standing tight and cupped, the outer
// ones opening and curling back. One flower = one model (its petals are its organs).
export function roseGeometry({ petals = 14, radius = 1 } = {}) {
  const parts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < petals; i++) {
    const t = i / (petals - 1);
    const len = radius * (0.42 + 0.58 * t);
    const g = petalGeometry({ length: len, width: len * (0.95 + 0.25 * t), cup: 0.5 - 0.22 * t, notch: 0.03, curl: -0.16 * t * t, segU: 6, segV: 7 });
    g.rotateX(-(1.3 - 0.95 * t));
    g.rotateY(i * golden);
    g.translate(0, radius * 0.06 * (1 - t), 0);
    parts.push(g);
  }
  return joinGeometry(parts);
}

/**
 * Climbing rose trained up a wall (wall frame: x along the wall, y up, z out of the face).
 * `path` is the main cane as [x, y] points; side shoots branch along the wall, carrying leaves
 * and open roses that face outward. Leaves and blooms sway in the wind.
 */
export function climbingRose(ctx, parent, { path, rng, z = 0.012, cane = '#7C6B58', leaf = '#7FB27A', roses = ['#F7B3C6', '#FFFFFF', '#F49AB2', '#FCE1E8'], blooms = 22, leaves = 220, name = 'climbingRose' }) {
  const m = ctx.materials;
  const g = group(parent, { name });
  const caneMat = m.bark(cane);
  const pts = path.map(([x, y]) => [x, y, z]);
  add(g, tube(pts, 0.0045, { tubular: 96, radial: 8 }), caneMat, { name: 'cane' });
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const shoots = [];
  const count = Math.max(4, Math.round(curve.getLength() / 0.07));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const p = curve.getPointAt(t);
    const side = i % 2 ? 1 : -1;
    const len = rng.range(0.05, 0.13);
    const a = side * rng.range(0.6, 1.2);
    const tip = new THREE.Vector3(p.x + Math.sin(a) * len, p.y + Math.cos(a) * len * 0.6, z + rng.range(0.004, 0.02));
    const mid = p.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, rng.range(-0.01, 0.015), 0.006));
    shoots.push([p, mid, tip]);
    add(g, tube([p.toArray(), mid.toArray(), tip.toArray()], 0.0024, { tubular: 16, radial: 6 }), caneMat, { name: 'shoot' });
  }
  const leafItems = [];
  for (let i = 0; i < leaves; i++) {
    const s = rng.pick(shoots);
    const k = rng.range(0.1, 1);
    const p = k < 0.5 ? s[0].clone().lerp(s[1], k * 2) : s[1].clone().lerp(s[2], (k - 0.5) * 2);
    const size = rng.range(0.016, 0.026);
    leafItems.push({
      p: [p.x + rng.range(-0.012, 0.012), p.y + rng.range(-0.012, 0.012), p.z + rng.range(0.002, 0.012)],
      r: [rng.range(-1.4, -0.3), rng.range(0, Math.PI * 2), rng.range(-0.5, 0.5)],
      s: size,
      color: new THREE.Color(leaf).offsetHSL(rng.range(-0.02, 0.02), rng.range(-0.06, 0.06), rng.range(-0.06, 0.05)),
    });
  }
  const wind = { anchor: 0, range: 1, flutter: 0.5, space: 'local' };
  g.add(instanced(leafGeometry({ length: 1, width: 0.55, fold: 0.16, arch: 0.12, segU: 6, segV: 10 }), m.leaf('#FFFFFF', wind), leafItems, { name: 'leaves' }));
  const roseItems = [];
  for (let i = 0; i < blooms; i++) {
    const s = shoots[(i * 7) % shoots.length];
    const p = rng.chance(0.6) ? s[2] : s[1];
    const size = rng.range(0.011, 0.017);
    roseItems.push({
      p: [p.x + rng.range(-0.008, 0.008), p.y + rng.range(-0.006, 0.01), p.z + 0.008],
      r: [Math.PI / 2 - rng.range(0.1, 0.6), rng.range(-0.4, 0.4), rng.range(0, Math.PI * 2), 'XZY'],
      s: size,
      color: new THREE.Color(rng.pick(roses)).offsetHSL(0, rng.range(-0.04, 0.04), rng.range(-0.03, 0.02)),
    });
  }
  g.add(instanced(roseGeometry({ petals: 14, radius: 1 }), m.petal('#FFFFFF', '#FFFFFF', wind), roseItems, { name: 'roses' }));
  return g;
}

// Wisteria raceme: a drooping stalk hung from y = 0 down to y = -length, carrying pea-flower florets
// in a spiral, fully open and pale at the top, tightening to deep-violet buds at the tip. Vertex
// coloured (the instance tint multiplies it); sway it with wind { anchor: 0, range: -length }.
export function racemeGeometry({ florets = 44, length = 1, width = 0.26, droop = 0.1 } = {}) {
  const parts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const top = new THREE.Color('#EEE6FA');
  const mid = new THREE.Color('#BFA5EA');
  const tip = new THREE.Color('#7C58C2');
  const axis = (t) => [droop * length * t * t, -t * length];
  const paint = (g, c) => {
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let k = 0; k < g.attributes.position.count; k++) colors.set([c.r, c.g, c.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  };
  for (let i = 0; i < florets; i++) {
    const t = i / (florets - 1);
    const [ax, ay] = axis(t);
    const r = width * length * 0.3 * (1 - 0.78 * t);
    const a = i * golden;
    const size = length * (0.105 - 0.068 * t);
    const c = t < 0.45 ? top.clone().lerp(mid, t / 0.45) : mid.clone().lerp(tip, (t - 0.45) / 0.55);
    // Pea flower: an upright, reflexed banner petal and a cupped keel beneath it.
    const banner = petalGeometry({ length: size, width: size * 1.05, cup: 0.35, notch: 0.12, curl: -0.18, segU: 5, segV: 5 });
    banner.rotateX(-0.25 - 0.3 * (1 - t));
    banner.rotateY(a);
    banner.translate(ax + Math.sin(a) * r, ay, Math.cos(a) * r);
    parts.push(paint(banner, c));
    const keel = petalGeometry({ length: size * 0.72, width: size * 0.5, cup: 0.9, notch: 0.0, curl: 0.2, segU: 4, segV: 4 });
    keel.rotateX(0.95);
    keel.rotateY(a);
    keel.translate(ax + Math.sin(a) * r * 0.8, ay - size * 0.12, Math.cos(a) * r * 0.8);
    parts.push(paint(keel, c.clone().multiplyScalar(0.92)));
  }
  const pts = Array.from({ length: 9 }, (_, i) => {
    const [x, y] = axis(i / 8);
    return new THREE.Vector3(x, y, 0);
  });
  const stalk = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, length * 0.0065, 5, false);
  const green = new THREE.Color('#8DAA6E');
  const sc = new Float32Array(stalk.attributes.position.count * 3);
  for (let k = 0; k < stalk.attributes.position.count; k++) sc.set([green.r, green.g, green.b], k * 3);
  stalk.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  parts.push(stalk);
  return joinGeometry(parts);
}
