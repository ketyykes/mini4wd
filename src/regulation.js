// 規則檢查器（regulation validator）：依 SPEC 1.1 檢查整車組裝；不合規回傳明確的違規代碼與說明
// 品牌限制不檢查，電池與馬達檢查類別（SPEC 1.1「本專案的規則檢查方式」）
import { spec } from './spec.js';

/** @typedef {{ code: string, message: string }} Violation */

const EPS = 1e-9;

/** 安裝點名稱（零件 compat.requires / 底盤與導輪架 features） */
const FEATURE_NAMES = {
  'side-damper-mount': '底盤側制振器座',
  'rear-damper-mount': '後導輪板制振器座',
  'rear-brake-mount': '後導輪架煞車座',
};

/** 干涉群組名稱 */
const GROUP_NAMES = {
  TIRE: '輪胎',
  ROLLER: '導輪',
  STAY: '導輪板',
  DAMPER: '制振器（含上下行程）',
  SPONGE: '煞車海綿',
  BALLAST: '配重',
  BODY: '車殼',
};

/**
 * 規則檢查器的所有違規代碼與說明（給網頁 / 文件用）
 * @type {Record<string, string>}
 */
export const VIOLATION_CODES = {
  LENGTH: '全長超過規則上限',
  WIDTH: '全寬超過規則上限',
  HEIGHT: '全高超過規則上限',
  MASS: '總重低於規則下限',
  TIRE_DIAMETER: '輪胎直徑超出規則範圍',
  TIRE_WIDTH: '輪胎寬度超出規則範圍',
  GROUND_CLEARANCE: '離地高度低於規則下限（含導輪板、煞車海綿、配重、制振器）',
  DRIVE_4WD: '不是四輪驅動',
  GEAR_RATIO: '齒輪比不在合法清單',
  MOTOR_CLASS: '馬達類別或單 / 雙軸不符合底盤',
  BATTERY: '電池規格不符',
  BODY_TIRE_CLEARANCE: '車殼與輪胎干涉',
  BODY_ROLLER_CLEARANCE: '車殼與導輪干涉',
  GEAR_CHASSIS: '齒輪組不適用這個底盤',
  MOUNT_COMPAT: '零件需要的安裝點不存在',
  STAY_TIRE_CLEARANCE: '導輪板與輪胎干涉',
  ROLLER_TIRE_CLEARANCE: '導輪與輪胎干涉',
  ROLLER_ROLLER_CLEARANCE: '導輪互相干涉（例如雙層導輪裝在上下兩層的導輪架）',
  STAY_ROLLER_CLEARANCE: '導輪板與導輪干涉',
  DAMPER_TIRE_CLEARANCE: '制振器與輪胎干涉',
  DAMPER_ROLLER_CLEARANCE: '制振器與導輪干涉',
  DAMPER_SPONGE_CLEARANCE: '制振器與煞車海綿干涉',
  DAMPER_STAY_CLEARANCE: '制振器與導輪板干涉',
  DAMPER_BODY_CLEARANCE: '制振器（含上下行程）與車殼干涉',
  SPONGE_TIRE_CLEARANCE: '煞車海綿與輪胎干涉',
  SPONGE_ROLLER_CLEARANCE: '煞車海綿與導輪干涉',
  SPONGE_BODY_CLEARANCE: '煞車海綿與車殼干涉',
  BALLAST_TIRE_CLEARANCE: '配重與輪胎干涉',
  BALLAST_ROLLER_CLEARANCE: '配重與導輪干涉',
  BALLAST_DAMPER_CLEARANCE: '配重與制振器干涉',
  BALLAST_SPONGE_CLEARANCE: '配重與煞車海綿干涉',
  BALLAST_BODY_CLEARANCE: '配重與車殼干涉',
  STAY_BODY_CLEARANCE: '導輪板與車殼干涉',
};

/**
 * 檢查整車組裝是否符合比賽規則與實體組裝條件（車殼與輪胎 / 導輪不得干涉）；warnings 保留給不影響 ok 的提醒
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
  // SPEC 1.14：車殼與輪胎 / 導輪間隙必須 ≥ 1 mm。兩個實體零件不能重疊（< 0 mm 是互相穿透，0–1 mm 是會摩擦的干涉），
  // 這種組合實際上裝不起來或輪胎會磨車殼 → 判為違規（2026-10-21 使用者要求：零件替換要符合物理，原本只是警告）
  if (asm.fit && asm.fit.tire_mm < 1) {
    fail('BODY_TIRE_CLEARANCE', `車殼 ${asm.body.id} 與輪胎間隙 ${asm.fit.tire_mm.toFixed(2)} mm（須 ≥ 1 mm；${asm.fit.tire_mm < 0 ? '輪胎穿進車殼' : '輪胎會磨到車殼'}），這款車殼的輪拱不適合 ${p.wheels.diameter_mm} mm 輪胎`);
  }
  if (asm.fit && asm.fit.roller_mm < 1) {
    fail('BODY_ROLLER_CLEARANCE', `車殼 ${asm.body.id} 與導輪間隙 ${asm.fit.roller_mm.toFixed(2)} mm（須 ≥ 1 mm）`);
  }
  // ---- 第三階段：安裝相容性 ----
  // 齒輪組只適用特定底盤配置（SPEC 1.5：4.2 / 5:1 等只有單軸底盤有對應零件）
  const g = p.gear;
  const layouts = g.compat?.chassisLayouts;
  if (layouts && !layouts.includes(p.chassis.motorLayout)) {
    fail('GEAR_CHASSIS', `齒輪組 ${g.name} 只適用 ${layouts.join('、')} 底盤，裝不上 ${p.chassis.name}（${p.chassis.motorLayout}）`);
  }
  // 安裝點：零件需要的安裝點（compat.requires）必須由底盤或導輪架提供（asm.features）
  const features = new Set(asm.features ?? []);
  for (const [slot, part] of Object.entries(p)) {
    const req = part?.compat?.requires ?? [];
    const missing = req.filter((f) => !features.has(f));
    if (missing.length > 0) {
      fail('MOUNT_COMPAT', `${part.name} 需要安裝點「${missing.map((f) => FEATURE_NAMES[f] ?? f).join('、')}」，目前的底盤 / 導輪架沒有（slot ${slot}）`);
    }
  }
  const bal = p.ballast;
  if (bal && !(bal.mountPoints ?? []).includes(bal.mount)) {
    fail('MOUNT_COMPAT', `${bal.name} 不能裝在「${bal.mount}」，可用的安裝點：${(bal.mountPoints ?? []).join('、')}`);
  }

  // ---- 第三階段：實體干涉（間隙 < 1 mm）。零件兩兩之間與零件–車殼，代碼形如 STAY_TIRE_CLEARANCE ----
  for (const it of asm.interference ?? []) {
    if (it.gap_mm < 1) {
      const [ga, gb] = it.code.replace('_CLEARANCE', '').split('_');
      const state = it.gap_mm < 0 ? '互相穿透' : '會摩擦';
      fail(it.code, `${GROUP_NAMES[ga] ?? ga}（${it.a}）與${GROUP_NAMES[gb] ?? gb}（${it.b}）間隙 ${it.gap_mm.toFixed(2)} mm（須 ≥ 1 mm，${state}），實體零件不能重疊`);
    }
  }

  /** @type {Violation[]} 目前沒有非違規的提醒；保留欄位給之後的相容性提示 */
  const warnings = [];
  return { ok: violations.length === 0, violations, warnings };
}
