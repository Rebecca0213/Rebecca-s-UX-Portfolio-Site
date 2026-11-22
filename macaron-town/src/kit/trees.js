import * as THREE from 'three';
import { add } from './place.js';
import { taperTube, sphere } from './geometry.js';
import { puffGeometry, puffPoint } from './clouds.js';

// Tree-building kit: a branching skeleton grown from a seed, tapered limbs with knuckled forks and
// a flared, rooted base, and a crown of sculpted lobes whose surfaces carry blossoms or leaves.
// Crown geometry is baked at the plant's origin, so materials can sway it with wind space 'object'.

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);

// `dir` turned away from itself by `angle`, toward azimuth `az` measured around it.
export function deflect(dir, angle, az) {
  const ref = Math.abs(dir.y) < 0.95 ? UP : X;
  const u = new THREE.Vector3().crossVectors(dir, ref).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();
  const side = u.multiplyScalar(Math.cos(az)).addScaledVector(v, Math.sin(az));
  return dir.clone().multiplyScalar(Math.cos(angle)).addScaledVector(side, Math.sin(angle)).normalize();
}

/**
 * Grows a branching skeleton. The trunk (length `trunk`) forks into forks[0] limbs of `length`; each
 * branch at depth d forks into forks[d] children, lengths shrinking by `lengthDecay`. Every branch
 * bends gently as it grows (`bend`), lifts toward the light (`upward`) and tapers (`taper`).
 * Returns { branches: [{ points, r0, r1, depth }], tips: [{ p, dir, depth }] }.
 */
// `minRise` keeps every limb from drooping below that slope (y of its unit direction).
export function growTree(rng, { trunk = 0.45, trunkRadius = 0.05, lean = 0.1, forks = [3, 3, 2], spread = 0.75, length = 0.42, lengthDecay = 0.72, taper = 0.66, upward = 0.25, bend = 0.12, steps = 4, minRise = -1 } = {}) {
  const branches = [];
  const tips = [];
  const rise = (d) => {
    if (d.y >= minRise) return d;
    const flat = Math.hypot(d.x, d.z) || 1;
    const k = Math.sqrt(1 - minRise * minRise) / flat;
    return d.set(d.x * k, minRise, d.z * k).normalize();
  };
  const grow = (start, dir, len, r0, depth) => {
    const points = [start.clone()];
    let d = rise(dir.clone());
    let p = start.clone();
    for (let i = 1; i <= steps; i++) {
      d = rise(deflect(d, rng.range(0, bend), rng.range(0, Math.PI * 2)).addScaledVector(UP, upward * 0.12).normalize());
      p = p.clone().addScaledVector(d, len / steps);
      points.push(p);
    }
    const r1 = r0 * taper;
    branches.push({ points, r0, r1, depth });
    if (depth >= forks.length) {
      tips.push({ p, dir: d.clone(), depth });
      return;
    }
    const n = forks[depth];
    const az0 = rng.range(0, Math.PI * 2);
    for (let k = 0; k < n; k++) {
      const az = az0 + (k / n) * Math.PI * 2 + rng.range(-0.45, 0.45);
      const child = deflect(d, spread * rng.range(0.7, 1.1), az).addScaledVector(UP, upward).normalize();
      const childLen = (depth === 0 ? length : len * lengthDecay) * rng.range(0.85, 1.12);
      grow(p, child, childLen, r1 * rng.range(0.8, 0.92), depth + 1);
    }
  };
  grow(new THREE.Vector3(0, 0, 0), deflect(UP.clone(), lean, rng.range(0, Math.PI * 2)), trunk, trunkRadius, 0);
  return { branches, tips };
}

/**
 * Grows an excurrent skeleton (ginkgo, conifers, young limes): a central leader rising `height`
 * with a gentle wander, carrying side branches from `clear` of its height upward, set round it by
 * the golden angle. Side branches leave at `angle` from the vertical, run longer low down and
 * shorter near the top (`profile(t)` scales their length by height t in [0, 1]), curve up toward
 * their tips and fork once into `forks` at their ends. Same output as growTree.
 */
