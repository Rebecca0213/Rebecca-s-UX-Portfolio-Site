import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, cylinder, torus, sphere, lathe, spline, tube, extrude } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { scallopBand, roundRect } from '../../kit/shapes.js';
import { joinGeometry } from '../../kit/flora.js';
import { puffGeometry } from '../../kit/clouds.js';
import { chain } from '../../kit/hardware.js';

// B12 — Sweet-treats kiosk: a confectioner's cart on two big spoked wheels. Mint panelled body with
// pink mouldings and a fold-down shelf hung on brass chains; candy-striped posts carry a pink-and-
// cream striped barrel canopy with a scalloped valance and a giant swirl lollipop on top. On the
// counter: clear glass jars packed with bonbons, a stand of swirl lollipops, cotton candy on paper
// cones in two racks, and a tray of wrapped sweets.

const BW = 1.1;
const BD = 0.66;
const BODY_Y = 0.24;
const BODY_H = 0.46;
const WHEEL_R = 0.27;
const POST_H = 0.62;
const TOP_Y = BODY_Y + BODY_H + 0.03;

function wheel(ctx, parent, { p, side }) {
  const m = ctx.materials;
  const g = group(parent, { p, r: [0, (side * Math.PI) / 2, 0], name: 'wheel' });
  const iron = m.metal('iron');
  const wood = m.paintedWood('#F6B9C9');
  add(g, torus(WHEEL_R, 0.016, 12, 96), iron, { name: 'tyre' });
  add(g, torus(WHEEL_R - 0.024, 0.014, 10, 96), wood, { name: 'felloe' });
  add(g, lathe(spline([[0, -0.05], [0.04, -0.05], [0.05, -0.02], [0.05, 0.02], [0.04, 0.05], [0, 0.05]], 24), 32), wood, { r: [Math.PI / 2, 0, 0], name: 'hub' });
  add(g, cylinder(0.022, 0.022, 0.12, 20, 1), m.metal('brass'), { r: [Math.PI / 2, 0, 0], name: 'hubCap' });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    add(g, lathe(spline([[0, 0], [0.009, 0], [0.011, 0.06], [0.008, WHEEL_R - 0.08], [0.01, WHEEL_R - 0.05], [0, WHEEL_R - 0.05]], 24), 10), wood, { p: [Math.sin(a) * 0.04, Math.cos(a) * 0.04, 0], r: [0, 0, -a], name: 'spoke' });
  }
  return g;
}

// Swirl lollipop, built like the real thing: two ropes of coloured sugar coiled side by side over a
// thin candy core, finished with a rolled rim and a centre nub, on a stick that ends inside the rim.
// The coil arms just touch (no gaps, no interpenetration); each arm's inner end is buried in the
// nub and its outer end dives into the rim, so no open tube end ever shows. Disc in the local xy plane.
function lollipop(ctx, parent, { p, r, radius = 0.06, colors = ['#F6B9C9', '#FFFFFF'], stick = 0.18, name = 'lollipop' }) {
  const m = ctx.materials;
  const R = radius;
  const g = group(parent, { p, r, name });
  const cy = stick + R;
  const stickLen = stick + 0.22 * R; // its top sits inside the rim's tube
  add(g, cylinder(0.09 * R, 0.09 * R, stickLen, 16, 1), m.ceramic('#FFFDF8'), { p: [0, stickLen / 2, 0], name: 'stick' });

  const candy = group(g, { p: [0, cy, 0], name: 'candy' });
  const rimR = 0.86 * R;
  const rimTube = 0.14 * R;
  const arm = 0.075 * R; // coil rope radius
  const b = (2 * arm * 0.95) / Math.PI; // archimedean growth per radian: the two arms just touch
  const r0 = 0.03 * R;
  const r1 = rimR - rimTube - 0.9 * arm;
  const a1 = (r1 - r0) / b;
  const dive = 1.0; // radians over which the arm's end curves out into the rim
  colors.forEach((c, ci) => {
    const pts = [];
    const n = 220;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (a1 + dive);
      let rr = r0 + b * a;
      if (a > a1) {
        const u = (a - a1) / dive;
        rr += (rimR - (r1 + b * dive)) * u * u;
      }
      const ang = a + ci * Math.PI;
      pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr, 0]);
    }
    add(candy, tube(pts, arm, { tubular: 440, radial: 10 }), m.candy(c), { name: 'coil' });
  });
  const core = spline([[0, -0.055 * R], [0.45 * R, -0.052 * R], [0.7 * R, -0.044 * R], [0.8 * R, 0], [0.7 * R, 0.044 * R], [0.45 * R, 0.052 * R], [0, 0.055 * R]], 48);
  add(candy, lathe(core, 64), m.candy(colors[1]), { r: [Math.PI / 2, 0, 0], name: 'core' });
  add(candy, torus(rimR, rimTube, 14, 96), m.candy(colors[0]), { name: 'rim' });
  add(candy, sphere(0.12 * R, 24, 16), m.candy(colors[0]), { s: [1, 1, 0.75], name: 'nub' });
  return g;
}

