import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { cylinder, torus, sphere, lathe, spline, roundedBox } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { macaron } from '../../kit/macaron.js';
import { Pendulum } from '../../physics/Pendulum.js';

// L3 — Ferris wheel on its own islet. Two white lattice A-frames carry the axle; the wheel has twin
// pink rims laced with little arches, white spokes strung with bulbs, and a macaron at each hub.
// Twelve teacup gondolas under striped canopies hang between the rims. The wheel turns with a
// boarding stop every cycle, and every gondola is a damped pendulum driven by its pivot's real
// acceleration (centripetal and tangential) and by the wind, so they sway as it slows and starts.
// Frame: the wheel turns in the xy plane, its axle along z; riders board at the bottom from +z.

const TAU = Math.PI * 2;
const AXLE_Y = 1.95; // the lowest tub clears the boarding deck
const R = 1.45; // gondola pivot circle = rim radius
const RIM_Z = 0.22;
const LEG_Z = 0.4;
const FOOT_X = 0.8;
const BASE_Y = 0.07;
const N = 12;
const W0 = 0.13; // cruising speed, rad/s
const CYCLE = 42; // s: cruise, slow to a stop for boarding, start again
const HANG = 0.27; // pivot to gondola centre of mass

const TUBS = ['#F6B9C9', '#A9DCC8', '#D8CCF3', '#FFE19A', '#F9C9B6', '#BFDDF2'];

const _up = new THREE.Vector3(0, 1, 0);
// Instance item for a unit cylinder (height 1 along y) stretched between a and b.
function rod(a, b, radius) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(_up, d.clone().divideScalar(len));
  const mid = a.clone().addScaledVector(d, 0.5);
  return { p: [mid.x, mid.y, mid.z], r: q, s: [radius, len, radius] };
}

function speedAt(t) {
  const u = ((t % CYCLE) + CYCLE) % CYCLE;
  const ease = (x) => x * x * (3 - 2 * x);
  if (u < 32) return W0;
  if (u < 35) return W0 * (1 - ease((u - 32) / 3));
  if (u < 39) return 0;
  return W0 * ease((u - 39) / 3);
}

// One gondola, hung from its pivot at the origin: stem and axle clip, a striped canopy on four
// slender posts, and a painted teacup tub with a gilt lip, belly band and two facing benches.
function gondola(ctx, parent, { color, seed, name = 'gondola' }) {
  const m = ctx.materials;
  const g = group(parent, { name });
  const paint = m.paintedWood(color);
  const white = m.paintedWood('#FFF7EE');
  const gold = m.metal('gold');
  const iron = m.trim('#FFFBF6');
  add(g, torus(0.016, 0.006, 8, 24), gold, { name: 'axleClip' });
  add(g, cylinder(0.008, 0.008, 0.05, 12, 1), iron, { p: [0, -0.035, 0], name: 'stem' });
  // Canopy: eight gores, alternating white and the tub colour, over a gilt rim bead.
  const canopy = spline([[0.165, -0.1], [0.15, -0.085], [0.11, -0.068], [0.05, -0.058], [0, -0.056]], 24);
  for (let k = 0; k < 8; k++) add(g, lathe(canopy, 10, (k / 8) * TAU, TAU / 8), k % 2 ? white : paint, { name: 'canopyGore' });
  add(g, torus(0.163, 0.006, 8, 64), gold, { p: [0, -0.1, 0], r: [Math.PI / 2, 0, 0], name: 'canopyBead' });
  add(g, sphere(0.012, 16, 12), gold, { p: [0, -0.052, 0], name: 'canopyKnob' });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    add(g, cylinder(0.005, 0.005, 0.105, 10, 1), iron, { p: [Math.cos(a) * 0.118, -0.152, Math.sin(a) * 0.118], name: 'post' });
  }
  // Teacup tub, open on top: outer wall up to a rolled lip, inner wall down to the floor.
  const tub = [
    ...spline([[0, -0.345], [0.09, -0.345], [0.125, -0.33], [0.138, -0.29], [0.136, -0.235], [0.134, -0.212], [0.142, -0.205]], 40),
    new THREE.Vector2(0.128, -0.205),
    new THREE.Vector2(0.126, -0.32),
    new THREE.Vector2(0, -0.32),
  ];
  add(g, lathe(tub, 64), paint, { name: 'tub' });
  add(g, torus(0.138, 0.007, 10, 64), gold, { p: [0, -0.204, 0], r: [Math.PI / 2, 0, 0], name: 'lip' });
  add(g, torus(0.139, 0.006, 10, 64), white, { p: [0, -0.27, 0], r: [Math.PI / 2, 0, 0], name: 'bellyBand' });
  for (const sz of [-1, 1]) add(g, roundedBox(0.19, 0.028, 0.055, 0.008, 2), white, { p: [0, -0.285, sz * 0.068], name: 'bench' });
  return g;
}

