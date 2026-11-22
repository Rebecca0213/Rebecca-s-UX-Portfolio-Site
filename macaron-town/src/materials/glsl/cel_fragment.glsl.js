export default `// ---- injected after <common> (fragment) ----
layout(location = 1) out highp vec4 gNormal;

uniform vec3 celShadowTint;
uniform vec4 celBands;        // x: terminator, y: softness, z: core-light level, w: highlight threshold
uniform vec4 celSpec;         // x: shininess, y: strength, z: threshold, w: softness
uniform vec3 celSpecColor;
uniform vec4 celRim;          // rgb, strength
uniform vec2 celRimShape;     // threshold, softness
uniform vec3 celReflect;      // x: strength, y: F0, z: metal tint (0 = dielectric, 1 = tinted by albedo)
uniform vec4 celTranslucency; // rgb, strength
uniform vec4 celTint2;        // rgb, amount (driven by the detail mask in .b)
uniform float celOutlineId;
uniform vec3 celSkyZenith;
uniform vec3 celSkyHorizon;
uniform vec3 celSkyGround;
uniform vec3 celSunDirection; // world space, toward the sun
uniform float celTime;
uniform mat4 celVenueFrames[4]; // world -> each venue's box ([-1, 1] inside; spare slots far away)
uniform vec4 celVenueGlow;    // how much each venue glows under the pointer (Hover)
uniform vec3 celGlow;         // the glow's colour
uniform vec4 celGlowShape;    // x lift up close, y extra lift from afar, z rim light, w room boost
uniform float celGlowHalo;    // the halo's strength (written to the colour's alpha for the bloom)

varying vec3 vCelObjPos;
varying vec3 vCelObjNormal;
varying vec3 vCelWorldPos;
varying vec2 vCelUv;

#ifdef CEL_DETAIL
uniform sampler2D celDetailMap;
uniform vec4 celDetail;       // x: scale, y: albedo amount, z: bump height (world units), w: unused
#endif

#ifdef CEL_CLEAR
uniform vec4 celClear;       // x: face opacity, y: edge opacity, z: highlight streaks
#endif

#ifdef CEL_FLOW
uniform vec4 celFlow;        // x: streak columns around (uv.x), y: flow speed (uv.y per s), z: dashes along uv.y, w: foam band at uv.y = 1
#endif

#ifdef CEL_GROUND_SHADE
uniform vec4 celGroundShade;  // x: normal lift toward up, y: root darkening, z: tip lightening, w: root gradient end (uv.y)
uniform vec3 celGroundTip;
#endif

float celShadow = 1.0;
float celLit = 0.0;
vec4 celSurface = vec4(0.5, 0.5, 0.0, 1.0);

float celStep(float edge, float x, float soft) {
  float w = max(fwidth(x) * 0.85, soft);
  return smoothstep(edge - w, edge + w, x);
}

// NaN/Inf test on the bit pattern: survives fast-math compilers (Metal) that fold isnan() away.
bool celFinite(vec4 v) {
  return all(notEqual(floatBitsToUint(v) & 0x7f800000u, uvec4(0x7f800000u)));
}

// normalize() that falls back instead of dividing by zero (edge-on micro-triangles at distance).
vec3 celNormalize(vec3 v, vec3 fallback) {
  float l2 = dot(v, v);
  return l2 > 1e-30 ? v * inversesqrt(l2) : fallback;
}

float celHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec4 celSampleDetail() {
#ifdef CEL_DETAIL
  #ifdef CEL_DETAIL_UV
  return texture2D(celDetailMap, vCelUv * celDetail.x);
  #else
  vec3 n = normalize(vCelObjNormal);
  vec3 w = pow(abs(n), vec3(5.0));
  w /= (w.x + w.y + w.z + 1e-5);
  vec3 p = vCelObjPos * celDetail.x;
  return texture2D(celDetailMap, p.zy) * w.x + texture2D(celDetailMap, p.xz) * w.y + texture2D(celDetailMap, p.xy) * w.z;
  #endif
#else
  return vec4(0.5, 0.5, 0.0, 1.0);
#endif
}

// Stylised sky/ground environment for reflections: banded, with a bright horizon glint.
vec3 celEnvironment(vec3 dirWorld) {
  float h = dirWorld.y;
  vec3 sky = mix(celSkyHorizon, celSkyZenith, smoothstep(0.03, 0.4, h));
  vec3 ground = mix(celSkyHorizon * 0.92, celSkyGround, smoothstep(0.0, 0.2, -h));
  vec3 env = mix(ground, sky, smoothstep(-0.015, 0.015, h));
  float sun = max(dot(dirWorld, celSunDirection), 0.0);
  env += vec3(1.0, 0.95, 0.85) * smoothstep(0.995, 0.999, sun) * 3.0;
  env += vec3(0.3) * (1.0 - smoothstep(0.0, 0.03, abs(h - 0.035)));
  return env;
}

// Mikkelsen derivative bump on unnormalised screen-space deltas: slope is in true world units.
vec3 celPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sigmaX = dFdx(surfPos);
  vec3 sigmaY = dFdy(surfPos);
  vec3 r1 = cross(sigmaY, surfNorm);
  vec3 r2 = cross(surfNorm, sigmaX);
  float det = dot(sigmaX, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  // Degenerate derivatives (det = 0, grad = 0) would normalise a zero vector into NaN.
  return celNormalize(abs(det) * surfNorm - grad, surfNorm);
}

#ifdef CEL_GLASS
varying vec3 vCelObjView;
#ifdef CEL_GLASS_ATTR
flat varying vec4 vCelRoomA;
flat varying vec4 vCelRoomB;
flat varying vec4 vCelRoomC;
#define celRoom vCelRoomA
#define celRoomWall vCelRoomB.rgb
#define celRoomAccent vCelRoomC.rgb
#define celRoomLight vec2(vCelRoomB.a, vCelRoomC.a)
#else
uniform vec4 celRoom;        // x: width, y: height, z: depth (object units), w: seed
uniform vec3 celRoomWall;
uniform vec3 celRoomAccent;
uniform vec2 celRoomLight;   // x: interior glow, y: style (0 home, 1 patisserie, 2 bookshop, 3 salon)
#endif

vec3 celWallpaper(vec2 q, float seed) {
  float style = floor(fract(seed * 7.13) * 3.0);
  vec3 base = celRoomWall;
  if (style < 0.5) {
    float stripe = step(0.5, fract(q.x * 9.0));
    return base * (0.92 + 0.08 * stripe);
  } else if (style < 1.5) {
    vec2 g = fract(q * vec2(7.0, 9.0)) - 0.5;
    float dots = smoothstep(0.12, 0.08, length(g));
    return mix(base, base * 0.86, dots);
  }
  float dado = step(q.y, 0.38);
  return mix(base, base * vec3(0.9, 0.95, 0.92), dado) * (1.0 - 0.25 * smoothstep(0.02, 0.0, abs(q.y - 0.38)));
}

vec3 celShelves(vec2 q, float seed, float books) {
  float row = floor(q.y * 4.0);
  float inRow = fract(q.y * 4.0);
  float plank = smoothstep(0.1, 0.06, inRow);
  vec3 wood = vec3(0.62, 0.45, 0.36);
  if (books > 0.5) {
    float spine = floor(q.x * 26.0 + row * 3.7);
    float h = celHash(vec2(spine, row + seed));
    float height = 0.55 + 0.35 * h;
    vec3 bookCol = 0.55 + 0.45 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
    bookCol = mix(bookCol, vec3(0.95, 0.88, 0.8), 0.35);
    float isBook = step(inRow, height) * step(0.12, inRow) * step(0.06, fract(q.x * 26.0 + row * 3.7));
    return mix(mix(celRoomWall * 0.7, bookCol, isBook), wood, plank);
  }
  float slot = fract(q.x * 6.0) - 0.5;
  float cakeId = celHash(vec2(floor(q.x * 6.0), row + seed));
  float cakeH = 0.32 + 0.2 * cakeId;
  float cake = step(abs(slot), 0.3) * step(0.12, inRow) * step(inRow, 0.12 + cakeH);
  float frosting = cake * step(0.12 + cakeH * 0.72, inRow);
  vec3 cakeCol = mix(vec3(1.0, 0.86, 0.78), vec3(0.98, 0.72, 0.8), cakeId);
  float cherry = step(length(vec2(slot * 1.6, inRow - 0.17 - cakeH)), 0.06) * step(0.5, cakeId);
  vec3 col = mix(celRoomWall * 0.8, cakeCol, cake);
  col = mix(col, vec3(1.0, 0.97, 0.94), frosting);
  col = mix(col, vec3(0.9, 0.25, 0.35), cherry);
  return mix(col, wood * 1.2, plank);
}

// A gallery wall: two or three framed paintings at eye level, each its own palette of soft colour
// fields and a pale disc, in gilt frames, each lit by a warm picture light.
vec3 celGallery(vec2 q, float seed) {
  vec3 col = mix(celRoomWall, vec3(0.98, 0.97, 0.95), 0.55);
  col *= 1.0 - 0.15 * step(q.y, 0.1);
  float n = 2.0 + step(0.5, fract(seed * 5.3));
  float slot = floor(q.x * n);
  float h = celHash(vec2(slot, floor(seed * 97.0)));
  vec2 c = vec2((slot + 0.5) / n, 0.56);
  vec2 extent = vec2(0.3 / n + 0.04 * h, 0.13 + 0.07 * fract(h * 7.3));
  vec2 e = abs(q - c) - extent;
  float inside = step(max(e.x, e.y), 0.0);
  float frame = inside * step(-0.022, max(e.x, e.y));
  vec2 u = (q - c) / extent;
  vec3 a = 0.55 + 0.45 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
  vec3 b = 0.55 + 0.45 * cos(6.2831 * (h + 0.4 + vec3(0.0, 0.33, 0.67)));
  vec3 art = mix(a, b, step(0.0, u.y + 0.35 * sin(u.x * 3.0 + h * 9.0)));
  art = mix(art, vec3(0.98, 0.95, 0.88), step(length(u - vec2(0.35, 0.3)), 0.28));
  col = mix(col, art, inside);
  col = mix(col, vec3(0.8, 0.64, 0.38), frame);
  float pool = exp(-pow((q.x - c.x) * n * 2.2, 2.0)) * smoothstep(c.y + extent.y + 0.25, c.y + extent.y, q.y) * step(c.y - extent.y, q.y);
  return col * (1.0 + 0.25 * pool);
}

vec3 celInterior(vec3 o, vec3 d, out float glow) {
  vec3 hs = vec3(celRoom.x * 0.5, celRoom.y * 0.5, celRoom.z);
  vec3 inv = 1.0 / (d + vec3(1e-5));
  vec3 t1 = (vec3(-hs.x, -hs.y, -hs.z) - o) * inv;
  vec3 t2 = (vec3(hs.x, hs.y, 0.0) - o) * inv;
  vec3 tf = max(t1, t2);
  float t = min(min(tf.x, tf.y), tf.z);
  vec3 h = o + d * t;
  float seed = celRoom.w;
  vec3 col;
  float shade = 1.0;
  if (tf.z <= tf.x && tf.z <= tf.y) {
    vec2 q = h.xy / celRoom.xy + 0.5;
    if (celRoomLight.y > 3.5) col = celGallery(q, seed);
    else if (celRoomLight.y > 0.5 && celRoomLight.y < 1.5) col = celShelves(q, seed, 0.0);
    else if (celRoomLight.y > 1.5 && celRoomLight.y < 2.5) col = celShelves(q, seed, 1.0);
    else {
      col = celWallpaper(q, seed);
      vec2 frame = abs(q - vec2(0.5 + (fract(seed * 3.1) - 0.5) * 0.3, 0.62)) - vec2(0.12, 0.1);
      float pic = step(max(frame.x, frame.y), 0.0);
      float border = pic * step(-0.018, max(frame.x, frame.y));
      vec3 art = mix(celRoomAccent, vec3(0.75, 0.86, 0.95), step(0.55, q.y));
      col = mix(col, art, pic);
      col = mix(col, vec3(0.85, 0.7, 0.45), border);
    }
    shade = 0.82;
  } else if (tf.y < tf.x) {
    if (d.y < 0.0) {
      float plank = step(0.06, fract(h.x / celRoom.x * 7.0 + 0.5));
      col = mix(vec3(0.55, 0.38, 0.3), vec3(0.72, 0.52, 0.4), celHash(vec2(floor(h.x / celRoom.x * 7.0), 3.0))) * mix(0.75, 1.0, plank);
      shade = 0.7;
    } else {
      col = vec3(1.0, 0.95, 0.88);
      shade = 1.0;
    }
  } else {
    vec2 q = vec2(h.z / celRoom.z, h.y / celRoom.y + 0.5);
    col = (celRoomLight.y > 3.5 ? celGallery(q, seed + 0.37) : celWallpaper(q, seed)) * 0.9;
    shade = 0.75;
  }
  // warm pendant lamp hanging from the ceiling centre
  vec3 lampPos = vec3((fract(seed * 5.7) - 0.5) * celRoom.x * 0.3, hs.y * 0.6, -hs.z * 0.55);
  float lampDist = length(h - lampPos);
  glow = 1.0 / (1.0 + lampDist * lampDist * 6.0 / (celRoom.x * celRoom.x));
  float bulb = smoothstep(0.08, 0.0, length((o + d * (lampPos.z - o.z) / d.z) - lampPos) / celRoom.x);
  col *= shade * (0.55 + 0.75 * glow);
  col += vec3(1.0, 0.86, 0.6) * bulb * 2.5;
  return col;
}

// Curtains hang just behind the glass, tied back at about a third of the height.
vec4 celCurtains(vec2 q, float seed) {
  float tie = 0.42;
  float gather = 0.16 + 0.09 * smoothstep(0.0, 0.5, abs(q.y - tie)) * (q.y > tie ? 1.0 : 0.6);
  float side = q.x < 0.5 ? q.x : 1.0 - q.x;
  float inside = step(side, gather) * step(0.05, q.y);
  float folds = 0.78 + 0.22 * sin((side / gather) * 18.0 + seed * 9.0);
  float tieBand = smoothstep(0.03, 0.015, abs(q.y - tie)) * inside;
  vec3 col = celRoomAccent * folds;
  col = mix(col, celRoomAccent * 0.7, tieBand);
  float pelmet = step(0.92, q.y);
  col = mix(col, celRoomAccent * 0.92, pelmet);
  return vec4(col, max(inside, pelmet));
}
#endif

#ifdef CEL_WATER
uniform vec3 celWaterDeep;
uniform vec3 celWaterShallow;
uniform vec3 celWaterShape;   // x: caustic cells per unit, y: foam width (in uv radius), z: caustic strength

vec2 celHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Animated cellular pattern: x = F1, y = F2.
vec2 celCells(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = celHash2(i + g);
      o = 0.5 + 0.45 * sin(t + 6.2831 * o);
      float d = length(g + o - f);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return vec2(f1, f2);
}
#endif
`;
