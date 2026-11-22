import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, lathe, spline, tube, taperTube, extrude, roundedBox } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { moldingAlong, moldingPlan } from '../../kit/sweep.js';
import { architrave, cornice } from '../../kit/profiles.js';
import { opening, scallopBand } from '../../kit/shapes.js';
import { finial } from '../../kit/roofs.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// L2 — Carousel on the south-east green. A stone plinth carries the turning platform: a planked deck
// with a mirrored fascia, an octagonal centre housing of arched mirrors in gilt frames, and twelve
// carved horses (eight outside, four inside) on barley-twist brass poles that rise and fall as the
// platform turns. Overhead, a rounding board of oval mirrors and bulbs, a scalloped valance, and a
// striped tent roof sagging between its ribs, crowned by a cupola, a gilded finial and a pennant
// that ripples in the wind. The whole platform and canopy turn together.

const STEP_R = 1.3;
const PLINTH_R = 1.24;
const PLINTH_TOP = 0.088;
const DECK_R = 1.16;
const DECK_Y = 0.092; // underside of the turning deck
const DECK_T = 0.04;
const DECK_TOP = DECK_Y + DECK_T;
const CORE_APOTHEM = 0.28;
const CEILING_Y = 1.35;
const BOARD_R = 1.26;
const BOARD_Y0 = 1.25;
const BOARD_Y1 = 1.45;
const ROOF_R = 1.29;
const ROOF_TOP = 1.98;
const SPEED = 0.32; // rad/s, counter-clockwise seen from above (the horses' heads lead)
const BOB = 0.05;
const HORSE_S = 1.3;

// An octagonal prism with crisp flat faces, one face centred on +z.
const octagon = (r0, r1, h) => {
  const g = cylinder(r0, r1, h, 8, 1).rotateY(Math.PI / 8).toNonIndexed();
  g.computeVertexNormals();
  return g;
};

const PALETTES = [
  { body: '#FFF8F2', mane: '#E9C46E', saddle: '#F6B9C9', blanket: '#A9DCC8' },
  { body: '#F9D3DE', mane: '#FFFDF8', saddle: '#A98FDF', blanket: '#FFF4E8' },
  { body: '#CFEBDF', mane: '#F6B9C9', saddle: '#F28CA6', blanket: '#FFF4E8' },
  { body: '#E4D8F6', mane: '#FFE19A', saddle: '#7FC4B0', blanket: '#F9D3DE' },
];

// Piecewise-linear lookup over [t, value] keys.
const keyed = (keys) => (t) => {
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return keys[keys.length - 1][1];
};
// Rounds a tube's ends into domes over the first and last `a` and `b` of its length.
const domed = (f, a = 0.06, b = 0.06) => (t) => f(t) * Math.sqrt(Math.min(1, t / a)) * Math.sqrt(Math.min(1, (1 - t) / b));
// Gaussian swelling at t0 (joints, muscles) for radius functions.
const bump = (t, t0, w, h) => h * Math.exp(-(((t - t0) / w) ** 2));

/**
 * A carved carousel horse in the classic jumper pose (forelegs folded, hind legs reaching back),
 * facing +x, the pole passing through the saddle at the origin. One smooth sculpted barrel with a
 * dipped back, deep chest and tucked flank; a heavy arched neck; a long wedge head held tucked,
 * with jowls, leaf ears, eyes and nostrils; muscled legs with knobby knees, hocks and fetlocks on
 * gilt hooves; a wavy carved tail and flowing mane; saddle, blanket, bridle, reins and stirrups.
 */
