import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { sphere, lathe, extrude, roundedBox } from '../../kit/geometry.js';
import { roundRect } from '../../kit/shapes.js';
import { crownBumps, sphereCover } from '../../kit/trees.js';
import { leafGeometry, tulipGeometry, roseGeometry, cherryFlowerGeometry } from '../../kit/flora.js';

// N6 — Flower bed: a French corbeille edged with dressed granite kerbs, its dark soil mounded a little
// toward the middle and planted in bands: a frothy edging of sweet alyssum (low mounds of tiny white
// four-petal florets), a double ring of tulips (deep six-tepal cups on swaying stems, each with two
// strap leaves) in one bed's pair of colours, and at the heart shrub roses, mounds of glossy leaves
// starred with open blooms. `shape` 'round' (radius) or 'long' (width x length, round-ended, along z).

const TULIPS = [
  ['#F6A9C1', '#FFF6F2'],
  ['#F9C3A0', '#FFF1DC'],
  ['#D7BDF0', '#FFF8FB'],
  ['#F7D879', '#FFF8E8'],
];
const ROSES = ['#F7B3C6', '#FCE1E8', '#F49AB2', '#FFFFFF'];
const ROSE_LEAVES = ['#7DAE74', '#74A66E', '#86B77C', '#6E9F69'];
const TULIP_GREENS = ['#9CC48F', '#93BE88', '#A6CC97'];

// Signed distance to the bed's outline (negative inside), and the outline's centre line for a long bed.
function outline(shape, { radius, width, length }) {
  if (shape === 'round') return { sd: (x, z) => Math.hypot(x, z) - radius, half: radius };
  const straight = Math.max(0, length / 2 - width / 2);
  return { sd: (x, z) => Math.hypot(x, Math.max(Math.abs(z) - straight, 0)) - width / 2, half: width / 2, straight };
}

// Points round the outline, `inset` inside it, every `spacing`.
function ring(shape, dims, inset, spacing) {
  const out = [];
  if (shape === 'round') {
    const r = dims.radius - inset;
    const n = Math.max(6, Math.round((Math.PI * 2 * r) / spacing));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([Math.sin(a) * r, Math.cos(a) * r]);
    }
    return out;
  }
  const r = dims.width / 2 - inset;
  const straight = Math.max(0, dims.length / 2 - dims.width / 2);
  const sides = Math.max(1, Math.round((straight * 2) / spacing));
  for (const sx of [-1, 1]) for (let i = 0; i <= sides; i++) out.push([sx * r, -straight + (i / sides) * straight * 2]);
  const arc = Math.max(2, Math.round((Math.PI * r) / spacing));
  for (const sz of [-1, 1]) for (let i = 1; i < arc; i++) {
    const a = (i / arc) * Math.PI;
    out.push([Math.cos(a) * r, sz * (straight + Math.sin(a) * r)]);
  }
  return out;
}

function kerb(parent, m, shape, dims) {
  const g = group(parent, { name: 'kerb' });
  const granite = m.granite('#E9E2E8');
  const w = 0.034;
  const h = 0.045;
  const profile = (r) => [[r - w / 2, -0.01], [r + w / 2 - 0.004, -0.01], [r + w / 2, h - 0.006], [r + w / 2 - 0.006, h], [r - w / 2 + 0.006, h], [r - w / 2, h - 0.006]];
  const arcStones = (r, a0, a1, cx = 0, cz = 0) => {
    const n = Math.max(2, Math.round(((a1 - a0) * r) / 0.11));
    const step = (a1 - a0) / n;
    for (let i = 0; i < n; i++) {
      add(g, lathe(profile(r), 10, a0 + i * step + 0.006, step - 0.012), granite, { p: [cx, 0, cz], name: 'kerbStone' });
    }
  };
  if (shape === 'round') arcStones(dims.radius, 0, Math.PI * 2);
  else {
    const r = dims.width / 2;
    const straight = Math.max(0, dims.length / 2 - dims.width / 2);
    // THREE's lathe sweeps from +z toward +x, so the far end (+z) spans [-pi/2, pi/2] about its centre.
    arcStones(r, -Math.PI / 2, Math.PI / 2, 0, straight);
    arcStones(r, Math.PI / 2, (Math.PI * 3) / 2, 0, -straight);
    const n = Math.max(1, Math.round((straight * 2) / 0.12));
    const len = (straight * 2) / n;
    for (const sx of [-1, 1]) for (let i = 0; i < n; i++) {
      add(g, roundedBox(w, h + 0.01, len - 0.012, 0.005, 3), granite, { p: [sx * r, (h - 0.01) / 2, -straight + (i + 0.5) * len], name: 'kerbStone' });
    }
  }
}

