// 電池組（2 顆 AA 串聯；SPEC 1.3）

// iter-92: central inertia uses the existing outer dimensions and placed mass.
// Uniform internal density is an estimate; chemistry-specific layers are not measured.
const INERTIA_SRC = '推估：按既有每顆質量與外徑／長度，視為沿車體x的均質圓柱；Ixx=mr²/2、Iyy=Izz=m(3r²+L²)/12。非電芯內部材料分布實測。';

/** @type {import('./types').PartBase[]} */
export const batteryParts = [
  {
    id: 'battery-aa-nimh-950',
    category: 'battery',
    name: '2 × AA NiMH 充電電池（950 mAh 等級）',
    chemistry: 'NiMH',
    size: 'AA',
    cells: 2,
    nominalCellVoltage_V: 1.2,
    capacity_mAh: 950,
    cellInternalResistance_ohm: 0.04,
    cellOcvCurve: [[0.0, 1.0], [0.05, 1.05], [0.1, 1.12], [0.2, 1.18], [0.5, 1.23], [0.8, 1.27], [0.9, 1.3], [1.0, 1.4]],
    cutoffCellVoltage_V: 1.0,
    cellMass_g: 19,
    cellDiameter_mm: 14.35,
    cellLength_mm: 50.5,
    /** 整組質量（cells × cellMass_g） */
    mass_g: 38,
    src: {
      capacity_mAh: 'SPEC 1.3：950 mAh 等級（Tamiya 15420 頁面）',
      nominalCellVoltage_V: 'SPEC 1.3：NiMH 1.2 V/顆',
      cellInternalResistance_ohm: 'SPEC 1.3：DC 內阻 40 mΩ/顆（推估）',
      cellOcvCurve: 'SPEC 1.3：開路電壓 vs SOC 分段線性（推估）',
      cutoffCellVoltage_V: 'SPEC 1.3：1.0 V/顆',
      cellMass_g: 'SPEC 1.3：約 19 g/顆',
      inertia: INERTIA_SRC,
      cellDiameter_mm: 'SPEC 1.9：Eneloop 規格書直徑 14.35 mm',
      cellLength_mm: '推估：AA 通用長度 50.5 mm',
    },
  },
  // ---- 第四階段（iter-54）：鹼性 AA 與高容量 NiMH（規則檢查只看類別 2 × AA，品牌不檢查，SPEC 1.1） ----
  {
    id: 'battery-aa-alkaline',
    category: 'battery',
    name: '2 × AA 鹼性乾電池（LR6，Power Champ RX 等級）',
    chemistry: 'alkaline',
    size: 'AA',
    cells: 2,
    nominalCellVoltage_V: 1.5,
    // 大電流（約 2 A）放電時的有效容量（標稱 2.4 Ah 在低負載才有）
    capacity_mAh: 1000,
    cellInternalResistance_ohm: 0.2,
    // 每顆內阻隨 SOC：0.20 Ω（全新）→ 0.50 Ω（放完）
    cellResistanceCurve: [[0.0, 0.5], [1.0, 0.2]],
    cellOcvCurve: [[0.0, 0.9], [0.1, 1.0], [1.0, 1.6]],
    cutoffCellVoltage_V: 0.9,
    cellMass_g: 23.0,
    cellDiameter_mm: 14.5,
    cellLength_mm: 50.5,
    mass_g: 46.0,
    src: {
      grade: 'PARTS_RESEARCH 第四階段 P 節：Tamiya 合法鹼性電池 Power Champ RX（[T55119]）沒有公布重量 / 內阻 / 容量，以 Energizer E91、Duracell 同尺寸鹼性電池規格代表（同類產品推估）',
      cellOcvCurve: 'PARTS_RESEARCH P 節：新品開路約 1.60 V（[EALK]「Open circuit voltage = 1.6 Volts」）；斜坡放電曲線 1.6 → 0.9 V（[EALK]），建模為 SOC 1 → 0.1 線性 1.6 → 1.0 V、末段降到 0.9 V（推估）',
      cellInternalResistance_ohm: 'PARTS_RESEARCH P 節：[E91]「Nominal IR: 150 to 300 milliohms (fresh)」；1 kHz 阻抗 181 mΩ（[LYGDUR]）→ 建模 0.20 Ω/顆（推估）',
      cellResistanceCurve: 'PARTS_RESEARCH P 節：[EALK]「internal resistance will rise during discharge」；R(SOC) = 0.20 × (1 + 1.5·(1 − SOC))，倍率是推估',
      capacity_mAh: '推估（P 節）：標稱約 2.4 Ah，但 2 A 等級放電的有效容量建議只取 1.0 Ah（[LYGDUR]「1 W 定功率約 900 mAh」只見於搜尋摘要）',
      cutoffCellVoltage_V: 'PARTS_RESEARCH P 節：[EALK] 放電終止 0.9 V/顆',
      cellMass_g: 'PARTS_RESEARCH P 節 [E91]：「Typical Weight: 23.0 grams」',
      inertia: INERTIA_SRC,
      mass_g: '2 × 23.0 g（[E91]；Duracell 23.8 g [LYGDUR]）',
      cellDiameter_mm: '推估：AA（LR6）IEC 尺寸 13.5–14.5 mm，取上限',
      cellLength_mm: '推估：AA 通用長度 50.5 mm',
    },
  },
  {
    id: 'battery-aa-nimh-2500',
    category: 'battery',
    name: '2 × AA NiMH 高容量充電電池（2500 mAh 等級）',
    chemistry: 'NiMH',
    size: 'AA',
    cells: 2,
    nominalCellVoltage_V: 1.2,
    capacity_mAh: 2500,
    cellInternalResistance_ohm: 0.05,
    cellOcvCurve: [[0.0, 1.0], [0.05, 1.05], [0.1, 1.12], [0.2, 1.18], [0.5, 1.23], [0.8, 1.27], [0.9, 1.3], [1.0, 1.4]],
    cutoffCellVoltage_V: 1.0,
    cellMass_g: 30.0,
    cellDiameter_mm: 14.5,
    cellLength_mm: 50.5,
    mass_g: 60.0,
    src: {
      grade: 'PARTS_RESEARCH 第四階段 P 節 [ENPRO]：eneloop pro BK-3HCDE 等級（Tamiya 現行只有 Neo Champ 一款 NiMH；本專案規則檢查只看 2 × AA 類別，不檢查品牌，SPEC 1.1）',
      capacity_mAh: '[ENPRO]「Capacity Minimum 2500mAh」',
      cellInternalResistance_ohm: '[ENPRO]「Internal Impedance Approx. 40mΩ(at 1KHz)」；DC 建模取 50 mΩ（推估：比 AC 值高約 25%，與 SPEC 1.3 由 25 → 40 mΩ 的放大比例一致）',
      cellOcvCurve: '同 battery-aa-nimh-950（SPEC 1.3 推估曲線）',
      cellMass_g: '[ENPRO]「Weight Approx. 30 g」',
      inertia: INERTIA_SRC,
      mass_g: '2 × 30 g（[ENPRO]）',
      cellDiameter_mm: '推估：AA 上限 14.5 mm',
    },
  },
];
