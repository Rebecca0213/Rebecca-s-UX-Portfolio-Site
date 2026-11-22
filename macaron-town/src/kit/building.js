import * as THREE from 'three';
import { add, group } from './place.js';
import { wallSlab } from './wall.js';
import { roundedBox, lathe, spline, tube, sphere, cylinder } from './geometry.js';
import { moldingLoop, moldingRun, moldingAlong } from './sweep.js';
import { cornice } from './profiles.js';
import { tilePlane, ridgeCaps, barrelPlane } from './roofs.js';

// Building-shell helpers. A building is modelled in its own frame: footprint centred on the origin,
// front facade facing +z, ground at y = 0.

/**
 * A wall panel of the box shell placed on one side. side: 'front' (+z), 'back' (-z), 'left' (-x),
 * 'right' (+x). The returned group is the wall's own frame (x along the wall, y up from `y`, outer
 * face at z = 0), so windows and doors are added straight into it.
 */
export function wallPanel(parent, { side, W, D, y = 0, height, thickness = 0.07, openings = [], material, name }) {
  const frames = {
    front: { p: [0, y, D / 2], ry: 0, width: W },
    back: { p: [0, y, -D / 2], ry: Math.PI, width: W },
    right: { p: [W / 2, y, 0], ry: Math.PI / 2, width: D - 2 * thickness },
    left: { p: [-W / 2, y, 0], ry: -Math.PI / 2, width: D - 2 * thickness },
  };
  const f = frames[side];
  const g = group(parent, { p: f.p, r: [0, f.ry, 0], name: name ?? `${side}Wall` });
  add(g, wallSlab(f.width, height, thickness, openings), material, { name: 'slab' });
  g.userData.width = f.width;
  return g;
}

/**
 * Quoins up one vertical corner: dressed blocks alternating long and short on each face, standing
 * proud of both walls. (cx, cz) is the outer corner; sx, sz point outward.
 */
export function quoins(parent, { cx, cz, sx, sz, y0, y1, course = 0.088, long = 0.15, short = 0.095, proud = 0.012, material, rng }) {
  const g = group(parent, { name: 'quoins' });
  const count = Math.floor((y1 - y0) / course);
  for (let i = 0; i < count; i++) {
    const a = i % 2 === 0 ? long : short; // along x
    const b = i % 2 === 0 ? short : long; // along z
    const h = course - 0.008;
    const x = cx - sx * (a / 2 - proud);
    const z = cz - sz * (b / 2 - proud);
    add(g, roundedBox(a, h, b, 0.006, 3), material, { p: [x, y0 + course * (i + 0.5) + (rng ? rng.range(-0.0008, 0.0008) : 0), z], name: 'quoin' });
  }
  return g;
}

/**
 * Closed hipped roof body (a frustum on a rectangle): eave rectangle w0 x d0 at y = 0 rising to
 * w1 x d1 at y = h. Flat-shaded faces; tiles are laid over it, so it only shows in the gaps.
 */
