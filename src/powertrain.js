// 動力鏈模型：NiMH 電池（內阻＋隨 SOC 變化的開路電壓）→ 線性 DC 馬達 → 齒輪比 → 輪上驅動力
// 純函式，不依賴物理引擎；物理模擬每一步呼叫，解析理論值也用同一套公式
// 第二階段：所有函式都吃組裝推導出的物理參數 P（asm.P，見 spec.js deriveParams），換零件就換一份 P

/**
 * 單顆電池開路電壓（依 SOC 線性內插）
 * @type {(P: any, soc: number) => number}
 */
export function cellOcv(P, soc) {
  const curve = P.ocvCurve;
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
  /** @param {any} P 組裝物理參數 @param {number} soc */
  constructor(P, soc = 1) {
    this.P = P;
    this.soc = soc;
    this.drainedC = 0;
  }

  /** 開路電壓 V */
  ocv() {
    return this.P.cells * cellOcv(this.P, this.soc);
  }

  /** 以電流 I（A）放電 dt 秒 */
  drain(current, dt) {
    const dq = Math.max(0, current) * dt;
    this.drainedC += dq;
    this.soc = Math.max(0, this.soc - dq / this.P.capacity_C);
  }
}

/**
 * 馬達內部摩擦扭力（庫侖＋黏滯），在 3 V 無載轉速時合計 = k_t·I0（主 agent 決策 D1）
 * @type {(P: any, omegaMotor: number) => number} N·m
 */
export function motorFrictionTorque(P, omegaMotor) {
  const c = P.motorFrictionCoulombFraction;
  const w = Math.max(0, omegaMotor);
  return P.motorFrictionTorque * (c + ((1 - c) * w) / P.omega0Rated);
}

/**
 * 電池組內阻（Ω，2 顆串聯）：電池零件有 cellResistanceCurve（內阻隨 SOC 變化，例如鹼性電池放電後內阻上升）時依 SOC 內插，否則為定值
 * @type {(P: any, soc: number) => number}
 */
export function batteryResistanceAt(P, soc) {
  const curve = P.cellResistanceCurve;
  if (!curve) {
    return P.batteryResistance;
  }
  const x = Math.min(1, Math.max(0, soc));
  for (let i = 1; i < curve.length; i++) {
    const [s1, r1] = curve[i];
    const [s0, r0] = curve[i - 1];
    if (x <= s1) {
      return P.cells * (r0 + ((x - s0) / (s1 - s0)) * (r1 - r0));
    }
  }
  return P.cells * curve[curve.length - 1][1];
}

/**
 * 在給定開路電壓與馬達轉速下，求電流、端電壓與馬達輸出扭力
 * 電路（第四階段加入迴路電阻 Rc：電池端子、開關、馬達端子的本體＋接點電阻，見 switch 零件）：
 *   Voc − I·(Rb + Rc + Rm) − Ke·ω = 0；輸出扭力 τ = Kt·I − τ_f(ω)
 * terminalVoltage = 電池端電壓 Voc − I·Rb；motorVoltage = 馬達端子電壓 Voc − I·(Rb + Rc)
 * @type {(P: any, voc: number, omegaMotor: number, rb?: number) => { current: number, torque: number, terminalVoltage: number, motorVoltage: number }}
 */
export function motorOperatingPoint(P, voc, omegaMotor, rb = P.batteryResistance) {
  const rc = P.circuitResistance ?? 0;
  const rTotal = rb + rc + P.motorResistance;
  const current = (voc - P.ke * omegaMotor) / rTotal;
  const torque = P.kt * current - motorFrictionTorque(P, omegaMotor);
  const terminalVoltage = voc - current * rb;
  const motorVoltage = voc - current * (rb + rc);
  return { current, torque, terminalVoltage, motorVoltage };
}

/**
 * 等效線性馬達參數（含電池內阻與 I0 摩擦）：τ_out = τ_stall · (1 − ω/ω0)
 * τ_out(ω) = Kt·(V − Ke·ω)/R − Kt·I0·[c + (1−c)·ω/ω0r] 對 ω 為線性，故仍是 SPEC P01 的線性馬達模型
 * @type {(P: any, voc: number, rb?: number) => { omega0: number, tauStall: number }}
 */
export function linearMotorParams(P, voc, rb = P.batteryResistance) {
  const rTotal = rb + (P.circuitResistance ?? 0) + P.motorResistance;
  const c = P.motorFrictionCoulombFraction;
  const tauStall = (P.kt * voc) / rTotal - P.motorFrictionTorque * c;
  const slope = (P.kt * P.ke) / rTotal + (P.motorFrictionTorque * (1 - c)) / P.omega0Rated;
  return { omega0: tauStall / slope, tauStall };
}

/**
 * 輪軸支撐（前後軸各左右 2 處，共 4 處）摩擦換算到輪胎接地點的阻力（N）
 * 4 處負載合計 = 4 輪法向力合計 normalTotal（省略時 = 車重，平地靜態）；F = μ·N·(r_shaft / r_wheel)（SPEC 1.6）；μ 由組裝的軸承零件決定
 * @type {(P: any, normalTotal?: number) => number}
 */
export function axleFrictionForce(P, normalTotal = P.massTotal * P.gravity) {
  return (P.bearingMu * normalTotal * P.shaftRadius) / P.wheelRadius;
}

