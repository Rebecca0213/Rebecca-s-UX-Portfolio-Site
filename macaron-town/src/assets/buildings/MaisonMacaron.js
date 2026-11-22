import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, cylinder, torus, sphere, lathe, spline, tube } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop, moldingRun } from '../../kit/sweep.js';
import { plinth, cornice, stringCourse, bead } from '../../kit/profiles.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { slateGeometry, tilePlane, ridgeCaps, cresting, downpipe } from '../../kit/roofs.js';
import { wallPanel, quoins, frustumGeometry, chimney, wallLantern } from '../../kit/building.js';
import { wallSlab } from '../../kit/wall.js';
import { macaron } from '../../kit/macaron.js';
import { Pendulum } from '../../physics/Pendulum.js';

// B01 — Maison Macaron: a Ladurée-style pâtisserie. Pistachio-green shopfront of panelled wood with
// reeded pilasters, gilded capitals and arched display windows, a fascia crowned by a row of giant
// macarons; rose-pink upper floors with dressed quoins, balconettes and shuttered windows with
// flower boxes; a deep dentilled cornice; a lavender-slate mansard with three bonnet dormers,
// iron cresting and chimneys. A macaron hangs from a wrought-iron bracket and swings in the wind.

const W = 1.9;
const D = 1.75;
const T = 0.07;
const BASE = 0.068; // plinth course = two door steps
const G_TOP = 1.0; // ground floor (shop) top
const COURSE = 1.86; // string course between the upper floors
const EAVE = 2.5; // main cornice
const CORNICE = 0.1;
const ROOF_Y = EAVE + CORNICE * 0.74;
const ROOF_H = 0.56;
const PITCH = (72 * Math.PI) / 180;
const SLATES = ['#A3A0C8', '#ABA8CE', '#9A97BE', '#B0ADD2', '#9E9BC2'];
const DORMER_XS = [-0.6, 0, 0.6];

// Reeded pilaster with a moulded base and a gilded capital, standing on the shopfront.
function pilaster(parent, { x, height, wood, gold }) {
  const g = group(parent, { p: [x, 0, 0], name: 'pilaster' });
  add(g, roundedBox(0.084, 0.05, 0.034, 0.004, 3), wood, { p: [0, 0.025, 0.017], name: 'base' });
  add(g, roundedBox(0.07, height - 0.09, 0.026, 0.004, 3), wood, { p: [0, 0.05 + (height - 0.09) / 2, 0.013], name: 'shaft' });
  for (const rx of [-0.019, 0, 0.019]) {
    add(g, cylinder(0.0055, 0.0055, height - 0.14, 12, 1), wood, { p: [rx, 0.075 + (height - 0.14) / 2, 0.027], name: 'reed' });
  }
  const capY = height - 0.04;
  add(g, roundedBox(0.09, 0.012, 0.038, 0.003, 2), gold, { p: [0, capY, 0.019], name: 'astragal' });
  add(g, roundedBox(0.08, 0.026, 0.034, 0.004, 2), gold, { p: [0, capY + 0.019, 0.017], name: 'bell' });
  for (const side of [-1, 1]) add(g, torus(0.0085, 0.003, 8, 24), gold, { p: [side * 0.036, capY + 0.022, 0.036], name: 'volute' });
  add(g, roundedBox(0.096, 0.01, 0.042, 0.002, 2), gold, { p: [0, capY + 0.037, 0.021], name: 'abacus' });
  return g;
}

