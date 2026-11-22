import * as THREE from 'three';
import tileable from './glsl/tileable.glsl.js';

import recipe_asphalt from './recipes/asphalt.glsl.js';
import recipe_bark from './recipes/bark.glsl.js';
import recipe_blossomMass from './recipes/blossomMass.glsl.js';
import recipe_boxwoodMass from './recipes/boxwoodMass.glsl.js';
import recipe_ceramic from './recipes/ceramic.glsl.js';
import recipe_chalkboard from './recipes/chalkboard.glsl.js';
import recipe_cloud from './recipes/cloud.glsl.js';
import recipe_cream from './recipes/cream.glsl.js';
import recipe_cypressMass from './recipes/cypressMass.glsl.js';
import recipe_fabric from './recipes/fabric.glsl.js';
import recipe_ginkgoMass from './recipes/ginkgoMass.glsl.js';
import recipe_grass from './recipes/grass.glsl.js';
import recipe_hydrangeaMass from './recipes/hydrangeaMass.glsl.js';
import recipe_lawn from './recipes/lawn.glsl.js';
import recipe_leaf from './recipes/leaf.glsl.js';
import recipe_metalBrushed from './recipes/metalBrushed.glsl.js';
import recipe_metalHammered from './recipes/metalHammered.glsl.js';
import recipe_paintedWood from './recipes/paintedWood.glsl.js';
import recipe_petal from './recipes/petal.glsl.js';
import recipe_plaster from './recipes/plaster.glsl.js';
import recipe_plastic from './recipes/plastic.glsl.js';
import recipe_slate from './recipes/slate.glsl.js';
import recipe_stone from './recipes/stone.glsl.js';
import recipe_sugarShell from './recipes/sugarShell.glsl.js';
import recipe_terracotta from './recipes/terracotta.glsl.js';
import recipe_wood from './recipes/wood.glsl.js';

const RECIPES = {
  './recipes/asphalt.glsl': recipe_asphalt,
  './recipes/bark.glsl': recipe_bark,
  './recipes/blossomMass.glsl': recipe_blossomMass,
  './recipes/boxwoodMass.glsl': recipe_boxwoodMass,
  './recipes/ceramic.glsl': recipe_ceramic,
  './recipes/chalkboard.glsl': recipe_chalkboard,
  './recipes/cloud.glsl': recipe_cloud,
  './recipes/cream.glsl': recipe_cream,
  './recipes/cypressMass.glsl': recipe_cypressMass,
  './recipes/fabric.glsl': recipe_fabric,
  './recipes/ginkgoMass.glsl': recipe_ginkgoMass,
  './recipes/grass.glsl': recipe_grass,
  './recipes/hydrangeaMass.glsl': recipe_hydrangeaMass,
  './recipes/lawn.glsl': recipe_lawn,
  './recipes/leaf.glsl': recipe_leaf,
  './recipes/metalBrushed.glsl': recipe_metalBrushed,
  './recipes/metalHammered.glsl': recipe_metalHammered,
  './recipes/paintedWood.glsl': recipe_paintedWood,
  './recipes/petal.glsl': recipe_petal,
  './recipes/plaster.glsl': recipe_plaster,
  './recipes/plastic.glsl': recipe_plastic,
  './recipes/slate.glsl': recipe_slate,
  './recipes/stone.glsl': recipe_stone,
  './recipes/sugarShell.glsl': recipe_sugarShell,
  './recipes/terracotta.glsl': recipe_terracotta,
  './recipes/wood.glsl': recipe_wood,
};

const VERTEX = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Bakes every procedural surface texture on the GPU once, at full resolution with mipmaps and
// maximum anisotropy. Channels: r = tone (0.5 neutral), g = height, b and a = recipe-specific masks.
export class TextureBakery {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = new Map();
    this.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
  }

  get(name, size = 1024) {
    const key = `${name}@${size}`;
    let texture = this.cache.get(key);
    if (texture) return texture;

    const source = RECIPES[`./recipes/${name}.glsl`];
    if (!source) throw new Error(`TextureBakery: no recipe named "${name}"`);

    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: `precision highp float;\nprecision highp int;\n${tileable}\n${source}\nin vec2 vUv;\nout vec4 outColor;\nvoid main() { outColor = clamp(recipe(vUv), 0.0, 1.0); }`,
    });
    const target = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      depthBuffer: false,
      colorSpace: THREE.NoColorSpace,
    });
    target.texture.anisotropy = this.anisotropy;
    target.texture.name = name;

    const previous = this.renderer.getRenderTarget();
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(previous);
    material.dispose();

    texture = target.texture;
    this.cache.set(key, texture);
    return texture;
  }
}
