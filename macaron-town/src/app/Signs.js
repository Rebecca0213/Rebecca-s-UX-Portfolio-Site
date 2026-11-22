import * as THREE from 'three';
const _view = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
const THREAD = 100; // px: the thread's drawn length, scaled to the gap between the name and the roof

// While a venue glows under the pointer (see Hover), its name hangs in the air above it: bright
// lettering in a warm halo, on a thread of light that comes down to a diamond on its roof. The thread
// is what ties the name to its building: from the town's usual high view, the air above a roof is
// where the buildings behind it are.
//
// The signs are page text laid over the canvas, not part of the scene: they stay sharp whatever
// resolution the governor renders at, and the depth of field never blurs them. Each frame a sign is
// placed where its roof point lands on screen; its lettering grows with nearness, within limits that
// keep it legible from afar and modest up close, and it is kept on screen. It eases in and out with
// the glow, rises into place, bobs gently while shown and breathes with the building's glow.
export class VenueSigns {
  // venues: Hover's venues ({ id, name, box, base }); picker: the Picker that finds their roofs.
  constructor(stage, camera, { venues, picker }) {
    this.stage = stage;
    this.camera = camera;
    this.root = document.createElement('div');
    this.root.className = 'venue-signs';
    stage.appendChild(this.root);
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.signs = venues.map((venue, i) => this.create(venue, picker, i));
  }

  create(venue, picker, i) {
    const { box, base } = venue;
    // The roof: where a ray dropped through the middle of the venue's lot first meets it.
    const x = base ? base.x : (box.min.x + box.max.x) / 2;
    const z = base ? base.z : (box.min.z + box.max.z) / 2;
    _ray.origin.set(x, box.max.y + 1, z);
    const hit = picker.nearest(_ray);
    const roof = new THREE.Vector3(x, hit?.id === venue.id ? _ray.origin.y - hit.distance : box.max.y, z);

    const el = document.createElement('div');
    el.className = 'venue-sign';
    el.dataset.venue = venue.id;
    const plate = document.createElement('div');
    plate.className = 'venue-sign__plate';
    const glow = document.createElement('span');
    glow.className = 'venue-sign__glow';
    glow.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'venue-sign__name';
    glow.textContent = name.textContent = venue.name ?? venue.id;
    plate.append(glow, name);
    const thread = document.createElement('div');
    thread.className = 'venue-sign__thread';
    const pin = document.createElement('div');
    pin.className = 'venue-sign__pin';
    el.append(thread, pin, plate);
    this.root.appendChild(el);
    return { venue, roof, el, plate, glow, thread, amount: 0, shown: false, size: 0, width: 0, height: 0, phase: i * 2.1 };
  }

  update(dt, hover) {
    const width = this.stage.clientWidth;
    const height = this.stage.clientHeight;
    const camera = this.camera;
    camera.updateMatrixWorld(); // this frame's view (the controls have just moved the camera)
    const still = this.reducedMotion.matches;
    const time = hover.time;
    for (const sign of this.signs) {
      const on = hover.hovered === sign.venue;
      sign.amount += ((on ? 1 : 0) - sign.amount) * (1 - Math.exp(-dt / (on ? 0.12 : 0.16)));
      _view.copy(sign.roof).applyMatrix4(camera.matrixWorldInverse);
      const visible = sign.amount > 0.004 && _view.z < -camera.near;
      if (visible !== sign.shown) {
        sign.shown = visible;
        sign.el.style.visibility = visible ? 'visible' : 'hidden';
      }
      if (!visible) {
        if (!on) sign.amount = 0;
        continue;
      }
      // Screen pixels per world unit at the roof's depth.
      const ppu = height / 2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * -_view.z);
      // Lettering about 20 px from the usual high view, 30 from the plaza, 37 in the street.
      const size = Math.round(THREE.MathUtils.clamp(7 * Math.pow(ppu, 0.32), 20, 42) * 2) / 2;
      if (size !== sign.size) {
        sign.size = size;
        sign.el.style.setProperty('--size', `${size}px`);
        sign.width = sign.plate.offsetWidth;
        sign.height = sign.plate.offsetHeight;
      }
      _ndc.copy(sign.roof).project(camera);
      const x = ((_ndc.x + 1) / 2) * width;
      const y = ((1 - _ndc.y) / 2) * height;
      const e = easeOut(sign.amount);
      // The name floats a little over the roof (in world units, so nearer views open the gap), rising
      // into place as it appears; the thread grows up from the roof to meet it.
      const lift = Math.max(0.3 * ppu, 14);
      const bob = still ? 0 : Math.sin(time * 1.7 + sign.phase) * 1.6;
      let gap = lift + bob + (still ? 0 : (1 - e) * 10);
      // Kept on screen, a margin from every edge: the name moves, and the thread stretches or shortens.
      const margin = 8;
      gap = Math.min(gap, y - margin - sign.height);
      gap = Math.max(gap, y - (height - margin));
      const dx = THREE.MathUtils.clamp(x, margin + sign.width / 2, width - margin - sign.width / 2) - x;
      const scale = still ? 1 : 0.94 + 0.06 * e;
      sign.el.style.opacity = e.toFixed(3);
      sign.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      sign.plate.style.transform = `translate3d(${(dx - sign.width / 2).toFixed(1)}px, ${(-gap).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      sign.thread.style.transform = `scaleY(${(Math.max(gap, 0) / THREAD) * (still ? 1 : e)})`;
      // The halo breathes with the building's glow (see Hover).
      sign.glow.style.opacity = (0.85 + 0.15 * Math.sin(time * 3.2)).toFixed(3);
    }
  }
}

const easeOut = (t) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
