export default `// Glazed ceramic: glass-smooth surface with fine crazing and pooled glaze tone.
vec4 recipe(vec2 uv) {
  vec4 craze = pworley(uv * 14.0 + vec2(pfbm(uv * 8.0, vec2(8.0), 3) * 0.2), vec2(14.0), 1.0);
  float crazing = smoothstep(0.018, 0.0, craze.w);
  float pooling = pwarped(uv * 3.0, vec2(3.0), 4);
  float orange = pfbm(uv * 160.0, vec2(160.0), 2);

  float height = 0.5 + 0.02 * orange - 0.08 * crazing;
  float tone = 0.5 + 0.05 * pooling - 0.05 * crazing + 0.01 * orange;
  return vec4(tone, height, crazing, 1.0);
}
`;
