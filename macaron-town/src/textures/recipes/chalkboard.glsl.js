export default `// Slate chalkboard: matte board with wiped chalk haze and eraser arcs. b = chalk dust.
vec4 recipe(vec2 uv) {
  float haze = pwarped(uv * 2.0, vec2(2.0), 5) * 0.5 + 0.5;
  float arcs = 0.5 + 0.5 * sin((length(uv - vec2(0.3, -0.4)) * 9.0 + pfbm(uv * 3.0, vec2(3.0), 3)) * 6.2831853);
  float grain = pfbm(uv * 200.0, vec2(200.0), 2);

  float dust = smoothstep(0.45, 0.85, haze) * (0.45 + 0.55 * arcs);
  float height = 0.5 + 0.03 * grain;
  float tone = 0.5 + 0.03 * grain;
  return vec4(tone, height, dust, 1.0);
}
`;
