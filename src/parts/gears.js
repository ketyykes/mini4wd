// 齒輪組（一台車份：前後各 1 組 小齒輪 → 中間齒輪 → 輪軸齒輪）
// 中間齒輪軸與輪軸的中心距固定（底盤決定），換齒輪比時改變中間齒輪小齒與輪軸齒輪的節圓半徑分配

/**
 * 齒輪件單件質量（g），給傳動系轉動慣量用（parts/inertia.js）；各齒輪組只差齒數，質量取相同值
 * @type {{ pinion: number, counter: number, spur: number }}
 */
const GEAR_PART_MASSES_G = { pinion: 0.07, counter: 0.5, spur: 0.5 };
/** @type {string} */
const GEAR_PART_MASSES_SRC = '推估（第四階段，轉動慣量用）：小齒輪 0.07 g/顆（[TOYZ] 玩家實測）、中間齒輪 0.5 g（mass_g 說明的「中間齒輪與軸 0.6 g/組」扣齒輪軸 0.1 g）、輪軸齒輪 0.5 g/顆（[NAO]）；慣量以節圓半徑的實心圓盤計（上限）';

/** 單軸底盤齒輪組（B14）：小齒輪 ×1、中間齒輪 ×1、輪軸齒輪 ×1、冠狀齒輪 ×2、傳動軸 ×1（g；轉動慣量用） */
const SS_GEAR_PART_MASSES_G = { pinion: 0.07, counter: 0.5, spur: 0.5, crown: 0.4, propShaft: 1.5 };
/** 冠狀齒輪節圓半徑（推估：輪軸 13 mm 高、傳動軸 6.5 mm 高 → 6.5 mm） */
const SS_CROWN_R_MM = 6.5;
/** 整組質量 = 上列合計 */
const SS_GEAR_MASS_G = 0.07 + 0.5 + 0.5 + 2 * 0.4 + 1.5;
const SS_GEAR_SRC = '推估（B14）：小齒輪、中間齒輪、輪軸齒輪同雙軸齒輪組（各 1 顆）；冠狀齒輪 0.4 g/顆（推估：與輪軸齒輪同級、較薄）；傳動軸 1.5 g（[VZ 2.5] 推估，範圍 1.0–2.0 g；[T18106] 只說中空傳動軸約為標配的一半重）';
const SS_MASS_SRC = '推估：小齒輪 0.07＋中間齒輪 0.5＋輪軸齒輪 0.5＋冠狀齒輪 2 × 0.4＋傳動軸 1.5 = 3.37 g';
const SS_EFF_SRC = '推估：沿用 η = 0.80（SPEC 1.12）。單軸＋傳動軸比雙軸多 2 組冠狀齒輪嚙合，效率應略低，但查不到數值（[VZ 2.2]、[VZ 4] 第 4 點），所以不另外調整';

/**
 * 單軸底盤齒輪組：中心距 13.1 mm 不變（同雙軸），小齒輪與中間齒輪大齒同 gear-3.5，由齒輪比分配中間齒輪小齒與輪軸齒輪
 * @type {(id: string, ratio: number, ratioSrc: string) => import('./types').PartBase[]}
 */
function singleShaftGear(id, ratio, ratioSrc) {
  const k = ratio / (6.8 / 2.6);
  const small = 13.1 / (1 + k);
  return [{
    id,
    category: 'gear',
    name: `${ratio.toFixed(1)}:1 齒輪組（單軸底盤用，含冠狀齒輪與傳動軸）`,
    ratio,
    efficiency: 0.8,
    pinionPitchRadius_mm: 2.6,
    counterLargePitchRadius_mm: 6.8,
    counterSmallPitchRadius_mm: Number(small.toFixed(4)),
    spurPitchRadius_mm: Number((13.1 - small).toFixed(4)),
    crownPitchRadius_mm: SS_CROWN_R_MM,
    mass_g: SS_GEAR_MASS_G,
    inertiaMasses_g: SS_GEAR_PART_MASSES_G,
    compat: { chassisLayouts: ['single-shaft'] },
    src: {
      inertiaMasses_g: SS_GEAR_SRC,
      ratio: `[VZ 2.3] 官方「グレードアップパーツ マッチングリスト ギヤ比 [2020年1月]」[GEAR]：${ratioSrc}`,
      pitchRadius: `推估：中心距 13.1 mm 不變，6.8/2.6 × 輪軸齒輪/中間齒輪小齒 ≈ ${ratio}（齒數查不到）`,
      efficiency: SS_EFF_SRC,
      mass_g: SS_MASS_SRC,
    },
  }];
}

