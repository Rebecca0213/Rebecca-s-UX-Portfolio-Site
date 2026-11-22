export default `// ---- replaces <lights_toon_pars_fragment> ----
varying vec3 vViewPosition;

struct ToonMaterial {
  vec3 diffuseColor;
};

// Banded key light: a soft-edged terminator, a brighter band facing the light, a crisp cast shadow,
// a stylised highlight and back-light transmission for thin or creamy surfaces.
void RE_Direct_Cel(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight) {
  float ndl = dot(geometryNormal, directLight.direction);
  float halfLambert = ndl * 0.5 + 0.5;
  float core = celStep(celBands.x, halfLambert, celBands.y);
  float high = celStep(celBands.w, halfLambert, celBands.y);
  float castLit = celStep(0.5, celShadow, 0.14);
  float lit = core * castLit;
  celLit = max(celLit, lit);

  vec3 radiance = directLight.color;
  float tone = lit * mix(celBands.z, 1.0, high);
  reflectedLight.directDiffuse += tone * radiance * BRDF_Lambert(material.diffuseColor);

  vec3 halfDir = normalize(directLight.direction + geometryViewDir);
  float nh = max(dot(geometryNormal, halfDir), 0.0);
  float shape = pow(nh, celSpec.x);
#ifdef CEL_ANISO
  shape *= mix(0.35, 1.6, celSurface.a);
#endif
  float spec = celStep(celSpec.z, shape, celSpec.w) * celSpec.y * lit;
  reflectedLight.directSpecular += spec * celSpecColor * radiance;

  float back = pow(clamp(dot(geometryViewDir, -directLight.direction), 0.0, 1.0), 3.0);
  float wrap = clamp(0.45 - ndl * 0.55, 0.0, 1.0);
  reflectedLight.directDiffuse += celTranslucency.rgb * celTranslucency.a * (back * 0.75 + wrap * 0.3) * mix(0.35, 1.0, castLit) * radiance * material.diffuseColor;
}

void RE_IndirectDiffuse_Cel(const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(material.diffuseColor) * celShadowTint;
}

#define RE_Direct RE_Direct_Cel
#define RE_IndirectDiffuse RE_IndirectDiffuse_Cel
`;
