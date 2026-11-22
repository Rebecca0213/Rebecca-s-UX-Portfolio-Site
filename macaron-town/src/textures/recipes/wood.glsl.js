export default `// Flat-sawn timber, grain along u: growth rings warped by knots, long fibres and open pores.
vec4 recipe(vec2 uv) {
  float warp = pfbm(uv * vec2(2.0, 5.0), vec2(2.0, 5.0), 4);
  vec2 knotCell = pworley(uv * vec2(2.0, 3.0), vec2(2.0, 3.0), 0.8).xy;
  float knot = smoothstep(0.22, 0.0, knotCell.x);
  float rings = fract(uv.y * 20.0 + warp * 1.7 + knot * 1.4);
  float earlywood = smoothstep(0.0, 0.1, rings) * smoothstep(1.0, 0.7, rings);
  float fibres = pfbm(uv * vec2(4.0, 240.0), vec2(4.0, 240.0), 3);
  float pores = step(0.84, pnoise(uv * vec2(48.0, 640.0), vec2(48.0, 640.0)) * 0.5 + 0.5);

  float height = 0.5 + 0.12 * (earlywood - 0.5) + 0.1 * fibres - 0.14 * pores - 0.1 * knot;
  float tone = 0.5 + 0.1 * (earlywood - 0.5) + 0.05 * fibres - 0.06 * pores + 0.04 * warp - 0.12 * knot;
  return vec4(tone, height, earlywood, knot);
}
`;
