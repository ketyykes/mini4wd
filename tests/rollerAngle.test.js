// B13（iter-105）：導輪角度調整板（田宮 15373，ダウンスラスト）。導輪軸頂端往車頭方向傾 θ；
// 沿牆前進時，導輪軸方向的滑動分量 v·sinθ 受滑動摩擦（spec.track.wallFriction）→ 把車往下壓；θ = 0 與沒裝相同
import { test, expect, beforeAll } from 'vitest';
import { assemble, loadConfig } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';
import { buildStraight } from '../src/track.js';
import * as sim from '../src/sim.js';

beforeAll(async () => {
  await sim.initRapier();
});

/** @type {(over: Record<string, any>) => Record<string, any>} */
const cfg = (over) => ({ ...loadConfig('default'), frontStay: 'stay-front-frp', rearStay: 'stay-rear-frp', body: null, ...over });

/**
 * 車頭右前導輪壓進右牆 0.3 mm、以 V 往前（+x）並帶 0.2 m/s 朝牆速度，解一次牆接觸衝量
 * @type {(asm: any, V: number) => { dvy: number, E0: number, E1: number, contacts: any[] }}
 */
const wallHit = (asm, V) => {
  const track = buildStraight(4);
  const env = sim.createWorld(track);
  const car = sim.createCar(env, { assembly: asm, s: 0.5, lane: 0, powered: false });
  env.world.step();
  car.chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
  const fr = car.rollers.find((r) => r.id === 'FR');
  const face = track.wallsAt(0)[0].d - track.dims.wallT / 2;
  const t = car.chassis.translation();
  car.chassis.setTranslation({ x: t.x, y: t.y, z: face - fr.z / 1000 - fr.r / 1000 + 0.0003 }, true);
  car.chassis.setLinvel({ x: V, y: 0, z: 0.2 }, true);
  const contacts = sim.rollerWallContacts(env, car).filter((c) => c.roller === 'FR');
  const E0 = sim.carKineticEnergy(car);
  const vy0 = car.chassis.linvel().y;
  sim.wallContactImpulses(env, car);
  const out = { dvy: car.chassis.linvel().y - vy0, E0, E1: sim.carKineticEnergy(car), contacts };
  env.world.free();
  return out;
};

test('P17_roller_angle 導輪角度調整板：下推角 θ 讓沿牆前進的車受向下衝量（θ 越大越大）、能量不增加；不裝時沒有垂直衝量', () => {
  const plain = wallHit(assemble(cfg({})), 3);
  expect(plain.contacts.length).toBeGreaterThan(0);
  const rows = [];
  let last = Math.abs(plain.dvy);
  for (const deg of [1, 2, 3]) {
    const asm = assemble(cfg({ frontRollerAngle: `roller-angle-plate-${deg}` }));
    expect(asm.layout.rollers.filter((r) => r.slot === 'frontRollers').every((r) => r.thrust_deg === deg)).toBe(true);
    expect(asm.layout.rollers.filter((r) => r.slot === 'rearRollers').every((r) => r.thrust_deg === 0)).toBe(true);
    const r = wallHit(asm, 3);
    rows.push(`${deg}°：Δv_y ${(r.dvy * 1000).toFixed(3)} mm/s，動能 ${(r.E0 * 1000).toFixed(4)} → ${(r.E1 * 1000).toFixed(4)} mJ`);
    // 向下，而且隨角度單調變大
    expect(r.dvy).toBeLessThan(0);
    expect(Math.abs(r.dvy)).toBeGreaterThan(last);
    last = Math.abs(r.dvy);
    // 摩擦只耗能
    expect(r.E1).toBeLessThanOrEqual(r.E0 * (1 + 1e-9));
  }
  console.log(`[P17 roller angle] 不裝：Δv_y ${(plain.dvy * 1000).toFixed(4)} mm/s；${rows.join('；')}`);
  // 不裝（θ = 0）：圓柱導輪碰鉛直牆，法向水平、沒有軸向滑動 → 幾乎沒有垂直衝量（只剩車身轉動耦合）
  expect(Math.abs(plain.dvy)).toBeLessThan(last * 0.05);
});

test('P18_roller_angle_mount 導輪角度調整板只能夾在板狀導輪架與底盤之間；每片 0.3 g 計入質量', () => {
  const stock = assemble({ ...loadConfig('default'), frontRollerAngle: 'roller-angle-plate-2' });
  expect(validateAssembly(stock).violations.map((v) => v.code)).toContain('ROLLER_ANGLE_MOUNT');
  const base = assemble(cfg({}));
  const both = assemble(cfg({ frontRollerAngle: 'roller-angle-plate-1', rearRollerAngle: 'roller-angle-plate-3' }));
  expect(validateAssembly(both).violations.map((v) => v.code)).not.toContain('ROLLER_ANGLE_MOUNT');
  expect(both.mass_g - base.mass_g).toBeCloseTo(0.6, 9);
});
