// 中間齒輪軸與中間齒輪軸承（第五階段 iter-59，台灣買得到的傳動零件；台灣來源見 shared/reference/TAIWAN_SOURCES.md）
// 中間齒輪（前後各 1 個）套在 φ2 × 13 mm 的軸上轉動；軸承摩擦力矩 = μ ×（兩個嚙合點的力）× 軸半徑（powertrain.js counterGearLossFraction）
// μ 的決定方式（assembly.js buildSpec）：
//   1. 本 slot 的零件自帶中間齒輪培林（counterBearing）→ 用培林的 μ（與輪軸軸承 slot 無關）
//   2. 否則中間齒輪軸承跟著輪軸軸承 slot（bearings）：滾珠培林 → 培林 μ；塑膠軸承 → 塑膠軸承與這支軸的表面摩擦 bushingFrictionCoeff（沒寫就用塑膠軸承本身的值）
// 軸本身的質量已含在齒輪組（gears.js：中間齒輪與軸 0.6 g/組）；同尺寸的鋼 / 不鏽鋼 / 含氟塗層軸質量相同，所以 mass_g = 0（只有培林組會加培林質量）

/** @type {import('./types').PartBase[]} */
export const counterShaftParts = [
  {
    id: 'counter-shaft-standard',
    category: 'counter-shaft',
    name: '套件標準中間齒輪軸（鋼，φ2 × 13 mm ×2）',
    bushingFrictionCoeff: null,
    counterBearing: null,
    mass_g: 0,
    src: {
      dims: 'PARTS_RESEARCH 第五階段 AF 節：中間齒輪軸 φ2 × 13 mm',
      mass_g: '含在齒輪組質量（gears.js 中間齒輪與軸 0.6 g/組，推估）',
      bushingFrictionCoeff: 'null = 沿用塑膠軸承本身的 μ（SPEC 1.6：0.20，推估）',
    },
  },
  {
    id: 'gear-shaft-ptfe',
    category: 'counter-shaft',
    name: '含氟塗層中間齒輪軸（直軸 ×2，15390）',
    bushingFrictionCoeff: 0.15,
    counterBearing: null,
    mass_g: 0,
    src: {
      grade: 'PARTS_RESEARCH 第五階段 AF 節 [T15390]：フッソコートギヤシャフト（含氟樹脂複合鍍層），φ2 × 13 mm',
      bushingFrictionCoeff: '推估（AF 節、V 節 [PMC-PTFE] 比例）：塑膠軸承與軸的摩擦 0.20 → 0.15；中間齒輪裝滾珠培林時軸不和軸承滑動，沒有作用',
      mass_g: '同尺寸鋼軸 0.32 g/支（V 節），與標準軸相同 → 相對齒輪組質量的增量 0',
      taiwan: 'TAIWAN_SOURCES TW18（四驅博士學校／露天，15390）',
    },
  },
  {
    id: 'counter-bearing-520',
    category: 'counter-shaft',
    name: '中間齒輪培林組（520 培林 ×2＋不鏽鋼軸 ×2，15347）',
    bushingFrictionCoeff: null,
    counterBearing: { kind: 'ball', frictionCoeff: 0.003, mass_g: 0.2 },
    /** 顯示用：2 顆 520 培林合計（組裝時依 counterBearing.mass_g 逐顆計入，不使用本欄） */
    mass_g: 0.4,
    src: {
      grade: 'PARTS_RESEARCH 第五階段 AF 節 [T15347] 官方：MS / MA / ME 用中間齒輪培林組（520 培林 2 顆、2 × 13 mm 不鏽鋼軸 2 支）',
      counterBearing: 'μ 0.003 同 SPEC 1.6 滾珠培林（推估）；520 培林質量 0.20 g（[ALBECO] MR52ZZ）',
      mass_g: '不鏽鋼軸與標準軸同尺寸 → 增量 0；培林質量由 counterBearing.mass_g 逐顆計入（取代 bearings slot 的中間齒輪軸承）；mass_g 0.4 是 2 顆合計，只給選單顯示',
      rule: '[REG6] Sec.6-4 明文允許加裝滾珠培林；齒輪比不變',
      taiwan: 'TAIWAN_SOURCES TW17（四驅博士學校／露天，15347）',
    },
  },
];
