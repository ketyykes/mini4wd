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
 * 馬達內部摩擦扭力（庫侖＋黏滯），在 3 V 無載轉速時合計 = k_t·I0（主 agent 決策 D1）
 * @param {number} omegaMotor 馬達角速度 rad/s（≥ 0）
 * @returns {number} N·m
 */
export function motorFrictionTorque(omegaMotor) {
  const c = P.motorFrictionCoulombFraction;
  const w = Math.max(0, omegaMotor);
  return P.motorFrictionTorque * (c + ((1 - c) * w) / P.omega0Rated);
}

/**
 * 在給定開路電壓與馬達轉速下，求電流、端電壓與馬達輸出扭力
 * 電路：Voc − I·(Rb + Rm) − Ke·ω = 0；輸出扭力 τ = Kt·I − τ_f(ω)
 * @param {number} voc 電池開路電壓
 * @param {number} omegaMotor 馬達角速度 rad/s
 */
export function motorOperatingPoint(voc, omegaMotor) {
  const rTotal = P.batteryResistance + P.motorResistance;
  const current = (voc - P.ke * omegaMotor) / rTotal;
  const torque = P.kt * current - motorFrictionTorque(omegaMotor);
  const terminalVoltage = voc - current * P.batteryResistance;
  return { current, torque, terminalVoltage };
}

/**
 * 等效線性馬達參數（含電池內阻與 I0 摩擦）：τ_out = τ_stall · (1 − ω/ω0)
 * τ_out(ω) = Kt·(V − Ke·ω)/R − Kt·I0·[c + (1−c)·ω/ω0r] 對 ω 為線性，故仍是 SPEC P01 的線性馬達模型
 * @param {number} voc 電池開路電壓
 */
export function linearMotorParams(voc) {
  const rTotal = P.batteryResistance + P.motorResistance;
  const c = P.motorFrictionCoulombFraction;
  const tauStall = (P.kt * voc) / rTotal - P.motorFrictionTorque * c;
  const slope = (P.kt * P.ke) / rTotal + (P.motorFrictionTorque * (1 - c)) / P.omega0Rated;
  return { omega0: tauStall / slope, tauStall };
}

/**
 * 依軸承種類取摩擦係數
 * @param {'bearing'|'bushing'} bearingType
 */
function bearingMu(bearingType) {
  const b = spec.bearings;
  return bearingType === 'bearing' ? b.ballBearingFrictionCoeff : b.bushingFrictionCoeff;
}

/**
 * 輪軸支撐（前後軸各左右 2 處，共 4 處）摩擦換算到輪胎接地點的阻力（N）
 * 4 處負載合計 = 車重；F = μ·N·(r_shaft / r_wheel)（SPEC 1.6）
 * @param {'bearing'|'bushing'} bearingType
 * @param {number} massKg 車重
 */
export function axleFrictionForce(bearingType, massKg) {
  const shaftR = spec.bearings.shaftRadius_mm * 0.001;
  const normalTotal = massKg * P.gravity;
  return (bearingMu(bearingType) * normalTotal * shaftR) / P.wheelRadius;
}

/**
 * 中間齒輪軸承（前後各 1 組）的損失比例 k_c：
 * 中間齒輪兩個嚙合點的切向力 F1 = τ_c / r_大齒、F2 = τ_c / r_小齒，MA 的小齒輪、中間齒輪、輪軸齒輪大致排成一直線，
 * 兩力同向相加；軸承摩擦扭力 = μ·(F1 + F2)·r_軸 = k_c·τ_c，k_c = μ·r_軸·(1/r_大齒 + 1/r_小齒)
 * @param {'bearing'|'bushing'} bearingType
 */
export function counterGearLossFraction(bearingType) {
  const d = spec.drivetrain;
  const rs = spec.bearings.counterShaftRadius_mm;
  return bearingMu(bearingType) * rs * (1 / d.counterLargePitchRadius_mm + 1 / d.counterSmallPitchRadius_mm);
}

/**
 * 斷電時馬達內部摩擦（反拖）經齒輪與中間齒輪軸承放大後在輪上的阻力（N）
 * 反向傳動：輪 → 輪軸齒輪 → 中間齒輪（軸承損失 k_c）→ 小齒輪 → 馬達，齒面效率 η 同正向
 * @param {number} gearRatio
 * @param {number} speed m/s
 * @param {'bearing'|'bushing'} bearingType
 */
export function motorCoastDragForce(gearRatio, speed, bearingType) {
  if (!spec.motor.coastMotorDrag) {
    return 0;
  }
  const omegaMotor = (Math.max(0, speed) / P.wheelRadius) * gearRatio;
  const kc = counterGearLossFraction(bearingType);
  return (motorFrictionTorque(omegaMotor) * gearRatio * (1 + kc)) / P.wheelRadius / P.gearEfficiency;
}

/**
 * 正向傳動效率：齒面效率 η（SPEC 1.12）× 中間齒輪軸承損失 (1 − k_c)
 * @param {'bearing'|'bushing'} bearingType
 */
export function driveEfficiency(bearingType) {
  return P.gearEfficiency * (1 - counterGearLossFraction(bearingType));
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
  let resist = P.crr * massKg * P.gravity + axleFrictionForce(bearingType, massKg);
  if (powered) {
    const op = motorOperatingPoint(battery.ocv(), omegaMotor);
    current = op.current;
    terminalVoltage = op.terminalVoltage;
    drive = (op.torque * gearRatio * driveEfficiency(bearingType)) / r;
  } else {
    resist += motorCoastDragForce(gearRatio, speed, bearingType);
  }
  return { drive, resist, current, terminalVoltage };
}

/**
 * 解析理論極速：驅動力 = 滾動阻力 + 軸承阻力 + 空氣阻力（傳動損失含在 driveEfficiency），二分法求根
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
  const eta = driveEfficiency(bearingType);
  const netForce = (v) => {
    const omega = (v / r) * gearRatio;
    const drive = (tauStall * (1 - omega / omega0) * gearRatio * eta) / r;
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
