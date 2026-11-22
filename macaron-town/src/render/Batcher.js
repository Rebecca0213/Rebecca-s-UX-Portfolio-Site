import * as THREE from 'three';
import { levelsOf, triangleCount } from './simplify.js';
import { isRoomGlass, roomAttributeGlass, roomAttributes, instancedBatchMaterial, instancedBatchDepthMaterial, INSTANCED_TEXTURE_WIDTH } from '../materials/CelMaterial.js';

const HIDDEN = 31; // a layer no camera renders: the source mesh stays in the graph, its children still draw
export const HIDDEN_MASK = (1 << HIDDEN) >>> 0;
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _im = new THREE.Matrix4();
const _tm = new THREE.Matrix4();
const _c = new THREE.Color();
const _frustum = new THREE.Frustum();
const _box = new THREE.Box3();
const _p = new THREE.Vector3();

// Animated parts are culled against the view frustum widened by this much per unit of distance (about
// 3.5°), so one whose bounds are refreshed only with the levels never clips at the screen's edge. A
// static part's bounds never change, so it is culled against the view itself.
const VIEW_SLACK = 0.06;

// Each batch's draw list. three's own per-part culling would transform every part's bounds and re-upload
// the batch's id texture on every render, shadow pass included; the batcher culls instead (see update),
// from bounds it already holds, and the list is rebuilt only when something in it changed. Parts outside
// the view are left out of the camera's list only: the shadow camera still draws them, since a part off
// screen can cast a shadow into view. `this` is the batch.
function updateDrawParameters(camera, geometry) {
  const view = this.userData.view;
  const kind = view.out > 0 && camera === view.batcher.viewCamera ? 1 : 0;
  if (!this._visibilityChanged && !view.dirty && view.built === kind) return;
  const index = geometry.getIndex();
  const bytes = index === null ? 1 : index.array.BYTES_PER_ELEMENT;
  const instances = this._instanceInfo;
  const geometries = this._geometryInfo;
  const starts = this._multiDrawStarts;
  const counts = this._multiDrawCounts;
  const ids = this._indirectTexture.image.data;
  const inView = kind ? view.inView : null;
  let n = 0;
  for (let i = 0; i < instances.length; i++) {
    const instance = instances[i];
    if (!instance.visible || !instance.active || (inView && !inView[i])) continue;
    const g = geometries[instance.geometryIndex];
    starts[n] = g.start * bytes;
    counts[n] = g.count;
    ids[n] = i;
    n++;
  }
  this._indirectTexture.needsUpdate = true;
  this._multiDrawCount = n;
  this._multiDrawBytesPerElement = bytes;
  this._visibilityChanged = false;
  view.dirty = false;
  view.built = kind;
}

// three draws a BatchedMesh with WEBGL_multi_draw's plain multi-draw. An instanced batch (see
// buildInstanced) draws each of its parts instanced, so it needs the instanced variant and each draw's
// instance count: while one is being drawn its counts wait here, and the extension's plain entry
// points hand them on (every other multi-draw passes straight through).
let pendingInstances = null;
const wrappedExtensions = new WeakSet();
function installInstancedMultiDraw(renderer) {
  if (!renderer.extensions.has('WEBGL_multi_draw')) return false;
  const ext = renderer.extensions.get('WEBGL_multi_draw');
  if (typeof ext.multiDrawElementsInstancedWEBGL !== 'function') return false;
  if (wrappedExtensions.has(ext)) return true;
  wrappedExtensions.add(ext);
  const elements = ext.multiDrawElementsWEBGL;
  const arrays = ext.multiDrawArraysWEBGL;
  ext.multiDrawElementsWEBGL = function (mode, counts, countsOffset, type, offsets, offsetsOffset, drawCount) {
    if (pendingInstances === null) return elements.call(this, mode, counts, countsOffset, type, offsets, offsetsOffset, drawCount);
    return this.multiDrawElementsInstancedWEBGL(mode, counts, countsOffset, type, offsets, offsetsOffset, pendingInstances, 0, drawCount);
  };
  ext.multiDrawArraysWEBGL = function (mode, firsts, firstsOffset, counts, countsOffset, drawCount) {
    if (pendingInstances === null) return arrays.call(this, mode, firsts, firstsOffset, counts, countsOffset, drawCount);
    return this.multiDrawArraysInstancedWEBGL(mode, firsts, firstsOffset, counts, countsOffset, pendingInstances, 0, drawCount);
  };
  return true;
}

