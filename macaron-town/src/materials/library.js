import * as THREE from 'three';
import { createCelMaterial, windDepthMaterial } from './CelMaterial.js';

const METALS = {
  iron: { color: '#59617A', spec: '#F4F1FF', tex: 'metalHammered', reflect: 0.45, rim: '#B9C7F0', bump: 0.0012 },
  gold: { color: '#E2B65C', spec: '#FFF1C8', tex: 'metalBrushed', reflect: 0.9, rim: '#FFE7B0', bump: 0.0004, aniso: true },
  brass: { color: '#C9A15B', spec: '#FFF0CC', tex: 'metalBrushed', reflect: 0.75, rim: '#FFE3AE', bump: 0.0004, aniso: true },
  chrome: { color: '#C9CFDA', spec: '#FFFFFF', tex: 'metalBrushed', reflect: 1.0, rim: '#FFFFFF', bump: 0.0003, aniso: true },
  copper: { color: '#D08A6A', spec: '#FFE0CC', tex: 'metalBrushed', reflect: 0.8, rim: '#FFD2BC', bump: 0.0004, aniso: true },
  zinc: { color: '#9AA6BC', spec: '#F6F8FF', tex: 'metalHammered', reflect: 0.55, rim: '#E3EBFF', bump: 0.0008 },
};

// Named surface families. Each preset is a deliberate lighting response, so metal, glass, wood,
// plastic, asphalt, petals and plaster read as different materials even in a flat cel palette.
export class MaterialLibrary {
  constructor(bakery) {
    this.bakery = bakery;
    this.cache = new Map();
  }

  cached(key, make) {
    let material = this.cache.get(key);
    if (!material) {
      material = make();
      this.cache.set(key, material);
    }
    return material;
  }

  tex(name) {
    return this.bakery.get(name);
  }

  plaster(color) {
    return this.cached(`plaster|${color}`, () =>
      createCelMaterial({
        name: 'plaster',
        color,
        detail: { texture: this.tex('plaster'), scale: 0.8, albedo: 0.3, bump: 0.0016 },
        bands: { softness: 0.03, core: 0.76 },
        rim: { strength: 0.14 },
      })
    );
  }

  // Painted mouldings and trims: smoother finish with a soft satin highlight.
  trim(color) {
    return this.cached(`trim|${color}`, () =>
      createCelMaterial({
        name: 'trim',
        color,
        detail: { texture: this.tex('plaster'), scale: 2.2, albedo: 0.12, bump: 0.0005 },
        spec: { shininess: 55, strength: 0.18, threshold: 0.55, softness: 0.05 },
        rim: { strength: 0.2 },
      })
    );
  }

  stone(color) {
    return this.cached(`stone|${color}`, () =>
      createCelMaterial({
        name: 'stone',
        color,
        detail: { texture: this.tex('stone'), scale: 1.4, albedo: 0.42, bump: 0.0022 },
        spec: { shininess: 18, strength: 0.05, threshold: 0.55 },
        rim: { strength: 0.12 },
      })
    );
  }

  // Paving setts: matte worn limestone, tinted per instance. Shadowed arrises stay light and warm
  // and the stones are soft-inked, so a field of thousands reads as texture, not a dark grid.
  sett() {
    return this.cached('sett', () =>
      createCelMaterial({
        name: 'sett', outline: 'soft',
        color: '#FFFFFF',
        detail: { texture: this.tex('stone'), scale: 3.2, albedo: 0.5, bump: 0.0008 },
        bands: { terminator: 0.4, softness: 0.04, core: 0.8, highlight: 0.86 },
        shadowTint: '#E4D8DF',
        rim: { strength: 0.08 },
      })
    );
  }

  // Dressed granite (kerbs, copings, steps): denser grain, crisp arrises, inked.
  granite(color) {
    return this.cached(`granite|${color}`, () =>
      createCelMaterial({
        name: 'granite',
        color,
        detail: { texture: this.tex('stone'), scale: 2.4, albedo: 0.55, bump: 0.0008 },
        tint2: { color: '#FFFFFF', amount: 0.25 },
        bands: { terminator: 0.44, softness: 0.035, core: 0.78, highlight: 0.88 },
        shadowTint: '#D9CFDD',
        spec: { shininess: 20, strength: 0.05, threshold: 0.66, softness: 0.06 },
        rim: { strength: 0.12 },
      })
    );
  }