// Radius of a lathe profile (outer surface) at height y.
function profileRadius(profile, y) {
  let best = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const c = profile[i + 1];
    if (a.y !== c.y && (y - a.y) * (y - c.y) <= 0) best = Math.max(best, a.x + ((c.x - a.x) * (y - a.y)) / (c.y - a.y));
  }
  return best;
}

// Printed spiral band lying on a paper cone whose radius is r0 + k * y: a flat strip just proud of
// the paper, so it reads as print rather than a wire wound round it.
function coneBand({ r0, k, y0, y1, turns, width, lift = 0.0005, samples = 200 }) {
  const slant = Math.hypot(1, k);
  const pos = [];
  const uv = [];
  const index = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const y = y0 + (y1 - y0) * t;
    const a = t * turns * Math.PI * 2;
    for (const side of [-1, 1]) {
      const yy = y + (side * width) / (2 * slant);
      const rr = r0 + k * yy + lift;
      pos.push(Math.cos(a) * rr, yy, Math.sin(a) * rr);
      uv.push(side < 0 ? 0 : 1, t);
    }
  }
  for (let i = 0; i < samples; i++) {
    const q = i * 2;
    index.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// One wrapped sweet (unit scale, long axis x): a glossy oval in foil, pinched at both ends into
// crimped, pleated fans with closed ends.
function wrappedSweetGeometry() {
  const fan = (dir) => {
    const rows = 10;
    const cols = 64;
    const pos = [];
    const index = [];
    const at = (u, a) => {
      const radius = (0.15 + 0.5 * Math.pow(u, 0.85)) * (1 + 0.24 * u * Math.cos(9 * a));
      return [dir * (1.02 + 0.9 * u), Math.cos(a) * radius, Math.sin(a) * radius];
    };
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) pos.push(...at(i / rows, (j / cols) * Math.PI * 2));
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j;
        const c = a + cols + 1;
        if (dir > 0) index.push(a, a + 1, c, a + 1, c + 1, c);
        else index.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
    // Crimped end face: a fan from the axis to the pleated rim.
    const centre = pos.length / 3;
    pos.push(dir * 1.92, 0, 0);
    const rim = rows * (cols + 1);
    for (let j = 0; j < cols; j++) {
      if (dir > 0) index.push(centre, rim + j, rim + j + 1);
      else index.push(centre, rim + j + 1, rim + j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  };
  return joinGeometry([new THREE.SphereGeometry(1, 24, 16).scale(1.25, 1, 1), fan(1), fan(-1)]);
}

// Cotton candy: one airy main puff with smaller puffs blooming out of its top and sides. Each puff
// is smooth-lobed (no crumpled creases), so the floss reads soft under the ink pass.
function floss(ctx, parent, { p, color, seed, rng, name = 'floss' }) {
  const m = ctx.materials;
  const g = group(parent, { p, name });
  const mat = m.cloud(color);
  const R = 0.046;
  add(g, puffGeometry({ radius: R, detail: 9, lumps: 0.13, frequency: 1.4, seed, flatten: 0.05 }), mat, { s: [1, 0.9, 1], name: 'puff' });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const up = rng.range(0.15, 0.75);
    const dir = new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - up * up), up, Math.sin(a) * Math.sqrt(1 - up * up));
    const r = rng.range(0.02, 0.026);
    const at = dir.multiplyScalar(R * 0.72);
    add(g, puffGeometry({ radius: r, detail: 7, lumps: 0.12, frequency: 1.5, seed: seed + k + 1, flatten: 0 }), mat, { p: [at.x, at.y * 0.9, at.z], name: 'tuft' });
  }
  return g;
}

