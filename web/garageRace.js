// 換件頁的「上賽道」：直接使用 src/sim.js（與 vitest 物理測試同一套 Rapier 模擬，不另寫物理）
// 官方 3 圈：從換道器前（s = 0.15 m，與 tests 的整圈測試相同）的內側車道出發，每圈經過一次換道器 / 立體橋換車道
// （track.nextLane），3 圈內三條車道各跑一圈，跑滿 3 × 一圈長度即完賽
import { spec } from '../src/spec.js';
import { buildCircuit } from '../src/track.js';
import { initRapier, createWorld, createCar, stepCar, forwardSpeed, upAxis, carLevel, sliderState } from '../src/sim.js';

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
 * @property {number[]} lapTimes 已完成各圈的模擬時間 s（跨線時在物理步內插）
 * @property {number} voltage 電池端電壓 V（負載下）
 * @property {number} current 馬達電流 A
 * @property {number} lane 目前車道（0 = 內側）
 * @property {boolean} onBridge 目前在換道器立體橋上
 * @property {number[]} laneHistory 依序跑過的車道（地面層，換道後才新增）
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
  // 起跑線：換道器前、內側車道（lane 0）；終點 = 起跑線後 3 圈
  const s0 = 0.15;
  const finishDistance = RACE_LAPS * L;
  const car = createCar(env, { assembly: asm, s: s0, lane: 0 });
  /** @type {number[]} */
  const laneHistory = [0];
  let onBridge = false;
  const dt = spec.sim.dt_s;
  let stallTime = 0;
  let progress = 0;
  let lastS = s0;
  let simTime = 0;
  let realTime = 0;
  let finishTime = null;
  const lapTimes = [];
  let lastCrossingTime = 0;
  /** @type {RaceStatus} */
  let status = 'running';

  /** @type {() => void} 推進一步並累計沿賽道的行駛距離 */
  const stepOnce = () => {
    const previousProgress = progress;
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
    while (lapTimes.length < RACE_LAPS && progress >= (lapTimes.length + 1) * L) {
      const crossing = simTime - dt + dt * (((lapTimes.length + 1) * L - previousProgress) / ds);
      lapTimes.push(crossing - lastCrossingTime);
      lastCrossingTime = crossing;
    }
    if (progress >= finishDistance) {
      finishTime = lastCrossingTime;
      status = 'finished';
    }
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
    const timeBefore = simTime;
    for (let i = 0; i < steps; i++) {
      stepOnce();
      if (status !== 'running') break;
      if (i % 16 === 15 && performance.now() - t0 > FRAME_BUDGET_MS) {
        break;
      }
    }
    // 車道紀錄：只在地面層判斷（橋上的橫向位置不對應地面車道）
    onBridge = carLevel(env, car) === 'bridge';
    if (!onBridge && track.laneOf) {
      const t = car.chassis.translation();
      const lane = track.laneOf(track.path.project(t.x, t.z).d);
      if (lane !== laneHistory[laneHistory.length - 1]) {
        laneHistory.push(lane);
      }
    }
    if (progress >= finishDistance) {
      status = 'finished';
      return;
    }
    if (Math.abs(forwardSpeed(car)) < STALL_SPEED && simTime > 1) {
      stallTime += simTime - timeBefore;
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
    // 橋上沿用進橋前的車道（橋的橫向位置不對應地面車道）
    let lane = laneHistory[laneHistory.length - 1];
    if (!onBridge && track.laneOf) {
      lane = track.laneOf(c.d);
    }
    return {
      speed: forwardSpeed(car),
      distance: progress,
      laps: Math.max(0, Math.floor(progress / L)),
      lapProgress: Math.max(0, progress / L),
      finishDistance,
      lapLength: L,
      simTime: finishTime ?? simTime,
      lapTimes: lapTimes.slice(),
      voltage: car.last.terminalVoltage || car.battery.ocv(),
      current: car.last.current,
      lane,
      onBridge,
      laneHistory: laneHistory.slice(),
      realtimeRatio: realTime > 0 ? simTime / realTime : 1,
      status,
    };
  };

  /** Chassis pose and actual local slider offsets in mm, for rendering. */
  const pose = () => ({
    pos: car.chassis.translation(), rot: car.chassis.rotation(),
    sliders: Object.fromEntries(car.sliders.map((sl) => [sl.slot, sliderState(car, sl).u * 1000])),
  });

  /** 釋放 Rapier 世界（WASM 記憶體） */
  const dispose = () => {
    env.world.free();
  };

  return { track, advance, snapshot, pose, dispose, laps: RACE_LAPS };
}
