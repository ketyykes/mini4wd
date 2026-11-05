// 整車組裝：由組裝設定（configs/*.json）解析零件 → 擺放位置 → 推導質量、重心、外框、物理參數
// 整車的質量、重心、外框「只」由這裡從零件資料推導（SPEC 1.13），模型、物理、規則檢查都用同一份結果
import defaultConfig from '../configs/default.json';
import speedConfig from '../configs/speed.json';
import technicalConfig from '../configs/technical.json';
import lightConfig from '../configs/light.json';
import raceFrpConfig from '../configs/race-frp.json';
import carbonDamperConfig from '../configs/carbon-damper.json';
import p4TechConfig from '../configs/p4-tech.json';
import p5TaiwanConfig from '../configs/p5-taiwan.json';
import p7DemoConfig from '../configs/p7-demo.json';
import p7PartsConfig from '../configs/p7-parts.json';
import vzDemoConfig from '../configs/vz-demo.json';
import vzTunedConfig from '../configs/vz-tuned.json';
import { spec as globalSpec, deriveParams } from './spec.js';
import { resolvePart, listParts } from './parts/index.js';
import { getBody, bodyMassProps, bodyClearance } from './bodies/index.js';
import { archCutBody } from './bodies/archCut.js';
import { rollerLayout, wheelLayout, componentLayout } from './carLayout.js';
import { solidGap, solidBox, verticesGap, sweepZ } from './parts/clearance.js';
import { polygonCentroid } from './parts/plateGeom.js';
import { bumperTrim } from './parts/bumperGeom.js';
import { drivetrainInertia } from './parts/inertia.js';
import { frontalArea } from './bodies/silhouette.js';
import { zeroTensor, addTensor, pointTensor, principalAxes, cylinderXTensor, boxTensor, axisymmetricTensor, flattenedCylinderXTensor, plateTensor } from './massTensor.js';
import { wheelInertia, axleInertia } from './parts/inertia.js';
import { chassisSideSolids, sideDamperAdapter } from './parts/chassisGeom.js';

/** @typedef {import('./parts/types').PlacedPart} PlacedPart */
/** @typedef {import('./parts/types').Vec3} Vec3 */
/** @typedef {import('./parts/types').Solid} Solid */
/** @typedef {import('./parts/types').PlacedSolid} PlacedSolid */

/** 組裝設定的 slot → 零件類別 */
export const SLOTS = {
  chassis: 'chassis',
  motor: 'motor',
  gear: 'gear',
  wheels: 'wheel',
  bearings: 'bearing',
  // 中間齒輪軸 / 中間齒輪軸承（含氟塗層軸、中間齒輪培林組）；舊設定沒有這個 slot 時用標準軸（SLOT_DEFAULTS）
  counterShaft: 'counter-shaft',
  // 前後導輪分開選（舊欄位 rollers 由 normalizeConfig 相容）
  frontRollers: 'roller',
  rearRollers: 'roller',
  frontStay: 'stay-front',
  rearStay: 'stay-rear',
  battery: 'battery',
  batteryCover: 'battery-cover',
  switch: 'switch',
  axles: 'axle',
  gearCover: 'gear-cover',
  hardware: 'hardware',
  massDamper: 'mass-damper',
  brakeSponge: 'brake-sponge',
  // 煞車架（FRP / 碳纖大面積），只在裝煞車海綿時有作用；舊設定沒有時用 FRP（SLOT_DEFAULTS）
  brakePlate: 'brake-plate',
  ballast: 'ballast',
  stabilizer: 'stabilizer',
  // B13：前／後導輪角度調整板（ダウンスラスト，15373）
  frontRollerAngle: 'roller-angle-plate',
  rearRollerAngle: 'roller-angle-plate',
};

/** 選配 slot：值可為 null（不裝）；組裝設定沒寫這個 slot 時也視為 null */
export const OPTIONAL_SLOTS = ['massDamper', 'brakeSponge', 'ballast', 'stabilizer', 'frontRollerAngle', 'rearRollerAngle'];

/**
 * 舊組裝設定欄位 → 新 slot（相容層）：導輪拆成 frontRollers / rearRollers，
 * 只寫 `rollers` 的設定（舊分享連結、舊測試）視為前後都裝同一款
 * @type {Record<string, string[]>}
 */
export const LEGACY_SLOT_ALIASES = {
  rollers: ['frontRollers', 'rearRollers'],
};

/**
 * 後來新增的必填 slot 的預設值（相容層）：舊組裝設定、舊分享連結沒有這些 slot 時，裝套件標準零件
 * @type {Record<string, string>}
 */
export const SLOT_DEFAULTS = {
  counterShaft: 'counter-shaft-standard',
  brakePlate: 'brake-plate-frp',
};

/**
 * 組裝設定正規化（相容層）：舊欄位 `rollers` 展開成 frontRollers 與 rearRollers，並移除舊欄位
 * 舊欄位與新欄位同時出現時以舊欄位為準：舊程式常用 `{ ...loadConfig(), rollers: 'x' }` 覆寫導輪，
 * 而 loadConfig() 已帶新欄位，若新欄位優先，這種覆寫會被悄悄忽略（網頁 URL 另外處理：URL 的新欄位優先，見 web/garage.js readUrl）
 * @type {(config: Record<string, any>) => Record<string, any>}
 */
export function normalizeConfig(config) {
  /** @type {Record<string, any>} */
  const out = { ...config };
  for (const [legacy, slots] of Object.entries(LEGACY_SLOT_ALIASES)) {
    if (out[legacy] === undefined) {
      continue;
    }
    for (const slot of slots) {
      out[slot] = out[legacy];
    }
    delete out[legacy];
  }
  for (const [slot, id] of Object.entries(SLOT_DEFAULTS)) {
    if (out[slot] === undefined) {
      out[slot] = id;
    }
  }
  return out;
}

/** 配重安裝點的中文名稱 */
const MOUNT_LABELS = { front: '前', center: '中央', rear: '後' };

/**
 * 某個 slot 可選的值（給網頁選單）：零件 id；有 mountPoints 的零件（配重）展開成 `id@安裝點`；選配 slot 另有 null（不裝）
 * 不相容的選項也列出（選了之後由 validateAssembly 擋下並說明原因）
 * @type {(slot: string) => { value: string | null, label: string }[]}
 */
export function slotChoices(slot) {
  // 舊 slot 名稱（rollers）：選項與新 slot 相同
  const category = SLOTS[slot] ?? SLOTS[LEGACY_SLOT_ALIASES[slot]?.[0] ?? ''];
  if (!category) {
    throw new Error(`未知的 slot：${slot}`);
  }
  /** @type {{ value: string | null, label: string }[]} */
  const out = [];
  if (OPTIONAL_SLOTS.includes(slot)) {
    out.push({ value: null, label: '不裝' });
  }
  for (const part of listParts(category)) {
    if (Array.isArray(part.mountPoints)) {
      for (const m of part.mountPoints) {
        out.push({ value: `${part.id}@${m}`, label: `${part.name}＠${MOUNT_LABELS[m] ?? m}` });
      }
    } else {
      out.push({ value: part.id, label: part.name });
    }
  }
  return out;
}

/** @type {Record<string, any>} */
const CONFIGS = { default: defaultConfig, speed: speedConfig, technical: technicalConfig, light: lightConfig, 'race-frp': raceFrpConfig, 'carbon-damper': carbonDamperConfig, 'p4-tech': p4TechConfig, 'p5-taiwan': p5TaiwanConfig, 'p7-demo': p7DemoConfig, 'p7-parts': p7PartsConfig, 'vz-demo': vzDemoConfig, 'vz-tuned': vzTunedConfig };

/** @type {() => string[]} 所有組裝設定名稱 */
export const listConfigs = () => Object.keys(CONFIGS);

/** @type {(name?: string) => Record<string, any>} 讀取組裝設定（回傳副本，可自由修改） */
export function loadConfig(name = 'default') {
  const c = CONFIGS[name];
  if (!c) {
    throw new Error(`未知的組裝設定：${name}`);
  }
  const { _readme, ...rest } = c;
  return normalizeConfig(structuredClone(rest));
}

/**
 * 把零件資料組成整車規格（底盤座標），讓建模 / 物理共用同一套欄位
 * @type {(p: Record<string, any>) => any}
 */
function buildSpec(p) {
  const ch = p.chassis;
  const fs = p.frontStay;
  const rs = p.rearStay;
  const g = p.gear;
  return {
    rules: globalSpec.rules,
    aero: globalSpec.aero,
    track: globalSpec.track,
    sim: globalSpec.sim,
    battery: p.battery,
    motor: p.motor,
    tire: p.wheels,
    // 迴路電阻（開關＋端子零件）與傳動系轉動慣量（輪子、輪軸、齒輪、馬達電樞，換算到輪軸）
    circuit: { resistance_ohm: p.switch.circuitResistance_ohm ?? 0 },
    spin: drivetrainInertia(p),
    drivetrain: {
      gearRatio: g.ratio,
      gearEfficiency: g.efficiency,
      // 中置雙軸：前後各 1 組中間齒輪；後置單軸（VZ）：只有後方 1 組，前輪經傳動軸＋冠狀齒輪驅動
      counterGearCount: ch.motorPosition === 'rear' ? 1 : 2,
      pinionPitchRadius_mm: g.pinionPitchRadius_mm,
      counterLargePitchRadius_mm: g.counterLargePitchRadius_mm,
      counterSmallPitchRadius_mm: g.counterSmallPitchRadius_mm,
      spurPitchRadius_mm: g.spurPitchRadius_mm,
      crownPitchRadius_mm: g.crownPitchRadius_mm ?? null,
    },
    bearings: {
      kind: p.bearings.kind,
      frictionCoeff: p.bearings.frictionCoeff,
      // 中間齒輪軸承的 μ 與輪軸軸承分開（中間齒輪軸 slot 決定，見 counterBearingFriction）
      counterFrictionCoeff: counterBearingFriction(p.bearings, p.counterShaft),
      shaftRadius_mm: globalSpec.bearingsGeometry.shaftRadius_mm,
      counterShaftRadius_mm: globalSpec.bearingsGeometry.counterShaftRadius_mm,
    },
    chassis: {
      wheelbase_mm: ch.wheelbase_mm,
      trackWidth_mm: ch.trackWidth_mm,
      // B14（VZ）：後輪距、馬達位置（rear = 後置橫置單軸）、馬達與電池座位置
      trackWidthRear_mm: ch.trackWidthRear_mm ?? ch.trackWidth_mm,
      motorPosition: ch.motorPosition ?? 'mid',
      motorMount_mm: ch.motorMount_mm ?? null,
      batteryBay_mm: ch.batteryBay_mm ?? null,
      refWheelDiameter_mm: ch.refWheelDiameter_mm,
      groundClearance_mm: ch.groundClearanceRef_mm,
      plateThickness_mm: ch.plateThickness_mm,
      // 前 / 後導輪各自的款式（直徑、高度、材質、疊層、錐形輪廓）；位置由 rollerLayoutOf() 依前後分別推導
      frontRoller: rollerSpec(p.frontRollers),
      rearRoller: rollerSpec(p.rearRollers),
      rollerCenterHeight_mm: fs.rollerY_mm,
      frontRollerX_mm: fs.rollerX_mm,
      frontRollerZ_mm: fs.rollerZ_mm,
      rearRollerX_mm: rs.rollerX_mm,
      rearRollerZ_mm: rs.rollerZ_mm,
      rearLowerRollerHeight_mm: rs.lowerRollerHeight_mm,
      rearUpperRollerHeight_mm: rs.upperRollerHeight_mm ?? null,
    },
  };
}

