// C_d 敏感度：C_d 0.6 是推估（查不到迷你四驅實測／CFD），量化它對理論極速與三圈時間的影響
import { test, beforeAll } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { theoreticalTopSpeed } from '../../src/powertrain.js';
import { spec } from '../../src/spec.js';
import { buildCircuit } from '../../src/track.js';
import { initRapier, createWorld, createCar, stepCar, upAxis } from '../../src/sim.js';
beforeAll(async () => { await initRapier(); });

/** @type {(cfg: object) => number} 3 圈時間（s），飛出回傳 NaN */
function lapTime(cfg) {
  const asm = assemble(cfg);
  const track = buildCircuit();
  const L = track.path.length;
  const env = createWorld(track);
  const car = createCar(env, { assembly: asm, s: 0.15, lane: 0, soc: 1 });
  let d = 0, last = 0.15, steps = 0, up = 1;
  for (; steps < Math.ceil(30 / spec.sim.dt_s) && d < 3 * L && up > 0.8; steps++) {
    stepCar(env, car);
    const t = car.chassis.translation();
    const p = track.path.project(t.x, t.z);
    let ds = p.s - last;
    if (ds < -L / 2) ds += L;
    if (ds > L / 2) ds -= L;
    d += ds; last = p.s;
    up = Math.min(up, upAxis(car).y);
  }
  env.world.free();
  return d >= 3 * L ? steps * spec.sim.dt_s : NaN;
}

test('cd sensitivity', () => {
  const base = spec.aero.dragCoeff;
  for (const name of ['default', 'p7-demo', 'vz-tuned']) {
    const row = [];
    for (const cd of [0.4, 0.6, 0.9]) {
      spec.aero.dragCoeff = cd;
      const asm = assemble(loadConfig(name));
      const v = theoreticalTopSpeed({ assembly: asm, soc: 1 }).vTheory;
      row.push(`Cd ${cd}: v ${v.toFixed(3)} m/s、3 圈 ${lapTime(loadConfig(name)).toFixed(2)} s`);
    }
    spec.aero.dragCoeff = base;
    console.log(`CD ${name} | ${row.join(' | ')}`);
  }
});
