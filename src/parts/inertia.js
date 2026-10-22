// 傳動系轉動慣量（第四階段 iter-54）：由零件的幾何與質量推導，換算到「輪軸」的等效轉動慣量 J_eq
//
// 推導（純滾動、4WD 前後軸機械連結）：
//   車速 v = ω_w·r（ω_w：輪子角速度，r：輪胎半徑）。動力鏈上每個轉動件 i 的角速度 ω_i = n_i·ω_w（n_i：相對輪軸的轉速比），
//   總動能 T = ½·m·v² + Σ ½·I_i·ω_i² = ½·(m + J_eq / r²)·v²，其中 J_eq = Σ I_i·n_i²。
//   - 輪胎＋輪框 ×4、輪軸 ×2、輪軸齒輪（spur）×2：n = 1
//   - 中間齒輪 ×2：n = r_spur / r_中間小齒（中間齒輪小齒帶動輪軸齒輪）
//   - 馬達電樞＋小齒輪 ×2：n = G（總齒輪比），所以電樞慣量要乘 G²
//   因此縱向運動的等效質量 = m + J_eq / r²（sim.js stepCar 以「轉動狀態＋純滾動約束衝量」實作，見該處說明）
//
// 幾何近似：每個件都拆成同軸的厚壁圓環 I = ½·m·(r_o² + r_i²)（實心圓柱 r_i = 0）；
// 六角軸 I = m·(5/12)·a²（iter-82 修正，原 5/24 少一半）（a = 邊長 = 外接圓半徑；2 mm 軸穿過內徑 2 mm 的培林，所以 2 mm 是對角寬）扣掉中孔
// 數值來源見各零件的 src 欄位；全部是推估（PARTS_RESEARCH 第四階段 R 節的方法）

/** @typedef {import('./types').SpinInertia} SpinInertia */

/** g·mm² → kg·m² */
const GMM2_TO_KGM2 = 1e-9;

/** @type {(m: number, ro: number, ri: number) => number} 厚壁圓環對自身軸的轉動慣量（g·mm²） */
export const ringInertia = (m, ro, ri) => 0.5 * m * (ro * ro + ri * ri);

/**
 * 輪框的質量分配與幾何（PARTS_RESEARCH 第四階段 R 節，依標準 low profile 輪框推估）：
 * 外圈（外徑 = 輪框外徑、壁厚 0.8 mm）52.1%、腹板（半徑 2.5 mm → 外圈內緣）30.9%、轂（半徑 1.0–2.5 mm）17.0%
 * @type {{ ring: number, web: number, hub: number, ringWall_mm: number, hubOuterR_mm: number, hubInnerR_mm: number }}
 */
export const RIM_LAYOUT = { ring: 0.521, web: 0.309, hub: 0.17, ringWall_mm: 0.8, hubOuterR_mm: 2.5, hubInnerR_mm: 1.0 };

/**
 * 輪框質量（g）：原始輪框質量扣掉腹板鏤空的部分（rimWebCutout = 腹板挖掉的比例，0 = 沒有鏤空）
 * @type {(rimBaseMass_g: number, rimWebCutout?: number) => number}
 */
export const rimMass = (rimBaseMass_g, rimWebCutout = 0) => rimBaseMass_g * (1 - RIM_LAYOUT.web * rimWebCutout);

/**
 * 單顆輪子（輪胎＋輪框）繞輪軸的轉動慣量（g·mm²）
 * 輪胎：厚壁圓環（外徑 diameter_mm、內徑 rimDiameter_mm）；輪框：外圈＋腹板（可鏤空）＋轂
 * @type {(w: any) => { tire: number, rim: number, total: number }}
 */
