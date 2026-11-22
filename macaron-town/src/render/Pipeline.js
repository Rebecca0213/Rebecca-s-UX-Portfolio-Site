import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { OutputShader } from 'three/examples/jsm/shaders/OutputShader.js';
import fullscreenVertex from './glsl/fullscreen.vert.glsl.js';
import outlineFragment from './glsl/outline.frag.glsl.js';
import bokehFragment from './glsl/bokeh.frag.glsl.js';
import bokehTilesFragment from './glsl/bokeh_tiles.frag.glsl.js';
import bokehSpreadFragment from './glsl/bokeh_spread.frag.glsl.js';
import gradeFragment from './glsl/grade.frag.glsl.js';
import { SHARED } from './shared.js';

// Renders the scene once, 4x multisampled, into colour (HDR) + view normals/material id with a shared
// depth, and resolves them into the target's textures. Every later pass reads these, so no extra scene
// passes are needed.
//
// The multisampled framebuffer is this pass's own rather than three's: three resolves a multisampled
// multiple-render-target one colour attachment per blit, re-pointing attachments between blits and
// resolving depth again with each (about 2.5 ms a frame more at DPR 2 on an M1, same pixels). To draw
// into it through three (which binds the target's framebuffer, also when its shadow pass hands the target
// back), it stands in for the target's framebuffer for the length of the render.
const COLOR_FORMATS = { [THREE.HalfFloatType]: 'RGBA16F', [THREE.FloatType]: 'RGBA32F', [THREE.UnsignedByteType]: 'RGBA8' };

