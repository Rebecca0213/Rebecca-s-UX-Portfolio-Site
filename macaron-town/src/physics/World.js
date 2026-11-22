import { SHARED } from '../render/shared.js';

// Scene units are 4 m, so Earth gravity is 9.81 / 4.
export const GRAVITY = 2.4525;

// Gusting wind shared by CPU physics (forces) and shaders (SHARED.wind sway).
export class WindField {
  constructor({ direction = [0.82, 0.57], base = 0.05 } = {}) {
    this.dir = { x: direction[0], z: direction[1] };
    this.base = base;
    this.strength = base;
  }

  update(t) {
    const gust = 0.6 + 0.25 * Math.sin(t * 0.31) + 0.15 * Math.sin(t * 1.13 + 1.7) + 0.1 * Math.sin(t * 2.71 + 0.4);
    this.strength = this.base * gust;
    const w = SHARED.wind.value;
    w.set(this.dir.x, this.dir.z, this.strength);
  }

  // Force per unit mass at a point, with a little spatial turbulence.
  sample(x, y, z, t, out) {
    const turb = Math.sin(x * 1.7 + t * 2.3) * 0.35 + Math.sin(z * 2.1 - t * 1.9) * 0.25;
    const s = this.strength * 18 * (1 + turb);
    out.x = this.dir.x * s;
    out.y = Math.sin(t * 3.1 + x + z) * this.strength * 4;
    out.z = this.dir.z * s;
    return out;
  }
}

// Fixed-timestep integrator for every simulated object in the scene.
export class PhysicsWorld {
  constructor({ rate = 120 } = {}) {
    this.step = 1 / rate;
    this.accumulator = 0;
    this.time = 0;
    this.bodies = new Set();
    this.wind = new WindField();
  }

  add(body) {
    this.bodies.add(body);
    return body;
  }

  remove(body) {
    this.bodies.delete(body);
  }

  update(frameDelta) {
    this.accumulator += Math.min(frameDelta, 0.1);
    while (this.accumulator >= this.step) {
      this.time += this.step;
      this.wind.update(this.time);
      for (const body of this.bodies) body.step(this.step, this);
      this.accumulator -= this.step;
    }
  }
}
