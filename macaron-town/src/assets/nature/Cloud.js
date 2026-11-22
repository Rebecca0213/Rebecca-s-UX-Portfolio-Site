import * as THREE from 'three';
import { add } from '../../kit/place.js';
import { createRandom } from '../../kit/random.js';
import { puffGeometry } from '../../kit/clouds.js';

// N8 — Cloud: a fair-weather cumulus drifting in the sky round the island. A flat-bottomed heap built
// up in tiers: a long base row of broad, flattened puffs, a shorter row of rounder ones riding on it
// and a crown of one or two cauliflower towers, each puff sculpted uniquely from its seed. The puffs
// breathe very slowly, out of step with each other, and the whole cloud bobs on the air.

export default function build(ctx, { seed = 81, length = 3.2 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Cloud';
  const material = m.cloud();
  const puffs = [];
  const L = length;
  const addPuff = (x, y, z, size, squash, flatten) => {
    const mesh = add(root, puffGeometry({ radius: 1, detail: 10, lumps: 0.22, frequency: 2.0, seed: rng.int(1, 99999), flatten }), material, {
      p: [x, y, z],
      r: [0, rng.range(0, Math.PI * 2), 0],
      s: [size, size * squash, size],
      cast: false,
      name: 'puff',
    });
    puffs.push({ mesh, base: mesh.scale.clone(), phase: rng.range(0, Math.PI * 2), rate: rng.range(0.18, 0.34) });
  };

  // Base row: broad and flat underneath, along x.
  const base = rng.int(5, 6);
  for (let i = 0; i < base; i++) {
    const t = base === 1 ? 0 : i / (base - 1) - 0.5;
    const size = L * rng.range(0.15, 0.19) * (1 - 0.45 * Math.abs(t) * 2) + L * 0.05;
    addPuff(t * L * 0.82 + rng.range(-0.05, 0.05) * L, size * 0.25, rng.range(-0.08, 0.08) * L, size, rng.range(0.62, 0.72), 0.75);
  }
  // Middle row: rounder puffs riding on the base, offset toward the middle.
  const mid = rng.int(3, 4);
  for (let i = 0; i < mid; i++) {
    const t = mid === 1 ? 0 : i / (mid - 1) - 0.5;
    const size = L * rng.range(0.15, 0.2) * (1 - 0.35 * Math.abs(t) * 2);
    addPuff(t * L * 0.5 + rng.range(-0.04, 0.04) * L, L * rng.range(0.1, 0.14), rng.range(-0.06, 0.06) * L, size, rng.range(0.82, 0.92), 0.4);
  }
  // Crown: one or two towers.
  const crown = rng.int(1, 2);
  for (let i = 0; i < crown; i++) {
    const size = L * rng.range(0.12, 0.16);
    addPuff(rng.range(-0.16, 0.16) * L, L * rng.range(0.22, 0.27), rng.range(-0.04, 0.04) * L, size, rng.range(0.88, 0.98), 0.2);
  }

  const bobPhase = rng.range(0, Math.PI * 2);
  root.userData.update = (dt, t) => {
    for (const p of puffs) {
      const k = 1 + 0.015 * Math.sin(t * p.rate + p.phase);
      p.mesh.scale.set(p.base.x * k, p.base.y * (2 - k), p.base.z * k);
    }
    root.position.y = (root.userData.baseY ?? 0) + Math.sin(t * 0.21 + bobPhase) * L * 0.012;
  };
  root.userData.stats = { puffs: puffs.length };
  return root;
}