  // Sand-and-lime bedding seen in paving joints: matte. It shares the setts' ink id: MSAA averages
  // ids across sub-pixel joints, and a distinct id would ink every joint into a dark grid at town scale.
  mortar(color) {
    return this.cached(`mortar|${color}`, () =>
      createCelMaterial({
        name: 'mortar', outline: 'soft', outlineId: this.sett().userData.cel.celOutlineId.value,
        color,
        detail: { texture: this.tex('stone'), scale: 5, albedo: 0.35, bump: 0.0006 },
        rim: { strength: 0.04 },
      })
    );
  }

  cream(color) {
    return this.cached(`cream|${color}`, () =>
      createCelMaterial({
        name: 'cream', outline: 'soft',
        color,
        detail: { texture: this.tex('cream'), scale: 0.32, albedo: 0.14, bump: 0.009 },
        bands: { terminator: 0.42, softness: 0.08, core: 0.84, highlight: 0.74 },
        shadowTint: '#E9D2E4',
        spec: { shininess: 28, strength: 0.32, threshold: 0.6, softness: 0.08, color: '#FFFDF8' },
        rim: { color: '#FFFBF4', strength: 0.32, threshold: 0.55, softness: 0.1 },
        translucency: { color: '#FFE3D2', strength: 0.32 },
      })
    );
  }

  // Fruit glaze / syrup: wet, glossy, light passes through it.
  glaze(color) {
    return this.cached(`glaze|${color}`, () =>
      createCelMaterial({
        name: 'glaze',
        color,
        detail: { texture: this.tex('ceramic'), scale: 1.1, albedo: 0.05, bump: 0.0015 },
        bands: { terminator: 0.42, softness: 0.05, core: 0.8, highlight: 0.74 },
        shadowTint: '#E7C2D4',
        spec: { shininess: 170, strength: 1.6, threshold: 0.45, softness: 0.01, color: '#FFFFFF' },
        reflect: { strength: 0.35, f0: 0.05 },
        rim: { color: '#FFE6EE', strength: 0.32, threshold: 0.6, softness: 0.05 },
        translucency: { color: '#FF9FB8', strength: 0.5 },
      })
    );
  }

  sugarShell(color) {
    return this.cached(`sugar|${color}`, () =>
      createCelMaterial({
        name: 'sugarShell', outline: 'soft',
        color,
        detail: { texture: this.tex('sugarShell'), scale: 2.0, albedo: 0.22, bump: 0.0018 },
        bands: { softness: 0.04, core: 0.8 },
        spec: { shininess: 24, strength: 0.14, threshold: 0.6, softness: 0.08 },
        rim: { strength: 0.22 },
        translucency: { color, strength: 0.12 },
      })
    );
  }

  // Standing-seam sheet roofing (tinted zinc): cool satin metal with a soft brushed sheen.
  sheetMetal(color) {
    return this.cached(`sheet|${color}`, () =>
      createCelMaterial({
        name: 'sheetMetal',
        color,
        detail: { texture: this.tex('metalBrushed'), scale: 2.2, albedo: 0.1, bump: 0.0003 },
        bands: { terminator: 0.48, softness: 0.02, core: 0.68, highlight: 0.82 },
        shadowTint: '#B4ADD2',
        spec: { shininess: 70, strength: 0.55, threshold: 0.5, softness: 0.02, color: '#FFFFFF' },
        rim: { color: '#F4F0FF', strength: 0.3, threshold: 0.6, softness: 0.04 },
        reflect: { strength: 0.38, f0: 0.4, metal: 1 },
        aniso: true,
      })
    );
  }

  // Macaron shell: smooth meringue with a soft satin sheen (no crackle), lit through a little.
  macaronShell(color) {
    return this.cached(`macaronShell|${color}`, () =>
      createCelMaterial({
        name: 'macaronShell', outline: 'soft',
        color,
        detail: { texture: this.tex('sugarShell'), scale: 1.2, albedo: 0.06, bump: 0.0004 },
        bands: { terminator: 0.42, softness: 0.05, core: 0.82, highlight: 0.76 },
        shadowTint: '#E6CFE0',
        spec: { shininess: 36, strength: 0.22, threshold: 0.62, softness: 0.08, color: '#FFFDF8' },
        rim: { color: '#FFFFFF', strength: 0.28, threshold: 0.56, softness: 0.1 },
        translucency: { color, strength: 0.18 },
      })
    );
  }

