import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, cylinder, sphere, torus, lathe, spline, tube } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop, moldingRun } from '../../kit/sweep.js';
import { plinth, cornice, stringCourse } from '../../kit/profiles.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { slateGeometry, tilePlane, ridgeCaps } from '../../kit/roofs.js';
import { stoneBalusterGeometry } from '../../kit/railings.js';
import { wallPanel, frustumGeometry, chimney, quoins } from '../../kit/building.js';

// B08 — Butter house: a Regency villa in butter-yellow stucco with white dressings and sky-blue
// shutters. A Tuscan portico shelters the fanlit door and carries a balustraded balcony; a dentilled
// cornice runs under a slate roof truncated to a widow's walk with a stone balustrade, crowned by an
// octagonal cupola whose copper weathervane swings round to point into the wind.

const W = 1.9;
const D = 1.75;
const T = 0.07;
const BASE = 0.068;
const G_TOP = 0.98;
const EAVE = 1.86;
const CORNICE = 0.08;
const PITCH = (33 * Math.PI) / 180;
const ROOF_H = 0.36;
const OVERHANG = 0.06;
const SLATES = ['#8E9DB3', '#97A5BA', '#8796AD', '#9DABBF', '#8A99AF'];
const PORTICO = { x: 0.34, depth: 0.42, top: 0.9 };

function tuscanColumn(parent, { p, height, stone, name = 'column' }) {
  const g = group(parent, { p, name });
  const r = 0.034;
  add(g, roundedBox(0.09, 0.022, 0.09, 0.004, 2), stone, { p: [0, 0.011, 0], name: 'plinth' });
  add(g, lathe(spline([[0, 0], [r * 1.25, 0], [r * 1.25, 0.008], [r * 1.05, 0.018], [r, 0.022], [0, 0.022]], 24), 40), stone, { p: [0, 0.022, 0], name: 'base' });
  const shaftH = height - 0.1;
  add(g, lathe(spline([[0, 0], [r, 0], [r, shaftH * 0.33], [r * 0.86, shaftH], [0, shaftH]], 48), 48), stone, { p: [0, 0.044, 0], name: 'shaft' });
  const cy = 0.044 + shaftH;
  add(g, lathe(spline([[0, 0], [r * 0.95, 0], [r * 0.95, 0.006], [r * 0.9, 0.01], [r * 1.25, 0.03], [0, 0.03]], 24), 40), stone, { p: [0, cy, 0], name: 'echinus' });
  add(g, roundedBox(0.092, 0.02, 0.092, 0.003, 2), stone, { p: [0, cy + 0.04, 0], name: 'abacus' });
  return g;
}

// Stone balustrade between two points on a deck at y = 0 (local frame), with piers at both ends.
function balustrade(parent, { from, to, stone, height = 0.13, piers = true, name = 'balustrade' }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const g = group(parent, { name });
  g.position.copy(a);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
  add(g, roundedBox(len, 0.016, 0.05, 0.004, 2), stone, { p: [len / 2, 0.008, 0], name: 'plinthRail' });
  add(g, roundedBox(len + 0.01, 0.02, 0.06, 0.006, 3), stone, { p: [len / 2, height, 0], name: 'handrail' });
  const n = Math.max(1, Math.floor((len - 0.08) / 0.036));
  const items = [];
  for (let i = 0; i <= n; i++) items.push({ p: [0.04 + ((len - 0.08) * i) / Math.max(n, 1), 0.016, 0] });
  g.add(instanced(stoneBalusterGeometry({ height: height - 0.026, radius: 0.011, radial: 24 }), stone, items, { name: 'balusters' }));
  if (piers) {
    for (const x of [0, len]) {
      add(g, roundedBox(0.05, height + 0.03, 0.06, 0.005, 3), stone, { p: [x, (height + 0.03) / 2, 0], name: 'pier' });
      add(g, sphere(0.022, 24, 16), stone, { p: [x, height + 0.05, 0], name: 'pierBall' });
    }
  }
  return g;
}

