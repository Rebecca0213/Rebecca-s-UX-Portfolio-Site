import * as THREE from 'three';
import { add, group } from './place.js';
import { opening } from './shapes.js';
import { moldingAlong, moldingRun } from './sweep.js';
import { architrave, sill as sillProfile, cornice } from './profiles.js';
import { roundedBox, extrude, torus, lathe, spline, tube } from './geometry.js';
import { instanced } from './instancing.js';
import { plantPatch, trailingStrand } from './flora.js';
import { createRandom } from './random.js';

// Everything here is built in a wall's local frame: x along the wall, y up from the wall base,
// z out of the outer face (z = 0), wall interior toward -z.

// Open outline of an opening's jambs and head: bottom-right corner, up, over the head, down to bottom-left.
export function headPath({ w, h, kind = 'rect', rise = w * 0.18, x = 0, y = 0 }) {
  const p = new THREE.Path();
  const hw = w / 2;
  p.moveTo(x + hw, y);
  if (kind === 'rect') {
    p.lineTo(x + hw, y + h);
    p.lineTo(x - hw, y + h);
  } else if (kind === 'round') {
    const spring = y + h - hw;
    p.lineTo(x + hw, spring);
    p.absarc(x, spring, hw, 0, Math.PI, false);
  } else if (kind === 'segmental') {
    const spring = y + h - rise;
    const radius = (hw * hw + rise * rise) / (2 * rise);
    const cy = spring + rise - radius;
    const a = Math.atan2(spring - cy, hw);
    p.lineTo(x + hw, spring);
    p.absarc(x, cy, radius, a, Math.PI - a, false);
  } else if (kind === 'basket') {
    const spring = y + h - rise;
    p.lineTo(x + hw, spring);
    p.absellipse(x, spring, hw, rise, 0, Math.PI, false, 0);
  }
  p.lineTo(x - hw, y);
  return p;
}

// Height of the straight-sided part of an opening (below the spring line).
export function springHeight({ w, h, kind = 'rect', rise = w * 0.18 }) {
  if (kind === 'round') return h - w / 2;
  if (kind === 'segmental' || kind === 'basket') return h - rise;
  return h;
}

function insetSpec(spec, f) {
  const inner = { ...spec, w: spec.w - 2 * f, h: spec.h - 2 * f, y: spec.y + f };
  if (spec.kind === 'circle') inner.h = spec.h - 2 * f;
  if (spec.rise !== undefined) inner.rise = Math.max(spec.rise - f, 0.01);
  return inner;
}

function casingOn(g, spec, material, size) {
  if (spec.kind === 'circle') {
    const pts = new THREE.Path().absarc(spec.x ?? 0, (spec.y ?? 0) + spec.h / 2, spec.h / 2, 0, Math.PI * 2, false).getPoints(96);
    pts.pop();
    return add(g, moldingAlong(pts, architrave(size), { closed: true }), material, { p: [0, 0, 0.0004] });
  }
  return add(g, moldingAlong(headPath(spec).getPoints(48), architrave(size)), material, { p: [0, 0, 0.0004] });
}

// Sash/jamb frame: the opening outline with the inner light cut out, set back into the reveal.
function frameRing(g, spec, f, depth, z, material) {
  const outer = opening({ ...spec, x: spec.x ?? 0, y: spec.y ?? 0 });
  outer.holes.push(opening({ ...insetSpec(spec, f), x: spec.x ?? 0 }));
  return add(g, extrude(outer, depth, { bevel: 0.0025, bevelSegments: 3 }), material, { p: [0, 0, z] });
}