export function growLeader(rng, { height = 1, radius = 0.05, clear = 0.3, laterals = 9, length = 0.4, angle = 1.0, curl = 0.35, forks = 2, forkLength = 0.45, profile = (t) => 1 - 0.55 * t, steps = 5 } = {}) {
  const branches = [];
  const tips = [];
  const leader = [new THREE.Vector3(0, 0, 0)];
  let d = deflect(UP.clone(), rng.range(0, 0.05), rng.range(0, Math.PI * 2));
  for (let i = 1; i <= 8; i++) {
    d = deflect(d, rng.range(0, 0.06), rng.range(0, Math.PI * 2)).addScaledVector(UP, 0.05).normalize();
    leader.push(leader[i - 1].clone().addScaledVector(d, height / 8));
  }
  const curve = new THREE.CatmullRomCurve3(leader);
  const r1 = radius * 0.28;
  branches.push({ points: leader, r0: radius, r1, depth: 0 });
  tips.push({ p: leader[leader.length - 1].clone(), dir: d.clone(), depth: 2 });
  const golden = Math.PI * (3 - Math.sqrt(5));
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < laterals; k++) {
    const t = clear + (1 - clear) * ((k + rng.range(0.2, 0.8)) / laterals) * 0.92;
    const start = curve.getPointAt(t);
    const rHere = radius + (r1 - radius) * t;
    const az = az0 + k * golden + rng.range(-0.3, 0.3);
    const out = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    let dir = UP.clone().multiplyScalar(Math.cos(angle)).addScaledVector(out, Math.sin(angle)).normalize();
    const len = length * profile(t) * rng.range(0.85, 1.12);
    const points = [start.clone()];
    let p = start.clone();
    for (let i = 1; i <= steps; i++) {
      dir = deflect(dir, rng.range(0, 0.12), rng.range(0, Math.PI * 2)).addScaledVector(UP, curl / steps).normalize();
      p = p.clone().addScaledVector(dir, len / steps);
      points.push(p);
    }
    const r0 = rHere * rng.range(0.5, 0.62);
    branches.push({ points, r0, r1: r0 * 0.55, depth: 1 });
    for (let f = 0; f < forks; f++) {
      const fd = deflect(dir, rng.range(0.35, 0.6), rng.range(0, Math.PI * 2)).addScaledVector(UP, 0.15).normalize();
      const fl = len * forkLength * rng.range(0.8, 1.15);
      const fp = [p.clone(), p.clone().addScaledVector(fd, fl * 0.5), p.clone().addScaledVector(fd, fl)];
      branches.push({ points: fp, r0: r0 * 0.5, r1: r0 * 0.3, depth: 2 });
      tips.push({ p: fp[2].clone(), dir: fd.clone(), depth: 2 });
    }
  }
  return { branches, tips };
}

/**
 * Bark meshes for a skeleton: a tapered tube per branch, a knuckle sphere closing every fork, a
 * flared trunk base and a few surface roots reaching out over the ground.
 */
// The trunk's own tube flares out at its foot (`flare` times wider at the ground over the lowest
// `flareHeight` of it), so the buttress follows a leaning trunk without a seam.
export function buildBranches(parent, { branches }, { material, rng, roots = 4, flare = 0.85, flareHeight = 0.28 }) {
  const tips = branches.reduce((n, b) => Math.max(n, b.depth), 0);
  for (const b of branches) {
    const radial = Math.max(6, 16 - b.depth * 3);
    let points = b.points;
    let radii;
    if (b.depth === 0) radii = (t) => b.r0 + (b.r1 - b.r0) * t + b.r0 * flare * Math.max(0, 1 - t / flareHeight) ** 2.4;
    else {
      // A limb grows out of its parent: it starts inside the parent's wood and swells into a collar.
      const back = b.points[1].clone().sub(b.points[0]).normalize().multiplyScalar(-b.r0 * 0.6);
      points = [b.points[0].clone().add(back), ...b.points];
      radii = (t) => b.r0 + (b.r1 - b.r0) * t + b.r0 * 0.12 * Math.max(0, 1 - t / 0.1) ** 2;
    }
    add(parent, taperTube(points, radii, { tubular: (b.depth === 0 ? 30 : 12) + points.length * 6, radial: b.depth === 0 ? 24 : radial }), material, { name: b.depth === 0 ? 'trunk' : 'branch' });
    if (b.depth === tips) continue; // the end of a terminal limb is buried in its clump of crown
    const end = b.points[b.points.length - 1];
    add(parent, sphere(b.r1 * 1.06, Math.max(8, radial), Math.max(6, radial - 4)), material, { p: [end.x, end.y, end.z], name: 'knuckle' });
  }
  const trunk = branches[0];
  const r = trunk.r0;
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < roots; k++) {
    const a = az0 + (k / roots) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const len = r * rng.range(3, 4.5);
    const pts = [[Math.sin(a) * r * 0.6, r * 1.2, Math.cos(a) * r * 0.6], [Math.sin(a) * r * 1.6, r * 0.35, Math.cos(a) * r * 1.6], [Math.sin(a) * len, -r * 0.1, Math.cos(a) * len]];
    add(parent, taperTube(pts, [r * 0.5, r * 0.08], { tubular: 20, radial: 8 }), material, { name: 'root' });
  }
}

