import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { roundedBox } from './geometry.js';
import { noise3 } from './noise.js';

// Paving micro-models. Every sett, kerb and flag is placed individually (instanced), but each
// instance picks one of several hand-cut variants and gets its own size, tilt, settle and tint.

// Ground levels shared by every surface asset (the lawn turf top is 0).
export const LEVELS = { lawn: 0, paving: 0.016, road: 0.008 };

/**
 * One hand-cut stone sett, top face at y = 0 (so placing it at the paving level is direct).
 * The top is pillowed by wear, edges are rounded and slightly irregular; no two variants match.
 */
export function settGeometry({ w = 0.072, d = 0.064, h = 0.036, radius = 0.008, pillow = 0.0028, rough = 0.0018, seed = 1 } = {}) {
  let g = roundedBox(w, h, d, radius, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-6);
  const p = g.attributes.position;
  // Per-stone character: the split face leans a little, and one top corner may be spalled off.
  const hash = (k) => {
    const s = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const leanU = (hash(1) - 0.5) * 0.04 * h;
  const leanV = (hash(2) - 0.5) * 0.04 * h;
  const chip = hash(3) < 0.4;
  const cu = hash(4) < 0.5 ? -1 : 1;
  const cv = hash(5) < 0.5 ? -1 : 1;
  const chipDepth = (0.05 + 0.06 * hash(6)) * h;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const u = (x / w) * 2;
    const v = (z / d) * 2;
    const top = THREE.MathUtils.smoothstep(y / h + 0.5, 0.45, 1.0);
    // Worn top: a shallow dome over a slightly leaning split face.
    y += top * (pillow * Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v) + leanU * u + leanV * v);
    // A spalled corner: the top arris near one corner is knocked down and back.
    if (chip) {
      const corner = THREE.MathUtils.smoothstep(u * cu + v * cv, 1.6, 1.97);
      y -= chipDepth * corner * top;
      x -= cu * corner * top * radius * 0.35;
      z -= cv * corner * top * radius * 0.35;
    }
    // Hand-cut irregularity: the faces wander, more toward the top edge.
    const n1 = noise3(x * 38 + seed * 7.1, y * 38, z * 38, seed);
    const n2 = noise3(x * 38, y * 38 + seed * 3.3, z * 38 + 9.1, seed + 1);
    x += rough * n1 * (0.6 + 0.4 * top);
    z += rough * n2 * (0.6 + 0.4 * top);
    y += rough * 0.35 * noise3(x * 60, seed, z * 60, seed + 2) * top;
    p.setXYZ(i, x, y - h / 2, z);
  }
  g.computeVertexNormals();
  return g;
}

// Fill a straight row exactly between x0 and x1 with randomly varied, stretched setts.
export function fitRow({ x0, x1, joint, minLength, maxLength, rng }) {
  const span = x1 - x0;
  const lengths = [];
  let total = 0;
  while (total < span - maxLength * 0.5) {
    const L = rng.range(minLength, maxLength);
    lengths.push(L);
    total += L + joint;
  }
  if (!lengths.length) return [];
  const stretch = (span - (lengths.length - 1) * joint) / lengths.reduce((a, b) => a + b, 0);
  const out = [];
  let x = x0;
  for (const L0 of lengths) {
    const L = L0 * stretch;
    out.push({ x: x + L / 2, length: L });
    x += L + joint;
  }
  return out;
}

// Fill an arc of a course exactly (between two angles) with randomly varied, stretched setts —
// how pavers close a course against a kerb end.
export function fitCourse({ r, a0, a1, joint, minLength, maxLength, rng }) {
  const span = (a1 - a0) * r;
  const lengths = [];
  let total = 0;
  while (total < span - maxLength * 0.5) {
    const L = rng.range(minLength, maxLength);
    lengths.push(L);
    total += L + joint;
  }
  const stretch = (span - (lengths.length - 1) * joint) / lengths.reduce((a, b) => a + b, 0);
  const out = [];
  let a = a0;
  for (const L0 of lengths) {
    const L = L0 * stretch;
    const mid = a + L / 2 / r;
    out.push({ x: Math.sin(mid) * r, z: Math.cos(mid) * r, r, angle: mid, length: L });
    a += (L + joint) / r;
  }
  return out;
}

/**
 * Concentric courses of setts between two radii. Each course is filled with randomly varied
 * sett lengths, then evenly stretched so the course closes; consecutive courses are staggered.
 * Returns [{ x, z, r, angle, length, depth, ring }] with angle in LatheGeometry convention.
 */
export function ringCourses({ inner, outer, pitch, joint = 0.008, minLength = 0.06, maxLength = 0.086, rng, accept = () => true }) {
  const out = [];
  const rings = Math.floor((outer - inner) / pitch);
  for (let k = 0; k < rings; k++) {
    const r = inner + (k + 0.5) * pitch;
    const circumference = Math.PI * 2 * r;
    const lengths = [];
    let total = 0;
    while (total < circumference - maxLength * 0.5) {
      const L = rng.range(minLength, maxLength);
      lengths.push(L);
      total += L + joint;
    }
    const stretch = (circumference - lengths.length * joint) / lengths.reduce((a, b) => a + b, 0);
    let a = rng.range(0, Math.PI * 2);
    for (const L0 of lengths) {
      const L = L0 * stretch;
      const mid = a + (L / 2) / r;
      if (accept(r, mid, L)) out.push({ x: Math.sin(mid) * r, z: Math.cos(mid) * r, r, angle: mid, length: L, depth: pitch - joint, ring: k });
      a += (L + joint) / r;
    }
  }
  return out;
}
