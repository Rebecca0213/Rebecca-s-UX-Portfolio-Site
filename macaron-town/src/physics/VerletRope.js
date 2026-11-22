import * as THREE from 'three';
import { GRAVITY } from './World.js';

const _wind = new THREE.Vector3();
const _delta = new THREE.Vector3();

// Position-based rope: Verlet particles joined by distance constraints, pinned at chosen ends.
// Settles into a true catenary and responds to gusts (bunting lines, balloon strings).
export class VerletRope {
  constructor(start, end, { segments = 32, slack = 1.05, damping = 0.992, iterations = 30, windScale = 1, buoyancy = 0, pinEnd = true } = {}) {
    this.segments = segments;
    this.iterations = iterations;
    this.damping = damping;
    this.windScale = windScale;
    this.buoyancy = buoyancy;
    this.rest = (start.distanceTo(end) * slack) / segments;
    this.points = [];
    this.previous = [];
    this.pinned = new Map();
    for (let i = 0; i <= segments; i++) {
      const p = start.clone().lerp(end, i / segments);
      p.y -= Math.sin((i / segments) * Math.PI) * start.distanceTo(end) * 0.15;
      this.points.push(p);
      this.previous.push(p.clone());
    }
    this.pin(0, start);
    if (pinEnd) this.pin(segments, end);
  }

  pin(index, position) {
    this.pinned.set(index, position.clone());
    this.points[index].copy(position);
    this.previous[index].copy(position);
  }

  step(dt, world) {
    const g = (-GRAVITY + this.buoyancy) * dt * dt;
    for (let i = 0; i < this.points.length; i++) {
      if (this.pinned.has(i)) continue;
      const p = this.points[i];
      const prev = this.previous[i];
      world.wind.sample(p.x, p.y, p.z, world.time, _wind).multiplyScalar(this.windScale * dt * dt);
      _delta.subVectors(p, prev).multiplyScalar(this.damping);
      prev.copy(p);
      p.add(_delta).add(_wind);
      p.y += g;
    }
    for (let k = 0; k < this.iterations; k++) {
      for (let i = 0; i < this.segments; i++) {
        const a = this.points[i];
        const b = this.points[i + 1];
        _delta.subVectors(b, a);
        const dist = _delta.length() || 1e-6;
        const diff = (dist - this.rest) / dist;
        const aPinned = this.pinned.has(i);
        const bPinned = this.pinned.has(i + 1);
        if (aPinned && bPinned) continue;
        const wa = aPinned ? 0 : bPinned ? 1 : 0.5;
        const wb = bPinned ? 0 : aPinned ? 1 : 0.5;
        a.addScaledVector(_delta, diff * wa);
        b.addScaledVector(_delta, -diff * wb);
      }
      for (const [i, pos] of this.pinned) this.points[i].copy(pos);
    }
  }

  // Position and tangent along the rope at parameter u in [0, 1].
  sample(u, outPosition, outTangent) {
    const f = Math.min(Math.max(u, 0), 1) * this.segments;
    const i = Math.min(Math.floor(f), this.segments - 1);
    const t = f - i;
    outPosition.lerpVectors(this.points[i], this.points[i + 1], t);
    if (outTangent) outTangent.subVectors(this.points[i + 1], this.points[i]).normalize();
    return outPosition;
  }
}
