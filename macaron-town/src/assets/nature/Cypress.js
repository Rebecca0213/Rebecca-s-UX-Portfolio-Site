import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { sphere, taperTube } from '../../kit/geometry.js';
import { crownBumps, sphereCover } from '../../kit/trees.js';
import { leafGeometry } from '../../kit/flora.js';

// N4 — Cypress: an Italian cypress (Cupressus sempervirens 'Stricta'), the dark exclamation mark
// of a formal garden. A short flared trunk vanishes into a flame-shaped column, fullest a third of
// the way up and drawn to a fine point, built of rings of tall oval tufts round a solid core so its
// sides ripple like brushwork. The skin is baked upswept spray, and thousands of feathery sprays
// stand out of it, all sweeping upward along the surface, taking its shading; the whole column
// sways from its foot in the wind.

const GREENS = ['#78A98E', '#6FA287', '#82B395', '#6A9C83', '#8DBA9C'];

// Column radius at height fraction t: full near the ground, fullest at a third, then a long taper.
const flame = (t) => (t < 0.3 ? 0.66 + 0.34 * Math.sin((t / 0.3) * Math.PI * 0.5) : Math.cos(((t - 0.3) / 0.7) * Math.PI * 0.5) ** 0.85);

export default function build(ctx, { seed = 41, height = null, girth = null } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Cypress';
  const H = height ?? rng.range(1.55, 1.8);
  const R = girth ?? rng.range(0.22, 0.25);
  const base = 0.07;
  const wind = { anchor: 0.1, range: H, flutter: 0.15, space: 'object' };
  const tree = group(root, { name: 'tree' });

  // Trunk: a short flared foot, rising hidden inside the column as its leader.
  const bark = m.bark('#8E7867', wind, { shadowTint: '#DCD2DE' });
  add(tree, taperTube([[0, 0, 0], [0.004, 0.25, 0], [0, H * 0.6, 0.004]], (t) => 0.034 * (1 - 0.7 * t) + 0.03 * Math.max(0, 1 - t / 0.12) ** 2.2, { tubular: 40, radial: 16 }), bark, { name: 'trunk' });

  // Tufts: rings of tall ovals round a core, each ring turned by the golden angle.
  const bumps = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  let ring = 0;
  for (let y = base + 0.1; y < H - 0.06; y += 0.085) {
    const t = (y - base) / (H - base);
    const r = R * flame(t);
    const tuft = Math.max(0.035, r * 0.58);
    bumps.push({ c: new THREE.Vector3(rng.range(-0.01, 0.01), y, rng.range(-0.01, 0.01)), r: r * 0.8, sy: 1.25, clump: ring });
    const n = Math.max(3, Math.round((Math.PI * 2 * r * 0.62) / (tuft * 1.05)));
    for (let k = 0; k < n; k++) {
      const a = ring * golden + (k / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const rr = r * rng.range(0.56, 0.7);
      bumps.push({ c: new THREE.Vector3(Math.cos(a) * rr, y + rng.range(-0.025, 0.025), Math.sin(a) * rr), r: tuft * rng.range(0.85, 1.2), sy: rng.range(1.4, 2.0), clump: ring });
    }
    ring++;
  }
  // The point: a slim spire of narrowing tufts.
  for (let i = 0; i < 3; i++) bumps.push({ c: new THREE.Vector3(0, H - 0.07 + i * 0.045, 0), r: 0.03 - i * 0.008, sy: 2.2, clump: ring + i });

  const skin = m.crownSkin('#86B496', { texture: 'cypressMass', wind, gap: '#2F5E4F', glow: '#DDF3C2', shadowTint: '#A9C7C0', scale: 5 });
  tree.add(instanced(sphere(1, 18, 14), skin, crownBumps(bumps), { name: 'column' }));

  const sprays = sphereCover(rng, bumps, {
    density: 2600,
    scale: [0.022, 0.03],
    under: 0.5,
    reach: 0.05,
    sink: 1.003,
    tilt: 0.5,
    alignUp: 0.45,
    color: () => new THREE.Color(rng.pick(GREENS)).offsetHSL(rng.range(-0.01, 0.01), rng.range(-0.04, 0.04), rng.range(-0.05, 0.04)),
  });
  const sprayMat = m.crownLeaves(wind, { outlineId: skin.userData.cel.celOutlineId.value, texture: 'leaf', vertexColors: false, shadowTint: '#A9C7C0', glow: '#DDF3C2', spec: { shininess: 30, strength: 0.06, threshold: 0.64, softness: 0.06 } });
  tree.add(instanced(leafGeometry({ length: 1, width: 0.3, fold: 0.1, arch: 0.1, segU: 3, segV: 6, transfer: true }), sprayMat, sprays, { cast: false, name: 'sprays' }));

  root.userData.footprint = { r: 0.3 };
  root.userData.canopy = R * 1.2;
  root.userData.stats = { height: +H.toFixed(2), tufts: bumps.length, sprays: sprays.length };
  return root;
}
