import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, cylinder, torus, sphere, lathe, spline } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop, moldingRun } from '../../kit/sweep.js';
import { plinth, stringCourse, crown } from '../../kit/profiles.js';
import { wallFromShape } from '../../kit/wall.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { slateGeometry } from '../../kit/roofs.js';
import { stripedAwning } from '../../kit/awnings.js';
import { wallPanel, gableRoof, chimney } from '../../kit/building.js';
import { beadBorderGeometry, rosetteGeometry } from '../../kit/piping.js';
import { climbingRose } from '../../kit/flora.js';

// B02 — Rabbit Cake: a cream stucco pâtisserie with powder-blue joinery. A long blue-and-white
// striped awning with a scalloped valance shades three segmental shop openings; climbing roses
// frame the shopfront; window boxes overflow beneath shuttered upper windows; a side-gabled
// square-slate roof carries a front cross gable whose shell niche holds the house emblem — a
// two-tier cake crowned with a bunny — in place of any lettering.

const W = 1.9;
const D = 1.75;
const T = 0.07;
const BASE = 0.068;
const G_TOP = 0.98;
const EAVE = 1.8;
const PITCH = (50 * Math.PI) / 180;
const CROSS_W = 0.86;
const CROSS_PITCH = (55 * Math.PI) / 180;
const CROSS_EAVE = 0.07;
const MAIN_EAVE = 0.09;
const TILES = ['#A9B8D0', '#B3C1D7', '#9EAEC8', '#B8C5DA', '#A4B4CD'];

// The emblem: plate, two frosted tiers with bead piping and strawberries, a bunny on top.
function bunnyCake(ctx, parent, { p, rng }) {
  const m = ctx.materials;
  const g = group(parent, { p, name: 'bunnyCake' });
  const vanilla = m.cream('#FFF8EE');
  const pinkIcing = m.cream('#F9D2DD');
  const white = m.cream('#FFFFFF');
  add(g, lathe(spline([[0, 0], [0.084, 0], [0.088, 0.004], [0.08, 0.008], [0, 0.007]], 24), 96), m.ceramic('#FFFFFF'), { name: 'plate' });
  const tier = (r, h, y, mat, name) => add(g, lathe(spline([[0, 0], [r - 0.004, 0], [r, 0.006], [r + 0.001, h * 0.5], [r, h - 0.007], [r - 0.006, h], [0, h]], 32), 128), mat, { p: [0, y, 0], name });
  tier(0.066, 0.052, 0.007, vanilla, 'lowerTier');
  tier(0.048, 0.042, 0.059, pinkIcing, 'upperTier');
  add(g, beadBorderGeometry({ radius: 0.067, y: 0, bead: 0.0055, beads: 34, tubular: 680, radial: 12 }), white, { p: [0, 0.008, 0], name: 'lowerPiping' });
  add(g, beadBorderGeometry({ radius: 0.049, y: 0, bead: 0.0048, beads: 28, tubular: 560, radial: 12 }), white, { p: [0, 0.06, 0], name: 'upperPiping' });
  // Strawberries ringing the lower tier's top, each with a leafy calyx.
  const berry = lathe(spline([[0, 0], [0.004, 0.002], [0.0068, 0.008], [0.0062, 0.013], [0.003, 0.0155], [0, 0.0158]], 24), 24);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    const bx = Math.cos(a) * 0.058;
    const bz = Math.sin(a) * 0.058;
    add(g, berry, m.glaze('#E9566F'), { p: [bx, 0.0758, bz], r: [rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)], s: [1, -1, 1], name: 'strawberry' });
    add(g, cylinder(0.0055, 0.003, 0.002, 6, 1), m.leaf('#7FB27A'), { p: [bx, 0.0755, bz], name: 'calyx' });
  }
  add(g, rosetteGeometry({ radius: 0.012, height: 0.01, turns: 2, ridges: 7, bead: 0.26, tubular: 80, radial: 18 }), white, { p: [0.022, 0.101, 0.02], name: 'rosette' });
  add(g, rosetteGeometry({ radius: 0.011, height: 0.009, turns: 2, ridges: 7, bead: 0.26, tubular: 80, radial: 18, phase: 1.2 }), white, { p: [-0.026, 0.101, 0.012], name: 'rosette' });
  // The bunny: a soft cream head, upright ears with pink lining, a pink nose and dark eyes.
  const bunny = group(g, { p: [0, 0.101, -0.004], name: 'bunny' });
  add(bunny, sphere(0.034, 48, 32), white, { p: [0, 0.026, 0], s: [1, 0.86, 0.94], name: 'head' });
  for (const side of [-1, 1]) {
    const ear = group(bunny, { p: [side * 0.014, 0.05, -0.004], r: [-0.12, 0, side * -0.18], name: 'ear' });
    add(ear, sphere(0.011, 32, 24), white, { p: [0, 0.028, 0], s: [1, 2.9, 0.55], name: 'earOuter' });
    add(ear, sphere(0.0072, 24, 16), m.cream('#F7B7C8'), { p: [0, 0.028, 0.0045], s: [1, 2.6, 0.35], name: 'earInner' });
    add(bunny, sphere(0.0036, 12, 8), m.plastic('#4A3E4E'), { p: [side * 0.0125, 0.03, 0.03], name: 'eye' });
    add(bunny, sphere(0.006, 16, 12), m.cream('#F8C2D0'), { p: [side * 0.018, 0.017, 0.026], s: [1, 0.7, 0.5], name: 'cheek' });
  }
  add(bunny, sphere(0.004, 16, 12), m.glaze('#F28FAA'), { p: [0, 0.022, 0.033], s: [1.2, 0.85, 0.8], name: 'nose' });
  return g;
}

