import { test, expect, beforeAll } from 'vitest';
import { assemble, loadConfig } from '../../src/assembly.js';
import { buildStraight } from '../../src/track.js';
import { spec } from '../../src/spec.js';
import * as sim from '../../src/sim.js';
beforeAll(async () => { await sim.initRapier(); });
const cfg = (over) => ({ ...loadConfig('default'), ...over });
function slideWallImpact(asm, psiDeg, V) {
  const track = buildStraight(4);
  const env = sim.createWorld(track);
  const car = sim.createCar(env, { assembly: asm, s: 0.5, lane: 0, powered: false });
  // 先走一步讓 Rapier 套用組裝的質量與慣性
  env.world.step();
  const psi = (psiDeg * Math.PI) / 180;
  const q = { x: 0, y: Math.sin(-psi / 2), z: 0, w: Math.cos(-psi / 2) };
  const fr = car.rollers.find((r) => r.id === 'FR');
  const face = track.wallsAt(0)[0].d - track.dims.wallT / 2;
  const t0 = car.chassis.translation();
  const zFR = (fr.x * Math.sin(psi) + fr.z * Math.cos(psi)) / 1000;
  const vel = { x: V * Math.cos(psi), y: 0, z: V * Math.sin(psi) };
  car.chassis.setTranslation({ x: t0.x, y: t0.y, z: face - 0.001 - fr.r / 1000 - zFR }, true);
  car.chassis.setRotation(q, true);
  car.chassis.setLinvel(vel, true);
  car.chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
  // 制振器、滑動板剛體跟著車體擺到同一個姿勢（滑動板在行程中央）
  const attached = [...car.dampers.map((d) => ({ body: d.body, a: d.anchor })), ...(car.slider ? [{ body: car.slider.body, a: car.slider.anchor }] : [])];
  for (const b of attached) {
    b.body.setTranslation(sim.localToWorld(car, b.a), true);
    b.body.setRotation(q, true);
    b.body.setLinvel(vel, true);
    b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  car.spin.omega = V / car.P.wheelRadius;
  // 初始姿勢不能和任何一面牆重疊（右前導輪離牆 1 mm，其餘外緣點也要在車道內）
  const pen0 = sim.wallPenetration(env, car);
  expect(pen0).toBeLessThan(0);
  const dt = env.world.timestep;
  const m = car.chassis.mass();
  const energy = () => sim.carKineticEnergy(car) + (sim.sliderState(car)?.springEnergy ?? 0);
  const E0 = energy();
  let Emax = E0;
  let E = E0;
  let peakF = 0;
  let peakInfo = null;
  let uMax = 0;
  let springMax = 0;
  let vz = car.chassis.linvel().z;
  for (let i = 0; i < 0.1 / dt; i++) {
    sim.stepCar(env, car);
    const vzNow = car.chassis.linvel().z;
    const fNow = (m * Math.abs(vzNow - vz)) / dt;
    if (fNow > peakF) { peakInfo = { step: i, f: fNow, rollers: sim.rollerWallContacts(env, car).map((c) => `${c.roller}${c.tier}:${(c.pen * 1000).toFixed(2)}`).join(' '), pen: sim.wallPenetration(env, car) }; }
    peakF = Math.max(peakF, fNow);
    vz = vzNow;
    const st = sim.sliderState(car);
    if (st) {
      uMax = Math.max(uMax, Math.abs(st.u));
      springMax = Math.max(springMax, Math.abs(st.force));
    }
    E = energy();
    Emax = Math.max(Emax, E);
  }
  return { peakInfo, peakF, E0, Emax, Eend: E, uMax, springMax, dampingWork: sim.sliderState(car)?.dampingWork ?? 0, pen0 };
}


test('peak', () => {
  for (const ax of [0.3, 0]) {
    spec.track.wallFriction = ax;
    for (const st of ['stay-front-frp', 'stay-front-slide-soft']) {
      const r = slideWallImpact(assemble(cfg({ frontStay: st, body: null })), 6, 4);
      console.log(`axial ${ax} ${st}: peak ${r.peakF.toFixed(2)} N at step ${r.peakInfo.step} contacts [${r.peakInfo.rollers}] pen ${(r.peakInfo.pen*1000).toFixed(2)}`);
    }
  }
  spec.track.wallFriction = 0.3;
});
