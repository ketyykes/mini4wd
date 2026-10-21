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
  // ---- 第四階段（iter-54）：錐形（テーパー）全鋁導輪：上段圓柱＋下段截錐（錐面朝下）----
  // taper：上段圓柱高 cylinderHeight_mm（直徑 = diameter_mm）、下段錐形高 coneHeight_mm、錐形底面直徑 bottomDiameter_mm。
  // 與牆面接觸時（牆面垂直）接觸點在上段圓柱、法向水平；騎上牆頂時牆頂邊緣碰到錐面，接觸法向沿錐面法向（與水平夾約 34°），
  // 產生「推回車道＋上抬」分力（sim.js rollerWallContacts 由這份幾何推導，不寫特例）
  {
    id: 'roller-19-tapered',
    category: 'roller',
    name: '19 mm 錐形全鋁導輪（テーパー，內含 520 培林）',
    finish: 'aluminum',
    diameter_mm: 19.0,
    height_mm: 5.0,
    taper: { cylinderHeight_mm: 2.0, coneHeight_mm: 3.0, bottomDiameter_mm: 15.0 },
    wallFriction: 0.05,
    restitution: 0.1,
    mass_g: 1.9,
    src: {
      grade: 'PARTS_RESEARCH 第四階段 T 節 [T95436] 官方：「HG 19mmオールアルミベアリングローラー（テーパータイプ）」「すり鉢（テーパー）形状により、マシンがコースフェンスに乗り上げた時にコース内へ復帰しやすい」「外径19ｍｍ、高さ5ｍｍ…重さは1.9g」',
      taper: '推估（T 節）：圓柱 2 mm＋錐形 3 mm（φ19 → φ15），錐面與水平夾 atan(2/3) ≈ 34°；官方與玩家都沒有錐角數值',
      mass_g: '[T95436] 官方「重さは1.9g」（含 520 培林）',
      mount: 'T 節 [FTAP]「tapered underside…mounted underneath the stay」：要用螺絲＋墊片鎖在 FRP / 碳纖導輪板上、錐面朝下才有作用 → 塑膠一體保桿 / 標準後導輪架擋下（ROLLER_TAPER_MOUNT，推估規則）',
      wallFriction: '同 roller-19（推估）',
    },
  },
  {
    id: 'roller-13-tapered',
    category: 'roller',
    name: '13 mm 錐形全鋁導輪（テーパー，內含 520 培林）',
    finish: 'aluminum',
    diameter_mm: 13.0,
    height_mm: 5.0,
    taper: { cylinderHeight_mm: 2.0, coneHeight_mm: 3.0, bottomDiameter_mm: 9.0 },
    wallFriction: 0.05,
    restitution: 0.1,
    mass_g: 0.8,
    src: {
      grade: 'PARTS_RESEARCH 第四階段 T 節 [T95497] 官方：「HG 13mmオールアルミベアリングローラー（テーパータイプ）」直徑 13 mm、520 培林；高度、質量官方未寫',
      taper: '推估（T 節）：圓柱 2 mm＋錐形 3 mm，錐角取與 19 mm 款相同的 34°（tan 34° ≈ 2/3 → 半徑內縮 2 mm，φ13 → φ9；T 節表中「φ10.5」與「34°」互相矛盾，φ10.5 只有 22.6°，這裡以錐角為準，φ9 仍包得住 520 培林外徑 5 mm）',
      mass_g: '推估（T 節）：13 mm 全鋁 0.85 g（[T15437]）扣錐形去除量 → 0.8 g',
      mount: '同 roller-19-tapered（ROLLER_TAPER_MOUNT）',
    },
  },
];
