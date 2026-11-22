import * as THREE from 'three';
import { PLAZA, STREET } from '../../map/layout.js';
import { add, group } from '../../kit/place.js';
import { cylinder, roundedBox, torus, sphere } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { settGeometry, ringCourses, fitRow, LEVELS } from '../../kit/paving.js';
import { moldingArc, moldingRun } from '../../kit/sweep.js';
import { stoneBalusterGeometry, stonePier } from '../../kit/railings.js';
import { noise3 } from '../../kit/noise.js';

// T4 — Street: one of the four streets radiating from the plaza, modelled in the east street's
// frame (running along +x from the plaza edge); the world assembler builds one per street with its
// own seed and turns it onto its axis. Cross-section from the centre line outward:
//   cambered asphalt with worn wheel tracks · a gutter course of setts · granite kerb ·
//   cobbled walk in stretcher bond · granite edging against the lawn.
// The road meets the plaza over a curved granite ramp and ends at a transverse ramp; beyond lies
// the belvedere: a round lookout paved in concentric setts around a brass compass medallion,
// closed by a limestone balustrade of turned balusters between corniced piers with ball finials.

const TOP = LEVELS.paving;
const ROAD = LEVELS.road;
const JOINT = 0.0075;
const R0 = PLAZA.radius;
const THRESHOLD = 0.07;
const ASPHALT = 0.5;
const GUTTER = STREET.roadHalf - 0.05; // 0.57
const KERB = STREET.roadHalf; // 0.62
const EDGING = STREET.roadHalf + STREET.walk; // 0.92
const WALK_OUT = EDGING - 0.035; // 0.885
const ROAD_END = 7.25;
const BAND = 0.07;
const BELV_X = STREET.end;
const BELV_R = STREET.belvedere;
const COPING_R = BELV_R - 0.04;
const COPING_TOP = TOP + 0.034;
const CAMBER = 0.003;
// Angle (from +x about the belvedere centre) where its rim meets the street edge.
const THETA_END = Math.acos(-Math.sqrt(BELV_R ** 2 - EDGING ** 2) / BELV_R);
const PIER_THETAS = [-1, -0.67, -0.335, 0, 0.335, 0.67, 1].map((k) => k * THETA_END);
const COPING_END_EXTRA = 0.05 / COPING_R; // the coping runs on under the terminal piers

const KERB_TONES = ['#D9CDC7', '#D3C6C0', '#DED3CC', '#CFC2BC'];
const WALK_TONES = ['#EFE4D6', '#E9DCCB', '#F3EADF', '#E5D6C4', '#EEE0D3', '#E7D9CD'];
const GUTTER_TONES = ['#D6CCC6', '#CFC4BE', '#DBD1CA'];
const BELV_TONES = ['#F1E7DA', '#EBDFCF', '#F5ECE1', '#E8DACA'];
const BELV_RING = ['#E9C6BE', '#E4BEB5'];

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Asphalt surface: crowned for drainage, two faint wheel tracks, a little unevenness.
function roadY(x, z) {
  const t = Math.min(1, Math.abs(z) / ASPHALT);
  const crown = CAMBER * (1 - t * t);
  const ruts = -0.0007 * Math.exp(-(((Math.abs(z) - 0.27) / 0.07) ** 2));
  return ROAD + crown + ruts + 0.0003 * noise3(x * 3.1, 0.5, z * 3.1, 77);
}

function asphaltGeometry() {
  const nz = 72;
  const nx = 480;
  const rIn = R0 + THRESHOLD + JOINT / 2;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      const z = -ASPHALT + (2 * ASPHALT * j) / nz;
      const x0 = Math.sqrt(rIn * rIn - z * z);
      const x = x0 + ((ROAD_END - JOINT / 2 - x0) * i) / nx;
      positions.push(x, roadY(x, z), z);
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j;
      const b = a + nz + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// A painted marking: a thin slab whose top follows the cambered road surface.
function paintGeometry(x0, x1, z0, z1, rng) {
  const g = new THREE.BoxGeometry(x1 - x0, 0.0016, z1 - z0, Math.max(2, Math.ceil((x1 - x0) / 0.008)), 1, Math.max(2, Math.ceil((z1 - z0) / 0.008)));
  const p = g.attributes.position;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const seed = rng.int(0, 1000);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx;
    const z = p.getZ(i) + cz;
    // Worn, slightly ragged edges: paint never ends on a perfect line.
    const edge = 0.0012 * noise3(x * 90, seed, z * 90, seed);
    const sx = Math.sign(p.getX(i)) * edge;
    const sz = Math.sign(p.getZ(i)) * edge;
    p.setXYZ(i, x + sx, roadY(x, z) + p.getY(i) + 0.0002, z + sz);
  }
  g.computeVertexNormals();
  return g;
}

