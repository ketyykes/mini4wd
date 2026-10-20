// 規則檢查器（regulation validator）：依 SPEC 1.1 檢查整車組裝；不合規回傳明確的違規代碼與說明
// 品牌限制不檢查，電池與馬達檢查類別（SPEC 1.1「本專案的規則檢查方式」）
import { spec } from './spec.js';

/** @typedef {{ code: string, message: string }} Violation */

const EPS = 1e-9;

/**
 * 檢查整車組裝是否符合比賽規則；另外回傳不屬於比賽規則、但零件互相干涉的相容性警告（不影響 ok）
 * @type {(asm: any) => { ok: boolean, violations: Violation[], warnings: Violation[] }}
 */
export function validateAssembly(asm) {
  const r = spec.rules;
  const p = asm.partsBySlot;
  /** @type {Violation[]} */
  const violations = [];
  /** @type {(code: string, message: string) => void} */
  const fail = (code, message) => violations.push({ code, message });
  const size = asm.bbox_mm.size;
  const f1 = (x) => x.toFixed(1);

  if (!(size.x < r.maxLength_mm)) {
    fail('LENGTH', `全長 ${f1(size.x)} mm，規則須 < ${r.maxLength_mm} mm`);
  }
  if (!(size.z < r.maxWidth_mm)) {
    fail('WIDTH', `全寬 ${f1(size.z)} mm，規則須 < ${r.maxWidth_mm} mm`);
  }
  if (!(size.y < r.maxHeight_mm)) {
    fail('HEIGHT', `全高 ${f1(size.y)} mm，規則須 < ${r.maxHeight_mm} mm`);
  }
  if (!(asm.mass_g >= r.minMassWithBatteryMotor_g)) {
    fail('MASS', `總重（含電池與馬達）${f1(asm.mass_g)} g，規則須 ≥ ${r.minMassWithBatteryMotor_g} g`);
  }
  const d = p.wheels.diameter_mm;
  if (d < r.tireDiameterRange_mm[0] - EPS || d > r.tireDiameterRange_mm[1] + EPS) {
    fail('TIRE_DIAMETER', `輪胎直徑 ${d} mm，規則須在 ${r.tireDiameterRange_mm.join('–')} mm`);
  }
  const w = p.wheels.width_mm;
  if (w < r.tireWidthRange_mm[0] - EPS || w > r.tireWidthRange_mm[1] + EPS) {
    fail('TIRE_WIDTH', `輪胎寬度 ${w} mm，規則須在 ${r.tireWidthRange_mm.join('–')} mm`);
  }
  if (!(asm.groundClearance_mm >= r.minGroundClearance_mm - EPS)) {
    fail('GROUND_CLEARANCE', `離地高度 ${asm.groundClearance_mm.toFixed(2)} mm，規則須 ≥ ${r.minGroundClearance_mm} mm`);
  }
  if (asm.driveType !== r.driveType) {
    fail('DRIVE_4WD', `驅動方式 ${asm.driveType}，規則須為 ${r.driveType}`);
  }
  if (!r.legalGearRatios.some((g) => Math.abs(g - asm.gearRatio) < 1e-6)) {
    fail('GEAR_RATIO', `齒輪比 ${asm.gearRatio}:1 不在合法清單（${r.legalGearRatios.join('、')}）`);
  }
  const m = p.motor;
  const shaftOk = (p.chassis.motorLayout === 'dual-shaft') === (m.shaft === 'dual');
  if (m.sizeClass !== r.motorSizeClass || !shaftOk) {
    fail('MOTOR_CLASS', `馬達須為 ${r.motorSizeClass} 尺寸，且單 / 雙軸符合底盤（${p.chassis.motorLayout}）；目前 ${m.sizeClass}、${m.shaft}`);
  }
  const b = p.battery;
  if (b.size !== r.batterySize || b.cells !== r.batteryCells) {
    fail('BATTERY', `電池須為 ${r.batteryCells} 顆 ${r.batterySize}；目前 ${b.cells} 顆 ${b.size}`);
  }
  /** @type {Violation[]} */
  const warnings = [];
  // SPEC 1.14：車殼與輪胎 / 導輪間隙 ≥ 1 mm（相容性，不是比賽規則）
  if (asm.fit && asm.fit.tire_mm < 1) {
    warnings.push({ code: 'BODY_TIRE_CLEARANCE', message: `車殼 ${asm.body.id} 與輪胎間隙 ${asm.fit.tire_mm.toFixed(2)} mm（< 1 mm，會干涉），這款車殼不適合 ${p.wheels.diameter_mm} mm 輪胎` });
  }
  if (asm.fit && asm.fit.roller_mm < 1) {
    warnings.push({ code: 'BODY_ROLLER_CLEARANCE', message: `車殼 ${asm.body.id} 與導輪間隙 ${asm.fit.roller_mm.toFixed(2)} mm（< 1 mm）` });
  }
  return { ok: violations.length === 0, violations, warnings };
}