  metal(kind = 'iron') {
    const m = METALS[kind];
    return this.cached(`metal|${kind}`, () =>
      createCelMaterial({
        name: `metal-${kind}`,
        color: m.color,
        detail: { texture: this.tex(m.tex), scale: 3, albedo: 0.18, bump: m.bump },
        bands: { terminator: 0.5, softness: 0.012, core: 0.58, highlight: 0.84 },
        shadowTint: '#A8A6CF',
        spec: { shininess: 90, strength: 1.1, threshold: 0.45, softness: 0.015, color: m.spec },
        rim: { color: m.rim, strength: 0.4, threshold: 0.58, softness: 0.03 },
        reflect: { strength: m.reflect, f0: 0.6, metal: 1 },
        aniso: Boolean(m.aniso),
      })
    );
  }

  // Window glass with an interior-mapped room behind it. Always a fresh material: each pane gets its own room.
  glass(room) {
    return createCelMaterial({
      name: 'glass',
      color: '#1A2030',
      glass: room,
      spec: { shininess: 220, strength: 1.4, threshold: 0.5, softness: 0.01 },
      rim: { strength: 0 },
    });
  }

  // Clear glass (jars, cloches, canopies): see-through and tinted, with fresnel edges and
  // highlight streaks (streak 0 for flat panes). Give its meshes cast: false.
  clearGlass(tint = '#E8F6F6', { opacity = 0.16, edge = 0.75, streak = 0.85 } = {}) {
    return this.cached(`clearGlass|${tint}|${opacity}|${edge}|${streak}`, () =>
      createCelMaterial({
        name: 'clearGlass', outline: 'none',
        color: tint,
        clear: { opacity, edge, streak },
        bands: { terminator: 0.45, softness: 0.03, core: 0.9, highlight: 0.8 },
        spec: { shininess: 200, strength: 1.6, threshold: 0.5, softness: 0.01 },
        reflect: { strength: 0.5, f0: 0.04 },
        rim: { color: '#FFFFFF', strength: 0.35, threshold: 0.6, softness: 0.05 },
      })
    );
  }

  lanternGlass(color = '#FFE3B0', glow = 1.6) {
    return this.cached(`lantern|${color}|${glow}`, () =>
      createCelMaterial({
        name: 'lanternGlass',
        color,
        emissive: color,
        emissiveIntensity: glow,
        spec: { shininess: 160, strength: 1.2, threshold: 0.5, softness: 0.01 },
        reflect: { strength: 0.35, f0: 0.04 },
        rim: { strength: 0.3, color: '#FFFFFF' },
      })
    );
  }

  bulb(color = '#FFE9B8', glow = 3.2) {
    return this.cached(`bulb|${color}|${glow}`, () =>
      createCelMaterial({ name: 'bulb', color, emissive: color, emissiveIntensity: glow, rim: { strength: 0 } })
    );
  }

  wood(color) {
    return this.cached(`wood|${color}`, () =>
      createCelMaterial({
        name: 'wood',
        color,
        detail: { texture: this.tex('wood'), scale: 1.6, albedo: 0.5, bump: 0.0009 },
        spec: { shininess: 22, strength: 0.14, threshold: 0.6, softness: 0.06, color: '#FFF3E4' },
        rim: { strength: 0.12 },
      })
    );
  }

  paintedWood(color) {
    return this.cached(`painted|${color}`, () =>
      createCelMaterial({
        name: 'paintedWood',
        color,
        detail: { texture: this.tex('paintedWood'), scale: 1.8, albedo: 0.32, bump: 0.0007 },
        spec: { shininess: 60, strength: 0.3, threshold: 0.55, softness: 0.04 },
        rim: { strength: 0.18 },
      })
    );
  }

  plastic(color) {
    return this.cached(`plastic|${color}`, () =>
      createCelMaterial({
        name: 'plastic',
        color,
        detail: { texture: this.tex('plastic'), scale: 3, albedo: 0.08, bump: 0.0002 },
        bands: { softness: 0.006, core: 0.72 },
        spec: { shininess: 140, strength: 1.25, threshold: 0.5, softness: 0.006 },
        rim: { strength: 0.3, threshold: 0.66, softness: 0.02 },
        reflect: { strength: 0.25, f0: 0.05 },
      })
    );
  }