class CelScenePass extends Pass {
  constructor(scene, camera, target, samples = 4) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.target = target; // single-sampled: the resolved textures the post passes read
    this.samples = samples;
    this.msaa = null;
    // The resolve copy also drops any non-finite pixel (from any material, cel or not): bloom's blur
    // chain would otherwise spread one NaN over the entire frame.
    this.copy = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
        vertexShader: CopyShader.vertexShader,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse;
          varying vec2 vUv;
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            bool finite = all(notEqual(floatBitsToUint(c) & 0x7f800000u, uvec4(0x7f800000u)));
            gl_FragColor = finite ? c : vec4(0.0, 0.0, 0.0, 1.0);
          }`,
      })
    );
  }

  // The multisampled framebuffer at the target's size: one renderbuffer per target texture, in its format,
  // and a depth renderbuffer in the depth texture's format (24-bit), as a resolve blit requires.
  framebuffer(renderer) {
    const { width, height } = this.target;
    if (this.msaa?.width === width && this.msaa?.height === height) return this.msaa;
    this.release();
    const gl = renderer.getContext();
    const samples = Math.min(this.samples, gl.getParameter(gl.MAX_SAMPLES));
    const storage = (format) => {
      const buffer = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, format, width, height);
      return buffer;
    };
    const colors = this.target.textures.map((t) => storage(gl[COLOR_FORMATS[t.type]]));
    const depth = storage(gl.DEPTH_COMPONENT24);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    const framebuffer = gl.createFramebuffer();
    renderer.state.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    colors.forEach((buffer, i) => gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.RENDERBUFFER, buffer));
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    renderer.state.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`CelScenePass: multisampled framebuffer incomplete (0x${status.toString(16)})`);
    this.msaa = { gl, framebuffer, colors, depth, width, height };
    return this.msaa;
  }

  render(renderer, writeBuffer) {
    renderer.initRenderTarget(this.target); // three sets up the resolved textures and their framebuffer
    const msaa = this.framebuffer(renderer);
    const properties = renderer.properties.get(this.target);
    const resolved = properties.__webglFramebuffer;
    properties.__webglFramebuffer = msaa.framebuffer;
    try {
      renderer.setRenderTarget(this.target);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      properties.__webglFramebuffer = resolved;
    }
    this.resolve(renderer, msaa, resolved);
    // The pass after this one may read the resolved colour itself (`reader`, the AO pass, which drops
    // non-finite pixels as this copy does): then the copy into the composer's buffer is skipped.
    this.needsSwap = !this.reader?.enabled || this.renderToScreen;
    if (!this.needsSwap) return;
    this.copy.material.uniforms.tDiffuse.value = this.target.textures[0];
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.copy.render(renderer);
  }

  // One blit per colour attachment, chosen with read/draw buffers instead of re-attaching, and depth once.
  // (Invalidating the multisampled buffers afterwards measured slower on ANGLE/Metal, so they are left.)
  resolve(renderer, msaa, resolved) {
    const { gl, width, height } = msaa;
    const state = renderer.state;
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, msaa.framebuffer);
    state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolved);
    const all = msaa.colors.map((_, i) => gl.COLOR_ATTACHMENT0 + i);
    for (let i = 0; i < all.length; i++) {
      gl.readBuffer(all[i]);
      gl.drawBuffers(all.map((a, j) => (j === i ? a : gl.NONE)));
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT | (i === 0 ? gl.DEPTH_BUFFER_BIT : 0), gl.NEAREST);
    }
    // Back to the defaults three expects: read from the first attachment, draw to all of them.
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.drawBuffers(all);
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  release() {
    if (!this.msaa) return;
    const { gl, framebuffer, colors, depth } = this.msaa;
    gl.deleteFramebuffer(framebuffer);
    for (const buffer of [...colors, depth]) gl.deleteRenderbuffer(buffer);
    this.msaa = null;
  }

  dispose() {
    this.release();
    this.copy.material.dispose();
    this.copy.dispose();
  }
}

// Depth of field, gathering only as far as blur actually reaches. Two passes at 1/64 of the pixels find
// the largest circle of confusion in each TILE x TILE block of depth and spread it over the blocks a blur
// that size can reach; the gather's spiral (bokeh.frag.glsl) stops at that circle. The image is the full
// 48-tap gather's, but the circle is rarely more than a third of the largest blur, so a blurred pixel
// takes a handful of taps and a sharp one a single fetch.
const TILE = 8;

class BokehPass extends Pass {
  constructor(uniforms) {
    super();
    // One uniform set shared by the three passes (each reads only what it declares).
    this.uniforms = { tDiffuse: { value: null }, tTiles: { value: null }, reach: { value: 2 }, ...uniforms };
    const target = () =>
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this.tiles = target();
    this.spread = target();
    const quad = (fragmentShader) => new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: this.uniforms, defines: { TILE }, vertexShader: fullscreenVertex, fragmentShader }));
    this.tileQuad = quad(bokehTilesFragment);
    this.spreadQuad = quad(bokehSpreadFragment);
    this.gatherQuad = quad(bokehFragment);
  }

  setSize(width, height) {
    for (const t of [this.tiles, this.spread]) t.setSize(Math.ceil(width / TILE), Math.ceil(height / TILE));
  }

  render(renderer, writeBuffer, readBuffer) {
    const u = this.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    // Blocks to spread over: enough to cover the largest blur (plus nearest-texel rounding) from any pixel.
    u.reach.value = Math.ceil((u.maxBlur.value + 1) / TILE);
    renderer.setRenderTarget(this.tiles);
    this.tileQuad.render(renderer);
    u.tTiles.value = this.tiles.texture;
    renderer.setRenderTarget(this.spread);
    this.spreadQuad.render(renderer);
    u.tTiles.value = this.spread.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.gatherQuad.render(renderer);
  }

  dispose() {
    for (const t of [this.tiles, this.spread]) t.dispose();
    for (const q of [this.tileQuad, this.spreadQuad, this.gatherQuad]) {
      q.material.dispose();
      q.dispose();
    }
  }
}


// Grass blades are far thinner than a pixel at town scale; letting them occlude makes the horizon
// search alias into grey blotches. Samples landing on 'foliage' ids (0.02-0.03 in the normal
// buffer's alpha) are ignored, so grass receives AO from buildings but never casts it.
//
// Far samples read coarse depth. Up close the AO radius spans a hundred pixels and more, and 36 samples
// scattered that wide miss the texture cache on nearly every fetch (the pass took 25 ms at the plaza
// and 83 ms at street level, against 5 ms in the hero view). As in XeGTAO, a sample reads a smaller copy
// of the depth chosen by its distance from the pixel: level L (1/2^L size) from 2^(L+3.3) px on. A level
// texel holds the full-resolution depth under its centre, foliage pushed to the far plane (an ignored
// sample), so a far sample moves by at most a few percent of its reach. Samples nearer than ~20 px read
// the full depth and test the foliage id as before.
const AO_LEVELS = 4;
const AO_SAMPLE_DEPTH = 'float sampleSceneDepth = getDepth(sampleUv);';
const AO_SAMPLE_FN = 'vec3 getSceneUvAndDepth(vec3 sampleViewPos) {';
const AO_LEVEL_SAMPLING = /* glsl */ `
uniform sampler2D tAOLevel1;
uniform sampler2D tAOLevel2;
uniform sampler2D tAOLevel3;
uniform sampler2D tAOLevel4;
bool aoFoliage(const vec2 uv) { float id = textureLod(tNormal, uv, 0.).a; return id > 0.02 && id < 0.03; }
float aoSampleDepth(const vec2 uv) {
  float level = floor(log2(max(length((uv - vUv) * resolution), 1.0)) - 3.3);
  if (level < 1.0) return aoFoliage(uv) ? 1.0 : getDepth(uv);
  if (level < 2.0) return textureLod(tAOLevel1, uv, 0.).r;
  if (level < 3.0) return textureLod(tAOLevel2, uv, 0.).r;
  if (level < 4.0) return textureLod(tAOLevel3, uv, 0.).r;
  return textureLod(tAOLevel4, uv, 0.).r;
}
`;
function levelledAOSamples(material) {
  const source = material.fragmentShader;
  if (!source.includes(AO_SAMPLE_DEPTH) || !source.includes(AO_SAMPLE_FN)) throw new Error('Pipeline: GTAO sample hook not found');
  material.fragmentShader = source.replace(AO_SAMPLE_FN, `${AO_LEVEL_SAMPLING}\n${AO_SAMPLE_FN}`).replace(AO_SAMPLE_DEPTH, 'float sampleSceneDepth = aoSampleDepth(sampleUv);');
  material.needsUpdate = true;
}

// One depth level: the full-resolution depth under each texel's centre, foliage at the far plane.
const AO_LEVEL_FRAGMENT = /* glsl */ `
uniform sampler2D tDepth;
uniform sampler2D tNormal;
varying vec2 vUv;
void main() {
  ivec2 size = textureSize(tDepth, 0);
  ivec2 p = min(ivec2(vUv * vec2(size)), size - 1);
  float id = texelFetch(tNormal, p, 0).a;
  gl_FragColor = vec4(id > 0.02 && id < 0.03 ? 1.0 : texelFetch(tDepth, p, 0).r, 0.0, 0.0, 1.0);
}`;

// three's GTAO pass with two economies that leave its output as it was. Its AO and denoised AO only ever
// hold grey, written to all four channels of a half-float target: here they are single-channel, and
// the denoiser reads the red channel back as the same grey. Its result is composited in one pass
// (three copies the frame, then multiplies the AO over the copy with blending).
const PD_GREY = [
  ['vec3 neighborColor = sampleTexel.rgb;', 'vec3 neighborColor = vec3(sampleTexel.r);'],
  ['vec3 center = texel.rgb;', 'vec3 center = vec3(texel.r);'],
  ['vec3 denoised = texel.rgb;', 'vec3 denoised = vec3(texel.r);'],
];

class CelGTAOPass extends GTAOPass {
  constructor(...args) {
    super(...args);
    this.gtaoRenderTarget.dispose();
    this.pdRenderTarget.dispose();
    this.gtaoRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height, { type: THREE.HalfFloatType, format: THREE.RedFormat, depthBuffer: false });
    this.pdRenderTarget = this.gtaoRenderTarget.clone();
    this.pdMaterial.uniforms.tDiffuse.value = this.gtaoRenderTarget.texture;
    let source = this.pdMaterial.fragmentShader;
    for (const [from, to] of PD_GREY) {
      if (!source.includes(from)) throw new Error(`Pipeline: denoise hook not found: ${from}`);
      source = source.replace(from, to);
    }
    this.pdMaterial.fragmentShader = source;
    this.pdMaterial.needsUpdate = true;
    // Coarse depth levels for far samples (see levelledAOSamples).
    this.levels = [];
    for (let level = 1; level <= AO_LEVELS; level++) {
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
      this.levels.push(target);
      this.gtaoMaterial.uniforms[`tAOLevel${level}`] = { value: target.texture };
    }
    this.levelMaterial = new THREE.ShaderMaterial({
      uniforms: { tDepth: { value: this.depthTexture }, tNormal: { value: this.normalTexture } },
      vertexShader: fullscreenVertex,
      fragmentShader: AO_LEVEL_FRAGMENT,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    levelledAOSamples(this.gtaoMaterial);
    this.setSize(this.width, this.height);
    this.composite = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tAO: { value: null }, intensity: { value: 1 } },
      vertexShader: fullscreenVertex,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tAO;
        uniform float intensity;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          // Reading the scene's resolved colour directly, it drops non-finite pixels as the scene
          // pass's copy would have (bloom's blur would spread one NaN over the whole frame).
          if (!all(notEqual(floatBitsToUint(c) & 0x7f800000u, uvec4(0x7f800000u)))) c = vec4(0.0, 0.0, 0.0, 1.0);
          gl_FragColor = vec4(c.rgb * mix(vec3(1.0), vec3(texture2D(tAO, vUv).r), intensity), c.a);
        }`,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
  }

  setSize(width, height) {
    super.setSize(width, height);
    this.levels?.forEach((target, i) => target.setSize(Math.ceil(width / 2 ** (i + 1)), Math.ceil(height / 2 ** (i + 1))));
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    for (const target of this.levels) this._renderPass(renderer, this.levelMaterial, target);
    if (this.output !== GTAOPass.OUTPUT.Default) {
      this.needsSwap = true;
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive); // debug views (AO shows in red)
      return;
    }
    const camera = this.camera;
    const u = this.gtaoMaterial.uniforms;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
    u.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
    u.cameraWorldMatrix.value.copy(camera.matrixWorld);
    this._renderPass(renderer, this.gtaoMaterial, this.gtaoRenderTarget, 0xffffff, 1.0);
    this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
    this._renderPass(renderer, this.pdMaterial, this.pdRenderTarget, 0xffffff, 1.0);
    // The ink pass, when on, applies the AO as it reads the frame (InkPass): no composite of its own.
    this.needsSwap = !this.compositeInto?.enabled;
    if (!this.needsSwap) return;
    const c = this.composite.uniforms;
    c.tDiffuse.value = this.sceneColor ?? readBuffer.texture;
    c.tAO.value = this.pdRenderTarget.texture;
    c.intensity.value = this.blendIntensity;
    this._renderPass(renderer, this.composite, this.renderToScreen ? null : writeBuffer);
  }

  dispose() {
    super.dispose();
    this.composite.dispose();
    this.levelMaterial.dispose();
    for (const target of this.levels) target.dispose();
  }
}

