import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createRenderer } from '../render/Renderer.js';
import { Pipeline } from '../render/Pipeline.js';
import { Sky } from '../render/Sky.js';
import { Lighting } from '../render/Lighting.js';
import { SHARED } from '../render/shared.js';
import { createContext } from './Context.js';
import { loadAsset } from '../assets/registry.js?v=spokes1';
import { ISLAND, STREETS, BUILDINGS, LANDMARKS, FURNITURE, GARLANDS, PLANTING, ISLETS, CAMERA, VENUES } from '../map/layout.js';
import { LEVELS } from '../kit/paving.js';
import { Batcher, HIDDEN_MASK } from '../render/Batcher.js';
import { CameraRig } from './CameraRig.js?v=centered1';
import { TapPhysics } from './TapPhysics.js';
import { ResolutionGovernor, resolutionRange } from '../render/Resolution.js';
import { Hover } from './Hover.js';
import { Picker } from './Picker.js';
import { VenueSigns } from './Signs.js';
import { Townsfolk } from './Townsfolk.js';

const DEG = Math.PI / 180;

// Yield to the browser between builds (it may draw a frame) without a timer: timers in a background
// tab are throttled to about one a second, which would stretch the build several-fold.
const channel = new MessageChannel();
const waiting = [];
channel.port1.onmessage = () => waiting.shift()?.();
const yieldTask = () =>
  new Promise((resolve) => {
    waiting.push(resolve);
    channel.port2.postMessage(0);
  });

// A stable seed per placed item, so every cherry, bench and lamp differs but rebuilds identically.
function seedOf(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 99991) + 1;
}

// Build options an asset needs from its map entry.
function optionsFor(item) {
  const seed = seedOf(item.id);
  switch (item.asset) {
    case 'nature/CherryBlossomTree':
    case 'nature/GoldenTree':
      return { seed, canopy: item.canopy };
    case 'nature/Topiary':
      return { seed, shape: item.shape };
    case 'nature/FlowerBed':
      return item.shape === 'round' ? { seed, shape: 'round', radius: item.footprint.r - 0.03 } : { seed, shape: 'long', width: item.footprint.w, length: item.footprint.d };
    case 'street/SignEasel':
      return { seed, motif: item.motif };
    default:
      return { seed };
  }
}

// Static parts never move once placed: freeze their matrices so the frame loop skips them. Anything
// an asset animates (it has an update hook, or physics re-poses it) keeps auto-updating.
function freeze(object) {
  object.updateWorldMatrix(true, true);
  object.traverse((o) => {
    o.matrixAutoUpdate = false;
  });
  object.matrixWorldAutoUpdate = false; // the per-frame matrix pass stops at this root
}