  // Boiled sweets, lollipops and foil wrappers: glassy sugar with a hard highlight. Light passes
  // through and the shade stays light, so candy under a canopy still glows instead of going muddy.
  // Per-instance colours multiply it, so the default base is white.
  candy(color = '#FFFFFF') {
    return this.cached(`candy|${color}`, () =>
      createCelMaterial({
        name: 'candy',
        color,
        detail: { texture: this.tex('ceramic'), scale: 2.5, albedo: 0.04, bump: 0.0002 },
        bands: { terminator: 0.42, softness: 0.03, core: 0.84, highlight: 0.74 },
        shadowTint: '#EBDDF0',
        spec: { shininess: 160, strength: 1.5, threshold: 0.48, softness: 0.008, color: '#FFFFFF' },
        reflect: { strength: 0.3, f0: 0.05 },
        rim: { color: '#FFFFFF', strength: 0.3, threshold: 0.6, softness: 0.04 },
        translucency: { color: '#FFFFFF', strength: 0.6 },
      })
    );
  }

  ceramic(color) {
    return this.cached(`ceramic|${color}`, () =>
      createCelMaterial({
        name: 'ceramic',
        color,
        detail: { texture: this.tex('ceramic'), scale: 2.5, albedo: 0.18, bump: 0.0003 },
        spec: { shininess: 180, strength: 1.2, threshold: 0.5, softness: 0.008 },
        reflect: { strength: 0.4, f0: 0.05 },
        rim: { strength: 0.22 },
      })
    );
  }

  asphalt(color, aggregate) {
    return this.cached(`asphalt|${color}`, () =>
      createCelMaterial({
        name: 'asphalt',
        color,
        // Fine aggregate and only a whisper of relief: strong bump would quantise into inked pebbles.
        detail: { texture: this.tex('asphalt'), scale: 2.2, albedo: 0.3, bump: 0.0004 },
        tint2: { color: aggregate, amount: 0.12 },
        bands: { softness: 0.04, core: 0.8 },
        shadowTint: '#BDB5DA',
        rim: { strength: 0.05 },
      })
    );
  }

  // Thermoplastic road paint: matte with a faint bead sheen; the asphalt grain shows through.
  // Unlined: flat paint reads by colour, and inked dashes turn into outlined pills at town scale.
  roadPaint(color = '#F6F2E9') {
    return this.cached(`roadPaint|${color}`, () =>
      createCelMaterial({
        name: 'roadPaint', outline: 'none',
        color,
        detail: { texture: this.tex('asphalt'), scale: 1.0, albedo: 0.22, bump: 0.0018 },
        bands: { softness: 0.04, core: 0.84 },
        spec: { shininess: 30, strength: 0.08, threshold: 0.62, softness: 0.06 },
        rim: { strength: 0.06 },
      })
    );
  }

  slate(color) {
    return this.cached(`slate|${color}`, () =>
      createCelMaterial({
        name: 'slate',
        color,
        detail: { texture: this.tex('slate'), scale: 1, albedo: 0.32, bump: 0.0012, mode: 'uv' },
        spec: { shininess: 45, strength: 0.16, threshold: 0.6, softness: 0.04, color: '#EEF2FF' },
        rim: { strength: 0.16 },
      })
    );
  }

  terracotta(color) {
    return this.cached(`terracotta|${color}`, () =>
      createCelMaterial({
        name: 'terracotta',
        color,
        detail: { texture: this.tex('terracotta'), scale: 2.6, albedo: 0.34, bump: 0.0009 },
        spec: { shininess: 20, strength: 0.08, threshold: 0.6 },
        rim: { strength: 0.14 },
      })
    );
  }

  fabric(color) {
    return this.cached(`fabric|${color}`, () =>
      createCelMaterial({
        name: 'fabric',
        color,
        side: THREE.DoubleSide,
        detail: { texture: this.tex('fabric'), scale: 3.2, albedo: 0.22, bump: 0.0004 },
        bands: { softness: 0.04, core: 0.8 },
        rim: { color: '#FFFFFF', strength: 0.34, threshold: 0.55, softness: 0.12 },
        translucency: { color, strength: 0.28 },
      })
    );
  }

  // Pennants and bunting flags: fabric that ripples in the wind from its hoist (local y = 0) out to
  // its fly (local y = length): build the flag along +y and turn the mesh to hang it.
  flag(color, length = 0.2) {
    return this.cached(`flag|${color}|${length}`, () =>
      createCelMaterial({
        name: 'flag',
        color,
        side: THREE.DoubleSide,
        detail: { texture: this.tex('fabric'), scale: 3.2, albedo: 0.22, bump: 0.0004 },
        bands: { softness: 0.04, core: 0.8 },
        rim: { color: '#FFFFFF', strength: 0.34, threshold: 0.55, softness: 0.12 },
        translucency: { color, strength: 0.3 },
        wind: { anchor: 0, range: length, flutter: 0.9, space: 'local' },
      })
    );
  }

