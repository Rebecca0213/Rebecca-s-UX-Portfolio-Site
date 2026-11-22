import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, lathe, spline, tube, extrude, roundedBox } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { moldingAlong, moldingRing } from '../../kit/sweep.js';
import { architrave, cornice, plinth } from '../../kit/profiles.js';
import { opening } from '../../kit/shapes.js';
import { balusterGeometry } from '../../kit/railings.js';
import { macaron } from '../../kit/macaron.js';
import { finial } from '../../kit/roofs.js';

// L4 — Macaron tower in the north-east parterre: four giant macarons stacked like the storeys of a
// pagoda, each set on a gilded colonnade around a cream core and carrying a balustraded deck, with
// festoons of bulbs swinging between the columns. It rises from a round stucco ground floor (pink
// double door, pâtisserie windows with their shelves of cakes, pink pilasters, cornice) on a
// stepped stone podium, and ends in a little belvedere with a striped dome, gilded finial and a
// pennant in the wind.

const TAU = Math.PI * 2;
const STEP_R = 0.85;
const PODIUM_R = 0.78;
const PODIUM_TOP = 0.095;
const DRUM_R = 0.46;
const DRUM_TOP = 0.52;
const TIERS = [
  { R: 0.5, flavour: 'rose', colonnade: 0.24 },
  { R: 0.43, flavour: 'pistachio', colonnade: 0.21 },
  { R: 0.37, flavour: 'lavender', colonnade: 0.19 },
  { R: 0.32, flavour: 'lemon', colonnade: 0 },
];
const HALF = 0.463; // a macaron's half height, as a fraction of its radius (filling + foot + shell)

// A round balustrade: top and bottom rails with turned balusters between.
function ringBalustrade(parent, { radius, y, height, spacing = 0.03, material, name = 'balustrade' }) {
  const g = group(parent, { p: [0, y, 0], name });
  add(g, torus(radius, 0.007, 8, 160), material, { p: [0, height, 0], r: [Math.PI / 2, 0, 0], name: 'topRail' });
  add(g, torus(radius, 0.005, 8, 160), material, { p: [0, 0.012, 0], r: [Math.PI / 2, 0, 0], name: 'bottomRail' });
  const count = Math.round((TAU * radius) / spacing);
  const posts = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * TAU;
    posts.push({ p: [Math.sin(a) * radius, 0.012, Math.cos(a) * radius], s: [1.6, height - 0.012, 1.6] });
  }
  g.add(instanced(balusterGeometry(), material, posts, { name: 'balusters' }));
  return g;
}

// Arched opening on the round drum (wall frame: x along the wall, y up, z out): a recess, then a
// door leaf pair or interior-mapped glass, framed by a moulded architrave with a keystone.
function archedOpening(ctx, parent, { a, w, h, y, door, seed }) {
  const m = ctx.materials;
  const g = group(parent, { p: [Math.sin(a) * DRUM_R, y, Math.cos(a) * DRUM_R], r: [0, a, 0], name: door ? 'door' : 'window' });
  const shape = opening({ w, h, kind: 'round' });
  add(g, extrude(shape, 0.012, { center: false, curveSegments: 32 }), m.plaster('#E9D6CE'), { p: [0, 0, -0.008], name: 'reveal' });
  if (door) {
    for (const sx of [-1, 1]) {
      const leaf = new THREE.Shape();
      const half = w / 2 - 0.004;
      const spring = h - w / 2;
      leaf.moveTo(0, 0);
      leaf.lineTo(sx * half, 0);
      leaf.lineTo(sx * half, spring);
      leaf.absarc(0, spring, half, sx > 0 ? 0 : Math.PI, Math.PI / 2, sx < 0);
      leaf.lineTo(0, 0);
      add(g, extrude(leaf, 0.01, { center: false, curveSegments: 24 }), m.paintedWood('#F28CA6'), { p: [0, 0, 0.002], name: 'leaf' });
      add(g, roundedBox(w * 0.32, h * 0.32, 0.006, 0.003, 2), m.paintedWood('#F6B9C9'), { p: [sx * w * 0.22, h * 0.28, 0.014], name: 'panel' });
      add(g, sphere(0.007, 12, 10), m.metal('brass'), { p: [sx * 0.012, h * 0.45, 0.016], name: 'knob' });
    }
  } else {
    const glassGeo = new THREE.ShapeGeometry(opening({ w: w - 0.016, h: h - 0.016, kind: 'round' }), 32).translate(0, -(h - 0.016) / 2, 0);
    add(g, glassGeo, m.glass({ width: w, height: h, depth: 0.22, style: 1, glow: 1.15, seed }), { p: [0, 0.008 + (h - 0.016) / 2, 0.004], cast: false, name: 'glass' });
    add(g, roundedBox(w + 0.02, 0.014, 0.03, 0.004, 2), m.trim('#FFFBF6'), { p: [0, -0.007, 0.014], name: 'sill' });
  }
  const outline = shape.getPoints(32);
  outline.pop();
  add(g, moldingAlong(outline, architrave(0.022), { closed: true }), m.trim('#FFFBF6'), { p: [0, 0, 0.006], name: 'architrave' });
  add(g, roundedBox(0.026, 0.034, 0.016, 0.004, 2), m.trim('#FFFBF6'), { p: [0, h + 0.008, 0.012], name: 'keystone' });
  return g;
}

