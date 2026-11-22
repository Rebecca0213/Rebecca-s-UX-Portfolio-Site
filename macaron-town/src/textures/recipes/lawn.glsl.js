export default `// Mown lawn seen as a surface under the blades: mowing stripes, irregular lush/dry mottling, thatch,
// soil peeking through. (Clover is modelled as real plants by the lawn asset, not painted here.)
vec4 recipe(vec2 uv) {
  float clumps = pwarped(uv * 6.0, vec2(6.0), 5);
  float mottling = pwarped(uv * 3.0 + 1.7, vec2(3.0), 4);
  float blades = pfbm(uv * vec2(180.0, 60.0), vec2(180.0, 60.0), 3);
  float thatch = pfbm(uv * vec2(60.0, 200.0) + 3.1, vec2(60.0, 200.0), 2);
  float stripes = 0.5 + 0.5 * cos(uv.x * 6.2831853 * 4.0);
  float soil = smoothstep(0.62, 0.8, pfbm(uv * 24.0 + 7.0, vec2(24.0), 4) * 0.5 + 0.5);
  float lush = smoothstep(-0.3, 0.5, mottling);

  float height = 0.5 + 0.18 * blades + 0.1 * clumps + 0.05 * thatch - 0.15 * soil;
  float tone = 0.5 + 0.05 * clumps + 0.04 * blades + 0.02 * thatch + 0.035 * (stripes - 0.5) + 0.05 * (lush - 0.5) - 0.06 * soil;
  return vec4(tone, height, lush, soil);
}
`;
