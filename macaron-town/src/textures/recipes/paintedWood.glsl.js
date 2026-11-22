export default `// Painted timber (doors, shutters, benches): grain telegraphing through brushed enamel, chipped edges.
vec4 recipe(vec2 uv) {
  float warp = pfbm(uv * vec2(2.0, 5.0), vec2(2.0, 5.0), 4);
  float rings = fract(uv.y * 18.0 + warp * 1.5);
  float grain = smoothstep(0.0, 0.12, rings) * smoothstep(1.0, 0.75, rings);
  float brush = pfbm(uv * vec2(5.0, 90.0), vec2(5.0, 90.0), 3);
  float chips = smoothstep(0.78, 0.86, pwarped(uv * 8.0, vec2(8.0), 4) * 0.5 + 0.5);

  float height = 0.5 + 0.06 * (grain - 0.5) + 0.06 * brush - 0.1 * chips;
  float tone = 0.5 + 0.025 * (grain - 0.5) + 0.03 * brush - 0.1 * chips;
  return vec4(tone, height, chips, grain);
}
`;