// An instanced batch's draw list: one draw per shown part, at its level's range, `count` copies from
// its first slot. As for the part batches, parts out of view are left out of the camera's list only
// (the shadow camera still draws them), and the list is rebuilt only when something in it changed.
function prepareInstanced(camera) {
  const view = this.userData.view;
  const kind = view.out > 0 && camera === view.batcher.viewCamera ? 1 : 0;
  if (view.dirty || view.built !== kind) {
    const ranges = this._geometryInfo;
    const starts = this._multiDrawStarts;
    const counts = this._multiDrawCounts;
    const instances = view.instances;
    const first = this._indirectTexture.image.data;
    let n = 0;
    for (const part of view.parts) {
      if (!part.shown || (kind && !part.inView)) continue;
      const range = ranges[part.ids[part.level]];
      starts[n] = range.start * view.bytes;
      counts[n] = range.count;
      instances[n] = part.mesh.count;
      first[n] = part.base;
      n++;
    }
    this._indirectTexture.needsUpdate = true;
    this._multiDrawCount = n;
    this._multiDrawBytesPerElement = view.bytes;
    view.dirty = false;
    view.built = kind;
  }
  pendingInstances = view.instances;
}

function instancedBeforeRender(renderer, scene, camera) {
  prepareInstanced.call(this, camera);
}

function instancedBeforeShadow(renderer, object, camera, shadowCamera) {
  prepareInstanced.call(this, shadowCamera);
}

// Also reached when the list was empty and nothing was drawn. Once drawn, three has uploaded the
// batch's textures, so later matrix changes can upload just their rows.
function instancedAfterRender() {
  pendingInstances = null;
  this.userData.view.uploaded = true;
}

const byDepth = (a, b) => a.depth - b.depth;
const NOTHING_NEAR = 1e9; // a batch with nothing in view draws last
const byNear = (a, b) => a.userData.view.near - b.userData.view.near;

// Mark floats [start, start + count) of an RGBA data texture for upload, in ranges that stay within a
// row (three uploads each range as one row strip).
function addRowRanges(texture, start, count) {
  const row = texture.image.width * 4;
  for (let s = start, end = start + count; s < end; ) {
    const e = Math.min(end, (Math.floor(s / row) + 1) * row);
    texture.addUpdateRange(s, e - s);
    s = e;
  }
}

// The geometry itself when it is indexed; otherwise the same vertices with a running index.
function withIndex(geometry) {
  if (geometry.index) return geometry;
  const indexed = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) indexed.setAttribute(name, attribute);
  const n = geometry.attributes.position.count;
  const index = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) index[i] = i;
  indexed.setIndex(new THREE.BufferAttribute(index, 1));
  return indexed;
}

// An instanced mesh can join an instanced batch when its material is an opaque cel one drawn with the
// renderer's own shadow material, and its transform keeps three's batched normals and winding right
// once folded into each copy's matrix (uniform scale, not mirrored).
function foldable(mesh) {
  const m = mesh.material;
  if (Array.isArray(m) || m.transparent || m.isShaderMaterial || !m.userData.cel) return false;
  if (mesh.customDepthMaterial || mesh.customDistanceMaterial || mesh.morphTexture) return false;
  const g = mesh.geometry;
  if (!g.attributes.position || Object.keys(g.morphAttributes).length) return false;
  for (const a of Object.values(g.attributes)) if (a.isInterleavedBufferAttribute) return false;
  const e = mesh.matrixWorld.elements;
  const sx = Math.hypot(e[0], e[1], e[2]);
  const sy = Math.hypot(e[4], e[5], e[6]);
  const sz = Math.hypot(e[8], e[9], e[10]);
  if (Math.max(sx, sy, sz) > Math.min(sx, sy, sz) * 1.0001) return false;
  return mesh.matrixWorld.determinant() > 0;
}

// Each part draws the finest level that spends at most `density` triangles per device pixel it covers
// (so a heavy part far away coarsens long before a light one); below `cull` pixels of projected
// radius it is not drawn at all (sub-pixel specks only add aliasing).
// Materials of instanced organs scattered over a mass (crown frosting, garden blooms, lawn herbs).
const SCATTERED = new Set(['blossom', 'crownLeaves', 'leaf', 'petal', 'bloom', 'wisteria', 'meadowFlower', 'clover']);

