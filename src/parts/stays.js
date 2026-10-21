// 導輪架（前 / 後）：決定導輪安裝位置（底盤座標，mm）
// rollerX_mm 為導輪軸到前後軸中點的距離（正值，後導輪架放在 −x）；rollerZ_mm 為導輪軸到車中線的距離
// 第三階段：FRP / 碳纖板導輪架。板件外形（plate.outline）同時用於質量、干涉檢查、3D 模型（plateGeom.js）
// 相容性：features 列出這個導輪架提供的安裝點（例如煞車海綿座、後制振器座），選配零件的 compat.requires 要對得上
import { symmetricOutline, holeRow, plateMass } from './plateGeom.js';

/** 密度（g/cm³）：SPEC 1.14 / PARTS_RESEARCH 3.1；碳纖見 PARTS_RESEARCH 第三階段 E 節 */
const RHO_FRP = 1.85;
const RHO_CARBON = 1.6;

/** 保桿下緣高度（底盤座標）：前後保桿頂面 = 導輪中心 10 − 4.6 + 2.4，下緣 = 10 − 4.6（與 model.js 保桿一致） */
const BUMPER_BOTTOM_Y = 5.4;

/** @type {(holes: { r: number }[]) => number} 圓孔總面積 */
const holeArea = (holes) => holes.reduce((a, h) => a + Math.PI * h.r * h.r, 0);

/** 小孔：φ2.0（實車導輪板的成排小孔，可鎖 M2 螺絲調整導輪 / 配件位置），間距 4 mm（推估：依 ref_chevalier-ma_gradeup、ref_aero-avante-ar 照片目視） */
const SMALL_HOLE_R = 1.0;
const HOLE_PITCH = 4;

/**
 * 板件的孔：導輪螺絲孔、鎖保桿的 2 個螺絲孔，再加上沿 rows 線段排列的成排小孔（左右對稱）
 * @type {(sx: number, outline: [number, number][], rollerX: number, rollerZ: number, mountX: number, rows: [[number, number], [number, number]][]) => { x: number, z: number, r: number }[]}
 */
const plateHoles = (sx, outline, rollerX, rollerZ, mountX, rows) => {
  /** @type {{ x: number, z: number, r: number }[]} */
  const holes = [
    // 導輪螺絲孔 φ2.2（M2）
    { x: sx * rollerX, z: -rollerZ, r: 1.1 },
    { x: sx * rollerX, z: rollerZ, r: 1.1 },
    // 鎖保桿的螺絲孔
    { x: sx * mountX, z: -6, r: 1.1 },
    { x: sx * mountX, z: 6, r: 1.1 },
  ];
  for (const [a, b] of rows) {
    holes.push(...holeRow(outline, [sx * a[0], a[1]], [sx * b[0], b[1]], HOLE_PITCH, SMALL_HOLE_R, holes));
  }
  return holes;
};

// ---- 前導輪板：橫跨車頭的窄長條（深約 10 mm）＋往後鎖在保桿下方的中央舌片（ref_aero-avante-ar 的 FRP 前寬板）----
const FRONT_FRP_OUTLINE = symmetricOutline(
  [[79, 0], [79, -36], [78.2, -44.5], [75.5, -47.6], [72, -47.8], [69.4, -45.5], [69, -40], [69, -14], [52, -14], [52, 0]],
  1,
);
const FRONT_FRP_HOLES = plateHoles(1, FRONT_FRP_OUTLINE, 74, 42.5, 56, [
  [[74, 2], [74, 38]],
  [[60, 9.5], [66, 9.5]],
]);
const FRONT_FRP_T = 1.5;
const FRONT_CARBON_OUTLINE = symmetricOutline(
  [[79, 0], [79, -38], [77.6, -45.2], [74.5, -47.8], [71, -47.4], [69, -44], [69, -14.5], [52, -14.5], [52, 0]],
  1,
);
const FRONT_CARBON_HOLES = plateHoles(1, FRONT_CARBON_OUTLINE, 74, 42.5, 56, [
  [[74, 2], [74, 38]],
  [[60, 10], [66, 10]],
]);
const FRONT_CARBON_T = 1.5;

