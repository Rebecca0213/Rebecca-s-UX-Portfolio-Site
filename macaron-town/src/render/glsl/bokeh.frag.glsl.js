export default `// Scatter-as-gather bokeh (golden-angle spiral) driven by the scene depth buffer.
#include <packing>

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tTiles; // largest circle of confusion that can reach each TILE x TILE block (px)
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float focusDistance;
uniform float aperture;   // CoC scale
uniform float maxBlur;    // pixels

varying vec2 vUv;

const float GOLDEN = 2.39996323;
const int TAPS = 48;

float viewDepth(vec2 uv) {
  return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar);
}

float coc(float z) {
  return clamp(abs(z - focusDistance) / z * aperture, 0.0, 1.0) * maxBlur;
}

void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;
  // Step size shrinks as the spiral widens, so TAPS samples cover the disc evenly out to maxBlur.
  float radScale = maxBlur * maxBlur / (2.0 * float(TAPS));
  // A tap gathers only from samples whose circle reaches it (weight m below); a tap with zero weight just
  // re-adds the running mean, which leaves the result as it was. The spiral only widens, so once it
  // passes the largest circle that can reach this pixel's block, no later tap can count: it stops there.
  // Same image as the full spiral; a pixel in focus costs one fetch. (+0.01: half-float rounding.)
  float reach = texelFetch(tTiles, ivec2(gl_FragCoord.xy) / TILE, 0).r + 0.51;
  if (maxBlur < 0.5 || reach <= radScale + 1.0) {
    gl_FragColor = vec4(color, 1.0);
    return;
  }
  float centerDepth = viewDepth(vUv);
  float centerSize = coc(centerDepth);
  float total = 1.0;
  float radius = radScale;
  float angle = 0.0;
  for (int i = 0; i < TAPS; i++) {
    angle += GOLDEN;
    radius += radScale / radius;
    if (radius > maxBlur || radius >= reach) break;
    vec2 uv = vUv + vec2(cos(angle), sin(angle)) * radius / resolution;
    vec3 sampleColor = texture2D(tDiffuse, uv).rgb;
    float sampleDepth = viewDepth(uv);
    float sampleSize = coc(sampleDepth);
    if (sampleDepth > centerDepth) sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
    color += mix(color / total, sampleColor, m);
    total += 1.0;
  }
  gl_FragColor = vec4(color / total, 1.0);
}
`;