// Full-island scene, assembled from the map one asset at a time (the page stays live while it builds).
export class World {
  constructor(stage) {
    this.stage = stage;
    this.params = new URLSearchParams(location.search);
    this.renderer = createRenderer(stage);
    // Render resolution: `?dpr=` pins it; otherwise it starts at the device's ceiling and the governor
    // trades it for frame rate once the town is up.
    const range = resolutionRange();
    const pinned = Number(this.params.get('dpr'));
    this.renderer.setPixelRatio(pinned > 0 ? pinned : range.max);
    this.governor = pinned > 0 ? null : new ResolutionGovernor({ ...range, apply: (ratio) => this.setPixelRatio(ratio) });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, stage.clientWidth / stage.clientHeight, 0.3, 900);
    this.ctx = createContext(this.renderer);
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.lighting = new Lighting(this.scene);
    this.pipeline = new Pipeline(this.renderer, this.scene, this.camera);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 95;
    this.controls.maxPolarAngle = 86 * DEG;
    this.controls.target.set(0, 0.4, 0);
    this.rig = new CameraRig(this.camera, this.controls, { azimuth: CAMERA.azimuth, elevation: CAMERA.elevation, distance: 50 });
    this.taps = new TapPhysics(this.camera, this.renderer.domElement);
    // Always a fair day: the town stays in the light it was designed in (Lighting, Sky and the shared
    // sky colours, under the map's sun), in a gentle gusting breeze (the physics WindField, which
    // sways the trees and flags through SHARED.wind as well as pushing the petals and bunting).
    this.timer = new THREE.Timer();
    this.animated = [];
    // ms: time spent building assets; wallMs: the whole assembly, including yields and the frames
    // shown while the town goes up; frameMs: those frames alone.
    this.progress = { placed: 0, total: 0, ms: 0, wallMs: 0, frameMs: 0 };
    window.addEventListener('resize', () => this.resize());
    this.resize();
    if (false) {
      window.__world = this;
      import('../dev/snapshot.js').then((dev) => {
        this.snapshot = (name, options) => dev.snapshot(this, name, options);
        this.shaderFailures = () => dev.shaderFailures(this.renderer);
        this.frame = (target, az, el, distance) => dev.frame(this, target, az, el, distance);
      });
    }
    this.renderer.setAnimationLoop((t) => this.tick(t));
    this.ready = false;
    this.building = this.assemble().catch((error) => {
      console.error(error);
      this.error = error;
    });
  }

  // Build one asset and add it to `parent` at a map placement; yields a frame first so the page
  // keeps drawing while the town goes up.
  async place(path, options, { x = 0, y = 0, z = 0, ry = 0, scale = 1, parent = this.scene, name } = {}) {
    await yieldTask();
    const t0 = performance.now();
    const build = await loadAsset(path);
    const object = build(this.ctx, options);
    object.position.set(x, y, z);
    object.rotation.y = ry;
    object.scale.multiplyScalar(scale);
    object.userData.asset = path;
    if (name) object.name = name;
    parent.add(object);
    object.updateWorldMatrix(true, true);
    object.userData.box = new THREE.Box3().setFromObject(object);
    if (object.userData.update) this.animated.push(object);
    else freeze(object);
    this.progress.placed++;
    this.progress.ms += performance.now() - t0;
    return object;
  }

  async assemble() {
    const T0 = performance.now();
    const groundY = (item) => (item.onPaving ? LEVELS.paving : LEVELS.lawn);
    const plan = [];
    const job = (path, options, where) => plan.push({ path, options, where });

    // Terrain: the cream island, its plaza and four streets, then the lawn round them all.
    job('terrain/CloudCreamIsland', { seed: 11 }, { name: 'island' });
    job('terrain/PlazaPaving', { seed: 31 }, { name: 'plaza' });
    for (const street of STREETS) job('terrain/Street', { seed: seedOf(`street-${street.id}`) }, { ry: street.angle, name: `street-${street.id}` });
    job('terrain/Lawn', { seed: 21 }, { name: 'lawn' });

    // Everything standing on the ground, from the map.
    for (const item of [...BUILDINGS, ...LANDMARKS, ...FURNITURE, ...PLANTING]) {
      job(item.asset, optionsFor(item), { x: item.x, y: groundY(item), z: item.z, ry: item.ry, name: item.id });
    }
    // Bunting strung between each street's facing pair of lamps (world coordinates, at the lamps' eyes).
    for (const g of GARLANDS) job(g.asset, { seed: seedOf(g.id), a: g.a, b: g.b, height: g.height + LEVELS.paving }, { name: g.id });

    this.progress.total = plan.length + ISLETS.length * 3 + 9 + 1;
    // Fetch every module first, while the page is idle, so nothing is fetched mid-build.
    const paths = new Set([...plan.map((j) => j.path), ...ISLETS.map((i) => i.feature), 'terrain/CloudCreamIsland', 'terrain/Lawn', 'nature/Cloud', 'nature/DriftingPetals']);
    await Promise.all([...paths].map((path) => loadAsset(path)));
    for (const { path, options, where } of plan) await this.place(path, options, where);

    await this.assembleIslets();
    await this.assembleSky();

    // Petals shed from every cherry crown (on the island and its blossom islet) on the wind.
    const emitters = [];
    this.scene.traverse((o) => {
      if (o.userData.asset !== 'nature/CherryBlossomTree') return;
      const box = new THREE.Box3().setFromObject(o.getObjectByName('crown'));
      const c = box.getCenter(new THREE.Vector3());
      emitters.push({ c: [c.x, c.y + (box.max.y - c.y) * 0.3, c.z], r: Math.min(box.max.x - c.x, box.max.z - c.z) * 0.85 });
    });
    await this.place('nature/DriftingPetals', { seed: 91, emitters, count: 900, rate: 60 }, { name: 'petals' });

    this.progress.wallMs = performance.now() - T0;
    this.unbatched = this.measure();
    if (this.params?.get('batch') !== '0') {
      this.batch();
      this.scene.matrixWorldAutoUpdate = false;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.stats = this.measure();
    this.makeTappable();
    this.makeVenues();
    // Townspeople strolling the streets: drawn as a crowd, never batched (they move every frame).
    this.townsfolk = new Townsfolk(this.ctx, { seed: 77 });
    this.scene.add(this.townsfolk.group);
    this.ready = true;
    this.rig.intro();
  }

  // Satellite islets: a miniature of the cream island under a lawn, carrying its feature.
  async assembleIslets() {
    for (const islet of ISLETS) {
      const g = new THREE.Group();
      g.name = islet.id;
      g.position.set(islet.x, islet.y, islet.z);
      this.scene.add(g);
      g.updateWorldMatrix(true, false);
      const k = islet.radius / ISLAND.bodyRadius;
      // A miniature of the main island, sharing its geometry (turned so its drips differ).
      const base = this.scene.getObjectByName('island').clone(true);
      base.name = `${islet.id}-base`;
      base.userData = { asset: 'terrain/CloudCreamIsland' };
      base.scale.setScalar(k);
      base.rotation.y = seedOf(islet.id) % 360;
      g.add(base);
      freeze(base);
      this.progress.placed++;
      const ground = ISLAND.groundRadius * k;
      const feature = await loadAsset(islet.feature);
      const probe = feature(this.ctx, { seed: seedOf(`${islet.id}-feature`) });
      const f = probe.userData.footprint ?? { r: 0.5 };
      // Turf right up to the feature (a tree stands in the grass; a castle or wheel on its own base).
      const keep = islet.feature.startsWith('nature/') ? [] : [{ shape: 'circle', x: 0, z: 0, r: (f.r ?? 1) + 0.05 }];
      await this.place('terrain/Lawn', { seed: seedOf(`${islet.id}-lawn`), radius: ground, zones: keep, density: 1100 }, { parent: g, name: `${islet.id}-lawn` });
      // Turn each feature to face the main island.
      probe.rotation.y = Math.atan2(-islet.x, -islet.z);
      probe.name = `${islet.id}-feature`;
      probe.userData.asset = islet.feature;
      g.add(probe);
      probe.updateWorldMatrix(true, true);
      probe.userData.box = new THREE.Box3().setFromObject(probe); // so the feature can be tapped
      if (probe.userData.update) this.animated.push(probe);
      else freeze(probe);
      this.progress.placed++;
    }
  }

  // Fair-weather clouds drifting slowly round the island, clear of the islets.
  async assembleSky() {
    this.cloudRing = new THREE.Group();
    this.cloudRing.name = 'cloudRing';
    this.scene.add(this.cloudRing);
    const clouds = [
      [20, 4.5, 22, 4.2], [65, 2.2, 27, 5.0], [110, 6.0, 31, 3.6], [150, -2.6, 24, 4.6], [195, 7.2, 34, 5.4],
      [240, 1.5, 25, 3.8], [285, 5.2, 29, 4.8], [330, -1.8, 23, 4.0], [355, 8.5, 36, 3.4],
    ];
    for (const [i, [az, y, r, length]] of clouds.entries()) {
      const a = az * DEG;
      const cloud = await this.place('nature/Cloud', { seed: 401 + i * 13, length }, { x: Math.cos(a) * r, y, z: Math.sin(a) * r, ry: -a + Math.PI / 2, parent: this.cloudRing, name: `cloud-${i}` });
      cloud.userData.baseY = y;
    }
  }

  // Batch every placed asset's parts by material (see Batcher); animated assets' parts are synced.
  batch() {
    const t0 = performance.now();
    this.batcher = new Batcher(this.scene, this.renderer);
    const animated = new Set(this.animated);
    for (const object of [...this.scene.children]) {
      if (object.userData.asset) this.batcher.collect(object, { dynamic: animated.has(object) });
      else if (object.isGroup) for (const child of object.children) if (child.userData.asset) this.batcher.collect(child, { dynamic: animated.has(child) || object === this.cloudRing });
    }
    this.batchStats = { ...this.batcher.build(), ms: Math.round(performance.now() - t0) };
    this.flatten(animated);
  }

  // A static asset's batched parts are drawn by their batches; what is left to walk each frame is only
  // what still draws itself (instanced micro-parts, one-off parts). Those move into one flat group per
  // asset at their world transforms, and the rest of the asset's hierarchy leaves the scene.
  flatten(animated) {
    const roots = [];
    for (const object of this.scene.children) {
      if (object.userData.asset) roots.push([object, this.scene]);
      else if (object.isGroup && object !== this.cloudRing) for (const child of object.children) if (child.userData.asset) roots.push([child, object]);
    }
    let dropped = 0;
    for (const [root, parent] of roots) {
      if (animated.has(root)) continue;
      root.updateWorldMatrix(true, true);
      const keep = [];
      root.traverse((o) => {
        if ((o.isMesh || o.isLight || o.isPoints || o.isLine) && o.layers.mask !== HIDDEN_MASK) keep.push(o);
        else dropped++;
      });
      const flat = new THREE.Group();
      flat.name = root.name;
      flat.userData = { ...root.userData, batchRoot: root };
      parent.add(flat);
      flat.updateWorldMatrix(true, false);
      const toFlat = flat.matrixWorld.clone().invert();
      for (const o of keep) {
        o.matrix.multiplyMatrices(toFlat, o.matrixWorld);
        o.matrix.decompose(o.position, o.quaternion, o.scale);
        o.children.length = 0;
        o.parent = null;
        flat.add(o);
      }
      parent.remove(root);
      flat.updateMatrixWorld(true);
      flat.traverse((o) => {
        o.matrixAutoUpdate = false;
      });
      flat.matrixWorldAutoUpdate = false;
    }
    this.flattened = { roots: roots.length, dropped };
  }

  // Everything standing on the island (not the ground itself, the sky or the bunting) can be tapped.
  makeTappable() {
    const skip = /^(terrain|nature\/(Cloud|DriftingPetals)|street\/Bunting)/;
    const petals = this.scene.getObjectByName('petals')?.userData.drift;
    const visit = (object) => {
      const asset = object.userData.asset;
      if (!asset || skip.test(asset) || !object.userData.box) return;
      // A flattened asset's base is where its original root stood (the flat group sits at its parent's origin).
      const base = new THREE.Vector3().setFromMatrixPosition((object.userData.batchRoot ?? object).matrixWorld);
      const dynamic = this.animated.includes(object);
      const scale0 = object.scale.clone();
      const parentInverse = object.parent.matrixWorld.clone().invert();
      const world0 = object.matrixWorld.clone();
      const apply = (m) => {
        if (dynamic) {
          // An animated asset keeps its own hierarchy: squash it by its root's scale about its base.
          if (!m) object.scale.copy(scale0);
          else object.scale.set(scale0.x * m.elements[0], scale0.y * m.elements[5], scale0.z * m.elements[10]);
          return;
        }
        this.batcher?.transform(object.userData.batchRoot ?? object, m);
        // The flat group's own world matrix is frozen (matrixWorldAutoUpdate off), so it is written here
        // directly and its children (still auto-updating their world matrices) follow it.
        object.matrix.multiplyMatrices(parentInverse, m ? new THREE.Matrix4().multiplyMatrices(m, world0) : world0);
        object.matrixWorld.multiplyMatrices(object.parent.matrixWorld, object.matrix);
        for (const child of object.children) child.updateMatrixWorld(true);
      };
      const onTap = asset === 'nature/CherryBlossomTree' && petals ? () => petals.burst(base.x, base.z, 45, this.ctx.physics) : null;
      this.taps.add({ name: object.name, box: object.userData.box, base, apply, onTap });
    };
    for (const object of this.scene.children) {
      if (object.userData.asset) visit(object);
      else if (object.isGroup) for (const child of object.children) visit(child);
    }
  }

  // The venues glow under the pointer (see Hover), their names in the air above them (see Signs). The
  // pointer is picked exactly (see Picker) against the venues and every other building, landmark and
  // islet feature, any of which can stand in front of one. A flattened asset's parts are its batched
  // originals (kept, hidden, under its batch root) plus those still drawing themselves in its flat group.
  makeVenues() {
    const objects = new Map();
    const visit = (object) => {
      if (object.userData.asset && object.userData.box) objects.set(object.name, object);
    };
    for (const object of this.scene.children) {
      visit(object);
      if (object.isGroup && !object.userData.asset) object.children.forEach(visit);
    }
    const tall = [...VENUES, ...BUILDINGS, ...LANDMARKS].map((item) => item.id).concat(ISLETS.map((islet) => `${islet.id}-feature`));
    const animated = new Set(this.animated);
    const items = [...new Set(tall)].filter((id) => objects.has(id)).map((id) => {
      const object = objects.get(id);
      const roots = object.userData.batchRoot ? [object.userData.batchRoot, object] : [object];
      return { id, box: object.userData.box, roots, moving: animated.has(object) };
    });
    // Each venue's box, and its base: the middle of its lot, where its original root stood.
    const venues = VENUES.filter((v) => objects.has(v.id)).map((v) => {
      const object = objects.get(v.id);
      const base = new THREE.Vector3().setFromMatrixPosition((object.userData.batchRoot ?? object).matrixWorld);
      return { ...v, box: object.userData.box, base };
    });
    const picker = new Picker(items);
    this.hover = new Hover(this.camera, this.renderer.domElement, { venues, picker, outline: 1 });
    this.signs = new VenueSigns(this.stage, this.camera, { venues: this.hover.venues, picker });
  }

  measure() {
    let meshes = 0;
    let triangles = 0;
    let instances = 0;
    this.scene.traverse((o) => {
      if (!o.isMesh || o.layers.mask === HIDDEN_MASK) return; // batched source parts are counted in their batch
      meshes++;
      const g = o.geometry;
      const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
      const count = o.isInstancedMesh ? o.count : 1;
      instances += o.isInstancedMesh ? o.count : 0;
      triangles += tris * count;
    });
    return { meshes, instances, triangles: Math.round(triangles), buildMs: Math.round(this.progress.ms) };
  }

  setPixelRatio(ratio) {
    this.renderer.setPixelRatio(ratio);
    this.resize();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.stage;
    this.camera.aspect = w / h;
    // The map's lens is set for landscape screens. On a portrait one, the vertical angle opens until
    // the horizontal angle matches a square screen's, so the island still fits across a phone.
    const half = Math.tan(((CAMERA.fov / 2) * Math.PI) / 180);
    this.camera.fov = (2 * Math.atan(half / Math.min(this.camera.aspect, 1)) * 180) / Math.PI;
    this.camera.fov = Math.min(this.camera.fov, 62);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.pipeline.setSize(w, h);
  }

  tick(time) {
    // While the town goes up, show it twice a second rather than slowing every build with a frame.
    const building = !this.ready;
    if (building) {
      if (time - (this.lastBuildFrame ?? -1e9) < 500) return;
      this.lastBuildFrame = time;
    }
    const frameStart = performance.now();
    // The governor learns nothing from the fly-in: the view (and so the frame's cost) changes under it.
    if (this.ready && this.governor && !this.rig.flying) {
      if (this.lastFrame !== undefined) this.governor.update(time - this.lastFrame);
      this.lastFrame = time;
    }
    this.timer.update(time);
    // Never backwards (a frame stamped before the last, as after the dev tools' synthetic frames, would
    // make every eased value overshoot and run away), never more than a twentieth of a second.
    const dt = THREE.MathUtils.clamp(this.timer.getDelta(), 0, 0.05);
    SHARED.time.value += dt;
    this.ctx.physics.update(dt);
    for (const object of this.animated) object.userData.update(dt, SHARED.time.value);
    if (this.cloudRing) this.cloudRing.rotation.y += dt * 0.006;
    this.rig.update(dt);
    this.taps.update(dt);
    this.hover?.update(dt);
    this.townsfolk?.update(dt);
    this.controls.update(dt); // with dt, the idle auto-orbit keeps its speed at any frame rate
    this.sky.update(this.camera);
    if (this.batcher) {
      this.scene.updateMatrixWorld(); // the renderer's own per-render pass is off (see assemble)
      this.batcher.update(this.camera, this.renderer.domElement.height);
      // Shadows are re-cast every third frame: moving shadows lag a frame or two, the frame budget halves.
      // Only ever raised here (the renderer lowers it once cast), so a request made elsewhere, like the
      // first cast once the town is batched, is never dropped.
      this.shadowFrame = ((this.shadowFrame ?? 0) + 1) % 3;
      if (this.shadowFrame === 0) this.renderer.shadowMap.needsUpdate = true;
    }
    this.pipeline.setFocus(this.camera.position.distanceTo(this.controls.target));
    this.signs?.update(dt, this.hover); // after everything that moves the camera this frame
    this.pipeline.render(dt);
    if (building) this.progress.frameMs += performance.now() - frameStart;
  }
}
