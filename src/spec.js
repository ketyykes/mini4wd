// 全域規格（比賽規則、空氣、賽道、模擬參數）與物理參數推導
// 第二階段：零件數值在 src/parts/，整車規格由 src/assembly.js 組出（asm.spec），這裡只負責換算成 SI 物理參數
import spec from '../config/spec.json';

export { spec };

const MM = 0.001;
const G_TO_KG = 0.001;

/**
 * 由組裝規格（asm.spec）與整車質量推導物理模擬用的 SI 參數
 * @type {(s: any, massTotal_g: number) => any}
 */
export function deriveParams(s, massTotal_g) {
  const wheelRadius = (s.tire.diameter_mm / 2) * MM;

  // 馬達模型常數（SPEC 1.4 推估式，含無載電流 I0）：
  // R_m = V / I_stall、k_t = τ_stall / (I_stall − I0)、k_e = (V − I0·R_m) / ω0
  // 輸出扭力 τ = k_t·I − τ_f(ω)，τ_f 在 3 V 無載轉速時 = k_t·I0（第一階段決策 D1）
  const m = s.motor;
  const omega0Rated = (m.noLoadRpm_atRated * 2 * Math.PI) / 60;
  const i0 = m.noLoadCurrent_A;
  const motorResistance = m.ratedVoltage_V / m.stallCurrent_atRated_A;
  const kt = m.stallTorque_atRated_Nm / (m.stallCurrent_atRated_A - i0);
  const ke = (m.ratedVoltage_V - i0 * motorResistance) / omega0Rated;

  return {
    wheelRadius,
    massTotal_g,
    massTotal: massTotal_g * G_TO_KG,
    ke,
    kt,
    motorResistance,
    omega0Rated,
    motorFrictionTorque: kt * i0,
    motorFrictionCoulombFraction: m.frictionCoulombFraction,
    coastMotorDrag: m.coastMotorDrag,
    cells: s.battery.cells,
    ocvCurve: s.battery.cellOcvCurve,
    cutoffCellVoltage: s.battery.cutoffCellVoltage_V,
    batteryResistance: s.battery.cells * s.battery.cellInternalResistance_ohm,
    capacity_C: s.battery.capacity_mAh * 3.6,
    gearRatio: s.drivetrain.gearRatio,
    gearEfficiency: s.drivetrain.gearEfficiency,
    counterLargePitchRadius_mm: s.drivetrain.counterLargePitchRadius_mm,
    counterSmallPitchRadius_mm: s.drivetrain.counterSmallPitchRadius_mm,
    bearingMu: s.bearings.frictionCoeff,
    shaftRadius: s.bearings.shaftRadius_mm * MM,
    counterShaftRadius_mm: s.bearings.counterShaftRadius_mm,
    gravity: s.sim.gravity,
    airDragK: 0.5 * s.aero.airDensity * s.aero.dragCoeff * s.frontalArea_mm2 * MM * MM,
    frontalArea_mm2: s.frontalArea_mm2,
    crr: s.tire.rollingResistanceCoeff,
    tireMu: s.tire.frictionCoeff,
    slipAngleSaturation: s.tire.slipAngleSaturation_rad,
  };
}