  // Foliage and blossom masses (tree crowns, shrubs, clipped topiary): soft-inked lobes that light
  // like a translucent cloud of leaves or petals, swaying with `wind` (use space 'object' with the
  // crown's geometry baked at the plant's origin, so it sways from the plant's own base).
  canopy(color, { wind = null, glow = '#FFE6EE', shadowTint = '#E2C8DA', lumps = 0.006 } = {}) {
    const make = () =>
      createCelMaterial({
        name: 'canopy', outline: 'soft',
        color,
        detail: { texture: this.tex('cloud'), scale: 0.9, albedo: 0.1, bump: lumps },
        bands: { terminator: 0.4, softness: 0.06, core: 0.86, highlight: 0.72 },
        shadowTint,
        rim: { color: '#FFFFFF', strength: 0.28, threshold: 0.56, softness: 0.1 },
        translucency: { color: glow, strength: 0.45 },
        wind,
      });
    return wind ? make() : this.cached(`canopy|${color}|${glow}|${shadowTint}|${lumps}`, make);
  }

  // The skin of a cumulus crown (cherry in bloom, ginkgo in gold): under its frosting of modelled
  // flowers or leaves it is itself a dense baked mass of them (`texture`: blossomMass, ginkgoMass),
  // light organs over `gap`-coloured depths, mapped in world space so it runs on unbroken across
  // the crown's overlapping bumps. Wherever the modelled organs part, more show behind them.
  crownSkin(color, { texture = 'blossomMass', wind = null, gap = '#EBA0B8', glow = '#FFE0EA', shadowTint = '#E6BFD3', scale = 2.6, spec = {} } = {}) {
    return createCelMaterial({
      name: 'crownSkin', outline: 'soft',
      color,
      detail: { texture: this.tex(texture), scale, albedo: 0.35, bump: 0.0, space: 'world' },
      tint2: { color: gap, amount: 0.75 },
      bands: { terminator: 0.4, softness: 0.06, core: 0.86, highlight: 0.72 },
      shadowTint,
      spec,
      rim: { color: '#FFFFFF', strength: 0.28, threshold: 0.56, softness: 0.1 },
      translucency: { color: glow, strength: 0.45 },
      wind,
    });
  }

  // Leaves frosting a cumulus crown (ginkgo fans): per-instance and per-vertex coloured, normal-
  // transferred from the crown and sharing its `outlineId` (see blossom). Veins fan from the stalk.
  // `texture`: 'petal' (veins fanning from the stalk) or 'leaf' (a midrib); `vertexColors` for
  // organs that carry their own gradient; `spec` for glossy leaves (boxwood).
  crownLeaves(wind, { outlineId, shadowTint = '#E9D9C8', glow = '#FFF1B8', texture = 'petal', vertexColors = true, spec = { shininess: 40, strength: 0.1, threshold: 0.62, softness: 0.05 } } = {}) {
    return createCelMaterial({
      name: 'crownLeaves', outline: 'soft', outlineId,
      color: '#FFFFFF',
      side: THREE.DoubleSide,
      vertexColors,
      transfer: true,
      detail: { texture: this.tex(texture, 512), scale: 1, albedo: 0.22, bump: 0.0, mode: 'uv' },
      bands: { terminator: 0.38, softness: 0.07, core: 0.88, highlight: 0.7 },
      shadowTint,
      spec,
      rim: { color: '#FFFBEA', strength: 0.26, threshold: 0.56, softness: 0.1 },
      translucency: { color: glow, strength: 0.6 },
      wind,
    });
  }

  // Blossoms frosting a tree crown and petals strewn on the grass: unlined and AO-transparent like
  // the lawn flowers (inked, a thousand tiny blooms turn into dark speckle), bright and lit through.
  // Coloured per instance (and per vertex with `vertexColors`); sways with `wind` like the crown it
  // sits on. `transfer`: the geometry carries the crown's normal (see CelMaterial), so a frosting of
  // flowers shades as the soft mass it covers. Give it the crown's `outlineId` too: MSAA blends the
  // ids of a flower and the skin under it, and two different ids would ink a ring round every flower.
  blossom(wind = null, { transfer = false, vertexColors = false, outlineId } = {}) {
    const make = () =>
      createCelMaterial({
        name: 'blossom', outline: 'foliage', outlineId,
        color: '#FFFFFF',
        side: THREE.DoubleSide,
        vertexColors,
        transfer,
        detail: { texture: this.tex('petal', 512), scale: 1, albedo: 0.12, bump: 0.0, mode: 'uv' },
        bands: { terminator: 0.36, softness: 0.08, core: 0.9, highlight: 0.7 },
        shadowTint: '#F1DCE6',
        rim: { color: '#FFFFFF', strength: 0.3, threshold: 0.55, softness: 0.12 },
        translucency: { color: '#FFE6EE', strength: 0.7 },
        wind,
      });
    return wind || outlineId !== undefined ? make() : this.cached(`blossom|${transfer}|${vertexColors}`, make);
  }

