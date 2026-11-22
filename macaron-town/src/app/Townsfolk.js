import * as THREE from 'three';
import { capsule, sphere, lathe, spline, roundedBox, cylinder, torus } from '../kit/geometry.js';
import { createRandom } from '../kit/random.js';
import { STREET, PLAZA, QUARTER, rotate } from '../map/layout.js';
import { LEVELS } from '../kit/paving.js';

// Ten townspeople, painted figurines with big round heads, out for a stroll. They walk the four
// streets on the carriageway, keeping to the right (clear of the lamps and easels on the pavements),
// go round the compass rose on each street's lookout terrace (some stop there a moment, facing out,
// to take in the view), and change streets on a one-way promenade round the fountain, like a
// roundabout. Every stretch of the way meets the next without a corner, so they never slide or skip
// and always face the way they walk; anyone who comes up behind someone slows and waits a step behind
// them. Each is put together from its own parts (shoes, legs, a dress or a jacket, arms, hands, head,
// eyes, cheeks, hair, maybe a hat, a scarf or a bag) in its own skin, hair and clothes; legs and arms
// swing as they go (shorter strides as they slow) and their bodies bob.
//
// Drawn as a crowd: each kind of part is one instanced mesh with an instance per person (about twenty
// draws for all ten), posed every frame on the CPU. Not batched: they move every frame.

const COUNT = 10;
const SKIN = ['#F6D7C3', '#EBC2A3', '#D9A37E', '#B97E5A', '#8D5B3F', '#F2CDB5', '#C98E6A'];
const HAIR = ['#3B2A22', '#6B4A33', '#C99A5B', '#E8C27A', '#2A2230', '#A85A3C', '#D9D3CC'];
const CLOTHES = ['#F2A7BC', '#A9DCC8', '#BFD5EC', '#F7D36B', '#C9B8E8', '#F4A38C', '#FFFFFF', '#9FB8DA', '#E8B9A0', '#B9DDA8'];
const LEGWEAR = ['#5C6E99', '#7A6A8E', '#4F5D75', '#8C6F5A', '#3E4A5E', '#F7F3EE'];
const SHOES = ['#5A3E2E', '#2E2A36', '#8A5A44', '#F2A7BC', '#FFFFFF'];
const ACCENT = ['#F2A7BC', '#F7D36B', '#A9DCC8', '#E5484D', '#BFD5EC', '#FFFFFF'];

// Routes, in each street's own frame (s along it from the island's centre, a across it; see `rotate`).
const LANE = 0.33; // each way's offset from the street's centre line: out on +a, in on -a (keep right)
const RING = PLAZA.radius - 0.95; // the promenade: round the fountain's steps, clear of the plaza benches
const BEND = 0.3; // radius of the bends between a street's lanes and the promenade
const JOIN = Math.sqrt((RING + BEND) ** 2 - (LANE + BEND) ** 2); // where the lanes meet their bends
const ON_RING = Math.atan2(LANE + BEND, JOIN); // where the bends meet the promenade, either side of the street
const LOOKOUT = STREET.end; // centre of the round lookout terrace (and its compass rose) closing each street
const ROAD_END = 7.25; // where the carriageway gives way to the lookout's paving (see terrain/Street)
const streetOf = (angle) => (((Math.round(-angle / QUARTER) % 4) + 4) % 4); // the street nearest a polar angle