export default function build(ctx, { seed = 202 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'RabbitCake';

  const cream = m.plaster('#FBF2E3');
  const white = m.trim('#FFFDF8');
  const blue = m.paintedWood('#A6C6E7');
  const blueDeep = m.paintedWood('#8FB4DD');
  const stone = m.stone('#EDE2D4');
  const iron = m.metal('iron');
  const brass = m.metal('brass');
  const zinc = m.metal('zinc');
  const flowers = ['#F7A8BE', '#FFFFFF', '#F4BCD0', '#FFF0B8', '#E9D7F7'];
  const shopRoom = { style: 1, wall: '#FFF1E8', accent: '#A9C8E8', glow: 1.25 };
  const homeRoom = (k) => ({ style: 0, wall: ['#F7EEE2', '#EEF3FA', '#FBEFF3'][k % 3], accent: ['#A9C8E8', '#F2B8C6', '#CFE3C8'][k % 3], glow: 0.95 });

  add(root, moldingLoop(plinth(0.07), W, D), stone, { name: 'plinthCourse' });

  /* ---------- shop floor ---------- */
  const shopOpenings = [
    { x: -0.58, y: 0.2, w: 0.5, h: 0.56, kind: 'segmental', rise: 0.07 },
    { x: 0, y: 0, w: 0.34, h: 0.72, kind: 'segmental', rise: 0.06 },
    { x: 0.58, y: 0.2, w: 0.5, h: 0.56, kind: 'segmental', rise: 0.07 },
  ];
  const shop = wallPanel(root, { side: 'front', W, D, y: BASE, height: G_TOP - BASE, thickness: T, openings: shopOpenings, material: cream, name: 'shopfront' });
  for (const [i, o] of [shopOpenings[0], shopOpenings[2]].entries()) {
    buildWindow(ctx, shop, { ...o, trim: blue, sash: blue, panes: [4, 3], casing: 0.036, room: shopRoom, seed: 0.23 + i * 0.29, keystone: true, box: { material: blueDeep, palette: flowers } });
    const riser = group(shop, { p: [o.x, 0.09, 0], name: 'stallRiser' });
    add(riser, roundedBox(0.46, 0.13, 0.016, 0.004, 3), blue, { p: [0, 0, 0.008], name: 'panel' });
    for (const px of [-0.115, 0.115]) add(riser, roundedBox(0.19, 0.09, 0.01, 0.003, 3), blue, { p: [px, 0, 0.019], name: 'field' });
  }
  buildDoor(ctx, shop, { ...shopOpenings[1], trim: blue, material: blue, metal: brass, stone, double: false, glazed: true, room: { ...shopRoom, glow: 1.35 }, casing: 0.04, steps: 2, seed: 0.61 });
  // Arm brackets sit on the corners and on the two piers between the door and the shop windows.
  stripedAwning(ctx, shop, { x: 0, y: 0.875, width: 1.8, depth: 0.34, drop: 0.13, stripes: 13, colors: ['#A6C6E7', '#FFFDF8'], valance: 0.052, metal: iron, sag: 0.007, arms: [-0.9, -0.252, 0.252, 0.9] });
  climbingRose(ctx, shop, { path: [[-0.92, 0], [-0.9, 0.22], [-0.925, 0.45], [-0.9, 0.66], [-0.89, 0.82]], rng, z: 0.032, blooms: 18, leaves: 170 });
  climbingRose(ctx, shop, { path: [[0.92, 0], [0.9, 0.25], [0.925, 0.5], [0.9, 0.7], [0.89, 0.83]], rng, z: 0.032, blooms: 18, leaves: 170 });

  for (const side of ['left', 'right']) {
    const o = [{ x: 0.1, y: 0.2, w: 0.42, h: 0.54, kind: 'segmental', rise: 0.06 }];
    const wall = wallPanel(root, { side, W, D, y: BASE, height: G_TOP - BASE, thickness: T, openings: o, material: cream });
    buildWindow(ctx, wall, { ...o[0], trim: blue, sash: blue, panes: [3, 3], casing: 0.034, room: shopRoom, seed: side === 'left' ? 0.42 : 0.57, keystone: true });
  }
  const backShop = [
    { x: 0.45, y: 0, w: 0.28, h: 0.64, kind: 'rect' },
    { x: -0.35, y: 0.24, w: 0.36, h: 0.44, kind: 'rect' },
  ];
  const back = wallPanel(root, { side: 'back', W, D, y: BASE, height: G_TOP - BASE, thickness: T, openings: backShop, material: cream });
  buildDoor(ctx, back, { ...backShop[0], trim: white, material: blue, metal: brass, stone, glazed: false, casing: 0.036, steps: 2, seed: 0.88 });
  buildWindow(ctx, back, { ...backShop[1], trim: white, sash: white, panes: [2, 2], casing: 0.034, room: { style: 1, glow: 0.9 }, seed: 0.31 });

  /* ---------- upper floor ---------- */
  const upperH = EAVE - G_TOP;
  const up = [
    { x: -0.6, y: 0.18, w: 0.3, h: 0.44, kind: 'rect' },
    { x: 0, y: 0.14, w: 0.32, h: 0.52, kind: 'round' },
    { x: 0.6, y: 0.18, w: 0.3, h: 0.44, kind: 'rect' },
  ];
  const front = wallPanel(root, { side: 'front', W, D, y: G_TOP, height: upperH, thickness: T, openings: up, material: cream, name: 'frontUpper' });
  up.forEach((o, i) => {
    const centre = i === 1;
    buildWindow(ctx, front, { ...o, trim: white, sash: blue, panes: centre ? [2, 3] : [2, 2], casing: 0.04, room: homeRoom(i), seed: 0.15 + i * 0.19, shutters: centre ? null : blue, box: centre ? null : { material: blueDeep, palette: flowers }, balcony: centre ? { stone } : null });
  });
  for (const side of ['left', 'right']) {
    const o = [
      { x: -0.38, y: 0.2, w: 0.28, h: 0.44, kind: 'rect' },
      { x: 0.38, y: 0.2, w: 0.28, h: 0.44, kind: 'rect' },
    ];
    const wall = wallPanel(root, { side, W, D, y: G_TOP, height: upperH, thickness: T, openings: o, material: cream });
    o.forEach((oo, i) => buildWindow(ctx, wall, { ...oo, trim: white, sash: blue, panes: [2, 2], casing: 0.036, room: homeRoom(i + 1), seed: (side === 'left' ? 0.5 : 0.7) + i * 0.07, shutters: blue }));
  }
  const backUp = [-0.6, 0, 0.6].map((x) => ({ x, y: 0.2, w: 0.28, h: 0.42, kind: 'rect' }));
  const backUpper = wallPanel(root, { side: 'back', W, D, y: G_TOP, height: upperH, thickness: T, openings: backUp, material: cream, name: 'backUpper' });
  backUp.forEach((o, i) => buildWindow(ctx, backUpper, { ...o, trim: white, sash: blue, panes: [2, 2], casing: 0.034, room: homeRoom(i + 2), seed: 0.63 + i * 0.05, shutters: i === 1 ? null : blue, box: i === 1 ? { material: blueDeep, palette: flowers } : null }));

  add(root, moldingLoop(stringCourse(0.03), W, D), white, { p: [0, G_TOP - 0.012, 0], name: 'stringCourse' });
  // Crown moulding tucked under the sloping soffit: its nosing clears the roof deck's underside.
  for (const sz of [1, -1]) add(root, moldingRun(crown(0.05), W + 0.02), white, { p: [(-sz * (W + 0.02)) / 2, EAVE - 0.1, (sz * D) / 2], r: [0, sz > 0 ? 0 : Math.PI, 0], name: 'eaveCrown' });
  // Corner pilaster strips in white, front corners.
  for (const sx of [-1, 1]) {
    add(root, roundedBox(0.06, EAVE - 0.08, 0.018, 0.004, 3), white, { p: [sx * (W / 2 - 0.03), 0.07 + (EAVE - 0.08) / 2, D / 2 + 0.009], name: 'cornerStrip' });
    add(root, roundedBox(0.018, EAVE - 0.08, 0.06, 0.004, 3), white, { p: [sx * (W / 2 + 0.009), 0.07 + (EAVE - 0.08) / 2, D / 2 - 0.03], name: 'cornerStrip' });
  }

  /* ---------- gables and roofs ---------- */
  const rise = (D / 2) * Math.tan(PITCH);
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-D / 2, 0);
    shape.lineTo(D / 2, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const gable = group(root, { p: [side * (W / 2), EAVE, 0], r: [0, side * (Math.PI / 2), 0], name: 'sideGable' });
    const oculus = { x: 0, y: rise * 0.38 - 0.1, w: 0.2, h: 0.2, kind: 'circle' };
    add(gable, wallFromShape(shape, T, [oculus]), cream, { name: 'gableWall' });
    buildWindow(ctx, gable, { ...oculus, trim: white, sash: blue, panes: [2, 2], casing: 0.03, room: homeRoom(side + 2), seed: 0.9 + side * 0.03 });
  }

  // Front cross gable with the emblem niche.
  const crossRise = (CROSS_W / 2) * Math.tan(CROSS_PITCH);
  const crossShape = new THREE.Shape();
  crossShape.moveTo(-CROSS_W / 2, 0);
  crossShape.lineTo(CROSS_W / 2, 0);
  crossShape.lineTo(0, crossRise);
  crossShape.closePath();
  const crossFace = group(root, { p: [0, EAVE, D / 2], name: 'crossGable' });
  const niche = { x: 0, y: 0.06, w: 0.3, h: 0.3, kind: 'circle' };
  add(crossFace, wallFromShape(crossShape, T, [niche]), cream, { name: 'gableWall' });
  add(crossFace, torus(0.155, 0.014, 12, 96), white, { p: [0, 0.21, 0.006], name: 'nicheSurround' });
  // A real recess: a lined drum running back into the attic, closed by a powder-blue back.
  const NICHE_DEPTH = 0.2;
  add(crossFace, lathe([[0.15, NICHE_DEPTH], [0.15, 0]], 96).rotateX(-Math.PI / 2), cream, { p: [0, 0.21, 0], name: 'nicheLining' });
  add(crossFace, cylinder(0.152, 0.152, 0.012, 96, 1), blue, { p: [0, 0.21, -NICHE_DEPTH], r: [Math.PI / 2, 0, 0], name: 'nicheBack' });
  // Fluted shell hood in the top of the niche.
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.1 + (0.8 * k) / 8);
    add(crossFace, roundedBox(0.008, 0.11, 0.008, 0.003, 2), white, { p: [Math.cos(a) * 0.09, 0.21 + Math.sin(a) * 0.09, -NICHE_DEPTH + 0.01], r: [0, 0, a - Math.PI / 2], name: 'shellRib' });
  }
  // Half-round shelf the cake stands on, set where the opening is wide enough for its plate.
  add(crossFace, cylinder(0.118, 0.118, 0.016, 64, 1, false, -Math.PI / 2, Math.PI), white, { p: [0, 0.082, -NICHE_DEPTH + 0.012], name: 'nicheShelf' });
  bunnyCake(ctx, crossFace, { p: [0, 0.09, -0.1], rng });
  add(crossFace, moldingRun(crown(0.04), CROSS_W + 0.04), white, { p: [-(CROSS_W + 0.04) / 2, -0.04, 0], name: 'crossCrown' });

  const tile = { geometry: slateGeometry(0.068, 0.088, 0.007, 'square'), material: m.slate('#FFFFFF'), colors: TILES, tileW: 0.068, exposure: 0.04 };
  const crossHeight = (ax) => (CROSS_W / 2 - ax) * Math.tan(CROSS_PITCH);
  const underCross = (x, ySlope) => {
    const ax = Math.abs(x);
    if (ax > CROSS_W / 2 + CROSS_EAVE - 0.02) return false;
    const h = -MAIN_EAVE * Math.tan(PITCH) + ySlope * Math.sin(PITCH);
    return h + 0.03 < crossHeight(ax);
  };
  const main = gableRoof(root, {
    length: W,
    span: D,
    pitch: PITCH,
    eave: MAIN_EAVE,
    verge: 0.07,
    tile,
    deck: m.slate('#9DAAC2'),
    trim: white,
    ridge: { material: zinc, colors: ['#FFFFFF'] },
    rng,
    exclude: { front: underCross },
    name: 'mainRoof',
  });
  main.group.position.y = EAVE;

  const crossLen = 0.78;
  const cross = gableRoof(root, {
    length: crossLen,
    span: CROSS_W,
    pitch: CROSS_PITCH,
    eave: CROSS_EAVE,
    verge: 0.06,
    tile: { ...tile, geometry: slateGeometry(0.06, 0.08, 0.006, 'diamond'), tileW: 0.06, exposure: 0.036 },
    deck: m.slate('#9DAAC2'),
    trim: white,
    ridge: { material: zinc, colors: ['#FFFFFF'] },
    rng,
    name: 'crossRoof',
  });
  cross.group.position.set(0, EAVE, D / 2 - crossLen / 2);
  cross.group.rotation.y = Math.PI / 2;
  add(root, sphere(0.016, 16, 12), m.metal('gold'), { p: [0, EAVE + crossRise + 0.04, D / 2 + 0.06], name: 'gableFinial' });

  for (const sx of [-1, 1]) chimney(root, { x: sx * (W / 2 - 0.12), z: 0.18, y0: EAVE + 0.2, y1: EAVE + rise + 0.32, w: 0.18, d: 0.26, plaster: cream, trim: white, clay: m.terracotta('#E39A7E'), pots: 2, rng });

  root.userData.footprint = { w: W, d: D };
  return root;
}