  petal(base, blush, wind) {
    return createCelMaterial({
      name: 'petal', outline: 'soft',
      color: base,
      side: THREE.DoubleSide,
      detail: { texture: this.tex('petal', 512), scale: 1, albedo: 0.25, bump: 0.0004, mode: 'uv' },
      tint2: { color: blush, amount: 0.85 },
      bands: { terminator: 0.4, softness: 0.06, core: 0.86, highlight: 0.72 },
      shadowTint: '#E8CBE0',
      rim: { color: '#FFF4F8', strength: 0.3, threshold: 0.56, softness: 0.1 },
      translucency: { color: '#FFC9DA', strength: 0.65 },
      wind,
    });
  }

  // Small garden blooms: coloured per instance, so no tip blush; light shines through the petals.
  bloom(wind) {
    const key = wind ? null : 'bloom';
    const make = () =>
      createCelMaterial({
        name: 'bloom', outline: 'soft',
        color: '#FFFFFF',
        side: THREE.DoubleSide,
        detail: { texture: this.tex('petal', 512), scale: 1, albedo: 0.18, bump: 0.0002, mode: 'uv' },
        bands: { terminator: 0.4, softness: 0.06, core: 0.86, highlight: 0.72 },
        shadowTint: '#E8CBE0',
        rim: { color: '#FFFFFF', strength: 0.25, threshold: 0.58, softness: 0.1 },
        translucency: { color: '#FFE2EA', strength: 0.55 },
        wind,
      });
    return key ? this.cached(key, make) : make();
  }

  // Shared per colour and wind, so the town's many strands, stems and garlands batch together.
  leaf(color, wind) {
    return this.cached(`leaf|${color}|${wind ? JSON.stringify(wind) : ''}`, () =>
      createCelMaterial({
        name: 'leaf', outline: 'soft',
        color,
        side: THREE.DoubleSide,
        detail: { texture: this.tex('leaf', 512), scale: 1, albedo: 0.28, bump: 0.0005, mode: 'uv' },
        bands: { terminator: 0.42, softness: 0.05, core: 0.8 },
        shadowTint: '#B9D2D0',
        spec: { shininess: 50, strength: 0.18, threshold: 0.6, softness: 0.04 },
        rim: { color: '#F3FFE6', strength: 0.22, threshold: 0.6, softness: 0.1 },
        translucency: { color: '#E5F7A8', strength: 0.5 },
        wind,
      })
    );
  }

  grass(color, wind, groundShade = { lift: 0.62, root: 0.34, tip: 0.16, rootEnd: 0.75 }) {
    return createCelMaterial({
      name: 'grass', outline: 'foliage', groundInk: true, groundShade,
      color,
      side: THREE.DoubleSide,
      detail: { texture: this.tex('grass', 256), scale: 1, albedo: 0.55, bump: 0.0, mode: 'uv' },
      bands: { terminator: 0.38, softness: 0.06, core: 0.84 },
      shadowTint: '#B5D3C8',
      rim: { color: '#F6FFE9', strength: 0.22, threshold: 0.6, softness: 0.1 },
      translucency: { color: '#EAF7B4', strength: 0.4 },
      wind,
    });
  }

  // Tiny lawn flowers (daisies, clover heads): unlined and AO-transparent like the grass they sit in.
  meadowFlower({ blush = null, vertexColors = false } = {}) {
    return this.cached(`meadow|${blush}|${vertexColors}`, () =>
      createCelMaterial({
        name: 'meadowFlower', outline: 'foliage',
        color: '#FFFFFF',
        side: THREE.DoubleSide,
        vertexColors,
        // No bump: at a centimetre across, vein relief would only alias into speckle.
        detail: { texture: this.tex('petal', 512), scale: 1, albedo: 0.12, bump: 0.0, mode: 'uv' },
        tint2: blush ? { color: blush, amount: 0.85 } : null,
        bands: { terminator: 0.4, softness: 0.06, core: 0.86, highlight: 0.72 },
        shadowTint: '#E8CBE0',
        rim: { color: '#FFFFFF', strength: 0.25, threshold: 0.58, softness: 0.1 },
        translucency: { color: '#FFE2EA', strength: 0.5 },
      })
    );
  }

