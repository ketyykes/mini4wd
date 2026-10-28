// Coupled velocity-level contact constraints in arbitrary generalized coordinates.
// No position bias, warm start, or part-specific coefficients; restitution is
// supplied by the caller as a contact-entry normal velocity target.
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const response = (Minv, j) => Minv.map((row) => dot(row, j));
const apply = (q, w, impulse) => { for (let i = 0; i < q.length; i++) q[i] += w[i] * impulse; };

// Minimize 1/2 f' K f - b' f within a circular Coulomb bound.
// Clipping K^-1 b radially is incorrect when the two effective masses differ.
function frictionDisk(a, b, d, bx, by, radius) {
  if (!(radius > 0)) return [0, 0];
  const solve = (alpha) => {
    const det = (a + alpha) * (d + alpha) - b * b;
    return [((d + alpha) * bx - b * by) / det, ((a + alpha) * by - b * bx) / det];
  };
  const free = solve(0);
  if (Math.hypot(...free) <= radius) return free;
  let lo = 0, hi = Math.hypot(bx, by) / radius;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (Math.hypot(...solve(mid)) > radius) lo = mid; else hi = mid;
  }
  return solve(hi);
}

// Solve the small positive-definite active normal/stop block. Normalizing the
// diagonal makes the rank check independent of mass and length units.
function activeSolution(A, rhs, active) {
  const scale = active.map((i) => Math.sqrt(A[i][i]));
  const L = active.map(() => new Array(active.length).fill(0));
  for (let i = 0; i < active.length; i++) for (let j = 0; j <= i; j++) {
    let value = A[active[i]][active[j]] / (scale[i] * scale[j]);
    for (let k = 0; k < j; k++) value -= L[i][k] * L[j][k];
    if (i === j) {
      if (value < 1e-12) return null; // Redundant row; do not regularize the physics.
      L[i][j] = Math.sqrt(value);
    } else L[i][j] = value / L[j][j];
  }
  const y = active.map((i, k) => rhs[i] / scale[k]);
  for (let i = 0; i < y.length; i++) {
    for (let k = 0; k < i; k++) y[i] -= L[i][k] * y[k];
    y[i] /= L[i][i];
  }
  for (let i = y.length - 1; i >= 0; i--) {
    for (let k = i + 1; k < y.length; k++) y[i] -= L[k][i] * y[k];
    y[i] /= L[i][i];
  }
  return y.map((v, k) => v / scale[k]);
}

// Nonnegative quadratic active set. Simultaneous normals/stops avoid the very
// slow scalar iteration caused by a 6 g sliding plate against a 120 g body.
function solveNormals(q, rows, A, tolerance) {
  const base = [...q];
  rows.forEach((c) => apply(base, c.w, -c.acc));
  const b = rows.map((c) => dot(c.j, base) - (c.target ?? 0));
  const lambda = rows.map(() => 0), active = [], redundant = new Set();
  const maxPivots = 8 * (rows.length + 1) ** 2;
  for (let pivot = 0; pivot < maxPivots; pivot++) {
    let enter = -1, worst = -tolerance;
    for (let i = 0; i < rows.length; i++) {
      if (active.includes(i) || redundant.has(i)) continue;
      const gradient = b[i] + dot(A[i], lambda);
      if (gradient < worst) { worst = gradient; enter = i; }
    }
    if (enter < 0) break;
    active.push(enter);
    for (let inner = 0; inner < maxPivots; inner++) {
      const z = activeSolution(A, b.map((x) => -x), active);
      if (!z) { active.pop(); redundant.add(enter); break; }
      if (z.every((x) => x > 0)) {
        lambda.fill(0);
        active.forEach((i, k) => { lambda[i] = z[k]; });
        break;
      }
      let alpha = 1;
      active.forEach((i, k) => { if (z[k] <= 0) alpha = Math.min(alpha, lambda[i] / (lambda[i] - z[k] || 1)); });
      active.forEach((i, k) => { lambda[i] += alpha * (z[k] - lambda[i]); });
      for (let k = active.length - 1; k >= 0; k--) {
        if (lambda[active[k]] <= 1e-14) { lambda[active[k]] = 0; active.splice(k, 1); }
      }
      redundant.clear();
    }
  }
  rows.forEach((c, i) => { apply(q, c.w, lambda[i] - c.acc); c.acc = lambda[i]; });
}

/**
 * Mutates q; contact rows have j (normal), tangents (two orthonormal directions'
 * Jacobians), mu, and optional restitution velocity target. Limits have j
 * and a nonpositive speculative target. The mass matrix must be SPD.
 * Accumulated impulses reset each physical step. Every sweep couples normal,
 * disk-constrained friction and travel stops; only impulse differences apply.
 * Passing the mass matrix M (options) enables the energy guard described below.
 */
