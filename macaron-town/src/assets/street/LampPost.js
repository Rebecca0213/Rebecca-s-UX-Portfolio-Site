import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, lathe, spline, tube, roundedBox } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { chain } from '../../kit/hardware.js';
import { plantPatch, trailingStrand } from '../../kit/flora.js';

// S1 — Lamp post: a Victorian cast-iron street lamp. A moulded pedestal on a granite footing, a
// fluted column tapering through gilt collars, a ladder bar with scrolled ends whose ring of eyes
// carries the bunting (at the map's garland height), a scrolled bracket with a hanging basket of
// petunias, and a four-pane lantern with a glowing bulb under a flared pyramid cap and crown finial.

export const GARLAND_Y = 1.34; // bunting attaches here (map GARLANDS height)
const SHAFT_Y0 = 0.3;
const SHAFT_Y1 = 1.4;

// Fluted column: a tapering lathe whose radius is grooved around its circumference.
function flutedShaft(r0, r1, height, flutes = 12) {
  const g = new THREE.CylinderGeometry(r1, r0, height, flutes * 8, 24, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(x, z);
    const groove = 1 - 0.09 * Math.pow(Math.max(0, Math.cos(a * flutes)), 2);
    p.setX(i, x * groove);
    p.setZ(i, z * groove);
  }
  g.computeVertexNormals();
  return g;
}

