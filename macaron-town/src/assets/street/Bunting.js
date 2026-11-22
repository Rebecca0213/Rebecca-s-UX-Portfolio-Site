import * as THREE from 'three';
import { add } from '../../kit/place.js';
import { cylinder, sphere } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';
import { VerletRope } from '../../physics/VerletRope.js';

// S5 — Bunting garland strung across a street between the eyes of two lamp posts. The cord is a
// Verlet rope (pinned at both lamps) that settles into a true catenary and swings in the gusts;
// a run of pastel pennants rides it, each hanging from the cord along its local tangent and blown
// out by the wind across the line. Built in the frame it is placed in: `a` and `b` are the two
// lamp positions [x, z], `height` the eye height.

const COLORS = ['#F6B9C9', '#A9DCC8', '#FFE19A', '#D8CCF3', '#FFFFFF', '#F9C9B6', '#BFDDF2'];

// Swallow-free pennant: a long triangle hanging from its top edge (top edge along +x, tip down -y),
// gently cupped so it catches light like cloth.
function pennantGeometry(width, length) {
  const g = new THREE.PlaneGeometry(width, length, 6, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const t = (length / 2 - y) / length; // 0 at the top edge, 1 at the tip
    p.setX(i, x * (1 - t));
    p.setY(i, -t * length);
    p.setZ(i, Math.sin(Math.PI * (x / width + 0.5)) * 0.004 * (1 - t));
  }
  g.computeVertexNormals();
  return g;
}

export default function build(ctx, { seed = 755, a = [-0.8, 0], b = [0.8, 0], height = 1.34, flags = 13 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Bunting';

  const start = new THREE.Vector3(a[0], height, a[1]);
  const end = new THREE.Vector3(b[0], height, b[1]);
  const span = start.distanceTo(end);
  const rope = new VerletRope(start, end, { segments: 28, slack: 1.035, damping: 0.985, iterations: 24, windScale: 0.35 });
  ctx.physics.add(rope);

  // Cord: one thin cylinder per rope segment, re-posed every frame.
  const cordMat = m.fabric('#FFF7EE');
  const cord = new THREE.InstancedMesh(cylinder(1, 1, 1, 6, 1), cordMat, rope.segments);
  cord.name = 'cord';
  cord.castShadow = true;
  cord.frustumCulled = false;
  root.add(cord);
  // Knots at the two eyes.
  for (const p of [start, end]) add(root, sphere(0.008, 12, 10), cordMat, { p: [p.x, p.y, p.z], name: 'knot' });

  // Pennants spaced evenly along the cord, alternating colours, each its own size and tint.
  const flagGeo = pennantGeometry(0.075, 0.11);
  const flagMesh = new THREE.InstancedMesh(flagGeo, m.fabric('#FFFFFF'), flags);
  flagMesh.name = 'pennants';
  flagMesh.castShadow = true;
  flagMesh.frustumCulled = false;
  const params = [];
  for (let i = 0; i < flags; i++) {
    const u = (i + 0.5) / flags;
    params.push({ u, scale: rng.range(0.92, 1.06), phase: rng.range(0, Math.PI * 2), blow: 0 });
    flagMesh.setColorAt(i, new THREE.Color(COLORS[i % COLORS.length]).offsetHSL(0, 0, rng.range(-0.03, 0.02)));
  }
  flagMesh.instanceColor.needsUpdate = true;
  root.add(flagMesh);

  const _p = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _x = new THREE.Vector3();
  const _y = new THREE.Vector3();
  const _z = new THREE.Vector3();
  const _w = { x: 0, y: 0, z: 0 };
  const up = new THREE.Vector3(0, 1, 0);
  const world = ctx.physics;
  // The rope lives in this asset's frame; the wind is sampled in world space via the root matrix.
  const local = new THREE.Matrix4();
  const windLocal = new THREE.Vector3();

  root.userData.update = (dt, time) => {
    for (let i = 0; i < rope.segments; i++) {
      _a.copy(rope.points[i]);
      _b.copy(rope.points[i + 1]);
      _t.subVectors(_b, _a);
      const len = _t.length();
      _q.setFromUnitVectors(up, _t.divideScalar(len || 1));
      _m.compose(_p.addVectors(_a, _b).multiplyScalar(0.5), _q, _s.set(0.0028, len, 0.0028));
      cord.setMatrixAt(i, _m);
    }
    cord.instanceMatrix.needsUpdate = true;

    root.updateWorldMatrix(true, false);
    local.copy(root.matrixWorld).invert();
    for (let i = 0; i < flags; i++) {
      const f = params[i];
      rope.sample(f.u, _p, _t);
      // Wind across the line blows the pennant out of its hanging plane (rotation about the cord).
      world.wind.sample(_p.x, _p.y, _p.z, world.time, _w);
      windLocal.set(_w.x, 0, _w.z).transformDirection(local).multiplyScalar(Math.hypot(_w.x, _w.z));
      _z.crossVectors(_t, up).normalize(); // horizontal normal to the hanging pennant
      const across = windLocal.dot(_z);
      const target = Math.atan(across * 0.9) + Math.sin(time * 5.3 + f.phase) * 0.12 * Math.min(1, Math.abs(across) + 0.3);
      f.blow += (target - f.blow) * Math.min(1, dt * 6);
      _x.copy(_t);
      _y.copy(up).applyAxisAngle(_x, f.blow);
      _z.crossVectors(_x, _y).normalize();
      _y.crossVectors(_z, _x).normalize();
      _m.makeBasis(_x, _y, _z);
      _q.setFromRotationMatrix(_m);
      _m.compose(_p, _q, _s.setScalar(f.scale));
      flagMesh.setMatrixAt(i, _m);
    }
    flagMesh.instanceMatrix.needsUpdate = true;
  };
  // Let the cord settle before the first frame so it never starts as a straight line.
  for (let k = 0; k < 240; k++) rope.step(1 / 120, world);
  root.userData.update(0, 0);
  root.userData.footprint = { w: 0.05, d: span };
  return root;
}
