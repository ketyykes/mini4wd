// P01–P03、P05–P07、P10 物理驗證（定義見 SPEC.md 第 2 部分；容許誤差寫在本檔，不得為通過而放寬）
// P04、P08、P09 第二階段改為透過零件組裝 / 每款車殼檢查，移到 modular.test.js
import { describe, test, expect, beforeAll } from 'vitest';
import { spec, deriveParams } from '../src/spec.js';
import { Battery, theoreticalTopSpeed, longitudinalForce } from '../src/powertrain.js';
import { buildCircuit, buildStraight } from '../src/track.js';
import { initRapier, createWorld, createCar, stepCar, forwardSpeed, upAxis, wallPenetration, minWallContactDist, localToWorld } from '../src/sim.js';

const P = deriveParams();
const G_STD = spec.drivetrain.standardGearRatio;

/** @type {(s: number) => string} */
const f3 = (x) => x.toFixed(3);

/**
 * 在長直線上全速跑，回傳穩定極速（最後 0.5 s 平均）
 * @type {(opt: { soc: number, seconds?: number }) => { vSteady: number, current: number, terminalVoltage: number }}
 */
function runStraightTopSpeed({ soc, seconds = 7 }) {
  const env = createWorld(buildStraight(40));
  const car = createCar(env, { s: 0.2, lane: 0, soc, drain: false });
  const steps = Math.round(seconds / spec.sim.dt_s);
  const tail = Math.round(0.5 / spec.sim.dt_s);
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    stepCar(env, car);
    if (i >= steps - tail) {
      sum += forwardSpeed(car);
    }
  }
  return { vSteady: sum / tail, current: car.last.current, terminalVoltage: car.last.terminalVoltage };
}

/**
 * 主賽道跑一圈（從換道段前的內側線道出發），逐步記錄驗證所需資料
 */
function runCircuitLap() {
  const track = buildCircuit();
  const env = createWorld(track);
  const s0 = 0.15;
  const car = createCar(env, { s: s0, lane: 0 });
  const L = track.path.length;
  let progress = 0;
  let lastS = s0;
  let arcSteps = 0;
  let arcContactSteps = 0;
  let maxPen = -Infinity;
  let minContactDist = Infinity;
  let minUp = 1;
  let minY = Infinity;
  let maxY = -Infinity;
  let laneBefore = null;
  let laneAfter = null;
  let speedAfterChanger = null;
  let maxSpeed = 0;
  const lc = track.laneChanger;
  const maxSteps = Math.round(10 / spec.sim.dt_s);
  let steps = 0;
  for (; steps < maxSteps && progress < L + 0.05; steps++) {
    stepCar(env, car);
    const t = car.chassis.translation();
    const c = track.path.project(t.x, t.z);
    let ds = c.s - lastS;
    if (ds < -L / 2) {
      ds += L;
    }
    if (ds > L / 2) {
      ds -= L;
    }
    progress += ds;
    lastS = c.s;
    maxSpeed = Math.max(maxSpeed, forwardSpeed(car));

    maxPen = Math.max(maxPen, wallPenetration(env, car));
    for (const r of car.rollers) {
      minContactDist = Math.min(minContactDist, minWallContactDist(env, r.collider));
    }
    minContactDist = Math.min(minContactDist, minWallContactDist(env, car.bodyCol));
    minUp = Math.min(minUp, upAxis(car).y);
    minY = Math.min(minY, t.y);
    maxY = Math.max(maxY, t.y);

    // P05：彎道中，外側（d 較小、遠離彎心）導輪與牆接觸
    if (c.seg.type === 'arc') {
      arcSteps++;
      let touching = false;
      for (const r of car.rollers) {
        const w = localToWorld(car, { x: r.x * 0.001, y: r.y * 0.001, z: r.z * 0.001 });
        const rd = track.path.project(w.x, w.z).d;
        if (rd < c.d && minWallContactDist(env, r.collider) <= 0.0005) {
          touching = true;
        }
      }
      if (touching) {
        arcContactSteps++;
      }
    }
    // P10：換道段前後的車道
    const sAbs = s0 + progress;
    if (laneBefore === null && sAbs >= lc.start - 0.1) {
      laneBefore = track.laneOf(c.d);
    }
    if (laneAfter === null && sAbs >= lc.end + 0.25) {
      laneAfter = track.laneOf(c.d);
      speedAfterChanger = forwardSpeed(car);
    }
  }
  return {
    lapLength: L,
    progress,
    time: steps * spec.sim.dt_s,
    arcContactFrac: arcSteps > 0 ? arcContactSteps / arcSteps : 0,
    maxPen,
    minContactDist,
    minUp,
    minY,
    maxY,
    laneBefore,
    laneAfter,
    speedAfterChanger,
    maxSpeed,
  };
}

let lap = null;

beforeAll(async () => {
  await initRapier();
  lap = runCircuitLap();
  console.log('[circuit lap]', JSON.stringify(lap));
});

