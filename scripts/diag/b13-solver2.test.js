import { test } from 'vitest';
import { readFileSync } from 'node:fs';
import { solveContactVelocities } from '../../src/contactSolver.js';
const clone = (x) => JSON.parse(JSON.stringify(x));
test('iters', () => {
  const [s] = JSON.parse(readFileSync('tmp/b13-solver-snaps.json', 'utf8'));
  for (const n of [2048, 4096, 8192]) {
    const q = [...s.q];
    const t0 = performance.now();
    const r = solveContactVelocities(q, s.Minv, clone(s.contacts), clone(s.stops), { M: s.M, maxIterations: n });
    console.log(`max ${n}: iterations ${r.iterations}, residual ${r.residual.toExponential(3)}, converged ${r.converged}, guard ${!!r.energyGuard} α ${r.restitutionScale}, ${(performance.now() - t0).toFixed(1)} ms`);
  }
  // 不加能量守門（沒傳 M）的單次求解：看摩擦 GS 本身要幾次
  for (const n of [256, 1024, 4096]) {
    const q = [...s.q];
    const r = solveContactVelocities(q, s.Minv, clone(s.contacts), clone(s.stops), { maxIterations: n });
    console.log(`noGuard max ${n}: iterations ${r.iterations}, residual ${r.residual.toExponential(3)}`);
  }
}, 600000);