/**
 * 中間齒輪軸承的摩擦係數（parts/counterShafts.js 的規則）：中間齒輪軸 slot 自帶培林 → 培林 μ；
 * 否則跟著輪軸軸承 slot：滾珠培林 → 培林 μ，塑膠軸承 → 這支軸對塑膠軸承的 μ（沒寫就用塑膠軸承本身的值）
 * @type {(bearings: Record<string, any>, counterShaft: Record<string, any>) => number}
 */
const counterBearingFriction = (bearings, counterShaft) => {
  if (counterShaft.counterBearing) {
    return counterShaft.counterBearing.frictionCoeff;
  }
  if (bearings.kind === 'bushing' && counterShaft.bushingFrictionCoeff !== null && counterShaft.bushingFrictionCoeff !== undefined) {
    return counterShaft.bushingFrictionCoeff;
  }
  return bearings.frictionCoeff;
};

/**
 * 導輪零件 → 整車規格用的導輪欄位
 * @type {(ro: Record<string, any>) => import('./parts/types').RollerSpec}
 */
const rollerSpec = (ro) => ({
  id: ro.id,
  diameter_mm: ro.diameter_mm,
  height_mm: ro.height_mm,
  finish: ro.finish,
  tiers: ro.tiers ?? null,
  // 錐形導輪的輪廓（上段圓柱＋下段截錐），3D 模型與 sim.js 接觸幾何用同一份
  taper: ro.taper ?? null,
  // 導輪外環（橡膠 O 環 / 塑膠環），只給 3D 外形用
  ring: ro.ring ?? null,
  // 塑膠導輪的顏色（例如 15532 藍色 POM），只給 3D 外形用
  color: ro.color,
});

/**
 * 導輪配置（底盤座標）：前導輪（FL / FR）用 frontRoller 的款式、後導輪（RL / RR / RUL / RUR）用 rearRoller 的款式。
 * 位置計算沿用 carLayout.js 的 rollerLayout（導輪架座面、較高導輪往上長的規則都相同），只是前後各帶自己的導輪尺寸；
 * 每顆導輪另帶 slot（frontRollers / rearRollers）、finish、taper，給質量、干涉、3D 模型、物理接觸使用
 * @type {(s: any) => import('./parts/types').PlacedRoller[]}
 */
export function rollerLayoutOf(s) {
  /** @type {(rs: import('./parts/types').RollerSpec) => any} 只帶一端導輪尺寸的整車規格（給 rollerLayout） */
  const withRoller = (rs) => ({
    ...s,
    chassis: { ...s.chassis, rollerDiameter_mm: rs.diameter_mm, rollerHeight_mm: rs.height_mm, rollerTiers: rs.tiers },
  });
  const isFront = (/** @type {{ id: string }} */ r) => r.id === 'FL' || r.id === 'FR';
  const fr = s.chassis.frontRoller;
  const rr = s.chassis.rearRoller;
  const front = rollerLayout(withRoller(fr)).filter(isFront).map((r) => ({ ...r, slot: 'frontRollers', partId: fr.id, finish: fr.finish, taper: fr.taper, ring: fr.ring, color: fr.color }));
  const rear = rollerLayout(withRoller(rr)).filter((r) => !isFront(r)).map((r) => ({ ...r, slot: 'rearRollers', partId: rr.id, finish: rr.finish, taper: rr.taper, ring: rr.ring, color: rr.color }));
  return [...front, ...rear];
}

/**
 * B14：後置單軸底盤的齒輪列位置（底盤座標，與 model.js 相同）：小齒輪在馬達軸端（z = 馬達 z + 長度/2 + 3），
 * 中間齒輪中心同時距小齒輪 (小齒輪 + 中間大齒) 節圓、距後輪軸 (中間小齒 + 輪軸齒輪) 節圓，取兩圓交點中較高的一點
 * @type {(g: any, motor: any, axleX: number, axleY: number) => { z: number, counter: { x: number, y: number } }}
 */
export function singleShaftTrain(g, motor, axleX, axleY) {
  const r1 = g.pinionPitchRadius_mm + g.counterLargePitchRadius_mm;
  const r2 = g.counterSmallPitchRadius_mm + g.spurPitchRadius_mm;
  const dx = axleX - motor.x;
  const dy = axleY - motor.y;
  const d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = motor.x + (a * dx) / d;
  const my = motor.y + (a * dy) / d;
  const cands = [{ x: mx - (h * dy) / d, y: my + (h * dx) / d }, { x: mx + (h * dy) / d, y: my - (h * dx) / d }];
  const counter = cands[0].y >= cands[1].y ? cands[0] : cands[1];
  return { z: motor.z + motor.length / 2 + 3, counter };
}

/** @type {(v: Vec3, dy: number) => Vec3} */
const lifted = (v, dy) => ({ x: v.x, y: v.y + dy, z: v.z });

/**
 * 組裝整車（設定可用舊欄位 rollers，會先經 normalizeConfig 展開；asm.config 是正規化後的設定）
 * @type {(rawConfig: Record<string, any>) => any}
 */