// The ink pass (outline.frag.glsl) reading the frame with the AO applied, so the AO needs no composite
// pass of its own: a read of the frame takes the scene's resolved colour, drops a non-finite pixel (as
// the scene pass's copy does) and multiplies in the denoised AO there. The line colour is read from a
// neighbour up to 0.7 px off the texel grid, filtered: that read blends four composited texels itself,
// as filtering the composited frame did (filtering colour and AO apart and multiplying would differ at
// edges), and is made only where a line is drawn.
const INK_DECLARE = 'uniform sampler2D tDiffuse;';
const INK_CENTRE = 'texture2D(tDiffuse, vUv).rgb';
const INK_LINE = 'vec3 lineSource = texture2D(tDiffuse, nearestUv).rgb;';
const INK_SCENE = /* glsl */ `
uniform sampler2D tAO;
uniform float aoIntensity; // 0 when the AO pass is off or composites itself
vec3 celFrameTexel(ivec2 p) {
  vec4 c = texelFetch(tDiffuse, p, 0);
  if (!all(notEqual(floatBitsToUint(c) & 0x7f800000u, uvec4(0x7f800000u)))) c = vec4(0.0, 0.0, 0.0, 1.0);
  if (aoIntensity <= 0.0) return c.rgb; // no AO bound
  return c.rgb * mix(vec3(1.0), vec3(texelFetch(tAO, p, 0).r), aoIntensity);
}
vec3 celFrame(vec2 uv) { // at a texel centre (the frame and the AO share this pass's size)
  return celFrameTexel(ivec2(uv * vec2(textureSize(tDiffuse, 0))));
}
vec3 celFrameFiltered(vec2 uv) { // bilinear, clamped at the edges like the composer's buffers
  ivec2 size = textureSize(tDiffuse, 0);
  vec2 st = uv * vec2(size) - 0.5;
  ivec2 i = ivec2(floor(st));
  vec2 f = st - floor(st);
  ivec2 lo = ivec2(0);
  ivec2 hi = size - 1;
  vec3 a = celFrameTexel(clamp(i, lo, hi));
  vec3 b = celFrameTexel(clamp(i + ivec2(1, 0), lo, hi));
  vec3 c = celFrameTexel(clamp(i + ivec2(0, 1), lo, hi));
  vec3 d = celFrameTexel(clamp(i + ivec2(1, 1), lo, hi));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`;
