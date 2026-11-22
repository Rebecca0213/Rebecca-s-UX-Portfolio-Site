export default `// Sand-float stucco: fine grit, stippled trowel texture and broad hand-finished swirls.
vec4 recipe(vec2 uv) {
  float grit = pfbm(uv * 96.0, vec2(96.0), 3);
  vec4 stipple = pworley(uv * 150.0, vec2(150.0), 0.95);
  float trowel = pwarped(uv * 3.0, vec2(3.0), 5);
  float strokes = pfbm(uv * vec2(3.0, 14.0), vec2(3.0, 14.0), 4);
  float bump = smoothstep(0.55, 0.05, stipple.x);

  float height = 0.48 + 0.16 * grit + 0.2 * bump + 0.1 * trowel + 0.05 * strokes;
  float tone = 0.5 + 0.045 * trowel + 0.025 * grit + 0.02 * strokes + 0.015 * bump;
  float weathering = smoothstep(0.15, 0.85, pfbm(uv * 5.0 + 3.1, vec2(5.0), 5) * 0.5 + 0.5);
  return vec4(tone, height, weathering, 1.0);
}
`;
