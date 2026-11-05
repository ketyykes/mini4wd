// B14：第二款底盤「後置單軸馬達＋傳動軸」（結構參考 Tamiya VZ）的資料、相容性、質量、傳動與跑圈驗證
// 來源：shared/reference/VZ_RESEARCH.md；容許誤差寫在本檔，不得為通過而放寬
import { test, expect, beforeAll } from 'vitest';
import { assemble, loadConfig } from '../src/assembly.js';
import { validateAssembly } from '../src/regulation.js';
import { getPart, listParts } from '../src/parts/index.js';
import { theoreticalTopSpeed } from '../src/powertrain.js';
import { spec } from '../src/spec.js';
import { buildCircuit, buildStraight } from '../src/track.js';
import { initRapier, createWorld, createCar, stepCar, forwardSpeed, upAxis, wallPenetration } from '../src/sim.js';
import { chassisMeshDistribution } from './helpers/chassisMesh.js';

beforeAll(async () => {
  await initRapier();
});

const VZ = loadConfig('vz-demo');
const codes = (cfg) => validateAssembly(assemble(cfg)).violations.map((v) => v.code);

test('P09_vz_dimensions VZ 底盤官方尺寸：軸距 80、輪距前 59.5／後 65.5、離地 2.5；示範車全長 158、全寬 98 mm（14 mm 導輪）', () => {
  const asm = assemble(VZ);
  const w = asm.layout.wheels;
  const front = w.filter((q) => q.x > 0).map((q) => Math.abs(q.z));
  const rear = w.filter((q) => q.x < 0).map((q) => Math.abs(q.z));
  expect(Math.max(...w.map((q) => q.x)) - Math.min(...w.map((q) => q.x))).toBeCloseTo(80, 9);
  for (const z of front) expect(2 * z).toBeCloseTo(59.5, 9);
  for (const z of rear) expect(2 * z).toBeCloseTo(65.5, 9);
  expect(asm.groundClearance_mm).toBeCloseTo(2.5, 9);
  // 官方全長 158、全寬 98 mm（[VZ 2.1]）；導輪位置是照片量測推估（±2 mm），外框容許 ±1.5 mm
  const size = asm.bbox_mm.size;
  console.log(`[P09_vz] 全長 ${size.x.toFixed(2)}、全寬 ${size.z.toFixed(2)}、全高 ${size.y.toFixed(2)} mm`);
  expect(Math.abs(size.x - 158)).toBeLessThan(1.5);
  expect(Math.abs(size.z - 98)).toBeLessThan(1.5);
  expect(validateAssembly(asm).ok).toBe(true);
});

