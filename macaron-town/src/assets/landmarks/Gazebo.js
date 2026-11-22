import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, lathe, spline, tube, extrude, roundedBox } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { moldingPlan } from '../../kit/sweep.js';
import { crown, bead } from '../../kit/profiles.js';
import { scallopBand, circle } from '../../kit/shapes.js';
import { railing } from '../../kit/railings.js';
import { slateGeometry, tilePlane, finial } from '../../kit/roofs.js';
import { chain } from '../../kit/hardware.js';
import { climbingRose, plantPatch, trailingStrand } from '../../kit/flora.js';

// L5 — Garden gazebo in the park by the duck pond: an octagonal Victorian pavilion. A granite
// footing and diamond-lattice skirt carry a painted floor reached by two steps; eight white posts
// rise to a frieze of pierced fretwork with scrolled corner brackets, and white railings with
// C-scrolls close every bay but the entrance. The bell-curved roof is laid in mint fish-scale
// shingles with white hip rolls, a pierced valance under the eaves and a little lantern crowned by
// a gilded finial. Inside hangs a lantern on a chain; roses climb the two entrance posts and
// baskets of trailing petunias hang from the eaves.

const TAU = Math.PI * 2;
const S8 = Math.sin(Math.PI / 8);
const C8 = Math.cos(Math.PI / 8);
const FOOT_R = 0.95; // corner radii of the octagons
const FLOOR_R = 0.9;
const POST_R = 0.84;
const FLOOR_Y = 0.12;
const POST_TOP = 0.88;
const EAVE_Y = 0.94;
// Roof profile at the hips: [corner radius, height], eave to apex, a flared bell in four planes.
const ROOF = [[1.0, EAVE_Y], [0.8, 1.02], [0.56, 1.18], [0.32, 1.4], [0.1, 1.64]];

// Octagon corners at radius r (a face centred on +z), counter-clockwise seen from above.
const octagon = (r) => Array.from({ length: 8 }, (_, k) => {
  const a = Math.PI / 8 + (k / 8) * TAU;
  return [Math.sin(a) * r, Math.cos(a) * r];
});
// Flat-faced octagonal slab between y0 and y1.
function slab(r, y0, y1) {
  const g = cylinder(r, r, y1 - y0, 8, 1).rotateY(Math.PI / 8).toNonIndexed();
  g.computeVertexNormals();
  return g.translate(0, (y0 + y1) / 2, 0);
}

// Face frame for face k (centred on angle k * 45 degrees): outward f and along-the-face u.
const faceFrame = (k) => {
  const a = (k / 8) * TAU;
  return { a, f: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), u: new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)) };
};

// Pierced fretwork band: a rectangle with a row of round holes and a scalloped lower edge.
function fretBand(width, height, count) {
  const shape = scallopBand(width, height, count, height * 0.35);
  const step = width / count;
  for (let i = 0; i < count; i++) shape.holes.push(circle(height * 0.22, -width / 2 + step * (i + 0.5), height * 0.45));
  return extrude(shape, 0.008, { bevel: 0.0015, bevelSegments: 1, curveSegments: 16 });
}

// Diamond lattice panel (width x height), centred at the origin.
function latticePanel(width, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();
  const cell = 0.04;
  const hole = cell * 0.36;
  for (let x = -width / 2 + cell; x < width / 2 - cell * 0.6; x += cell) {
    for (const [dy, dx] of [[0, 0], [cell / 2, cell / 2]]) {
      const cx = x + dx - cell / 2;
      const cy = -height / 4 + dy - cell / 4;
      if (cx - hole < -width / 2 + 0.008 || cx + hole > width / 2 - 0.008) continue;
      if (cy - hole < -height / 2 + 0.006 || cy + hole > height / 2 - 0.006) continue;
      const d = new THREE.Path();
      d.moveTo(cx, cy - hole);
      d.lineTo(cx + hole, cy);
      d.lineTo(cx, cy + hole);
      d.lineTo(cx - hole, cy);
      d.closePath();
      shape.holes.push(d);
    }
  }
  return extrude(shape, 0.008, { curveSegments: 4 });
}