export function assemble(rawConfig) {
  // 相容層：舊欄位 rollers → frontRollers / rearRollers
  const config = normalizeConfig(rawConfig);
  /** @type {Record<string, any>} */
  const p = {};
  for (const [slot, category] of Object.entries(SLOTS)) {
    const v = config[slot];
    if (OPTIONAL_SLOTS.includes(slot) && (v === undefined || v === null || v === '')) {
      p[slot] = null;
      continue;
    }
    if (v === undefined || v === null) {
      throw new Error(`組裝設定缺少 slot：${slot}`);
    }
    p[slot] = resolvePart(v, category);
  }
  // body 為 null / 空字串時不裝車殼（只有底盤）：質量、重心、外框、規則檢查都只算底盤
  const s = buildSpec(p);
  const ch = p.chassis;
  // B15：bodyArchCut = true 時把輪胎附近的殼面剪掉（底盤座標，輪軸相對底盤固定；切口跟著實際輪徑與輪寬）
  const baseBody = config.body ? getBody(config.body) : null;
  const body = baseBody && config.bodyArchCut
    ? archCutBody(baseBody, wheelLayout(s).map((w) => ({ x: w.x, y: w.y, z: w.z, r: p.wheels.diameter_mm / 2, width: p.wheels.width_mm })))
    : baseBody;
  const bodyProps = body ? bodyMassProps(body) : null;

  // 換輪徑時整個底盤（含導輪、車殼）跟著升降
  const lift = (p.wheels.diameter_mm - ch.refWheelDiameter_mm) / 2;

  // ---- 零件擺放（底盤座標，最後統一加 lift）----
  const comp = componentLayout(s);
  const wheels = wheelLayout(s);
  const rollers = rollerLayoutOf(s);
  const hw = ch.wheelbase_mm / 2;
  const axleY = ch.refWheelDiameter_mm / 2;
  // 中間齒輪位置：中間齒輪小齒與輪軸齒輪中心距 = 小齒 + 輪軸齒輪節圓半徑；中間齒輪軸與馬達軸同高（與 model.js gearTrainLayout 相同）
  const centerDist = p.gear.counterSmallPitchRadius_mm + p.gear.spurPitchRadius_mm;
  const counterX = hw - Math.sqrt(Math.max(0, centerDist * centerDist - (axleY - comp.motor.y) ** 2));
  // B14：後置單軸底盤（VZ）只有後方一組齒輪（位置見 singleShaftTrain）
  const rearMotor = comp.motor.axis === 'z';
  const ssTrain = rearMotor ? singleShaftTrain(p.gear, comp.motor, -hw, axleY) : null;

  /** @type {PlacedPart[]} */
  const parts = [];
  /** @type {(slot: string, label: string, mass_g: number, pos: Vec3, inertia_gmm2?: PlacedPart['inertia_gmm2']) => void} */
  const place = (slot, label, mass_g, pos, inertia_gmm2) => {
    // 質量 0 的零件（例如和底盤一體成型的前保桿）不列入
    if (mass_g <= 0) {
      return;
    }
    parts.push({ slot, id: p[slot]?.id ?? body?.id ?? slot, category: p[slot]?.category ?? 'body', label, mass_g, pos: lifted(pos, lift), ...(inertia_gmm2 ? { inertia_gmm2 } : {}) });
  };

  // 保桿切除：裝 FRP / 碳纖導輪板（chassisTrim）的那一端，底盤保桿兩側導輪臂剪掉；
  // 切除質量 = 切除幾何（parts/bumperGeom.js，與 3D 模型同一份）× 底盤密度，從底盤本體的質量與重心扣除
  const chassisTrim = [];
  for (const [slot, sx] of [['frontStay', 1], ['rearStay', -1]]) {
    // B14：VZ 的 FRP 前寬架與保桿一起鎖（ch.bumperTrim = false），不切保桿
    if (p[slot].chassisTrim && ch.bumperTrim !== false) {
      const t = bumperTrim(ch, sx);
      chassisTrim.push({ slot, end: sx > 0 ? 'front' : 'rear', mass_g: t.mass_g, com_mm: t.com_mm, volume_mm3: t.volume_mm3, second_mm5: t.second_mm5 });
    }
  }
  let chMass = ch.mass_g;
  const chMom = { x: ch.mass_g * ch.com_mm.x, y: ch.mass_g * ch.com_mm.y, z: ch.mass_g * ch.com_mm.z };
  // B3：底盤本體慣性 = 3D 模型網格分布（每 g 中心張量 × 實測質量），對原點；保桿切除區的 ∫rrᵀ dm 同樣扣掉
  const chOrigin = addTensor(Object.fromEntries(Object.entries(ch.inertiaPerMass_mm2).map(([k, v]) => [k, v * ch.mass_g])), pointTensor(ch.mass_g, ch.com_mm));
  for (const t of chassisTrim) {
    chMass -= t.mass_g;
    chMom.x -= t.mass_g * t.com_mm.x;
    chMom.y -= t.mass_g * t.com_mm.y;
    chMom.z -= t.mass_g * t.com_mm.z;
    const rho = ch.density_g_cm3 / 1000;
    const q = t.second_mm5;
    addTensor(chOrigin, { xx: (q.yy + q.zz) * rho, yy: (q.xx + q.zz) * rho, zz: (q.xx + q.yy) * rho, xy: -q.xy * rho, xz: -q.xz * rho, yz: -q.yz * rho }, -1);
  }
  const chCom = { x: chMom.x / chMass, y: chMom.y / chMass, z: chMom.z / chMass };
  place('chassis', chassisTrim.length > 0 ? '底盤本體（保桿切除後）' : '底盤本體', chMass, chCom, addTensor(chOrigin, pointTensor(chMass, chCom), -1));
  // B3：馬達外殼（兩側削平的圓柱，軸沿 x）均質中心張量（推估：電樞、磁鐵、外殼的實際分布未實測）
  if (rearMotor) {
    // B14：橫置馬達（軸沿 z）：同一顆扁圓柱張量，把 x、z 軸對調
    const t = flattenedCylinderXTensor(p.motor.mass_g, comp.motor.dia, comp.motor.flat, comp.motor.length);
    place('motor', '單軸馬達（後置橫置）', p.motor.mass_g, { x: comp.motor.x, y: comp.motor.y, z: comp.motor.z },
      { xx: t.zz, yy: t.yy, zz: t.xx, xy: t.yz, xz: t.xz, yz: t.xy });
  } else {
    place('motor', '雙軸馬達', p.motor.mass_g, { x: comp.motor.x, y: comp.motor.y, z: comp.motor.z },
      flattenedCylinderXTensor(p.motor.mass_g, comp.motor.dia, comp.motor.flat, comp.motor.length));
  }
  const cells = p.battery.cells;
  comp.battery.zs.slice(0, cells).forEach((z, i) => {
    const cellMass = p.battery.mass_g / cells;
    place('battery', `電池 ${i + 1}`, cellMass, { x: comp.battery.x, y: comp.battery.y, z },
      cylinderXTensor(cellMass, comp.battery.dia / 2, comp.battery.length));
  });
  // 齒輪組：前後各一半；質心取中間齒輪與輪軸齒輪之間（推估）
  // B3：齒輪組視為軸沿 z、半徑 = 輪軸齒輪節圓的實心圓盤（同 inertia.js 傳動系的推估），厚度取 0（上限：齒輪實際有腹板開孔）
  const gearR = p.gear.spurPitchRadius_mm;
  if (ssTrain) {
    // B14：單軸齒輪組拆成「後齒輪列（小齒輪＋中間齒輪＋輪軸齒輪）」「前後冠狀齒輪」「傳動軸」三處（質量來自 inertiaMasses_g，合計 = 齒輪組質量）
    const gm = p.gear.inertiaMasses_g;
    const ps = ch.propShaft_mm;
    // 裝錯齒輪組（例如雙軸 PRO 組，GEAR_CHASSIS 違規）時沒有冠狀齒輪與傳動軸資料：整組質量都放在後齒輪列，只為了讓組裝與規則檢查能完成
    const hasCrown = (gm.crown ?? 0) > 0 && (gm.propShaft ?? 0) > 0;
    const mTrain = hasCrown ? gm.pinion + gm.counter + gm.spur : p.gear.mass_g;
    place('gear', '後齒輪列', mTrain, { x: (ssTrain.counter.x - hw) / 2, y: (ssTrain.counter.y + axleY) / 2, z: ssTrain.z }, axisymmetricTensor(mTrain, (mTrain * gearR * gearR) / 2, 0, 'z'));
    if (hasCrown) {
      const cr = p.gear.crownPitchRadius_mm;
      for (const sx of [1, -1]) {
        place('gear', `${sx > 0 ? '前' : '後'}冠狀齒輪`, gm.crown, { x: sx * hw, y: axleY, z: ps.z - 1 }, axisymmetricTensor(gm.crown, (gm.crown * cr * cr) / 2, 0, 'z'));
      }
      place('gear', '傳動軸', gm.propShaft, { x: 0, y: ps.y, z: ps.z }, cylinderXTensor(gm.propShaft, 1, 2 * hw - 8));
    }
  } else {
    for (const sx of [1, -1]) {
      const label = sx > 0 ? '前' : '後';
      const m = p.gear.mass_g / 2;
      place('gear', `${label}齒輪組`, m, { x: sx * (counterX + hw) / 2, y: (comp.motor.y + axleY) / 2, z: 0 }, axisymmetricTensor(m, (m * gearR * gearR) / 2, 0, 'z'));
    }
  }
  // 輪胎＋輪框：繞輪軸 = inertia.js 的傳動系值（同一份），橫向 = 繞軸 / 2 + m·寬² / 12
  const wheelAxial = wheelInertia(p.wheels).total;
  for (const w of wheels) {
    place('wheels', `輪胎 ${w.id}`, p.wheels.mass_g, { x: w.x, y: w.y, z: w.z }, axisymmetricTensor(p.wheels.mass_g, wheelAxial, p.wheels.width_mm, 'z'));
  }
  const axleAxial = axleInertia(p.axles);
  for (const sx of [1, -1]) {
    place('axles', sx > 0 ? '前輪軸' : '後輪軸', p.axles.mass_g, { x: sx * hw, y: axleY, z: 0 }, axisymmetricTensor(p.axles.mass_g, axleAxial, p.axles.length_mm, 'z'));
  }
  // 軸承 6 處：輪軸左右支撐 ×4（輪軸支撐座 z = ±(輪距/2 − 6.35)：MA ±23.4，同 model.js）、中間齒輪軸 ×2
  // B14：VZ 後輪距較寬，後輪軸承跟著往外；中間齒輪只有後方 1 組，2 個軸承都在中間齒輪軸兩端
  for (const sx of [1, -1]) {
    const bz = (sx > 0 ? ch.trackWidth_mm : (ch.trackWidthRear_mm ?? ch.trackWidth_mm)) / 2 - 6.35;
    for (const sz of [1, -1]) {
      place('bearings', `輪軸軸承 ${sx > 0 ? '前' : '後'}${sz > 0 ? '右' : '左'}`, p.bearings.mass_g, { x: sx * hw, y: axleY, z: sz * bz });
    }
    const cpos = ssTrain ? { x: ssTrain.counter.x, y: ssTrain.counter.y, z: ssTrain.z + sx * 2 } : { x: sx * counterX, y: comp.motor.y, z: 0 };
    const clabel = ssTrain ? (sx > 0 ? '右' : '左') : sx > 0 ? '前' : '後';
    // 中間齒輪軸 slot 自帶培林（中間齒輪培林組）時，中間齒輪軸承改由它提供（取代輪軸軸承 slot 的中間齒輪軸承）
    const cb = p.counterShaft.counterBearing;
    if (cb) {
      place('counterShaft', `中間齒輪培林 ${clabel}`, cb.mass_g, cpos);
    } else {
      place('bearings', `中間齒輪軸承 ${clabel}`, p.bearings.counterMass_g, cpos);
    }
  }
  // B3：導輪視為軸沿 y 的均質圓柱（外徑、總高取導輪佈局；推估，實際有培林與鋁殼分層）
  for (const r of rollers) {
    const m = p[r.slot].mass_g;
    place(r.slot, `導輪 ${r.id}`, m, { x: r.x, y: r.y, z: r.z }, axisymmetricTensor(m, (m * r.r * r.r) / 2, r.h, 'y'));
  }
  // B13：導輪角度調整板夾在導輪架與底盤之間，每端一片；位置取該端導輪的 x 平均、往內 8 mm，高度同導輪中心往下 3.5 mm（同塑膠導輪架質心的推估）
  for (const [slot, rollerSlot, sx] of [['frontRollerAngle', 'frontRollers', 1], ['rearRollerAngle', 'rearRollers', -1]]) {
    const plate = p[slot];
    const own = rollers.filter((r) => r.slot === rollerSlot);
    if (plate && own.length > 0) {
      const x = own.reduce((a, r) => a + r.x, 0) / own.length - sx * 8;
      const y = own.reduce((a, r) => a + r.y, 0) / own.length - 3.5;
      place(slot, `${sx > 0 ? '前' : '後'}導輪角度調整板 ${plate.angle_deg}°`, plate.mass_g, { x, y, z: 0 });
    }
  }
  // 導輪架質心：板件 = 俯視外形面積形心、板厚中央；塑膠標準件 = 導輪座與底盤端之間（推估：導輪軸往內 8 mm、導輪中心往下 3.5 mm）
  for (const [slot, sx] of [['frontStay', 1], ['rearStay', -1]]) {
    const st = p[slot];
    const label = sx > 0 ? '前導輪架' : '後導輪架';
    if (st.slide) {
      // 滑動保桿（前後皆可）：滑動板（隨導輪左右滑動）、樹脂滑軌與小五金（固定在底盤）分開放，滑動部分另建剛體（見下方 sliders）
      const [cx, cz] = polygonCentroid(st.plate.outline);
      const rail = st.slide.rail;
      const railPos = { x: (rail.xMin_mm + rail.xMax_mm) / 2, y: rail.y_mm + rail.thickness_mm / 2, z: 0 };
      const end = sx > 0 ? '前' : '後';
      place(slot, SLIDE_PLATE_LABELS[slot], st.slide.plateMass_g, { x: cx, y: st.plate.y_mm + st.plate.thickness_mm / 2, z: cz });
      place(slot, `${end}滑動保桿滑軌`, st.slide.railMass_g, railPos);
      place(slot, `${end}滑動保桿彈簧與螺絲`, st.slide.hardware_g, railPos);
    } else if (st.plate) {
      const [cx, cz] = polygonCentroid(st.plate.outline);
      // B3：板件用俯視外形的均質平板張量（開孔不扣；質量仍用零件值）
      place(slot, label, st.mass_g, { x: cx, y: st.plate.y_mm + st.plate.thickness_mm / 2, z: cz }, plateTensor(st.mass_g, st.plate.outline, st.plate.thickness_mm));
    } else if (sx > 0) {
      place(slot, label, st.mass_g, { x: st.rollerX_mm - 8, y: st.rollerY_mm - 3.5, z: 0 });
    } else {
      const upper = st.upperRollerHeight_mm ?? st.lowerRollerHeight_mm;
      place(slot, label, st.mass_g, { x: -(st.rollerX_mm - 8), y: (st.lowerRollerHeight_mm + upper) / 2 - 3.5, z: 0 });
    }
  }
  if (rearMotor) {
    // B14：VZ 電池扣跨在兩顆電池上方；後齒輪蓋蓋住馬達後方的齒輪列（推估位置）
    place('batteryCover', '電池扣', p.batteryCover.mass_g, { x: comp.battery.x, y: comp.battery.y + comp.battery.dia / 2 + 0.5, z: 0 });
    place('gearCover', '後齒輪蓋', p.gearCover.mass_g, { x: (ssTrain.counter.x - hw) / 2, y: ssTrain.counter.y + p.gear.counterLargePitchRadius_mm + 1, z: ssTrain.z });
  } else {
    place('batteryCover', '電池蓋', p.batteryCover.mass_g, { x: 0, y: ch.groundClearanceRef_mm + 0.5, z: 0 });
    // 齒輪蓋蓋住馬達與前後齒輪上方（質心推估：馬達頂面上方 2 mm）
    place('gearCover', '齒輪蓋', p.gearCover.mass_g, { x: 0, y: comp.motor.y + comp.motor.flat / 2 + 2, z: 0 });
  }
  place('switch', '開關＋端子', p.switch.mass_g, ch.switchPos_mm);
  // 小五金分散在底盤上，質心取底盤本體質心（推估）
  place('hardware', '小五金', p.hardware.mass_g, ch.com_mm);

  // ---- 選配零件：制振器、煞車海綿、配重。實體形狀（底盤座標）同時給干涉檢查、外框、離地高度、3D 模型 ----
  const opt = optionalLayout(p, comp, rollers);
  for (const d of opt.dampers) {
    place('massDamper', d.label, d.mass_g, d.pos);
    // 擺動式制振器的擺臂隨配重一起擺動（另列一筆質量，物理引擎併入同一個擺動剛體）
    if (d.swing) {
      place('massDamper', `${d.label}擺臂`, d.swing.armMass_g, d.swing.armPos);
    }
  }
  // 制振器托架（例如 MA 側制振器的 FRP 側板）鎖死在底盤上，質量計入剛體，不跟配重一起滑動
  for (const b of opt.damperBrackets) {
    place('massDamper', b.label, b.mass_g, b.pos);
  }
  if (opt.sponge) {
    if (opt.sponge.plate) {
      place('brakeSponge', '煞車板', opt.sponge.plate.mass_g, opt.sponge.plate.pos);
    }
    for (const e of opt.sponge.extras) {
      place('brakeSponge', e.label, e.mass_g, e.pos);
    }
    place('brakeSponge', opt.sponge.label, opt.sponge.mass_g, opt.sponge.pos);
  }
  if (opt.ballast) {
    const b = opt.ballast.solid;
    place('ballast', `配重（${opt.ballast.mount}）`, opt.ballast.mass_g, opt.ballast.pos, boxTensor(opt.ballast.mass_g, b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z));
  }
  for (const st of opt.stabilizers) {
    place('stabilizer', st.label, st.mass_g, st.pos);
  }
  if (body) {
    parts.push({ slot: 'body', id: body.id, category: 'body', label: `車殼 ${body.id}`, mass_g: bodyProps.mass_g, pos: lifted(bodyProps.com_mm, lift) });
  }

  // ---- 質量、重心、慣性：整車（P14）與「剛體部分」（不含可上下滑動的制振器，物理引擎的車體剛體用）----
  const total = massProps(parts, ch, bodyProps);
  const { mass_g, com_mm } = total;
  const inertia_kgm2 = total.inertia_kgm2;
  // 制振器鎖死（locked = true，用螺帽鎖緊當固定配重）時視為剛體的一部分
  const damperLabels = new Set(opt.dampers.flatMap((d) => (d.swing ? [d.label, `${d.label}擺臂`] : [d.label])));
  const movableParts = p.massDamper && !p.massDamper.locked ? parts.filter((q) => q.slot === 'massDamper' && damperLabels.has(q.label)) : [];
  // 滑動保桿：滑動板＋裝在上面的前導輪（＋同一支螺絲上的穩定零件）是另一個剛體，不屬於車體剛體
  // 後滑動保桿同理（後滑動板＋後導輪）；前後都裝時是兩個獨立的滑動剛體
  const slider = sliderOf('frontStay', p.frontStay, parts, opt.stabilizers);
  const rearSlider = sliderOf('rearStay', p.rearStay, parts, opt.stabilizers);
  const sliders = [slider, rearSlider].filter((q) => q !== null);
  const sliderParts = parts.filter((q) => sliders.some((sl) => sl.labels.includes(q.label)));
  const detached = [...movableParts, ...sliderParts];
  const rigid = detached.length > 0 ? massProps(parts.filter((q) => !detached.includes(q)), ch, bodyProps) : total;
  const movable = p.massDamper?.swing ? swingMovable(p.massDamper, movableParts, opt.dampers[0], lift) : movableParts.map((q) => {
    const d = p.massDamper;
    return {
      label: q.label,
      mass_g: q.mass_g,
      pos: q.pos,
      stroke_mm: d.stroke_mm,
      seatDeflection_mm: d.seatDeflection_mm,
      seatDampingRatio: d.seatDampingRatio,
      slideFriction_Nspm: d.slideFriction_Nspm,
    };
  });

  // ---- 外框（車體座標）：底盤本體、輪胎、導輪、車殼的聯集 ----
  const R = p.wheels.diameter_mm / 2;
  const halfTire = p.wheels.width_mm / 2;
  const chassisBox = { min: lifted(ch.bbox_mm.min, lift), max: lifted(ch.bbox_mm.max, lift) };
  const bodyBox = body ? { min: lifted(bodyProps.bbox_mm.min, lift), max: lifted(bodyProps.bbox_mm.max, lift) } : null;
  /** @type {{ min: Vec3, max: Vec3 }[]} 結構外框：底盤本體＋車殼（沒裝車殼時只有底盤） */
  const structBoxes = bodyBox ? [chassisBox, bodyBox] : [chassisBox];
  /** @type {{ min: Vec3, max: Vec3 }[]} */
  const boxes = [...structBoxes];
  for (const w of wheels) {
    boxes.push({ min: { x: w.x - R, y: 0, z: w.z - halfTire }, max: { x: w.x + R, y: 2 * R, z: w.z + halfTire } });
  }
  // 滑動保桿（推估規則）：裝在滑動板上的零件（前導輪、滑動板、穩定零件）以行程端點（左右各 ±stroke）的外框計入，車寬檢查較保守
  // 後滑動保桿同理（後導輪、後滑動板）
  /** @type {(slot: string) => number} 某個 slot 的零件因滑動行程在 z 方向外擴的量（不在滑動板上 = 0） */
  const strokeOf = (slot) => sliders.find((sl) => sl.slot === slot || sl.rollerSlot === slot)?.stroke_mm ?? 0;
  /** @type {number[]} 每個外框在 z 方向因滑動行程外擴的量（只有滑動板上的零件 > 0；迎風面積用不外擴的寬度） */
  const boxSlideDz = boxes.map(() => 0);
  for (const r of rollers) {
    const dz = strokeOf(r.slot);
    boxes.push({ min: { x: r.x - r.r, y: r.y - r.h / 2 + lift, z: r.z - r.r - dz }, max: { x: r.x + r.r, y: r.y + r.h / 2 + lift, z: r.z + r.r + dz } });
    boxSlideDz.push(dz);
  }
  // 導輪板、選配零件（制振器取整個行程的範圍）
  /** @type {{ min: Vec3, max: Vec3 }[]} */
  const staticExtraBoxes = [];
  const extraBoxes = opt.solids.filter((q) => q.group !== 'tire' && q.group !== 'roller').map((q) => {
    const b = solidBox(q.solid);
    const damper = opt.dampers.find((d) => d.swept === q.solid);
    const halfX = damper?.part.shape === 'box' ? damper.part.length_mm / 2 : (damper?.part.diameter_mm ?? 0) / 2;
    const halfZ = damper?.part.shape === 'box' ? damper.part.width_mm / 2 : halfX;
    staticExtraBoxes.push(damper ? {
      min: lifted({ x: damper.pos.x - halfX, y: damper.seat.y, z: damper.pos.z - halfZ }, lift),
      max: lifted({ x: damper.pos.x + halfX, y: damper.seat.y + damper.part.height_mm, z: damper.pos.z + halfZ }, lift),
    } : { min: lifted(b.min, lift), max: lifted(b.max, lift) });
    let dz = 0;
    if (q.group === 'stay') {
      dz = strokeOf(q.slot);
    } else if (q.group === 'stabilizer') {
      // 穩定零件和前導輪同一支螺絲
      dz = strokeOf('frontStay');
    }
    boxSlideDz.push(dz);
    return { min: lifted({ ...b.min, z: b.min.z - dz }, lift), max: lifted({ ...b.max, z: b.max.z + dz }, lift) };
  });
  boxes.push(...extraBoxes);
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  boxes.forEach((b, i) => {
    for (const k of ['x', 'y', 'z']) {
      min[k] = Math.min(min[k], b.min[k]);
      max[k] = Math.max(max[k], b.max[k]);
    }
  });
  const bbox_mm = { min, max, size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z } };
  // Shell mesh projection ∪ other components' projected boxes, at rest.
  // The swept bounds remain solely for regulation checks.
  const aeroBoxes = boxes.slice(0, boxes.length - extraBoxes.length).filter((b) => b !== bodyBox).map((b) => {
    const dz = boxSlideDz[boxes.indexOf(b)];
    return { min: { ...b.min, z: b.min.z + dz }, max: { ...b.max, z: b.max.z - dz } };
  }).concat(staticExtraBoxes);
  const frontalArea_mm2 = frontalArea(body, aeroBoxes, lift);
  // 離地高度：輪胎以外的最低點（底盤本體、車殼、導輪）
  // structureClearance_mm：只看底盤本體、車殼、導輪（物理車體碰撞方塊的底面用這個）；groundClearance_mm 另含導輪板與選配零件（規則檢查用）
  const structureClearance_mm = Math.min(...structBoxes.map((b) => b.min.y), ...rollers.map((r) => r.y - r.h / 2 + lift));
  const groundClearance_mm = Math.min(structureClearance_mm, ...extraBoxes.map((b) => b.min.y));

  // 車殼與輪胎、導輪的間隙（底盤座標：輪軸相對底盤固定，換大徑輪時輪胎往外長）
  // 沒裝車殼時 fit = null（規則檢查跳過車殼間隙）
  let fit = null;
  if (body) {
    fit = bodyClearance(
      body,
      wheels.map((w) => ({ x: w.x, y: w.y, z: w.z, r: R, width: p.wheels.width_mm })),
      rollers.map((r) => ({ ...r, stroke: strokeOf(r.slot === 'frontRollers' ? 'frontStay' : 'rearStay') })),
    );
  }
  const interference = interferenceChecks(body, bodyProps, wheels.map((w) => ({ ...w, r: R, width: p.wheels.width_mm })), rollers, opt.solids, p);

  return {
    config: structuredClone(config),
    partsBySlot: p,
    parts,
    mass_g,
    com_mm,
    bbox_mm,
    groundClearance_mm,
    structureClearance_mm,
    frontalArea_mm2,
    fit,
    interference,
    chassisTrim,
    features: [...new Set([...(ch.features ?? []), ...(p.frontStay.features ?? []), ...(p.rearStay.features ?? [])])],
    optional: { dampers: opt.dampers, damperBrackets: opt.damperBrackets, solids: opt.solids, sponge: opt.sponge, ballast: opt.ballast, stabilizers: opt.stabilizers },
    rigid: { mass_g: rigid.mass_g, com_mm: rigid.com_mm, inertia_kgm2: rigid.inertia_kgm2, inertiaTensor_kgm2: rigid.inertiaTensor_kgm2, inertiaFrame: rigid.inertiaFrame },
    movable,
    // 滑動保桿的滑動部分：slider = 前、rearSlider = 後，沒裝時為 null；sliders = 有裝的（前在前）
    slider,
    rearSlider,
    sliders,
    lift_mm: lift,
    gearRatio: p.gear.ratio,
    driveType: ch.driveType,
    spec: s,
    inertia_kgm2,
    inertiaTensor_kgm2: total.inertiaTensor_kgm2,
    inertiaFrame: total.inertiaFrame,
    P: deriveParams({ ...s, frontalArea_mm2 }, mass_g),
    layout: {
      wheels: wheels.map((w) => ({ ...lifted(w, lift), id: w.id, r: R, width: p.wheels.width_mm })),
      // B13：thrust_deg = 該端導輪角度調整板的下推角（沒裝為 0）
      rollers: rollers.map((r) => ({ ...r, y: r.y + lift, thrust_deg: p[r.slot === 'frontRollers' ? 'frontRollerAngle' : 'rearRollerAngle']?.angle_deg ?? 0 })),
    },
    chassisMounts: ch.bodyMounts.map((m) => ({ ...lifted(m, lift), id: m.id })),
    // 底盤本體外框（車體座標）：沒裝車殼時物理碰撞方塊用這個
    chassisBox_mm: chassisBox,
    // 沒裝車殼時為 null
    body: body
      ? {
          id: body.id,
          def: body,
          // 切輪拱時記錄原車殼 id 與切掉的質量（B15）
          archCut: body.archCut ? { baseId: body.archCut.baseId, removedMass_g: bodyMassProps(baseBody).mass_g - bodyProps.mass_g } : null,
          mounts: body.mounts.map((m) => ({ ...lifted(m, lift), id: m.id })),
          mass_g: bodyProps.mass_g,
          bbox_mm: bodyBox,
        }
      : null,
  };
}

