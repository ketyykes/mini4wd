import { test, expect } from 'vitest';
import { assemble, loadConfig } from '../src/assembly.js';
import { motorParts } from '../src/parts/motors.js';
import { deriveParams } from '../src/spec.js';
import { motorOperatingPoint, motorFrictionTorque, linearMotorParams, theoreticalTopSpeed } from '../src/powertrain.js';

const base = assemble(loadConfig('default'));
const params = (motor) => deriveParams({ ...base.spec, motor }, base.mass_g);

test('P17_motor_endpoints 八款馬達同時重現無載與堵轉端點，電機常數相等且擬合損耗非負', () => {
  for (const motor of motorParts) {
    const P = { ...params(motor), circuitResistance: 0 };
    expect(P.kt, motor.id).toBe(P.ke);
    expect(P.motorResistance, motor.id).toBeGreaterThan(0);
    expect(P.motorBrushDrop, motor.id).toBeGreaterThanOrEqual(0);
    const stall = motorOperatingPoint(P, motor.ratedVoltage_V, 0, 0);
    const idle = motorOperatingPoint(P, motor.ratedVoltage_V, motor.noLoadRpm_atRated * 2 * Math.PI / 60, 0);
    expect(stall.current, motor.id).toBeCloseTo(motor.stallCurrent_atRated_A, 12);
    expect(stall.torque, motor.id).toBeCloseTo(motor.stallTorque_atRated_Nm, 12);
    expect(idle.current, motor.id).toBeCloseTo(motor.noLoadCurrent_A, 12);
    expect(idle.torque, motor.id).toBeCloseTo(0, 12);
  }
  // A contradictory endpoint set must not silently create a negative loss.
  expect(() => params({ ...motorParts[0], stallTorque_atRated_Nm: 1 })).toThrow(/passive/);
});

test('P17_motor_power 電動、零電流與發電分支均滿足電路及功率平衡，電刷不會發能', () => {
  for (const motor of motorParts) {
    const P = params(motor);
    let generated = false, motored = false;
    for (const voltage of [0, 1.5, 2.4, 3, 3.2]) for (const ratio of [0, 0.2, 0.8, 1, 1.5, 2]) {
      const omega = P.omega0Rated * ratio;
      const op = motorOperatingPoint(P, voltage, omega);
      const i = op.current;
      generated ||= i < 0;
      motored ||= i > 0;
      const brushLoss = op.brushVoltage * i;
      const frictionLoss = motorFrictionTorque(P, omega) * omega;
      const windingLoss = P.motorResistance * i * i;
      expect(brushLoss).toBeGreaterThanOrEqual(-1e-14);
      expect(frictionLoss).toBeGreaterThanOrEqual(0);
      expect(op.motorVoltage).toBeCloseTo(P.motorResistance * i + op.brushVoltage + P.ke * omega, 12);
      expect(op.motorVoltage * i - op.torque * omega).toBeCloseTo(windingLoss + brushLoss + frictionLoss, 11);
      const externalLoss = (P.batteryResistance + P.circuitResistance) * i * i;
      expect(voltage * i - op.torque * omega).toBeCloseTo(externalLoss + windingLoss + brushLoss + frictionLoss, 11);
    }
    expect(generated).toBe(true);
    expect(motored).toBe(true);
    // Exact, continuous threshold on BOTH sides of the no-current interval.
    const omega = P.omega0Rated;
    for (const sign of [-1, 1]) {
      const edge = P.ke * omega + sign * P.motorBrushDrop;
      expect(Math.abs(motorOperatingPoint(P, edge, omega).current)).toBeLessThan(1e-13);
      const inside = motorOperatingPoint(P, edge - sign * 1e-5, omega);
      const outside = motorOperatingPoint(P, edge + sign * 1e-5, omega);
      expect(Math.abs(inside.current)).toBeLessThan(1e-13);
      expect(outside.current).toBeCloseTo(sign * 1e-5 / (P.motorResistance + P.batteryResistance + P.circuitResistance), 12);
    }
  }
});

test('P01_motor_curve 解析正扭力曲線與電路一致，低於起動電壓時理論速度為零', () => {
  for (const motor of motorParts) {
    const P = params(motor);
    for (const voltage of [1.5, 2.4, 3, 3.2]) {
      const line = linearMotorParams(P, voltage);
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const op = motorOperatingPoint(P, voltage, fraction * line.omega0);
        expect(op.torque).toBeCloseTo(line.tauStall * (1 - fraction), 12);
      }
    }
    for (const voltage of [0, P.motorBrushDrop / 2, P.motorBrushDrop]) {
      expect(theoreticalTopSpeed({ assembly: { P }, voc: voltage }).vTheory).toBe(0);
    }
  }
});

test('P17_motor_holdout FA-130 未用於擬合的原廠最大效率點在既有推估摩擦模型下誤差小於1%', () => {
  // Mabuchi official data (accessed 2026-10-27): 9710 rpm, 0.56 A,
  // 0.74 mN·m, 0.76 W @ 3 V. Only no-load/stall enter the fit.
  const P = { ...params(motorParts[0]), circuitResistance: 0 };
  const omega = 9710 * 2 * Math.PI / 60;
  const point = motorOperatingPoint(P, 3, omega, 0);
  expect(Math.abs(point.current / 0.56 - 1)).toBeLessThan(0.01);
  expect(Math.abs(point.torque / 0.00074 - 1)).toBeLessThan(0.01);
  expect(Math.abs(point.torque * omega / 0.76 - 1)).toBeLessThan(0.01);
  console.log('[motor holdout]', { current_A: point.current, torque_Nm: point.torque, output_W: point.torque * omega });
});
