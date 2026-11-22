import {
  ISLAND,
  PLAZA,
  STREET,
  STREETS,
  BUILDINGS,
  LANDMARKS,
  FURNITURE,
  PLANTING,
  GARLANDS,
  ISLETS,
  SUN,
  CAMERA,
  rotate,
} from './layout.js';
import { worldFootprint } from './audit.js';

const CODE = {
  'maison-macaron': 'B1',
  'rabbit-cake': 'B2',
  'la-douceur': 'B3',
  'peach-house': 'B4',
  'sage-dutch': 'B5',
  'blue-bookshop': 'B6',
  'wisteria-house': 'B7',
  'butter-house': 'B8',
  'rose-turret': 'B9',
  'grand-salon': 'B10',
  'macaron-kiosk': 'B11',
  'sweet-treats': 'B12',
  fountain: 'L1',
  carousel: 'L2',
  'macaron-tower': 'L4',
  gazebo: 'L5',
  pond: 'N7',
};

const FILL = {
  'maison-macaron': '#F6D3CE',
  'rabbit-cake': '#FBF2E4',
  'la-douceur': '#FFFAF2',
  'peach-house': '#F8CDB2',
  'sage-dutch': '#C8DCBA',
  'blue-bookshop': '#BFD2EB',
  'wisteria-house': '#DACDEF',
  'butter-house': '#F8E6B0',
  'rose-turret': '#F3BCC5',
  'grand-salon': '#FBF2E4',
  'macaron-kiosk': '#F5BDC9',
  'sweet-treats': '#F9CCD9',
  fountain: '#BDE3EF',
  carousel: '#F0A9BA',
  'macaron-tower': '#F8E3A5',
  gazebo: '#99CEB9',
  pond: '#BDE3EF',
};

const TREE_FILL = {
  'nature/CherryBlossomTree': '#F7BFD0',
  'nature/GoldenTree': '#F3CF85',
  'nature/Cypress': '#8FC6A8',
  'nature/Topiary': '#A3CC8E',
  'nature/FloweringBush': '#B4D9A0',
  'nature/FlowerBed': '#F4A9C0',
};

const INK = '#5C3F4C';
const n = (v) => v.toFixed(1);
const FONT = '<style>.t,.ts,.th{font-family:system-ui,sans-serif;fill:#5C3F4C}.t,.th{font-size:14px}.th{font-weight:500}.ts{font-size:12px}</style>';

