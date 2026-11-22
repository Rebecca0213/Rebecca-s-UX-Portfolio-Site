import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, lathe, spline, roundedBox } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { VerletRope } from '../../physics/VerletRope.js';
import { GRAVITY } from '../../physics/World.js';

// S7 — Balloon bunch: seven glossy latex balloons tethered to a candy-striped weight tied with a
// bow. Every string is a buoyant Verlet rope pinned at the weight, so the bunch floats up into a
// loose fan, sways and bobs in the gusts, and the balloons jostle instead of passing through each
// other; each balloon rides the end of its string, its knot pointing down the line.

const COLORS = ['#F6B9C9', '#A9DCC8', '#FFE19A', '#D8CCF3', '#F9C9B6', '#BFDDF2', '#FFFFFF'];
const BALLOON_R = 0.07;
const TIE_Y = 0.13;

// Latex balloon: a teardrop lathe (knot end at y = 0, crown up), with the tied neck and lip.
function balloonGeometry() {
  return lathe(spline([[0, 0], [0.006, 0.004], [0.012, 0.018], [0.04, 0.045], [0.066, 0.09], [0.072, 0.13], [0.062, 0.17], [0.036, 0.195], [0, 0.202]], 64), 48);
}

export default function build(ctx, { seed = 777, count = 7 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'BalloonBunch';

  /* ---------- the weight ---------- */
  const weight = group(root, { name: 'weight' });
  add(weight, cylinder(0.05, 0.055, 0.08, 48, 1), m.paintedWood('#FFF7EE'), { p: [0, 0.04, 0], name: 'drum' });
  for (let k = 0; k < 3; k++) add(weight, torus(0.052, 0.008, 8, 48), m.paintedWood('#F28CA6'), { p: [0, 0.016 + k * 0.024, 0], r: [Math.PI / 2, 0, 0], name: 'stripe' });
  add(weight, cylinder(0.054, 0.054, 0.012, 48, 1), m.paintedWood('#F6B9C9'), { p: [0, 0.086, 0], name: 'lid' });
  for (const sx of [-1, 1]) add(weight, sphere(1, 20, 14), m.fabric('#F28CA6'), { p: [sx * 0.022, 0.104, 0], r: [0, 0, sx * 0.5], s: [0.026, 0.012, 0.014], name: 'bowLoop' });
  add(weight, sphere(0.01, 12, 10), m.fabric('#F28CA6'), { p: [0, 0.104, 0], name: 'bowKnot' });
  add(weight, cylinder(0.006, 0.01, TIE_Y - 0.092, 12, 1), m.fabric('#FFFFFF'), { p: [0, 0.092 + (TIE_Y - 0.092) / 2, 0], name: 'tieCords' });

  /* ---------- strings and balloons ---------- */
  const anchor = new THREE.Vector3(0, TIE_Y, 0);
  const ropes = [];
  const balloons = [];
  const strings = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const len = rng.range(0.55, 0.85);
    const tilt = i === 0 ? 0.05 : rng.range(0.25, 0.42);
    const tip = new THREE.Vector3(Math.sin(a) * Math.sin(tilt) * len, TIE_Y + Math.cos(tilt) * len, Math.cos(a) * Math.sin(tilt) * len);
    const rope = new VerletRope(anchor, tip, { segments: 10, slack: 1.0, damping: 0.97, iterations: 12, windScale: 0.5, buoyancy: GRAVITY + rng.range(0.9, 1.3), pinEnd: false });
    ctx.physics.add(rope);
    ropes.push(rope);
    const mesh = new THREE.InstancedMesh(cylinder(1, 1, 1, 5, 1), m.fabric('#FFFFFF'), rope.segments);
    mesh.name = 'string';
    mesh.frustumCulled = false;
    root.add(mesh);
    strings.push(mesh);
    const b = group(root, { name: 'balloon' });
    const color = COLORS[i % COLORS.length];
    add(b, balloonGeometry(), m.candy(color), { name: 'latex' });
    add(b, torus(0.007, 0.003, 8, 16), m.candy(color), { p: [0, 0.001, 0], r: [Math.PI / 2, 0, 0], name: 'lip' });
    balloons.push(b);
  }

  // Balloons jostle: push apart any two whose bodies overlap (and keep them off the weight).
  const minGap = BALLOON_R * 2;
  const _d = new THREE.Vector3();
  ctx.physics.add({
    step() {
      for (let i = 0; i < ropes.length; i++) {
        const pi = ropes[i].points[ropes[i].segments];
        for (let j = i + 1; j < ropes.length; j++) {
          const pj = ropes[j].points[ropes[j].segments];
          _d.subVectors(pj, pi);
          const dist = _d.length();
          if (dist >= minGap || dist < 1e-6) continue;
          _d.multiplyScalar((minGap - dist) / dist / 2);
          pi.sub(_d);
          pj.add(_d);
        }
      }
    },
  });

  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  root.userData.update = () => {
    ropes.forEach((rope, r) => {
      for (let i = 0; i < rope.segments; i++) {
        _a.copy(rope.points[i]);
        _b.copy(rope.points[i + 1]);
        _t.subVectors(_b, _a);
        const len = _t.length() || 1e-4;
        _q.setFromUnitVectors(up, _t.divideScalar(len));
        _m.compose(_a.add(_b).multiplyScalar(0.5), _q, _s.set(0.0012, len, 0.0012));
        strings[r].setMatrixAt(i, _m);
      }
      strings[r].instanceMatrix.needsUpdate = true;
      const end = rope.points[rope.segments];
      _t.subVectors(end, rope.points[rope.segments - 1]).normalize();
      balloons[r].position.copy(end);
      balloons[r].quaternion.setFromUnitVectors(up, _t);
    });
  };
  for (let k = 0; k < 360; k++) for (const body of ctx.physics.bodies) if (ropes.includes(body)) body.step(1 / 120, ctx.physics);
  root.userData.update();
  root.userData.footprint = { r: 0.35 };
  return root;
}
