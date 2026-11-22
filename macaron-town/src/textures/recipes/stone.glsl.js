export default `// Fine limestone: compacted grains, scattered mineral flecks, shallow pores and cloudy veining.
vec4 recipe(vec2 uv) {
  vec4 grains = pworley(uv * 64.0, vec2(64.0), 1.0);
  float pores = smoothstep(0.09, 0.0, pworley(uv * 26.0, vec2(26.0), 1.0).x);
  float cloud = pwarped(uv * 4.0, vec2(4.0), 5);
  float vein = smoothstep(0.93, 1.0, pridged(uv * 3.0, vec2(3.0), 5));
  float fleckLight = step(0.94, hash12(floor(uv * 512.0)));
  float fleckDark = step(0.955, hash12(floor(uv * 384.0) + 3.0));

  float height = 0.55 + 0.14 * (grains.x - 0.45) + 0.12 * cloud - 0.28 * pores;
  float tone = 0.5 + 0.06 * cloud + 0.04 * (grains.z - 0.5) + 0.07 * fleckLight - 0.08 * fleckDark - 0.05 * vein;
  return vec4(tone, height, pores, vein);
}
`;
