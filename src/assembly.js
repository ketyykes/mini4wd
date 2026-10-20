// 整車組裝：由組裝設定（configs/*.json）解析零件 → 擺放位置 → 推導質量、重心、外框、物理參數
// 整車的質量、重心、外框「只」由這裡從零件資料推導（SPEC 1.13），模型、物理、規則檢查都用同一份結果
import defaultConfig from '../configs/default.json';
import speedConfig from '../configs/speed.json';
import technicalConfig from '../configs/technical.json';
import lightConfig from '../configs/light.json';
import { spec as globalSpec, deriveParams } from './spec.js';
import { resolvePart } from './parts/index.js';
import { getBody, bodyMassProps, bodyClearance } from './bodies/index.js';
import { rollerLayout, wheelLayout, componentLayout } from './carLayout.js';

/** @typedef {import('./parts/types').PlacedPart} PlacedPart */
/** @typedef {import('./parts/types').Vec3} Vec3 */

/** 組裝設定的 slot → 零件類別 */
export const SLOTS = {
  chassis: 'chassis',
  motor: 'motor',
  gear: 'gear',
  wheels: 'wheel',
  bearings: 'bearing',
  rollers: 'roller',
  frontStay: 'stay-front',
  rearStay: 'stay-rear',
  battery: 'battery',
  batteryCover: 'battery-cover',
  switch: 'switch',
  axles: 'axle',
  gearCover: 'gear-cover',
  hardware: 'hardware',
};

/** @type {Record<string, any>} */
const CONFIGS = { default: defaultConfig, speed: speedConfig, technical: technicalConfig, light: lightConfig };

/** @type {() => string[]} 所有組裝設定名稱 */
export const listConfigs = () => Object.keys(CONFIGS);

/** @type {(name?: string) => Record<string, any>} 讀取組裝設定（回傳副本，可自由修改） */
export function loadConfig(name = 'default') {
  const c = CONFIGS[name];
  if (!c) {
    throw new Error(`未知的組裝設定：${name}`);
  }
  const { _readme, ...rest } = c;
  return structuredClone(rest);
}

/**
 * 把零件資料組成和第一階段 spec.json 相同結構的整車規格（底盤座標），讓建模 / 物理沿用同一套欄位
 * @type {(p: Record<string, any>) => any}
 */
function buildSpec(p) {
  const ch = p.chassis;
  const ro = p.rollers;
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
      shaftRadius_mm: globalSpec.bearingsGeometry.shaftRadius_mm,
      counterShaftRadius_mm: globalSpec.bearingsGeometry.counterShaftRadius_mm,
    },
    chassis: {
      wheelbase_mm: ch.wheelbase_mm,
      trackWidth_mm: ch.trackWidth_mm,
      refWheelDiameter_mm: ch.refWheelDiameter_mm,
      groundClearance_mm: ch.groundClearanceRef_mm,
      plateThickness_mm: ch.plateThickness_mm,
      rollerDiameter_mm: ro.diameter_mm,
      rollerHeight_mm: ro.height_mm,
      rollerFinish: ro.finish,
      rollerCenterHeight_mm: fs.rollerY_mm,
      frontRollerX_mm: fs.rollerX_mm,
      frontRollerZ_mm: fs.rollerZ_mm,
      rearRollerX_mm: rs.rollerX_mm,
      rearRollerZ_mm: rs.rollerZ_mm,
      rearLowerRollerHeight_mm: rs.lowerRollerHeight_mm,
      rearUpperRollerHeight_mm: rs.upperRollerHeight_mm,
    },
  };
}

/** @type {(v: Vec3, dy: number) => Vec3} */
const lifted = (v, dy) => ({ x: v.x, y: v.y + dy, z: v.z });

/**
 * 組裝整車
 * @type {(config: Record<string, any>) => any}
 */