function glazingBars(g, spec, inner, material, panes, z) {
  const [cols, rows] = panes;
  const bar = 0.011;
  const x0 = inner.x - inner.w / 2;
  const straight = springHeight(inner);
  for (let c = 1; c < cols; c++) {
    const x = x0 + (inner.w * c) / cols;
    const height = inner.kind === 'rect' || inner.kind === 'circle' ? inner.h : straight;
    add(g, roundedBox(bar, height, bar, 0.003, 2), material, { p: [x, inner.y + height / 2, z] });
  }
  for (let r = 1; r < rows; r++) {
    const yy = inner.y + (straight * r) / rows;
    add(g, roundedBox(inner.w, bar, bar, 0.003, 2), material, { p: [inner.x, yy, z] });
  }
  if (inner.kind === 'round' || inner.kind === 'segmental' || inner.kind === 'basket') {
    const springY = inner.y + straight;
    add(g, roundedBox(inner.w, bar * 1.2, bar * 1.1, 0.003, 2), material, { p: [inner.x, springY, z] });
    const radius = inner.kind === 'round' ? inner.w / 2 : inner.rise;
    const hub = radius * 0.32;
    add(g, torus(hub, bar * 0.5, 8, 48, Math.PI), material, { p: [inner.x, springY, z], s: [1, inner.kind === 'round' ? 1 : inner.rise / (inner.w / 2), 1] });
    for (const a of [Math.PI / 6, Math.PI / 2, (Math.PI * 5) / 6]) {
      const ry = inner.kind === 'round' ? 1 : inner.rise / (inner.w / 2);
      const len = (inner.w / 2 - hub) * 0.98;
      const cx = Math.cos(a) * (hub + len / 2);
      const cy = Math.sin(a) * (hub + len / 2) * ry;
      const angle = Math.atan2(Math.sin(a) * ry, Math.cos(a));
      add(g, roundedBox(len, bar, bar, 0.003, 2), material, { p: [inner.x + cx, springY + cy, z], r: [0, 0, angle] });
    }
  }
  if (inner.kind === 'circle') {
    add(g, roundedBox(inner.h, bar, bar, 0.003, 2), material, { p: [inner.x, inner.y + inner.h / 2, z] });
    add(g, roundedBox(bar, inner.h, bar, 0.003, 2), material, { p: [inner.x, inner.y + inner.h / 2, z] });
  }
}

function glassPane(ctx, g, inner, room, seed, z) {
  const shape = opening({ ...inner, x: 0, y: -inner.h / 2 });
  const material = ctx.materials.glass({
    width: inner.w,
    height: inner.h,
    depth: Math.max(inner.w, inner.h) * 0.75 + 0.06,
    seed,
    ...room,
  });
  const pane = add(g, new THREE.ShapeGeometry(shape, 64), material, { p: [inner.x, inner.y + inner.h / 2, z], cast: false });
  return pane;
}

function keystone(g, spec, material) {
  const s = new THREE.Shape();
  const b = Math.max(0.035, spec.w * 0.13);
  const t = b * 1.45;
  const hgt = b * 1.9;
  s.moveTo(-b / 2, 0);
  s.lineTo(b / 2, 0);
  s.lineTo(t / 2, hgt);
  s.lineTo(-t / 2, hgt);
  s.closePath();
  add(g, extrude(s, 0.03, { bevel: 0.004, bevelSegments: 3 }), material, { p: [spec.x, spec.y + spec.h - hgt * 0.3, 0.017] });
}

// side: -1 for the leaf left of the opening, +1 for the right one (hinges face the opening).
function louveredShutter(ctx, g, { x, y, w, h, material, metal, rng, side }) {
  const leaf = group(g, { p: [x, y, 0.012], name: 'shutter' });
  const stile = 0.013;
  add(leaf, roundedBox(stile, h, 0.012, 0.003, 2), material, { p: [-w / 2 + stile / 2, h / 2, 0] });
  add(leaf, roundedBox(stile, h, 0.012, 0.003, 2), material, { p: [w / 2 - stile / 2, h / 2, 0] });
  for (const yy of [stile / 2, h / 2, h - stile / 2]) {
    add(leaf, roundedBox(w - 2 * stile, stile, 0.012, 0.003, 2), material, { p: [0, yy, 0] });
  }
  const slats = [];
  const pitch = 0.0125;
  for (const [a, b] of [
    [stile, h / 2 - stile / 2],
    [h / 2 + stile / 2, h - stile],
  ]) {
    for (let yy = a + pitch * 0.6; yy < b - pitch * 0.4; yy += pitch) {
      slats.push({ p: [0, yy, 0], r: [0.62 + rng.range(-0.04, 0.04), 0, 0] });
    }
  }
  leaf.add(instanced(roundedBox(w - 2 * stile, 0.0032, 0.016, 0.0012, 1), material, slats));
  for (const yy of [h * 0.18, h * 0.82]) {
    add(leaf, roundedBox(0.012, 0.007, 0.004, 0.0015, 1), metal, { p: [-side * (w / 2 + 0.004), yy, 0.007] });
  }
  return leaf;
}

