export default `// Bokeh reach, step 2: each block takes the largest circle of the blocks within \`reach\` of it, which
// covers every depth sample the gather's spiral can touch from any pixel of the block.
uniform sampler2D tTiles;
uniform int reach; // blocks

void main() {
  ivec2 last = textureSize(tTiles, 0) - 1;
  ivec2 p = ivec2(gl_FragCoord.xy);
  float m = 0.0;
  for (int y = -reach; y <= reach; y++) {
    for (int x = -reach; x <= reach; x++) {
      m = max(m, texelFetch(tTiles, clamp(p + ivec2(x, y), ivec2(0), last), 0).r);
    }
  }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}
`;