export function frustumGeometry(w0, d0, w1, d1, h) {
  const b = [
    [-w0 / 2, 0, d0 / 2],
    [w0 / 2, 0, d0 / 2],
    [w0 / 2, 0, -d0 / 2],
    [-w0 / 2, 0, -d0 / 2],
  ];
  const t = [
    [-w1 / 2, h, d1 / 2],
    [w1 / 2, h, d1 / 2],
    [w1 / 2, h, -d1 / 2],
    [-w1 / 2, h, -d1 / 2],
  ];
  const tris = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tris.push(b[i], b[j], t[j], b[i], t[j], t[i]);
  }
  tris.push(t[0], t[1], t[2], t[0], t[2], t[3]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Chimney stack: plastered shaft, moulded cap and a row of terracotta pots.
 */
export function chimney(parent, { x, z, y0, y1, w = 0.16, d = 0.3, plaster, trim, clay, pots = 3, rng }) {
  const g = group(parent, { p: [x, 0, z], name: 'chimney' });
  add(g, roundedBox(w, y1 - y0, d, 0.006, 3), plaster, { p: [0, (y0 + y1) / 2, 0], name: 'stack' });
  add(g, moldingLoop(cornice(0.03), w, d), trim, { p: [0, y1 - 0.004, 0], name: 'cap' });
  add(g, roundedBox(w + 0.06, 0.018, d + 0.06, 0.004, 2), trim, { p: [0, y1 + 0.026, 0], name: 'capSlab' });
  const pot = lathe(
    spline([[0, 0], [0.026, 0], [0.024, 0.02], [0.02, 0.06], [0.023, 0.085], [0.028, 0.092], [0.026, 0.1], [0.018, 0.1], [0.016, 0.09], [0, 0.088]], 48),
    32
  );
  for (let i = 0; i < pots; i++) {
    const pz = -d / 2 + (d * (i + 0.5)) / pots;
    const s = rng ? rng.range(0.9, 1.12) : 1;
    add(g, pot, clay, { p: [0, y1 + 0.035, pz], s: [1, s, 1], name: 'pot' });
  }
  return g;
}

/**
 * Pitched roof with its ridge along local x, placed with the group at wall-plate height (y = 0) and
 * the walls `span` apart along z. Two tiled planes laid on board decks (their undersides are the
 * soffits), ridge caps, eave fascias and bargeboards on both rakes.
 * tile: { geometry, material, colors, tileW, exposure }; exclude: { front, back } face tests.
 */
export function gableRoof(parent, { length, span, pitch, eave = 0.08, verge = 0.06, tile, deck, trim, ridge, rng, exclude = {}, name = 'gableRoof' }) {
  const g = group(parent, { name });
  const half = span / 2;
  const rise = half * Math.tan(pitch);
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const L = (half + eave) / c;
  const width = length + 2 * verge;
  const basis = new THREE.Matrix4();
  for (const side of [1, -1]) {
    const origin = new THREE.Vector3(0, -eave * Math.tan(pitch), side * (half + eave));
    const u = new THREE.Vector3(side, 0, 0);
    const v = new THREE.Vector3(0, s, -side * c);
    const n = new THREE.Vector3(0, c, side * s);
    // Board deck under the tiles; its underside is the soffit seen from the street.
    const w = new THREE.Vector3().crossVectors(u, n);
    const slab = add(g, roundedBox(width, 0.016, L, 0.004, 2), deck, { name: 'deck' });
    slab.quaternion.setFromRotationMatrix(basis.makeBasis(u, n, w));
    slab.position.copy(origin).addScaledVector(v, L / 2).addScaledVector(n, -0.008);
    if (tile.barrel) barrelPlane(g, { origin, u, v, n, width, length: L, tileW: tile.tileW, tileL: tile.tileL, overlap: tile.overlap ?? 0.3, material: tile.material, rng, colors: tile.colors });
    else tilePlane(g, { origin, u, v, n, width, length: L, tileW: tile.tileW, exposure: tile.exposure, geometry: tile.geometry, material: tile.material, rng, colors: tile.colors, exclude: side > 0 ? exclude.front : exclude.back });
    // Eave fascia board.
    const fascia = add(g, roundedBox(width + 0.01, 0.05, 0.02, 0.004, 2), trim, { name: 'fascia' });
    fascia.position.copy(origin).addScaledVector(n, -0.022).add(new THREE.Vector3(0, 0, side * 0.006));
    // Bargeboards up both rakes.
    for (const end of [1, -1]) {
      const board = add(g, roundedBox(0.022, 0.06, L + 0.03, 0.005, 2), trim, { name: 'bargeboard' });
      board.quaternion.setFromRotationMatrix(basis.makeBasis(u, n, w));
      board.position.copy(origin).addScaledVector(v, L / 2).addScaledVector(n, -0.004).add(new THREE.Vector3(end * (width / 2 + 0.008), 0, 0));
    }
  }
  const ridgeR = ridge.radius ?? 0.026;
  ridgeCaps(g, { from: [-width / 2 - 0.01, rise + ridgeR * 0.46, 0], to: [width / 2 + 0.01, rise + ridgeR * 0.46, 0], radius: ridgeR, material: ridge.material, rng, colors: ridge.colors, pieceLength: ridge.pieceLength ?? 0.09 });
  return { group: g, rise, slopeLength: L, width };
}

/**
 * Shop lantern on a scrolled wall bracket (wall frame: x along the wall, y up, z out).
 */
export function wallLantern(ctx, parent, { x, y, z = 0, brass, iron, name = 'wallLantern' }) {
  const m = ctx.materials;
  const g = group(parent, { p: [x, y, z], name });
  add(g, roundedBox(0.03, 0.06, 0.008, 0.003, 2), iron, { p: [0, 0, 0.004], name: 'plate' });
  add(g, tube([[0, 0.012, 0.006], [0, 0.03, 0.04], [0, 0.026, 0.075]], 0.0032, { tubular: 32, radial: 8 }), iron, { name: 'arm' });
  add(g, tube([[0, -0.02, 0.006], [0, -0.006, 0.03], [0, 0.018, 0.05]], 0.0024, { tubular: 32, radial: 8 }), iron, { name: 'brace' });
  const cage = group(g, { p: [0, -0.035, 0.075], name: 'cage' });
  add(cage, lathe(spline([[0, 0.12], [0.012, 0.118], [0.03, 0.098], [0.036, 0.09], [0, 0.09]], 24), 32), brass, { name: 'roof' });
  add(cage, sphere(0.008, 16, 12), brass, { p: [0, 0.128, 0], name: 'knob' });
  add(cage, lathe(spline([[0, 0], [0.012, 0.002], [0.026, 0.014], [0.03, 0.022], [0, 0.022]], 24), 32), brass, { name: 'bowl' });
  add(cage, cylinder(0.027, 0.027, 0.066, 32, 1, true), m.lanternGlass(), { p: [0, 0.056, 0], cast: false, name: 'glass' });
  add(cage, sphere(0.011, 20, 14), m.bulb(), { p: [0, 0.052, 0], cast: false, name: 'bulb' });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    add(cage, roundedBox(0.004, 0.07, 0.004, 0.001, 1), brass, { p: [Math.cos(a) * 0.028, 0.056, Math.sin(a) * 0.028], name: 'post' });
  }
  return g;
}

