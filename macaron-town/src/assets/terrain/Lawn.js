import * as THREE from 'three';
import { ISLAND, BUILDINGS, LANDMARKS, PLANTING, pondRadius, rotate } from '../../map/layout.js';
import { worldFootprint, pavingZones, overlap } from '../../map/audit.js';
import { add } from '../../kit/place.js';
import { lathe, roundedCylinderProfile, sphere } from '../../kit/geometry.js';
import { instanced } from '../../kit/instancing.js';
import { grassBladeGeometry, daisyGeometry, cloverGeometry, cloverHeadGeometry } from '../../kit/flora.js';
import { createRandom } from '../../kit/random.js';
import { fbm3 } from '../../kit/noise.js';

// T2 — Lawn: a soft-edged turf disc on the cream plateau, densely planted with individually placed
// grass blades that sway in the wind, with drifts of pink-tipped lawn daisies and low clover patches.
// Nothing grows on any paving zone or building footprint from the map.

const GREENS = ['#BFE0A6', '#B4DA9C', '#C8E6B2', '#AAD392', '#C3E3A2', '#B9DDA8'];
const GRASS_CELL = 1.5; // side of a ground cell of blades (see the grass below)
const CLOVER_GREENS = ['#93C583', '#8BBF7E', '#9DCB8C', '#86B97A'];

function blocked(x, z, zones, margin) {
  const probe = { shape: 'circle', x, z, r: margin };
  return zones.some((zone) => (zone.test ? zone.test(x, z, margin) : overlap(probe, zone, 0)));
}

// The duck pond keeps its own shoreline (plus its pebble bank), not its round footprint.
function pondZone(item) {
  return {
    test: (x, z, margin) => {
      const [lx, lz] = rotate(x - item.x, z - item.z, -item.ry);
      return Math.hypot(lx, lz) < pondRadius(Math.atan2(lz, lx)) + 0.07 + margin;
    },
  };
}

