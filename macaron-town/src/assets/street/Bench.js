import * as THREE from 'three';
import { add, group } from '../../kit/place.js';
import { roundedBox, sphere, tube } from '../../kit/geometry.js';
import { createRandom } from '../../kit/random.js';

// S2 — Park bench: three cast-iron frames painted white (two scrolled ends with armrests and a
// plain middle support) carrying pink-painted timber: five seat slats and four backrest slats
// following the reclined back. Gilt rosettes cap the scrolls. Faces +z; length along x.

const LEN = 0.6;
const SEAT_Y = 0.165;

// Side frame in its own yz plane (z forward): front leg rising into a scrolled armrest, back leg
// rising into the reclined back, seat rail between, and curled feet.
function frame(ctx, parent, { x, arms, material, gold }) {
  const g = group(parent, { p: [x, 0, 0], name: arms ? 'endFrame' : 'midFrame' });
  const P = (y, z) => [0, y, z];
  add(g, tube([P(0.006, 0.115), P(0.08, 0.108), P(SEAT_Y, 0.098)], 0.011, { tubular: 24, radial: 10 }), material, { name: 'frontLeg' });
  add(g, tube([P(0.006, -0.12), P(0.09, -0.1), P(SEAT_Y, -0.085), P(0.3, -0.13), P(0.43, -0.17)], 0.011, { tubular: 48, radial: 10 }), material, { name: 'backLeg' });
  add(g, tube([P(SEAT_Y - 0.012, 0.11), P(SEAT_Y - 0.006, 0), P(SEAT_Y - 0.012, -0.095)], 0.009, { tubular: 24, radial: 8 }), material, { name: 'seatRail' });
  if (arms) {
    const curl = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const a = t * Math.PI * 1.5;
      curl.push(P(0.255 + Math.sin(a) * 0.028 * (1 - t * 0.4), 0.09 + Math.cos(a) * 0.028 * (1 - t * 0.4)));
    }
    add(g, tube([P(SEAT_Y, 0.098), P(0.22, 0.1), ...curl], 0.009, { tubular: 64, radial: 8 }), material, { name: 'armrest' });
    add(g, tube([P(0.28, -0.12), P(0.27, -0.04), P(0.262, 0.04), P(0.26, 0.09)], 0.008, { tubular: 24, radial: 8 }), material, { name: 'armRail' });
    add(g, sphere(0.011, 16, 12), gold, { p: [0, 0.255, 0.09], name: 'rosette' });
  }
  for (const z of [0.115, -0.12]) {
    const foot = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const a = t * Math.PI * 1.2;
      foot.push(P(0.012 + Math.sin(a) * 0.012, z + Math.sign(z) * (0.004 + (1 - Math.cos(a)) * 0.01)));
    }
    add(g, tube(foot, 0.006, { tubular: 24, radial: 6 }), material, { name: 'footCurl' });
  }
  return g;
}

export default function build(ctx, { seed = 722 } = {}) {
  const m = ctx.materials;
  const rng = createRandom(seed);
  const root = new THREE.Group();
  root.name = 'Bench';

  const iron = m.trim('#FFFBF6');
  const gold = m.metal('gold');
  const slatPaint = m.paintedWood('#F6B9C9');

  for (const [x, arms] of [[-LEN / 2 + 0.02, true], [0, false], [LEN / 2 - 0.02, true]]) frame(ctx, root, { x, arms, material: iron, gold });

  // Seat slats across the rails, each with its own slight bow and tone.
  for (let k = 0; k < 5; k++) {
    const z = 0.088 - k * 0.042;
    add(root, roundedBox(LEN + 0.04, 0.013, 0.034, 0.004, 2), slatPaint, { p: [0, SEAT_Y + 0.006, z], r: [0, rng.range(-0.004, 0.004), 0], name: 'seatSlat' });
  }
  // Back slats laid along the reclined back legs.
  const backTilt = Math.atan2(0.13 - 0.085, 0.3 - SEAT_Y);
  for (let k = 0; k < 4; k++) {
    const t = 0.22 + k * 0.058;
    const z = -0.085 - (t - SEAT_Y) * Math.tan(backTilt) + 0.018;
    add(root, roundedBox(LEN + 0.03, 0.04, 0.012, 0.004, 2), slatPaint, { p: [0, t, z], r: [-backTilt, 0, 0], name: 'backSlat' });
  }

  root.userData.footprint = { r: 0.45 };
  return root;
}
