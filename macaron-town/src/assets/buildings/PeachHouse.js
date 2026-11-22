import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, lathe, spline, tube, sphere } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop, moldingRun, moldingPlan } from '../../kit/sweep.js';
import { plinth, cornice, stringCourse, crown } from '../../kit/profiles.js';
import { wallFromShape, wallSlab } from '../../kit/wall.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { gutter } from '../../kit/roofs.js';
import { railing } from '../../kit/railings.js';
import { wallPanel, gableRoof, chimney, wallLantern } from '../../kit/building.js';

// B04 — Peach house: a tall, narrow townhouse of the pastel row. Peach stucco under a steep front
// gable of coral barrel tiles with white gingerbread bargeboards and an apex finial; a canted bay
// window on the ground floor whose roof is the first-floor balcony; teal shutters, window boxes of
// geraniums, a hooded front door and a lantern.

const W = 1.9;
const D = 1.75;
const T = 0.07;
const BASE = 0.068;
const G_TOP = 0.98;
const EAVE = 1.86;
const PITCH = (47 * Math.PI) / 180;
const RISE = (W / 2) * Math.tan(PITCH);
const EAVE_OUT = 0.09;
const VERGE = 0.085;
const BX = 0.33; // bay window centre
const BAY_P = 0.22;
const BAY_FW = 0.42;
const BAY_H = 0.84;
const TILES = ['#E08C72', '#D9826A', '#E69A80', '#D47B63', '#E39177'];

// Front or back wall: storeys plus the gable triangle, cut with every opening.
function gableWall(height, openings) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, height);
  s.lineTo(0, height + RISE - 0.002);
  s.lineTo(-W / 2, height);
  s.closePath();
  return wallFromShape(s, T, openings);
}

// White gingerbread fringe hanging under one rake of the front bargeboards.
function gingerbread(parent, { side, z, material }) {
  const g = group(parent, { name: 'gingerbread' });
  const c = Math.cos(PITCH);
  const s = Math.sin(PITCH);
  const x0 = side * (W / 2 + EAVE_OUT);
  const y0 = EAVE - EAVE_OUT * Math.tan(PITCH);
  const L = (W / 2 + EAVE_OUT) / c;
  const dir = new THREE.Vector2(-side * c, s);
  // Perpendicular to the rake, pointing down into the gable (where the fringe hangs).
  const below = new THREE.Vector2(-dir.y * side, dir.x * side);
  const scallop = new THREE.Shape();
  scallop.moveTo(-0.021, 0);
  scallop.absarc(0, 0, 0.021, Math.PI, Math.PI * 2, false);
  scallop.lineTo(-0.021, 0);
  const geo = new THREE.ExtrudeGeometry(scallop, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 16 });
  const angle = Math.atan2(dir.y, dir.x);
  const count = Math.floor((L - 0.06) / 0.046);
  for (let i = 0; i < count; i++) {
    const t = 0.05 + i * 0.046;
    const px = x0 + dir.x * t + below.x * 0.032;
    const py = y0 + dir.y * t + below.y * 0.032;
    const piece = add(g, geo, material, { p: [px, py, z], name: 'scallop' });
    piece.rotation.z = angle + (side > 0 ? Math.PI : 0);
  }
  return g;
}

