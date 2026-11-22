import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, tube, capsule, roundedBox, lathe, spline } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { plantPatch } from '../../kit/flora.js';

// S6 — Bicycle: a vintage step-through town bike in mint, parked on its kickstand and leaning on
// it. Spoked wheels with cream tyres and fenders, a swooping down tube, sprung leather saddle,
// swept-back bars with grips and a brass bell, chainring, cranks and pedals behind a chain guard,
// a rear rack, and a wicker basket on the front carrier full of flowers and a baguette.
// Frame: wheels in the yz plane, front toward +z, ground at y = 0.

const WR = 0.125; // wheel radius
const REAR_Z = -0.2;
const FRONT_Z = 0.2;
const BB = [0.118, -0.04]; // bottom bracket (y, z)
const LEAN = 0.11; // radians toward +x, onto the kickstand

const _up = new THREE.Vector3(0, 1, 0);
function rod(a, b, radius) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  return { p: a.clone().addScaledVector(d, 0.5).toArray(), r: new THREE.Quaternion().setFromUnitVectors(_up, d.divideScalar(len)), s: [radius, len, radius] };
}

function wheel(ctx, parent, { z, spokes, tyre, rim }) {
  const m = ctx.materials;
  const g = group(parent, { p: [0, WR, z], r: [0, Math.PI / 2, 0], name: 'wheel' });
  add(g, torus(WR - 0.009, 0.0095, 12, 96), tyre, { name: 'tyre' });
  add(g, torus(WR - 0.021, 0.0045, 8, 96), rim, { name: 'rim' });
  add(g, cylinder(0.012, 0.012, 0.05, 20, 1), rim, { r: [Math.PI / 2, 0, 0], name: 'hub' });
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const side = k % 2 ? 1 : -1;
    const hub = new THREE.Vector3(Math.cos(a + side * 0.12) * 0.012, Math.sin(a + side * 0.12) * 0.012, side * 0.02);
    const tip = new THREE.Vector3(Math.cos(a) * (WR - 0.024), Math.sin(a) * (WR - 0.024), 0);
    spokes.push({ g, item: rod(hub, tip, 0.0012) });
  }
  add(g, cylinder(0.002, 0.002, 0.012, 8, 1), m.metal('brass'), { p: [0, WR - 0.03, 0], name: 'valve' });
  return g;
}

