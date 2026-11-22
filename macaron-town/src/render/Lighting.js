import * as THREE from 'three';
import { SHARED } from './shared.js';
import { SUN } from '../map/layout.js';

// Warm key sun with crisp-but-soft cast shadows, and a sky/cream hemisphere fill for the shadow side.
export class Lighting {
  constructor(scene, { extent = 23, sunIntensity = 2.25, fillIntensity = 1.15 } = {}) {
    const dir = new THREE.Vector3(
      Math.cos(SUN.elevation) * Math.cos(SUN.azimuth),
      Math.sin(SUN.elevation),
      Math.cos(SUN.elevation) * Math.sin(SUN.azimuth)
    ).normalize();
    SHARED.sunDirection.value.copy(dir);

    this.sun = new THREE.DirectionalLight(SHARED.sunColor.value, sunIntensity);
    this.sun.position.copy(dir).multiplyScalar(60);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(4096, 4096);
    Object.assign(s.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 20, far: 110 });
    s.camera.updateProjectionMatrix();
    s.bias = -0.00025;
    s.normalBias = 0.018;
    s.radius = 2.5;

    this.fill = new THREE.HemisphereLight('#EAF2FF', '#F6DCDC', fillIntensity);

    scene.add(this.sun, this.sun.target, this.fill);
  }

  setExtent(extent) {
    const c = this.sun.shadow.camera;
    Object.assign(c, { left: -extent, right: extent, top: extent, bottom: -extent });
    c.updateProjectionMatrix();
  }
}
