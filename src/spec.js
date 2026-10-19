// 規格讀取與衍生參數：模型與物理共用同一份 config/spec.json
import spec from '../config/spec.json';

export { spec };

const MM = 0.001;
const G_TO_KG = 0.001;

/**
 * 由 spec.json 推導出物理模擬用的 SI 參數
 * @returns {object} 衍生參數
 */
export function deriveParams() {
  const s = spec;
  const wheelRadius = (s.tire.diameter_mm / 2) * MM;

  // 質量組成（g）
  const massMotor = s.motor.mass_g;
  const massWheels = 4 * s.tire.mass_g;
  const massChassisMisc = s.chassis.massChassisBodyMisc_g;
  const massBattery = s.battery.cells * s.battery.cellMass_g;
  const massNoBattery_g = massChassisMisc + massMotor + massWheels;
  const massTotal_g = massNoBattery_g + massBattery;

  // 馬達模型常數（SPEC 1.4 推估式，iter-01 起納入無載電流 I0）：
  // R_m = V / I_stall、k_t = τ_stall / (I_stall − I0)、k_e = (V − I0·R_m) / ω0
  // 輸出扭力 τ = k_t·I − τ_f(ω)，τ_f 在 3 V 無載轉速時 = k_t·I0（主 agent 決策 D1）
  const omega0Rated = (s.motor.noLoadRpm_atRated * 2 * Math.PI) / 60;
  const i0 = s.motor.noLoadCurrent_A;
  const motorResistance = s.motor.ratedVoltage_V / s.motor.stallCurrent_atRated_A;
  const kt = s.motor.stallTorque_atRated_Nm / (s.motor.stallCurrent_atRated_A - i0);
  const ke = (s.motor.ratedVoltage_V - i0 * motorResistance) / omega0Rated;

  return {
    wheelRadius,
    massNoBattery_g,
    massBattery_g: massBattery,
    massTotal_g,
    massTotal: massTotal_g * G_TO_KG,
    ke,
    kt,
    motorResistance,
    omega0Rated,
    motorFrictionTorque: kt * i0,
    motorFrictionCoulombFraction: s.motor.frictionCoulombFraction,
    batteryResistance: s.battery.cells * s.battery.cellInternalResistance_ohm,
    capacity_C: s.battery.capacity_mAh * 3.6,
    gearEfficiency: s.drivetrain.gearEfficiency,
    gravity: s.sim.gravity,
    airDragK: 0.5 * s.aero.airDensity * s.aero.dragCoeff * s.aero.frontalArea_mm2 * MM * MM,
    crr: s.tire.rollingResistanceCoeff,
  };
}
