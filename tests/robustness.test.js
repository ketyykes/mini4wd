import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { assemble, loadConfig } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';
import { buildCircuit } from '../src/track.js';
import { spec } from '../src/spec.js';
import * as sim from '../src/sim.js';
import { dropTest } from './helpers/drop.js';

beforeAll(sim.initRapier);
const measurements = {};
afterAll(() => {
  mkdirSync(new URL('../tmp/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../tmp/robustness.json', import.meta.url), JSON.stringify(measurements, null, 2));
});

const dampers = [
  'damper-rear-cylinder', 'damper-side-square', 'damper-side-square-32',
  'damper-heavy', 'damper-square-8x8x14', 'damper-square-8x8x32',
  'damper-slim', 'damper-slim-short', 'damper-ar-side', 'damper-balllink-square',
];

describe('正式穩健性回歸', () => {
  test.each(dampers)('P17_drop_matrix %s：30–140 mm 水平與前後、左右傾斜落地，對照同質量鎖死組', (id) => {
    const config = { ...loadConfig('default'), body: null, rearStay: 'stay-rear-frp', massDamper: id };
    const free = assemble(config);
    const locked = assemble({ ...config, massDamper: { base: id, locked: true } });
    expect(validateAssembly(free).ok).toBe(true);
    expect(free.mass_g).toBeCloseTo(locked.mass_g, 9);
    const cases = [30, 60, 80, 90, 100, 110, 120, 140].map((h) => ({ h }));
    cases.push(...[{ pitch: 8 }, { pitch: -8 }, { roll: 8 }, { roll: -8 }].map((tilt) => ({ h: 100, ...tilt })));
    let reboundWins = 0;
    let airWins = 0;
    const rows = [];
    let freeAir = 0, lockedAir = 0, freeRebound = 0, lockedRebound = 0;
    measurements[id] = [];
    for (const scenario of cases) {
      const a = dropTest(free, scenario.h, scenario);
      const b = dropTest(locked, scenario.h, scenario);
      for (const result of [a, b]) {
        expect(result.landed, JSON.stringify(scenario)).toBe(true);
        expect(Object.values(result).every((v) => typeof v !== 'number' || Number.isFinite(v))).toBe(true);
        expect(result.minUp).toBeGreaterThan(0.8);
        expect(result.finalUp).toBeGreaterThan(0.99);
        // iter-94：射線輪開始接觸那一步改用離散梯度力後，落地過程任何一步的總機械能都不得高於落下前
        expect(result.maxEnergy).toBeLessThanOrEqual(result.initialEnergy);
        expect(result.finalEnergy).toBeLessThan(result.initialEnergy);
      }
      measurements[id].push({ scenario, free: a, locked: b });
      freeAir += a.air_ms; lockedAir += b.air_ms;
      freeRebound += a.rebound_mm; lockedRebound += b.rebound_mm;
      if (a.rebound_mm < b.rebound_mm) reboundWins++;
      if (a.air_ms < b.air_ms) airWins++;
      rows.push(`${scenario.h}/${scenario.pitch ?? 0}/${scenario.roll ?? 0}: ${a.rebound_mm.toFixed(3)}/${b.rebound_mm.toFixed(3)} mm, ${a.air_ms.toFixed(2)}/${b.air_ms.toFixed(2)} ms`);
    }
    // The damping benefit depends on height and attitude. Record every result;
    // do not assume that every damper improves every metric in every landing.
    expect(freeAir).toBeLessThan(lockedAir);
    // The heavy damper's delayed second push is already documented in P17_heavy_damper.
    if (id !== 'damper-heavy') expect(freeRebound).toBeLessThan(lockedRebound);
    console.log(`[P17] ${id} rebound wins ${reboundWins}/${cases.length}, air wins ${airWins}/${cases.length}\n${rows.join('\n')}`);
  });

  // Reconstruct the old eight-case diagnostic as a committed, reproducible matrix.
  const starts = [
    { s: 0.15, lane: 0, soc: 1 }, { s: 0.17, lane: 0, soc: 1 },
    { s: 0.19, lane: 0, soc: 1 }, { s: 0.21, lane: 0, soc: 1 },
    { s: 0.15, lane: 1, soc: 1 }, { s: 0.15, lane: 2, soc: 1 },
    { s: 0.15, lane: 0, soc: 0.9 }, { s: 0.21, lane: 2, soc: 0.9 },
  ];
  test.each(['default', 'p5-taiwan', 'p7-demo', 'p7-parts'])('P17_race_perturbations %s：起跑位置、車道、SOC 八組官方三圈', (name) => {
    const asm = assemble(loadConfig(name));
    expect(validateAssembly(asm).ok).toBe(true);
    const track = buildCircuit();
    const L = track.path.length;
    measurements[`${name}-race`] = [];
    for (const start of starts) {
      const env = sim.createWorld(track);
      try {
        const car = sim.createCar(env, { assembly: asm, ...start });
        let distance = 0;
        let last = start.s;
        let maxPen = 0;
        let minUp = 1;
        let steps = 0, maxSolverResidual = 0, solverFailures = 0, maxSolverIterations = 0;
        for (; steps < Math.ceil(30 / spec.sim.dt_s) && distance < 3 * L && minUp > 0.8; steps++) {
          sim.stepCar(env, car);
          if (car.wallSolve) {
            maxSolverResidual = Math.max(maxSolverResidual, car.wallSolve.residual);
            maxSolverIterations = Math.max(maxSolverIterations, car.wallSolve.iterations);
            solverFailures += +!car.wallSolve.converged;
          }
          const t = car.chassis.translation();
          const p = track.path.project(t.x, t.z);
          let ds = p.s - last;
          if (ds < -L / 2) ds += L;
          if (ds > L / 2) ds -= L;
          distance += ds;
          last = p.s;
          minUp = Math.min(minUp, sim.upAxis(car).y);
          maxPen = Math.max(maxPen, sim.wallPenetration(env, car));
        }
        const label = `${name} ${JSON.stringify(start)}`;
        measurements[`${name}-race`].push({ start, distance, simTime: steps * spec.sim.dt_s, maxPen_mm: maxPen * 1000, minUp, maxSolverResidual, maxSolverIterations, solverFailures });
        console.log(`[P17] ${label}: ${distance.toFixed(3)} m, ${(steps * spec.sim.dt_s).toFixed(3)} s, ${(maxPen * 1000).toFixed(3)} mm, up ${minUp.toFixed(3)}`);
        expect(distance, label).toBeGreaterThanOrEqual(3 * L);
        expect(maxPen, label).toBeLessThanOrEqual(0.001);
        expect(minUp, label).toBeGreaterThan(0.8);
        expect(solverFailures, label).toBe(0);
      } finally {
        env.world.free();
      }
    }
  }, 600000);
});
