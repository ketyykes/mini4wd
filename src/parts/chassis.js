// 底盤本體（只算塑膠底盤＋前後保桿；導輪架、導輪、齒輪、軸承等另列為零件）
// 座標：底盤座標 = 搭配 refWheelDiameter_mm 輪胎時的車體座標（x 向前、y 向上、z 向右，原點在前後軸中點的地面，mm）
// 換不同直徑的輪胎時，整個底盤（含導輪、車殼）一起升降 (D − refWheelDiameter) / 2

/** @type {import('./types').PartBase[]} */
export const chassisParts = [
  {
    id: 'chassis-midship',
    category: 'chassis',
    name: '中置雙軸馬達一體式底盤（結構參考 MA）',
    wheelbase_mm: 80,
    trackWidth_mm: 59.5,
    refWheelDiameter_mm: 26,
    groundClearanceRef_mm: 2.2,
    plateThickness_mm: 1.5,
    driveType: '4WD',
    motorLayout: 'dual-shaft',
    mass_g: 24.4,
    /** 底盤本體質心（底盤座標） */
    com_mm: { x: 0, y: 6.5, z: 0 },
    /** 底盤本體（不含導輪架與導輪）的外框，底盤座標 */
    bbox_mm: { min: { x: -64, y: 2.2, z: -36 }, max: { x: 64, y: 17, z: 36 } },
    /** 車殼安裝點（SPEC 1.14）：前後各 1 組卡榫，所有車殼都要對齊 */
    bodyMounts: [
      { id: 'front', x: 52, y: 13, z: 0 },
      { id: 'rear', x: -50, y: 15, z: 0 },
    ],
    /** 開關位置（底盤座標，開關零件質心） */
    switchPos_mm: { x: -30, y: 6, z: -24 },
    src: {
      wheelbase_mm: 'SPEC 1.2 [CS]：MA 軸距 80 mm',
      trackWidth_mm: 'SPEC 1.2 [CS]：MA 輪距 59.5 mm',
      refWheelDiameter_mm: 'SPEC 1.12：預設 26 mm 小徑輪胎；離地 2.2 mm 是這個輪徑下的值',
      groundClearanceRef_mm: 'SPEC 1.2 [CS]：MA 離地 2.2 mm',
      plateThickness_mm: 'SPEC 1.9：底板厚約 1.5 mm（推估）',
      mass_g: 'PARTS_RESEARCH [NAO] 玩家實測：MA 底盤 24.4 g（未加工，不含齒輪蓋）；前保桿與底盤一體成型，含在內',
      com_mm: '推估：底板＋側壁＋保桿的幾何中心，底板在 2.2–3.7 mm、側壁高到約 9.4 mm、保桿約 5–8 mm',
      bbox_mm: '由 iter-31 模型量測（不含導輪架上的導輪座）',
      bodyMounts: '本專案定義（SPEC 1.14，第 0 輪決定）',
    },
  },
];
