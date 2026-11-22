export default `// ---- injected after <normal_fragment_maps> ----
#ifdef CEL_TRANSFER
// The geometry normal is the host surface's normal: never flipped for back faces, never perturbed,
// so thousands of tiny flowers light as one soft mass instead of a speckle of petal facets.
normal = celNormalize(vNormal, normal);
#endif
#ifdef CEL_GROUND_SHADE
// Both faces already face the viewer here, so leaning toward up keeps a meadow evenly lit.
normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), celGroundShade.x));
#endif
#ifdef CEL_DETAIL
{
  vec2 dh = vec2(dFdx(celSurface.g), dFdy(celSurface.g)) * celDetail.z;
  normal = celPerturb(-vViewPosition, normal, dh, faceDirection);
}
#endif
#ifdef CEL_WATER
{
  float t = celTime;
  vec2 p = vCelWorldPos.xz * 6.0;
  float hx = sin(p.x * 1.3 + t * 1.7) * 0.5 + sin(p.y * 1.7 - t * 1.3 + p.x * 0.6) * 0.5 + sin((p.x + p.y) * 2.9 + t * 2.3) * 0.25;
  vec2 dh = vec2(dFdx(hx), dFdy(hx)) * 0.0035;
  normal = celPerturb(-vViewPosition, normal, dh, faceDirection);
}
#endif
`;
