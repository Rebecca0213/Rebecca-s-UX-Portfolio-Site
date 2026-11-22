import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, cylinder, torus, sphere, lathe, spline, tube } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop, moldingRun, moldingRing } from '../../kit/sweep.js';
import { plinth, cornice, stringCourse } from '../../kit/profiles.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { slateGeometry, tileRevolution, finial } from '../../kit/roofs.js';
import { stoneBalusterGeometry } from '../../kit/railings.js';
import { wallPanel, voussoirs } from '../../kit/building.js';

// B10 — The welcome centre (one of the town's three venues, with the gallery and the café), in a
// Belle-Époque pavilion. Cream stone ground floor of five tall arched, gilt-fanlit bays between rose-
// marble pilasters; an iron-and-glass marquise over the doors, hung with a garland of pastel pennants;
// a painted map of the island on a board by the entrance, a red pin marking where you stand; a rose
// stucco upper storey with oval windows in garlanded frames; a balustraded roof terrace with urns and
// welcome flags at its front corners; and a central drum carrying a pink fish-scale imperial dome,
// gold ribs and a lantern. No lettering: the map, the flags and the garland say welcome.

const W = 2.2;
const D = 1.95;
const T = 0.07;
const BASE = 0.068;
const G_TOP = 1.16;
const EAVE = 1.98;
const BAYS = [-0.84, -0.42, 0, 0.42, 0.84];
const DRUM_R = 0.5;
const DRUM_H = 0.32;
const DOME_H = 0.62;
const SCALES = ['#F2A9BD', '#EE9DB3', '#F5B4C6', '#EA94AC', '#F3AFC1'];

function balustradeRun(parent, { from, to, stone, height = 0.12 }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const g = group(parent, { name: 'balustrade' });
  g.position.copy(a);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
  add(g, roundedBox(len, 0.016, 0.05, 0.004, 2), stone, { p: [len / 2, 0.008, 0], name: 'plinthRail' });
  add(g, roundedBox(len + 0.01, 0.02, 0.06, 0.006, 3), stone, { p: [len / 2, height, 0], name: 'handrail' });
  const n = Math.max(1, Math.floor((len - 0.06) / 0.034));
  const items = [];
  for (let i = 0; i <= n; i++) items.push({ p: [0.03 + ((len - 0.06) * i) / n, 0.016, 0] });
  g.add(instanced(stoneBalusterGeometry({ height: height - 0.026, radius: 0.0105, radial: 24 }), stone, items, { name: 'balusters' }));
}

function urn(ctx, parent, { p, stone, name = 'urn' }) {
  const g = group(parent, { p, name });
  add(g, roundedBox(0.06, 0.04, 0.06, 0.005, 2), stone, { p: [0, 0.02, 0], name: 'pedestal' });
  add(g, lathe(spline([[0, 0], [0.022, 0], [0.016, 0.012], [0.012, 0.02], [0.03, 0.05], [0.034, 0.075], [0.026, 0.092], [0.032, 0.1], [0.03, 0.106], [0, 0.104]], 64), 40), stone, { p: [0, 0.04, 0], name: 'vase' });
  // A spill of pink blossom in the urn.
  const flowers = [];
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4;
    const r = 0.022 * Math.sqrt(i / 26);
    flowers.push({ p: [Math.cos(a) * r, 0.15 + 0.012 * Math.cos(i), Math.sin(a) * r], s: 0.011, color: ['#F7B6C8', '#FFFFFF', '#F49AB2'][i % 3] });
  }
  return { group: g, flowers };
}

