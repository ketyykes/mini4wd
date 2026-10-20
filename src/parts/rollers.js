// 導輪（單顆；一台車 6 顆：前 2、後 2×2 疊放，SPEC 1.8）

/** @type {import('./types').PartBase[]} */
export const rollerParts = [
  {
    id: 'roller-13',
    category: 'roller',
    name: '13 mm 塑膠導輪',
    finish: 'plastic',
    diameter_mm: 13.0,
    height_mm: 5.0,
    wallFriction: 0.05,
    restitution: 0.1,
    mass_g: 0.45,
    src: {
      diameter_mm: 'SPEC 1.8：13 mm',
      height_mm: 'PARTS_RESEARCH 推估：沿用 19 mm 鋁導輪官方高度 5 mm（13 mm 導輪高度沒查到）',
      wallFriction: 'SPEC 1.8：導輪–牆等效摩擦 0.05（推估）',
      restitution: '推估：塑膠導輪撞擊 ABS 牆的恢復係數偏低',
      mass_g: 'PARTS_RESEARCH [T15551] 官方：13 mm 塑膠導輪（壓入培林）0.45 g',
    },
  },
  {
    id: 'roller-19',
    category: 'roller',
    name: '19 mm 鋁合金導輪（內含培林）',
    finish: 'aluminum',
    diameter_mm: 19.0,
    height_mm: 5.0,
    wallFriction: 0.05,
    restitution: 0.1,
    mass_g: 1.9,
    src: {
      diameter_mm: 'SPEC 1.8：19 mm',
      height_mm: 'PARTS_RESEARCH [T95609] 官方：外徑 19 mm、高 5 mm',
      wallFriction: '同 roller-13（推估）',
      mass_g: 'PARTS_RESEARCH [T95609] 官方：1.9 g（含 520 培林）',
    },
  },
];