  // Wisteria racemes: vertex-coloured florets (pale to violet), translucent, swaying from the stalk top.
  wisteria(length = 1) {
    return this.cached(`wisteria|${length}`, () =>
      createCelMaterial({
        name: 'wisteria', outline: 'soft',
        color: '#FFFFFF',
        side: THREE.DoubleSide,
        vertexColors: true,
        detail: { texture: this.tex('petal', 512), scale: 1, albedo: 0.14, bump: 0.0, mode: 'uv' },
        bands: { terminator: 0.4, softness: 0.06, core: 0.86, highlight: 0.72 },
        shadowTint: '#D5C8EC',
        rim: { color: '#FBF6FF', strength: 0.3, threshold: 0.56, softness: 0.1 },
        translucency: { color: '#E6D6FF', strength: 0.6 },
        wind: { anchor: 0, range: -length, flutter: 0.35, space: 'local' },
      })
    );
  }

  // Low lawn herbs (clover): leaf shading, but unlined and AO-transparent like the grass around them.
  clover() {
    return this.cached('clover', () =>
      createCelMaterial({
        name: 'clover', outline: 'foliage', groundInk: true,
        color: '#FFFFFF',
        side: THREE.DoubleSide,
        detail: { texture: this.tex('leaf', 512), scale: 1, albedo: 0.3, bump: 0.0, mode: 'uv' },
        groundShade: { lift: 0.35, root: 0.12, tip: 0.0, rootEnd: 0.5 },
        bands: { terminator: 0.4, softness: 0.06, core: 0.82 },
        shadowTint: '#B5D3C8',
        spec: { shininess: 40, strength: 0.12, threshold: 0.62, softness: 0.05 },
        rim: { color: '#F3FFE6', strength: 0.18, threshold: 0.6, softness: 0.1 },
        translucency: { color: '#E5F7A8', strength: 0.35 },
      })
    );
  }

  lawn(color) {
    return this.cached(`lawn|${color}`, () =>
      createCelMaterial({
        name: 'lawn', outline: 'none', groundInk: true,
        color,
        detail: { texture: this.tex('lawn'), scale: 0.5, albedo: 0.45, bump: 0.0015 },
        shadowTint: '#B5D3C8',
        rim: { strength: 0.08 },
      })
    );
  }

  // Bark. With `wind` (the same shape as its crown's), limbs and twigs sway with the blossoms they carry.
  // `shadowTint` lightens the shade of a trunk standing under its own crown.
  bark(color, wind = null, { shadowTint = '#C9C2E8' } = {}) {
    const make = () =>
      createCelMaterial({
        name: 'bark',
        color,
        detail: { texture: this.tex('bark'), scale: 2.2, albedo: 0.45, bump: 0.0035 },
        tint2: { color: '#9BB58B', amount: 0.35 },
        shadowTint,
        spec: { shininess: 16, strength: 0.06, threshold: 0.6 },
        rim: { strength: 0.12 },
        wind,
      });
    return wind ? make() : this.cached(`bark|${color}|${shadowTint}`, make);
  }

  cloud(color = '#FFFFFF') {
    return this.cached(`cloud|${color}`, () =>
      createCelMaterial({
        name: 'cloud', outline: 'soft',
        color,
        detail: { texture: this.tex('cloud'), scale: 0.18, albedo: 0.08, bump: 0.02 },
        bands: { terminator: 0.4, softness: 0.07, core: 0.86, highlight: 0.72 },
        shadowTint: '#D6DCF7',
        rim: { color: '#FFFFFF', strength: 0.5, threshold: 0.5, softness: 0.12 },
        translucency: { color: '#FFF1F4', strength: 0.3 },
      })
    );
  }

  // `caustics`: cells per unit (finer on a wide pond than in a fountain basin); `foam`: the shore band.
  water(deep, shallow, { caustics = 2.6, foam = 0.14, strength = 1 } = {}) {
    return this.cached(`water|${deep}|${shallow}|${caustics}|${foam}|${strength}`, () =>
      createCelMaterial({
        name: 'water',
        color: shallow,
        water: { deep, shallow, causticScale: caustics, foam, causticStrength: strength },
        spec: { shininess: 200, strength: 1.6, threshold: 0.45, softness: 0.01 },
        rim: { strength: 0 },
      })
    );
  }

