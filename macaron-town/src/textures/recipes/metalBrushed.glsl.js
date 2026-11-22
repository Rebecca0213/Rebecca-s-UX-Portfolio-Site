export default `// Brushed metal (brass, chrome, gold leaf): directional polishing lines, fine scratches, soft patina.
// Alpha carries the brushing pattern so the shader can stretch highlights along it.
vec4 recipe(vec2 uv) {
  float brushing = pfbm(uv * vec2(3.0, 512.0), vec2(3.0, 512.0), 3);
  float hairline = pnoise(uv * vec2(6.0, 1400.0), vec2(6.0, 1400.0));
  float scratches = smoothstep(0.985, 1.0, pridged(uv * vec2(1.0, 24.0) + vec2(pfbm(uv * 6.0, vec2(6.0), 2) * 0.3, 0.0), vec2(1.0, 24.0), 3));
  float patina = pwarped(uv * 3.0, vec2(3.0), 5);

  float height = 0.5 + 0.08 * brushing + 0.04 * hairline - 0.1 * scratches;
  float tone = 0.5 + 0.04 * brushing + 0.03 * hairline + 0.04 * patina + 0.06 * scratches;
  return vec4(tone, height, smoothstep(0.1, 0.65, patina * 0.5 + 0.5), brushing * 0.5 + 0.5);
}
`;
