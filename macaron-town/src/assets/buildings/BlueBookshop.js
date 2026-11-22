import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, cylinder, torus, sphere, lathe, spline, tube } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop, moldingRun } from '../../kit/sweep.js';
import { plinth, cornice, stringCourse, bead } from '../../kit/profiles.js';
import { wallSlab } from '../../kit/wall.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { slateGeometry } from '../../kit/roofs.js';
import { railing } from '../../kit/railings.js';
import { wallPanel, hipRoof, chimney, wallLantern } from '../../kit/building.js';
import { Pendulum } from '../../physics/Pendulum.js';
import buildSignEasel from '../street/SignEasel.js';

// B06 — The café (one of the town's three venues, with the welcome centre and the gallery): powder-
// blue stucco over a deep navy timber shopfront. Two shop windows of cake shelves flank a recessed
// door; a gilt-framed fascia carries a coffee-cup emblem; a gilded cup on its saucer, steam curling
// from it, hangs from a scrolled bracket and swings in the wind; a chalkboard easel by the door
// shows a steaming cup. Out front, a terrace of two marble-topped bistro tables with bentwood chairs
// and cups of coffee. Above, a long iron balcony, navy shutters and a hipped roof of flat terracotta
// tiles with a round-headed dormer. No lettering anywhere: the cups say café.

const W = 1.95;
const D = 1.75;
const T = 0.07;
const BASE = 0.068;
const G_TOP = 1.0;
const F1_TOP = 1.74;
const EAVE = 2.42;
const ROOF_PITCH = (40 * Math.PI) / 180;
const OVERHANG = 0.08;
const TILES = ['#E3A487', '#DC9A7C', '#E8AE92', '#D68F72', '#E19E83'];

// A coffee cup on its saucer with three curls of steam: cream china with gilt rims for the hanging
// sign, or all gilt (`gilt`) and pressed flat for the fascia's emblem. The cup's handle points along +x.
function coffeeCup(ctx, parent, { size = 0.1, p, r, s = 1, gilt = false, name = 'cup' }) {
  const m = ctx.materials;
  const g = group(parent, { p, r, s, name });
  const k = size;
  const gold = m.metal('gold');
  const china = gilt ? gold : m.ceramic('#FFF8EE');
  const steam = gilt ? gold : m.cream('#FFFDF8');
  add(g, cylinder(k * 0.62, k * 0.5, k * 0.06, 48, 1), china, { p: [0, -k * 0.42, 0], name: 'saucer' });
  add(g, torus(k * 0.6, k * 0.012, 8, 64), gold, { p: [0, -k * 0.39, 0], r: [Math.PI / 2, 0, 0], name: 'saucerRim' });
  add(g, lathe(spline([[0, 0], [k * 0.28, 0], [k * 0.4, k * 0.25], [k * 0.44, k * 0.52], [k * 0.4, k * 0.53], [k * 0.36, k * 0.3], [0, k * 0.05]], 32), 48), china, { p: [0, -k * 0.39, 0], name: 'cup' });
  add(g, torus(k * 0.43, k * 0.014, 8, 64), gold, { p: [0, k * 0.13, 0], r: [Math.PI / 2, 0, 0], name: 'cupRim' });
  add(g, cylinder(k * 0.37, k * 0.37, k * 0.01, 40, 1), gilt ? gold : m.glaze('#7A4B30'), { p: [0, k * 0.1, 0], name: 'coffee' });
  add(g, torus(k * 0.13, k * 0.035, 10, 32), china, { p: [k * 0.46, -k * 0.12, 0], name: 'handle' });
  for (const [i, x] of [-0.15, 0.02, 0.18].entries()) {
    const pts = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16;
      pts.push([k * (x + 0.06 * Math.sin(t * Math.PI * 2 + i * 1.7)), k * (0.22 + (0.5 + 0.08 * i) * t), 0]);
    }
    add(g, tube(pts, k * (0.026 - 0.004 * i), { tubular: 32, radial: 8 }), steam, { name: 'steam' });
  }
  return g;
}

