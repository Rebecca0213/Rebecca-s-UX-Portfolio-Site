import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, lathe, spline, extrude, roundedBox } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { moldingAlong } from '../../kit/sweep.js';
import { architrave } from '../../kit/profiles.js';
import { opening } from '../../kit/shapes.js';
import { wallSlab } from '../../kit/wall.js';
import { voussoirs } from '../../kit/building.js';
import { slateGeometry, tileCone, finial } from '../../kit/roofs.js';

// L6 — The pink castle on its own islet, a fairy-tale silhouette for the skyline. A tall round keep
// engaged in the back wall carries two corbelled bartizans and a gilt-railed balcony; corner towers
// (taller at the back) and two slim gate towers rise under steep cones of lavender fish-scale
// slates on machicolated galleries, each with a gilded finial and a pennant in the wind. Crenellated
// curtain walls with wall-walks link them, and the gatehouse arch has voussoirs, oak doors and a
// gilded portcullis, reached by steps from a stone terrace. Lit arched windows ring every tower.
// Frame: the gate faces +z.

const TAU = Math.PI * 2;
const TERRACE = 0.1;
const WALL_H = 0.95;
const WALL_T = 0.14;

const TOWERS = [
  { id: 'keep', x: 0, z: -0.5, R: 0.5, H: 2.95, roofH: 1.95, rows: [0.6, 1.2, 1.8, 2.5], windows: 6, flag: '#F28CA6' },
  { id: 'backLeft', x: -1.2, z: -1.02, R: 0.31, H: 2.2, roofH: 1.35, rows: [0.65, 1.3, 1.85], windows: 5, flag: '#A9DCC8' },
  { id: 'backRight', x: 1.2, z: -1.02, R: 0.31, H: 2.2, roofH: 1.35, rows: [0.65, 1.3, 1.85], windows: 5, flag: '#A9DCC8' },
  { id: 'frontLeft', x: -1.42, z: 0.85, R: 0.28, H: 1.7, roofH: 1.15, rows: [0.6, 1.25], windows: 4, flag: '#FFE19A' },
  { id: 'frontRight', x: 1.42, z: 0.85, R: 0.28, H: 1.7, roofH: 1.15, rows: [0.6, 1.25], windows: 4, flag: '#FFE19A' },
  { id: 'gateLeft', x: -0.46, z: 1.25, R: 0.2, H: 1.45, roofH: 0.95, rows: [1.0], windows: 3, flag: '#F28CA6' },
  { id: 'gateRight', x: 0.46, z: 1.25, R: 0.2, H: 1.45, roofH: 0.95, rows: [1.0], windows: 3, flag: '#F28CA6' },
];
// Curtain walls between towers (by id), in order round the bailey; the gate wall is built apart.
const WALLS = [['frontLeft', 'gateLeft'], ['gateRight', 'frontRight'], ['frontRight', 'backRight'], ['backRight', 'backLeft'], ['backLeft', 'frontLeft']];
const SLATES = ['#A9A4E0', '#B4AFE8', '#9F99D8', '#BDB8EC', '#A6A0DC'];

// Arched window on a round tower (at angle a, radius R): interior-mapped glass, white architrave,
// sill and keystone.
function towerWindow(ctx, parent, { a, R, y, w, h, seed }) {
  const m = ctx.materials;
  const trim = m.trim('#FFFBF6');
  const g = group(parent, { p: [Math.sin(a) * R, y, Math.cos(a) * R], r: [0, a, 0], name: 'window' });
  const shape = opening({ w, h, kind: 'round' });
  add(g, new THREE.ShapeGeometry(opening({ w: w - 0.012, h: h - 0.012, kind: 'round' }), 24).translate(0, -(h - 0.012) / 2, 0), m.glass({ width: w, height: h, depth: 0.2, style: 0, glow: 1.25, seed, wall: '#F8E4E8', accent: '#C9B6F0' }), { p: [0, 0.006 + (h - 0.012) / 2, 0.003], cast: false, name: 'glass' });
  const outline = shape.getPoints(24);
  outline.pop();
  add(g, moldingAlong(outline, architrave(0.016), { closed: true }), trim, { p: [0, 0, 0.004], name: 'architrave' });
  add(g, roundedBox(w + 0.03, 0.014, 0.03, 0.004, 2), trim, { p: [0, -0.006, 0.012], name: 'sill' });
  return g;
}

