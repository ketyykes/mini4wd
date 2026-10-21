// 換件頁的「上賽道」：直接使用 src/sim.js（與 vitest 物理測試同一套 Rapier 模擬，不另寫物理）
// 3 線道賽道：從換道段出口的內側車道出發，每經過一次換道段往外換一個車道（內 → 中 → 外）。
// src/track.js 的外側換道橋目前只有外觀（物理上外側車道在第 3 次換道段入口被外牆收掉），
// 所以終點線設在第 3 次換道段入口：三個車道各跑完一整圈，總距離 = 3 圈 − 換道段長
import { spec } from '../src/spec.js';
import { buildCircuit } from '../src/track.js';
import { initRapier, createWorld, createCar, stepCar, forwardSpeed, upAxis } from '../src/sim.js';

/** 每幀物理計算的時間上限（ms）：超過就讓模擬比真實時間慢，畫面仍維持流暢 */
const FRAME_BUDGET_MS = 14;
/** 一幀最多補算的真實時間（s）：分頁切走再回來時不要一次補太多 */
const MAX_FRAME_DT_S = 0.05;
/** 一場的圈數（3 線道各跑一圈） */
const RACE_LAPS = 3;
/** 車速低於此值（m/s）持續 STALL_TIME_S 秒視為卡住 */
const STALL_SPEED = 0.05;
const STALL_TIME_S = 1.5;

/** @typedef {'running' | 'finished' | 'derailed' | 'stalled'} RaceStatus */

/**
 * @typedef {object} RaceSnapshot
 * @property {number} speed 前進速度 m/s
 * @property {number} distance 行駛距離（沿賽道中心線）m
 * @property {number} laps 完成圈數（整數）
 * @property {number} lapProgress 圈數（含小數）
 * @property {number} finishDistance 終點距離 m
 * @property {number} lapLength 一圈長度 m
 * @property {number} simTime 模擬時間 s
 * @property {number} voltage 電池端電壓 V（負載下）
 * @property {number} current 馬達電流 A
 * @property {number} lane 目前車道（0 = 內側）
 * @property {number} realtimeRatio 模擬時間 / 真實時間
 * @property {RaceStatus} status
 */

/** @type {ReturnType<typeof buildCircuit> | null} 賽道只建一次 */
let circuit = null;

/** @type {() => ReturnType<typeof buildCircuit>} */
export const getCircuit = () => {
  if (!circuit) {
    circuit = buildCircuit();
  }
  return circuit;
};

/**
 * 建立一場模擬（每次上賽道都建新的 Rapier 世界）
 * @type {(asm: any) => Promise<ReturnType<typeof createSession>>}
 */
export const startRace = async (asm) => {
  await initRapier();
  return createSession(asm);
};

/** @param {any} asm */
function createSession(asm) {
  const track = getCircuit();
  const env = createWorld(track);
  const L = track.path.length;
  const lc = track.laneChanger;
  // 起跑線：換道段出口後 5 cm、內側車道（lane 0）
  let s0 = 0.15;
  let finishDistance = RACE_LAPS * L;
  if (lc) {
    s0 = lc.end + 0.05;
    finishDistance = lc.start + RACE_LAPS * L - s0 - 0.02;
  }
  const car = createCar(env, { assembly: asm, s: s0, lane: 0 });
  const dt = spec.sim.dt_s;
  let stallTime = 0;
  let progress = 0;
  let lastS = s0;
  let simTime = 0;
  let realTime = 0;
  /** @type {RaceStatus} */
  let status = 'running';

  /** @type {() => void} 推進一步並累計沿賽道的行駛距離 */
  const stepOnce = () => {
    stepCar(env, car);
    simTime += dt;
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
  };

  /**
   * 依真實經過時間推進模擬（受每幀時間上限限制）
   * @type {(dtReal: number) => void}
   */
  const advance = (dtReal) => {
    if (status !== 'running') {
      return;
    }
    const want = Math.min(dtReal, MAX_FRAME_DT_S);
    realTime += want;
    const steps = Math.max(1, Math.round(want / dt));
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) {
      stepOnce();
      if (i % 16 === 15 && performance.now() - t0 > FRAME_BUDGET_MS) {
        break;
      }
    }
    if (progress >= finishDistance) {
      status = 'finished';
      return;
    }
    if (Math.abs(forwardSpeed(car)) < STALL_SPEED && simTime > 1) {
      stallTime += want;
      if (stallTime > STALL_TIME_S) {
        status = 'stalled';
        return;
      }
    } else {
      stallTime = 0;
    }
    // 翻車或掉出賽道：車體上方向偏離 > 60°，或掉到地面以下
    const t = car.chassis.translation();
    if (upAxis(car).y < 0.5 || t.y < -0.05) {
      status = 'derailed';
    }
  };

  /** @type {() => RaceSnapshot} */
  const snapshot = () => {
    const t = car.chassis.translation();
    const c = track.path.project(t.x, t.z);
    let lane = 0;
    if (track.laneOf) {
      lane = track.laneOf(c.d);
    }
    return {
      speed: forwardSpeed(car),
      distance: progress,
      laps: Math.max(0, Math.floor(progress / L)),
      lapProgress: Math.max(0, progress / L),
      finishDistance,
      lapLength: L,
      simTime,
      voltage: car.last.terminalVoltage || car.battery.ocv(),
      current: car.last.current,
      lane,
      realtimeRatio: realTime > 0 ? simTime / realTime : 1,
      status,
    };
  };

  /** @type {() => { pos: { x: number, y: number, z: number }, rot: { x: number, y: number, z: number, w: number } }} */
  const pose = () => ({ pos: car.chassis.translation(), rot: car.chassis.rotation() });

  /** 釋放 Rapier 世界（WASM 記憶體） */
  const dispose = () => {
    env.world.free();
  };

  return { track, advance, snapshot, pose, dispose, laps: RACE_LAPS };
}
