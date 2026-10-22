// 車輛零件配置（單位 mm，底盤座標：x 向前、y 向上、z 向右，原點在前後軸中點的地面上，搭配參考輪徑）
// 車體座標 = 底盤座標 + (0, lift, 0)，lift = (輪徑 − 參考輪徑) / 2，由 assembly.js 換算
// Three.js 模型與 Rapier 碰撞體都由這裡取得位置，確保兩者一致
// s 為 assembly.js 組出的整車規格（asm.spec）

/** 導輪架資料的導輪高度是以 5 mm 高的單層導輪為準；較高的導輪（例如雙層導輪）座面不變、往上長 */
const ROLLER_REF_HEIGHT_MM = 5;

/**
 * 導輪配置：前 2 顆＋後每側 1–2 層（後導輪架 upperRollerHeight_mm 為 null 時只有下層）
 * tiers：疊放的接觸片（相對導輪中心的 y、直徑、高度），單層導輪為 1 片
 * @type {(s: any) => { id: string, x: number, y: number, z: number, r: number, h: number, tiers: { y: number, r: number, h: number, wallFriction?: number, restitution?: number, ring?: any }[] }[]}
 */
export function rollerLayout(s) {
  const c = s.chassis;
  const r = c.rollerDiameter_mm / 2;
  const h = c.rollerHeight_mm;
  const dy = (h - ROLLER_REF_HEIGHT_MM) / 2;
  const tiers = (c.rollerTiers ?? [{ diameter_mm: c.rollerDiameter_mm, height_mm: h, y_mm: 0 }]).map((t) => ({ y: t.y_mm, r: t.diameter_mm / 2, h: t.height_mm, wallFriction: t.wallFriction, restitution: t.restitution, ring: t.ring }));
  const fx = c.frontRollerX_mm;
  const fz = c.frontRollerZ_mm;
  const rx = c.rearRollerX_mm;
  const rz = c.rearRollerZ_mm;
  const list = [
    { id: 'FL', x: fx, y: c.rollerCenterHeight_mm + dy, z: -fz, r, h, tiers },
    { id: 'FR', x: fx, y: c.rollerCenterHeight_mm + dy, z: fz, r, h, tiers },
    { id: 'RL', x: -rx, y: c.rearLowerRollerHeight_mm + dy, z: -rz, r, h, tiers },
    { id: 'RR', x: -rx, y: c.rearLowerRollerHeight_mm + dy, z: rz, r, h, tiers },
  ];
  if (c.rearUpperRollerHeight_mm !== null && c.rearUpperRollerHeight_mm !== undefined) {
    list.push(
      { id: 'RUL', x: -rx, y: c.rearUpperRollerHeight_mm + dy, z: -rz, r, h, tiers },
      { id: 'RUR', x: -rx, y: c.rearUpperRollerHeight_mm + dy, z: rz, r, h, tiers },
    );
  }
  return list;
}

/** @type {(s: any) => { id: string, x: number, y: number, z: number }[]} 輪子配置（底盤座標：輪軸高度 = 參考輪半徑） */
export function wheelLayout(s) {
  const c = s.chassis;
  const y = c.refWheelDiameter_mm / 2;
  const hx = c.wheelbase_mm / 2;
  const hz = c.trackWidth_mm / 2;
  return [
    { id: 'FL', x: hx, y, z: -hz },
    { id: 'FR', x: hx, y, z: hz },
    { id: 'RL', x: -hx, y, z: -hz },
    { id: 'RR', x: -hx, y, z: hz },
  ];
}

/** @type {(s: any) => any} 主要零件位置（雙軸馬達置中、兩側電池） */
export function componentLayout(s) {
  const c = s.chassis;
  const m = s.motor.body_mm;
  const floor = c.groundClearance_mm + c.plateThickness_mm;
  const cellR = s.battery.cellDiameter_mm / 2;
  return {
    floorY: floor,
    motor: { x: 0, y: floor + m.flat / 2 + 0.5, z: 0, length: m.length, dia: m.diameter, flat: m.flat },
    battery: { x: 0, y: floor + cellR, zs: [-(m.diameter / 2 + cellR + 2), m.diameter / 2 + cellR + 2], length: s.battery.cellLength_mm, dia: s.battery.cellDiameter_mm },
    rollerX: c.frontRollerX_mm,
  };
}
