// B1 診斷（iter-101）：牆接觸（自訂共用求解）與地板／輪胎（Rapier）分步 → 步長收斂測試
// npx vitest run --config scripts/diag/vitest.diag.config.js scripts/diag/b1-split-dt.test.js --silent=false
import { test, beforeAll } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { buildCircuit } from '../../src/track.js';
import { spec } from '../../src/spec.js';
import * as sim from '../../src/sim.js';
beforeAll(async () => { await sim.initRapier(); });
test('split', () => {
  const dt0 = spec.sim.dt_s;
  for (const name of ['default', 'p7-demo']) {
    const asm = assemble(loadConfig(name));
    const res = [];
    for (const k of [1, 2, 4]) {
      spec.sim.dt_s = dt0 / k;
      const track = buildCircuit();
      const env = sim.createWorld(track);
      const car = sim.createCar(env, { assembly: asm, s: 0.15, lane: 0 });
      const L = track.path.length;
      let last = 0.15, dist = 0, contactSteps = 0, steps = 0;
      const T = 2.5;
      for (let i = 0; i < Math.round(T / spec.sim.dt_s); i++) {
        sim.stepCar(env, car);
        const t = car.chassis.translation();
        const c = track.path.project(t.x, t.z);
        let ds = c.s - last; if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L;
        dist += ds; last = c.s; steps++;
        if (sim.rollerWallContacts(env, car).length) contactSteps++;
      }
      res.push({ k, dist, v: sim.forwardSpeed(car), wall: contactSteps / steps });
      env.world.free();
    }
    spec.sim.dt_s = dt0;
    console.log(name, res.map((r) => `dt/${r.k}: ${r.dist.toFixed(4)} m v ${r.v.toFixed(4)} wall ${(r.wall * 100).toFixed(1)}%`).join(' | '),
      `Δ12 ${((res[0].dist - res[1].dist) / res[1].dist * 100).toFixed(3)}% Δ24 ${((res[1].dist - res[2].dist) / res[2].dist * 100).toFixed(3)}%`);
  }
});
