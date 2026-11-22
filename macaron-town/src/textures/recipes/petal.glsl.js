export default `// Cherry petal, UV-mapped: u across the petal, v from claw (0) to tip (1).
// Veins fan from the claw; b = tip blush mask, a = claw mask.
vec4 recipe(vec2 uv) {
  float x = uv.x - 0.5;
  float theta = atan(x * 1.7, uv.y + 0.05);
  float veins = pow(0.5 + 0.5 * cos(theta * 34.0), 7.0) * smoothstep(0.02, 0.35, uv.y) * smoothstep(1.0, 0.75, uv.y);
  float mottle = pfbm(uv * 7.0, vec2(7.0), 4);
  float crinkle = pfbm(uv * vec2(3.0, 18.0), vec2(3.0, 18.0), 3);
  float blush = smoothstep(0.3, 1.0, uv.y) * (0.75 + 0.25 * mottle);
  float claw = smoothstep(0.24, 0.0, uv.y);

  float height = 0.5 + 0.22 * veins + 0.08 * crinkle;
  float tone = 0.5 + 0.07 * veins - 0.05 * claw + 0.03 * mottle;
  return vec4(tone, height, blush, claw);
}
`;
