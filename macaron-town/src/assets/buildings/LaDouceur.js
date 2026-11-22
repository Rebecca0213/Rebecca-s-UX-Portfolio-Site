import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, cylinder, torus, sphere, lathe, spline, tube } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop } from '../../kit/sweep.js';
import { plinth, cornice, stringCourse } from '../../kit/profiles.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { domeAwning } from '../../kit/awnings.js';
import { cresting } from '../../kit/roofs.js';
import { balusterGeometry } from '../../kit/railings.js';
import { roseGeometry } from '../../kit/flora.js';
import { wallPanel, frustumGeometry, chimney, wallLantern, rusticate, voussoirs, consoleGeometry, pediment, curvedMansard } from '../../kit/building.js';

// B03 — La Douceur, the town's gallery (one of its three venues, with the welcome centre and the
// café): a white-and-gold Parisian maison. Banded rustication on the ground floor with voussoir
// arches and gilded keystones, each opening under a rose-pink dome awning; a continuous gilded balcony
// on scrolled consoles before the piano nobile's French windows and their alternating pediments; giant
// Ionic pilasters with gold capitals; a modillioned cornice hung with gold festoons; and a curved
// lilac-zinc mansard with standing seams, oeil-de-boeuf dormers and gold cresting. As a gallery: rooms
// hung with framed paintings behind every window, painted exhibition banners on poles at the corners,
// and two sculptures on plinths beside the door, a gilt knot and a stack of balanced marble stones.

const W = 2.2;
const D = 1.95;
const T = 0.07;
const BASE = 0.068;
const G_TOP = 1.12;
const F1_TOP = 1.98;
const EAVE = 2.7;
const CORNICE = 0.11;
const ROOF_Y = EAVE + CORNICE * 0.74;
const ROOF_H = 0.62;
const ROOF_INSET = 0.28;
const BAYS = [-0.72, 0, 0.72];
const VOUSSOIR = 0.075;

function ionicPilaster(parent, { x, y0, y1, stone, gold, name = 'pilaster' }) {
  const g = group(parent, { p: [x, 0, 0], name });
  const w = 0.08;
  const proj = 0.026;
  add(g, roundedBox(w + 0.03, 0.03, proj + 0.016, 0.004, 2), stone, { p: [0, y0 + 0.015, (proj + 0.016) / 2], name: 'plinth' });
  add(g, roundedBox(w + 0.016, 0.014, proj + 0.01, 0.006, 3), stone, { p: [0, y0 + 0.037, (proj + 0.01) / 2], name: 'baseTorus' });
  const shaftY = y0 + 0.044;
  const shaftH = y1 - shaftY - 0.06;
  add(g, roundedBox(w, shaftH, proj, 0.004, 3), stone, { p: [0, shaftY + shaftH / 2, proj / 2], name: 'shaft' });
  for (let k = -2; k <= 2; k++) add(g, roundedBox(0.006, shaftH - 0.05, 0.004, 0.0015, 1), stone, { p: [k * 0.0135, shaftY + shaftH / 2, proj + 0.002], name: 'fillet' });
  const cy = y1 - 0.06;
  add(g, roundedBox(w + 0.004, 0.012, proj + 0.006, 0.003, 2), gold, { p: [0, cy + 0.006, (proj + 0.006) / 2], name: 'astragal' });
  add(g, roundedBox(w - 0.004, 0.022, proj + 0.012, 0.005, 2), gold, { p: [0, cy + 0.023, (proj + 0.012) / 2], name: 'echinus' });
  for (const sx of [-1, 1]) {
    add(g, torus(0.011, 0.0038, 10, 32), gold, { p: [sx * (w / 2 + 0.002), cy + 0.03, proj + 0.01], name: 'volute' });
    add(g, sphere(0.004, 12, 8), gold, { p: [sx * (w / 2 + 0.002), cy + 0.03, proj + 0.012], name: 'voluteEye' });
  }
  add(g, roundedBox(w + 0.03, 0.012, proj + 0.02, 0.002, 2), gold, { p: [0, cy + 0.052, (proj + 0.02) / 2], name: 'abacus' });
  return g;
}

