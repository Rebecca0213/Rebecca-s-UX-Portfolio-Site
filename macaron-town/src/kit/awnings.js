import * as THREE from 'three';
import { add, group } from './place.js';
import { tube, sphere, roundedBox, extrude } from './geometry.js';
import { scallopBand } from './shapes.js';

// Wall frame: x along the wall, y up, z out of the face.

// Canopy section: from the wall head (t = 0) out to the front bar (t = 1), gently convex.
function canopyPoint(t, yTop, depth, drop) {
  return { y: yTop - drop * (0.42 * t + 0.58 * t * t), z: depth * t };
}

function stripeGeometry(xa, xb, arms, { yTop, depth, drop, sag }) {
  const su = 8;
  const sv = 28;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= sv; j++) {
    const t = j / sv;
    const { y, z } = canopyPoint(t, yTop, depth, drop);
    for (let i = 0; i <= su; i++) {
      const x = xa + ((xb - xa) * i) / su;
      let k = 0;
      for (let a = 0; a < arms.length - 1; a++) {
        if (x >= arms[a] && x <= arms[a + 1]) k = Math.sin((Math.PI * (x - arms[a])) / (arms[a + 1] - arms[a]));
      }
      const billow = sag * k * Math.sin(Math.PI * t) * 1.2 + sag * k * t * 0.4;
      positions.push(x, y - billow, z);
      uvs.push(x, t);
    }
  }
  for (let j = 0; j < sv; j++) {
    for (let i = 0; i < su; i++) {
      const a = j * (su + 1) + i;
      const b = a + su + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * Striped canvas awning: each stripe is its own fabric panel, each scallop its own valance piece,
 * hung on an iron frame (wall rail, folding arms, front bar).
 */
// arms: optional x positions (awning frame) for the folding arms, so their wall brackets land on
// piers rather than on doors or glass; they must include both ends.
export function stripedAwning(ctx, parent, { x = 0, y, width, depth, drop, stripes = 9, colors, valance = 0.045, scallopsPerStripe = 1, metal, sag = 0.006, arms: armXs = null }) {
  const m = ctx.materials;
  const g = group(parent, { p: [x, 0, 0], name: 'awning' });
  const armCount = Math.max(2, Math.round(width / 0.45) + 1);
  const arms = armXs ? [...armXs].sort((p, q) => p - q) : [];
  if (!armXs) for (let i = 0; i < armCount; i++) arms.push(-width / 2 + (width * i) / (armCount - 1));
  const sw = width / stripes;
  const front = canopyPoint(1, y, depth, drop);
  for (let s = 0; s < stripes; s++) {
    const xa = -width / 2 + s * sw;
    const xb = xa + sw;
    const material = m.fabric(colors[s % colors.length]);
    add(g, stripeGeometry(xa, xb, arms, { yTop: y, depth, drop, sag }), material);
    const band = scallopBand(sw, valance, scallopsPerStripe, valance * 0.5);
    add(g, extrude(band, 0.004, { bevel: 0.0012, bevelSegments: 2, curveSegments: 20 }), material, { p: [(xa + xb) / 2, front.y - valance - 0.002, front.z + 0.002] });
  }
  add(g, tube([[-width / 2 - 0.01, front.y, front.z], [width / 2 + 0.01, front.y, front.z]], 0.006, { tubular: 8, radial: 12 }), metal);
  for (const end of [-1, 1]) add(g, sphere(0.009, 16, 12), metal, { p: [end * (width / 2 + 0.012), front.y, front.z] });
  add(g, roundedBox(width + 0.03, 0.022, 0.018, 0.005, 3), metal, { p: [0, y + 0.006, 0.009] });
  for (const ax of arms) {
    const elbow = [ax, y - drop * 1.25, depth * 0.45];
    add(g, tube([[ax, y - drop * 2.1, 0.008], elbow, [ax, front.y - 0.004, front.z - 0.004]], 0.0045, { tubular: 48, radial: 8 }), metal);
    add(g, roundedBox(0.03, 0.04, 0.012, 0.004, 2), metal, { p: [ax, y - drop * 2.1, 0.006] });
    add(g, sphere(0.007, 12, 8), metal, { p: elbow });
  }
  return g;
}

/**
 * Parisian dome awning: a quarter-sphere canopy with metal ribs and a scalloped hem.
 */
export function domeAwning(ctx, parent, { x = 0, y, radius, depth = radius * 0.9, color, hemColor, metal, ribs = 7 }) {
  const m = ctx.materials;
  const g = group(parent, { p: [x, y, 0], name: 'domeAwning' });
  const shell = new THREE.SphereGeometry(radius, 72, 36, 0, Math.PI, 0, Math.PI / 2);
  shell.scale(1, 1, depth / radius);
  add(g, shell, m.fabric(color), { p: [0, 0, 0.004] });
  for (let i = 1; i < ribs; i++) {
    const phi = (i / ribs) * Math.PI;
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const theta = (k / 24) * (Math.PI / 2);
      pts.push([-radius * Math.cos(phi) * Math.sin(theta) * 1.01, radius * Math.cos(theta) * 1.01, (depth / radius) * radius * Math.sin(phi) * Math.sin(theta) * 1.01 + 0.004]);
    }
    add(g, tube(pts, 0.0025, { tubular: 48, radial: 6 }), metal);
  }
  const count = Math.round((Math.PI * radius) / 0.03);
  for (let i = 0; i < count; i++) {
    const phi = ((i + 0.5) / count) * Math.PI;
    const px = -radius * Math.cos(phi);
    const pz = depth * Math.sin(phi) + 0.004;
    const scallop = scallopBand(0.03, 0.012, 1, 0.012);
    const piece = add(g, extrude(scallop, 0.003, { bevel: 0.001, bevelSegments: 1, curveSegments: 12 }), m.fabric(hemColor ?? color), { p: [px, -0.012, pz], cast: false });
    piece.rotation.y = Math.PI / 2 - phi;
  }
  return g;
}
