// Damped harmonic oscillator, integrated semi-implicitly (stable at the world's fixed step).
export class Spring {
  constructor({ stiffness = 220, damping = 9, mass = 1, rest = 0 } = {}) {
    this.k = stiffness;
    this.c = damping;
    this.m = mass;
    this.rest = rest;
    this.x = rest;
    this.v = 0;
  }

  impulse(velocity) {
    this.v += velocity;
  }

  step(dt) {
    const a = (-this.k * (this.x - this.rest) - this.c * this.v) / this.m;
    this.v += a * dt;
    this.x += this.v * dt;
  }

  get settled() {
    return Math.abs(this.x - this.rest) < 1e-4 && Math.abs(this.v) < 1e-3;
  }
}

// Volume-preserving squash and stretch driven by a spring: tap an object and it wobbles like soft clay.
export class SquashBody {
  constructor(object, options) {
    this.object = object;
    this.base = object.scale.clone();
    this.spring = new Spring({ stiffness: 260, damping: 7.5, ...options });
  }

  poke(strength = 1) {
    this.spring.impulse(-3.2 * strength);
  }

  step(dt) {
    if (this.spring.settled) {
      if (!this.rested) this.object.scale.copy(this.base);
      this.rested = true;
      return;
    }
    this.rested = false;
    this.spring.step(dt);
    const s = Math.max(-0.45, Math.min(0.45, this.spring.x));
    const sy = 1 + s;
    const sxz = 1 / Math.sqrt(sy);
    this.object.scale.set(this.base.x * sxz, this.base.y * sy, this.base.z * sxz);
  }
}