// `radius` and `zones` turn it into a free-standing patch (the asset viewer stands nature on one).
export default function build(ctx, { seed = 21, density = 1300, radius: groundRadius = ISLAND.groundRadius, zones: keepClear = null } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Lawn';

  // Turf base: slightly domed with a rolled edge where it meets the cream.
  const turfProfile = roundedCylinderProfile(groundRadius, 0.05, 0.03, 10);
  add(root, lathe(turfProfile, 360), m.lawn('#BFE0A6'), { p: [0, -0.05, 0], cast: false, name: 'turf' });

  const zones = keepClear ?? [
    ...pavingZones(),
    ...BUILDINGS.map(worldFootprint),
    ...LANDMARKS.filter((l) => !l.onPaving).map((l) => (l.id === 'pond' ? pondZone(l) : worldFootprint(l))),
    ...PLANTING.filter((p) => p.kind === 'bed').map(worldFootprint),
  ];

  const blades = [];
  const daisies = [];
  const discs = [];
  const clovers = [];
  const cloverHeads = [];
  const cloverStalks = [];
  const radius = groundRadius - 0.06;
  const attempts = Math.round(Math.PI * radius * radius * density);
  const tmpE = new THREE.Euler();
  for (let i = 0; i < attempts; i++) {
    const r = Math.sqrt(rng()) * radius;
    const a = rng() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (blocked(x, z, zones, 0.02)) continue;

    // Clumping: blades grow taller and denser in soft patches.
    const clump = 0.5 + 0.5 * Math.sin(x * 2.3 + Math.sin(z * 1.7)) * Math.sin(z * 2.9 + Math.cos(x * 1.3));
    const h = (0.032 + 0.03 * clump) * rng.range(0.75, 1.25);
    tmpE.set(rng.range(-0.25, 0.25), rng.range(0, Math.PI * 2), rng.range(-0.25, 0.25));
    blades.push({
      p: [x, -0.004, z],
      r: new THREE.Quaternion().setFromEuler(tmpE),
      s: [h * 0.9, h, h],
      color: new THREE.Color(rng.pick(GREENS)).offsetHSL(rng.range(-0.01, 0.01), rng.range(-0.04, 0.04), rng.range(-0.05, 0.04)),
    });

    // Daisies come in drifts, where the low-frequency field is high.
    const daisyField = THREE.MathUtils.smoothstep(fbm3(x * 0.55, 0.4, z * 0.55, 3, 5), 0.05, 0.45);
    if (daisyField > 0 && rng.chance(0.012 * daisyField)) {
      const s = rng.range(0.009, 0.013);
      const stem = h * rng.range(0.55, 0.85);
      const p = [x + rng.range(-0.01, 0.01), stem, z + rng.range(-0.01, 0.01)];
      const tilt = [rng.range(-0.3, 0.3), rng.range(0, Math.PI * 2), rng.range(-0.3, 0.3)];
      daisies.push({ p, r: tilt, s, color: new THREE.Color('#FFFFFF').offsetHSL(0, 0, rng.range(-0.03, 0)) });
      discs.push({ p: [p[0], p[1] + s * 0.05, p[2]], r: tilt, s: [s * 0.22, s * 0.12, s * 0.22], color: rng.pick(['#F7C844', '#F4BE3A', '#F9CF55']) });
    }

    // Clover hugs the ground under the blades in its own patches.
    const cloverField = fbm3(x * 0.9 + 11.3, 1.3, z * 0.9 - 4.1, 3, 9);
    if (cloverField > 0.3 && rng.chance(0.5 * THREE.MathUtils.smoothstep(cloverField, 0.3, 0.46))) {
      const leaflet = rng.range(0.0065, 0.0095);
      const stalk = leaflet * rng.range(1.1, 2.1);
      clovers.push({
        p: [x + rng.range(-0.008, 0.008), -0.004, z + rng.range(-0.008, 0.008)],
        r: [rng.range(-0.15, 0.15), rng.range(0, Math.PI * 2), rng.range(-0.15, 0.15)],
        s: [leaflet, leaflet, leaflet],
        stalk,
        color: new THREE.Color(rng.pick(CLOVER_GREENS)).offsetHSL(0, rng.range(-0.03, 0.03), rng.range(-0.03, 0.03)),
      });
      if (rng.chance(0.06)) {
        // Flower heads rise on their own stalks above the leaves.
        const head = rng.range(0.0034, 0.0046);
        const rise = stalk * rng.range(1.5, 2.1);
        const lean = [rng.range(-0.2, 0.2), rng.range(0, Math.PI * 2), rng.range(-0.2, 0.2)];
        const fx = x + rng.range(-0.004, 0.004);
        const fz = z + rng.range(-0.004, 0.004);
        cloverStalks.push({ p: [fx, -0.004, fz], r: lean, s: [head * 0.16, rise, head * 0.16], color: rng.pick(CLOVER_GREENS) });
        const top = new THREE.Vector3(0, rise, 0).applyEuler(new THREE.Euler(...lean));
        cloverHeads.push({ p: [fx + top.x, top.y - 0.004 + head * 0.55, fz + top.z], r: [0, rng.range(0, Math.PI * 2), 0], s: head, color: rng.chance(0.8) ? '#FFFFFF' : '#FBE3EA' });
      }
    }
  }

  // The blades are planted in ground cells, each drawn as a whole, so distant cells can use blades of
  // fewer segments (same height, width and bend: two, then one, where a blade is a pixel or so across).
  // A cell is never culled for being small: the blades are the lawn's texture at any distance.
  const grassMat = m.grass('#FFFFFF', { anchor: 0, range: 1, flutter: 0.4, space: 'local' });
  const blade = (segments) => grassBladeGeometry({ height: 1, width: 0.3, bend: 0.32, segments });
  const bladeLevels = [blade(5), blade(2), blade(1)];
  const cells = Map.groupBy(blades, (b) => `${Math.floor(b.p[0] / GRASS_CELL)},${Math.floor(b.p[2] / GRASS_CELL)}`);
  for (const cell of cells.values()) {
    const mesh = instanced(bladeLevels[0], grassMat, cell, { cast: false, name: 'grass' });
    mesh.userData.levels = bladeLevels.slice(1);
    mesh.userData.lodCull = false;
    root.add(mesh);
  }

  // Two clover models (short and long stalk), so the patches have layered heights.
  const shortClover = clovers.filter((c) => c.stalk / c.s[0] < 1.6);
  const tallClover = clovers.filter((c) => c.stalk / c.s[0] >= 1.6);
  root.add(instanced(cloverGeometry({ leaflet: 1, stalk: 1.35 }), m.clover(), shortClover, { cast: false, name: 'cloverLow' }));
  root.add(instanced(cloverGeometry({ leaflet: 1, stalk: 1.85, droop: 0.2 }), m.clover(), tallClover, { cast: false, name: 'cloverTall' }));
  root.add(instanced(new THREE.CylinderGeometry(0.7, 1, 1, 6, 4, true).translate(0, 0.5, 0), m.clover(), cloverStalks, { cast: false, name: 'cloverStalks' }));
  root.add(instanced(cloverHeadGeometry({ florets: 44, radius: 1 }), m.meadowFlower({ vertexColors: true }), cloverHeads, { cast: false, name: 'cloverHeads' }));

  root.add(instanced(daisyGeometry({ rays: 22, radius: 1 }), m.meadowFlower({ blush: '#F5A9C0' }), daisies, { cast: false, name: 'daisies' }));
  root.add(instanced(sphere(1, 16, 10), m.meadowFlower(), discs, { cast: false, name: 'daisyDiscs' }));

  root.userData.stats = { blades: blades.length, daisies: daisies.length, clovers: clovers.length };
  return root;
}
