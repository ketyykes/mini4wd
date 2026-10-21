// 防翻 / 穩定零件（第四階段 iter-54）：裝在前導輪上方同一支螺絲（左右各 1 顆），不轉動、是滑動接觸
// 只有實際碰到賽道側牆面或牆頂時才有接觸力（sim.js 以 Rapier 圓柱碰撞體偵測幾何接觸，平時與牆不接觸、對模擬沒有任何力）
// 位置：底面 = 前導輪頂面 + spacer_mm（assembly.js optionalLayout），外徑比導輪小，所以直立行駛時外緣在導輪外緣內側；
// 車身側傾 θ 使穩定零件外緣越過導輪外緣時才會碰牆（PARTS_RESEARCH 第四階段 S 節的傾斜接觸條件）

/** @type {import('./types').PartBase[]} */
export const stabilizerParts = [
  {
    id: 'stabilizer-tube-8',
    category: 'stabilizer',
    name: '低摩擦高位圓筒穩定柱 φ8 × 10 mm（POM，前導輪上方左右各 1）',
    material: 'POM',
    diameter_mm: 8.0,
    height_mm: 10.0,
    spacer_mm: 1.5,
    wallFriction: 0.2,
    restitution: 0.1,
    // 單側：POM 圓筒 0.63 g ＋ 長螺絲換掉原本 2 × 8 螺絲的差 0.4 g
    mass_g: 0.63 + 0.4,
    src: {
      grade: 'PARTS_RESEARCH 第四階段 S 節 [T95718] 官方：「低摩擦ハイマウントチューブスタビセット」「フロントローラーの上に装着する樹脂製の円筒形スタビライザー」「マシンが傾いたときにコースフェンスに触れて転倒を防ぐ」',
      diameter_mm: '[T95718] 官方：直徑 8 mm、高 10 mm、POM 樹脂',
      spacer_mm: '推估（S 節）：導輪頂面與穩定柱之間墊片 1.5 mm',
      wallFriction: '推估（S 節）：POM 對 ABS 牆滑動 μ 約 0.2',
      restitution: '推估：同塑膠導輪 0.1',
      mass_g: '推估（S 節）：π/4·(8² − 2.6²)·10 = 450 mm³ × POM 1.41 g/cm³ = 0.63 g（中孔 φ2.6 推估為 M2 螺絲孔）＋長螺絲 M2 × 25 鋼約 0.6 g 換掉 2 × 8 螺絲約 0.2 g（差 0.4 g）',
    },
  },
  {
    id: 'stabilizer-head-17',
    category: 'stabilizer',
    name: '大徑穩定頭 17 mm（POM，配 19 mm 前導輪，左右各 1）',
    material: 'POM',
    diameter_mm: 17.0,
    height_mm: 3.0,
    spacer_mm: 1.5,
    wallFriction: 0.2,
    restitution: 0.1,
    // 只能和這個直徑的導輪一起裝（官方套件設計；裝在較小導輪上會變成主要接觸面 → STABILIZER_ROLLER_SIZE）
    requiresRollerDiameter_mm: 19.0,
    // 單側：穩定頭 0.9 g ＋ 雙頭螺絲換掉原本螺絲的差約 0.4 g
    mass_g: 0.9 + 0.4,
    src: {
      grade: 'PARTS_RESEARCH 第四階段 S 節 [T95519]（同文 [T95402]、[T95430]）官方：「フロントに19mmローラーを使った時に組み合わせて、コーナーでのマシンの傾きを少なくし走行安定性を高める17mmのスタビヘッド」「低摩擦･高強度のPOM樹脂」',
      diameter_mm: '官方 17 mm；高 3 mm 為推估（S 節）',
      requiresRollerDiameter_mm: '官方套件：配 19 mm 前導輪使用（S 節建議 STABILIZER_ROLLER_SIZE）',
      wallFriction: '推估（S 節）：POM 對 ABS 0.2',
      mass_g: '推估（S 節）：π/4·(17² − 2.6²)·3 × 1.41 = 0.94 → 0.9 g；附的雙頭螺絲比原本螺絲重約 0.4 g（推估，同穩定柱長螺絲差）',
    },
  },
];
