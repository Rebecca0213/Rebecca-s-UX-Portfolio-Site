// Moulding cross-sections as [out, up] points, from the wall at the bottom to the wall at the top.
// Each takes a scale `s` (overall projection in scene units). Curves are sampled densely.

const arc = (cx, cy, r, a0, a1, steps) => {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
};

const ogee = (x0, y0, x1, y1, steps = 14) => {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k = t * t * (3 - 2 * t);
    pts.push([x0 + (x1 - x0) * k, y0 + (y1 - y0) * t]);
  }
  return pts;
};

const scale = (pts, s) => pts.map(([x, y]) => [x * s, y * s]);

// Classical entablature cornice: bed moulding, ovolo, corona with drip, cyma recta, top fillet.
export const cornice = (s = 1) =>
  scale(
    [
      [0, 0],
      [0.08, 0],
      [0.08, 0.06],
      ...arc(0.08, 0.16, 0.1, -Math.PI / 2, 0, 10).slice(1),
      [0.32, 0.2],
      [0.32, 0.27],
      [0.6, 0.27],
      [0.6, 0.4],
      [0.62, 0.42],
      ...ogee(0.62, 0.42, 0.95, 0.68).slice(1),
      [0.95, 0.74],
      [0, 0.74],
    ],
    s
  );

// Thin horizontal band with a half-round bead (string course between storeys).
export const stringCourse = (s = 1) =>
  scale([[0, 0], [0.35, 0], [0.35, 0.18], ...arc(0.35, 0.36, 0.18, -Math.PI / 2, Math.PI / 2, 12).slice(1), [0.35, 0.72], [0, 0.72]], s);

// Window/door surround: back band, bead, wide fascia and an inner fillet (counter-clockwise like
// every profile here, so faces point outward).
export const architrave = (s = 1) =>
  scale(
    [
      [1.0, 0],
      [0.95, 0.3],
      [0.72, 0.3],
      [0.72, 0.2],
      ...arc(0.62, 0.2, 0.07, 0, Math.PI, 8).slice(1),
      [0.55, 0.2],
      [0.06, 0.2],
      [-0.02, 0.18],
      [-0.02, 0],
    ],
    s
  );

// Projecting sill with a weathered top and a drip groove underneath.
export const sill = (s = 1) =>
  scale(
    [
      [0, -0.4],
      [0.62, -0.4],
      [0.62, -0.32],
      [0.7, -0.3],
      [0.78, -0.3],
      ...arc(0.78, -0.18, 0.12, -Math.PI / 2, Math.PI / 2, 10).slice(1),
      [0.0, 0.0],
    ],
    s
  );

// Base course at the foot of a wall: torus, scotia and plinth block.
export const plinth = (s = 1) =>
  scale(
    [
      [0, 0],
      [0.55, 0],
      [0.55, 0.55],
      ...arc(0.55, 0.7, 0.15, -Math.PI / 2, Math.PI / 2, 12).slice(1),
      [0.4, 0.85],
      ...ogee(0.4, 0.85, 0.12, 1.0).slice(1),
      [0.0, 1.0],
    ],
    s
  );

// Eaves crown for roof edges: cove under a rounded nosing.
export const crown = (s = 1) =>
  scale([[0, 0], ...arc(0, 0.4, 0.4, -Math.PI / 2, 0, 12).slice(1), [0.4, 0.55], ...arc(0.4, 0.7, 0.15, -Math.PI / 2, Math.PI / 2, 10).slice(1), [0, 0.85]], s);

// Small astragal bead.
export const bead = (s = 1) => scale([[0, 0], ...arc(0, 0.5, 0.5, -Math.PI / 2, Math.PI / 2, 16).slice(1)], s);