export default function build(ctx, { seed = 1212 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'SweetTreatsKiosk';

  const mint = m.paintedWood('#A9DCC8');
  const pink = m.paintedWood('#F6B9C9');
  const cream = m.paintedWood('#FFF7EE');
  const iron = m.metal('iron');
  const brass = m.metal('brass');
  const glass = m.clearGlass('#E6F5F4');

  /* ---------- chassis, wheels, handle, leg ---------- */
  for (const sx of [-1, 1]) add(root, roundedBox(0.03, 0.03, BD + 0.1, 0.006, 2), iron, { p: [sx * 0.4, BODY_Y - 0.02, 0], name: 'rail' });
  add(root, cylinder(0.016, 0.016, BW + 0.32, 16, 1), iron, { p: [0, WHEEL_R, -0.08], r: [0, 0, Math.PI / 2], name: 'axle' });
  for (const sx of [-1, 1]) wheel(ctx, root, { p: [sx * (BW / 2 + 0.11), WHEEL_R, -0.08], side: sx });
  for (const sx of [-1, 1]) add(root, tube([[sx * 0.35, BODY_Y + 0.1, -BD / 2], [sx * 0.36, BODY_Y + 0.2, -BD / 2 - 0.18], [sx * 0.34, BODY_Y + 0.32, -BD / 2 - 0.3]], 0.012, { tubular: 32, radial: 8 }), iron, { name: 'handleArm' });
  add(root, cylinder(0.018, 0.018, 0.74, 20, 1), m.wood('#B98C64'), { p: [0, BODY_Y + 0.32, -BD / 2 - 0.3], r: [0, 0, Math.PI / 2], name: 'handleBar' });
  add(root, tube([[0, BODY_Y - 0.03, BD / 2 - 0.06], [0, 0.12, BD / 2 - 0.02], [0, 0.004, BD / 2]], 0.012, { tubular: 24, radial: 8 }), iron, { name: 'standLeg' });
  add(root, sphere(0.02, 16, 12), iron, { p: [0, 0.012, BD / 2], s: [1.4, 0.6, 1.4], name: 'foot' });

  /* ---------- panelled body ---------- */
  const body = group(root, { p: [0, BODY_Y, 0], name: 'body' });
  add(body, roundedBox(BW, BODY_H, BD, 0.012, 3), mint, { p: [0, BODY_H / 2, 0], name: 'box' });
  add(body, roundedBox(BW + 0.04, 0.03, BD + 0.04, 0.008, 3), pink, { p: [0, 0.015, 0], name: 'skirt' });
  add(body, roundedBox(BW + 0.06, 0.03, BD + 0.06, 0.008, 3), pink, { p: [0, BODY_H + 0.015, 0], name: 'counterTop' });
  for (const [face, len, ry] of [['front', BW, 0], ['back', BW, Math.PI], ['left', BD, -Math.PI / 2], ['right', BD, Math.PI / 2]]) {
    const n = face === 'front' || face === 'back' ? 3 : 2;
    const half = (face === 'left' || face === 'right' ? BW : BD) / 2;
    const frame = group(body, { r: [0, ry, 0], name: `${face}Panels` });
    for (let i = 0; i < n; i++) {
      const pw = len / n - 0.06;
      const px = -len / 2 + (len / n) * (i + 0.5);
      add(frame, roundedBox(pw, BODY_H - 0.12, 0.012, 0.006, 3), cream, { p: [px, BODY_H / 2, half + 0.002], name: 'field' });
      add(frame, torus(0.045, 0.006, 8, 48), pink, { p: [px, BODY_H / 2, half + 0.01], name: 'roundel' });
    }
  }
  // Fold-down front shelf, hung from the front posts on brass chains.
  const shelfY = BODY_H - 0.06;
  add(body, roundedBox(BW - 0.1, 0.02, 0.16, 0.005, 2), pink, { p: [0, shelfY, BD / 2 + 0.09], name: 'shelf' });
  for (const sx of [-1, 1]) add(body, cylinder(0.008, 0.008, 0.04, 12, 1), brass, { p: [sx * (BW / 2 - 0.12), shelfY - 0.004, BD / 2 + 0.008], r: [0, 0, Math.PI / 2], name: 'hinge' });

  /* ---------- candy-striped posts and striped barrel canopy ---------- */
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const post = group(root, { p: [sx * (BW / 2 - 0.03), TOP_Y, sz * (BD / 2 - 0.03)], name: 'post' });
    add(post, cylinder(0.016, 0.016, POST_H, 16, 1), cream, { p: [0, POST_H / 2, 0], name: 'core' });
    const pts = [];
    for (let i = 0; i <= 90; i++) {
      const t = i / 90;
      const a = t * Math.PI * 2 * 6;
      pts.push([Math.cos(a) * 0.016, t * POST_H, Math.sin(a) * 0.016]);
    }
    add(post, tube(pts, 0.008, { tubular: 270, radial: 8 }), m.plastic('#F28CA6'), { name: 'stripe' });
    if (sz > 0) {
      // Eye for the shelf chain, and the chain itself down to the shelf's outer corner.
      const eyeY = 0.12;
      add(post, torus(0.008, 0.0022, 8, 20), brass, { p: [0, eyeY, 0.026], name: 'chainEye' });
      const from = [sx * (BW / 2 - 0.03), TOP_Y + eyeY - 0.01, BD / 2 - 0.03 + 0.026];
      const to = [sx * (BW / 2 - 0.065), BODY_Y + shelfY + 0.012, BD / 2 + 0.162];
      chain(root, { from, to, link: 0.011, material: brass, name: 'shelfChain' });
      add(root, torus(0.007, 0.002, 8, 20), brass, { p: to, r: [Math.PI / 2, 0, 0], name: 'shelfEye' });
    }
  }
  const canopy = group(root, { p: [0, TOP_Y + POST_H, 0], name: 'canopy' });
  const CR = BD / 2 + 0.1;
  const CL = BW + 0.16;
  const stripes = 14;
  for (let i = 0; i < stripes; i++) {
    const a0 = -Math.PI / 2 + (Math.PI * i) / stripes;
    const geo = new THREE.CylinderGeometry(CR, CR, CL, 8, 1, true, a0 + Math.PI / 2, Math.PI / stripes);
    // Local x becomes the barrel's height after the turn onto the x axis: flatten it there.
    add(canopy, geo, m.fabric(i % 2 ? '#FFF7EE' : '#F6B9C9'), { r: [0, 0, Math.PI / 2], s: [0.62, 1, 1], name: 'stripe' });
  }
  const endCap = new THREE.CircleGeometry(CR, 48, 0, Math.PI);
  for (const sx of [-1, 1]) add(canopy, endCap, m.fabric('#F6B9C9'), { p: [sx * (CL / 2), 0, 0], r: [0, (sx * Math.PI) / 2, 0], s: [1, 0.62, 1], name: 'endCap' });
  const sc = extrude(scallopBand(0.08, 0.06, 1, 0.03), 0.004, { bevel: 0.001, bevelSegments: 1, curveSegments: 16 });
  for (const sz of [1, -1]) {
    for (let i = 0; i < Math.round(CL / 0.08); i++) {
      add(canopy, sc, m.fabric(i % 2 ? '#F6B9C9' : '#FFF7EE'), { p: [-CL / 2 + 0.04 + i * 0.08, -0.058, sz * (CR + 0.003)], r: [0, sz > 0 ? 0 : Math.PI, 0], cast: false, name: 'valance' });
    }
  }
  add(canopy, tube([[-CL / 2, 0.002, 0], [CL / 2, 0.002, 0]], 0.01, { tubular: 4, radial: 8 }), brass, { p: [0, CR * 0.62 + 0.004, 0], name: 'ridgeRod' });
  lollipop(ctx, canopy, { p: [0, CR * 0.62 - 0.006, 0], radius: 0.11, colors: ['#F28CA6', '#FFFFFF'], stick: 0.16, name: 'giantLollipop' });

  /* ---------- the sweets ---------- */
  const counter = group(root, { p: [0, TOP_Y, 0], name: 'sweets' });

  // Clear glass jars of bonbons, close-packed in layers that follow each jar's own profile (no
  // sweet ever pokes through the glass). The outer two are lidded apothecary jars with headroom;
  // the inner two are wide-mouthed canisters filled to the brim and heaped into a dome.
  const apothecary = spline([[0, 0], [0.045, 0], [0.05, 0.01], [0.05, 0.11], [0.042, 0.122], [0.03, 0.126], [0.03, 0.135], [0.027, 0.136]], 96);
  const canister = spline([[0, 0], [0.04, 0], [0.045, 0.008], [0.046, 0.06], [0.046, 0.104], [0.049, 0.109], [0.0505, 0.113], [0.048, 0.1145]], 96);
  const palettes = [['#F7A8BE', '#FFFFFF', '#F28CA6'], ['#A9DCC8', '#FFFFFF', '#7FC4B0'], ['#FFE19A', '#FFFFFF', '#F7C65A'], ['#C9B6F0', '#FFFFFF', '#A98FDF']];
  const BON = 0.0105; // bonbon radius
  const PITCH = 2 * BON + 0.001;
  const GLASS = 0.0025;
  // Furthest a bonbon centre may sit from the jar axis at height y: inside the glass below the
  // mouth, and under a dome (height `dome`, footed on the mouth) above it.
  const reach = (profile, mouth, dome, y) => {
    let best = Infinity;
    for (let k = -4; k <= 4; k++) {
      const dy = (k / 4) * BON;
      if (y + dy > mouth) continue;
      best = Math.min(best, profileRadius(profile, y + dy) - GLASS - Math.sqrt(BON * BON - dy * dy));
    }
    if (y > mouth - BON) {
      const u = (y - (mouth - BON)) / dome;
      const domeLimit = u >= 1 ? -1 : (profileRadius(profile, mouth - 0.002) - GLASS - BON) * Math.sqrt(1 - u * u);
      best = Math.min(best, domeLimit);
    }
    return best;
  };
  const bonbons = [];
  // Each layer is packed in rings: an outer ring touching the glass with as many sweets as fit its
  // circumference, then smaller rings inward, and one in the middle when only that fits. Every
  // layer settles at its own angle on the one below.
  const fill = (cx, cz, { profile, mouth, top, dome }, palette) => {
    for (let y = GLASS + BON; y <= top; y += PITCH * 0.93) {
      let r = reach(profile, mouth, dome, y);
      if (r < 0) break;
      const phase = rng.range(0, Math.PI * 2);
      for (; r > -1e-6; r -= PITCH) {
        if (r < PITCH * 0.5) {
          bonbons.push({ p: [cx, y, cz], s: BON, color: rng.pick(palette) });
          break;
        }
        const n = Math.floor(Math.PI / Math.asin(Math.min(1, PITCH / (2 * r))));
        for (let k = 0; k < n; k++) {
          const a = phase + (k / n) * Math.PI * 2 + r * 40;
          bonbons.push({ p: [cx + Math.cos(a) * r, y + rng.range(-0.0006, 0.0006), cz + Math.sin(a) * r], s: BON, color: rng.pick(palette) });
        }
      }
    }
  };
  const jarXs = [-0.38, -0.22, 0.22, 0.38];
  jarXs.forEach((x, i) => {
    const z = -0.12;
    const lidded = i === 0 || i === 3;
    if (lidded) {
      add(counter, lathe(apothecary, 64), glass, { p: [x, 0, z], cast: false, name: 'jar' });
      fill(x, z, { profile: apothecary, mouth: 0.136, top: 0.1, dome: 0 }, palettes[i]);
      const lid = group(counter, { p: [x, 0.134, z], name: 'jarLid' });
      add(lid, lathe(spline([[0, 0.022], [0.016, 0.019], [0.03, 0.009], [0.034, 0.003], [0.034, 0], [0.026, -0.006], [0, -0.006]], 32), 48), glass, { cast: false, name: 'lidGlass' });
      add(lid, sphere(0.009, 20, 14), m.ceramic('#FFFFFF'), { p: [0, 0.028, 0], name: 'knob' });
    } else {
      add(counter, lathe(canister, 64), glass, { p: [x, 0, z], cast: false, name: 'jar' });
      fill(x, z, { profile: canister, mouth: 0.11, top: 0.2, dome: 0.026 }, palettes[i]);
    }
  });
  counter.add(instanced(sphere(1, 20, 14), m.candy(), bonbons, { name: 'bonbons' }));

  // Lollipop stand: a pink drum stuck with swirl pops, each leaning out toward the way it faces,
  // and a taller one standing straight in the middle.
  const stand = group(counter, { p: [0, 0, -0.14], name: 'popStand' });
  add(stand, cylinder(0.06, 0.07, 0.08, 48, 1), pink, { p: [0, 0.04, 0], name: 'drum' });
  add(stand, torus(0.06, 0.005, 8, 64), cream, { p: [0, 0.08, 0], r: [Math.PI / 2, 0, 0], name: 'drumBead' });
  const pops = [['#F28CA6', '#FFFFFF'], ['#7FC4B0', '#FFFFFF'], ['#F7C65A', '#FFFFFF'], ['#A98FDF', '#FFFFFF'], ['#F28CA6', '#FFE19A']];
  pops.forEach((c, i) => {
    const a = (i / pops.length) * Math.PI * 2 + 0.3;
    lollipop(ctx, stand, { p: [Math.sin(a) * 0.035, 0.07, Math.cos(a) * 0.035], r: [0.26, a, 0, 'YXZ'], radius: 0.035, colors: c, stick: 0.1, name: 'pop' });
  });
  lollipop(ctx, stand, { p: [0, 0.07, 0], r: [0, 0.3, 0], radius: 0.04, colors: ['#A98FDF', '#FFF7EE'], stick: 0.15, name: 'pop' });

  // Cotton candy: paper cones (a pink spiral printed on each) standing in two racks, crowned with floss.
  const flossColors = ['#F9C7D7', '#D8CCF3', '#F9C7D7', '#D8CCF3'];
  const CONE_R0 = 0.004;
  const CONE_K = 0.022 / 0.13;
  let cone = 0;
  for (const rx of [-0.34, 0.34]) {
    const rack = group(counter, { p: [rx, 0, 0.17], name: 'coneRack' });
    add(rack, roundedBox(0.22, 0.045, 0.07, 0.008, 3), pink, { p: [0, 0.0225, 0], name: 'block' });
    for (const cx of [-0.06, 0.06]) {
      const c = group(rack, { p: [cx, 0.012, 0], name: 'cottonCandy' });
      add(c, lathe([[0, 0], [CONE_R0, 0], [CONE_R0 + CONE_K * 0.13, 0.13], [0, 0.13]], 48), m.paintedWood('#FFFDF8'), { name: 'paperCone' });
      add(c, coneBand({ r0: CONE_R0, k: CONE_K, y0: 0.036, y1: 0.122, turns: 2.25, width: 0.009 }), m.paintedWood('#F28CA6'), { name: 'printedBand' });
      add(c, torus(0.0108, 0.0024, 8, 24), pink, { p: [0, 0.033, 0], r: [Math.PI / 2, 0, 0], name: 'collar' });
      floss(ctx, c, { p: [0, 0.165, 0], color: flossColors[cone % 4], seed: seed + cone * 7, rng });
      cone++;
    }
  }

  // Chrome tray with a raised lip, holding wrapped sweets in rows (one model per sweet).
  const trayShape = roundRect(0.3, 0.14, 0.016, 0, -0.07);
  trayShape.holes.push(roundRect(0.284, 0.124, 0.01, 0, -0.062));
  const tray = group(counter, { p: [0, 0, 0.17], name: 'tray' });
  add(tray, roundedBox(0.286, 0.006, 0.126, 0.002, 2), m.metal('chrome'), { p: [0, 0.003, 0], name: 'trayBed' });
  add(tray, extrude(trayShape, 0.014, { bevel: 0.0015, bevelSegments: 2, curveSegments: 12, center: false }), m.metal('chrome'), { p: [0, 0.0015, 0], r: [-Math.PI / 2, 0, 0], name: 'trayLip' });
  const wrapped = wrappedSweetGeometry();
  const sweets = [];
  for (let k = 0; k < 15; k++) {
    const row = Math.floor(k / 5);
    sweets.push({ p: [(k % 5 - 2) * 0.054 + (row === 1 ? 0.012 : 0) - 0.004, 0.006 + 0.011, -0.04 + row * 0.04], r: [rng.range(-0.15, 0.15), rng.range(-0.35, 0.35), 0], s: 0.011, color: rng.pick(['#F28CA6', '#7FC4B0', '#F7C65A', '#A98FDF', '#FFFFFF']) });
  }
  tray.add(instanced(wrapped, m.candy(), sweets, { name: 'wrappedSweets' }));

  root.userData.footprint = { w: 1.5, d: 1.3 };
  return root;
}
