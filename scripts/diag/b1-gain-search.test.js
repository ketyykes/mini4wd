// B1 診斷：隨機搜尋「同時多點恢復碰撞（法向速度目標 −e·v_n）」使系統動能增加的案例
// pnpm exec vitest run --config scripts/diag/vitest.diag.config.js scripts/diag/b1-gain-search.test.js --silent=false
import { test } from 'vitest';
import { solveContactVelocities } from '../../src/contactSolver.js';
let seed = 11;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const L = Math.hypot(...v); return v.map((x) => x / L); };
test('search', () => {
  let found = 0, tried = 0, worst = 0;
  for (let trial = 0; trial < 40000 && found < 3; trial++) {
    const I = [0.02 + rnd() * 0.3, 0.02 + rnd() * 0.3, 0.02 + rnd() * 0.3];
    const M = [1, 1, 1, ...I].map((m, i) => Array.from({ length: 6 }, (_, k) => (k === i ? m : 0)));
    const Minv = M.map((row, i) => row.map((x, k) => (k === i ? 1 / x : 0)));
    const q0 = Array.from({ length: 6 }, () => rnd() * 2 - 1);
    const nc = 2 + Math.floor(rnd() * 3);
    const contacts = [];
    for (let k = 0; k < nc; k++) {
      const p = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
      const n = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
      const seedv = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const t1 = norm(cross(n, seedv)), t2 = cross(n, t1);
      const J = (d) => [...d, ...cross(p, d)];
      const j = J(n);
      const vn = j.reduce((s, x, i) => s + x * q0[i], 0);
      if (vn >= 0) continue;
      const e = rnd();
      contacts.push({ j, tangents: [J(t1), J(t2)], mu: rnd() < 0.5 ? 0 : rnd(), target: -e * vn });
    }
    if (contacts.length < 2) continue;
    tried++;
    const q = [...q0];
    const r = solveContactVelocities(q, Minv, contacts, []);
    if (!r.converged) continue;
    const ke = (v) => 0.5 * v.reduce((s, x, i) => s + M[i][i] * x * x, 0);
    const rel = (ke(q) - ke(q0)) / ke(q0);
    worst = Math.max(worst, rel);
    if (rel > 1e-6) { found++; console.log('GAIN', JSON.stringify({ I, q0, contacts: contacts.map((c) => ({ j: c.j, tangents: c.tangents, mu: c.mu, target: c.target })), rel })); }
  }
  console.log('tried', tried, 'found', found, 'worst rel', worst);
});