// A swag of gilded beads between two rosettes, fattest at its low point.
function festoon(parent, { x0, x1, y, sag, gold, bead = 0.0056, z = 0.012 }) {
  const items = [];
  const n = Math.round(((x1 - x0) * 1.15) / (bead * 1.9));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const k = Math.sin(Math.PI * u);
    items.push({ p: [x0 + (x1 - x0) * u, y - sag * k, z + 0.004 * k], s: bead * (0.65 + 0.6 * k) });
  }
  parent.add(instanced(sphere(1, 12, 8), gold, items, { name: 'festoonBeads' }));
  add(parent, sphere(0.006, 12, 8), gold, { p: [(x0 + x1) / 2, y - sag - 0.012, z + 0.004], s: [1, 1.6, 1], name: 'tasselDrop' });
}

function rosette(parent, { x, y, z = 0.01, gold, r = 0.013 }) {
  add(parent, cylinder(r, r, 0.006, 24, 1), gold, { p: [x, y, z], r: [Math.PI / 2, 0, 0], name: 'rosette' });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    add(parent, sphere(r * 0.32, 10, 8), gold, { p: [x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72, z + 0.004], name: 'rosettePetal' });
  }
  add(parent, sphere(r * 0.42, 12, 10), gold, { p: [x, y, z + 0.005], name: 'rosetteBoss' });
}

// Round attic dormer (oeil-de-boeuf) projecting from one mansard face.
function oeilDeBoeuf(ctx, face, { mansard, out, s, hc = 0.24, r = 0.1, sheet, trim, sash, gold, room, seed }) {
  const g = group(face, { name: 'oeilDeBoeuf' });
  const tBottom = mansard.tAt(hc - r);
  const zf = out - mansard.at(tBottom).inset + 0.07;
  const len = 0.38;
  const drum = cylinder(r, r, len, 56, 1, true).rotateX(Math.PI / 2);
  add(g, drum, sheet, { p: [s, hc, zf - len / 2], name: 'drum' });
  const frontFrame = group(g, { p: [s, hc, zf], name: 'front' });
  const open = 0.068;
  add(frontFrame, new THREE.RingGeometry(open, r, 64, 1), sheet, { name: 'face' });
  buildWindow(ctx, frontFrame, { x: 0, y: -open, w: 2 * open, h: 2 * open, kind: 'circle', trim, sash, panes: [2, 2], casing: 0.022, room, seed });
  add(frontFrame, torus(r, 0.005, 10, 72), gold, { name: 'giltBead' });
  // Flame finial on the drum's crown.
  const flame = lathe(spline([[0, 0], [0.012, 0], [0.008, 0.012], [0.014, 0.026], [0.006, 0.045], [0, 0.062]], 32), 24);
  add(g, flame, gold, { p: [s, hc + r - 0.004, zf - 0.035], name: 'flameFinial' });
}