export function assemble(config) {
  /** @type {Record<string, any>} */
  const p = {};
  for (const [slot, category] of Object.entries(SLOTS)) {
    if (config[slot] === undefined) {
      throw new Error(`組裝設定缺少 slot：${slot}`);
    }
    p[slot] = resolvePart(config[slot], category);
  }
  const body = getBody(config.body);
  const bodyProps = bodyMassProps(body);
  const s = buildSpec(p);
  const ch = p.chassis;

  // 換輪徑時整個底盤（含導輪、車殼）跟著升降
  const lift = (p.wheels.diameter_mm - ch.refWheelDiameter_mm) / 2;

  // ---- 零件擺放（底盤座標，最後統一加 lift）----
  const comp = componentLayout(s);
  const wheels = wheelLayout(s);
  const rollers = rollerLayout(s);
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
    parts.push({ slot, id: p[slot]?.id ?? body.id, category: p[slot]?.category ?? 'body', label, mass_g, pos: lifted(pos, lift) });
  };

  place('chassis', '底盤本體', ch.mass_g, ch.com_mm);
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
    place('bearings', `中間齒輪軸承 ${sx > 0 ? '前' : '後'}`, p.bearings.counterMass_g, { x: sx * counterX, y: comp.motor.y, z: 0 });
  }
  for (const r of rollers) {
    place('rollers', `導輪 ${r.id}`, p.rollers.mass_g, { x: r.x, y: r.y, z: r.z });
  }
  // 導輪架質心：導輪座與底盤端之間（推估：導輪軸往內 8 mm、導輪中心往下 3.5 mm）
  place('frontStay', '前導輪架', p.frontStay.mass_g, { x: p.frontStay.rollerX_mm - 8, y: p.frontStay.rollerY_mm - 3.5, z: 0 });
  place('rearStay', '後導輪架', p.rearStay.mass_g, {
    x: -(p.rearStay.rollerX_mm - 8),
    y: (p.rearStay.lowerRollerHeight_mm + p.rearStay.upperRollerHeight_mm) / 2 - 3.5,
    z: 0,
  });
  place('batteryCover', '電池蓋', p.batteryCover.mass_g, { x: 0, y: ch.groundClearanceRef_mm + 0.5, z: 0 });
  place('switch', '開關＋端子', p.switch.mass_g, ch.switchPos_mm);
  // 齒輪蓋蓋住馬達與前後齒輪上方（質心推估：馬達頂面上方 2 mm）；小五金分散在底盤上，質心取底盤本體質心（推估）
  place('gearCover', '齒輪蓋', p.gearCover.mass_g, { x: 0, y: comp.motor.y + comp.motor.flat / 2 + 2, z: 0 });
  place('hardware', '小五金', p.hardware.mass_g, ch.com_mm);
  parts.push({ slot: 'body', id: body.id, category: 'body', label: `車殼 ${body.id}`, mass_g: bodyProps.mass_g, pos: lifted(bodyProps.com_mm, lift) });

  // ---- 質量、重心 ----
  let mass_g = 0;
  const mom = { x: 0, y: 0, z: 0 };
  for (const q of parts) {
    mass_g += q.mass_g;
    mom.x += q.mass_g * q.pos.x;
    mom.y += q.mass_g * q.pos.y;
    mom.z += q.mass_g * q.pos.z;
  }
  const com_mm = { x: mom.x / mass_g, y: mom.y / mass_g, z: mom.z / mass_g };

  // ---- 慣性矩（主軸近似，忽略慣性積）：各零件以質點計（平行軸定理），
  // 底盤本體與車殼另加自身外框的均質方塊慣性（推估：兩者是分佈最廣的零件）----
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
  for (const [m, b] of [[ch.mass_g, ch.bbox_mm], [bodyProps.mass_g, bodyProps.bbox_mm]]) {
    const bi = boxInertia(m, b);
    inertia.x += bi.x;
    inertia.y += bi.y;
    inertia.z += bi.z;
  }
  // g·mm² → kg·m²
  const inertia_kgm2 = { x: inertia.x * 1e-9, y: inertia.y * 1e-9, z: inertia.z * 1e-9 };

  // ---- 外框（車體座標）：底盤本體、輪胎、導輪、車殼的聯集 ----
  const R = p.wheels.diameter_mm / 2;
  const halfTire = p.wheels.width_mm / 2;
  /** @type {{ min: Vec3, max: Vec3 }[]} */
  const boxes = [
    { min: lifted(ch.bbox_mm.min, lift), max: lifted(ch.bbox_mm.max, lift) },
    { min: lifted(bodyProps.bbox_mm.min, lift), max: lifted(bodyProps.bbox_mm.max, lift) },
  ];
  for (const w of wheels) {
    boxes.push({ min: { x: w.x - R, y: 0, z: w.z - halfTire }, max: { x: w.x + R, y: 2 * R, z: w.z + halfTire } });
  }
  for (const r of rollers) {
    boxes.push({ min: { x: r.x - r.r, y: r.y - r.h / 2 + lift, z: r.z - r.r }, max: { x: r.x + r.r, y: r.y + r.h / 2 + lift, z: r.z + r.r } });
  }
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of boxes) {
    for (const k of ['x', 'y', 'z']) {
      min[k] = Math.min(min[k], b.min[k]);
      max[k] = Math.max(max[k], b.max[k]);
    }
  }
  const bbox_mm = { min, max, size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z } };
  // 迎風面積（SPEC 1.11）：外框寬 × 高 × 填充比例
  const frontalArea_mm2 = bbox_mm.size.z * bbox_mm.size.y * globalSpec.aero.frontalAreaFill;
  // 離地高度：輪胎以外的最低點（底盤本體、車殼、導輪）
  const groundClearance_mm = Math.min(...boxes.filter((_, i) => i < 2).map((b) => b.min.y), ...rollers.map((r) => r.y - r.h / 2 + lift));

  // 車殼與輪胎、導輪的間隙（底盤座標：輪軸相對底盤固定，換大徑輪時輪胎往外長）
  const fit = bodyClearance(
    body,
    wheels.map((w) => ({ x: w.x, y: w.y, z: w.z, r: R, width: p.wheels.width_mm })),
    rollers,
  );

  return {
    config: structuredClone(config),
    partsBySlot: p,
    parts,
    mass_g,
    com_mm,
    bbox_mm,
    groundClearance_mm,
    frontalArea_mm2,
    fit,
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
    body: {
      id: body.id,
      def: body,
      mounts: body.mounts.map((m) => ({ ...lifted(m, lift), id: m.id })),
      mass_g: bodyProps.mass_g,
      bbox_mm: { min: lifted(bodyProps.bbox_mm.min, lift), max: lifted(bodyProps.bbox_mm.max, lift) },
    },
  };
}