export function horse(ctx, parent, { palette, p, r, s, seed, name = 'horse' }) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const g = group(parent, { p, r, s, name });
  const coat = m.paintedWood(palette.body);
  const mane = m.paintedWood(palette.mane);
  const saddle = m.paintedWood(palette.saddle);
  const blanket = m.paintedWood(palette.blanket);
  const gold = m.metal('gold');
  const dark = m.ceramic('#3F3550');
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

  /* barrel */
  const girth = spline([[0, -0.2], [0.045, -0.193], [0.068, -0.172], [0.08, -0.13], [0.08, -0.08], [0.074, -0.03], [0.074, 0.02], [0.08, 0.07], [0.084, 0.115], [0.076, 0.155], [0.05, 0.183], [0, 0.195]], 56);
  let barrel = lathe(girth, 64).rotateZ(-Math.PI / 2).scale(1, 1, 0.82);
  barrel.deleteAttribute('uv');
  barrel.deleteAttribute('normal');
  barrel = mergeVertices(barrel);
  const bp = barrel.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const y = bp.getY(i);
    let dy = 0;
    if (y > 0) dy -= 0.011 * Math.exp(-(((x + 0.01) / 0.075) ** 2)) * (y / 0.08); // dip behind the withers
    if (y < 0) dy += 0.018 * Math.exp(-(((x + 0.105) / 0.06) ** 2)) * (-y / 0.08); // flank tucked up
    if (y < 0 && x > 0.04) dy -= 0.014 * Math.min(1, (x - 0.04) / 0.07) * (-y / 0.08); // deep chest
    if (y > 0 && x > 0.08) dy += 0.012 * Math.min(1, (x - 0.08) / 0.06) * (y / 0.08); // withers rising into the neck
    bp.setY(i, y + dy);
  }
  barrel.computeVertexNormals();
  add(g, barrel, coat, { name: 'barrel' });

  /* neck: heavy at the chest, arching up into the head */
  const neckPts = [[0.085, 0.0, 0], [0.145, 0.08, 0], [0.183, 0.16, 0], [0.21, 0.222, 0]];
  const neckR = (t) => 0.072 - 0.04 * t;
  add(g, taperTube(neckPts, neckR, { tubular: 48, radial: 24 }), coat, { s: [1, 1, 0.68], name: 'neck' });

  /* head: a long wedge held tucked, deepest at the jowl, swelling again at the soft nose */
  const headPts = [V(0.196, 0.252), V(0.233, 0.207), V(0.268, 0.161), V(0.296, 0.12)];
  const headCurve = new THREE.CatmullRomCurve3(headPts, false, 'centripetal');
  const headR = domed(keyed([[0, 0.027], [0.2, 0.037], [0.36, 0.035], [0.7, 0.025], [0.88, 0.028], [1, 0.024]]), 0.08, 0.12);
  add(g, taperTube(headPts, headR, { tubular: 40, radial: 24 }), coat, { s: [1, 1, 0.66], name: 'head' });
  const along = (t) => headCurve.getPointAt(t);
  const axis = headCurve.getTangentAt(0.3);
  const front = V(-axis.y, axis.x); // toward the face (forehead and nose line)
  const backward = front.clone().negate();
  // Jowls: the broad, flat cheek plates at the back of the jaw.
  const jowl = along(0.3).addScaledVector(backward, 0.012);
  for (const sz of [-1, 1]) add(g, sphere(1, 32, 20), coat, { p: [jowl.x, jowl.y, sz * 0.008], r: [0, 0, Math.atan2(axis.y, axis.x)], s: [0.036, 0.031, 0.02], name: 'jowl' });
  // Ears: two leaf-shaped points standing up from the poll, a little apart and pricked forward.
  const poll = along(0.04);
  for (const sz of [-1, 1]) {
    const ear = group(g, { p: [poll.x - 0.006, poll.y + 0.012, sz * 0.015], r: [sz * 0.2, 0, -0.15], name: 'ear' });
    add(ear, lathe(spline([[0, 0], [0.011, 0.004], [0.0125, 0.016], [0.008, 0.03], [0.002, 0.039], [0, 0.04]], 24), 20), coat, { s: [1, 1, 0.55], name: 'earLeaf' });
  }
  // Eyes on the sides of the face, nostrils on the muzzle.
  const eye = along(0.3).addScaledVector(front, 0.008);
  const nose = along(0.92).addScaledVector(front, 0.006);
  for (const sz of [-1, 1]) {
    add(g, sphere(0.0075, 16, 12), dark, { p: [eye.x, eye.y, sz * 0.0225], name: 'eye' });
    add(g, sphere(0.0045, 12, 8), dark, { p: [nose.x, nose.y, sz * 0.0135], s: [0.7, 1, 0.7], name: 'nostril' });
  }
  // Forelock falling over the brow.
  const brow = along(0.12).addScaledVector(front, 0.024);
  add(g, sphere(1, 20, 14), mane, { p: [brow.x, brow.y, 0], r: [0, 0, Math.atan2(axis.y, axis.x)], s: [0.026, 0.011, 0.015], name: 'forelock' });
  // Bridle: noseband and browband square to the head, a gilt rosette at the cheek.
  const ringAt = (t, radius, label) => {
    const c = along(t);
    const d = headCurve.getTangentAt(t);
    // Ring square to the head axis (local z along it), squashed across the head like the head itself.
    const band = add(g, torus(radius, 0.0034, 8, 40), saddle, { p: [c.x, c.y, 0], s: [1, 0.68, 1], name: label });
    band.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(-d.y, d.x, 0), V(0, 0, 1), d));
    return band;
  };
  ringAt(0.72, headR(0.72) + 0.002, 'noseband');
  ringAt(0.16, headR(0.16) + 0.002, 'browband');
  const cheek = along(0.4);
  for (const sz of [-1, 1]) add(g, sphere(0.007, 16, 12), gold, { p: [cheek.x, cheek.y, sz * 0.024], name: 'rosette' });

  /* mane: lobes springing from the crest and streaming back */
  const crest = new THREE.CatmullRomCurve3(neckPts.map((q) => V(...q)), false, 'centripetal');
  for (let k = 0; k < 9; k++) {
    const t = 0.05 + k * 0.11;
    const c = crest.getPointAt(Math.min(t, 1));
    const tan = crest.getTangentAt(Math.min(t, 1));
    const back = V(-tan.y, tan.x);
    const dir = back.clone().multiplyScalar(0.8).sub(tan).normalize();
    const at = c.clone().addScaledVector(back, neckR(t) * 0.82).addScaledVector(dir, 0.016);
    add(g, sphere(1, 20, 14), mane, { p: [at.x, at.y, (k % 2 ? 1 : -1) * 0.012], r: [0, 0, Math.atan2(dir.y, dir.x) + rng.range(-0.12, 0.12)], s: [0.038, 0.016, 0.014], name: 'mane' });
  }

  /* legs: one tube per leg with knobby joints, muscle masses where they meet the body */
  const hoof = lathe(spline([[0, 0], [0.0165, 0], [0.019, 0.01], [0.0155, 0.02], [0, 0.021]], 16), 24);
  const leg = (pts, joints, label) => {
    const radius = (t) => 0.033 - 0.022 * Math.min(1, t * 1.6) + joints.reduce((sum, [t0, h]) => sum + bump(t, t0, 0.045, h), 0);
    add(g, taperTube(pts, radius, { tubular: 64, radial: 16 }), coat, { name: label });
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => V(...q)), false, 'centripetal');
    const end = curve.getPointAt(1);
    const h = add(g, hoof, gold, { p: [end.x, end.y, end.z], name: 'hoof' });
    h.quaternion.setFromUnitVectors(V(0, 1, 0), curve.getTangentAt(1));
  };
  for (const sz of [-1, 1]) {
    const lift = sz > 0 ? 0.014 : -0.006; // the forelegs fold a little differently
    // Foreleg: elbow, forearm forward and down, knee, cannon folded back, fetlock, pastern.
    add(g, sphere(1, 32, 20), coat, { p: [0.12, -0.04, sz * 0.032], r: [0, 0, -0.55], s: [0.05, 0.07, 0.03], name: 'forearmMuscle' });
    leg([[0.115, -0.03, sz * 0.03], [0.165, -0.085, sz * 0.04], [0.205, -0.128 + lift, sz * 0.043], [0.178, -0.165 + lift, sz * 0.044], [0.155, -0.19 + lift, sz * 0.044], [0.163, -0.208 + lift, sz * 0.044]], [[0.46, 0.006], [0.8, 0.005]], 'foreleg');
    // Hind leg: haunch, gaskin back and down to the hock, cannon reaching back, fetlock, pastern.
    add(g, sphere(1, 32, 20), coat, { p: [-0.125, -0.015, sz * 0.034], r: [0, 0, 0.35], s: [0.075, 0.075, 0.034], name: 'haunch' });
    leg([[-0.11, -0.03, sz * 0.03], [-0.15, -0.085, sz * 0.042], [-0.19, -0.135, sz * 0.045], [-0.235, -0.16, sz * 0.046], [-0.272, -0.172, sz * 0.046], [-0.298, -0.172, sz * 0.046]], [[0.42, 0.007], [0.8, 0.005]], 'hindleg');
  }

  /* tail: a short dock, then three wavy carved strands */
  add(g, sphere(1, 20, 14), mane, { p: [-0.19, 0.04, 0], r: [0, 0, -0.5], s: [0.026, 0.018, 0.016], name: 'dock' });
  for (const [dz, phase, len] of [[0, 0, 1], [0.009, 1.2, 0.92], [-0.009, 2.3, 0.86]]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push([-0.195 - 0.085 * Math.sin(t * 1.9) * len, 0.045 - 0.19 * t * len + 0.022 * Math.sin(t * 6 + phase), dz * (1 + t)]);
    }
    add(g, taperTube(pts, domed((t) => 0.016 * (1 - 0.7 * t), 0.02, 0.15), { tubular: 48, radial: 12 }), mane, { name: 'tailStrand' });
  }

  /* saddle, blanket, stirrups, reins */
  // Blanket draped over the back and well down the flanks, a gilt cord along each hem with tassels.
  const drape = 1.45;
  const cloth = new THREE.CylinderGeometry(0.073, 0.073, 0.15, 48, 1, true, -drape, drape * 2).rotateZ(-Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1, 0.88);
  add(g, cloth, blanket, { p: [-0.008, -0.006, 0], name: 'blanket' });
  for (const sz of [-1, 1]) {
    const hy = -0.006 + 0.0735 * Math.cos(drape);
    const hz = sz * 0.0735 * Math.sin(drape) * 0.88;
    add(g, tube([[-0.083, hy, hz], [-0.008, hy - 0.002, hz * 1.01], [0.067, hy, hz]], 0.0034, { tubular: 24, radial: 8 }), gold, { name: 'hemCord' });
    for (let k = 0; k < 6; k++) add(g, sphere(1, 12, 10), gold, { p: [-0.07 + k * 0.025, hy - 0.007, hz * 1.02], s: [0.004, 0.008, 0.004], name: 'tassel' });
  }
  // Carved saddle: a dished seat between a high scrolled cantle and a low pommel, its sides
  // rounded off; the lower edge sinks into the back.
  const seat = new THREE.Shape();
  seat.moveTo(-0.086, 0.03);
  seat.bezierCurveTo(-0.092, 0.07, -0.088, 0.1, -0.072, 0.108);
  seat.bezierCurveTo(-0.06, 0.112, -0.055, 0.092, -0.04, 0.083);
  seat.bezierCurveTo(-0.015, 0.075, 0.015, 0.075, 0.032, 0.084);
  seat.bezierCurveTo(0.045, 0.092, 0.052, 0.102, 0.06, 0.098);
  seat.bezierCurveTo(0.07, 0.093, 0.07, 0.07, 0.064, 0.03);
  seat.closePath();
  add(g, extrude(seat, 0.072, { bevel: 0.011, bevelSegments: 5, curveSegments: 24 }), saddle, { name: 'saddle' });
  add(g, torus(0.007, 0.0028, 8, 20), gold, { p: [0.058, 0.103, 0], r: [0, Math.PI / 2, 0], name: 'pommelRing' });
  for (const sz of [-1, 1]) {
    add(g, roundedBox(0.012, 0.075, 0.003, 0.001, 1), saddle, { p: [-0.004, 0.022, sz * 0.069], r: [sz * 0.12, 0, 0], name: 'strap' });
    add(g, torus(0.012, 0.0028, 8, 24), gold, { p: [-0.004, -0.022, sz * 0.075], r: [0, Math.PI / 2, 0], name: 'stirrup' });
  }
  const bit = along(0.76);
  for (const sz of [-1, 1]) {
    add(g, tube([[bit.x, bit.y, sz * 0.02], [0.19, 0.12, sz * 0.04], [0.11, 0.084, sz * 0.036], [0.058, 0.1, sz * 0.012]], 0.0028, { tubular: 40, radial: 6 }), saddle, { name: 'rein' });
  }
  return g;
}