function bistroTable(ctx, parent, { p, rng, name = 'bistroTable' }) {
  const m = ctx.materials;
  const g = group(parent, { p, name });
  const iron = m.metal('iron');
  add(g, lathe(spline([[0, 0], [0.03, 0], [0.028, 0.004], [0.01, 0.012], [0.006, 0.03], [0.005, 0.1], [0.009, 0.118], [0, 0.12]], 48), 32), iron, { name: 'pedestal' });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    add(g, tube([[0, 0.012, 0], [Math.cos(a) * 0.022, 0.008, Math.sin(a) * 0.022], [Math.cos(a) * 0.04, 0.002, Math.sin(a) * 0.04]], 0.0032, { tubular: 16, radial: 6 }), iron, { name: 'foot' });
  }
  add(g, cylinder(0.052, 0.052, 0.007, 48, 1), m.stone('#F7F3EE'), { p: [0, 0.124, 0], name: 'marbleTop' });
  add(g, torus(0.052, 0.0022, 6, 64), m.metal('brass'), { p: [0, 0.124, 0], r: [Math.PI / 2, 0, 0], name: 'brassRim' });
  // Coffee for two: saucers, cups with handles, coffee surface.
  for (const side of [-1, 1]) {
    const c = group(g, { p: [side * 0.022, 0.1275, rng.range(-0.012, 0.012)], name: 'coffee' });
    add(c, cylinder(0.011, 0.008, 0.0016, 24, 1), m.ceramic('#FFFFFF'), { name: 'saucer' });
    add(c, lathe(spline([[0, 0], [0.0042, 0], [0.006, 0.004], [0.0064, 0.0085], [0.0056, 0.0086], [0.0052, 0.0045], [0, 0.0012]], 24), 24), m.ceramic('#FFFFFF'), { p: [0, 0.001, 0], name: 'cup' });
    add(c, cylinder(0.0053, 0.0053, 0.0005, 20, 1), m.glaze('#8A5A3C'), { p: [0, 0.0078, 0], name: 'coffee' });
    add(c, torus(0.0022, 0.0007, 6, 16), m.ceramic('#FFFFFF'), { p: [side * 0.0068, 0.0058, 0], name: 'handle' });
  }
  return g;
}

function bentwoodChair(ctx, parent, { p, ry, name = 'bentwoodChair' }) {
  const m = ctx.materials;
  const g = group(parent, { p, r: [0, ry, 0], name });
  const wood = m.wood('#6D4A35');
  const seatY = 0.075;
  add(g, cylinder(0.026, 0.026, 0.006, 32, 1), m.wood('#A87A57'), { p: [0, seatY, 0], name: 'seat' });
  add(g, torus(0.026, 0.0026, 6, 40), wood, { p: [0, seatY - 0.003, 0], r: [Math.PI / 2, 0, 0], name: 'seatRing' });
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const top = [sx * 0.019, seatY - 0.004, sz * 0.019];
    add(g, tube([top, [sx * 0.022, seatY * 0.5, sz * 0.022], [sx * 0.026, 0.002, sz * 0.026]], 0.0026, { tubular: 16, radial: 6 }), wood, { name: 'leg' });
  }
  add(g, torus(0.022, 0.0018, 6, 40), wood, { p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0], name: 'legRing' });
  // Bentwood back: a hoop rising from the rear legs, with an inner loop.
  const back = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI;
    back.push([Math.cos(a) * 0.021, seatY + 0.008 + Math.sin(a) * 0.065, -0.024 - Math.sin(a) * 0.006]);
  }
  add(g, tube(back, 0.0026, { tubular: 48, radial: 6 }), wood, { name: 'backHoop' });
  const inner = back.map(([x, y, z]) => [x * 0.6, seatY + 0.012 + (y - seatY - 0.008) * 0.62, z]);
  add(g, tube(inner, 0.0018, { tubular: 40, radial: 6 }), wood, { name: 'backLoop' });
  return g;
}

