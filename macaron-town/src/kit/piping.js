import * as THREE from 'three';

// Piped decorations: a star-tip bead of cream swept along a rising spiral into a soft peak.
// Built as one continuous surface (every rosette is its own geometry with its own twist and size).
// The section is swept with -cos like THREE.TubeGeometry so the winding faces outward.
export function rosetteGeometry({ radius = 0.6, height = 0.5, turns = 2.1, ridges = 8, bead = 0.24, twist = 3.5, tubular = 260, radial = 56, phase = 0 } = {}) {
  const curve = new THREE.Curve();
  curve.getPoint = (s, target = new THREE.Vector3()) => {
    const a = phase + s * turns * Math.PI * 2;
    const r = radius * (1 - bead * 0.5) * (Math.pow(1 - s, 0.82) * 0.93 + 0.07);
    return target.set(Math.cos(a) * r, height * (0.12 + 0.88 * Math.pow(s, 0.8)), Math.sin(a) * r);
  };
  // Frenet frames are sampled at uniform arc length, so each ring must sit at the matching
  // arc-length point (the spiral's outer coils are far longer than its inner ones).
  const frames = curve.computeFrenetFrames(tubular, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  const center = new THREE.Vector3();
  const offset = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const s = curve.getUtoTmapping(i / tubular);
    curve.getPoint(s, center);
    const swell = 1 + 0.12 * Math.sin(s * turns * Math.PI * 2 * 3);
    const tipFade = Math.pow(Math.max(0, 1 - s), 0.55);
    const startFade = Math.min(1, s * 12 + 0.25);
    const rho = bead * radius * swell * (0.35 + 0.65 * tipFade) * startFade;
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const star = 1 + 0.17 * Math.cos(ridges * phi + twist * s * Math.PI * 2) * (0.3 + 0.7 * tipFade);
      offset
        .copy(frames.normals[i])
        .multiplyScalar(-Math.cos(phi))
        .addScaledVector(frames.binormals[i], Math.sin(phi))
        .multiplyScalar(rho * star);
      positions.push(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      uvs.push(s, j / radial);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // Soft peak where the piping bag lifts off.
  const tip = curve.getPoint(1);
  const tipIndex = positions.length / 3;
  positions.push(tip.x, tip.y + bead * radius * 0.55, tip.z);
  uvs.push(1, 0.5);
  const last = tubular * (radial + 1);
  for (let j = 0; j < radial; j++) indices.push(last + j, tipIndex, last + j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// A ring of piped shell beads (border piping), as a star-section tube following a closed loop.
export function beadBorderGeometry({ radius, y = 0, bead = 0.05, beads = 120, ridges = 7, tubular = 2400, radial = 18 } = {}) {
  const curve = new THREE.Curve();
  curve.getPoint = (s, target = new THREE.Vector3()) => {
    const a = s * Math.PI * 2;
    return target.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
  };
  const frames = curve.computeFrenetFrames(tubular, true);
  const positions = [];
  const indices = [];
  const center = new THREE.Vector3();
  const offset = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const s = i / tubular;
    curve.getPoint(s, center);
    const phaseInBead = (s * beads) % 1;
    const shell = 0.55 + 0.45 * Math.pow(Math.sin(Math.PI * phaseInBead), 0.7);
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const star = 1 + 0.14 * Math.cos(ridges * phi + phaseInBead * 4);
      offset
        .copy(frames.normals[i % tubular])
        .multiplyScalar(-Math.cos(phi))
        .addScaledVector(frames.binormals[i % tubular], Math.sin(phi))
        .multiplyScalar(bead * shell * star);
      positions.push(center.x + offset.x, center.y + offset.y + bead * 0.4, center.z + offset.z);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