export default function build(ctx, { seed = 101 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'MaisonMacaron';

  const pink = m.plaster('#F5C3CE');
  const cream = m.trim('#FFF8EF');
  const stone = m.stone('#F2E7D9');
  const plinthStone = m.stone('#E6D6CF');
  const mint = m.paintedWood('#A6DBC4');
  const sashCream = m.paintedWood('#FFF8EF');
  const gold = m.metal('gold');
  const iron = m.metal('iron');
  const brass = m.metal('brass');
  const zinc = m.metal('zinc');
  const flowers = ['#F7A8BE', '#FFFFFF', '#F28CA6', '#FFD1DC', '#FBE3EA'];

  /* ---------- base and ground-floor shop ---------- */
  add(root, moldingLoop(plinth(0.07), W, D), plinthStone, { name: 'plinthCourse' });

  const shopOpenings = [
    { x: -0.6, y: 0.2, w: 0.44, h: 0.56, kind: 'round' },
    { x: 0, y: 0, w: 0.38, h: 0.74, kind: 'round' },
    { x: 0.6, y: 0.2, w: 0.44, h: 0.56, kind: 'round' },
  ];
  const shop = wallPanel(root, { side: 'front', W, D, y: BASE, height: G_TOP - BASE, thickness: T, openings: shopOpenings, material: mint, name: 'shopfront' });
  const shopRoom = { style: 1, wall: '#FBE8EE', accent: '#F5B5C6', glow: 1.25 };
  for (const [i, o] of [shopOpenings[0], shopOpenings[2]].entries()) {
    buildWindow(ctx, shop, { ...o, trim: mint, sash: sashCream, panes: [3, 3], casing: 0.032, room: shopRoom, seed: 0.17 + i * 0.31, keystone: false, hood: false });
    // Stall riser beneath each display window: a fielded panel framed in gilt beads.
    const riser = group(shop, { p: [o.x, 0.1, 0], name: 'stallRiser' });
    add(riser, roundedBox(0.4, 0.12, 0.014, 0.004, 3), mint, { p: [0, 0, 0.007], name: 'field' });
    for (const [w, h, px, py] of [[0.4, 0.006, 0, 0.063], [0.4, 0.006, 0, -0.063], [0.006, 0.132, 0.203, 0], [0.006, 0.132, -0.203, 0]]) {
      add(riser, roundedBox(w, h, 0.006, 0.002, 2), gold, { p: [px, py, 0.016], name: 'gilt' });
    }
  }
  buildDoor(ctx, shop, { ...shopOpenings[1], trim: mint, material: mint, metal: brass, stone, double: true, glazed: true, room: { ...shopRoom, glow: 1.35 }, casing: 0.045, steps: 2, seed: 0.53 });

  for (const x of [-0.905, -0.29, 0.29, 0.905]) pilaster(shop, { x, height: 0.76, wood: mint, gold });
  for (const x of [-0.29, 0.29]) wallLantern(ctx, shop, { x, y: 0.56, z: 0.027, brass, iron });

  // Fascia: architrave, gilt-framed board with a macaron cartouche (no lettering), and cornice.
  add(shop, roundedBox(W + 0.03, 0.03, 0.034, 0.004, 3), mint, { p: [0, 0.775, 0.017], name: 'architrave' });
  add(shop, roundedBox(W + 0.03, 0.11, 0.036, 0.005, 3), mint, { p: [0, 0.85, 0.018], name: 'fasciaBoard' });
  for (const y of [0.798, 0.902]) add(shop, moldingRun(bead(0.012), W - 0.02), gold, { p: [-(W - 0.02) / 2, y - 0.006, 0.036], name: 'giltBead' });
  const cartouche = group(shop, { p: [0, 0.85, 0.038], name: 'cartouche' });
  add(cartouche, torus(0.046, 0.0055, 10, 64), gold, { s: [1.35, 1, 1], name: 'frame' });
  add(cartouche, cylinder(0.046, 0.046, 0.006, 64, 1), m.paintedWood('#FBE3EA'), { r: [Math.PI / 2, 0, 0], s: [1.35, 1, 1], name: 'field' });
  macaron(ctx, cartouche, { radius: 0.03, flavour: 'raspberry', p: [0, 0, 0.012], r: [Math.PI / 2, 0, 0], seed: seed + 1 });
  add(shop, moldingRun(cornice(0.06), W + 0.08), mint, { p: [-(W + 0.08) / 2, 0.905, 0], name: 'shopCornice' });

  // The giant macarons standing along the cornice.
  const corniceTop = 0.905 + 0.06 * 0.74;
  // Each stands on edge, turned so passers-by see the shell, ruffled foot and filling in profile.
  const display = [
    [-0.7, 0.055, 'lavender', 1.05],
    [-0.35, 0.058, 'pistachio', -0.95],
    [0, 0.078, 'rose', 0.62],
    [0.35, 0.058, 'lemon', 0.95],
    [0.7, 0.055, 'raspberry', -1.05],
  ];
  display.forEach(([x, r, flavour, turn], i) => {
    macaron(ctx, shop, {
      radius: r,
      flavour,
      p: [x, corniceTop + r, 0.05],
      r: [Math.PI / 2 + rng.range(-0.05, 0.05), turn, rng.range(-0.04, 0.04), 'YXZ'],
      seed: seed + 10 + i,
      name: `giantMacaron-${flavour}`,
    });
  });

  // Side and back walls of the shop floor.
  const sideShop = [{ x: 0, y: 0.2, w: 0.4, h: 0.56, kind: 'round' }];
  for (const side of ['left', 'right']) {
    const wall = wallPanel(root, { side, W, D, y: BASE, height: G_TOP - BASE, thickness: T, openings: sideShop, material: pink });
    buildWindow(ctx, wall, { ...sideShop[0], trim: mint, sash: sashCream, panes: [3, 3], casing: 0.032, room: shopRoom, seed: side === 'left' ? 0.71 : 0.83, keystone: false });
  }
  const backShop = [
    { x: -0.45, y: 0, w: 0.26, h: 0.62, kind: 'segmental', rise: 0.05 },
    { x: 0.35, y: 0.24, w: 0.34, h: 0.46, kind: 'segmental', rise: 0.05 },
  ];
  const back = wallPanel(root, { side: 'back', W, D, y: BASE, height: G_TOP - BASE, thickness: T, openings: backShop, material: pink });
  buildDoor(ctx, back, { ...backShop[0], trim: cream, material: mint, metal: brass, stone, glazed: false, casing: 0.04, steps: 2, seed: 0.91 });
  buildWindow(ctx, back, { ...backShop[1], trim: cream, sash: sashCream, panes: [2, 2], casing: 0.035, room: { style: 1, glow: 0.9 }, seed: 0.37 });

  /* ---------- upper floors ---------- */
  const upperH = EAVE - G_TOP;
  const f1 = (x, w = 0.3, h = 0.54) => ({ x, y: 0.24, w, h, kind: 'round' });
  const f2 = (x, w = 0.28, h = 0.42) => ({ x, y: 0.98, w, h, kind: 'rect' });
  const homeRoom = (k) => ({ style: 0, wall: ['#F8E8DC', '#F3E6F0', '#EEF2E4'][k % 3], accent: ['#F2B8C6', '#C9D9F0', '#F6D7A8'][k % 3], glow: 0.95 });

  const frontUpper = [f1(-0.6), f1(0), f1(0.6), f2(-0.6), f2(0), f2(0.6)];
  const front = wallPanel(root, { side: 'front', W, D, y: G_TOP, height: upperH, thickness: T, openings: frontUpper, material: pink, name: 'frontUpper' });
  frontUpper.forEach((o, i) => {
    const firstFloor = i < 3;
    buildWindow(ctx, front, {
      ...o,
      trim: cream,
      sash: sashCream,
      panes: firstFloor ? [2, 3] : [2, 2],
      casing: 0.04,
      room: homeRoom(i),
      seed: 0.11 + i * 0.137,
      balcony: firstFloor ? { stone } : null,
      shutters: firstFloor ? null : mint,
      box: firstFloor ? null : { material: mint, palette: flowers },
    });
  });

  for (const side of ['left', 'right']) {
    const openings = [f1(-0.38, 0.28, 0.5), f1(0.38, 0.28, 0.5), f2(-0.38, 0.26, 0.4), f2(0.38, 0.26, 0.4)];
    const wall = wallPanel(root, { side, W, D, y: G_TOP, height: upperH, thickness: T, openings, material: pink });
    openings.forEach((o, i) => {
      buildWindow(ctx, wall, { ...o, trim: cream, sash: sashCream, panes: [2, 2], casing: 0.036, room: homeRoom(i + 1), seed: (side === 'left' ? 0.3 : 0.6) + i * 0.071, shutters: mint, box: i >= 2 && side === 'right' ? { material: mint, palette: flowers } : null });
    });
  }
  const backUpper = [f1(-0.6, 0.28, 0.5), f1(0, 0.28, 0.5), f1(0.6, 0.28, 0.5), f2(-0.6, 0.26, 0.4), f2(0, 0.26, 0.4), f2(0.6, 0.26, 0.4)];
  const backWall = wallPanel(root, { side: 'back', W, D, y: G_TOP, height: upperH, thickness: T, openings: backUpper, material: pink, name: 'backUpper' });
  backUpper.forEach((o, i) => buildWindow(ctx, backWall, { ...o, trim: cream, sash: sashCream, panes: [2, 2], casing: 0.034, room: homeRoom(i + 2), seed: 0.47 + i * 0.093, shutters: mint }));

  // Courses, quoins and the main cornice with its dentils.
  add(root, moldingLoop(stringCourse(0.036), W, D), cream, { p: [0, G_TOP - 0.014, 0], name: 'shopCourse' });
  add(root, moldingLoop(stringCourse(0.03), W, D), cream, { p: [0, COURSE, 0], name: 'stringCourse' });
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    quoins(root, { cx: (sx * W) / 2, cz: (sz * D) / 2, sx, sz, y0: G_TOP + 0.01, y1: EAVE - 0.02, material: stone, rng });
  }
  add(root, moldingLoop(cornice(CORNICE), W, D), cream, { p: [0, EAVE, 0], name: 'mainCornice' });
  const dentils = [];
  const pitchD = 0.032;
  for (const [len, axis, sx, sz] of [[W, 'x', 0, 1], [W, 'x', 0, -1], [D, 'z', 1, 0], [D, 'z', -1, 0]]) {
    const n = Math.floor((len - 0.04) / pitchD);
    for (let i = 0; i <= n; i++) {
      const t = -((n * pitchD) / 2) + i * pitchD;
      const x = axis === 'x' ? t : (sx * W) / 2 + sx * 0.008;
      const z = axis === 'z' ? t : (sz * D) / 2 + sz * 0.008;
      dentils.push({ p: [x, EAVE - 0.012, z], r: [0, axis === 'x' ? 0 : Math.PI / 2, 0] });
    }
  }
  root.add(instanced(roundedBox(0.016, 0.022, 0.016, 0.003, 2), cream, dentils, { name: 'dentils' }));

  // Wrought-iron bracket with a macaron sign that swings in the wind.
  const bracket = group(front, { p: [0.875, 0.55, 0.012], name: 'signBracket' });
  add(bracket, roundedBox(0.05, 0.13, 0.01, 0.003, 2), iron, { p: [0, 0, 0.005], name: 'wallPlate' });
  add(bracket, roundedBox(0.012, 0.012, 0.32, 0.003, 2), iron, { p: [0, 0.05, 0.16], name: 'arm' });
  add(bracket, tube([[0, -0.05, 0.01], [0, -0.02, 0.09], [0, 0.02, 0.17], [0, 0.044, 0.25]], 0.004, { tubular: 48, radial: 8 }), iron, { name: 'brace' });
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 1.7;
      const r = 0.02 * (1 - i / 30);
      pts.push([0, 0.022 + Math.sin(a) * r, 0.06 + k * 0.07 + Math.cos(a) * r]);
    }
    add(bracket, tube(pts, 0.0022, { tubular: 40, radial: 6 }), iron, { name: 'scroll' });
  }
  add(bracket, sphere(0.011, 16, 12), gold, { p: [0, 0.05, 0.325], name: 'armKnob' });
  const pivot = group(bracket, { p: [0, 0.044, 0.215], name: 'signPivot' });
  for (const dz of [-0.035, 0.035]) {
    add(pivot, torus(0.008, 0.0018, 6, 16), iron, { p: [0, -0.008, dz], r: [0, Math.PI / 2, 0], name: 'ring' });
    add(pivot, roundedBox(0.003, 0.05, 0.003, 0.001, 1), iron, { p: [0, -0.04, dz], name: 'hanger' });
  }
  macaron(ctx, pivot, { radius: 0.11, flavour: 'rose', p: [0, -0.175, 0], r: [0, 0, Math.PI / 2], seed: seed + 50, name: 'signMacaron' });

  const swing = new Pendulum({ length: 0.17, damping: 0.55 });
  const swingAxis = new THREE.Vector3(1, 0, 0);
  const pivotWorld = new THREE.Vector3();
  const force = { x: 0, y: 0, z: 0 };
  ctx.physics.add({
    step(dt, world) {
      world.wind.sample(pivotWorld.x, pivotWorld.y, pivotWorld.z, world.time, force);
      swing.external = ((force.x * swingAxis.x + force.z * swingAxis.z) * 0.22) / swing.length;
      swing.step(dt);
    },
  });

  /* ---------- mansard roof ---------- */
  const roof = group(root, { p: [0, ROOF_Y, 0], name: 'mansard' });
  const We = W + 0.04;
  const De = D + 0.04;
  const inset = ROOF_H / Math.tan(PITCH);
  const W1 = We - 2 * inset;
  const D1 = De - 2 * inset;
  const slopeLen = ROOF_H / Math.sin(PITCH);
  add(roof, frustumGeometry(We, De, W1, D1, ROOF_H), m.slate('#9693BA'), { name: 'roofBody' });
  const c = Math.cos(PITCH);
  const s = Math.sin(PITCH);
  const slate = slateGeometry(0.06, 0.078, 0.006, 'scale');
  const slateMat = m.slate('#FFFFFF');
  // Skip only tiles wholly hidden inside a dormer: between its cheeks and below the line where the
  // bonnet meets the slope (tiles half under a cheek or bonnet stay, so no bare deck shows).
  const underDormer = (x, y) =>
    DORMER_XS.some((dx) => {
      const off = Math.abs(x - dx);
      if (off > 0.12 || y < 0.02) return false;
      const bonnet = 0.03 + 0.36 + 0.1023 * Math.sqrt(Math.max(0, 1 - (off / 0.165) ** 2));
      return y < bonnet / Math.sin(PITCH) - 0.09;
    });
  const faces = [
    { origin: [0, 0, De / 2], u: [1, 0, 0], v: [0, s, -c], n: [0, c, s], width: We, taper: W1 / We, exclude: underDormer },
    { origin: [0, 0, -De / 2], u: [-1, 0, 0], v: [0, s, c], n: [0, c, -s], width: We, taper: W1 / We },
    { origin: [We / 2, 0, 0], u: [0, 0, -1], v: [-c, s, 0], n: [s, c, 0], width: De, taper: D1 / De },
    { origin: [-We / 2, 0, 0], u: [0, 0, 1], v: [c, s, 0], n: [-s, c, 0], width: De, taper: D1 / De },
  ];
  for (const f of faces) {
    tilePlane(roof, {
      origin: new THREE.Vector3(...f.origin),
      u: new THREE.Vector3(...f.u),
      v: new THREE.Vector3(...f.v),
      n: new THREE.Vector3(...f.n),
      width: f.width,
      length: slopeLen,
      taper: f.taper,
      tileW: 0.06,
      exposure: 0.036,
      geometry: slate,
      material: slateMat,
      rng,
      colors: SLATES,
      exclude: f.exclude ?? null,
    });
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    ridgeCaps(roof, { from: [(sx * We) / 2, 0.004, (sz * De) / 2], to: [(sx * W1) / 2, ROOF_H + 0.004, (sz * D1) / 2], radius: 0.021, material: zinc, rng, colors: ['#FFFFFF'] });
  }
  add(roof, frustumGeometry(W1 + 0.03, D1 + 0.03, W1 - 0.3, D1 - 0.3, 0.08), zinc, { p: [0, ROOF_H, 0], name: 'zincDeck' });
  for (const sz of [1, -1]) cresting(roof, { from: [-W1 / 2 + 0.02, ROOF_H + 0.006, (sz * D1) / 2], to: [W1 / 2 - 0.02, ROOF_H + 0.006, (sz * D1) / 2], material: iron, height: 0.07 });

  // Bonnet dormers on the street face.
  for (const [i, x] of DORMER_XS.entries()) {
    const yb = 0.03;
    const dormer = group(roof, { p: [x, yb, De / 2 - yb / Math.tan(PITCH) - 0.004], name: 'dormer' });
    const open = { x: 0, y: 0.07, w: 0.17, h: 0.25, kind: 'round' };
    const face = group(dormer, { name: 'dormerFace' });
    add(face, wallSlab(0.3, 0.36, 0.04, [open]), cream, { name: 'front' });
    buildWindow(ctx, face, { ...open, trim: cream, sash: sashCream, panes: [2, 2], casing: 0.026, room: homeRoom(i), seed: 0.79 + i * 0.05, keystone: true, sill: true });
    for (const side of [-1, 1]) add(dormer, roundedBox(0.03, 0.36, 0.34, 0.006, 3), cream, { p: [side * 0.135, 0.18, -0.17], name: 'cheek' });
    // Upper half-cylinder once turned onto z (theta pi/2..3pi/2 maps to y >= 0).
    const bonnet = cylinder(0.165, 0.165, 0.36, 48, 1, false, Math.PI / 2, Math.PI);
    add(dormer, bonnet, zinc, { p: [0, 0.36, -0.15], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.62], name: 'bonnet' });
    add(dormer, torus(0.165, 0.012, 10, 48, Math.PI), cream, { p: [0, 0.36, 0.012], s: [1, 0.62, 1], name: 'archivolt' });
    add(dormer, sphere(0.014, 16, 12), gold, { p: [0, 0.36 + 0.165 * 0.62 + 0.012, 0.01], name: 'finial' });
  }

  for (const x of [-0.58, 0.58]) chimney(roof, { x, z: -0.22, y0: 0.2, y1: ROOF_H + 0.34, plaster: pink, trim: cream, clay: m.terracotta('#E39A7E'), rng });
  downpipe(root, { top: [W / 2 - 0.09, EAVE - 0.02, -D / 2 - 0.0], bottom: 0, offset: 0.025, material: zinc });

  root.userData.update = () => {
    pivot.updateWorldMatrix(true, false);
    pivotWorld.setFromMatrixPosition(pivot.matrixWorld);
    swingAxis.setFromMatrixColumn(pivot.matrixWorld, 0).normalize();
    pivot.rotation.z = swing.theta;
  };
  root.userData.footprint = { w: W, d: D };
  return root;
}
