import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { instanced } from '../../kit/instancing.js';
import { createRandom } from '../../kit/random.js';
import { sphere, taperTube, capsule, cylinder } from '../../kit/geometry.js';
import { puffGeometry } from '../../kit/clouds.js';
import { lilyPadGeometry, waterLilyGeometry, grassBladeGeometry } from '../../kit/flora.js';
import { pondRadius } from '../../map/layout.js';

// N7 — Duck pond: a soft kidney of still water in the park, its shoreline shared with the map so the
// lawn grows right up to its pebble bank. Rounded pebbles and a few mossy boulders edge it, lily pads
// float in drifts with pink and white water lilies open among them, cattails stand in two clumps of
// sword leaves, and a white duck leads three yellow ducklings round a slow loop: bodies bobbing,
// heads nodding and now and then dipping to feed, each swimmer trailing widening ripples.

const WATER_Y = 0.012;
const TAU = Math.PI * 2;
const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

// Shoreline point at angle a, pushed `offset` out along the radius.
const shore = (a, offset = 0) => {
  const r = pondRadius(a) + offset;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

// The water: a fan over the shoreline whose uv runs radially (0.5 at the centre, the rim at 0.5 out),
// as the water shader expects for its depth gradient and shoreline foam.
function waterGeometry(steps = 240) {
  const pos = [0, 0, 0];
  const uv = [0.5, 0.5];
  const index = [];
  const rings = 6;
  for (let k = 1; k <= rings; k++) {
    const f = k / rings;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU;
      const [x, z] = shore(a);
      pos.push(x * f, 0, z * f);
      uv.push(0.5 + Math.cos(a) * 0.5 * f, 0.5 + Math.sin(a) * 0.5 * f);
    }
  }
  for (let i = 0; i < steps; i++) index.push(0, 1 + ((i + 1) % steps), 1 + i);
  for (let k = 1; k < rings; k++) {
    const a0 = 1 + (k - 1) * steps;
    const b0 = 1 + k * steps;
    for (let i = 0; i < steps; i++) {
      const j = (i + 1) % steps;
      index.push(a0 + i, a0 + j, b0 + i, a0 + j, b0 + j, b0 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// The bank: a strip round the shore from under the water's edge up over a low lip and down to the turf.
function bankGeometry(steps = 240) {
  const profile = [[-0.05, WATER_Y - 0.008], [-0.012, WATER_Y + 0.002], [0.02, WATER_Y + 0.008], [0.05, WATER_Y + 0.004], [0.085, 0.001], [0.1, -0.004]];
  const pos = [];
  const index = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    for (const [off, y] of profile) {
      const [x, z] = shore(a, off);
      pos.push(x, y, z);
    }
  }
  const n = profile.length;
  for (let i = 0; i < steps; i++) {
    const j = (i + 1) % steps;
    for (let k = 0; k < n - 1; k++) index.push(i * n + k, j * n + k, i * n + k + 1, j * n + k, j * n + k + 1, i * n + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/* ---------- ducks ---------- */

// The body of a swimming duck from a sphere: full chest forward (+z), flat keel underneath, the rear
// sweeping up and narrowing into the tail.
function duckBodyGeometry(L, W, H) {
  const g = new THREE.SphereGeometry(1, 56, 36);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i);
    const vy = p.getY(i);
    const vz = p.getZ(i);
    const front = smooth(vz, -0.3, 0.9);
    const rear = Math.max(0, -vz);
    let x = vx * W * (0.84 + 0.22 * front) * (1 - 0.5 * rear ** 3);
    let y = vy * H * (vy < 0 ? 0.72 : 1) + H * 0.62 * rear ** 2.6;
    const z = vz * L;
    if (vy > 0) y *= 1 - 0.12 * front * vy; // the back flattens toward the neck
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

// A duck (or duckling) as its own group, facing +z, its waterline at y = 0. Returns the group and its
// head pivot (for nodding and dipping).
function buildDuck(m, { size = 1, kind = 'duck' }) {
  const g = new THREE.Group();
  g.name = kind;
  const duckling = kind === 'duckling';
  const plumage = m.plumage(duckling ? '#FFE27C' : '#FFFFFF');
  const bill = m.plastic(duckling ? '#F6B25A' : '#F7A24B');
  const eye = m.plastic('#2C2333');
  const shine = m.bulb('#FFFFFF', 1.2);
  const L = (duckling ? 0.03 : 0.07) * size;
  const W = (duckling ? 0.024 : 0.042) * size;
  const H = (duckling ? 0.022 : 0.034) * size;

  if (duckling) {
    add(g, sphere(1, 40, 28), plumage, { p: [0, H * 0.45, 0], s: [W, H, L], name: 'body' });
    add(g, sphere(1, 20, 14), plumage, { p: [0, H * 0.95, -L * 0.85], s: [W * 0.35, H * 0.4, L * 0.3], r: [-0.6, 0, 0], name: 'tailFluff' });
    for (const sx of [-1, 1]) add(g, sphere(1, 20, 14), plumage, { p: [sx * W * 0.9, H * 0.6, -L * 0.1], s: [W * 0.22, H * 0.42, L * 0.5], name: 'wingStub' });
  } else {
    add(g, duckBodyGeometry(L, W, H), plumage, { p: [0, H * 0.3, 0], name: 'body' });
    // Folded wings: long shells lying along the flanks, their tips lifted toward the tail.
    for (const sx of [-1, 1]) add(g, sphere(1, 36, 24), plumage, { p: [sx * W * 0.6, H * 0.66, -L * 0.3], s: [W * 0.34, H * 0.48, L * 0.6], r: [-0.2, sx * 0.06, 0], name: 'wing' });
    add(g, capsule(H * 0.16, H * 0.5, 8, 16), plumage, { p: [0, H * 1.25, -L * 1.0], r: [-1.0, 0, 0], name: 'tailCurl' });
  }

  // Neck and head on a pivot at the base of the neck.
  const head = group(g, { p: [0, H * (duckling ? 0.9 : 0.75), L * (duckling ? 0.55 : 0.66)], name: 'headPivot' });
  if (!duckling) {
    // A short, thick neck: a Pekin's head sits close on its chest.
    add(head, taperTube([[0, -H * 0.1, -L * 0.02], [0, H * 0.4, L * 0.06], [0, H * 0.78, L * 0.1]], [H * 0.5, H * 0.42], { tubular: 20, radial: 16 }), plumage, { name: 'neck' });
  }
  const hy = duckling ? H * 0.75 : H * 1.02;
  const hz = duckling ? L * 0.1 : L * 0.16;
  const hr = duckling ? H * 0.62 : H * 0.6;
  add(head, sphere(1, 40, 28), plumage, { p: [0, hy, hz], s: [hr * 0.9, hr * 0.92, hr * 1.08], name: 'head' });
  add(head, sphere(1, 28, 16), bill, { p: [0, hy - hr * 0.3, hz + hr * 1.02], s: [hr * 0.46, hr * 0.15, hr * 0.62], r: [0.16, 0, 0], name: 'bill' });
  for (const sx of [-1, 1]) {
    add(head, sphere(hr * 0.13, 14, 10), eye, { p: [sx * hr * 0.72, hy + hr * 0.18, hz + hr * 0.5], name: 'eye' });
    add(head, sphere(hr * 0.045, 8, 6), shine, { p: [sx * hr * 0.78, hy + hr * 0.25, hz + hr * 0.58], cast: false, name: 'eyeShine' });
  }
  return { group: g, head };
}

/* ---------- the pond ---------- */

export default function build(ctx, { seed = 71 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Pond';

  add(root, waterGeometry(), m.water('#8CCFDD', '#CDEFF3', { caustics: 5.5, foam: 0.09, strength: 0.35 }), { p: [0, WATER_Y, 0], cast: false, name: 'water' });
  add(root, bankGeometry(), m.stone('#CDBFAF'), { cast: false, name: 'bank' });

  // Pebbles along the bank, a few half in the water; boulders at intervals.
  const pebbles = [];
  const PEBBLES = ['#E7DED6', '#D9CEC6', '#EEE6E0', '#CFC6C9', '#E8D7D2', '#D4D3DA'];
  for (let i = 0; i < 560; i++) {
    const a = rng.range(0, TAU);
    const off = rng.range(-0.025, 0.075);
    const [x, z] = shore(a, off);
    const s = rng.range(0.008, 0.016);
    pebbles.push({ p: [x, WATER_Y + 0.004 - Math.max(0, -off) * 0.2, z], r: [rng.range(-0.3, 0.3), rng.range(0, TAU), rng.range(-0.3, 0.3)], s: [s * rng.range(1, 1.5), s * rng.range(0.45, 0.7), s], color: rng.pick(PEBBLES) });
  }
  root.add(instanced(sphere(1, 12, 8), m.stone('#FFFFFF'), pebbles, { name: 'pebbles' }));
  const rock = m.stone('#D7CFCC');
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rng.range(-0.3, 0.3);
    const [x, z] = shore(a, rng.range(0.01, 0.05));
    const r = rng.range(0.045, 0.085);
    add(root, puffGeometry({ radius: r, detail: 5, lumps: 0.22, frequency: 1.6, seed: rng.int(1, 999), flatten: 0.55, squash: 0.62 }), rock, { p: [x, WATER_Y - r * 0.15, z], r: [0, rng.range(0, TAU), 0], name: 'boulder' });
  }

  // Lily pads in three drifts near the shore, water lilies open on a few.
  const pads = [];
  const lilies = [];
  const hearts = [];
  const PADS = ['#8DC48A', '#7FB87D', '#9CCD92', '#86BE7E'];
  for (const [a0, n] of [[0.6, 12], [2.7, 9], [4.6, 11]]) {
    let placed = 0;
    for (let i = 0; i < n * 6 && placed < n; i++) {
      const a = a0 + rng.range(-0.35, 0.35);
      const [x, z] = shore(a, -rng.range(0.1, 0.32));
      const r = rng.range(0.032, 0.058);
      if (pads.some((p) => Math.hypot(p.p[0] - x, p.p[2] - z) < (p.s + r) * 0.9)) continue;
      pads.push({ p: [x, WATER_Y + 0.0015, z], r: [rng.range(-0.03, 0.03), rng.range(0, TAU), rng.range(-0.03, 0.03)], s: r, color: rng.pick(PADS) });
      placed++;
      if (rng.chance(0.28)) {
        lilies.push({ p: [x + rng.range(-0.01, 0.01), WATER_Y + 0.004, z + rng.range(-0.01, 0.01)], r: [0, rng.range(0, TAU), 0], s: r * 0.55, color: rng.pick(['#F9C3D3', '#FFF6F4', '#F7B0C6']) });
        hearts.push({ p: [lilies.at(-1).p[0], WATER_Y + 0.009, lilies.at(-1).p[2]], s: [r * 0.12, r * 0.07, r * 0.12], color: '#F6D35C' });
      }
    }
  }
  root.add(instanced(lilyPadGeometry({ radius: 1 }), m.leaf('#FFFFFF'), pads, { cast: false, name: 'lilyPads' }));
  root.add(instanced(waterLilyGeometry({ radius: 1 }), m.petal('#FFFFFF', '#FFFFFF'), lilies, { name: 'waterLilies' }));
  root.add(instanced(sphere(1, 12, 8), m.plastic('#FFFFFF'), hearts, { cast: false, name: 'lilyHearts' }));

  // Cattails: two clumps of sword leaves with brown spikes on stiff stems, swaying a little.
  const reedWind = { anchor: 0, range: 0.32, flutter: 0.5, space: 'object' };
  const blades = [];
  const stems = [];
  const spikes = [];
  for (const a0 of [1.7, 5.6]) {
    const [cx, cz] = shore(a0, -0.02);
    for (let i = 0; i < 18; i++) {
      const x = cx + rng.range(-0.06, 0.06);
      const z = cz + rng.range(-0.06, 0.06);
      const h = rng.range(0.2, 0.32);
      blades.push({ p: [x, WATER_Y - 0.004, z], r: [rng.range(-0.18, 0.18), rng.range(0, TAU), rng.range(-0.18, 0.18)], s: [h * 0.9, h, h], color: rng.pick(['#8FB97E', '#83AF76', '#9BC488']) });
    }
    for (let i = 0; i < 5; i++) {
      const x = cx + rng.range(-0.04, 0.04);
      const z = cz + rng.range(-0.04, 0.04);
      const h = rng.range(0.26, 0.34);
      const lean = [rng.range(-0.06, 0.06), 0, rng.range(-0.06, 0.06)];
      stems.push({ p: [x, WATER_Y, z], r: lean, s: [0.0026, h, 0.0026], color: '#93B27E' });
      const top = new THREE.Vector3(0, h * 0.86, 0).applyEuler(new THREE.Euler(...lean));
      spikes.push({ p: [x + top.x, WATER_Y + top.y, z + top.z], r: lean, s: [0.0085, 0.022, 0.0085], color: '#8C6A55' });
    }
  }
  root.add(instanced(grassBladeGeometry({ height: 1, width: 0.07, bend: 0.22, segments: 6 }), m.leaf('#FFFFFF', reedWind), blades, { cast: false, name: 'reeds' }));
  root.add(instanced(cylinder(1, 1, 1, 8, 4, true).translate(0, 0.5, 0), m.leaf('#FFFFFF', reedWind), stems, { name: 'cattailStems' }));
  root.add(instanced(capsule(1, 1.6, 8, 12), m.wood('#FFFFFF'), spikes, { name: 'cattails' }));

  // The duck family on its loop.
  const loop = new THREE.CatmullRomCurve3(
    Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * TAU + 0.3;
      const [x, z] = shore(a, -0.36 - 0.06 * Math.sin(a * 3));
      return new THREE.Vector3(x, WATER_Y, z);
    }),
    true,
    'centripetal'
  );
  const length = loop.getLength();
  const swimmers = [
    { ...buildDuck(m, { size: 1.15, kind: 'duck' }), lag: 0, bob: 0, wiggle: 0 },
    ...[0.16, 0.25, 0.34].map((lag, i) => ({ ...buildDuck(m, { size: 1, kind: 'duckling' }), lag, bob: 1.3 + i * 1.7, wiggle: 0.025 * (i % 2 ? 1 : -1) })),
  ];
  for (const s of swimmers) root.add(s.group);

  // Ripple rings: a small pool, each with its own fading material.
  const rings = [];
  const ringGeometry = new THREE.RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2);
  for (let i = 0; i < 14; i++) {
    const mat = m.ripple();
    const mesh = add(root, ringGeometry, mat, { cast: false, receive: false, name: 'ripple' });
    mesh.visible = false;
    rings.push({ mesh, mat, age: 99, life: 2.6, size: 0.1 });
  }
  let nextRing = 0;
  const spawn = (x, z, size) => {
    const r = rings[nextRing++ % rings.length];
    r.age = 0;
    r.size = size;
    r.mesh.position.set(x, WATER_Y + 0.0012, z);
    r.mesh.visible = true;
  };

  const speed = 0.055;
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  let travelled = rng.range(0, length);
  let rippleClock = 0;
  root.userData.update = (dt, time) => {
    travelled += speed * dt;
    rippleClock += dt;
    swimmers.forEach((s, i) => {
      const u = (((travelled - s.lag) / length) % 1 + 1) % 1;
      loop.getPointAt(u, p);
      loop.getTangentAt(u, t);
      side.set(t.z, 0, -t.x);
      p.addScaledVector(side, s.wiggle * Math.sin(time * 1.3 + i));
      s.group.position.set(p.x, WATER_Y + 0.0015 * Math.sin(time * 2.1 + s.bob), p.z);
      s.group.rotation.set(0.04 * Math.sin(time * 1.7 + s.bob), Math.atan2(t.x, t.z) + 0.08 * Math.sin(time * 1.3 + i), 0.05 * Math.sin(time * 1.9 + s.bob * 0.7));
      // Heads nod with each paddle; now and then the duck dips to feed.
      const feed = i === 0 ? smooth(Math.sin(time * 0.33), 0.92, 0.99) : 0;
      s.head.rotation.x = 0.08 * Math.sin(time * 3.4 + s.bob) + feed * 1.1;
    });
    if (rippleClock > 0.85) {
      rippleClock = 0;
      const lead = swimmers[0].group.position;
      spawn(lead.x, lead.z, 0.16);
      const k = swimmers[1 + Math.floor(rng() * 3)].group.position;
      spawn(k.x, k.z, 0.08);
    }
    for (const r of rings) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const f = r.age / r.life;
      if (f >= 1) {
        r.mesh.visible = false;
        continue;
      }
      r.mesh.scale.setScalar(0.02 + r.size * (1 - (1 - f) ** 2));
      r.mat.userData.fade((1 - f) ** 1.5);
    }
  };

  root.userData.footprint = { r: 1.25 };
  root.userData.clearGround = true;
  root.userData.stats = { pebbles: pebbles.length, pads: pads.length, lilies: lilies.length };
  return root;
}
