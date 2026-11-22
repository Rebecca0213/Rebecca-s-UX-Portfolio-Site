import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, lathe, spline, tube } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { moldingLoop, moldingRun } from '../../kit/sweep.js';
import { plinth, stringCourse, crown } from '../../kit/profiles.js';
import { wallFromShape } from '../../kit/wall.js';
import { buildWindow } from '../../kit/windows.js';
import { buildDoor } from '../../kit/doors.js';
import { slateGeometry, tilePlane, ridgeCaps } from '../../kit/roofs.js';
import { wallPanel, chimney, wallLantern } from '../../kit/building.js';
import { leafGeometry, racemeGeometry } from '../../kit/flora.js';

// B07 — Wisteria house: lavender stucco under a silver-slate gambrel whose double-pitched profile
// faces the street. A white timber pergola runs the width of the ground floor; two old wisteria
// trunks twist up its outer posts and spread along every beam, hung with a hundred racemes that sway
// in the wind. Grey-violet shutters, a plum door, an attic French window and an oculus in the gambrel.

const W = 1.9;
const D = 1.75;
const T = 0.07;
const BASE = 0.068;
const G_TOP = 0.98;
const EAVE = 1.84;
const LOW_PITCH = (68 * Math.PI) / 180;
const UP_PITCH = (28 * Math.PI) / 180;
const KNEE_X = 0.55;
const KNEE_Y = (W / 2 - KNEE_X) * Math.tan(LOW_PITCH);
const RIDGE_Y = KNEE_Y + KNEE_X * Math.tan(UP_PITCH);
const EAVE_OUT = 0.05;
const VERGE = 0.08;
const SLATES = ['#ABA8BC', '#B4B1C4', '#A29FB4', '#B9B6C8', '#A6A3B8'];
const P_DEPTH = 0.42; // pergola projection
const P_TOP = 0.9; // underside of the pergola joists (from the ground)

function gambrelOutline(height) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, height);
  s.lineTo(KNEE_X, height + KNEE_Y);
  s.lineTo(0, height + RIDGE_Y - 0.002);
  s.lineTo(-KNEE_X, height + KNEE_Y);
  s.lineTo(-W / 2, height);
  s.closePath();
  return s;
}