// A round tower: battered plinth, pink walls with white string courses and rings of arched windows,
// a machicolated gallery of corbels under a projecting band, a steep cone of fish-scale slates, a
// gilded finial and a pennant.
function roundTower(ctx, parent, spec, rng) {
  const m = ctx.materials;
  const { x, z, R, H, roofH, rows, windows, flag } = spec;
  const g = group(parent, { p: [x, TERRACE, z], name: spec.id });
  const wall = m.plaster('#F6C9D3');
  const trim = m.trim('#FFFBF6');
  const stone = m.stone('#EADFD6');
  add(g, lathe(spline([[0, 0], [R + 0.04, 0], [R + 0.03, 0.09], [R + 0.006, 0.15], [R, 0.16], [0, 0.16]], 24), 96), stone, { name: 'plinth' });
  add(g, cylinder(R, R, H - 0.15, 96, 1), wall, { p: [0, 0.15 + (H - 0.15) / 2, 0], name: 'wall' });
  for (const y of [0.16, ...rows.slice(1).map((r) => r - 0.12)]) add(g, torus(R + 0.004, 0.012, 8, 96), trim, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], name: 'stringCourse' });
  rows.forEach((y, ri) => {
    for (let k = 0; k < windows; k++) {
      const a = ((k + (ri % 2) * 0.5) / windows) * TAU;
      towerWindow(ctx, g, { a, R: R + 0.002, y, w: R > 0.4 ? 0.1 : R > 0.15 ? 0.075 : 0.05, h: R > 0.4 ? 0.21 : R > 0.15 ? 0.16 : 0.1, seed: rng() });
    }
  });
  // Machicolated gallery: corbels in a ring carrying a projecting band.
  const galleryY = H - 0.1;
  const corbels = [];
  const count = Math.round((TAU * R) / 0.07);
  for (let k = 0; k < count; k++) {
    const a = (k / count) * TAU;
    corbels.push({ p: [Math.sin(a) * (R + 0.022), galleryY - 0.04, Math.cos(a) * (R + 0.022)], r: [0, a, 0], s: [1, 1, 1] });
  }
  g.add(instanced(roundedBox(0.032, 0.07, 0.05, 0.008, 2), trim, corbels, { name: 'corbels' }));
  add(g, lathe([[R, galleryY], [R + 0.075, galleryY], [R + 0.08, galleryY + 0.01], [R + 0.08, galleryY + 0.09], [R + 0.075, galleryY + 0.1], [R, galleryY + 0.1]], 96), wall, { name: 'gallery' });
  add(g, torus(R + 0.08, 0.008, 8, 96), trim, { p: [0, galleryY + 0.1, 0], r: [Math.PI / 2, 0, 0], name: 'galleryBead' });
  // Steep cone of fish-scale slates over a deck, overhanging the gallery.
  const coneR = R + 0.13;
  const coneY = galleryY + 0.1;
  add(g, cylinder(0.001, coneR - 0.01, roofH, 96, 1, true), m.slate('#8F89C9'), { p: [0, coneY + roofH / 2, 0], name: 'roofDeck' });
  add(g, cylinder(coneR - 0.005, coneR - 0.005, 0.012, 96, 1), m.paintedWood('#FFF4EC'), { p: [0, coneY + 0.006, 0], name: 'eaveSoffit' });
  const scale = Math.min(1, R / 0.4);
  tileCone(g, { radius: coneR, height: roofH, baseY: coneY, tileW: 0.05 * Math.max(0.75, scale), exposure: 0.034 * Math.max(0.8, scale), geometry: slateGeometry(0.05 * Math.max(0.75, scale), 0.068 * Math.max(0.8, scale), 0.005, 'scale', { light: true }), material: m.slate('#FFFFFF'), rng, colors: SLATES, lift: 0.005 });
  add(g, torus(coneR - 0.01, 0.01, 8, 96), trim, { p: [0, coneY + 0.012, 0], r: [Math.PI / 2, 0, 0], name: 'eaveRoll' });
  const fin = group(g, { p: [0, coneY + roofH - 0.02, 0], name: 'finial' });
  finial(fin, { y: 0, height: 0.16 + R * 0.2, radius: 0.018 + R * 0.02, material: m.metal('gold') });
  const staff = 0.2 + R * 0.25;
  add(fin, cylinder(0.004, 0.004, staff, 12, 1), m.metal('gold'), { p: [0, 0.12 + staff / 2, 0], name: 'flagstaff' });
  const pennant = new THREE.Shape();
  const len = 0.16 + R * 0.25;
  pennant.moveTo(-0.028, 0);
  pennant.lineTo(0.028, 0);
  pennant.lineTo(0.008, len);
  pennant.lineTo(0, len * 0.82);
  pennant.lineTo(-0.008, len);
  pennant.closePath();
  const f = add(fin, new THREE.ShapeGeometry(pennant, 8), m.flag(flag, len), { p: [0, 0.12 + staff - 0.03, 0], r: [0, 0, -Math.PI / 2], name: 'pennant' });
  f.castShadow = false;
  return g;
}