function soil(parent, m, shape, dims) {
  const earth = m.stone('#7A6253');
  if (shape === 'round') {
    const r = dims.radius - 0.012;
    add(parent, lathe([[0, -0.01], [r, -0.01], [r, 0.008], [r * 0.85, 0.017], [r * 0.5, 0.027], [0, 0.032]], 72), earth, { name: 'soil' });
    return;
  }
  const w = dims.width - 0.024;
  const d = dims.length - 0.024;
  const g = extrude(roundRect(w, d, w / 2 - 0.001, 0, -d / 2), 0.03, { bevel: 0.008, bevelSegments: 4, curveSegments: 32 });
  g.rotateX(-Math.PI / 2);
  add(parent, g, earth, { p: [0, 0.004, 0], name: 'soil' });
}

// A shrub rose: a mound of leafy bumps starred with open roses.
function roseShrub(m, rng, centre, size, { leaves, roses, bumps }) {
  const core = { c: new THREE.Vector3(centre[0], 0.03 + size * 0.75, centre[1]), r: size, sy: 0.85 };
  const own = [core];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const e = rng.range(0.1, 0.9);
    own.push({ c: core.c.clone().add(new THREE.Vector3(Math.cos(a) * Math.cos(e) * size * 0.75, Math.sin(e) * size * 0.55, Math.sin(a) * Math.cos(e) * size * 0.75)), r: size * rng.range(0.5, 0.66), sy: 0.88 });
  }
  bumps.push(...own);
  leaves.push(...sphereCover(rng, own, { density: 9000, scale: [0.011, 0.015], under: 0.3, reach: 0.02, sink: 1.004, tilt: 0.55, color: () => new THREE.Color(rng.pick(ROSE_LEAVES)).offsetHSL(0, rng.range(-0.04, 0.04), rng.range(-0.05, 0.04)) }));
  // Roses open on the exposed skin only (the same burial and crevice tests as the leaves), mostly
  // on the upper and outer faces, turned a little toward the sky.
  const spots = sphereCover(rng, own, { density: 420, scale: [0.019, 0.025], under: 0.1, reach: 0.03, sink: 1.01, tilt: 0.3 });
  const up = new THREE.Vector3(0, 1, 0);
  const shuffled = spots.map((spot) => [rng(), spot]).sort((a, b) => a[0] - b[0]).map(([, spot]) => spot);
  for (const spot of shuffled.slice(0, 22)) {
    const n = up.clone().applyQuaternion(spot.r).lerp(up, 0.3).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, n).multiply(new THREE.Quaternion().setFromAxisAngle(up, rng.range(0, Math.PI * 2)));
    roses.push({ p: spot.p, r: q, s: spot.s, color: new THREE.Color(rng.pick(ROSES)).offsetHSL(0, rng.range(-0.04, 0.04), rng.range(-0.03, 0.02)) });
  }
}

