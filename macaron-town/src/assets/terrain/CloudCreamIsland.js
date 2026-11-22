import * as THREE from 'three';
import { ISLAND } from '../../map/layout.js';
import { add, group } from '../../kit/place.js';
import { sphere } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { rosetteGeometry } from '../../kit/piping.js';
import { puffGeometry } from '../../kit/clouds.js';
import { fbm3 } from '../../kit/noise.js';

// T1 — Cloud Cream Island: a hand-smoothed whipped-cream slab ringed with piped rosettes, strawberry
// glaze running over the lip in drips, sugar pearls, all resting on a cushion of cumulus.
// The town plateau is the flat top at y = TOP (the lawn and paving sit on it).

const TOP = -0.02;
const ANGULAR = 1440;

// Side silhouette of the slab (r, y), from the edge of the flat top over the lip and under.
const SIDE = new THREE.CatmullRomCurve3(
  [
    [9.2, TOP],
    [9.85, TOP - 0.012],
    [10.16, -0.075],
    [10.37, -0.24],
    [10.45, -0.55],
    [10.41, -0.96],
    [10.29, -1.36],
    [10.05, -1.68],
    [9.63, -1.92],
    [9.0, -2.05],
    [8.0, -2.12],
  ].map(([r, y]) => new THREE.Vector3(r, y, 0)),
  false,
  'centripetal'
);
const SIDE_LENGTH = SIDE.getLength();

// Spatula-smoothed irregularity: gentle lobes plus fine sweeps, only on the sides.
function wobble(theta, r, y) {
  const w = THREE.MathUtils.smoothstep(r, 9.25, 9.95);
  if (w === 0) return 0;
  const lobes = 0.009 * Math.sin(7 * theta + 0.8) + 0.006 * Math.sin(13 * theta + 2.1) + 0.0025 * Math.sin(41 * theta + y * 3);
  const organic = 0.011 * fbm3(Math.cos(theta) * 2.2, y * 0.9, Math.sin(theta) * 2.2, 4, 7);
  return w * (lobes + organic);
}

function sidePoint(s) {
  const t = THREE.MathUtils.clamp(s / SIDE_LENGTH, 0, 1);
  const p = SIDE.getPointAt(t);
  const tan = SIDE.getTangentAt(t);
  // Outward normal of the silhouette: the tangent (running outward and down) turned a quarter
  // counter-clockwise, e.g. straight down (0, -1) -> straight out (1, 0).
  return { r: p.x, y: p.y, nr: -tan.y, ny: tan.x };
}

