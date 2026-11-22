export default `// Cumulus surface: billowing cauliflower lobes and wispy shear.
vec4 recipe(vec2 uv) {
  vec4 lobes = pworley(uv * 9.0, vec2(9.0), 1.0);
  float billow = smoothstep(0.9, 0.0, lobes.x);
  float wisp = pwarped(uv * vec2(3.0, 6.0), vec2(3.0, 6.0), 5);
  float fine = pfbm(uv * 40.0, vec2(40.0), 3);

  float height = 0.35 + 0.4 * billow + 0.15 * wisp + 0.05 * fine;
  float tone = 0.5 + 0.06 * billow + 0.04 * wisp;
  return vec4(tone, height, billow, wisp * 0.5 + 0.5);
}
`;
