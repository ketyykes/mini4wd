// 車輛零件配置（單位 mm，車體座標：x 向前、y 向上、z 向右，原點在前後軸中點的地面上）
// Three.js 模型與 Rapier 碰撞體都由這裡取得位置，確保兩者一致
// 參考：Chevalier（MA 底盤）— 雙軸馬達置中、前 2 顆＋後上下疊放 2×2 顆導輪（SPEC 1.2 / 1.8）
import { spec } from './spec.js';

/** 導輪 x 位置：使導輪外緣前後總長 = 全長 156 mm */
function rollerX() {
  const c = spec.chassis;
  return c.overallLength_mm / 2 - c.rollerDiameter_mm / 2;
}

/** 導輪配置：前 2 顆＋後 2×2 顆（上下疊放） */
export function rollerLayout() {
  const c = spec.chassis;
  const r = c.rollerDiameter_mm / 2;
  // 導輪外緣跨距 = 全寬 97 mm（SPEC 1.8）
  const zc = c.overallWidth_mm / 2 - r;
  const x = rollerX();
  const h = c.rollerHeight_mm;
  return [
    { id: 'FL', x, y: c.rollerCenterHeight_mm, z: -zc, r, h },
    { id: 'FR', x, y: c.rollerCenterHeight_mm, z: zc, r, h },
    { id: 'RL', x: -x, y: c.rollerCenterHeight_mm, z: -zc, r, h },
    { id: 'RR', x: -x, y: c.rollerCenterHeight_mm, z: zc, r, h },
    { id: 'RUL', x: -x, y: c.rearUpperRollerHeight_mm, z: -zc, r, h },
    { id: 'RUR', x: -x, y: c.rearUpperRollerHeight_mm, z: zc, r, h },
  ];
}

/** 輪子配置 */
export function wheelLayout() {
  const c = spec.chassis;
  const r = spec.tire.diameter_mm / 2;
  const hx = c.wheelbase_mm / 2;
  const hz = c.trackWidth_mm / 2;
  return [
    { id: 'FL', x: hx, y: r, z: -hz },
    { id: 'FR', x: hx, y: r, z: hz },
    { id: 'RL', x: -hx, y: r, z: -hz },
    { id: 'RR', x: -hx, y: r, z: hz },
  ];
}

/** 物理用車體碰撞方塊（底盤＋車殼合併，mm）；寬度取車殼寬，不含導輪 */
export function bodyColliderBox() {
  const c = spec.chassis;
  const b = spec.body;
  const bottom = c.groundClearance_mm;
  const top = b.height_mm - 2;
  return {
    hx: b.length_mm / 2,
    hy: (top - bottom) / 2,
    hz: b.width_mm / 2,
    cy: (top + bottom) / 2,
  };
}

/** 主要零件位置（雙軸馬達置中、兩側電池、前後齒輪箱） */
export function componentLayout() {
  const c = spec.chassis;
  const m = spec.motor.body_mm;
  const floor = c.groundClearance_mm + c.plateThickness_mm;
  const cellR = spec.battery.cellDiameter_mm / 2;
  return {
    floorY: floor,
    motor: { x: 0, y: floor + m.flat / 2 + 0.5, z: 0, length: m.length, dia: m.diameter, flat: m.flat },
    battery: { x: 0, y: floor + cellR, zs: [-(m.diameter / 2 + cellR + 2), m.diameter / 2 + cellR + 2], length: spec.battery.cellLength_mm, dia: spec.battery.cellDiameter_mm },
    rollerX: rollerX(),
  };
}
