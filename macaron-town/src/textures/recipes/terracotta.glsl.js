export default `// Fired clay: fine body grain, grog specks and kiln flashing.
vec4 recipe(vec2 uv) {
  float body = pfbm(uv * 40.0, vec2(40.0), 4);
  float grog = step(0.9, hash12(floor(uv * 420.0)));
  float pits = smoothstep(0.1, 0.0, pworley(uv * 60.0, vec2(60.0), 1.0).x);
  float flash = pwarped(uv * 2.0, vec2(2.0), 4);

  float height = 0.5 + 0.12 * body - 0.06 * grog - 0.2 * pits;
  float tone = 0.5 + 0.07 * flash + 0.04 * body - 0.06 * grog - 0.04 * pits;
  return vec4(tone, height, smoothstep(0.2, 0.8, flash * 0.5 + 0.5), 1.0);
}
`;
