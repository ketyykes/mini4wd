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

// ---- 前寬滑動保桿（第五階段 iter-61，TW10 / [T15469]）：2 mm 鋁滑動板（裝前導輪）＋樹脂滑軌（鎖在前保桿下方）＋左右對頂的彈簧 ----
// 滑動板只能相對底盤左右（車身 z）滑動 ±2.5 mm；牆對前導輪的力先經過彈簧再傳到車身（sim.js sliderSpringImpulse / sliderContactImpulses）
const RHO_ALU = 2.7;
const RHO_POM = 1.41;
const SLIDE_PLATE_T = 2.0;
const SLIDE_RAIL_T = 1.2;
/** 滑動板外形：橫跨車頭的 12 mm 深長條，兩端包住導輪孔（左右對稱，推估） */
const SLIDE_OUTLINE = symmetricOutline(
  [[80, 0], [80, -40], [79, -44.5], [76.5, -47.2], [73, -47.6], [69.8, -45.8], [68, -41], [68, 0]],
  1,
);
/** @type {{ x: number, z: number, r: number }[]} 滑動板的孔：導輪螺絲孔 φ2.2 ＋ 一排 φ3.5 減重孔（間距 6 mm，推估：實車鋁板有成排減重孔） */
const SLIDE_HOLES = [
  { x: 74, z: -42.5, r: 1.1 },
  { x: 74, z: 42.5, r: 1.1 },
];
SLIDE_HOLES.push(...holeRow(SLIDE_OUTLINE, [74, 3], [74, 36], 6, 1.75, SLIDE_HOLES));
/** @type {import('./types').SlideSpec['rail']} 樹脂滑軌（固定在前保桿中央橋接板下方，滑動板在它下面左右滑動；底盤座標，推估尺寸） */
const SLIDE_RAIL = { xMin_mm: 60, xMax_mm: 72, halfZ_mm: 15, y_mm: BUMPER_BOTTOM_Y - SLIDE_RAIL_T, thickness_mm: SLIDE_RAIL_T, density_g_cm3: RHO_POM };
const SLIDE_RAIL_MASS = ((SLIDE_RAIL.xMax_mm - SLIDE_RAIL.xMin_mm) * 2 * SLIDE_RAIL.halfZ_mm * SLIDE_RAIL_T * RHO_POM) / 1000;
/** 彈簧、螺絲、擋片等小五金（固定在底盤側，推估） */
const SLIDE_HARDWARE_G = 1.9;
const SLIDE_PLATE_MASS = plateMass(SLIDE_OUTLINE, holeArea(SLIDE_HOLES), SLIDE_PLATE_T, RHO_ALU);

/**
 * 前滑動保桿零件（金＝軟彈簧、銀＝硬彈簧，同一份幾何）
 * @type {(o: { id: string, name: string, springK_N_per_mm: number, preload_N: number, springColor: number, springSrc: string }) => import('./types').PartBase}
 */