// Horizontal extent an opening blocks at the band [ya, yb] (wall frame), or null if it misses.
function openingSpan(o, ya, yb, margin, ring) {
  const y0 = o.y ?? 0;
  const hw = o.w / 2;
  if (o.kind === 'round') {
    const spring = y0 + o.h - hw;
    const R = hw + ring;
    if (yb <= y0 - 1e-4 || ya >= spring + R) return null;
    if (yb <= spring) return hw + margin;
    const dy = Math.max(ya, spring) - spring;
    return Math.max(Math.sqrt(Math.max(0, R * R - dy * dy)), ya < spring ? hw + margin : 0);
  }
  if (o.kind === 'circle') {
    const cy = y0 + o.h / 2;
    const R = o.h / 2 + margin;
    const dy = Math.max(0, Math.max(ya - cy, cy - yb));
    return dy >= R ? null : Math.sqrt(R * R - dy * dy);
  }
  const top = y0 + o.h + margin;
  if (yb <= y0 - 1e-4 || ya >= top) return null;
  return hw + margin;
}

/**
 * Parisian banded rustication ('refends'): courses of dressed stone separated by deep horizontal
 * channels, stopped around every opening (and around arch voussoirs, `ring` beyond the radius).
 * Wall frame; courses run from x0 to x1, proud of the face.
 */
