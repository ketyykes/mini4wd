// 齒輪組（一台車份：前後各 1 組 小齒輪 → 中間齒輪 → 輪軸齒輪）
// 中間齒輪軸與輪軸的中心距固定（底盤決定），換齒輪比時改變中間齒輪小齒與輪軸齒輪的節圓半徑分配

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
    src: {
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
    src: {
      ratio: 'SPEC 1.5：4:1',
      efficiency: '同 gear-3.5（推估）',
      pitchRadius: '推估：小齒輪與中間齒輪大齒同 gear-3.5，中心距 5.6 + 7.5 = 13.1 mm 不變，6.8/2.6 × 7.92/5.18 ≈ 4.0',
      mass_g: 'PARTS_RESEARCH：只差齒數，與 gear-3.5 質量差 < 0.1 g，取相同值（推估）',
    },
  },
];