export default function build(ctx, { seed = 61, shape = 'round', radius = 0.42, width = 0.4, length = 1.3 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'FlowerBed';
  const dims = { radius, width, length };
  const { sd } = outline(shape, dims);
  const ground = (x, z) => 0.008 + Math.min(1, -sd(x, z) / 0.2) * 0.022; // the soil's mound

  kerb(root, m, shape, dims);
  soil(root, m, shape, dims);

  // Sweet alyssum: a frothy edging of low white mounds just inside the kerb.
  // Overlapping, low mounds merge into one soft band; florets cover it so it reads as bloom, not pebbles.
  const mounds = ring(shape, dims, 0.05, 0.03).map(([x, z]) => ({ c: new THREE.Vector3(x + rng.range(-0.006, 0.006), ground(x, z), z + rng.range(-0.006, 0.006)), r: rng.range(0.03, 0.037), sy: 0.48 }));
  const froth = m.crownSkin('#FBFBF4', { texture: 'hydrangeaMass', gap: '#C9D9B8', glow: '#FFFFFF', shadowTint: '#E4E4EE', scale: 40 });
  root.add(instanced(sphere(1, 16, 10), froth, crownBumps(mounds), { name: 'alyssum' }));
  const florets = sphereCover(rng, mounds, { density: 7500, scale: [0.006, 0.0078], under: 0.15, reach: 0.008, sink: 1.012, tilt: 0.6, color: () => (rng.chance(0.12) ? '#F7E9F7' : '#FFFFFF') });
  root.add(instanced(cherryFlowerGeometry({ radius: 1, petals: 4, notch: 0, cup: 0.1, eye: '#F2E4B8', steps: 4 }), m.blossom(null, { transfer: true, vertexColors: true, outlineId: froth.userData.cel.celOutlineId.value }), florets, { cast: false, name: 'alyssumFlorets' }));

  // Tulips: a double ring (or rows) in the bed's pair of colours, alternating.
  const [tulipA, tulipB] = TULIPS[seed % TULIPS.length];
  const tulipWind = { anchor: 0, range: 0.16, flutter: 0.4, space: 'object' };
  const heads = [];
  const stems = [];
  const blades = [];
  const spots = [...ring(shape, dims, 0.12, 0.06), ...ring(shape, dims, 0.18, 0.065)];
  spots.forEach(([x, z], i) => {
    const jx = x + rng.range(-0.01, 0.01);
    const jz = z + rng.range(-0.01, 0.01);
    const y = ground(jx, jz);
    const tall = rng.range(0.1, 0.135);
    const lean = [rng.range(-0.08, 0.08), 0, rng.range(-0.08, 0.08)];
    const top = new THREE.Vector3(0, tall, 0).applyEuler(new THREE.Euler(...lean));
    stems.push({ p: [jx, y, jz], r: lean, s: [0.0021, tall, 0.0021], color: '#8FB980' });
    heads.push({ p: [jx + top.x, y + top.y, jz + top.z], r: [lean[0], rng.range(0, Math.PI * 2), lean[2]], s: rng.range(0.019, 0.023), color: new THREE.Color(i % 2 ? tulipA : tulipB).offsetHSL(rng.range(-0.01, 0.01), rng.range(-0.03, 0.03), rng.range(-0.03, 0.02)) });
    for (let k = 0; k < 2; k++) {
      const a = rng.range(0, Math.PI * 2);
      blades.push({ p: [jx, y + 0.004, jz], r: [-rng.range(0.9, 1.25), a, 0, 'YXZ'], s: rng.range(0.06, 0.08), color: rng.pick(TULIP_GREENS) });
    }
  });
  const tulipMat = m.petal('#FFFFFF', '#FFFFFF', tulipWind);
  root.add(instanced(tulipGeometry({ radius: 1 }), tulipMat, heads, { name: 'tulips' }));
  root.add(instanced(new THREE.CylinderGeometry(1, 1, 1, 8, 4, true).translate(0, 0.5, 0), m.leaf('#FFFFFF', tulipWind), stems, { name: 'tulipStems' }));
  root.add(instanced(leafGeometry({ length: 1, width: 0.24, fold: 0.3, arch: 0.25, segU: 4, segV: 10 }), m.leaf('#FFFFFF', tulipWind), blades, { cast: false, name: 'tulipLeaves' }));

  // Shrub roses at the heart (one in a round bed, a row of them down a long one).
  const leaves = [];
  const roses = [];
  const bumps = [];
  if (shape === 'round') roseShrub(m, rng, [0, 0], 0.085, { leaves, roses, bumps });
  else {
    const straight = Math.max(0, length / 2 - width / 2);
    for (const z of [-straight * 0.9, 0, straight * 0.9]) roseShrub(m, rng, [0, z], 0.07, { leaves, roses, bumps });
  }
  const roseSkin = m.crownSkin('#8CBB82', { texture: 'boxwoodMass', gap: '#3C6E4A', glow: '#E8F7B0', shadowTint: '#B8D4C4', scale: 5 });
  root.add(instanced(sphere(1, 18, 12), roseSkin, crownBumps(bumps), { name: 'roseShrub' }));
  root.add(instanced(leafGeometry({ length: 1, width: 0.6, fold: 0.12, arch: 0.1, segU: 4, segV: 6, transfer: true }), m.crownLeaves(null, { outlineId: roseSkin.userData.cel.celOutlineId.value, texture: 'leaf', vertexColors: false, shadowTint: '#B8D4C4', glow: '#E8F7B0', spec: { shininess: 60, strength: 0.22, threshold: 0.6, softness: 0.05 } }), leaves, { cast: false, name: 'roseLeaves' }));
  root.add(instanced(roseGeometry({ petals: 14, radius: 1 }), m.petal('#FFFFFF', '#FFFFFF'), roses, { name: 'roses' }));

  root.userData.footprint = shape === 'round' ? { r: radius } : { w: width, d: length };
  root.userData.clearGround = true; // no turf grows inside the kerb
  root.userData.stats = { shape, tulips: heads.length, alyssum: florets.length, roses: roses.length };
  return root;
}
