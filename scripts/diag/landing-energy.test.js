// 落地瞬間機械能回升診斷：步長縮放、各能量項拆解。
// npx vitest run --config scripts/diag/vitest.diag.config.js scripts/diag/landing-energy.test.js --silent=false
import { beforeAll, test } from 'vitest';
import { spec } from '../../src/spec.js';
import * as sim from '../../src/sim.js';
import { assemble, loadConfig } from '../../src/assembly.js';
import { dropTest } from '../../tests/helpers/drop.js';

beforeAll(sim.initRapier);
const baseDt = spec.sim.dt_s;
const config = { ...loadConfig('default'), body: null, rearStay: 'stay-rear-frp', massDamper: { base: 'damper-square-8x8x32', locked: true } };

test('步長縮放', () => {
  for (const h of [60, 120]) {
    for (const s of [1, 0.5, 0.25]) {
      spec.sim.dt_s = baseDt * s;
      const r = dropTest(assemble(config), h);
      console.log(`h=${h} dt=${spec.sim.dt_s} rise=${((r.maxEnergy - r.initialEnergy) / r.initialEnergy * 100).toExponential(4)}%`);
    }
  }
  spec.sim.dt_s = baseDt;
});

import * as THREE from 'three';
import { buildStraight } from '../../src/track.js';
import { carMechanicalEnergy } from '../../tests/helpers/drop.js';

test('逐步拆解 h=60', () => {
  const env = sim.createWorld(buildStraight(4));
  const car = sim.createCar(env, { assembly: assemble(config), s: 0.5, lane: 0, powered: false });
  for (const b of [car.chassis, ...car.dampers.map((d) => d.body), ...car.sliders.map((sl) => sl.body)]) {
    const t = new THREE.Vector3().copy(b.translation());
    t.y += 0.06;
    b.setTranslation(t, true);
  }
  const e0 = carMechanicalEnergy(car);
  const rows = [];
  for (let i = 0; i < 0.4 / env.world.timestep; i++) {
    const before = carMechanicalEnergy(car);
    sim.stepCar(env, car);
    const e = carMechanicalEnergy(car);
    // 車上任何Rapier碰撞體與地板的接觸
    const groundPairs = [];
    env.world.contactPairsWith(env.floor, (other) => {
      env.world.contactPair(env.floor, other, (m) => {
        if (m.numContacts() > 0) groundPairs.push(`${other.handle}:${m.numContacts()}:${m.contactDist(0).toFixed(6)}`);
      });
    });
    const comp = car.wheels.map((w) => (w.contact ? (w.normalForce).toFixed(2) : '-')).join(',');
    rows.push({ i, e, d: e - before, vy: car.chassis.linvel().y, y: car.chassis.translation().y, comp, groundPairs: groundPairs.join(' ') });
  }
  rows.sort((a, b) => b.d - a.d);
  console.log('e0', e0, 'bodyCol', car.bodyCol?.handle ?? car.bodyCol?.map?.((c) => c.handle));
  for (const r of rows.slice(0, 8)) console.log(JSON.stringify({ ...r, rel: (r.e - e0) / e0 }));
});
