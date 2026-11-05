// P06 穿透診斷：比較 Rapier 步長、求解迭代、允許穿透等設定下，單圈中導輪對牆的最大穿透
import { test } from 'vitest';
import { spec } from '../../src/spec.js';
import { buildCircuit } from '../../src/track.js';
import { initRapier, createWorld, createCar, stepCar, wallPenetration, minWallContactDist, forwardSpeed } from '../../src/sim.js';

function run(cfg) {
  spec.sim.dt_s = cfg.dt ?? 0.001;
  const track = buildCircuit();
  const env = createWorld(track);
  const ip = env.world.integrationParameters;
  if (cfg.iters) ip.numSolverIterations = cfg.iters;
  if (cfg.pgs) ip.numInternalPgsIterations = cfg.pgs;
  if (cfg.freq) ip.contact_natural_frequency = cfg.freq;
  if (cfg.ccd) ip.maxCcdSubsteps = cfg.ccd;
  if (cfg.ale) ip.normalizedAllowedLinearError = cfg.ale;
  if (cfg.pred) ip.normalizedPredictionDistance = cfg.pred;
  console.log('defaults', ip.normalizedPredictionDistance, ip.normalizedAllowedLinearError, ip.lengthUnit);
  const car = createCar(env, { s: 0.15, lane: 0 });
  if (cfg.rest !== undefined) for (const r of car.rollers) r.collider.setRestitution(cfg.rest);
  let worst = { pen: -1 }, worstC = { d: 1 };
  for (let i = 0; i < 2.7 / spec.sim.dt_s; i++) {
    stepCar(env, car);
    const p = wallPenetration(env, car);
    const t = car.chassis.translation();
    const c = track.path.project(t.x, t.z);
    if (p > worst.pen) worst = { pen: p, s: c.s, seg: c.seg.type, v: forwardSpeed(car), i };
    for (const r of car.rollers) { const d = minWallContactDist(env, r.collider); if (d < worstC.d) worstC = { d, id: r.id, s: c.s, i }; }
    if (cfg.trace && i % Math.round(0.1/spec.sim.dt_s) === 0) { let m = 1; for (const r of car.rollers) m = Math.min(m, minWallContactDist(env, r.collider)); console.log('T', i, c.s.toFixed(2), c.seg.type, forwardSpeed(car).toFixed(2), (p*1000).toFixed(3), (m*1000).toFixed(3)); }
    const d = minWallContactDist(env, car.bodyCol); if (d < worstC.d) worstC = { d, id: 'body', s: c.s, i };
  }
  console.log(JSON.stringify(cfg), 'geo', (worst.pen*1000).toFixed(3), JSON.stringify(worst), 'contact', (worstC.d*1000).toFixed(3), JSON.stringify(worstC));
}
test('diag', async () => {
  await initRapier();
  for (const cfg of [{dt:0.00025,pred:0.05},{dt:0.00025,iters:16},{dt:0.00025,rest:0},{dt:0.0005,rest:0},{dt:0.00025,iters:4}]) run(cfg);
}, 600000);