const slideFrontPart = ({ id, name, springK_N_per_mm, preload_N, springColor, springSrc }) => ({
  id,
  category: 'stay-front',
  name,
  material: 'aluminum',
  rollerX_mm: 74,
  rollerZ_mm: 42.5,
  rollerY_mm: 10,
  // 滑動板（鋁）：外形同時給質量、干涉檢查（行程中央位置）、3D 模型
  plate: { outline: SLIDE_OUTLINE, holes: SLIDE_HOLES, y_mm: SLIDE_RAIL.y_mm - SLIDE_PLATE_T, thickness_mm: SLIDE_PLATE_T, density_g_cm3: RHO_ALU },
  /** @type {import('./types').SlideSpec} */
  slide: {
    stroke_mm: 2.5,
    springK_N_per_mm,
    preload_N,
    dampingRatio: 0.3,
    seatDeflection_mm: 0.05,
    plateMass_g: SLIDE_PLATE_MASS,
    rail: SLIDE_RAIL,
    railMass_g: SLIDE_RAIL_MASS,
    hardware_g: SLIDE_HARDWARE_G,
    spring: { x_mm: 70.5, innerZ_mm: SLIDE_RAIL.halfZ_mm, outerZ_mm: 23, coilDiameter_mm: 2.6, wireDiameter_mm: 0.45, turns: 7, color: springColor },
  },
  mass_g: SLIDE_PLATE_MASS + SLIDE_RAIL_MASS + SLIDE_HARDWARE_G,
  /** 裝滑動保桿時前保桿兩側的導輪臂剪掉（同 FRP 板；導輪改由滑動板撐） */
  chassisTrim: { kind: 'bumper-wings', src: '推估：實車裝滑動保桿時常把原廠保桿的導輪臂剪掉（導輪改由滑動板撐）；切除範圍同 FRP 前寬板' },
  features: [],
  src: {
    structure: 'PARTS_RESEARCH 第五階段 W / AB 節 [T15469] 官方：2 mm 鋁板＋低摩擦樹脂滑軌，鎖在 MA 前保桿；「フェンスにぶつかった時のショックをスムーズに吸収」',
    rollerZ_mm: '推估：導輪孔位同 stay-front-frp（±42.5 mm）；滑動板在行程端點時 13 mm 導輪外緣跨距 2 ×（42.5 + 2.5 + 6.5）= 103 mm，17 / 19 mm 導輪會超過 105 mm（WIDTH）',
    stroke_mm: '推估（W 節）：左右各 ±2.5 mm，端點為硬止擋',
    springK_N_per_mm: springSrc,
    dampingRatio: '推估（W 節）：官方以滑動阻尼油脂調整，取阻尼比 0.3（以彈簧常數與滑動質量換算阻尼係數 c = 2ζ√(k·m)）',
    seatDeflection_mm: '推估：預壓由中央擋塊承受；擋塊（樹脂）接觸變形取 0.05 mm（擋塊剛性 = 預壓 / 0.05 mm），彈簧力在 0–0.05 mm 內由 0 連續升到預壓（位能函數連續、不產生能量）',
    plate: '推估：鋁板約 90 × 12 × 2 mm（W 節「約 90 × 15 × 2 mm」），兩端包住導輪孔；φ3.5 減重孔一排；密度 2.7 g/cm³',
    rail: '推估：樹脂（POM 1.41 g/cm³）滑軌 12 × 30 × 1.2 mm，鎖在前保桿中央橋接板下方',
    hardware_g: '推估（W 節「樹脂件與彈簧螺絲約 2.5 g」− 滑軌 0.6 g）：彈簧 2 支、螺絲、擋片約 1.9 g',
    mass_g: '由滑動板外形 × 厚度 × 密度＋滑軌＋小五金推導，合計約 7.8 g（W 節推估約 8 g）',
    taiwan: 'TAIWAN_SOURCES TW10（四驅博士學校／露天，15469）',
  },
});

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
  slideFrontPart({
    id: 'stay-front-slide-soft',
    name: '前寬滑動保桿・軟彈簧（鋁板＋樹脂滑軌，金色彈簧）',
    springK_N_per_mm: 0.5,
    preload_N: 0.5,
    springColor: 0xd9b24a,
    springSrc: '推估（W 節）：軟（金）k ≈ 0.5 N/mm、預壓 0.5 N——滿行程力 0.5 + 0.5 × 2.5 ≈ 1.8 N，遠小於轉彎側向力約 6.5 N（「碰牆就滑」）',
  }),
  slideFrontPart({
    id: 'stay-front-slide-hard',
    name: '前寬滑動保桿・硬彈簧（鋁板＋樹脂滑軌，銀色彈簧）',
    springK_N_per_mm: 2,
    preload_N: 2,
    springColor: 0xc8ccd2,
    springSrc: '推估（W 節）：硬（銀）k ≈ 2 N/mm、預壓 2 N——滿行程力約 7 N，與轉彎側向力同量級（「只有很用力才滑、出彎立刻回彈」）',
  }),
];