/**
 * Crown lobes: one at every tip, pushed a little along its branch, plus filling lobes along the
 * outer branches so the crown has no holes. Returns [{ center, radius, seed }].
 */
// `gather` pulls every lobe toward the crown's centre so neighbours merge into one cloud; `sculpt`
// sets the lobes' lumpiness (stored on each lobe, so items can find its exact surface).
export function crownLobes(rng, { branches, tips }, { size = 0.2, fillDepth = 2, fill = 0.75, lift = 0.25, gather = 0, sculpt = {} }) {
  const lobes = [];
  const shape = { lumps: 0.17, frequency: 1.6, flatten: 0.3, ...sculpt };
  for (const t of tips) {
    const c = t.p.clone().addScaledVector(t.dir, size * 0.3).addScaledVector(UP, size * lift);
    lobes.push({ center: c, radius: size * rng.range(0.85, 1.15), seed: rng.int(1, 9999), sculpt: shape });
  }
  for (const b of branches) {
    if (b.depth < fillDepth || rng() > fill) continue;
    const mid = b.points[Math.floor(b.points.length / 2)];
    lobes.push({ center: mid.clone().addScaledVector(UP, size * 0.2), radius: size * rng.range(0.7, 0.92), seed: rng.int(1, 9999), sculpt: shape });
  }
  if (gather > 0) {
    const centre = new THREE.Vector3();
    for (const lobe of lobes) centre.add(lobe.center);
    centre.divideScalar(lobes.length);
    for (const lobe of lobes) lobe.center.lerp(centre, gather);
  }
  return lobes;
}

// A lobe's sculpted geometry, baked at its place in the crown.
export function lobeGeometry(lobe, { detail = 7 } = {}) {
  return puffGeometry({ radius: lobe.radius, detail, seed: lobe.seed, ...lobe.sculpt }).translate(lobe.center.x, lobe.center.y, lobe.center.z);
}

/**
 * Instances scattered over the crown surface (blossoms, leaves): `perLobe` per lobe on its upper
 * and outer face (directions below `minUp` are mostly skipped), each facing out of the surface
 * (+y of the organ along the normal) with its own spin, size and colour.
 */
export function crownItems(rng, lobes, { perLobe = 40, minUp = -0.35, scale = [0.02, 0.03], colors, sink = 0.94, crownCenter = new THREE.Vector3() }) {
  const items = [];
  const n = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  for (const lobe of lobes) {
    const outward = lobe.center.clone().sub(crownCenter).setY(0).normalize();
    for (let i = 0; i < perLobe; i++) {
      n.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
      if (n.lengthSq() > 1 || n.lengthSq() < 1e-4) {
        i--;
        continue;
      }
      n.normalize();
      // Favour the sunny top and the outside of the crown; the inside is hidden anyway.
      if (n.y < minUp && n.dot(outward) < 0.2 && rng() < 0.85) continue;
      // Seated on the lobe's actual sculpted surface (never floating over a dip), `sink` deep.
      const p = puffPoint(n, { radius: lobe.radius, seed: lobe.seed, ...lobe.sculpt }).multiplyScalar(sink).add(lobe.center);
      q.setFromUnitVectors(UP, n);
      spin.setFromAxisAngle(UP, rng.range(0, Math.PI * 2));
      items.push({ p: [p.x, p.y, p.z], r: q.clone().multiply(spin), s: rng.range(scale[0], scale[1]), color: new THREE.Color(rng.pick(colors)).offsetHSL(rng.range(-0.01, 0.01), 0, rng.range(-0.04, 0.03)) });
    }
  }
  return items;
}