test('P18_vz_compat 單／雙軸馬達、齒輪組、MA 專用零件與 VZ 專用零件只能裝在對應底盤', () => {
  expect(codes(VZ)).toEqual([]);
  // 雙軸 PRO 馬達 → VZ 不行；單軸馬達 → MA 不行（[VZ 3.1]）
  for (const m of listParts('motor')) {
    const onVz = codes({ ...VZ, motor: m.id });
    const onMa = codes({ ...loadConfig('default'), motor: m.id });
    if (m.shaft === 'dual') {
      expect(onVz, m.id).toContain('MOTOR_CLASS');
      expect(onMa, m.id).not.toContain('MOTOR_CLASS');
    } else {
      expect(onVz, m.id).not.toContain('MOTOR_CLASS');
      expect(onMa, m.id).toContain('MOTOR_CLASS');
    }
  }
  // 齒輪組：PRO（雙軸）只能 MA，單軸組只能 VZ
  for (const g of listParts('gear')) {
    const single = g.compat.chassisLayouts.includes('single-shaft');
    expect(codes({ ...VZ, gear: g.id }).includes('GEAR_CHASSIS'), g.id).toBe(!single);
    expect(codes({ ...loadConfig('default'), gear: g.id }).includes('GEAR_CHASSIS'), g.id).toBe(single);
  }
  // 官方一覽不含 VZ 的零件（前滑動保桿 15469、橡膠煞車 15413、金端子、PRO 齒輪軸與培林組、MA 蓋子與後導輪架）
  const maOnly = [
    ['frontStay', 'stay-front-slide-hard'],
    ['switch', 'switch-gold-terminal'],
    ['counterShaft', 'gear-shaft-ptfe'],
    ['counterShaft', 'counter-bearing-520'],
    ['batteryCover', 'battery-cover-standard'],
    ['gearCover', 'gear-cover-standard'],
    ['rearStay', 'stay-rear-standard'],
  ];
  for (const [slot, id] of maOnly) {
    expect(codes({ ...VZ, [slot]: id }), id).toContain('CHASSIS_COMPAT');
  }
  expect(codes({ ...VZ, rearStay: 'stay-rear-frp', brakeSponge: 'brake-rubber' })).toContain('CHASSIS_COMPAT');
  // VZ 專用零件裝到 MA → 擋下
  for (const [slot, id] of [['batteryCover', 'battery-cover-vz'], ['gearCover', 'gear-cover-vz'], ['rearStay', 'stay-rear-vz']]) {
    expect(codes({ ...loadConfig('default'), [slot]: id }), id).toContain('CHASSIS_COMPAT');
  }
  // 側制振器：MA 側制振器 15490 一覽不含 VZ（CHASSIS_COMPAT）；AR 側制振器 15459 一覽含 VZ → 裝在 VZ 側壁上、不碰側壁與其他零件
  expect(codes({ ...VZ, massDamper: 'damper-side-square-32' })).toContain('CHASSIS_COMPAT');
  // 15459（φ11.5 × 11.4，推估）裝在外掛式側座，素組的 owl-hush 車殼裝得下；官方「一部のボディは加工が必要」由寬側裙車殼（pc-box 等）表現（查證紀錄：ITERATION_LOG iter-111）
  expect(codes({ ...VZ, massDamper: 'damper-ar-side' })).toEqual([]);
  // 官方一覽含 VZ 的後滑動保桿 15467、FRP／碳纖導輪板可以裝
  for (const [slot, id] of [['rearStay', 'stay-rear-slide-soft'], ['frontStay', 'stay-front-frp'], ['rearStay', 'stay-rear-frp'], ['frontStay', 'stay-front-carbon']]) {
    expect(codes({ ...VZ, [slot]: id }), id).toEqual([]);
  }
});

test('P14_vz_chassis_mesh VZ 底盤本體的質心與慣性分布 = 3D 模型網格；質量與實車素組實測一致', () => {
  const base = { ...VZ, body: null, frontStay: 'stay-front-standard', rearStay: 'stay-rear-vz' };
  const asm = assemble(base);
  const ch = asm.partsBySlot.chassis;
  const d = chassisMeshDistribution(asm);
  for (const k of ['x', 'y', 'z']) expect(ch.com_mm[k], `com ${k}`).toBeCloseTo(d.com_mm[k], 6);
  for (const k of Object.keys(d.gyration_mm2)) expect(ch.inertiaPerMass_mm2[k], `I ${k}`).toBeCloseTo(d.gyration_mm2[k], 4);
  // 每件只算一次：零件質量合計 = 整車
  expect(asm.parts.reduce((a, q) => a + q.mass_g, 0)).toBeCloseTo(asm.mass_g, 9);
  // [AIDA] 素組（含套件車殼、不含電池）實測 71.5 g：本模型不含車殼、不含電池的質量 + 車殼應落在 71.5 g；
  // 套件車殼質量查不到，本專案車殼 6–18 g（推估）→ 不含車殼的質量要在 71.5 − 18 ～ 71.5 − 6
  const noBattery = asm.mass_g - asm.partsBySlot.battery.mass_g;
  console.log(`[P14_vz] 不含車殼與電池 ${noBattery.toFixed(2)} g（實車素組含車殼 71.5 g → 車殼 ${(71.5 - noBattery).toFixed(1)} g）`);
  expect(noBattery).toBeGreaterThan(71.5 - 18);
  expect(noBattery).toBeLessThan(71.5 - 6);
});