/**
 * 擺動式制振器（球頭連桿）的擺動剛體：配重＋擺臂合成一個剛體，繞支點（球頭中心）的橫向軸（車體 z 軸）轉動。
 * 質心 = 配重與擺臂的質量加權；對自身質心的慣性：配重方塊（6 × 6 × 32 mm，32 沿 z）＋擺臂細桿（沿 x）＋平行軸定理。
 * 座墊接觸點 = 配重中心（座墊在配重正下方）。位置都是車體座標（已加 lift）
 * @type {(d: Record<string, any>, movableParts: PlacedPart[], placed: any, lift: number) => any[]}
 */
function swingMovable(d, movableParts, placed, lift) {
  if (movableParts.length === 0) {
    return [];
  }
  const weight = movableParts.find((q) => q.label === placed.label);
  const arm = movableParts.find((q) => q.label === `${placed.label}擺臂`);
  const own = [weight, arm].filter((q) => q !== undefined);
  const mass_g = own.reduce((a, q) => a + q.mass_g, 0);
  const com = {
    x: own.reduce((a, q) => a + q.mass_g * q.pos.x, 0) / mass_g,
    y: own.reduce((a, q) => a + q.mass_g * q.pos.y, 0) / mass_g,
    z: own.reduce((a, q) => a + q.mass_g * q.pos.z, 0) / mass_g,
  };
  // g·mm²：方塊自身（x 向寬 w、y 向高 h、z 向長 L）
  const m = weight.mass_g;
  const w = d.width_mm;
  const h = d.height_mm;
  const L = d.length_mm;
  const I = { x: (m * (h * h + L * L)) / 12, y: (m * (w * w + L * L)) / 12, z: (m * (w * w + h * h)) / 12 };
  // 擺臂：沿 x 的細桿（長 = 支點到配重的水平距離）
  if (arm) {
    const la = d.swing.armLength_mm;
    I.y += (arm.mass_g * la * la) / 12;
    I.z += (arm.mass_g * la * la) / 12;
  }
  for (const q of own) {
    const dx = q.pos.x - com.x;
    const dy = q.pos.y - com.y;
    const dz = q.pos.z - com.z;
    I.x += q.mass_g * (dy * dy + dz * dz);
    I.y += q.mass_g * (dx * dx + dz * dz);
    I.z += q.mass_g * (dx * dx + dy * dy);
  }
  return [
    {
      label: placed.label,
      mass_g,
      pos: com,
      seatPos: weight.pos,
      pivot: lifted(placed.swing.pivot, lift),
      inertia_kgm2: { x: I.x * 1e-9, y: I.y * 1e-9, z: I.z * 1e-9 },
      maxAngle_rad: (d.swing.maxAngle_deg * Math.PI) / 180,
      pivotFriction_Nmspr: d.swing.pivotFriction_Nmspr,
      stroke_mm: d.stroke_mm,
      seatDeflection_mm: d.seatDeflection_mm,
      seatDampingRatio: d.seatDampingRatio,
      slideFriction_Nspm: 0,
    },
  ];
}

