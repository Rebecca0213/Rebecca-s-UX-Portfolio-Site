import * as THREE from 'three';
import { PLAZA, STREET, STREETS, rotate } from '../../map/layout.js';
import { add, group } from '../../kit/place.js';
import { cylinder } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { settGeometry, ringCourses, fitCourse, LEVELS } from '../../kit/paving.js';
import { moldingArc } from '../../kit/sweep.js';
import { grassBladeGeometry } from '../../kit/flora.js';

// T3 — Plaza paving: concentric courses of hand-cut limestone setts around the fountain, inlaid
// with a rose-and-mint compass star whose long points run down the four streets, two banded
// courses, a fountain apron, curved granite kerbstones at the lawn edge (open at the street mouths)
// and a few tufts of grass that have found the outer joints. Surface height: TOP above the lawn.

const TOP = LEVELS.paving;
const APRON = 1.62; // fountain apron (the fountain's basin and step cover it)
const EDGE = PLAZA.radius;
const COURSES = 21;
const PITCH = (EDGE - APRON) / COURSES;
const JOINT = 0.0075;
const KERB_IN = EDGE - 2 * PITCH; // kerbstones take the two outermost courses
const KERB_R = (KERB_IN + EDGE) / 2;
const MOUTH_HALF_WIDTH = STREET.roadHalf + STREET.walk;

const FIELD = ['#F0E6D8', '#EADDCB', '#F4EBDF', '#E6D7C5', '#EFE1D4', '#E8DACE', '#F2E4DA'];
const BAND = ['#E8C9C1', '#E4C1B9', '#ECCFC8'];
const STAR_MAIN = ['#EDB9AE', '#E8B0A5', '#F1C3B8', '#EAB4AA'];
const STAR_DIAG = ['#CDE4D2', '#C5DDCA', '#D4E8D6'];
const KERB = ['#D9CDC7', '#D3C6C0', '#DED3CC', '#CFC2BC'];

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Street directions in LatheGeometry angles (0 = +z, toward +x).
const STREET_ANGLES = STREETS.map((s) => {
  const [dx, dz] = rotate(1, 0, s.angle);
  return Math.atan2(dx, dz);
});

// The kerbstones stop at radial end faces this far either side of each street's axis.
const MOUTH_ANGLE = Math.asin(MOUTH_HALF_WIDTH / KERB_R);

// Compass star: four long rose points tapering down the streets, four shorter mint points on the
// diagonals, all springing from the fountain apron.
function starTone(r, phi) {
  const t = (r - APRON) / (EDGE - APRON);
  for (const s of STREET_ANGLES) {
    const main = wrap(phi - s);
    if (Math.cos(main) > 0 && r * Math.abs(Math.sin(main)) < 0.36 * Math.max(0, 1 - t)) return 'main';
    const diag = wrap(phi - s - Math.PI / 4);
    if (Math.cos(diag) > 0 && r * Math.abs(Math.sin(diag)) < 0.26 * Math.max(0, 1 - t / 0.62)) return 'diag';
  }
  return null;
}

function kerbProfile() {
  const half = PITCH - JOINT / 2;
  const top = TOP + 0.006;
  const bottom = -0.03;
  const round = 0.013;
  const arc = (cx, cy, a0, a1) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const a = a0 + ((a1 - a0) * i) / 8;
      pts.push([cx + Math.cos(a) * round, cy + Math.sin(a) * round]);
    }
    return pts;
  };
  // Counter-clockwise in (out, up): bottom, outer face, rounded arrises, top, inner face.
  return [[-half, bottom], [half, bottom], ...arc(half - round, top - round, 0, Math.PI / 2), ...arc(-half + round, top - round, Math.PI / 2, Math.PI)];
}

