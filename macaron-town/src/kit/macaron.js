import * as THREE from 'three';
import { add, group } from './place.js';
import { lathe, spline, weldNormals } from './geometry.js';
import { noise3 } from './noise.js';

// A French macaron modelled as its real parts: two domed shells, each standing on its ruffled
// 'pied' (foot), sandwiching a filling that bulges a little between them. Local frame: the axis is
// +y, the filling is centred on y = 0, radius R. Callers orient it (lying flat, or standing on edge).

export const MACARON_COLORS = {
  rose: { shell: '#F6B5C6', filling: '#FCE3EA' },
  pistachio: { shell: '#BFE2C6', filling: '#EAF6E4' },
  lavender: { shell: '#D7C6EE', filling: '#F3ECFB' },
  lemon: { shell: '#F8E6A2', filling: '#FFF6D6' },
  raspberry: { shell: '#EE93AB', filling: '#FBD9E2' },
  vanilla: { shell: '#F6EEDC', filling: '#FFFBF1' },
  caramel: { shell: '#E8C29C', filling: '#F6E3CC' },
};

// Smooth domed shell from its rim to the crown, sitting above y = 0 (underside flat at y = 0).
function shellGeometry(R, seed) {
  const H = 0.31 * R;
  const pts = spline(
    [
      [0, -0.004 * R],
      [0.88 * R, -0.004 * R],
      [0.965 * R, 0.012 * R],
      [0.985 * R, 0.06 * R],
      [0.95 * R, 0.15 * R],
      [0.83 * R, 0.235 * R],
      [0.6 * R, 0.29 * R],
      [0.3 * R, H * 0.995],
      [0, H],
    ],
    72
  );
  const g = lathe(pts, 96);
  // A barely uneven crown: hand-piped shells are never perfect domes.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const top = THREE.MathUtils.smoothstep(y / H, 0.3, 1);
    p.setY(i, y + 0.012 * R * top * noise3(x / R * 2.2, seed, z / R * 2.2, seed));
  }
  g.computeVertexNormals();
  weldNormals(g);
  return g;
}

// The ruffled foot: a short frilly collar under the shell rim (y from -h to 0).
function footGeometry(R, seed) {
  const h = 0.085 * R;
  const pts = spline(
    [
      [0, -h],
      [0.9 * R, -h],
      [0.955 * R, -h * 0.7],
      [0.975 * R, -h * 0.3],
      [0.97 * R, 0],
      [0, 0],
    ],
    24
  );
  const g = lathe(pts, 192);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.5 * R) continue;
    const a = Math.atan2(z, x);
    const ruffle = 0.028 * R * (0.55 + 0.45 * Math.sin(a * 46 + seed)) * (0.6 + 0.4 * noise3(Math.cos(a) * 6, y / R * 9, Math.sin(a) * 6, seed + 3));
    const s = (r + ruffle) / r;
    p.setXYZ(i, x * s, y + 0.012 * R * noise3(Math.cos(a) * 9, seed, Math.sin(a) * 9, seed + 5), z * s);
  }
  g.computeVertexNormals();
  weldNormals(g);
  return g;
}

// Filling: a soft disc that bulges slightly past the feet, its edge piped and uneven.
function fillingGeometry(R, seed) {
  const t = 0.075 * R;
  const pts = spline(
    [
      [0, -t],
      [0.8 * R, -t],
      [0.88 * R, -t * 0.75],
      [0.91 * R, 0],
      [0.88 * R, t * 0.75],
      [0.8 * R, t],
      [0, t],
    ],
    32
  );
  const g = lathe(pts, 128);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.6 * R) continue;
    const a = Math.atan2(z, x);
    const s = 1 + 0.025 * noise3(Math.cos(a) * 3, seed, Math.sin(a) * 3, seed + 7);
    p.setX(i, x * s);
    p.setZ(i, z * s);
  }
  g.computeVertexNormals();
  weldNormals(g);
  return g;
}

/**
 * One macaron (six independent parts). `flavour` is a key of MACARON_COLORS or { shell, filling }.
 */
export function macaron(ctx, parent, { radius = 0.05, flavour = 'rose', p, r, s, seed = 1, name = 'macaron' } = {}) {
  const m = ctx.materials;
  const colors = typeof flavour === 'string' ? MACARON_COLORS[flavour] : flavour;
  const g = group(parent, { p, r, s, name });
  const shell = m.macaronShell(colors.shell);
  // The foot is the rough, airy part of the shell: same colour, a little paler, textured.
  const foot = m.sugarShell(new THREE.Color(colors.shell).offsetHSL(0, -0.04, 0.03).getStyle());
  const filling = m.cream(colors.filling);
  const R = radius;
  const fill = 0.075 * R;
  const footH = 0.085 * R;
  add(g, fillingGeometry(R, seed), filling, { name: 'filling' });
  for (const side of [1, -1]) {
    const half = group(g, { p: [0, side * (fill + footH * 0.92), 0], s: [1, side, 1], name: side > 0 ? 'topShell' : 'bottomShell' });
    add(half, footGeometry(R, seed + side * 11), foot, { name: 'foot' });
    add(half, shellGeometry(R, seed + side * 5), shell, { name: 'shell' });
  }
  return g;
}
