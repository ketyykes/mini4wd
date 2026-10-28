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
    /** 底盤本體質心（底盤座標）：iter-96 起由 3D 模型 ABS 底盤網格的體積權重推導（見 inertiaPerMass_mm2） */
    com_mm: { x: -0.1801481302498697, y: 6.573273507557011, z: -0.2144887294876264 },
    /**
     * 底盤本體（未切保桿）對自身質心、每 g 的慣性張量（mm²；乘質量 g → g·mm²）。iter-96（B3）：取代「整個外框實心方塊」。
     * 由 model.js 底盤本體 ABS 網格（abs-chassis-gunmetal）體積積分；網格有重疊、比實物厚，只當分布權重，總質量用實測 mass_g。
     * 一致性測試 P14_component_tensors（tests/inertia.test.js）由模型重算比對
     */
    inertiaPerMass_mm2: { xx: 498.2342875083376, yy: 2609.553738719728, zz: 2157.5391007841904, xy: 38.01552627865167, xz: -16.56920833419538, yz: 2.9937155134995295 },
    /** 底盤本體（不含導輪架與導輪）的外框，底盤座標 */
    bbox_mm: { min: { x: -64, y: 2.2, z: -36 }, max: { x: 64, y: 17, z: 36 } },
    /** 車殼安裝點（SPEC 1.14）：前後各 1 組卡榫，所有車殼都要對齊 */
    bodyMounts: [
      { id: 'front', x: 52, y: 13, z: 0 },
      { id: 'rear', x: -50, y: 15, z: 0 },
    ],
    /** 底盤提供的安裝點（選配零件的 compat.requires 要對得上） */
    features: ['side-damper-mount'],
    /** 側制振器固定中心；安裝面高度由共用側裙幾何推導（底盤座標） */
    sideDamperMount: { x_mm: 0, z_mm: 33 },
    /** 前後保桿下緣高度（底盤座標，與 model.js 保桿一致）：導輪板、煞車海綿、前後配重都鎖在這個面下方 */
    bumperBottomY_mm: 5.4,
    /** 前後保桿（底盤一體）上的導輪座位置：保桿外形以此為準；FRP / 碳纖導輪板另外決定導輪位置 */
    bumperRollerX_mm: 71.5,
    bumperRollerZ_mm: 42,
    /** 一體寬保桿板厚（與 model.js 保桿相同）；保桿切除的質量 = 切除體積 × 底盤材料密度（parts/bumperGeom.js） */
    bumperThickness_mm: 2.4,
    /** 底盤材料密度（ABS，SPEC 1.14） */
    density_g_cm3: 1.05,
    /** 配重安裝點：front / rear 鎖在前後保桿（或導輪板）下方；center 貼在齒輪蓋頂面（y 由組裝計算） */
    ballastMounts: { front: { x_mm: 67, z_mm: 0 }, center: { x_mm: 0, z_mm: 0 }, rear: { x_mm: -67, z_mm: 0 } },
    /** 開關位置（底盤座標，開關零件質心） */
    switchPos_mm: { x: -21, y: 20.6, z: -19.2 },
    src: {
      wheelbase_mm: 'SPEC 1.2 [CS]：MA 軸距 80 mm',
      trackWidth_mm: 'SPEC 1.2 [CS]：MA 輪距 59.5 mm',
      refWheelDiameter_mm: 'SPEC 1.12：預設 26 mm 小徑輪胎；離地 2.2 mm 是這個輪徑下的值',
      groundClearanceRef_mm: 'SPEC 1.2 [CS]：MA 離地 2.2 mm',
      plateThickness_mm: 'SPEC 1.9：底板厚約 1.5 mm（推估）',
      mass_g: 'PARTS_RESEARCH [NAO] 玩家實測：MA 底盤 24.4 g（未加工，不含齒輪蓋）；前保桿與底盤一體成型，含在內',
      com_mm: 'iter-96：由 3D 模型底盤本體 ABS 網格體積權重推導（37,045 mm³；原推估「底板＋側壁＋保桿的幾何中心」(0, 6.5, 0) 與此相差 < 0.3 mm）',
      inertiaPerMass_mm2: '推估分布：3D 模型（與外觀同一份）底盤本體網格的體積權重；網格體積 × ABS 密度約 38.9 g，大於實測 24.4 g（模型偏厚、零件重疊），所以只取分布形狀、總質量用實測值。尚無實測慣性',
      bbox_mm: '由 iter-31 模型量測（不含導輪架上的導輪座）',
      bodyMounts: '本專案定義（SPEC 1.14，第 0 輪決定）',
      sideDamperMount: '推估：x=0、z=±33；安裝面由 chassisGeom 側裙頂面（5.3 mm）推導。搭配 15473 的 6 mm 鋁墊管（官方長度）、1.5 mm FRP 側板及 1 mm 可壓縮座墊（推估），配重底面 13.8 mm；不再把舊 y=2 mm 當成可穿過側裙的座位。外側壁實際 z=±35–36.2，由共用幾何檢查間隙。',
      density_g_cm3: 'SPEC 1.14 / PARTS_RESEARCH 3.1：ABS 1.05 g/cm³（MA 底盤材質以 ABS 推估）',
      bumperThickness_mm: '推估：模型保桿板厚 2.4 mm（iter-35 外形）',
      ballastMounts: '推估：配重常見貼在前後保桿下方或底盤上方；本專案提供前、中、後三處',
    },
  },
];