export default function build(ctx, { seed = 707 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'WisteriaHouse';

  const lavender = m.plaster('#DCD0EC');
  const white = m.trim('#FFFDF8');
  const timber = m.paintedWood('#FFFDF8');
  const shutterMat = m.paintedWood('#9D91B9');
  const plum = m.paintedWood('#8C6AA6');
  const sash = m.paintedWood('#FFFDF8');
  const stone = m.stone('#EEE6DD');
  const iron = m.metal('iron');
  const brass = m.metal('brass');
  const zinc = m.metal('zinc');
  const bark = m.bark('#8A765F');
  const pansies = ['#B9A3E3', '#FFFFFF', '#F7D36B', '#E4D9F7', '#9C7FD0'];
  const room = (k, glow = 0.95) => ({ style: 0, wall: ['#F6F1FA', '#FBF2EC', '#F2F5F0'][k % 3], accent: ['#B9A3E3', '#F2B8C6', '#CFE3C8'][k % 3], glow });

  add(root, moldingLoop(plinth(0.07), W, D), stone, { name: 'plinthCourse' });

  /* ---------- front and back gambrel walls ---------- */
  const fh = EAVE - BASE;
  const fo = [
    { x: 0, y: 0, w: 0.34, h: 0.72, kind: 'round' }, // its surround stops under the pergola ledger
    { x: -0.6, y: 0.2, w: 0.36, h: 0.52, kind: 'rect' },
    { x: 0.6, y: 0.2, w: 0.36, h: 0.52, kind: 'rect' },
    { x: -0.6, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
    { x: 0, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
    { x: 0.6, y: 1.0, w: 0.3, h: 0.52, kind: 'rect' },
    { x: 0, y: fh + 0.12, w: 0.36, h: 0.6, kind: 'rect' },
    { x: 0, y: fh + 0.86, w: 0.18, h: 0.18, kind: 'circle' },
  ];
  const front = group(root, { p: [0, BASE, D / 2], name: 'frontWall' });
  add(front, wallFromShape(gambrelOutline(fh), T, fo), lavender, { name: 'slab' });
  buildDoor(ctx, front, { ...fo[0], trim: white, material: plum, metal: brass, stone, glazed: false, casing: 0.045, steps: 2, seed: 0.37 });
  fo.slice(1, 6).forEach((o, i) => buildWindow(ctx, front, { ...o, trim: white, sash, panes: [2, 3], casing: 0.04, room: room(i), seed: 0.13 + i * 0.11, shutters: shutterMat, box: i >= 2 ? { material: white, palette: pansies } : null }));
  buildWindow(ctx, front, { ...fo[6], trim: white, sash, panes: [2, 4], casing: 0.04, sill: false, room: room(1, 1.0), seed: 0.71, balcony: { stone } });
  buildWindow(ctx, front, { ...fo[7], trim: white, sash, panes: [2, 2], casing: 0.03, room: room(2), seed: 0.79 });
  add(front, moldingRun(stringCourse(0.03), W), white, { p: [-W / 2, G_TOP - BASE - 0.014, 0], name: 'storeyCourse' });
  add(front, moldingRun(stringCourse(0.03), W), white, { p: [-W / 2, fh - 0.02, 0], name: 'atticCourse' });
  wallLantern(ctx, front, { x: 0.27, y: 0.6, brass, iron });

  const bo = [
    { x: 0.45, y: 0, w: 0.3, h: 0.74, kind: 'rect' },
    { x: -0.4, y: 0.2, w: 0.36, h: 0.52, kind: 'rect' },
    { x: -0.5, y: 1.0, w: 0.3, h: 0.5, kind: 'rect' },
    { x: 0.5, y: 1.0, w: 0.3, h: 0.5, kind: 'rect' },
    { x: 0, y: fh + 0.18, w: 0.3, h: 0.48, kind: 'rect' },
  ];
  const back = group(root, { p: [0, BASE, -D / 2], r: [0, Math.PI, 0], name: 'backWall' });
  add(back, wallFromShape(gambrelOutline(fh), T, bo), lavender, { name: 'slab' });
  buildDoor(ctx, back, { ...bo[0], trim: white, material: plum, metal: brass, stone, glazed: true, room: room(1), casing: 0.04, steps: 2, seed: 0.83 });
  bo.slice(1).forEach((o, i) => buildWindow(ctx, back, { ...o, trim: white, sash, panes: [2, 3], casing: 0.036, room: room(i + 1), seed: 0.86 + i * 0.03, shutters: i < 3 ? shutterMat : null }));
  add(back, moldingRun(stringCourse(0.03), W), white, { p: [-W / 2, G_TOP - BASE - 0.014, 0], name: 'storeyCourse' });

  for (const side of ['left', 'right']) {
    const o = [-0.4, 0.4].flatMap((x) => [{ x, y: 0.2, w: 0.3, h: 0.5, kind: 'rect' }, { x, y: 1.0, w: 0.28, h: 0.5, kind: 'rect' }]);
    const wall = wallPanel(root, { side, W, D, y: BASE, height: fh, thickness: T, openings: o, material: lavender });
    o.forEach((oo, i) => buildWindow(ctx, wall, { ...oo, trim: white, sash, panes: [2, 3], casing: 0.038, room: room(i + 2), seed: (side === 'left' ? 0.21 : 0.27) + i * 0.05, shutters: shutterMat }));
    add(wall, moldingRun(stringCourse(0.03), D - 2 * T), white, { p: [-(D - 2 * T) / 2, G_TOP - BASE - 0.014, 0], name: 'sideCourse' });
    add(wall, moldingRun(crown(0.045), D - 2 * T), white, { p: [-(D - 2 * T) / 2, fh - 0.075, 0], name: 'eaveCrown' });
  }

  /* ---------- gambrel roof ---------- */
  const roof = group(root, { p: [0, EAVE, 0], name: 'gambrelRoof' });
  const width = D + 2 * VERGE;
  const tile = slateGeometry(0.062, 0.082, 0.007, 'square');
  const slateMat = m.slate('#FFFFFF');
  const basis = new THREE.Matrix4();
  const planes = [];
  for (const sx of [1, -1]) {
    const c1 = Math.cos(LOW_PITCH);
    const s1 = Math.sin(LOW_PITCH);
    const c2 = Math.cos(UP_PITCH);
    const s2 = Math.sin(UP_PITCH);
    const lowOrigin = new THREE.Vector3(sx * (W / 2 + EAVE_OUT), -EAVE_OUT * Math.tan(LOW_PITCH), 0);
    const lowLen = (W / 2 + EAVE_OUT - KNEE_X) / c1;
    const lap = 0.05;
    const upOrigin = new THREE.Vector3(sx * (KNEE_X + lap * c2), KNEE_Y - lap * s2, 0);
    const upLen = KNEE_X / c2 + lap;
    planes.push(
      { origin: lowOrigin, v: new THREE.Vector3(-sx * c1, s1, 0), n: new THREE.Vector3(sx * s1, c1, 0), len: lowLen, eave: true },
      { origin: upOrigin, v: new THREE.Vector3(-sx * c2, s2, 0), n: new THREE.Vector3(sx * s2, c2, 0), len: upLen }
    );
  }
  for (const pl of planes) {
    const u = new THREE.Vector3().crossVectors(pl.v, pl.n).normalize();
    const w = new THREE.Vector3().crossVectors(u, pl.n);
    const deck = add(roof, roundedBox(width, 0.016, pl.len, 0.004, 2), m.paintedWood('#FFFDF8'), { name: 'deck' });
    deck.quaternion.setFromRotationMatrix(basis.makeBasis(u, pl.n, w));
    deck.position.copy(pl.origin).addScaledVector(pl.v, pl.len / 2).addScaledVector(pl.n, -0.008);
    tilePlane(roof, { origin: pl.origin, u, v: pl.v, n: pl.n, width, length: pl.len, tileW: 0.062, exposure: 0.037, geometry: tile, material: slateMat, rng, colors: SLATES });
    for (const end of [1, -1]) {
      const board = add(roof, roundedBox(0.02, 0.055, pl.len + 0.02, 0.005, 2), white, { name: 'bargeboard' });
      board.quaternion.setFromRotationMatrix(basis.makeBasis(u, pl.n, w));
      board.position.copy(pl.origin).addScaledVector(pl.v, pl.len / 2).addScaledVector(pl.n, -0.004).add(new THREE.Vector3(0, 0, end * (width / 2 + 0.008)));
    }
    if (pl.eave) {
      // Fascia board along the eave (local x runs along u, the eave direction).
      const fascia = add(roof, roundedBox(width + 0.02, 0.05, 0.018, 0.004, 2), white, { name: 'fascia' });
      fascia.quaternion.setFromRotationMatrix(basis.makeBasis(u, pl.n, w));
      fascia.position.copy(pl.origin).addScaledVector(pl.n, -0.024).addScaledVector(pl.v, 0.004);
    }
  }
  ridgeCaps(roof, { from: [0, RIDGE_Y + 0.012, -width / 2 - 0.01], to: [0, RIDGE_Y + 0.012, width / 2 + 0.01], radius: 0.026, material: zinc, rng, colors: ['#FFFFFF'] });
  for (const sx of [1, -1]) ridgeCaps(roof, { from: [sx * KNEE_X, KNEE_Y + 0.01, -width / 2], to: [sx * KNEE_X, KNEE_Y + 0.01, width / 2], radius: 0.016, material: zinc, rng, colors: ['#FFFFFF'] });
  chimney(root, { x: -0.3, z: -0.45, y0: EAVE + KNEE_Y, y1: EAVE + RIDGE_Y + 0.3, w: 0.18, d: 0.24, plaster: lavender, trim: white, clay: m.terracotta('#D9826A'), pots: 2, rng });

  /* ---------- pergola ---------- */
  const pergola = group(root, { p: [0, 0, D / 2], name: 'pergola' });
  const postXs = [-0.86, -0.3, 0.3, 0.86];
  const post = lathe(spline([[0, 0], [0.03, 0], [0.03, 0.04], [0.022, 0.06], [0.02, 0.2], [0.024, 0.45], [0.02, 0.75], [0.026, 0.8], [0.03, 0.83], [0, 0.83]], 72), 28);
  for (const x of postXs) {
    add(pergola, roundedBox(0.07, 0.03, 0.07, 0.005, 2), stone, { p: [x, 0.015, P_DEPTH], name: 'postBase' });
    add(pergola, post, timber, { p: [x, 0.03, P_DEPTH], name: 'post' });
  }
  add(pergola, roundedBox(W + 0.12, 0.06, 0.05, 0.006, 3), timber, { p: [0, P_TOP + 0.03 - 0.06, P_DEPTH], name: 'frontBeam' });
  add(pergola, roundedBox(W, 0.05, 0.04, 0.005, 3), timber, { p: [0, P_TOP + 0.03 - 0.06, 0.02], name: 'ledger' });
  const joistXs = [];
  for (let i = 0; i < 9; i++) joistXs.push(-0.88 + (1.76 * i) / 8);
  const joist = new THREE.Shape();
  joist.moveTo(0, 0);
  joist.lineTo(P_DEPTH + 0.06, 0);
  joist.quadraticCurveTo(P_DEPTH + 0.09, 0.015, P_DEPTH + 0.09, 0.05);
  joist.lineTo(0, 0.05);
  joist.closePath();
  const joistGeo = new THREE.ExtrudeGeometry(joist, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 12 });
  joistGeo.rotateY(-Math.PI / 2);
  joistGeo.translate(0.011, 0, 0);
  for (const x of joistXs) add(pergola, joistGeo, timber, { p: [x, P_TOP, 0.0], name: 'joist' });

  /* ---------- the wisteria ---------- */
  const vines = group(pergola, { name: 'wisteria' });
  const leafItems = [];
  const leafAlong = (pts, count, spread = 0.03) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    for (let i = 0; i < count; i++) {
      const p = curve.getPointAt(rng.range(0.05, 1));
      leafItems.push({
        p: [p.x + rng.range(-spread, spread), p.y + rng.range(-spread * 0.6, spread), p.z + rng.range(-spread, spread)],
        r: [rng.range(-1.2, 0.4), rng.range(0, Math.PI * 2), rng.range(-0.4, 0.4)],
        s: rng.range(0.022, 0.034),
        color: new THREE.Color('#86B36F').offsetHSL(rng.range(-0.02, 0.02), rng.range(-0.06, 0.04), rng.range(-0.05, 0.06)),
      });
    }
    return curve;
  };
  for (const sx of [-1, 1]) {
    const px = sx * 0.86;
    const trunk = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const a = t * Math.PI * 2 * 2.2 + (sx > 0 ? 1 : 0);
      trunk.push([px + Math.cos(a) * 0.038, 0.01 + t * (P_TOP + 0.02), P_DEPTH + Math.sin(a) * 0.038]);
    }
    add(vines, tube(trunk, 0.014, { tubular: 160, radial: 10 }), bark, { name: 'trunk' });
    const twin = trunk.map(([x, y, z], i) => {
      const a = (i / 28) * Math.PI * 2 * 2.2 + Math.PI + (sx > 0 ? 1 : 0);
      return [px + Math.cos(a) * 0.034, y, P_DEPTH + Math.sin(a) * 0.034];
    });
    add(vines, tube(twin.slice(3), 0.009, { tubular: 140, radial: 8 }), bark, { name: 'trunk' });
    // Main canes along the front beam toward the centre, and back over the joists to the wall.
    const beamRun = [[px, P_TOP + 0.03, P_DEPTH], [px - sx * 0.3, P_TOP + 0.075, P_DEPTH + 0.02], [px - sx * 0.62, P_TOP + 0.06, P_DEPTH - 0.01], [px - sx * 0.88, P_TOP + 0.08, P_DEPTH + 0.015]];
    add(vines, tube(beamRun, 0.009, { tubular: 80, radial: 8 }), bark, { name: 'cane' });
    leafAlong(beamRun, 150);
    const backRun = [[px, P_TOP + 0.03, P_DEPTH], [px - sx * 0.08, P_TOP + 0.07, P_DEPTH * 0.6], [px - sx * 0.12, P_TOP + 0.06, P_DEPTH * 0.25], [px - sx * 0.2, P_TOP + 0.12, 0.03]];
    add(vines, tube(backRun, 0.008, { tubular: 60, radial: 8 }), bark, { name: 'cane' });
    leafAlong(backRun, 70);
    leafAlong(trunk.slice(10), 40, 0.04);
    // Up the wall beside the first-floor windows.
    const climb = [[px - sx * 0.2, P_TOP + 0.12, 0.03], [px - sx * 0.12, P_TOP + 0.3, 0.02], [px - sx * 0.05, P_TOP + 0.55, 0.025], [px + sx * 0.01, P_TOP + 0.78, 0.02]];
    add(vines, tube(climb, 0.007, { tubular: 60, radial: 8 }), bark, { name: 'cane' });
    leafAlong(climb, 70, 0.035);
  }
  for (const x of [-0.44, 0, 0.44]) {
    const run = [[x - 0.16, P_TOP + 0.07, 0.04], [x, P_TOP + 0.1, P_DEPTH * 0.5], [x + 0.1, P_TOP + 0.07, P_DEPTH + 0.02]];
    add(vines, tube(run, 0.006, { tubular: 40, radial: 6 }), bark, { name: 'cane' });
    leafAlong(run, 60);
  }
  vines.add(instanced(leafGeometry({ length: 1, width: 0.42, fold: 0.14, arch: 0.1, segU: 6, segV: 10 }), m.leaf('#FFFFFF', { anchor: 0, range: 1, flutter: 0.45, space: 'local' }), leafItems, { name: 'leaves' }));

  const racemes = [];
  const hangFrom = (x, z) => {
    const len = rng.range(0.12, 0.22);
    racemes.push({
      p: [x + rng.range(-0.012, 0.012), P_TOP - 0.004, z],
      r: [rng.range(-0.12, 0.12), rng.range(0, Math.PI * 2), rng.range(-0.12, 0.12)],
      s: len,
      color: new THREE.Color('#FFFFFF').offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.06, 0)),
    });
  };
  for (const x of joistXs) for (let z = 0.06; z < P_DEPTH + 0.06; z += rng.range(0.045, 0.07)) if (rng.chance(0.85)) hangFrom(x + rng.range(-0.02, 0.02), z);
  for (let x = -0.95; x < 0.95; x += rng.range(0.04, 0.065)) if (Math.abs(Math.abs(x) - 0.86) > 0.04 && Math.abs(Math.abs(x) - 0.3) > 0.04) hangFrom(x, P_DEPTH + rng.range(-0.02, 0.03));
  // A few on the wall beside the upper windows.
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const len = rng.range(0.1, 0.17);
      racemes.push({ p: [sx * (0.86 - 0.2 + i * 0.03 * sx), P_TOP + 0.3 + i * 0.08, 0.035], r: [rng.range(-0.2, 0.1), rng.range(0, 6.28), rng.range(-0.15, 0.15)], s: len, color: '#FFFFFF' });
    }
  }
  vines.add(instanced(racemeGeometry({ florets: 44, length: 1 }), m.wisteria(1), racemes, { name: 'racemes' }));

  root.userData.stats = { racemes: racemes.length, leaves: leafItems.length };
  root.userData.footprint = { w: W, d: D };
  return root;
}