// Kerb cross-section (out, up), counter-clockwise: rounded arris on the road side (-out).
function kerbProfile(halfWidth, top, roadRound = 0.012, walkRound = 0.004) {
  const arc = (cx, cy, r, a0, a1) => Array.from({ length: 9 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / 8;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  return [
    [-halfWidth, -0.03],
    [halfWidth, -0.03],
    ...arc(halfWidth - walkRound, top - walkRound, walkRound, 0, Math.PI / 2),
    ...arc(-halfWidth + roadRound, top - roadRound, roadRound, Math.PI / 2, Math.PI),
  ];
}

// Ramp cross-section (out, up): rises from road level (out = 0) to paving level (out = width).
function rampProfile(width) {
  return [
    [0, -0.03],
    [width, -0.03],
    [width, TOP - 0.003],
    [width - 0.003, TOP],
    [0.004, ROAD + 0.0012],
    [0, ROAD - 0.0008],
  ];
}

export default function build(ctx, { seed = 41 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Street';

  const granite = m.granite('#FFFFFF'); // instance-tinted kerbs and edging
  const graniteBlock = m.granite('#D9CDC7'); // individually modelled ramp and band blocks
  const settMat = m.sett();
  const limestone = m.stone('#F4EDE2');
  const iron = m.metal('iron');

  /* ---------- bedding under every paved surface ---------- */
  const outline = new THREE.Shape();
  const plazaArc = (z) => Math.sqrt(R0 * R0 - z * z);
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const z = -EDGING + (2 * EDGING * i) / steps;
    const pt = [plazaArc(z) + 0.004, -z];
    if (i === 0) outline.moveTo(pt[0], pt[1]);
    else outline.lineTo(pt[0], pt[1]);
  }
  const xMeet = BELV_X - Math.sqrt(BELV_R ** 2 - EDGING ** 2);
  outline.lineTo(xMeet, -EDGING);
  for (let i = 0; i <= 96; i++) {
    const theta = THETA_END - (2 * THETA_END * i) / 96;
    outline.lineTo(BELV_X + Math.cos(theta) * (BELV_R - 0.006), -Math.sin(theta) * (BELV_R - 0.006));
  }
  outline.lineTo(xMeet, EDGING);
  // The carriageway (asphalt, gutters, kerbs) sits lower, so it is cut out of the walk bedding.
  const carriageway = new THREE.Path();
  const rHole = R0 + 0.012; // must stay inside the bedding outline or the triangulation breaks
  carriageway.moveTo(Math.sqrt(rHole * rHole - GUTTER * GUTTER), -GUTTER);
  carriageway.lineTo(ROAD_END + 0.002, -GUTTER);
  carriageway.lineTo(ROAD_END + 0.002, GUTTER);
  for (let i = 0; i <= 24; i++) {
    const z = -GUTTER + (2 * GUTTER * i) / 24;
    carriageway.lineTo(Math.sqrt(rHole * rHole - z * z), -z);
  }
  outline.holes.push(carriageway);
  const bed = new THREE.ShapeGeometry(outline, 1).rotateX(-Math.PI / 2);
  add(root, bed, m.mortar('#DACDBF'), { p: [0, TOP - 0.011, 0], cast: false, name: 'mortarBed' });
  // Low bedding under the whole carriageway: it shows in the gutter joints, and closes the view
  // under the asphalt's edge (the asphalt is a surface, not a slab).
  const roadBedX0 = R0 - 0.06;
  const roadBed = new THREE.PlaneGeometry(ROAD_END + 0.002 - roadBedX0, 2 * (GUTTER + 0.003), 16, 4).rotateX(-Math.PI / 2);
  add(root, roadBed, m.mortar('#DACDBF'), { p: [(roadBedX0 + ROAD_END + 0.002) / 2, ROAD - 0.0055, 0], cast: false, name: 'roadBed' });

  /* ---------- carriageway ---------- */
  add(root, asphaltGeometry(), m.asphalt('#9A94A4', '#DCD7E2'), { cast: false, name: 'asphalt' });

  // Curved granite ramp where the road rises to the plaza.
  const threshold = group(root, { name: 'plazaThreshold' });
  const rMid = R0 + JOINT / 2 + THRESHOLD / 2;
  const tHalf = Math.asin((GUTTER - JOINT / 2) / rMid);
  const tBlocks = 5;
  const tSpan = (2 * tHalf) / tBlocks;
  // In the arc frame +out points away from the plaza, so the ramp must descend with +out: the
  // rising ramp profile is centred, mirrored, and re-ordered to stay counter-clockwise.
  const tArc = rampProfile(THRESHOLD - JOINT)
    .map(([o, u]) => [(THRESHOLD - JOINT) / 2 - o, u])
    .reverse();
  for (let b = 0; b < tBlocks; b++) {
    const a0 = Math.PI / 2 - tHalf + b * tSpan + JOINT / (2 * rMid);
    const a1 = a0 + tSpan - JOINT / rMid;
    add(threshold, moldingArc(tArc, rMid, a0, a1, { segments: 16 }), graniteBlock, { p: [0, rng.range(-0.0006, 0.0004), 0], name: 'thresholdBlock' });
  }

  // Transverse ramp where the road ends at the belvedere.
  const endRamp = group(root, { name: 'endRamp' });
  const rampBlocks = 4;
  const rampLen = (2 * GUTTER) / rampBlocks;
  for (let b = 0; b < rampBlocks; b++) {
    const zTop = GUTTER - b * rampLen - JOINT / 2;
    const geometry = moldingRun(rampProfile(BAND - JOINT), rampLen - JOINT);
    add(endRamp, geometry, graniteBlock, { p: [ROAD_END + JOINT / 2, rng.range(-0.0006, 0.0004), zTop], r: [0, Math.PI / 2, 0], name: 'rampBlock' });
  }
  // The band continues flat across kerbs and walks.
  for (const side of [1, -1]) {
    const geometry = moldingRun(kerbProfile((BAND - JOINT) / 2, TOP + 0.0015, 0.004, 0.004).map(([o, u]) => [o + (BAND - JOINT) / 2, u]), WALK_OUT - GUTTER - JOINT);
    const zStart = side > 0 ? WALK_OUT - JOINT / 2 : -GUTTER - JOINT / 2;
    add(endRamp, geometry, graniteBlock, { p: [ROAD_END + JOINT / 2, 0, zStart], r: [0, Math.PI / 2, 0], name: 'bandBlock' });
  }

  // Road paint: dashed centre line and a zebra crossing near the plaza.
  const paint = group(root, { name: 'markings' });
  const paintMat = m.roadPaint('#F7F3EA');
  for (let x = 4.1; x + 0.2 < 7.0; x += 0.36) {
    const len = 0.2 * rng.range(0.96, 1.03);
    add(paint, paintGeometry(x, x + len, -0.011, 0.011, rng), paintMat, { cast: false, name: 'centreDash' });
  }
  for (let k = 0; k < 7; k++) {
    const zc = (k - 3) * 0.15;
    add(paint, paintGeometry(3.36, 3.66, zc - 0.0375, zc + 0.0375, rng), paintMat, { cast: false, name: 'zebraStripe' });
  }

  // Cast-iron manhole cover with a raised pattern.
  const manhole = group(root, { name: 'manholeCover', p: [5.12, roadY(5.12, 0.24) - 0.0032, 0.24] });
  add(manhole, cylinder(0.062, 0.062, 0.004, 72, 1), iron, { p: [0, 0.002, 0], name: 'plate' });
  add(manhole, torus(0.062, 0.0032, 10, 96), iron, { p: [0, 0.0035, 0], r: [Math.PI / 2, 0, 0], name: 'rim' });
  for (const rr of [0.018, 0.034, 0.048]) add(manhole, torus(rr, 0.0016, 8, 72), iron, { p: [0, 0.0042, 0], r: [Math.PI / 2, 0, 0], name: 'ring' });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    add(manhole, roundedBox(0.038, 0.002, 0.003, 0.0008, 1), iron, { p: [Math.cos(a) * 0.037, 0.0042, Math.sin(a) * 0.037], r: [0, -a, 0], name: 'rib' });
  }
  const slotMat = m.stone('#3F3A47');
  for (const sx of [-0.04, 0.04]) add(manhole, roundedBox(0.012, 0.002, 0.004, 0.0008, 1), slotMat, { p: [sx, 0.0041, 0], name: 'liftSlot' });

  /* ---------- gutter course, gully grates and kerbs ---------- */
  const grateXs = [4.3, 6.45];
  const gutterSetts = [];
  const gutterDepth = GUTTER - ASPHALT - JOINT;
  const gutterZ = ASPHALT + JOINT / 2 + gutterDepth / 2;
  const rStart = R0 + THRESHOLD + JOINT / 2;
  for (const side of [1, -1]) {
    const x0 = Math.sqrt(rStart * rStart - (gutterZ - gutterDepth / 2) ** 2) + JOINT / 2;
    let segments = [[x0, ROAD_END - JOINT / 2]];
    for (const gx of grateXs) {
      segments = segments.flatMap(([a, b]) => (gx - 0.06 > a && gx + 0.06 < b ? [[a, gx - 0.06], [gx + 0.06, b]] : [[a, b]]));
    }
    for (const [a, b] of segments) {
      for (const s of fitRow({ x0: a, x1: b, joint: JOINT, minLength: 0.055, maxLength: 0.075, rng })) {
        gutterSetts.push({
          p: [s.x, ROAD - 0.0012 + rng.range(-0.0008, 0.0006), side * gutterZ],
          r: [rng.range(-0.03, 0.03), rng.range(-0.02, 0.02), rng.range(-0.03, 0.03)],
          s: [s.length / 0.072, rng.range(0.92, 1.05), 1],
          color: new THREE.Color(rng.pick(GUTTER_TONES)).offsetHSL(0, rng.range(-0.02, 0.02), rng.range(-0.025, 0.02)),
        });
      }
    }
    // Gully grates sitting in the gutter course.
    for (const gx of grateXs) {
      const grate = group(root, { name: 'gullyGrate', p: [gx, ROAD - 0.0045, side * gutterZ] });
      add(grate, roundedBox(0.112, 0.024, 0.056, 0.002, 1), slotMat, { p: [0, -0.012, 0], name: 'pit' });
      for (const [w, d, x, z] of [[0.112, 0.006, 0, 0.028], [0.112, 0.006, 0, -0.028], [0.006, 0.05, 0.053, 0], [0.006, 0.05, -0.053, 0]]) {
        add(grate, roundedBox(w, 0.004, d, 0.0012, 1), iron, { p: [x, 0.0015, z], name: 'frame' });
      }
      for (let k = 0; k < 8; k++) add(grate, roundedBox(0.0045, 0.0035, 0.05, 0.001, 1), iron, { p: [-0.042 + k * 0.012, 0.0012, 0], name: 'bar' });
    }
  }
  const gutterGeo = settGeometry({ w: 0.072, d: gutterDepth, h: 0.034, radius: 0.005, pillow: 0.0014, rough: 0.0034, seed: seed * 13 });
  root.add(instanced(gutterGeo, settMat, gutterSetts, { cast: false, name: 'gutterSetts', tiling: true }));

  const kerbs = [];
  const kerbZ = (GUTTER + KERB) / 2;
  const kx0 = Math.sqrt((R0 + JOINT / 2) ** 2 - GUTTER ** 2) + JOINT / 2;
  const kerbRun = ROAD_END - JOINT / 2 - kx0;
  const kerbCount = Math.round(kerbRun / 0.32);
  const kerbLen = kerbRun / kerbCount;
  const kerbGeo = moldingRun(kerbProfile((KERB - GUTTER) / 2, TOP + 0.0015), kerbLen - JOINT);
  for (const side of [1, -1]) {
    for (let k = 0; k < kerbCount; k++) {
      const x = kx0 + k * kerbLen + JOINT / 2;
      kerbs.push({
        p: side > 0 ? [x, rng.range(-0.001, 0.0004), kerbZ] : [x + kerbLen - JOINT, rng.range(-0.001, 0.0004), -kerbZ],
        r: [0, side > 0 ? 0 : Math.PI, 0],
        color: new THREE.Color(rng.pick(KERB_TONES)).offsetHSL(0, rng.range(-0.02, 0.02), rng.range(-0.02, 0.015)),
      });
    }
  }
  root.add(instanced(kerbGeo, granite, kerbs, { name: 'kerbs' }));

  /* ---------- walks and edging ---------- */
  const walkSetts = [];
  const rows = 4;
  const za = KERB + JOINT / 2;
  const pitch = (WALK_OUT - JOINT / 2 - za) / rows;
  const depth = pitch - JOINT;
  for (const side of [1, -1]) {
    for (let k = 0; k < rows; k++) {
      const zc = za + (k + 0.5) * pitch;
      const x0 = Math.sqrt((R0 + JOINT / 2) ** 2 - (zc - depth / 2) ** 2) + JOINT / 2;
      for (const s of fitRow({ x0, x1: ROAD_END - JOINT / 2, joint: JOINT, minLength: 0.06, maxLength: 0.09, rng })) {
        walkSetts.push({
          p: [s.x, TOP + rng.range(-0.0016, 0.0012), side * zc],
          r: [rng.range(-0.035, 0.035), rng.range(-0.02, 0.02), rng.range(-0.035, 0.035)],
          s: [s.length / 0.072, rng.range(0.92, 1.08), 1],
          color: new THREE.Color(rng.pick(WALK_TONES)).offsetHSL(rng.range(-0.006, 0.006), rng.range(-0.03, 0.03), rng.range(-0.025, 0.02)),
        });
      }
    }
  }

  const edging = [];
  const edgeZ = (WALK_OUT + EDGING) / 2;
  const ex0 = Math.sqrt((R0 + JOINT / 2) ** 2 - edgeZ ** 2) + JOINT / 2;
  const pierEnd = BELV_X + Math.cos(THETA_END) * COPING_R - 0.05;
  const edgeRun = pierEnd - ex0;
  const edgeCount = Math.round(edgeRun / 0.3);
  const edgeLen = edgeRun / edgeCount;
  const edgeGeo = moldingRun(kerbProfile((EDGING - WALK_OUT - JOINT) / 2, TOP + 0.0012, 0.003, 0.008), edgeLen - JOINT);
  for (const side of [1, -1]) {
    for (let k = 0; k < edgeCount; k++) {
      const x = ex0 + k * edgeLen + JOINT / 2;
      edging.push({
        p: side > 0 ? [x, rng.range(-0.001, 0.0004), edgeZ] : [x + edgeLen - JOINT, rng.range(-0.001, 0.0004), -edgeZ],
        r: [0, side > 0 ? 0 : Math.PI, 0],
        color: new THREE.Color(rng.pick(KERB_TONES)).offsetHSL(0, rng.range(-0.02, 0.02), rng.range(-0.02, 0.015)),
      });
    }
  }
  root.add(instanced(edgeGeo, granite, edging, { name: 'edging' }));

  /* ---------- belvedere ---------- */
  const belvedere = group(root, { name: 'belvedere' });
  const belvSetts = [];
  const innerR = 0.135;
  const bandStart = ROAD_END + BAND + JOINT / 2;
  const courses = ringCourses({
    inner: innerR,
    outer: 1.25,
    pitch: 0.066,
    joint: JOINT,
    minLength: 0.058,
    maxLength: 0.084,
    rng,
    accept: (r, phi, L) => {
      const x = BELV_X + Math.sin(phi) * r;
      const z = Math.cos(phi) * r;
      const d = 0.066 - JOINT;
      const ex = (L / 2) * Math.abs(Math.cos(phi)) + (d / 2) * Math.abs(Math.sin(phi));
      const ez = (L / 2) * Math.abs(Math.sin(phi)) + (d / 2) * Math.abs(Math.cos(phi));
      if (x - ex < bandStart) return false;
      if (r + d / 2 <= COPING_R - 0.04 - JOINT / 2) return true;
      if (Math.abs(z) + ez > WALK_OUT - JOINT / 2) return false;
      if (x + ex <= pierEnd - 0.01) return true;
      // Corner beside the terminal piers: clear of the coping's end and of the pier itself.
      const theta = Math.abs(Math.atan2(z, x - BELV_X));
      const pierX = BELV_X + Math.cos(THETA_END) * COPING_R;
      const pierZ = Math.sign(z) * Math.sin(THETA_END) * COPING_R;
      return theta - L / 2 / r > THETA_END + COPING_END_EXTRA + 0.01 && Math.hypot(x - pierX, z - pierZ) > 0.072 + L / 2;
    },
  });
  for (const s of courses) {
    const ring = s.ring === 7 || s.ring === 8;
    belvSetts.push({
      p: [BELV_X + s.x, TOP + rng.range(-0.0014, 0.0012), s.z],
      r: new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.03, 0.03), s.angle + rng.range(-0.02, 0.02), rng.range(-0.03, 0.03), 'YXZ')),
      s: [s.length / 0.072, rng.range(0.92, 1.08), 1],
      color: new THREE.Color(rng.pick(ring ? BELV_RING : BELV_TONES)).offsetHSL(rng.range(-0.006, 0.006), rng.range(-0.03, 0.03), rng.range(-0.025, 0.02)),
    });
  }

  // Cut-stone infill: small setts close the leftover corners between the concentric courses and
  // the straight edging, the way pavers cut stones to fit.
  const placed = courses.map((s) => ({ x: BELV_X + s.x, z: s.z, phi: s.angle, hl: s.length / 2 + JOINT / 2, hd: (0.066 - JOINT) / 2 + JOINT / 2 }));
  const clash = (x, z, half) =>
    placed.some((s) => {
      const dx = x - s.x;
      const dz = z - s.z;
      if (dx * dx + dz * dz > 0.03) return false;
      const lt = dx * Math.cos(s.phi) - dz * Math.sin(s.phi);
      const ln = dx * Math.sin(s.phi) + dz * Math.cos(s.phi);
      return Math.abs(lt) < s.hl + half && Math.abs(ln) < s.hd + half;
    });
  const infill = [];
  const pierX = BELV_X + Math.cos(THETA_END) * COPING_R;
  // Two passes: cut halves first, then quarters for the tightest gaps.
  for (const [pass, cut] of [[0, 0.034], [1, 0.022]]) {
    const half = cut / 2;
    const items = [];
    for (const side of [1, -1]) {
      for (let x = bandStart + half; x < pierX + 0.08; x += (cut + JOINT) * 0.5) {
        for (let az = half * 0.5; az < WALK_OUT; az += (cut + JOINT) * 0.5) {
          const px = x + rng.range(-0.002, 0.002);
          const pz = side * (az + rng.range(-0.002, 0.002));
          if (px - half < bandStart || Math.abs(pz) + half > WALK_OUT - JOINT / 2) continue;
          const rb = Math.hypot(px - BELV_X, pz);
          if (rb - half < innerR + 0.01) continue;
          if (rb + half > COPING_R - 0.04 - JOINT / 2) {
            const theta = Math.abs(Math.atan2(pz, px - BELV_X));
            if (theta - half / rb < THETA_END + COPING_END_EXTRA + 0.008) continue;
            if (Math.hypot(px - pierX, pz - side * Math.sin(THETA_END) * COPING_R) < 0.07 + half) continue;
            if (px + half > pierX + 0.05) continue;
          }
          if (clash(px, pz, half + JOINT / 2)) continue;
          placed.push({ x: px, z: pz, phi: Math.PI / 2, hl: half + JOINT / 2, hd: half + JOINT / 2 });
          items.push({
            p: [px, TOP + rng.range(-0.0014, 0.0012), pz],
            r: [rng.range(-0.03, 0.03), (rng.int(0, 3) * Math.PI) / 2 + rng.range(-0.05, 0.05), rng.range(-0.03, 0.03)],
            s: [rng.range(0.92, 1.03), rng.range(0.92, 1.06), rng.range(0.92, 1.03)],
            color: new THREE.Color(rng.pick(BELV_TONES)).offsetHSL(0, rng.range(-0.03, 0.03), rng.range(-0.025, 0.02)),
          });
        }
      }
    }
    if (items.length) {
      const cutGeo = settGeometry({ w: cut, d: cut, h: 0.034, radius: cut * 0.13, pillow: 0.0011, rough: cut * 0.075, seed: seed * 17 + pass });
      belvedere.add(instanced(cutGeo, settMat, items, { cast: false, name: `cutInfill-${pass}`, tiling: true }));
    }
    infill.push(...items);
  }

  // Walk and belvedere setts share a handful of hand-cut variants.
  const variants = 6;
  const buckets = Array.from({ length: variants }, () => []);
  for (const item of walkSetts) buckets[rng.int(0, variants - 1)].push(item);
  const belvBuckets = Array.from({ length: variants }, () => []);
  for (const item of belvSetts) belvBuckets[rng.int(0, variants - 1)].push(item);
  const setts = group(root, { name: 'walkSetts' });
  buckets.forEach((items, i) => {
    const geometry = settGeometry({ w: 0.072, d: depth, h: 0.036, radius: 0.0052, pillow: rng.range(0.0011, 0.0019), rough: rng.range(0.003, 0.0042), seed: seed * 10 + i });
    setts.add(instanced(geometry, settMat, items, { cast: false, name: `walk-${i}`, tiling: true }));
  });
  belvBuckets.forEach((items, i) => {
    const geometry = settGeometry({ w: 0.072, d: 0.066 - JOINT, h: 0.036, radius: 0.0052, pillow: rng.range(0.0011, 0.0019), rough: rng.range(0.003, 0.0042), seed: seed * 10 + 50 + i });
    belvedere.add(instanced(geometry, settMat, items, { cast: false, name: `belvedere-${i}`, tiling: true }));
  });

  // Compass medallion: granite ring, rose inlay, an eight-point brass star.
  const medallion = group(belvedere, { name: 'medallion', p: [BELV_X, 0, 0] });
  add(medallion, cylinder(innerR - JOINT / 2, innerR - JOINT / 2, 0.04, 128, 1), m.granite('#D8CCC6'), { p: [0, TOP + 0.0015 - 0.02, 0], cast: false, name: 'ring' });
  add(medallion, cylinder(0.094, 0.094, 0.004, 128, 1), m.granite('#E6BDB4'), { p: [0, TOP + 0.0005, 0], cast: false, name: 'roseInlay' });
  const star = new THREE.Shape();
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const rr = k % 2 === 0 ? (k % 4 === 0 ? 0.085 : 0.058) : 0.022;
    const px = Math.sin(a) * rr;
    const pz = Math.cos(a) * rr;
    if (k === 0) star.moveTo(px, pz);
    else star.lineTo(px, pz);
  }
  const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 4 }).rotateX(Math.PI / 2);
  add(medallion, starGeo, m.metal('brass'), { p: [0, TOP + 0.0042, 0], r: [0, Math.PI / 2, 0], cast: false, name: 'brassStar' });
  add(medallion, sphere(0.012, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.metal('brass'), { p: [0, TOP + 0.0042, 0], cast: false, name: 'boss' });

  // Coping ring the balustrade stands on.
  const coping = group(belvedere, { name: 'coping', p: [BELV_X, 0, 0] });
  const cHalf = 0.04 - JOINT / 2;
  const copingProfile = kerbProfile(cHalf, COPING_TOP, 0.008, 0.008);
  const cExtra = COPING_END_EXTRA;
  const cBlocks = 13;
  const cStart = Math.PI / 2 - THETA_END - cExtra;
  const cSpan = (2 * (THETA_END + cExtra)) / cBlocks;
  for (let b = 0; b < cBlocks; b++) {
    const a0 = cStart + b * cSpan + JOINT / (2 * COPING_R);
    add(coping, moldingArc(copingProfile, COPING_R, a0, a0 + cSpan - JOINT / COPING_R, { segments: 24 }), limestone, { name: 'copingBlock' });
  }

  // Piers, balusters and the curved top rail.
  const balustrade = group(belvedere, { name: 'balustrade', p: [BELV_X, 0, 0] });
  const pierW = 0.064;
  const balH = 0.115;
  const plinthH = 0.01;
  const abacusH = 0.006;
  const railY = COPING_TOP + plinthH + balH + abacusH;
  const railProfile = [
    [-0.03, 0],
    [0.03, 0],
    [0.03, 0.013],
    ...Array.from({ length: 9 }, (_, i) => {
      const a = (i / 8) * (Math.PI / 2);
      return [0.018 + Math.cos(a) * 0.012, 0.013 + Math.sin(a) * 0.012];
    }),
    [0, 0.028],
    ...Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI / 2 + (i / 8) * (Math.PI / 2);
      return [-0.018 + Math.cos(a) * 0.012, 0.013 + Math.sin(a) * 0.012];
    }),
  ];
  for (const theta of PIER_THETAS) {
    const phi = Math.PI / 2 - theta;
    const pier = stonePier(balustrade, { width: pierW, height: railY + 0.028 + 0.02 - COPING_TOP, stone: limestone, name: 'pier' });
    pier.position.set(Math.sin(phi) * COPING_R, COPING_TOP, Math.cos(phi) * COPING_R);
    pier.rotation.y = phi;
  }
  const balusters = [];
  const plinths = [];
  const abaci = [];
  const clearance = (pierW / 2 + 0.03) / COPING_R;
  for (let k = 0; k < PIER_THETAS.length - 1; k++) {
    const t0 = PIER_THETAS[k] + clearance;
    const t1 = PIER_THETAS[k + 1] - clearance;
    const count = Math.max(1, Math.floor(((t1 - t0) * COPING_R) / 0.046) + 1);
    for (let i = 0; i < count; i++) {
      const theta = count === 1 ? (t0 + t1) / 2 : t0 + ((t1 - t0) * i) / (count - 1);
      const phi = Math.PI / 2 - theta;
      const x = Math.sin(phi) * COPING_R;
      const z = Math.cos(phi) * COPING_R;
      plinths.push({ p: [x, COPING_TOP + plinthH / 2, z], r: [0, phi, 0] });
      balusters.push({ p: [x, COPING_TOP + plinthH, z], r: [0, rng.range(0, Math.PI * 2), 0], s: [rng.range(0.985, 1.015), 1, rng.range(0.985, 1.015)] });
      abaci.push({ p: [x, COPING_TOP + plinthH + balH + abacusH / 2, z], r: [0, phi, 0] });
    }
    const ra0 = Math.PI / 2 - (PIER_THETAS[k + 1] - pierW / 2 / COPING_R);
    const ra1 = Math.PI / 2 - (PIER_THETAS[k] + pierW / 2 / COPING_R);
    add(balustrade, moldingArc(railProfile, COPING_R, ra0, ra1, { segments: 40 }), limestone, { p: [0, railY, 0], name: 'rail' });
  }
  balustrade.add(instanced(roundedBox(0.026, plinthH, 0.026, 0.002, 2), limestone, plinths, { name: 'balusterPlinths' }));
  balustrade.add(instanced(stoneBalusterGeometry({ height: balH, radius: 0.0125, radial: 28 }), limestone, balusters, { name: 'balusters' }));
  balustrade.add(instanced(roundedBox(0.024, abacusH, 0.024, 0.0015, 2), limestone, abaci, { name: 'balusterAbaci' }));

  root.userData.stats = { walkSetts: walkSetts.length, gutterSetts: gutterSetts.length, belvedereSetts: belvSetts.length, cutInfill: infill.length, balusters: balusters.length, kerbs: kerbs.length };
  return root;
}