function inkShader() {
  let source = outlineFragment;
  for (const hook of [INK_DECLARE, INK_CENTRE, INK_LINE]) if (!source.includes(hook)) throw new Error(`Pipeline: ink hook not found: ${hook}`);
  return source
    .replace(INK_DECLARE, `${INK_DECLARE}\n${INK_SCENE}`)
    .replace(INK_LINE, 'vec3 lineSource = edge > 0.0 ? celFrameFiltered(nearestUv) : vec3(0.0);')
    .replaceAll(INK_CENTRE, 'celFrame(vUv)');
}

class InkPass extends ShaderPass {
  constructor(uniforms) {
    super({ uniforms: { tDiffuse: { value: null }, tAO: { value: null }, aoIntensity: { value: 0 }, ...uniforms }, vertexShader: fullscreenVertex, fragmentShader: inkShader() });
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    const ao = this.ao;
    const composite = ao?.enabled && ao.compositeInto === this && ao.output === GTAOPass.OUTPUT.Default;
    const u = this.uniforms;
    u.tDiffuse.value = composite ? ao.sceneColor : readBuffer.texture;
    u.tAO.value = composite ? ao.pdRenderTarget.texture : null;
    u.aoIntensity.value = composite ? ao.blendIntensity : 0;
    const id = this.textureID;
    this.textureID = null; // tDiffuse is set above
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    this.textureID = id;
  }
}

