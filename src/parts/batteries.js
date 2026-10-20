// 電池組（2 顆 AA 串聯；SPEC 1.3）

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
      cellDiameter_mm: 'SPEC 1.9：Eneloop 規格書直徑 14.35 mm',
      cellLength_mm: '推估：AA 通用長度 50.5 mm',
    },
  },
];