test('P17_vz_drivetrain 單軸傳動：只有 1 組中間齒輪、多出冠狀齒輪與傳動軸慣量；單軸馬達模型回代官方建議負載點', () => {
  const vz = assemble(VZ);
  const ma = assemble({ ...loadConfig('default') });
  const r = vz.spec.spin.reflected_gmm2;
  expect(vz.spec.drivetrain.counterGearCount).toBe(1);
  expect(r.crownGears).toBeGreaterThan(0);
  expect(r.propShaft).toBeGreaterThan(0);
  expect(ma.spec.spin.reflected_gmm2.crownGears).toBeUndefined();
  // 齒輪質量：單軸組 = 小齒輪＋中間齒輪＋輪軸齒輪＋冠狀齒輪 ×2＋傳動軸，與零件清單一致
  const gm = vz.partsBySlot.gear.inertiaMasses_g;
  expect(vz.partsBySlot.gear.mass_g).toBeCloseTo(gm.pinion + gm.counter + gm.spur + 2 * gm.crown + gm.propShaft, 9);
  const gearParts = vz.parts.filter((q) => q.slot === 'gear');
  expect(gearParts.reduce((a, q) => a + q.mass_g, 0)).toBeCloseTo(vz.partsBySlot.gear.mass_g, 9);
  // 單軸馬達：線性模型（k_t = k_e、I0 = 0.25 A）回代官方建議負載點（2.4 V 下限、3.0 V 上限），轉速誤差 < 7%（同 PRO 馬達擬合的回代範圍）
  const official = {
    'motor-single-hyper': [[1.4, 17200], [1.9, 21200]],
    'motor-single-torque': [[1.6, 12300], [2.0, 14700]],
    'motor-single-atomic': [[1.5, 12700], [1.8, 14900]],
  };
  for (const [id, pts] of Object.entries(official)) {
    const m = getPart(id);
    const I0 = m.noLoadCurrent_A;
    const R = 3.0 / m.stallCurrent_atRated_A;
    const k = m.stallTorque_atRated_Nm / (m.stallCurrent_atRated_A - I0);
    pts.forEach(([tau_mNm, rpm], i) => {
      const V = i === 0 ? 2.4 : 3.0;
      const I = (tau_mNm * 1e-3) / k + I0;
      const w = (V - I * R) / k;
      const err = Math.abs((w * 60) / (2 * Math.PI) - rpm) / rpm;
      expect(err, `${id} ${V} V`).toBeLessThan(0.07);
    });
    expect(m.shaft).toBe('single');
  }
});

test('P01_vz_top_speed VZ 示範車：理論極速 vs 模擬極速誤差 < 10%（後置單軸＋傳動軸同一套傳動模型）', () => {
  const asm = assemble(VZ);
  const theory = theoreticalTopSpeed({ assembly: asm, soc: 1 });
  const env = createWorld(buildStraight(40));
  const car = createCar(env, { assembly: asm, s: 0.2, lane: 0, soc: 1, drain: false });
  const steps = Math.round(7 / spec.sim.dt_s);
  const tail = Math.round(0.5 / spec.sim.dt_s);
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    stepCar(env, car);
    if (i >= steps - tail) sum += forwardSpeed(car);
  }
  env.world.free();
  const v = sum / tail;
  const err = Math.abs(v - theory.vTheory) / theory.vTheory;
  console.log(`[P01_vz] 理論 ${theory.vTheory.toFixed(3)} m/s、模擬 ${v.toFixed(3)} m/s、誤差 ${(err * 100).toFixed(2)}%`);
  expect(err).toBeLessThan(0.1);
}, 60000);

