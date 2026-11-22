export default `// A ginkgo crown in autumn seen from outside: two staggered layers of fan-shaped leaves (wavy margins,
// cleft in the middle, veins fanning from the stalk) lying every which way, the near layer brighter.
// r = tone (leaves light, gaps dark), g = height, b = amber mask (gaps and leaf bases), a = leaf mask.
float ginkgoFan(vec2 p, float density, float seed, out float base) {
  vec2 g = p * density;
  vec2 i = floor(g);
  float best = 0.0;
  base = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = mod(i + vec2(float(x), float(y)), vec2(density));
      vec2 h = hash22(cell + seed);
      float turn = hash12(cell + seed + 3.1) * 6.2831853;
      vec2 dir = vec2(cos(turn), sin(turn));
      // The fan's stalk end sits behind the cell centre, the blade opens toward \`dir\`.
      vec2 origin = i + vec2(float(x), float(y)) + 0.5 + (h - 0.5) * 0.6 - dir * 0.42;
      vec2 d = g - origin;
      float r = length(d);
      float a = atan(d.x * dir.y - d.y * dir.x, dot(d, dir)); // angle from the leaf's axis
      float s = a / 1.05;
      if (abs(s) > 1.0) continue;
      float corner = 0.78 + 0.22 * sqrt(max(cos(s * 1.5707963), 0.0));
      float outline = 0.95 * (0.85 + 0.3 * h.y) * corner * (1.0 - 0.22 * exp(-(s / 0.09) * (s / 0.09))) * (1.0 + 0.035 * sin(s * 9.0 * 3.14159));
      float m = smoothstep(outline, outline - 0.05, r) * smoothstep(0.0, 0.08, r);
      if (m > best) {
        best = m;
        base = smoothstep(outline * 0.45, 0.0, r);
      }
    }
  }
  return best;
}

vec4 recipe(vec2 uv) {
  float baseA;
  float baseB;
  float near = ginkgoFan(uv, 8.0, 2.3, baseA);
  float far = ginkgoFan(uv + vec2(0.5 / 8.0), 8.0, 9.1, baseB);
  float mottle = pfbm(uv * 6.0, vec2(6.0), 3);
  float leaf = max(near, far * 0.85);
  float base = near > 0.5 ? baseA : baseB * far;

  float tone = mix(0.3, mix(0.52, 0.63, near), leaf) + 0.04 * mottle;
  float height = 0.3 + 0.5 * near + 0.25 * far * (1.0 - near);
  float amber = clamp((1.0 - leaf) + base * 0.5, 0.0, 1.0);
  return vec4(tone, height, amber, leaf);
}
`;
