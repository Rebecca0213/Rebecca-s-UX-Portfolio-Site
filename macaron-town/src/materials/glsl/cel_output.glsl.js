export default `// ---- replaces the outgoingLight line ----
vec3 celViewDir = normalize(vViewPosition);
vec3 celWorldNormal = inverseTransformDirection(normal, viewMatrix);
vec3 celWorldView = inverseTransformDirection(celViewDir, viewMatrix);
vec3 celReflDir = reflect(-celWorldView, celWorldNormal);
float celNdV = clamp(dot(normal, celViewDir), 0.0, 1.0);

// Stylised environment reflection (metal, glass, glaze, plastic).
float celFresnel = celReflect.y + (1.0 - celReflect.y) * pow(1.0 - celNdV, 5.0);
vec3 celEnv = celEnvironment(celReflDir);
vec3 celReflTint = mix(vec3(1.0), diffuseColor.rgb, celReflect.z);
vec3 celReflection = celEnv * celReflTint * celFresnel * celReflect.x * mix(0.55, 1.0, celLit);

// Rim light, stronger on the side facing the sun.
float celSunFacing = clamp(dot(celWorldNormal, celSunDirection) * 0.5 + 0.6, 0.0, 1.0);
float celRimAmt = celStep(celRimShape.x, 1.0 - celNdV, celRimShape.y) * celRim.a * celSunFacing;
vec3 celRimLight = celRim.rgb * celRimAmt * mix(0.4, 1.0, celLit);

vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + celReflection + celRimLight + totalEmissiveRadiance;

// Venues (see Hover): how far inside each venue's box this surface is (a box stops just above the
// ground at the venue's foot). Each venue glows on its own under the pointer (celHover), and all of
// them are marked for the outline glow they always wear (celVenue, written to the colour's alpha).
float celVenue = 0.0;
float celHover = 0.0;
for (int i = 0; i < 4; i++) {
  vec3 celBoxP = (celVenueFrames[i] * vec4(vCelWorldPos, 1.0)).xyz;
  float celInside = 1.0 - smoothstep(0.96, 1.0, max(max(abs(celBoxP.x), abs(celBoxP.y)), abs(celBoxP.z)));
  celVenue = max(celVenue, celInside);
  celHover = max(celHover, celInside * celVenueGlow[i]);
}
float celHalo = 0.0; // added to the colour's alpha: the bloom spreads it into a halo (CelBloomPass)

#ifdef CEL_GLASS
{
  vec3 o = vec3(vCelObjPos.xy, 0.0);
  vec3 d = normalize(vCelObjView);
  float glow;
  // A hovered building's rooms light up, as if someone had turned the lamps on to welcome you in.
  float celRoomBoost = 1.0 + celGlowShape.w * celHover;
  vec3 room = celInterior(o, d, glow) * celRoomLight.x * celRoomBoost;
  vec2 q = vCelObjPos.xy / celRoom.xy + 0.5;
  vec4 curtain = celCurtains(q, celRoom.w);
  room = mix(room, curtain.rgb * celRoomLight.x * celRoomBoost * (0.7 + 0.5 * glow), curtain.a);
  float fres = 0.06 + 0.94 * pow(1.0 - celNdV, 4.0);
  vec3 reflection = celEnvironment(celReflDir);
  vec3 glassColor = mix(room, reflection, clamp(fres * 0.8 + 0.12, 0.0, 1.0));
  float diag = (q.x + q.y * 0.65);
  float streak = (1.0 - smoothstep(0.0, 0.035, abs(diag - 0.42))) + 0.7 * (1.0 - smoothstep(0.0, 0.016, abs(diag - 0.53)));
  streak *= smoothstep(0.15, 0.55, q.y) * 0.55;
  glassColor += vec3(1.0) * streak;
  outgoingLight = glassColor * mix(0.86, 1.0, celLit) + reflectedLight.directSpecular;
}
#endif

#ifdef CEL_WATER
{
  float fres = 0.04 + 0.96 * pow(1.0 - celNdV, 5.0);
  outgoingLight = mix(outgoingLight, celEnvironment(celReflDir), fres * 0.7);
}
#endif

#ifdef CEL_CLEAR
{
  float edge = pow(1.0 - celNdV, 3.0);
  float band = (smoothstep(0.26, 0.31, normal.x) - smoothstep(0.4, 0.47, normal.x))
             + 0.55 * (smoothstep(-0.66, -0.62, normal.x) - smoothstep(-0.56, -0.51, normal.x));
  band = clamp(band, 0.0, 1.0) * celClear.z;
  float spec = max(max(reflectedLight.directSpecular.r, reflectedLight.directSpecular.g), reflectedLight.directSpecular.b);
  outgoingLight = mix(outgoingLight, vec3(1.0), band);
  float flowAlpha = 0.0;
#ifdef CEL_FLOW
  {
    // Moving water: columns of white streaks broken into dashes that travel toward +uv.y, a glassy
    // lip where the sheet leaves its edge (uv.y = 0) and churned foam at its foot (uv.y = 1).
    float u = vCelUv.x * celFlow.x;
    float cell = floor(u);
    float j = fract(sin(cell * 91.7 + 3.1) * 43758.5453);
    float halfWidth = mix(0.1, 0.24, j);
    float aw = fwidth(u) * 1.2;
    float column = 1.0 - smoothstep(halfWidth - aw, halfWidth + aw, abs(fract(u) - 0.5));
    float v = vCelUv.y * celFlow.z * (0.8 + 0.4 * j) - celTime * celFlow.y * (0.85 + 0.3 * j) + j * 5.0;
    float fv = fract(v);
    float dash = smoothstep(0.0, 0.12, fv) * (1.0 - smoothstep(0.5, 0.66, fv));
    float streak = column * dash;
    float lip = 1.0 - smoothstep(0.0, 0.08, vCelUv.y);
    float foam = smoothstep(1.0 - celFlow.w, 1.0, vCelUv.y);
    outgoingLight = mix(outgoingLight, vec3(1.0), clamp(streak * 0.7 + foam * 0.85 + lip * 0.3, 0.0, 1.0));
    flowAlpha = streak * 0.42 + foam * 0.55 + lip * 0.22;
  }
#endif
  diffuseColor.a = clamp(mix(celClear.x, celClear.y, edge) + band * 0.75 + spec * 0.6 + flowAlpha, 0.0, 1.0);
}
#endif

// Hover: the building brightens in its own colours, and the warm light gathers at its rims, where it
// runs past the bloom's threshold so the bloom haloes the silhouette. Seen from afar, where rims are a
// pixel thin and windows specks, it brightens more, so it still stands out from its neighbours. Its
// whole surface also feeds a soft halo of the glow's own colour round it (through the colour's alpha,
// which the bloom reads; see CelBloomPass), so it shines without washing out: strongest from afar,
// faint up close, where the building fills the view and a wide halo would only haze the street.
if (celHover > 0.0) {
  float celFar = smoothstep(12.0, 40.0, length(vViewPosition));
  float celLift = celGlowShape.x + celGlowShape.y * celFar;
  outgoingLight = outgoingLight * (1.0 + celLift * celHover) + celGlow * celHover * (0.25 * celLift + celGlowShape.z * pow(1.0 - celNdV, 3.0));
  celHalo = celHover * celGlowHalo * (0.2 + 0.8 * smoothstep(8.0, 30.0, length(vViewPosition)));
}
`;
