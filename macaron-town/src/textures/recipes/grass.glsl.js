export default `// Single grass blade, UV-mapped: v from root (0) to tip (1). Parallel veins, sun-bleached tip.
vec4 recipe(vec2 uv) {
  float x = uv.x - 0.5;
  float veins = 0.5 + 0.5 * cos(x * 6.2831853 * 5.0);
  float streak = pfbm(uv * vec2(4.0, 40.0), vec2(4.0, 40.0), 3);
  float root = smoothstep(0.35, 0.0, uv.y);
  float tip = smoothstep(0.65, 1.0, uv.y);

  float height = 0.5 + 0.15 * veins + 0.05 * streak;
  float tone = 0.42 + 0.22 * uv.y + 0.04 * veins + 0.04 * streak - 0.1 * root;
  return vec4(tone, height, tip, root);
}
`;