// onSill: the box rests on the window sill (no brackets); otherwise it hangs on iron brackets.
function flowerBox(ctx, g, { x, y, w, material, metal, palette, rng, trailing = true, onSill = false }) {
  const box = group(g, { p: [x, y, 0], name: 'flowerBox' });
  const depth = 0.07;
  const height = 0.055;
  add(box, roundedBox(w, height, depth, 0.006, 3), material, { p: [0, -height / 2, depth / 2 + 0.006] });
  // Lip: four rails around the open top, so the soil and planting show inside.
  const lip = 0.008;
  for (const sz of [-1, 1]) add(box, roundedBox(w + 0.008, 0.006, lip, 0.002, 2), material, { p: [0, -0.002, depth / 2 + 0.006 + sz * (depth / 2 + 0.004 - lip / 2)], name: 'lip' });
  for (const sx of [-1, 1]) add(box, roundedBox(lip, 0.006, depth + 0.008 - 2 * lip, 0.002, 2), material, { p: [sx * (w / 2 + 0.004 - lip / 2), -0.002, depth / 2 + 0.006], name: 'lip' });
  add(box, roundedBox(w - 0.008, 0.01, depth - 0.008, 0.003, 2), ctx.materials.stone('#7A5B4E'), { p: [0, -0.012, depth / 2 + 0.006], cast: false, name: 'soil' });
  for (const bx of onSill ? [] : [-w * 0.35, w * 0.35]) {
    add(box, roundedBox(0.008, 0.045, 0.008, 0.002, 2), metal, { p: [bx, -height - 0.018, 0.012] });
    add(box, roundedBox(0.008, 0.008, depth * 0.9, 0.002, 2), metal, { p: [bx, -height - 0.002, depth / 2] });
    add(box, tube([[bx, -height - 0.038, 0.006], [bx, -height - 0.03, depth * 0.35], [bx, -height - 0.008, depth * 0.75]], 0.003, { tubular: 24, radial: 6 }), metal);
  }
  plantPatch(ctx, box, { x0: -w / 2 + 0.008, x1: w / 2 - 0.008, z0: 0.012, z1: depth, y: -0.007, density: 11000, palette, rng, bloomScale: 0.0105, leafScale: 0.021, mound: 0.016 });
  if (trailing) {
    const strands = Math.max(2, Math.round(w / 0.09));
    for (let i = 0; i < strands; i++) {
      const sx = -w / 2 + (w * (i + 0.5)) / strands + rng.range(-0.01, 0.01);
      trailingStrand(ctx, box, { start: [sx, -0.002, depth + 0.008], length: rng.range(0.05, 0.13), rng, leaves: 9, bloomPalette: rng.chance(0.5) ? palette : null });
    }
  }
  return box;
}

