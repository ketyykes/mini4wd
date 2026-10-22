// 整車組裝：由組裝設定（configs/*.json）解析零件 → 擺放位置 → 推導質量、重心、外框、物理參數
// 整車的質量、重心、外框「只」由這裡從零件資料推導（SPEC 1.13），模型、物理、規則檢查都用同一份結果
import defaultConfig from '../configs/default.json';
import speedConfig from '../configs/speed.json';
import technicalConfig from '../configs/technical.json';
import lightConfig from '../configs/light.json';
import raceFrpConfig from '../configs/race-frp.json';
import carbonDamperConfig from '../configs/carbon-damper.json';
import p4TechConfig from '../configs/p4-tech.json';
import { spec as globalSpec, deriveParams } from './spec.js';
import { resolvePart, listParts } from './parts/index.js';
import { getBody, bodyMassProps, bodyClearance } from './bodies/index.js';
import { rollerLayout, wheelLayout, componentLayout } from './carLayout.js';
import { solidGap, solidBox, verticesGap } from './parts/clearance.js';
import { polygonCentroid } from './parts/plateGeom.js';
import { bumperTrim } from './parts/bumperGeom.js';
import { drivetrainInertia } from './parts/inertia.js';

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
  // iter-59：中間齒輪軸 / 中間齒輪軸承（含氟塗層軸、中間齒輪培林組）；舊設定沒有這個 slot 時用標準軸（SLOT_DEFAULTS）
  counterShaft: 'counter-shaft',
  // iter-56：前後導輪分開選（原本單一 rollers slot 前後共用；舊欄位由 normalizeConfig 相容）
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
  // iter-60：煞車架（FRP / 碳纖大面積），只在裝煞車海綿時有作用；舊設定沒有時用 FRP（SLOT_DEFAULTS）
  brakePlate: 'brake-plate',
  ballast: 'ballast',
  stabilizer: 'stabilizer',
};

/** 選配 slot：值可為 null（不裝）；組裝設定沒寫這個 slot 時也視為 null */
export const OPTIONAL_SLOTS = ['massDamper', 'brakeSponge', 'ballast', 'stabilizer'];

