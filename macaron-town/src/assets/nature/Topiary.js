import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { roundedBox, sphere, cylinder, lathe, spline, taperTube, tube } from '../../kit/geometry.js';
import { surfaceCover } from '../../kit/trees.js';
import { leafGeometry } from '../../kit/flora.js';

// N3 — Topiary: clipped boxwood grown in a Versailles planter (a cream-painted box of corner posts
// with gilt ball finials and bun feet, framing raised sage panels, filled with dark soil), in one of
// four classic shapes: a spiral corkscrewing round its bare stem to a point, three stacked balls on
// one stem, a cone with a ball finial, or a ball standard on a clean stem. The clipped skin is a
// close shear of baked boxwood, and thousands of small glossy oval leaves stand out of it at its
// surface, taking its shading, so the edges read crisp but leafy.

const SHAPES = ['spiral', 'tiers', 'cone', 'standard'];
const GREENS = ['#7FB47A', '#76AC72', '#88BC80', '#6FA56C', '#93C285'];
const BOX = { half: 0.16, height: 0.27, post: 0.024 };

function planter(parent, m, rng) {
  const g = group(parent, { name: 'planter' });
  const paint = m.paintedWood('#F6F0E6');
  const panel = m.paintedWood('#B7CCB4');
  const gold = m.metal('gold');
  const { half, height, post } = BOX;
  const foot = 0.03;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = sx * (half - post);
    const z = sz * (half - post);
    add(g, sphere(0.024, 20, 14), paint, { p: [x, 0.02, z], s: [1, 0.85, 1], name: 'bunFoot' });
    add(g, roundedBox(post * 2, height, post * 2, 0.005, 3), paint, { p: [x, foot + height / 2, z], name: 'cornerPost' });
    add(g, roundedBox(post * 2.4, 0.014, post * 2.4, 0.004, 3), paint, { p: [x, foot + height + 0.007, z], name: 'postCap' });
    add(g, cylinder(0.008, 0.011, 0.012, 16), gold, { p: [x, foot + height + 0.02, z], name: 'finialNeck' });
    add(g, sphere(0.02, 24, 16), gold, { p: [x, foot + height + 0.044, z], name: 'finialBall' });
  }
  // Four sides: a board between the posts, framed by top and bottom rails, carrying a raised panel.
  const span = (half - post * 2) * 2;
  for (let k = 0; k < 4; k++) {
    const side = group(g, { r: [0, (k * Math.PI) / 2, 0], name: 'side' });
    const z = half - post;
    add(side, roundedBox(span, height - 0.02, 0.014, 0.003, 2), paint, { p: [0, foot + height / 2, z], name: 'board' });
    add(side, roundedBox(span + 0.004, 0.026, 0.026, 0.005, 3), paint, { p: [0, foot + height - 0.013, z + 0.004], name: 'topRail' });
    add(side, roundedBox(span + 0.004, 0.03, 0.024, 0.005, 3), paint, { p: [0, foot + 0.017, z + 0.003], name: 'bottomRail' });
    add(side, roundedBox(span - 0.05, height - 0.105, 0.012, 0.004, 3), panel, { p: [0, foot + height / 2 + 0.004, z + 0.008], name: 'panel' });
    add(side, roundedBox(span - 0.085, height - 0.14, 0.008, 0.003, 3), panel, { p: [0, foot + height / 2 + 0.004, z + 0.013], name: 'panelField' });
  }
  // Soil, mounded a little, just below the rim.
  const soil = m.stone('#7C6455');
  add(g, lathe(spline([[0, 0.008], [half * 0.6, 0.004], [half - post, -0.004], [half - post, -0.02], [0, -0.02]], 24), 4, Math.PI / 4), soil, { p: [0, foot + height - 0.016, 0], s: [1.414, 1, 1.414], name: 'soil' });
  return { top: foot + height - 0.012 };
}