// Thin parts whose far level collapses (rods, slats) are culled a little earlier, at `thin`.
// Instanced parts that tile a surface edge to edge (slates, pantiles, setts) spend `tiling` triangles
// per pixel instead: a coarse tile stops interlocking with its neighbours and the deck shows through.
export const LOD = { density: 2, tiling: 7, cull: 0.8, thin: 1.6 };

const maxScale = (m) => {
  const e = m.elements;
  return Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10]));
};

// Radius of a geometry's bounding box under a transform, scaled per axis: a unit post squashed to a
// tenth of its height is a tenth as tall, which the bounding sphere times the largest scale overstates.
function scaledRadius(box, m) {
  const e = m.elements;
  const sx = Math.hypot(e[0], e[1], e[2]);
  const sy = Math.hypot(e[4], e[5], e[6]);
  const sz = Math.hypot(e[8], e[9], e[10]);
  return 0.5 * Math.hypot((box.max.x - box.min.x) * sx, (box.max.y - box.min.y) * sy, (box.max.z - box.min.z) * sz);
}

// Draw-call batching and levels of detail for the assembled town. Every part stays its own mesh in the
// scene graph, with its own geometry and transform, exactly as modelled; only its submission changes.
// Parts sharing a material (and shadow flags and attribute layout) become instances of their own
// geometry in one THREE.BatchedMesh, drawn in one multi-draw call per pass. Each heavy part also gets
// two coarser levels in its batch and shows the one its on-screen size calls for. Parts of animated
// assets are batched too: their world matrices and visibility are copied in every frame. Instanced
// micro-parts sharing a material likewise draw together, in one instanced multi-draw (buildInstanced).
export class Batcher {
  constructor(scene, renderer = null) {
    this.scene = scene;
    this.groups = new Map();
    this.entries = [];
    this.dynamic = [];
    this.batches = [];
    this.instanced = []; // instanced meshes that draw themselves
    this.folded = []; // instanced meshes drawn by an instanced batch
    this.foldedDynamic = [];
    this.instancedBatches = [];
    this.multiDraw = renderer ? installInstancedMultiDraw(renderer) : false;
    this.frame = 0;
    this.lastCamera = new THREE.Matrix4();
  }

