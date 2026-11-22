import * as THREE from 'three';
import { opening } from './shapes.js';

// Wall slab with openings cut clean through (their reveals are real geometry).
// Frame: x along the wall (centred), y up from 0, outer face at z = 0, inner face at z = -thickness.
export function wallSlab(width, height, thickness, openings = []) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();
  return wallFromShape(shape, thickness, openings);
}

// Any outline (gables, curved Dutch tops) with openings; same frame as wallSlab.
export function wallFromShape(shape, thickness, openings = []) {
  for (const spec of openings) shape.holes.push(opening(spec));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 72, steps: 1 });
  geometry.translate(0, 0, -thickness);
  return geometry;
}