export function wheelInertia(w) {
  const R = w.diameter_mm / 2;
  const rr = w.rimDiameter_mm / 2;
  const cut = w.rimWebCutout ?? 0;
  const base = w.rimBaseMass_g;
  const L = RIM_LAYOUT;
  const rimRingIn = rr - L.ringWall_mm;
  const rimI =
    ringInertia(base * L.ring, rr, rimRingIn) +
    ringInertia(base * L.web * (1 - cut), rimRingIn, L.hubOuterR_mm) +
    ringInertia(base * L.hub, L.hubOuterR_mm, L.hubInnerR_mm);
  const tireMass = w.mass_g - rimMass(base, cut);
  const tireI = ringInertia(tireMass, R, rr);
  return { tire: tireI, rim: rimI, total: tireI + rimI };
}

/**
 * 六角輪軸（可中空）繞自身軸的轉動慣量（g·mm²）
 * 正六角形（邊長 a）截面極慣性矩 / 面積 = (5/12)·a²（J_p = (5√3/8)·a⁴、A = (3√3/2)·a²；iter-82 修正物理稽核 L2，原本誤寫 5/24）；
 * 中孔直徑 boreDiameter_mm 的部分以實心圓柱扣除
 * @type {(axle: any) => number}
 */
export function axleInertia(axle) {
  const a = axle.diameter_mm / 2;
  const hexArea = 1.5 * Math.sqrt(3) * a * a;
  const bore = axle.boreDiameter_mm ?? 0;
  const boreArea = (Math.PI / 4) * bore * bore;
  // 由零件質量反推實心六角的等效質量（質量 = 密度 × (六角 − 中孔) × 長）
  const solidMass = (axle.mass_g * hexArea) / (hexArea - boreArea);
  const boreMass = solidMass - axle.mass_g;
  return solidMass * (5 / 12) * a * a - 0.5 * boreMass * (bore / 2) ** 2;
}

/**
 * 馬達電樞（轉子）繞馬達軸的轉動慣量（g·mm²）：電樞視為均質實心圓柱 ½·m·r²（推估，見馬達零件 armature 的 src）
 * @type {(motor: any) => number}
 */
export const armatureInertia = (motor) => ringInertia(motor.armature.mass_g, motor.armature.diameter_mm / 2, 0);

/**
 * 整台車的傳動系轉動慣量，換算到輪軸（J_eq）
 * 齒輪件視為以節圓半徑為外徑的實心圓盤（質量來自齒輪組零件的 inertiaMasses_g；推估，偏大的上限：實際齒輪有腹板開孔）
 * @type {(p: Record<string, any>) => SpinInertia}
 */
export function drivetrainInertia(p) {
  const g = p.gear;
  const G = g.ratio;
  const gm = g.inertiaMasses_g;
  const wheel = wheelInertia(p.wheels).total;
  const axle = axleInertia(p.axles);
  const spur = ringInertia(gm.spur, g.spurPitchRadius_mm, 0);
  const counter = ringInertia(gm.counter, g.counterLargePitchRadius_mm, 0);
  const nCounter = g.spurPitchRadius_mm / g.counterSmallPitchRadius_mm;
  const pinion = ringInertia(gm.pinion, g.pinionPitchRadius_mm, 0);
  const arm = armatureInertia(p.motor);
  /** 各項換算到輪軸後的值（g·mm²） */
  const parts = {
    wheels: 4 * wheel,
    axles: 2 * axle,
    spurGears: 2 * spur,
    counterGears: 2 * counter * nCounter * nCounter,
    motor: (arm + 2 * pinion) * G * G,
  };
  const total_gmm2 = parts.wheels + parts.axles + parts.spurGears + parts.counterGears + parts.motor;
  const r = p.wheels.diameter_mm / 2;
  return {
    perItem_gmm2: { wheel, axle, spur, counter, pinion, armature: arm },
    reflected_gmm2: parts,
    total_gmm2,
    total_kgm2: total_gmm2 * GMM2_TO_KGM2,
    // 等效平移質量 J_eq / r²（g），方便和整車質量比較
    equivalentMass_g: total_gmm2 / (r * r),
  };
}