/* ---------- cumulus crowns (trees in bloom) ---------- */

const randomUnit = (rng, out = new THREE.Vector3()) => {
  do out.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
  while (out.lengthSq() > 1 || out.lengthSq() < 1e-4);
  return out.normalize();
};

/**
 * Cumulus crown: a clump at every branch tip, each a heap of smooth overlapping bumps (a large core
 * with smaller ones banked over its top and outer side), plus filler clumps that close the crown's
 * dome wherever the tips leave a hole. Bumps are oblate (height `flat` of their width), so clumps
 * stack in soft horizontal tiers like cloud; smooth bumps read as bloom, noise-sculpted lobes as rock.
 * Returns { spheres: [{ c, r, sy, clump }], clumps, centre, radius, top }; a bump spans r across
 * and r * sy up.
 */
// `fillBelow`: how far under the dome's equator (in its half-height) filler clumps still go, for
// crowns that are ovals rather than umbrellas. `along`: { depth, at: [t...], chance } also seats
// clumps along the limbs of that depth (foliage carried along side branches).
export function cumulusCrown(rng, { tips, branches = [] }, { size = 0.16, satellites = [5, 8], squash = 0.8, flat = 0.78, fillShell = 0.55, fillGap = 1.15, lift = 0.25, fillBelow = 0.1, along = null } = {}) {
  const centre = new THREE.Vector3();
  for (const t of tips) centre.add(t.p);
  centre.divideScalar(tips.length);
  const clumps = tips.map((t) => ({
    c: t.p.clone().addScaledVector(t.dir, size * 0.25).addScaledVector(UP, size * lift),
    s: size * rng.range(0.88, 1.12),
    tip: t,
  }));
  if (along) {
    for (const b of branches) {
      if (b.depth !== along.depth) continue;
      const curve = new THREE.CatmullRomCurve3(b.points);
      for (const t of along.at) {
        if (!rng.chance(along.chance ?? 1)) continue;
        const p = curve.getPointAt(t).addScaledVector(UP, size * lift * 0.6);
        if (clumps.some((k) => k.c.distanceTo(p) < size * 0.9)) continue;
        clumps.push({ c: p, s: size * rng.range(0.8, 1.0), tip: null });
      }
    }
  }

  // The dome through the clumps: a half-ellipsoid over their mean height, filled with clumps on
  // its skin (inset by `fillShell` of a clump) wherever no clump stands within `fillGap` sizes.
  let reachXZ = 0;
  let top = -Infinity;
  for (const k of clumps) {
    reachXZ = Math.max(reachXZ, Math.hypot(k.c.x - centre.x, k.c.z - centre.z));
    top = Math.max(top, k.c.y);
  }
  const base = centre.y + size * lift;
  const rx = reachXZ;
  const ry = Math.max(top - base, size);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const samples = Math.round((((Math.PI * 2 * rx * rx) / (size * size)) * 1.4 * (1 + fillBelow)) / 1.1);
  const fills = [];
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * (1 + fillBelow); // the upper hemisphere and a little below its rim
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * golden;
    const p = new THREE.Vector3(centre.x + Math.cos(a) * ring * (rx - size * fillShell), base + y * (ry - size * fillShell * 0.6), centre.z + Math.sin(a) * ring * (rx - size * fillShell));
    const near = [...clumps, ...fills].some((k) => k.c.distanceTo(p) < size * fillGap);
    if (!near) fills.push({ c: p, s: size * rng.range(0.82, 1.0), tip: null });
  }
  clumps.push(...fills);

  const spheres = [];
  const d = new THREE.Vector3();
  clumps.forEach((k, index) => {
    const outward = k.c.clone().sub(centre).setY(0);
    if (outward.lengthSq() > 1e-6) outward.normalize();
    k.outward = outward;
    spheres.push({ c: k.c.clone(), r: k.s * rng.range(0.64, 0.72), sy: flat * rng.range(0.92, 1.06), clump: index });
    // Satellites sink well into the core, so a clump reads as one cauliflower head, not a heap of balls.
    const n = rng.int(satellites[0], satellites[1]);
    for (let i = 0; i < n; i++) {
      randomUnit(rng, d).addScaledVector(outward, 0.6).addScaledVector(UP, 0.35).normalize();
      const p = k.c.clone().addScaledVector(d, k.s * rng.range(0.34, 0.56));
      p.y = k.c.y + (p.y - k.c.y) * squash;
      spheres.push({ c: p, r: k.s * rng.range(0.36, 0.54), sy: flat * rng.range(0.9, 1.1), clump: index });
    }
  });
  return { spheres, clumps, centre, radius: rx + size, top: base + ry + size * flat };
}

