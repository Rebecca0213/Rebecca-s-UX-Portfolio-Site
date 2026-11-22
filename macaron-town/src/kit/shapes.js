import * as THREE from 'three';

// 2D outlines in the XY plane. Openings sit on y = 0 and are centred on x = 0 unless offset.

export function rect(w, h, x = 0, y = 0) {
  const s = new THREE.Shape();
  s.moveTo(x - w / 2, y);
  s.lineTo(x + w / 2, y);
  s.lineTo(x + w / 2, y + h);
  s.lineTo(x - w / 2, y + h);
  s.closePath();
  return s;
}

export function centeredRect(w, h) {
  return rect(w, h, 0, -h / 2);
}

export function roundRect(w, h, r, x = 0, y = 0) {
  const k = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const s = new THREE.Shape();
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  s.moveTo(x0 + k, y);
  s.lineTo(x1 - k, y);
  s.absarc(x1 - k, y + k, k, -Math.PI / 2, 0, false);
  s.lineTo(x1, y + h - k);
  s.absarc(x1 - k, y + h - k, k, 0, Math.PI / 2, false);
  s.lineTo(x0 + k, y + h);
  s.absarc(x0 + k, y + h - k, k, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y + k);
  s.absarc(x0 + k, y + k, k, Math.PI, Math.PI * 1.5, false);
  return s;
}

// Opening outlines. kind: 'rect' | 'round' (semicircular head) | 'segmental' (shallow arc, `rise`)
// | 'basket' (elliptical head, `rise`) | 'gothic' (pointed) | 'circle' (oculus, h = diameter).
export function opening({ w, h, kind = 'rect', rise = w * 0.18, x = 0, y = 0 }) {
  const s = new THREE.Shape();
  const hw = w / 2;
  if (kind === 'circle') {
    s.absarc(x, y + h / 2, h / 2, 0, Math.PI * 2, false);
    return s;
  }
  if (kind === 'rect') return rect(w, h, x, y);
  s.moveTo(x - hw, y);
  s.lineTo(x + hw, y);
  if (kind === 'round') {
    const spring = y + h - hw;
    s.lineTo(x + hw, spring);
    s.absarc(x, spring, hw, 0, Math.PI, false);
  } else if (kind === 'segmental') {
    const spring = y + h - rise;
    const radius = (hw * hw + rise * rise) / (2 * rise);
    const cy = spring + rise - radius;
    const a = Math.atan2(spring - cy, hw);
    s.lineTo(x + hw, spring);
    s.absarc(x, cy, radius, a, Math.PI - a, false);
  } else if (kind === 'basket') {
    const spring = y + h - rise;
    s.lineTo(x + hw, spring);
    s.absellipse(x, spring, hw, rise, 0, Math.PI, false, 0);
  } else if (kind === 'gothic') {
    const spring = y + h - w * 0.86;
    s.lineTo(x + hw, spring);
    s.absarc(x - hw, spring, w, 0, Math.PI / 3, false);
    s.absarc(x + hw, spring, w, (Math.PI * 2) / 3, Math.PI, false);
  }
  s.closePath();
  return s;
}

// Dense polyline of an opening's outline, counter-clockwise from the bottom-left corner (for sweeps).
export function openingOutline(spec, samples = 96) {
  return opening(spec).getSpacedPoints(samples);
}

export function circle(r, x = 0, y = 0) {
  const s = new THREE.Shape();
  s.absarc(x, y, r, 0, Math.PI * 2, false);
  return s;
}

// Band whose bottom edge is a row of scallops (awning valances, carousel skirts).
export function scallopBand(width, height, count, depth) {
  const s = new THREE.Shape();
  const r = width / count / 2;
  s.moveTo(-width / 2, height);
  s.lineTo(-width / 2, 0);
  for (let i = 0; i < count; i++) {
    const cx = -width / 2 + r * (2 * i + 1);
    s.absellipse(cx, 0, r, depth, Math.PI, Math.PI * 2, false, 0);
  }
  s.lineTo(width / 2, height);
  s.closePath();
  return s;
}

// Curvy Dutch gable: shoulders, an S-curve neck and a semicircular crown.
export function dutchGable(w, h) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const neck = w * 0.24;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.bezierCurveTo(hw, h * 0.18, hw * 0.92, h * 0.34, hw * 0.62, h * 0.42);
  s.bezierCurveTo(neck * 1.2, h * 0.5, neck, h * 0.58, neck, h * 0.7);
  s.absarc(0, h * 0.7, neck, 0, Math.PI, false);
  s.bezierCurveTo(-neck, h * 0.58, -neck * 1.2, h * 0.5, -hw * 0.62, h * 0.42);
  s.bezierCurveTo(-hw * 0.92, h * 0.34, -hw, h * 0.18, -hw, 0);
  return s;
}
