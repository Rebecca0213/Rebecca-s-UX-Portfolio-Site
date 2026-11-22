import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// High-tessellation primitives. Nothing is cached or shared: every call models a fresh part.
export const TAU = Math.PI * 2;

const toV2 = (p) => (p.isVector2 ? p : new THREE.Vector2(p[0], p[1]));
const toV3 = (p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]));

export function roundedBox(w, h, d, radius = 0.01, segments = 6) {
  const r = Math.max(0.0004, Math.min(radius, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  return new RoundedBoxGeometry(w, h, d, segments, r);
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export const cylinder = (rTop, rBottom, height, radial = 64, heightSegments = 1, open = false, thetaStart = 0, thetaLength = TAU) =>
  new THREE.CylinderGeometry(rTop, rBottom, height, radial, heightSegments, open, thetaStart, thetaLength);

export const sphere = (r, width = 64, height = 48, phiStart = 0, phiLength = TAU, thetaStart = 0, thetaLength = Math.PI) =>
  new THREE.SphereGeometry(r, width, height, phiStart, phiLength, thetaStart, thetaLength);

export const torus = (radius, tube, radial = 24, tubular = 160, arc = TAU) => new THREE.TorusGeometry(radius, tube, radial, tubular, arc);

export const capsule = (r, length, capSegments = 16, radial = 40) => new THREE.CapsuleGeometry(r, length, capSegments, radial, 1);

export function lathe(points, segments = 128, phiStart = 0, phiLength = TAU) {
  return new THREE.LatheGeometry(points.map(toV2), segments, phiStart, phiLength);
}

// Smooth 2D profile through control points (centripetal Catmull-Rom), clamped to x >= 0 for lathes.
export function spline(points, samples = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  return curve.getSpacedPoints(samples).map((p) => new THREE.Vector2(Math.max(p.x, 0), p.y));
}

// Lathe profile for a cylinder with rounded top and bottom edges (bottom centre -> out -> up -> in -> top centre).
export function roundedCylinderProfile(radius, height, edge, steps = 12) {
  const e = Math.min(edge, radius - 1e-4, height / 2 - 1e-4);
  const pts = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - e + Math.cos(a) * e, e + Math.sin(a) * e));
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - e + Math.cos(a) * e, height - e + Math.sin(a) * e));
  }
  pts.push(new THREE.Vector2(0, height));
  return pts;
}

export const roundedCylinder = (radius, height, edge = 0.01, segments = 96) => lathe(roundedCylinderProfile(radius, height, edge), segments);

export function tube(points, radius, { tubular = 160, radial = 16, closed = false, tension = 'centripetal' } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(toV3), closed, tension);
  return new THREE.TubeGeometry(curve, tubular, radius, radial, closed);
}

/**
 * Tube whose radius varies along its length (limbs, necks, tails, branches). `radii` is [r0, r1]
 * (linear from start to end) or a function of t in [0, 1]. Normals lean with the taper, so a cone
 * of a tube shades like a cone. Ends are open: bury them in what they join, or taper them to 0.
 */
export function taperTube(points, radii, { tubular = 64, radial = 16, tension = 'centripetal' } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(toV3), false, tension);
  const radiusAt = typeof radii === 'function' ? radii : (t) => radii[0] + (radii[1] - radii[0]) * t;
  const length = curve.getLength();
  const frames = curve.computeFrenetFrames(tubular, false);
  const position = [];
  const normal = [];
  const uv = [];
  const index = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, P);
    const r = radiusAt(t);
    const e = 1 / tubular;
    const slope = (radiusAt(Math.min(1, t + e)) - radiusAt(Math.max(0, t - e))) / ((Math.min(1, t + e) - Math.max(0, t - e)) * length);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    const T = frames.tangents[i];
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * TAU;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      N.set(cos * n.x + sin * b.x, cos * n.y + sin * b.y, cos * n.z + sin * b.z).normalize();
      position.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z);
      N.addScaledVector(T, -slope).normalize();
      normal.push(N.x, N.y, N.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const c = a + radial + 1;
      index.push(a, c, a + 1, c, c + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

// Average the normals of coincident vertices (lathe and tube seams, poles), so a sculpted smooth
// surface shades without a visible seam. Positions are untouched. Only for smooth surfaces: it
// would also soften deliberate hard edges built from duplicated vertices.
export function weldNormals(geometry, precision = 1e-6) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) / precision)},${Math.round(pos.getY(i) / precision)},${Math.round(pos.getZ(i) / precision)}`;
    const list = groups.get(key);
    if (list) list.push(i);
    else groups.set(key, [i]);
  }
  const n = new THREE.Vector3();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of list) n.set(n.x + nor.getX(i), n.y + nor.getY(i), n.z + nor.getZ(i));
    n.normalize();
    for (const i of list) nor.setXYZ(i, n.x, n.y, n.z);
  }
  nor.needsUpdate = true;
  return geometry;
}

// Extrude a 2D shape. With a bevel the outline grows by `bevel`, so pass shapes inset accordingly.
export function extrude(shape, depth, { bevel = 0, bevelSegments = 6, curveSegments = 64, center = true } = {}) {
  const inner = Math.max(depth - 2 * bevel, 1e-4);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: inner,
    steps: 1,
    curveSegments,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
  });
  if (center) geometry.translate(0, 0, -inner / 2);
  return geometry;
}

export const shapeGeometry = (shape, curveSegments = 64) => new THREE.ShapeGeometry(shape, curveSegments);

// A plane subdivided finely enough to bend (cloth, awnings, flags).
export const plane = (w, h, sx = 32, sy = 32) => new THREE.PlaneGeometry(w, h, sx, sy);
