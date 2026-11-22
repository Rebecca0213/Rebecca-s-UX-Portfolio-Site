export default `// ---- injected after <begin_vertex> ----
vCelObjPos = transformed;
vCelObjNormal = objectNormal;
vCelUv = uv;
mat4 celModel = modelMatrix;
#ifdef USE_INSTANCING
celModel = modelMatrix * instanceMatrix;
#endif
#ifdef USE_BATCHING
celModel = modelMatrix * batchingMatrix;
#endif
#ifdef CEL_DETAIL_WORLD
// World-anchored detail, taken before the wind moves the surface: one continuous pattern across
// every part of a mass (the overlapping bumps of a crown), riding along as the mass sways.
vCelObjPos = (celModel * vec4(transformed, 1.0)).xyz;
vCelObjNormal = normalize(mat3(celModel) * objectNormal);
#endif
#ifdef CEL_WIND
{
  vec3 wp = (celModel * vec4(transformed, 1.0)).xyz;
  // w: 0 = height in the geometry's own space, 1 = absolute world height, 2 = world height above
  // the mesh's origin (a tree's crown sways from its own base wherever the tree is placed).
#if defined( CEL_INSTANCED_BATCH ) && defined( USE_BATCHING )
  float celBaseY = celGroupY; // the instanced part's own origin, as for an InstancedMesh
#elif defined( USE_BATCHING )
  float celBaseY = celModel[3].y; // a batched part's own origin: its plant's base
#else
  float celBaseY = modelMatrix[3].y;
#endif
  float h = celWindShape.w > 1.5 ? wp.y - celBaseY - celWindShape.x
          : celWindShape.w > 0.5 ? wp.y - celWindShape.x
          : transformed.y - celWindShape.x;
  float k = clamp(h / celWindShape.y, 0.0, 1.6);
  k *= k;
  float phase = dot(wp.xz, vec2(0.41, 0.27)) + celTime * 1.6;
  float gust = 0.55 + 0.45 * sin(celTime * 0.37 + wp.x * 0.09 + wp.z * 0.05);
  float sway = (sin(phase) * 0.55 + sin(phase * 2.17 + 1.3) * 0.25) * gust + 0.35 * gust;
  float flutter = sin(celTime * 8.3 + dot(wp, vec3(17.1, 9.7, 13.3))) * celWindShape.z;
  vec3 offset = vec3(celWind.x, 0.0, celWind.y) * sway * celWind.z * k;
  offset += vec3(0.4, 1.0, 0.4) * flutter * celWind.z * k * 0.25;
  transformed += inverse(mat3(celModel)) * offset;
}
#endif
vCelWorldPos = (celModel * vec4(transformed, 1.0)).xyz;
#ifdef CEL_GLASS
vCelObjView = transformed - (inverse(celModel) * vec4(cameraPosition, 1.0)).xyz;
#ifdef CEL_GLASS_ATTR
vCelRoomA = celRoomA;
vCelRoomB = celRoomB;
vCelRoomC = celRoomC;
#endif
#endif
`;