describe('物理驗證 P01–P03、P05–P07、P10', () => {
  test('P01_top_speed 理論極速 vs 模擬極速（誤差 < 10%）', () => {
    const battery = new Battery(1);
    const theory = theoreticalTopSpeed({ voc: battery.ocv(), gearRatio: G_STD, bearingType: 'bearing', massKg: P.massTotal });
    const sim = runStraightTopSpeed({ soc: 1 });
    const err = Math.abs(sim.vSteady - theory.vTheory) / theory.vTheory;
    console.log(`[P01] v0=${f3(theory.v0)} m/s（無載理論）, 理論極速=${f3(theory.vTheory)} m/s, 模擬穩定極速=${f3(sim.vSteady)} m/s, 誤差=${(err * 100).toFixed(2)}%, 端電壓=${f3(sim.terminalVoltage)} V, 電流=${f3(sim.current)} A`);
    expect(err).toBeLessThan(0.1);
  }, 60000);

  test('P02_battery_sag 端電壓隨放電量單調不增且下降 ≥ 5%', () => {
    // 以 1 s 步長積分：每一步在當下 SOC 求穩定行駛的工作點（電流），再扣除電量
    const battery = new Battery(1);
    const samples = [];
    const cutoff = spec.battery.cells * spec.battery.cutoffCellVoltage_V;
    for (let t = 0; t < 4 * 3600; t++) {
      const theory = theoreticalTopSpeed({ voc: battery.ocv(), gearRatio: G_STD, bearingType: 'bearing', massKg: P.massTotal });
      const op = longitudinalForce({ speed: theory.vTheory, gearRatio: G_STD, powered: true, battery, bearingType: 'bearing', massKg: P.massTotal });
      samples.push({ mAh: battery.drainedC / 3.6, v: op.terminalVoltage, current: op.current });
      if (op.terminalVoltage <= cutoff || battery.soc <= 0) {
        break;
      }
      battery.drain(op.current, 1);
    }
    let monotonic = true;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].v > samples[i - 1].v + 1e-9) {
        monotonic = false;
      }
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    const drop = (first.v - last.v) / first.v;
    console.log(`[P02] 樣本數=${samples.length}, 放電量=${last.mAh.toFixed(1)} mAh, 端電壓 ${f3(first.v)} → ${f3(last.v)} V, 下降 ${(drop * 100).toFixed(1)}%, 單調不增=${monotonic}, 平均電流≈${f3(first.current)} A`);
    expect(monotonic).toBe(true);
    expect(drop).toBeGreaterThanOrEqual(0.05);
  });

  test('P03_low_battery_slower SOC 20% 穩定車速 < 滿電', () => {
    const full = runStraightTopSpeed({ soc: 1 });
    const low = runStraightTopSpeed({ soc: 0.2 });
    console.log(`[P03] 滿電 ${f3(full.vSteady)} m/s（${f3(full.terminalVoltage)} V）, SOC 20% ${f3(low.vSteady)} m/s（${f3(low.terminalVoltage)} V）`);
    expect(low.vSteady).toBeLessThan(full.vSteady);
  }, 60000);

  test('P05_roller_wall_contact 彎道外側導輪貼牆時間比例 ≥ 50%', () => {
    console.log(`[P05] 彎道外側導輪接觸比例 ${(lap.arcContactFrac * 100).toFixed(1)}%`);
    expect(lap.arcContactFrac).toBeGreaterThanOrEqual(0.5);
  });

  test('P06_no_wall_penetration 不穿牆（穿透深度 ≤ 1 mm）', () => {
    const contactPen = Math.max(0, -lap.minContactDist);
    const pen = Math.max(lap.maxPen, contactPen);
    console.log(`[P06] 幾何最大超出牆面 ${(lap.maxPen * 1000).toFixed(3)} mm, 接觸最大穿透 ${(contactPen * 1000).toFixed(3)} mm`);
    expect(pen).toBeLessThanOrEqual(0.001);
  });

  test('P07_stays_on_track 標準馬達＋標準齒輪比跑完 1 圈不飛出、不翻覆', () => {
    const completed = lap.progress >= lap.lapLength;
    console.log(`[P07] 進度 ${f3(lap.progress)} / ${f3(lap.lapLength)} m, 單圈 ${f3(lap.time)} s, 最高速 ${f3(lap.maxSpeed)} m/s, 最小 up.y ${f3(lap.minUp)}, 車體 y 範圍 ${(lap.minY * 1000).toFixed(2)}–${(lap.maxY * 1000).toFixed(2)} mm, 最大超出牆面 ${(lap.maxPen * 1000).toFixed(3)} mm`);
    expect(completed).toBe(true);
    expect(lap.minUp).toBeGreaterThan(0.8);
    expect(lap.maxY).toBeLessThan(spec.track.wallHeight_mm * 0.001);
    expect(lap.minY).toBeGreaterThan(-0.005);
    expect(lap.maxPen).toBeLessThanOrEqual(0.001);
  });

  test('P10_lane_changer 通過換道段後換到相鄰車道且未卡住、未飛出', () => {
    console.log(`[P10] 換道前車道 ${lap.laneBefore} → 換道後車道 ${lap.laneAfter}, 出口速度 ${lap.speedAfterChanger === null ? 'N/A' : f3(lap.speedAfterChanger)} m/s, 最小 up.y ${f3(lap.minUp)}`);
    expect(lap.laneBefore).not.toBeNull();
    expect(lap.laneAfter).toBe(lap.laneBefore + 1);
    expect(lap.speedAfterChanger).toBeGreaterThan(0.5);
    expect(lap.minUp).toBeGreaterThan(0.8);
  });
});
