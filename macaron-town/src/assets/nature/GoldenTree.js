import * as THREE from 'three';
import { group } from '../../kit/place.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { sphere } from '../../kit/geometry.js';
import { growLeader, buildBranches, cumulusCrown, crownBumps, sphereCover, crownTwigs } from '../../kit/trees.js';
import { ginkgoLeafGeometry } from '../../kit/flora.js';

// N2 — Golden tree: a ginkgo in its autumn gold. A tall, nearly straight grey-brown trunk rises
// through upswept limbs into an upright oval crown of clumped bumps, each shingled with fan-shaped,
// cleft ginkgo leaves (veins fanning from the stalk) in butter, saffron and a little lime where
// the turn is late; the leaves light up where the sun shines through, the tree sways from its
// trunk, short spur shoots tufted with leaves fringe the crown, and a golden carpet of fallen fans
// lies thickest under the drip line.

const GOLD_TOP = [new THREE.Color('#FBE08A'), new THREE.Color('#F9D877'), new THREE.Color('#FFE9A3')];
const GOLD_LOW = [new THREE.Color('#F2C252'), new THREE.Color('#EDB548'), new THREE.Color('#F4CB60')];
const LATE = new THREE.Color('#D9DE86'); // a few leaves still turning

export default function build(ctx, { seed = 822, canopy: reachTarget = 0.72 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'GoldenTree';
  const tree = group(root, { name: 'tree' });
  const wind = { anchor: 0.35, range: 1.3, flutter: 0.3, space: 'object' };

  const skeleton = growLeader(rng, { height: 1.3, radius: 0.058, clear: 0.28, laterals: 12, length: 0.5, angle: 1.18, curl: 0.3, forks: 2, forkLength: 0.45, profile: (t) => 1 - 0.6 * t * t });
  const bark = m.bark('#A8968A', wind, { shadowTint: '#E6DDE6' });
  buildBranches(tree, skeleton, { material: bark, rng, flare: 0.7 });

  const crown = cumulusCrown(rng, skeleton, { size: 0.155, satellites: [4, 6], flat: 0.8, lift: 0.1, fillBelow: 0.7, fillGap: 1.3, along: { depth: 1, at: [0.5], chance: 0.9 } });
  const canopy = m.crownSkin('#FBE3A0', { texture: 'ginkgoMass', wind, gap: '#E4A646', glow: '#FFF1B8', shadowTint: '#EAD9C0' });
  tree.add(instanced(sphere(1, 20, 14), canopy, crownBumps(crown.spheres), { name: 'crown' }));

  // Leaves: paler butter on the sunny top, deeper saffron below, a few late lime ones anywhere.
  const low = crown.centre.y - 0.25;
  const high = crown.top;
  const tint = (p) => {
    if (rng.chance(0.06)) return LATE.clone().offsetHSL(rng.range(-0.01, 0.01), 0, rng.range(-0.03, 0.02));
    const t = THREE.MathUtils.smoothstep(p.y, low, high);
    return rng.pick(GOLD_LOW).clone().lerp(rng.pick(GOLD_TOP), t).offsetHSL(rng.range(-0.008, 0.008), 0, rng.range(-0.03, 0.02));
  };
  const leaves = sphereCover(rng, crown.spheres, { density: 1500, scale: [0.023, 0.031], under: 0.5, reach: 0.08, sink: 1.004, tilt: 0.45, color: tint });

  // Spur shoots at the rim, tufted with leaves along their outer half.
  const shoots = crownTwigs(tree, rng, crown, { material: bark, count: 2, reach: [0.3, 0.55], rim: 0.5 });
  const up = new THREE.Vector3(0, 1, 0);
  for (const shoot of shoots) {
    const curve = new THREE.CatmullRomCurve3(shoot.points);
    for (const t of [0.45, 0.58, 0.7, 0.82, 0.93, 1, 1, 1]) {
      const p = curve.getPointAt(Math.min(1, t + rng.range(-0.03, 0.03)));
      const n = shoot.dir.clone().add(new THREE.Vector3(rng.range(-1, 1), rng.range(-0.2, 1.1), rng.range(-1, 1))).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, n).multiply(new THREE.Quaternion().setFromAxisAngle(up, rng.range(0, Math.PI * 2)));
      leaves.push({ p: [p.x + n.x * 0.01, p.y + n.y * 0.01, p.z + n.z * 0.01], r: q, s: rng.range(0.026, 0.032), color: tint(p) });
    }
  }
  const leafMat = m.crownLeaves(wind, { outlineId: canopy.userData.cel.celOutlineId.value });
  tree.add(instanced(ginkgoLeafGeometry({ radius: 1 }), leafMat, leaves, { cast: false, name: 'leaves' }));

  // The golden carpet: fallen fans thickest under the crown's rim, lying almost flat.
  const fallen = [];
  const rim = crown.radius * 0.8;
  for (let i = 0; i < 620; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.max(0.07, rim + (rng() + rng() + rng() - 1.5) * crown.radius * 0.6);
    fallen.push({
      p: [crown.centre.x + Math.sin(a) * d, rng.range(0.002, 0.007), crown.centre.z + Math.cos(a) * d],
      r: [rng.range(-0.14, 0.14), rng.range(0, Math.PI * 2), rng.range(-0.14, 0.14), 'YXZ'],
      s: rng.range(0.024, 0.032),
      color: rng.chance(0.05) ? LATE : rng.pick([...GOLD_LOW, ...GOLD_TOP]),
    });
  }
  tree.add(instanced(ginkgoLeafGeometry({ radius: 1, transfer: false, cup: 0.06 }), m.blossom(null, { vertexColors: true }), fallen, { cast: false, name: 'fallenLeaves' }));

  let reach = 0;
  for (const b of crown.spheres) reach = Math.max(reach, Math.hypot(b.c.x, b.c.z) + b.r);
  const scale = reachTarget / reach;
  tree.scale.setScalar(scale);
  root.userData.footprint = { r: 0.2 * scale };
  root.userData.canopy = reachTarget;
  root.userData.stats = { spheres: crown.spheres.length, clumps: crown.clumps.length, leaves: leaves.length, scale: +scale.toFixed(3), top: +(crown.top * scale).toFixed(3) };
  return root;
}
