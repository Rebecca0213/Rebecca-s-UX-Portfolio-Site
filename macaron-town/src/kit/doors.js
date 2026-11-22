import * as THREE from 'three';
import { add, group } from './place.js';
import { opening } from './shapes.js';
import { moldingAlong, moldingRun } from './sweep.js';
import { architrave, cornice } from './profiles.js';
import { roundedBox, extrude, sphere, cylinder, torus, lathe, spline } from './geometry.js';
import { headPath, springHeight } from './windows.js';

// Raised panel: bevelled field proud of the leaf.
function raisedPanel(g, x, y, w, h, material) {
  const s = new THREE.Shape();
  const b = 0.006;
  s.moveTo(-w / 2 + b, -h / 2 + b);
  s.lineTo(w / 2 - b, -h / 2 + b);
  s.lineTo(w / 2 - b, h / 2 - b);
  s.lineTo(-w / 2 + b, h / 2 - b);
  s.closePath();
  add(g, extrude(s, 0.014, { bevel: b, bevelSegments: 4 }), material, { p: [x, y, 0.004] });
}

function leaf(ctx, g, { x, y, w, h, material, metal, glazed, room, seed, hingeSide }) {
  const l = group(g, { p: [x, y, 0], name: 'leaf' });
  const stile = Math.min(0.035, w * 0.16);
  const rail = stile;
  // Leaf body: full height when panelled; only the lower half when glazed (the upper light is open).
  const bodyH = glazed ? h * 0.45 : h;
  add(l, roundedBox(w, bodyH, 0.022, 0.004, 3), material, { p: [0, bodyH / 2, 0], name: 'body' });
  for (const sx of [-1, 1]) add(l, roundedBox(stile, h, 0.03, 0.004, 3), material, { p: [sx * (w / 2 - stile / 2), h / 2, 0.004] });
  for (const yy of [rail / 2, h * 0.45, h - rail / 2]) add(l, roundedBox(w - 2 * stile, rail, 0.03, 0.004, 3), material, { p: [0, yy, 0.004] });
  const fieldW = w - 2 * stile - 0.012;
  raisedPanel(l, 0, (rail + h * 0.45) / 2, fieldW, h * 0.45 - rail * 1.6, material);
  if (glazed) {
    // The pane runs under the stiles and rails (bedded in their rebates), so no gap shows.
    const gw = w - 2 * stile + 0.006;
    const gh = h - rail - (h * 0.45 + rail / 2) + 0.006;
    const shape = new THREE.Shape();
    shape.moveTo(-gw / 2, -gh / 2);
    shape.lineTo(gw / 2, -gh / 2);
    shape.lineTo(gw / 2, gh / 2);
    shape.lineTo(-gw / 2, gh / 2);
    shape.closePath();
    const cy = (h * 0.45 + rail / 2 + (h - rail)) / 2;
    add(l, new THREE.ShapeGeometry(shape), ctx.materials.glass({ width: gw, height: gh, depth: 0.45, seed, ...room }), { p: [0, cy, -0.002], cast: false, name: 'glass' });
    add(l, roundedBox(0.009, gh, 0.009, 0.002, 2), material, { p: [0, cy, 0.004], name: 'glazingBar' });
    add(l, roundedBox(gw, 0.009, 0.009, 0.002, 2), material, { p: [0, cy, 0.004], name: 'glazingBar' });
  } else {
    raisedPanel(l, 0, (h * 0.45 + h) / 2, fieldW, h * 0.55 - rail * 1.6, material);
  }
  const handleX = -hingeSide * (w / 2 - stile * 0.55);
  add(l, roundedBox(0.012, 0.05, 0.004, 0.002, 2), metal, { p: [handleX, h * 0.47, 0.021] });
  add(l, sphere(0.0085, 24, 16), metal, { p: [handleX, h * 0.47, 0.03] });
  add(l, cylinder(0.003, 0.003, 0.012, 12), metal, { p: [handleX, h * 0.47, 0.024], r: [Math.PI / 2, 0, 0] });
  for (const yy of [h * 0.12, h * 0.5, h * 0.88]) {
    add(l, cylinder(0.005, 0.005, 0.03, 16), metal, { p: [hingeSide * (w / 2 + 0.002), yy, 0.014] });
  }
  add(l, roundedBox(w - 2 * stile, 0.045, 0.003, 0.001, 1), metal, { p: [0, 0.028, 0.02] });
  return l;
}

/**
 * Door in a wall opening: moulded surround, jamb frame, panelled leaf (or pair), fanlight in arched
 * heads, brass hardware, threshold and stone steps.
 */
