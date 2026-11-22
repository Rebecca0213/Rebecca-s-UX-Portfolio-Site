import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, cylinder, tube, torus } from '../../kit/geometry.js';
import { chain } from '../../kit/hardware.js';

// S4 — Sign easel: an A-frame pavement board outside a shop. Two pink-framed chalkboards hinge at
// the top on brass hinges, held apart by a little chain; each face carries a chalk drawing (no
// lettering) — a cake slice with a cherry ('cake') or a steaming cup on a saucer ('cup') — framed
// by a chalk border of dots. Faces +z.

const W = 0.17;
const H = 0.3;
const SPLAY = 0.2; // radians each board leans from vertical

// Chalk strokes on a board (board frame: x across, y up from the board's centre, z out).
function chalkDrawing(ctx, parent, motif) {
  const chalk = ctx.materials.roadPaint('#F4F1EA');
  const pink = ctx.materials.roadPaint('#F7C2CF');
  const stroke = (pts, r = 0.0022, mat = chalk) => add(parent, tube(pts.map(([x, y]) => [x, y, 0.0035]), r, { tubular: Math.max(8, pts.length * 6), radial: 5 }), mat, { cast: false, name: 'chalk' });
  // Dotted border.
  for (let i = 0; i < 9; i++) {
    for (const y of [-0.105, 0.105]) add(parent, cylinder(0.003, 0.003, 0.002, 8, 1), chalk, { p: [-0.056 + i * 0.014, y, 0.0035], r: [Math.PI / 2, 0, 0], cast: false, name: 'chalkDot' });
  }
  if (motif === 'cup') {
    stroke([[-0.035, 0.0], [-0.03, -0.04], [0.03, -0.04], [0.035, 0.0], [-0.035, 0.0]]);
    const handle = [];
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      handle.push([0.036 + Math.cos(a) * 0.014, -0.018 + Math.sin(a) * 0.014]);
    }
    stroke(handle);
    stroke([[-0.05, -0.048], [0.05, -0.048]]);
    for (const dx of [-0.014, 0.004, 0.022]) {
      const steam = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        steam.push([dx + Math.sin(t * Math.PI * 2) * 0.006, 0.012 + t * 0.045]);
      }
      stroke(steam, 0.0018);
    }
    stroke([[-0.012, 0.075], [0.0, 0.085], [0.012, 0.075], [0, 0.062], [-0.012, 0.075]], 0.002, pink);
  } else {
    // Cake slice: a wedge of sponge and cream layers with a cherry on top.
    stroke([[-0.045, -0.045], [0.045, -0.045], [0.045, 0.01], [-0.045, 0.03], [-0.045, -0.045]]);
    stroke([[-0.045, -0.012], [0.045, -0.022]], 0.0018, pink);
    stroke([[-0.045, 0.008], [0.045, -0.004]], 0.0018);
    const cherry = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      cherry.push([-0.004 + Math.cos(a) * 0.011, 0.037 + Math.sin(a) * 0.011]);
    }
    stroke(cherry, 0.0022, pink);
    stroke([[-0.002, 0.048], [0.004, 0.064], [0.014, 0.07]], 0.0016);
  }
}

export default function build(ctx, { motif = 'cake' } = {}) {
  const m = ctx.materials;
  const root = new THREE.Group();
  root.name = 'SignEasel';
  const frame = m.paintedWood('#F6B9C9');
  const brass = m.metal('brass');

  const hingeY = H * Math.cos(SPLAY);
  for (const side of [1, -1]) {
    // Each board hangs from the hinge line and leans out toward its own side.
    const board = group(root, { p: [0, hingeY, 0], r: [-side * SPLAY, side > 0 ? 0 : Math.PI, 0], name: side > 0 ? 'frontBoard' : 'backBoard' });
    const face = group(board, { p: [0, -H / 2, 0.012], name: 'face' });
    add(face, roundedBox(W - 0.024, H - 0.05, 0.006, 0.002, 1), m.chalkboard(), { name: 'chalkboard' });
    for (const sx of [-1, 1]) add(face, roundedBox(0.016, H, 0.018, 0.004, 2), frame, { p: [sx * (W / 2 - 0.008), -0.006, 0], name: 'stile' });
    for (const y of [H / 2 - 0.012, -H / 2 + 0.03]) add(face, roundedBox(W, 0.022, 0.018, 0.004, 2), frame, { p: [0, y, 0], name: 'rail' });
    chalkDrawing(ctx, group(face, { name: 'drawing' }), motif);
  }
  for (const sx of [-1, 1]) add(root, cylinder(0.006, 0.006, 0.024, 12, 1), brass, { p: [sx * (W / 2 - 0.02), hingeY - 0.004, 0], r: [0, 0, Math.PI / 2], name: 'hinge' });
  add(root, torus(0.008, 0.002, 8, 16), brass, { p: [0, hingeY + 0.006, 0], name: 'handleRing' });
  const spread = Math.sin(SPLAY) * H * 0.55;
  for (const sx of [-1, 1]) chain(root, { from: [sx * (W / 2 - 0.012), hingeY - H * 0.55 * Math.cos(SPLAY), spread], to: [sx * (W / 2 - 0.012), hingeY - H * 0.55 * Math.cos(SPLAY), -spread], link: 0.009, material: brass, name: 'stayChain' });

  root.userData.footprint = { r: 0.13 };
  return root;
}