// A catenary festoon of bulbs between two points (wire and lamps), sagging `sag` at its middle.
function festoon(wires, lamps, a, b, sag, count) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push([p.x, p.y, p.z]);
  }
  wires.push(pts);
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t) + 0.008;
    lamps.push({ p: [p.x, p.y, p.z], s: 0.0085 });
  }
}

export default function build(ctx, { seed = 404 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'MacaronTower';

  const stone = m.stone('#F3EAE0');
  const granite = m.granite('#E6DCD4');
  const plaster = m.plaster('#FFF4EA');
  const trim = m.trim('#FFFBF6');
  const pink = m.trim('#F6B9C9');
  const gold = m.metal('gold');
  const bulb = m.bulb('#FFE9B8', 2.4);

  /* ---------- podium ---------- */
  const nose = (r, y0, h) => spline([[0, y0], [r - 0.01, y0], [r, y0 + h * 0.3], [r - 0.003, y0 + h * 0.8], [r - 0.012, y0 + h], [0, y0 + h]], 40);
  add(root, lathe(nose(STEP_R, 0, 0.035), 192), granite, { name: 'step' });
  add(root, lathe(nose(PODIUM_R, 0.035, PODIUM_TOP - 0.035), 192), stone, { name: 'podium' });

  /* ---------- ground floor drum ---------- */
  add(root, cylinder(DRUM_R, DRUM_R, DRUM_TOP - PODIUM_TOP, 160, 1), plaster, { p: [0, (PODIUM_TOP + DRUM_TOP) / 2, 0], name: 'drum' });
  add(root, moldingRing(plinth(0.035), DRUM_R, { segments: 160 }), stone, { p: [0, PODIUM_TOP, 0], name: 'drumPlinth' });
  add(root, moldingRing(cornice(0.055), DRUM_R, { segments: 160 }), trim, { p: [0, DRUM_TOP - 0.05, 0], name: 'drumCornice' });
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * TAU;
    add(root, roundedBox(0.05, DRUM_TOP - PODIUM_TOP - 0.11, 0.02, 0.004, 2), pink, { p: [Math.sin(a) * (DRUM_R + 0.006), PODIUM_TOP + 0.035 + (DRUM_TOP - PODIUM_TOP - 0.11) / 2, Math.cos(a) * (DRUM_R + 0.006)], r: [0, a, 0], name: 'pilaster' });
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU;
    archedOpening(ctx, root, { a, w: k === 0 ? 0.17 : 0.13, h: k === 0 ? 0.3 : 0.24, y: k === 0 ? PODIUM_TOP + 0.004 : PODIUM_TOP + 0.09, door: k === 0, seed: 0.13 * k + 0.05 });
  }
  add(root, roundedBox(0.26, 0.02, 0.1, 0.005, 2), granite, { p: [0, PODIUM_TOP + 0.01 - 0.02, DRUM_R + 0.07], name: 'doorstep' });

  /* ---------- tiers ---------- */
  let y = DRUM_TOP;
  const wires = [];
  const lamps = [];
  TIERS.forEach((tier, i) => {
    const R = tier.R;
    // Ceiling plate the macaron rests on (the drum top for the first tier).
    add(root, cylinder(R * 0.56, R * 0.58, 0.03, 96, 1), trim, { p: [0, y + 0.015, 0], name: 'plate' });
    add(root, torus(R * 0.57, 0.008, 8, 120), gold, { p: [0, y + 0.004, 0], r: [Math.PI / 2, 0, 0], name: 'plateBead' });
    const c = y + 0.03 + HALF * R;
    macaron(ctx, root, { radius: R, flavour: tier.flavour, p: [0, c, 0], r: [0, i * 0.8, 0], seed: seed + i * 17, name: 'tierMacaron' });
    // Deck sunk into the crown, with a gilt balustrade round its edge.
    const deckY = c + 0.44 * R;
    const deckR = 0.5 * R;
    add(root, cylinder(deckR, deckR, 0.03, 96, 1), trim, { p: [0, deckY + 0.015, 0], name: 'deck' });
    add(root, torus(deckR, 0.009, 8, 120), gold, { p: [0, deckY + 0.03, 0], r: [Math.PI / 2, 0, 0], name: 'deckEdge' });
    ringBalustrade(root, { radius: deckR - 0.012, y: deckY + 0.03, height: 0.085, material: gold, name: 'deckBalustrade' });
    y = deckY + 0.03;
    if (!tier.colonnade) return;
    // Colonnade: a cream core with little arched lights, ringed by gilded columns.
    const H = tier.colonnade;
    const coreR = R * 0.22;
    add(root, cylinder(coreR, coreR, H, 64, 1), plaster, { p: [0, y + H / 2, 0], name: 'core' });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + i;
      const lw = coreR * 0.7;
      const light = new THREE.ShapeGeometry(opening({ w: lw, h: H * 0.5, kind: 'round' }), 16).translate(0, -H * 0.25, 0);
      add(root, light, m.glass({ width: lw, height: H * 0.5, depth: 0.12, style: 0, glow: 1.3, seed: seed * 0.01 + i + k * 0.3 }), { p: [Math.sin(a) * (coreR + 0.002), y + H * 0.5, Math.cos(a) * (coreR + 0.002)], r: [0, a, 0], cast: false, name: 'coreLight' });
    }
    const COLS = 6;
    const colR = R * 0.36;
    const tops = [];
    for (let k = 0; k < COLS; k++) {
      const a = (k / COLS) * TAU + Math.PI / COLS;
      const x = Math.sin(a) * colR;
      const z = Math.cos(a) * colR;
      add(root, lathe(spline([[0, 0], [0.026, 0], [0.024, 0.01], [0.018, 0.016], [0, 0.016]], 12), 24), gold, { p: [x, y, z], name: 'columnBase' });
      add(root, cylinder(0.012, 0.014, H - 0.03, 20, 1), gold, { p: [x, y + 0.016 + (H - 0.03) / 2, z], name: 'columnShaft' });
      add(root, lathe(spline([[0, 0], [0.014, 0], [0.026, 0.012], [0.028, 0.016], [0, 0.016]], 12), 24), gold, { p: [x, y + H - 0.016, z], name: 'columnCapital' });
      tops.push(new THREE.Vector3(x, y + H - 0.02, z));
    }
    for (let k = 0; k < COLS; k++) festoon(wires, lamps, tops[k], tops[(k + 1) % COLS], 0.045, 7);
    y += H;
  });

  /* ---------- belvedere ---------- */
  const bel = group(root, { p: [0, y, 0], name: 'belvedere' });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    add(bel, cylinder(0.008, 0.009, 0.17, 12, 1), gold, { p: [Math.sin(a) * 0.1, 0.085, Math.cos(a) * 0.1], name: 'belvedereColumn' });
  }
  add(bel, cylinder(0.035, 0.035, 0.17, 24, 1), plaster, { p: [0, 0.085, 0], name: 'belvedereCore' });
  add(bel, cylinder(0.125, 0.125, 0.02, 64, 1), trim, { p: [0, 0.18, 0], name: 'belvedereEntablature' });
  add(bel, torus(0.125, 0.007, 8, 96), gold, { p: [0, 0.19, 0], r: [Math.PI / 2, 0, 0], name: 'belvedereBead' });
  const dome = spline([[0.14, 0.19], [0.13, 0.24], [0.09, 0.3], [0.035, 0.33], [0, 0.335]], 32);
  for (let k = 0; k < 8; k++) add(bel, lathe(dome, 12, (k / 8) * TAU, TAU / 8), m.fabric(k % 2 ? '#FFF7EE' : '#F6B9C9'), { name: 'domeGore' });
  const fin = group(bel, { p: [0, 0.33, 0], name: 'finial' });
  finial(fin, { y: 0, height: 0.16, radius: 0.022, material: gold });
  add(fin, cylinder(0.004, 0.004, 0.22, 12, 1), gold, { p: [0, 0.22, 0], name: 'flagstaff' });
  const pennant = new THREE.Shape();
  pennant.moveTo(-0.03, 0);
  pennant.lineTo(0.03, 0);
  pennant.lineTo(0, 0.19);
  pennant.closePath();
  const flag = add(fin, new THREE.ShapeGeometry(pennant, 8), m.flag('#A9DCC8', 0.19), { p: [0, 0.3, 0], r: [0, 0, -Math.PI / 2], name: 'pennant' });
  flag.castShadow = false;

  /* ---------- festoons ---------- */
  for (const pts of wires) add(root, tube(pts, 0.0018, { tubular: 24, radial: 5 }), m.metal('iron'), { cast: false, name: 'festoonWire' });
  root.add(instanced(sphere(1, 10, 8), bulb, lamps, { cast: false, name: 'festoonBulbs' }));

  root.userData.footprint = { r: STEP_R };
  return root;
}