// A stretch of the way, walked by distance along it: a straight run, or an arc about `c` from polar
// angle a0 to a1 (x = cos, z = sin). `at` writes the ground position (x, z) and the unit direction.
function straight([ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  return {
    length,
    at(d, pos, dir) {
      pos.x = ax + (dx * d) / length;
      pos.z = az + (dz * d) / length;
      dir.set(dx / length, 0, dz / length);
    },
  };
}
function arc([cx, cz], r, a0, a1) {
  const sign = Math.sign(a1 - a0);
  return {
    length: r * Math.abs(a1 - a0),
    at(d, pos, dir) {
      const a = a0 + (sign * d) / r;
      pos.x = cx + r * Math.cos(a);
      pos.z = cz + r * Math.sin(a);
      dir.set(-Math.sin(a) * sign, 0, Math.cos(a) * sign);
    },
  };
}

// Each street's stretches. Out along +a to the lookout; round the compass rose to the left, in two
// quarter turns (the view lies between them); back along -a; then a right-hand bend onto the promenade,
// which runs anticlockwise seen from above. From the promenade a right-hand bend leads onto a street's
// way out. Each stretch leaves in the direction the last arrived.
const ROUTES = [0, 1, 2, 3].map((q) => {
  const at = (s, a) => rotate(s, a, q * QUARTER);
  const turn = -q * QUARTER; // a street-frame polar angle, in the world
  const rose = at(LOOKOUT, 0);
  const [ox, oz] = at(1, 0);
  return {
    out: straight(at(JOIN, LANE), at(LOOKOUT, LANE)),
    lookout: [arc(rose, LANE, Math.PI / 2 + turn, turn), arc(rose, LANE, turn, -Math.PI / 2 + turn)],
    in: straight(at(LOOKOUT, -LANE), at(JOIN, -LANE)),
    enter: arc(at(JOIN, -(LANE + BEND)), BEND, Math.PI / 2 + turn, Math.PI - ON_RING + turn),
    leave: arc(at(JOIN, LANE + BEND), BEND, -(Math.PI - ON_RING) + turn, -Math.PI / 2 + turn),
    view: Math.atan2(ox, oz), // facing out over the lookout's balustrade
    // Round the promenade from this street's bend in to the bend out to street q + n (n quarters on).
    promenade: [1, 2, 3].map((n) => arc([0, 0], RING, -ON_RING + turn, ON_RING + turn - n * QUARTER)),
  };
});
const ONWARD = [0.45, 0.35, 0.2]; // chances of going on one, two or three streets round the promenade

// The ground under a walker: the plaza's and the lookouts' paving, or the crowned road between them.
function groundY(x, z) {
  if (x * x + z * z < PLAZA.radius ** 2) return LEVELS.paving;
  const q = streetOf(Math.atan2(z, x));
  const [s, a] = rotate(x, z, -q * QUARTER);
  if (s > ROAD_END || Math.abs(a) > STREET.roadHalf) return LEVELS.paving;
  const t = Math.min(1, Math.abs(a) / 0.5);
  return LEVELS.road + 0.003 * (1 - t * t);
}

// The figure, in its own space: feet at y = 0, facing +z. Joints the limbs swing about.
const HIP = 0.12;
const SHOULDER = 0.236;
const HEAD = 0.326;

const _m = new THREE.Matrix4();
const _j = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Townsfolk {
  constructor(ctx, { seed = 77, count = COUNT } = {}) {
    const m = ctx.materials;
    const rng = createRandom(seed);
    this.rng = rng; // their choices along the way, so each load strolls the same
    this.group = new THREE.Group();
    this.group.name = 'townsfolk';
    this.count = count;

    // People: their looks and where they start.
    this.people = [];
    for (let i = 0; i < count; i++) {
      const dress = rng() < 0.5;
      const hair = rng.pick(['cap', 'bob', 'bun']);
      const skin = new THREE.Color(rng.pick(SKIN));
      const hairColor = new THREE.Color(rng.pick(HAIR));
      const clothes = new THREE.Color(rng.pick(CLOTHES));
      const legs = new THREE.Color(dress ? rng.pick(['#F7F3EE', '#FBE3EA', '#E8E2F2']) : rng.pick(LEGWEAR));
      const shoes = new THREE.Color(rng.pick(SHOES));
      const accent = new THREE.Color(rng.pick(ACCENT));
      rng(); // an umbrella's colour was drawn here while the town had weather: kept, so everyone looks and walks as before
      const person = {
        skin,
        hairColor,
        clothes,
        legs,
        shoes,
        accent,
        dress,
        hair,
        hat: rng() < 0.45 ? rng.pick(['beret', 'boater']) : null,
        scarf: rng() < 0.4,
        bag: rng() < 0.35,
        height: rng.range(0.94, 1.08),
        speed: rng.range(0.22, 0.32),
        phase: rng() * Math.PI * 2,
        // Where they are: their street, the stage of the way round it, that stretch and how far along it.
        q: i % 4,
        stage: 'out',
        leg: null,
        d: 0,
        pause: 0, // seconds left at the view
        pace: 0, // walking speed now
        pos: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, 1), // the way ahead along their stretch
        heading: 0,
      };
      // Somewhere along a street's way out or back, a little apart from everyone placed so far.
      for (let tries = 0; tries < 40; tries++) {
        person.stage = rng() < 0.5 ? 'out' : 'in';
        person.leg = ROUTES[person.q][person.stage];
        person.d = rng.range(0.4, person.leg.length - 0.4);
        person.leg.at(person.d, person.pos, person.dir);
        if (this.people.every((o) => Math.hypot(o.pos.x - person.pos.x, o.pos.z - person.pos.z) > 0.5)) break;
      }
      person.pos.y = groundY(person.pos.x, person.pos.z);
      person.heading = Math.atan2(person.dir.x, person.dir.z);
      person.pace = person.speed;
      this.people.push(person);
    }

    // Parts: geometry in the figure's space, the joint it hangs from, its colour and who wears it.
    const paint = m.paintedWood('#FFFFFF');
    const dark = m.paintedWood('#2B2340');
    const blush = m.paintedWood('#F4A6B0');
    const fabric = m.fabric('#FFFFFF');
    const at =(x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
    const legGeo = capsule(0.017, 0.07, 6, 12);
    const armGeo = capsule(0.013, 0.07, 6, 12);
    const parts = [
      { geo: legGeo, mat: paint, joint: 'legL', local: at(0, -0.052, 0), color: (p) => p.legs },
      { geo: legGeo, mat: paint, joint: 'legR', local: at(0, -0.052, 0), color: (p) => p.legs },
      { geo: roundedBox(0.034, 0.022, 0.056, 0.008, 3), mat: paint, joint: 'legL', local: at(0, -0.109, 0.01), color: (p) => p.shoes },
      { geo: roundedBox(0.034, 0.022, 0.056, 0.008, 3), mat: paint, joint: 'legR', local: at(0, -0.109, 0.01), color: (p) => p.shoes },
      { geo: lathe(spline([[0, 0.085], [0.068, 0.085], [0.071, 0.1], [0.061, 0.16], [0.05, 0.215], [0.046, 0.25], [0.03, 0.262], [0, 0.266]], 24), 32), mat: paint, joint: 'body', color: (p) => p.clothes, wears: (p) => p.dress },
      { geo: lathe(spline([[0, 0.128], [0.056, 0.128], [0.058, 0.14], [0.054, 0.19], [0.048, 0.235], [0.03, 0.262], [0, 0.266]], 24), 32), mat: paint, joint: 'body', color: (p) => p.clothes, wears: (p) => !p.dress },
      { geo: armGeo, mat: paint, joint: 'armL', local: at(0, -0.05, 0), color: (p) => p.clothes },
      { geo: armGeo, mat: paint, joint: 'armR', local: at(0, -0.05, 0), color: (p) => p.clothes },
      { geo: sphere(0.016, 16, 12), mat: paint, joint: 'armL', local: at(0, -0.1, 0), color: (p) => p.skin },
      { geo: sphere(0.016, 16, 12), mat: paint, joint: 'armR', local: at(0, -0.1, 0), color: (p) => p.skin },
      { geo: sphere(0.064, 32, 24), mat: paint, joint: 'body', local: at(0, HEAD, 0), color: (p) => p.skin },
      { geo: sphere(0.0075, 12, 8), mat: dark, joint: 'body', local: at(-0.023, HEAD + 0.004, 0.058), cast: false },
      { geo: sphere(0.0075, 12, 8), mat: dark, joint: 'body', local: at(0.023, HEAD + 0.004, 0.058), cast: false },
      { geo: sphere(0.009, 12, 8), mat: blush, joint: 'body', local: at(-0.037, HEAD - 0.014, 0.048).multiply(new THREE.Matrix4().makeScale(1, 0.6, 0.5)), cast: false },
      { geo: sphere(0.009, 12, 8), mat: blush, joint: 'body', local: at(0.037, HEAD - 0.014, 0.048).multiply(new THREE.Matrix4().makeScale(1, 0.6, 0.5)), cast: false },
      // Hair: a cap; a bob (open over the face); a cap with a bun.
      { geo: sphere(0.068, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), mat: paint, joint: 'body', local: at(0, HEAD + 0.004, -0.004), color: (p) => p.hairColor, wears: (p) => p.hair !== 'bob' },
      { geo: lathe(spline([[0.0, 0.072], [0.042, 0.064], [0.068, 0.032], [0.072, -0.012], [0.066, -0.03]], 16), 32, Math.PI * 0.3, Math.PI * 1.4), mat: paint, joint: 'body', local: at(0, HEAD, -0.002), color: (p) => p.hairColor, wears: (p) => p.hair === 'bob' },
      { geo: sphere(0.026, 20, 14), mat: paint, joint: 'body', local: at(0, HEAD + 0.05, -0.048), color: (p) => p.hairColor, wears: (p) => p.hair === 'bun' && p.hat !== 'boater' },
      // Hats.
      { geo: sphere(0.074, 32, 12), mat: paint, joint: 'body', local: at(0.008, HEAD + 0.052, -0.006).multiply(new THREE.Matrix4().makeRotationZ(-0.18)).multiply(new THREE.Matrix4().makeScale(1, 0.32, 1)), color: (p) => p.accent, wears: (p) => p.hat === 'beret' },
      { geo: cylinder(0.094, 0.094, 0.006, 40, 1), mat: paint, joint: 'body', local: at(0, HEAD + 0.046, 0), color: () => new THREE.Color('#F2E2B8'), wears: (p) => p.hat === 'boater' },
      { geo: cylinder(0.058, 0.061, 0.034, 32, 1), mat: paint, joint: 'body', local: at(0, HEAD + 0.064, 0), color: () => new THREE.Color('#F2E2B8'), wears: (p) => p.hat === 'boater' },
      { geo: torus(0.06, 0.006, 8, 40), mat: paint, joint: 'body', local: at(0, HEAD + 0.053, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), color: (p) => p.accent, wears: (p) => p.hat === 'boater' },
      // A scarf, a bag.
      { geo: torus(0.033, 0.011, 8, 32), mat: fabric, joint: 'body', local: at(0, 0.262, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), color: (p) => p.accent, wears: (p) => p.scarf },
      { geo: roundedBox(0.044, 0.04, 0.016, 0.006, 3), mat: paint, joint: 'body', local: at(0.072, 0.15, 0.004), color: (p) => p.accent, wears: (p) => p.bag },
    ];
    this.parts = parts.map((part) => {
      const mesh = new THREE.InstancedMesh(part.geo, part.mat, count);
      mesh.name = 'townsperson';
      mesh.frustumCulled = false;
      mesh.castShadow = part.cast !== false;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (part.color) {
        this.people.forEach((p, i) => mesh.setColorAt(i, part.color(p)));
        mesh.instanceColor.needsUpdate = true;
      }
      this.group.add(mesh);
      return { ...part, mesh, local: part.local ?? new THREE.Matrix4() };
    });
    this.joints = { body: new THREE.Matrix4(), legL: new THREE.Matrix4(), legR: new THREE.Matrix4(), armL: new THREE.Matrix4(), armR: new THREE.Matrix4() };
    this.update(0);
  }

  // On along the way by `step`, onto the next stretch whenever one runs out.
  walk(p, step) {
    p.d += step;
    while (p.d >= p.leg.length && p.pause <= 0) {
      p.d -= p.leg.length;
      const r = ROUTES[p.q];
      switch (p.stage) {
        case 'out':
          [p.stage, p.leg] = ['lookout0', r.lookout[0]];
          break;
        case 'lookout0':
          [p.stage, p.leg] = ['lookout1', r.lookout[1]];
          // Half way round the compass rose some stop, facing out, to take in the view.
          if (this.rng() < 0.6) {
            p.pause = this.rng.range(2, 5);
            p.d = 0;
          }
          break;
        case 'lookout1':
          [p.stage, p.leg] = ['in', r.in];
          break;
        case 'in':
          [p.stage, p.leg] = ['enter', r.enter];
          break;
        case 'enter': {
          const u = this.rng();
          const n = u < ONWARD[0] ? 1 : u < ONWARD[0] + ONWARD[1] ? 2 : 3;
          [p.stage, p.leg] = ['ring', r.promenade[n - 1]];
          p.q = (p.q + n) % 4;
          break;
        }
        case 'ring':
          [p.stage, p.leg] = ['leave', r.leave];
          break;
        default:
          [p.stage, p.leg] = ['out', r.out];
      }
    }
    p.leg.at(Math.min(p.d, p.leg.length), p.pos, p.dir);
  }

  update(dt) {
    const ease = (tau) => (dt > 0 ? 1 - Math.exp(-dt / tau) : 1);
    for (const p of this.people) {
      // Slow for anyone close ahead in one's path, and wait a step behind them. Those on the promenade
      // never give way to those still coming in: they wait at the end of the street for a gap in the
      // walkers coming round (the promenade's own right of way).
      let clear = Infinity;
      for (const o of this.people) {
        if (o === p || (p.stage === 'ring' && o.stage === 'enter')) continue;
        const dx = o.pos.x - p.pos.x;
        const dz = o.pos.z - p.pos.z;
        const ahead = dx * p.dir.x + dz * p.dir.z;
        if (ahead > 0.02 && ahead < clear && Math.abs(dx * p.dir.z - dz * p.dir.x) < 0.16) clear = ahead;
      }
      if (p.stage === 'in' && p.leg.length - p.d < 0.3) {
        const merge = ROUTES[p.q].promenade[0];
        merge.at(0, _v, _s);
        for (const o of this.people) {
          if (o.stage !== 'ring') continue;
          // How far round the promenade they still have to come to where this bend joins it.
          const behind = Math.atan2(_v.x * o.pos.z - _v.z * o.pos.x, _v.x * o.pos.x + _v.z * o.pos.z) * RING;
          if (behind > -0.15 && behind < 0.55) clear = 0;
        }
      }
      const gap = 0.2;
      if (p.pause > 0) p.pause -= dt;
      const want = p.pause > 0 ? 0 : p.speed * THREE.MathUtils.smoothstep(clear, gap, gap + 0.2);
      p.pace += (want - p.pace) * ease(0.3);
      const step = p.pace * dt;
      this.walk(p, step);
      // Feet on the ground, eased over the small steps between the road and the paving.
      p.pos.y += (groundY(p.pos.x, p.pos.z) - p.pos.y) * ease(0.08);
      // Facing the way they walk, or out over the balustrade while they stop at the view.
      const yaw = p.pause > 0 ? ROUTES[p.q].view : Math.atan2(p.dir.x, p.dir.z);
      let turn = yaw - p.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      // Small corrections follow the way at once; a big turn (to the view and back) is made unhurried.
      p.heading += turn * ease(0.12 + 0.3 * THREE.MathUtils.smoothstep(Math.abs(turn), 0.2, 1.2));
      p.phase += (step / 0.1) * Math.PI;
    }
    this.pose();
  }

  // Each person's parts at their joints, swinging as they walk.
  pose() {
    const J = this.joints;
    this.people.forEach((p, i) => {
      const stride = Math.min(1, p.pace / p.speed); // shorter strides as they slow, feet together at rest
      const swing = Math.sin(p.phase) * stride;
      const bob = 0.006 * Math.abs(Math.sin(p.phase)) * stride;
      _m.compose(p.pos, _q.setFromAxisAngle(_v.set(0, 1, 0), p.heading), _s.setScalar(p.height));
      J.body.copy(_m).multiply(_j.makeTranslation(0, bob, 0)).multiply(_j.makeRotationZ(0.04 * swing));
      const limb = (target, x, y, rx, rz = 0) => target.copy(_m).multiply(_j.makeTranslation(x, y + bob * 0.5, 0)).multiply(_j.makeRotationFromEuler(_e.set(rx, 0, rz)));
      limb(J.legL, -0.026, HIP, 0.42 * swing);
      limb(J.legR, 0.026, HIP, -0.42 * swing);
      limb(J.armL, -0.057, SHOULDER, -0.35 * swing, -0.12);
      limb(J.armR, 0.057, SHOULDER, 0.35 * swing, 0.12);
      for (const part of this.parts) {
        const worn = !part.wears || part.wears(p);
        part.mesh.setMatrixAt(i, worn ? _j.multiplyMatrices(J[part.joint], part.local) : ZERO);
      }
    });
    for (const part of this.parts) part.mesh.instanceMatrix.needsUpdate = true;
  }
}