export default function build(ctx, { seed = 766 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Bicycle';

  const paint = m.trim('#8ED0BC');
  const cream = m.trim('#FFF7EE');
  const chrome = m.metal('chrome');
  const brass = m.metal('brass');
  const leather = m.paintedWood('#9A6A48');
  const tyre = m.paintedWood('#F3E8DA');

  // The bike leans onto its kickstand about the line where its tyres touch the ground.
  const bike = group(root, { r: [0, 0, -LEAN], name: 'bike' });

  /* ---------- wheels and fenders ---------- */
  const spokes = [];
  wheel(ctx, bike, { z: REAR_Z, spokes, tyre, rim: chrome });
  wheel(ctx, bike, { z: FRONT_Z, spokes, tyre, rim: chrome });
  const groups = new Map();
  for (const { g, item } of spokes) {
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(item);
  }
  for (const [g, items] of groups) g.add(instanced(cylinder(1, 1, 1, 5, 1), chrome, items, { name: 'spokes' }));
  for (const [z, a0] of [[REAR_Z, -0.4], [FRONT_Z, Math.PI * 0.15]]) {
    add(bike, torus(WR + 0.014, 0.011, 10, 64, Math.PI * 0.95).rotateZ(a0).scale(1, 1, 1.6), cream, { p: [0, WR, z], r: [0, Math.PI / 2, 0], name: 'fender' });
  }

  /* ---------- frame ---------- */
  const P = (y, z, x = 0) => new THREE.Vector3(x, y, z);
  const headTop = P(0.345, 0.15);
  const headBot = P(0.288, 0.172);
  add(bike, tube([headTop, headBot], 0.013, { tubular: 4, radial: 14 }), paint, { name: 'headTube' });
  add(bike, tube([P(0.3, 0.165), P(0.22, 0.11), P(0.15, 0.03), P(BB[0], BB[1])], 0.012, { tubular: 48, radial: 12 }), paint, { name: 'downTube' });
  add(bike, tube([P(0.318, 0.16), P(0.25, 0.085), P(0.2, 0.0), P(0.19, -0.05)], 0.008, { tubular: 40, radial: 10 }), paint, { name: 'mixteTube' });
  add(bike, tube([P(BB[0], BB[1]), P(0.335, -0.098)], 0.0115, { tubular: 4, radial: 12 }), paint, { name: 'seatTube' });
  for (const x of [-0.024, 0.024]) {
    add(bike, tube([P(BB[0], BB[1], x * 0.6), P(WR, REAR_Z, x)], 0.0065, { tubular: 4, radial: 8 }), paint, { name: 'chainStay' });
    add(bike, tube([P(0.312, -0.093, x * 0.4), P(WR, REAR_Z, x)], 0.006, { tubular: 4, radial: 8 }), paint, { name: 'seatStay' });
    add(bike, tube([P(0.29, 0.172, x * 0.5), P(0.22, 0.19, x), P(WR, FRONT_Z, x)], 0.0068, { tubular: 24, radial: 8 }), paint, { name: 'forkBlade' });
  }
  add(bike, cylinder(0.016, 0.016, 0.06, 20, 1), paint, { p: [0, BB[0], BB[1]], r: [0, 0, Math.PI / 2], name: 'bottomBracket' });

  /* ---------- drive train ---------- */
  const drive = group(bike, { p: [0.034, BB[0], BB[1]], r: [0, Math.PI / 2, 0], name: 'chainring' });
  add(drive, torus(0.04, 0.004, 8, 64), chrome, { name: 'ring' });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    add(drive, roundedBox(0.006, 0.04, 0.003, 0.001, 1), chrome, { p: [Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0], r: [0, 0, a - Math.PI / 2], name: 'ringSpider' });
  }
  for (const [x, a] of [[0.04, 0.6], [-0.04, 0.6 + Math.PI]]) {
    const crank = group(bike, { p: [x, BB[0], BB[1]], r: [a, 0, 0], name: 'crank' });
    add(crank, roundedBox(0.008, 0.075, 0.012, 0.003, 2), chrome, { p: [0, 0.037, 0], name: 'arm' });
    add(crank, roundedBox(0.045, 0.01, 0.026, 0.003, 2), m.metal('iron'), { p: [Math.sign(x) * 0.028, 0.075, 0], r: [-a, 0, 0], name: 'pedal' });
  }
  // Chain looping the chainring and a small rear sprocket, under a slim guard over its top run.
  add(bike, torus(0.016, 0.003, 6, 32), chrome, { p: [0.034, WR, REAR_Z], r: [0, Math.PI / 2, 0], name: 'sprocket' });
  const chainLoop = [P(BB[0] + 0.041, BB[1], 0.034), P(WR + 0.017, REAR_Z, 0.034), P(WR, REAR_Z - 0.018, 0.034), P(WR - 0.017, REAR_Z, 0.034), P(BB[0] - 0.041, BB[1], 0.034), P(BB[0], BB[1] + 0.042, 0.034)];
  add(bike, tube(chainLoop, 0.0032, { tubular: 160, radial: 6, closed: true }), m.metal('iron'), { name: 'chain' });
  add(bike, roundedBox(0.006, 0.024, 0.2, 0.004, 2), paint, { p: [0.046, (BB[0] + WR) / 2 + 0.05, (BB[1] + REAR_Z) / 2], r: [-Math.atan2(BB[0] + 0.041 - (WR + 0.017), BB[1] - REAR_Z), 0, 0], name: 'chainGuard' });

  /* ---------- saddle, bars, bell ---------- */
  add(bike, cylinder(0.006, 0.006, 0.05, 12, 1), chrome, { p: [0, 0.355, -0.104], r: [-0.4, 0, 0], name: 'seatPost' });
  const saddle = group(bike, { p: [0, 0.385, -0.112], name: 'saddle' });
  add(saddle, sphere(1, 32, 20), leather, { s: [0.04, 0.016, 0.065], name: 'seat' });
  add(saddle, sphere(1, 20, 14), leather, { p: [0, 0.002, 0.05], s: [0.016, 0.012, 0.03], name: 'nose' });
  for (const x of [-0.024, 0.024]) {
    const coil = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const a = t * Math.PI * 2 * 5;
      coil.push([x + Math.cos(a) * 0.007, -0.03 + t * 0.022, -0.035 + Math.sin(a) * 0.007]);
    }
    add(saddle, tube(coil, 0.0018, { tubular: 120, radial: 5 }), chrome, { name: 'spring' });
  }
  add(bike, cylinder(0.007, 0.007, 0.05, 12, 1), chrome, { p: [0, 0.37, 0.142], r: [0.4, 0, 0], name: 'stem' });
  const bar = [P(0.37, 0.07, -0.13), P(0.385, 0.12, -0.08), P(0.39, 0.15, 0), P(0.385, 0.12, 0.08), P(0.37, 0.07, 0.13)];
  add(bike, tube(bar, 0.0065, { tubular: 64, radial: 10 }), chrome, { name: 'handlebar' });
  for (const sx of [-1, 1]) {
    const end = bar[sx < 0 ? 0 : 4];
    const dir = end.clone().sub(bar[sx < 0 ? 1 : 3]).normalize();
    const grip = add(bike, capsule(0.0095, 0.04, 8, 14), cream, { p: end.clone().addScaledVector(dir, 0.012).toArray(), name: 'grip' });
    grip.quaternion.setFromUnitVectors(_up, dir);
  }
  const bell = group(bike, { p: [0.06, 0.398, 0.135], name: 'bell' });
  add(bell, sphere(0.013, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass, { name: 'dome' });
  add(bell, roundedBox(0.008, 0.004, 0.012, 0.001, 1), brass, { p: [0.012, 0.004, 0], name: 'lever' });

  /* ---------- racks and basket ---------- */
  for (const x of [-0.05, 0.05]) add(bike, tube([P(0.3, -0.1, x * 0.6), P(0.31, -0.2, x), P(WR, REAR_Z, x * 0.5)], 0.004, { tubular: 16, radial: 6 }), chrome, { name: 'rackStrut' });
  for (const x of [-0.042, 0, 0.042]) add(bike, tube([P(0.31, -0.12, x), P(0.312, -0.2, x), P(0.31, -0.28, x)], 0.0042, { tubular: 12, radial: 6 }), chrome, { name: 'rackRail' });
  for (const z of [-0.13, -0.27]) add(bike, tube([P(0.31, z, -0.045), P(0.31, z, 0.045)], 0.0042, { tubular: 4, radial: 6 }), chrome, { name: 'rackBar' });
  add(bike, roundedBox(0.11, 0.008, 0.1, 0.003, 1), chrome, { p: [0, 0.3, 0.215], name: 'frontCarrier' });
  const basket = group(bike, { p: [0, 0.304, 0.218], name: 'basket' });
  const wicker = m.wood('#D2A878');
  add(basket, roundedBox(0.104, 0.008, 0.088, 0.003, 1), wicker, { name: 'basketFloor' });
  for (let k = 0; k < 6; k++) {
    const y = 0.01 + k * 0.013;
    add(basket, lathe([[0.072, y], [0.076, y + 0.006], [0.072, y + 0.012]], 4, Math.PI / 4).scale(1, 1, 0.85), wicker, { name: 'weave' });
  }
  add(basket, torus(0.075, 0.005, 8, 4, Math.PI * 2).rotateX(Math.PI / 2).rotateY(Math.PI / 4).scale(1, 1, 0.85), m.wood('#BE925F'), { p: [0, 0.088, 0], name: 'basketRim' });
  plantPatch(ctx, basket, { x0: -0.045, x1: 0.045, z0: -0.038, z1: 0.038, y: 0.08, density: 6000, palette: ['#F49AB2', '#FFFFFF', '#FFE19A', '#D8B4F0'], leafColor: '#7FB27A', bloomScale: 0.014, leafScale: 0.024, rng, mound: 0.03 });
  const loaf = add(basket, capsule(0.016, 0.16, 10, 16), m.paintedWood('#E2B07A'), { p: [-0.02, 0.12, -0.01], r: [0.2, 0, 0.6], name: 'baguette' });
  for (let k = 0; k < 4; k++) add(loaf, roundedBox(0.012, 0.003, 0.03, 0.001, 1), m.paintedWood('#F2D3A6'), { p: [0.012, -0.06 + k * 0.04, 0], r: [0, 0, 0.5], name: 'score' });

  /* ---------- kickstand ---------- */
  add(root, tube([P(BB[0] * Math.cos(LEAN), BB[1] - 0.04, BB[0] * Math.sin(LEAN) + 0.02), P(0.002, BB[1] - 0.07, 0.07)], 0.005, { tubular: 4, radial: 8 }), chrome, { name: 'kickstand' });
  add(root, sphere(0.008, 12, 10), m.metal('iron'), { p: [0.07, 0.004, BB[1] - 0.07], s: [1.2, 0.5, 1.2], name: 'standFoot' });

  root.userData.footprint = { w: 0.3, d: 0.95 };
  return root;
}
