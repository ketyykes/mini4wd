// 其他底盤零件：電池蓋、開關（含端子）、輪軸、齒輪蓋、小五金

/** 銅電阻率（Ω·m，[HYPER]）與黃銅電阻率（[CONCAST] C26000 28% IACS） */
const RHO_COPPER = 1.68e-8;
const RHO_BRASS = 6.17e-8;
/** 端子組體積（mm³）：銅端子 2.2 g ÷ 8.96 g/cm³ */
const TERMINAL_COPPER_VOLUME_MM3 = (2.2 / 8.96) * 1000;
/** 電流路徑總長（mm，推估：電池間連接片＋正負極片＋開關到馬達，依 MA 80 mm 軸距估） */
const TERMINAL_PATH_MM = 150;
/** 迴路接點數（[POKE]：電池 4 接點＋馬達 2 接點＋開關 1） */
const CONTACTS = 7;
/** @type {string} */
const TERMINAL_RESISTANCE_SRC = '本體 R = ρ·L²/V（V = 端子體積 246 mm³、L = 電流路徑 150 mm 推估）＋接點電阻 × 7 個（[POKE]；接點值無實測，推估，上限參考 AA 電池座規格 < 50 mΩ）';

/**
 * 端子本體電阻（Ω）：R = ρ·L / A = ρ·L² / V；疊 n 片時截面 × n
 * @type {(rho: number, volume_mm3: number, layers: number) => number}
 */
