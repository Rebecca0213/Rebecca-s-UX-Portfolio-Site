export default `// ---- injected after <color_fragment> ----
celSurface = celSampleDetail();
#ifdef CEL_DETAIL
diffuseColor.rgb *= 1.0 + (celSurface.r - 0.5) * 2.0 * celDetail.y;
#endif
diffuseColor.rgb = mix(diffuseColor.rgb, celTint2.rgb, clamp(celSurface.b * celTint2.a, 0.0, 1.0));

#ifdef CEL_GROUND_SHADE
{
  // Root self-occlusion and sun-bleached tips along the blade (uv.y runs root -> tip).
  float along = clamp(vCelUv.y, 0.0, 1.0);
  diffuseColor.rgb *= mix(1.0 - celGroundShade.y, 1.0, smoothstep(0.0, celGroundShade.w, along));
  diffuseColor.rgb = mix(diffuseColor.rgb, celGroundTip, celGroundShade.z * smoothstep(0.55, 1.0, along));
}
#endif

#ifdef CEL_WATER
{
  vec2 radial = vCelUv - 0.5;
  float r = length(radial) * 2.0;
  float depth = smoothstep(1.0, 0.25, r);
  vec3 water = mix(celWaterShallow, celWaterDeep, depth);
  vec2 cells = celCells(vCelWorldPos.xz * celWaterShape.x, celTime * 0.9);
  float caustic = smoothstep(0.12, 0.02, cells.y - cells.x);
  vec2 cells2 = celCells(vCelWorldPos.xz * celWaterShape.x * 1.9 + 3.7, celTime * 1.3 + 2.0);
  caustic = max(caustic, 0.6 * smoothstep(0.1, 0.02, cells2.y - cells2.x));
  water += vec3(0.9, 1.0, 1.0) * caustic * mix(0.25, 0.08, depth) * celWaterShape.z;
  float foam = smoothstep(1.0 - celWaterShape.y, 1.0 - celWaterShape.y * 0.35, r);
  foam *= 0.65 + 0.35 * sin(atan(radial.y, radial.x) * 23.0 + celTime * 1.4);
  water = mix(water, vec3(1.0, 0.99, 0.97), clamp(foam, 0.0, 1.0));
  diffuseColor.rgb = water;
}
#endif
`;
