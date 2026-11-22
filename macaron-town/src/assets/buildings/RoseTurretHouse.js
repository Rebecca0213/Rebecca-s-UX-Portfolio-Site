import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, sphere } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop, moldingRun, moldingPlan } from '../../kit/sweep.js';
import { plinth, cornice, stringCourse } from '../../kit/profiles.js';
import { wallSlab } from '../../kit/wall.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { slateGeometry, tilePlane, ridgeCaps, finial, cresting } from '../../kit/roofs.js';
import { railing } from '../../kit/railings.js';
import { wallPanel, hipRoof, chimney, wallLantern } from '../../kit/building.js';

// B09 — Rose turret house: rose stucco and cream dressings, sage shutters, a steep hipped roof with
// iron cresting — and at its front corner an octagonal turret that climbs a storey higher, ringed by
// a little iron balcony under a tall fish-scale spire with a gilded finial.

const W = 2.1;
const D = 1.9;
const T = 0.07;
const BASE = 0.068;
const G_TOP = 0.98;
const EAVE = 1.84;
const TOWER_TOP = EAVE + 0.72;
const SPIRE_H = 1.15;
const R_IN = 0.44; // turret inradius
const TC = [W / 2 - 0.12, D / 2 - 0.12]; // turret centre
const FACET = 2 * R_IN * Math.tan(Math.PI / 8);
const SLATES = ['#9C98BC', '#A5A1C4', '#938FB4', '#ABA7C9', '#9894B8'];

