import * as THREE from 'three';
import * as sim from '../../src/sim.js';
import { spec } from '../../src/spec.js';
import { buildStraight } from '../../src/track.js';

/** Total mechanical energy on flat ground: kinetic, gravity, tire springs,
 * damper seat springs, slider springs, and compressed brake sponge.
 * This helper is not valid on a sloping or elevated ground mesh.
 */
export function carMechanicalEnergy(car) {
  const g = spec.sim.gravity;
  const up = sim.upAxis(car);
  let e = sim.carKineticEnergy(car);
  e += car.chassis.mass() * g * car.chassis.worldCom().y;
  for (const d of car.dampers) {
    e += d.body.mass() * g * d.body.worldCom().y;
    const a = sim.localToWorld(car, d.anchor);
    // 座墊點：滑動式 = 制振器剛體原點；擺動式 = 擺動剛體上的座墊點（同 sim.js swingDamperForces）
    let p = d.body.translation();
    if (d.swing) {
      p = sim.localToWorld({ chassis: d.body }, d.seatOnBody);
    }
    const rel = (p.x - a.x) * up.x + (p.y - a.y) * up.y + (p.z - a.z) * up.z;
    if (rel < 0) {
      e += 0.5 * d.seatK * rel * rel;
    }
  }
  for (const sl of car.sliders) {
    e += sl.body.mass() * g * sl.body.worldCom().y + sim.sliderState(car, sl).springEnergy;
  }
  const { wheelR, restLen, springK } = car.wheelParams;
  for (const w of car.wheels) {
    const hp = sim.localToWorld(car, w.hardpoint);
    const dist = hp.y / up.y;
    const comp = restLen + wheelR - dist;
    if (comp > 0 && dist >= 0) {
      e += 0.5 * springK * comp * comp;
    }
  }
  if (car.sponge) {
    const n = car.sponge.pts.length;
    for (const lp of car.sponge.pts) {
      const p = sim.localToWorld(car, lp);
      const delta = Math.min(Math.max(0, -p.y / up.y), car.sponge.thickness);
      e += 0.5 * (car.sponge.k / n) * delta * delta;
    }
  }
  return e;
}


// Rotate every attached body about the chassis origin, preserving joint anchors.
// Heights refer to the chassis origin; positive pitch lifts the nose, roll the right side.
export function dropTest(asm, h_mm, { pitch = 0, roll = 0 } = {}) {
  const env = sim.createWorld(buildStraight(4));
  const car = sim.createCar(env, { assembly: asm, s: 0.5, lane: 0, powered: false });
  const origin = new THREE.Vector3().copy(car.chassis.translation());
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(roll * Math.PI / 180, 0, pitch * Math.PI / 180));
  for (const b of [car.chassis, ...car.dampers.map((d) => d.body), ...car.sliders.map((sl) => sl.body)]) {
    const t = new THREE.Vector3().copy(b.translation()).sub(origin).applyQuaternion(tilt).add(origin);
    t.y += h_mm / 1000;
    b.setTranslation(t, true);
    b.setRotation(tilt.clone().multiply(new THREE.Quaternion().copy(b.rotation())), true);
    b.recomputeMassPropertiesFromColliders();
  }
  const dt = env.world.timestep;
  const initialEnergy = carMechanicalEnergy(car);
  let maxEnergy = initialEnergy;
  let minUp = 1;
  let landed = -1;
  let peak = -Infinity;
  let air = 0;
  let sumVy = 0;
  for (let i = 0; i < 0.4 / dt; i++) {
    sim.stepCar(env, car);
    maxEnergy = Math.max(maxEnergy, carMechanicalEnergy(car));
    minUp = Math.min(minUp, sim.upAxis(car).y);
    const touching = car.wheels.some((w) => w.contact);
    if (landed < 0 && touching) {
      landed = i;
    }
    if (landed < 0) {
      continue;
    }
    if (!touching) {
      air += dt;
    }
    if (i > landed + 0.015 / dt) {
      peak = Math.max(peak, car.chassis.translation().y);
    }
    if (i > landed + 0.02 / dt) {
      sumVy += Math.abs(car.chassis.linvel().y) * dt;
    }
  }
  const result = {
    rebound_mm: peak * 1000, air_ms: air * 1000, sumVy_mm: sumVy * 1000,
    landed: landed >= 0, minUp, finalUp: sim.upAxis(car).y,
    initialEnergy, maxEnergy, finalEnergy: carMechanicalEnergy(car),
  };
  env.world.free();
  return result;
}
