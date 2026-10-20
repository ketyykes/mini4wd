// 其他底盤零件：電池蓋、開關（含端子）、輪軸、齒輪蓋、小五金

/** @type {import('./types').PartBase[]} */
export const miscParts = [
  {
    id: 'battery-cover-standard',
    category: 'battery-cover',
    name: '電池蓋（底面）',
    mass_g: 1.6,
    src: { mass_g: 'PARTS_RESEARCH [NAO] 玩家實測：電池蓋 1.6 g' },
  },
  {
    id: 'switch-standard',
    category: 'switch',
    name: '電源開關＋銅電池端子',
    mass_g: 3.0,
    src: { mass_g: 'PARTS_RESEARCH：銅端子 2.2 g（[NAO] 玩家實測）＋旋轉開關約 0.8 g（推估）' },
  },
  {
    id: 'axle-hex-60',
    category: 'axle',
    name: '2 mm 六角輪軸 60 mm（鋼，一台車 2 支）',
    diameter_mm: 2,
    length_mm: 60,
    /** 單支質量 */
    mass_g: 1.15,
    src: {
      diameter_mm: 'SPEC 1.6：輪軸直徑 2 mm（620 內徑）',
      length_mm: 'PARTS_RESEARCH [FANDOM]：MA 輪軸 60 mm',
      mass_g: 'PARTS_RESEARCH [NAO] 玩家實測 2 支 2.3 g；幾何驗算 1.22 g/支',
    },
  },
  {
    id: 'gear-cover-standard',
    category: 'gear-cover',
    name: '馬達＋齒輪固定蓋（滑動卡榫蓋）',
    mass_g: 5.5,
    src: { mass_g: 'PARTS_RESEARCH [NAO] 玩家實測：齒輪蓋 5.5 g' },
  },
  {
    id: 'hardware-standard',
    category: 'hardware',
    name: '小五金：馬達座、端子固定件、車殼卡榫、導輪螺絲螺帽',
    mass_g: 3.0,
    src: { mass_g: 'PARTS_RESEARCH 推估：[NAO] 4.9 g 雜項群組扣掉中間齒輪、軸承、開關約 2.5 g，加車殼卡榫 0.4 g' },
  },
];