export default function build(ctx, { seed = 404 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'PeachHouse';

  const peach = m.plaster('#FAD0B8');
  const white = m.trim('#FFFCF7');
  const teal = m.paintedWood('#7CC3BC');
  const sash = m.paintedWood('#FFFCF7');
  const stone = m.stone('#EFE2D3');
  const iron = m.metal('iron');
  const brass = m.metal('brass');
  const copper = m.metal('copper');
  const geraniums = ['#F06C7E', '#F48FA0', '#FFFFFF', '#F5A0B4', '#E9566F'];
  const room = (k, glow = 0.95) => ({ style: 0, wall: ['#FBEFE6', '#EEF5F3', '#FAF1F6'][k % 3], accent: ['#7CC3BC', '#F2B8C6', '#F6D7A8'][k % 3], glow });

  add(root, moldingLoop(plinth(0.07), W, D), stone, { name: 'plinthCourse' });

  /* ---------- front gable wall ---------- */
  const wallH = EAVE - BASE;
  const fo = {
    door: { x: -0.55, y: 0, w: 0.34, h: 0.76, kind: 'rect' },
    up: { x: -0.55, y: 1.0, w: 0.32, h: 0.5, kind: 'rect' },
    french: { x: BX, y: 0.95, w: 0.36, h: 0.62, kind: 'rect' },
    attic: { x: 0, y: wallH + 0.17, w: 0.26, h: 0.26, kind: 'circle' },
  };
  const front = group(root, { p: [0, BASE, D / 2], name: 'frontWall' });
  add(front, gableWall(wallH, Object.values(fo)), peach, { name: 'slab' });
  buildDoor(ctx, front, { ...fo.door, trim: white, material: teal, metal: brass, stone, glazed: false, casing: 0.045, steps: 2, hood: true, seed: 0.33 });
  buildWindow(ctx, front, { ...fo.up, trim: white, sash, panes: [2, 3], casing: 0.04, room: room(0), seed: 0.17, shutters: teal, box: { material: teal, palette: geraniums } });
  buildWindow(ctx, front, { ...fo.french, trim: white, sash, panes: [2, 4], casing: 0.04, sill: false, room: room(1, 1.0), seed: 0.29 });
  buildWindow(ctx, front, { ...fo.attic, trim: white, sash, panes: [2, 2], casing: 0.034, room: room(2), seed: 0.47 });
  wallLantern(ctx, front, { x: -0.27, y: 0.6, brass, iron });
  add(front, moldingRun(stringCourse(0.03), W), white, { p: [-W / 2, G_TOP - BASE - 0.014, 0], name: 'frontCourse' });

  /* ---------- canted bay window ---------- */
  const bay = group(root, { p: [0, BASE, 0], name: 'bayWindow' });
  const zf = D / 2 + BAY_P;
  const hw = BAY_FW / 2;
  const reach = hw + BAY_P;
  const diag = Math.hypot(BAY_P, BAY_P);
  const faces = [
    { name: 'front', c: [BX, zf], ry: 0, width: BAY_FW, open: { x: 0, y: 0.18, w: 0.3, h: 0.5, kind: 'rect' }, panes: [2, 3] },
    { name: 'left', c: [BX - hw - BAY_P / 2, D / 2 + BAY_P / 2], ry: -Math.PI / 4, width: diag, open: { x: 0, y: 0.18, w: 0.15, h: 0.5, kind: 'rect' }, panes: [1, 3] },
    { name: 'right', c: [BX + hw + BAY_P / 2, D / 2 + BAY_P / 2], ry: Math.PI / 4, width: diag, open: { x: 0, y: 0.18, w: 0.15, h: 0.5, kind: 'rect' }, panes: [1, 3] },
  ];
  faces.forEach((f, i) => {
    const face = group(bay, { p: [f.c[0], 0, f.c[1]], r: [0, f.ry, 0], name: `${f.name}Face` });
    add(face, wallSlab(f.width, BAY_H, 0.05, [f.open]), peach, { name: 'slab' });
    buildWindow(ctx, face, { ...f.open, trim: white, sash, panes: f.panes, casing: 0.024, hood: false, room: room(i + 1, 1.05), seed: 0.61 + i * 0.07 });
  });
  // Corner posts at the bay's angles and where it meets the house.
  const plan = [[BX - reach, D / 2], [BX - hw, zf], [BX + hw, zf], [BX + reach, D / 2]];
  const postAngles = [-Math.PI / 4, -Math.PI / 8, Math.PI / 8, Math.PI / 4];
  plan.forEach(([x, z], i) => add(bay, roundedBox(0.036, BAY_H, 0.036, 0.006, 3), white, { p: [x, BAY_H / 2, z + (i === 0 || i === 3 ? 0.012 : 0)], r: [0, postAngles[i], 0], name: 'post' }));
  // Mouldings run on into the house wall so their open ends are buried in the masonry.
  const buried = [[plan[0][0] - 0.035, D / 2 - 0.035], ...plan, [plan[3][0] + 0.035, D / 2 - 0.035]];
  add(bay, moldingPlan(plinth(0.055), buried), stone, { p: [0, -0.066, 0], name: 'bayPlinth' });
  add(bay, moldingPlan(cornice(0.045), buried), white, { p: [0, BAY_H - 0.004, 0], name: 'bayCornice' });
  const top = new THREE.Shape();
  top.moveTo(plan[0][0], -(D / 2 - 0.02));
  for (const [x, z] of plan) top.lineTo(x, -z);
  top.lineTo(plan[3][0], -(D / 2 - 0.02));
  top.closePath();
  const deck = new THREE.ExtrudeGeometry(top, { depth: 0.02, bevelEnabled: false }).rotateX(-Math.PI / 2);
  add(bay, deck, stone, { p: [0, BAY_H + 0.045 * 0.74 - 0.012, 0], name: 'balconyDeck' });
  const rail = group(bay, { p: [0, BAY_H + 0.045 * 0.74 + 0.008, 0], name: 'balconyRail' });
  const railPts = [[BX - reach + 0.03, D / 2 + 0.02], [BX - hw + 0.008, zf - 0.024], [BX + hw - 0.008, zf - 0.024], [BX + reach - 0.03, D / 2 + 0.02]];
  for (let i = 0; i < 3; i++) railing(ctx, rail, { from: [railPts[i][0], 0, railPts[i][1]], to: [railPts[i + 1][0], 0, railPts[i + 1][1]], height: 0.12, spacing: 0.02, metal: iron, scrolls: true, newels: false });
  // One newel at each angle of the balcony, shared by the runs that meet there.
  for (const [x, z] of railPts) {
    add(rail, roundedBox(0.016, 0.13, 0.016, 0.003, 2), iron, { p: [x, 0.065, z], name: 'newel' });
    add(rail, sphere(0.011, 20, 14), iron, { p: [x, 0.138, z], name: 'newelKnob' });
  }

  /* ---------- side and back walls ---------- */
  for (const side of ['left', 'right']) {
    const o = [
      { x: -0.4, y: 0.18, w: 0.3, h: 0.5, kind: 'rect' },
      { x: 0.4, y: 0.18, w: 0.3, h: 0.5, kind: 'rect' },
      { x: -0.4, y: 1.0, w: 0.28, h: 0.46, kind: 'rect' },
      { x: 0.4, y: 1.0, w: 0.28, h: 0.46, kind: 'rect' },
    ];
    const wall = wallPanel(root, { side, W, D, y: BASE, height: wallH, thickness: T, openings: o, material: peach });
    o.forEach((oo, i) => buildWindow(ctx, wall, { ...oo, trim: white, sash, panes: [2, 3], casing: 0.038, room: room(i), seed: (side === 'left' ? 0.2 : 0.3) + i * 0.05, shutters: i >= 2 ? teal : null, box: i < 2 && side === 'right' ? { material: teal, palette: geraniums } : null }));
    add(wall, moldingRun(stringCourse(0.03), D - 2 * T), white, { p: [-(D - 2 * T) / 2, G_TOP - BASE - 0.014, 0], name: 'sideCourse' });
    add(wall, moldingRun(crown(0.05), D + 0.02), white, { p: [-(D + 0.02) / 2, EAVE - BASE - 0.092, 0], name: 'eaveCrown' });
  }
  const bo = [
    { x: 0.45, y: 0, w: 0.3, h: 0.74, kind: 'rect' },
    { x: -0.4, y: 0.18, w: 0.34, h: 0.5, kind: 'rect' },
    { x: -0.4, y: 1.0, w: 0.3, h: 0.48, kind: 'rect' },
    { x: 0.4, y: 1.0, w: 0.3, h: 0.48, kind: 'rect' },
    { x: 0, y: wallH + 0.17, w: 0.24, h: 0.24, kind: 'circle' },
  ];
  const back = group(root, { p: [0, BASE, -D / 2], r: [0, Math.PI, 0], name: 'backWall' });
  add(back, gableWall(wallH, bo), peach, { name: 'slab' });
  buildDoor(ctx, back, { ...bo[0], trim: white, material: teal, metal: brass, stone, glazed: true, room: room(1), casing: 0.04, steps: 2, seed: 0.77 });
  bo.slice(1).forEach((o, i) => buildWindow(ctx, back, { ...o, trim: white, sash, panes: o.kind === 'circle' ? [2, 2] : [2, 3], casing: 0.036, room: room(i + 2), seed: 0.81 + i * 0.03, shutters: i === 1 || i === 2 ? teal : null }));
  add(back, moldingRun(stringCourse(0.03), W), white, { p: [-W / 2, G_TOP - BASE - 0.014, 0], name: 'backCourse' });

  /* ---------- barrel-tile gable roof ---------- */
  const roof = gableRoof(root, {
    length: D,
    span: W,
    pitch: PITCH,
    eave: EAVE_OUT,
    verge: VERGE,
    tile: { barrel: true, tileW: 0.074, tileL: 0.12, overlap: 0.32, material: m.terracotta('#FFFFFF'), colors: TILES },
    deck: m.paintedWood('#FFFCF7'),
    trim: white,
    ridge: { material: m.terracotta('#FFFFFF'), colors: ['#D47B63', '#DD8B70'], radius: 0.05, pieceLength: 0.11 },
    rng,
    name: 'roof',
  });
  roof.group.position.y = EAVE;
  roof.group.rotation.y = Math.PI / 2;

  // Gingerbread fringe, apex finial and pendant on the front gable.
  for (const side of [-1, 1]) gingerbread(root, { side, z: D / 2 + VERGE + 0.002, material: white });
  const finial = lathe(spline([[0, 0], [0.022, 0], [0.018, 0.04], [0.026, 0.07], [0.012, 0.1], [0.016, 0.13], [0.004, 0.19], [0, 0.2]], 64), 32);
  add(root, finial, white, { p: [0, EAVE + RISE + 0.04, D / 2 + VERGE - 0.01], name: 'apexFinial' });
  const pendant = lathe(spline([[0, 0], [0.018, -0.01], [0.012, -0.05], [0.02, -0.08], [0, -0.12]], 48), 32);
  add(root, pendant, white, { p: [0, EAVE + RISE - 0.05, D / 2 + VERGE - 0.01], name: 'apexPendant' });

  // Copper gutters along both eaves, downpipes at the front corners.
  const yG = EAVE - EAVE_OUT * Math.tan(PITCH) - 0.03;
  for (const sx of [-1, 1]) {
    const xg = sx * (W / 2 + EAVE_OUT + 0.012);
    gutter(root, { from: [xg, yG, D / 2 + VERGE], to: [xg, yG, -D / 2 - VERGE], radius: 0.02, material: copper });
    const z = D / 2 - 0.06;
    const pts = [[xg, yG, z], [xg, yG - 0.04, z], [xg - sx * 0.06, yG - 0.11, z], [sx * (W / 2 + 0.016), yG - 0.17, z], [sx * (W / 2 + 0.016), 0.06, z], [sx * (W / 2 + 0.03), 0.02, z], [sx * (W / 2 + 0.06), 0.008, z]];
    add(root, tube(pts, 0.012, { tubular: 140, radial: 16, tension: 'catmullrom' }), copper, { name: 'downpipe' });
  }

  chimney(root, { x: -0.48, z: -0.32, y0: EAVE + 0.36, y1: EAVE + RISE + 0.26, w: 0.2, d: 0.26, plaster: peach, trim: white, clay: m.terracotta('#D9826A'), pots: 2, rng });

  root.userData.footprint = { w: W, d: D };
  return root;
}
