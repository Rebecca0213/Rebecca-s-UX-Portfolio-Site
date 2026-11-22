export default `// Italian cypress foliage: dense, feathery sprays of scale leaves all sweeping upward (v is up on the
// sides of the column), in two staggered layers, deep blue-green in the gaps between them.
// r = tone (sprays light, gaps dark), g = height, b = deep-gap mask, a = spray mask.
float cypressSpray(vec2 p, vec2 density, float seed, out float rib) {
  vec2 g = p * density;
  vec2 i = floor(g);
  float best = 0.0;
  rib = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = mod(i + vec2(float(x), float(y)), density);
      vec2 h = hash22(cell + seed);
      float turn = 1.5707963 + (hash12(cell + seed + 2.9) - 0.5) * 0.9;
      vec2 axis = vec2(cos(turn), sin(turn));
      vec2 d = g - (i + vec2(float(x), float(y)) + 0.5 + (h - 0.5) * 0.7);
      vec2 q = vec2(dot(d, axis), d.x * axis.y - d.y * axis.x);
      float len = 0.95 * (0.85 + 0.3 * h.y);
      // A spray: narrow, widest below its middle, with saw-toothed edges of scale-leaf tufts.
      float w = len * 0.32 * (1.0 - smoothstep(-0.6, 1.0, q.x / len)) * (0.85 + 0.15 * sin(q.x * 40.0));
      float m = smoothstep(w, w * 0.7, abs(q.y)) * smoothstep(len, len * 0.85, abs(q.x));
      if (m > best) {
        best = m;
        rib = smoothstep(0.05, 0.0, abs(q.y));
      }
    }
  }
  return best;
}

vec4 recipe(vec2 uv) {
  float ribA;
  float ribB;
  float near = cypressSpray(uv, vec2(16.0, 8.0), 3.3, ribA);
  float far = cypressSpray(uv + vec2(0.5 / 16.0, 0.5 / 8.0), vec2(16.0, 8.0), 7.7, ribB);
  float mottle = pfbm(uv * 4.0, vec2(4.0), 3);
  float spray = max(near, far * 0.85);
  float rib = near > 0.5 ? ribA : ribB * far;

  float tone = mix(0.26, mix(0.5, 0.6, near), spray) + 0.04 * rib + 0.05 * mottle;
  float height = 0.3 + 0.5 * near + 0.25 * far * (1.0 - near);
  return vec4(tone, height, 1.0 - spray, spray);
}
`;
