// 輪胎＋輪框（單顆）

/** @type {import('./types').PartBase[]} */
export const wheelParts = [
  {
    id: 'wheel-26-lowprofile',
    category: 'wheel',
    name: '小徑 low profile 輪胎＋輪框（26 mm）',
    diameter_mm: 26.0,
    width_mm: 9.0,
    rimDiameter_mm: 18.0,
    frictionCoeff: 0.7,
    rollingResistanceCoeff: 0.02,
    slipAngleSaturation_rad: 0.1,
    mass_g: 3.0,
    src: {
      diameter_mm: 'SPEC 1.7：Tamiya 15542 小徑 low profile 26 mm',
      width_mm: 'SPEC 1.7：約 9 mm（推估）',
      rimDiameter_mm: '推估：low profile 胎厚約 4 mm',
      frictionCoeff: 'SPEC 1.7：μ = 0.7（推估）',
      rollingResistanceCoeff: 'SPEC 1.7：C_rr = 0.02（推估）',
      slipAngleSaturation_rad: '推估：小型橡膠胎側向力約在 5–6° 滑移角飽和',
      mass_g: '暫定（iter-31）：第一階段推估每顆約 3 g，待 PARTS_RESEARCH 更新',
    },
  },
  {
    id: 'wheel-31-large',
    category: 'wheel',
    name: '大徑輪胎＋輪框（31 mm）',
    diameter_mm: 31.0,
    width_mm: 9.0,
    rimDiameter_mm: 21.0,
    frictionCoeff: 0.7,
    rollingResistanceCoeff: 0.02,
    slipAngleSaturation_rad: 0.1,
    mass_g: 4.0,
    src: {
      diameter_mm: 'SPEC 1.7：Tamiya 15544 大徑 31 mm',
      width_mm: '暫定（iter-31）',
      rimDiameter_mm: '暫定（iter-31）：胎厚約 5 mm',
      frictionCoeff: '同 wheel-26（推估）',
      rollingResistanceCoeff: '同 wheel-26（推估）',
      mass_g: '暫定（iter-31）：待 PARTS_RESEARCH 更新',
    },
  },
];
