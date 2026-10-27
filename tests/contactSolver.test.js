import { expect, test } from 'vitest';
import { solveContactVelocities } from '../src/contactSolver.js';

const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

test('P17_contact_coulomb 解析質點撞牆：滑動／黏著、雙切向圓錐、無接近不產生摩擦', () => {
  for (const vy of [-1, 0, 1, 4]) for (const vz of [-2, 0, 3]) for (const mu of [0, 0.05, 0.3, 2]) {
    const q = [-1, vy, vz], e0 = dot(q, q);
    const c = { j: [1, 0, 0], tangents: [[0, 1, 0], [0, 0, 1]], mu };
    const result = solveContactVelocities(q, eye(3), [c]);
    const factor = Math.max(0, 1 - mu / Math.hypot(vy, vz));
    expect(q[0]).toBeCloseTo(0, 10);
    expect(q[1]).toBeCloseTo(vy * (Number.isNaN(factor) ? 0 : factor), 9);
    expect(q[2]).toBeCloseTo(vz * (Number.isNaN(factor) ? 0 : factor), 9);
    expect(Math.hypot(...c.friction)).toBeLessThanOrEqual(mu * c.acc + 1e-12);
    expect(dot(q, q)).toBeLessThanOrEqual(e0 + 1e-12);
    expect(result.converged).toBe(true);
    const separating = [1, vy, vz];
    solveContactVelocities(separating, eye(3), [c]);
    expect(separating).toEqual([1, vy, vz]);
    expect(c.acc).toBe(0);
    expect(c.friction).toEqual([0, 0]);
  }
});

test('P17_contact_metric 異向有效質量：滑動摩擦反向於最終速度；轉換切向基底不改物理解', () => {
  const Minv = [[1, 0, 0], [0, 2, 0.7], [0, 0.7, 0.5]];
  let reference;
  for (const angle of [0, 0.4, 1.2, 2.8]) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const c = { j: [1, 0, 0], tangents: [[0, ca, sa], [0, -sa, ca]], mu: 0.3 };
    const q = [-1, 2, -1];
    expect(solveContactVelocities(q, Minv, [c]).converged).toBe(true);
    const v = c.tangents.map((t) => dot(t, q));
    expect(Math.hypot(...c.friction)).toBeCloseTo(0.3, 10);
    expect(c.friction[0] * v[1] - c.friction[1] * v[0]).toBeCloseTo(0, 9);
    expect(dot(c.friction, v)).toBeLessThan(0);
    if (reference) q.forEach((x, i) => expect(x).toBeCloseTo(reference[i], 9)); else reference = q;
  }
});

test('P17_contact_stop_coupled 摩擦與雙止擋一起求解：下一步行程、接觸互補、動能與累積圓錐', () => {
  // Orthogonal coordinates transformed to q=(body Vx,Vy,Vz,front slip,rear slip).
  // Two sliding masses share tangential body motion and independent lateral slip.
  const masses = [0.12, 0.006, 0.008], total = masses.reduce((a, b) => a + b);
  const Minv = eye(5);
  Minv[0][0] = Minv[1][1] = 1 / total;
  Minv[2][2] = 1 / masses[0];
  for (let i = 3; i < 5; i++) {
    Minv[2][i] = Minv[i][2] = -1 / masses[0];
    for (let j = 3; j < 5; j++) Minv[i][j] = 1 / masses[0] + (i === j ? 1 / masses[i - 2] : 0);
  }
  const energy = (q) => 0.5 * (total * (q[0] ** 2 + q[1] ** 2) + masses[0] * q[2] ** 2 + masses[1] * (q[2] + q[3]) ** 2 + masses[2] * (q[2] + q[4]) ** 2);
  for (const mu of [0, 0.2, 0.7]) for (const sign of [-1, 1]) {
    const q = [2, 0.3, sign, 0.3 * sign, -0.2 * sign], e0 = energy(q);
    const contacts = [3, 4].map((i) => ({ j: [0, 0, -sign, ...[3, 4].map((k) => i === k ? -sign : 0)], tangents: [[1, 0, 0, 0, 0], [0, 1, 0, 0, 0]], mu }));
    const limits = [3, 4].flatMap((i) => [-1, 1].map((side) => ({ j: Array.from({ length: 5 }, (_, k) => k === i ? -side : 0), target: -0.02 })));
    const result = solveContactVelocities(q, Minv, contacts, limits);
    expect(result.converged, JSON.stringify(result)).toBe(true);
    expect(energy(q)).toBeLessThanOrEqual(e0 + 1e-10);
    expect(Math.abs(q[3])).toBeLessThanOrEqual(0.02 + 1e-9);
    expect(Math.abs(q[4])).toBeLessThanOrEqual(0.02 + 1e-9);
    for (const c of contacts) {
      expect(dot(c.j, q)).toBeGreaterThanOrEqual(-1e-9);
      expect(Math.abs(c.acc * dot(c.j, q))).toBeLessThan(1e-9);
      expect(Math.hypot(...c.friction)).toBeLessThanOrEqual(mu * c.acc + 1e-12);
    }
  }
});

test('P17_contact_normal_friction 法向與摩擦互相影響時仍符合獨立滑動解析解', () => {
  const mu = 0.2, q = [-1, 3, 0];
  const c = { j: [1, 0, 0], tangents: [[0, 1, 0], [0, 0, 1]], mu };
  const result = solveContactVelocities(q, [[1, 0.4, 0], [0.4, 2, 0], [0, 0, 1]], [c]);
  const jn = 1 / (1 - 0.4 * mu), jt = -mu * jn;
  expect(result.converged).toBe(true);
  expect(c.acc).toBeCloseTo(jn, 8);
  expect(c.friction[0]).toBeCloseTo(jt, 8);
  expect(q[0]).toBeCloseTo(0, 8);
  expect(q[1]).toBeCloseTo(3 + 0.4 * jn + 2 * jt, 8);
});

test('P17_contact_redundant 重複法向與無作用止擋不改變碰撞，法向不為負', () => {
  const make = () => ({ j: [1, 0, 0], tangents: [[0, 1, 0], [0, 0, 1]], mu: 0.3 });
  const single = [-1, 2, -0.4], duplicate = [...single];
  solveContactVelocities(single, eye(3), [make()]);
  const contacts = [make(), make(), make()];
  const result = solveContactVelocities(duplicate, eye(3), contacts, [{ j: [-1, 0, 0], target: -10 }]);
  expect(result.converged).toBe(true);
  duplicate.forEach((v, i) => expect(v).toBeCloseTo(single[i], 9));
  contacts.forEach((c) => expect(c.acc).toBeGreaterThanOrEqual(0));
});

test('P17_contact_restitution 單點撞擊保留指定恢復係數與耗散，摩擦受總法向衝量限制', () => {
  for (const e of [0, 0.05, 0.1, 0.5, 1]) {
    const q = [-2, 3, 0], c = { j: [1, 0, 0], tangents: [[0, 1, 0], [0, 0, 1]], mu: 0.2, target: 2 * e };
    expect(solveContactVelocities(q, eye(3), [c]).converged).toBe(true);
    expect(q[0]).toBeCloseTo(2 * e, 9);
    expect(c.acc).toBeCloseTo(2 * (1 + e), 9);
    expect(q[1]).toBeCloseTo(3 - 0.2 * c.acc, 9);
    expect(dot(q, q)).toBeLessThanOrEqual(13 + 1e-10);
  }
});
