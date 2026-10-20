// 導輪架（前 / 後）：決定導輪安裝位置（底盤座標，mm）
// rollerX_mm 為導輪軸到前後軸中點的距離（正值，後導輪架放在 −x）；rollerZ_mm 為導輪軸到車中線的距離

/** @type {import('./types').PartBase[]} */
export const stayParts = [
  {
    id: 'stay-front-standard',
    category: 'stay-front',
    name: '前保桿導輪架（底盤附屬，左右各 1 顆導輪）',
    rollerX_mm: 71.5,
    rollerZ_mm: 42,
    rollerY_mm: 10,
    /** 前保桿與底盤一體成型，質量已含在 chassis-midship（0 g 的零件不放進零件清單） */
    mass_g: 0,
    src: {
      rollerX_mm: '推估：導輪外緣前後總長 156 mm（SPEC 1.2）− 導輪半徑 6.5',
      rollerZ_mm: '推估：導輪外緣跨距 97 mm（SPEC 1.8）− 導輪半徑 6.5',
      rollerY_mm: 'SPEC 1.8：與牆接觸高度離地約 8–15 mm（推估）',
      mass_g: 'PARTS_RESEARCH：MA 類前保桿與底盤一體成型（0 g，含在底盤 24.4 g）',
    },
  },
  {
    id: 'stay-rear-standard',
    category: 'stay-rear',
    name: '後保桿＋上層導輪架（左右各上下 2 顆導輪）',
    rollerX_mm: 71.5,
    rollerZ_mm: 42,
    lowerRollerHeight_mm: 10,
    upperRollerHeight_mm: 18,
    mass_g: 2.0,
    src: {
      rollerX_mm: '同 stay-front-standard',
      rollerZ_mm: '同 stay-front-standard',
      lowerRollerHeight_mm: 'SPEC 1.8（推估）',
      upperRollerHeight_mm: 'SPEC 1.8：後保桿上下 2 顆疊放（推估高度）',
      mass_g: 'PARTS_RESEARCH 推估：碳纖後導輪架 2.46 g（[MYF2] 玩家實測）換算成 ABS 2 mm 厚 ≈ 2.1 g，取 2.0 g',
    },
  },
];