export function rusticate(parent, { x0, x1, y0, y1, course = 0.085, gap = 0.01, proud = 0.018, openings = [], margin = 0.03, ring = 0.07, material, name = 'rustication' }) {
  const g = group(parent, { name });
  const n = Math.max(1, Math.round((y1 - y0) / course));
  const ch = (y1 - y0) / n;
  for (let k = 0; k < n; k++) {
    const ya = y0 + k * ch + gap / 2;
    const yb = ya + ch - gap;
    let segments = [[x0, x1]];
    for (const o of openings) {
      const half = openingSpan(o, ya, yb, margin, ring);
      if (half === null) continue;
      const a = (o.x ?? 0) - half;
      const b = (o.x ?? 0) + half;
      segments = segments.flatMap(([s, e]) => {
        if (b <= s || a >= e) return [[s, e]];
        const out = [];
        if (a > s) out.push([s, a]);
        if (b < e) out.push([b, e]);
        return out;
      });
    }
    for (const [s, e] of segments) {
      if (e - s < 0.03) continue;
      add(g, roundedBox(e - s, yb - ya, proud, Math.min(0.009, proud * 0.45), 3), material, { p: [(s + e) / 2, (ya + yb) / 2, proud / 2], name: 'course' });
    }
  }
  return g;
}

/**
 * Voussoirs around a round arch (centre x, spring line y = spring, intrados `radius`): wedge stones
 * with real joints, the middle one a larger keystone (optionally in its own material).
 */
export function voussoirs(parent, { x, spring, radius, depth = 0.07, count = 9, proud = 0.024, material, keyMaterial = null, keyScale = 1.35, name = 'voussoirs' }) {
  const g = group(parent, { p: [x, spring, 0], name });
  const joint = 0.007 / radius;
  const keyWide = 1.25;
  const unit = Math.PI / (count - 1 + keyWide);
  let a = 0;
  for (let i = 0; i < count; i++) {
    const key = i === (count - 1) / 2;
    const span = unit * (key ? keyWide : 1);
    const a0 = a + joint / 2;
    const a1 = a + span - joint / 2;
    a += span;
    const ro = radius + depth * (key ? keyScale : 1);
    const s = new THREE.Shape();
    s.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
    s.lineTo(Math.cos(a0) * ro, Math.sin(a0) * ro);
    s.absarc(0, 0, ro, a0, a1, false);
    s.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
    s.absarc(0, 0, radius, a1, a0, true);
    const thick = proud + (key ? 0.008 : 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: thick - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 16 });
    geo.translate(0, 0, 0.003);
    add(g, geo, key && keyMaterial ? keyMaterial : material, { name: key ? 'keystone' : 'voussoir' });
  }
  return g;
}

// Scrolled console (S-bracket) in the wall frame: hangs below y = 0, projects `d` toward +z, `w` wide.
export function consoleGeometry({ h = 0.12, d = 0.12, w = 0.05 } = {}) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(d, 0);
  s.lineTo(d, -h * 0.12);
  s.bezierCurveTo(d * 0.95, -h * 0.35, d * 0.35, -h * 0.3, d * 0.3, -h * 0.62);
  s.bezierCurveTo(d * 0.26, -h * 0.85, d * 0.42, -h * 0.98, d * 0.24, -h);
  s.lineTo(0, -h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 24 });
  // Shape x -> out of the wall (+z), extrusion -> along the wall (x), centred.
  g.rotateY(-Math.PI / 2);
  g.translate((w - 0.006) / 2, 0, 0);
  return g;
}

/**
 * Window pediment in the wall frame, sitting on y: a horizontal bed cornice, then a triangular or
 * segmental raking cornice over a recessed tympanum. Returns { group, apex } (apex = top height).
 */