export default function build(ctx, { seed = 1010 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'GrandSalon';

  const stone = m.stone('#FBF5EA');
  const rose = m.plaster('#F5C9D2');
  const cream = m.trim('#FFFBF4');
  const marble = m.stone('#EFB9C6');
  const sash = m.paintedWood('#FFFBF4');
  const gold = m.metal('gold');
  const iron = m.metal('iron');
  const salon = (k) => ({ style: 3, wall: ['#FBEFF1', '#FFF6EA', '#F7F0FA'][k % 3], accent: ['#E8C27A', '#F2B8C6', '#CFE3C8'][k % 3], glow: 1.3 });
  const home = (k) => ({ style: 0, wall: ['#FBF2EE', '#F4F0F8', '#FBF6EA'][k % 3], accent: ['#F2B8C6', '#E8C27A', '#C9D9F0'][k % 3], glow: 1.0 });

  add(root, moldingLoop(plinth(0.07), W, D), stone, { name: 'plinthCourse' });

  /* ---------- arcaded ground floor ---------- */
  const gH = G_TOP - BASE;
  const arch = (x, wide = 0.3) => ({ x, y: 0.08, w: wide, h: 0.86, kind: 'round' });
  const frontO = BAYS.map((x, i) => (i === 2 ? { x, y: 0, w: 0.32, h: 0.94, kind: 'round' } : arch(x)));
  const front0 = wallPanel(root, { side: 'front', W, D, y: BASE, height: gH, thickness: T, openings: frontO, material: stone, name: 'arcade' });
  frontO.forEach((o, i) => {
    voussoirs(front0, { x: o.x, spring: o.y + o.h - o.w / 2, radius: o.w / 2, depth: 0.055, count: 7, material: stone, keyMaterial: gold });
    if (i === 2) buildDoor(ctx, front0, { ...o, trim: cream, material: m.paintedWood('#F7E7EC'), metal: gold, stone, double: true, glazed: true, room: { ...salon(0), glow: 1.45 }, casing: 0, steps: 2, seed: 0.41 });
    else buildWindow(ctx, front0, { ...o, trim: cream, sash, panes: [2, 4], casing: 0, keystone: false, room: salon(i), seed: 0.17 + i * 0.09 });
  });
  // Rose-marble pilasters with gilded capitals between the bays.
  for (const x of [-1.06, -0.63, -0.21, 0.21, 0.63, 1.06]) {
    add(front0, roundedBox(0.07, gH - 0.1, 0.03, 0.004, 3), marble, { p: [x, 0.04 + (gH - 0.1) / 2, 0.015], name: 'pilaster' });
    add(front0, roundedBox(0.086, 0.03, 0.04, 0.004, 2), gold, { p: [x, gH - 0.045, 0.02], name: 'capital' });
    add(front0, roundedBox(0.082, 0.04, 0.038, 0.004, 2), stone, { p: [x, 0.02, 0.019], name: 'pilasterBase' });
  }
  // Marquise: an iron-and-glass canopy fanning out over the doors on scrolled brackets.
  const marquise = group(front0, { p: [0, gH - 0.08, 0], name: 'marquise' });
  const glassMat = m.clearGlass('#D4ECF0', { opacity: 0.26, edge: 0.55, streak: 0 });
  const MW = 0.62;
  const MD = 0.36;
  const pane = new THREE.Shape();
  pane.moveTo(-MW / 2, 0);
  pane.lineTo(MW / 2, 0);
  pane.lineTo(MW / 2 + 0.05, MD);
  pane.quadraticCurveTo(0, MD + 0.08, -MW / 2 - 0.05, MD);
  pane.closePath();
  const paneGeo = new THREE.ExtrudeGeometry(pane, { depth: 0.006, bevelEnabled: false, curveSegments: 24 }).rotateX(Math.PI / 2 - 0.22);
  add(marquise, paneGeo, glassMat, { p: [0, 0.006, 0.012], cast: false, name: 'glass' });
  for (let k = 0; k <= 6; k++) {
    const t = k / 6;
    const x0 = -MW / 2 + MW * t;
    const x1 = (-MW / 2 - 0.05) + (MW + 0.1) * t;
    const z1 = MD + 0.06 * Math.sin(Math.PI * t);
    add(marquise, tube([[x0, 0.004, 0.012], [x1, -Math.sin(0.22) * z1, 0.012 + Math.cos(0.22) * z1]], 0.004, { tubular: 8, radial: 6 }), iron, { name: 'rib' });
  }
  const edge = [];
  for (let k = 0; k <= 24; k++) {
    const t = k / 24;
    const x = (-MW / 2 - 0.05) + (MW + 0.1) * t;
    const z = MD + 0.06 * Math.sin(Math.PI * t);
    edge.push([x, -Math.sin(0.22) * z, 0.012 + Math.cos(0.22) * z]);
  }
  add(marquise, tube(edge, 0.006, { tubular: 64, radial: 8 }), iron, { name: 'frontRail' });
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push([sx * (MW / 2 - 0.02), -0.16 + 0.16 * t + 0.03 * Math.sin(Math.PI * t), 0.01 + 0.3 * t * t]);
    }
    add(marquise, tube(pts, 0.005, { tubular: 40, radial: 8 }), iron, { name: 'bracket' });
    add(marquise, torus(0.022, 0.0035, 8, 32), iron, { p: [sx * (MW / 2 - 0.02), -0.11, 0.05], r: [0, Math.PI / 2, 0], name: 'scroll' });
  }
  add(marquise, moldingRun(cornice(0.02), MW + 0.12), gold, { p: [-(MW + 0.12) / 2, -0.012, 0], name: 'wallPlate' });
  // A welcome garland swagged under the marquise's front rail: a cord and pastel pennants that flutter.
  const railAt = (t, drop) => {
    const z = MD + 0.06 * Math.sin(Math.PI * t);
    return [(-MW / 2 - 0.05) + (MW + 0.1) * t, -Math.sin(0.22) * z - 0.012 - drop * Math.sin(Math.PI * t), 0.018 + Math.cos(0.22) * z];
  };
  const cord = [];
  for (let k = 0; k <= 24; k++) cord.push(railAt(k / 24, 0.055));
  add(marquise, tube(cord, 0.0022, { tubular: 48, radial: 6 }), m.fabric('#FFF7EE'), { cast: false, name: 'garlandCord' });
  const pennantColors = ['#F2A7BC', '#F7D36B', '#A9DCC8', '#BFD5EC', '#FFFFFF', '#C9B8E8'];
  const pennant = new THREE.Shape();
  pennant.moveTo(-0.018, 0);
  pennant.lineTo(0.018, 0);
  pennant.lineTo(0, 0.046);
  pennant.closePath();
  const pennantGeo = new THREE.ShapeGeometry(pennant, 1);
  for (let k = 0; k < 9; k++) {
    const at = railAt((k + 0.5) / 9, 0.055);
    const f = add(marquise, pennantGeo, m.flag(pennantColors[k % pennantColors.length], 0.046), { p: at, r: [0, 0, Math.PI], name: 'garlandPennant' });
    f.castShadow = false;
  }

  // Side and back arcades.
  const sideO = [-0.45, 0.45].map((x) => arch(x));
  for (const side of ['left', 'right']) {
    const wall = wallPanel(root, { side, W, D, y: BASE, height: gH, thickness: T, openings: sideO, material: stone, name: `arcade-${side}` });
    sideO.forEach((o, i) => {
      voussoirs(wall, { x: o.x, spring: o.y + o.h - o.w / 2, radius: o.w / 2, depth: 0.055, count: 7, material: stone, keyMaterial: gold });
      buildWindow(ctx, wall, { ...o, trim: cream, sash, panes: [2, 4], casing: 0, keystone: false, room: salon(i + 1), seed: (side === 'left' ? 0.51 : 0.61) + i * 0.05 });
    });
  }
  const backO = [arch(-0.6), { x: 0.3, y: 0, w: 0.3, h: 0.84, kind: 'round' }, arch(0.84)];
  const back0 = wallPanel(root, { side: 'back', W, D, y: BASE, height: gH, thickness: T, openings: backO, material: stone, name: 'arcadeBack' });
  backO.forEach((o, i) => {
    voussoirs(back0, { x: o.x, spring: o.y + o.h - o.w / 2, radius: o.w / 2, depth: 0.055, count: 7, material: stone, keyMaterial: gold });
    if (i === 1) buildDoor(ctx, back0, { ...o, trim: cream, material: m.paintedWood('#F7E7EC'), metal: gold, stone, glazed: false, casing: 0, steps: 2, seed: 0.77 });
    else buildWindow(ctx, back0, { ...o, trim: cream, sash, panes: [2, 4], casing: 0, keystone: false, room: salon(i + 2), seed: 0.71 + i * 0.03 });
  });

  /* ---------- rose upper storey with oval windows ---------- */
  const uH = EAVE - G_TOP;
  const oval = (x) => ({ x, y: 0.2, w: 0.24, h: 0.24, kind: 'circle' });
  const upperFaces = [
    ['front', BAYS],
    ['back', [-0.6, 0, 0.6]],
    ['left', [-0.45, 0.45]],
    ['right', [-0.45, 0.45]],
  ];
  for (const [side, xs] of upperFaces) {
    const o = xs.map(oval);
    const wall = wallPanel(root, { side, W, D, y: G_TOP, height: uH, thickness: T, openings: o, material: rose, name: `upper-${side}` });
    o.forEach((oo, i) => {
      buildWindow(ctx, wall, { ...oo, trim: cream, sash, panes: [2, 2], casing: 0.034, room: home(i), seed: 0.31 + i * 0.07 + side.length * 0.01 });
      add(wall, torus(0.16, 0.007, 10, 64), gold, { p: [oo.x, oo.y + 0.12, 0.012], name: 'giltRing' });
      // Garland swag under each oval.
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        pts.push([oo.x - 0.13 + 0.26 * t, oo.y - 0.04 - 0.05 * Math.sin(Math.PI * t), 0.014]);
      }
      add(wall, tube(pts, 0.007, { tubular: 32, radial: 8 }), m.leaf('#9CC48B'), { name: 'garland' });
      for (const t of [0.25, 0.5, 0.75]) add(wall, sphere(0.011, 12, 8), m.bloom(), { p: [oo.x - 0.13 + 0.26 * t, oo.y - 0.04 - 0.05 * Math.sin(Math.PI * t), 0.02], name: 'garlandRose' });
    });
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    add(root, roundedBox(0.07, uH - 0.02, 0.07, 0.006, 3), cream, { p: [(sx * W) / 2, G_TOP + uH / 2, (sz * D) / 2], name: 'cornerPier' });
  }
  add(root, moldingLoop(stringCourse(0.036), W, D), cream, { p: [0, G_TOP - 0.018, 0], name: 'arcadeCornice' });
  add(root, moldingLoop(cornice(0.09), W, D), cream, { p: [0, EAVE, 0], name: 'mainCornice' });

  /* ---------- roof terrace, urns, drum and dome ---------- */
  const deckY = EAVE + 0.09 * 0.74;
  add(root, roundedBox(W + 0.12, 0.02, D + 0.12, 0.006, 2), m.stone('#ECE2D8'), { p: [0, deckY - 0.01, 0], name: 'terraceDeck' });
  const bx = W / 2 + 0.03;
  const bz = D / 2 + 0.03;
  const c4 = [[-bx, bz], [bx, bz], [bx, -bz], [-bx, -bz]];
  const flowers = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = c4[i];
    const [ex, ez] = c4[(i + 1) % 4];
    balustradeRun(root, { from: [ax, deckY, az], to: [ex, deckY, ez], stone });
    const u = urn(ctx, root, { p: [ax, deckY + 0.13, az], stone });
    for (const f of u.flowers) flowers.push({ ...f, p: [f.p[0] + ax, f.p[1] + deckY + 0.13, f.p[2] + az] });
  }
  root.add(instanced(sphere(1, 12, 8), m.bloom(), flowers, { name: 'urnBlossom' }));
  // Welcome flags on gilt staffs at the terrace's front corners.
  for (const [k, sx] of [-1, 1].entries()) {
    const staffH = 0.36;
    const pole = group(root, { p: [sx * (bx - 0.15), deckY, bz - 0.07], name: 'flagpole' });
    add(pole, cylinder(0.018, 0.022, 0.03, 20, 1), stone, { p: [0, 0.015, 0], name: 'socket' });
    add(pole, cylinder(0.005, 0.005, staffH, 12, 1), gold, { p: [0, staffH / 2, 0], name: 'staff' });
    add(pole, sphere(0.01, 12, 10), gold, { p: [0, staffH + 0.01, 0], name: 'finial' });
    const len = 0.2;
    const flagShape = new THREE.Shape();
    flagShape.moveTo(-0.032, 0);
    flagShape.lineTo(0.032, 0);
    flagShape.lineTo(0.01, len);
    flagShape.lineTo(0, len * 0.8);
    flagShape.lineTo(-0.01, len);
    flagShape.closePath();
    const f = add(pole, new THREE.ShapeGeometry(flagShape, 8), m.flag(['#A9DCC8', '#F7D36B'][k], len), { p: [0, staffH - 0.035, 0], r: [0, 0, -Math.PI / 2], name: 'flag' });
    f.castShadow = false;
  }

  /* ---------- the island map by the entrance ---------- */
  // A painted map on a cream board: the island and its plaza, four streets, little houses, the
  // fountain and the three islets, and a red pin standing where the welcome centre is.
  const board = group(root, { p: [0.72, 0, D / 2 + 0.24], r: [0, -0.3, 0], s: 1.35, name: 'mapBoard' });
  const paint = (color) => m.paintedWood(color);
  for (const sx of [-1, 1]) add(board, roundedBox(0.016, 0.4, 0.016, 0.004, 2), paint('#C9A46A'), { p: [sx * 0.15, 0.2, 0], name: 'leg' });
  const face = group(board, { p: [0, 0.47, 0.012], r: [-0.18, 0, 0], name: 'mapFace' });
  add(face, roundedBox(0.34, 0.26, 0.018, 0.006, 3), paint('#FFF6E8'), { name: 'frame' });
  add(face, roundedBox(0.31, 0.23, 0.004, 0.003, 2), paint('#CFE4F2'), { p: [0, 0, 0.0095], name: 'sea' });
  const map = group(face, { p: [0, 0, 0.012], name: 'map' });
  const disc = (r, color, z, name) => add(map, cylinder(r, r, 0.003, 64, 1), paint(color), { p: [0, 0, z], r: [Math.PI / 2, 0, 0], name });
  disc(0.098, '#F6E3C8', 0, 'islandRim');
  disc(0.088, '#B9DDA8', 0.001, 'lawn');
  for (const [w, h] of [[0.17, 0.016], [0.016, 0.17]]) add(map, roundedBox(w, h, 0.002, 0.001, 1), paint('#DCD3E6'), { p: [0, 0, 0.0035], name: 'street' });
  disc(0.028, '#F2C6D2', 0.0045, 'plaza');
  disc(0.009, '#9FD0E6', 0.0055, 'fountain');
  const roofs = ['#F2A7BC', '#BFD5EC', '#F7D36B', '#C9B8E8', '#F4A38C', '#A9DCC8'];
  let r = 0;
  for (const [qx, qy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    for (const [a, b] of [[0.03, 0.056], [0.058, 0.03]]) add(map, roundedBox(0.018, 0.014, 0.004, 0.001, 1), paint(roofs[r++ % roofs.length]), { p: [qx * a, qy * b, 0.005], name: 'house' });
  }
  for (const [x, y, rad] of [[-0.125, 0.085, 0.014], [0.13, -0.07, 0.012], [-0.12, -0.09, 0.011]]) {
    add(map, cylinder(rad, rad, 0.003, 24, 1), paint('#B9DDA8'), { p: [x, y, 0.001], r: [Math.PI / 2, 0, 0], name: 'islet' });
  }
  const pin = group(map, { p: [-0.058, 0.03, 0.006], name: 'youAreHere' });
  add(pin, cylinder(0.0016, 0.0016, 0.022, 8, 1), m.metal('chrome'), { p: [0, 0, 0.011], r: [Math.PI / 2, 0, 0], name: 'pinShaft' });
  add(pin, sphere(0.0085, 16, 12), m.plastic('#E5484D'), { p: [0, 0, 0.024], name: 'pinHead' });

  const drum = group(root, { p: [0, deckY, -0.05], name: 'drum' });
  add(drum, moldingRing(plinth(0.05), DRUM_R, { segments: 128 }), stone, { name: 'drumBase' });
  add(drum, cylinder(DRUM_R, DRUM_R, DRUM_H, 128, 1), rose, { p: [0, DRUM_H / 2, 0], name: 'drumWall' });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const face = group(drum, { p: [Math.sin(a) * DRUM_R, 0, Math.cos(a) * DRUM_R], r: [0, a, 0], name: 'drumBay' });
    add(face, cylinder(0.06, 0.06, 0.02, 32, 1), m.glass({ width: 0.12, height: 0.12, depth: 0.2, style: 3, glow: 1.2, seed: 0.1 * k }), { p: [0, DRUM_H * 0.55, 0.004], r: [Math.PI / 2, 0, 0], cast: false, name: 'oculusGlass' });
    add(face, torus(0.066, 0.012, 10, 48), cream, { p: [0, DRUM_H * 0.55, 0.012], name: 'oculusFrame' });
    const pa = a + Math.PI / 8;
    add(drum, roundedBox(0.05, DRUM_H, 0.03, 0.004, 3), cream, { p: [Math.sin(pa) * (DRUM_R + 0.01), DRUM_H / 2, Math.cos(pa) * (DRUM_R + 0.01)], r: [0, pa, 0], name: 'drumPilaster' });
  }
  add(drum, moldingRing(cornice(0.06), DRUM_R, { segments: 128 }), cream, { p: [0, DRUM_H, 0], name: 'drumCornice' });

  // Imperial (ogee) dome in pink fish-scale tiles with gilded ribs.
  const domeBase = DRUM_H + 0.06 * 0.74;
  const R0 = DRUM_R + 0.06 * 0.9;
  const domeProfile = (t) => {
    const k = THREE.MathUtils.clamp(t, 0, 1);
    // Bell then a reverse curve tapering to the lantern neck.
    const r = R0 * (Math.cos(k * Math.PI * 0.5) ** 0.85) * (1 + 0.12 * Math.sin(k * Math.PI)) * (1 - 0.82 * k ** 3) + 0.0;
    return { r: Math.max(r, 0.07 * (k > 0.9 ? 1 : 0)), y: DOME_H * (1 - (1 - k) ** 1.6) };
  };
  const shellPts = [];
  for (let i = 0; i <= 64; i++) {
    const p = domeProfile(i / 64);
    shellPts.push([Math.max(p.r - 0.004, 0), p.y]);
  }
  shellPts.push([0, DOME_H]);
  const dome = group(drum, { p: [0, domeBase, 0], name: 'dome' });
  add(dome, lathe(shellPts, 128), m.slate('#EE9DB3'), { name: 'domeShell' });
  tileRevolution(dome, { profile: domeProfile, tileW: 0.05, exposure: 0.03, geometry: slateGeometry(0.05, 0.066, 0.005, 'scale'), material: m.slate('#FFFFFF'), rng, colors: SCALES, minRadius: 0.08 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const p = domeProfile((i / 40) * 0.93);
      pts.push([Math.sin(a) * (p.r + 0.012), p.y + 0.004, Math.cos(a) * (p.r + 0.012)]);
    }
    add(dome, tube(pts, 0.009, { tubular: 80, radial: 8 }), gold, { name: 'rib' });
  }
  // Lantern: a ring of slender columns under a tiny cupola, then the finial.
  const lantern = group(dome, { p: [0, DOME_H * 0.94, 0], name: 'lantern' });
  add(lantern, cylinder(0.1, 0.1, 0.02, 48, 1), cream, { name: 'lanternBase' });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    add(lantern, cylinder(0.008, 0.008, 0.12, 12, 1), cream, { p: [Math.sin(a) * 0.08, 0.07, Math.cos(a) * 0.08], name: 'lanternColumn' });
  }
  add(lantern, cylinder(0.06, 0.06, 0.12, 32, 1), m.lanternGlass('#FFE9C2', 1.1), { p: [0, 0.07, 0], cast: false, name: 'lanternGlass' });
  add(lantern, cylinder(0.1, 0.1, 0.018, 48, 1), cream, { p: [0, 0.14, 0], name: 'lanternCornice' });
  add(lantern, lathe(spline([[0, 0], [0.09, 0], [0.07, 0.04], [0.03, 0.08], [0, 0.1]], 40), 48), gold, { p: [0, 0.149, 0], name: 'lanternCap' });
  finial(lantern, { y: 0.24, height: 0.16, radius: 0.022, material: gold });

  root.userData.footprint = { w: W, d: D };
  return root;
}
