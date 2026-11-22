// THE MAP — single source of truth for where everything on Cloud Cream Island stands.
// Units: 1 unit = 4 m. Top-down axes: +x east, +z south. Angles are radians about +y.
// Pure data, no rendering imports: the schematic, the audit and the world assembler all read this.

export const QUARTER = Math.PI / 2;
const DEG = Math.PI / 180;

export const ISLAND = {
  groundRadius: 9.0, // town plateau (lawn + paving)
  rimRadius: 9.75, // ring of piped cream rosettes
  bodyRadius: 10.4, // cream slab
};

export const PLAZA = { radius: 3.0 };

export const STREET = {
  roadHalf: 0.62, // asphalt carriageway half-width
  walk: 0.3, // cobbled pavement on each side
  start: 2.9,
  end: 7.9,
  belvedere: 0.95, // round lookout terrace closing each street
};

export const LOT = { frontLine: 1.05, nearAlong: 4.25, farAlong: 6.65 };

// Same convention as THREE's rotation about +y.
export const rotate = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

// Quadrants are the SE quadrant turned by q quarter-turns: 0 = SE, 1 = NE, 2 = NW, 3 = SW.
// In a quadrant's frame its two streets run along +x and +z.
const inQuadrant = (q, x, z) => rotate(x, z, q * QUARTER);

export const STREETS = [
  { id: 'east', quadrant: 0 },
  { id: 'north', quadrant: 1 },
  { id: 'west', quadrant: 2 },
  { id: 'south', quadrant: 3 },
].map((s) => ({ ...s, angle: s.quadrant * QUARTER }));

/* ---------- placement helpers ---------- */

// Building lot. Slots A/B line the quadrant's +x street, C/D its +z street; A and C are nearest the plaza.
function lot(id, asset, label, quadrant, slot, w, d) {
  const along = slot === 'A' || slot === 'C' ? LOT.nearAlong : LOT.farAlong;
  const onX = slot === 'A' || slot === 'B';
  const local = onX ? [along, LOT.frontLine + d / 2] : [LOT.frontLine + d / 2, along];
  const [x, z] = inQuadrant(quadrant, local[0], local[1]);
  return {
    id,
    asset,
    label,
    kind: 'building',
    x,
    z,
    ry: (onX ? Math.PI : -QUARTER) + quadrant * QUARTER,
    footprint: { w, d },
    tall: true,
  };
}

function place(id, asset, label, kind, quadrant, x, z, ry, footprint, extra = {}) {
  const [wx, wz] = inQuadrant(quadrant, x, z);
  return { id, asset, label, kind, x: wx, z: wz, ry: ry + quadrant * QUARTER, footprint, ...extra };
}

const facing = (dx, dz) => Math.atan2(dx, dz); // ry that turns an asset's front (+z) toward (dx, dz)
const TO_PLAZA = facing(-1, -1);

/* ---------- buildings ---------- */

// The hero pâtisseries stand in the north row (q1 C, q2 A, q2 B), whose fronts face the default
// camera across the plaza; the round-towered rose house reads from any side in the foreground.
export const BUILDINGS = [
  lot('blue-bookshop', 'buildings/BlueBookshop', 'Café', 0, 'A', 1.95, 1.75),
  lot('rose-turret', 'buildings/RoseTurretHouse', 'Rose turret house', 0, 'B', 2.1, 1.9),
  lot('wisteria-house', 'buildings/WisteriaHouse', 'Wisteria house', 0, 'C', 1.9, 1.75),
  place('macaron-kiosk', 'buildings/MacaronKiosk', 'Macaron kiosk', 'building', 0, 2.1, 6.65, -QUARTER, { r: 1.0 }, { tall: true }),

  lot('peach-house', 'buildings/PeachHouse', 'Peach house', 1, 'A', 1.9, 1.75),
  lot('sage-dutch', 'buildings/SageDutchHouse', 'Sage Dutch house', 1, 'B', 1.9, 1.75),
  lot('la-douceur', 'buildings/LaDouceur', 'Gallery (La Douceur)', 1, 'C', 2.2, 1.95),

  lot('maison-macaron', 'buildings/MaisonMacaron', 'Maison Macaron', 2, 'A', 1.9, 1.75),
  lot('rabbit-cake', 'buildings/RabbitCake', 'Rabbit Cake', 2, 'B', 1.9, 1.75),
  lot('grand-salon', 'buildings/GrandSalon', 'Welcome centre', 2, 'C', 2.2, 1.95),
  lot('sweet-treats', 'buildings/SweetTreatsKiosk', 'Sweet-treats kiosk', 2, 'D', 1.5, 1.3),

  lot('butter-house', 'buildings/ButterHouse', 'Butter house', 3, 'A', 1.9, 1.75),
];