// Crenellated curtain wall between two tower centres: battered plinth, pink wall, string course,
// a stone wall-walk and merlons along both faces.
function curtainWall(ctx, parent, a, b, merlons) {
  const m = ctx.materials;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const start = a.R * 0.7;
  const end = len - b.R * 0.7;
  const run = end - start;
  const cx = a.x + ux * (start + run / 2);
  const cz = a.z + uz * (start + run / 2);
  const ry = Math.atan2(uz, ux) * -1;
  const g = group(parent, { p: [cx, TERRACE, cz], r: [0, ry, 0], name: 'curtainWall' });
  add(g, roundedBox(run, 0.16, WALL_T + 0.08, 0.01, 2), m.stone('#EADFD6'), { p: [0, 0.08, 0], name: 'plinth' });
  add(g, roundedBox(run, WALL_H - 0.16, WALL_T, 0.006, 2), m.plaster('#F6C9D3'), { p: [0, 0.16 + (WALL_H - 0.16) / 2, 0], name: 'wall' });
  add(g, roundedBox(run, 0.022, WALL_T + 0.03, 0.006, 2), m.trim('#FFFBF6'), { p: [0, WALL_H - 0.011, 0], name: 'wallWalk' });
  // String course and a row of small lit arched windows on the outer face (away from the bailey).
  const outward = -uz * cx + ux * cz > 0 ? 1 : -1;
  add(g, roundedBox(run, 0.018, WALL_T + 0.02, 0.005, 2), m.trim('#FFFBF6'), { p: [0, 0.5, 0], name: 'stringCourse' });
  const lights = Math.max(1, Math.floor(run / 0.36));
  for (let i = 0; i < lights; i++) {
    const x = -run / 2 + (run / lights) * (i + 0.5);
    const win = group(g, { p: [x, 0.6, (outward * WALL_T) / 2], r: [0, outward > 0 ? 0 : Math.PI, 0], name: 'wallWindow' });
    const w = 0.07;
    const h = 0.15;
    add(win, new THREE.ShapeGeometry(opening({ w, h, kind: 'round' }), 16).translate(0, -h / 2, 0), m.glass({ width: w, height: h, depth: 0.16, style: 0, glow: 1.2, seed: (x * 7.3 + cz) % 1, wall: '#F8E4E8', accent: '#C9B6F0' }), { p: [0, h / 2, 0.002], cast: false, name: 'glass' });
    const outline = opening({ w, h, kind: 'round' }).getPoints(16);
    outline.pop();
    add(win, moldingAlong(outline, architrave(0.014), { closed: true }), m.trim('#FFFBF6'), { p: [0, 0, 0.003], name: 'architrave' });
  }
  const n = Math.max(2, Math.floor(run / 0.13));
  for (let i = 0; i < n; i++) {
    const x = -run / 2 + (run / n) * (i + 0.5);
    for (const side of [-1, 1]) merlons.push({ g, p: [x, WALL_H + 0.045, side * (WALL_T / 2 - 0.02)] });
  }
  return g;
}