// The clipped foliage masses of each shape, as [{ geometry, matrix }] in the topiary's frame, plus
// the bare stem's path.
function shapeMasses(shape, base, rng) {
  const masses = [];
  const m4 = (x, y, z, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
  let stemTop = base + 0.2;
  if (shape === 'spiral') {
    // A corkscrew: a tube coiling round the stem, widest at the foot, tapering to a point.
    const turns = 4.6;
    const y0 = base + 0.08;
    const y1 = base + 0.8;
    const pts = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2;
      const R = 0.105 * (1 - t) + 0.01 * t;
      pts.push(new THREE.Vector3(Math.cos(a) * R, y0 + (y1 - y0) * t, Math.sin(a) * R));
    }
    const radius = (t) => (0.095 * (1 - t) + 0.017 * t) * Math.min(1, t * 14 + 0.3);
    masses.push({ geometry: taperTube(pts, radius, { tubular: 420, radial: 28 }), matrix: m4(0, 0, 0) });
    masses.push({ geometry: sphere(0.02, 20, 14), matrix: m4(pts[steps].x, pts[steps].y, pts[steps].z) });
    stemTop = y1 - 0.04;
  } else if (shape === 'tiers') {
    const balls = [
      [0.155, base + 0.2],
      [0.118, base + 0.49],
      [0.082, base + 0.72],
    ];
    for (const [r, y] of balls) masses.push({ geometry: sphere(1, 64, 44), matrix: m4(0, y, 0, r, r * 0.94, r) });
    stemTop = base + 0.74;
  } else if (shape === 'cone') {
    const h = 0.62;
    const r = 0.16;
    const profile = spline([[0, 0], [r * 0.9, 0.006], [r, 0.03], [r * 0.82, h * 0.3], [r * 0.48, h * 0.66], [r * 0.12, h * 0.95], [0, h]], 80);
    masses.push({ geometry: lathe(profile, 96), matrix: m4(0, base + 0.05, 0) });
    masses.push({ geometry: sphere(1, 40, 28), matrix: m4(0, base + 0.05 + h + 0.05, 0, 0.055) });
    stemTop = base + 0.08;
  } else {
    // Standard: a ball held high on a clean stem.
    masses.push({ geometry: sphere(1, 72, 50), matrix: m4(0, base + 0.52, 0, 0.175, 0.165, 0.175) });
    stemTop = base + 0.46;
  }
  return { masses, stemTop };
}

export default function build(ctx, { seed = 31, shape = null } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const kind = shape ?? SHAPES[seed % SHAPES.length];
  const root = new THREE.Group();
  root.name = 'Topiary';

  const { top } = planter(root, m, rng);

  // The bare stem, rising from the soil through the clipped masses.
  const { masses, stemTop } = shapeMasses(kind, top, rng);
  const stem = m.bark('#8E7A68');
  add(root, taperTube([[0, top - 0.02, 0], [0.004, (top + stemTop) / 2, -0.003], [0, stemTop, 0]], [0.015, 0.009], { tubular: 32, radial: 12 }), stem, { name: 'stem' });

  const skin = m.crownSkin('#9CCB90', { texture: 'boxwoodMass', gap: '#3F7A52', glow: '#E8F7B0', shadowTint: '#B8D4C4', scale: 6, spec: { shininess: 60, strength: 0.16, threshold: 0.6, softness: 0.05 } });
  const leafMat = m.crownLeaves(null, { outlineId: skin.userData.cel.celOutlineId.value, texture: 'leaf', vertexColors: false, shadowTint: '#B8D4C4', glow: '#E8F7B0', spec: { shininess: 70, strength: 0.3, threshold: 0.58, softness: 0.04 } });
  const leaves = [];
  for (const { geometry, matrix } of masses) {
    add(root, geometry, skin, { name: 'clipped' }).applyMatrix4(matrix);
    leaves.push(...surfaceCover(rng, geometry, { matrix, density: 5200, scale: [0.011, 0.015], under: 0.6, lift: 0.001, tilt: 0.5, color: () => new THREE.Color(rng.pick(GREENS)).offsetHSL(rng.range(-0.01, 0.01), rng.range(-0.04, 0.04), rng.range(-0.05, 0.04)) }));
  }
  root.add(instanced(leafGeometry({ length: 1, width: 0.62, fold: 0.12, arch: 0.08, segU: 4, segV: 6, transfer: true }), leafMat, leaves, { cast: false, name: 'leaves' }));

  root.userData.footprint = { r: 0.3 };
  root.userData.stats = { shape: kind, leaves: leaves.length };
  return root;
}
