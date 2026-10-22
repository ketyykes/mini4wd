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
  // ---- 第七階段（iter-78）：HG 丸穴培林（15519，PARTS_RESEARCH 第七階段 AQ 節，台灣 TW39）----
  // 與 bearing-620 同結構；物理差異只有質量（較薄）與軸承摩擦係數（推估較小），沒有依 id 的特例
  {
    id: 'bearing-620-hg',
    category: 'bearing',
    name: 'HG 丸穴滾珠培林 620（輪軸與中間齒輪 6 處都用，15519）',
    kind: 'ball',
    outerDiameter_mm: 6,
    innerDiameter_mm: 2,
    width_mm: 2,
    frictionCoeff: 0.002,
    /** 輪軸用單顆質量 */
    mass_g: 0.28,
    /** 中間齒輪軸也用同一款 620（官方「カウンターギヤの軸受けとして使え」） */
    counterMass_g: 0.28,
    src: {
      grade: 'PARTS_RESEARCH 第七階段 AQ 節 [T15519] 官方：「HG 丸穴ボールベアリング （4個）」「ガタが少なく、転がり抵抗もさらに小さい」「ドライブシャフトやカウンターギヤの軸受けとして使え」；適用含 MA',
      outerDiameter_mm: '[T15519] 官方「サイズは外径6mm､内径2mm､厚み2mm」',
      width_mm: '[T15519] 官方厚 2 mm',
      frictionCoeff: '推估（AQ 節）：0.002 = 既有 bearing-620 0.003（SPEC 1.6 推估）的 2/3；官方只有定性「転がり抵抗もさらに小さい」，沒有數值（AT 節第 11 點：效果約 0.1% 級）',
      mass_g: '推估（AQ 節）：[ALBECO] MR62 開放式（2×6×2.5）0.28 g，同尺寸級；官方未寫質量。厚 2 mm 比 2.5 mm 薄，實際可能更輕，取 AQ 節值',
      counterMass_g: '推估：中間齒輪軸也裝 15519（官方可用於カウンターギヤ），同 0.28 g；6 處需 2 包（一包 4 顆）',
      rule: '[REG7] Sec.6「installing ball bearings」明文允許',
      taiwan: 'TAIWAN_SOURCES TW39（四驅博士學校／露天，15519）',
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
