// B13 診斷：導輪實測滾動阻力／軸向滑動摩擦各自對三圈的影響
import { test, beforeAll } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { buildCircuit } from '../../src/track.js';
import { spec } from '../../src/spec.js';
import * as sim from '../../src/sim.js';
beforeAll(async () => { await sim.initRapier(); });
const run = (asm) => {
  const track = buildCircuit(); const env = sim.createWorld(track);
  const car = sim.createCar(env, { assembly: asm, s: 0.15, lane: 0 });
  const L = track.path.length; let last = 0.15, dist = 0, maxPen = 0, minUp = 1, t = 0;
  for (let i = 0; i < Math.round(12 / spec.sim.dt_s) && dist < 3 * L; i++) {
    sim.stepCar(env, car); t += spec.sim.dt_s;
    const p = car.chassis.translation(); const c = track.path.project(p.x, p.z);
    let ds = c.s - last; if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L; dist += ds; last = c.s;
    maxPen = Math.max(maxPen, sim.wallPenetration(env, car)); minUp = Math.min(minUp, sim.upAxis(car).y);
    if (minUp < 0.5) break;
  }
  env.world.free();
  return `dist ${dist.toFixed(2)}/${(3 * L).toFixed(2)} t ${t.toFixed(2)} pen ${(maxPen * 1000).toFixed(2)} up ${minUp.toFixed(3)}`;
};
test('variants', () => {
  const ax0 = spec.track.rollerAxialFriction;
  for (const name of ['default', 'p7-demo']) {
    const asm = assemble(loadConfig(name));
    for (const [label, ax] of [['tires-only', undefined]]) {
      spec.track.rollerAxialFriction = ax;
      console.log(name, label.padEnd(20), run(asm));
    }
  }
  spec.track.rollerAxialFriction = ax0;
});
