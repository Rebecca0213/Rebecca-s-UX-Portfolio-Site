import * as THREE from 'three';
import { GRAVITY } from './World.js';

const _dummy = new THREE.Object3D();
const _velocity = new THREE.Vector3();

// Ballistic water droplets rendered as an InstancedMesh: spawned by emitters, pulled by gravity and
// wind, stretched along their velocity, and recycled when they hit a catch surface.
export class Droplets {
  constructor(mesh, { capacity = 600 } = {}) {
    this.mesh = mesh;
    this.capacity = capacity;
    this.position = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.floor = new Float32Array(capacity);
    this.cursor = 0;
    this.emitters = [];
    this.mesh.count = capacity;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) this.life[i] = 0;
  }

  // origin/direction in the mesh's local space; rate in droplets per second; floorY = catch height.
  addEmitter({ origin, direction, speed, spread, rate, floorY }) {
    this.emitters.push({ origin: origin.clone(), direction: direction.clone().normalize(), speed, spread, rate, floorY, carry: 0 });
  }

  spawn(e) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    _velocity.copy(e.direction);
    _velocity.x += (Math.random() - 0.5) * e.spread;
    _velocity.y += (Math.random() - 0.5) * e.spread * 0.4;
    _velocity.z += (Math.random() - 0.5) * e.spread;
    _velocity.normalize().multiplyScalar(e.speed * (0.92 + Math.random() * 0.16));
    this.position.set([e.origin.x, e.origin.y, e.origin.z], i * 3);
    this.velocity.set([_velocity.x, _velocity.y, _velocity.z], i * 3);
    this.life[i] = 3;
    this.floor[i] = e.floorY;
  }

  step(dt, world) {
    for (const e of this.emitters) {
      e.carry += e.rate * dt;
      while (e.carry >= 1) {
        this.spawn(e);
        e.carry -= 1;
      }
    }
    const windX = world.wind.dir.x * world.wind.strength * 0.6;
    const windZ = world.wind.dir.z * world.wind.strength * 0.6;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      const k = i * 3;
      this.velocity[k] += windX * dt;
      this.velocity[k + 1] -= GRAVITY * dt;
      this.velocity[k + 2] += windZ * dt;
      this.position[k] += this.velocity[k] * dt;
      this.position[k + 1] += this.velocity[k + 1] * dt;
      this.position[k + 2] += this.velocity[k + 2] * dt;
      this.life[i] -= dt;
      if (this.position[k + 1] < this.floor[i]) this.life[i] = 0;
    }
  }

  // Called once per rendered frame. Each drop is stretched along its velocity by (1 + speed * stretch).
  sync(radius, stretch = 0.9) {
    for (let i = 0; i < this.capacity; i++) {
      const k = i * 3;
      if (this.life[i] <= 0) {
        // Spent drops shrink to nothing at the origin (not parked far away, which would skew bounds).
        _dummy.position.set(0, 0, 0);
        _dummy.scale.setScalar(0.0001);
      } else {
        _dummy.position.set(this.position[k], this.position[k + 1], this.position[k + 2]);
        _velocity.set(this.velocity[k], this.velocity[k + 1], this.velocity[k + 2]);
        const speed = _velocity.length();
        _dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, _velocity.normalize());
        _dummy.scale.set(radius, radius * (1 + speed * stretch), radius);
      }
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