export default function build(ctx, { seed = 31 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'PlazaPaving';

  // Bedding: sand-and-lime mortar showing in every joint.
  const bed = new THREE.RingGeometry(APRON - 0.04, EDGE - 0.006, 360, 6).rotateX(-Math.PI / 2);
  add(root, bed, m.mortar('#DACDBF'), { p: [0, TOP - 0.011, 0], cast: false, name: 'mortarBed' });

  // Fountain apron: a dressed stone disc the fountain's basin stands on.
  add(root, cylinder(APRON, APRON, 0.03, 256, 1), m.stone('#ECE1D3'), { p: [0, TOP - 0.004 - 0.015, 0], cast: false, name: 'fountainApron' });

  // Setts: concentric courses; the two outermost courses only cross the street mouths, where
  // they are closed exactly against the radial kerb ends.
  const courses = ringCourses({
    inner: APRON,
    outer: KERB_IN + 1e-6,
    pitch: PITCH,
    joint: JOINT,
    minLength: 0.058,
    maxLength: 0.084,
    rng,
  });
  for (let k = COURSES - 2; k < COURSES; k++) {
    const r = APRON + (k + 0.5) * PITCH;
    for (const s of STREET_ANGLES) {
      const edge = MOUTH_ANGLE - JOINT / r;
      for (const sett of fitCourse({ r, a0: s - edge, a1: s + edge, joint: JOINT, minLength: 0.058, maxLength: 0.084, rng })) {
        courses.push({ ...sett, ring: k });
      }
    }
  }

  const variants = 7;
  const buckets = Array.from({ length: variants }, () => []);
  const tufts = [];
  const tmpE = new THREE.Euler();
  for (const s of courses) {
    const star = starTone(s.r, s.angle);
    const banded = s.ring === 12 || s.ring === 13;
    const palette = star === 'main' ? STAR_MAIN : star === 'diag' ? STAR_DIAG : banded ? BAND : FIELD;
    const color = new THREE.Color(rng.pick(palette)).offsetHSL(rng.range(-0.006, 0.006), rng.range(-0.03, 0.03), rng.range(-0.025, 0.02));
    // Settlement: each sett sits a hair higher or lower and leans a little.
    tmpE.set(rng.range(-0.035, 0.035), s.angle + rng.range(-0.02, 0.02), rng.range(-0.035, 0.035), 'YXZ');
    buckets[rng.int(0, variants - 1)].push({
      p: [s.x, TOP + rng.range(-0.0016, 0.0012), s.z],
      r: new THREE.Quaternion().setFromEuler(tmpE),
      s: [s.length / 0.072, rng.range(0.92, 1.08), 1],
      color,
    });
    // Grass has found a few of the outer joints.
    if (s.ring >= COURSES - 6 && rng.chance(0.035)) {
      const side = rng.chance(0.5) ? 1 : -1;
      const a = s.angle + (side * (s.length / 2 + JOINT / 2)) / s.r;
      const blades = rng.int(3, 6);
      for (let b = 0; b < blades; b++) {
        const h = rng.range(0.012, 0.022);
        tmpE.set(rng.range(-0.35, 0.35), rng.range(0, Math.PI * 2), rng.range(-0.35, 0.35), 'XYZ');
        tufts.push({
          p: [Math.sin(a) * s.r + rng.range(-0.004, 0.004), TOP - 0.01, Math.cos(a) * s.r + rng.range(-0.004, 0.004)],
          r: new THREE.Quaternion().setFromEuler(tmpE),
          s: [h * 0.8, h, h],
          color: new THREE.Color(rng.pick(['#B9DDA0', '#AFD597', '#C3E3AA'])),
        });
      }
    }
  }
  const setts = group(root, { name: 'setts' });
  const settMat = m.sett();
  buckets.forEach((items, i) => {
    const geometry = settGeometry({ w: 0.072, d: PITCH - JOINT, h: 0.036, radius: 0.0052, pillow: rng.range(0.0011, 0.0019), rough: rng.range(0.003, 0.0042), seed: seed * 10 + i });
    setts.add(instanced(geometry, settMat, items, { cast: false, name: `setts-${i}`, tiling: true }));
  });

  // Kerbstones: curved granite blocks between the street mouths, each with real joints.
  const kerbs = [];
  const profile = kerbProfile();
  const gapAngle = JOINT / KERB_R;
  const mouth = MOUTH_ANGLE;
  const run = Math.PI / 2 - 2 * mouth;
  const blocks = Math.round((run * KERB_R) / 0.3);
  const span = run / blocks;
  const kerbGeometry = moldingArc(profile, KERB_R, -span / 2 + gapAngle / 2, span / 2 - gapAngle / 2, { segments: 28 });
  for (const s of STREET_ANGLES) {
    for (let b = 0; b < blocks; b++) {
      const phi = s + mouth + span * (b + 0.5);
      kerbs.push({ p: [0, rng.range(-0.0012, 0.0006), 0], r: [0, phi, 0], color: new THREE.Color(rng.pick(KERB)).offsetHSL(0, rng.range(-0.02, 0.02), rng.range(-0.02, 0.015)) });
    }
  }
  root.add(instanced(kerbGeometry, m.granite('#FFFFFF'), kerbs, { cast: true, name: 'kerbstones' }));

  if (tufts.length) {
    const grass = m.grass('#FFFFFF', { anchor: 0, range: 1, flutter: 0.4, space: 'local' });
    root.add(instanced(grassBladeGeometry({ height: 1, width: 0.3, bend: 0.3, segments: 4 }), grass, tufts, { cast: false, name: 'jointGrass' }));
  }

  root.userData.stats = { setts: courses.length, kerbs: kerbs.length, tuftBlades: tufts.length };
  root.userData.footprint = { r: EDGE };
  return root;
}
