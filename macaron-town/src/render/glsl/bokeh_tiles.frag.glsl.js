export default `// Bokeh reach, step 1: the largest circle of confusion in each TILE x TILE block of the depth buffer.
#include <packing>

uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform float focusDistance;
uniform float aperture;
uniform float maxBlur;

// Same circle of confusion as the gather (bokeh.frag.glsl), from a raw depth-buffer value.
float coc(float depth) {
  float z = -perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
  return clamp(abs(z - focusDistance) / z * aperture, 0.0, 1.0) * maxBlur;
}

void main() {
  ivec2 last = textureSize(tDepth, 0) - 1;
  ivec2 base = ivec2(gl_FragCoord.xy) * TILE;
  float nearest = 1.0;
  float farthest = 0.0;
  for (int y = 0; y < TILE; y++) {
    for (int x = 0; x < TILE; x++) {
      float d = texelFetch(tDepth, min(base + ivec2(x, y), last), 0).x;
      nearest = min(nearest, d);
      farthest = max(farthest, d);
    }
  }
  // The circle only grows away from the focal plane, on either side of it, so a block's largest circle
  // belongs to its nearest or its farthest depth.
  gl_FragColor = vec4(max(coc(nearest), coc(farthest)), 0.0, 0.0, 1.0);
}
`;