export default function build(ctx, { seed = 606 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'BlueBookshop';

  const blue = m.plaster('#BFD5EC');
  const navy = m.paintedWood('#2F4A7A');
  const white = m.trim('#FFFDF8');
  const sash = m.paintedWood('#FFFDF8');
  const stone = m.stone('#EEE6DA');
  const gold = m.metal('gold');
  const iron = m.metal('iron');
  const brass = m.metal('brass');
  const flowers = ['#FFFFFF', '#F7D36B', '#F2A7BC', '#BFD5EC', '#FFE9A8'];
  const cafeRoom = { style: 1, wall: '#F6EBDD', accent: '#E8B9A0', glow: 1.3 };
  const home = (k) => ({ style: 0, wall: ['#F4F0E8', '#EEF3FA', '#FBF1EC'][k % 3], accent: ['#9FB8DA', '#F2B8C6', '#F7D36B'][k % 3], glow: 0.95 });

  add(root, moldingLoop(plinth(0.07), W, D), stone, { name: 'plinthCourse' });

  /* ---------- navy shopfront ---------- */
  const shopO = [
    { x: -0.6, y: 0.16, w: 0.56, h: 0.6, kind: 'rect' },
    { x: 0, y: 0, w: 0.36, h: 0.78, kind: 'rect' },
    { x: 0.6, y: 0.16, w: 0.56, h: 0.6, kind: 'rect' },
  ];
  const shop = wallPanel(root, { side: 'front', W, D, y: BASE, height: G_TOP - BASE, thickness: T, openings: shopO, material: navy, name: 'shopfront' });
  for (const [i, o] of [shopO[0], shopO[2]].entries()) {
    buildWindow(ctx, shop, { ...o, trim: navy, sash: navy, panes: [3, 2], casing: 0.03, hood: false, room: cafeRoom, seed: 0.19 + i * 0.37 });
    const riser = group(shop, { p: [o.x, 0.075, 0], name: 'stallRiser' });
    add(riser, roundedBox(o.w + 0.06, 0.12, 0.018, 0.004, 3), navy, { p: [0, 0, 0.009], name: 'panel' });
    add(riser, moldingRun(bead(0.008), o.w), gold, { p: [-o.w / 2, 0.052, 0.018], name: 'giltBead' });
  }
  buildDoor(ctx, shop, { ...shopO[1], trim: navy, material: navy, metal: brass, stone, glazed: true, room: { ...cafeRoom, glow: 1.4 }, casing: 0.03, steps: 2, seed: 0.47 });
  // Pilasters with gilded capitals between the bays.
  for (const x of [-0.94, -0.26, 0.26, 0.94]) {
    add(shop, roundedBox(0.07, 0.8, 0.03, 0.004, 3), navy, { p: [x, 0.42, 0.015], name: 'pilaster' });
    add(shop, roundedBox(0.084, 0.03, 0.04, 0.004, 2), gold, { p: [x, 0.82, 0.02], name: 'capital' });
    add(shop, roundedBox(0.084, 0.04, 0.038, 0.004, 2), navy, { p: [x, 0.04, 0.019], name: 'pilasterBase' });
  }
  // Fascia with a gilt coffee-cup emblem pressed flat against it (no lettering).
  add(shop, roundedBox(W + 0.03, 0.1, 0.036, 0.005, 3), navy, { p: [0, 0.875, 0.018], name: 'fascia' });
  for (const y of [0.828, 0.922]) add(shop, moldingRun(bead(0.01), W - 0.04), gold, { p: [-(W - 0.04) / 2, y - 0.005, 0.036], name: 'giltBead' });
  coffeeCup(ctx, shop, { size: 0.07, p: [0, 0.87, 0.042], s: [1, 1, 0.22], gilt: true, name: 'cupEmblem' });
  add(shop, moldingRun(cornice(0.055), W + 0.08), navy, { p: [-(W + 0.08) / 2, 0.925, 0], name: 'shopCornice' });
  for (const x of [-0.26, 0.26]) wallLantern(ctx, shop, { x, y: 0.62, z: 0.03, brass, iron });

  /* ---------- coffee-cup sign on a scrolled bracket ---------- */
  // Mounted on the corner pilaster under the fascia, clear of the balcony above.
  const bracket = group(root, { p: [W / 2 - 0.03, BASE + 0.79, D / 2 + 0.03], name: 'signBracket' });
  add(bracket, roundedBox(0.04, 0.12, 0.01, 0.003, 2), iron, { p: [0, 0, 0.005], name: 'plate' });
  add(bracket, roundedBox(0.01, 0.01, 0.27, 0.003, 2), iron, { p: [0, 0.045, 0.135], name: 'arm' });
  add(bracket, tube([[0, -0.045, 0.01], [0, -0.01, 0.08], [0, 0.03, 0.17], [0, 0.04, 0.22]], 0.0035, { tubular: 48, radial: 8 }), iron, { name: 'brace' });
  add(bracket, sphere(0.009, 16, 12), gold, { p: [0, 0.045, 0.274], name: 'knob' });
  const pivot = group(bracket, { p: [0, 0.04, 0.17], name: 'signPivot' });
  for (const dz of [-0.03, 0.03]) add(pivot, roundedBox(0.003, 0.04, 0.003, 0.001, 1), iron, { p: [0, -0.02, dz], name: 'hanger' });
  coffeeCup(ctx, pivot, { size: 0.1, p: [0, -0.1, 0], r: [0, Math.PI / 2, 0], name: 'signCup' });
  const swing = new Pendulum({ length: 0.11, damping: 0.6 });
  const pivotWorld = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const force = { x: 0, y: 0, z: 0 };
  ctx.physics.add({
    step(dt, world) {
      world.wind.sample(pivotWorld.x, pivotWorld.y, pivotWorld.z, world.time, force);
      swing.external = ((force.x * axis.x + force.z * axis.z) * 0.2) / swing.length;
      swing.step(dt);
    },
  });

  /* ---------- café terrace ---------- */
  // Furniture is drawn at the same stylised scale as the architecture's doors and windows.
  const terrace = group(root, { p: [0, 0, D / 2 + 0.36], s: 1.45, name: 'cafeTerrace' });
  for (const [i, x] of [-0.43, 0.43].entries()) {
    bistroTable(ctx, terrace, { p: [x, 0, 0], rng, name: `table-${i}` });
    bentwoodChair(ctx, terrace, { p: [x - 0.085, 0, 0.01], ry: Math.PI / 2 + 0.2, name: 'chair' });
    bentwoodChair(ctx, terrace, { p: [x + 0.085, 0, -0.01], ry: -Math.PI / 2 - 0.15, name: 'chair' });
  }
  // A chalkboard by the door: a steaming cup, no words.
  const easel = buildSignEasel(ctx, { motif: 'cup' });
  easel.position.set(0.27, 0, D / 2 + 0.2);
  easel.rotation.y = -0.35;
  easel.scale.setScalar(1.1);
  root.add(easel);

  /* ---------- upper floors ---------- */
  const shopSide = [{ x: 0, y: 0.2, w: 0.44, h: 0.56, kind: 'rect' }];
  for (const side of ['left', 'right']) {
    const wall = wallPanel(root, { side, W, D, y: BASE, height: G_TOP - BASE, thickness: T, openings: shopSide, material: blue });
    buildWindow(ctx, wall, { ...shopSide[0], trim: white, sash, panes: [3, 2], casing: 0.036, room: cafeRoom, seed: side === 'left' ? 0.55 : 0.65 });
  }
  const backShop = [{ x: 0.5, y: 0, w: 0.3, h: 0.74, kind: 'rect' }, { x: -0.4, y: 0.22, w: 0.4, h: 0.5, kind: 'rect' }];
  const back0 = wallPanel(root, { side: 'back', W, D, y: BASE, height: G_TOP - BASE, thickness: T, openings: backShop, material: blue, name: 'backShop' });
  buildDoor(ctx, back0, { ...backShop[0], trim: white, material: navy, metal: brass, stone, glazed: false, casing: 0.04, steps: 2, seed: 0.73 });
  buildWindow(ctx, back0, { ...backShop[1], trim: white, sash, panes: [3, 2], casing: 0.036, room: cafeRoom, seed: 0.81 });

  const xs = [-0.62, 0, 0.62];
  const f1 = xs.map((x) => ({ x, y: 0.12, w: 0.34, h: 0.58, kind: 'rect' }));
  const f2 = xs.map((x) => ({ x, y: 0.1, w: 0.3, h: 0.46, kind: 'rect' }));
  const front1 = wallPanel(root, { side: 'front', W, D, y: G_TOP, height: F1_TOP - G_TOP, thickness: T, openings: f1, material: blue, name: 'firstFloor' });
  f1.forEach((o, i) => buildWindow(ctx, front1, { ...o, trim: white, sash, panes: [2, 4], casing: 0.042, sill: false, room: home(i), seed: 0.11 + i * 0.13 }));
  // Long iron balcony across the first floor.
  const bal = group(front1, { name: 'balcony' });
  add(bal, roundedBox(W - 0.08, 0.03, 0.15, 0.005, 3), stone, { p: [0, 0.105, 0.075], name: 'slab' });
  for (const cx of [-0.88, -0.31, 0.31, 0.88]) add(bal, roundedBox(0.04, 0.06, 0.13, 0.006, 3), stone, { p: [cx, 0.06, 0.065], name: 'corbel' });
  railing(ctx, bal, { from: [-(W - 0.12) / 2, 0.12, 0.135], to: [(W - 0.12) / 2, 0.12, 0.135], height: 0.13, spacing: 0.022, metal: iron, scrolls: true, newels: true });
  for (const sx of [-1, 1]) railing(ctx, bal, { from: [sx * ((W - 0.12) / 2), 0.12, 0.135], to: [sx * ((W - 0.12) / 2), 0.12, 0.012], height: 0.13, spacing: 0.022, metal: iron, scrolls: false, newels: false });
  const front2 = wallPanel(root, { side: 'front', W, D, y: F1_TOP, height: EAVE - F1_TOP, thickness: T, openings: f2, material: blue, name: 'secondFloor' });
  f2.forEach((o, i) => buildWindow(ctx, front2, { ...o, trim: white, sash, panes: [2, 3], casing: 0.04, room: home(i + 1), seed: 0.37 + i * 0.09, shutters: navy, box: { material: navy, palette: flowers } }));

  for (const side of ['left', 'right']) {
    const o1 = [-0.42, 0.42].map((x) => ({ x, y: 0.14, w: 0.3, h: 0.52, kind: 'rect' }));
    const w1 = wallPanel(root, { side, W, D, y: G_TOP, height: F1_TOP - G_TOP, thickness: T, openings: o1, material: blue, name: `first-${side}` });
    o1.forEach((o, i) => buildWindow(ctx, w1, { ...o, trim: white, sash, panes: [2, 3], casing: 0.038, room: home(i), seed: (side === 'left' ? 0.21 : 0.31) + i * 0.04, shutters: navy }));
    const o2 = [-0.42, 0.42].map((x) => ({ x, y: 0.12, w: 0.28, h: 0.44, kind: 'rect' }));
    const w2 = wallPanel(root, { side, W, D, y: F1_TOP, height: EAVE - F1_TOP, thickness: T, openings: o2, material: blue, name: `second-${side}` });
    o2.forEach((o, i) => buildWindow(ctx, w2, { ...o, trim: white, sash, panes: [2, 2], casing: 0.036, room: home(i + 2), seed: (side === 'left' ? 0.41 : 0.51) + i * 0.04, shutters: navy }));
  }
  const b1 = xs.map((x) => ({ x, y: 0.14, w: 0.3, h: 0.52, kind: 'rect' }));
  const back1 = wallPanel(root, { side: 'back', W, D, y: G_TOP, height: F1_TOP - G_TOP, thickness: T, openings: b1, material: blue, name: 'backFirst' });
  b1.forEach((o, i) => buildWindow(ctx, back1, { ...o, trim: white, sash, panes: [2, 3], casing: 0.038, room: home(i), seed: 0.61 + i * 0.05 }));
  const b2 = xs.map((x) => ({ x, y: 0.12, w: 0.28, h: 0.44, kind: 'rect' }));
  const back2 = wallPanel(root, { side: 'back', W, D, y: F1_TOP, height: EAVE - F1_TOP, thickness: T, openings: b2, material: blue, name: 'backSecond' });
  b2.forEach((o, i) => buildWindow(ctx, back2, { ...o, trim: white, sash, panes: [2, 2], casing: 0.036, room: home(i + 1), seed: 0.71 + i * 0.05, shutters: navy }));

  add(root, moldingLoop(stringCourse(0.03), W, D), white, { p: [0, G_TOP - 0.012, 0], name: 'shopCourse' });
  add(root, moldingLoop(stringCourse(0.028), W, D), white, { p: [0, F1_TOP - 0.012, 0], name: 'storeyCourse' });
  add(root, moldingLoop(cornice(0.085), W, D), white, { p: [0, EAVE, 0], name: 'eaveCornice' });

  /* ---------- hipped roof with a dormer ---------- */
  const roofY = EAVE + 0.085 * 0.74;
  const We = W + 2 * OVERHANG;
  const De = D + 2 * OVERHANG;
  const dormerHalf = 0.17;
  const roof = hipRoof(root, {
    W: We,
    D: De,
    pitch: ROOF_PITCH,
    tile: { geometry: slateGeometry(0.064, 0.084, 0.007, 'square'), material: m.terracotta('#FFFFFF'), colors: TILES, tileW: 0.064, exposure: 0.038 },
    body: m.terracotta('#D9957A'),
    ridge: { material: m.terracotta('#FFFFFF'), colors: ['#D68F72', '#DC9A7C'], radius: 0.024 },
    rng,
    exclude: { front: (x, y) => Math.abs(x) < dormerHalf - 0.03 && y > 0.06 && y < 0.5 },
    name: 'roof',
  });
  roof.group.position.y = roofY;

  // Round-headed dormer on the street face.
  const dy = 0.06;
  const dz = De / 2 - dy / Math.tan(ROOF_PITCH);
  const dormer = group(root, { p: [0, roofY + dy, dz - 0.01], name: 'dormer' });
  const dOpen = { x: 0, y: 0.06, w: 0.18, h: 0.3, kind: 'round' };
  add(dormer, wallSlab(2 * dormerHalf, 0.42, 0.04, [dOpen]), white, { name: 'face' });
  buildWindow(ctx, dormer, { ...dOpen, trim: white, sash, panes: [2, 2], casing: 0.028, room: home(2), seed: 0.93, keystone: true });
  const hood = cylinder(dormerHalf + 0.02, dormerHalf + 0.02, 0.46, 48, 1, false, Math.PI / 2, Math.PI);
  add(dormer, hood, m.sheetMetal('#B9C2CF'), { p: [0, 0.42, -0.2], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.55], name: 'hood' });
  for (const side of [-1, 1]) add(dormer, roundedBox(0.024, 0.42, 0.44, 0.005, 2), white, { p: [side * (dormerHalf - 0.012), 0.21, -0.22], name: 'cheek' });
  add(dormer, sphere(0.014, 16, 12), gold, { p: [0, 0.42 + (dormerHalf + 0.02) * 0.55 + 0.01, 0.0], name: 'finial' });

  chimney(root, { x: -0.5, z: -0.2, y0: roofY + 0.25, y1: roofY + roof.height + 0.3, w: 0.18, d: 0.26, plaster: blue, trim: white, clay: m.terracotta('#D9826A'), pots: 2, rng });

  root.userData.update = () => {
    pivot.updateWorldMatrix(true, false);
    pivotWorld.setFromMatrixPosition(pivot.matrixWorld);
    // The sign hangs square to the wall (faces along x), so it swings about the bracket arm.
    axis.setFromMatrixColumn(pivot.matrixWorld, 0).normalize();
    pivot.rotation.z = swing.theta;
  };
  root.userData.footprint = { w: W, d: D };
  return root;
}