  static eligible(mesh) {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isBatchedMesh || mesh.isSkinnedMesh) return false;
    const m = mesh.material;
    if (Array.isArray(m) || m.transparent || m.isShaderMaterial || !m.userData.cel) return false;
    if (mesh.customDepthMaterial || mesh.customDistanceMaterial) return false;
    const g = mesh.geometry;
    if (!g.attributes.position || Object.keys(g.morphAttributes).length) return false;
    for (const a of Object.values(g.attributes)) if (a.isInterleavedBufferAttribute) return false;
    return true;
  }

  // Gather the meshes of one placed asset. `dynamic`: the asset moves some of its parts every frame.
  collect(root, { dynamic = false } = {}) {
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (o.isInstancedMesh) {
        // Particle meshes (re-posed every frame, never frustum-culled) keep their geometry.
        if (o.frustumCulled !== false && o.userData.lod !== false) this.instanced.push({ mesh: o, dynamic, root });
        return;
      }
      if (!Batcher.eligible(o)) return;
      const g = o.geometry;
      const layout = Object.entries(g.attributes).map(([k, a]) => `${k}${a.itemSize}${a.normalized ? 'n' : ''}`).sort().join(',');
      // Window panes differ only in their rooms, which move into vertex attributes: one batch for them all.
      const glass = isRoomGlass(o.material);
      const family = glass ? `glass:${Object.keys(o.material.defines).sort().join(',')}` : o.material.uuid;
      const key = `${family}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${g.index ? 'i' : 'n'}|${layout}`;
      let group = this.groups.get(key);
      if (!group) {
        group = { material: glass ? roomAttributeGlass(o.material) : o.material, glass, cast: o.castShadow, receive: o.receiveShadow, indexed: Boolean(g.index), items: [] };
        this.groups.set(key, group);
      }
      group.items.push({ mesh: o, dynamic, root });
    });
  }

  build() {
    let parts = 0;
    let lodded = 0;
    const levelCache = new Map();
    const levels = (g, indexed) => {
      if (!levelCache.has(g)) {
        let l = levelsOf(g);
        if (l && !indexed) {
          const collapsed = l.collapsed;
          l = l.map((x) => x.toNonIndexed());
          l.collapsed = collapsed;
        }
        levelCache.set(g, l);
      }
      return levelCache.get(g);
    };
    for (const group of this.groups.values()) {
      if (group.items.length < 2) continue; // a one-off part gains nothing from a batch
      // Each pane draws a copy of its geometry carrying its own room (see roomAttributeGlass).
      if (group.glass) {
        for (const item of group.items) {
          const g = item.mesh.geometry.clone();
          for (const [name, attribute] of Object.entries(roomAttributes(item.mesh.material, g.attributes.position.count))) g.setAttribute(name, attribute);
          item.geometry = g;
        }
      }
      const geometryOf = (item) => item.geometry ?? item.mesh.geometry;
      const geometries = new Map();
      let vertices = 0;
      let indices = 0;
      const count = (g) => {
        vertices += g.attributes.position.count;
        indices += g.index ? g.index.count : 0;
      };
      for (const item of group.items) {
        const g = geometryOf(item);
        if (geometries.has(g)) continue;
        const l = levels(g, group.indexed);
        geometries.set(g, { levels: l });
        count(g);
        if (l) l.forEach(count);
      }
      const batch = new THREE.BatchedMesh(group.items.length, vertices, Math.max(indices, 3), group.material);
      batch.name = `batch:${group.material.name}`;
      batch.castShadow = group.cast;
      batch.receiveShadow = group.receive;
      batch.sortObjects = false;
      batch.perObjectFrustumCulled = false;
      batch.userData.view = { batcher: this, inView: new Uint8Array(group.items.length).fill(1), out: 0, dirty: true, built: -1 };
      batch._updateDrawParameters = updateDrawParameters;
      for (const [g, info] of geometries) {
        info.ids = [batch.addGeometry(g), ...(info.levels ?? []).map((l) => batch.addGeometry(l))];
        info.tris = [g, ...(info.levels ?? [])].map(triangleCount);
        if (!g.boundingSphere) g.computeBoundingSphere();
        if (!g.boundingBox) g.computeBoundingBox();
        info.sphere = g.boundingSphere;
        info.box = g.boundingBox;
        info.cull = info.levels?.collapsed ? LOD.thin : LOD.cull;
      }
      for (const item of group.items) {
        const info = geometries.get(geometryOf(item));
        const id = batch.addInstance(info.ids[0]);
        batch.setMatrixAt(id, item.mesh.matrixWorld);
        item.mesh.layers.set(HIDDEN);
        const entry = { batch, id, ids: info.ids, tris: info.tris, sphere: info.sphere, box: info.box, cull: info.cull, mesh: item.mesh, root: item.root, dynamic: item.dynamic, level: 0, visible: true, center: new THREE.Vector3(), radius: 0 };
        this.place(entry);
        this.entries.push(entry);
        if (item.dynamic) {
          entry.uploaded = Float32Array.from(item.mesh.matrixWorld.elements); // the matrix the batch holds
          this.dynamic.push(entry);
        }
        if (info.ids.length > 1) lodded++;
        parts++;
      }
      // A static part's own buffers are never drawn again (nor is a pane's room-carrying copy).
      for (const [g] of geometries) if (group.items.every((i) => geometryOf(i) !== g || !i.dynamic || i.geometry)) g.dispose();
      this.scene.add(batch);
      this.batches.push(batch);
    }
    this.groups.clear();

    // Instanced micro-parts (tiles, balusters, blooms...): the whole mesh changes level by the size its
    // instances show at the nearest point of the mesh.
    const instancedLevels = new Map();
    const m = new THREE.Matrix4();
    for (const item of this.instanced) {
      const mesh = item.mesh;
      const g = mesh.geometry;
      // Scattered organs (blossoms, leaves, florets) may coarsen to a few triangles each; parts that
      // tile a surface edge to edge (slates, pantiles, setts) keep their outline, or gaps open between them.
      const micro = SCATTERED.has(mesh.material.name) ? 'scatter' : mesh.userData.tiling ? false : 'hard';
      const key = `${g.uuid}|${micro}`;
      // An asset may model its own coarser levels (the lawn's blades of fewer segments).
      if (!mesh.userData.levels && !instancedLevels.has(key)) instancedLevels.set(key, levelsOf(g, { micro }));
      item.levels = [g, ...(mesh.userData.levels ?? instancedLevels.get(key) ?? [])];
      item.tris = item.levels.map(triangleCount);
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingSphere) g.computeBoundingSphere();
      // Typical on-screen size of one instance: the mean over a sample of their own transforms.
      let s = 0;
      let n = 0;
      const step = Math.max(1, Math.floor(mesh.count / 40));
      for (let i = 0; i < mesh.count; i += step, n++) {
        mesh.getMatrixAt(i, m).premultiply(mesh.matrixWorld);
        s += Math.min(g.boundingSphere.radius * maxScale(m), scaledRadius(g.boundingBox, m));
      }
      item.instanceRadius = n ? s / n : 0;
      if (!mesh.boundingSphere) mesh.computeBoundingSphere();
      item.center = mesh.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld);
      item.radius = mesh.boundingSphere.radius * maxScale(mesh.matrixWorld);
      item.level = 0;
      item.cull = mesh.userData.lodCull !== false;
      item.density = mesh.userData.tiling ? LOD.tiling : LOD.density;
    }

    // Instanced meshes sharing a material (and shadow flags, layout, colouring and motion) draw as one
    // instanced batch; a mesh with no such company keeps drawing itself.
    const families = new Map();
    const keep = [];
    for (const item of this.instanced) {
      const mesh = item.mesh;
      if (!this.multiDraw || !foldable(mesh)) {
        keep.push(item);
        continue;
      }
      const g = mesh.geometry;
      const layout = Object.entries(g.attributes).map(([k, a]) => `${k}${a.itemSize}${a.normalized ? 'n' : ''}`).sort().join(',');
      const key = `${mesh.material.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${layout}|${mesh.instanceColor ? 'c' : ''}|${item.dynamic ? 'd' : 's'}`;
      if (!families.has(key)) families.set(key, []);
      families.get(key).push(item);
    }
    for (const family of families.values()) {
      if (family.length < 2) keep.push(...family);
      else this.buildInstanced(family);
    }
    this.instanced = keep;
    // The folded meshes' own buffers are never drawn again (unless shared with a mesh that still is).
    const kept = new Set(keep.flatMap((item) => item.levels));
    const done = new Set();
    for (const item of this.folded) {
      item.mesh.dispose();
      for (const g of item.levels) {
        if (kept.has(g) || done.has(g)) continue;
        done.add(g);
        g.dispose();
      }
    }

    // Parts grouped by the asset they belong to, for culling an asset at a time (see update).
    this.assets = [...Map.groupBy([...this.entries, ...this.folded], (e) => e.root).values()].map((entries) => ({ entries, dynamic: entries.some((e) => e.dynamic), center: new THREE.Vector3(), radius: 0, state: -1 }));
    for (const group of this.assets) this.bound(group);
    return {
      batches: this.batches.length,
      parts,
      lodded,
      dynamic: this.dynamic.length,
      instanced: this.instanced.length,
      instancedBatches: this.instancedBatches.length,
      folded: this.folded.length,
    };
  }

  // Instanced meshes sharing a material become one instanced batch: each mesh's geometry and its levels
  // go into the batch's buffers once, its copies into consecutive slots holding their world matrices
  // (and colours), and the batch draws every mesh as one instanced draw of a single multi-draw call
  // (see prepareInstanced). Each mesh keeps its own level, culling and motion.
  buildInstanced(items) {
    const first = items[0].mesh;
    const geometries = new Map();
    let vertices = 0;
    let indices = 0;
    let slots = 0;
    for (const item of items) {
      slots += item.mesh.count;
      const g = item.mesh.geometry;
      if (geometries.has(g)) continue;
      // Every instanced batch is indexed, so each level draws exactly as the mesh drew it: an unwelded
      // geometry gets a running index (its coarser levels are welded, and stay so).
      const levels = item.levels.map(withIndex);
      geometries.set(g, { levels });
      for (const l of levels) {
        vertices += l.attributes.position.count;
        indices += l.index.count;
      }
    }
    const batch = new THREE.BatchedMesh(slots, vertices, Math.max(indices, 3), instancedBatchMaterial(first.material));
    batch.name = `instanced:${first.material.name}`;
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.frustumCulled = false; // culled mesh by mesh (see update)
    batch.sortObjects = false;
    batch.perObjectFrustumCulled = false;
    if (first.castShadow) batch.customDepthMaterial = instancedBatchDepthMaterial();
    // Textures of the fixed power-of-two widths the shader's slot lookups assume (see CelMaterial); the
    // draw list holds a row per mesh, not per copy.
    const W = INSTANCED_TEXTURE_WIDTH;
    const rows = (texels, width) => Math.max(1, Math.ceil(texels / width));
    const rgba = (width, texels) => new THREE.DataTexture(new Float32Array(width * rows(texels, width) * 4), width, rows(texels, width), THREE.RGBAFormat, THREE.FloatType);
    batch._matricesTexture.dispose();
    batch._matricesTexture = rgba(W.matrices, slots * 4);
    batch._indirectTexture.dispose();
    batch._indirectTexture = new THREE.DataTexture(new Uint32Array(W.ids * rows(items.length, W.ids)), W.ids, rows(items.length, W.ids), THREE.RedIntegerFormat, THREE.UnsignedIntType);
    if (first.instanceColor) {
      batch._colorsTexture = rgba(W.colors, slots);
      batch._colorsTexture.image.data.fill(1);
      batch._colorsTexture.colorSpace = THREE.ColorManagement.workingColorSpace;
    }
    for (const info of geometries.values()) info.ids = info.levels.map((l) => batch.addGeometry(l));
    for (const item of items) {
      const mesh = item.mesh;
      item.folded = true;
      item.batch = batch;
      item.ids = geometries.get(mesh.geometry).ids;
      item.base = batch.instanceCount;
      for (let i = 0; i < mesh.count; i++) batch.addInstance(item.ids[0]);
      item.world0 = mesh.matrixWorld.clone(); // where it was placed (a tap re-poses a static mesh from here)
      item.held = Float32Array.from(mesh.matrixWorld.elements);
      item.versions = [mesh.instanceMatrix.version, mesh.instanceColor?.version ?? -1];
      item.shown = true;
      item.inView = 1;
      this.writeInstanced(item, item.world0);
      if (mesh.instanceColor) for (let i = 0; i < mesh.count; i++) batch.setColorAt(item.base + i, _c.fromArray(mesh.instanceColor.array, i * 3));
      mesh.layers.set(HIDDEN);
      this.folded.push(item);
      if (item.dynamic) this.foldedDynamic.push(item);
    }
    batch.userData.view = {
      batcher: this,
      parts: items,
      instances: new Int32Array(items.length),
      bytes: batch.geometry.getIndex().array.BYTES_PER_ELEMENT,
      out: 0,
      dirty: true,
      built: -1,
      uploaded: false,
    };
    batch.onBeforeRender = instancedBeforeRender;
    batch.onBeforeShadow = instancedBeforeShadow;
    batch.onAfterRender = instancedAfterRender;
    batch.onAfterShadow = instancedAfterRender;
    this.scene.add(batch);
    this.instancedBatches.push(batch);
  }

  // Write a folded mesh's copies into its batch at the mesh's world transform `matrix`: each copy's
  // world matrix, its spare bottom row carrying the mesh's own origin height (see CelMaterial's
  // instancedBatchVertex). Once the batch has been drawn, only the rows written are uploaded.
  writeInstanced(item, matrix) {
    const texture = item.batch._matricesTexture;
    const data = texture.image.data;
    const local = item.mesh.instanceMatrix.array;
    const y = matrix.elements[13];
    for (let i = 0; i < item.mesh.count; i++) {
      _im.fromArray(local, i * 16).premultiply(matrix);
      _im.elements[3] = y;
      _im.toArray(data, (item.base + i) * 16);
    }
    if (item.batch.userData.view?.uploaded) addRowRanges(texture, item.base * 16, item.mesh.count * 16);
    texture.needsUpdate = true;
  }

  // World bounding sphere of a batched part (a folded mesh's moves with it; its radius stays).
  place(entry) {
    if (entry.folded) {
      entry.center.copy(entry.mesh.boundingSphere.center).applyMatrix4(entry.mesh.matrixWorld);
      return;
    }
    entry.center.copy(entry.sphere.center).applyMatrix4(entry.mesh.matrixWorld);
    // Both are upper bounds of the part's true radius; the smaller is the tighter.
    entry.radius = Math.min(entry.sphere.radius * maxScale(entry.mesh.matrixWorld), scaledRadius(entry.box, entry.mesh.matrixWorld));
  }

  // Bounding sphere of one asset's batched parts (a box round their spheres, then the farthest reach).
  bound(group) {
    const box = _box.makeEmpty();
    for (const e of group.entries) {
      box.expandByPoint(_p.copy(e.center).addScalar(-e.radius));
      box.expandByPoint(_p.copy(e.center).addScalar(e.radius));
    }
    box.getCenter(group.center);
    group.radius = 0;
    for (const e of group.entries) group.radius = Math.max(group.radius, group.center.distanceTo(e.center) + e.radius);
  }

  // Mark one part in or out of the camera's view (its batch rebuilds its list when anything changed).
  setInView(e, inView) {
    const view = e.batch.userData.view;
    if (e.folded) {
      if (e.inView === inView) return;
      e.inView = inView;
    } else {
      if (view.inView[e.id] === inView) return;
      view.inView[e.id] = inView;
    }
    view.out += inView ? -1 : 1;
    view.dirty = true;
  }

  // Each frame, after the animated assets have moved: copy their parts' matrices in, cull the parts
  // against the view whenever the camera has moved, and (when it has moved, and every few frames
  // regardless) choose each part's level.
  update(camera, heightPx) {
    // An animated asset's parts are all synced, but most of them (a house round its swinging sign) never
    // move: a part's matrix is copied in only when it changed, so a batch re-uploads its matrices only
    // when one of its parts actually moved.
    for (const d of this.dynamic) {
      const m = d.mesh.matrixWorld.elements;
      const held = d.uploaded;
      for (let k = 0; k < 16; k++) {
        if (held[k] !== Math.fround(m[k])) {
          held.set(m);
          d.batch.setMatrixAt(d.id, d.mesh.matrixWorld);
          break;
        }
      }
    }
    // Likewise a folded instanced mesh's copies are rewritten only when the mesh moved (or re-posed them).
    for (const f of this.foldedDynamic) {
      const mesh = f.mesh;
      const m = mesh.matrixWorld.elements;
      const held = f.held;
      let moved = mesh.instanceMatrix.version !== f.versions[0];
      for (let k = 0; !moved && k < 16; k++) moved = held[k] !== Math.fround(m[k]);
      if (moved) {
        held.set(m);
        f.versions[0] = mesh.instanceMatrix.version;
        this.writeInstanced(f, mesh.matrixWorld);
      }
      if (mesh.instanceColor && mesh.instanceColor.version !== f.versions[1]) {
        f.versions[1] = mesh.instanceColor.version;
        for (let i = 0; i < mesh.count; i++) f.batch.setColorAt(f.base + i, _c.fromArray(mesh.instanceColor.array, i * 3));
      }
    }
    this.frame++;
    camera.updateMatrixWorld(); // the controls have moved it since the last render
    this.viewCamera = camera;
    const view = camera.matrixWorld;
    // Re-choose levels every third frame while the camera moves, every eighth while it rests.
    const moved = !this.lastCamera.equals(view);
    const levels = this.frame % (moved ? 3 : 8) === 0;
    if (!levels && this.lastCull?.equals(view)) return;
    (this.lastCull ??= new THREE.Matrix4()).copy(view);
    if (levels) this.lastCamera.copy(view);
    _frustum.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const planes = _frustum.planes;
    const eye = _v.setFromMatrixPosition(view);
    // Animated parts' bounds (and their assets') follow them when the levels are re-chosen.
    if (levels) {
      for (const group of this.assets) {
        if (!group.dynamic) continue;
        for (const e of group.entries) if (e.dynamic) this.place(e);
        this.bound(group);
      }
    }
    // Cull asset by asset: an asset wholly inside the view has every part in it, one wholly outside
    // (by the same widened test) has none, and only those across an edge are tested part by part. The
    // outcome is the part-by-part test's (an asset's sphere holds each of its parts' spheres), at the
    // cost of a hundred-odd tests while the camera turns.
    for (const group of this.assets) {
      const dist = eye.distanceTo(group.center);
      const slack = group.radius + VIEW_SLACK * (dist + group.radius);
      let state = 1;
      for (let p = 0; p < 6; p++) {
        const s = planes[p].distanceToPoint(group.center);
        if (s < -slack) {
          state = 0;
          break;
        }
        if (s < group.radius) state = 2;
      }
      if (state === 2) {
        for (const e of group.entries) {
          const partSlack = e.dynamic ? e.radius + VIEW_SLACK * eye.distanceTo(e.center) : e.radius;
          let inView = 1;
          for (let p = 0; p < 6; p++) {
            if (planes[p].distanceToPoint(e.center) < -partSlack) {
              inView = 0;
              break;
            }
          }
          this.setInView(e, inView);
        }
      } else if (state !== group.state) {
        for (const e of group.entries) this.setInView(e, state);
      }
      group.state = state;
    }
    if (!levels) return;
    const k = heightPx / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const pick = (px, tris, density = LOD.density) => {
      const area = Math.PI * px * px;
      for (let l = 0; l < tris.length - 1; l++) if (tris[l] <= density * area) return l;
      return tris.length - 1;
    };
    for (const batch of this.batches) batch.userData.view.near = NOTHING_NEAR;
    for (const e of this.entries) {
      const d = Math.max(eye.distanceTo(e.center) - e.radius, 0.05);
      const px = (e.radius * k) / d;
      const shown = (!e.dynamic || (e.mesh.visible && (e.mesh.parent?.visible ?? true))) && px > e.cull;
      if (shown !== e.visible) {
        e.batch.setVisibleAt(e.id, shown);
        e.visible = shown;
      }
      if (!shown) continue;
      const view = e.batch.userData.view;
      if (d < view.near && view.inView[e.id]) view.near = d;
      const level = pick(px, e.tris);
      if (level !== e.level) {
        e.batch.setGeometryIdAt(e.id, e.ids[level]);
        e.level = level;
      }
    }
    for (const item of this.instanced) {
      if (item.dynamic) item.center.copy(item.mesh.boundingSphere.center).applyMatrix4(item.mesh.matrixWorld);
      const d = Math.max(eye.distanceTo(item.center) - item.radius, 0.05);
      const px = (item.instanceRadius * k) / d;
      const shown = !item.cull || px > LOD.cull;
      if (shown !== item.mesh.visible) item.mesh.visible = shown;
      if (!shown) continue;
      const level = pick(px, item.tris, item.density);
      if (level !== item.level) {
        item.mesh.geometry = item.levels[level];
        item.level = level;
      }
    }
    // Folded meshes choose the same way (their bounds follow them with their asset's, above); an animated
    // asset's mesh also hides with itself or its parent, as a batched part does.
    for (const f of this.folded) {
      const d = Math.max(eye.distanceTo(f.center) - f.radius, 0.05);
      f.depth = d;
      const px = (f.instanceRadius * k) / d;
      const shown = (!f.dynamic || (f.mesh.visible && (f.mesh.parent?.visible ?? true))) && (!f.cull || px > LOD.cull);
      const level = shown ? pick(px, f.tris, f.density) : f.level;
      if (shown !== f.shown || level !== f.level) {
        f.shown = shown;
        f.level = level;
        f.batch.userData.view.dirty = true;
      }
    }
    // Draw nearest first: every batch is ranked by its nearest part in view, and each instanced batch
    // draws its meshes nearest first. A tiling GPU hides what lies behind only within the geometry it
    // holds at once, and the town's tens of millions of triangles overflow that many times a frame, so
    // order counts: at the plaza the whole frame measured about a tenth faster drawn nearest first
    // than in material order (the batches precede everything else, the sky included).
    if (moved) {
      for (const batch of this.instancedBatches) {
        const view = batch.userData.view;
        view.parts.sort(byDepth);
        view.dirty = true;
        view.near = NOTHING_NEAR;
        for (const f of view.parts) {
          if (f.shown && f.inView) {
            view.near = f.depth;
            break;
          }
        }
      }
      (this.drawOrder ??= [...this.batches, ...this.instancedBatches]).sort(byNear);
      this.drawOrder.forEach((batch, rank) => (batch.renderOrder = rank - this.drawOrder.length));
    }
  }

  // Re-pose a static asset's batched parts by a world transform (null puts them back).
  transform(root, matrix) {
    const list = (this.byRoot ??= Map.groupBy([...this.entries, ...this.folded].filter((e) => !e.dynamic), (e) => e.root)).get(root) ?? [];
    for (const e of list) {
      if (e.folded) this.writeInstanced(e, matrix ? _tm.multiplyMatrices(matrix, e.world0) : e.world0);
      else e.batch.setMatrixAt(e.id, matrix ? _m.multiplyMatrices(matrix, e.mesh.matrixWorld) : e.mesh.matrixWorld);
    }
  }

  // Triangles the levels in use would draw (one camera pass), for checking the LOD's effect.
  drawnTriangles() {
    let t = 0;
    for (const e of this.entries) if (e.visible && e.batch.userData.view.inView[e.id]) t += e.tris[e.level];
    for (const item of this.instanced) if (item.mesh.visible) t += triangleCount(item.mesh.geometry) * item.mesh.count;
    for (const f of this.folded) if (f.shown && f.inView) t += f.tris[f.level] * f.mesh.count;
    return Math.round(t);
  }
}
