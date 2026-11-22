import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, lathe, spline, tube, extrude } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { moldingRing } from '../../kit/sweep.js';
import { plinth, cornice } from '../../kit/profiles.js';
import { scallopBand } from '../../kit/shapes.js';
import { beadBorderGeometry } from '../../kit/piping.js';
import { macaron, MACARON_COLORS } from '../../kit/macaron.js';

// B11 — Macaron kiosk: a round pâtisserie stall on the green. A striped pink-and-cream counter with
// piped borders opens toward the street; inside, a three-tier stand of macarons. Six gilded
// barley-sugar columns carry a scalloped valance hung with bulbs, and the roof is itself a giant
// rose macaron crowned with a glossy cherry.

const R_COUNTER = 0.62;
const COUNTER_H = 0.42;
const COL_R = 0.6;
const RING_Y = 1.26;
const ROOF_R = 0.84;
const OPEN_HALF = 0.55; // half-angle of the serving opening (radians), facing +z

export default function build(ctx, { seed = 1111 } = {}) {
  const m = ctx.materials;
  const root = new THREE.Group();
  root.name = 'MacaronKiosk';

  const stone = m.stone('#F3EAE0');
  const pink = m.paintedWood('#F6B9C9');
  const creamWood = m.paintedWood('#FFF7EE');
  const marble = m.stone('#F7D9E0');
  const gold = m.metal('gold');
  const icing = m.cream('#FFFFFF');

  /* ---------- plinth and striped counter ---------- */
  add(root, cylinder(0.8, 0.82, 0.05, 128, 1), stone, { p: [0, 0.025, 0], name: 'plinth' });
  add(root, moldingRing(plinth(0.04), 0.8, { segments: 160 }), stone, { p: [0, 0.0, 0], name: 'plinthMoulding' });
  const arc = Math.PI * 2 - 2 * OPEN_HALF;
  const start = OPEN_HALF; // LatheGeometry angles: 0 = +z
  const staves = 28;
  for (let i = 0; i < staves; i++) {
    const a0 = start + (arc * i) / staves;
    const a1 = start + (arc * (i + 1)) / staves;
    const geo = lathe([[R_COUNTER - 0.05, 0], [R_COUNTER, 0], [R_COUNTER, COUNTER_H], [R_COUNTER - 0.05, COUNTER_H], [R_COUNTER - 0.05, 0]], 6, a0, a1 - a0);
    add(root, geo, i % 2 ? creamWood : pink, { p: [0, 0.05, 0], name: 'counterStave' });
  }
  add(root, lathe([[R_COUNTER - 0.08, 0], [R_COUNTER + 0.035, 0], [R_COUNTER + 0.04, 0.012], [R_COUNTER + 0.035, 0.026], [R_COUNTER - 0.08, 0.026], [R_COUNTER - 0.08, 0]], 96, start, arc), marble, { p: [0, 0.05 + COUNTER_H, 0], name: 'counterTop' });
  add(root, beadBorderGeometry({ radius: R_COUNTER + 0.004, y: 0, bead: 0.016, beads: 70, tubular: 1400, radial: 12 }), icing, { p: [0, 0.07, 0], name: 'basePiping' });
  for (const sx of [-1, 1]) {
    const a = sx * OPEN_HALF;
    add(root, cylinder(0.03, 0.03, COUNTER_H + 0.03, 24, 1), pink, { p: [Math.sin(a) * (R_COUNTER - 0.025), 0.05 + (COUNTER_H + 0.03) / 2, Math.cos(a) * (R_COUNTER - 0.025)], name: 'counterPost' });
  }
  // Round medallion with a little macaron on the counter's back (no lettering).
  const medal = group(root, { p: [0, 0.05 + COUNTER_H * 0.55, -R_COUNTER - 0.004], r: [0, Math.PI, 0], name: 'medallion' });
  add(medal, cylinder(0.075, 0.075, 0.01, 48, 1), creamWood, { r: [Math.PI / 2, 0, 0], name: 'disc' });
  add(medal, torus(0.075, 0.008, 10, 64), gold, { name: 'frame' });
  macaron(ctx, medal, { radius: 0.04, flavour: 'pistachio', p: [0, 0, 0.016], r: [Math.PI / 2, 0, 0], seed: seed + 3 });

  /* ---------- the macaron tower on the counter ---------- */
  const stand = group(root, { p: [0, 0.05, 0], name: 'macaronStand' });
  add(stand, lathe(spline([[0, 0], [0.08, 0], [0.05, 0.02], [0.024, 0.06], [0.02, 0.44], [0, 0.44]], 48), 40), gold, { name: 'stem' });
  // Gilded rod threading the upper tiers onto the stem.
  add(stand, cylinder(0.008, 0.008, 0.27, 16, 1), gold, { p: [0, 0.44 + 0.135, 0], name: 'rod' });
  for (const y of [0.555, 0.655]) add(stand, lathe(spline([[0, 0], [0.018, 0], [0.012, 0.008], [0.009, 0.012], [0, 0.012]], 12), 24), gold, { p: [0, y - 0.012, 0], name: 'collar' });
  const flavours = Object.keys(MACARON_COLORS);
  const tiers = [{ y: 0.46, r: 0.2, n: 12 }, { y: 0.56, r: 0.14, n: 9 }, { y: 0.66, r: 0.08, n: 6 }];
  tiers.forEach((t, ti) => {
    add(stand, cylinder(t.r + 0.03, t.r + 0.02, 0.008, 48, 1), m.ceramic('#FFFFFF'), { p: [0, t.y, 0], name: 'plate' });
    add(stand, torus(t.r + 0.03, 0.004, 8, 64), gold, { p: [0, t.y + 0.003, 0], r: [Math.PI / 2, 0, 0], name: 'plateRim' });
    for (let k = 0; k < t.n; k++) {
      const a = (k / t.n) * Math.PI * 2 + ti * 0.3;
      macaron(ctx, stand, { radius: 0.026, flavour: flavours[(k + ti * 2) % flavours.length], p: [Math.sin(a) * t.r, t.y + 0.032, Math.cos(a) * t.r], r: [Math.PI / 2 - 0.25, a, 0, 'YXZ'], seed: seed + 20 + ti * 20 + k });
    }
  });
  macaron(ctx, stand, { radius: 0.03, flavour: 'raspberry', p: [0, 0.71, 0], seed: seed + 90 });

  /* ---------- barley-sugar columns, valance, bulbs ---------- */
  const colTop = RING_Y - 0.02;
  const colBase = 0.05 + COUNTER_H + 0.026;
  // Columns stand on the counter: the first and last flank the serving opening.
  for (let k = 0; k < 6; k++) {
    const a = OPEN_HALF + 0.1 + (k * (Math.PI * 2 - 2 * (OPEN_HALF + 0.1))) / 5;
    const cx = Math.sin(a) * COL_R;
    const cz = Math.cos(a) * COL_R;
    const col = group(root, { p: [cx, colBase, cz], name: 'column' });
    const h = colTop - colBase;
    add(col, cylinder(0.014, 0.014, h, 16, 1), creamWood, { p: [0, h / 2, 0], name: 'core' });
    for (const ph of [0, Math.PI]) {
      const pts = [];
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        const aa = t * Math.PI * 2 * 5 + ph;
        pts.push([Math.cos(aa) * 0.014, t * h, Math.sin(aa) * 0.014]);
      }
      add(col, tube(pts, 0.0085, { tubular: 240, radial: 8 }), ph ? pink : gold, { name: 'twist' });
    }
    add(col, lathe(spline([[0, 0], [0.03, 0], [0.026, 0.012], [0.02, 0.02], [0, 0.02]], 16), 24), gold, { name: 'base' });
    add(col, lathe(spline([[0, 0], [0.02, 0], [0.034, 0.02], [0.036, 0.03], [0, 0.03]], 16), 24), gold, { p: [0, h - 0.03, 0], name: 'capital' });
  }
  add(root, moldingRing(cornice(0.06), ROOF_R - 0.16, { segments: 160 }), creamWood, { p: [0, RING_Y, 0], name: 'ringCornice' });
  // Ceiling slab: its underside is the kiosk ceiling and its rim closes the back of the ring cornice.
  add(root, cylinder(ROOF_R - 0.15, ROOF_R - 0.15, 0.05, 96, 1), creamWood, { p: [0, RING_Y + 0.025, 0], name: 'ceiling' });
  // Scalloped valance pieces, alternating pink and cream, hung around the ring.
  const scallops = 40;
  const vr = ROOF_R - 0.115;
  const piece = extrude(scallopBand((Math.PI * 2 * vr) / scallops + 0.002, 0.07, 1, 0.035), 0.004, { bevel: 0.001, bevelSegments: 1, curveSegments: 16 });
  for (let k = 0; k < scallops; k++) {
    const a = ((k + 0.5) / scallops) * Math.PI * 2;
    add(root, piece, m.fabric(k % 2 ? '#FFF7EE' : '#F6B9C9'), { p: [Math.sin(a) * vr, RING_Y - 0.072, Math.cos(a) * vr], r: [0, a, 0], cast: false, name: 'valance' });
  }
  const bulbs = [];
  for (let k = 0; k < scallops; k++) {
    const a = (k / scallops) * Math.PI * 2;
    bulbs.push({ p: [Math.sin(a) * (vr + 0.01), RING_Y - 0.005, Math.cos(a) * (vr + 0.01)], s: 0.011 });
  }
  root.add(instanced(sphere(1, 12, 10), m.bulb('#FFE9B8', 2.4), bulbs, { cast: false, name: 'bulbs' }));

  /* ---------- the giant macaron roof and its cherry ---------- */
  const roofCentre = RING_Y + 0.06 * 0.74 + 0.38 * (ROOF_R / 0.82);
  macaron(ctx, root, { radius: ROOF_R, flavour: 'rose', p: [0, roofCentre, 0], seed: seed + 7, name: 'macaronRoof' });
  const top = roofCentre + 0.38 * (ROOF_R / 0.82);
  const cherry = group(root, { p: [0, top - 0.012, 0], name: 'cherry' });
  add(cherry, sphere(0.1, 64, 48), m.glaze('#E23B5A'), { p: [0, 0.085, 0], s: [1, 0.92, 1], name: 'fruit' });
  add(cherry, sphere(0.02, 16, 12), m.glaze('#B82C47'), { p: [0, 0.172, 0], name: 'dimple' });
  add(cherry, tube([[0, 0.17, 0], [0.01, 0.24, 0.0], [0.05, 0.3, 0.01], [0.1, 0.32, 0.02]], 0.007, { tubular: 40, radial: 8 }), m.bark('#6E8B4E'), { name: 'stem' });
  const leaf = new THREE.Shape();
  leaf.moveTo(0, 0);
  leaf.quadraticCurveTo(0.03, 0.03, 0.08, 0);
  leaf.quadraticCurveTo(0.03, -0.03, 0, 0);
  add(cherry, extrude(leaf, 0.004, { bevel: 0.001, bevelSegments: 1, curveSegments: 16 }), m.leaf('#7FB27A'), { p: [0.09, 0.32, 0.02], r: [0.3, -0.4, 0.4], name: 'leaf' });

  root.userData.footprint = { r: 1.0 };
  return root;
}