export default function build(ctx, { seed = 808 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'ButterHouse';

  const butter = m.plaster('#FAE3A4');
  const white = m.trim('#FFFDF8');
  const stone = m.stone('#FBF6EC');
  const sky = m.paintedWood('#9DC8E8');
  const sash = m.paintedWood('#FFFDF8');
  const iron = m.metal('iron');
  const brass = m.metal('brass');
  const copper = m.metal('copper');
  const zinc = m.metal('zinc');
  const flowers = ['#FFFFFF', '#9DC8E8', '#F7A8BE', '#FFE9A8', '#C9B6F0'];
  const room = (k, glow = 0.95) => ({ style: 0, wall: ['#FBF4E4', '#EEF4FA', '#FBF0F2'][k % 3], accent: ['#9DC8E8', '#F2B8C6', '#F7D36B'][k % 3], glow });

  add(root, moldingLoop(plinth(0.07), W, D), stone, { name: 'plinthCourse' });
  const fh = EAVE - BASE;

  /* ---------- facade ---------- */
  const fo = [
    { x: 0, y: 0, w: 0.34, h: 0.74, kind: 'round' },
    { x: -0.62, y: 0.2, w: 0.32, h: 0.52, kind: 'rect' },
    { x: 0.62, y: 0.2, w: 0.32, h: 0.52, kind: 'rect' },
    { x: -0.62, y: 1.02, w: 0.3, h: 0.54, kind: 'rect' },
    { x: 0, y: 1.0, w: 0.34, h: 0.62, kind: 'rect' },
    { x: 0.62, y: 1.02, w: 0.3, h: 0.54, kind: 'rect' },
  ];
  const front = wallPanel(root, { side: 'front', W, D, y: BASE, height: fh, thickness: T, openings: fo, material: butter, name: 'facade' });
  buildDoor(ctx, front, { ...fo[0], trim: white, material: sky, metal: brass, stone, glazed: false, casing: 0.04, steps: 2, seed: 0.37 });
  fo.slice(1).forEach((o, i) => {
    const french = i === 3;
    buildWindow(ctx, front, { ...o, trim: white, sash, panes: french ? [2, 4] : [2, 3], casing: 0.04, sill: !french, room: room(i, french ? 1.0 : 0.95), seed: 0.13 + i * 0.11, shutters: french ? null : sky, box: i === 2 || i === 4 ? { material: white, palette: flowers } : null });
  });
  add(front, moldingRun(stringCourse(0.03), W), white, { p: [-W / 2, G_TOP - BASE - 0.014, 0], name: 'storeyCourse' });
  for (const sx of [-1, 1]) quoins(root, { cx: (sx * W) / 2, cz: D / 2, sx, sz: 1, y0: BASE + 0.005, y1: EAVE - 0.03, material: stone, rng });
  for (const sx of [-1, 1]) quoins(root, { cx: (sx * W) / 2, cz: -D / 2, sx, sz: -1, y0: BASE + 0.005, y1: EAVE - 0.03, material: stone, rng });

  /* ---------- Tuscan portico with a balcony ---------- */
  const portico = group(root, { p: [0, BASE, D / 2], name: 'portico' });
  const colH = PORTICO.top - 0.07;
  for (const sx of [-1, 1]) {
    tuscanColumn(portico, { p: [sx * PORTICO.x, 0, PORTICO.depth - 0.05], height: colH, stone });
    add(portico, roundedBox(0.07, colH, 0.03, 0.004, 3), stone, { p: [sx * PORTICO.x, colH / 2, 0.015], name: 'respond' });
  }
  const slabW = 2 * PORTICO.x + 0.16;
  add(portico, roundedBox(0.04 + 2 * PORTICO.x + 0.1, 0.07, 0.07, 0.005, 3), stone, { p: [0, PORTICO.top - 0.035, PORTICO.depth - 0.05], name: 'architrave' });
  for (const sx of [-1, 1]) add(portico, roundedBox(0.07, 0.07, PORTICO.depth - 0.05, 0.005, 3), stone, { p: [sx * PORTICO.x, PORTICO.top - 0.035, (PORTICO.depth - 0.05) / 2], name: 'sideBeam' });
  add(portico, roundedBox(slabW, 0.03, PORTICO.depth + 0.04, 0.006, 3), stone, { p: [0, PORTICO.top + 0.015, PORTICO.depth / 2], name: 'roofSlab' });
  add(portico, moldingRun(cornice(0.04), slabW + 0.02), stone, { p: [-(slabW + 0.02) / 2, PORTICO.top + 0.03, PORTICO.depth + 0.02], name: 'porticoCornice' });
  const deckY = PORTICO.top + 0.03 + 0.04 * 0.74;
  const zb = PORTICO.depth - 0.01;
  const bx = slabW / 2 - 0.03;
  balustrade(portico, { from: [-bx, deckY, zb], to: [bx, deckY, zb], stone });
  for (const sx of [-1, 1]) balustrade(portico, { from: [sx * bx, deckY, zb], to: [sx * bx, deckY, 0.03], stone, piers: false });
  // Pendant lantern hanging on a chain from the portico ceiling, clear of the fanlight.
  const pendant = group(portico, { p: [0, PORTICO.top, PORTICO.depth * 0.55], name: 'porchLantern' });
  add(pendant, cylinder(0.018, 0.018, 0.008, 20, 1), brass, { p: [0, -0.004, 0], name: 'ceilingRose' });
  for (let k = 0; k < 6; k++) add(pendant, torus(0.0055, 0.0014, 6, 14), brass, { p: [0, -0.014 - k * 0.0095, 0], r: [0, (k % 2) * (Math.PI / 2), 0], name: 'chainLink' });
  const cage = group(pendant, { p: [0, -0.18, 0], name: 'cage' });
  add(cage, lathe(spline([[0, 0.11], [0.01, 0.108], [0.03, 0.09], [0.035, 0.084], [0, 0.084]], 24), 6), brass, { name: 'roof' });
  add(cage, cylinder(0.026, 0.026, 0.07, 6, 1, true), m.lanternGlass(), { p: [0, 0.047, 0], cast: false, name: 'glass' });
  add(cage, sphere(0.011, 20, 14), m.bulb(), { p: [0, 0.045, 0], cast: false, name: 'bulb' });
  add(cage, lathe(spline([[0, -0.016], [0.006, -0.012], [0.026, 0.006], [0.03, 0.012], [0, 0.012]], 24), 6), brass, { name: 'bowl' });
  for (let k = 0; k < 6; k++) {
    const a2 = (k / 6) * Math.PI * 2;
    add(cage, roundedBox(0.004, 0.074, 0.004, 0.001, 1), brass, { p: [Math.sin(a2) * 0.027, 0.047, Math.cos(a2) * 0.027], name: 'post' });
  }

  /* ---------- sides and back ---------- */
  for (const side of ['left', 'right']) {
    const o = [-0.42, 0.42].flatMap((x) => [{ x, y: 0.2, w: 0.3, h: 0.52, kind: 'rect' }, { x, y: 1.02, w: 0.28, h: 0.52, kind: 'rect' }]);
    const wall = wallPanel(root, { side, W, D, y: BASE, height: fh, thickness: T, openings: o, material: butter });
    o.forEach((oo, i) => buildWindow(ctx, wall, { ...oo, trim: white, sash, panes: [2, 3], casing: 0.038, room: room(i + 1), seed: (side === 'left' ? 0.21 : 0.29) + i * 0.05, shutters: sky }));
    add(wall, moldingRun(stringCourse(0.03), D - 2 * T), white, { p: [-(D - 2 * T) / 2, G_TOP - BASE - 0.014, 0], name: 'sideCourse' });
  }
  const bo = [
    { x: 0.45, y: 0, w: 0.3, h: 0.74, kind: 'rect' },
    { x: -0.45, y: 0.2, w: 0.34, h: 0.52, kind: 'rect' },
    { x: -0.55, y: 1.02, w: 0.3, h: 0.52, kind: 'rect' },
    { x: 0, y: 1.02, w: 0.3, h: 0.52, kind: 'rect' },
    { x: 0.55, y: 1.02, w: 0.3, h: 0.52, kind: 'rect' },
  ];
  const back = wallPanel(root, { side: 'back', W, D, y: BASE, height: fh, thickness: T, openings: bo, material: butter, name: 'backWall' });
  buildDoor(ctx, back, { ...bo[0], trim: white, material: sky, metal: brass, stone, glazed: true, room: room(2), casing: 0.04, steps: 2, seed: 0.83 });
  bo.slice(1).forEach((o, i) => buildWindow(ctx, back, { ...o, trim: white, sash, panes: [2, 3], casing: 0.036, room: room(i), seed: 0.86 + i * 0.03, shutters: sky }));
  add(back, moldingRun(stringCourse(0.03), W), white, { p: [-W / 2, G_TOP - BASE - 0.014, 0], name: 'storeyCourse' });

  // Dentilled cornice.
  add(root, moldingLoop(cornice(CORNICE), W, D), white, { p: [0, EAVE, 0], name: 'mainCornice' });
  const dentils = [];
  for (const [len, axis, sx, sz] of [[W, 'x', 0, 1], [W, 'x', 0, -1], [D, 'z', 1, 0], [D, 'z', -1, 0]]) {
    const n = Math.floor((len - 0.04) / 0.03);
    for (let i = 0; i <= n; i++) {
      const t = -((n * 0.03) / 2) + i * 0.03;
      dentils.push({ p: [axis === 'x' ? t : (sx * W) / 2 + sx * 0.008, EAVE - 0.012, axis === 'z' ? t : (sz * D) / 2 + sz * 0.008], r: [0, axis === 'x' ? 0 : Math.PI / 2, 0] });
    }
  }
  root.add(instanced(roundedBox(0.014, 0.02, 0.016, 0.003, 2), white, dentils, { name: 'dentils' }));

  /* ---------- truncated hip roof, widow's walk, cupola ---------- */
  const roofY = EAVE + CORNICE * 0.74;
  const roof = group(root, { p: [0, roofY, 0], name: 'roof' });
  const We = W + 2 * OVERHANG;
  const De = D + 2 * OVERHANG;
  const inset = ROOF_H / Math.tan(PITCH);
  const W1 = We - 2 * inset;
  const D1 = De - 2 * inset;
  add(roof, frustumGeometry(We, De, W1, D1, ROOF_H), m.slate('#8E9DB3'), { name: 'roofBody' });
  const c = Math.cos(PITCH);
  const s = Math.sin(PITCH);
  const slope = ROOF_H / s;
  const tile = slateGeometry(0.06, 0.08, 0.006, 'square');
  for (const f of [
    { o: [0, 0, De / 2], u: [1, 0, 0], v: [0, s, -c], n: [0, c, s], w: We, t: W1 / We },
    { o: [0, 0, -De / 2], u: [-1, 0, 0], v: [0, s, c], n: [0, c, -s], w: We, t: W1 / We },
    { o: [We / 2, 0, 0], u: [0, 0, -1], v: [-c, s, 0], n: [s, c, 0], w: De, t: D1 / De },
    { o: [-We / 2, 0, 0], u: [0, 0, 1], v: [c, s, 0], n: [-s, c, 0], w: De, t: D1 / De },
  ]) {
    tilePlane(roof, { origin: new THREE.Vector3(...f.o), u: new THREE.Vector3(...f.u), v: new THREE.Vector3(...f.v), n: new THREE.Vector3(...f.n), width: f.w, length: slope, taper: f.t, tileW: 0.06, exposure: 0.036, geometry: tile, material: m.slate('#FFFFFF'), rng, colors: SLATES });
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) ridgeCaps(roof, { from: [(sx * We) / 2, 0.006, (sz * De) / 2], to: [(sx * W1) / 2, ROOF_H + 0.006, (sz * D1) / 2], radius: 0.02, material: zinc, rng, colors: ['#FFFFFF'] });
  add(roof, roundedBox(W1 + 0.04, 0.03, D1 + 0.04, 0.006, 2), zinc, { p: [0, ROOF_H + 0.012, 0], name: 'walkDeck' });
  const wy = ROOF_H + 0.027;
  const hx = W1 / 2 - 0.02;
  const hz = D1 / 2 - 0.02;
  const corners = [[-hx, hz], [hx, hz], [hx, -hz], [-hx, -hz]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i];
    const [bx2, bz2] = corners[(i + 1) % 4];
    balustrade(roof, { from: [ax, wy, az], to: [bx2, wy, bz2], stone, height: 0.1 });
  }

  // Octagonal cupola: drum with arched louvres, eight pilasters, copper ogee dome, finial, vane.
  const cupola = group(roof, { p: [0, wy, 0], name: 'cupola' });
  const cr = 0.16;
  const ch = 0.26;
  add(cupola, lathe([[0, 0], [cr + 0.02, 0], [cr + 0.02, 0.03], [0, 0.03]], 8), white, { r: [0, Math.PI / 8, 0], name: 'cupolaBase' });
  add(cupola, cylinder(cr * 0.97, cr * 0.97, ch, 8, 1), white, { p: [0, 0.03 + ch / 2, 0], r: [0, Math.PI / 8, 0], name: 'drum' });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const face = group(cupola, { p: [Math.sin(a) * cr * 0.9, 0.03, Math.cos(a) * cr * 0.9], r: [0, a, 0], name: 'louvreFace' });
    add(face, roundedBox(0.06, ch * 0.7, 0.008, 0.004, 2), m.paintedWood('#7FA9CC'), { p: [0, ch * 0.45, 0.012], name: 'louvrePanel' });
    for (let j = 0; j < 7; j++) add(face, roundedBox(0.058, 0.004, 0.012, 0.0015, 1), white, { p: [0, ch * 0.16 + j * 0.022, 0.018], r: [0.5, 0, 0], name: 'slat' });
    add(face, cylinder(0.03, 0.03, 0.01, 16, 1, false, -Math.PI / 2, Math.PI), white, { p: [0, ch * 0.8, 0.014], r: [Math.PI / 2, 0, 0], name: 'archHead' });
    const pa = a + Math.PI / 8;
    add(cupola, roundedBox(0.018, ch, 0.018, 0.004, 2), white, { p: [Math.sin(pa) * cr, 0.03 + ch / 2, Math.cos(pa) * cr], r: [0, pa, 0], name: 'pilaster' });
  }
  add(cupola, lathe([[0, 0], [cr + 0.035, 0], [cr + 0.035, 0.02], [cr + 0.02, 0.035], [0, 0.035]], 8), white, { p: [0, 0.03 + ch, 0], r: [0, Math.PI / 8, 0], name: 'cupolaCornice' });
  const dome = lathe(spline([[0, 0], [cr + 0.01, 0], [cr * 0.95, 0.05], [cr * 0.62, 0.12], [cr * 0.3, 0.17], [cr * 0.12, 0.215], [0, 0.23]], 64), 8);
  add(cupola, dome, copper, { p: [0, 0.03 + ch + 0.035, 0], r: [0, Math.PI / 8, 0], name: 'ogeeDome' });
  const vaneY = 0.03 + ch + 0.035 + 0.23;
  add(cupola, lathe(spline([[0, 0], [0.012, 0], [0.008, 0.02], [0.014, 0.034], [0.004, 0.05], [0.003, 0.17], [0, 0.18]], 40), 20), copper, { p: [0, vaneY, 0], name: 'spire' });
  add(cupola, sphere(0.016, 20, 14), m.metal('gold'), { p: [0, vaneY + 0.06, 0], name: 'gildedBall' });
  // Fixed compass arms (plain, no lettering), then the turning vane above them.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    add(cupola, tube([[0, vaneY + 0.09, 0], [Math.sin(a) * 0.06, vaneY + 0.09, Math.cos(a) * 0.06]], 0.0025, { tubular: 4, radial: 6 }), copper, { name: 'compassArm' });
    add(cupola, sphere(0.006, 12, 8), copper, { p: [Math.sin(a) * 0.062, vaneY + 0.09, Math.cos(a) * 0.062], name: 'compassKnob' });
  }
  const vane = group(cupola, { p: [0, vaneY + 0.13, 0], name: 'weathervane' });
  add(vane, roundedBox(0.2, 0.006, 0.006, 0.002, 1), copper, { name: 'shaft' });
  const head = new THREE.Shape();
  head.moveTo(0.13, 0);
  head.lineTo(0.09, 0.022);
  head.lineTo(0.095, 0);
  head.lineTo(0.09, -0.022);
  head.closePath();
  const tail = new THREE.Shape();
  tail.moveTo(-0.06, 0);
  tail.lineTo(-0.1, 0.04);
  tail.quadraticCurveTo(-0.12, 0.0, -0.1, -0.04);
  tail.closePath();
  for (const sh of [head, tail]) add(vane, new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1, curveSegments: 12 }).translate(0, 0, -0.002), copper, { name: 'vaneBlade' });

  // The vane turns toward the wind (its arrow points upwind): a damped rotational spring.
  const vaneState = { angle: rng.range(0, Math.PI * 2), omega: 0 };
  const sample = { x: 0, y: 0, z: 0 };
  const vaneWorld = new THREE.Vector3();
  ctx.physics.add({
    step(dt, world) {
      world.wind.sample(vaneWorld.x, vaneWorld.y, vaneWorld.z, world.time, sample);
      // Angle about +y that turns the arrow (+x) to face the incoming wind (-wind direction).
      const target = Math.atan2(sample.z, -sample.x);
      let diff = target - vaneState.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const strength = Math.min(1, Math.hypot(sample.x, sample.z) * 1.5);
      vaneState.omega += (diff * 9 * strength - vaneState.omega * 2.6) * dt;
      vaneState.angle += vaneState.omega * dt;
    },
  });

  for (const sx of [-1, 1]) chimney(root, { x: sx * 0.62, z: 0, y0: roofY + 0.05, y1: roofY + ROOF_H + 0.3, w: 0.26, d: 0.18, plaster: butter, trim: white, clay: m.terracotta('#D9826A'), pots: 3, rng });

  root.userData.update = () => {
    vane.updateWorldMatrix(true, false);
    vaneWorld.setFromMatrixPosition(vane.matrixWorld);
    // Undo the asset's own world rotation so the vane tracks the world wind.
    const parentYaw = new THREE.Euler().setFromQuaternion(root.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
    vane.rotation.y = vaneState.angle - parentYaw;
  };
  root.userData.footprint = { w: W, d: D };
  return root;
}
