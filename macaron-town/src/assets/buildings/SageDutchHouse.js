import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, cylinder, sphere, torus, lathe, spline, tube } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop, moldingRun, moldingAlong } from '../../kit/sweep.js';
import { plinth, cornice, stringCourse, crown } from '../../kit/profiles.js';
import { wallFromShape } from '../../kit/wall.js';
import { dutchGable } from '../../kit/shapes.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { slateGeometry, gutter } from '../../kit/roofs.js';
import { wallPanel, gableRoof, chimney, quoins, wallLantern } from '../../kit/building.js';

// B05 — Sage Dutch house: a canal-house of the pastel row. Sage stucco with white dressings, a tall
// curved neck gable with a moulded stone coping, kneelers and ball finials, twin arched attic lights
// under an oculus and a timber hoist beam with its pulley; dusty-rose shutters, lavender window
// boxes, a fanlit butter-yellow door; behind the gable, a blue-grey slate roof.

const W = 1.9;
const D = 1.75;
const T = 0.07;
const BASE = 0.068;
const G_TOP = 0.95;
const EAVE = 1.86;
const GABLE_H = 1.2;
const PITCH = (50 * Math.PI) / 180;
const RISE = (W / 2) * Math.tan(PITCH);
const EAVE_OUT = 0.09;
const BACK_VERGE = 0.08;
const SLATES = ['#7E8A96', '#86929D', '#78838F', '#8D98A3', '#818C99'];