// Instance placements for a crown's bumps (a unit sphere scaled to each bump).
export const crownBumps = (spheres) => spheres.map((s) => ({ p: s.c.toArray(), s: [s.r, s.r * s.sy, s.r] }));

/**
 * Organs strewn over the exposed skin of a heap of bumps (blossoms over a cumulus crown). Each bump
 * gets `density` per unit of its area; points buried in a neighbour are dropped, and so are most of
 * those hidden in a crevice (a ray `reach` long out of the surface hits another bump). Undersides
 * keep only `under` of theirs. Each item sits on its bump facing out (+y along the surface normal,
 * which the organ's transferred normal then carries), spun at random, tilted up to `tilt`.
 * `color(p, n)` tints each one.
 */
// `alignUp`: instead of a random spin, each organ's length (+z) runs up the surface (sprays on a
// cypress), within +-`alignUp` radians, its tip lifted off the skin by up to `tilt`.
export function sphereCover(rng, spheres, { density = 900, scale = [0.018, 0.026], under = 0.35, reach = 0.2, sink = 1, tilt = 0.3, alignUp = null, color = () => '#FFFFFF' } = {}) {
  const items = [];
  const u = new THREE.Vector3();
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  const o = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  for (const s of spheres) {
    const sy = s.sy ?? 1;
    const near = spheres.filter((b) => b !== s && b.c.distanceTo(s.c) < b.r + s.r + reach);
    const area = 4 * Math.PI * s.r * s.r * (1 + 2 * sy) / 3;
    const count = Math.round(area * density);
    for (let i = 0; i < count; i++) {
      randomUnit(rng, u);
      n.set(u.x, u.y / sy, u.z).normalize(); // the ellipsoid's normal at that point
      if (n.y < -0.25 && !rng.chance(under)) continue;
      p.set(s.c.x + u.x * s.r, s.c.y + u.y * s.r * sy, s.c.z + u.z * s.r);
      let hidden = false;
      for (const b of near) {
        // In b's unit-sphere space: buried if inside it; in a crevice if the outward ray meets it soon.
        const by = b.r * (b.sy ?? 1);
        o.set((p.x - b.c.x) / b.r, (p.y - b.c.y) / by, (p.z - b.c.z) / b.r);
        const c = o.lengthSq() - 1;
        if (c < 0) {
          hidden = true;
          break;
        }
        dir.set(n.x / b.r, n.y / by, n.z / b.r);
        const a = dir.lengthSq();
        const h = o.dot(dir);
        const disc = h * h - a * c;
        if (h < 0 && disc > 0 && (-h - Math.sqrt(disc)) / a < reach && rng.chance(0.9)) {
          hidden = true;
          break;
        }
      }
      if (hidden) continue;
      p.set(s.c.x + u.x * s.r * sink, s.c.y + u.y * s.r * sy * sink, s.c.z + u.z * s.r * sink);
      q.setFromUnitVectors(UP, n);
      const tangentUp = alignUp === null ? null : UP.clone().addScaledVector(n, -n.y);
      if (tangentUp && tangentUp.lengthSq() > 1e-4) {
        // Spin about the normal so +z follows the surface's uphill direction, then lift the tip.
        const local = tangentUp.applyQuaternion(q.clone().invert());
        q.multiply(turn.setFromAxisAngle(UP, Math.atan2(local.x, local.z) + rng.range(-alignUp, alignUp)));
        q.multiply(turn.setFromAxisAngle(axis.set(1, 0, 0), -rng.range(0, tilt)));
      } else {
        randomUnit(rng, axis).cross(UP);
        if (axis.lengthSq() > 1e-6) q.multiply(turn.setFromAxisAngle(axis.normalize(), rng.range(0, tilt)));
        q.multiply(turn.setFromAxisAngle(UP, rng.range(0, Math.PI * 2)));
      }
      items.push({ p: [p.x, p.y, p.z], r: q.clone(), s: rng.range(scale[0], scale[1]), color: color(p, n) });
    }
  }
  return items;
}