// ---- 後導輪板：中央舌片（鎖在後保桿下方，尾端延伸成制振器座）＋兩支斜臂伸到導輪座 ----
// FRP 後板：根部較寬（±21）、斜臂靠近後輪 → 換 31 mm 大徑輪時臂會碰到輪胎（STAY_TIRE_CLEARANCE）
const REAR_FRP_OUTLINE = symmetricOutline(
  [[82.5, 0], [82.5, -5.5], [79, -8], [66, -11], [75.6, -37.5], [76.2, -42.5], [74.5, -46.8], [71, -48], [67.6, -46.4], [50, -21], [50, 0]],
  -1,
);
const REAR_FRP_HOLES = plateHoles(-1, REAR_FRP_OUTLINE, 71.5, 42.5, 54, [
  [[59, 18], [70, 37]],
  [[60, 0], [80, 0]],
]);
const REAR_FRP_T = 1.5;
// 碳纖寬後板：導輪更外側（±44.5，配 19 mm 導輪會超過 105 mm 寬，WIDTH）、單層導輪座（可裝雙層導輪）
const REAR_CARBON_OUTLINE = symmetricOutline(
  [[82.5, 0], [82.5, -5.5], [79, -8], [67, -10], [76.5, -39.5], [77, -44.5], [75, -49], [71.5, -50.3], [68, -48.6], [53, -15], [53, 0]],
  -1,
);
const REAR_CARBON_HOLES = plateHoles(-1, REAR_CARBON_OUTLINE, 72, 44.5, 57, [
  [[63, 20], [71.5, 39]],
  [[61, 0], [80, 0]],
]);
const REAR_CARBON_T = 1.5;