function terminalBodyResistance(rho, volume_mm3, layers) {
  const L = TERMINAL_PATH_MM * 1e-3;
  const V = volume_mm3 * layers * 1e-9;
  return (rho * L * L) / V;
}

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
    terminal: 'copper',
    terminalLayers: 1,
    // 迴路電阻 = 端子本體（銅，R = ρ·L²/V）＋ 7 個接點 × 8 mΩ
    circuitResistance_ohm: terminalBodyResistance(RHO_COPPER, TERMINAL_COPPER_VOLUME_MM3, 1) + CONTACTS * 0.008,
    mass_g: 3.0,
    src: {
      mass_g: 'PARTS_RESEARCH：銅端子 2.2 g（[NAO] 玩家實測）＋旋轉開關約 0.8 g（推估）',
      terminal: 'PARTS_RESEARCH 第四階段 U 節 [FGT]：之後的底盤標準馬達 / 電池端子是銅',
      circuitResistance_ohm: `推估（U 節）：${TERMINAL_RESISTANCE_SRC}；乾淨銅接點 8 mΩ/個 → 約 57.5 mΩ`,
    },
  },
  {
    id: 'switch-gold-terminal',
    category: 'switch',
    name: '電源開關＋鍍金電池端子（低電阻端子）',
    terminal: 'gold',
    terminalLayers: 1,
    // 鍍金端子：底材黃銅（[POKE] 作者說法）→ 本體電阻較高，但金不氧化、接點電阻較低（5 mΩ/個）
    circuitResistance_ohm: terminalBodyResistance(RHO_BRASS, TERMINAL_COPPER_VOLUME_MM3, 1) + CONTACTS * 0.005,
    mass_g: 3.0,
    src: {
      grade: 'PARTS_RESEARCH 第四階段 U 節：MS 用金端子 15360（[FGT]：MS-type 同時支援 MS 與 MA 底盤）；Tamiya 官方（[T15421]）只說鍍金「酸化防止効果」，沒有電阻數據',
      mass_g: '推估（U 節）：同形狀，與銅端子相同 2.2 g ＋ 開關 0.8 g',
      circuitResistance_ohm: `推估（U 節）：${TERMINAL_RESISTANCE_SRC}；底材黃銅 ρ = 6.17×10⁻⁸ Ω·m（[CONCAST]）→ 本體 5.7 mΩ；鍍金接點 5 mΩ/個 → 約 40.7 mΩ`,
    },
  },
  {
    id: 'switch-double-terminal',
    category: 'switch',
    name: '電源開關＋疊兩片的加厚銅端子（違規改裝，規則測試用）',
    terminal: 'copper',
    terminalLayers: 2,
    circuitResistance_ohm: terminalBodyResistance(RHO_COPPER, TERMINAL_COPPER_VOLUME_MM3, 2) + CONTACTS * 0.008,
    mass_g: 5.2,
    src: {
      grade: 'PARTS_RESEARCH 第四階段 U 節：兩片端子疊加（加厚）；[REG6] Sec.6-5「Soldering or double-plated terminals are prohibited」→ 違規 TERMINAL_MOD',
      mass_g: '銅端子 2 × 2.2 g ＋ 開關 0.8 g',
      circuitResistance_ohm: `推估（U 節）：截面加倍、本體電阻減半（0.8 mΩ），接點同銅（8 mΩ/個）→ 約 56.8 mΩ`,
    },
  },
  {
    id: 'axle-hex-60',
    category: 'axle',
    name: '2 mm 六角輪軸 60 mm（鋼，一台車 2 支）',
    diameter_mm: 2,
    length_mm: 60,
    boreDiameter_mm: 0,
    /** 單支質量 */
    mass_g: 1.15,
    src: {
      diameter_mm: 'SPEC 1.6：輪軸直徑 2 mm（620 內徑）；六角的對角寬 = 2 mm（穿過培林內孔），截面 2.598 mm²，60 mm × 7.85 g/cm³ = 1.22 g 與實測相符',
      length_mm: 'PARTS_RESEARCH [FANDOM]：MA 輪軸 60 mm',
      mass_g: 'PARTS_RESEARCH [NAO] 玩家實測 2 支 2.3 g；幾何驗算 1.22 g/支',
    },
  },
  {
    id: 'axle-hex-60-hollow',
    category: 'axle',
    name: '60 mm 中空不鏽鋼六角輪軸（一台車 2 支）',
    diameter_mm: 2,
    length_mm: 60,
    // 中孔直徑由「質量為實心的 2/3」反推：π/4·d² = 六角面積 × 1/3 → d ≈ 1.05 mm
    boreDiameter_mm: Math.sqrt(((1.5 * Math.sqrt(3)) / 3) * (4 / Math.PI)),
    mass_g: 1.15 * (2 / 3),
    src: {
      grade: 'PARTS_RESEARCH 第四階段 V 節 [T15440] 官方：「60mm中空ステンレスシャフト」「重量がノーマルの2/3以下と軽量ながら強度は同等｡回転部分の軽量化により､シャープな加速」「ミニ四駆PROをはじめ…取り付け可能」',
      mass_g: '官方「ノーマルの2/3以下」× 標準輪軸 1.15 g（[NAO]）= 0.77 g/支',
      boreDiameter_mm: '推估（V 節）：由質量 2/3 反推中孔約 φ1.05 mm；[REG6] Sec.6-3 禁止自行鑽孔，只有官方中空軸能用',
      note: '[FHS]：中空軸受大衝擊較易彎曲；本專案不模擬彎曲',
    },
  },
  {
    id: 'gear-cover-standard',
    category: 'gear-cover',
    name: '馬達＋齒輪固定蓋（滑動卡榫蓋）',
    mass_g: 5.5,
    src: { mass_g: 'PARTS_RESEARCH [NAO] 玩家實測：齒輪蓋 5.5 g' },
  },
  // B14（iter-107）：VZ 底盤附屬的蓋子（[VZ 2.5]、[VZ 2.6]）
  {
    id: 'battery-cover-vz',
    category: 'battery-cover',
    name: '電池扣（VZ，上方扣住兩顆縱向電池）',
    mass_g: 1.0,
    src: { mass_g: '推估（[VZ 2.5]）：VS 有「ヒンジで開閉できるスイッチカバーとバッテリーホルダー」、VZ「VSから引き継ぐシャーシのレイアウト」→ 推估 VZ 也有；質量取 MA 電池蓋 1.6 g × 約 0.6' },
  },
  {
    id: 'gear-cover-vz',
    category: 'gear-cover',
    name: '後齒輪蓋（VZ，蓋住馬達後方的齒輪）',
    mass_g: 1.5,
    src: { mass_g: '推估（[VZ 2.5]）：[T18094]「ギヤカバーはワンタッチで取り外しOK」，只蓋後方齒輪，面積約 MA 齒輪蓋（5.5 g）的 1/4' },
  },
  {
    id: 'hardware-standard',
    category: 'hardware',
    name: '小五金：馬達座、端子固定件、車殼卡榫、導輪螺絲螺帽',
    mass_g: 3.0,
    src: { mass_g: 'PARTS_RESEARCH 推估：[NAO] 4.9 g 雜項群組扣掉中間齒輪、軸承、開關約 2.5 g，加車殼卡榫 0.4 g' },
  },
];
