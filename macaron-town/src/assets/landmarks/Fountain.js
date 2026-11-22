import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, lathe, spline, roundedBox } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { beadBorderGeometry } from '../../kit/piping.js';
import { macaron } from '../../kit/macaron.js';
import { finial } from '../../kit/roofs.js';
import { Droplets } from '../../physics/Droplets.js';
import { GRAVITY } from '../../physics/World.js';

// L1 — Tiered fountain at the heart of the plaza, iced like a three-tier cake. Two granite steps
// carry a pink-marble basin with a cream coping piped in white and twelve gilt-ringed macaron
// medallions. From the water rises a turned baluster pedestal holding a wide gadrooned tazza, a
// slender stem and a smaller tazza crowned by a stack of macarons and a gilded finial. Water is
// simulated: a centre jet blooms into an umbrella of droplets, eight brass rim jets arc into the
// basin, both tazzas overflow in sheets that follow their true ballistic paths, and every landing
// throws up splashes over a ring of foam.

const STEP1 = { r: 1.63, h: 0.045 };
const STEP2 = { r: 1.56, h: 0.04 };
const BASE_TOP = STEP1.h + STEP2.h;
const R_OUT = 1.48; // basin wall, outer face
const R_IN = 1.36; // basin wall, inner face
const COPING_Y = 0.25;
const COPING_H = 0.04;
const FLOOR_Y = 0.1;
const WATER_Y = 0.236;

const MID = { lip: 0.85, lipTop: 0.958, water: 0.961, under: 0.735 };
const TOP = { lip: 0.43, lipTop: 1.428, water: 1.431, under: 1.33 };
const NOZZLE_Y = 1.74;
const JET_RISE = 0.3;

// Overflow sheet leaving a lip at (r0, y0) with outward speed v0 and falling to `floor`: a lathe of
// the true ballistic path, so its uv.y runs down the fall (lip at 0, landing at 1).
function curtain(r0, y0, v0, floor) {
  const T = Math.sqrt((2 * (y0 - floor)) / GRAVITY);
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * T;
    pts.push(new THREE.Vector2(r0 + v0 * t, y0 - 0.5 * GRAVITY * t * t));
  }
  return { geometry: lathe(pts, 192), landing: r0 + v0 * T };
}

// Still water filling a round vessel: a disc whose uvs are centred, as the water material expects.
const waterDisc = (radius) => new THREE.CircleGeometry(radius, 192).rotateX(-Math.PI / 2);

// Gadroons: convex lobes radiating under a tazza, each following the slope of the underside.
function gadroons(parent, { count, r0, r1, y0, y1, width, material, phase = 0, name = 'gadroon' }) {
  const len = Math.hypot(r1 - r0, y1 - y0);
  const tilt = Math.atan2(y1 - y0, r1 - r0);
  for (let k = 0; k < count; k++) {
    const a = phase + (k / count) * Math.PI * 2;
    const rm = (r0 + r1) / 2;
    const ym = (y0 + y1) / 2 - width * 0.25;
    add(parent, sphere(1, 32, 16), material, { p: [Math.sin(a) * rm, ym, Math.cos(a) * rm], r: [-tilt, a, 0, 'YXZ'], s: [width, width * 0.42, len / 2], name });
  }
}

// A ring of foam: flattened bubbles scattered thickest at the landing line of falling water.
function foamRing(parent, { radius, y, spread, count, rng, material, name = 'foam' }) {
  const items = [];
  for (let k = 0; k < count; k++) {
    const a = rng.range(0, Math.PI * 2);
    const d = (rng() + rng() + rng() - 1.5) * spread;
    const s = rng.range(0.007, 0.016) * (1 - Math.abs(d) / (spread * 2.2));
    items.push({ p: [Math.sin(a) * (radius + d), y + s * 0.15, Math.cos(a) * (radius + d)], s: [s, s * 0.45, s], r: [0, rng.range(0, 6.28), 0] });
  }
  parent.add(instanced(sphere(1, 12, 8), material, items, { cast: false, name }));
}

