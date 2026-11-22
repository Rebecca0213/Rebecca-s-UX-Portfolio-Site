import * as THREE from 'three';
import { gsap } from 'gsap';

const DEG = Math.PI / 180;

// The town's camera: orbit controls held over the island (the target never leaves the plateau and
// the eye never dips below the horizon), a fly-in from high and far once the town is built, and a
// slow orbit that takes over after a while without input and hands back at the first touch.
export class CameraRig {
  constructor(camera, controls, { azimuth, elevation, distance = 50, reach = 9.5, idle = 18 } = {}) {
    this.camera = camera;
    this.controls = controls;
    this.home = { azimuth, elevation, distance };
    this.reach = reach;
    this.idle = idle;
    this.quiet = 0;
    this.flying = false;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.panSpeed = 0.6;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.8;
    controls.autoRotateSpeed = 0.35;
    controls.addEventListener('start', () => {
      this.quiet = 0;
      controls.autoRotate = false;
      if (this.tween) this.tween.kill();
      this.flying = false;
    });
    // The intro's vantage: high above, farther out, swung round a little.
    this.set(azimuth - 38 * DEG, 62 * DEG, distance * 1.8);
  }

  // Place the eye at azimuth (from +x toward +z) / elevation / distance about the target.
  set(azimuth, elevation, distance) {
    const t = this.controls.target;
    this.camera.position.set(t.x + distance * Math.cos(elevation) * Math.cos(azimuth), t.y + distance * Math.sin(elevation), t.z + distance * Math.cos(elevation) * Math.sin(azimuth));
    this.camera.lookAt(t);
    this.controls.update();
  }

  replayIntro(duration = 4.8) {
    this.tween?.kill();
    const { azimuth, elevation, distance } = this.home;
    this.set(azimuth - 38 * DEG, 62 * DEG, distance * 1.8);
    this.intro(duration);
  }

  intro(duration = 4.8) {
    const start = this.spherical();
    const p = { ...start };
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.enabled = false;
    this.flying = true;
    this.tween = gsap.to(p, {
      azimuth: this.home.azimuth,
      elevation: this.home.elevation,
      distance: this.home.distance,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => this.set(p.azimuth, p.elevation, p.distance),
      onComplete: () => {
        this.flying = false;
        this.controls.enabled = true;
        this.controls.enableDamping = damping;
        this.set(this.home.azimuth, this.home.elevation, this.home.distance);
      },
    });
  }

  spherical() {
    const v = this.camera.position.clone().sub(this.controls.target);
    const distance = v.length();
    return { azimuth: Math.atan2(v.z, v.x), elevation: Math.asin(v.y / distance), distance };
  }

  update(dt) {
    // Keep the target over the plateau and near the ground.
    const t = this.controls.target;
    const r = Math.hypot(t.x, t.z);
    if (r > this.reach) {
      t.x *= this.reach / r;
      t.z *= this.reach / r;
    }
    t.y = THREE.MathUtils.clamp(t.y, 0, 3);
    if (!this.flying) {
      this.quiet += dt;
      if (this.quiet > this.idle) this.controls.autoRotate = true;
    }
  }
}
