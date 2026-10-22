// 第三階段選配零件：制振器（mass damper）、煞車海綿（brake sponge）、配重（ballast）
// 這些 slot 可以填 null（不裝）。相容性：compat.requires 列出需要的安裝點（由底盤 / 導輪架的 features 提供）
// 數值來源見 shared/reference/PARTS_RESEARCH.md「第三階段（iter-46）新零件查證」F、G、H 節

/** @type {import('./types').PartBase[]} */
export const massDamperParts = [
  {
    id: 'damper-rear-cylinder',
    category: 'mass-damper',
    name: '後制振器（黃銅圓柱 4.7 g，套在長螺絲上可上下滑動）',
    material: 'brass',
    mount: 'rear',
    count: 1,
    shape: 'cylinder',
    diameter_mm: 10,
    height_mm: 7.5,
    stroke_mm: 3,
    /** 單顆質量 */
    mass_g: 4.7,
    /** 下止點座墊（墊片＋螺帽）在自重下的靜態壓縮量，座墊剛性 k = m·g / δ */
    seatDeflection_mm: 0.3,
    /** 座墊阻尼比（相對於制振器自身質量） */
    seatDampingRatio: 0.5,
    /** 沿螺絲軸滑動的黏滯摩擦（N·s/m） */
    slideFriction_Nspm: 0.02,
    compat: { requires: ['rear-damper-mount'] },
    src: {
      mass_g: 'PARTS_RESEARCH 第三階段 F 節 [T15392] 官方「ウエイトは1個4.7g」',
      dims: 'PARTS_RESEARCH 第三階段 F 節：推估外徑約 10 × 高約 7.5 mm（由 4.7 g ÷ 黃銅 8.5 g/cm³ 反算體積吻合）',
      stroke_mm: 'PARTS_RESEARCH 第三階段 F 節：推估 3 mm（範圍 2–5 mm，官方只說可用螺帽＋墊片調整）',
      seatDeflection_mm: '推估：與輪胎接地同樣取 0.3 mm 等級的接觸變形（config sim.suspensionStaticDeflection_mm）',
      seatDampingRatio: '推估：墊片接觸的能量損失（PARTS_RESEARCH F 節：端點碰撞恢復係數推估 0.1–0.3，相當於阻尼比約 0.4–0.6）',
      slideFriction_Nspm: '推估：螺絲軸與黃銅孔之間的滑動摩擦（很小）',
      mount: '裝在 FRP / 碳纖後導輪板尾端的制振器座（stay-rear-frp / stay-rear-carbon-wide）；塑膠標準後導輪架沒有 → MOUNT_COMPAT',
    },
  },
  {
    id: 'damper-side-square',
    category: 'mass-damper',
    name: '側制振器（黃銅方塊 6×6×14 mm，左右各 1 顆，可上下滑動）',
    material: 'brass',
    mount: 'side',
    count: 2,
    shape: 'box',
    length_mm: 14,
    width_mm: 6,
    height_mm: 6,
    stroke_mm: 2,
    mass_g: 3.6,
    seatDeflection_mm: 0.3,
    seatDampingRatio: 0.5,
    slideFriction_Nspm: 0.02,
    compat: { requires: ['side-damper-mount'] },
    src: {
      mass_g: 'PARTS_RESEARCH 第三階段 F 節 [T15472] 官方「真ちゅう製、1本約3.6g」',
      dims: 'PARTS_RESEARCH 第三階段 F 節 [T15472] 官方 6×6×14 mm',
      stroke_mm: '推估：2 mm（側面托架空間較小）',
      mount: '底盤兩側托架（chassis-midship.sideDamperMount，推估位置）',
    },
  },
  // ---- 第五階段（iter-58）：台灣買得到的 MA 側制振器組（台灣來源見 shared/reference/TAIWAN_SOURCES.md）----
  {
    id: 'damper-side-square-32',
    category: 'mass-damper',
    name: 'MA 側制振器組（黃銅方塊 6×6×32 mm，左右各 1 顆＋FRP 側板，可上下滑動）',
    material: 'brass',
    mount: 'side',
    count: 2,
    shape: 'box',
    length_mm: 32,
    width_mm: 6,
    height_mm: 6,
    stroke_mm: 2,
    mass_g: 8.3,
    seatDeflection_mm: 0.3,
    seatDampingRatio: 0.5,
    slideFriction_Nspm: 0.02,
    /** 固定在底盤側面的 FRP 側板（每側 1 片）：只計質量（鎖死在底盤，不滑動） */
    bracket: { material: 'frp', thickness_mm: 1.5, mass_g: 0.9 },
    compat: { requires: ['side-damper-mount'] },
    src: {
      mass_g: 'PARTS_RESEARCH 第五階段 AD 節 [T15490] 官方：黃銅 6×6×32 mm、1 顆 8.3 g',
      dims: 'AD 節 [T15490] 官方 6×6×32 mm',
      stroke_mm: '推估（AD 節）：同 damper-side-square 2 mm',
      bracket: '推估（AD 節）：MA 專用 FRP 側板約 35×12×1.5 mm 扣孔 ≈ 500 mm³ × 1.85 g/cm³ ≈ 0.9 g／片',
      seat: '座墊剛性、阻尼、滑動摩擦同 damper-side-square（推估）',
      rule: '[REG6] Sec.3：旋轉 / 制振器位置不限；腳註禁止在「前輪中心→前輪後緣」「後輪中心→後輪前緣」的輪胎外側裝零件（SIDE_PART_TIRE_ZONE，官方條文）；32 mm 長、中心 x = 0 → x ∈ [−16, 16]，不進入禁區',
      taiwan: 'TAIWAN_SOURCES TW20（四驅博士學校／露天，15490）',
    },
  },
];

