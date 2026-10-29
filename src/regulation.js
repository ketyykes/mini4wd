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
  STABILIZER: '穩定零件',
  CHASSIS: '底盤結構',
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
  CHASSIS_COMPAT: '零件不適用這個底盤（官方商品頁適用底盤一覽，B14）',
  MOUNT_COMPAT: '零件需要的安裝點不存在',
  ROLLER_ANGLE_MOUNT: '導輪角度調整板只能夾在板狀導輪架（FRP／碳纖／滑動保桿）與底盤之間',
  STAY_TIRE_CLEARANCE: '導輪板與輪胎干涉',
  ROLLER_TIRE_CLEARANCE: '導輪與輪胎干涉',
  ROLLER_ROLLER_CLEARANCE: '導輪互相干涉（例如雙層導輪裝在上下兩層的導輪架）',
  STAY_ROLLER_CLEARANCE: '導輪板與導輪干涉',
  DAMPER_TIRE_CLEARANCE: '制振器與輪胎干涉',
  DAMPER_ROLLER_CLEARANCE: '制振器與導輪干涉',
  DAMPER_SPONGE_CLEARANCE: '制振器與煞車海綿干涉',
  DAMPER_STAY_CLEARANCE: '制振器與導輪板干涉',
  DAMPER_BODY_CLEARANCE: '制振器（含上下行程）與車殼干涉',
  DAMPER_CHASSIS_CLEARANCE: '制振器（含上下行程）與底盤側裙／側壁／支撐結構干涉（推估幾何，非官方條文）',
  SPONGE_TIRE_CLEARANCE: '煞車海綿與輪胎干涉',
  SPONGE_ROLLER_CLEARANCE: '煞車海綿與導輪干涉',
  SPONGE_BODY_CLEARANCE: '煞車海綿與車殼干涉',
  BALLAST_TIRE_CLEARANCE: '配重與輪胎干涉',
  BALLAST_ROLLER_CLEARANCE: '配重與導輪干涉',
  BALLAST_DAMPER_CLEARANCE: '配重與制振器干涉',
  BALLAST_SPONGE_CLEARANCE: '配重與煞車海綿干涉',
  BALLAST_BODY_CLEARANCE: '配重與車殼干涉',
  STAY_BODY_CLEARANCE: '導輪板與車殼干涉',
  TERMINAL_MOD: '電池 / 馬達端子改裝（疊加、焊接）違規',
  STABILIZER_ROLLER_SIZE: '穩定零件與前導輪尺寸不搭配（例如 17 mm 穩定頭只能配 19 mm 導輪；「外徑須小於前導輪」為推估規則，非官方條文）',
  ROLLER_TAPER_MOUNT: '（推估規則，非官方條文）錐形導輪必須用螺絲＋墊片鎖在 FRP / 碳纖導輪板上（錐面朝下）；前後導輪各自依所裝的導輪架判定',
  STABILIZER_ROLLER_CLEARANCE: '穩定零件與導輪干涉',
  STABILIZER_TIRE_CLEARANCE: '穩定零件與輪胎干涉',
  STABILIZER_STAY_CLEARANCE: '穩定零件與導輪板干涉',
  SIDE_PART_TIRE_ZONE: '輪胎外側禁裝區：前輪中心到前輪後緣、後輪中心到後輪前緣之間，輪胎外側不可裝零件（官方規則 Sec.3 腳註）',
  STABILIZER_BODY_CLEARANCE: '穩定零件與車殼干涉',
  BALLAST_STABILIZER_CLEARANCE: '配重與穩定零件干涉',
  DAMPER_STABILIZER_CLEARANCE: '制振器與穩定零件干涉',
  SPONGE_STABILIZER_CLEARANCE: '煞車海綿與穩定零件干涉',
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
    // 滑動保桿（iter-61）：外框取滑動板在行程端點時的最大範圍（推估規則：官方條文沒寫可動零件怎麼量，取較保守的量法）
    // iter-64：前 / 後滑動保桿各自的行程端點
    const sliders = asm.sliders ?? (asm.slider ? [asm.slider] : []);
    const slideNote = sliders.length > 0 ? `（含${sliders.map((sl) => `${sl.slot === 'frontStay' ? '前' : '後'}滑動保桿行程端點 ±${sl.stroke_mm} mm`).join('、')} 的外框，推估規則）` : '';
    fail('WIDTH', `全寬 ${f1(size.z)} mm${slideNote}，規則須 < ${r.maxWidth_mm} mm`);
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
  // 第四階段：端子只能用套件或 Grade-Up 端子，疊加（double-plated）或焊接禁止（PARTS_RESEARCH [REG6] Sec.6-5）
  const sw = p.switch;
  if ((sw.terminalLayers ?? 1) > 1 || sw.terminalSoldered) {
    fail('TERMINAL_MOD', `${sw.name}：端子疊了 ${sw.terminalLayers ?? 1} 片${sw.terminalSoldered ? '且有焊接' : ''}；規則只允許套件或 Grade-Up 端子，疊加或焊接端子禁止（Tamiya 規則 Sec.6-5）`);
  }
  // 第四階段：穩定零件只能配指定直徑的前導輪（17 mm 穩定頭 ↔ 19 mm 導輪）；穩定零件外徑不得 ≥ 導輪外徑（否則它變成主要接觸面，等於換了導輪）
  // iter-56：穩定零件裝在前導輪正上方（同一支螺絲），所以看的是前導輪（frontRollers）
  const stab = p.stabilizer;
  if (stab) {
    const rd = p.frontRollers.diameter_mm;
    if (stab.requiresRollerDiameter_mm !== undefined && Math.abs(stab.requiresRollerDiameter_mm - rd) > EPS) {
      fail('STABILIZER_ROLLER_SIZE', `${stab.name} 只能配 ${stab.requiresRollerDiameter_mm} mm 前導輪，目前前導輪 ${rd} mm`);
    } else if (stab.diameter_mm >= rd - EPS) {
      // ※ 推估規則（非官方條文）：官方規則沒有限制穩定頭直徑；依據是穩定頭的用途（側傾時才碰牆，見 PARTS_RESEARCH AP 節），外徑 ≥ 導輪就變成主要碰牆面
      fail('STABILIZER_ROLLER_SIZE', `（推估規則，非官方條文）${stab.name} 外徑 ${stab.diameter_mm} mm ≥ 前導輪 ${rd} mm，會取代前導輪成為碰牆面`);
    }
  }
  // 第四階段：錐形導輪要鎖在 FRP / 碳纖導輪板（有 plate 的導輪架）上；塑膠一體保桿 / 標準後導輪架擋下。
  // ※ 這是推估規則，不是官方條文：Tamiya 官方規則沒有限制錐形導輪的安裝方式。依據是 PARTS_RESEARCH 第四階段 T 節
  //   [T95436] 官方商品說明（錐面在導輪下方、騎上牆頂時才把車推回車道）與 [FTAP]「tapered underside…mounted underneath the stay」：
  //   錐面要朝下、用螺絲＋墊片鎖在平板上才有作用；塑膠一體保桿 / 標準後導輪架的導輪座是固定的凸台，推估裝不上或錐面方向不對。
  // iter-56：前後導輪分開選 → 前 / 後各自檢查：前導輪是錐形才看前導輪架、後導輪是錐形才看後導輪架；兩端都不合時合併成一筆違規
  /** @type {[string, string, string][]} [導輪 slot, 導輪架 slot, 中文] */
  const taperEnds = [['frontRollers', 'frontStay', '前'], ['rearRollers', 'rearStay', '後']];
  const badTaper = taperEnds.filter(([rs, ss]) => p[rs].taper && !p[ss].plate).map(([rs, ss, label]) => `${label}導輪 ${p[rs].name} 裝在 ${p[ss].name}`);
  if (badTaper.length > 0) {
    fail('ROLLER_TAPER_MOUNT', `（推估規則，非官方條文）錐形導輪必須用螺絲＋墊片鎖在 FRP / 碳纖導輪板、錐面朝下才有作用；${badTaper.join('、')}，不是導輪板`);
  }
  // 第五階段（iter-58）：官方規則 [REG6] Sec.3 腳註——「前輪中心 → 前輪後緣」「後輪中心 → 後輪前緣」這兩段，輪胎外側不可裝零件
  // （PARTS_RESEARCH 第五階段 AD 節；官方條文，非推估）。目前會裝在底盤側面的零件只有側制振器：以它的行程掃掠範圍（swept）檢查
  const sideZone = sidePartTireZone(asm);
  if (sideZone) {
    fail('SIDE_PART_TIRE_ZONE', sideZone);
  }
  // SPEC 1.14：車殼與輪胎 / 導輪間隙必須 ≥ 1 mm。兩個實體零件不能重疊（< 0 mm 是互相穿透，0–1 mm 是會摩擦的干涉），
  // 這種組合實際上裝不起來或輪胎會磨車殼 → 判為違規（2026-10-21 使用者要求：零件替換要符合物理，原本只是警告）
  if (asm.fit && asm.fit.tire_mm < 1) {
    fail('BODY_TIRE_CLEARANCE', `車殼 ${asm.body.id} 與輪胎間隙 ${asm.fit.tire_mm.toFixed(2)} mm（須 ≥ 1 mm；${asm.fit.tire_mm < 0 ? '輪胎穿進車殼' : '輪胎會磨到車殼'}），這款車殼的輪拱不適合 ${p.wheels.diameter_mm} mm 輪胎${asm.body.archCut ? '' : '（可勾選「切輪拱」剪掉干涉的殼面）'}`);
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
  // B14（iter-107）：零件只能裝在某些底盤（parts/chassisCompat.js，官方「シャーシ一覧」）
  for (const [slot, part] of Object.entries(p)) {
    const only = part?.compat?.chassis;
    // 覆寫欄位的自訂零件 id 是「base+custom」，以 base 判斷是哪一款底盤
    if (only && !only.includes(p.chassis.id.split('+')[0])) {
      fail('CHASSIS_COMPAT', `${part.name} 只適用 ${only.join('、')}，裝不上 ${p.chassis.name}（slot ${slot}）`);
    }
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
  // B13（iter-105）：導輪角度調整板（15373）「FRPなどとシャーシに間に挟み込んで」→ 該端導輪架要是板狀（有 plate），原廠塑膠保桿裝不上
  for (const [slot, stay] of [['frontRollerAngle', 'frontStay'], ['rearRollerAngle', 'rearStay']]) {
    if (p[slot] && !p[stay]?.plate) {
      fail('ROLLER_ANGLE_MOUNT', `${p[slot].name} 要夾在板狀導輪架與底盤之間，${p[stay]?.name ?? stay} 不是板狀導輪架（slot ${slot}）`);
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

/**
 * 輪胎外側禁裝區檢查（官方規則 Sec.3 腳註）：側面零件的外框若同時（1）伸到輪胎外側面以外、（2）x 範圍進入
 * 前輪 [x_F − R, x_F] 或後輪 [x_R, x_R + R]，回傳違規說明；否則回傳 null
 * @type {(asm: any) => string | null}
 */
function sidePartTireZone(asm) {
  const wheels = asm.layout.wheels;
  const R = wheels[0].r;
  const tireOuterZ = Math.max(...wheels.map((w) => Math.abs(w.z) + w.width / 2));
  const xF = Math.max(...wheels.map((w) => w.x));
  const xR = Math.min(...wheels.map((w) => w.x));
  for (const d of asm.optional?.dampers ?? []) {
    if (d.part.mount !== 'side' || d.swept.kind !== 'box') {
      continue;
    }
    const b = d.swept;
    const outer = Math.max(Math.abs(b.min.z), Math.abs(b.max.z));
    if (outer <= tireOuterZ) {
      continue;
    }
    const inFront = b.max.x > xF - R && b.min.x < xF;
    const inRear = b.min.x < xR + R && b.max.x > xR;
    if (inFront || inRear) {
      const where = inFront ? '前輪中心到前輪後緣' : '後輪中心到後輪前緣';
      return `${d.label}（${d.part.name}）伸到輪胎外側（外緣 ${outer.toFixed(1)} mm > 輪胎外側面 ${tireOuterZ.toFixed(1)} mm），且進入${where}之間（x ${b.min.x.toFixed(1)}–${b.max.x.toFixed(1)} mm）；官方規則 Sec.3 腳註禁止`;
    }
  }
  return null;
}