// three's bloom pass without its last step, an additive blend of the bloom over the frame: the grade
// pass (GradeOutputPass) adds the bloom as it reads the frame. Off, or with the grade pass off, it
// blends as usual.
//
// It also carries the hovered venue's halo (see Hover). The building's surfaces write how much halo
// they give off to the scene colour's alpha, above its usual 1 (cel_output; nothing else reads that
// alpha, the ink pass writes 1), and the bright-pass adds that much of the glow's colour to what it
// lets through, so the blur spreads it round the building like any bright light: a soft warm halo
// that leaves the building's own colours alone (a brighter building would only wash out).
// The venues' outline glow (see Hover): which pixels are venues (the scene colour's alpha is 2 there,
// see cel_output), blurred at half resolution, across and then down. The grade pass draws the glow from
// it just outside each silhouette, a bright line where the blur is strong and a soft glow fading
// beyond. The blur's spread is set in CSS pixels, so the outline keeps its width at any resolution the
// governor picks. The venues' distance from the eye is blurred with them, so the glow can stay off
// anything standing well in front of a venue (a tree, a turret): it lights only what lies about level
// with the venue or behind it, and never outlines an occluder as if it were the venue.
const VENUE_BLUR = /* glsl */ `
uniform sampler2D tSource;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform vec2 uStep;       // one tap, in uv (across or down)
uniform float uFromScene; // 1: the first pass, from the scene colour (a venue where its alpha is over 1)
uniform vec2 uInFront;    // world units nearer than the venues beside it from which a pixel starts, and ends, keeping the glow off
varying vec2 vUv;
float celViewDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).r;
  return cameraNear * cameraFar / (cameraFar - d * (cameraFar - cameraNear));
}
// x: venue (0..1), y: venue times its distance from the eye.
vec2 celVenueAt(vec2 uv) {
  if (uFromScene < 0.5) return texture2D(tSource, uv).rg;
  float venue = clamp(texture2D(tSource, uv).a - 1.0, 0.0, 1.0);
  return vec2(venue, venue > 0.0 ? venue * celViewDepth(uv) : 0.0);
}
void main() {
  vec2 sum = vec2(0.0);
  float total = 0.0;
  for (int i = -6; i <= 6; i++) {
    float w = exp(-float(i * i) / 11.5); // a Gaussian of 2.4 taps
    sum += w * celVenueAt(vUv + uStep * float(i));
    total += w;
  }
  sum /= total;
  if (uFromScene > 0.5) {
    gl_FragColor = vec4(sum, 0.0, 1.0);
    return;
  }
  // The venues nearby, at their average distance; this pixel, if it stands well in front of them, is
  // something hiding part of a venue, and gets no glow.
  float venues = sum.y / max(sum.x, 1e-4);
  float inFront = smoothstep(uInFront.x, uInFront.y, venues - celViewDepth(vUv));
  gl_FragColor = vec4(sum.x * (1.0 - inFront), 0.0, 0.0, 1.0);
}`;

