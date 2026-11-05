// B13：導輪 μ 改實測後，p5-taiwan / p7-demo 在換道橋頂飛出。像實車一樣換零件調校，找出 8 組起跑擾動都跑完的設定
import { test, beforeAll } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { validateAssembly } from '../../src/regulation.js';
import { buildCircuit } from '../../src/track.js';
import { spec } from '../../src/spec.js';
import * as sim from '../../src/sim.js';
beforeAll(async () => { await sim.initRapier(); });
const starts = [
  { s: 0.15, lane: 0, soc: 1 }, { s: 0.17, lane: 0, soc: 1 }, { s: 0.19, lane: 0, soc: 1 }, { s: 0.21, lane: 0, soc: 1 },
  { s: 0.15, lane: 1, soc: 1 }, { s: 0.15, lane: 2, soc: 1 }, { s: 0.15, lane: 0, soc: 0.9 }, { s: 0.21, lane: 2, soc: 0.9 },
];
const run8 = (cfg, thrust = null, perSlot = null) => {
  const asm = assemble(cfg);
  if (!validateAssembly(asm).ok) return 'ILLEGAL ' + JSON.stringify(validateAssembly(asm).violations.map((v) => v.code));
  const track = buildCircuit(); const L = track.path.length;
  let ok = 0; const times = []; let worstPen = 0; let worstUp = 1;
  for (const st of starts) {
    const env = sim.createWorld(track);
    const car = sim.createCar(env, { assembly: asm, ...st });
    if (perSlot) for (const r of car.rollers) r.axialFriction = r.slot === 'frontRollers' ? perSlot.front : perSlot.rear;
    if (thrust !== null) for (const r of car.rollers) r.thrust_deg = typeof thrust === 'number' ? thrust : (r.slot === 'frontRollers' ? thrust.front : thrust.rear);
    let d = 0, last = st.s, pen = 0, up = 1, steps = 0;
    for (; steps < Math.ceil(30 / spec.sim.dt_s) && d < 3 * L && up > 0.8; steps++) {
      sim.stepCar(env, car);
      const t = car.chassis.translation(); const p = track.path.project(t.x, t.z);
      let ds = p.s - last; if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L; d += ds; last = p.s;
      up = Math.min(up, sim.upAxis(car).y); pen = Math.max(pen, sim.wallPenetration(env, car));
    }
    env.world.free();
    const fine = d >= 3 * L && pen <= 0.001 && up > 0.8;
    ok += +fine; if (fine) times.push(steps * spec.sim.dt_s);
    worstPen = Math.max(worstPen, pen); worstUp = Math.min(worstUp, up);
  }
  return `${ok}/8 ok, 3 laps ${times.length ? Math.min(...times).toFixed(2) + '–' + Math.max(...times).toFixed(2) + ' s' : '-'}, worst pen ${(worstPen * 1000).toFixed(2)} mm, up ${worstUp.toFixed(3)}`;
};
const VARIANTS = JSON.parse(process.env.B13_VARIANTS ?? '[]');
test('tune', () => {
  // 第 4 欄：導輪軸向滑動摩擦（spec.track.wallFriction）敏感度（驗證下推角）
  const mu0 = spec.track.wallFriction;
  for (const [name, over, thrust = null, mu = mu0] of VARIANTS) {
    const perSlot = typeof mu === 'object' ? mu : null;
    spec.track.wallFriction = perSlot ? mu0 : mu;
    try {
      console.log(`${name} ${JSON.stringify(over)} thrust ${JSON.stringify(thrust)} muAxial ${JSON.stringify(mu)}: ${run8({ ...loadConfig(name), ...over }, thrust, perSlot)}`);
    } finally {
      spec.track.wallFriction = mu0;
    }
  }
}, 3600000);
