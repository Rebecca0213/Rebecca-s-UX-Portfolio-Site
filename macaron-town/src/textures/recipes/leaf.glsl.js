export default `// Broadleaf, UV-mapped: u across the blade, v from petiole (0) to tip (1).
// Raised midrib, pinnate secondary veins, darker serrated margin. b = midrib, a = margin.
vec4 recipe(vec2 uv) {
  float x = uv.x - 0.5;
  float ax = abs(x);
  float midrib = smoothstep(0.028, 0.0, ax);
  float veinPhase = (uv.y - ax * 1.35) * 8.0;
  float veins = smoothstep(0.86, 1.0, 0.5 + 0.5 * cos(veinPhase * 6.2831853)) * smoothstep(0.02, 0.07, ax) * smoothstep(0.5, 0.3, ax);
  float margin = smoothstep(0.34, 0.5, ax);
  float cells = pfbm(uv * 24.0, vec2(24.0), 3);

  float height = 0.5 + 0.28 * midrib + 0.14 * veins + 0.04 * cells - 0.05 * margin;
  float tone = 0.5 + 0.1 * midrib + 0.06 * veins - 0.07 * margin + 0.03 * cells;
  return vec4(tone, height, midrib, margin);
}
`;
