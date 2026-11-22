export default `// Cotton canvas: plain over-under weave with slubbed yarn and a light nap.
vec4 recipe(vec2 uv) {
  vec2 c = uv * 180.0;
  float warpYarn = 0.5 + 0.5 * cos(c.x * 6.2831853);
  float weftYarn = 0.5 + 0.5 * cos(c.y * 6.2831853);
  float over = mod(floor(c.x) + floor(c.y), 2.0);
  float weave = mix(warpYarn * smoothstep(0.0, 0.5, fract(c.y)) * smoothstep(1.0, 0.5, fract(c.y)),
                    weftYarn * smoothstep(0.0, 0.5, fract(c.x)) * smoothstep(1.0, 0.5, fract(c.x)), over);
  float slub = pfbm(uv * vec2(6.0, 140.0), vec2(6.0, 140.0), 2) + pfbm(uv * vec2(140.0, 6.0), vec2(140.0, 6.0), 2);
  float nap = pfbm(uv * 60.0, vec2(60.0), 3);

  float height = 0.45 + 0.35 * weave + 0.05 * slub;
  float tone = 0.5 + 0.08 * (weave - 0.5) + 0.03 * slub + 0.02 * nap;
  return vec4(tone, height, weave, 1.0);
}
`;
