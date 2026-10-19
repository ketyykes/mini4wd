// 動力鏈模型：NiMH 電池（內阻＋隨 SOC 變化的開路電壓）→ 線性 DC 馬達 → 齒輪比 → 輪上驅動力
// 純函式，不依賴物理引擎；物理模擬每一步呼叫，解析理論值也用同一套公式
import { spec, deriveParams } from './spec.js';

const P = deriveParams();

/**
 * 單顆電池開路電壓（依 SOC 線性內插）
 * @param {number} soc 0–1
 * @returns {number} V
 */
export function cellOcv(soc) {
  const curve = spec.battery.cellOcvCurve;
  const x = Math.min(1, Math.max(0, soc));
  for (let i = 1; i < curve.length; i++) {
    const [s1, v1] = curve[i];
    const [s0, v0] = curve[i - 1];
    if (x <= s1) {
      const t = (x - s0) / (s1 - s0);
      return v0 + t * (v1 - v0);
    }
  }
  return curve[curve.length - 1][1];
}

/** 電池組（2 顆串聯）狀態 */
export class Battery {
  constructor(soc = 1) {
    this.soc = soc;
    this.drainedC = 0;
  }

  /** 開路電壓 V */
  ocv() {
    return spec.battery.cells * cellOcv(this.soc);
  }

  /** 以電流 I（A）放電 dt 秒 */
  drain(current, dt) {
    const dq = Math.max(0, current) * dt;
    this.drainedC += dq;
    this.soc = Math.max(0, this.soc - dq / P.capacity_C);
  }
}

/**
 * 在給定開路電壓與馬達轉速下，求電流、端電壓與馬達扭力
 * 電路：Voc − I·(Rb + Rm) − Ke·ω = 0
 * @param {number} voc 電池開路電壓
 * @param {number} omegaMotor 馬達角速度 rad/s
 */
export function motorOperatingPoint(voc, omegaMotor) {
  const rTotal = P.batteryResistance + P.motorResistance;
  const current = (voc - P.ke * omegaMotor) / rTotal;
  const torque = P.kt * current;
  const terminalVoltage = voc - current * P.batteryResistance;
  return { current, torque, terminalVoltage };
}

/**
 * 等效線性馬達參數（含電池內阻）：τ = τ_stall · (1 − ω/ω0)
 * @param {number} voc 電池開路電壓
 */
export function linearMotorParams(voc) {
  const rTotal = P.batteryResistance + P.motorResistance;
  return {
    omega0: voc / P.ke,
    tauStall: (P.kt * voc) / rTotal,
  };
}

/**
 * 依軸承種類，計算輪軸支撐摩擦換算到輪胎接地點的阻力（N）
 * @param {'bearing'|'bushing'} bearingType
 * @param {number} massKg 車重
 */
export function axleFrictionForce(bearingType, massKg) {
  const b = spec.bearings;
  const r = P.wheelRadius;
  const shaftR = b.shaftRadius_mm * 0.001;
  const normalTotal = massKg * P.gravity;
  const mu = bearingType === 'bearing' ? b.ballBearingFrictionCoeff : b.bushingFrictionCoeff;
  // F = μ·N·(r_shaft / r_wheel)（SPEC 1.6）
  return (mu * normalTotal * shaftR) / r;
}

/**
 * 斷電時馬達內部摩擦扭力，經齒輪放大後在輪上的阻力（N）
 * @param {number} gearRatio
 */
export function motorCoastDragForce(gearRatio, enabled = spec.motor.coastMotorDrag) {
  if (!enabled) {
    return 0;
  }
  return (P.motorFrictionTorque * gearRatio) / P.wheelRadius / P.gearEfficiency;
}

/**
 * 計算某速度下的縱向力（全部 4 輪合計，N），正值為推進
 * 不含空氣阻力（空氣阻力由物理模擬直接施加在車體上）
 * @param {object} opt
 * @param {number} opt.speed 前進速度 m/s
 * @param {number} opt.gearRatio
 * @param {boolean} opt.powered 是否通電
 * @param {Battery} opt.battery
 * @param {'bearing'|'bushing'} opt.bearingType
 * @param {number} opt.massKg
 */
export function longitudinalForce({ speed, gearRatio, powered, battery, bearingType, massKg }) {
  const r = P.wheelRadius;
  const omegaMotor = (Math.max(0, speed) / r) * gearRatio;
  let drive = 0;
  let current = 0;
  let terminalVoltage = battery.ocv();
  if (powered) {
    const op = motorOperatingPoint(battery.ocv(), omegaMotor);
    current = op.current;
    terminalVoltage = op.terminalVoltage;
    drive = (op.torque * gearRatio * P.gearEfficiency) / r;
  }
  let resist = P.crr * massKg * P.gravity + axleFrictionForce(bearingType, massKg);
  if (!powered) {
    resist += motorCoastDragForce(gearRatio);
  }
  return { drive, resist, current, terminalVoltage };
}

/**
 * 解析理論極速：驅動力 = 滾動阻力 + 軸承阻力 + 空氣阻力，二分法求根
 * @param {object} opt
 * @param {number} opt.voc 電池開路電壓
 * @param {number} opt.gearRatio
 * @param {'bearing'|'bushing'} opt.bearingType
 * @param {number} opt.massKg
 */
export function theoreticalTopSpeed({ voc, gearRatio, bearingType, massKg }) {
  const r = P.wheelRadius;
  const { omega0, tauStall } = linearMotorParams(voc);
  const v0 = (omega0 / gearRatio) * r;
  const netForce = (v) => {
    const omega = (v / r) * gearRatio;
    const drive = (tauStall * (1 - omega / omega0) * gearRatio * P.gearEfficiency) / r;
    const resist = P.crr * massKg * P.gravity + axleFrictionForce(bearingType, massKg) + P.airDragK * v * v;
    return drive - resist;
  };
  let lo = 0;
  let hi = v0;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (netForce(mid) > 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { vTheory: 0.5 * (lo + hi), v0, omega0, tauStall };
}

export const derived = P;
