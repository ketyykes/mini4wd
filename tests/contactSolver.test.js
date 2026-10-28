import { expect, test } from 'vitest';
import { solveContactVelocities, kineticEnergy } from '../src/contactSolver.js';

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

// iter-98（B1）：scripts/diag/b1-gain-search.test.js 隨機搜尋到的案例：6 自由度剛體兩點同時恢復碰撞，聯立解讓動能 +1.26%
const GAIN_CASE = {"I": [0.31929803076665847, 0.14548226406797765, 0.05641814237926156], "q0": [-0.4715717853978276, -0.5539533733390272, -0.7666211985051632, 0.32169413892552257, 0.40873095113784075, -0.6414213399402797], "contacts": [{"j": [0.7151855731199914, 0.5513455765452564, -0.4295668181144912, 0.17961376776674762, 0.05102219243760277, 0.36452544503770445], "tangents": [[0.5148971335178831, 0, 0.8572519710651397, -0.33539718175456135, -0.14249590792549763, 0.201451910645158], [0.4726420822314669, -0.8342769655360137, -0.2838862569409171, 0.09359698109410641, 0.03371885029576401, 0.05673755433725275]], "mu": 0, "target": 0.4037686169474809}, {"j": [0.2148089609774456, 0.7876680706713074, 0.5774392788239563, -0.24752288421812, -0.0031423779649109333, 0.09636560311467988], "tangents": [[-0.9372495221745518, 0, 0.3486593368656206, -0.16532787189161205, 0.033711899929429884, -0.444426557812994], [0.27462782719048084, -0.61609983804976, 0.7382415228688339, -0.37062280394811364, -0.004017450802740701, 0.134519911831371]], "mu": 0.367289433022961, "target": 1.061067226829772}]};
const diag = (v) => v.map((x, i) => v.map((_, k) => (i === k ? x : 0)));

test('P17_contact_energy_guard 同時多點恢復碰撞：聯立解可能增能 → 給質量矩陣時等比例縮小恢復目標，保證 ½qᵀMq 不增加且不穿透', () => {
  const M = diag([1, 1, 1, ...GAIN_CASE.I]);
  const Minv = diag([1, 1, 1, ...GAIN_CASE.I.map((x) => 1 / x)]);
  const fresh = () => GAIN_CASE.contacts.map((c) => ({ ...c, j: [...c.j], tangents: c.tangents.map((t) => [...t]) }));
  const e0 = kineticEnergy(GAIN_CASE.q0, M);
  // 沒有守門：確實增能（說明守門是必要的，不是理論上的擔心）
  const plain = [...GAIN_CASE.q0];
  expect(solveContactVelocities(plain, Minv, fresh()).converged).toBe(true);
  expect(kineticEnergy(plain, M) / e0 - 1).toBeGreaterThan(0.01);
  // 有守門：不增能、仍有反彈（α > 0）、所有接觸都不再接近
  const q = [...GAIN_CASE.q0];
  const contacts = fresh();
  const r = solveContactVelocities(q, Minv, contacts, [], { M });
  expect(r.converged).toBe(true);
  expect(r.energyGuard).toBe(true);
  expect(r.restitutionScale).toBeGreaterThan(0);
  expect(r.restitutionScale).toBeLessThan(1);
  expect(r.energyAfter).toBeLessThanOrEqual(e0 * (1 + 1e-12));
  expect(kineticEnergy(q, M)).toBeCloseTo(r.energyAfter, 15);
  for (const c of contacts) expect(dot(c.j, q)).toBeGreaterThanOrEqual(-1e-9);
  console.log(`[P17 energy guard] 無守門 +${((kineticEnergy(plain, M) / e0 - 1) * 100).toFixed(3)}%，守門 α = ${r.restitutionScale.toFixed(4)}、${((r.energyAfter / e0 - 1) * 100).toExponential(2)}%`);
});

test('P17_contact_energy_random 600 組隨機 6 自由度多點接觸（恢復係數、摩擦隨機）：守門後動能都不增加、不穿透；沒增能的案例結果與原解相同', () => {
  let seed = 98;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (v) => { const L = Math.hypot(...v); return v.map((x) => x / L); };
  let guarded = 0, cases = 0;
  while (cases < 600) {
    const I = [0.02 + rnd() * 0.3, 0.02 + rnd() * 0.3, 0.02 + rnd() * 0.3];
    const M = diag([1, 1, 1, ...I]), Minv = diag([1, 1, 1, ...I.map((x) => 1 / x)]);
    const q0 = Array.from({ length: 6 }, () => rnd() * 2 - 1);
    const contacts = [];
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const p = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], d = unit([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
      const t1 = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t2 = cross(d, t1);
      const J = (v) => [...v, ...cross(p, v)];
      const j = J(d), vn = dot(j, q0), e = rnd(), mu = rnd() < 0.5 ? 0 : rnd();
      if (vn < 0) contacts.push({ j, tangents: [J(t1), J(t2)], mu, target: -e * vn });
    }
    if (contacts.length < 2) continue;
    cases++;
    const copy = () => contacts.map((c) => ({ ...c, j: [...c.j], tangents: c.tangents.map((t) => [...t]) }));
    const plain = [...q0];
    solveContactVelocities(plain, Minv, copy());
    const q = [...q0], cs = copy();
    const r = solveContactVelocities(q, Minv, cs, [], { M });
    const e0 = kineticEnergy(q0, M);
    expect(kineticEnergy(q, M)).toBeLessThanOrEqual(e0 * (1 + 1e-12));
    for (const c of cs) expect(dot(c.j, q)).toBeGreaterThanOrEqual(-1e-8);
    if (r.energyGuard) guarded++;
    else q.forEach((x, i) => expect(x).toBe(plain[i]));
  }
  expect(guarded).toBeGreaterThan(0);
  console.log(`[P17 energy random] ${cases} 組，觸發守門 ${guarded} 組`);
});