export default function build(ctx, { seed = 711, basket = true } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'LampPost';

  const iron = m.metal('iron');
  const gold = m.metal('gold');
  const granite = m.granite('#E2D8D0');

  /* ---------- footing, pedestal, shaft ---------- */
  add(root, roundedBox(0.2, 0.03, 0.2, 0.008, 2), granite, { p: [0, 0.015, 0], name: 'footing' });
  const pedestal = spline([[0, 0.03], [0.1, 0.03], [0.1, 0.05], [0.085, 0.065], [0.088, 0.08], [0.07, 0.1], [0.062, 0.16], [0.066, 0.2], [0.058, 0.22], [0.05, 0.25], [0.056, 0.27], [0.045, 0.29], [0.04, SHAFT_Y0], [0, SHAFT_Y0]], 96);
  add(root, lathe(pedestal, 48), iron, { name: 'pedestal' });
  add(root, flutedShaft(0.036, 0.026, SHAFT_Y1 - SHAFT_Y0), iron, { p: [0, (SHAFT_Y0 + SHAFT_Y1) / 2, 0], name: 'shaft' });
  for (const [y, r] of [[SHAFT_Y0 + 0.01, 0.042], [0.82, 0.034], [SHAFT_Y1 - 0.02, 0.032]]) add(root, torus(r, 0.007, 10, 48), gold, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], name: 'collar' });

  /* ---------- ladder bar and bunting ring ---------- */
  const bar = group(root, { p: [0, GARLAND_Y, 0], name: 'ladderBar' });
  add(bar, cylinder(0.008, 0.008, 0.3, 12, 1), iron, { r: [0, 0, Math.PI / 2], name: 'bar' });
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const a = t * Math.PI * 1.6;
      pts.push([sx * (0.15 + Math.sin(a) * 0.022), -Math.cos(a) * 0.022 + 0.022, 0]);
    }
    add(bar, tube(pts, 0.0045, { tubular: 40, radial: 6 }), iron, { name: 'scroll' });
    add(bar, sphere(0.009, 12, 10), gold, { p: [sx * 0.15, 0, 0], name: 'barKnob' });
  }
  add(bar, torus(0.034, 0.006, 8, 40), iron, { r: [Math.PI / 2, 0, 0], name: 'garlandCollar' });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    add(bar, torus(0.009, 0.0025, 8, 20), gold, { p: [Math.sin(a) * 0.043, -0.006, Math.cos(a) * 0.043], r: [0, a, 0], name: 'garlandEye' });
  }

  /* ---------- lantern ---------- */
  const lan = group(root, { p: [0, SHAFT_Y1, 0], name: 'lantern' });
  add(lan, lathe(spline([[0, 0], [0.03, 0], [0.04, 0.012], [0.06, 0.03], [0.07, 0.038], [0, 0.038]], 24), 32), iron, { name: 'cup' });
  const paneH = 0.15;
  const half = 0.058;
  const bulb = m.lanternGlass('#FFE3B0', 1.5);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const pane = group(lan, { p: [Math.sin(a) * half, 0.04 + paneH / 2, Math.cos(a) * half], r: [0, a, 0], name: 'pane' });
    add(pane, roundedBox(half * 2 - 0.008, paneH - 0.006, 0.003, 0.001, 1), bulb, { cast: false, name: 'glass' });
    const c = Math.PI / 4 + a;
    add(lan, roundedBox(0.009, paneH + 0.01, 0.009, 0.002, 1), iron, { p: [Math.sin(c) * half * 1.414, 0.04 + paneH / 2, Math.cos(c) * half * 1.414], name: 'cornerPost' });
  }
  add(lan, sphere(0.02, 20, 14), m.bulb('#FFE9B8', 3), { p: [0, 0.04 + paneH * 0.45, 0], cast: false, name: 'bulb' });
  add(lan, roundedBox(half * 2 + 0.02, 0.014, half * 2 + 0.02, 0.004, 2), iron, { p: [0, 0.04 + paneH + 0.007, 0], name: 'topFrame' });
  // Flared pyramid cap (a four-sided lathe), its eaves kicked up, crowned by a gilt finial.
  const capGeo = lathe(spline([[0.095, 0], [0.08, 0.012], [0.05, 0.05], [0.02, 0.085], [0, 0.095]], 24), 4, Math.PI / 4).toNonIndexed();
  capGeo.computeVertexNormals();
  add(lan, capGeo, iron, { p: [0, 0.04 + paneH + 0.014, 0], name: 'cap' });
  add(lan, sphere(0.014, 16, 12), gold, { p: [0, 0.04 + paneH + 0.115, 0], name: 'finialBall' });
  add(lan, cylinder(0, 0.006, 0.05, 10, 1), gold, { p: [0, 0.04 + paneH + 0.15, 0], name: 'finialSpike' });

  /* ---------- scrolled bracket and hanging basket ---------- */
  if (basket) {
    const arm = group(root, { p: [0, 1.06, 0], name: 'basketBracket' });
    add(arm, tube([[0, 0.05, 0], [0.08, 0.07, 0], [0.18, 0.05, 0], [0.22, 0.02, 0]], 0.006, { tubular: 40, radial: 8 }), iron, { name: 'arm' });
    const curl = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = t * Math.PI * 1.7;
      curl.push([0.03 + Math.cos(a) * 0.035 * (1 - t * 0.5), 0.0 + Math.sin(a) * 0.035 * (1 - t * 0.5), 0]);
    }
    add(arm, tube(curl, 0.004, { tubular: 48, radial: 6 }), iron, { name: 'curl' });
    add(arm, sphere(0.008, 12, 10), gold, { p: [0.22, 0.02, 0], name: 'armKnob' });
    chain(arm, { from: [0.2, 0.02, 0], to: [0.2, -0.1, 0], link: 0.011, material: m.metal('brass'), name: 'basketChain' });
    const b = group(arm, { p: [0.2, -0.15, 0], name: 'basket' });
    add(b, lathe(spline([[0, 0], [0.03, 0.004], [0.046, 0.022], [0.052, 0.045], [0.048, 0.048]], 24), 32), m.wood('#C9A27C'), { name: 'basketBowl' });
    add(b, torus(0.05, 0.004, 8, 40), m.wood('#B48D68'), { p: [0, 0.046, 0], r: [Math.PI / 2, 0, 0], name: 'basketRim' });
    plantPatch(ctx, b, { x0: -0.038, x1: 0.038, z0: -0.038, z1: 0.038, y: 0.048, density: 9000, palette: ['#F49AB2', '#FFFFFF', '#F7B3C6', '#D8B4F0'], leafColor: '#7FB27A', bloomScale: 0.012, leafScale: 0.022, rng, mound: 0.018 });
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2 + 0.3;
      trailingStrand(ctx, b, { start: [Math.cos(a) * 0.044, 0.045, Math.sin(a) * 0.044], length: rng.range(0.05, 0.09), drift: [Math.cos(a) * 0.02, 0, Math.sin(a) * 0.02], leaves: 8, rng, bloomPalette: ['#F49AB2', '#FFFFFF'] });
    }
  }

  root.userData.footprint = { r: 0.12 };
  return root;
}
