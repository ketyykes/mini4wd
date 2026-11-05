// 防翻 / 穩定零件：裝在前導輪上方同一支螺絲（左右各 1 顆），不轉動、是滑動接觸
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
  // ---- 大徑穩定頭 φ11 / φ15（15391，一包兩種尺寸；PARTS_RESEARCH 第七階段 AP 節）----
  // 與 stabilizer-head-17 同機制（換數值，不需新物理）：直徑較小 → 直立時外緣離導輪外緣較遠，車身要側傾得更多才碰牆（較晚介入）。
  // 官方只說「13～19mmローラーと組み合わせる2サイズ」，沒有指定哪一顆配哪一種導輪 → 不設 requiresRollerDiameter_mm，
  // 改由 regulation.js 既有的「穩定零件外徑 ≥ 前導輪外徑 → STABILIZER_ROLLER_SIZE」判定（AP 節建議的推估規則「穩定頭直徑 < 導輪直徑」）；
  // rollerDiameterRange_mm 記錄官方的適用導輪範圍（regulation.js 目前沒有讀）
  {
    id: 'stabilizer-head-11',
    category: 'stabilizer',
    name: '大徑穩定頭 11 mm（低摩擦樹脂，配 13–19 mm 前導輪，左右各 1）',
    material: 'POM',
    diameter_mm: 11.0,
    height_mm: 3.0,
    spacer_mm: 1.5,
    wallFriction: 0.2,
    restitution: 0.1,
    /** 官方適用的前導輪直徑範圍（mm，含端點） */
    rollerDiameterRange_mm: { min: 13.0, max: 19.0 },
    // 單側：穩定頭 0.4 g ＋ 換長螺絲的差約 0.4 g
    mass_g: 0.4 + 0.4,
    compat: {},
    src: {
      grade: 'PARTS_RESEARCH 第七階段 AP 節 [T15391] 官方：「大径スタビヘッドセット(11mm、15mm)」「コーナーでのマシンの傾きを少なくして」「13～19mmローラーと組み合わせる2サイズ」「高強度・低摩擦の樹脂製」；適用含 MA',
      diameter_mm: '[T15391] 官方 11 mm；高 3 mm 為推估（AP 節：同 stabilizer-head-17；官方無高度）',
      material: '官方只寫「高強度・低摩擦の樹脂」；推估 POM（同 stabilizer-head-17 [T95519] 明寫 POM）',
      rollerDiameterRange_mm: '[T15391] 官方「13～19mmローラーと組み合わせる」',
      rule: '[REG7] 沒有穩定頭條文（規則未明文規定）；STABILIZER_ROLLER_SIZE「穩定頭直徑 < 前導輪直徑」為推估規則（AP 節，依據官方「13～19mm」與穩定頭用途，非條文）：11 mm 配 13 / 17 / 19 mm 都成立',
      spacer_mm: '推估：同 stabilizer-head-17 的 1.5 mm 墊片',
      wallFriction: '推估（AP 節）：同 stabilizer-head-17，樹脂對 ABS 牆 0.2',
      restitution: '推估：同 stabilizer-head-17 0.1',
      mass_g: '推估：π/4·(11² − 2.6²)·3 = 269 mm³ × POM 1.41 g/cm³ = 0.38 → 0.4 g（與 stabilizer-head-17 同一算法；AP 節表列 0.3 g，但以它自己寫的「POM × 圓盤體積扣中孔」、高 3 mm 計算為 0.38 g，取計算值）；長螺絲換掉原本螺絲的差 0.4 g（推估，同 stabilizer-head-17；官方未寫套件是否附螺絲）',
      taiwan: '無台灣來源（TAIWAN_SOURCES：兩家店都沒找到 15391）',
    },
  },
  {
    id: 'stabilizer-head-15',
    category: 'stabilizer',
    name: '大徑穩定頭 15 mm（低摩擦樹脂，配 17–19 mm 前導輪，左右各 1）',
    material: 'POM',
    diameter_mm: 15.0,
    height_mm: 3.0,
    spacer_mm: 1.5,
    wallFriction: 0.2,
    restitution: 0.1,
    rollerDiameterRange_mm: { min: 13.0, max: 19.0 },
    // 單側：穩定頭 0.7 g ＋ 換長螺絲的差約 0.4 g
    mass_g: 0.7 + 0.4,
    compat: {},
    src: {
      grade: 'PARTS_RESEARCH 第七階段 AP 節 [T15391] 官方：同 stabilizer-head-11（一包 11 mm、15 mm 兩種）',
      diameter_mm: '[T15391] 官方 15 mm；高 3 mm 為推估（AP 節）',
      material: '官方「高強度・低摩擦の樹脂」；推估 POM',
      rollerDiameterRange_mm: '[T15391] 官方「13～19mmローラーと組み合わせる」（整包的範圍；哪一種尺寸配哪一種導輪官方未寫）',
      rule: '推估規則 STABILIZER_ROLLER_SIZE（AP 節）：15 mm ≥ 13 mm 導輪 → 會比導輪先碰牆，擋下；配 17 / 19 mm 導輪合法。名稱的「17–19 mm」是由這條推估規則推得，不是官方指定',
      spacer_mm: '推估：同 stabilizer-head-17 的 1.5 mm',
      wallFriction: '推估（AP 節）：0.2',
      restitution: '推估：0.1',
      mass_g: '推估：π/4·(15² − 2.6²)·3 = 514 mm³ × 1.41 g/cm³ = 0.73 → 0.7 g（AP 節表列 0.5 g，但以同一計算基準、高 3 mm 為 0.73 g，取計算值）；長螺絲差 0.4 g（推估）',
      taiwan: '無台灣來源',
    },
  },
];
