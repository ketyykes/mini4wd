// 導輪（單顆；一台車 6 顆：前 2、後 2×2 疊放，SPEC 1.8）

/** @type {import('./types').PartBase[]} */
export const rollerParts = [
  {
    id: 'roller-13',
    category: 'roller',
    name: '13 mm 塑膠導輪',
    diameter_mm: 13.0,
    height_mm: 6.5,
    wallFriction: 0.05,
    restitution: 0.1,
    mass_g: 0.5,
    src: {
      diameter_mm: 'SPEC 1.8：13 mm',
      height_mm: '推估：13 mm 導輪厚度約 6–7 mm',
      wallFriction: 'SPEC 1.8：導輪–牆等效摩擦 0.05（推估）',
      restitution: '推估：塑膠導輪撞擊 ABS 牆的恢復係數偏低',
      mass_g: '暫定（iter-31）：待 PARTS_RESEARCH 更新',
    },
  },
  {
    id: 'roller-19',
    category: 'roller',
    name: '19 mm 鋁合金導輪（內含培林）',
    diameter_mm: 19.0,
    height_mm: 6.5,
    wallFriction: 0.05,
    restitution: 0.1,
    mass_g: 1.5,
    src: {
      diameter_mm: 'SPEC 1.8：19 mm',
      height_mm: '暫定（iter-31）',
      wallFriction: '同 roller-13（推估）',
      mass_g: '暫定（iter-31）：待 PARTS_RESEARCH 更新',
    },
  },
];
