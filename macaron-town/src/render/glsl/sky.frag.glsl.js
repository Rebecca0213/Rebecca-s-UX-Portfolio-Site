export default `layout(location = 1) out highp vec4 gNormal;

uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uSunDir;   // toward the sun: lights the sea of clouds and places the sun's glow
uniform vec3 uSunColor;
uniform float uTime;

// Sea of clouds far below the island: a world-anchored plane of cumulus tops, so it parallaxes as
// the camera orbits, banded by the sun like the rest of the town and hazed into the horizon.
uniform vec4 uSea;        // x: height, y: feature scale (1/units), z: coverage threshold, w: haze distance
uniform vec3 uSeaLit;
uniform vec3 uSeaShade;
uniform vec3 uSeaDeep;
uniform vec4 uCasters[4]; // xyz centre, w radius: the island and islets, shadowed onto the sea

varying vec3 vDir;

float skyHash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
}

float skyNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x), mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float skyFbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    s += a * skyNoise(p);
    p = p * 2.03 + vec2(13.1, 7.7);
    a *= 0.5;
  }
  return s;
}

// Value noise with its analytic gradient (x: value, yz: d/dp), so the cloud tops can be lit
// without extra samples.
vec3 skyNoised(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = skyHash(i);
  float b = skyHash(i + vec2(1.0, 0.0));
  float c = skyHash(i + vec2(0.0, 1.0));
  float d = skyHash(i + vec2(1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k4 = a - b - c + d;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}

// x: the cloud field (five octaves, for the puffs' outlines); yz: the gradient of its three broad
// octaves only, so the lighting shapes whole domes instead of speckling every wisp.
vec3 seaFbm(vec2 p) {
  vec3 s = vec3(0.0);
  float a = 0.5;
  float k = 1.0;
  for (int i = 0; i < 5; i++) {
    vec3 n = skyNoised(p);
    s.x += a * n.x;
    if (i < 3) s.yz += a * k * n.yz;
    p = p * 2.03 + vec2(13.1, 7.7);
    k *= 2.03;
    a *= 0.46;
  }
  return s;
}

vec3 cloudSea(vec3 d, vec3 haze) {
  float t = min((uSea.x - cameraPosition.y) / d.y, 6.0 * uSea.w);
  vec2 p = cameraPosition.xz + d.xz * t;
  vec2 q = p * uSea.y + vec2(uTime * 0.012, uTime * 0.005);
  // A broad warp bunches the field into billowing heaps rather than even blotches.
  q += (vec2(skyNoise(q * 0.35 + 3.7), skyNoise(q * 0.35 - 5.1)) - 0.5) * 1.6;
  vec3 n = seaFbm(q);
  // Puffs: the field above the coverage threshold, antialiased by its own screen footprint.
  float w = max(fwidth(n.x) * 1.2, 0.012);
  float body = smoothstep(uSea.z - w, uSea.z + w, n.x);
  // Each puff is a dome: height rises like a square root from its edge, so its rim is steep and
  // its crown flat. Lit as a heightfield by the sun and cut into two cel bands.
  float above = max(n.x - uSea.z, 0.0);
  float steep = 1.0 + 0.9 * (1.0 - smoothstep(0.0, 0.14, above));
  vec3 N = normalize(vec3(-n.y * steep * 2.4, 1.0, -n.z * steep * 2.4));
  float ndl = dot(N, uSunDir);
  float aw = max(fwidth(ndl), 0.02);
  float lit = smoothstep(0.52 - aw, 0.52 + aw, ndl);
  // Crevices between the puffs sink into shade.
  lit *= smoothstep(0.0, 0.05, above);
  vec3 sea = mix(uSeaDeep, mix(uSeaShade, uSeaLit, lit), body);
  // The island and islets cast soft shadows straight along the sun onto the sea.
  float shadow = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 c = uCasters[i];
    vec3 s = c.xyz - uSunDir * ((c.y - uSea.x) / max(uSunDir.y, 0.05));
    float r = length(p - s.xz) / max(c.w, 1e-3);
    shadow = max(shadow, 1.0 - smoothstep(0.72, 1.3, r));
  }
  sea = mix(sea, sea * vec3(0.8, 0.78, 0.93), shadow * 0.8);
  return mix(sea, haze, 1.0 - exp(-t / uSea.w));
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;

  vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.62, h));
  vec3 below = mix(uHorizon, uBelow, smoothstep(0.0, -0.4, h));
  if (h < 0.0) col = cloudSea(d, below);
  col = mix(col, uHorizon * 1.03, (1.0 - smoothstep(0.0, 0.1, abs(h - 0.01))) * 0.45);

  // The sun's glow and disc.
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 7.0) * 0.16 + pow(s, 80.0) * 0.4);
  col += uSunColor * smoothstep(0.99935, 0.9997, s) * 2.2;

  // Painterly fair-weather cirrus on a virtual sky plane, thresholded into crisp cel shapes and lit by
  // the sky's own light.
  if (h > 0.04) {
    vec2 plane = d.xz / max(h + 0.12, 0.04);
    float wisp = skyFbm(plane * vec2(0.9, 2.6) + vec2(uTime * 0.004, 0.0));
    float cirrus = smoothstep(0.58, 0.66, wisp) * smoothstep(0.06, 0.3, h) * (1.0 - smoothstep(0.55, 0.85, h));
    float cirrusShade = smoothstep(0.58, 0.72, skyFbm(plane * vec2(0.9, 2.6) + vec2(uTime * 0.004 + 0.02, -0.03)));
    vec3 light = mix(uHorizon, vec3(dot(uHorizon, vec3(0.3333))), 0.35) * 1.06;
    vec3 cloud = light * mix(vec3(0.96, 0.93, 0.98), vec3(1.0, 0.99, 0.97), cirrusShade);
    col = mix(col, cloud, cirrus * 0.6);
  }

  gl_FragColor = vec4(col, 1.0);
  gNormal = vec4(0.5, 0.5, 1.0, 0.0);
}
`;
