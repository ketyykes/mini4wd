// 軸承（一台車 6 處：前後輪軸左右各 1、前後中間齒輪軸各 1；SPEC 1.6）

/** @type {import('./types').PartBase[]} */
export const bearingParts = [
  {
    id: 'bearing-620',
    category: 'bearing',
    name: '滾珠培林（輪軸 620、中間齒輪 520）',
    kind: 'ball',
    outerDiameter_mm: 6,
    innerDiameter_mm: 2,
    width_mm: 2.5,
    frictionCoeff: 0.003,
    /** 輪軸用 620 單顆質量 */
    mass_g: 0.33,
    /** 中間齒輪軸用 520 單顆質量 */
    counterMass_g: 0.2,
    src: {
      outerDiameter_mm: 'SPEC 1.6：620 外徑 6 / 內徑 2 mm（Tamiya 15523）',
      width_mm: 'SPEC 1.6：約 2.5 mm（推估，MR62ZZ）',
      frictionCoeff: 'SPEC 1.6：0.003（推估）',
      mass_g: 'PARTS_RESEARCH [ALBECO] 培林型錄：MR62ZZ（2×6×2.5）0.33 g',
      counterMass_g: 'PARTS_RESEARCH [ALBECO]：MR52ZZ（2×5×2.5）0.20 g',
    },
  },
  {
    id: 'bushing-plastic',
    category: 'bearing',
    name: '塑膠軸承（bushing）',
    kind: 'bushing',
    outerDiameter_mm: 6,
    innerDiameter_mm: 2,
    width_mm: 2.5,
    frictionCoeff: 0.2,
    mass_g: 0.1,
    counterMass_g: 0.1,
    src: {
      frictionCoeff: 'SPEC 1.6：0.20（推估）',
      material: 'PARTS_RESEARCH [T15523] 官方：POM 樹脂',
      mass_g: 'PARTS_RESEARCH 推估：約 71 mm³ × POM 1.41 g/cm³ ≈ 0.10 g（凸緣尺寸推估）',
    },
  },
];