/**
 * 舊組裝設定欄位 → 新 slot（相容層）：iter-56 起導輪拆成 frontRollers / rearRollers，
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
const CONFIGS = { default: defaultConfig, speed: speedConfig, technical: technicalConfig, light: lightConfig, 'race-frp': raceFrpConfig, 'carbon-damper': carbonDamperConfig, 'p4-tech': p4TechConfig };

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
 * 把零件資料組成和第一階段 spec.json 相同結構的整車規格（底盤座標），讓建模 / 物理沿用同一套欄位
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
    // 第四階段：迴路電阻（開關＋端子零件）與傳動系轉動慣量（輪子、輪軸、齒輪、馬達電樞，換算到輪軸）
    circuit: { resistance_ohm: p.switch.circuitResistance_ohm ?? 0 },
    spin: drivetrainInertia(p),
    drivetrain: {
      gearRatio: g.ratio,
      gearEfficiency: g.efficiency,
      counterGearCount: 2,
      pinionPitchRadius_mm: g.pinionPitchRadius_mm,
      counterLargePitchRadius_mm: g.counterLargePitchRadius_mm,
      counterSmallPitchRadius_mm: g.counterSmallPitchRadius_mm,
      spurPitchRadius_mm: g.spurPitchRadius_mm,
    },
    bearings: {
      kind: p.bearings.kind,
      frictionCoeff: p.bearings.frictionCoeff,
      // iter-59：中間齒輪軸承的 μ 與輪軸軸承分開（中間齒輪軸 slot 決定，見 counterBearingFriction）
      counterFrictionCoeff: counterBearingFriction(p.bearings, p.counterShaft),
      shaftRadius_mm: globalSpec.bearingsGeometry.shaftRadius_mm,
      counterShaftRadius_mm: globalSpec.bearingsGeometry.counterShaftRadius_mm,
    },
    chassis: {
      wheelbase_mm: ch.wheelbase_mm,
      trackWidth_mm: ch.trackWidth_mm,
      refWheelDiameter_mm: ch.refWheelDiameter_mm,
      groundClearance_mm: ch.groundClearanceRef_mm,
      plateThickness_mm: ch.plateThickness_mm,
      // iter-56：前 / 後導輪各自的款式（直徑、高度、材質、疊層、錐形輪廓）；位置由 rollerLayoutOf() 依前後分別推導
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
  // 第四階段：錐形導輪的輪廓（上段圓柱＋下段截錐），3D 模型與 sim.js 接觸幾何用同一份
  taper: ro.taper ?? null,
  // 第五階段：導輪外環（橡膠 O 環 / 塑膠環），只給 3D 外形用
  ring: ro.ring ?? null,
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
  const front = rollerLayout(withRoller(fr)).filter(isFront).map((r) => ({ ...r, slot: 'frontRollers', partId: fr.id, finish: fr.finish, taper: fr.taper, ring: fr.ring }));
  const rear = rollerLayout(withRoller(rr)).filter((r) => !isFront(r)).map((r) => ({ ...r, slot: 'rearRollers', partId: rr.id, finish: rr.finish, taper: rr.taper, ring: rr.ring }));
  return [...front, ...rear];
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
  const body = config.body ? getBody(config.body) : null;
  const bodyProps = body ? bodyMassProps(body) : null;
  const s = buildSpec(p);
  const ch = p.chassis;

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

  /** @type {PlacedPart[]} */
  const parts = [];
  /** @type {(slot: string, label: string, mass_g: number, pos: Vec3) => void} */
  const place = (slot, label, mass_g, pos) => {
    // 質量 0 的零件（例如和底盤一體成型的前保桿）不列入
    if (mass_g <= 0) {
      return;
    }
    parts.push({ slot, id: p[slot]?.id ?? body?.id ?? slot, category: p[slot]?.category ?? 'body', label, mass_g, pos: lifted(pos, lift) });
  };

  // 保桿切除（iter-47）：裝 FRP / 碳纖導輪板（chassisTrim）的那一端，底盤保桿兩側導輪臂剪掉；
  // 切除質量 = 切除幾何（parts/bumperGeom.js，與 3D 模型同一份）× 底盤密度，從底盤本體的質量與重心扣除
  const chassisTrim = [];
  for (const [slot, sx] of [['frontStay', 1], ['rearStay', -1]]) {
    if (p[slot].chassisTrim) {
      const t = bumperTrim(ch, sx);
      chassisTrim.push({ slot, end: sx > 0 ? 'front' : 'rear', mass_g: t.mass_g, com_mm: t.com_mm, volume_mm3: t.volume_mm3 });
    }
  }
  let chMass = ch.mass_g;
  const chMom = { x: ch.mass_g * ch.com_mm.x, y: ch.mass_g * ch.com_mm.y, z: ch.mass_g * ch.com_mm.z };
  for (const t of chassisTrim) {
    chMass -= t.mass_g;
    chMom.x -= t.mass_g * t.com_mm.x;
    chMom.y -= t.mass_g * t.com_mm.y;
    chMom.z -= t.mass_g * t.com_mm.z;
  }
  place('chassis', chassisTrim.length > 0 ? '底盤本體（保桿切除後）' : '底盤本體', chMass, { x: chMom.x / chMass, y: chMom.y / chMass, z: chMom.z / chMass });
  place('motor', '雙軸馬達', p.motor.mass_g, { x: comp.motor.x, y: comp.motor.y, z: comp.motor.z });
  const cells = p.battery.cells;
  comp.battery.zs.slice(0, cells).forEach((z, i) => {
    place('battery', `電池 ${i + 1}`, p.battery.mass_g / cells, { x: comp.battery.x, y: comp.battery.y, z });
  });
  // 齒輪組：前後各一半；質心取中間齒輪與輪軸齒輪之間（推估）
  for (const sx of [1, -1]) {
    const label = sx > 0 ? '前' : '後';
    place('gear', `${label}齒輪組`, p.gear.mass_g / 2, { x: sx * (counterX + hw) / 2, y: (comp.motor.y + axleY) / 2, z: 0 });
  }
  for (const w of wheels) {
    place('wheels', `輪胎 ${w.id}`, p.wheels.mass_g, { x: w.x, y: w.y, z: w.z });
  }
  for (const sx of [1, -1]) {
    place('axles', sx > 0 ? '前輪軸' : '後輪軸', p.axles.mass_g, { x: sx * hw, y: axleY, z: 0 });
  }
  // 軸承 6 處：輪軸左右支撐 ×4（輪軸支撐座 z = ±23.4，同 model.js）、中間齒輪軸 ×2
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      place('bearings', `輪軸軸承 ${sx > 0 ? '前' : '後'}${sz > 0 ? '右' : '左'}`, p.bearings.mass_g, { x: sx * hw, y: axleY, z: sz * 23.4 });
    }
    // iter-59：中間齒輪軸 slot 自帶培林（中間齒輪培林組）時，中間齒輪軸承改由它提供（取代輪軸軸承 slot 的中間齒輪軸承）
    const cb = p.counterShaft.counterBearing;
    if (cb) {
      place('counterShaft', `中間齒輪培林 ${sx > 0 ? '前' : '後'}`, cb.mass_g, { x: sx * counterX, y: comp.motor.y, z: 0 });
    } else {
      place('bearings', `中間齒輪軸承 ${sx > 0 ? '前' : '後'}`, p.bearings.counterMass_g, { x: sx * counterX, y: comp.motor.y, z: 0 });
    }
  }
  for (const r of rollers) {
    place(r.slot, `導輪 ${r.id}`, p[r.slot].mass_g, { x: r.x, y: r.y, z: r.z });
  }
  // 導輪架質心：板件 = 俯視外形面積形心、板厚中央；塑膠標準件 = 導輪座與底盤端之間（推估：導輪軸往內 8 mm、導輪中心往下 3.5 mm）
  for (const [slot, sx] of [['frontStay', 1], ['rearStay', -1]]) {
    const st = p[slot];
    const label = sx > 0 ? '前導輪架' : '後導輪架';
    if (st.slide) {
      // 滑動保桿（iter-61）：滑動板（隨導輪左右滑動）、樹脂滑軌與小五金（固定在底盤）分開放，滑動部分另建剛體（見下方 slider）
      const [cx, cz] = polygonCentroid(st.plate.outline);
      const rail = st.slide.rail;
      const railPos = { x: (rail.xMin_mm + rail.xMax_mm) / 2, y: rail.y_mm + rail.thickness_mm / 2, z: 0 };
      place(slot, SLIDE_PLATE_LABEL, st.slide.plateMass_g, { x: cx, y: st.plate.y_mm + st.plate.thickness_mm / 2, z: cz });
      place(slot, '前滑動保桿滑軌', st.slide.railMass_g, railPos);
      place(slot, '前滑動保桿彈簧與螺絲', st.slide.hardware_g, railPos);
    } else if (st.plate) {
      const [cx, cz] = polygonCentroid(st.plate.outline);
      place(slot, label, st.mass_g, { x: cx, y: st.plate.y_mm + st.plate.thickness_mm / 2, z: cz });
    } else if (sx > 0) {
      place(slot, label, st.mass_g, { x: st.rollerX_mm - 8, y: st.rollerY_mm - 3.5, z: 0 });
    } else {
      const upper = st.upperRollerHeight_mm ?? st.lowerRollerHeight_mm;
      place(slot, label, st.mass_g, { x: -(st.rollerX_mm - 8), y: (st.lowerRollerHeight_mm + upper) / 2 - 3.5, z: 0 });
    }
  }
  place('batteryCover', '電池蓋', p.batteryCover.mass_g, { x: 0, y: ch.groundClearanceRef_mm + 0.5, z: 0 });
  place('switch', '開關＋端子', p.switch.mass_g, ch.switchPos_mm);
  // 齒輪蓋蓋住馬達與前後齒輪上方（質心推估：馬達頂面上方 2 mm）；小五金分散在底盤上，質心取底盤本體質心（推估）
  place('gearCover', '齒輪蓋', p.gearCover.mass_g, { x: 0, y: comp.motor.y + comp.motor.flat / 2 + 2, z: 0 });
  place('hardware', '小五金', p.hardware.mass_g, ch.com_mm);

  // ---- 選配零件（第三階段）：制振器、煞車海綿、配重。實體形狀（底盤座標）同時給干涉檢查、外框、離地高度、3D 模型 ----
  const opt = optionalLayout(p, comp, rollers);
  for (const d of opt.dampers) {
    place('massDamper', d.label, d.mass_g, d.pos);
  }
  // 第五階段：制振器托架（例如 MA 側制振器的 FRP 側板）鎖死在底盤上，質量計入剛體，不跟配重一起滑動
  for (const b of opt.damperBrackets) {
    place('massDamper', b.label, b.mass_g, b.pos);
  }
  if (opt.sponge) {
    if (opt.sponge.plate) {
      place('brakeSponge', '煞車板', opt.sponge.plate.mass_g, opt.sponge.plate.pos);
    }
    place('brakeSponge', '煞車海綿', opt.sponge.mass_g, opt.sponge.pos);
  }
  if (opt.ballast) {
    place('ballast', `配重（${opt.ballast.mount}）`, opt.ballast.mass_g, opt.ballast.pos);
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
  const damperLabels = new Set(opt.dampers.map((d) => d.label));
  const movableParts = p.massDamper && !p.massDamper.locked ? parts.filter((q) => q.slot === 'massDamper' && damperLabels.has(q.label)) : [];
  // 滑動保桿（iter-61）：滑動板＋裝在上面的前導輪（＋同一支螺絲上的穩定零件）是另一個剛體，不屬於車體剛體
  const slider = sliderOf(p.frontStay, parts, opt.stabilizers);
  const sliderParts = slider ? parts.filter((q) => slider.labels.includes(q.label)) : [];
  const detached = [...movableParts, ...sliderParts];
  const rigid = detached.length > 0 ? massProps(parts.filter((q) => !detached.includes(q)), ch, bodyProps) : total;
  const movable = movableParts.map((q) => {
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
  // 滑動保桿（推估規則，iter-61）：裝在滑動板上的零件（前導輪、滑動板、穩定零件）以行程端點（左右各 ±stroke）的外框計入，車寬檢查較保守
  const slideZ = slider ? slider.stroke_mm : 0;
  /** @type {number[]} 每個外框在 z 方向因滑動行程外擴的量（只有滑動板上的零件 > 0；迎風面積用不外擴的寬度） */
  const boxSlideDz = boxes.map(() => 0);
  for (const r of rollers) {
    const dz = slider && r.slot === 'frontRollers' ? slideZ : 0;
    boxes.push({ min: { x: r.x - r.r, y: r.y - r.h / 2 + lift, z: r.z - r.r - dz }, max: { x: r.x + r.r, y: r.y + r.h / 2 + lift, z: r.z + r.r + dz } });
    boxSlideDz.push(dz);
  }
  // 導輪板、選配零件（制振器取整個行程的範圍）
  /** @type {{ min: Vec3, max: Vec3 }[]} */
  const extraBoxes = opt.solids.filter((q) => q.group !== 'tire' && q.group !== 'roller').map((q) => {
    const b = solidBox(q.solid);
    const onSlider = slider && ((q.group === 'stay' && q.slot === 'frontStay') || q.group === 'stabilizer');
    const dz = onSlider ? slideZ : 0;
    boxSlideDz.push(dz);
    return { min: lifted({ ...b.min, z: b.min.z - dz }, lift), max: lifted({ ...b.max, z: b.max.z + dz }, lift) };
  });
  boxes.push(...extraBoxes);
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  let staticMinZ = Infinity;
  let staticMaxZ = -Infinity;
  boxes.forEach((b, i) => {
    for (const k of ['x', 'y', 'z']) {
      min[k] = Math.min(min[k], b.min[k]);
      max[k] = Math.max(max[k], b.max[k]);
    }
    staticMinZ = Math.min(staticMinZ, b.min.z + boxSlideDz[i]);
    staticMaxZ = Math.max(staticMaxZ, b.max.z - boxSlideDz[i]);
  });
  const bbox_mm = { min, max, size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z } };
  // 迎風面積（SPEC 1.11）：外框寬 × 高 × 填充比例；寬度取滑動板在行程中央（實際行駛）時的值（沒有滑動保桿時就是外框寬）
  const frontalArea_mm2 = (staticMaxZ - staticMinZ) * bbox_mm.size.y * globalSpec.aero.frontalAreaFill;
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
      rollers,
    );
  }
  const interference = interferenceChecks(body, bodyProps, wheels.map((w) => ({ ...w, r: R, width: p.wheels.width_mm })), rollers, opt.solids);

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
    optional: { dampers: opt.dampers, sponge: opt.sponge, ballast: opt.ballast, stabilizers: opt.stabilizers },
    rigid: { mass_g: rigid.mass_g, com_mm: rigid.com_mm, inertia_kgm2: rigid.inertia_kgm2 },
    movable,
    // 滑動保桿的滑動部分（iter-61）；沒有滑動保桿時為 null
    slider,
    lift_mm: lift,
    gearRatio: p.gear.ratio,
    driveType: ch.driveType,
    spec: s,
    inertia_kgm2,
    P: deriveParams({ ...s, frontalArea_mm2 }, mass_g),
    layout: {
      wheels: wheels.map((w) => ({ ...lifted(w, lift), id: w.id, r: R, width: p.wheels.width_mm })),
      rollers: rollers.map((r) => ({ ...r, y: r.y + lift })),
    },
    chassisMounts: ch.bodyMounts.map((m) => ({ ...lifted(m, lift), id: m.id })),
    // 底盤本體外框（車體座標）：沒裝車殼時物理碰撞方塊用這個
    chassisBox_mm: chassisBox,
    // 沒裝車殼時為 null
    body: body
      ? {
          id: body.id,
          def: body,
          mounts: body.mounts.map((m) => ({ ...lifted(m, lift), id: m.id })),
          mass_g: bodyProps.mass_g,
          bbox_mm: bodyBox,
        }
      : null,
  };
}

