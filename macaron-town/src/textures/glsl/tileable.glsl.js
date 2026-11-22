export default `// Seamlessly tiling noise: every lattice coordinate wraps by \`period\`, so a texture sampled over
// uv in [0, 1) with an integer-scaled period tiles without seams.

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float gradAt(vec2 cell, vec2 period, vec2 offset) {
  vec2 g = hash22(mod(cell, period)) * 2.0 - 1.0;
  return dot(normalize(g + 1e-5), offset);
}

// Gradient noise in roughly [-1, 1].
float pnoise(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = gradAt(i, period, f);
  float b = gradAt(i + vec2(1.0, 0.0), period, f - vec2(1.0, 0.0));
  float c = gradAt(i + vec2(0.0, 1.0), period, f - vec2(0.0, 1.0));
  float d = gradAt(i + vec2(1.0, 1.0), period, f - vec2(1.0, 1.0));
  return 1.42 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float pfbm(vec2 p, vec2 period, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= octaves) break;
    sum += amp * pnoise(p, period);
    norm += amp;
    p *= 2.0;
    period *= 2.0;
    amp *= 0.5;
  }
  return sum / norm;
}

float pridged(vec2 p, vec2 period, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= octaves) break;
    float r = 1.0 - abs(pnoise(p, period));
    sum += amp * r * r;
    norm += amp;
    p *= 2.0;
    period *= 2.0;
    amp *= 0.5;
  }
  return sum / norm;
}

// Tileable cellular noise: x = F1, y = F2, z = per-cell random id, w = distance to cell edge.
vec4 pworley(vec2 p, vec2 period, float jitter) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 9.0;
  float f2 = 9.0;
  float id = 0.0;
  vec2 nearest = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = mod(i + g, period);
      vec2 r = g + 0.5 + (hash22(cell) - 0.5) * jitter - f;
      float d = dot(r, r);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash12(cell + 7.7);
        nearest = r;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  // Exact distance to the cell border (second pass, Inigo Quilez).
  float edge = 9.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 cell = mod(i + g, period);
      vec2 r = g + 0.5 + (hash22(cell) - 0.5) * jitter - f;
      vec2 diff = r - nearest;
      if (dot(diff, diff) > 1e-5) edge = min(edge, dot(0.5 * (nearest + r), normalize(diff)));
    }
  }
  return vec4(sqrt(f1), sqrt(f2), id, edge);
}

// Domain-warped fbm, the workhorse for organic variation.
float pwarped(vec2 p, vec2 period, int octaves) {
  vec2 q = vec2(pfbm(p, period, 3), pfbm(p + vec2(5.2, 1.3), period, 3));
  return pfbm(p + 1.6 * q, period, octaves);
}
`;