// Town plan: top-down, north up.
export function planSVG({ standalone = false } = {}) {
  const S = 27;
  const cx = 340;
  const cy = 318;
  const px = (x) => cx + x * S;
  const py = (z) => cy + z * S;
  const poly = (pts) => pts.map(([x, z]) => `${n(px(x))},${n(py(z))}`).join(' ');
  const out = [];
  const add = (s) => out.push(s);

  add(`<circle cx="${cx}" cy="${cy}" r="${n(ISLAND.bodyRadius * S)}" fill="#FFF4E4" stroke="#E6CDB9" stroke-width="0.5"/>`);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    add(`<circle cx="${n(px(Math.cos(a) * ISLAND.rimRadius))}" cy="${n(py(Math.sin(a) * ISLAND.rimRadius))}" r="${n(0.95 * S)}" fill="#FFFDF8" stroke="#E6CDB9" stroke-width="0.5"/>`);
  }
  add(`<circle cx="${cx}" cy="${cy}" r="${n(ISLAND.groundRadius * S)}" fill="#CFE7BF" stroke="#A9CF95" stroke-width="0.5"/>`);

  const half = STREET.roadHalf + STREET.walk;
  for (const street of STREETS) {
    const strip = (h) =>
      [
        [STREET.start - 0.4, -h],
        [STREET.end, -h],
        [STREET.end, h],
        [STREET.start - 0.4, h],
      ].map(([x, z]) => rotate(x, z, street.angle));
    const [bx, bz] = rotate(STREET.end, 0, street.angle);
    add(`<circle cx="${n(px(bx))}" cy="${n(py(bz))}" r="${n(STREET.belvedere * S)}" fill="#F3DED3" stroke="#D9BBAA" stroke-width="0.5"/>`);
    add(`<polygon points="${poly(strip(half))}" fill="#F3DED3"/>`);
    add(`<polygon points="${poly(strip(STREET.roadHalf))}" fill="#B9AEC6"/>`);
  }
  add(`<circle cx="${cx}" cy="${cy}" r="${n(PLAZA.radius * S)}" fill="#F3DED3" stroke="#D9BBAA" stroke-width="0.5"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="${n(2.45 * S)}" fill="none" stroke="#E2C2B2" stroke-width="2"/>`);

  for (const g of GARLANDS) {
    add(`<line x1="${n(px(g.a[0]))}" y1="${n(py(g.a[1]))}" x2="${n(px(g.b[0]))}" y2="${n(py(g.b[1]))}" stroke="#EE8FAB" stroke-width="1.5" stroke-dasharray="3 2"/>`);
  }

  for (const item of PLANTING) {
    const fill = TREE_FILL[item.asset];
    const fp = worldFootprint(item);
    if (fp.shape === 'rect') {
      add(`<polygon points="${poly(fp.corners)}" fill="${fill}" stroke="#D77E9C" stroke-width="0.5"/>`);
    } else {
      const r = item.canopy ?? item.footprint.r;
      add(`<circle cx="${n(px(item.x))}" cy="${n(py(item.z))}" r="${n(r * S)}" fill="${fill}" fill-opacity="0.9" stroke="#7FA389" stroke-width="0.5"/>`);
      if (item.canopy) add(`<circle cx="${n(px(item.x))}" cy="${n(py(item.z))}" r="1.6" fill="#8C6A5A"/>`);
    }
  }

  const label = (x, z, text) =>
    add(`<text class="ts" x="${n(px(x))}" y="${n(py(z))}" text-anchor="middle" dominant-baseline="central" style="fill:${INK}">${text}</text>`);

  for (const item of [...BUILDINGS, ...LANDMARKS]) {
    const fp = worldFootprint(item);
    const fill = FILL[item.id];
    if (fp.shape === 'rect') {
      add(`<polygon points="${poly(fp.corners)}" fill="${fill}" stroke="${INK}" stroke-width="0.8"/>`);
      const front = [
        [-0.16, item.footprint.d / 2],
        [0.16, item.footprint.d / 2],
        [0, item.footprint.d / 2 + 0.2],
      ].map(([x, z]) => {
        const [rx, rz] = rotate(x, z, item.ry);
        return [rx + item.x, rz + item.z];
      });
      add(`<polygon points="${poly(front)}" fill="${INK}"/>`);
    } else {
      add(`<circle cx="${n(px(item.x))}" cy="${n(py(item.z))}" r="${n(fp.r * S)}" fill="${fill}" stroke="${INK}" stroke-width="0.8"/>`);
    }
    label(item.x, item.z, CODE[item.id]);
  }

  for (const item of FURNITURE) {
    const x = px(item.x);
    const y = py(item.z);
    if (item.kind === 'lamp') add(`<circle cx="${n(x)}" cy="${n(y)}" r="2.6" fill="#5F6883"/>`);
    else if (item.kind === 'urn') add(`<circle cx="${n(x)}" cy="${n(y)}" r="3.2" fill="#E8C783" stroke="#B8944C" stroke-width="0.5"/>`);
    else if (item.kind === 'easel') add(`<rect x="${n(x - 2.5)}" y="${n(y - 2.5)}" width="5" height="5" fill="#4F6B5E"/>`);
    else if (item.kind === 'bench' || item.kind === 'bicycle') {
      const w = item.kind === 'bench' ? 0.82 : 0.3;
      const d = item.kind === 'bench' ? 0.3 : 0.95;
      const pts = [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ].map(([bx, bz]) => {
        const [rx, rz] = rotate(bx, bz, item.ry);
        return [rx + item.x, rz + item.z];
      });
      add(`<polygon points="${poly(pts)}" fill="${item.kind === 'bench' ? '#C99A82' : '#7FB3C8'}" stroke="${INK}" stroke-width="0.4"/>`);
    }
  }

  add(`<line x1="62" y1="96" x2="62" y2="60" stroke="${INK}" stroke-width="1.2" marker-end="url(#arrow)"/>`);
  add(`<text class="ts" x="62" y="110" text-anchor="middle" style="fill:${INK}">North</text>`);
  add(`<line x1="566" y1="604" x2="${566 + 2 * S}" y2="604" stroke="${INK}" stroke-width="1.2"/>`);
  add(`<text class="ts" x="${566 + S}" y="596" text-anchor="middle" style="fill:${INK}">8 m</text>`);

  const legend = [
    ['B1', 'Maison Macaron', 'maison-macaron'],
    ['B2', 'Rabbit Cake', 'rabbit-cake'],
    ['B3', 'La Douceur', 'la-douceur'],
    ['B4', 'Peach house', 'peach-house'],
    ['B5', 'Sage Dutch house', 'sage-dutch'],
    ['B6', 'Blue bookshop café', 'blue-bookshop'],
    ['B7', 'Wisteria house', 'wisteria-house'],
    ['B8', 'Butter house', 'butter-house'],
    ['B9', 'Rose turret house', 'rose-turret'],
    ['B10', 'Grand salon de thé', 'grand-salon'],
    ['B11', 'Macaron kiosk', 'macaron-kiosk'],
    ['B12', 'Sweet-treats kiosk', 'sweet-treats'],
    ['L1', 'Tiered fountain', 'fountain'],
    ['L2', 'Carousel', 'carousel'],
    ['L4', 'Macaron tower', 'macaron-tower'],
    ['L5', 'Gazebo', 'gazebo'],
    ['N7', 'Duck pond', 'pond'],
  ];
  const keys = [
    ['#F7BFD0', 'Cherry blossom'],
    ['#F3CF85', 'Golden tree'],
    ['#8FC6A8', 'Cypress, topiary'],
    ['#B4D9A0', 'Flowering bush'],
    ['#F4A9C0', 'Flower bed'],
    ['#B9AEC6', 'Asphalt street'],
    ['#F3DED3', 'Cobbled paving'],
    ['#5F6883', 'Lamp post'],
    ['#C99A82', 'Bench'],
    ['#E8C783', 'Urn planter'],
    ['#EE8FAB', 'Bunting garland'],
  ];
  const top = 642;
  const rows = 7;
  legend.forEach(([code, name, id], i) => {
    const x = 40 + Math.floor(i / rows) * 150;
    const y = top + (i % rows) * 20;
    add(`<rect x="${x}" y="${y - 6}" width="12" height="12" rx="2" fill="${FILL[id]}" stroke="${INK}" stroke-width="0.5"/>`);
    add(`<text class="ts" x="${x + 18}" y="${y}" dominant-baseline="central">${code} ${name}</text>`);
  });
  keys.forEach(([color, name], i) => {
    const x = 490 + Math.floor(i / 6) * 0;
    const y = top + i * 20;
    add(`<rect x="${x}" y="${y - 6}" width="12" height="12" rx="6" fill="${color}"/>`);
    add(`<text class="ts" x="${x + 18}" y="${y}" dominant-baseline="central">${name}</text>`);
  });

  const height = top + 11 * 20 + 12;
  return `<svg width="100%" viewBox="0 0 680 ${height}" role="img"${standalone ? ' xmlns="http://www.w3.org/2000/svg"' : ''}><title>Cloud cream island town plan</title><desc>Top-down plan of the island: a round plaza with a fountain, four asphalt streets, twelve building lots, landmarks, planting and street furniture.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>${standalone ? FONT : ''}${out.join('')}</svg>`;
}