/** 滑動保桿的滑動板在零件清單（asm.parts）中的標籤 */
const SLIDE_PLATE_LABEL = '前滑動板';

/**
 * 滑動保桿的滑動部分（iter-61）：滑動板＋前導輪（FL / FR）＋前導輪上方的穩定零件（同一支螺絲），質量、質心（車體座標）、對自身質心的慣性。
 * 慣性：各零件以質點計（平行軸定理），滑動板另加自身外框方塊的慣性。前導輪架不是滑動保桿時回傳 null
 * @type {(st: Record<string, any>, parts: PlacedPart[], stabilizers: any[]) => import('./parts/types').PlacedSlider | null}
 */
function sliderOf(st, parts, stabilizers) {
  if (!st.slide) {
    return null;
  }
  const stabLabels = new Set(stabilizers.map((s) => s.label));
  const own = parts.filter((q) => q.label === SLIDE_PLATE_LABEL || q.slot === 'frontRollers' || (q.slot === 'stabilizer' && stabLabels.has(q.label)));
  let mass_g = 0;
  const mom = { x: 0, y: 0, z: 0 };
  for (const q of own) {
    mass_g += q.mass_g;
    mom.x += q.mass_g * q.pos.x;
    mom.y += q.mass_g * q.pos.y;
    mom.z += q.mass_g * q.pos.z;
  }
  const com_mm = { x: mom.x / mass_g, y: mom.y / mass_g, z: mom.z / mass_g };
  const inertia = { x: 0, y: 0, z: 0 };
  for (const q of own) {
    const dx = q.pos.x - com_mm.x;
    const dy = q.pos.y - com_mm.y;
    const dz = q.pos.z - com_mm.z;
    inertia.x += q.mass_g * (dy * dy + dz * dz);
    inertia.y += q.mass_g * (dx * dx + dz * dz);
    inertia.z += q.mass_g * (dx * dx + dy * dy);
  }
  // 滑動板自身（外框方塊）的慣性
  const xs = st.plate.outline.map((/** @type {number[]} */ v) => v[0]);
  const zs = st.plate.outline.map((/** @type {number[]} */ v) => v[1]);
  const lx = Math.max(...xs) - Math.min(...xs);
  const lz = Math.max(...zs) - Math.min(...zs);
  const ly = st.plate.thickness_mm;
  const mp = st.slide.plateMass_g;
  inertia.x += (mp / 12) * (ly * ly + lz * lz);
  inertia.y += (mp / 12) * (lx * lx + lz * lz);
  inertia.z += (mp / 12) * (lx * lx + ly * ly);
  const sl = st.slide;
  return {
    slot: 'frontStay',
    partId: st.id,
    labels: own.map((q) => q.label),
    mass_g,
    com_mm,
    inertia_kgm2: { x: inertia.x * 1e-9, y: inertia.y * 1e-9, z: inertia.z * 1e-9 },
    stroke_mm: sl.stroke_mm,
    springK_N_per_mm: sl.springK_N_per_mm,
    preload_N: sl.preload_N,
    dampingRatio: sl.dampingRatio,
    seatDeflection_mm: sl.seatDeflection_mm,
  };
}