export default function build(ctx, { seed = 909 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'RoseTurretHouse';

  const rose = m.plaster('#F4C4CC');
  const cream = m.trim('#FFF8EE');
  const sage = m.paintedWood('#9FC4A8');
  const sash = m.paintedWood('#FFF8EE');
  const stone = m.stone('#F1E7DC');
  const iron = m.metal('iron');
  const brass = m.metal('brass');
  const gold = m.metal('gold');
  const zinc = m.metal('zinc');
  const flowers = ['#FFFFFF', '#F7A8BE', '#FFD1DC', '#F28CA6', '#FBE3EA'];
  const room = (k, glow = 0.95) => ({ style: 0, wall: ['#FBF0F2', '#F3F7EF', '#FBF4E8'][k % 3], accent: ['#9FC4A8', '#F2B8C6', '#F6D7A8'][k % 3], glow });
  const fh = EAVE - BASE;

  add(root, moldingLoop(plinth(0.07), W, D), stone, { name: 'plinthCourse' });

  /* ---------- main block ---------- */
  const fo = [
    { x: -0.15, y: 0, w: 0.34, h: 0.78, kind: 'round' },
    { x: -0.72, y: 0.2, w: 0.34, h: 0.52, kind: 'rect' },
    { x: -0.72, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
    { x: -0.15, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
  ];
  const front = wallPanel(root, { side: 'front', W, D, y: BASE, height: fh, thickness: T, openings: fo, material: rose, name: 'frontWall' });
  buildDoor(ctx, front, { ...fo[0], trim: cream, material: sage, metal: brass, stone, glazed: true, room: room(1, 1.1), casing: 0.045, steps: 2, hood: true, seed: 0.37 });
  fo.slice(1).forEach((o, i) => buildWindow(ctx, front, { ...o, trim: cream, sash, panes: [2, 3], casing: 0.04, room: room(i), seed: 0.13 + i * 0.11, shutters: sage, box: { material: cream, palette: flowers } }));
  wallLantern(ctx, front, { x: 0.16, y: 0.6, brass, iron });

  const ro = [0.05, 0.6].flatMap((x) => [{ x, y: 0.2, w: 0.3, h: 0.52, kind: 'rect' }, { x, y: 1.0, w: 0.28, h: 0.52, kind: 'rect' }]);
  const right = wallPanel(root, { side: 'right', W, D, y: BASE, height: fh, thickness: T, openings: ro, material: rose });
  ro.forEach((o, i) => buildWindow(ctx, right, { ...o, trim: cream, sash, panes: [2, 3], casing: 0.038, room: room(i + 1), seed: 0.41 + i * 0.05, shutters: sage }));
  const lo = [-0.45, 0.45].flatMap((x) => [{ x, y: 0.2, w: 0.3, h: 0.52, kind: 'rect' }, { x, y: 1.0, w: 0.28, h: 0.52, kind: 'rect' }]);
  const left = wallPanel(root, { side: 'left', W, D, y: BASE, height: fh, thickness: T, openings: lo, material: rose });
  lo.forEach((o, i) => buildWindow(ctx, left, { ...o, trim: cream, sash, panes: [2, 3], casing: 0.038, room: room(i), seed: 0.51 + i * 0.05, shutters: sage }));
  const bo = [
    { x: 0.55, y: 0, w: 0.3, h: 0.74, kind: 'rect' },
    { x: -0.55, y: 0.2, w: 0.34, h: 0.52, kind: 'rect' },
    { x: -0.55, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
    { x: 0, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
    { x: 0.55, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
  ];
  const back = wallPanel(root, { side: 'back', W, D, y: BASE, height: fh, thickness: T, openings: bo, material: rose, name: 'backWall' });
  buildDoor(ctx, back, { ...bo[0], trim: cream, material: sage, metal: brass, stone, glazed: false, casing: 0.04, steps: 2, seed: 0.83 });
  bo.slice(1).forEach((o, i) => buildWindow(ctx, back, { ...o, trim: cream, sash, panes: [2, 3], casing: 0.036, room: room(i + 2), seed: 0.86 + i * 0.03, shutters: sage }));
  add(root, moldingLoop(stringCourse(0.03), W, D), cream, { p: [0, G_TOP - 0.014, 0], name: 'storeyCourse' });
  add(root, moldingLoop(cornice(0.075), W, D), cream, { p: [0, EAVE, 0], name: 'eaveCornice' });

  const roofY = EAVE + 0.075 * 0.74;
  const main = hipRoof(root, {
    W: W + 0.12,
    D: D + 0.12,
    pitch: (52 * Math.PI) / 180,
    tile: { geometry: slateGeometry(0.06, 0.078, 0.006, 'scale'), material: m.slate('#FFFFFF'), colors: SLATES, tileW: 0.06, exposure: 0.036 },
    body: m.slate('#9894B8'),
    ridge: { material: zinc, colors: ['#FFFFFF'], radius: 0.02 },
    rng,
    name: 'mainRoof',
  });
  main.group.position.y = roofY;
  cresting(root, { from: [-main.W1 / 2, roofY + main.height + 0.02, 0], to: [main.W1 / 2, roofY + main.height + 0.02, 0], material: iron, height: 0.07 });
  chimney(root, { x: -0.62, z: -0.35, y0: roofY + 0.3, y1: roofY + main.height + 0.28, w: 0.2, d: 0.26, plaster: rose, trim: cream, clay: m.terracotta('#D9826A'), pots: 2, rng });

  /* ---------- octagonal turret ---------- */
  const turret = group(root, { p: [TC[0], 0, TC[1]], name: 'turret' });
  const tH = TOWER_TOP - BASE;
  const outward = new Set([7, 0, 1, 2]);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const face = group(turret, { p: [Math.sin(a) * R_IN, BASE, Math.cos(a) * R_IN], r: [0, a, 0], name: `facet-${k}` });
    const openings = outward.has(k)
      ? [
          { x: 0, y: 0.22, w: 0.18, h: 0.48, kind: 'rect' },
          { x: 0, y: 1.0, w: 0.17, h: 0.5, kind: 'rect' },
          { x: 0, y: fh + 0.14, w: 0.16, h: 0.44, kind: 'round' },
        ]
      : [];
    add(face, wallSlab(FACET + 0.002, tH, T, openings), rose, { name: 'slab' });
    openings.forEach((o, i) => buildWindow(ctx, face, { ...o, trim: cream, sash, panes: i === 2 ? [1, 3] : [1, 3], casing: 0.028, hood: false, keystone: i === 2, room: room(k + i, 1.0), seed: 0.2 + k * 0.07 + i * 0.013 }));
    // Pilaster strip on every arris.
    const ea = a + Math.PI / 8;
    const rc = R_IN / Math.cos(Math.PI / 8);
    add(turret, roundedBox(0.04, tH, 0.04, 0.006, 3), cream, { p: [Math.sin(ea) * rc, BASE + tH / 2, Math.cos(ea) * rc], r: [0, ea, 0], name: 'arris' });
  }
  // Octagon corners ordered so moldingPlan's outward normal (left of travel in x/z) faces out.
  const oct = (r) => Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4;
    return [Math.sin(a) * r, Math.cos(a) * r];
  });
  const rc = R_IN / Math.cos(Math.PI / 8);
  add(turret, moldingPlan(plinth(0.07), oct(rc), { closed: true }), stone, { name: 'turretPlinth' });
  add(turret, moldingPlan(stringCourse(0.03), oct(rc), { closed: true }), cream, { p: [0, G_TOP - 0.014, 0], name: 'turretCourse' });
  add(turret, moldingPlan(stringCourse(0.032), oct(rc), { closed: true }), cream, { p: [0, EAVE, 0], name: 'turretBand' });
  add(turret, moldingPlan(cornice(0.075), oct(rc), { closed: true }), cream, { p: [0, TOWER_TOP, 0], name: 'turretCornice' });

  // Iron balcony ringing the top storey, on a moulded stone ledge.
  const ledgeY = EAVE + 0.032 * 0.72;
  const ledge = new THREE.Shape(oct(rc + 0.13).map(([x, z]) => new THREE.Vector2(x, -z)));
  ledge.holes.push(new THREE.Path(oct(rc - 0.02).map(([x, z]) => new THREE.Vector2(x, -z)).reverse()));
  const ledgeGeo = new THREE.ExtrudeGeometry(ledge, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }).rotateX(-Math.PI / 2);
  add(turret, ledgeGeo, stone, { p: [0, ledgeY, 0], name: 'balconyLedge' });
  const railR = rc + 0.1;
  const rp = oct(railR);
  for (let k = 0; k < 8; k++) {
    // No railing where the run would pass inside the main block (or its eaves).
    const mid = ((k + 0.5) * Math.PI) / 4;
    const mx = TC[0] + Math.sin(mid) * railR * Math.cos(Math.PI / 8);
    const mz = TC[1] + Math.cos(mid) * railR * Math.cos(Math.PI / 8);
    if (Math.abs(mx) < W / 2 + 0.1 && Math.abs(mz) < D / 2 + 0.1) continue;
    const [ax, az] = rp[k];
    const [bx, bz] = rp[(k + 1) % 8];
    railing(ctx, turret, { from: [ax, ledgeY + 0.034, az], to: [bx, ledgeY + 0.034, bz], height: 0.12, spacing: 0.02, metal: iron, scrolls: true, newels: true });
  }

  // Fish-scale spire: eight tapering faces meeting at a gilded finial.
  const spire = group(turret, { p: [0, TOWER_TOP + 0.075 * 0.74, 0], name: 'spire' });
  const re = R_IN + 0.08;
  const slate = slateGeometry(0.05, 0.066, 0.005, 'scale');
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const n0 = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const origin = n0.clone().multiplyScalar(re);
    const u = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).negate();
    const toApex = new THREE.Vector3(0, SPIRE_H, 0).sub(origin);
    const len = toApex.length();
    const v = toApex.clone().normalize();
    const nrm = new THREE.Vector3().crossVectors(u, v).normalize();
    if (nrm.dot(n0) < 0) {
      u.negate();
      nrm.negate();
    }
    tilePlane(spire, { origin, u, v, n: nrm, width: 2 * re * Math.tan(Math.PI / 8) + 0.004, length: len * 0.97, taper: 0.02, tileW: 0.05, exposure: 0.03, geometry: slate, material: m.slate('#FFFFFF'), rng, colors: SLATES });
    // Solid core face under the slates.
    const tri = new THREE.BufferGeometry();
    const hw = re * Math.tan(Math.PI / 8);
    const p0 = origin.clone().addScaledVector(u, -hw);
    const p1 = origin.clone().addScaledVector(u, hw);
    tri.setAttribute('position', new THREE.Float32BufferAttribute([...p0.toArray(), ...p1.toArray(), 0, SPIRE_H, 0], 3));
    tri.computeVertexNormals();
    if (new THREE.Vector3().fromBufferAttribute(tri.attributes.normal, 0).dot(n0) < 0) tri.setIndex([0, 2, 1]);
    tri.computeVertexNormals();
    add(spire, tri, m.slate('#9894B8'), { name: 'spireCore' });
    const ea = a + Math.PI / 8;
    const rce = re / Math.cos(Math.PI / 8);
    ridgeCaps(spire, { from: [Math.sin(ea) * rce, 0.004, Math.cos(ea) * rce], to: [0, SPIRE_H, 0], radius: 0.014, material: zinc, rng, colors: ['#FFFFFF'], pieceLength: 0.08 });
  }
  finial(spire, { y: SPIRE_H - 0.02, height: 0.26, radius: 0.03, material: gold });
  add(spire, sphere(0.018, 20, 14), gold, { p: [0, SPIRE_H + 0.28, 0], name: 'finialTip' });

  root.userData.footprint = { w: W, d: D };
  return root;
}
