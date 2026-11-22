export default `// Riven roofing slate: cleavage laminations along u, mica sparkle and soft dressing marks.
vec4 recipe(vec2 uv) {
  float cleave = pfbm(uv * vec2(2.0, 70.0), vec2(2.0, 70.0), 4);
  float riven = pridged(uv * vec2(3.0, 18.0), vec2(3.0, 18.0), 4);
  float mica = step(0.965, hash12(floor(uv * 360.0)));
  float sheen = pwarped(uv * 3.0, vec2(3.0), 4);

  float height = 0.5 + 0.14 * cleave + 0.1 * (riven - 0.5);
  float tone = 0.5 + 0.06 * cleave + 0.05 * sheen + 0.08 * mica;
  return vec4(tone, height, mica, riven);
}
`;
