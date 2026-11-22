export default `// A hydrangea mophead seen close: florets of four broad, rounded sepals packed edge to edge in two
// staggered layers, each with a tiny true flower at its eye, deeper tint in the gaps between them.
// r = tone (sepals light, gaps dark), g = height, b = deep mask (gaps and eyes), a = floret mask.
float hydrangeaFloret(vec2 p, float density, float seed, out float eye) {
  vec2 g = p * density;
  vec2 i = floor(g);
  float best = 0.0;
  eye = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = mod(i + vec2(float(x), float(y)), vec2(density));
      vec2 h = hash22(cell + seed);
      vec2 d = g - (i + vec2(float(x), float(y)) + 0.5 + (h - 0.5) * 0.6);
      float r = length(d);
      float a = atan(d.y, d.x) / 6.2831853 + h.x;
      float s = (fract(a * 4.0) - 0.5) * 2.0; // 0 at a sepal's midline, +-1 between sepals
      float lobe = 0.55 + 0.45 * pow(cos(s * 1.5707963), 0.45);
      float outline = lobe * 0.6 * (0.85 + 0.3 * h.y);
      float m = smoothstep(outline, outline - 0.05, r);
      if (m > best) {
        best = m;
        eye = smoothstep(0.12, 0.0, r);
      }
    }
  }
  return best;
}

vec4 recipe(vec2 uv) {
  float eyeA;
  float eyeB;
  float near = hydrangeaFloret(uv, 10.0, 5.1, eyeA);
  float far = hydrangeaFloret(uv + vec2(0.5 / 10.0), 10.0, 2.7, eyeB);
  float mottle = pfbm(uv * 6.0, vec2(6.0), 3);
  float floret = max(near, far * 0.85);
  float eye = near > 0.5 ? eyeA : eyeB * far;

  float tone = mix(0.32, mix(0.54, 0.63, near), floret) + 0.03 * mottle;
  float height = 0.3 + 0.5 * near + 0.25 * far * (1.0 - near);
  float deep = clamp((1.0 - floret) + eye * 0.8, 0.0, 1.0);
  return vec4(tone, height, deep, floret);
}
`;