export function pediment(parent, { x = 0, y, width, kind = 'triangular', rise = width * 0.2, scale = 0.05, material, name = 'pediment' }) {
  const g = group(parent, { p: [x, y, 0], name });
  const base = cornice(scale);
  add(g, moldingRun(base, width), material, { p: [-width / 2, 0, 0], name: 'bedCornice' });
  const top = scale * 0.74;
  const rake = cornice(scale * 0.85).map(([o, u]) => [u, o]).reverse();
  const half = width / 2 - scale * 0.2;
  let pts;
  if (kind === 'segmental') {
    const radius = (half * half + rise * rise) / (2 * rise);
    const cy = top + rise - radius;
    const a = Math.asin(half / radius);
    // Right to left over the top (counter-clockwise), so the moulding's outside faces up and out.
    pts = [];
    for (let i = 0; i <= 40; i++) {
      const phi = a - (2 * a * i) / 40;
      pts.push({ x: Math.sin(phi) * radius, y: cy + Math.cos(phi) * radius });
    }
  } else {
    pts = [{ x: half, y: top }, { x: 0, y: top + rise }, { x: -half, y: top }];
  }
  add(g, moldingAlong(pts, rake, { sharpAngle: 0.3 }), material, { name: 'rakingCornice' });
  // Tympanum: the flat field under the raking cornice, set just proud of the wall.
  const field = new THREE.Shape();
  field.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) field.lineTo(p.x, p.y);
  field.closePath();
  add(g, new THREE.ExtrudeGeometry(field, { depth: 0.008, bevelEnabled: false, curveSegments: 8 }), material, { name: 'tympanum' });
  return { group: g, apex: y + top + rise + scale * 0.6 };
}

/**
 * Curved (bombé) mansard over a W x D eave rectangle at y = 0: every face rises vertically from the
 * eave and rolls back to a shallow slope under the flat top. The four faces are separate sheets
 * meeting at hip rolls; standing seams run square to the eave and stop where they meet a hip.
 * Returns { group, at(t) -> { inset, y }, tAt(y), faces }.
 */
export function curvedMansard(parent, { W, D, height = 0.6, inset = 0.28, bend = 1.15, sheet, seamSpacing = 0.056, rows = 48, cols = 96, name = 'curvedMansard' }) {
  const g = group(parent, { name });
  const at = (t) => ({ inset: (inset * (1 - Math.cos(t * bend))) / (1 - Math.cos(bend)), y: (height * Math.sin(t * bend)) / Math.sin(bend) });
  const tAt = (y) => Math.asin(THREE.MathUtils.clamp((y * Math.sin(bend)) / height, 0, 1)) / bend;
  const tAtInset = (d) => Math.acos(THREE.MathUtils.clamp(1 - (d * (1 - Math.cos(bend))) / inset, -1, 1)) / bend;
  const faces = [
    { name: 'front', ry: 0, half: W / 2, out: D / 2 },
    { name: 'right', ry: Math.PI / 2, half: D / 2, out: W / 2 },
    { name: 'back', ry: Math.PI, half: W / 2, out: D / 2 },
    { name: 'left', ry: -Math.PI / 2, half: D / 2, out: W / 2 },
  ];
  for (const f of faces) {
    // Each face is built in its own frame (eave along x at z = out, facing +z) and turned into place.
    const frame = group(g, { r: [0, f.ry, 0], name: `${f.name}Face` });
    f.frame = frame;
    const positions = [];
    const indices = [];
    for (let j = 0; j <= rows; j++) {
      const { inset: d, y } = at(j / rows);
      const hw = f.half - d;
      for (let i = 0; i <= cols; i++) positions.push(-hw + (2 * hw * i) / cols, y, f.out - d);
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        const b = a + cols + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    add(frame, geo, sheet, { name: 'sheet' });
    // Standing seams, each a folded rib following the curve until it meets a hip.
    const count = Math.floor((2 * f.half) / seamSpacing);
    for (let k = 1; k < count; k++) {
      const s = -f.half + (2 * f.half * k) / count;
      const tMax = f.half - Math.abs(s) >= inset ? 1 : tAtInset(f.half - Math.abs(s));
      if (tMax < 0.04) continue;
      const pts = [];
      const steps = Math.max(4, Math.round(tMax * 24));
      for (let i = 0; i <= steps; i++) {
        const t = (tMax * i) / steps;
        const p = at(t);
        const dt = 1e-3;
        const q = at(Math.min(1, t + dt));
        const ny = q.inset - p.inset;
        const nz = q.y - p.y;
        const len = Math.hypot(ny, nz) || 1;
        pts.push([s, p.y + (ny / len) * 0.0035, f.out - p.inset + (nz / len) * 0.0035]);
      }
      add(frame, tube(pts, 0.0026, { tubular: steps * 2, radial: 6 }), sheet, { cast: false, name: 'seam' });
    }
  }
  // Hip rolls along the four curved arrises.
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const p = at(i / 32);
      pts.push([sx * (W / 2 - p.inset), p.y + 0.004, sz * (D / 2 - p.inset)]);
    }
    add(g, tube(pts, 0.011, { tubular: 64, radial: 10 }), sheet, { name: 'hipRoll' });
  }
  return { group: g, at, tAt, faces };
}