export function buildDoor(ctx, parent, spec) {
  const {
    x = 0,
    w,
    h,
    kind = 'round',
    rise,
    trim,
    material,
    metal = ctx.materials.metal('brass'),
    stone = ctx.materials.stone('#EFE4D6'),
    glazed = true,
    double = false,
    room = { style: 1, glow: 1.1 },
    casing = 0.06,
    steps = 2,
    hood = false,
    seed = 1,
  } = spec;
  const g = group(parent, { name: 'door' });
  const open = { w, h, kind, rise, x, y: 0 };

  if (casing > 0) add(g, moldingAlong(headPath(open).getPoints(48), architrave(casing)), trim, { p: [0, 0, 0.0004] });

  const f = 0.022;
  const outer = opening(open);
  outer.holes.push(opening({ ...open, w: w - 2 * f, h: h - f, y: 0, rise: rise !== undefined ? rise - f : undefined }));
  add(g, extrude(outer, 0.05, { bevel: 0.003 }), trim, { p: [0, 0, -0.032] });

  const leafH = springHeight(open) - (kind === 'rect' ? f : 0.008);
  const leafW = w - 2 * f;
  const recess = group(g, { p: [0, 0, -0.06] });
  if (double) {
    leaf(ctx, recess, { x: x - leafW / 4, y: 0.008, w: leafW / 2 - 0.002, h: leafH - 0.008, material, metal, glazed, room, seed, hingeSide: -1 });
    leaf(ctx, recess, { x: x + leafW / 4, y: 0.008, w: leafW / 2 - 0.002, h: leafH - 0.008, material, metal, glazed, room, seed: seed + 0.37, hingeSide: 1 });
  } else {
    leaf(ctx, recess, { x, y: 0.008, w: leafW, h: leafH - 0.008, material, metal, glazed, room, seed, hingeSide: 1 });
  }

  if (kind !== 'rect') {
    const fanSpring = leafH;
    add(g, roundedBox(leafW, 0.02, 0.04, 0.004, 2), trim, { p: [x, fanSpring, -0.04] });
    if (kind === 'round') {
      const r = leafW / 2;
      const semi = new THREE.Shape();
      semi.moveTo(r, 0);
      semi.absarc(0, 0, r, 0, Math.PI, false);
      semi.closePath();
      add(g, new THREE.ShapeGeometry(semi, 64), ctx.materials.glass({ width: leafW, height: r * 2, depth: 0.5, seed: seed + 0.11, ...room }), { p: [x, fanSpring + 0.01, -0.05], cast: false });
      for (let i = 1; i < 6; i++) {
        const a = (i / 6) * Math.PI;
        const len = r * 0.95;
        add(g, roundedBox(len, 0.008, 0.008, 0.002, 2), trim, { p: [x + Math.cos(a) * len * 0.5, fanSpring + 0.01 + Math.sin(a) * len * 0.5, -0.042], r: [0, 0, a] });
      }
      add(g, torus(r * 0.3, 0.005, 8, 48, Math.PI), trim, { p: [x, fanSpring + 0.01, -0.042] });
    } else {
      // Segmental or basket head: a solid painted tympanum panel filling the arch.
      const headRise = (rise ?? w * 0.18) - f * 0.5;
      const head = new THREE.Shape();
      head.moveTo(leafW / 2, 0);
      head.absellipse(0, 0, leafW / 2, headRise, 0, Math.PI, false, 0);
      head.closePath();
      add(g, extrude(head, 0.02, { bevel: 0.003 }), material, { p: [x, fanSpring + 0.01, -0.05] });
    }
  }

  if (hood) {
    const len = w + casing * 2.4 + 0.06;
    add(g, moldingRun(cornice(0.07), len), trim, { p: [x - len / 2, h + casing * 0.35, 0] });
    for (const side of [-1, 1]) {
      const console = lathe(spline([[0, 0], [0.012, 0], [0.018, 0.03], [0.012, 0.06], [0.02, 0.09], [0, 0.09]], 32), 32);
      add(g, console, trim, { p: [x + side * (w / 2 + casing * 0.9), h - 0.06, 0.03], s: [1, 1, 1] });
    }
  }

  add(g, roundedBox(w + 0.02, 0.012, 0.07, 0.003, 2), stone, { p: [x, 0.006, -0.03] });
  // The door sits at floor level (y = 0); steps descend to the ground at y = -0.034 * steps.
  for (let i = 0; i < steps; i++) {
    const sw = w + 0.12 + 0.06 * i;
    const sd = 0.07 + 0.065 * i;
    add(g, roundedBox(sw, 0.034, sd, 0.008, 3), stone, { p: [x, -0.017 - 0.034 * i, sd / 2] });
  }
  return g;
}
