export default `// Linear-light grade before tone mapping: saturation, warm lavender shadow lift, soft peach vignette.
uniform sampler2D tDiffuse;
uniform float saturation;
uniform vec3 shadowLift;
uniform vec3 highlightTint;
uniform float vignette;
uniform vec3 vignetteTint;

varying vec2 vUv;

void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c += shadowLift * (1.0 - smoothstep(0.0, 0.45, l));
  c *= mix(vec3(1.0), highlightTint, smoothstep(0.5, 1.2, l));
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
  float v = smoothstep(0.82, 0.28, length(q));
  c = mix(c * vignetteTint, c, mix(1.0 - vignette, 1.0, v));
  gl_FragColor = vec4(c, 1.0);
}
`;
