// B13 成因調查：導輪實測滾動阻力下 p7-demo 翻車，是物理上的衝出賽道，還是數值問題？
import { test, beforeAll } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { buildCircuit } from '../../src/track.js';
import { spec } from '../../src/spec.js';
import * as sim from '../../src/sim.js';
beforeAll(async () => { await sim.initRapier(); });
const MEAS = { front: 0.00315, rear: 0.0031 };
const run = (name, { mu, dtDiv = 1, trace = false }) => {
  const dt0 = spec.sim.dt_s;
  spec.sim.dt_s = dt0 / dtDiv;
  const asm = assemble(loadConfig(name));
  const track = buildCircuit(); const env = sim.createWorld(track);
  const car = sim.createCar(env, { assembly: asm, s: 0.15, lane: 0 });
  if (mu) {
    for (const r of car.rollers) {
      const v = r.slot.startsWith('front') ? mu.front : mu.rear;
      r.mu = v;
      if (r.tiers) r.tiers = r.tiers.map((t) => ({ ...t, wallFriction: v }));
      for (const c of r.colliders) c.setFriction(v);
    }
  }
  const L = track.path.length; let last = 0.15, dist = 0, t = 0;
  const hist = [];
  let first = null;
  const n = Math.round(12 / spec.sim.dt_s);
  for (let i = 0; i < n && dist < 3 * L; i++) {
    sim.stepCar(env, car); t += spec.sim.dt_s;
    const p = car.chassis.translation(); const c = track.path.project(p.x, p.z);
    let ds = c.s - last; if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L; dist += ds; last = c.s;
    const v = car.chassis.linvel();
    const pen = sim.wallPenetration(env, car); const up = sim.upAxis(car).y;
    const nc = sim.rollerWallContacts(env, car).length;
    hist.push({ t, s: c.s, d: c.d, y: p.y, spd: Math.hypot(v.x, v.z), vy: v.y, pen, up, nc });
    if (!first && (pen > 0.001 || up < 0.8)) first = hist.length - 1;
    if (up < 0.3) break;
  }
  spec.sim.dt_s = dt0;
  const maxPen = Math.max(...hist.map((h) => h.pen)); const minUp = Math.min(...hist.map((h) => h.up));
  console.log(`${name} mu=${mu ? 'measured' : '0.05'} dt/${dtDiv}: dist ${dist.toFixed(2)}/${(3 * L).toFixed(2)} t ${t.toFixed(3)} maxPen ${(maxPen * 1000).toFixed(2)} mm minUp ${minUp.toFixed(3)} vmax ${Math.max(...hist.map((h) => h.spd)).toFixed(2)}`);
  if (trace && first !== null) {
    const step = Math.round(0.005 / spec.sim.dt_s);
    const seg = track.segmentAt ? track.segmentAt(hist[first].s) : null;
    console.log(`  first event at t ${hist[first].t.toFixed(3)} s=${hist[first].s.toFixed(3)} ${seg ? JSON.stringify(seg).slice(0, 120) : ''}`);
    for (let k = Math.max(0, first - 40 * step); k < Math.min(hist.length, first + 30 * step); k += step) {
      const h = hist[k];
      console.log(`  t ${h.t.toFixed(3)} s ${h.s.toFixed(3)} d ${(h.d * 1000).toFixed(1)} y ${(h.y * 1000).toFixed(1)} spd ${h.spd.toFixed(2)} vy ${h.vy.toFixed(2)} pen ${(h.pen * 1000).toFixed(2)} up ${h.up.toFixed(3)} rollerContacts ${h.nc}`);
    }
  }
};
test('cause', () => {
  run('p7-demo', {});
  run('p7-demo', { mu: MEAS, trace: true });
  run('p7-demo', { mu: MEAS, dtDiv: 4 });
}, 1200000);
