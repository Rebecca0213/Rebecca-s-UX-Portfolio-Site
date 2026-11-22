export default `// Moulded plastic: near-perfect surface with faint orange peel and the odd flow line.
vec4 recipe(vec2 uv) {
  float peel = pfbm(uv * 90.0, vec2(90.0), 3);
  float flow = pfbm(uv * vec2(2.0, 9.0), vec2(2.0, 9.0), 4);

  float height = 0.5 + 0.035 * peel;
  float tone = 0.5 + 0.012 * peel + 0.015 * flow;
  return vec4(tone, height, 0.0, 1.0);
}
`;