/** 滑動保桿的滑動板在零件清單（asm.parts）中的標籤（前 / 後） */
const SLIDE_PLATE_LABELS = { frontStay: '前滑動板', rearStay: '後滑動板' };

/**
 * 滑動保桿的滑動部分：滑動板＋裝在上面的導輪（前：FL / FR＋前導輪上方的穩定零件（同一支螺絲）；後：RL / RR / RUL / RUR），
 * 質量、質心（車體座標）、對自身質心的慣性。慣性：各零件以質點計（平行軸定理），滑動板另加自身外框方塊的慣性。導輪架不是滑動保桿時回傳 null
 * @type {(slot: 'frontStay' | 'rearStay', st: Record<string, any>, parts: PlacedPart[], stabilizers: any[]) => import('./parts/types').PlacedSlider | null}
 */
function sliderOf(slot, st, parts, stabilizers) {
  if (!st.slide) {
    return null;
  }
  const rollerSlot = slot === 'frontStay' ? 'frontRollers' : 'rearRollers';
  // 穩定零件裝在前導輪上方，只跟前滑動板一起滑動
  const stabLabels = new Set(slot === 'frontStay' ? stabilizers.map((s) => s.label) : []);
  const own = parts.filter((q) => q.label === SLIDE_PLATE_LABELS[slot] || q.slot === rollerSlot || (q.slot === 'stabilizer' && stabLabels.has(q.label)));
  let mass_g = 0;
  const mom = { x: 0, y: 0, z: 0 };
  for (const q of own) {
    mass_g += q.mass_g;
    mom.x += q.mass_g * q.pos.x;
    mom.y += q.mass_g * q.pos.y;
    mom.z += q.mass_g * q.pos.z;
  }
  const com_mm = { x: mom.x / mass_g, y: mom.y / mass_g, z: mom.z / mass_g };
  const inertia = zeroTensor();
  for (const q of own) {
    const dx = q.pos.x - com_mm.x;
    const dy = q.pos.y - com_mm.y;
    const dz = q.pos.z - com_mm.z;
    addTensor(inertia, pointTensor(q.mass_g, { x: dx, y: dy, z: dz }));
    if (q.inertia_gmm2) addTensor(inertia, q.inertia_gmm2);
  }
  // 滑動板自身（外框方塊）的慣性
  const xs = st.plate.outline.map((/** @type {number[]} */ v) => v[0]);
  const zs = st.plate.outline.map((/** @type {number[]} */ v) => v[1]);
  const lx = Math.max(...xs) - Math.min(...xs);
  const lz = Math.max(...zs) - Math.min(...zs);
  const ly = st.plate.thickness_mm;
  const mp = st.slide.plateMass_g;
  inertia.xx += (mp / 12) * (ly * ly + lz * lz);
  inertia.yy += (mp / 12) * (lx * lx + lz * lz);
  inertia.zz += (mp / 12) * (lx * lx + ly * ly);
  const sl = st.slide;
  const tensor = Object.fromEntries(Object.entries(inertia).map(([k, v]) => [k, v * 1e-9]));
  const principal = principalAxes(tensor);
  return {
    slot,
    rollerSlot,
    partId: st.id,
    labels: own.map((q) => q.label),
    mass_g,
    com_mm,
    inertia_kgm2: principal.inertia,
    inertiaTensor_kgm2: tensor,
    inertiaFrame: principal.frame,
    stroke_mm: sl.stroke_mm,
    springK_N_per_mm: sl.springK_N_per_mm,
    preload_N: sl.preload_N,
    dampingRatio: sl.dampingRatio,
    seatDeflection_mm: sl.seatDeflection_mm,
  };
}