/**
 * 煞車板（iter-50）：海綿貼在 1.5 mm FRP 小板上，小板鎖在導輪架的煞車座下方（[T15518] 官方 FRP 煞車架「1.5mm厚FRP製ステー」附 2 mm 海綿）。
 * 板的平面尺寸 = 海綿貼片外擴 margin_mm（推估：板緣比海綿各多 0.6 mm 方便貼齊），質量 = 面積 × 厚度 × FRP 密度 1.85（SPEC 1.14），組裝時計算
 */
const BRAKE_PLATE = { material: 'frp', thickness_mm: 1.5, density_g_cm3: 1.85, margin_mm: 0.6, src: 'PARTS_RESEARCH 第三階段 A 節 [T15518]：1.5 mm FRP 煞車架；外擴 0.6 mm 為推估' };

/** @type {import('./types').PartBase[]} */
export const brakeSpongeParts = [
  {
    id: 'sponge-1mm-strong',
    category: 'brake-sponge',
    name: '煞車海綿 1 mm（強力，白）',
    color: 'white',
    thickness_mm: 1,
    /** 海綿對 ABS 賽道的摩擦係數 */
    frictionCoeff: 1.0,
    /** 壓縮模數（Pa）：接觸剛性 k = E·A / t */
    compressiveModulus_Pa: 3e5,
    contactDampingRatio: 0.3,
    density_g_cm3: 0.12,
    compat: { requires: ['rear-brake-mount'] },
    brakePlate: BRAKE_PLATE,
    /** 實際質量依導輪架的煞車座面積在組裝時計算（面積 × 厚度 × 密度；煞車板另計） */
    mass_g: 0,
    src: {
      thickness_mm: 'PARTS_RESEARCH 第三階段 G 節 [T15492] 官方：1 / 2 / 3 mm 三種厚度',
      frictionCoeff: 'PARTS_RESEARCH 第三階段 G 節：強力款 μ 推估 1.0（聚氨酯動摩擦 0.2–2.5，越軟越高 [GALL]）',
      compressiveModulus_Pa: '推估：軟質發泡聚氨酯壓縮模數約 0.1–1 MPa，強力（軟）款取 0.3 MPa',
      contactDampingRatio: '推估：發泡材的遲滯損失',
      density_g_cm3: 'PARTS_RESEARCH 第三階段 G 節 [VIETAPE]：約 0.12 g/cm³',
    },
  },
  {
    id: 'sponge-2mm-strong',
    category: 'brake-sponge',
    name: '煞車海綿 2 mm（強力，白）',
    color: 'white',
    thickness_mm: 2,
    frictionCoeff: 1.0,
    compressiveModulus_Pa: 3e5,
    contactDampingRatio: 0.3,
    density_g_cm3: 0.12,
    compat: { requires: ['rear-brake-mount'] },
    brakePlate: BRAKE_PLATE,
    mass_g: 0,
    src: {
      thickness_mm: 'PARTS_RESEARCH 第三階段 G 節 [T15492]',
      frictionCoeff: '同 sponge-1mm-strong（推估）',
      compressiveModulus_Pa: '同 sponge-1mm-strong（推估）',
    },
  },
  {
    id: 'sponge-3mm-mild',
    category: 'brake-sponge',
    name: '煞車海綿 3 mm（溫和，藍）',
    color: 'blue',
    thickness_mm: 3,
    frictionCoeff: 0.6,
    compressiveModulus_Pa: 1e6,
    contactDampingRatio: 0.3,
    density_g_cm3: 0.12,
    compat: { requires: ['rear-brake-mount'] },
    brakePlate: BRAKE_PLATE,
    mass_g: 0,
    src: {
      thickness_mm: 'PARTS_RESEARCH 第三階段 G 節 [T15492]（3 mm）',
      frictionCoeff: 'PARTS_RESEARCH 第三階段 G 節 [T15512]：マイルド款 μ 推估 0.6',
      compressiveModulus_Pa: '推估：較硬，取 1 MPa',
    },
  },
];

/** @type {import('./types').PartBase[]} */
export const ballastParts = [
  {
    id: 'ballast-hex-1g',
    category: 'ballast',
    name: '六角配重 1 g（可裝前 / 中 / 後）',
    material: 'brass',
    length_mm: 6,
    width_mm: 5.2,
    thickness_mm: 4,
    mass_g: 1.0,
    mountPoints: ['front', 'center', 'rear'],
    defaultMount: 'rear',
    compat: {},
    src: {
      mass_g: 'PARTS_RESEARCH 第三階段 H 節 [T95557] 官方「重さ約1gの六角ウエイト」',
      dims: '推估：對邊 5.2 mm 六角柱、高 4 mm（體積 93.7 mm³：鋼 7.85 g/cm³ 約 0.74 g、黃銅 8.5 g/cm³ 約 0.80 g；官方約 1 g，黃銅較接近，材質取黃銅）；外框用 6 × 5.2 × 4 mm',
    },
  },
  {
    id: 'ballast-square-3.6g',
    category: 'ballast',
    name: '黃銅方塊配重 3.6 g（6×6×14 mm，鎖死固定，可裝前 / 中 / 後）',
    material: 'brass',
    length_mm: 14,
    width_mm: 6,
    thickness_mm: 6,
    mass_g: 3.6,
    mountPoints: ['front', 'center', 'rear'],
    defaultMount: 'center',
    compat: {},
    src: {
      mass_g: 'PARTS_RESEARCH 第三階段 H 節 [T15472] 官方「1本約3.6g」「固定式のウェイトとしても使えます」',
      dims: '[T15472] 官方 6×6×14 mm',
    },
  },
];