export function solveContactVelocities(q, Minv, contacts, limits = [], { maxIterations = 64, tolerance = 1e-9, M = null } = {}) {
  if (!M) return solveOnce(q, Minv, contacts, limits, maxIterations, tolerance);
  // iter-98（B1）：全域能量保證。同時多點恢復碰撞（法向目標 −e·v_n）的聯立解可能讓 ½qᵀMq 增加
  // （隨機 6 自由度多接觸案例最多 +1.8%，見 scripts/diag/b1-gain-search.test.js）。增加時把所有恢復目標等比例縮小，
  // 二分到剛好不增能的最大比例 α。α = 0 時所有法向／止擋目標 ≤ 0：ΔKE = λᵀv₁ − ½λᵀAλ ≤ 0，摩擦圓盤只耗能 → 必定不增能
  const q0 = [...q];
  const e0 = kineticEnergy(q0, M);
  const targets = contacts.map((c) => c.target ?? 0);
  const restituting = targets.some((t) => t > 0);
  let result = solveOnce(q, Minv, contacts, limits, maxIterations, tolerance);
  let e1 = kineticEnergy(q, M);
  if (!restituting || e1 <= e0) return { ...result, energyBefore: e0, energyAfter: e1, restitutionScale: 1 };
  /** @type {(alpha: number) => { result: any, q: number[], e: number }} 以比例 α 縮小恢復目標後重解 */
  const trial = (alpha) => {
    const qa = [...q0];
    contacts.forEach((c, i) => { c.target = targets[i] > 0 ? alpha * targets[i] : targets[i]; });
    const r = solveOnce(qa, Minv, contacts, limits, maxIterations, tolerance);
    return { result: r, q: qa, e: kineticEnergy(qa, M) };
  };
  let lo = 0, hi = 1;
  for (let it = 0; it < 30 && hi - lo > 1e-6; it++) {
    const mid = (lo + hi) / 2;
    if (trial(mid).e <= e0) lo = mid; else hi = mid;
  }
  // 以 α = lo 重解一次：q、contact 的 acc／friction／target 都對應實際採用的解
  const final = trial(lo);
  q.splice(0, q.length, ...final.q);
  result = final.result;
  e1 = final.e;
  return { ...result, energyBefore: e0, energyAfter: e1, restitutionScale: lo, energyGuard: true };
}

/** @type {(v: number[], M: number[][]) => number} 廣義速度的動能 ½vᵀMv */
export const kineticEnergy = (v, M) => 0.5 * M.reduce((sum, row, i) => sum + v[i] * dot(row, v), 0);

function solveOnce(q, Minv, contacts, limits, maxIterations, tolerance) {
  const rows = [...contacts, ...limits];
  for (const c of rows) {
    c.w = response(Minv, c.j);
    c.K = dot(c.j, c.w);
    c.acc = 0;
  }
  for (const c of contacts) {
    c.tw = c.tangents.map((j) => response(Minv, j));
    c.tk = [dot(c.tangents[0], c.tw[0]), dot(c.tangents[0], c.tw[1]), dot(c.tangents[1], c.tw[1])];
    c.friction = [0, 0];
  }
  let iterations = 0, residual = Infinity;
  const A = rows.map((c) => rows.map((d) => dot(c.j, d.w)));
  for (; iterations < maxIterations; iterations++) {
    const before = [...q];
    solveNormals(q, rows, A, tolerance);
    for (const c of contacts) {
      const [a, b, d] = c.tk;
      const [fx, fy] = c.friction;
      const next = frictionDisk(a, b, d,
        a * fx + b * fy - dot(c.tangents[0], q),
        b * fx + d * fy - dot(c.tangents[1], q), c.mu * c.acc);
      apply(q, c.tw[0], next[0] - fx);
      apply(q, c.tw[1], next[1] - fy);
      c.friction = next;
    }
    // Finish each sweep with stops, so friction cannot invalidate a just-solved limit.
    solveNormals(q, rows, A, tolerance);
    const delta = q.map((v, i) => v - before[i]);
    residual = Math.max(0,
      ...rows.map((c) => Math.abs(dot(c.j, delta))),
      ...contacts.flatMap((c) => c.tangents.map((j) => Math.abs(dot(j, delta)))),
      ...rows.map((c) => {
      const vn = dot(c.j, q) - (c.target ?? 0);
      return c.acc > 0 ? Math.abs(vn) : Math.max(0, -vn);
    }));
    if (residual <= tolerance) {
      // Verify the final friction fixed point after the last normal/stop block,
      // including a shrinking cone; small net q changes alone are insufficient.
      for (const c of contacts) {
        const [a, b, d] = c.tk, [fx, fy] = c.friction;
        const next = frictionDisk(a, b, d,
          a * fx + b * fy - dot(c.tangents[0], q),
          b * fx + d * fy - dot(c.tangents[1], q), c.mu * c.acc);
        const dx = next[0] - fx, dy = next[1] - fy;
        residual = Math.max(residual, Math.abs(a * dx + b * dy), Math.abs(b * dx + d * dy));
      }
      if (residual <= tolerance) { iterations++; break; }
    }
  }
  return { iterations, residual, converged: residual <= tolerance };
}