export default function build(ctx, { seed = 101 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Fountain';

  const granite = m.granite('#E6DCD4');
  const stone = m.stone('#F6EEE4');
  const marble = m.stone('#F4CFD8');
  const gold = m.metal('gold');
  const brass = m.metal('brass');
  const icing = m.cream('#FFFFFF');
  const water = m.water('#8DD0DE', '#C9EEF4');
  const sheet = m.waterSheet('#DDF3F7', { columns: 110, speed: 1.7, dashes: 3, foam: 0.1, opacity: 0.3 });
  const foam = m.foam();

  /* ---------- steps ---------- */
  const nose = (r, y0, h) => spline([[0, y0], [r - 0.012, y0], [r, y0 + h * 0.3], [r - 0.003, y0 + h * 0.8], [r - 0.014, y0 + h], [0, y0 + h]], 40);
  add(root, lathe(nose(STEP1.r, 0, STEP1.h), 256), granite, { name: 'step' });
  add(root, lathe(nose(STEP2.r, STEP1.h, STEP2.h), 256), granite, { name: 'step' });

  /* ---------- basin ---------- */
  // Pink marble wall: torus base moulding, plain die, a little bed moulding under the coping, then
  // over the top and down the inner face to the floor.
  const wall = [
    ...spline([[R_OUT + 0.024, BASE_TOP], [R_OUT + 0.026, BASE_TOP + 0.01], [R_OUT + 0.012, BASE_TOP + 0.024], [R_OUT, BASE_TOP + 0.03]], 16),
    new THREE.Vector2(R_OUT, COPING_Y - 0.022),
    ...spline([[R_OUT, COPING_Y - 0.022], [R_OUT + 0.01, COPING_Y - 0.014], [R_OUT + 0.012, COPING_Y - 0.004]], 10).slice(1),
    new THREE.Vector2(R_IN, COPING_Y - 0.004),
    new THREE.Vector2(R_IN, FLOOR_Y),
    new THREE.Vector2(0, FLOOR_Y),
  ];
  add(root, lathe(wall, 256), marble, { name: 'basinWall' });
  // Cream coping with bullnosed edges, overhanging the wall on both sides.
  const cy = COPING_Y;
  const coping = [
    new THREE.Vector2(R_IN - 0.012, cy - 0.004),
    new THREE.Vector2(R_OUT + 0.026, cy - 0.004),
    ...spline([[R_OUT + 0.026, cy - 0.004], [R_OUT + 0.036, cy + 0.008], [R_OUT + 0.034, cy + 0.026], [R_OUT + 0.018, cy + COPING_H]], 16).slice(1),
    new THREE.Vector2(R_IN + 0.004, cy + COPING_H),
    ...spline([[R_IN + 0.004, cy + COPING_H], [R_IN - 0.01, cy + COPING_H - 0.01], [R_IN - 0.015, cy + 0.012], [R_IN - 0.012, cy - 0.004]], 16).slice(1),
  ];
  add(root, lathe(coping, 256), stone, { name: 'coping' });
  add(root, beadBorderGeometry({ radius: R_OUT + 0.006, y: 0, bead: 0.015, beads: 170, tubular: 3400, radial: 14 }), icing, { p: [0, cy + COPING_H - 0.004, 0], name: 'copingPiping' });

  // Twelve panels: cream pilaster strips, and in each bay a macaron medallion in a gilt ring.
  const flavours = ['rose', 'pistachio', 'lavender', 'lemon', 'raspberry', 'vanilla'];
  const dieY0 = BASE_TOP + 0.03;
  const dieY1 = COPING_Y - 0.022;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    add(root, roundedBox(0.05, dieY1 - dieY0, 0.016, 0.004, 2), stone, { p: [Math.sin(a) * (R_OUT + 0.006), (dieY0 + dieY1) / 2, Math.cos(a) * (R_OUT + 0.006)], r: [0, a, 0], name: 'pilaster' });
    const b = a + Math.PI / 12;
    const medal = group(root, { p: [Math.sin(b) * (R_OUT + 0.004), (dieY0 + dieY1) / 2, Math.cos(b) * (R_OUT + 0.004)], r: [0, b, 0], name: 'medallion' });
    add(medal, torus(0.043, 0.0045, 10, 64), gold, { name: 'ring' });
    macaron(ctx, medal, { radius: 0.033, flavour: flavours[k % flavours.length], p: [0, 0, 0.012], r: [Math.PI / 2, 0, 0], seed: seed + k * 3 });
  }
  add(root, waterDisc(R_IN + 0.002), water, { p: [0, WATER_Y, 0], cast: false, name: 'basinWater' });

  /* ---------- pedestal and lower tazza ---------- */
  add(root, cylinder(0.28, 0.29, 0.05, 96, 1), stone, { p: [0, FLOOR_Y + 0.025, 0], name: 'pedestalPlinth' });
  const vase = spline([[0, FLOOR_Y + 0.05], [0.25, FLOOR_Y + 0.05], [0.25, FLOOR_Y + 0.07], [0.22, FLOOR_Y + 0.085], [0.235, FLOOR_Y + 0.11], [0.21, FLOOR_Y + 0.13], [0.24, 0.32], [0.2, 0.42], [0.12, 0.53], [0.11, 0.58], [0.14, 0.6], [0.145, 0.615], [0.11, 0.63], [0.12, 0.67], [0.18, 0.705], [0.21, MID.under], [0, MID.under]], 120);
  add(root, lathe(vase, 128), stone, { name: 'pedestal' });
  add(root, torus(0.143, 0.009, 12, 96), gold, { p: [0, 0.607, 0], r: [Math.PI / 2, 0, 0], name: 'pedestalRing' });

  const tazza = (o) => {
    const k = o.lip;
    return [
      ...spline([[0, o.under], [0.19 * k / 0.85, o.under], [0.35 * k / 0.85, o.under + 0.03 * k / 0.85], [0.55 * k / 0.85, o.under + 0.085 * k / 0.85], [0.72 * k / 0.85, o.under + 0.14 * k / 0.85], [k - 0.035 * k / 0.85, o.lipTop - 0.03 * k / 0.85], [k, o.lipTop - 0.016 * k / 0.85], [k - 0.004, o.lipTop - 0.004], [k - 0.02 * k / 0.85, o.lipTop]], 96),
      new THREE.Vector2(k - 0.04 * k / 0.85, o.lipTop - 0.012),
      new THREE.Vector2(0, o.lipTop - 0.012),
    ];
  };
  add(root, lathe(tazza(MID), 192), stone, { name: 'lowerTazza' });
  gadroons(root, { count: 24, r0: 0.3, r1: 0.74, y0: MID.under + 0.022, y1: MID.under + 0.15, width: 0.034, material: stone, name: 'gadroon' });
  add(root, torus(MID.lip - 0.004, 0.011, 12, 192), marble, { p: [0, MID.lipTop - 0.016, 0], r: [Math.PI / 2, 0, 0], name: 'lipBand' });
  add(root, beadBorderGeometry({ radius: MID.lip - 0.012, y: 0, bead: 0.011, beads: 110, tubular: 2200, radial: 12 }), icing, { p: [0, MID.lipTop - 0.006, 0], name: 'lipPiping' });
  add(root, waterDisc(MID.lip - 0.006), water, { p: [0, MID.water, 0], cast: false, name: 'tazzaWater' });

  /* ---------- stem and upper tazza ---------- */
  const stem = spline([[0, MID.water - 0.03], [0.12, MID.water - 0.03], [0.12, MID.water + 0.005], [0.1, MID.water + 0.02], [0.08, 1.03], [0.066, 1.11], [0.072, 1.15], [0.1, 1.17], [0.072, 1.19], [0.062, 1.25], [0.085, 1.3], [0.11, TOP.under], [0, TOP.under]], 96);
  add(root, lathe(stem, 96), stone, { name: 'stem' });
  add(root, torus(0.098, 0.007, 10, 72), gold, { p: [0, 1.17, 0], r: [Math.PI / 2, 0, 0], name: 'stemRing' });
  add(root, lathe(tazza(TOP), 160), stone, { name: 'upperTazza' });
  gadroons(root, { count: 14, r0: 0.16, r1: 0.37, y0: TOP.under + 0.014, y1: TOP.under + 0.07, width: 0.026, material: stone, phase: 0.2, name: 'gadroon' });
  add(root, torus(TOP.lip - 0.003, 0.008, 10, 128), marble, { p: [0, TOP.lipTop - 0.008, 0], r: [Math.PI / 2, 0, 0], name: 'lipBand' });
  add(root, beadBorderGeometry({ radius: TOP.lip - 0.008, y: 0, bead: 0.008, beads: 70, tubular: 1400, radial: 10 }), icing, { p: [0, TOP.lipTop - 0.004, 0], name: 'lipPiping' });
  add(root, waterDisc(TOP.lip - 0.004), water, { p: [0, TOP.water, 0], cast: false, name: 'topWater' });

  /* ---------- crown: a stack of macarons and a gilded finial ---------- */
  add(root, cylinder(0.065, 0.075, 0.04, 64, 1), stone, { p: [0, TOP.water + 0.01, 0], name: 'crownPlinth' });
  add(root, torus(0.068, 0.006, 10, 64), gold, { p: [0, TOP.water + 0.03, 0], r: [Math.PI / 2, 0, 0], name: 'crownRing' });
  let y = TOP.water + 0.03;
  [['rose', 0.085], ['pistachio', 0.07], ['lavender', 0.055]].forEach(([flavour, r], i) => {
    y += 0.463 * r;
    macaron(ctx, root, { radius: r, flavour, p: [0, y, 0], r: [0, i * 0.7, 0], seed: seed + 40 + i, name: 'crownMacaron' });
    y += 0.463 * r;
  });
  const crown = group(root, { p: [0, y - 0.004, 0], name: 'finial' });
  finial(crown, { y: 0, height: NOZZLE_Y - y + 0.004, radius: 0.02, material: gold });

  /* ---------- water: overflow sheets, jet column, rim nozzles ---------- */
  const upper = curtain(TOP.lip + 0.002, TOP.lipTop - 0.002, 0.16, MID.water);
  add(root, upper.geometry, sheet, { cast: false, receive: false, name: 'upperCurtain' });
  const lower = curtain(MID.lip + 0.002, MID.lipTop - 0.002, 0.22, WATER_Y);
  add(root, lower.geometry, sheet, { cast: false, receive: false, name: 'lowerCurtain' });
  const jetSpeed = Math.sqrt(2 * GRAVITY * JET_RISE);
  const jetColumn = spline([[0, NOZZLE_Y - 0.01], [0.007, NOZZLE_Y - 0.01], [0.009, NOZZLE_Y + 0.08], [0.012, NOZZLE_Y + 0.18], [0.008, NOZZLE_Y + 0.25], [0, NOZZLE_Y + 0.27]], 32);
  add(root, lathe(jetColumn, 48), m.waterSheet('#E8F7FA', { columns: 10, speed: 2.4, dashes: 4, foam: 0.0, opacity: 0.45 }), { cast: false, receive: false, name: 'jetColumn' });

  const NOZZLES = 8;
  const nozzleR = R_IN + 0.01;
  const nozzleY = cy + COPING_H;
  const rimTarget = lower.landing; // the rim jets land where the lower sheet does
  // Arc: rise 0.24 above the nozzle, then fall to the water at the landing radius.
  const rise = 0.24;
  const vy = Math.sqrt(2 * GRAVITY * rise);
  const flight = vy / GRAVITY + Math.sqrt((2 * (nozzleY + rise - WATER_Y)) / GRAVITY);
  const vh = (nozzleR - rimTarget) / flight;
  const rimSpeed = Math.hypot(vy, vh);
  for (let k = 0; k < NOZZLES; k++) {
    const a = ((k + 0.5) / NOZZLES) * Math.PI * 2;
    const n = group(root, { p: [Math.sin(a) * nozzleR, nozzleY, Math.cos(a) * nozzleR], r: [0, a, 0], name: 'rimNozzle' });
    add(n, roundedBox(0.05, 0.016, 0.05, 0.006, 2), stone, { p: [0, 0.008, 0.005], name: 'nozzleBlock' });
    // Brass spout leaning in toward the pedestal at the jet's launch angle.
    const spout = group(n, { p: [0, 0.016, 0], r: [-Math.atan2(vh, vy), 0, 0], name: 'spout' });
    add(spout, lathe(spline([[0, 0], [0.014, 0], [0.013, 0.008], [0.007, 0.016], [0.0055, 0.04], [0.007, 0.046], [0.004, 0.047], [0, 0.047]], 32), 32), brass, { name: 'nozzle' });
  }

  /* ---------- foam at every landing ---------- */
  foamRing(root, { radius: lower.landing, y: WATER_Y, spread: 0.05, count: 260, rng, material: foam, name: 'basinFoam' });
  foamRing(root, { radius: upper.landing, y: MID.water, spread: 0.035, count: 130, rng, material: foam, name: 'tazzaFoam' });
  foamRing(root, { radius: 0.09, y: TOP.water, spread: 0.06, count: 60, rng, material: foam, name: 'crownFoam' });

  /* ---------- simulated spray ---------- */
  const dropMesh = new THREE.InstancedMesh(sphere(1, 10, 8), m.spray(), 1600);
  dropMesh.name = 'spray';
  dropMesh.castShadow = false;
  dropMesh.receiveShadow = false;
  root.add(dropMesh);
  const spray = new Droplets(dropMesh, { capacity: 1600 });
  const v3 = (x, yy, z) => new THREE.Vector3(x, yy, z);
  // Centre jet: a rising column that blooms into an umbrella and rains into the upper tazza.
  spray.addEmitter({ origin: v3(0, NOZZLE_Y + 0.01, 0), direction: v3(0, 1, 0), speed: jetSpeed, spread: 0.5, rate: 150, floorY: TOP.water });
  // Rim jets arcing in to the landing ring of the lower sheet.
  for (let k = 0; k < NOZZLES; k++) {
    const a = ((k + 0.5) / NOZZLES) * Math.PI * 2;
    const out = v3(Math.sin(a), 0, Math.cos(a));
    // Spout tip: 0.016 up to the spout base, then the spout's 0.047 length along the launch line.
    const tip = out.clone().multiplyScalar(nozzleR - (0.047 * vh) / rimSpeed).setY(nozzleY + 0.016 + (0.047 * vy) / rimSpeed);
    spray.addEmitter({ origin: tip, direction: out.clone().multiplyScalar(-vh).setY(vy), speed: rimSpeed, spread: 0.035, rate: 48, floorY: WATER_Y });
  }
  // Splashes thrown up where the sheets land.
  const splashes = (radius, floorY, count, speed, rate) => {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      const out = v3(Math.sin(a), 0, Math.cos(a));
      spray.addEmitter({ origin: out.clone().multiplyScalar(radius).setY(floorY + 0.004), direction: out.clone().multiplyScalar(0.35).setY(1), speed, spread: 1.1, rate, floorY });
    }
  };
  splashes(lower.landing, WATER_Y, 28, 0.42, 6);
  splashes(upper.landing, MID.water, 16, 0.32, 5);
  ctx.physics.add(spray);

  root.userData.update = () => spray.sync(0.0078, 2.2);
  root.userData.footprint = { r: STEP1.r };
  return root;
}