/** @type {import('./types').PartBase[]} */
export const gearParts = [
  {
    id: 'gear-3.5',
    category: 'gear',
    name: '3.5:1 齒輪組（雙軸底盤用）',
    ratio: 3.5,
    efficiency: 0.8,
    pinionPitchRadius_mm: 2.6,
    counterLargePitchRadius_mm: 6.8,
    counterSmallPitchRadius_mm: 5.6,
    spurPitchRadius_mm: 7.5,
    mass_g: 2.0,
    inertiaMasses_g: GEAR_PART_MASSES_G,
    /** 相容性：只適用中置雙軸底盤（chassis.motorLayout） */
    compat: { chassisLayouts: ['dual-shaft'] },
    src: {
      inertiaMasses_g: GEAR_PART_MASSES_SRC,
      ratio: 'SPEC 1.5：3.5:1 為 MA 等底盤套件標配',
      efficiency: 'SPEC 1.12：η = 0.80（推估）',
      pitchRadius: '推估：依 ref_ma-chassis 目視比例；6.8/2.6 × 7.5/5.6 ≈ 3.5',
      mass_g: 'PARTS_RESEARCH：8T 小齒輪 ×2（[TOYZ] 玩家實測 0.07 g/顆）＋中間齒輪與軸 ×2（推估 0.6 g/組）＋輪軸齒輪 ×2（[NAO] 0.5 g）≈ 1.8，取 2.0 g',
    },
  },
  {
    id: 'gear-4.0',
    category: 'gear',
    name: '4:1 齒輪組（雙軸底盤用）',
    ratio: 4.0,
    efficiency: 0.8,
    pinionPitchRadius_mm: 2.6,
    counterLargePitchRadius_mm: 6.8,
    counterSmallPitchRadius_mm: 5.18,
    spurPitchRadius_mm: 7.92,
    mass_g: 2.0,
    inertiaMasses_g: GEAR_PART_MASSES_G,
    compat: { chassisLayouts: ['dual-shaft'] },
    src: {
      inertiaMasses_g: GEAR_PART_MASSES_SRC,
      ratio: 'SPEC 1.5：4:1',
      efficiency: '同 gear-3.5（推估）',
      pitchRadius: '推估：小齒輪與中間齒輪大齒同 gear-3.5，中心距 5.6 + 7.5 = 13.1 mm 不變，6.8/2.6 × 7.92/5.18 ≈ 4.0',
      mass_g: 'PARTS_RESEARCH：只差齒數，與 gear-3.5 質量差 < 0.1 g，取相同值（推估）',
    },
  },
  {
    id: 'gear-3.7',
    category: 'gear',
    name: '3.7:1 齒輪組（雙軸底盤用）',
    ratio: 3.7,
    efficiency: 0.8,
    pinionPitchRadius_mm: 2.6,
    counterLargePitchRadius_mm: 6.8,
    counterSmallPitchRadius_mm: 5.425,
    spurPitchRadius_mm: 7.675,
    mass_g: 2.0,
    inertiaMasses_g: GEAR_PART_MASSES_G,
    compat: { chassisLayouts: ['dual-shaft'] },
    src: {
      inertiaMasses_g: GEAR_PART_MASSES_SRC,
      ratio: 'SPEC 1.5：3.7:1，PRO（MS）用 High Speed EX Gear Set（15429）；PARTS_RESEARCH 第三階段 G 節',
      efficiency: '同 gear-3.5（推估）',
      pitchRadius: '推估：中心距 13.1 mm 不變，6.8/2.6 × 7.675/5.425 ≈ 3.70',
      mass_g: '推估：只差齒數，與 gear-3.5 相同',
    },
  },
  // B14（iter-107）：單軸底盤（VZ）用齒輪組。VZ 的傳動：8T 小齒輪 → 中間齒輪（カウンターギヤ）→ 後輪軸齒輪（スパーギヤ），
  // 後輪軸冠狀齒輪 → 傳動軸 → 前輪軸冠狀齒輪（G13 粉紅）。中間齒輪只有 1 組；質量另含冠狀齒輪 ×2 與傳動軸（[VZ 2.2]、[VZ 2.5]）
  ...singleShaftGear('gear-ss-3.5', 3.5, 'GEAR 表 VZ 欄 3.5:1（カウンター G17 水色＋スパー G18 黃）；單售 15432 スーパーXX・スーパーII用超速ギヤセット（一覽含 VZ [C]）；VZ 標配 [CS]'),
  ...singleShaftGear('gear-ss-3.7', 3.7, 'GEAR 表 VZ 欄 3.7:1（カウンター G24 綠＋スパー G18 黃）；單售 15434 ハイスピードEXカウンターギヤセット（一覽含 VZ [C]）'),
  ...singleShaftGear('gear-ss-4.0', 4.0, 'GEAR 表 VZ 欄 4:1（カウンター G14 黑＋スパー G11 淡茶）；單售 15236 ハイスピードカウンターギヤ（[VZ 4] 第 5 點：15236 頁本輪未開，合法依據是 GEAR 表）'),
  {
    id: 'gear-4.2',
    category: 'gear',
    name: '4.2:1 齒輪組（單軸底盤用；中置雙軸底盤裝不上）',
    ratio: 4.2,
    efficiency: 0.8,
    pinionPitchRadius_mm: 2.6,
    counterLargePitchRadius_mm: 6.8,
    counterSmallPitchRadius_mm: 5.027,
    spurPitchRadius_mm: 8.073,
    crownPitchRadius_mm: SS_CROWN_R_MM,
    mass_g: SS_GEAR_MASS_G,
    inertiaMasses_g: SS_GEAR_PART_MASSES_G,
    compat: { chassisLayouts: ['single-shaft'] },
    src: {
      inertiaMasses_g: SS_GEAR_SRC,
      ratio: 'SPEC 1.5 [CS]：4.2:1 為 AR、Super II 標配；VS / FM / Zero / Type 系列可用，都是單軸（後置 / 前置馬達）底盤 → 不適用中置雙軸底盤（GEAR_CHASSIS）。B14：GEAR 表 VZ 欄 4.2:1（カウンター G9 紅＋スパー G11 淡茶），單售 15236（原本引用的 15516 是 FM-A 專用，一覽不含 VZ，[VZ 2.3]）',
      pitchRadius: '推估：中心距 13.1 mm 不變，6.8/2.6 × 8.073/5.027 ≈ 4.2',
      efficiency: SS_EFF_SRC,
      mass_g: SS_MASS_SRC,
    },
  },
  ...singleShaftGear('gear-ss-5.0', 5.0, 'GEAR 表 VZ 欄 5:1（カウンター G10 藍＋スパー G6 黃綠）；表上沒有單售料號註記（[VZ 2.3]）'),
];