class VenueOutlinePass extends Pass {
  constructor(source, depth, camera) {
    super();
    this.needsSwap = false; // it leaves the frame alone: the grade pass reads its result
    this.source = source; // the scene colour (CelScenePass's resolved target)
    this.camera = camera;
    this.spread = 1.8; // CSS pixels between taps: the glow fades out over about 8
    // Half-float: the second channel carries distances from the eye (in world units) through the blur.
    const target = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGFormat, depthBuffer: false });
    this.across = target();
    this.blurred = target();
    this.width = 1;
    this.height = 1;
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: {
          tSource: { value: null },
          tDepth: { value: depth },
          cameraNear: { value: camera.near },
          cameraFar: { value: camera.far },
          uStep: { value: new THREE.Vector2() },
          uFromScene: { value: 1 },
          uInFront: { value: new THREE.Vector2(0.25, 0.6) },
        },
        vertexShader: fullscreenVertex,
        fragmentShader: VENUE_BLUR,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
      })
    );
  }

  get texture() {
    return this.blurred.texture;
  }

  // In drawing-buffer pixels (the composer's size times its pixel ratio); the blur runs at half that.
  setSize(width, height) {
    this.width = width;
    this.height = height;
    for (const t of [this.across, this.blurred]) t.setSize(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2)));
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    const u = this.quad.material.uniforms;
    const tap = this.spread * renderer.getPixelRatio(); // in drawing-buffer pixels
    const prevTarget = renderer.getRenderTarget();
    u.cameraNear.value = this.camera.near;
    u.cameraFar.value = this.camera.far;
    u.tSource.value = this.source;
    u.uFromScene.value = 1;
    u.uStep.value.set(tap / this.width, 0);
    renderer.setRenderTarget(this.across);
    this.quad.render(renderer);
    u.tSource.value = this.across.texture;
    u.uFromScene.value = 0;
    u.uStep.value.set(0, tap / this.height);
    renderer.setRenderTarget(this.blurred);
    this.quad.render(renderer);
    renderer.setRenderTarget(prevTarget);
  }

  dispose() {
    for (const t of [this.across, this.blurred]) t.dispose();
    this.quad.material.dispose();
    this.quad.dispose();
  }
}

const HALO_READ = 'gl_FragColor = mix( outputColor, texel, alpha );';
const HALO_DECLARE = 'uniform sampler2D tDiffuse;';