function balconette(ctx, g, { x, y, w, metal, stone }) {
  const b = group(g, { p: [x, y, 0], name: 'balconette' });
  const depth = 0.075;
  add(b, roundedBox(w + 0.05, 0.022, depth + 0.02, 0.005, 3), stone, { p: [0, -0.011, (depth + 0.02) / 2] });
  const height = 0.13;
  const front = depth;
  add(b, roundedBox(w + 0.03, 0.009, 0.009, 0.003, 2), metal, { p: [0, height, front] });
  add(b, roundedBox(w + 0.03, 0.006, 0.006, 0.002, 2), metal, { p: [0, 0.016, front] });
  for (const side of [-1, 1]) {
    add(b, roundedBox(0.006, 0.006, depth, 0.002, 2), metal, { p: [side * (w / 2 + 0.012), height, depth / 2] });
    add(b, roundedBox(0.007, height, 0.007, 0.002, 2), metal, { p: [side * (w / 2 + 0.012), height / 2, front] });
  }
  const spindle = lathe(spline([[0.0, 0.0], [0.0028, 0.0], [0.0022, 0.02], [0.004, 0.045], [0.0022, 0.07], [0.0034, 0.09], [0.0024, 0.1], [0.0, 0.1]], 40), 12);
  const posts = [];
  for (let px = -w / 2; px <= w / 2 + 1e-6; px += 0.017) posts.push({ p: [px, 0.019, front], s: [1, (height - 0.02) / 0.1, 1] });
  b.add(instanced(spindle, metal, posts));
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = t * Math.PI * 1.6;
      pts.push([side * (0.012 + Math.sin(a) * 0.022 * (1 - t * 0.4)), 0.03 + t * 0.08 + Math.cos(a) * 0.01, front + 0.004]);
    }
    add(b, tube(pts, 0.0024, { tubular: 64, radial: 6 }), metal);
  }
  return b;
}

/**
 * A complete window in its wall opening. The wall slab must have been cut with the same {x, y, w, h, kind}.
 */
export function buildWindow(ctx, parent, spec) {
  const {
    x = 0,
    y = 0,
    w,
    h,
    kind = 'rect',
    rise,
    trim,
    sash,
    metal = ctx.materials.metal('iron'),
    room = {},
    panes = [2, 3],
    casing = 0.045,
    sill = true,
    keystone: withKeystone = kind === 'round' || kind === 'segmental',
    hood = kind === 'rect',
    shutters = null,
    box = null,
    balcony = null,
    seed = 1,
  } = spec;
  const rng = createRandom(Math.floor(seed * 7919) + 3);
  const g = group(parent, { name: 'window' });
  const open = { w, h, kind, rise, x, y };
  const f = Math.max(0.016, Math.min(w, h) * 0.065);
  const inner = { ...insetSpec(open, f), x };

  if (casing > 0) casingOn(g, open, trim, casing);
  frameRing(g, open, f, 0.03, -0.035, sash);
  glassPane(ctx, g, inner, room, seed, -0.045);
  glazingBars(g, open, inner, sash, panes, -0.031);

  if (sill && kind !== 'circle') {
    const len = w + casing * 1.9 + 0.02;
    add(g, moldingRun(sillProfile(0.078), len), trim, { p: [x - len / 2, y, 0] });
  }
  if (withKeystone && kind !== 'rect' && kind !== 'circle') keystone(g, open, trim);
  if (hood && kind === 'rect' && casing > 0) {
    const len = w + casing * 2.2 + 0.03;
    add(g, moldingRun(cornice(0.05), len), trim, { p: [x - len / 2, y + h + casing * 0.32, 0] });
  }
  if (shutters) {
    const leafW = w * 0.52;
    const leafH = springHeight(open) + (kind === 'rect' ? 0 : Math.min(w * 0.18, h * 0.1));
    for (const side of [-1, 1]) {
      louveredShutter(ctx, g, {
        x: x + side * (w / 2 + casing + leafW / 2 + 0.006),
        y,
        w: leafW,
        h: leafH,
        material: shutters,
        metal,
        rng,
        side,
      });
    }
  }
  if (box) {
    // On a sill the box stands on its weathered top, planting rising in front of the lower panes.
    const onSill = sill && kind !== 'circle';
    flowerBox(ctx, g, { x, y: onSill ? y + 0.057 : y - 0.034, w: w + 0.05, material: box.material, metal, palette: box.palette, rng, trailing: box.trailing !== false, onSill });
  }
  if (balcony) balconette(ctx, g, { x, y: y - 0.005, w: w + 0.04, metal, stone: balcony.stone });
  return g;
}