// World overview (top-down) beside a side elevation of the island's layers.
export function worldSVG({ standalone = false } = {}) {
  const out = [];
  const add = (s) => out.push(s);
  const S = 7.2;
  const cx = 186;
  const cy = 176;
  const px = (x) => cx + x * S;
  const py = (z) => cy + z * S;

  add(`<circle cx="${cx}" cy="${cy}" r="${n(31 * S > 150 ? 150 : 31 * S)}" fill="none" stroke="#B9C6DE" stroke-width="0.8" stroke-dasharray="4 4"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="${n(ISLAND.bodyRadius * S)}" fill="#FFF4E4" stroke="#E6CDB9" stroke-width="0.8"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="${n(ISLAND.groundRadius * S)}" fill="#CFE7BF"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="${n(PLAZA.radius * S)}" fill="#F3DED3"/>`);
  for (const street of STREETS) {
    const [ex, ez] = rotate(STREET.end, 0, street.angle);
    add(`<line x1="${cx}" y1="${cy}" x2="${n(px(ex))}" y2="${n(py(ez))}" stroke="#B9AEC6" stroke-width="${n(STREET.roadHalf * 2 * S)}"/>`);
  }
  const isletFill = { 'castle-isle': '#F5BDC9', 'ferris-isle': '#F8E3A5', 'blossom-isle': '#C3E5D1' };
  const labelAt = { 'castle-isle': [0, -34], 'ferris-isle': [0, 32], 'blossom-isle': [0, 28] };
  for (const islet of ISLETS) {
    add(`<circle cx="${n(px(islet.x))}" cy="${n(py(islet.z))}" r="${n(islet.radius * S)}" fill="${isletFill[islet.id]}" stroke="${INK}" stroke-width="0.6"/>`);
    const [dx, dy] = labelAt[islet.id];
    add(`<text class="ts" x="${n(px(islet.x) + dx)}" y="${n(py(islet.z) + dy)}" text-anchor="middle" dominant-baseline="central">${islet.label}</text>`);
  }

  const sunX = cx + Math.cos(SUN.azimuth) * 150;
  const sunY = cy + Math.sin(SUN.azimuth) * 150;
  add(`<circle cx="${n(sunX)}" cy="${n(sunY)}" r="7" fill="#F8D27A" stroke="#D9A441" stroke-width="0.6"/>`);
  add(`<line x1="${n(sunX + Math.cos(SUN.azimuth + Math.PI) * 12)}" y1="${n(sunY + Math.sin(SUN.azimuth + Math.PI) * 12)}" x2="${n(sunX + Math.cos(SUN.azimuth + Math.PI) * 44)}" y2="${n(sunY + Math.sin(SUN.azimuth + Math.PI) * 44)}" stroke="#D9A441" stroke-width="1.2" marker-end="url(#arrow)"/>`);
  add(`<text class="ts" x="${n(sunX - 14)}" y="${n(sunY)}" text-anchor="end" dominant-baseline="central">Sun</text>`);

  const camX = cx + Math.cos(CAMERA.azimuth) * 150;
  const camY = cy + Math.sin(CAMERA.azimuth) * 150;
  add(`<rect x="${n(camX - 7)}" y="${n(camY - 5)}" width="14" height="10" rx="2" fill="#8FA3C8" stroke="${INK}" stroke-width="0.6"/>`);
  add(`<line x1="${n(camX + Math.cos(CAMERA.azimuth + Math.PI) * 12)}" y1="${n(camY + Math.sin(CAMERA.azimuth + Math.PI) * 12)}" x2="${n(camX + Math.cos(CAMERA.azimuth + Math.PI) * 44)}" y2="${n(camY + Math.sin(CAMERA.azimuth + Math.PI) * 44)}" stroke="#6F86B5" stroke-width="1.2" marker-end="url(#arrow)"/>`);
  add(`<text class="ts" x="${n(camX + 14)}" y="${n(camY)}" dominant-baseline="central">Camera start</text>`);
  add(`<text class="ts" x="${cx}" y="22" text-anchor="middle" dominant-baseline="central">Top view: island, islets and cloud sea</text>`);

  const ex = 470;
  const ground = 150;
  const hw = 86;
  add(`<text class="ts" x="${ex + 20}" y="22" text-anchor="middle" dominant-baseline="central">Side view: island layers</text>`);
  const puffs = [
    [-62, 46, 30],
    [-22, 58, 36],
    [22, 60, 34],
    [60, 46, 30],
    [-84, 30, 20],
    [84, 30, 20],
    [0, 86, 26],
    [-40, 82, 22],
    [40, 82, 22],
  ];
  for (const [dx, dy, r] of puffs) add(`<circle cx="${ex + dx}" cy="${ground + dy}" r="${r}" fill="#FFFFFF" stroke="#C9D2E6" stroke-width="0.6"/>`);
  add(`<rect x="${ex - hw}" y="${ground + 2}" width="${hw * 2}" height="24" rx="11" fill="#FFF4E4" stroke="#E6CDB9" stroke-width="0.6"/>`);
  for (const dx of [-70, -44, -12, 20, 52, 74]) add(`<rect x="${ex + dx - 4}" y="${ground + 18}" width="8" height="${14 + ((dx * 7) % 9 + 9) % 9}" rx="4" fill="#FFF4E4" stroke="#E6CDB9" stroke-width="0.6"/>`);
  add(`<rect x="${ex - hw + 8}" y="${ground - 3}" width="${hw * 2 - 16}" height="6" rx="3" fill="#CFE7BF"/>`);
  for (const dx of [-82, 82]) add(`<circle cx="${ex + dx}" cy="${ground - 2}" r="9" fill="#FFFDF8" stroke="#E6CDB9" stroke-width="0.6"/>`);
  const houses = [
    [-58, 20, 26, '#F8CDB2'],
    [-34, 22, 34, '#F6D3CE'],
    [-8, 18, 22, '#BFD2EB'],
    [14, 22, 30, '#FBF2E4'],
    [40, 20, 24, '#DACDEF'],
  ];
  for (const [dx, w, h, fill] of houses) {
    add(`<rect x="${ex + dx}" y="${ground - 3 - h}" width="${w}" height="${h}" fill="${fill}" stroke="${INK}" stroke-width="0.6"/>`);
    add(`<polygon points="${ex + dx - 2},${ground - 3 - h} ${ex + dx + w / 2},${ground - 3 - h - 12} ${ex + dx + w + 2},${ground - 3 - h}" fill="#8797B8" stroke="${INK}" stroke-width="0.6"/>`);
  }
  const notes = [
    [ground - 40, 'Pastel town', ex + 62, ground - 30],
    [ground - 4, 'Piped rim', ex + 91, ground - 2],
    [ground + 14, 'Cream slab', ex + hw, ground + 14],
    [ground + 62, 'Cloud base', ex + 84, ground + 56],
  ];
  for (const [y, text, lx, ly] of notes) {
    add(`<line class="leader" x1="${lx}" y1="${ly}" x2="${ex + 104}" y2="${y}"/>`);
    add(`<text class="ts" x="${ex + 108}" y="${y}" dominant-baseline="central">${text}</text>`);
  }

  return `<svg width="100%" viewBox="0 0 680 350" role="img"${standalone ? ' xmlns="http://www.w3.org/2000/svg"' : ''}><title>Cloud cream island world overview</title><desc>Left: top view of the main island with three satellite islets, the sun direction and the starting camera. Right: side view showing the town on a cream slab with a piped rim, resting on a cloud.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>${standalone ? FONT + '<style>.leader{stroke:#9A8A92;stroke-width:0.5;stroke-dasharray:3 2}</style>' : ''}${out.join('')}</svg>`;
}
