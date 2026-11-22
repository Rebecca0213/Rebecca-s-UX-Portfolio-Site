export default `// Clipped boxwood: a close shear of small, glossy, oval leaves in two staggered layers, each leaf
// turned its own way with a pale midrib, deep green in the gaps between them.
// r = tone (leaves light, gaps dark), g = height, b = deep-gap mask, a = leaf mask.
float boxLeaf(vec2 p, float density, float seed, out float rib) {
  vec2 g = p * density;
  vec2 i = floor(g);
  float best = 0.0;
  rib = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = mod(i + vec2(float(x), float(y)), vec2(density));
      vec2 h = hash22(cell + seed);
      float turn = hash12(cell + seed + 5.7) * 3.14159265;
      vec2 axis = vec2(cos(turn), sin(turn));
      vec2 d = g - (i + vec2(float(x), float(y)) + 0.5 + (h - 0.5) * 0.7);
      vec2 q = vec2(dot(d, axis), d.x * axis.y - d.y * axis.x); // along, across the leaf
      float len = 0.62 * (0.85 + 0.3 * h.y);
      float e = (q.x * q.x) / (len * len) + (q.y * q.y) / (len * len * 0.3);
      float m = smoothstep(1.0, 0.82, e);
      if (m > best) {
        best = m;
        rib = smoothstep(0.06, 0.0, abs(q.y)) * smoothstep(1.0, 0.3, e);
      }
    }
  }
  return best;
}

vec4 recipe(vec2 uv) {
  float ribA;
  float ribB;
  float near = boxLeaf(uv, 14.0, 4.1, ribA);
  float far = boxLeaf(uv + vec2(0.5 / 14.0), 14.0, 8.9, ribB);
  float mottle = pfbm(uv * 5.0, vec2(5.0), 3);
  float leaf = max(near, far * 0.85);
  float rib = near > 0.5 ? ribA : ribB * far;

  float tone = mix(0.28, mix(0.52, 0.62, near), leaf) + 0.05 * rib + 0.04 * mottle;
  float height = 0.3 + 0.5 * near + 0.25 * far * (1.0 - near);
  return vec4(tone, height, 1.0 - leaf, leaf);
}
`;
