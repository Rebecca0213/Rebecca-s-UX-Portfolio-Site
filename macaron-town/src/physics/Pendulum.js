import { GRAVITY } from './World.js';

// Planar damped pendulum whose pivot may accelerate (ferris gondolas, hanging signs, lanterns).
// theta is measured from straight down, positive toward +x of the swing plane.
export class Pendulum {
  constructor({ length = 0.3, damping = 0.35, theta = 0, omega = 0 } = {}) {
    this.length = length;
    this.damping = damping;
    this.theta = theta;
    this.omega = omega;
    this.pivotAccel = { x: 0, y: 0 };
    this.external = 0;
  }

  // ax, ay: pivot acceleration in the swing plane; external: extra angular acceleration (e.g. wind torque).
  step(dt) {
    const { x: ax, y: ay } = this.pivotAccel;
    const alpha =
      -((GRAVITY + ay) / this.length) * Math.sin(this.theta) -
      (ax / this.length) * Math.cos(this.theta) -
      this.damping * this.omega +
      this.external;
    this.omega += alpha * dt;
    this.theta += this.omega * dt;
  }
}