/**
 * Twigs in bloom fringing the crown: from the branch tips on the crown's rim (clumps out past
 * `rim` of its reach), thin kinked shoots run outward and a little down, out past the clump's skin.
 * Returns the shoots as [{ points, dir }] for the caller to dress with flowers or leaves.
 */
export function crownTwigs(parent, rng, crown, { material, count = 2, reach = [0.35, 0.65], radius = 0.0065, rim = 0.55 } = {}) {
  const shoots = [];
  const reachXZ = crown.radius;
  for (const clump of crown.clumps) {
    if (!clump.tip) continue;
    if (Math.hypot(clump.c.x - crown.centre.x, clump.c.z - crown.centre.z) < reachXZ * rim) continue;
    for (let k = 0; k < count; k++) {
      const dir = clump.outward.clone().multiplyScalar(1.2).addScaledVector(clump.tip.dir, 0.4).addScaledVector(UP, rng.range(-0.45, 0.15));
      dir.add(randomUnit(rng).multiplyScalar(0.5)).normalize();
      if (dir.y > 0.15) dir.setY(0.15).normalize(); // out and down from the rim, never up through the top
      const length = clump.s * (0.8 + rng.range(reach[0], reach[1]));
      const points = [clump.c.clone().addScaledVector(dir, -clump.s * 0.2)];
      let d = dir.clone();
      for (let i = 1; i <= 4; i++) {
        d = deflect(d, rng.range(0.05, 0.3), rng.range(0, Math.PI * 2));
        if (d.y > 0.2) d.setY(0.2).normalize();
        points.push(points[i - 1].clone().addScaledVector(d, length / 4));
      }
      add(parent, taperTube(points, [radius, radius * 0.35], { tubular: 24, radial: 6 }), material, { name: 'twig' });
      shoots.push({ points, dir: d.clone() });
    }
  }
  return shoots;
}

/**
 * Organs strewn over any closed surface mesh (clipped topiary, a cypress column): `density` per unit
 * of its area, area-weighted over its triangles (in the mesh's own frame, after `matrix`), each
 * facing out along the interpolated surface normal (+y of the organ), spun at random and tilted up
 * to `tilt`. Downward-facing spots keep only `under` of theirs; `keep(p, n)` may veto any spot.
 */
export function surfaceCover(rng, geometry, { matrix = null, density = 900, scale = [0.01, 0.014], under = 0.4, sink = 1, lift = 0, tilt = 0.3, keep = () => true, color = () => '#FFFFFF' } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  if (matrix) g.applyMatrix4(matrix);
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const triangles = pos.count / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const na = new THREE.Vector3();
  const nb = new THREE.Vector3();
  const nc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  const items = [];
  let carry = 0;
  for (let t = 0; t < triangles; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    carry += area * density;
    while (carry >= 1) {
      carry -= 1;
      let u = rng();
      let v = rng();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      p.copy(a).addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
      na.fromBufferAttribute(nor, t * 3);
      nb.fromBufferAttribute(nor, t * 3 + 1);
      nc.fromBufferAttribute(nor, t * 3 + 2);
      n.copy(na).multiplyScalar(1 - u - v).addScaledVector(nb, u).addScaledVector(nc, v).normalize();
      if (n.y < -0.3 && !rng.chance(under)) continue;
      if (!keep(p, n)) continue;
      p.multiplyScalar(sink).addScaledVector(n, lift);
      q.setFromUnitVectors(UP, n);
      randomUnit(rng, axis).cross(UP);
      if (axis.lengthSq() > 1e-6) q.multiply(turn.setFromAxisAngle(axis.normalize(), rng.range(0, tilt)));
      q.multiply(turn.setFromAxisAngle(UP, rng.range(0, Math.PI * 2)));
      items.push({ p: [p.x, p.y, p.z], r: q.clone(), s: rng.range(scale[0], scale[1]), color: color(p, n) });
    }
  }
  return items;
}
