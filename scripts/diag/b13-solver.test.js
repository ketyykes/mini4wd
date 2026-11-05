// B13：p7-demo {s 0.15, lane 0, soc 0.9} 牆接觸求解 256 次未收斂——抓出那一步，分析收斂行為
import { test, beforeAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { assemble, loadConfig } from '../../src/assembly.js';
import { buildCircuit } from '../../src/track.js';
import { spec } from '../../src/spec.js';
import { solveContactVelocities } from '../../src/contactSolver.js';
import * as sim from '../../src/sim.js';
beforeAll(async () => { await sim.initRapier(); });
const clone = (x) => JSON.parse(JSON.stringify(x));
test('solver', () => {
  const snaps = [];
  globalThis.__wallSolveDiag = (s) => snaps.push({ ...s, step: stepNo });
  let stepNo = 0;
  const asm = assemble(loadConfig('p7-demo'));
  const track = buildCircuit(); const L = track.path.length;
  const env = sim.createWorld(track);
  const car = sim.createCar(env, { assembly: asm, s: 0.15, lane: 0, soc: 0.9 });
  let d = 0, last = 0.15;
  for (; stepNo < Math.ceil(30 / spec.sim.dt_s) && d < 3 * L; stepNo++) {
    sim.stepCar(env, car);
    const t = car.chassis.translation(); const p = track.path.project(t.x, t.z);
    let ds = p.s - last; if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L; d += ds; last = p.s;
  }
  env.world.free();
  delete globalThis.__wallSolveDiag;
  console.log(`unconverged steps: ${snaps.length} (${snaps.map((s) => s.step).join(',')})`);
  writeFileSync('tmp/b13-solver-snaps.json', JSON.stringify(snaps));
  for (const s of snaps) {
    console.log(`step ${s.step}: ${s.contacts.length} contacts [${s.contacts.map((c) => `${c.roller}/${c.tier} mu=${c.mu} tgt=${(c.target ?? 0).toExponential(2)}`).join('; ')}], ${s.stops.length} stops`);
    const row = [];
    for (const n of [16, 32, 64, 128, 256, 512, 1024, 4096, 16384, 65536]) {
      const q = [...s.q];
      const r = solveContactVelocities(q, s.Minv, clone(s.contacts), clone(s.stops), { M: s.M, maxIterations: n });
      row.push(`${n}:${r.residual.toExponential(2)}${r.converged ? '✓' : ''}`);
    }
    console.log('  residual vs maxIterations  ' + row.join('  '));
  }
}, 3600000);