// The town's venues: buildings that answer the pointer (they glow on hover, see Hover, and their name
// appears in the air above them, see Signs).
export const VENUES = [
  { id: 'grand-salon', role: 'welcome', name: 'Welcome Centre' },
  { id: 'la-douceur', role: 'gallery', name: 'Gallery' },
  { id: 'blue-bookshop', role: 'cafe', name: 'Café' },
];

/* ---------- landmarks ---------- */

// The duck pond's shoreline, as a radius about its centre by angle (local frame): a soft kidney.
// The pond asset is built to it and the lawn grows right up to it.
export const POND_SHORE = { radius: 0.93, harmonics: [[2, 0.12, 0.5], [3, 0.07, 1.2], [5, 0.035, 0.3]] };
export const pondRadius = (a) => POND_SHORE.radius * (1 + POND_SHORE.harmonics.reduce((sum, [k, amp, phase]) => sum + amp * Math.sin(k * a + phase), 0));

export const LANDMARKS = [
  place('fountain', 'landmarks/Fountain', 'Tiered fountain', 'landmark', 0, 0, 0, 0, { r: 1.8 }, { onPaving: true, tall: true }),
  place('carousel', 'landmarks/Carousel', 'Carousel', 'landmark', 0, 5.2, 5.2, 0, { r: 1.3 }, { tall: true }),
  place('macaron-tower', 'landmarks/MacaronTower', 'Macaron tower', 'landmark', 1, 5.05, 5.05, 0, { r: 0.85 }, { tall: true }),
  place('gazebo', 'landmarks/Gazebo', 'Gazebo', 'landmark', 3, 2.3, 4.55, 0, { r: 1.05 }, { tall: true }),
  place('pond', 'nature/Pond', 'Duck pond', 'landmark', 3, 5.0, 5.0, 0, { r: 1.25 }),
];

/* ---------- street furniture ---------- */

const furniture = [];
for (let q = 0; q < 4; q++) {
  furniture.push(
    place(`bench-plaza-${q}`, 'street/Bench', 'Bench', 'bench', q, 1.68, 1.68, TO_PLAZA, { r: 0.45 }, { onPaving: true }),
    place(`lamp-plaza-${q}`, 'street/LampPost', 'Lamp', 'lamp', q, 2.54, 1.05, 0, { r: 0.12 }, { onPaving: true }),
    place(`lamp-street-a-${q}`, 'street/LampPost', 'Lamp', 'lamp', q, 5.45, 0.8, 0, { r: 0.12 }, { onPaving: true }),
    place(`lamp-street-b-${q}`, 'street/LampPost', 'Lamp', 'lamp', q, 0.8, 5.45, 0, { r: 0.12 }, { onPaving: true }),
    place(`urn-a-${q}`, 'street/UrnPlanter', 'Urn', 'urn', q, 8.32, 0.6, 0, { r: 0.17 }, { onPaving: true }),
    place(`urn-b-${q}`, 'street/UrnPlanter', 'Urn', 'urn', q, 8.32, -0.6, 0, { r: 0.17 }, { onPaving: true })
  );
}
furniture.push(
  place('bench-pocket', 'street/Bench', 'Bench', 'bench', 1, 1.5, 6.0, facing(-1, 0), { r: 0.45 }),
  place('bench-grove', 'street/Bench', 'Bench', 'bench', 2, 5.05, 5.3, TO_PLAZA, { r: 0.45 }),
  place('bench-park-a', 'street/Bench', 'Bench', 'bench', 3, 3.7, 3.6, facing(1.3, 1.4), { r: 0.45 }),
  place('bench-park-b', 'street/Bench', 'Bench', 'bench', 3, 4.85, 6.8, facing(0, -1), { r: 0.45 }),
  place('easel-rabbit', 'street/SignEasel', 'Sign easel', 'easel', 2, 5.95, 0.84, facing(0, -1), { r: 0.13 }, { onPaving: true, motif: 'cake' }),
  place('easel-books', 'street/SignEasel', 'Sign easel', 'easel', 0, 3.02, 0.84, facing(0, -1), { r: 0.13 }, { onPaving: true, motif: 'cup' }),
  place('bicycle', 'street/Bicycle', 'Bicycle', 'bicycle', 2, 3.0, 1.65, 0, { w: 0.3, d: 0.95 })
);
export const FURNITURE = furniture;

// Bunting is strung across each street between its facing pair of lamps.
export const GARLANDS = STREETS.map((street) => {
  const [ax, az] = rotate(5.45, 0.8, street.angle);
  const [bx, bz] = rotate(5.45, -0.8, street.angle);
  return { id: `bunting-${street.id}`, asset: 'street/Bunting', a: [ax, az], b: [bx, bz], height: 1.34 };
});

/* ---------- planting ---------- */

const tree = (id, asset, label, q, x, z, canopy) =>
  place(id, asset, label, 'tree', q, x, z, 0, { r: 0.2 }, { canopy });
