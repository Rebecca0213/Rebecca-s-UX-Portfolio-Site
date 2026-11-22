export default `// Hand-forged wrought iron: overlapping hammer facets, scale and mottled powder-coat patina.
vec4 recipe(vec2 uv) {
  vec4 facets = pworley(uv * 30.0, vec2(30.0), 0.9);
  float scale = pfbm(uv * 120.0, vec2(120.0), 3);
  float patina = pwarped(uv * 4.0, vec2(4.0), 5);

  float height = 0.5 + 0.32 * (facets.x - 0.36) + 0.06 * scale;
  float tone = 0.5 + 0.05 * patina + 0.03 * (facets.z - 0.5) + 0.02 * scale;
  return vec4(tone, height, smoothstep(0.2, 0.75, patina * 0.5 + 0.5), facets.w);
}
`;
