// P06 chatter 追蹤（iter-04）：記錄單圈中每顆導輪的接觸距離與車體橫向速度，找出最大穿透發生的情境（入彎撞擊 vs 穩態）
import { test } from 'vitest';
import { spec } from '../../src/spec.js';
import { buildCircuit } from '../../src/track.js';
import { initRapier, createWorld, createCar, stepCar, wallPenetration, minWallContactDist, forwardSpeed } from '../../src/sim.js';

test('trace', async () => {
  await initRapier();
  const variants = JSON.parse(process.env.P06_VARIANTS ?? '[{}]');
  for (const v of variants) {
    const alpha0 = spec.tire.slipAngleSaturation_rad;
    if (v.alpha) spec.tire.slipAngleSaturation_rad = v.alpha;
    const track = buildCircuit();
    const env = createWorld(track);
    if (v.freq) env.world.integrationParameters.contact_natural_frequency = v.freq;
    if (v.pgs) env.world.integrationParameters.numInternalPgsIterations = v.pgs;
    if (v.pred) env.world.integrationParameters.normalizedPredictionDistance = v.pred;
    const car = createCar(env, { s: v.s0 ?? 0.15, lane: v.lane ?? 0 });
    if (v.rest !== undefined) for (const r of car.rollers) r.collider.setRestitution(v.rest);
    const log = [];
    let worst = { d: 1 };
    let worstGeo = -1;
    const n = Math.round(2.6 / spec.sim.dt_s);
    for (let i = 0; i < n; i++) {
      stepCar(env, car);
      const t = car.chassis.translation();
      const c = track.path.project(t.x, t.z);
      const vel = car.chassis.linvel();
      const ang = car.chassis.angvel();
      let m = 1;
      let id = '';
      for (const r of car.rollers) {
        const d = minWallContactDist(env, r.collider);
        if (d < m) { m = d; id = r.id; }
      }
      worstGeo = Math.max(worstGeo, wallPenetration(env, car));
      log.push({ i, s: c.s, seg: c.seg.type, d: c.d, m, id, yaw: ang.y, v: forwardSpeed(car) });
      if (m < worst.d) worst = { d: m, i, id, s: c.s, seg: c.seg.type };
    }
    spec.tire.slipAngleSaturation_rad = alpha0;
    console.log(JSON.stringify(v), 'worst contact', (worst.d * 1000).toFixed(3), 'mm', JSON.stringify(worst), 'geo', (worstGeo * 1000).toFixed(3));
    if (!v.quiet) {
      const k0 = Math.max(0, worst.i - 200);
      for (let k = k0; k < Math.min(log.length, worst.i + 40); k += 10) {
        const e = log[k];
        console.log(e.i, e.s.toFixed(3), e.seg, (e.d * 1000).toFixed(2), e.id, e.m < 1 ? (e.m * 1000).toFixed(3) : '-', 'yaw', e.yaw.toFixed(3), 'v', e.v.toFixed(3));
      }
    }
  }
}, 600000);
