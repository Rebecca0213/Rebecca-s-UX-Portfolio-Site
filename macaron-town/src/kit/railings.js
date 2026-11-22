import * as THREE from 'three';
import { add, group } from './place.js';
import { roundedBox, lathe, spline, tube, sphere } from './geometry.js';
import { instanced } from './instancing.js';
import { moldingLoop } from './sweep.js';
import { plinth, cornice } from './profiles.js';

// Turned baluster profile (height 1, scaled per use).
export function balusterGeometry(radius = 0.004) {
  const r = radius;
  return lathe(
    spline(
      [
        [0, 0],
        [r * 1.4, 0],
        [r * 1.4, 0.04],
        [r * 0.8, 0.08],
        [r * 1.25, 0.32],
        [r * 0.7, 0.55],
        [r * 1.1, 0.62],
        [r * 0.7, 0.7],
        [r * 0.8, 0.94],
        [r * 1.3, 0.96],
        [r * 1.3, 1.0],
        [0, 1.0],
      ],
      64
    ),
    16
  );
}

/**
 * Turned limestone baluster (classic double-vase), standing on y = 0, `height` tall, widest
 * belly radius `radius`. Square plinth and abacus are separate blocks added by the caller.
 */
export function stoneBalusterGeometry({ height = 0.13, radius = 0.013, radial = 32 } = {}) {
  const r = radius;
  const h = height;
  const profile = spline(
    [
      [0, 0],
      [r * 0.92, 0],
      [r * 0.92, h * 0.035],
      [r * 1.02, h * 0.06], // base torus
      [r * 0.86, h * 0.1],
      [r * 0.62, h * 0.13], // scotia
      [r * 0.7, h * 0.16],
      [r * 0.98, h * 0.3], // belly
      [r * 0.92, h * 0.42],
      [r * 0.52, h * 0.6], // neck
      [r * 0.44, h * 0.68],
      [r * 0.6, h * 0.73], // collar ring
      [r * 0.6, h * 0.76],
      [r * 0.42, h * 0.79],
      [r * 0.5, h * 0.88],
      [r * 0.8, h * 0.94], // capital flare
      [r * 0.82, h * 0.97],
      [r * 0.82, h],
      [0, h],
    ],
    96
  );
  return lathe(profile, radial);
}

/**
 * Square stone pier for a balustrade: moulded base, shaft, corniced cap and a ball finial on a
 * turned neck. Stands on y = 0 with its faces aligned to local x/z. Returns the pier group.
 */
export function stonePier(parent, { width = 0.064, height = 0.18, stone, name = 'pier' }) {
  const g = group(parent, { name });
  const baseH = width * 0.42;
  const capH = width * 0.5;
  add(g, moldingLoop(plinth(baseH), width, width), stone, { name: 'pierBase' });
  add(g, roundedBox(width, height - baseH - capH, width, width * 0.04, 3), stone, { p: [0, baseH + (height - baseH - capH) / 2, 0], name: 'pierShaft' });
  add(g, moldingLoop(cornice(capH * 0.92), width, width), stone, { p: [0, height - capH, 0], name: 'pierCap' });
  const slabW = width + capH * 0.92 * 1.9;
  add(g, roundedBox(slabW, width * 0.12, slabW, width * 0.03, 3), stone, { p: [0, height - capH + capH * 0.92 * 0.74 + width * 0.06, 0], name: 'pierCapSlab' });
  const top = height - capH + capH * 0.92 * 0.74 + width * 0.12;
  const neck = lathe(
    spline([[0, 0], [width * 0.32, 0], [width * 0.32, width * 0.06], [width * 0.18, width * 0.16], [width * 0.14, width * 0.26], [width * 0.22, width * 0.32], [0, width * 0.34]], 48),
    40
  );
  add(g, neck, stone, { p: [0, top, 0], name: 'finialNeck' });
  add(g, sphere(width * 0.36, 48, 32), stone, { p: [0, top + width * 0.3 + width * 0.33, 0], name: 'finialBall' });
  return g;
}

/**
 * Wrought-iron railing between two points on the ground plane: top rail with knob newels,
 * bottom rail, turned balusters and a band of C-scrolls under the top rail.
 */
export function railing(ctx, parent, { from, to, height = 0.11, spacing = 0.022, metal, scrolls = true, newels = true }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const g = group(parent, { name: 'railing' });
  g.position.copy(a);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
  add(g, roundedBox(len, 0.008, 0.01, 0.003, 2), metal, { p: [len / 2, height, 0] });
  add(g, roundedBox(len, 0.005, 0.006, 0.002, 2), metal, { p: [len / 2, 0.012, 0] });
  const posts = [];
  const count = Math.max(2, Math.round(len / spacing));
  for (let i = 0; i <= count; i++) posts.push({ p: [(len * i) / count, 0.009, 0], s: [1, height - 0.012, 1] });
  g.add(instanced(balusterGeometry(), metal, posts, { name: 'balusters' }));
  if (newels) {
    for (const end of [0, len]) {
      add(g, roundedBox(0.014, height + 0.01, 0.014, 0.003, 2), metal, { p: [end, (height + 0.01) / 2, 0] });
      add(g, sphere(0.01, 20, 14), metal, { p: [end, height + 0.016, 0] });
    }
  }
  if (scrolls) {
    const bay = len / count;
    for (let i = 0; i < count; i++) {
      const cx = bay * (i + 0.5);
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        const ang = Math.PI * 1.3 * t;
        pts.push([cx + Math.cos(ang) * bay * 0.32, height - 0.024 + Math.sin(ang) * 0.012 - t * 0.006, 0]);
      }
      add(g, tube(pts, 0.0014, { tubular: 24, radial: 5 }), metal, { cast: false });
    }
  }
  return g;
}