/**
 * 中間齒輪軸承（前後各 1 組）的損失比例 k_c：
 * 中間齒輪兩個嚙合點的切向力 F1 = τ_c / r_大齒、F2 = τ_c / r_小齒，MA 的小齒輪、中間齒輪、輪軸齒輪大致排成一直線，
 * 兩力同向相加；軸承摩擦扭力 = μ·(F1 + F2)·r_軸 = k_c·τ_c，k_c = μ·r_軸·(1/r_大齒 + 1/r_小齒)（μ = 中間齒輪軸承的摩擦係數）
 * @type {(P: any) => number}
 */
export function counterGearLossFraction(P) {
  // iter-59：μ 用中間齒輪軸承自己的值（中間齒輪軸 slot：含氟塗層軸 / 中間齒輪培林組），舊的整車參數沒有時同輪軸軸承
  const mu = P.counterBearingMu ?? P.bearingMu;
  return mu * P.counterShaftRadius_mm * (1 / P.counterLargePitchRadius_mm + 1 / P.counterSmallPitchRadius_mm);
}

/**
 * 斷電時馬達內部摩擦（反拖）經齒輪與中間齒輪軸承放大後在輪上的阻力（N）
 * 反向傳動：輪 → 輪軸齒輪 → 中間齒輪（軸承損失 k_c）→ 小齒輪 → 馬達，齒面效率 η 同正向
 * @type {(P: any, speed: number) => number}
 */
export function motorCoastDragForce(P, speed) {
  if (!P.coastMotorDrag) {
    return 0;
  }
  const gearRatio = P.gearRatio;
  const omegaMotor = (Math.max(0, speed) / P.wheelRadius) * gearRatio;
  const kc = counterGearLossFraction(P);
  return (motorFrictionTorque(P, omegaMotor) * gearRatio * (1 + kc)) / P.wheelRadius / P.gearEfficiency;
}

/**
 * 正向傳動效率：齒面效率 η（SPEC 1.12）× 中間齒輪軸承損失 (1 − k_c)
 * @type {(P: any) => number}
 */
export function driveEfficiency(P) {
  return P.gearEfficiency * (1 - counterGearLossFraction(P));
}

/**
 * 計算某速度下的縱向力（全部 4 輪合計，N），正值為推進
 * 不含空氣阻力（空氣阻力由物理模擬直接施加在車體上）
 * speed：輪胎接地面的線速度（第四階段起 = 傳動系轉速 ω_w × r，見 sim.js stepCar；純滾動時等於車速）
 * normalLoad：4 輪法向力合計（N）。物理稽核 L3（iter-87）：滾阻 C_rr·N 與輪軸軸承阻力 μ·N·r_軸/r_輪 都和實際法向力成正比，
 * 騰空時為 0、坡道上為 m·g·cosθ、落地瞬間較大；省略時 = 車重（平地靜態，理論極速與舊版相同）
 * @type {(P: any, opt: { speed: number, powered: boolean, battery: Battery, normalLoad?: number }) => { drive: number, resist: number, rolling: number, current: number, terminalVoltage: number, motorVoltage: number }}
 */
export function longitudinalForce(P, { speed, powered, battery, normalLoad = P.massTotal * P.gravity }) {
  const r = P.wheelRadius;
  const gearRatio = P.gearRatio;
  const omegaMotor = (Math.max(0, speed) / r) * gearRatio;
  let drive = 0;
  let current = 0;
  let terminalVoltage = battery.ocv();
  let motorVoltage = 0;
  const rolling = P.crr * normalLoad;
  let resist = rolling + axleFrictionForce(P, normalLoad);
  if (powered) {
    const op = motorOperatingPoint(P, battery.ocv(), omegaMotor, batteryResistanceAt(P, battery.soc));
    current = op.current;
    terminalVoltage = op.terminalVoltage;
    motorVoltage = op.motorVoltage;
    // 物理稽核 L4（iter-82）：τ ≥ 0 時功率由馬達流向輪子，輪上力 = τ·G·η/r；τ < 0（馬達被拖到無載轉速以上、反向功率流）時
    // 輪子要多出傳動損失才能拖動馬達 → 輪上力 = τ·G/(r·η)（與 motorCoastDragForce 一致）
    if (op.torque >= 0) {
      drive = (op.torque * gearRatio * driveEfficiency(P)) / r;
    } else {
      drive = (op.torque * gearRatio) / (r * driveEfficiency(P));
    }
  } else {
    resist += motorCoastDragForce(P, speed);
  }
  return { drive, resist, rolling, current, terminalVoltage, motorVoltage };
}

/**
 * 解析理論極速：驅動力 = 滾動阻力 + 軸承阻力 + 空氣阻力（傳動損失含在 driveEfficiency），二分法求根
 * 電池開路電壓用 voc，或由 soc 依組裝的電池曲線算出
 * @type {(opt: { assembly: any, soc?: number, voc?: number }) => { vTheory: number, v0: number, omega0: number, tauStall: number }}
 */
export function theoreticalTopSpeed({ assembly, soc = 1, voc }) {
  const P = assembly.P;
  const vocUsed = voc ?? new Battery(P, soc).ocv();
  const gearRatio = P.gearRatio;
  const r = P.wheelRadius;
  const { omega0, tauStall } = linearMotorParams(P, vocUsed, batteryResistanceAt(P, soc));
  const v0 = (omega0 / gearRatio) * r;
  const eta = driveEfficiency(P);
  const netForce = (v) => {
    const omega = (v / r) * gearRatio;
    const drive = (tauStall * (1 - omega / omega0) * gearRatio * eta) / r;
    const resist = P.crr * P.massTotal * P.gravity + axleFrictionForce(P) + P.airDragK * v * v;
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