/**
 * Full parallel-axis tensor. Body uses shell/solid integrals; the chassis and
 * components carry their own central tensors (chassis mesh
 * distribution, motor, wheels, axles, gears, rollers, plates, ballast, AA
 * cells); remaining small items (bearings, covers, switch, hardware) are points.
 * @type {(parts: PlacedPart[], ch: any, bodyProps: any) => { mass_g: number, com_mm: Vec3, inertia_kgm2: Vec3 }}
 */
function massProps(parts, ch, bodyProps) {
  let mass_g = 0;
  const mom = { x: 0, y: 0, z: 0 };
  for (const q of parts) {
    mass_g += q.mass_g;
    mom.x += q.mass_g * q.pos.x;
    mom.y += q.mass_g * q.pos.y;
    mom.z += q.mass_g * q.pos.z;
  }
  const com_mm = { x: mom.x / mass_g, y: mom.y / mass_g, z: mom.z / mass_g };
  const inertia = zeroTensor();
  for (const q of parts) {
    const dx = q.pos.x - com_mm.x;
    const dy = q.pos.y - com_mm.y;
    const dz = q.pos.z - com_mm.z;
    addTensor(inertia, pointTensor(q.mass_g, { x: dx, y: dy, z: dz }));
    if (q.inertia_gmm2) addTensor(inertia, q.inertia_gmm2);
  }
  if (bodyProps) addTensor(inertia, bodyProps.inertia_gmm2);
  // g·mm² → kg·m²
  const tensor = Object.fromEntries(Object.entries(inertia).map(([k, v]) => [k, v * 1e-9]));
  const principal = principalAxes(tensor);
  return { mass_g, com_mm, inertia_kgm2: principal.inertia, inertiaTensor_kgm2: tensor, inertiaFrame: principal.frame };
}

/** @type {(cx: number, cz: number, y0: number, lx: number, lz: number, ly: number) => Solid} 底面中心在 (cx, y0, cz) 的方塊 */
const boxAt = (cx, cz, y0, lx, lz, ly) => ({
  kind: 'box',
  min: { x: cx - lx / 2, y: y0, z: cz - lz / 2 },
  max: { x: cx + lx / 2, y: y0 + ly, z: cz + lz / 2 },
});

/**
 * 選配零件與導輪板的擺放（底盤座標，未加 lift）
 * 制振器：靜止在行程下止點；干涉檢查用「整個行程掃過的範圍」
 * 煞車海綿：貼在後導輪架的煞車座下方；配重：依安裝點（前 / 後鎖在保桿或導輪板下方，中央貼在齒輪蓋頂面）
 * 穩定零件：前導輪（FL / FR）正上方，底面 = 導輪頂面 + spacer_mm，與導輪同軸（同一支螺絲）
 * @type {(p: Record<string, any>, comp: any, rollers: any[]) => { dampers: any[], damperBrackets: { label: string, mass_g: number, pos: Vec3 }[], sponge: any, ballast: any, stabilizers: any[], solids: PlacedSolid[] }}
 */
function optionalLayout(p, comp, rollers) {
  const ch = p.chassis;
  /** @type {PlacedSolid[]} */
  const solids = [];
  for (const [slot, label] of [['frontStay', '前導輪板'], ['rearStay', '後導輪板']]) {
    const pl = p[slot].plate;
    if (pl) {
      solids.push({ group: 'stay', slot, label, solid: { kind: 'plate', outline: pl.outline, y0: pl.y_mm, y1: pl.y_mm + pl.thickness_mm } });
    }
  }

  /** @type {any[]} */
  const dampers = [];
  /** @type {{ label: string, mass_g: number, pos: Vec3 }[]} 制振器托架（固定在底盤） */
  const damperBrackets = [];
  const d = p.massDamper;
  if (d && d.swing) {
    // 擺動式制振器（球頭連桿）——支點在後導輪板制振器座上方，配重橫放在支點前方 armLength 處，
    // 靜止時靠在後保桿頂面的止擋墊上；往上擺到 maxAngle 為止。干涉用「擺動掃過的範圍」：方塊轉 maxAngle 時角點多出的量另加 1 mm
    const sw = d.swing;
    const m = p.rearStay.damperMount ?? { x_mm: -79, z_mm: 0, y_mm: ch.bumperBottomY_mm };
    const pivot = { x: m.x_mm, y: m.y_mm + sw.pivotHeight_mm, z: m.z_mm };
    const seat = { x: m.x_mm + sw.armLength_mm, y: ch.bumperBottomY_mm + (ch.bumperThickness_mm ?? 2.4), z: m.z_mm };
    const h = d.height_mm;
    const swept = boxAt(seat.x, seat.z, seat.y, d.width_mm + 2, d.length_mm, h + d.stroke_mm + 1);
    const pos = { x: seat.x, y: seat.y + h / 2, z: seat.z };
    // 擺臂質心：支點與配重之間的中點（FRP 小板）
    const armPos = { x: (pivot.x + pos.x) / 2, y: (pivot.y + pos.y) / 2, z: pivot.z };
    dampers.push({ label: '制振器', mass_g: d.mass_g, pos, seat, part: d, swept, index: 0, swing: { pivot, armPos, armMass_g: sw.armMass_g } });
    solids.push({ group: 'damper', slot: 'massDamper', label: '制振器', solid: /** @type {Solid} */ (swept) });
    damperBrackets.push({ label: '制振器支點底座', mass_g: sw.bracketMass_g, pos: { x: pivot.x, y: m.y_mm + 1, z: pivot.z } });
    // 支點底座＋球頭＋球頭杯也是實體（與 model.js 同尺寸：底座 7 × 22 mm、球頭杯外徑 4.4 mm 頂到支點上方 2.2 mm），和配重等零件一起做干涉檢查
    solids.push({ group: 'damper', slot: 'massDamper', label: '制振器支點底座', solid: /** @type {Solid} */ (boxAt(pivot.x, pivot.z, m.y_mm, 7, 22, sw.pivotHeight_mm + 2.2)) });
  } else if (d) {
    /** @type {{ x: number, y: number, z: number }[]} 制振器底面中心（下止點） */
    let seats = [];
    if (d.mount === 'side') {
      const m = ch.sideDamperMount ?? { x_mm: 0, z_mm: 33 };
      const extra = { spacer_mm: m.spacer_mm, plateInnerZ_mm: m.plateInnerZ_mm, plateLength_mm: m.plateLength_mm };
      seats = [{ x: m.x_mm, y: m.y_mm, z: -m.z_mm, ...extra }, { x: m.x_mm, y: m.y_mm, z: m.z_mm, ...extra }].slice(0, d.count);
    } else {
      const m = p.rearStay.damperMount ?? { x_mm: -79, z_mm: 0, y_mm: ch.bumperBottomY_mm };
      // 墊管（rearSpacer_mm）：制振器整個墊高，墊管本身是固定的安裝五金（B10）
      const spacer = d.rearSpacer_mm ?? 0;
      seats = [{ x: m.x_mm, y: m.y_mm + spacer, z: m.z_mm, baseY: m.y_mm, rearSpacer: spacer }];
    }
    seats.forEach((s, i) => {
      const adapter = d.mount === 'side' ? sideDamperAdapter(ch, d, s) : null;
      if (adapter) s.y = adapter.seatY;
      const h = d.height_mm;
      // The prismatic joint permits 1 mm of seat compression below zero.
      // Include that lower stop in side-structure clearance, not just +stroke.
      const lowerTravel = adapter ? 1 : 0;
      const swept = d.shape === 'box'
        ? boxAt(s.x, s.z, s.y - lowerTravel, d.length_mm, d.width_mm, h + d.stroke_mm + lowerTravel)
        : { kind: 'cyl', axis: 'y', c: { x: s.x, y: s.y + (h + d.stroke_mm - lowerTravel) / 2, z: s.z }, r: d.diameter_mm / 2, halfLen: (h + d.stroke_mm + lowerTravel) / 2 };
      const label = seats.length > 1 ? `制振器 ${s.z < 0 ? '左' : '右'}` : '制振器';
      dampers.push({ label, mass_g: d.mass_g, pos: { x: s.x, y: s.y + h / 2, z: s.z }, seat: s, part: d, swept, index: i, adapter });
      solids.push({ group: 'damper', slot: 'massDamper', label, solid: /** @type {Solid} */ (swept) });
      // Side mounting plates / spacers stay fixed; their actual solids also
      // participate in body and unrelated-part clearance.
      if (adapter) {
        const b = solidBox(adapter.plate);
        damperBrackets.push({ label: `${label}托架`, mass_g: adapter.plateMass_g, pos: { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 } });
        solids.push({ group: 'damper', slot: 'massDamper', label: `${label}托架`, solid: adapter.plate, mountingHardware: true });
        const padBox = solidBox(adapter.pad);
        damperBrackets.push({ label: `${label}座墊`, mass_g: adapter.padMass_g, pos: { x: (padBox.min.x + padBox.max.x) / 2, y: (padBox.min.y + padBox.max.y) / 2, z: (padBox.min.z + padBox.max.z) / 2 } });
        solids.push({ group: 'damper', slot: 'massDamper', label: `${label}座墊`, solid: adapter.pad, mountingHardware: true });
        adapter.spacers.forEach((spacer, n) => {
          damperBrackets.push({ label: `${label}墊管 ${n + 1}`, mass_g: spacer.mass_g, pos: { x: spacer.x, y: (spacer.y0 + spacer.y1) / 2, z: spacer.z } });
          // The bore is occupied by its mounting screw; an outer cylinder is
          // conservative for clearance against unrelated parts and the body.
          solids.push({ group: 'damper', slot: 'massDamper', label: `${label}墊管 ${n + 1}`, mountingHardware: true, solid: { kind: 'cyl', axis: 'y', c: { x: spacer.x, y: (spacer.y0 + spacer.y1) / 2, z: spacer.z }, r: spacer.outerRadius, halfLen: (spacer.y1 - spacer.y0) / 2 } });
        });
      } else if (s.rearSpacer > 0) {
        // 15473 鋁墊管（外徑 4、內徑 2.2 mm，同 sideDamperAdapter 的墊管）
        const spacerMass = Math.PI * (2 ** 2 - 1.1 ** 2) * s.rearSpacer * 2.7 / 1000;
        damperBrackets.push({ label: `${label}墊管`, mass_g: spacerMass, pos: { x: s.x, y: s.baseY + s.rearSpacer / 2, z: s.z } });
        solids.push({ group: 'damper', slot: 'massDamper', label: `${label}墊管`, mountingHardware: true, solid: { kind: 'cyl', axis: 'y', c: { x: s.x, y: s.baseY + s.rearSpacer / 2, z: s.z }, r: 2, halfLen: s.rearSpacer / 2 } });
      }
    });
  }

  let sponge = null;
  const sp = p.brakeSponge;
  if (sp) {
    const m = p.rearStay.brakeMount ?? { xMin_mm: 62, xMax_mm: 73, halfZ_mm: 8, y_mm: ch.bumperBottomY_mm };
    if (sp.kind === 'rubber-pin') {
      sponge = rubberPinLayout(sp, m, (p.wheels.diameter_mm - ch.refWheelDiameter_mm) / 2);
    } else {
      sponge = spongePadLayout(sp, p.brakePlate ?? sp.brakePlate ?? { thickness_mm: 0, density_g_cm3: 0, margin_mm: 0 }, m);
    }
    solids.push({ group: 'sponge', slot: 'brakeSponge', label: sponge.label, solid: sponge.solid });
  }

  let ballast = null;
  const b = p.ballast;
  if (b) {
    const mounts = ch.ballastMounts ?? {};
    const mount = mounts[b.mount] ? b.mount : b.defaultMount;
    let m = mounts[mount];
    let y0;
    const endStay = mount === 'front' ? p.frontStay : mount === 'rear' ? p.rearStay : null;
    if (mount === 'center') {
      // 齒輪蓋頂面（推估：馬達頂面上方 3.5 mm，齒輪蓋質心在頂面上方 2 mm 處的板厚中央）
      y0 = comp.motor.y + comp.motor.flat / 2 + 3.5;
    } else if (endStay?.ballastMount) {
      // 導輪板自帶的配重座：鎖在板面上（例如後板尾端的舌片上方）
      m = endStay.ballastMount;
      y0 = endStay.ballastMount.y_mm;
    } else {
      const top = endStay.plate ? endStay.plate.y_mm : ch.bumperBottomY_mm;
      y0 = top - b.thickness_mm;
    }
    const solid = boxAt(m.x_mm, m.z_mm, y0, b.length_mm, b.width_mm, b.thickness_mm);
    ballast = { mass_g: b.mass_g, mount, onTop: mount === 'center' || !!endStay?.ballastMount, pos: { x: m.x_mm, y: y0 + b.thickness_mm / 2, z: m.z_mm }, solid, part: b };
    solids.push({ group: 'ballast', slot: 'ballast', label: '配重', solid });
  }

  /** @type {any[]} */
  const stabilizers = [];
  const st = p.stabilizer;
  if (st) {
    for (const r of rollers.filter((q) => q.id === 'FL' || q.id === 'FR')) {
      const y0 = r.y + r.h / 2 + st.spacer_mm;
      const c = { x: r.x, y: y0 + st.height_mm / 2, z: r.z };
      const label = `穩定零件 ${r.z < 0 ? '左' : '右'}`;
      /** @type {Solid} */
      const solid = { kind: 'cyl', axis: 'y', c, r: st.diameter_mm / 2, halfLen: st.height_mm / 2 };
      stabilizers.push({ label, mass_g: st.mass_g, pos: c, solid, r: st.diameter_mm / 2, h: st.height_mm, part: st });
      solids.push({ group: 'stabilizer', slot: 'stabilizer', label, solid });
    }
  }
  return { dampers, damperBrackets, sponge, ballast, stabilizers, solids };
}