class CelBloomPass extends UnrealBloomPass {
  constructor(...args) {
    super(...args);
    const material = this.materialHighPassFilter;
    if (!material.fragmentShader.includes(HALO_READ)) throw new Error('Pipeline: bloom bright-pass hook not found');
    Object.assign(this.highPassUniforms, { tHalo: { value: null }, haloColor: SHARED.glow });
    material.fragmentShader = material.fragmentShader
      .replace(HALO_DECLARE, `${HALO_DECLARE}\nuniform sampler2D tHalo;\nuniform vec3 haloColor;`)
      .replace(HALO_READ, `${HALO_READ}\n\t\t\tgl_FragColor.rgb += haloColor * max(texture2D(tHalo, vUv).a - 2.0, 0.0);`);
    material.needsUpdate = true;
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.blendMaterial.visible = !this.compositeInto?.enabled;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}

// The grade (grade.frag.glsl) and three's output pass (tone mapping, sRGB) in one full-screen pass:
// the graded image no longer goes through a half-float buffer of its own before the output reads it.
// It also adds the bloom (see CelBloomPass) as it reads the frame. Over the hovered venue itself only
// part of the bloom is added: its halo is given off by the whole building, so it is strongest over the
// building, where it would only veil it in a milky haze; this way it shines round the building.
const GRADE_READ = 'gl_FragColor = texture2D( tDiffuse, vUv );';
const GRADE_DECLARE = 'uniform sampler2D tDiffuse;';
const GRADE_SAMPLE = 'vec3 c = texture2D(tDiffuse, vUv).rgb;';
const GRADE_HALO = /* glsl */ `
uniform sampler2D tHalo;          // the scene colour: its alpha is 2 on a venue, more on the hovered one (cel_output)
uniform float haloKeep;           // the share of the bloom added over the hovered venue
uniform sampler2D tVenueOutline;  // the venues, blurred (VenueOutlinePass)
uniform vec4 venueOutline;        // the outline glow: rgb, amount (Hover)
uniform vec4 venueOutlineShape;   // the line: from, to (blurred venue just outside); line and glow strengths
float celBloomShare(vec2 uv) { return 1.0 - (1.0 - haloKeep) * smoothstep(0.0, 0.04, texture2D(tHalo, uv).a - 2.0); }
vec3 celVenueOutline(vec2 uv) {
  if (venueOutline.a <= 0.0) return vec3(0.0);
  float outside = texture2D(tVenueOutline, uv).r * (1.0 - clamp(texture2D(tHalo, uv).a - 1.0, 0.0, 1.0));
  float line = smoothstep(venueOutlineShape.x, venueOutlineShape.y, outside);
  return venueOutline.rgb * venueOutline.a * (line * venueOutlineShape.z + outside * venueOutlineShape.w);
}`;
function gradeOutputShader() {
  const grade = gradeFragment;
  const body = grade.slice(grade.indexOf('void main() {') + 'void main() {'.length, grade.lastIndexOf('}'));
  const uniforms = grade
    .split('\n')
    .filter((line) => line.startsWith('uniform ') && !line.includes('tDiffuse'))
    .join('\n');
  const source = OutputShader.fragmentShader;
  if (!source.includes(GRADE_READ) || !source.includes(GRADE_DECLARE) || !body.includes(GRADE_SAMPLE)) throw new Error('Pipeline: output/grade hooks not found');
  const graded = body.replace(
    GRADE_SAMPLE,
    'vec3 c = texture2D(tDiffuse, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomAmount * celBloomShare(vUv) + celVenueOutline(vUv);',
  );
  return source.replace(GRADE_DECLARE, `${GRADE_DECLARE}\nuniform sampler2D tBloom;\nuniform float bloomAmount;${GRADE_HALO}\n${uniforms}`).replace(GRADE_READ, graded);
}

class GradeOutputPass extends OutputPass {
  constructor(uniforms) {
    super();
    const own = {
      tBloom: { value: null },
      bloomAmount: { value: 0 },
      tHalo: { value: null },
      haloKeep: { value: 0.15 },
      tVenueOutline: { value: null },
      venueOutline: SHARED.outline,
      venueOutlineShape: { value: new THREE.Vector4(0.16, 0.34, 1.4, 0.7) },
    };
    for (const [name, uniform] of Object.entries({ ...own, ...uniforms })) this.uniforms[name] = uniform;
    this.material.fragmentShader = gradeOutputShader();
    this.material.needsUpdate = true;
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    const bloom = this.bloom;
    const add = bloom?.enabled && bloom.compositeInto === this;
    this.uniforms.tBloom.value = add ? bloom.renderTargetsHorizontal[0].texture : null;
    this.uniforms.bloomAmount.value = add ? 1 : 0;
    this.uniforms.tVenueOutline.value = this.venueOutline?.enabled ? this.venueOutline.texture : null;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}

export class Pipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.camera = camera;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());