const cherry = (id, q, x, z) => tree(id, 'nature/CherryBlossomTree', 'Cherry blossom', q, x, z, 0.8);
const golden = (id, q, x, z) => tree(id, 'nature/GoldenTree', 'Golden tree', q, x, z, 0.75);
const cypress = (id, q, x, z) => place(id, 'nature/Cypress', 'Cypress', 'tree', q, x, z, 0, { r: 0.3 }, { canopy: 0.35 });
const topiary = (id, q, x, z, shape) => place(id, 'nature/Topiary', 'Topiary', 'tree', q, x, z, 0, { r: 0.3 }, { canopy: 0.3, shape });
const bush = (id, q, x, z) => place(id, 'nature/FloweringBush', 'Flowering bush', 'bush', q, x, z, 0, { r: 0.38 });
const roundBed = (id, q, x, z) => place(id, 'nature/FlowerBed', 'Flower bed', 'bed', q, x, z, 0, { r: 0.45 }, { shape: 'round' });

export const PLANTING = [
  // one round bed on each plaza diagonal
  roundBed('bed-diag-0', 0, 2.6, 2.6),
  roundBed('bed-diag-1', 1, 2.6, 2.6),
  roundBed('bed-diag-2', 2, 2.6, 2.6),
  roundBed('bed-diag-3', 3, 2.6, 2.6),

  // SE: carousel green
  cherry('cherry-se-1', 0, 7.35, 4.15),
  cherry('cherry-se-2', 0, 4.1, 7.3),
  bush('bush-se-1', 0, 3.5, 3.55),
  bush('bush-se-2', 0, 3.55, 6.25),

  // NE: macaron tower parterre and pocket garden
  // formal pairs round the tower: spirals on one diagonal, tiered balls on the other
  topiary('topiary-ne-1', 1, 4.15, 4.15, 'spiral'),
  topiary('topiary-ne-2', 1, 5.95, 4.15, 'tiers'),
  topiary('topiary-ne-3', 1, 4.15, 5.95, 'tiers'),
  topiary('topiary-ne-4', 1, 5.95, 5.95, 'spiral'),
  cherry('cherry-ne-1', 1, 7.3, 4.4),
  cherry('cherry-ne-pocket', 1, 2.15, 6.85),
  golden('golden-ne-1', 1, 4.2, 7.45),
  roundBed('bed-ne-pocket', 1, 1.6, 7.45),
  bush('bush-ne-1', 1, 3.55, 3.5),
  bush('bush-ne-2', 1, 2.75, 5.95),

  // NW: cherry grove
  cherry('cherry-nw-1', 2, 4.5, 4.4),
  cherry('cherry-nw-2', 2, 5.9, 5.3),
  cherry('cherry-nw-3', 2, 4.6, 6.15),
  golden('golden-nw-1', 2, 7.3, 4.3),
  bush('bush-nw-1', 2, 3.55, 3.5),
  bush('bush-nw-2', 2, 3.3, 6.9),

  // SW: the park
  cypress('cypress-sw-1', 3, 5.9, 1.35),
  cypress('cypress-sw-2', 3, 7.15, 1.35),
  cypress('cypress-sw-3', 3, 1.4, 3.4),
  golden('golden-sw-1', 3, 6.55, 2.8),
  golden('golden-sw-2', 3, 7.0, 4.35),
  golden('golden-sw-3', 3, 3.5, 7.0),
  place('bed-sw-long', 'nature/FlowerBed', 'Flower bed', 'bed', 3, 1.45, 6.6, 0, { w: 0.4, d: 1.3 }, { shape: 'long' }),
  bush('bush-sw-1', 3, 2.9, 6.2),
  bush('bush-sw-2', 3, 1.55, 7.75),
];

/* ---------- satellite islets ---------- */

// angle is measured from +x (east) toward +z (south); y is the islet ground height above the main plateau.
export const ISLETS = [
  { id: 'castle-isle', label: 'Castle isle', angle: 205 * DEG, distance: 17.2, y: 3.2, radius: 3.3, feature: 'landmarks/PinkCastle' },
  { id: 'ferris-isle', label: 'Ferris isle', angle: 38 * DEG, distance: 15.6, y: -0.6, radius: 2.5, feature: 'landmarks/FerrisWheel' },
  { id: 'blossom-isle', label: 'Blossom isle', angle: 150 * DEG, distance: 14.8, y: -1.5, radius: 1.8, feature: 'nature/CherryBlossomTree' },
].map((islet) => ({ ...islet, x: Math.cos(islet.angle) * islet.distance, z: Math.sin(islet.angle) * islet.distance }));

/* ---------- sky ---------- */

export const SUN = { azimuth: 126 * DEG, elevation: 47 * DEG }; // azimuth from +x toward +z
export const CAMERA = { azimuth: 70 * DEG, elevation: 33 * DEG, fov: 30 };

export const ALL_GROUND_ITEMS = [...BUILDINGS, ...LANDMARKS, ...FURNITURE, ...PLANTING];