/** @type {(cfg: object, tag: string) => void} 三條車道出發各跑官方 3 圈：不穿牆（≤ 1 mm）、不飛出、不翻覆 */
function raceThreeLanes(cfg, tag) {
  const asm = assemble(cfg);
  const track = buildCircuit();
  const L = track.path.length;
  for (const lane of [0, 1, 2]) {
    const env = createWorld(track);
    const car = createCar(env, { assembly: asm, s: 0.15, lane, soc: 1 });
    let d = 0;
    let last = 0.15;
    let pen = 0;
    let up = 1;
    let steps = 0;
    for (; steps < Math.ceil(30 / spec.sim.dt_s) && d < 3 * L && up > 0.8; steps++) {
      stepCar(env, car);
      const t = car.chassis.translation();
      const p = track.path.project(t.x, t.z);
      let ds = p.s - last;
      if (ds < -L / 2) ds += L;
      if (ds > L / 2) ds -= L;
      d += ds;
      last = p.s;
      up = Math.min(up, upAxis(car).y);
      pen = Math.max(pen, wallPenetration(env, car));
    }
    env.world.free();
    console.log(`[${tag}] 車道 ${lane}：${(d / L).toFixed(2)} 圈、${(steps * spec.sim.dt_s).toFixed(2)} s、最大穿入 ${(pen * 1000).toFixed(3)} mm、最低 up.y ${up.toFixed(3)}`);
    expect(d).toBeGreaterThanOrEqual(3 * L);
    expect(pen).toBeLessThanOrEqual(0.001);
    expect(up).toBeGreaterThan(0.8);
  }
}

test('P16_vz_race VZ 示範車三條車道出發各跑官方 3 圈：不穿牆（≤ 1 mm）、不飛出、不翻覆', () => {
  raceThreeLanes(VZ, 'P16_vz');
}, 600000);

test('P16_vz_tuned 高速 VZ（TT2 單軸＋3.7:1，加零件調校）三條車道各跑 3 圈；側制振器座：VZ 側壁上的側制振器安裝與跑圈', () => {
  const tuned = loadConfig('vz-tuned');
  expect(codes(tuned)).toEqual([]);
  raceThreeLanes(tuned, 'P16_vz_tuned');
  // 側制振器座（查證紀錄：ITERATION_LOG iter-111）：AR 側制振器 15459（φ11.5 × 11.4 mm 推估）外掛在側壁外、貼近底盤底面；
  // 官方「一部のボディは加工が必要」：PC 車殼 pc-box 側裙碰到（車殼干涉），預設 owl-hush 裝得下。15515 方形短制振器裝得進 PC 車殼
  expect(codes({ ...tuned, massDamper: 'damper-ar-side' })).toEqual(['DAMPER_BODY_CLEARANCE']);
  expect(codes({ ...loadConfig('default'), massDamper: 'damper-ar-side' })).toEqual([]);
  const side = { ...tuned, massDamper: 'damper-side-square' };
  expect(codes(side)).toEqual([]);
  const asm = assemble(side);
  const ch = asm.partsBySlot.chassis;
  const wallTop = ch.groundClearanceRef_mm + ch.plateThickness_mm + ch.sideWallHeight_mm;
  const ds = asm.optional.dampers;
  expect(ds.length).toBe(2);
  for (const d of ds) {
    const b = d.adapter.plate;
    const zs = [Math.abs(b.min.z), Math.abs(b.max.z)];
    // 外掛式側座：側板底面 = 底盤底面（不降低離地高度）、比壁頂低；從中段側壁外緣（|z| 27）外側伸到配重外緣（查證紀錄：ITERATION_LOG iter-111）
    expect(b.min.y).toBeCloseTo(ch.groundClearanceRef_mm, 9);
    expect(b.max.y).toBeLessThan(wallTop);
    expect(Math.min(...zs)).toBeGreaterThan(27);
    expect(Math.max(...zs)).toBeGreaterThanOrEqual(Math.abs(d.seat.z) + d.part.width_mm / 2);
    expect(d.adapter.spacers.length).toBe(0);
  }
  raceThreeLanes(side, 'P16_vz_side');
}, 900000);
