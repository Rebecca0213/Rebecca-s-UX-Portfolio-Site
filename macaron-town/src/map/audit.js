import { ISLAND, PLAZA, STREET, STREETS, ALL_GROUND_ITEMS, rotate } from './layout.js';

// World-space footprint of a placed item: circle, or axis-aligned box (all boxes sit at quarter turns).
export function worldFootprint(item) {
  const f = item.footprint;
  if (f.r !== undefined) return { shape: 'circle', x: item.x, z: item.z, r: f.r };
  const corners = [
    [-f.w / 2, -f.d / 2],
    [f.w / 2, -f.d / 2],
    [f.w / 2, f.d / 2],
    [-f.w / 2, f.d / 2],
  ].map(([x, z]) => {
    const [rx, rz] = rotate(x, z, item.ry);
    return [rx + item.x, rz + item.z];
  });
  const xs = corners.map((c) => c[0]);
  const zs = corners.map((c) => c[1]);
  return { shape: 'rect', x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), corners };
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function overlap(a, b, margin = 0) {
  if (a.shape === 'circle' && b.shape === 'circle') return Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r + margin;
  if (a.shape === 'rect' && b.shape === 'rect') {
    return a.x0 < b.x1 + margin && b.x0 < a.x1 + margin && a.z0 < b.z1 + margin && b.z0 < a.z1 + margin;
  }
  const [c, r] = a.shape === 'circle' ? [a, b] : [b, a];
  return Math.hypot(c.x - clamp(c.x, r.x0, r.x1), c.z - clamp(c.z, r.z0, r.z1)) < c.r + margin;
}

function reach(fp) {
  if (fp.shape === 'circle') return Math.hypot(fp.x, fp.z) + fp.r;
  return Math.max(...fp.corners.map(([x, z]) => Math.hypot(x, z)));
}

export function pavingZones() {
  const half = STREET.roadHalf + STREET.walk;
  const zones = [{ name: 'plaza', shape: 'circle', x: 0, z: 0, r: PLAZA.radius }];
  for (const street of STREETS) {
    const corners = [
      [STREET.start, -half],
      [STREET.end, -half],
      [STREET.end, half],
      [STREET.start, half],
    ].map(([x, z]) => rotate(x, z, street.angle));
    const xs = corners.map((c) => c[0]);
    const zs = corners.map((c) => c[1]);
    zones.push({ name: `${street.id} street`, shape: 'rect', x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
    const [bx, bz] = rotate(STREET.end, 0, street.angle);
    zones.push({ name: `${street.id} belvedere`, shape: 'circle', x: bx, z: bz, r: STREET.belvedere });
  }
  return zones;
}

// Every rule the map must satisfy before anything is modeled.
export function auditMap() {
  const issues = [];
  const items = ALL_GROUND_ITEMS.map((item) => ({ item, fp: worldFootprint(item) }));
  const zones = pavingZones();

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlap(items[i].fp, items[j].fp, 0.02)) issues.push(`overlap: ${items[i].item.id} × ${items[j].item.id}`);
    }
  }

  for (const { item, fp } of items) {
    if (reach(fp) > ISLAND.groundRadius - 0.12) issues.push(`off the plateau: ${item.id} reaches ${reach(fp).toFixed(2)}`);
    if (!item.onPaving) {
      for (const zone of zones) if (overlap(fp, zone, 0)) issues.push(`on paving: ${item.id} × ${zone.name}`);
    }
  }

  const trees = items.filter(({ item }) => item.canopy);
  for (const a of trees) {
    const crown = { shape: 'circle', x: a.item.x, z: a.item.z, r: a.item.canopy };
    for (const b of items) {
      if (b.item.tall && overlap(crown, b.fp, 0)) issues.push(`canopy hits: ${a.item.id} × ${b.item.id}`);
    }
    for (const b of trees) {
      if (a.item.id < b.item.id) {
        const gap = Math.hypot(a.item.x - b.item.x, a.item.z - b.item.z) - (a.item.canopy + b.item.canopy);
        if (gap < -0.05) issues.push(`canopies merge: ${a.item.id} × ${b.item.id} (${gap.toFixed(2)})`);
      }
    }
  }

  return { items: items.length, issues };
}
