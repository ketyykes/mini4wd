// 齒輪組（一台車份：前後各 1 組 小齒輪 → 中間齒輪 → 輪軸齒輪）
// 中間齒輪軸與輪軸的中心距固定（底盤決定），換齒輪比時改變中間齒輪小齒與輪軸齒輪的節圓半徑分配

/**
 * 齒輪件單件質量（g），給傳動系轉動慣量用（parts/inertia.js）；各齒輪組只差齒數，質量取相同值
 * @type {{ pinion: number, counter: number, spur: number }}
 */
const GEAR_PART_MASSES_G = { pinion: 0.07, counter: 0.5, spur: 0.5 };
/** @type {string} */
const GEAR_PART_MASSES_SRC = '推估（第四階段，轉動慣量用）：小齒輪 0.07 g/顆（[TOYZ] 玩家實測）、中間齒輪 0.5 g（mass_g 說明的「中間齒輪與軸 0.6 g/組」扣齒輪軸 0.1 g）、輪軸齒輪 0.5 g/顆（[NAO]）；慣量以節圓半徑的實心圓盤計（上限）';

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
    mass_g: 2.0,
    inertiaMasses_g: GEAR_PART_MASSES_G,
    compat: { chassisLayouts: ['single-shaft'] },
    src: {
      inertiaMasses_g: GEAR_PART_MASSES_SRC,
      ratio: 'SPEC 1.5 [CS]：4.2:1 為 AR、Super II 標配；VS / FM / Zero / Type 系列可用，都是單軸（後置 / 前置馬達）底盤 → 不適用中置雙軸底盤（GEAR_CHASSIS）',
      pitchRadius: '推估：僅供完整性（裝不上本底盤）',
      mass_g: '推估：同 gear-3.5',
    },
  },
];