/**
 * Hipped roof on a W x D eave rectangle at y = 0 (pitch on all four sides, ridge along the longer
 * axis): a closed body under four tiled faces, with hip and ridge rolls. exclude: { front, back,
 * left, right } face tests in face coordinates.
 */
export function hipRoof(parent, { W, D, pitch, tile, body, ridge, rng, exclude = {}, name = 'hipRoof' }) {
  const g = group(parent, { name });
  const run = Math.min(W, D) / 2;
  const h = run * Math.tan(pitch);
  const W1 = Math.max(W - 2 * run, 0.001);
  const D1 = Math.max(D - 2 * run, 0.001);
  add(g, frustumGeometry(W, D, W1, D1, h), body, { name: 'roofBody' });
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const slope = run / c;
  const faces = [
    { key: 'front', origin: [0, 0, D / 2], u: [1, 0, 0], v: [0, s, -c], n: [0, c, s], width: W, taper: W1 / W },
    { key: 'back', origin: [0, 0, -D / 2], u: [-1, 0, 0], v: [0, s, c], n: [0, c, -s], width: W, taper: W1 / W },
    { key: 'right', origin: [W / 2, 0, 0], u: [0, 0, -1], v: [-c, s, 0], n: [s, c, 0], width: D, taper: D1 / D },
    { key: 'left', origin: [-W / 2, 0, 0], u: [0, 0, 1], v: [c, s, 0], n: [-s, c, 0], width: D, taper: D1 / D },
  ];
  for (const f of faces) {
    tilePlane(g, {
      origin: new THREE.Vector3(...f.origin),
      u: new THREE.Vector3(...f.u),
      v: new THREE.Vector3(...f.v),
      n: new THREE.Vector3(...f.n),
      width: f.width,
      length: slope,
      taper: f.taper,
      tileW: tile.tileW,
      exposure: tile.exposure,
      geometry: tile.geometry,
      material: tile.material,
      rng,
      colors: tile.colors,
      exclude: exclude[f.key] ?? null,
    });
  }
  const r = ridge.radius ?? 0.022;
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    ridgeCaps(g, { from: [(sx * W) / 2, r * 0.3, (sz * D) / 2], to: [(sx * W1) / 2, h + r * 0.3, (sz * D1) / 2], radius: r, material: ridge.material, rng, colors: ridge.colors });
  }
  if (W1 > 0.01 || D1 > 0.01) {
    const along = W1 >= D1;
    ridgeCaps(g, { from: along ? [-W1 / 2, h + r * 0.3, 0] : [0, h + r * 0.3, -D1 / 2], to: along ? [W1 / 2, h + r * 0.3, 0] : [0, h + r * 0.3, D1 / 2], radius: r, material: ridge.material, rng, colors: ridge.colors });
  }
  return { group: g, height: h, W1, D1, slope };
}
