export default `// Macaron shell / baked meringue: smooth crackled sugar crust with tiny air pocks.
vec4 recipe(vec2 uv) {
  vec4 crust = pworley(uv * 22.0, vec2(22.0), 1.0);
  float crackle = smoothstep(0.025, 0.0, crust.w) * 0.6;
  float pocks = smoothstep(0.22, 0.0, pworley(uv * 95.0, vec2(95.0), 1.0).x);
  float bloom = pwarped(uv * 3.0, vec2(3.0), 4);

  float height = 0.5 + 0.05 * (crust.z - 0.5) - 0.12 * crackle - 0.1 * pocks;
  float tone = 0.5 + 0.03 * bloom - 0.035 * crackle - 0.02 * pocks;
  return vec4(tone, height, pocks, crackle);
}
`;