// Lathe with the same winding as THREE.LatheGeometry (profile from bottom centre, out, up, in).
function creamBody() {
  const profile = [[0, -2.15], [4, -2.14]];
  const samples = SIDE.getSpacedPoints(220).reverse();
  for (const p of samples) profile.push([p.x, p.y]);
  profile.push([7.5, TOP], [4, TOP], [0, TOP]);
  const n = profile.length;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= ANGULAR; i++) {
    const theta = (i / ANGULAR) * Math.PI * 2;
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    for (let j = 0; j < n; j++) {
      const [r, y] = profile[j];
      const rr = r * (1 + wobble(theta, r, y));
      positions.push(s * rr, y, c * rr);
    }
  }
  for (let i = 0; i < ANGULAR; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      const b = a + n;
      indices.push(a, b, a + 1, b + 1, a + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Strawberry glaze: a film poured over the lip that runs down in tongues ending in beads.
function glazeGeometry(drips, lipStart) {
  const columns = 2880;
  const rows = 56;
  const base = 0.24;
  const length = (theta) => {
    let extra = 0;
    for (const d of drips) {
      let dt = Math.abs(theta - d.theta);
      dt = Math.min(dt, Math.PI * 2 - dt);
      const x = dt / d.width;
      if (x < 1) extra = Math.max(extra, d.length * Math.pow(1 - x * x, 0.55));
    }
    return base + extra;
  };
  const positions = [];
  const indices = [];
  for (let i = 0; i <= columns; i++) {
    const theta = (i / columns) * Math.PI * 2;
    const L = length(theta);
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      const p = sidePoint(lipStart + L * t);
      const thickness = 0.024 * THREE.MathUtils.smoothstep(t, 0, 0.1) * (1 - Math.pow(THREE.MathUtils.smoothstep(t, 0.78, 1), 2));
      const r = p.r * (1 + wobble(theta, p.r, p.y)) + p.nr * thickness;
      positions.push(s * r, p.y + p.ny * thickness, c * r);
    }
  }
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const b = a + rows + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return { geometry: g, length };
}

function arcLengthAtRadius(r) {
  let best = 0;
  let bestErr = Infinity;
  for (let k = 0; k <= 400; k++) {
    const s = (k / 400) * SIDE_LENGTH * 0.4;
    const err = Math.abs(sidePoint(s).r - r);
    if (err < bestErr) {
      bestErr = err;
      best = s;
    }
  }
  return best;
}

export default function build(ctx, { seed = 11 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'CloudCreamIsland';

  add(root, creamBody(), m.cream('#FFF7EC'), { name: 'creamSlab' });

  // Glaze drips: varied tongues spaced unevenly around the rim.
  const drips = [];
  let theta = rng.range(0, 0.1);
  while (theta < Math.PI * 2 - 0.05) {
    drips.push({ theta, width: rng.range(0.016, 0.03), length: rng.chance(0.25) ? rng.range(0.75, 1.05) : rng.range(0.2, 0.6) });
    theta += rng.range(0.1, 0.19);
  }
  const lipStart = arcLengthAtRadius(10.0);
  const glaze = glazeGeometry(drips, lipStart);
  const glazeMat = m.glaze('#F59BB4');
  add(root, glaze.geometry, glazeMat, { name: 'glaze' });

  // A glossy bead swelling at the end of every longer tongue.
  for (const d of drips) {
    if (d.length < 0.32) continue;
    const L = glaze.length(d.theta);
    const p = sidePoint(lipStart + L * 0.97);
    const r = p.r * (1 + wobble(d.theta, p.r, p.y));
    const beadR = d.width * 10.4 * rng.range(0.42, 0.55);
    const bead = add(root, sphere(1, 40, 28), glazeMat, {
      p: [Math.sin(d.theta) * (r + p.nr * beadR * 0.45), p.y - beadR * 0.25, Math.cos(d.theta) * (r + p.nr * beadR * 0.45)],
      s: [beadR, beadR * 1.3, beadR * 0.75],
      name: 'dripBead',
    });
    bead.rotation.y = d.theta;
  }

  // Piped rosettes around the top edge, each sculpted individually.
  const rosettes = group(root, { name: 'rosettes' });
  const count = 50;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng.range(-0.01, 0.01);
    const radius = rng.range(0.5, 0.58);
    const geometry = rosetteGeometry({
      radius,
      height: radius * rng.range(0.78, 0.92),
      turns: rng.range(1.9, 2.35),
      ridges: rng.int(7, 9),
      twist: rng.range(2.5, 4.5),
      phase: rng.range(0, Math.PI * 2),
      tubular: 220,
      radial: 44,
    });
    const r = ISLAND.rimRadius - 0.03;
    add(rosettes, geometry, m.cream('#FFFCF6'), { p: [Math.sin(a) * r, TOP - 0.02, Math.cos(a) * r], r: [0, rng.range(0, Math.PI * 2), 0], name: `rosette-${i}` });
  }

  // Sugar pearls nestled on the glaze between rosettes.
  const pearls = [];
  const pearlS = arcLengthAtRadius(10.18);
  const lip = sidePoint(pearlS);
  for (let i = 0; i < count * 2; i++) {
    const a = ((i + 0.5) / (count * 2)) * Math.PI * 2 + rng.range(-0.012, 0.012);
    const size = rng.range(0.055, 0.085);
    const r = lip.r * (1 + wobble(a, lip.r, lip.y)) + size * 0.55;
    pearls.push({ p: [Math.sin(a) * r, lip.y + size * 0.62 + 0.024, Math.cos(a) * r], s: size, color: rng.pick(['#FFFDF8', '#FAD5DF', '#F4E3C3', '#FFFDF8']) });
  }
  root.add(instanced(sphere(1, 32, 24), m.ceramic('#FFFFFF'), pearls, { name: 'pearls' }));

  // Cumulus cushion: overlapping cauliflower clusters (a big lobe crowned with florets) in tiers.
  const cloud = group(root, { name: 'cloudBase' });
  const puffs = [];
  const tiers = [
    { n: 22, r: [9.4, 10.5], y: [-2.45, -2.05], size: [1.25, 1.85], florets: [3, 5] },
    { n: 16, r: [6.6, 8.6], y: [-3.15, -2.7], size: [1.9, 2.6], florets: [2, 4] },
    { n: 9, r: [1.5, 5.2], y: [-3.85, -3.35], size: [2.4, 3.1], florets: [1, 3] },
    { n: 10, r: [3.0, 9.6], y: [-4.7, -4.05], size: [0.9, 1.5], florets: [1, 2] },
  ];
  let puffSeed = seed * 100;
  const material = m.cloud();
  const addPuff = (p, size, squash) => {
    const puff = add(cloud, puffGeometry({ radius: 1, detail: 11, lumps: 0.24, frequency: 2.1, seed: ++puffSeed, flatten: 0.3 }), material, {
      p,
      r: [0, rng.range(0, Math.PI * 2), 0],
      s: [size, size * squash, size],
      name: 'puff',
    });
    puffs.push({ mesh: puff, base: puff.scale.clone(), phase: rng.range(0, Math.PI * 2), rate: rng.range(0.25, 0.45) });
  };
  for (const tier of tiers) {
    for (let i = 0; i < tier.n; i++) {
      const a = (i / tier.n) * Math.PI * 2 + rng.range(-0.14, 0.14);
      const r = rng.range(tier.r[0], tier.r[1]);
      const size = rng.range(tier.size[0], tier.size[1]);
      const center = new THREE.Vector3(Math.sin(a) * r, rng.range(tier.y[0], tier.y[1]), Math.cos(a) * r);
      addPuff(center.toArray(), size, rng.range(0.8, 0.92));
      const florets = rng.int(tier.florets[0], tier.florets[1]);
      for (let f = 0; f < florets; f++) {
        const dir = new THREE.Vector3(rng.range(-1, 1), rng.range(0.15, 0.8), rng.range(-1, 1)).normalize();
        const fs = size * rng.range(0.38, 0.6);
        addPuff(center.clone().addScaledVector(dir, size * 0.78).toArray(), fs, rng.range(0.85, 1.0));
      }
    }
  }

  // Clouds breathe very slowly.
  root.userData.update = (dt, t) => {
    for (const p of puffs) {
      const k = 1 + 0.012 * Math.sin(t * p.rate + p.phase);
      p.mesh.scale.set(p.base.x * k, p.base.y * (2 - k), p.base.z * k);
    }
  };
  root.userData.footprint = { r: ISLAND.bodyRadius };
  return root;
}
