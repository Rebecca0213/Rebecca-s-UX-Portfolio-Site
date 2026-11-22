export default `// A crown in full bloom seen from outside: two staggered layers of small five-petal cherry flowers
// (broad petals, notched tips) packed edge to edge, the near layer brighter than the one behind.
// r = tone (petals light, gaps dark), g = height, b = deep-pink mask (gaps and flower eyes), a = petal mask.
float cherryRosette(vec2 p, float density, float seed, out float eye) {
  vec2 g = p * density;
  vec2 i = floor(g);
  float best = 0.0;
  eye = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = mod(i + vec2(float(x), float(y)), vec2(density));
      vec2 h = hash22(cell + seed);
      vec2 d = g - (i + vec2(float(x), float(y)) + 0.5 + (h - 0.5) * 0.7);
      float r = length(d);
      float a = atan(d.y, d.x) / 6.2831853 + h.x;
      float s = (fract(a * 5.0) - 0.5) * 2.0; // 0 at a petal's midline, +-1 between petals
      float lobe = 0.5 + 0.5 * pow(cos(s * 1.5707963), 0.55);
      float outline = (lobe - 0.15 * exp(-(s / 0.18) * (s / 0.18))) * 0.58 * (0.85 + 0.3 * h.y);
      float m = smoothstep(outline, outline - 0.05, r);
      if (m > best) {
        best = m;
        eye = smoothstep(outline * 0.5, 0.0, r);
      }
    }
  }
  return best;
}

vec4 recipe(vec2 uv) {
  float eyeA;
  float eyeB;
  float near = cherryRosette(uv, 9.0, 1.7, eyeA);
  float far = cherryRosette(uv + vec2(0.5 / 9.0), 9.0, 7.3, eyeB);
  float mottle = pfbm(uv * 6.0, vec2(6.0), 3);
  float flower = max(near, far * 0.85);
  float eye = near > 0.5 ? eyeA : eyeB * far;

  float tone = mix(0.3, mix(0.54, 0.64, near), flower) + 0.03 * mottle;
  float height = 0.3 + 0.5 * near + 0.25 * far * (1.0 - near);
  float pink = clamp((1.0 - flower) + eye * 0.75, 0.0, 1.0);
  return vec4(tone, height, pink, flower);
}
`;