/**
 * 煞車海綿＋煞車架（含 AR 斜面架）：海綿貼在煞車架下，煞車架鎖在導輪架煞車座下方。
 * 回傳的 contact（車體底盤座標，mm）給 sim.js 的煞車接觸：接觸點、總面積、可壓縮厚度；backing 是海綿壓到底後承受接觸的剛性部分
 * @type {(sp: any, bp: any, m: any) => any}
 */
function spongePadLayout(sp, bp, m) {
  const t = sp.thickness_mm;
  const tp = bp.thickness_mm;
  const margin = bp.margin_mm;
  // 貼片寬：煞車架有指定（大面積碳纖架、AR 海綿條）就用它，否則同煞車座
  let lz = 2 * m.halfZ_mm;
  if (bp.padHalfZ_mm !== null && bp.padHalfZ_mm !== undefined) {
    lz = 2 * bp.padHalfZ_mm;
  }
  if (!bp.padLengthX_mm) {
    const lx = m.xMax_mm - m.xMin_mm;
    const cx = -(m.xMin_mm + m.xMax_mm) / 2;
    const plateBox = boxAt(cx, 0, m.y_mm - tp, lx + 2 * margin, lz + 2 * margin, tp);
    const spongeBox = boxAt(cx, 0, m.y_mm - tp - t, lx, lz, t);
    // 干涉 / 離地用的實體：煞車板＋海綿合成一個方塊（外框取煞車板）
    const solid = boxAt(cx, 0, m.y_mm - tp - t, lx + 2 * margin, lz + 2 * margin, tp + t);
    const plateMass_g = ((lx + 2 * margin) * (lz + 2 * margin) * tp * bp.density_g_cm3) / 1000;
    // 接觸點：底面 4 角＋中心（外框取煞車板）
    const b = solid;
    const pts = [[b.min.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [(b.min.x + b.max.x) / 2, 0]].map(([x, z]) => ({ x, y: b.min.y, z }));
    return {
      label: '煞車海綿',
      mass_g: (lx * lz * t * sp.density_g_cm3) / 1000,
      pos: { x: cx, y: m.y_mm - tp - t / 2, z: 0 },
      plate: tp > 0 ? { mass_g: plateMass_g, pos: { x: cx, y: m.y_mm - tp / 2, z: 0 }, box: plateBox, material: bp.material } : null,
      extras: [],
      spongeBox,
      solid,
      part: sp,
      area_mm2: lx * lz,
      length_mm: lx,
      width_mm: lz,
      contact: { pts_mm: pts, area_mm2: lx * lz, thickness_mm: t },
      backing: tp > 0 ? [{ kind: 'box', min: plateBox.min, max: plateBox.max }] : [],
    };
  }
  // AR 煞車組（15458）：海綿條（沿車長 padLengthX_mm）貼在架的後端；架的前段底面做成往前上翹的斜面（スキッド）。
  // 斜面在煞車座面以下：前緣厚度 = 板厚 − 長度 × tanθ（> 0），不往上穿進保桿
  const lx = bp.padLengthX_mm;
  const xPadRear = m.xMax_mm;
  const xPadFront = m.xMax_mm - lx;
  const cxPad = -(xPadRear + xPadFront) / 2;
  const sk = bp.skid;
  const rise = sk.length_mm * Math.tan((sk.angle_deg * Math.PI) / 180);
  if (!(rise < tp)) {
    throw new Error(`${bp.id}: 斜面上翹 ${rise.toFixed(2)} mm 超過板厚`);
  }
  const zHalf = lz / 2 + margin;
  const yBottom = m.y_mm - tp;
  // 平板：|x| ∈ [海綿前緣 − 外擴, 海綿後緣 + 外擴]；斜板：再往前 skid.length_mm（底面座標 x 為負值 = 車尾）
  const flatFront = xPadFront - margin;
  const plateBox = { min: { x: -(xPadRear + margin), y: yBottom, z: -zHalf }, max: { x: -flatFront, y: m.y_mm, z: zHalf } };
  const skidFront = flatFront - sk.length_mm;
  /** @type {Vec3[]} 斜板的 8 個角點（凸包）：底面由 (−flatFront, yBottom) 斜上到 (−skidFront, yBottom + rise)，頂面貼煞車座 */
  const skidHull = [];
  for (const z of [-zHalf, zHalf]) {
    skidHull.push({ x: -flatFront, y: yBottom, z }, { x: -flatFront, y: m.y_mm, z }, { x: -skidFront, y: yBottom + rise, z }, { x: -skidFront, y: m.y_mm, z });
  }
  const spongeBox = boxAt(cxPad, 0, yBottom - t, lx, lz, t);
  const solid = { min: { x: -(xPadRear + margin), y: yBottom - t, z: -zHalf }, max: { x: -skidFront, y: m.y_mm, z: zHalf }, kind: 'box' };
  const flatVol = (xPadRear - flatFront + margin) * 2 * zHalf * tp;
  const skidVol = sk.length_mm * 2 * zHalf * (tp + (tp - rise)) / 2;
  const plateMass_g = ((flatVol + skidVol) * bp.density_g_cm3) / 1000;
  // 平板＋斜板的質心（x：體積加權；y：板厚中央，斜板略高，取體積加權的近似）
  const flatCx = -(xPadRear + margin + flatFront) / 2;
  const skidCx = -(flatFront + skidFront) / 2;
  const plateCx = (flatCx * flatVol + skidCx * skidVol) / (flatVol + skidVol);
  const plateCy = (((yBottom + m.y_mm) / 2) * flatVol + ((yBottom + rise / 2 + m.y_mm) / 2) * skidVol) / (flatVol + skidVol);
  const pts = [[-xPadRear, -lz / 2], [-xPadRear, lz / 2], [-xPadFront, -lz / 2], [-xPadFront, lz / 2], [cxPad, 0]].map(([x, z]) => ({ x, y: yBottom - t, z }));
  return {
    label: '煞車海綿',
    mass_g: (lx * lz * t * sp.density_g_cm3) / 1000,
    pos: { x: cxPad, y: yBottom - t / 2, z: 0 },
    plate: { mass_g: plateMass_g, pos: { x: plateCx, y: plateCy, z: 0 }, box: plateBox, skidHull, material: bp.material },
    extras: [],
    spongeBox,
    solid,
    part: sp,
    area_mm2: lx * lz,
    length_mm: lx,
    width_mm: lz,
    contact: { pts_mm: pts, area_mm2: lx * lz, thickness_mm: t },
    backing: [{ kind: 'box', min: plateBox.min, max: plateBox.max }, skidBacking(flatFront, skidFront, yBottom, rise, tp, zHalf)],
  };
}

/**
 * 斜板的碰撞體：底面貼著斜面、內接於斜板的旋轉方塊（厚度取斜板前緣的垂直厚度 × cosθ）。
 * 不用凸包：Rapier 0.21 凸多面體對刀口的接觸法向實測偏離斜面（scripts/diag/b8-hull.test.js），旋轉方塊的法向與解析值一致
 * @type {(flatFront: number, skidFront: number, yBottom: number, rise: number, tp: number, zHalf: number) => any}
 */
function skidBacking(flatFront, skidFront, yBottom, rise, tp, zHalf) {
  const len = flatFront - skidFront;
  const theta = Math.atan2(rise, len);
  const slope = Math.hypot(len, rise);
  const thick = (tp - rise) * Math.cos(theta);
  // 底面中點，往材料內側（−sinθ, cosθ）移半個厚度
  const mx = -(flatFront + skidFront) / 2;
  const my = yBottom + rise / 2;
  return {
    kind: 'obox',
    c: { x: mx - Math.sin(theta) * thick / 2, y: my + Math.cos(theta) * thick / 2, z: 0 },
    half: { x: slope / 2, y: thick / 2, z: zHalf },
    angleZ_rad: theta,
  };
}

/**
 * 橡膠煞車（15413）：後保桿煞車座下方向下的樹脂管座，橡膠柱從管座伸出 pinProtrusion_mm。
 * 大徑輪時（輪徑使底盤抬高 ≥ 鋁墊圈長度）在管座上方加鋁墊圈，端面離地與小徑輪相同（官方：鋁墊圈讓小徑、大徑輪都能用）。
 * 接觸：端面中心一點（面積 = 橡膠柱截面、可壓縮長度 = 伸出長度）；壓到底後由管座（剛性）承受
 * @type {(sp: any, m: any, lift: number) => any}
 */
function rubberPinLayout(sp, m, lift) {
  const collar = lift >= sp.collarLength_mm - 1e-9 ? sp.collarLength_mm : 0;
  const cx = -(m.xMin_mm + m.xMax_mm) / 2;
  const rPin = sp.pinDiameter_mm / 2;
  const rSock = sp.socketDiameter_mm / 2;
  const ySockTop = m.y_mm - collar;
  const ySockBot = ySockTop - sp.socketLength_mm;
  const yTip = ySockBot - sp.pinProtrusion_mm;
  const area = Math.PI * rPin * rPin;
  // 橡膠柱全長 = 伸出長度＋插在管座內的長度；管座 = 管壁（外徑 − 柱徑）；鋁墊圈內孔取 M2.6 螺絲孔 2.6 mm（推估）
  const rubberLen = sp.pinProtrusion_mm + sp.socketLength_mm;
  const rubberMass = (area * rubberLen * sp.rubberDensity_g_cm3) / 1000;
  const sockMass = (Math.PI * (rSock * rSock - rPin * rPin) * sp.socketLength_mm * sp.socketDensity_g_cm3) / 1000;
  const collarMass = (Math.PI * (rSock * rSock - 1.3 * 1.3) * collar * sp.collarDensity_g_cm3) / 1000;
  const extras = [{ label: '橡膠煞車管座', mass_g: sockMass, pos: { x: cx, y: (ySockTop + ySockBot) / 2, z: 0 } }];
  if (collar > 0) {
    extras.push({ label: '橡膠煞車鋁墊圈', mass_g: collarMass, pos: { x: cx, y: (m.y_mm + ySockTop) / 2, z: 0 } });
  }
  /** @type {Solid} 干涉 / 離地：管座外徑的圓柱（含橡膠柱與鋁墊圈，保守） */
  const solid = { kind: 'cyl', axis: 'y', c: { x: cx, y: (m.y_mm + yTip) / 2, z: 0 }, r: rSock, halfLen: (m.y_mm - yTip) / 2 };
  return {
    label: '橡膠煞車',
    mass_g: rubberMass,
    pos: { x: cx, y: (ySockTop + yTip) / 2 - sp.socketLength_mm / 2, z: 0 },
    plate: null,
    extras,
    solid,
    part: sp,
    pin: { x: cx, yTip, ySockBot, ySockTop, yTop: m.y_mm, rPin, rSock, collar },
    area_mm2: area,
    contact: { pts_mm: [{ x: cx, y: yTip, z: 0 }], area_mm2: area, thickness_mm: sp.pinProtrusion_mm },
    // 管座壓到底的剛性背板：與其他背板一致用方塊（外接管座圓柱）
    backing: [{ kind: 'box', min: { x: cx - rSock, y: ySockBot, z: -rSock }, max: { x: cx + rSock, y: ySockTop, z: rSock } }],
  };
}

/** @type {Map<string, number>} 車殼頂點 → 實體間隙的快取（key：車殼 id＋實體） */
const bodyGapCache = new Map();
/** @type {Map<string, number>} 實體兩兩間隙快取 */
const pairGapCache = new Map();

/** @type {(a: Solid, b: Solid) => number} */
const cachedGap = (a, b) => {
  const key = JSON.stringify([a, b]);
  let g = pairGapCache.get(key);
  if (g === undefined) {
    g = solidGap(a, b);
    pairGapCache.set(key, g);
  }
  return g;
};

/** 干涉代碼的群組順序 */
const GROUP_ORDER = ['ballast', 'damper', 'sponge', 'stabilizer', 'stay', 'roller', 'tire'];

/** 不檢查的組合：鎖在導輪板上的零件本來就和板面接觸（安裝關係，不是干涉） */
const MOUNTED_ON = new Set(['sponge|stay', 'ballast|stay', 'damper|stay']);

/**
 * 實體干涉檢查：零件兩兩之間、零件與車殼之間的最小間隙。間隙 < 1 mm 由規則檢查器判為違規
 * 群組：tire（輪胎）、roller（導輪）、stay（導輪板）、damper（制振器行程範圍）、sponge（煞車海綿）、ballast（配重）、stabilizer（穩定零件）
 * 車殼與輪胎 / 導輪沿用 bodies/index.js 的 bodyClearance（BODY_TIRE_CLEARANCE / BODY_ROLLER_CLEARANCE）
 * @type {(body: any, bodyProps: any, wheels: any[], rollers: any[], solids: PlacedSolid[]) => { code: string, a: string, b: string, gap_mm: number }[]}
 */
function interferenceChecks(body, bodyProps, wheels, rollers, solids, parts) {
  /** @type {PlacedSolid[]} */
  const all = [
    ...wheels.map((w) => ({ group: 'tire', slot: 'wheels', label: `輪胎 ${w.id}`, solid: /** @type {Solid} */ ({ kind: 'cyl', axis: 'z', c: { x: w.x, y: w.y, z: w.z }, r: w.r, halfLen: w.width / 2 }) })),
    ...rollers.map((r) => ({ group: 'roller', slot: r.slot, label: `導輪 ${r.id}`, solid: /** @type {Solid} */ ({ kind: 'cyl', axis: 'y', c: { x: r.x, y: r.y, z: r.z }, r: r.r, halfLen: r.h / 2 }) })),
    ...solids,
  ];
  for (const item of all) {
    const slot = item.group === 'roller' ? (item.slot === 'frontRollers' ? 'frontStay' : 'rearStay') : item.group === 'stabilizer' ? 'frontStay' : item.group === 'stay' ? item.slot : null;
    item.motion = slot && parts[slot]?.slide ? slot : null;
    item.swept = sweepZ(item.solid, item.motion ? parts[slot].slide.stroke_mm : 0);
  }
  /** @type {Map<string, { code: string, a: string, b: string, gap_mm: number }>} 每種代碼只留最小間隙那一組 */
  const worst = new Map();
  /** @type {(code: string, a: string, b: string, gap: number) => void} */
  const record = (code, a, b, gap) => {
    const cur = worst.get(code);
    if (!cur || gap < cur.gap_mm) {
      worst.set(code, { code, a, b, gap_mm: gap });
    }
  };
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const A = all[i];
      const B = all[j];
      // 輪胎彼此、同一組制振器之間不檢查；導輪板之間（前 / 後）距離很遠
      if (A.group === B.group && A.group !== 'roller') {
        continue;
      }
      if (MOUNTED_ON.has(`${A.group}|${B.group}`) || MOUNTED_ON.has(`${B.group}|${A.group}`)) {
        continue;
      }
      // 代碼依 GROUP_ORDER 排前後，例如 STAY_TIRE_CLEARANCE、ROLLER_TIRE_CLEARANCE、BALLAST_SPONGE_CLEARANCE
      const [P, Q] = GROUP_ORDER.indexOf(A.group) <= GROUP_ORDER.indexOf(B.group) ? [A, B] : [B, A];
      const code = `${P.group.toUpperCase()}_${Q.group.toUpperCase()}_CLEARANCE`;
      // Parts on one board translate together. Sweeping them independently
      // would invent a relative motion that the joint cannot produce.
      const sameMotion = P.motion && P.motion === Q.motion;
      record(code, P.label, Q.label, cachedGap(sameMotion ? P.solid : P.swept, sameMotion ? Q.solid : Q.swept));
    }
  }
  // 選配零件、導輪板與車殼（車殼頂點到零件實體的距離）；沒裝車殼時跳過
  for (const s of body ? all.filter((s) => !['tire', 'roller'].includes(s.group)) : []) {
    const key = JSON.stringify([body.id, s.swept]);
    let g = bodyGapCache.get(key);
    if (g === undefined) {
      g = verticesGap(bodyProps.vertices, s.swept);
      bodyGapCache.set(key, g);
    }
    record(`${s.group.toUpperCase()}_BODY_CLEARANCE`, s.label, `車殼 ${body.id}`, g);
  }
  // Moving side weights must clear real side structures, including the full
  // damper travel. Fasteners/adapter-to-chassis mounting contact is intentional.
  if (parts.massDamper?.mount === 'side') {
    for (const s of solids.filter((q) => q.group === 'damper' && !q.mountingHardware)) {
      for (const ch of chassisSideSolids(parts.chassis)) record('DAMPER_CHASSIS_CLEARANCE', s.label, ch.label, cachedGap(s.solid, ch.solid));
    }
  }
  return [...worst.values()];
}
