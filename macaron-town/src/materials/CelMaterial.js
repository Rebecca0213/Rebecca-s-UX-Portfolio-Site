import * as THREE from 'three';
import { SHARED } from '../render/shared.js';
import vertexPars from './glsl/cel_vertex.glsl.js';
import vertexMain from './glsl/cel_vertex_main.glsl.js';
import fragmentPars from './glsl/cel_fragment.glsl.js';
import lightsPars from './glsl/cel_lights.glsl.js';
import colorChunk from './glsl/cel_color.glsl.js';
import normalChunk from './glsl/cel_normal.glsl.js';
import outputChunk from './glsl/cel_output.glsl.js';

const OUTGOING = 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';
const DIR_INFO = 'getDirectionalLightInfo( directionalLight, directLight );';
const DIR_SHADOW = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]';

function must(source, needle) {
  if (!source.includes(needle)) throw new Error(`CelMaterial: shader hook not found: ${needle.slice(0, 60)}`);
  return source;
}

// Directional shadows are captured into `celShadow` instead of dimming the light, so the cel model
// can quantise cast shadows separately from the terminator.
const LIGHTS_BEGIN = must(must(THREE.ShaderChunk.lights_fragment_begin, DIR_INFO), DIR_SHADOW)
  .replace(DIR_INFO, `${DIR_INFO}\n\t\tcelShadow = 1.0;`)
  .replace(DIR_SHADOW, 'celShadow = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]');

function patchVertex(source) {
  return must(must(source, '#include <common>'), '#include <begin_vertex>')
    .replace('#include <common>', `#include <common>\n${vertexPars}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexMain}`);
}