    this.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
    // Single-sampled: the scene pass draws 4x multisampled into its own framebuffer and resolves here.
    this.sceneTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      count: 2,
      type: THREE.HalfFloatType,
      depthTexture: this.depthTexture,
    });
    this.sceneTarget.textures[0].name = 'color';
    this.sceneTarget.textures[1].name = 'normalId';
    const normalTexture = this.sceneTarget.textures[1];

    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(renderer.getPixelRatio());

    this.scenePass = new CelScenePass(scene, camera, this.sceneTarget, 4);

    this.ao = new CelGTAOPass(scene, camera, size.x, size.y, { depthTexture: this.depthTexture, normalTexture });
    this.ao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.6, thickness: 0.5, scale: 1.0, samples: 16, distanceFallOff: 1.0 });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 4, samples: 16 });
    this.ao.blendIntensity = 0.85;

    // Textures are bound after construction: ShaderPass clones its uniforms, and cloning drops
    // render-target textures (and copies the depth texture into an empty one).
    const depthUniforms = () => ({
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2(size.x, size.y) },
      cameraNear: { value: camera.near },
      cameraFar: { value: camera.far },
    });

    this.outline = new InkPass({
      ...depthUniforms(),
      tNormal: { value: null },
      thickness: { value: renderer.getPixelRatio() },
      strength: { value: 0.92 },
      inkTint: { value: new THREE.Vector3(0.36, 0.27, 0.36) },
      fade: { value: new THREE.Vector2(70, 160) },
      creaseFade: { value: new THREE.Vector2(14, 40) },
    });

    this.bokeh = new BokehPass({
      ...depthUniforms(),
      focusDistance: { value: 40 },
      aperture: { value: 0.35 },
      maxBlur: { value: 5 * renderer.getPixelRatio() },
    });

    // Threshold above sunlit pastels, so only emissive glass, bulbs and the sun disc bloom.
    this.bloom = new CelBloomPass(new THREE.Vector2(size.x, size.y), 0.24, 0.45, 1.25);

    // Grade, then tone mapping and sRGB, in one pass (`output` names the same pass).
    this.grade = new GradeOutputPass({
      saturation: { value: 1.06 },
      shadowLift: { value: new THREE.Vector3(0.012, 0.008, 0.02) },
      highlightTint: { value: new THREE.Vector3(1.02, 1.0, 0.98) },
      vignette: { value: 0.16 },
      vignetteTint: { value: new THREE.Vector3(1.0, 0.92, 0.93) },
    });
    // The venues' outline glow, blurred from the scene colour for the grade pass to draw.
    this.venueOutline = new VenueOutlinePass(this.sceneTarget.textures[0], this.depthTexture, camera);
    this.grade.venueOutline = this.venueOutline;
    this.output = this.grade;
    this.smaa = new SMAAPass();

    for (const pass of [this.scenePass, this.ao, this.outline, this.bokeh, this.bloom, this.venueOutline, this.grade, this.smaa]) {
      this.composer.addPass(pass);
    }
    // Fewer full-screen passes, same image: the AO reads the scene's resolved colour itself (no copy by
    // the scene pass), the ink pass applies the AO as it reads (no AO composite), and the grade pass adds
    // the bloom as it reads (no bloom blend). Each falls back to the separate step when its partner is off.
    this.ao.sceneColor = this.sceneTarget.textures[0];
    this.scenePass.reader = this.ao;
    this.ao.compositeInto = this.outline;
    this.outline.ao = this.ao;
    this.bloom.compositeInto = this.grade;
    this.grade.bloom = this.bloom;
    // The hovered venue's halo, in the scene colour's alpha: the bloom spreads it, the grade keeps it off the venue.
    this.bloom.highPassUniforms.tHalo.value = this.sceneTarget.textures[0];
    this.grade.uniforms.tHalo.value = this.sceneTarget.textures[0];
    this.depthPasses = [this.outline, this.bokeh];
    for (const pass of this.depthPasses) pass.uniforms.tDepth.value = this.depthTexture;
    this.outline.uniforms.tNormal.value = normalTexture;
  }

  setFocus(distance) {
    this.bokeh.uniforms.focusDistance.value = distance;
  }

  setSize(width, height) {
    const ratio = this.renderer.getPixelRatio();
    const w = Math.floor(width * ratio);
    const h = Math.floor(height * ratio);
    this.sceneTarget.setSize(w, h);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    for (const pass of this.depthPasses) pass.uniforms.resolution.value.set(w, h);
    // Line weight and blur radius are in device pixels: keep them the same size on screen.
    this.outline.uniforms.thickness.value = ratio;
    this.bokeh.uniforms.maxBlur.value = 5 * ratio;
    this.venueOutline.setSize(w, h);
  }

  render(delta) {
    for (const pass of this.depthPasses) {
      pass.uniforms.cameraNear.value = this.camera.near;
      pass.uniforms.cameraFar.value = this.camera.far;
    }
    this.composer.render(delta);
  }
}