export default function build(ctx, { seed = 303 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'FerrisWheel';

  const stone = m.stone('#F3EAE0');
  const granite = m.granite('#E6DCD4');
  const white = m.trim('#FFFBF6');
  const pink = m.paintedWood('#F6B9C9');
  const cream = m.paintedWood('#FFF7EE');
  const gold = m.metal('gold');
  const iron = m.metal('iron');
  const bulb = m.bulb('#FFE9B8', 2.4);
  const unitRod = cylinder(1, 1, 1, 8, 1);

  /* ---------- platform ---------- */
  const nose = (r, y0, h) => spline([[0, y0], [r - 0.01, y0], [r, y0 + h * 0.3], [r - 0.003, y0 + h * 0.8], [r - 0.012, y0 + h], [0, y0 + h]], 40);
  add(root, lathe(nose(1.3, 0, BASE_Y), 192), stone, { name: 'platform' });
  // Boarding deck under the bottom of the wheel, with steps down toward +z.
  add(root, roundedBox(0.62, 0.05, 0.56, 0.01, 2), cream, { p: [0, BASE_Y + 0.025, 0], name: 'boardingDeck' });
  for (let k = 0; k < 2; k++) {
    const h = 0.017 * (2 - k);
    add(root, roundedBox(0.4, h, 0.065, 0.005, 2), granite, { p: [0, BASE_Y + h / 2, 0.28 + 0.0325 + 0.065 * k], name: 'step' });
  }
  // Brass rails clear of the gondolas' sweep: one behind the loading point, two flanking the steps.
  const railTop = BASE_Y + 0.05 + 0.16;
  for (let k = 0; k < 3; k++) add(root, cylinder(0.008, 0.008, 0.16, 10, 1), gold, { p: [-0.26 + k * 0.26, railTop - 0.08, -0.25], name: 'railPost' });
  add(root, cylinder(0.006, 0.006, 0.54, 10, 1), gold, { p: [0, railTop, -0.25], r: [0, 0, Math.PI / 2], name: 'rail' });
  for (const sx of [-1, 1]) {
    for (const z of [0.18, 0.27]) add(root, cylinder(0.008, 0.008, 0.16, 10, 1), gold, { p: [sx * 0.22, railTop - 0.08, z], name: 'railPost' });
    add(root, cylinder(0.006, 0.006, 0.1, 10, 1), gold, { p: [sx * 0.22, railTop, 0.225], r: [Math.PI / 2, 0, 0], name: 'rail' });
  }

  /* ---------- A-frames: white lattice legs, tie bars, bearings ---------- */
  const webItems = [];
  for (const sz of [-1, 1]) {
    const z = sz * LEG_Z;
    const top = new THREE.Vector3(0, AXLE_Y, z);
    for (const sx of [-1, 1]) {
      const foot = new THREE.Vector3(sx * FOOT_X, BASE_Y, z);
      const d = new THREE.Vector3().subVectors(top, foot);
      const len = d.length();
      d.normalize();
      const n = new THREE.Vector3(-d.y, d.x, 0);
      const width = (t) => 0.14 - 0.08 * t;
      const at = (t, side) => foot.clone().addScaledVector(d, t * len).addScaledVector(n, (side * width(t)) / 2);
      for (const side of [-1, 1]) {
        const a = at(0, side);
        const b = at(0.97, side);
        add(root, cylinder(0.016, 0.016, a.distanceTo(b), 12, 1), white, { p: [(a.x + b.x) / 2, (a.y + b.y) / 2, z], r: [0, 0, Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2], name: 'chord' });
      }
      const NODES = 18;
      for (let i = 0; i < NODES; i++) webItems.push(rod(at((i / NODES) * 0.97, i % 2 ? 1 : -1), at(((i + 1) / NODES) * 0.97, i % 2 ? -1 : 1), 0.0065));
      add(root, roundedBox(0.2, 0.06, 0.14, 0.01, 2), granite, { p: [foot.x, BASE_Y + 0.03, z], name: 'footing' });
    }
    // Tie bar across the frame with a gilt ring at its middle.
    const tieY = 0.82;
    const tieX = FOOT_X * (1 - (tieY - BASE_Y) / (AXLE_Y - BASE_Y));
    add(root, cylinder(0.012, 0.012, tieX * 2, 12, 1), white, { p: [0, tieY, z], r: [0, 0, Math.PI / 2], name: 'tieBar' });
    add(root, torus(0.06, 0.008, 10, 48), gold, { p: [0, tieY + 0.065, z], name: 'tieRing' });
    add(root, sphere(0.022, 16, 12), pink, { p: [0, tieY + 0.065, z], name: 'tieBoss' });
    // Bearing housing at the apex, capped in gold.
    add(root, cylinder(0.07, 0.07, 0.09, 32, 1), iron, { p: [0, AXLE_Y, z], r: [Math.PI / 2, 0, 0], name: 'bearing' });
    add(root, sphere(0.05, 24, 12, 0, TAU, 0, Math.PI / 2), gold, { p: [0, AXLE_Y, z + sz * 0.045], r: [sz * Math.PI / 2, 0, 0], name: 'bearingCap' });
  }
  root.add(instanced(unitRod, white, webItems, { name: 'latticeWeb' }));
  for (const sx of [-1, 1]) add(root, cylinder(0.014, 0.014, LEG_Z * 2, 12, 1), white, { p: [sx * FOOT_X, BASE_Y + 0.07, 0], r: [Math.PI / 2, 0, 0], name: 'groundBeam' });
  add(root, cylinder(0.034, 0.034, LEG_Z * 2 + 0.1, 32, 1), iron, { p: [0, AXLE_Y, 0], r: [Math.PI / 2, 0, 0], name: 'axle' });

  /* ---------- the wheel ---------- */
  const wheel = group(root, { p: [0, AXLE_Y, 0], name: 'wheel' });
  add(wheel, cylinder(0.09, 0.09, RIM_Z * 2, 48, 1), pink, { r: [Math.PI / 2, 0, 0], name: 'hubDrum' });
  const SPOKES = 24;
  const spokeItems = [];
  const archItems = [];
  const lamps = [];
  for (const sz of [-1, 1]) {
    const z = sz * RIM_Z;
    add(wheel, torus(R, 0.022, 12, 360), pink, { p: [0, 0, z], name: 'rim' });
    add(wheel, torus(R - 0.1, 0.01, 8, 360), cream, { p: [0, 0, z], name: 'innerRim' });
    add(wheel, torus(R * 0.55, 0.013, 10, 240), pink, { p: [0, 0, z], name: 'midRing' });
    add(wheel, lathe(spline([[0, -0.03], [0.15, -0.03], [0.165, -0.015], [0.15, 0.008], [0.1, 0.022], [0, 0.026]], 24), 64), gold, { p: [0, 0, z], r: [sz * Math.PI / 2, 0, 0], name: 'hubFlange' });
    for (let k = 0; k < SPOKES; k++) {
      const a = (k / SPOKES) * TAU;
      const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      spokeItems.push(rod(dir.clone().multiplyScalar(0.12).setZ(z), dir.clone().multiplyScalar(R - 0.012).setZ(z), 0.007));
      // A little arch between each pair of spokes, just inside the rim.
      const mid = a + Math.PI / SPOKES;
      const chord = 2 * (R - 0.1) * Math.sin(Math.PI / SPOKES);
      const c = new THREE.Vector3(Math.cos(mid), Math.sin(mid), 0).multiplyScalar(R - 0.1);
      archItems.push({ p: [c.x, c.y, z], r: [0, 0, mid + Math.PI / 2], s: chord / 2 });
      if (k % 2 === 0) for (let j = 1; j <= 5; j++) lamps.push({ p: [dir.x * (0.12 + (j / 6) * (R - 0.25)), dir.y * (0.12 + (j / 6) * (R - 0.25)), z + sz * 0.012], s: 0.011 });
    }
    for (let k = 0; k < 96; k++) {
      const a = (k / 96) * TAU;
      lamps.push({ p: [Math.cos(a) * R, Math.sin(a) * R, z + sz * 0.026], s: 0.012 });
    }
    macaron(ctx, wheel, { radius: 0.1, flavour: sz > 0 ? 'rose' : 'pistachio', p: [0, 0, z + sz * 0.075], r: [Math.PI / 2, 0, 0], seed: seed + (sz > 0 ? 1 : 2), name: 'hubMacaron' });
  }
  // The loaded wheel: spokes stop on the rim. Keep that mesh at every distance — a coarser
  // stand-in of the unit rod reads as pipes sticking past the rim on the still poster.
  const spokes = instanced(unitRod, cream, spokeItems, { name: 'spokes' });
  spokes.userData.levels = [];
  wheel.add(spokes);
  // Arch: a half ring bulging toward the hub, unit radius, scaled to span its bay.
  const arches = instanced(torus(1, 0.012, 6, 24, Math.PI), cream, archItems, { name: 'rimArches' });
  arches.userData.levels = [];
  wheel.add(arches);
  wheel.add(instanced(sphere(1, 10, 8), bulb, lamps, { cast: false, name: 'wheelBulbs' }));
  // Pivot axles and tie bars spanning the two rims.
  for (let k = 0; k < N * 2; k++) {
    const a = (k / (N * 2)) * TAU;
    add(wheel, cylinder(k % 2 ? 0.009 : 0.013, k % 2 ? 0.009 : 0.013, RIM_Z * 2, 12, 1), k % 2 ? cream : gold, { p: [Math.cos(a) * R, Math.sin(a) * R, 0], r: [Math.PI / 2, 0, 0], name: k % 2 ? 'tieRod' : 'pivotAxle' });
  }

  /* ---------- gondolas on pendulum physics ---------- */
  const cars = [];
  const swings = [];
  for (let k = 0; k < N; k++) {
    cars.push(gondola(ctx, root, { color: TUBS[k % TUBS.length], seed: seed + k }));
    swings.push(new Pendulum({ length: HANG, damping: 0.22, theta: rng.range(-0.02, 0.02) }));
  }
  const state = { t: rng.range(0, CYCLE), angle: rng.range(0, TAU), omega: 0 };
  state.omega = speedAt(state.t);
  const planeX = new THREE.Vector3(1, 0, 0);
  const hubWorld = new THREE.Vector3();
  const force = { x: 0, y: 0, z: 0 };
  ctx.physics.add({
    step(dt, world) {
      state.t += dt;
      const omega = speedAt(state.t);
      const alpha = (omega - state.omega) / dt;
      state.omega = omega;
      state.angle += omega * dt;
      world.wind.sample(hubWorld.x, hubWorld.y, hubWorld.z, world.time, force);
      const windAlong = force.x * planeX.x + force.z * planeX.z;
      for (let k = 0; k < N; k++) {
        const phi = state.angle + (k / N) * TAU;
        const c = Math.cos(phi);
        const s = Math.sin(phi);
        const p = swings[k];
        // Pivot acceleration in the wheel plane: tangential (alpha R) plus centripetal (omega^2 R inward).
        p.pivotAccel.x = -alpha * R * s - omega * omega * R * c;
        p.pivotAccel.y = alpha * R * c - omega * omega * R * s;
        p.external = (windAlong * 0.1 * (0.8 + 0.4 * Math.sin(k * 1.7 + world.time * 0.6))) / p.length;
        p.step(dt);
      }
    },
  });

  root.userData.update = () => {
    root.updateWorldMatrix(true, false);
    planeX.setFromMatrixColumn(root.matrixWorld, 0).normalize();
    hubWorld.set(0, AXLE_Y, 0).applyMatrix4(root.matrixWorld);
    wheel.rotation.z = state.angle;
    for (let k = 0; k < N; k++) {
      const phi = state.angle + (k / N) * TAU;
      cars[k].position.set(Math.cos(phi) * R, AXLE_Y + Math.sin(phi) * R, 0);
      cars[k].rotation.z = swings[k].theta;
    }
  };
  root.userData.update();
  root.userData.footprint = { r: 1.3 };
  return root;
}