export default function build(ctx, { seed = 606 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'PinkCastle';

  const stone = m.stone('#EADFD6');
  const granite = m.granite('#E2D8D0');
  const trim = m.trim('#FFFBF6');
  const wallPink = m.plaster('#F6C9D3');
  const gold = m.metal('gold');

  /* ---------- terrace and approach ---------- */
  const terrace = new THREE.Shape();
  terrace.moveTo(-1.85, -1.55);
  terrace.lineTo(1.85, -1.55);
  terrace.lineTo(1.85, 1.35);
  terrace.lineTo(0.75, 1.75);
  terrace.lineTo(-0.75, 1.75);
  terrace.lineTo(-1.85, 1.35);
  terrace.closePath();
  add(root, extrude(terrace, TERRACE, { bevel: 0.012, bevelSegments: 3, center: false }), stone, { r: [Math.PI / 2, 0, 0], p: [0, TERRACE - 0.012, 0], name: 'terrace' });
  for (let k = 0; k < 3; k++) {
    const h = TERRACE - (k + 1) * (TERRACE / 3) + TERRACE / 3;
    add(root, roundedBox(0.6, h, 0.1, 0.008, 2), granite, { p: [0, h / 2, 1.75 + 0.05 + 0.1 * k], name: 'step' });
  }

  /* ---------- towers ---------- */
  const byId = {};
  for (const spec of TOWERS) {
    byId[spec.id] = spec;
    roundTower(ctx, root, spec, rng);
  }

  /* ---------- keep: balcony and bartizans ---------- */
  const keep = byId.keep;
  const balconyY = TERRACE + 2.18;
  add(root, lathe([[keep.R, -0.03], [keep.R + 0.16, -0.01], [keep.R + 0.16, 0.02], [keep.R, 0.02]], 128), trim, { p: [keep.x, balconyY, keep.z], name: 'balconyFloor' });
  const posts = [];
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * TAU;
    posts.push({ p: [keep.x + Math.sin(a) * (keep.R + 0.145), balconyY + 0.02, keep.z + Math.cos(a) * (keep.R + 0.145)], s: [0.006, 0.12, 0.006] });
  }
  root.add(instanced(cylinder(1, 1, 1, 8, 1).translate(0, 0.5, 0), gold, posts, { name: 'balconyRail' }));
  add(root, torus(keep.R + 0.145, 0.008, 8, 128), gold, { p: [keep.x, balconyY + 0.14, keep.z], r: [Math.PI / 2, 0, 0], name: 'balconyTopRail' });
  for (const side of [-1, 1]) {
    const a = side * 0.95;
    const bx = keep.x + Math.sin(a) * (keep.R + 0.02);
    const bz = keep.z + Math.cos(a) * (keep.R + 0.02);
    roundTower(ctx, root, { id: 'bartizan', x: bx, z: bz, R: 0.1, H: 0.46, roofH: 0.5, rows: [0.26], windows: 2, flag: '#FFE19A' }, rng).position.y = TERRACE + 1.55;
    add(root, lathe(spline([[0, 0.2], [0.12, 0.2], [0.095, 0.12], [0.05, 0.05], [0, 0]], 24), 48), stone, { p: [bx, TERRACE + 1.35, bz], name: 'bartizanCorbel' });
  }

  /* ---------- curtain walls ---------- */
  const merlons = [];
  for (const [a, b] of WALLS) curtainWall(ctx, root, byId[a], byId[b], merlons);
  const merlonGeo = roundedBox(0.075, 0.09, 0.04, 0.008, 2);
  const groups = new Map();
  for (const item of merlons) {
    if (!groups.has(item.g)) groups.set(item.g, []);
    groups.get(item.g).push({ p: item.p });
  }
  for (const [g, items] of groups) g.add(instanced(merlonGeo, wallPink, items, { name: 'merlons' }));

  /* ---------- gatehouse ---------- */
  const gl = byId.gateLeft;
  const gr = byId.gateRight;
  const gateW = gr.x - gl.x;
  const gate = group(root, { p: [0, TERRACE, gl.z + WALL_T / 2], name: 'gatehouse' });
  const archW = 0.28;
  const archH = 0.5;
  add(gate, wallSlab(gateW, WALL_H + 0.15, WALL_T, [{ w: archW, h: archH, kind: 'round', y: 0 }]), wallPink, { name: 'gateWall' });
  voussoirs(gate, { x: 0, spring: archH - archW / 2, radius: archW / 2, depth: 0.06, count: 11, proud: 0.018, material: trim, keyMaterial: gold, name: 'gateArch' });
  for (let k = 0; k < 5; k++) add(gate, roundedBox(0.075, 0.09, 0.05, 0.008, 2), wallPink, { p: [-gateW / 2 + 0.1 + k * ((gateW - 0.2) / 4), WALL_H + 0.15 + 0.045, -0.02], name: 'gateMerlon' });
  add(gate, roundedBox(gateW + 0.02, 0.024, WALL_T + 0.03, 0.006, 2), trim, { p: [0, WALL_H + 0.15 - 0.012, -WALL_T / 2], name: 'gateWalk' });
  // Oak doors stood open behind a raised gilded portcullis.
  for (const sx of [-1, 1]) {
    const leaf = add(gate, roundedBox(archW / 2 - 0.006, archH - archW / 2 + 0.04, 0.02, 0.004, 2), m.wood('#B98C64'), { p: [sx * (archW / 2 - 0.01), (archH - archW / 2 + 0.04) / 2, -WALL_T + 0.01], name: 'door' });
    leaf.rotation.y = sx * -1.2;
    leaf.position.x = sx * (archW / 2 - 0.02);
    leaf.position.z = -WALL_T - 0.05;
  }
  const grid = group(gate, { p: [0, archH * 0.62, -WALL_T * 0.5], name: 'portcullis' });
  for (let i = -3; i <= 3; i++) add(grid, roundedBox(0.008, archH * 0.42, 0.008, 0.002, 1), gold, { p: [i * 0.036, archH * 0.21, 0], name: 'portcullisBar' });
  for (let j = 0; j < 4; j++) add(grid, roundedBox(archW, 0.008, 0.008, 0.002, 1), gold, { p: [0, 0.04 + j * 0.1, 0], name: 'portcullisRail' });
  for (let i = -3; i <= 3; i++) add(grid, cylinder(0, 0.006, 0.03, 8, 1), gold, { p: [i * 0.036, -0.015, 0], r: [Math.PI, 0, 0], name: 'portcullisSpike' });
  // Heraldic roundel over the arch: a gilt ring round a pink boss.
  add(gate, torus(0.06, 0.009, 10, 48), gold, { p: [0, archH + 0.16, 0.012], name: 'roundel' });
  add(gate, sphere(1, 24, 16), m.plaster('#F28CA6'), { p: [0, archH + 0.16, 0.012], s: [0.048, 0.048, 0.016], name: 'roundelBoss' });

  root.userData.footprint = { r: 2.3 };
  return root;
}
