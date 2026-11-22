import * as THREE from 'three';
import { Spring } from '../physics/Spring.js';

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _s = new THREE.Matrix4();

// Tap anything standing on the island and it wobbles like soft clay: a squash-and-stretch spring that
// keeps its volume, pivoting on the thing's own base. A tapped cherry tree also shakes loose a burst
// of petals. Targets are picked by their world bounding boxes (cheap, and the batched town has no
// per-part meshes in the scene to raycast).
export class TapPhysics {
  constructor(camera, element, { onTap } = {}) {
    this.camera = camera;
    this.element = element;
    this.targets = [];
    this.active = new Set();
    this.onTap = onTap;
    let down = null;
    element.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    element.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      down = null;
      if (moved < 7 && quick) this.tap(e.clientX, e.clientY);
    });
  }

  // `apply(matrix)` re-poses the target with a world-space transform about its base (identity to rest).
  add({ name, box, base, apply, onTap }) {
    this.targets.push({ name, box, base, apply, onTap, spring: new Spring({ stiffness: 240, damping: 6.5 }) });
  }

  tap(clientX, clientY) {
    const rect = this.element.getBoundingClientRect();
    _ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    let best = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (!_ray.ray.intersectBox(t.box, _hit)) continue;
      const d = _hit.distanceTo(_ray.ray.origin);
      // Prefer the smaller of overlapping boxes (a bench in front of a house) when hits are close.
      const size = t.box.getSize(new THREE.Vector3()).length();
      const score = d + size * 0.15;
      if (score < bestD) {
        bestD = score;
        best = t;
      }
    }
    if (!best) return null;
    best.spring.impulse(-3.0);
    this.active.add(best);
    best.onTap?.();
    this.onTap?.(best);
    return best;
  }

  update(dt) {
    const steps = Math.ceil(Math.min(dt, 0.05) / (1 / 120));
    for (const t of this.active) {
      for (let i = 0; i < steps; i++) t.spring.step(Math.min(dt, 0.05) / steps);
      const s = THREE.MathUtils.clamp(t.spring.x, -0.3, 0.3);
      if (t.spring.settled) {
        t.spring.x = 0;
        t.spring.v = 0;
        t.apply(null);
        this.active.delete(t);
        continue;
      }
      const sy = 1 + s;
      const sxz = 1 / Math.sqrt(sy);
      _m.makeTranslation(t.base.x, t.base.y, t.base.z).multiply(_s.makeScale(sxz, sy, sxz)).multiply(new THREE.Matrix4().makeTranslation(-t.base.x, -t.base.y, -t.base.z));
      t.apply(_m);
    }
  }
}
