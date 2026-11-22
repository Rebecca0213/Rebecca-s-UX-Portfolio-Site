export default `// Whipped cream: spatula ridges that meander, soft folds and a faint aerated grain.
vec4 recipe(vec2 uv) {
  float warp = pfbm(uv * 4.0, vec2(4.0), 4);
  float ridges = 0.5 + 0.5 * sin((uv.y * 14.0 + warp * 2.4) * 6.2831853);
  float folds = pwarped(uv * 5.0, vec2(5.0), 5);
  float air = smoothstep(0.35, 0.0, pworley(uv * 110.0, vec2(110.0), 1.0).x);

  float height = 0.5 + 0.2 * (ridges - 0.5) + 0.24 * folds - 0.05 * air;
  float tone = 0.5 + 0.03 * folds + 0.02 * (ridges - 0.5) - 0.015 * air;
  return vec4(tone, height, smoothstep(0.6, 0.95, ridges), 1.0);
}
`;
