import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { lathe, spline, sphere } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop } from '../../kit/sweep.js';
import { plinth, cornice } from '../../kit/profiles.js';
import { roundedBox } from '../../kit/geometry.js';
import { plantPatch, trailingStrand } from '../../kit/flora.js';

// S3 — Urn planter for the belvederes: a limestone campana urn with a gadrooned body, egg-and-dart
// lip and turned foot on a square pedestal with a moulded base and cap, planted with a mound of
// pink and white geraniums and trailing ivy spilling over the rim.

const PED = 0.11; // pedestal width
const PED_H = 0.15;

export default function build(ctx, { seed = 733 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'UrnPlanter';
  const stone = m.stone('#F1E8DC');

  /* ---------- pedestal ---------- */
  add(root, moldingLoop(plinth(0.02), PED, PED), stone, { name: 'pedestalBase' });
  add(root, roundedBox(PED, PED_H - 0.05, PED, 0.004, 2), stone, { p: [0, 0.02 + (PED_H - 0.05) / 2, 0], name: 'pedestalDie' });
  add(root, moldingLoop(cornice(0.03), PED, PED), stone, { p: [0, PED_H - 0.03, 0], name: 'pedestalCap' });
  add(root, roundedBox(PED + 0.035, 0.012, PED + 0.035, 0.003, 2), stone, { p: [0, PED_H + 0.006, 0], name: 'capSlab' });

  /* ---------- campana urn ---------- */
  const urn = group(root, { p: [0, PED_H + 0.012, 0], name: 'urn' });
  const body = spline([[0, 0], [0.05, 0], [0.052, 0.008], [0.032, 0.02], [0.026, 0.04], [0.04, 0.05], [0.05, 0.06], [0.07, 0.1], [0.085, 0.15], [0.095, 0.17], [0.1, 0.18], [0.096, 0.186], [0.088, 0.186], [0.086, 0.17], [0, 0.17]], 96);
  add(urn, lathe(body, 64), stone, { name: 'urnBody' });
  // Gadroons: convex lobes up the lower bowl.
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    add(urn, sphere(1, 16, 12), stone, { p: [Math.sin(a) * 0.058, 0.082, Math.cos(a) * 0.058], r: [0.42, a, 0, 'YXZ'], s: [0.011, 0.034, 0.008], name: 'gadroon' });
  }
  // Egg-and-dart band under the lip.
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    add(urn, sphere(1, 12, 8), stone, { p: [Math.sin(a) * 0.092, 0.162, Math.cos(a) * 0.092], r: [0, a, 0], s: [0.008, 0.011, 0.005], name: 'egg' });
  }

  /* ---------- planting ---------- */
  plantPatch(ctx, urn, { x0: -0.075, x1: 0.075, z0: -0.075, z1: 0.075, y: 0.17, density: 7000, palette: ['#F49AB2', '#FFFFFF', '#F7B3C6', '#E7708F'], leafColor: '#78AE74', bloomScale: 0.014, leafScale: 0.026, rng, mound: 0.05 });
  for (let s = 0; s < 7; s++) {
    const a = (s / 7) * Math.PI * 2 + rng.range(-0.2, 0.2);
    trailingStrand(ctx, urn, { start: [Math.sin(a) * 0.092, 0.182, Math.cos(a) * 0.092], length: rng.range(0.07, 0.13), drift: [Math.sin(a) * 0.03, 0, Math.cos(a) * 0.03], leaves: 10, leafColor: '#5F9A5C', rng });
  }

  root.userData.footprint = { r: 0.17 };
  return root;
}
