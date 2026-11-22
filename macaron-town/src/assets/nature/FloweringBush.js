import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { sphere, taperTube } from '../../kit/geometry.js';
import { crownBumps, sphereCover } from '../../kit/trees.js';
import { leafGeometry, cherryFlowerGeometry } from '../../kit/flora.js';

// N5 — Flowering bush: a mophead hydrangea, the French garden's summer cloud. A low mound of leafy
// bumps on a few woody stems, shingled with broad, glossy, serrate-looking leaves, carries a dozen
// or more domed flower heads, each a ball of four-sepal florets with tiny true flowers at their
// eyes. One bush leans to one colour (the soil decides: pink, lavender or periwinkle) but its heads
// drift through the neighbouring tints. Heads and leaves take their own mass's shading and sway.

const PALETTES = {
  pink: ['#F7B8CD', '#F4A8C2', '#FAC9D9', '#F2B3CF', '#E9B6DD'],
  lavender: ['#D5C3F1', '#C9B5EC', '#DECFF6', '#E3C2E8', '#C2BDF0'],
  periwinkle: ['#BCCBF3', '#ACBEF0', '#C9D5F7', '#C4C0F0', '#B2CDEE'],
};
const KINDS = Object.keys(PALETTES);
const LEAF_GREENS = ['#86B97C', '#7CB274', '#90C285', '#76AA70', '#9AC88C'];

export default function build(ctx, { seed = 51, colour = null } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const kind = colour ?? KINDS[seed % KINDS.length];
  const palette = PALETTES[kind];
  const root = new THREE.Group();
  root.name = 'FloweringBush';
  const bush = group(root, { name: 'bush' });
  const wind = { anchor: 0.04, range: 0.5, flutter: 0.3, space: 'object' };

  // Woody stems fanning up from the crown of the roots into the mound.
  const stem = m.bark('#8C7A66', wind, { shadowTint: '#DCD2DE' });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const out = rng.range(0.06, 0.12);
    add(bush, taperTube([[Math.cos(a) * 0.015, 0, Math.sin(a) * 0.015], [Math.cos(a) * out * 0.5, 0.07, Math.sin(a) * out * 0.5], [Math.cos(a) * out, 0.15, Math.sin(a) * out]], [0.011, 0.006], { tubular: 16, radial: 8 }), stem, { name: 'stem' });
  }

  // The leafy mound: a broad core with bumps banked round and over it.
  const bumps = [{ c: new THREE.Vector3(0, 0.17, 0), r: 0.2, sy: 0.78 }];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const count = 15;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const elevation = 0.05 + t * 1.15;
    const a = i * golden + rng.range(-0.25, 0.25);
    const d = rng.range(0.17, 0.21);
    bumps.push({
      c: new THREE.Vector3(Math.cos(a) * Math.cos(elevation) * d, 0.13 + Math.sin(elevation) * d * 0.85, Math.sin(a) * Math.cos(elevation) * d),
      r: rng.range(0.085, 0.115),
      sy: rng.range(0.8, 0.95),
    });
  }
  const leafSkin = m.crownSkin('#9CCB8E', { texture: 'boxwoodMass', wind, gap: '#3E7650', glow: '#E8F7B0', shadowTint: '#B8D4C4', scale: 3.2 });
  bush.add(instanced(sphere(1, 20, 14), leafSkin, crownBumps(bumps), { name: 'mound' }));
  const leaves = sphereCover(rng, bumps, {
    density: 1500,
    scale: [0.032, 0.046],
    under: 0.35,
    reach: 0.05,
    sink: 1.004,
    tilt: 0.55,
    color: () => new THREE.Color(rng.pick(LEAF_GREENS)).offsetHSL(rng.range(-0.01, 0.01), rng.range(-0.04, 0.04), rng.range(-0.05, 0.04)),
  });
  const leafMat = m.crownLeaves(wind, { outlineId: leafSkin.userData.cel.celOutlineId.value, texture: 'leaf', vertexColors: false, shadowTint: '#B8D4C4', glow: '#E8F7B0', spec: { shininess: 60, strength: 0.22, threshold: 0.6, softness: 0.05 } });
  bush.add(instanced(leafGeometry({ length: 1, width: 0.62, fold: 0.14, arch: 0.1, segU: 4, segV: 7, transfer: true }), leafMat, leaves, { cast: false, name: 'leaves' }));

  // Flower heads: domes standing out of the mound's upper and outer skin, each tinted its own way.
  const heads = [];
  const headTint = [];
  const centre = new THREE.Vector3(0, 0.15, 0);
  const n = new THREE.Vector3();
  let tries = 0;
  while (heads.length < 16 && tries++ < 400) {
    n.set(rng.range(-1, 1), rng.range(-0.15, 1), rng.range(-1, 1));
    if (n.lengthSq() > 1 || n.lengthSq() < 0.05) continue;
    n.normalize();
    const r = rng.range(0.05, 0.072);
    const c = centre.clone().add(new THREE.Vector3(n.x * 0.27, n.y * 0.22, n.z * 0.27)).addScaledVector(n, r * 0.15);
    if (heads.some((h) => h.c.distanceTo(c) < (h.r + r) * 0.95)) continue;
    heads.push({ c, r, sy: 0.82 });
    headTint.push(rng.pick(palette));
  }
  const headSkin = m.crownSkin('#FFFFFF', { texture: 'hydrangeaMass', wind, gap: '#B9A3D8', glow: '#FFF0FA', shadowTint: '#DCCFEA', scale: 9 });
  const headMesh = instanced(sphere(1, 22, 16), headSkin, crownBumps(heads).map((h, i) => ({ ...h, color: headTint[i] })), { name: 'flowerHeads' });
  bush.add(headMesh);
  const florets = [];
  heads.forEach((h, i) => {
    const base = new THREE.Color(headTint[i]);
    florets.push(...sphereCover(rng, [h], { density: 3800, scale: [0.012, 0.016], under: 0.5, reach: 0.02, sink: 1.006, tilt: 0.4, color: () => base.clone().offsetHSL(rng.range(-0.015, 0.015), rng.range(-0.05, 0.05), rng.range(-0.04, 0.04)) }));
  });
  const floretMat = m.blossom(wind, { transfer: true, vertexColors: true, outlineId: headSkin.userData.cel.celOutlineId.value });
  bush.add(instanced(cherryFlowerGeometry({ radius: 1, petals: 4, notch: 0.0, cup: 0.12, eye: '#CDBFEA', steps: 6 }), floretMat, florets, { cast: false, name: 'florets' }));

  root.userData.footprint = { r: 0.38 };
  root.userData.stats = { colour: kind, leaves: leaves.length, heads: heads.length, florets: florets.length };
  return root;
}
