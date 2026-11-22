import * as THREE from 'three';
import { group } from '../../kit/place.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { sphere } from '../../kit/geometry.js';
import { growTree, buildBranches, cumulusCrown, crownBumps, sphereCover, crownTwigs } from '../../kit/trees.js';
import { cherryFlowerGeometry, cherryPetalGeometry } from '../../kit/flora.js';

// N1 — Cherry blossom tree (Somei-Yoshino habit): a short, leaning trunk of banded cherry bark
// splitting into four spreading scaffold limbs under a broad umbrella crown. The crown is a cloud
// of clumps, each a heap of smooth pink bumps frosted with thousands of five-petal, notched cherry
// flowers (white rims, blushing eyes) that take the crown's own shading, so the mass reads soft.
// Twigs in bloom fringe its edge, everything sways from the trunk in the wind, and fallen petals
// drift thickest beneath the crown's rim.

const FLOWER_TOP = [new THREE.Color('#FFFFFF'), new THREE.Color('#FFF6F8'), new THREE.Color('#FFEFF4')];
const FLOWER_LOW = [new THREE.Color('#FDE3EB'), new THREE.Color('#FAD4E0'), new THREE.Color('#F8CAD8')];

// `canopy`: the crown's reach from the trunk; each tree is scaled to it, so seeds vary in shape
// and stature but always fill their place on the map.
export default function build(ctx, { seed = 811, canopy: reachTarget = 0.8 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'CherryBlossomTree';
  const tree = group(root, { name: 'tree' });
  const wind = { anchor: 0.3, range: 1.1, flutter: 0.2, space: 'object' };

  const skeleton = growTree(rng, { trunk: 0.32, trunkRadius: 0.064, lean: 0.12, forks: [4, 2, 2], spread: 1.02, length: 0.31, lengthDecay: 0.76, taper: 0.64, upward: 0.05, bend: 0.2, minRise: 0.12 });
  const bark = m.bark('#A9877F', wind, { shadowTint: '#EDE2EE' });
  buildBranches(tree, skeleton, { material: bark, rng });

  const crown = cumulusCrown(rng, skeleton, { size: 0.165, flat: 0.74 });
  // Smooth bumps whose skin is baked blossom, so gaps between the modelled flowers show more bloom.
  const canopy = m.crownSkin('#FBE4EB', { texture: 'blossomMass', wind, gap: '#EC9FB7', glow: '#FFE0EA', shadowTint: '#E6BFD3' });
  tree.add(instanced(sphere(1, 20, 14), canopy, crownBumps(crown.spheres), { name: 'crown' }));

  // Blossoms: paler on the sunny top of the crown, pinker toward its underside.
  const low = crown.centre.y - 0.1;
  const high = crown.top;
  const tint = (p) => {
    const t = THREE.MathUtils.smoothstep(p.y, low, high);
    const c = rng.pick(FLOWER_LOW).clone().lerp(rng.pick(FLOWER_TOP), t);
    return c.offsetHSL(rng.range(-0.008, 0.008), 0, rng.range(-0.02, 0.015));
  };
  const flowers = sphereCover(rng, crown.spheres, { density: 1300, scale: [0.019, 0.026], under: 0.4, reach: 0.08, sink: 1.004, tilt: 0.2, color: tint });

  // Twigs in bloom at the rim: flowers on short spurs along each shoot's outer half, and a cluster
  // of three or four at its end.
  const shoots = crownTwigs(tree, rng, crown, { material: bark, count: 2 });
  const up = new THREE.Vector3(0, 1, 0);
  for (const shoot of shoots) {
    const curve = new THREE.CatmullRomCurve3(shoot.points);
    const spots = [0.5, 0.62, 0.74, 0.86, 0.97, 1, 1];
    for (const t of spots) {
      const p = curve.getPointAt(Math.min(1, t + rng.range(-0.03, 0.03)));
      const n = shoot.dir.clone().add(new THREE.Vector3(rng.range(-0.9, 0.9), rng.range(-0.3, 1.0), rng.range(-0.9, 0.9))).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, n).multiply(new THREE.Quaternion().setFromAxisAngle(up, rng.range(0, Math.PI * 2)));
      const lift = t > 0.95 ? 0.016 : 0.009;
      flowers.push({ p: [p.x + n.x * lift, p.y + n.y * lift, p.z + n.z * lift], r: q, s: rng.range(0.019, 0.025), color: tint(p) });
    }
  }
  const blossom = m.blossom(wind, { transfer: true, vertexColors: true, outlineId: canopy.userData.cel.celOutlineId.value });
  tree.add(instanced(cherryFlowerGeometry({ radius: 1 }), blossom, flowers, { cast: false, name: 'blossoms' }));

  // Fallen petals: thickest under the crown's rim, thinning inward and out, lying almost flat.
  const petals = [];
  const rim = crown.radius * 0.85;
  for (let i = 0; i < 520; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.max(0.08, rim + (rng() + rng() + rng() - 1.5) * crown.radius * 0.55);
    petals.push({
      p: [crown.centre.x + Math.sin(a) * d, rng.range(0.002, 0.006), crown.centre.z + Math.cos(a) * d],
      r: [rng.range(-0.12, 0.12), rng.range(0, Math.PI * 2), rng.range(-0.12, 0.12), 'YXZ'],
      s: rng.range(0.016, 0.022),
      color: rng.pick(['#FFFFFF', '#FFF2F6', '#FDE1EA', '#FAD0DD']),
    });
  }
  tree.add(instanced(cherryPetalGeometry({ length: 1 }), m.blossom(null, { vertexColors: true }), petals, { cast: false, name: 'fallenPetals' }));

  let reach = 0;
  for (const b of crown.spheres) reach = Math.max(reach, Math.hypot(b.c.x, b.c.z) + b.r);
  const scale = reachTarget / reach;
  tree.scale.setScalar(scale);
  root.userData.footprint = { r: 0.2 * scale };
  root.userData.canopy = reachTarget;
  root.userData.stats = { spheres: crown.spheres.length, clumps: crown.clumps.length, flowers: flowers.length, scale: +scale.toFixed(3), top: +(crown.top * scale).toFixed(3) };
  return root;
}
