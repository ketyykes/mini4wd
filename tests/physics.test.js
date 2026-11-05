// P01–P03、P05–P07、P10 物理驗證（定義見 SPEC.md 第 2 部分；容許誤差寫在本檔，不得為通過而放寬）
// P04、P08、P09 透過零件組裝 / 每款車殼檢查，放在 modular.test.js
import { describe, test, expect, beforeAll } from 'vitest';
import { spec } from '../src/spec.js';
import { Battery, theoreticalTopSpeed, longitudinalForce } from '../src/powertrain.js';
import { assemble, loadConfig } from '../src/assembly.js';
import { buildCircuit, buildStraight } from '../src/track.js';
import { initRapier, createWorld, createCar, stepCar, forwardSpeed, upAxis, wallPenetration, minWallContactDist, localToWorld, heightAboveRoad, carLevel } from '../src/sim.js';

// P01–P10 使用預設組裝（configs/default.json，SPEC 1.12）
const ASM = assemble(loadConfig('default'));
const P = ASM.P;

/** @type {(s: number) => string} */
const f3 = (x) => x.toFixed(3);

/**
 * 在長直線上全速跑，回傳穩定極速（最後 0.5 s 平均）
 * @type {(opt: { soc: number, seconds?: number }) => { vSteady: number, current: number, terminalVoltage: number }}
 */
function runStraightTopSpeed({ soc, seconds = 7 }) {
  const env = createWorld(buildStraight(40));
  const car = createCar(env, { assembly: ASM, s: 0.2, lane: 0, soc, drain: false });
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
 * 主賽道從 s0 = 0.15（換道器前）的指定車道出發，逐步記錄驗證所需資料。
 * 預設跑一圈；until 指定時跑到絕對位置 s0 + 進度 ≥ until 為止（P10 只跑到換道器出口後）
 * @type {(opt?: { lane?: number, until?: number }) => any}
 */
function runCircuitLap({ lane = 0, until } = {}) {
  const track = buildCircuit();
  const env = createWorld(track);
  const s0 = 0.15;
  const car = createCar(env, { assembly: ASM, s: s0, lane });
  const L = track.path.length;
  const stopAt = until === undefined ? L + 0.05 : until - s0;
  let maxH = -Infinity;
  let minH = Infinity;
  let maxBridgeY = 0;
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
  for (; steps < maxSteps && progress < stopAt; steps++) {
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
    // 離所在層路面的高度（換道器橋上以橋面為準）
    const h = heightAboveRoad(env, car);
    maxH = Math.max(maxH, h);
    minH = Math.min(minH, h);
    if (carLevel(env, car) === 'bridge') {
      maxBridgeY = Math.max(maxBridgeY, t.y);
    }

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
    maxH,
    minH,
    maxBridgeY,
    track,
  };
}

let lap = null;

beforeAll(async () => {
  await initRapier();
  lap = runCircuitLap();
  const { track, ...rest } = lap;
  console.log('[circuit lap]', JSON.stringify(rest));
});

describe('物理驗證 P01–P03、P05–P07、P10', () => {
  test('P01_top_speed 理論極速 vs 模擬極速（誤差 < 10%）', () => {
    const theory = theoreticalTopSpeed({ assembly: ASM, soc: 1 });
    const sim = runStraightTopSpeed({ soc: 1 });
    const err = Math.abs(sim.vSteady - theory.vTheory) / theory.vTheory;
    console.log(`[P01] v0=${f3(theory.v0)} m/s（無載理論）, 理論極速=${f3(theory.vTheory)} m/s, 模擬穩定極速=${f3(sim.vSteady)} m/s, 誤差=${(err * 100).toFixed(2)}%, 端電壓=${f3(sim.terminalVoltage)} V, 電流=${f3(sim.current)} A`);
    expect(err).toBeLessThan(0.1);
  }, 60000);

  test('P02_battery_sag 端電壓隨放電量單調不增且下降 ≥ 5%', () => {
    // 以 1 s 步長積分：每一步在當下 SOC 求穩定行駛的工作點（電流），再扣除電量
    const battery = new Battery(P, 1);
    const samples = [];
    const cutoff = P.cells * P.cutoffCellVoltage;
    for (let t = 0; t < 4 * 3600; t++) {
      const theory = theoreticalTopSpeed({ assembly: ASM, voc: battery.ocv() });
      const op = longitudinalForce(P, { speed: theory.vTheory, powered: true, battery });
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

  test('P10_lane_changer 三條車道出發都能通過換道器（立體橋），依佈局換到下一條車道（內→中、中→外、外→內走橋），未卡住、未飛出、不穿牆', () => {
    const track = lap.track;
    const lc = track.laneChanger;
    const b = track.bridge;
    const wallH = spec.track.wallHeight_mm * 0.001;
    console.log(`[P10] 換道器 s ${f3(lc.start)}–${f3(lc.end)} m：橋面 ${(b.deckHeight * 1000).toFixed(0)} mm、坡度 ${b.slope_deg}°、引道 ${f3(b.rampLength)} m、斜向段 ${f3(b.latEnd - b.latStart)} m、橋下淨高 ${(b.clearance * 1000).toFixed(0)} mm（支架樑底 ${(b.supportClearance * 1000).toFixed(0)} mm）`);
    // 橋下淨高（含支架樑底）必須 ≥ 規則車高上限 70 mm
    expect(b.supportClearance).toBeGreaterThanOrEqual(spec.rules.maxHeight_mm * 0.001);
    for (const lane of [0, 1, 2]) {
      // 內側車道直接用 P05–P07 那一圈；中、外側車道各跑到換道器出口後 0.3 m
      const r = lane === 0 ? lap : runCircuitLap({ lane, until: lc.end + 0.3 });
      const pen = Math.max(r.maxPen, Math.max(0, -r.minContactDist));
      console.log(`[P10] 車道 ${lane}：換道前 ${r.laneBefore} → 換道後 ${r.laneAfter}（應為 ${track.nextLane(lane)}）, 出口速度 ${r.speedAfterChanger === null ? 'N/A' : f3(r.speedAfterChanger)} m/s, 最小 up.y ${f3(r.minUp)}, 離路面高度 ${(r.minH * 1000).toFixed(2)}–${(r.maxH * 1000).toFixed(2)} mm, 橋上最高 ${(r.maxBridgeY * 1000).toFixed(1)} mm, 穿透 ${(pen * 1000).toFixed(3)} mm`);
      expect(r.laneBefore).toBe(lane);
      expect(r.laneAfter).toBe(track.nextLane(lane));
      expect(r.speedAfterChanger).toBeGreaterThan(0.5);
      expect(r.minUp).toBeGreaterThan(0.8);
      expect(r.maxH).toBeLessThan(wallH);
      expect(r.minH).toBeGreaterThan(-0.005);
      expect(pen).toBeLessThanOrEqual(0.001);
      if (lane === 2) {
        // 外側車道真的爬上橋面（車體原點達橋面高度 −5 mm 以上）
        expect(r.maxBridgeY).toBeGreaterThan(b.deckHeight - 0.005);
      } else {
        // 其他車道從橋下通過，沒有上橋
        expect(r.maxBridgeY).toBe(0);
      }
    }
  }, 120000);
});
