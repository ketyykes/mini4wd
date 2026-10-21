// 導輪（單顆；前 2 顆＋後每側 1–2 層，依導輪架而定，SPEC 1.8）
// 第三階段：tiers 描述疊放的導輪片（由下而上；雙層導輪 = 一顆導輪本體上有兩片接觸面）。沒有 tiers 時視為單片 diameter_mm × height_mm
// diameter_mm 一律是最大接觸直徑（外框、與牆接觸都用它）

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
    id: 'roller-13-alu',
    category: 'roller',
    name: '13 mm 鋁合金導輪（內含培林）',
    finish: 'aluminum',
    diameter_mm: 13.0,
    height_mm: 5.0,
    wallFriction: 0.05,
    restitution: 0.1,
    mass_g: 0.85,
    src: {
      diameter_mm: 'PARTS_RESEARCH [T15437] 官方：13 mm 全鋁導輪',
      height_mm: '推估：同 roller-13（5 mm）',
      wallFriction: '同 roller-13（推估：導輪會轉動，切向阻力主要來自內含培林）',
      restitution: '推估：鋁導輪較硬，與塑膠導輪同取 0.1（牆是 ABS，能量主要損失在牆面）',
      mass_g: 'PARTS_RESEARCH [T15437] 官方「2個で約1.7g」→ 0.85 g／顆',
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
  {
    id: 'roller-13-12-double',
    category: 'roller',
    name: '13-12 mm 雙層塑膠導輪（下層 13 mm、上層 12 mm，兩片接觸面）',
    finish: 'plastic',
    diameter_mm: 13.0,
    height_mm: 10.0,
    tiers: [
      { diameter_mm: 13.0, height_mm: 4.5, y_mm: -2.75 },
      { diameter_mm: 12.0, height_mm: 4.5, y_mm: 2.75 },
    ],
    wallFriction: 0.05,
    restitution: 0.1,
    mass_g: 0.6,
    src: {
      diameter_mm: 'PARTS_RESEARCH 第三階段 D 節：13-12 mm 二段塑膠導輪（[SAGANO] 0.6 g）；平常下段 13 mm 碰牆，車身傾斜時上段碰牆（[T15525]）',
      height_mm: 'PARTS_RESEARCH 第三階段 D 節：總高約 10 mm（推估）',
      tiers: '推估：上下兩片各 4.5 mm、中間縮腰 1 mm',
      mass_g: 'PARTS_RESEARCH 第三階段 D 節 [SAGANO]：0.6 g',
    },
  },
];
