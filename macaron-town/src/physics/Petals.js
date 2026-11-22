import * as THREE from 'three';
import { GRAVITY } from './World.js';

const _dummy = new THREE.Object3D();
const _air = { x: 0, y: 0, z: 0 };
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();

// Loose petals on the wind, rendered as an InstancedMesh. Each is shed from an emitter (a crown, as
// a sphere), carried toward the moving air by strong drag (so it falls at a petal's slow terminal
// speed), fluttering side to side and tumbling as it goes; on reaching the ground it lies flat for a
// while, then is gone, and the crowns shed new ones at `rate` per second.
export class PetalDrift {
  constructor(mesh, { emitters, ground = 0, rate = 16, drag = 7.5, carry = 0.6, rng = Math.random, bounds = 30 } = {}) {
    this.mesh = mesh;
    this.capacity = mesh.count;
    this.emitters = emitters;
    this.ground = ground;
    this.rate = rate;
    this.drag = drag;
    this.carryAir = carry;
    this.rng = rng;
    this.bounds = bounds;
    const n = this.capacity;
    this.position = new Float32Array(n * 3);
    this.velocity = new Float32Array(n * 3);
    this.quaternion = Array.from({ length: n }, () => new THREE.Quaternion());
    this.axis = Array.from({ length: n }, () => new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize());
    this.spin = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.freq = new Float32Array(n);
    this.size = new Float32Array(n);
    this.state = new Uint8Array(n); // 0 dead, 1 flying, 2 landed
    this.rest = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.size[i] = 0.014 + rng() * 0.007;
      this.phase[i] = rng() * Math.PI * 2;
      this.freq[i] = 1.4 + rng() * 1.6;
      this.spin[i] = 2 + rng() * 5;
    }
    this.carry = 0;
    this.cursor = 0;
  }

  // Shake `n` petals loose at once from the emitter nearest (x, z) (a tapped tree).
  burst(x, z, n, world) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.emitters) {
      const d = Math.hypot(e.c[0] - x, e.c[2] - z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return;
    for (let i = 0; i < n; i++) this.spawn(world, best);
  }

  spawn(world, emitter = null) {
    for (let tries = 0; tries < this.capacity; tries++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      if (this.state[i] !== 0) continue;
      const e = emitter ?? this.emitters[Math.floor(this.rng() * this.emitters.length)];
      let x;
      let y;
      let z;
      do {
        x = this.rng() * 2 - 1;
        y = this.rng() * 2 - 1;
        z = this.rng() * 2 - 1;
      } while (x * x + y * y + z * z > 1 || y < -0.3);
      const k = i * 3;
      this.position[k] = e.c[0] + x * e.r;
      this.position[k + 1] = e.c[1] + y * e.r * 0.6;
      this.position[k + 2] = e.c[2] + z * e.r;
      world.wind.sample(this.position[k], this.position[k + 1], this.position[k + 2], world.time, _air);
      this.velocity[k] = _air.x * 0.3;
      this.velocity[k + 1] = -0.05;
      this.velocity[k + 2] = _air.z * 0.3;
      this.quaternion[i].setFromAxisAngle(this.axis[i], this.rng() * Math.PI * 2);
      this.state[i] = 1;
      return;
    }
  }

  step(dt, world) {
    this.carry += this.rate * dt;
    while (this.carry >= 1) {
      this.spawn(world);
      this.carry -= 1;
    }
    const t = world.time;
    for (let i = 0; i < this.capacity; i++) {
      const s = this.state[i];
      if (s === 0) continue;
      if (s === 2) {
        this.rest[i] -= dt;
        if (this.rest[i] <= 0) this.state[i] = 0;
        continue;
      }
      const k = i * 3;
      const x = this.position[k];
      const y = this.position[k + 1];
      const z = this.position[k + 2];
      world.wind.sample(x, y, z, t, _air);
      const f = this.freq[i];
      const ph = this.phase[i];
      // The air moves at `carry` of the wind field's push; the petal chases it through drag (so it sinks
      // at a petal's slow terminal speed), flutters across its fall and bobs as it side-slips.
      const c = this.carryAir;
      const ax = (_air.x * c - this.velocity[k]) * this.drag + Math.sin(t * f + ph) * 0.6;
      const ay = (_air.y * 0.3 - this.velocity[k + 1]) * this.drag - GRAVITY + Math.sin(t * f * 2.1 + ph) * 1.1;
      const az = (_air.z * c - this.velocity[k + 2]) * this.drag + Math.cos(t * f * 1.3 + ph) * 0.6;
      this.velocity[k] += ax * dt;
      this.velocity[k + 1] += ay * dt;
      this.velocity[k + 2] += az * dt;
      this.position[k] += this.velocity[k] * dt;
      this.position[k + 1] += this.velocity[k + 1] * dt;
      this.position[k + 2] += this.velocity[k + 2] * dt;
      _q.setFromAxisAngle(this.axis[i], this.spin[i] * dt);
      this.quaternion[i].multiply(_q);
      if (this.position[k + 1] <= this.ground + 0.004) {
        // Settle flat on the grass, turned at random.
        this.position[k + 1] = this.ground + 0.004 + this.rng() * 0.012;
        _axis.set(this.rng() - 0.5, 0, this.rng() - 0.5).normalize();
        this.quaternion[i].setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng() * Math.PI * 2).multiply(_q.setFromAxisAngle(_axis, (this.rng() - 0.5) * 0.3));
        this.state[i] = 2;
        this.rest[i] = 4 + this.rng() * 8;
      } else if (Math.abs(x) > this.bounds || Math.abs(z) > this.bounds || y < this.ground - 1) this.state[i] = 0;
    }
  }

  // Once per rendered frame.
  sync() {
    for (let i = 0; i < this.capacity; i++) {
      const k = i * 3;
      if (this.state[i] === 0) {
        _dummy.position.set(0, 0, 0);
        _dummy.scale.setScalar(0.0001);
      } else {
        _dummy.position.set(this.position[k], this.position[k + 1], this.position[k + 2]);
        _dummy.quaternion.copy(this.quaternion[i]);
        _dummy.scale.setScalar(this.size[i]);
      }
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get flying() {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.state[i] === 1) n++;
    return n;
  }
}