// Barley-twist brass pole: a core wound with two spiral strands, collared where it meets the horse.
function pole(ctx, parent, { y0, y1, name = 'pole' }) {
  const m = ctx.materials;
  const g = group(parent, { name });
  const h = y1 - y0;
  add(g, cylinder(0.009, 0.009, h, 16, 1), m.metal('brass'), { p: [0, (y0 + y1) / 2, 0], name: 'core' });
  const turns = h / 0.07;
  for (const [ph, mat] of [[0, m.metal('brass')], [Math.PI, m.ceramic('#FFF7EE')]]) {
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const a = t * turns * Math.PI * 2 + ph;
      pts.push([Math.cos(a) * 0.009, y0 + t * h, Math.sin(a) * 0.009]);
    }
    add(g, tube(pts, 0.0052, { tubular: 600, radial: 8 }), mat, { name: 'strand' });
  }
  return g;
}

// One tent stripe: a partial lathe of the roof profile, sagging inward between its two ribs.
function roofStripe(profile, a0, da, sag) {
  const geo = lathe(profile, 24, a0, da);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    let a = Math.atan2(v.x, v.z) - a0;
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const u = THREE.MathUtils.clamp(a / da, 0, 1);
    const k = 1 - (sag * Math.sin(Math.PI * u) * r) / ROOF_R;
    p.setXYZ(i, v.x * k, v.y - sag * 0.35 * Math.sin(Math.PI * u) * (r / ROOF_R), v.z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export default function build(ctx, { seed = 202 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Carousel';

  const stone = m.stone('#F3EAE0');
  const granite = m.granite('#E6DCD4');
  const pink = m.paintedWood('#F6B9C9');
  const cream = m.paintedWood('#FFF7EE');
  const mint = m.paintedWood('#A9DCC8');
  const gold = m.metal('gold');
  const mirror = m.metal('chrome');
  const bulb = m.bulb('#FFE9B8', 2.4);

  /* ---------- static plinth ---------- */
  const nose = (r, y0, h) => spline([[0, y0], [r - 0.01, y0], [r, y0 + h * 0.3], [r - 0.003, y0 + h * 0.8], [r - 0.012, y0 + h], [0, y0 + h]], 40);
  add(root, lathe(nose(STEP_R, 0, 0.034), 256), granite, { name: 'step' });
  add(root, lathe(nose(PLINTH_R, 0.034, PLINTH_TOP - 0.034), 256), stone, { name: 'plinth' });

  /* ---------- the turning platform ---------- */
  const rotor = group(root, { name: 'rotor' });

  // Planked deck: radial boards in two tones, a painted fascia with gilt beads, mirrors and bulbs.
  const BOARDS = 56;
  const board = lathe([[CORE_APOTHEM, 0], [DECK_R - 0.01, 0], [DECK_R - 0.01, DECK_T], [CORE_APOTHEM, DECK_T], [CORE_APOTHEM, 0]], 6, 0, ((Math.PI * 2) / BOARDS) * 0.985);
  const boards = [];
  for (let k = 0; k < BOARDS; k++) boards.push({ p: [0, DECK_Y, 0], r: [0, (k / BOARDS) * Math.PI * 2, 0], color: rng.pick(['#E9D3C0', '#E2C8B4', '#EDDACA', '#E5CDBB']) });
  rotor.add(instanced(board, m.wood('#FFFFFF'), boards, { name: 'deckBoards' }));
  add(rotor, lathe([[DECK_R - 0.012, DECK_Y - 0.004], [DECK_R + 0.012, DECK_Y - 0.004], [DECK_R + 0.012, DECK_TOP + 0.004], [DECK_R - 0.012, DECK_TOP + 0.004], [DECK_R - 0.012, DECK_Y - 0.004]], 256), pink, { name: 'fascia' });
  for (const y of [DECK_Y - 0.002, DECK_TOP + 0.002]) add(rotor, torus(DECK_R + 0.012, 0.0045, 8, 256), gold, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], name: 'fasciaBead' });
  const fasciaLamps = [];
  for (let k = 0; k < 32; k++) {
    const a = ((k + 0.5) / 32) * Math.PI * 2;
    const disc = add(rotor, cylinder(0.014, 0.014, 0.004, 24, 1), mirror, { p: [Math.sin(a) * (DECK_R + 0.014), DECK_Y + DECK_T / 2, Math.cos(a) * (DECK_R + 0.014)], r: [Math.PI / 2, a, 0, 'YXZ'], name: 'fasciaMirror' });
    disc.scale.set(1, 1, 0.7);
    const b = (k / 32) * Math.PI * 2;
    fasciaLamps.push({ p: [Math.sin(b) * (DECK_R + 0.016), DECK_Y + DECK_T / 2, Math.cos(b) * (DECK_R + 0.016)], s: 0.0075 });
  }
  rotor.add(instanced(sphere(1, 12, 10), bulb, fasciaLamps, { cast: false, name: 'fasciaBulbs' }));

  // Octagonal centre housing: plinth band, arched mirror panels in gilt frames, frieze, cornice.
  const coreR = CORE_APOTHEM / Math.cos(Math.PI / 8);
  const coreH = CEILING_Y - DECK_TOP;
  add(rotor, octagon(coreR, coreR, coreH), cream, { p: [0, DECK_TOP + coreH / 2, 0], name: 'core' });
  add(rotor, octagon(coreR + 0.02, coreR + 0.024, 0.1), pink, { p: [0, DECK_TOP + 0.05, 0], name: 'coreBase' });
  add(rotor, octagon(coreR + 0.012, coreR + 0.012, 0.16), pink, { p: [0, CEILING_Y - 0.09, 0], name: 'coreFrieze' });
  const friezeY = CEILING_Y - 0.115 - (DECK_TOP + 0.2);
  const panel = { w: 0.15, h: 0.62, kind: 'round', y: 0 };
  const glassShape = opening(panel);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const face = group(rotor, { p: [Math.sin(a) * CORE_APOTHEM, DECK_TOP + 0.2, Math.cos(a) * CORE_APOTHEM], r: [0, a, 0], name: 'corePanel' });
    add(face, extrude(glassShape, 0.006, { center: false, curveSegments: 32 }), k % 2 ? mirror : mint, { name: k % 2 ? 'mirror' : 'paintedPanel' });
    const outline = glassShape.getPoints(32);
    outline.pop();
    add(face, moldingAlong(outline, architrave(0.016), { closed: true }), gold, { p: [0, 0, 0.004], name: 'frame' });
    // Frieze medallion above each panel.
    add(face, torus(0.034, 0.005, 10, 48), gold, { p: [0, friezeY, 0.017], name: 'friezeRing' });
    add(face, sphere(1, 24, 16), k % 2 ? mint : m.paintedWood('#F28CA6'), { p: [0, friezeY, 0.017], s: [0.026, 0.026, 0.01], name: 'friezeBoss' });
  }
  const octPlan = [];
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k / 8) * Math.PI * 2;
    octPlan.push([Math.sin(a) * (coreR + 0.012), Math.cos(a) * (coreR + 0.012)]);
  }
  add(rotor, moldingPlan(cornice(0.05), octPlan, { closed: true }), cream, { p: [0, CEILING_Y - 0.06, 0], name: 'coreCornice' });

  // Ceiling: boarded underside of the canopy with gilt radial ribs.
  add(rotor, cylinder(BOARD_R - 0.022, BOARD_R - 0.022, 0.03, 192, 1), cream, { p: [0, CEILING_Y + 0.015, 0], name: 'ceiling' });
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const len = BOARD_R - coreR;
    add(rotor, roundedBox(0.022, 0.018, len, 0.004, 2), gold, { p: [Math.sin(a) * (coreR + len / 2), CEILING_Y - 0.008, Math.cos(a) * (coreR + len / 2)], r: [0, a, 0], name: 'ceilingRib' });
  }

  // Rounding board: sixteen pink boards, each with an oval mirror in a gilt ring, gilt pilasters
  // between them, a bulb on every pilaster and a row of bulbs along the top.
  const BOARDS_N = 16;
  const boardH = BOARD_Y1 - BOARD_Y0;
  add(rotor, lathe([[BOARD_R - 0.02, BOARD_Y0], [BOARD_R, BOARD_Y0], [BOARD_R, BOARD_Y1], [BOARD_R - 0.02, BOARD_Y1], [BOARD_R - 0.02, BOARD_Y0]], 256), pink, { name: 'roundingBoard' });
  for (const y of [BOARD_Y0, BOARD_Y1]) add(rotor, torus(BOARD_R + 0.004, 0.009, 10, 256), cream, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], name: 'boardMoulding' });
  const boardBulbs = [];
  for (let k = 0; k < BOARDS_N; k++) {
    const a = ((k + 0.5) / BOARDS_N) * Math.PI * 2;
    const face = group(rotor, { p: [Math.sin(a) * BOARD_R, (BOARD_Y0 + BOARD_Y1) / 2, Math.cos(a) * BOARD_R], r: [0, a, 0], name: 'boardPanel' });
    add(face, torus(0.06, 0.008, 10, 64), gold, { p: [0, 0, 0.008], s: [1.45, 1, 1], name: 'ovalFrame' });
    add(face, cylinder(0.058, 0.058, 0.006, 48, 1), mirror, { p: [0, 0, 0.004], r: [Math.PI / 2, 0, 0], s: [1.45, 1, 1], name: 'ovalMirror' });
    const b = (k / BOARDS_N) * Math.PI * 2;
    add(rotor, roundedBox(0.026, boardH + 0.01, 0.014, 0.004, 2), gold, { p: [Math.sin(b) * (BOARD_R + 0.006), (BOARD_Y0 + BOARD_Y1) / 2, Math.cos(b) * (BOARD_R + 0.006)], r: [0, b, 0], name: 'pilaster' });
    boardBulbs.push({ p: [Math.sin(b) * (BOARD_R + 0.02), BOARD_Y1 + 0.022, Math.cos(b) * (BOARD_R + 0.02)], s: 0.014 });
    for (let j = 1; j < 4; j++) {
      const c = ((k + j / 4) / BOARDS_N) * Math.PI * 2;
      boardBulbs.push({ p: [Math.sin(c) * (BOARD_R + 0.012), BOARD_Y1 + 0.012, Math.cos(c) * (BOARD_R + 0.012)], s: 0.009 });
    }
  }
  rotor.add(instanced(sphere(1, 12, 10), bulb, boardBulbs, { cast: false, name: 'boardBulbs' }));
  // Scalloped valance under the rounding board, with a bulb in each scallop.
  const VAL = 64;
  const vr = BOARD_R + 0.006;
  const scallop = extrude(scallopBand((Math.PI * 2 * vr) / VAL + 0.002, 0.075, 1, 0.032), 0.004, { bevel: 0.001, bevelSegments: 1, curveSegments: 16 });
  const valanceBulbs = [];
  for (let k = 0; k < VAL; k++) {
    const a = ((k + 0.5) / VAL) * Math.PI * 2;
    add(rotor, scallop, m.fabric(k % 2 ? '#FFF7EE' : '#F6B9C9'), { p: [Math.sin(a) * vr, BOARD_Y0 - 0.075, Math.cos(a) * vr], r: [0, a, 0], cast: false, name: 'valance' });
    if (k % 2 === 0) valanceBulbs.push({ p: [Math.sin(a) * (vr - 0.02), BOARD_Y0 - 0.1, Math.cos(a) * (vr - 0.02)], s: 0.009 });
  }
  rotor.add(instanced(sphere(1, 12, 10), bulb, valanceBulbs, { cast: false, name: 'valanceBulbs' }));

  /* ---------- striped tent roof ---------- */
  const roofProfile = spline([[ROOF_R, BOARD_Y1 + 0.004], [ROOF_R * 0.72, BOARD_Y1 + 0.17], [ROOF_R * 0.4, BOARD_Y1 + 0.37], [0.13, ROOF_TOP]], 48);
  const STRIPES = 16;
  const da = (Math.PI * 2) / STRIPES;
  for (let k = 0; k < STRIPES; k++) {
    add(rotor, roofStripe(roofProfile, k * da, da, 0.035), m.fabric(k % 2 ? '#FFF7EE' : '#F6B9C9'), { name: 'roofStripe' });
  }
  const ribPts = roofProfile.filter((_, i) => i % 6 === 0 || i === roofProfile.length - 1);
  for (let k = 0; k < STRIPES; k++) {
    const a = k * da;
    add(rotor, tube(ribPts.map((q) => [Math.sin(a) * (q.x + 0.004), q.y + 0.004, Math.cos(a) * (q.x + 0.004)]), 0.008, { tubular: 64, radial: 8 }), cream, { name: 'roofRib' });
  }
  // Eave: a rolled cream edge and little pennant tabs at the end of every rib.
  add(rotor, torus(ROOF_R, 0.012, 10, 256), cream, { p: [0, BOARD_Y1 + 0.006, 0], r: [Math.PI / 2, 0, 0], name: 'eaveRoll' });
  for (let k = 0; k < STRIPES; k++) {
    const a = k * da;
    add(rotor, sphere(0.016, 16, 12), gold, { p: [Math.sin(a) * (ROOF_R + 0.012), BOARD_Y1 + 0.012, Math.cos(a) * (ROOF_R + 0.012)], name: 'eaveKnob' });
  }

  /* ---------- cupola, finial and pennant ---------- */
  const cup = group(rotor, { p: [0, ROOF_TOP - 0.02, 0], name: 'cupola' });
  add(cup, octagon(0.15, 0.15, 0.1), cream, { p: [0, 0.05, 0], name: 'drum' });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const ap = 0.15 * Math.cos(Math.PI / 8);
    const arch = group(cup, { p: [Math.sin(a) * ap, 0.018, Math.cos(a) * ap], r: [0, a, 0], name: 'cupolaArch' });
    add(arch, extrude(opening({ w: 0.05, h: 0.065, kind: 'round' }), 0.004, { center: false, curveSegments: 16 }), mirror, { name: 'archMirror' });
  }
  add(cup, torus(0.155, 0.008, 8, 96), gold, { p: [0, 0.1, 0], r: [Math.PI / 2, 0, 0], name: 'drumRing' });
  const domeProfile = spline([[0.165, 0.1], [0.15, 0.15], [0.1, 0.205], [0.04, 0.235], [0, 0.24]], 32);
  for (let k = 0; k < 8; k++) add(cup, lathe(domeProfile, 12, (k / 8) * Math.PI * 2, Math.PI / 4), m.fabric(k % 2 ? '#FFF7EE' : '#F6B9C9'), { name: 'domeGore' });
  const fin = group(cup, { p: [0, 0.232, 0], name: 'finial' });
  finial(fin, { y: 0, height: 0.14, radius: 0.022, material: gold });
  add(fin, cylinder(0.004, 0.004, 0.2, 12, 1), gold, { p: [0, 0.2, 0], name: 'flagstaff' });
  // Swallow-tailed pennant, modelled along +y (hoist at 0) and turned to fly from the staff.
  const pennant = new THREE.Shape();
  pennant.moveTo(-0.032, 0);
  pennant.lineTo(0.032, 0);
  pennant.lineTo(0.012, 0.2);
  pennant.lineTo(0.0, 0.16);
  pennant.lineTo(-0.012, 0.2);
  pennant.closePath();
  const flagGeo = new THREE.ShapeGeometry(pennant, 12);
  const flag = add(fin, flagGeo, m.flag('#F28CA6', 0.2), { p: [0, 0.27, 0], r: [0, 0, -Math.PI / 2], name: 'pennant' });
  flag.castShadow = false;

  /* ---------- horses ---------- */
  const riders = [];
  const ring = (count, radius, offset, phase) => {
    for (let k = 0; k < count; k++) {
      const a = offset + (k / count) * Math.PI * 2;
      const baseY = 0.6 + (k % 2 ? 0.02 : -0.02);
      const rider = group(rotor, { p: [Math.sin(a) * radius, baseY, Math.cos(a) * radius], r: [0, a, 0], name: 'rider' });
      horse(ctx, rider, { palette: PALETTES[(k + (radius < 0.8 ? 2 : 0)) % PALETTES.length], s: HORSE_S, seed: seed + riders.length * 13 });
      pole(ctx, rider, { y0: DECK_TOP - 0.12 - baseY, y1: CEILING_Y + 0.08 - baseY });
      for (const y of [0.1 * HORSE_S, -0.085 * HORSE_S]) add(rider, cylinder(0.016, 0.016, 0.02, 24, 1), gold, { p: [0, y, 0], name: 'poleCollar' });
      rider.userData.baseY = baseY;
      rider.userData.phase = phase + k * Math.PI;
      riders.push(rider);
    }
  };
  ring(8, 0.95, 0, 0);
  ring(4, 0.62, Math.PI / 8, Math.PI / 2);

  let angle = rng.range(0, Math.PI * 2);
  root.userData.update = (dt) => {
    angle += dt * SPEED;
    rotor.rotation.y = angle;
    for (const rider of riders) rider.position.y = rider.userData.baseY + BOB * Math.sin(angle * 3 + rider.userData.phase);
  };
  root.userData.footprint = { r: STEP_R };
  return root;
}
