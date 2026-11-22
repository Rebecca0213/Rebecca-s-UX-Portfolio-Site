import * as THREE from 'three';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { cherryPetalGeometry } from '../../kit/flora.js';
import { PetalDrift } from '../../physics/Petals.js';

// N9 — Drifting petals: cherry petals loosed from the crowns on every gust. Each sheds from somewhere
// in a crown (`emitters`: spheres { c: [x, y, z], r } in this asset's frame, the town's cherry trees),
// chases the moving air through strong drag so it sinks slowly, flutters across its fall and tumbles
// over and over, then settles flat on the grass, lies a while and is gone, while the crowns shed more.

export default function build(ctx, { seed = 91, count = 260, emitters = [{ c: [0, 0.92, 0], r: 0.7 }], ground = 0, rate = 16 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'DriftingPetals';
  // Parked (unseen) in their crowns and on the ground beneath until shed, so bounds cover the shower.
  const items = Array.from({ length: count }, (_, i) => {
    const e = emitters[i % emitters.length];
    const low = i % 2 ? 1 : 0;
    return { p: [e.c[0] + rng.range(-e.r, e.r), low ? ground : e.c[1] + e.r * 0.6, e.c[2] + rng.range(-e.r, e.r)], s: 0.0001, color: rng.pick(['#FFFFFF', '#FFF2F6', '#FDE1EA', '#FAD0DD', '#FFE8EF']) };
  });
  const mesh = instanced(cherryPetalGeometry({ length: 1, cup: 0.22 }), m.blossom(null, { vertexColors: true }), items, { cast: false, name: 'petals' });
  mesh.frustumCulled = false;
  root.add(mesh);
  const drift = new PetalDrift(mesh, { emitters, ground, rate, rng });
  ctx.physics.add(drift);
  root.userData.update = () => drift.sync();
  root.userData.drift = drift;
  return root;
}
