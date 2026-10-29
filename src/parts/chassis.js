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
    motorPosition: 'mid',
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
  // B14（iter-107）：第二款底盤——後置單軸馬達＋傳動軸四驅（結構參考 Tamiya VZ）。來源與推估依據見 shared/reference/VZ_RESEARCH.md（以下 [VZ x.x] 指該檔節次）
  {
    id: 'chassis-vz',
    category: 'chassis',
    name: '後置單軸馬達傳動軸底盤（結構參考 VZ）',
    wheelbase_mm: 80,
    trackWidth_mm: 59.5,
    trackWidthRear_mm: 65.5,
    refWheelDiameter_mm: 26,
    groundClearanceRef_mm: 2.5,
    plateThickness_mm: 1.5,
    driveType: '4WD',
    motorLayout: 'single-shaft',
    motorPosition: 'rear',
    /** 馬達中心（橫置，軸沿 z、扁面朝上下）；y 由 componentLayout 依底板與馬達外殼決定 */
    motorMount_mm: { x: -28.5, z: 8 },
    /** 2 顆 AA 縱向並排：電池中心 x、左右電池中心 |z| */
    batteryBay_mm: { x: 8, z: 7.3 },
    /** 傳動軸（沿 x）：前後冠狀齒輪之間，位於電池外側 */
    propShaft_mm: { z: -17, y: 6.5 },
    /** 前保桿（螺絲固定、可拆）含在底盤質量；FRP 前寬架與保桿一起鎖（不切保桿，見 src.bumperTrim） */
    bumperTrim: false,
    mass_g: 14.0,
    com_mm: { x: 4.115481021121193, y: 6.032874348295693, z: 0.6548691602451742 },
    inertiaPerMass_mm2: { xx: 340.06049225500414, yy: 1927.7378568154418, zz: 1614.7958104683805, xy: 0.04958818927773834, xz: 27.113748618862807, yz: -2.7708989457093303 },
    bbox_mm: { min: { x: -62, y: 2.5, z: -36 }, max: { x: 64, y: 17, z: 36 } },
    bodyMounts: [
      { id: 'front', x: 52, y: 13, z: 0 },
      { id: 'rear', x: -50, y: 15, z: 0 },
    ],
    features: ['side-damper-mount'],
    /** 側壁（外緣立壁）：[x0, x1, 外緣 |z|]，厚 1.4、高 8.5 mm，立在底板上；3D 模型與側制振器干涉檢查共用 */
    sideWalls_mm: [[27, 55, 23.5], [-24, 24, 27], [-56, -27, 26.5]],
    sideWallHeight_mm: 8.5,
    /** 側制振器座（AR 側制振器 15459）：FRP 側板直接鎖在中段側壁頂面（y = 離地 2.5＋底板 1.5＋壁高 8.5），不加墊管 */
    sideDamperMount: { x_mm: 0, z_mm: 28.5, y_mm: 12.5, spacer_mm: 0 },
    bumperBottomY_mm: 5.4,
    bumperRollerX_mm: 71.5,
    bumperRollerZ_mm: 42,
    bumperThickness_mm: 2.4,
    density_g_cm3: 1.05,
    ballastMounts: { front: { x_mm: 67, z_mm: 0 }, center: { x_mm: 0, z_mm: 0 }, rear: { x_mm: -67, z_mm: 0 } },
    switchPos_mm: { x: 30, y: 20.6, z: 0 },
    src: {
      wheelbase_mm: '[VZ 2.1] [CS] 官方底盤一覽：VZ 軸距 80 mm',
      trackWidth_mm: '[VZ 2.1] [CS]：輪距前 59.5 mm',
      trackWidthRear_mm: '[VZ 2.1] [CS]：輪距後 65.5 mm',
      groundClearanceRef_mm: '[VZ 2.1] [CS]：離地 2.5 mm（26 mm 輪胎）',
      plateThickness_mm: '推估：同 chassis-midship 1.5 mm（VZ 底板厚度查不到）',
      motorLayout: '[VZ 2.2] [CS] 分類「リヤモーターシャーシ」、[AIDA]「VZシャーシは片軸」：後置單軸（片軸）馬達，馬達 → 中間齒輪 → 後輪軸齒輪＋後冠狀齒輪 → 傳動軸 → 前冠狀齒輪',
      motorMount_mm: '推估（[VZ 2.2]）：官方照片以軸距 80 mm 為比例尺量得馬達中心在後軸前約 10.5 mm（x ≈ −30，誤差約 ±2 mm）、偏離中線約 8 mm（左右無法判斷）。外殼 20.1 mm 寬，x −30 會和後輪軸重疊，所以取 −28.5（外殼後緣距後輪軸 0.3 mm）；z 取 +8（中間齒輪與輪軸齒輪在 +z 側）',
      batteryBay_mm: '推估（[VZ 2.2]）：照片量得電池倉 x 約 +32 ～ −18、中心 +7、縱向並排 z ±7.3；中心取 +8，讓電池後端（−17.25）與馬達外殼前緣（−18.45）留 1.2 mm',
      propShaft_mm: '推估：[VZ 2.2] 寫傳動軸沿中線，但中線會穿過電池；改放在電池外側 z −17（冠狀齒輪面），高度 = 輪軸 13 − 冠狀齒輪節圓 6.5。官方沒有尺寸圖',
      bumperTrim: '[VZ 2.4] [T15524]：VZ 專用 FRP 前寬架「可拆保桿直鎖底盤，或與保桿一起鎖（補強）」；本專案取後者，不切保桿',
      mass_g: '推估（[VZ 2.5]）：底盤塑膠本體 12 g（範圍 11–15 g；atwiki 12.1 g 只見於搜尋摘要，不算來源）＋前保桿 2.0 g（推估）。後導輪架另列 stay-rear-vz',
      com_mm: '由 3D 模型（model.js buildChassisVZ）底盤本體 ABS 網格的體積權重推導（同 chassis-midship iter-96 做法；網格 19,108 mm³ × ABS 1.05 ≈ 20.1 g，比 14 g 推估重，比例 0.70 與 MA 的 24.4/38.9 = 0.63 相近，同樣只取分布形狀）',
      inertiaPerMass_mm2: '同 com_mm：3D 模型網格分布，只取分布形狀，總質量用 mass_g',
      bbox_mm: '推估：由 3D 模型外形（不含導輪）',
      bodyMounts: '本專案的車殼安裝點（SPEC 1.14）。VZ 實車前卡榫約 x +50、後卡榫在後導輪架內側約 x −55（[VZ 2.6] 推估），與本專案定義差 2–5 mm；為了讓同一批車殼都能裝上，VZ 底盤的卡榫柱放在專案定義的位置（推估，等同換用對應的卡榫座）',
      features: '[VZ 3.1]：AR 側制振器 15459 官方一覽含 VZ → 提供側制振器座；MA 側制振器 15490 一覽不含 VZ（chassisCompat.js 擋下）',
      sideWalls_mm: '推估：由 VZ 套件照片目測的底盤外形（前段窄、中段最寬、後段配合後輪距），官方沒有尺寸圖',
      sideDamperMount: '推估（使用者 2026-10-28：查不到就照推估）：15459 的 FRP 側板要鎖在底盤側面，VZ 上的實際孔位查不到；取中段側壁（x ±24、外緣 z 27、頂面 y 12.5）——側板 6.5 mm 寬、中心 z 28.5 → z 25.25–31.75，完整壓在 1.4 mm 厚的壁頂上，不另加墊管；制振器（φ8）中心 z 28.5，內緣 24.5 在壁頂上方、不碰側壁，外緣 32.5 比 MA（37）窄',
      bumperBottomY_mm: '推估：同 chassis-midship（前保桿下緣 5.4 mm），VZ 保桿高度查不到',
      bumperRollerX_mm: '推估（[VZ 2.4]）：照片量得前導輪在前軸前約 30.6 mm → x ≈ +71；取 stay-front-standard 的 71.5（差 0.5 mm，在照片量測誤差內），保桿外形與導輪位置一致',
      bumperRollerZ_mm: '推估（[VZ 2.4]）：官方全寬 98 mm（14 mm 導輪）→ (98 − 14)/2 = 42',
      density_g_cm3: '[VZ 2.1] [T18094]「シャーシ本体とギヤカバーなどのAパーツはABS樹脂製」',
      switchPos_mm: '推估（[VZ 2.6]，低信心）：電池倉前端上方；只影響擺件與質量位置',
      ballastMounts: '同 chassis-midship（推估）',
    },
  },
];