export default function build(ctx, { seed = 303 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'LaDouceur';

  const white = m.plaster('#FFFAF2');
  const stone = m.stone('#FBF4E9');
  const trim = m.trim('#FFFDF9');
  const sash = m.paintedWood('#FFFDF9');
  const blush = m.paintedWood('#F5D3DC');
  const gold = m.metal('gold');
  const iron = m.metal('iron');
  const sheet = m.sheetMetal('#BCB5D0');
  const pinkFabric = '#F2A7BC';
  const blossoms = ['#F7B6C8', '#FFFFFF', '#F9CBD8', '#F3A2B8', '#FFF0F4'];
  // Gallery rooms (style 4): pale walls hung with framed paintings under picture lights.
  const shopRoom = { style: 4, wall: '#F7F2EC', accent: '#E8C27A', glow: 1.3 };
  const salonRoom = (k) => ({ style: 4, wall: ['#FBF3F1', '#F6F3EC', '#F3F1F8'][k % 3], accent: '#E8C27A', glow: 1.15 });
  const homeRoom = (k) => ({ style: 0, wall: ['#F8EEE6', '#F4EEF8', '#FBF2EA'][k % 3], accent: ['#F2B8C6', '#C9D9F0', '#F6D7A8'][k % 3], glow: 0.95 });

  add(root, moldingLoop(plinth(0.07), W, D), stone, { name: 'plinthCourse' });

  /* ---------- rusticated ground floor ---------- */
  const groundH = G_TOP - BASE;
  const rustTop = groundH - 0.03;
  const arch = (x, w, h, y = 0.16) => ({ x, y, w, h, kind: 'round' });
  const frontOpenings = [arch(-0.72, 0.44, 0.76), { x: 0, y: 0, w: 0.42, h: 0.92, kind: 'round' }, arch(0.72, 0.44, 0.76)];
  const front0 = wallPanel(root, { side: 'front', W, D, y: BASE, height: groundH, thickness: T, openings: frontOpenings, material: white, name: 'groundFront' });
  rusticate(front0, { x0: -W / 2, x1: W / 2, y0: 0.005, y1: rustTop, openings: frontOpenings, ring: VOUSSOIR + 0.004, material: stone });
  frontOpenings.forEach((o, i) => {
    const r = o.w / 2;
    const spring = o.y + o.h - r;
    voussoirs(front0, { x: o.x, spring, radius: r, depth: VOUSSOIR, count: 9, material: stone, keyMaterial: gold });
    if (i === 1) {
      buildDoor(ctx, front0, { ...o, trim, material: blush, metal: gold, stone, double: true, glazed: true, room: { ...shopRoom, glow: 1.4 }, casing: 0, steps: 2, seed: 0.37 });
    } else {
      buildWindow(ctx, front0, { ...o, trim, sash, panes: [3, 4], casing: 0, keystone: false, room: shopRoom, seed: 0.21 + i * 0.17 });
    }
    // Rose-pink bonnet awning standing just proud of the voussoirs.
    const awningMount = group(front0, { p: [0, 0, 0.032], name: 'awningMount' });
    domeAwning(ctx, awningMount, { x: o.x, y: spring, radius: r + 0.035, depth: (r + 0.035) * 0.95, color: pinkFabric, hemColor: '#FFF7F3', metal: gold, ribs: 7 });
  });
  for (const x of [-0.36, 0.36]) wallLantern(ctx, front0, { x, y: 0.6, z: 0.018, brass: gold, iron, name: 'giltLantern' });

  /* ---------- the gallery's banners and sculptures ---------- */
  // Exhibition banners on iron poles at the front corners, each painted with a large disc and a wave
  // across a deep ground in a gilt edge (no lettering).
  for (const [k, side] of [-1, 1].entries()) {
    const pole = group(root, { p: [side * 0.98, 0, D / 2 + 0.14], name: 'bannerPole' });
    add(pole, cylinder(0.03, 0.036, 0.03, 24, 1), stone, { p: [0, 0.015, 0], name: 'footing' });
    add(pole, cylinder(0.008, 0.009, 0.86, 16, 1), iron, { p: [0, 0.46, 0], name: 'pole' });
    add(pole, sphere(0.014, 16, 12), gold, { p: [0, 0.9, 0], name: 'finial' });
    add(pole, roundedBox(0.012, 0.012, 0.16, 0.003, 2), iron, { p: [0, 0.86, 0.075], name: 'arm' });
    const banner = group(pole, { p: [0, 0.59, 0.145], name: 'banner' });
    const ground = ['#3F7F86', '#7A4E7E'][k];
    const disc = ['#F4A38C', '#F7D36B'][k];
    const wave = ['#F7E7C9', '#F2A7BC'][k];
    add(banner, roundedBox(0.012, 0.5, 0.15, 0.003, 2), m.fabric(ground), { name: 'cloth' });
    add(banner, roundedBox(0.014, 0.012, 0.155, 0.003, 2), gold, { p: [0, 0.252, 0], name: 'rod' });
    for (const y of [-0.235, 0.235]) add(banner, roundedBox(0.0135, 0.008, 0.148, 0.002, 2), gold, { p: [0, y, 0], name: 'giltEdge' });
    add(banner, cylinder(0.042, 0.042, 0.004, 40, 1), m.paintedWood(disc), { p: [0.008, 0.08, 0], r: [0, 0, Math.PI / 2], name: 'disc' });
    const pts = [];
    for (let j = 0; j <= 20; j++) pts.push([0.008, -0.09 + 0.022 * Math.sin((j / 20) * Math.PI * 2.4), -0.065 + (0.13 * j) / 20]);
    add(banner, tube(pts, 0.007, { tubular: 40, radial: 6 }), m.paintedWood(wave), { name: 'wave' });
    banner.rotation.y = side * 0.12;
  }

  // Two sculptures on stone plinths beside the door: a gilt knot, and three marble stones balanced.
  for (const side of [-1, 1]) {
    const plinthGroup = group(root, { p: [side * 0.34, 0, D / 2 + 0.11], name: 'sculpturePlinth' });
    add(plinthGroup, roundedBox(0.11, 0.17, 0.11, 0.008, 3), stone, { p: [0, 0.085, 0], name: 'plinth' });
    add(plinthGroup, roundedBox(0.126, 0.018, 0.126, 0.004, 2), stone, { p: [0, 0.178, 0], name: 'cap' });
    if (side < 0) {
      add(plinthGroup, new THREE.TorusKnotGeometry(0.034, 0.011, 160, 16, 2, 3), gold, { p: [0, 0.235, 0], r: [0.4, 0.3, 0], name: 'giltKnot' });
    } else {
      const marble = m.stone('#F7F3EE');
      add(plinthGroup, sphere(0.034, 32, 20), marble, { p: [0, 0.214, 0], s: [1.15, 0.7, 1.0], name: 'stone' });
      add(plinthGroup, sphere(0.026, 32, 20), marble, { p: [0.006, 0.252, 0.004], s: [1.0, 0.75, 1.1], name: 'stone' });
      add(plinthGroup, sphere(0.018, 32, 20), marble, { p: [-0.004, 0.28, -0.002], s: [1.1, 0.8, 0.95], name: 'stone' });
    }
  }

  const sideOpenings = [arch(-0.42, 0.4, 0.74), arch(0.42, 0.4, 0.74)];
  for (const side of ['left', 'right']) {
    const wall = wallPanel(root, { side, W, D, y: BASE, height: groundH, thickness: T, openings: sideOpenings, material: white, name: `ground-${side}` });
    rusticate(wall, { x0: -D / 2 - 0.018, x1: D / 2 + 0.018, y0: 0.005, y1: rustTop, openings: sideOpenings, ring: VOUSSOIR + 0.004, material: stone });
    sideOpenings.forEach((o, i) => {
      voussoirs(wall, { x: o.x, spring: o.y + o.h - o.w / 2, radius: o.w / 2, depth: VOUSSOIR, count: 9, material: stone, keyMaterial: gold });
      buildWindow(ctx, wall, { ...o, trim, sash, panes: [3, 4], casing: 0, keystone: false, room: shopRoom, seed: (side === 'left' ? 0.5 : 0.6) + i * 0.07 });
    });
  }
  const backOpenings = [arch(-0.72, 0.4, 0.74), { x: 0, y: 0, w: 0.34, h: 0.84, kind: 'round' }, arch(0.72, 0.4, 0.74)];
  const back0 = wallPanel(root, { side: 'back', W, D, y: BASE, height: groundH, thickness: T, openings: backOpenings, material: white, name: 'groundBack' });
  rusticate(back0, { x0: -W / 2, x1: W / 2, y0: 0.005, y1: rustTop, openings: backOpenings, ring: VOUSSOIR + 0.004, material: stone });
  backOpenings.forEach((o, i) => {
    voussoirs(back0, { x: o.x, spring: o.y + o.h - o.w / 2, radius: o.w / 2, depth: VOUSSOIR, count: 9, material: stone, keyMaterial: gold });
    if (i === 1) buildDoor(ctx, back0, { ...o, trim, material: blush, metal: gold, stone, glazed: false, casing: 0, steps: 2, seed: 0.83 });
    else buildWindow(ctx, back0, { ...o, trim, sash, panes: [3, 4], casing: 0, keystone: false, room: shopRoom, seed: 0.71 + i * 0.05 });
  });

  /* ---------- piano nobile ---------- */
  const f1H = F1_TOP - G_TOP;
  const french = (x) => ({ x, y: 0.035, w: 0.36, h: 0.62, kind: 'rect' });
  const f1Openings = BAYS.map(french);
  const front1 = wallPanel(root, { side: 'front', W, D, y: G_TOP, height: f1H, thickness: T, openings: f1Openings, material: white, name: 'pianoNobile' });
  f1Openings.forEach((o, i) => {
    buildWindow(ctx, front1, { ...o, trim, sash, panes: [2, 4], casing: 0.045, sill: false, hood: false, room: salonRoom(i), seed: 0.13 + i * 0.21 });
    const ped = pediment(front1, { x: o.x, y: o.y + o.h + 0.045, width: o.w + 0.15, kind: i === 1 ? 'segmental' : 'triangular', rise: i === 1 ? 0.07 : 0.085, scale: 0.042, material: trim });
    const tyY = o.y + o.h + 0.045 + 0.042 * 0.74 + 0.026;
    if (i === 1) {
      // Gilt cartouche framing a sugar rose.
      add(front1, torus(0.026, 0.0045, 10, 48), gold, { p: [o.x, tyY + 0.006, 0.014], s: [1.35, 0.85, 1], name: 'cartouche' });
      const rose = add(front1, roseGeometry({ petals: 14, radius: 1 }), m.petal('#F7B3C6', '#FCE1E8'), { p: [o.x, tyY + 0.006, 0.016], s: 0.016, name: 'cartoucheRose' });
      rose.rotation.x = Math.PI / 2;
    } else {
      rosette(front1, { x: o.x, y: tyY, z: 0.012, gold, r: 0.011 });
    }
    void ped;
  });

  // Continuous gilded balcony on scrolled consoles.
  const balcony = group(front1, { name: 'balcony' });
  const BW = 2.12;
  const BD = 0.16;
  const slabTop = 0.012;
  add(balcony, roundedBox(BW, 0.04, BD, 0.006, 3), stone, { p: [0, slabTop - 0.02, BD / 2], name: 'slab' });
  for (const cx of [-1.0, -0.36, 0.36, 1.0]) add(balcony, consoleGeometry({ h: 0.15, d: BD - 0.012, w: 0.05 }), stone, { p: [cx, slabTop - 0.04, 0], name: 'console' });
  const railH = 0.135;
  const baluster = balusterGeometry(0.0042);
  const posts = [];
  const zr = BD - 0.016;
  for (let x = -BW / 2 + 0.03; x <= BW / 2 - 0.029; x += 0.024) posts.push({ p: [x, slabTop + 0.008, zr], s: [1, railH - 0.02, 1] });
  for (const sx of [-1, 1]) for (let z = 0.03; z < zr - 0.012; z += 0.024) posts.push({ p: [sx * (BW / 2 - 0.016), slabTop + 0.008, z], s: [1, railH - 0.02, 1] });
  balcony.add(instanced(baluster, iron, posts, { name: 'balusters' }));
  add(balcony, roundedBox(BW - 0.02, 0.012, 0.016, 0.004, 2), gold, { p: [0, slabTop + railH, zr], name: 'handrail' });
  add(balcony, roundedBox(BW - 0.02, 0.008, 0.01, 0.003, 2), iron, { p: [0, slabTop + 0.012, zr], name: 'bottomRail' });
  for (const sx of [-1, 1]) {
    add(balcony, roundedBox(0.016, 0.012, zr, 0.004, 2), gold, { p: [sx * (BW / 2 - 0.016), slabTop + railH, zr / 2], name: 'returnRail' });
    add(balcony, roundedBox(0.018, railH + 0.01, 0.018, 0.004, 2), iron, { p: [sx * (BW / 2 - 0.016), slabTop + railH / 2, zr], name: 'newel' });
    add(balcony, sphere(0.012, 20, 14), gold, { p: [sx * (BW / 2 - 0.016), slabTop + railH + 0.02, zr], name: 'newelBall' });
  }

  /* ---------- upper storey ---------- */
  const f2H = EAVE - F1_TOP;
  const f2Openings = BAYS.map((x) => ({ x, y: 0.12, w: 0.32, h: 0.42, kind: 'rect' }));
  const front2 = wallPanel(root, { side: 'front', W, D, y: F1_TOP, height: f2H, thickness: T, openings: f2Openings, material: white, name: 'upperFront' });
  f2Openings.forEach((o, i) => {
    buildWindow(ctx, front2, { ...o, trim, sash, panes: [2, 3], casing: 0.04, hood: false, room: homeRoom(i), seed: 0.41 + i * 0.13, box: { material: trim, palette: blossoms } });
    add(front2, cylinder(0.026, 0.026, 0.008, 24, 1, false, -Math.PI / 2, Math.PI), gold, { p: [o.x, o.y + o.h + 0.04, 0.012], r: [Math.PI / 2, 0, 0], name: 'agrafe' });
  });
  // Gold festoons swagged between rosettes across the frieze.
  const fy = f2H - 0.062;
  const swags = [[-0.98, -0.44], [-0.28, 0.28], [0.44, 0.98]];
  for (const [a, b] of swags) festoon(front2, { x0: a, x1: b, y: fy, sag: 0.045, gold });
  for (const x of [-0.98, -0.44, -0.28, 0.28, 0.44, 0.98]) rosette(front2, { x, y: fy, gold });

  // Side and back upper floors: architraved windows under cornice hoods.
  for (const side of ['left', 'right']) {
    const o1 = [-0.42, 0.42].map((x) => ({ x, y: 0.1, w: 0.34, h: 0.56, kind: 'rect' }));
    const w1 = wallPanel(root, { side, W, D, y: G_TOP, height: f1H, thickness: T, openings: o1, material: white, name: `nobile-${side}` });
    o1.forEach((o, i) => buildWindow(ctx, w1, { ...o, trim, sash, panes: [2, 3], casing: 0.042, room: salonRoom(i + 1), seed: (side === 'left' ? 0.3 : 0.35) + i * 0.09 }));
    const o2 = [-0.42, 0.42].map((x) => ({ x, y: 0.13, w: 0.3, h: 0.4, kind: 'rect' }));
    const w2 = wallPanel(root, { side, W, D, y: F1_TOP, height: f2H, thickness: T, openings: o2, material: white, name: `upper-${side}` });
    o2.forEach((o, i) => buildWindow(ctx, w2, { ...o, trim, sash, panes: [2, 2], casing: 0.038, room: homeRoom(i + 2), seed: (side === 'left' ? 0.62 : 0.67) + i * 0.05 }));
  }
  const b1 = BAYS.map((x) => ({ x, y: 0.1, w: 0.34, h: 0.56, kind: 'rect' }));
  const back1 = wallPanel(root, { side: 'back', W, D, y: G_TOP, height: f1H, thickness: T, openings: b1, material: white, name: 'nobileBack' });
  b1.forEach((o, i) => buildWindow(ctx, back1, { ...o, trim, sash, panes: [2, 3], casing: 0.042, room: salonRoom(i + 2), seed: 0.52 + i * 0.07 }));
  const b2 = BAYS.map((x) => ({ x, y: 0.13, w: 0.3, h: 0.4, kind: 'rect' }));
  const back2 = wallPanel(root, { side: 'back', W, D, y: F1_TOP, height: f2H, thickness: T, openings: b2, material: white, name: 'upperBack' });
  b2.forEach((o, i) => buildWindow(ctx, back2, { ...o, trim, sash, panes: [2, 2], casing: 0.038, room: homeRoom(i), seed: 0.88 + i * 0.03 }));

  // Giant-order Ionic pilasters through both upper storeys: corners on every face, two more in front.
  const pilasters = group(root, { name: 'pilasters' });
  const pY0 = G_TOP + 0.03;
  const pY1 = EAVE - 0.035;
  const onFace = (side, x) => {
    const frames = { front: [0, D / 2, 0], back: [0, -D / 2, Math.PI], right: [W / 2, 0, Math.PI / 2], left: [-W / 2, 0, -Math.PI / 2] };
    const [fx, fz, ry] = frames[side];
    const g = group(pilasters, { p: [fx, 0, fz], r: [0, ry, 0], name: `${side}Pilasters` });
    ionicPilaster(g, { x, y0: pY0, y1: pY1, stone, gold });
  };
  for (const x of [-1.04, -0.36, 0.36, 1.04]) onFace('front', x);
  for (const x of [-1.04, 1.04]) onFace('back', x);
  for (const side of ['left', 'right']) for (const x of [-(D / 2 - 0.06), D / 2 - 0.06]) onFace(side, x);

  /* ---------- courses, cornice, modillions ---------- */
  add(root, moldingLoop(stringCourse(0.032), W, D), trim, { p: [0, G_TOP - 0.022, 0], name: 'groundCourse' });
  add(root, moldingLoop(stringCourse(0.028), W, D), trim, { p: [0, F1_TOP - 0.012, 0], name: 'storeyCourse' });
  add(root, moldingLoop(cornice(CORNICE), W, D), trim, { p: [0, EAVE, 0], name: 'mainCornice' });
  const modillions = [];
  const spacing = 0.11;
  for (const [len, axis, sx, sz] of [[W, 'x', 0, 1], [W, 'x', 0, -1], [D, 'z', 1, 0], [D, 'z', -1, 0]]) {
    const n = Math.floor((len - 0.08) / spacing);
    for (let i = 0; i <= n; i++) {
      const t = -((n * spacing) / 2) + i * spacing;
      const x = axis === 'x' ? t : (sx * W) / 2;
      const z = axis === 'z' ? t : (sz * D) / 2;
      const ry = axis === 'x' ? (sz > 0 ? 0 : Math.PI) : sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      modillions.push({ p: [x, EAVE + CORNICE * 0.27, z], r: [0, ry, 0] });
    }
  }
  root.add(instanced(consoleGeometry({ h: 0.06, d: CORNICE * 0.56, w: 0.03 }), trim, modillions, { name: 'modillions' }));

  /* ---------- curved mansard ---------- */
  const roof = group(root, { p: [0, ROOF_Y, 0], name: 'roof' });
  const Wm = W + 0.03;
  const Dm = D + 0.03;
  const mansard = curvedMansard(roof, { W: Wm, D: Dm, height: ROOF_H, inset: ROOF_INSET, sheet });
  const Wt = Wm - 2 * ROOF_INSET;
  const Dt = Dm - 2 * ROOF_INSET;
  add(roof, frustumGeometry(Wt + 0.012, Dt + 0.012, Wt - 0.22, Dt - 0.22, 0.05), sheet, { p: [0, ROOF_H - 0.004, 0], name: 'topDeck' });
  for (const [a, b] of [[[-Wt / 2, Dt / 2], [Wt / 2, Dt / 2]], [[Wt / 2, -Dt / 2], [-Wt / 2, -Dt / 2]], [[Wt / 2, Dt / 2], [Wt / 2, -Dt / 2]], [[-Wt / 2, -Dt / 2], [-Wt / 2, Dt / 2]]]) {
    cresting(roof, { from: [a[0], ROOF_H + 0.004, a[1]], to: [b[0], ROOF_H + 0.004, b[1]], material: gold, height: 0.065, spacing: 0.065 });
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    add(roof, lathe(spline([[0, 0], [0.016, 0], [0.012, 0.02], [0.02, 0.05], [0.008, 0.08], [0, 0.11]], 40), 32), gold, { p: [(sx * Wt) / 2, ROOF_H + 0.004, (sz * Dt) / 2], name: 'cornerFinial' });
  }
  const dormerSet = { front: BAYS, back: [-0.5, 0.5], left: [0], right: [0] };
  for (const f of mansard.faces) {
    for (const [i, s] of dormerSet[f.name].entries()) {
      oeilDeBoeuf(ctx, f.frame, { mansard, out: f.out, s, sheet, trim, sash, gold, room: homeRoom(i + 1), seed: 0.07 + i * 0.11 + f.ry * 0.01 });
    }
  }
  for (const x of [-0.52, 0.52]) chimney(roof, { x, z: -0.22, y0: ROOF_H - 0.1, y1: ROOF_H + 0.36, w: 0.17, d: 0.28, plaster: white, trim, clay: m.terracotta('#E39A7E'), pots: 2, rng });

  root.userData.footprint = { w: W, d: D };
  return root;
}
