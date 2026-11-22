import * as THREE from 'three';

// Uniform objects shared by every material; updating a value here updates the whole scene.
export const SHARED = {
  time: { value: 0 },
  wind: { value: new THREE.Vector3(0.8, 0.6, 0.05) }, // xy: direction over the ground (xz), z: strength (the gusting breeze: physics WindField)
  skyZenith: { value: new THREE.Color('#8FBDEB') },
  skyHorizon: { value: new THREE.Color('#FDE8E0') },
  skyGround: { value: new THREE.Color('#F2D3DA') },
  sunDirection: { value: new THREE.Vector3(0, 1, 0) }, // world, toward the sun
  sunColor: { value: new THREE.Color('#FFF1DE') },
  // The venues (see Hover): a world -> box frame per venue (its box is [-1, 1]; spare slots lie far
  // away), how much each one glows under the pointer, and the glow's colour.
  venueFrames: { value: Array.from({ length: 4 }, () => new THREE.Matrix4().makeTranslation(1e4, 1e4, 1e4)) },
  venueGlow: { value: new THREE.Vector4(0, 0, 0, 0) },
  glow: { value: new THREE.Color(1, 0.85, 0.62) },
  // The outline glow every venue wears, so it reads as something to point at: rgb, amount (Hover makes
  // it breathe; Pipeline's VenueOutlinePass and the grade pass draw it).
  outline: { value: new THREE.Vector4(1, 0.8, 0.62, 1) },
  // How the glow looks (cel_output): x how much the building brightens up close, y how much more from
  // afar, z the warm light at its rims (what blooms into a halo), w how much brighter its rooms get.
  glowShape: { value: new THREE.Vector4(0.28, 0.42, 2.4, 2.4) },
  // How strongly the glow spills round the building as a soft warm halo (carried to the bloom in the
  // scene colour's alpha, see cel_output and Pipeline's CelBloomPass).
  glowHalo: { value: 1 },
};