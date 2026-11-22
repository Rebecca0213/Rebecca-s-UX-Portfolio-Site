// Holds the frame rate up by trading resolution. The town is bound by per-pixel work (MSAA scene,
// AO, ink, bokeh, bloom at device resolution), so the pixel ratio is the lever: it steps down while
// frames run slow and back up while they run fast, settling where the device keeps pace.
//
// Every step down is a trial. A slow frame cadence is not always the GPU's doing: a vsync divider,
// a low-power mode or a hidden window can cap the frame rate at 30 Hz however light the frame is.
// If the frames come no faster after a step down, the resolution is restored and no step is tried
// for `recover` ms; a second failed trial from the same ratio holds it there for good. (One trial is
// weak evidence: a view that grows costlier under it, or a spell of other work on the machine, can
// hide the gain. A single failure used to lock an M1 at 2x and 14 fps, where 1x runs at 30.)
// Hysteresis keeps it from hunting: after stepping down from a ratio it may not climb back to that
// ratio for `recover` ms, and every change is followed by a quiet spell while the average resettles
// (its first frames, which pay for the change itself, are left out).
export class ResolutionGovernor {
  constructor({ max, min, step = 0.25, slowMs = 36, fastMs = 20, recover = 30000, apply }) {
    this.max = max;
    this.min = Math.min(min, max);
    this.step = step;
    this.slowMs = slowMs;
    this.fastMs = fastMs;
    this.recover = recover;
    this.apply = apply;
    this.ratio = max;
    this.avg = null;
    this.quiet = 1500;
    this.settle = 0;
    this.sum = 0;
    this.count = 0;
    this.trial = null;
    this.blocked = { ratio: Infinity, until: 0 };
    this.failed = { ratio: null, until: 0 }; // the last failed trial: from which ratio, retried after when
    this.clock = 0;
  }

  // Once per displayed frame, with that frame's wall-clock duration.
  update(ms) {
    if (!(ms > 0) || ms > 250) return; // a stall (hidden tab, GC, shader compile) says nothing about load
    this.clock += ms;
    // The first frames after a change pay for it (render targets reallocated, detail levels re-chosen)
    // and say nothing about the new ratio's cost; the rest of the quiet spell is averaged evenly, so
    // the decision at its end (a trial's verdict) rests on all of them alike.
    if (this.settle > 0) {
      this.settle -= ms;
      return;
    }
    if (this.quiet > 0) {
      this.sum += ms;
      this.count++;
      this.quiet -= ms;
      if (this.quiet > 0) return;
      this.avg = this.sum / this.count;
    } else {
      this.avg += (ms - this.avg) * 0.06;
    }
    if (this.trial) {
      const { ratio, avg } = this.trial;
      this.trial = null;
      if (this.avg > avg * 0.9) {
        // No faster for fewer pixels: the cadence may be capped elsewhere. Restore it; hold it for good
        // only if a trial from this ratio has already failed.
        if (this.failed.ratio === ratio) this.min = ratio;
        this.failed = { ratio, until: this.clock + this.recover };
        this.set(ratio);
        return;
      }
    }
    if (this.avg > this.slowMs && this.ratio > this.min && this.clock >= this.failed.until) {
      this.trial = { ratio: this.ratio, avg: this.avg };
      this.blocked = { ratio: this.ratio, until: this.clock + this.recover };
      this.set(this.ratio - this.step);
    } else if (this.avg < this.fastMs && this.ratio < this.max) {
      const next = this.ratio + this.step;
      if (next >= this.blocked.ratio && this.clock < this.blocked.until) return;
      this.set(next);
    }
  }

  set(ratio) {
    this.ratio = Math.round(Math.min(this.max, Math.max(this.min, ratio)) * 100) / 100;
    this.apply(this.ratio);
    this.avg = null;
    this.settle = 400;
    this.quiet = 1600;
    this.sum = 0;
    this.count = 0;
  }
}

// The starting (and highest) pixel ratio for this device, and the floor it may drop to. Phones get a
// lower ceiling: their screens are dense and their GPUs share a small power budget.
export function resolutionRange() {
  const dpr = window.devicePixelRatio || 1;
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  const max = Math.min(dpr, phone ? 1.5 : 2);
  return { max, min: Math.max(0.75, max * 0.5), phone };
}