  // Overflow curtains and jets: a see-through sheet of moving water whose white streaks and foam
  // scroll along the surface's uv.y (lathe the profile so uv.y runs with the flow). Give its
  // meshes cast: false.
  waterSheet(tint = '#DDF3F7', { columns = 90, speed = 1.6, dashes = 3, foam = 0.12, opacity = 0.3 } = {}) {
    return this.cached(`waterSheet|${tint}|${columns}|${speed}|${dashes}|${foam}|${opacity}`, () =>
      createCelMaterial({
        name: 'waterSheet', outline: 'none',
        color: tint,
        side: THREE.DoubleSide,
        clear: { opacity, edge: 0.75, streak: 0 },
        flow: { columns, speed, dashes, foam },
        bands: { terminator: 0.42, softness: 0.05, core: 0.9, highlight: 0.75 },
        shadowTint: '#E2EEF4',
        spec: { shininess: 120, strength: 1.2, threshold: 0.5, softness: 0.02 },
        reflect: { strength: 0.4, f0: 0.04 },
        rim: { color: '#FFFFFF', strength: 0.3, threshold: 0.6, softness: 0.06 },
      })
    );
  }

  // Churned foam where falling water lands: bright flecks with no depth or ink, so a ring of
  // bubbles reads as froth rather than outlined pebbles.
  foam(tint = '#FFFFFF') {
    return this.cached(`foam|${tint}`, () =>
      createCelMaterial({
        name: 'foam', outline: 'none',
        color: tint,
        clear: { opacity: 0.82, edge: 0.96, streak: 0 },
        bands: { terminator: 0.35, softness: 0.08, core: 0.94, highlight: 0.7 },
        shadowTint: '#EEF4F8',
        rim: { color: '#FFFFFF', strength: 0.4, threshold: 0.5, softness: 0.12 },
        translucency: { color: '#FFFFFF', strength: 0.4 },
      })
    );
  }

  // Ballistic spray droplets: clear, bright beads, unlined so a jet never inks into a dotted line.
  spray(tint = '#F1FAFD') {
    return this.cached(`spray|${tint}`, () =>
      createCelMaterial({
        name: 'spray', outline: 'none',
        color: tint,
        clear: { opacity: 0.6, edge: 0.95, streak: 0 },
        bands: { terminator: 0.4, softness: 0.05, core: 0.92, highlight: 0.7 },
        shadowTint: '#E6F1F6',
        spec: { shininess: 90, strength: 1.4, threshold: 0.45, softness: 0.02 },
        rim: { color: '#FFFFFF', strength: 0.5, threshold: 0.5, softness: 0.1 },
      })
    );
  }

  // Down and feathers (ducks, ducklings): soft-inked, velvety, with a bright soft rim and light
  // passing through the fluff at the edges.
  plumage(color) {
    return this.cached(`plumage|${color}`, () =>
      createCelMaterial({
        name: 'plumage', outline: 'soft',
        color,
        detail: { texture: this.tex('fabric'), scale: 9, albedo: 0.08, bump: 0.0003 },
        bands: { terminator: 0.42, softness: 0.06, core: 0.84, highlight: 0.74 },
        shadowTint: '#D9DCEF',
        spec: { shininess: 20, strength: 0.08, threshold: 0.62, softness: 0.08 },
        rim: { color: '#FFFFFF', strength: 0.42, threshold: 0.52, softness: 0.12 },
        translucency: { color, strength: 0.25 },
      })
    );
  }

  // A ripple ring spreading on water: its own material, so each ring fades as it widens (`fade`).
  ripple(tint = '#FFFFFF') {
    const material = createCelMaterial({
      name: 'ripple', outline: 'none',
      color: tint,
      clear: { opacity: 0.7, edge: 0.7, streak: 0 },
      bands: { terminator: 0.3, softness: 0.1, core: 0.95, highlight: 0.7 },
      shadowTint: '#F2F6F8',
      rim: { strength: 0 },
    });
    material.userData.fade = (k) => {
      material.userData.cel.celClear.value.x = 0.7 * k;
      material.userData.cel.celClear.value.y = 0.7 * k;
    };
    return material;
  }

  chalkboard() {
    return this.cached('chalkboard', () =>
      createCelMaterial({
        name: 'chalkboard',
        color: '#4C6457',
        detail: { texture: this.tex('chalkboard'), scale: 1.5, albedo: 0.15, bump: 0.0002 },
        tint2: { color: '#C9D5CB', amount: 0.45 },
        rim: { strength: 0.06 },
      })
    );
  }

  windShadow(material) {
    return windDepthMaterial(material);
  }
}
