import { beforeAll, expect, test } from 'vitest';
import { assemble, loadConfig } from '../src/assembly.js';
import { buildStraight } from '../src/track.js';
import { spec } from '../src/spec.js';
import * as sim from '../src/sim.js';

beforeAll(sim.initRapier);

test('P17_slider_spring_joint 彈簧內衝量保留滑板與車體同角速度，不延後一個物理步才修關節', () => {
  const asm = assemble({ ...loadConfig('default'), body: null, frontStay: 'stay-front-slide-soft', rearStay: 'stay-rear-slide-hard' });
  const env = sim.createWorld(buildStraight(4));
  try {
    const car = sim.createCar(env, { assembly: asm, powered: false });
    const bodies = [car.chassis, ...car.sliders.map((s) => s.body)];
    bodies.forEach((b) => b.recomputeMassPropertiesFromColliders());
    for (const [i, sl] of car.sliders.entries()) {
      const anchor = sim.localToWorld(car, sl.anchor);
      sl.body.setTranslation({ ...anchor, z: anchor.z + (i ? -0.0004 : 0.0005) }, true);
    }
    const momentum = () => bodies.reduce((p, b) => {
      const v = b.linvel(), m = b.mass();
      return { x: p.x + m * v.x, y: p.y + m * v.y, z: p.z + m * v.z };
    }, { x: 0, y: 0, z: 0 });
    const p0 = momentum();
    sim.applySliderSpringImpulses(car);
    const w = car.chassis.angvel(), p1 = momentum();
    expect(Math.hypot(w.x, w.y, w.z)).toBeGreaterThan(0);
    for (const sl of car.sliders) {
      const ws = sl.body.angvel();
      expect(Math.hypot(ws.x - w.x, ws.y - w.y, ws.z - w.z)).toBeLessThan(1e-7);
      const state = sim.sliderState(car, sl);
      expect(state.u * state.uDot).toBeLessThan(0);
    }
    for (const k of ['x', 'y', 'z']) expect(Math.abs(p1[k] - p0[k])).toBeLessThan(1e-8);
  } finally { env.world.free(); }
});

test('P17_slider_speculative_stop 未碰牆時也能預先限制下一步位移，守恆線動量且只耗能', () => {
  const asm = assemble({ ...loadConfig('default'), body: null, frontStay: 'stay-front-slide-soft', rearStay: 'stay-rear-slide-hard' });
  for (const slot of ['frontStay', 'rearStay']) for (const sign of [-1, 1]) {
    const env = sim.createWorld(buildStraight(4));
    try {
      const car = sim.createCar(env, { assembly: asm, s: 0.5, powered: false });
      const bodies = [car.chassis, ...car.sliders.map((sl) => sl.body)];
      bodies.forEach((b) => b.recomputeMassPropertiesFromColliders());
      const sl = car.sliders.find((s) => s.slot === slot);
      const anchor = sim.localToWorld(car, sl.anchor);
      sl.body.setTranslation({ ...anchor, z: anchor.z + sign * (sl.stroke - 0.0001) }, true);
      sl.body.setLinvel({ x: 0, y: 0, z: sign }, true);
      const momentum = () => bodies.reduce((p, b) => {
        const v = b.linvel(), m = b.mass();
        return { x: p.x + m * v.x, y: p.y + m * v.y, z: p.z + m * v.z };
      }, { x: 0, y: 0, z: 0 });
      const p0 = momentum(), e0 = sim.carKineticEnergy(car);
      expect(sim.rollerWallContacts(env, car)).toHaveLength(0);
      const before = sim.sliderState(car, sl);
      expect(sign * (before.u + spec.sim.dt_s * before.uDot)).toBeGreaterThan(sl.stroke);
      sim.wallContactImpulses(env, car);
      const after = sim.sliderState(car, sl), p1 = momentum();
      expect(sign * (after.u + spec.sim.dt_s * after.uDot)).toBeLessThanOrEqual(sl.stroke + 1e-8);
      expect(sim.carKineticEnergy(car)).toBeLessThan(e0);
      for (const k of ['x', 'y', 'z']) expect(Math.abs(p1[k] - p0[k])).toBeLessThan(1e-8);
      expect(after.u).toBe(before.u); // No position projection.
    } finally { env.world.free(); }
  }
});
