import * as THREE from 'three';
import { SHARED } from '../render/shared.js';

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _size = new THREE.Vector3();
const _centre = new THREE.Vector3();

// The town's venues (the welcome centre, the gallery and the café) glow while the pointer is over
// them. The venue under the pointer is the one the pointer's ray meets first, picked exactly against
// the buildings' own surfaces (see Picker), so another building, a landmark or an islet feature in
// front of it hides it, and the sky beside its roof does not count. Its box goes to every cel material
// as a frame (SHARED.venueFrames): surfaces inside the box light up warm, most at their rims, its rooms
// brighten, and a soft warm halo spreads round the building (cel_output; the bloom carries the halo,
// see Pipeline's CelBloomPass), while its name appears in the air above it (see Signs). The glow eases
// in and out and breathes a little while held. On a touch screen there is no hover: a tap lights the
// venue it lands on for a moment.
export class Hover {
  // venues: [{ id, role, box, base? }] (world boxes: the glow's extent); picker: a Picker over the venues and
  // everything else that stands tall enough to hide one.
  constructor(camera, element, { venues, picker, strength = 1, outline = 1 }) {
    this.camera = camera;
    this.element = element;
    this.strength = strength;
    this.outline = outline;
    const frames = SHARED.venueFrames.value;
    if (venues.length > frames.length) console.warn(`Hover: only the first ${frames.length} venues can glow`);
    this.venues = venues.slice(0, frames.length).map((v, i) => {
      const box = v.box.clone().expandByScalar(0.03);
      // The box stops just above the ground at the venue's foot, so the paving and lawn round it are
      // neither lit nor outlined with it.
      if (v.base) box.min.y = v.base.y + 0.015;
      box.getCenter(_centre);
      box.getSize(_size).multiplyScalar(0.5);
      const frame = new THREE.Matrix4().compose(_centre, new THREE.Quaternion(), _size).invert();
      frames[i].copy(frame);
      return { ...v, box, frame, slot: i, amount: 0 };
    });
    this.byId = new Map(this.venues.map((v) => [v.id, v]));
    this.picker = picker;
    this.last = { x: NaN, y: NaN, view: new THREE.Matrix4(), venue: null }; // the last pick, kept while nothing moves
    this.pointer = null;
    this.touchUntil = 0;
    this.hovered = null;
    this.time = 0;
    element.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') this.pointer = [e.clientX, e.clientY];
    });
    element.addEventListener('pointerleave', () => {
      if (performance.now() > this.touchUntil) this.pointer = null;
    });
    element.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.pointer = [e.clientX, e.clientY];
      this.touchUntil = performance.now() + 1500;
    });
  }

  // The venue under a point on screen, or null.
  pick(clientX, clientY) {
    const rect = this.element.getBoundingClientRect();
    _ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    const hit = this.picker.nearest(_ray.ray);
    return hit ? this.byId.get(hit.id) ?? null : null;
  }

  update(dt) {
    this.time += dt;
    // Two milliseconds a frame of picking groundwork until it is all done (a few seconds after load).
    if (!this.prepared) this.prepared = this.picker.prepare(2);
    if (this.touchUntil && performance.now() > this.touchUntil) {
      this.touchUntil = 0;
      this.pointer = null;
    }
    // Picked again only when the pointer or the view has moved.
    const last = this.last;
    if (this.pointer && (this.pointer[0] !== last.x || this.pointer[1] !== last.y || !last.view.equals(this.camera.matrixWorld))) {
      [last.x, last.y] = this.pointer;
      last.view.copy(this.camera.matrixWorld);
      last.venue = this.pick(last.x, last.y);
    }
    const hovered = this.pointer ? last.venue : null;
    if (hovered !== this.hovered) {
      this.hovered = hovered;
      this.element.style.cursor = hovered ? 'pointer' : '';
    }

    const pulse = 0.9 + 0.1 * Math.sin(this.time * 3.2);
    const glow = SHARED.venueGlow.value;
    for (const v of this.venues) {
      const on = v === hovered;
      v.amount += ((on ? 1 : 0) - v.amount) * (1 - Math.exp(-dt / 0.12));
      if (!on && v.amount < 0.003) v.amount = 0;
      glow.setComponent(v.slot, v.amount * pulse * this.strength);
    }
    // The outline glow breathes slowly, about once every two and a half seconds, never fading below
    // two thirds of its strength.
    SHARED.outline.value.w = this.outline * (0.82 + 0.18 * Math.sin(this.time * 2.5));
  }
}