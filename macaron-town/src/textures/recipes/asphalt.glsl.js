export default `// Rolled asphalt: small angular aggregate scattered through dark bitumen (not packed edge to edge),
// fines, tyre-polished wear and a few hairline cracks in rare patches.
// b = aggregate mask (catches light), a = crack mask.
vec4 recipe(vec2 uv) {
  vec4 agg = pworley(uv * 72.0, vec2(72.0), 1.0);
  // Only some cells hold a stone, and each stone sits well inside its cell.
  float stone = smoothstep(0.1, 0.17, agg.w) * step(0.52, agg.z);
  vec4 grit = pworley(uv * 210.0, vec2(210.0), 1.0);
  float fines = smoothstep(0.06, 0.12, grit.w) * step(0.62, grit.z);
  float binder = pfbm(uv * 40.0, vec2(40.0), 3);
  float wear = pwarped(uv * 3.0, vec2(3.0), 5);
  vec4 crackCells = pworley(uv * 5.0 + vec2(pfbm(uv * 10.0, vec2(10.0), 3) * 0.12), vec2(5.0), 1.0);
  float crackGate = smoothstep(0.55, 0.8, pfbm(uv * 7.0, vec2(7.0), 3) * 0.5 + 0.5);
  float cracks = smoothstep(0.025, 0.0, crackCells.w) * crackGate;

  float height = 0.45 + 0.2 * stone * (0.6 + 0.4 * agg.z) + 0.05 * fines + 0.03 * binder - 0.25 * cracks;
  float tone = 0.48 + stone * (0.06 + (agg.z - 0.5) * 0.22) + 0.03 * fines + 0.02 * binder + 0.05 * wear - 0.12 * cracks;
  return vec4(tone, height, stone, cracks);
}
`;
