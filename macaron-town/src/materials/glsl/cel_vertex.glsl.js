export default `// ---- injected after <common> (vertex) ----
varying vec3 vCelObjPos;
varying vec3 vCelObjNormal;
varying vec3 vCelWorldPos;
varying vec2 vCelUv;
#ifdef CEL_GLASS
varying vec3 vCelObjView;
#ifdef CEL_GLASS_ATTR
// Batched panes carry their room in vertex attributes (constant over a pane) instead of uniforms.
attribute vec4 celRoomA;  // width, height, depth, seed
attribute vec4 celRoomB;  // wall rgb, interior glow
attribute vec4 celRoomC;  // accent rgb, style
flat varying vec4 vCelRoomA;
flat varying vec4 vCelRoomB;
flat varying vec4 vCelRoomC;
#endif
#endif
#ifdef CEL_WIND
uniform float celTime;
uniform vec3 celWind;       // xy: world xz direction, z: strength
uniform vec4 celWindShape;  // x: anchor height, y: height range, z: flutter, w: 1 = measure height in world space
#endif
`;
