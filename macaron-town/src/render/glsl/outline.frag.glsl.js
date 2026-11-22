export default `// Ink pass: lines where depth curvature, surface normals or material ids change. Each line is
// tinted from the colour of the nearest surface it outlines, like coloured line art.
#include <packing>

uniform sampler2D tDiffuse;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float thickness;
uniform float strength;
uniform vec3 inkTint;
uniform vec2 fade; // start, end distance
// Over this distance range, crease lines rise from gentle folds to sharp ones: up close every tile
// and moulding is inked, at town scale only corners, ridges and eaves (a tile there is a few pixels
// across, and a line round each one would ink a third of the roof).
uniform vec2 creaseFade;

varying vec2 vUv;

// Ground cover ('none' turf, 'foliage' grass and lawn flowers) is never inked. As a neighbour it
// still counts as ground for silhouettes (depth), but never adds crease or material-id lines.
bool unlined(float id) {
  return id > 0.004 && id < 0.03;
}

float viewDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
}

void main() {
  vec2 px = thickness / resolution;
  float d0 = viewDepth(vUv);
  vec4 n0 = texture2D(tNormal, vUv);
  vec3 N0 = n0.rgb * 2.0 - 1.0;
  if (unlined(n0.a)) {
    gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0);
    return;
  }

  vec2 offs[8];
  offs[0] = vec2(px.x, 0.0);
  offs[1] = vec2(-px.x, 0.0);
  offs[2] = vec2(0.0, px.y);
  offs[3] = vec2(0.0, -px.y);
  offs[4] = vec2(px.x, px.y) * 0.7071;
  offs[5] = vec2(-px.x, -px.y) * 0.7071;
  offs[6] = vec2(px.x, -px.y) * 0.7071;
  offs[7] = vec2(-px.x, px.y) * 0.7071;

  float depths[8];
  float nearest = d0;
  vec2 nearestUv = vUv;
  float normalEdge = 0.0;
  float idEdge = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 uv = vUv + offs[i];
    depths[i] = viewDepth(uv);
    vec4 n = texture2D(tNormal, uv);
    if (depths[i] < nearest) {
      nearest = depths[i];
      nearestUv = uv;
    }
    if (unlined(n.a)) continue;
    normalEdge = max(normalEdge, 1.0 - dot(N0, n.rgb * 2.0 - 1.0));
    idEdge = max(idEdge, step(0.003, abs(n.a - n0.a)));
  }

  // Second derivative of depth: zero on flat or tilted planes, large at creases and silhouettes.
  float lap = abs(depths[0] + depths[1] - 2.0 * d0) + abs(depths[2] + depths[3] - 2.0 * d0);
  lap += 0.5 * (abs(depths[4] + depths[5] - 2.0 * d0) + abs(depths[6] + depths[7] - 2.0 * d0));
  float depthEdge = smoothstep(0.006, 0.02, lap / max(nearest, 0.1));
  float far = smoothstep(creaseFade.x, creaseFade.y, nearest);
  float creaseLo = mix(0.16, 0.62, far);
  float creaseEdge = smoothstep(creaseLo, creaseLo + mix(0.24, 0.3, far), normalEdge) * (n0.a > 0.5 ? 0.12 : 1.0);
  // Material boundaries thin out over the same range: the deck between roof tiles and every window's
  // frame, glass and sill would otherwise grain the town into noise. Silhouettes (depth) never fade here.
  float edge = max(max(depthEdge, creaseEdge), idEdge * mix(0.7, 0.22, far));
  edge *= 1.0 - smoothstep(fade.x, fade.y, nearest);

  vec3 color = texture2D(tDiffuse, vUv).rgb;
  vec3 lineSource = texture2D(tDiffuse, nearestUv).rgb;
  vec3 ink = lineSource * inkTint;
  gl_FragColor = vec4(mix(color, ink, clamp(edge * strength, 0.0, 1.0)), 1.0);
}
`;
