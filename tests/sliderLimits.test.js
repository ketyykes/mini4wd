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

test('P17_slider_wall_friction 真實牆接觸與雙滑板：有摩擦時同一步守住預測行程且耗能', () => {
  for (const stays of [false, true]) for (const sign of [-1, 1]) {
    const asm = assemble({ ...loadConfig('default'), body: null, ...(stays ? { frontStay: 'stay-front-slide-soft', rearStay: 'stay-rear-slide-hard' } : {}) });
    const track = buildStraight(4), env = sim.createWorld(track);
    try {
      const car = sim.createCar(env, { assembly: asm, s: 0.5, powered: false });
      const bodies = [car.chassis, ...car.sliders.map((sl) => sl.body)];
      bodies.forEach((b) => b.recomputeMassPropertiesFromColliders());
      const r = car.rollers.find((r) => r.id === (sign > 0 ? 'FR' : 'FL'));
      // Isolate one geometric contact. Rapier is not stepped during this diagnostic.
      car.rollers = [r];
      const face = track.wallsAt(0)[sign > 0 ? 0 : 1].d - sign * track.dims.wallT / 2;
      const t = car.chassis.translation();
      car.chassis.setTranslation({ ...t, z: face - r.z / 1000 - sign * (r.r / 1000 - 0.0003) }, true);
      for (const sl of car.sliders) {
        const anchor = sim.localToWorld(car, sl.anchor);
        sl.body.setTranslation({ ...anchor, z: anchor.z + sign * (sl.stroke - 0.00001) }, true);
      }
      bodies.forEach((b) => { b.setLinvel({ x: 2, y: 0, z: sign * 0.2 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); });
      const contacts = sim.rollerWallContacts(env, car);
      expect(contacts.length).toBeGreaterThan(0);
      expect(contacts[0].mu).toBeGreaterThan(0);
      const e0 = sim.carKineticEnergy(car), vx0 = car.chassis.linvel().x;
      sim.wallContactImpulses(env, car);
      expect(car.wallSolve.converged, JSON.stringify(car.wallSolve)).toBe(true);
      expect(sim.carKineticEnergy(car)).toBeLessThan(e0);
      expect(car.chassis.linvel().x).toBeLessThan(vx0);
      for (const sl of car.sliders) {
        const { u, uDot } = sim.sliderState(car, sl);
        expect(Math.abs(u + spec.sim.dt_s * uDot)).toBeLessThanOrEqual(sl.stroke + 1e-8);
        const w = car.chassis.angvel(), ws = sl.body.angvel();
        expect(Math.hypot(w.x - ws.x, w.y - ws.y, w.z - ws.z)).toBeLessThan(1e-7);
      }
    } finally { env.world.free(); }
  }
});

test('P17_slider_velocity_projection 理想關節速度投影守恆線／角動量且只移除違反關節的動能', () => {
  const asm = assemble({ ...loadConfig('default'), body: null, frontStay: 'stay-front-slide-soft', rearStay: 'stay-rear-slide-hard' });
  const env = sim.createWorld(buildStraight(4));
  try {
    const car = sim.createCar(env, { assembly: asm, powered: false });
    const bodies = [car.chassis, ...car.sliders.map((sl) => sl.body)];
    bodies.forEach((b, i) => {
      b.recomputeMassPropertiesFromColliders();
      b.setLinvel({ x: 0.5 + i * 0.2, y: -0.3 * i, z: 0.1 - i * 0.4 }, true);
      b.setAngvel({ x: 1 + i, y: -2 * i, z: i * 0.7 }, true);
    });
    for (const sl of car.sliders) sl.k = sl.kSeat = sl.F0 = sl.c = 0;
    const momentum = () => bodies.reduce((sum, b) => {
      const v = b.linvel(), w = b.angvel(), r = b.worldCom(), m = b.mass(), A = b.effectiveWorldInvInertia();
      // Independent adjugate inverse of the symmetric inverse-inertia tensor.
      const a = A.m11, bb = A.m12, c = A.m13, d = A.m22, e = A.m23, f = A.m33;
      const det = a * (d * f - e * e) - bb * (bb * f - c * e) + c * (bb * e - c * d);
      const I = [[d * f - e * e, c * e - bb * f, bb * e - c * d], [c * e - bb * f, a * f - c * c, bb * c - a * e], [bb * e - c * d, bb * c - a * e, a * d - bb * bb]].map((row) => row.map((x) => x / det));
      const spin = I.map((row) => row[0] * w.x + row[1] * w.y + row[2] * w.z);
      return sum.map((x, i) => x + [m * v.x, m * v.y, m * v.z,
        spin[0] + m * (r.y * v.z - r.z * v.y), spin[1] + m * (r.z * v.x - r.x * v.z), spin[2] + m * (r.x * v.y - r.y * v.x)][i]);
    }, [0, 0, 0, 0, 0, 0]);
    const p0 = momentum(), e0 = sim.carKineticEnergy(car);
    sim.applySliderSpringImpulses(car);
    const p1 = momentum();
    p1.forEach((x, i) => expect(Math.abs(x - p0[i])).toBeLessThan(1e-8));
    expect(sim.carKineticEnergy(car)).toBeLessThan(e0);
    const w = car.chassis.angvel();
    for (const sl of car.sliders) {
      const ws = sl.body.angvel();
      expect(Math.hypot(w.x - ws.x, w.y - ws.y, w.z - ws.z)).toBeLessThan(1e-7);
    }
  } finally { env.world.free(); }
});

test('P17_wall_split_position 水平牆位置穩定化整組平移，保留內部行程、速度、重力與彈簧能', () => {
  const asm = assemble({ ...loadConfig('p7-demo'), frontStay: 'stay-front-slide-soft', rearStay: 'stay-rear-slide-hard' });
  const track = buildStraight(4), env = sim.createWorld(track);
  try {
    const car = sim.createCar(env, { assembly: asm, s: 0.5, powered: false });
    const bodies = [car.chassis, ...car.sliders.map((sl) => sl.body), ...car.dampers.map((d) => d.body)];
    const r = car.rollers.find((r) => r.id === 'FR');
    car.rollers = [r];
    const face = track.wallsAt(0)[0].d - track.dims.wallT / 2;
    const dz = face - r.z / 1000 - r.r / 1000 + 0.0004 - car.chassis.translation().z;
    for (const b of bodies) {
      b.recomputeMassPropertiesFromColliders();
      const p = b.translation(); b.setTranslation({ ...p, z: p.z + dz }, true);
      b.setLinvel({ x: 2, y: 0, z: 0 }, true);
    }
    const before = bodies.map((b) => ({ p: b.translation(), v: b.linvel(), w: b.angvel() }));
    const u0 = car.sliders.map((sl) => sim.sliderState(car, sl).u), e0 = sim.carKineticEnergy(car);
    sim.stabilizeWallPositions(env, car);
    const delta = car.chassis.translation().z - before[0].p.z;
    expect(delta).toBeLessThan(0);
    bodies.forEach((b, i) => {
      expect(b.translation().x).toBe(before[i].p.x);
      expect(b.translation().y).toBe(before[i].p.y);
      expect(b.translation().z - before[i].p.z).toBeCloseTo(delta, 7);
      expect(b.linvel()).toEqual(before[i].v);
      expect(b.angvel()).toEqual(before[i].w);
    });
    car.sliders.forEach((sl, i) => expect(sim.sliderState(car, sl).u).toBeCloseTo(u0[i], 7));
    expect(sim.carKineticEnergy(car)).toBeCloseTo(e0, 9);
    expect(Math.max(...sim.rollerWallContacts(env, car).map((c) => c.pen))).toBeLessThanOrEqual(spec.sim.wallProjectionSlop_mm / 1000 + 1e-7);
  } finally { env.world.free(); }
});

test('P17_wall_tiers 逐層幾何與摩擦：傾斜後只有上層橡膠環接觸，不借用下層大徑', () => {
  const asm = assemble({ ...loadConfig('default'), body: null, frontRollers: 'roller-13-12-alu-double-rubber' });
  for (const degrees of [0, 12]) {
    const track = buildStraight(4), env = sim.createWorld(track);
    try {
      const car = sim.createCar(env, { assembly: asm, s: 0.5, powered: false });
      const angle = degrees * Math.PI / 180;
      car.chassis.setRotation({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) }, true);
      const r = car.rollers.find((r) => r.id === 'FR'), upper = r.tiers[1];
      car.rollers = [r];
      const p = car.chassis.translation(), face = track.wallsAt(0)[0].d - track.dims.wallT / 2;
      const upperZ = ((r.y + upper.y) * Math.sin(angle) + r.z * Math.cos(angle)) / 1000;
      car.chassis.setTranslation({ ...p, z: face - upperZ - upper.r / 1000 + 0.0002 }, true);
      const contacts = sim.rollerWallContacts(env, car);
      expect(contacts.find((c) => c.tier === 1).mu).toBe(0.1);
      expect(contacts.find((c) => c.tier === 1).pen).toBeCloseTo(0.0002, 7);
      if (degrees === 0) {
        expect(contacts).toHaveLength(2);
        expect(contacts.find((c) => c.tier === 0).mu).toBe(0.05);
      } else {
        expect(contacts).toHaveLength(1);
        expect(contacts[0].tier).toBe(1);
      }
    } finally { env.world.free(); }
  }
});