/**
 * 質量、重心、慣性矩（主軸近似，忽略慣性積）：各零件以質點計（平行軸定理），
 * 底盤本體與車殼另加自身外框的均質方塊慣性（推估：兩者是分佈最廣的零件）
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
  /** @type {(m: number, b: { min: Vec3, max: Vec3 }) => Vec3} 均質方塊對自身中心的慣性（g·mm²） */
  const boxInertia = (m, b) => {
    const lx = b.max.x - b.min.x;
    const ly = b.max.y - b.min.y;
    const lz = b.max.z - b.min.z;
    return { x: (m / 12) * (ly * ly + lz * lz), y: (m / 12) * (lx * lx + lz * lz), z: (m / 12) * (lx * lx + ly * ly) };
  };
  const inertia = { x: 0, y: 0, z: 0 };
  for (const q of parts) {
    const dx = q.pos.x - com_mm.x;
    const dy = q.pos.y - com_mm.y;
    const dz = q.pos.z - com_mm.z;
    inertia.x += q.mass_g * (dy * dy + dz * dz);
    inertia.y += q.mass_g * (dx * dx + dz * dz);
    inertia.z += q.mass_g * (dx * dx + dy * dy);
  }
  /** @type {[number, { min: Vec3, max: Vec3 }][]} 底盤本體與車殼（沒裝車殼時只有底盤） */
  // 底盤本體的質量取零件清單裡的值（保桿切除後的質量）
  const chPart = parts.find((q) => q.slot === 'chassis');
  const spread = [[chPart ? chPart.mass_g : ch.mass_g, ch.bbox_mm]];
  if (bodyProps) {
    spread.push([bodyProps.mass_g, bodyProps.bbox_mm]);
  }
  for (const [m, b] of spread) {
    const bi = boxInertia(m, b);
    inertia.x += bi.x;
    inertia.y += bi.y;
    inertia.z += bi.z;
  }
  // g·mm² → kg·m²
  return { mass_g, com_mm, inertia_kgm2: { x: inertia.x * 1e-9, y: inertia.y * 1e-9, z: inertia.z * 1e-9 } };
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
 * 穩定零件（第四階段）：前導輪（FL / FR）正上方，底面 = 導輪頂面 + spacer_mm，與導輪同軸（同一支螺絲）
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
  /** @type {{ label: string, mass_g: number, pos: Vec3 }[]} 制振器托架（固定在底盤，第五階段） */
  const damperBrackets = [];
  const d = p.massDamper;
  if (d) {
    /** @type {{ x: number, y: number, z: number }[]} 制振器底面中心（下止點） */
    let seats = [];
    if (d.mount === 'side') {
      const m = ch.sideDamperMount ?? { x_mm: 0, z_mm: 33, y_mm: 2 };
      seats = [{ x: m.x_mm, y: m.y_mm, z: -m.z_mm }, { x: m.x_mm, y: m.y_mm, z: m.z_mm }].slice(0, d.count);
    } else {
      const m = p.rearStay.damperMount ?? { x_mm: -79, z_mm: 0, y_mm: ch.bumperBottomY_mm };
      seats = [{ x: m.x_mm, y: m.y_mm, z: m.z_mm }];
    }
    seats.forEach((s, i) => {
      const h = d.height_mm;
      const swept = d.shape === 'box'
        ? boxAt(s.x, s.z, s.y, d.length_mm, d.width_mm, h + d.stroke_mm)
        : { kind: 'cyl', axis: 'y', c: { x: s.x, y: s.y + (h + d.stroke_mm) / 2, z: s.z }, r: d.diameter_mm / 2, halfLen: (h + d.stroke_mm) / 2 };
      const label = seats.length > 1 ? `制振器 ${s.z < 0 ? '左' : '右'}` : '制振器';
      dampers.push({ label, mass_g: d.mass_g, pos: { x: s.x, y: s.y + h / 2, z: s.z }, seat: s, part: d, swept, index: i });
      solids.push({ group: 'damper', slot: 'massDamper', label, solid: /** @type {Solid} */ (swept) });
      // 托架（零件資料 bracket：固定在底盤側面的板，與配重同一個 x 範圍、貼在配重內側；只計質量，干涉沿用配重的行程範圍）
      if (d.bracket) {
        const b = d.bracket;
        const side = Math.sign(s.z) || 1;
        damperBrackets.push({ label: `${label}托架`, mass_g: b.mass_g, pos: { x: s.x, y: s.y + h / 2, z: s.z - side * (d.width_mm / 2 + b.thickness_mm / 2) } });
      }
    });
  }

  let sponge = null;
  const sp = p.brakeSponge;
  if (sp) {
    const m = p.rearStay.brakeMount ?? { xMin_mm: 62, xMax_mm: 73, halfZ_mm: 8, y_mm: ch.bumperBottomY_mm };
    // 煞車板（iter-50）：海綿貼在煞車板下，煞車板鎖在導輪架煞車座下方。iter-60 起由 brakePlate slot 決定（舊資料：海綿零件自帶的 brakePlate；都沒有時厚度 0）
    const bp = p.brakePlate ?? sp.brakePlate ?? { thickness_mm: 0, density_g_cm3: 0, margin_mm: 0 };
    const lx = m.xMax_mm - m.xMin_mm;
    // 貼片寬：煞車架有指定（大面積碳纖架）就用它，否則同煞車座
    let lz = 2 * m.halfZ_mm;
    if (bp.padHalfZ_mm !== null && bp.padHalfZ_mm !== undefined) {
      lz = 2 * bp.padHalfZ_mm;
    }
    const t = sp.thickness_mm;
    const cx = -(m.xMin_mm + m.xMax_mm) / 2;
    const tp = bp.thickness_mm;
    const plateBox = boxAt(cx, 0, m.y_mm - tp, lx + 2 * bp.margin_mm, lz + 2 * bp.margin_mm, tp);
    const spongeBox = boxAt(cx, 0, m.y_mm - tp - t, lx, lz, t);
    // 干涉 / 離地用的實體：煞車板＋海綿合成一個方塊（外框取煞車板）
    const solid = boxAt(cx, 0, m.y_mm - tp - t, lx + 2 * bp.margin_mm, lz + 2 * bp.margin_mm, tp + t);
    const spongeMass = (lx * lz * t * sp.density_g_cm3) / 1000;
    const plateMass_g = ((lx + 2 * bp.margin_mm) * (lz + 2 * bp.margin_mm) * tp * bp.density_g_cm3) / 1000;
    sponge = {
      mass_g: spongeMass,
      pos: { x: cx, y: m.y_mm - tp - t / 2, z: 0 },
      plate: tp > 0 ? { mass_g: plateMass_g, pos: { x: cx, y: m.y_mm - tp / 2, z: 0 }, box: plateBox, material: bp.material } : null,
      spongeBox,
      solid,
      part: sp,
      area_mm2: lx * lz,
      length_mm: lx,
      width_mm: lz,
    };
    solids.push({ group: 'sponge', slot: 'brakeSponge', label: '煞車海綿', solid });
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
      // 導輪板自帶的配重座（iter-50）：鎖在板面上（例如後板尾端的舌片上方）
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
 * 實體干涉檢查（第三階段）：零件兩兩之間、零件與車殼之間的最小間隙。間隙 < 1 mm 由規則檢查器判為違規
 * 群組：tire（輪胎）、roller（導輪）、stay（導輪板）、damper（制振器行程範圍）、sponge（煞車海綿）、ballast（配重）、stabilizer（穩定零件，第四階段）
 * 車殼與輪胎 / 導輪沿用 bodies/index.js 的 bodyClearance（BODY_TIRE_CLEARANCE / BODY_ROLLER_CLEARANCE）
 * @type {(body: any, bodyProps: any, wheels: any[], rollers: any[], solids: PlacedSolid[]) => { code: string, a: string, b: string, gap_mm: number }[]}
 */
function interferenceChecks(body, bodyProps, wheels, rollers, solids) {
  /** @type {PlacedSolid[]} */
  const all = [
    ...wheels.map((w) => ({ group: 'tire', slot: 'wheels', label: `輪胎 ${w.id}`, solid: /** @type {Solid} */ ({ kind: 'cyl', axis: 'z', c: { x: w.x, y: w.y, z: w.z }, r: w.r, halfLen: w.width / 2 }) })),
    ...rollers.map((r) => ({ group: 'roller', slot: r.slot, label: `導輪 ${r.id}`, solid: /** @type {Solid} */ ({ kind: 'cyl', axis: 'y', c: { x: r.x, y: r.y, z: r.z }, r: r.r, halfLen: r.h / 2 }) })),
    ...solids,
  ];
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
      record(code, P.label, Q.label, cachedGap(P.solid, Q.solid));
    }
  }
  // 選配零件、導輪板與車殼（車殼頂點到零件實體的距離）；沒裝車殼時跳過
  for (const s of body ? solids : []) {
    const key = JSON.stringify([body.id, s.solid]);
    let g = bodyGapCache.get(key);
    if (g === undefined) {
      g = verticesGap(bodyProps.vertices, s.solid);
      bodyGapCache.set(key, g);
    }
    record(`${s.group.toUpperCase()}_BODY_CLEARANCE`, s.label, `車殼 ${body.id}`, g);
  }
  return [...worst.values()];
}