export default function build(ctx, { seed = 505 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Gazebo';

  const granite = m.granite('#E6DCD4');
  const white = m.trim('#FFFBF6');
  const floorPaint = m.paintedWood('#F3E2D3');
  const ceilingPaint = m.paintedWood('#FFF4EC');
  const gold = m.metal('gold');
  const brass = m.metal('brass');

  /* ---------- footing, lattice skirt, floor, steps ---------- */
  add(root, slab(FOOT_R, 0, 0.026), granite, { name: 'footing' });
  add(root, slab(FLOOR_R - 0.035, 0.026, FLOOR_Y - 0.03), m.stone('#E9DFD6'), { name: 'underfloor' });
  const skirtH = FLOOR_Y - 0.03 - 0.026;
  const sideLen = 2 * (FLOOR_R - 0.02) * S8;
  for (let k = 0; k < 8; k++) {
    const { a, f } = faceFrame(k);
    const p = f.clone().multiplyScalar((FLOOR_R - 0.02) * C8);
    add(root, latticePanel(sideLen - 0.04, skirtH), white, { p: [p.x, 0.026 + skirtH / 2, p.z], r: [0, a, 0], name: 'latticeSkirt' });
  }
  for (const [x, z] of octagon(FLOOR_R - 0.02)) add(root, roundedBox(0.05, skirtH, 0.05, 0.006, 2), white, { p: [x, 0.026 + skirtH / 2, z], name: 'skirtPier' });
  add(root, slab(FLOOR_R, FLOOR_Y - 0.03, FLOOR_Y), floorPaint, { name: 'floor' });
  add(root, moldingPlan(bead(0.018), octagon(FLOOR_R - 0.004), { closed: true }), white, { p: [0, FLOOR_Y - 0.022, 0], name: 'floorNosing' });
  const frontZ = FLOOR_R * C8;
  for (let k = 0; k < 2; k++) {
    const h = FLOOR_Y - 0.04 * (k + 1);
    add(root, roundedBox(0.5, h, 0.08, 0.006, 2), white, { p: [0, h / 2, frontZ + 0.04 + 0.08 * k], name: 'step' });
  }

  /* ---------- posts, frieze, brackets ---------- */
  const corners = octagon(POST_R);
  const postH = POST_TOP - FLOOR_Y;
  corners.forEach(([x, z], k) => {
    const a = Math.PI / 8 + (k / 8) * TAU;
    const post = group(root, { p: [x, FLOOR_Y, z], r: [0, a, 0], name: 'post' });
    add(post, roundedBox(0.062, 0.06, 0.062, 0.006, 2), white, { p: [0, 0.03, 0], name: 'postBase' });
    add(post, roundedBox(0.042, postH - 0.1, 0.042, 0.006, 2), white, { p: [0, 0.06 + (postH - 0.1) / 2, 0], name: 'postShaft' });
    for (const y of [0.13, postH - 0.13]) add(post, roundedBox(0.05, 0.02, 0.05, 0.005, 2), white, { p: [0, y, 0], name: 'postCollar' });
    add(post, roundedBox(0.06, 0.04, 0.06, 0.006, 2), white, { p: [0, postH - 0.02, 0], name: 'postCap' });
  });
  const bayLen = 2 * POST_R * S8;
  for (let k = 0; k < 8; k++) {
    const { a, f, u } = faceFrame(k);
    const c = f.clone().multiplyScalar(POST_R * C8);
    // Frieze of pierced fretwork under the eave beam, and a beam over it.
    add(root, fretBand(bayLen - 0.05, 0.075, 7), white, { p: [c.x, POST_TOP - 0.075, c.z], r: [0, a, 0], name: 'frieze' });
    add(root, roundedBox(bayLen + 0.06, 0.03, 0.05, 0.006, 2), white, { p: [c.x, POST_TOP + 0.015, c.z], r: [0, a, 0], name: 'eaveBeam' });
    // Scrolled brackets springing from each post into the bay.
    const bracket = new THREE.Shape();
    bracket.moveTo(0, 0);
    bracket.lineTo(0.11, 0);
    bracket.quadraticCurveTo(0.025, -0.025, 0, -0.11);
    bracket.closePath();
    bracket.holes.push(circle(0.016, 0.03, -0.03));
    const bracketGeo = extrude(bracket, 0.008, { curveSegments: 16 });
    for (const side of [-1, 1]) {
      const end = c.clone().addScaledVector(u, (side * (bayLen - 0.042)) / 2);
      add(root, bracketGeo, white, { p: [end.x, POST_TOP - 0.075, end.z], r: [0, a + (side > 0 ? Math.PI : 0), 0], name: 'bracket' });
    }
    // Railings in every bay but the entrance (face 0, toward +z).
    if (k !== 0) {
      const from = c.clone().addScaledVector(u, -(bayLen / 2 - 0.03));
      const to = c.clone().addScaledVector(u, bayLen / 2 - 0.03);
      railing(ctx, root, { from: [from.x, FLOOR_Y, from.z], to: [to.x, FLOOR_Y, to.z], height: 0.24, spacing: 0.034, metal: white, scrolls: true, newels: false });
    }
  }

  /* ---------- ceiling and pendant lantern ---------- */
  add(root, slab(ROOF[0][0] - 0.04, EAVE_Y - 0.004, EAVE_Y + 0.02), ceilingPaint, { name: 'ceiling' });
  for (const [x, z] of octagon(ROOF[0][0] - 0.08)) {
    const len = Math.hypot(x, z);
    add(root, roundedBox(0.03, 0.03, len, 0.005, 2), white, { p: [x / 2, EAVE_Y - 0.015, z / 2], r: [0, Math.atan2(x, z), 0], name: 'rafter' });
  }
  add(root, sphere(0.04, 24, 12, 0, TAU, 0, Math.PI / 2), white, { p: [0, EAVE_Y - 0.03, 0], r: [Math.PI, 0, 0], name: 'ceilingRose' });
  chain(root, { from: [0, EAVE_Y - 0.06, 0], to: [0, 0.74, 0], link: 0.012, material: brass, name: 'lanternChain' });
  const lamp = group(root, { p: [0, 0.62, 0], name: 'pendantLantern' });
  add(lamp, lathe(spline([[0, 0.12], [0.014, 0.118], [0.034, 0.098], [0.04, 0.09], [0, 0.09]], 24), 32), brass, { name: 'lanternRoof' });
  add(lamp, cylinder(0.031, 0.031, 0.07, 32, 1, true), m.lanternGlass(), { p: [0, 0.055, 0], cast: false, name: 'lanternGlass' });
  add(lamp, sphere(0.013, 20, 14), m.bulb(), { p: [0, 0.052, 0], cast: false, name: 'lanternBulb' });
  add(lamp, lathe(spline([[0, 0], [0.014, 0.002], [0.03, 0.014], [0.034, 0.022], [0, 0.022]], 24), 32), brass, { name: 'lanternBowl' });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    add(lamp, roundedBox(0.004, 0.074, 0.004, 0.001, 1), brass, { p: [Math.cos(a) * 0.032, 0.055, Math.sin(a) * 0.032], name: 'lanternPost' });
  }

  /* ---------- roof: shingled bell over eight faces ---------- */
  const deck = m.slate('#86BCA9');
  const shingle = slateGeometry(0.05, 0.068, 0.005, 'scale');
  const shingleMat = m.slate('#FFFFFF');
  const mints = ['#A9DCC8', '#9FD3BE', '#B5E3D1', '#A2D8C6', '#BFE7D7'];
  const profile = ROOF.map(([r, y]) => new THREE.Vector2(r, y));
  for (let k = 0; k < 8; k++) {
    const { a, f, u } = faceFrame(k);
    add(root, lathe(profile, 1, a - Math.PI / 8, Math.PI / 4), deck, { name: 'roofDeck' });
    for (let b = 0; b < ROOF.length - 1; b++) {
      const [r0, y0] = ROOF[b];
      const [r1, y1] = ROOF[b + 1];
      const d0 = r0 * C8;
      const d1 = r1 * C8;
      const v = f.clone().multiplyScalar(d1 - d0).add(new THREE.Vector3(0, y1 - y0, 0));
      const length = v.length();
      v.normalize();
      const n = new THREE.Vector3().crossVectors(u, v).normalize();
      const origin = f.clone().multiplyScalar(d0).setY(y0);
      tilePlane(root, { origin, u, v, n, width: 2 * r0 * S8, length: length + (b < ROOF.length - 2 ? 0.02 : 0), taper: r1 / r0, tileW: 0.05, exposure: 0.032, geometry: shingle, material: shingleMat, rng, colors: mints, lift: 0.005 });
    }
  }
  // White hip rolls on the eight hips, and the pierced valance and crown moulding at the eaves.
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k / 8) * TAU;
    add(root, tube(ROOF.map(([r, y]) => [Math.sin(a) * (r + 0.006), y + 0.012, Math.cos(a) * (r + 0.006)]), 0.014, { tubular: 64, radial: 10, tension: 'chordal' }), white, { name: 'hipRoll' });
  }
  add(root, moldingPlan(crown(0.05), octagon(ROOF[0][0] - 0.03), { closed: true }), white, { p: [0, EAVE_Y - 0.04, 0], name: 'eaveCrown' });
  const eaveSide = 2 * (ROOF[0][0] - 0.01) * S8;
  for (let k = 0; k < 8; k++) {
    const { a, f } = faceFrame(k);
    const p = f.clone().multiplyScalar((ROOF[0][0] - 0.012) * C8);
    add(root, fretBand(eaveSide - 0.03, 0.06, 9), white, { p: [p.x, EAVE_Y - 0.1, p.z], r: [0, a, 0], cast: false, name: 'valance' });
  }

  /* ---------- lantern and finial ---------- */
  const top = group(root, { p: [0, ROOF[ROOF.length - 1][1] - 0.02, 0], name: 'roofLantern' });
  add(top, slab(0.11, 0, 0.1), white, { name: 'lanternDrum' });
  for (let k = 0; k < 8; k++) {
    const { a, f } = faceFrame(k);
    const p = f.clone().multiplyScalar(0.11 * C8 + 0.002);
    add(top, roundedBox(0.04, 0.055, 0.004, 0.002, 1), m.lanternGlass('#FFE9C2', 0.6), { p: [p.x, 0.05, p.z], r: [0, a, 0], cast: false, name: 'lanternPane' });
  }
  const capProfile = spline([[0.14, 0.1], [0.11, 0.13], [0.06, 0.17], [0.02, 0.2], [0, 0.205]], 24);
  const capGeo = lathe(capProfile, 8, Math.PI / 8).toNonIndexed();
  capGeo.computeVertexNormals();
  add(top, capGeo, deck, { name: 'lanternCap' });
  const fin = group(top, { p: [0, 0.2, 0], name: 'finial' });
  finial(fin, { y: 0, height: 0.18, radius: 0.024, material: gold });

  /* ---------- roses and hanging baskets ---------- */
  for (const k of [7, 0]) {
    const [x, z] = corners[k];
    const a = Math.atan2(x, z);
    const wall = group(root, { p: [x + Math.sin(a) * 0.022, FLOOR_Y, z + Math.cos(a) * 0.022], r: [0, a, 0], name: 'roseOnPost' });
    climbingRose(ctx, wall, { path: [[0, 0.02], [0.012, 0.22], [-0.01, 0.42], [0.008, 0.6], [-0.02, 0.74]], rng, z: 0.004, blooms: 12, leaves: 110 });
  }
  for (const k of [1, 3, 5]) {
    const [x, z] = corners[k];
    const a = Math.atan2(x, z);
    const out = ROOF[0][0] * 0.94;
    const hx = Math.sin(a) * out;
    const hz = Math.cos(a) * out;
    chain(root, { from: [hx, EAVE_Y - 0.03, hz], to: [hx, EAVE_Y - 0.16, hz], link: 0.011, material: brass, name: 'basketChain' });
    const basket = group(root, { p: [hx, EAVE_Y - 0.21, hz], name: 'hangingBasket' });
    add(basket, lathe(spline([[0, 0], [0.03, 0.004], [0.048, 0.022], [0.054, 0.045], [0.05, 0.048]], 24), 32), m.wood('#C9A27C'), { name: 'basket' });
    add(basket, torus(0.052, 0.004, 8, 40), m.wood('#B48D68'), { p: [0, 0.046, 0], r: [Math.PI / 2, 0, 0], name: 'basketRim' });
    plantPatch(ctx, basket, { x0: -0.04, x1: 0.04, z0: -0.04, z1: 0.04, y: 0.048, density: 9000, palette: ['#F49AB2', '#FFFFFF', '#D8B4F0', '#F7B3C6'], leafColor: '#7FB27A', bloomScale: 0.012, leafScale: 0.022, rng, mound: 0.018 });
    for (let s = 0; s < 4; s++) {
      const ang = (s / 4) * TAU + 0.4;
      trailingStrand(ctx, basket, { start: [Math.cos(ang) * 0.045, 0.045, Math.sin(ang) * 0.045], length: rng.range(0.06, 0.1), drift: [Math.cos(ang) * 0.02, 0, Math.sin(ang) * 0.02], leaves: 8, rng, bloomPalette: ['#F49AB2', '#D8B4F0'] });
    }
  }

  root.userData.footprint = { r: 1.05 };
  return root;
}