/** @type {import('./types').PartBase[]} */
export const stayParts = [
  {
    id: 'stay-front-standard',
    category: 'stay-front',
    name: '前保桿導輪架（底盤附屬，左右各 1 顆導輪）',
    material: 'abs',
    rollerX_mm: 71.5,
    rollerZ_mm: 42,
    rollerY_mm: 10,
    /** 前保桿與底盤一體成型，質量已含在 chassis-midship（0 g 的零件不放進零件清單） */
    mass_g: 0,
    features: [],
    src: {
      rollerX_mm: '推估：導輪外緣前後總長 156 mm（SPEC 1.2）− 導輪半徑 6.5',
      rollerZ_mm: '推估：導輪外緣跨距 97 mm（SPEC 1.8）− 導輪半徑 6.5',
      rollerY_mm: 'SPEC 1.8：與牆接觸高度離地約 8–15 mm（推估）',
      mass_g: 'PARTS_RESEARCH：MA 類前保桿與底盤一體成型（0 g，含在底盤 24.4 g）',
      clearance: '與底盤一體，干涉檢查只看導輪（底盤本身依 22–35 mm 輪胎設計）',
    },
  },
  {
    id: 'stay-front-frp',
    category: 'stay-front',
    name: 'FRP 前寬導輪板（鎖在前保桿下方）',
    material: 'frp',
    rollerX_mm: 74,
    rollerZ_mm: 42.5,
    rollerY_mm: 10,
    plate: { outline: FRONT_FRP_OUTLINE, holes: FRONT_FRP_HOLES, y_mm: BUMPER_BOTTOM_Y - FRONT_FRP_T, thickness_mm: FRONT_FRP_T, density_g_cm3: RHO_FRP },
    mass_g: plateMass(FRONT_FRP_OUTLINE, holeArea(FRONT_FRP_HOLES), FRONT_FRP_T, RHO_FRP),
    /** 裝這塊板時把底盤保桿這一端的兩側導輪臂剪掉（質量由 parts/bumperGeom.js 的切除幾何 × 底盤密度推導，assemble() 從底盤扣除） */
    chassisTrim: { kind: 'bumper-wings', src: '推估：實車裝 FRP / 碳纖導輪板時常把原廠保桿的導輪臂剪掉；切除範圍＝寬保桿板在中央橋接板以外的部分＋導輪座凸台＋三角斜撐＋補強片（與 3D 模型同一份幾何）' },
    features: [],
    src: {
      rollerZ_mm: '推估：19 mm 導輪時外緣跨距 2 ×（42.5 + 9.5）= 104 mm，剛好在規則 < 105 mm 內（寬板設計目的）',
      rollerX_mm: '推估：比保桿導輪座前移 2.5 mm',
      thickness_mm: 'PARTS_RESEARCH 第三階段 E 節 [T15524]、[T15518] 官方：FRP 板 1.5 mm',
      density_g_cm3: 'SPEC 1.14 / PARTS_RESEARCH 3.1：FRP（G-10/FR-4）1.85 g/cm³',
      mass_g: '由外形面積扣開孔 × 厚度 × 密度推導（plateGeom.js），對照 [MYF1] 碳纖前寬板實測 3.19 g × 密度比',
    },
  },
  {
    id: 'stay-front-carbon',
    category: 'stay-front',
    name: '碳纖前寬導輪板（鎖在前保桿下方）',
    material: 'carbon',
    rollerX_mm: 74,
    rollerZ_mm: 42.5,
    rollerY_mm: 10,
    plate: { outline: FRONT_CARBON_OUTLINE, holes: FRONT_CARBON_HOLES, y_mm: BUMPER_BOTTOM_Y - FRONT_CARBON_T, thickness_mm: FRONT_CARBON_T, density_g_cm3: RHO_CARBON },
    mass_g: plateMass(FRONT_CARBON_OUTLINE, holeArea(FRONT_CARBON_HOLES), FRONT_CARBON_T, RHO_CARBON),
    /** 裝這塊板時把底盤保桿這一端的兩側導輪臂剪掉（質量由 parts/bumperGeom.js 的切除幾何 × 底盤密度推導，assemble() 從底盤扣除） */
    chassisTrim: { kind: 'bumper-wings', src: '推估：實車裝 FRP / 碳纖導輪板時常把原廠保桿的導輪臂剪掉；切除範圍＝寬保桿板在中央橋接板以外的部分＋導輪座凸台＋三角斜撐＋補強片（與 3D 模型同一份幾何）' },
    features: [],
    src: {
      rollerZ_mm: '同 stay-front-frp（推估）',
      thickness_mm: 'PARTS_RESEARCH [MYF1] 玩家實測：碳纖前寬導輪架厚 1.51–1.52 mm',
      density_g_cm3: 'PARTS_RESEARCH 第三階段 E 節 [RSCF]、[EMCF] 廠商規格：碳纖積層板 1.6 g/cm³',
      mass_g: '由外形面積扣開孔 × 厚度 × 密度推導；[MYF1] 實測同類碳纖前寬導輪架 3.19 g',
    },
  },
  {
    id: 'stay-rear-standard',
    category: 'stay-rear',
    name: '後保桿＋上層導輪架（左右各上下 2 顆導輪）',
    material: 'abs',
    rollerX_mm: 71.5,
    rollerZ_mm: 42,
    lowerRollerHeight_mm: 10,
    upperRollerHeight_mm: 18,
    mass_g: 2.0,
    features: ['rear-brake-mount'],
    /** 煞車海綿座：後保桿橋接板下緣（底盤座標；x 範圍為 |x|） */
    brakeMount: { xMin_mm: 62, xMax_mm: 73, halfZ_mm: 8, y_mm: BUMPER_BOTTOM_Y },
    src: {
      rollerX_mm: '同 stay-front-standard',
      rollerZ_mm: '同 stay-front-standard',
      lowerRollerHeight_mm: 'SPEC 1.8（推估）',
      upperRollerHeight_mm: 'SPEC 1.8：後保桿上下 2 顆疊放（推估高度）',
      mass_g: 'PARTS_RESEARCH 推估：碳纖後導輪架 2.46 g（[MYF2] 玩家實測）換算成 ABS 2 mm 厚 ≈ 2.1 g，取 2.0 g',
      brakeMount: '推估：後保桿中央橋接板下緣（model.js 保桿下緣 y = 5.4 mm）',
    },
  },
  {
    id: 'stay-rear-frp',
    category: 'stay-rear',
    name: 'FRP 後導輪板（鎖在後保桿下方，上下兩層導輪用長螺絲＋墊管疊放）',
    material: 'frp',
    rollerX_mm: 71.5,
    rollerZ_mm: 42.5,
    lowerRollerHeight_mm: 10,
    upperRollerHeight_mm: 18,
    plate: { outline: REAR_FRP_OUTLINE, holes: REAR_FRP_HOLES, y_mm: BUMPER_BOTTOM_Y - REAR_FRP_T, thickness_mm: REAR_FRP_T, density_g_cm3: RHO_FRP },
    mass_g: plateMass(REAR_FRP_OUTLINE, holeArea(REAR_FRP_HOLES), REAR_FRP_T, RHO_FRP),
    /** 裝這塊板時把底盤保桿這一端的兩側導輪臂剪掉（質量由 parts/bumperGeom.js 的切除幾何 × 底盤密度推導，assemble() 從底盤扣除） */
    chassisTrim: { kind: 'bumper-wings', src: '推估：實車裝 FRP / 碳纖導輪板時常把原廠保桿的導輪臂剪掉；切除範圍＝寬保桿板在中央橋接板以外的部分＋導輪座凸台＋三角斜撐＋補強片（與 3D 模型同一份幾何）' },
    features: ['rear-brake-mount', 'rear-damper-mount'],
    brakeMount: { xMin_mm: 70, xMax_mm: 83, halfZ_mm: 7, y_mm: BUMPER_BOTTOM_Y - REAR_FRP_T },
    damperMount: { x_mm: -79, z_mm: 0, y_mm: BUMPER_BOTTOM_Y },
    /** 後配重座：板尾舌片上方（配重 @rear 時鎖在板面上，iter-50；推估位置，與後制振器座同一處，兩者擇一） */
    ballastMount: { x_mm: -78, z_mm: 0, y_mm: BUMPER_BOTTOM_Y },
    src: {
      rollerZ_mm: '推估：19 mm 導輪時外緣跨距 104 mm（< 105）',
      thickness_mm: 'PARTS_RESEARCH 第三階段 E 節 [T15524]、[T15518] 官方：FRP 板 1.5 mm',
      density_g_cm3: 'SPEC 1.14：FRP 1.85 g/cm³',
      mass_g: '由外形面積扣開孔 × 厚度 × 密度推導；對照 [MYF2] 碳纖後導輪架實測 2.46 g × 密度比',
      outline: '推估（原創外形，參考 ref_chevalier-ma_gradeup 後板的「中央舌片＋斜臂」結構）：根部較寬（±21 mm），臂靠近後輪；31 mm 大徑輪會碰到臂（規則檢查 STAY_TIRE_CLEARANCE）',
      holes: '推估：φ2 mm 成排小孔、間距 4 mm（照片目視），質量扣除孔面積',
      damperMount: '推估：板尾延伸的制振器座（車尾中央）；制振器螺絲用皿頭螺絲由板底鎖上、與板底齊平（不凸出，所以板尾下方仍可貼煞車海綿）',
      brakeMount: '推估：煞車座在板尾下方（實車常見位置，海綿後緣略超出板尾，從車尾看得到），x 70–83 mm、寬 14 mm',
    },
  },
  {
    id: 'stay-rear-carbon-wide',
    category: 'stay-rear',
    name: '碳纖寬後導輪板（單層導輪座，可裝雙層導輪）',
    material: 'carbon',
    rollerX_mm: 72,
    rollerZ_mm: 44.5,
    lowerRollerHeight_mm: 12,
    upperRollerHeight_mm: null,
    plate: { outline: REAR_CARBON_OUTLINE, holes: REAR_CARBON_HOLES, y_mm: BUMPER_BOTTOM_Y - REAR_CARBON_T, thickness_mm: REAR_CARBON_T, density_g_cm3: RHO_CARBON },
    mass_g: plateMass(REAR_CARBON_OUTLINE, holeArea(REAR_CARBON_HOLES), REAR_CARBON_T, RHO_CARBON),
    /** 裝這塊板時把底盤保桿這一端的兩側導輪臂剪掉（質量由 parts/bumperGeom.js 的切除幾何 × 底盤密度推導，assemble() 從底盤扣除） */
    chassisTrim: { kind: 'bumper-wings', src: '推估：實車裝 FRP / 碳纖導輪板時常把原廠保桿的導輪臂剪掉；切除範圍＝寬保桿板在中央橋接板以外的部分＋導輪座凸台＋三角斜撐＋補強片（與 3D 模型同一份幾何）' },
    features: ['rear-brake-mount', 'rear-damper-mount'],
    brakeMount: { xMin_mm: 70, xMax_mm: 83, halfZ_mm: 7, y_mm: BUMPER_BOTTOM_Y - REAR_CARBON_T },
    damperMount: { x_mm: -79, z_mm: 0, y_mm: BUMPER_BOTTOM_Y },
    /** 後配重座：板尾舌片上方（配重 @rear 時鎖在板面上，iter-50；推估位置，與後制振器座同一處，兩者擇一） */
    ballastMount: { x_mm: -78, z_mm: 0, y_mm: BUMPER_BOTTOM_Y },
    src: {
      rollerZ_mm: '推估：寬板；13 mm 導輪外緣跨距 102 mm，19 mm 導輪 108 mm 超過規則（由 WIDTH 擋下）',
      lowerRollerHeight_mm: '推估：單層導輪座，導輪中心離地 12 mm（墊高讓雙層導輪的下層離地）',
      thickness_mm: 'PARTS_RESEARCH [MYF1] 玩家實測：碳纖多用途寬後架厚 1.57 mm，取 1.5',
      density_g_cm3: 'PARTS_RESEARCH 第三階段 E 節 [RSCF]、[EMCF]：碳纖 1.6 g/cm³',
      mass_g: '由外形面積扣開孔 × 厚度 × 密度推導；[MYF1] 實測碳纖多用途寬後架 3.31 g',
    },
  },
];
