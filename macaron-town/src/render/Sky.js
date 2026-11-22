import * as THREE from 'three';
import vertexShader from './glsl/sky.vert.glsl.js';
import fragmentShader from './glsl/sky.frag.glsl.js';
import { SHARED } from './shared.js';
import { ISLAND, ISLETS } from '../map/layout.js';

// The island and its islets, as discs that shadow the sea of clouds below (centre a little under
// each lawn, radius out to the cloud skirts).
const casters = () => [
  new THREE.Vector4(0, -1.2, 0, ISLAND.bodyRadius * 1.05),
  ...ISLETS.map((islet) => new THREE.Vector4(islet.x, islet.y - 0.6, islet.z, islet.radius * 1.08)),
].slice(0, 4);

// Pastel dome that follows the camera and never writes depth, so post effects treat it as background.
// Below the horizon it shows a sea of cumulus tops far under the island (see sky.frag.glsl).
export class Sky {
  constructor({ seaHeight = -38, seaScale = 1 / 21, coverage = 0.47, haze = 420 } = {}) {
    const list = casters();
    while (list.length < 4) list.push(new THREE.Vector4(0, -1e4, 0, 0));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: SHARED.skyZenith,
        uHorizon: SHARED.skyHorizon,
        uBelow: SHARED.skyGround,
        uSunDir: SHARED.sunDirection,
        uSunColor: SHARED.sunColor,
        uTime: SHARED.time,
        uSea: { value: new THREE.Vector4(seaHeight, seaScale, coverage, haze) },
        // Cool against the warm island: cream-white tops, lilac shade, powder-blue depths.
        uSeaLit: { value: new THREE.Color('#FFFAF4') },
        uSeaShade: { value: new THREE.Color('#DDD5EE') },
        uSeaDeep: { value: new THREE.Color('#BCD0EC') },
        uCasters: { value: list },
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 96, 48), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  update(camera) {
    this.mesh.position.copy(camera.position);
  }
}
