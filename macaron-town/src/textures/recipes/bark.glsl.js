export default `// Cherry bark: smooth plates split by shallow vertical fissures, ringed with horizontal lenticels.
// Grain runs along v (up the trunk).
vec4 recipe(vec2 uv) {
  vec4 plates = pworley(vec2(uv.x * 9.0, uv.y * 3.0), vec2(9.0, 3.0), 0.9);
  float fissure = smoothstep(0.0, 0.14, plates.w);
  vec2 lc = uv * vec2(28.0, 220.0);
  float lenticel = step(0.86, hash12(floor(lc))) * smoothstep(0.5, 0.15, abs(fract(lc.y) - 0.5));
  float fine = pfbm(uv * 90.0, vec2(90.0), 3);
  float moss = smoothstep(0.62, 0.85, pwarped(uv * 3.0, vec2(3.0), 5) * 0.5 + 0.5);

  float height = 0.25 + 0.6 * fissure + 0.08 * fine - 0.12 * lenticel;
  float tone = 0.5 + 0.14 * (fissure - 0.5) + 0.04 * fine - 0.14 * lenticel + 0.06 * (plates.z - 0.5);
  return vec4(tone, height, moss, lenticel);
}
`;