function patchFragment(source) {
  for (const hook of ['#include <common>', '#include <lights_toon_pars_fragment>', '#include <lights_fragment_begin>', '#include <color_fragment>', '#include <normal_fragment_maps>', OUTGOING]) {
    must(source, hook);
  }
  return source
    .replace('#include <common>', `#include <common>\n${fragmentPars}`)
    .replace('#include <lights_toon_pars_fragment>', lightsPars)
    .replace('#include <lights_fragment_begin>', LIGHTS_BEGIN)
    .replace('#include <color_fragment>', `#include <color_fragment>\n${colorChunk}`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${normalChunk}`)
    .replace(OUTGOING, outputChunk)
    .replace(
      /}\s*$/,
      `#ifdef CEL_GROUND_INK
\tgNormal = vec4( normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) * 0.5 + 0.5, celOutlineId );
#else
\tgNormal = vec4( normalize( normal ) * 0.5 + 0.5, celOutlineId );
#endif
#ifdef CEL_CLEAR
\tgNormal = vec4( 0.0 ); // zero alpha: blending leaves the normal/ink buffer untouched
#else
\tgl_FragColor.a += celVenue * ( 1.0 + celHalo ); // outline mark 2; hovered halo above (CelBloomPass)
#endif
\t// A single non-finite pixel would be smeared across the whole frame by bloom and the AO denoiser.
\tif ( ! celFinite( gNormal ) ) gNormal = vec4( 0.5, 0.5, 1.0, celOutlineId );
\tif ( ! celFinite( gl_FragColor ) ) gl_FragColor = celFinite( diffuseColor ) ? vec4( diffuseColor.rgb * 0.8, diffuseColor.a ) : vec4( 0.5, 0.5, 0.5, 1.0 );
}
`
    );
}

// Shared by every cel material so they all compile to the same programs (per define set).
function onBeforeCompile(shader) {
  Object.assign(shader.uniforms, this.userData.cel);
  shader.vertexShader = patchVertex(shader.vertexShader);
  if (this.defines.CEL_INSTANCED_BATCH !== undefined) shader.vertexShader = instancedBatchVertex(shader.vertexShader);
  shader.fragmentShader = patchFragment(shader.fragmentShader);
}

// Instanced batches (see Batcher): every instanced micro-part sharing a material draws in one instanced
// multi-draw call, one draw per part. A part's copies sit in consecutive slots of a BatchedMesh, and
// its draw's id texel holds its first slot, so a copy's slot is that plus gl_InstanceID. A copy's
// world matrix carries its part's own origin height in its spare bottom row (an affine matrix's is
// 0 0 0 1): `celGroupY`, the height an instanced mesh's wind measures from (its modelMatrix[3].y),
// zeroed before the matrix is used.
//
// Every vertex looks its copy up, so the batch's textures have fixed power-of-two widths and the
// lookups mask and shift (three's own divide by the texture's width, slow on the GPU).
export const INSTANCED_TEXTURE_WIDTH = { matrices: 1024, colors: 256, ids: 64 };
const INSTANCED_BATCHING_PARS = /* glsl */ `
#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	int celSlot() {
		return int( texelFetch( batchingIdTexture, ivec2( gl_DrawID & 63, gl_DrawID >> 6 ), 0 ).r ) + gl_InstanceID;
	}
	mat4 celSlotMatrix( const in int slot ) {
		int j = slot * 4;
		ivec2 p = ivec2( j & 1023, j >> 10 );
		return mat4( texelFetch( batchingTexture, p, 0 ), texelFetch( batchingTexture, p + ivec2( 1, 0 ), 0 ),
			texelFetch( batchingTexture, p + ivec2( 2, 0 ), 0 ), texelFetch( batchingTexture, p + ivec2( 3, 0 ), 0 ) );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 celSlotColor( const in int slot ) {
		return texelFetch( batchingColorTexture, ivec2( slot & 255, slot >> 8 ), 0 );
	}
#endif
`;
const INSTANCED_BATCHING_VERTEX = /* glsl */ `
#ifdef USE_BATCHING
	mat4 batchingMatrix = celSlotMatrix( celSlot() );
	float celGroupY = batchingMatrix[ 0 ][ 3 ];
	batchingMatrix[ 0 ][ 3 ] = 0.0;
#endif
`;
const BATCH_COLOR = 'getBatchingColor( getIndirectIndex( gl_DrawID ) )';
const INSTANCED_COLOR_VERTEX = must(THREE.ShaderChunk.color_vertex, BATCH_COLOR).replace(BATCH_COLOR, 'celSlotColor( celSlot() )');

function instancedBatchVertex(source) {
  for (const hook of ['#include <batching_pars_vertex>', '#include <batching_vertex>']) must(source, hook);
  return source
    .replace('#include <batching_pars_vertex>', INSTANCED_BATCHING_PARS)
    .replace('#include <batching_vertex>', INSTANCED_BATCHING_VERTEX)
    .replace('#include <color_vertex>', INSTANCED_COLOR_VERTEX);
}

// The twin of a cel material that an instanced batch draws with: the same look and the same live
// uniforms, compiled with the instanced slot lookup.
export function instancedBatchMaterial(source) {
  const material = new THREE.MeshToonMaterial({ color: source.color, emissive: source.emissive, emissiveIntensity: source.emissiveIntensity, side: source.side, vertexColors: source.vertexColors });
  material.name = source.name;
  material.transparent = source.transparent;
  material.depthWrite = source.depthWrite;
  material.defines = { ...source.defines, CEL_INSTANCED_BATCH: '' };
  material.userData.cel = source.userData.cel;
  material.onBeforeCompile = onBeforeCompile;
  return material;
}

// Shadow pass of every instanced batch: three's own depth material (the renderer sets its side and the
// rest from each batch's material, as for any custom depth material) with the instanced slot lookup.
let instancedDepth = null;
export function instancedBatchDepthMaterial() {
  if (!instancedDepth) {
    instancedDepth = new THREE.MeshDepthMaterial();
    instancedDepth.name = 'celInstancedBatchDepth';
    instancedDepth.onBeforeCompile = (shader) => {
      shader.vertexShader = instancedBatchVertex(shader.vertexShader);
    };
  }
  return instancedDepth;
}

// Material ids drive ink lines between materials. Hard surfaces live in [0.04, 0.46]; soft organic ones
// (cream, foliage, petals, clouds) in [0.54, 0.96], which tells the ink pass to skip fine crease lines.
// Unlined ids sit below 0.03 and are never inked: 'none' (turf) at 0.012, and 'foliage' (grass blades)
// at 0.025, which the AO pass also treats as transparent so sub-pixel blades never smudge the ground.
// The sky writes 0.
let outlineCounter = 0;
const FIXED_IDS = { none: 0.012, foliage: 0.025 };
const nextOutlineId = (kind) => FIXED_IDS[kind] ?? (kind === 'soft' ? 0.54 : 0.04) + 0.42 * ((++outlineCounter * 0.6180339887) % 1);

const color = (value) => new THREE.Color(value);
const vec4 = (c, w) => {
  const k = color(c);
  return new THREE.Vector4(k.r, k.g, k.b, w);
};

/**
 * Cinematic cel material. Every surface family (plaster, metal, glass, wood, plastic, asphalt,
 * petals...) is a parameter set over this one lighting model.
 */
export function createCelMaterial(options = {}) {
  const {
    color: base = '#ffffff',
    emissive = '#000000',
    emissiveIntensity = 1,
    side = THREE.FrontSide,
    vertexColors = false,
    detail = null,
    bands = {},
    shadowTint = '#C9C2E8',
    spec = {},
    rim = {},
    reflect = {},
    translucency = {},
    tint2 = null,
    glass = null,
    water = null,
    wind = null,
    aniso = false,
    groundInk = false,
    groundShade = null,
    transfer = false,
    clear = null,
    flow = null,
    outline = 'hard',
    outlineId = nextOutlineId(outline),
    name = 'cel',
  } = options;

  const material = new THREE.MeshToonMaterial({ color: base, emissive, emissiveIntensity, side, vertexColors });
  material.name = name;

  const b = { terminator: 0.47, softness: 0.025, core: 0.74, highlight: 0.8, ...bands };
  const s = { shininess: 40, strength: 0, threshold: 0.5, softness: 0.04, color: '#FFFFFF', ...spec };
  const r = { color: '#FFF4EC', strength: 0.18, threshold: 0.62, softness: 0.06, ...rim };
  const rf = { strength: 0, f0: 0.04, metal: 0, ...reflect };
  const t = { color: '#FFD9E2', strength: 0, ...translucency };

  const uniforms = {
    celShadowTint: { value: color(shadowTint) },
    celBands: { value: new THREE.Vector4(b.terminator, b.softness, b.core, b.highlight) },
    celSpec: { value: new THREE.Vector4(s.shininess, s.strength, s.threshold, s.softness) },
    celSpecColor: { value: color(s.color) },
    celRim: { value: vec4(r.color, r.strength) },
    celRimShape: { value: new THREE.Vector2(r.threshold, r.softness) },
    celReflect: { value: new THREE.Vector3(rf.strength, rf.f0, rf.metal) },
    celTranslucency: { value: vec4(t.color, t.strength) },
    celTint2: { value: tint2 ? vec4(tint2.color, tint2.amount) : new THREE.Vector4(0, 0, 0, 0) },
    celOutlineId: { value: outlineId },
    celSkyZenith: SHARED.skyZenith,
    celSkyHorizon: SHARED.skyHorizon,
    celSkyGround: SHARED.skyGround,
    celSunDirection: SHARED.sunDirection,
    celTime: SHARED.time,
    celVenueFrames: SHARED.venueFrames,
    celVenueGlow: SHARED.venueGlow,
    celGlow: SHARED.glow,
    celGlowShape: SHARED.glowShape,
    celGlowHalo: SHARED.glowHalo,
  };

  const defines = {};
  if (detail) {
    defines.CEL_DETAIL = '';
    if (detail.mode === 'uv') defines.CEL_DETAIL_UV = '';
    if (detail.space === 'world') defines.CEL_DETAIL_WORLD = '';
    uniforms.celDetailMap = { value: detail.texture };
    uniforms.celDetail = { value: new THREE.Vector4(detail.scale ?? 1, detail.albedo ?? 0.3, detail.bump ?? 0.001, 0) };
  }
  if (aniso) defines.CEL_ANISO = '';
  // Normal transfer: micro-organs strewn over a mass (blossoms frosting a crown) carry the normal of
  // the surface they sit on in their geometry, used on both faces, so they light as that mass does.
  if (transfer) defines.CEL_TRANSFER = '';
  // Ground cover (grass) reports the ground's normal and id to the ink pass, so it never draws lines.
  if (groundInk) defines.CEL_GROUND_INK = '';
  // Ground-cover shading: normals lean toward the ground's up vector so a meadow lights as one soft
  // carpet, blades darken toward the root (self-occlusion) and brighten toward sunlit tips.
  if (groundShade) {
    defines.CEL_GROUND_SHADE = '';
    uniforms.celGroundShade = { value: new THREE.Vector4(groundShade.lift ?? 0.6, groundShade.root ?? 0.3, groundShade.tip ?? 0.12, groundShade.rootEnd ?? 0.8) };
    uniforms.celGroundTip = { value: color(groundShade.tipColor ?? '#F6FAD0') };
  }
  // Clear glass: truly see-through. It blends over the scene but writes neither depth nor the
  // normal/id buffer, so whatever is behind keeps its own ink lines, AO and focus.
  if (clear) {
    defines.CEL_CLEAR = '';
    uniforms.celClear = { value: new THREE.Vector4(clear.opacity ?? 0.16, clear.edge ?? 0.75, clear.streak ?? 0.8, 0) };
    material.transparent = true;
    material.depthWrite = false;
    // Falling or rising water: streaks and foam scroll along the surface's uv.y (clear materials only).
    if (flow) {
      defines.CEL_FLOW = '';
      uniforms.celFlow = { value: new THREE.Vector4(flow.columns ?? 80, flow.speed ?? 1.5, flow.dashes ?? 3, flow.foam ?? 0.1) };
    }
  }
  if (glass) {
    defines.CEL_GLASS = '';
    uniforms.celRoom = { value: new THREE.Vector4(glass.width, glass.height, glass.depth, glass.seed ?? Math.random()) };
    uniforms.celRoomWall = { value: color(glass.wall ?? '#F7E6D8') };
    uniforms.celRoomAccent = { value: color(glass.accent ?? '#F2B8C6') };
    uniforms.celRoomLight = { value: new THREE.Vector2(glass.glow ?? 1.0, glass.style ?? 0) };
  }
  if (water) {
    defines.CEL_WATER = '';
    uniforms.celWaterDeep = { value: color(water.deep) };
    uniforms.celWaterShallow = { value: color(water.shallow) };
    uniforms.celWaterShape = { value: new THREE.Vector3(water.causticScale ?? 2.5, water.foam ?? 0.12, water.causticStrength ?? 1) };
  }
  if (wind) {
    defines.CEL_WIND = '';
    uniforms.celWind = SHARED.wind;
    uniforms.celWindShape = { value: new THREE.Vector4(wind.anchor ?? 0, wind.range ?? 1, wind.flutter ?? 0, wind.space === 'world' ? 1 : wind.space === 'object' ? 2 : 0) };
  }

  material.defines = defines;
  material.userData.cel = uniforms;
  material.onBeforeCompile = onBeforeCompile;
  return material;
}

// Window glass gives every pane its own room through uniforms, so no two panes share a material. For
// batching, a pane's room moves into vertex attributes instead (constant over the pane) and every pane
// draws with one twin of the glass material that reads them.
export function isRoomGlass(material) {
  return material.defines?.CEL_GLASS !== undefined && material.defines.CEL_GLASS_ATTR === undefined;
}

export function roomAttributeGlass(source) {
  const material = new THREE.MeshToonMaterial({ color: source.color, emissive: source.emissive, emissiveIntensity: source.emissiveIntensity, side: source.side });
  material.name = source.name;
  material.defines = { ...source.defines, CEL_GLASS_ATTR: '' };
  const { celRoom, celRoomWall, celRoomAccent, celRoomLight, ...shared } = source.userData.cel;
  material.userData.cel = shared;
  material.onBeforeCompile = onBeforeCompile;
  return material;
}

// The room of a pane's glass material, as the vertex attributes `roomAttributeGlass` reads.
export function roomAttributes(material, count) {
  const { celRoom, celRoomWall, celRoomAccent, celRoomLight } = material.userData.cel;
  const room = celRoom.value;
  const wall = celRoomWall.value;
  const accent = celRoomAccent.value;
  const light = celRoomLight.value;
  const fill = (values) => {
    const array = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) array.set(values, i * 4);
    return new THREE.BufferAttribute(array, 4);
  };
  return {
    celRoomA: fill([room.x, room.y, room.z, room.w]),
    celRoomB: fill([wall.r, wall.g, wall.b, light.x]),
    celRoomC: fill([accent.r, accent.g, accent.b, light.y]),
  };
}

// Shadow-pass twin for wind-animated meshes, so cast shadows sway with the geometry.
function onBeforeCompileDepth(shader) {
  Object.assign(shader.uniforms, this.userData.cel);
  const windMain = vertexMain
    .replace('vCelObjPos = transformed;', '')
    .replace('vCelObjNormal = objectNormal;', '')
    .replace('vCelUv = uv;', '')
    .replace(/vCelWorldPos = .*;/, '')
    .replace(/#ifdef CEL_GLASS[\s\S]*?#endif\s*$/, '');
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float celTime;\nuniform vec3 celWind;\nuniform vec4 celWindShape;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${windMain}`);
}

export function windDepthMaterial(material) {
  const depth = new THREE.MeshDepthMaterial();
  depth.defines = { CEL_WIND: '' };
  depth.userData.cel = {
    celTime: SHARED.time,
    celWind: SHARED.wind,
    celWindShape: material.userData.cel.celWindShape,
  };
  depth.onBeforeCompile = onBeforeCompileDepth;
  return depth;
}