// Coping cross-section (outward from the outline, out of the wall face): it caps the wall top and
// overhangs both faces with a rounded weathering. Counter-clockwise.
function copingProfile() {
  const arc = (cx, cy, r, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  return [[-0.014, -T - 0.016], [0.026, -T - 0.016], ...arc(0.026, -T - 0.004, 0.012, -Math.PI / 2, 0), [0.04, -0.01], ...arc(0.028, 0.008, 0.012, 0, Math.PI / 2), [-0.014, 0.02]];
}

// Ball finial on a moulded pedestal, standing at (x, y) on the coping (wall frame).
function ballFinial(parent, { x, y, z = -T / 2, scale = 1, stone, name = 'ballFinial' }) {
  const g = group(parent, { p: [x, y, z], s: scale, name });
  add(g, roundedBox(0.07, 0.05, 0.07, 0.006, 3), stone, { p: [0, 0.025, 0], name: 'pedestal' });
  add(g, moldingLoop(cornice(0.018), 0.07, 0.07), stone, { p: [0, 0.05, 0], name: 'pedestalCap' });
  add(g, lathe(spline([[0, 0], [0.02, 0], [0.012, 0.016], [0.016, 0.024], [0, 0.026]], 32), 32), stone, { p: [0, 0.064, 0], name: 'neck' });
  add(g, sphere(0.034, 40, 28), stone, { p: [0, 0.118, 0], name: 'ball' });
  return g;
}

export default function build(ctx, { seed = 505 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'SageDutchHouse';

  const sage = m.plaster('#C9DDC1');
  const white = m.trim('#FFFDF8');
  const stone = m.stone('#F6F1E8');
  const rose = m.paintedWood('#E7A9B6');
  const butter = m.paintedWood('#F4DA8E');
  const sash = m.paintedWood('#FFFDF8');
  const oak = m.wood('#B98C64');
  const iron = m.metal('iron');
  const brass = m.metal('brass');
  const zinc = m.metal('zinc');
  const lavender = ['#B9A3E3', '#CDBBF0', '#A88FD8', '#FFFFFF', '#E4D9F7'];
  const room = (k, glow = 0.95) => ({ style: 0, wall: ['#F4F6EE', '#FBF0F2', '#F8F1E4'][k % 3], accent: ['#E7A9B6', '#B9A3E3', '#F4DA8E'][k % 3], glow });

  add(root, moldingLoop(plinth(0.07), W, D), stone, { name: 'plinthCourse' });

  /* ---------- front facade ---------- */
  const fh = EAVE - BASE;
  const fo = [
    { x: 0, y: 0, w: 0.36, h: 0.82, kind: 'round' },
    { x: -0.6, y: 0.2, w: 0.32, h: 0.5, kind: 'rect' },
    { x: 0.6, y: 0.2, w: 0.32, h: 0.5, kind: 'rect' },
    { x: -0.6, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
    { x: 0, y: 1.0, w: 0.32, h: 0.58, kind: 'segmental', rise: 0.06 },
    { x: 0.6, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
  ];
  const front = wallPanel(root, { side: 'front', W, D, y: BASE, height: fh, thickness: T, openings: fo, material: sage, name: 'facade' });
  buildDoor(ctx, front, { ...fo[0], trim: white, material: butter, metal: brass, stone, glazed: false, casing: 0.05, steps: 2, seed: 0.41 });
  fo.slice(1).forEach((o, i) => {
    const centre = i === 3;
    buildWindow(ctx, front, { ...o, trim: white, sash, panes: centre ? [2, 3] : [2, 3], casing: 0.04, room: room(i, centre ? 1.0 : 0.95), seed: 0.13 + i * 0.11, shutters: centre ? null : rose, box: centre ? null : { material: white, palette: lavender }, balcony: centre ? { stone } : null });
  });
  wallLantern(ctx, front, { x: 0.3, y: 0.62, brass, iron });
  add(front, moldingRun(stringCourse(0.03), W), white, { p: [-W / 2, G_TOP - BASE - 0.014, 0], name: 'storeyCourse' });
  add(front, moldingRun(cornice(0.06), W + 0.06), white, { p: [-(W + 0.06) / 2, fh - 0.006, 0], name: 'gableCornice' });
  for (const sx of [-1, 1]) quoins(root, { cx: (sx * W) / 2, cz: D / 2, sx, sz: 1, y0: BASE + 0.005, y1: EAVE - 0.05, course: 0.09, material: stone, rng });

  /* ---------- the neck gable ---------- */
  const gable = group(root, { p: [0, EAVE + 0.06 * 0.74, D / 2], name: 'neckGable' });
  const shape = dutchGable(W, GABLE_H);
  const go = [
    { x: -0.135, y: 0.22, w: 0.2, h: 0.4, kind: 'round' },
    { x: 0.135, y: 0.22, w: 0.2, h: 0.4, kind: 'round' },
    { x: 0, y: 0.83, w: 0.18, h: 0.18, kind: 'circle' },
  ];
  add(gable, wallFromShape(shape, T, go), sage, { name: 'gableWall' });
  go.forEach((o, i) => buildWindow(ctx, gable, { ...o, trim: white, sash, panes: o.kind === 'circle' ? [2, 2] : [1, 2], casing: o.kind === 'circle' ? 0.03 : 0.034, room: room(i + 1, 0.9), seed: 0.61 + i * 0.09, keystone: o.kind === 'round' }));
  add(gable, roundedBox(0.04, 0.4, 0.018, 0.004, 2), white, { p: [0, 0.42, 0.009], name: 'mullionPier' });

  // Coping along the curved outline, from the right shoulder over the top to the left.
  const outline = shape.getPoints(48);
  const start = outline.findIndex((p) => Math.abs(p.x - W / 2) < 1e-6 && Math.abs(p.y) < 1e-6);
  const top = outline.slice(start).filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 1e-5);
  add(gable, moldingAlong(top, copingProfile(), { sharpAngle: 0.6 }), stone, { name: 'coping' });

  // Kneelers: moulded blocks projecting at the shoulders that stop the eaves, each carrying a ball
  // finial beside the rising coping.
  for (const sx of [-1, 1]) {
    const kx = sx * (W / 2 + 0.04);
    add(gable, roundedBox(0.15, 0.26, T + 0.05, 0.008, 3), stone, { p: [kx, -0.03, -T / 2], name: 'kneeler' });
    add(gable, roundedBox(0.17, 0.022, T + 0.07, 0.005, 2), stone, { p: [kx, 0.111, -T / 2], name: 'kneelerCap' });
    ballFinial(gable, { x: sx * (W / 2 + 0.06), y: 0.122, stone, scale: 0.85 });
  }
  const crownY = GABLE_H * 0.7 + W * 0.24;
  ballFinial(gable, { x: 0, y: crownY + 0.03, stone });

  // Timber hoist beam with an iron hook and pulley, under the crown.
  const beamY = 1.13;
  add(gable, roundedBox(0.05, 0.06, 0.26, 0.006, 3), oak, { p: [0, beamY, 0.11], name: 'hoistBeam' });
  add(gable, roundedBox(0.06, 0.012, 0.012, 0.003, 2), iron, { p: [0, beamY + 0.036, 0.2], name: 'strap' });
  add(gable, torus(0.022, 0.006, 10, 32), oak, { p: [0, beamY - 0.06, 0.2], r: [0, Math.PI / 2, 0], name: 'pulleyWheel' });
  add(gable, roundedBox(0.008, 0.07, 0.012, 0.002, 2), iron, { p: [0, beamY - 0.04, 0.2], name: 'pulleyHanger' });
  add(gable, tube([[0, beamY - 0.085, 0.2], [0, beamY - 0.11, 0.2], [0, beamY - 0.13, 0.215], [0, beamY - 0.12, 0.232]], 0.0035, { tubular: 24, radial: 6 }), iron, { name: 'hook' });

  /* ---------- side and back walls ---------- */
  for (const side of ['left', 'right']) {
    const o = [-0.4, 0.4].flatMap((x) => [{ x, y: 0.2, w: 0.3, h: 0.5, kind: 'rect' }, { x, y: 1.0, w: 0.28, h: 0.5, kind: 'rect' }]);
    const wall = wallPanel(root, { side, W, D, y: BASE, height: fh, thickness: T, openings: o, material: sage });
    o.forEach((oo, i) => buildWindow(ctx, wall, { ...oo, trim: white, sash, panes: [2, 3], casing: 0.038, room: room(i + 2), seed: (side === 'left' ? 0.21 : 0.27) + i * 0.05, shutters: rose }));
    add(wall, moldingRun(stringCourse(0.03), D - 2 * T), white, { p: [-(D - 2 * T) / 2, G_TOP - BASE - 0.014, 0], name: 'sideCourse' });
    add(wall, moldingRun(crown(0.05), D - T + 0.02), white, { p: [-(D - T + 0.02) / 2 - T / 2, fh - 0.092, 0], name: 'eaveCrown' });
  }
  const bo = [
    { x: -0.45, y: 0, w: 0.3, h: 0.74, kind: 'rect' },
    { x: 0.4, y: 0.2, w: 0.34, h: 0.5, kind: 'rect' },
    { x: -0.4, y: 1.0, w: 0.3, h: 0.5, kind: 'rect' },
    { x: 0.4, y: 1.0, w: 0.3, h: 0.5, kind: 'rect' },
    { x: 0, y: fh + 0.2, w: 0.24, h: 0.24, kind: 'circle' },
  ];
  const backShape = new THREE.Shape();
  backShape.moveTo(-W / 2, 0);
  backShape.lineTo(W / 2, 0);
  backShape.lineTo(W / 2, fh);
  backShape.lineTo(0, fh + RISE - 0.002);
  backShape.lineTo(-W / 2, fh);
  backShape.closePath();
  const back = group(root, { p: [0, BASE, -D / 2], r: [0, Math.PI, 0], name: 'backWall' });
  add(back, wallFromShape(backShape, T, bo), sage, { name: 'slab' });
  buildDoor(ctx, back, { ...bo[0], trim: white, material: rose, metal: brass, stone, glazed: true, room: room(1), casing: 0.04, steps: 2, seed: 0.83 });
  bo.slice(1).forEach((o, i) => buildWindow(ctx, back, { ...o, trim: white, sash, panes: o.kind === 'circle' ? [2, 2] : [2, 3], casing: 0.036, room: room(i), seed: 0.88 + i * 0.02, shutters: o.kind === 'circle' ? null : rose }));
  add(back, moldingRun(stringCourse(0.03), W), white, { p: [-W / 2, G_TOP - BASE - 0.014, 0], name: 'backCourse' });

  /* ---------- roof behind the gable ---------- */
  const roofLen = D - T + BACK_VERGE;
  const roof = gableRoof(root, {
    length: roofLen,
    span: W,
    pitch: PITCH,
    eave: EAVE_OUT,
    verge: 0,
    tile: { geometry: slateGeometry(0.066, 0.086, 0.007, 'square'), material: m.slate('#FFFFFF'), colors: SLATES, tileW: 0.066, exposure: 0.039 },
    deck: m.paintedWood('#FFFDF8'),
    trim: white,
    ridge: { material: zinc, colors: ['#FFFFFF'], radius: 0.026 },
    rng,
    name: 'roof',
  });
  roof.group.position.set(0, EAVE, (D / 2 - T - D / 2 - BACK_VERGE) / 2);
  roof.group.rotation.y = Math.PI / 2;

  const yG = EAVE - EAVE_OUT * Math.tan(PITCH) - 0.03;
  for (const sx of [-1, 1]) {
    const xg = sx * (W / 2 + EAVE_OUT + 0.012);
    gutter(root, { from: [xg, yG, D / 2 - T - 0.002], to: [xg, yG, -D / 2 - BACK_VERGE], radius: 0.019, material: zinc });
    // Swan-neck downpipe back to the side wall near the rear corner.
    const z = -D / 2 + 0.06;
    const pts = [[xg, yG, z], [xg, yG - 0.04, z], [xg - sx * 0.06, yG - 0.11, z], [sx * (W / 2 + 0.016), yG - 0.17, z], [sx * (W / 2 + 0.016), 0.06, z], [sx * (W / 2 + 0.03), 0.02, z], [sx * (W / 2 + 0.06), 0.008, z]];
    add(root, tube(pts, 0.012, { tubular: 140, radial: 16, tension: 'catmullrom' }), zinc, { name: 'downpipe' });
  }
  chimney(root, { x: 0.42, z: -0.38, y0: EAVE + 0.3, y1: EAVE + RISE + 0.22, w: 0.18, d: 0.26, plaster: sage, trim: white, clay: m.terracotta('#D9826A'), pots: 2, rng });

  root.userData.footprint = { w: W, d: D };
  return root;
}
