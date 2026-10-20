// 其他底盤零件：電池蓋、開關（含端子）、輪軸

/** @type {import('./types').PartBase[]} */
export const miscParts = [
  {
    id: 'battery-cover-standard',
    category: 'battery-cover',
    name: '電池蓋（底面）',
    mass_g: 2.0,
    src: { mass_g: '暫定（iter-31）：待 PARTS_RESEARCH 更新' },
  },
  {
    id: 'switch-standard',
    category: 'switch',
    name: '電源開關＋電池端子',
    mass_g: 1.5,
    src: { mass_g: '暫定（iter-31）：待 PARTS_RESEARCH 更新' },
  },
  {
    id: 'axle-hex-60',
    category: 'axle',
    name: '2 mm 六角輪軸（鋼，一台車 2 支）',
    diameter_mm: 2,
    length_mm: 60,
    /** 單支質量 */
    mass_g: 1.4,
    src: {
      diameter_mm: 'SPEC 1.6：輪軸直徑 2 mm（620 內徑）',
      length_mm: '暫定（iter-31）：待 PARTS_RESEARCH 更新',
      mass_g: '推估：鋼 7.85 g/cm³ × π × 0.1² cm² × 6 cm ≈ 1.48 g，扣掉六角截面略小取 1.4 g',
    },
  },
];
