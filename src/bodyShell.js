// Chevalier（MA）車殼：以參考照片（shared/reference/ref_chevalier-ma_*）判讀的截面放樣
// 單位 mm；車體座標 x 向前、y 向上、z 向右，原點在前後軸中點的地面上
// 曲面 S(x, u)：x 為縱向位置，u ∈ [0, 1] 為截面上「中線（0）→ 葉子板稜線（0.4）→ 側面最寬處（0.8）→ 底緣（1）」的參數
// 條紋、頭燈、散熱口等用「貼在曲面上的獨立薄片幾何」（ribbon），邊緣是幾何邊，不會有頂點色的鋸齒
import * as THREE from 'three';
import { spec } from './spec.js';

/**
 * 以 Hermite 三次曲線內插表格（切線取前後差分），比 smoothstep 分段更平順，不會在節點產生平台
 * @param {number[][]} table [[x, y], ...]，x 遞減或遞增皆可
 * @param {number} x
 */
function smoothTable(table, x) {
  const pts = table[0][0] < table[table.length - 1][0] ? table : table.slice().reverse();
  const n = pts.length;
  if (x <= pts[0][0]) {
    return pts[0][1];
  }
  if (x >= pts[n - 1][0]) {
    return pts[n - 1][1];
  }
  let i = 0;
  while (x > pts[i + 1][0]) {
    i++;
  }
  const slope = (k) => {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(n - 1, k + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  const [x0, y0] = pts[i];
  const [x1, y1] = pts[i + 1];
  const h = x1 - x0;
  const t = (x - x0) / h;
  const m0 = slope(i) * h;
  const m1 = slope(i + 1) * h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
}

/** Catmull-Rom 一維內插：pts 為控制點陣列 [{z, y}]，u ∈ [0,1] 均分在各段 */
function catmull(pts, u) {
  const segs = pts.length - 1;
  const f = Math.min(segs - 1e-9, Math.max(0, u * segs));
  const i = Math.floor(f);
  const t = f - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(segs, i + 2)];
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  return { z: cr(p0.z, p1.z, p2.z, p3.z), y: cr(p0.y, p1.y, p2.y, p3.y) };
}

// ---- 車殼輪廓表（推估：依 ref_chevalier-ma_side-high / front34 / rear34 / hood-detail 目視比例；
//      全長以 SPEC 1.12 外框 156 mm 換算，軸距 80 mm 對照照片中的輪心位置）----
export const BODY_FRONT_X = 73;
export const BODY_REAR_X = -63;
/** 半寬：前葉子板寬、座艙兩側內收、後輪拱外擴 */
// iter-03：依 reviewer「車鼻前緣太薄太低、車尾太厚太方」重量比例（ref side-high / front34 / rear34）：
//   車鼻：前葉子板在鼻端仍高（頭燈位於前臉中段），前臉厚約 10 mm → 鼻端中線 8 → 12.5、稜線 11.5 → 18.5、鼻端半寬 25 → 30
//   車尾：後甲板往車尾下降、平面收窄（尾燈面低而圓）→ 車尾中線 28 → 21.5、稜線 28.4 → 23.5、尾端半寬 35 → 31.5
// iter-07：reviewer「後段座艙與尾部隆起不夠、尾部缺寬大後輪拱外擴」（ref side-high / rear34：後葉子板明顯外擴、車尾厚實方正）
//   後段半寬 −24…−63：41/42/41.6/39.8/36.5/31.5 → 41.8/43/43/41.8/39.2/34.5（全寬 86 mm，仍小於導輪跨距 97 mm）
// iter-19：輪拱處半寬收窄、收腰減輕（主 agent／reviewer iter-18「俯視啞鈴形、腰身太窄、輪拱鼓太大」；
//   iter-18 量測：輪胎外側面 z = 輪距/2 + 胎寬/2 = 34.25 mm，車殼側面前 40／後 43 mm，內縮 6–9 mm，參考近乎齊平）
//   → 前輪拱 40 → 37、後輪拱 43 → 39、座艙下方 38 → 36.3；前後與腰身差由 2／5 mm 減為 0.7／2.7 mm，俯視輪廓較平直。
//   輪拱唇邊 z = 半寬 − 1.8 → 前 35.2／後 37.2，仍蓋在輪胎外側面（34.25）之外（推估，SPEC 未給車殼寬）
const HALF_WIDTH = [[73, 29], [66, 33.4], [56, 35.6], [46, 36.8], [36, 37], [24, 36.7], [12, 36.4], [0, 36.3], [-12, 36.9], [-24, 38.2], [-34, 39], [-44, 39], [-52, 38.2], [-58, 36.2], [-63, 32]];
/** 中線高度：鼻端（厚）→ 引擎蓋 → 座艙下緣 → 後甲板往車尾下降 */
// iter-07：後甲板加高、車尾不再往下收（ref side-high：座艙後方到車尾近乎水平，尾端厚實）→ −34…−63 中線 +1…+3.5 mm
// iter-11：擋風玻璃下緣（中線）24.6 → 27.2 mm（推估：ref side-high 像素量測反推 x ≈ 18 mm 處約 27.4 mm，見 ITERATION_LOG iter-11），
//   引擎蓋後段（x 36…12）跟著墊高 1.2–2.6 mm，減少前葉子板到座艙的凹腰；座艙下方（x ≤ 0）不動
// iter-13：引擎蓋中央大幅墊高（推估：擬合相機量 ref side-high 中線，徽章騎士頭 x ≈ 49.5 / y ≈ 27.2、進氣罩前端頂 x ≈ 31.7 / y ≈ 30.4，
//   見 ITERATION_LOG iter-13）：x 66…24 由 16.5/18.5/20.8/23.0/25.4 → 17.5/24.0/27.4/28.8/28.2（含隆起後 x 40 約 29.7），
//   消除前葉子板與引擎蓋之間 6–7 mm 的深谷，形成往擋風玻璃上揚的楔形
// iter-14：取 iter-12（深谷 6–7 mm）與 iter-13（幾乎填平）的中間值：中線 x 56…24 略降 0.4–0.5 mm（24.0/27.4/28.8/28.2 → 23.5/26.9/28.3/27.9），
//   搭配下方前葉子板稜線升高約 1.5 mm，讓葉子板稜線比引擎蓋中線（含隆起）高約 1.5–2 mm，保留輕微 S 形起伏（主 agent iter-13 決策）
// iter-16：座艙下方中線（x 12…−24）降 0.8–1.6 mm（27.2/25.6/26.6/28.2 → 26.4/24.2/25.0/27.0），與下方車門腰線一起壓低，
//   讓座艙側窗露出更高（reviewer iter-15「腰線到車頂落差大」）；x ≥ 24 引擎蓋、x ≤ −34 後甲板不動（iter-15 後甲板反光退步）
const CENTER_Y = [[73, 14], [66, 17.3], [56, 23.5], [46, 26.9], [36, 28.3], [24, 27.9], [12, 26.4], [0, 24.2], [-12, 25.0], [-24, 27.0], [-34, 29.8], [-44, 30.8], [-52, 30.2], [-58, 28.4], [-63, 25.0]];
/** 葉子板稜線高度：前輪上方隆起高於引擎蓋（鼻端仍高），後輪上方再隆起後往車尾下降 */
// iter-07：後葉子板稜線加高（ref side-high：後輪上方隆起約為車頂高的 85–90%）
// iter-11：前葉子板稜線 30.5 → 31.5 mm（ref 量測約 30.6–31.0，取略高補償俯拍誤差）、座艙前方腰線 x 24…−12 墊高 0.8–1.8 mm（減少凹腰）；後段不變
// iter-13：前葉子板稜線 x 66…24 由 24.4/29.3/31.5/31.5/30.0 → 23.8/27.6/29.0/29.2/29.0（推估：擬合相機疊圖上，近側稜線與遠側輪廓
//   都比參考照高約 15–20 px ≈ 3 mm；只降 2.3 mm，保守取值），不再像浮筒高出引擎蓋
// iter-14：前葉子板稜線 x 66…24 升高約 1.5 mm（23.8/27.6/29.0/29.2/29.0 → 24.3/28.9/30.5/30.7/30.0；介於 iter-12 31.5 與 iter-13 29.2 之間），
//   reviewer iter-13「前葉子板峰值變低、S 形起伏比基準弱」
// iter-16：車門區腰線（葉子板稜線在前後輪之間的部分）壓低 2.2–2.6 mm：x 24…−24 由 30.0/28.8/28.2/29.2/31.2 → 29.4/26.4/25.6/26.8/30.2；
//   前輪上方（x ≥ 36）與後輪上方（x ≤ −34）的峰值不動，前後輪拱因此讀成兩個鼓包（推估：ref side-high 車門腰線約在橘色條紋高度，
//   明顯低於前後葉子板峰值；iter-15 reviewer「腰線到車頂落差大」）
const FENDER_Y = [[73, 18.5], [66, 24.3], [56, 28.9], [46, 30.5], [36, 30.7], [24, 29.4], [12, 26.4], [0, 25.6], [-12, 26.8], [-24, 30.2], [-34, 32.6], [-44, 33.0], [-52, 32.2], [-58, 30.6], [-63, 27.0]];
/** 稜線位置（佔半寬的比例） */
// iter-13：前段稜線略往內收（56／36：0.76／0.77 → 0.74／0.75），配合疊圖上遠側輪廓偏高
// iter-16：車門區稜線往內收（x 8…−8：0.86 → 0.72，約 z 32.7 → 27.4），讓腰線貼近座艙側窗底緣、車門側面變成往下外擴的斜面，
//   減少座艙兩側的平台面積（推估：ref side-high／front34 側窗底緣幾乎直接接車門側面，前後葉子板才往外鼓出）
// iter-16（同上，擬合相機反投影）：近側與遠側同一葉子板頂的像素同時成立時，前葉子板稜線約在 z ≈ 27、y ≈ 29，後葉子板約在 z ≈ 24、y ≈ 32.6
//   （本模型為 z 30／34、y 30.7／34.0）→ 稜線整體往內移：前段 0.74／0.75 → 0.70／0.69、後段 0.79／0.76 → 0.62／0.66
const FENDER_Z = [[73, 0.8], [56, 0.70], [36, 0.69], [20, 0.70], [8, 0.68], [-8, 0.68], [-20, 0.66], [-34, 0.62], [-63, 0.66]];
/** 側面最寬處的高度 */
const SIDE_Y = [[73, 12.5], [66, 13], [56, 13], [46, 14], [-50, 14], [-58, 13.5], [-63, 13]];
/** 車殼底緣：iter-02 為 5.6 mm，與底盤側框之間縫隙偏大 → 4.4 mm（底板上緣 3.7 mm） */
// iter-05：reviewer「車殼底緣離底盤太近像一整塊」（ref side-high：車殼下方露出一層黑色底盤側框）→ 4.4 → 6.4 mm
// iter-12：ref side-high 擬合相機量測（推估 ±0.5 mm）：車門下緣（x ≈ 3、近側）y ≈ 8.8 mm，下方露出黑色底盤側裙 → 6.4 → 8.6 mm
const BOTTOM_Y = 8.6;
/** 輪拱半徑：iter-02 輪胎外 2.5 mm 間隙偏大 → 1.8 mm */
// iter-05：reviewer「輪胎露出比例小、輪拱開口大」（ref side-high：輪拱開口明顯大於輪胎）→ 1.8 → 2.8 mm
// iter-07：reviewer「輪拱上緣空隙偏大」→ 2.8 → 1.8 mm
// iter-13：reviewer「輪拱上方黑色內襯空隙明顯（參考輪胎填滿輪拱）」→ 1.8 → 1.0 mm（輪胎外徑 26 mm 不變；輪拱頂離胎面 0.5 mm）
// （iter-13～17：ARCH_R = 輪胎半徑 + 1.0，圓心 = 輪心 − 0.5）
// iter-18：五位 reviewer（iter-12、13、15、16、17）一致指出「輪拱上緣把輪胎蓋掉太多、輪子埋太深」。
//   原因（scripts/diag/overlay_wheel.mjs 擬合相機量測）：輪胎外側面在 z = 輪距/2 + 胎寬/2 = 34.25 mm，車殼側面在前 40／後 43 mm，
//   24° 俯拍時輪拱唇邊（z = 半寬 − 1.8）擋住輪胎上緣：前輪被遮 8 px、後輪 16 px（輪胎直徑 133 px）。
//   輪胎外徑 26 mm、輪距不可改 → 輪拱開口改為「圓心上移＋半徑加大」，讓唇邊高過「輪胎頂外緣往相機的視線」：
//   視線斜率 tan 25.75° ≈ 0.48，前唇邊需 ≥ 26 + (38.2 − 34.25)·0.48 ≈ 27.9、後唇邊 ≥ 26 + (41.2 − 34.25)·0.48 ≈ 29.3；
//   再加唇邊圓珠（ARCH_LIP_R）下緣約 0.2 mm → 開口頂取前 28.2、後 29.1 mm（後輪保留約 0.4 mm 遮擋，避免側視黑縫過大）。
//   側邊間隙前 1.5／後 1.8 mm（ref side-high 輪拱與輪胎約等距同心、間隙約 1.5 mm，推估）
// iter-19：車殼半寬收窄後唇邊 z 前 35.2／後 37.2，24° 視線遮擋大幅減少，iter-18 的開口頂（28.2／29.1）在 sidehigh 讓輪胎上方露出 8 px 空隙
//   → 依 overlay_wheel.mjs 重量：前 lift 0.7 → −0.2、r +1.5 → +1.2（開口頂 27.0）；後 lift 1.3 → 0.5、r +1.8 → +1.5（開口頂 28.0），
//   sidehigh 輪拱邊皆在胎頂上方 2 px（約 0.4 mm），側邊間隙前 1.2／後 1.5 mm
/** 每個輪拱的開口圓：圓心高 = 輪心 + lift，半徑 r（mm） */
const ARCHES = [
  { x: spec.chassis.wheelbase_mm / 2, lift: -0.2, r: spec.tire.diameter_mm / 2 + 1.2 },
  { x: -spec.chassis.wheelbase_mm / 2, lift: 0.5, r: spec.tire.diameter_mm / 2 + 1.5 },
];

/** 車殼底緣（含前後輪拱開口） */
function bottomAt(x) {
  const wheelY = spec.tire.diameter_mm / 2;
  let y = BOTTOM_Y;
  // 車尾下緣往上收（尾燈下方的擴散器開口，看得到底盤；ref rear34）
  if (x < -54) {
    const t = (-54 - x) / 9;
    y = BOTTOM_Y + (9.9 - BOTTOM_Y) * t * t;
  }
  // 車鼻下緣往上收到 10 mm（ref front34：鼻端下方露出黑色保桿與導輪臂，車殼不罩住保桿；導輪臂頂 ≈ 10 mm）
  if (x > 55) {
    const t = Math.min(1, (x - 55) / 10);
    y = BOTTOM_Y + (10.4 - BOTTOM_Y) * t * t * (3 - 2 * t);
  }
  for (const a of ARCHES) {
    const dx = x - a.x;
    if (Math.abs(dx) < a.r) {
      y = Math.max(y, wheelY + a.lift + Math.sqrt(a.r * a.r - dx * dx));
    }
  }
  return y;
}

/** 引擎蓋中央隆起高度（mm） */
const BULGE_H = 1.2;
/** 平滑 max：|a − b| ≫ k 時等於 max，兩者相等時多 k / 2，以雙曲線過渡（C∞，不會有折角） */
const softMax = (a, b, k) => 0.5 * (a + b + Math.sqrt((a - b) * (a - b) + k * k));

/**
 * 肩部控制點（z = 半寬 − 0.7）比葉子板稜線低多少（mm）
 * iter-16：3.2 → 6.0。擬合相機把 ref side-high 遠側輪廓反投影（scripts/diag/measure_ref.mjs）：遠側後葉子板頂 (700, 216) 在 y 30 時 z ≈ 28.7、
 *   遠側前葉子板 (260, 228) 在 y 28 時 z ≈ 29.1；本模型肩部在 z ≈ 39–42 仍有 y 27–31，遠側輪廓比參考高 25–35 px（見 overlay_full.mjs）。
 *   參考的葉子板從稜線往外是圓滑下降到側面，而不是平台延伸到最寬處 → 肩部壓低，俯拍時露出的頂面面積減少
 */
const SHOULDER_DROP = 6.0;

/** 某 x 截面的半邊控制點（中線 → 底緣） */
function sectionPoints(x) {
  const w = smoothTable(HALF_WIDTH, x);
  const yc = smoothTable(CENTER_Y, x);
  const yb = bottomAt(x);
  // iter-13：輪拱把側面往上推的三個 max 改成平滑 max（softMax），避免輪拱上方的肩線出現折角（rear34 引擎蓋反光成塊狀）
  const ys = softMax(smoothTable(SIDE_Y, x), yb + 0.9, 1.0);
  const shoulder = softMax(smoothTable(FENDER_Y, x) - SHOULDER_DROP, ys + 0.8, 1.0);
  const yf = softMax(smoothTable(FENDER_Y, x), shoulder + 0.6, 1.0);
  const zf = w * smoothTable(FENDER_Z, x);
  // 引擎蓋中央隆起（power bulge，ref_chevalier-ma_hood-detail：中央高、兩側凹槽、再到葉子板稜線）
  // iter-13：中線整體墊高後，隆起 1.8 → BULGE_H，兩側凹槽改用平滑後的 bulgeS（原本 bulgeT 在 x = 40 有折角）
  const bulgeT = Math.max(0, 1 - Math.abs(x - 40) / 24);
  const bulgeS = bulgeT * bulgeT * (3 - 2 * bulgeT);
  const bulge = BULGE_H * bulgeS;
  // iter-13：引擎蓋中央墊高到接近葉子板後，原本「中線＋12% 高差」的中段控制點會在中線與稜線之間挖出 1–2 mm 的 W 形凹槽，
  //   rear34／front34 的燈箱倒影因此變成塊狀；改為中線與稜線的平均（中央隆起處只留 0.3 mm 的淺槽），截面成為平順的弧
  //   遠離引擎蓋（座艙下方、後甲板）時中線仍明顯低於稜線，保留原本 12% 的權重
  // iter-14：crown 原為線性 clamp（x = 8、20 兩處斜率不連續 → 中段控制點有折線，rear34 引擎蓋／葉子板反光出現不連續亮塊），改 smoothstep
  const crownT = Math.min(1, Math.max(0, (x - 8) / 12));
  const crown = crownT * crownT * (3 - 2 * crownT);
  const midY = (1 - crown) * (yc + 0.12 * (yf - yc)) + crown * (0.5 * (yc + bulge + yf)) - 0.3 * bulgeS;
  return [
    { z: 0, y: yc + bulge },
    { z: zf * 0.5, y: midY },
    { z: zf, y: yf },
    { z: w - 0.7, y: shoulder },
    { z: w, y: ys },
    { z: w - 1.8, y: yb },
  ];
}

/**
 * 車殼曲面上的點
 * @param {number} x
 * @param {number} u 0（中線）→ 1（底緣）
 * @param {number} side +1 右、−1 左
 */
export function bodyPoint(x, u, side = 1) {
  const pts = sectionPoints(x);
  // 中線對稱：在前面補一個鏡射點，讓中線處切線水平
  const ext = [{ z: -pts[1].z, y: pts[1].y }, ...pts];
  const segs = pts.length - 1;
  const f = u * segs;
  const q = catmull(ext, (f + 1) / (segs + 1));
  // iter-14：中線 → 葉子板稜線（u 0…0.4）改用單一多項式 y(z)，取代兩段 Catmull-Rom：
  //   控制點橫向間距不均（中線→中段 15 mm、稜線→肩線 9 mm、肩線→最寬處 0.7 mm），曲率集中在 u = 0.2 的節點，
  //   rear34／front34 引擎蓋與葉子板反光成不連續的斑駁亮塊（reviewer iter-13）。z(u) 不變（貼紙、百葉的 u 位置不動），
  //   y 改為三次 Hermite（中線斜率 0；稜線處斜率取 Catmull 在該節點的幾何斜率，維持 C1）＋ t²(1−t)² 修正項過中段控制點
  if (u < 0.4) {
    const zf = pts[2].z;
    const t = Math.min(1, Math.max(0, q.z / zf));
    const y0 = pts[0].y;
    const yf = pts[2].y;
    const mf = ((pts[3].y - pts[1].y) / (pts[3].z - pts[1].z)) * zf;
    const t2 = t * t;
    const t3 = t2 * t;
    const herm = (tt) => {
      const a2 = tt * tt;
      const a3 = a2 * tt;
      return (2 * a3 - 3 * a2 + 1) * y0 + (-2 * a3 + 3 * a2) * yf + (a3 - a2) * mf;
    };
    const cMid = 16 * (pts[1].y - herm(0.5));
    q.y = (2 * t3 - 3 * t2 + 1) * y0 + (-2 * t3 + 3 * t2) * yf + (t3 - t2) * mf + cMid * t2 * (1 - t) * (1 - t);
  }
  return new THREE.Vector3(noseMap(x), q.y - nacaDepth(x, u), side * (q.z - sideIntakeDepth(x, u)));
}

// ---- iter-14：車門後方深凹立體側進氣口（ref_chevalier-ma_side-high／front34：車門面往後漸凹成淺盤，
//      後緣是一道「)」形唇邊，唇邊後方落入深色槽口，後葉子板前緣再從槽底往外升出）----
// 尺寸為推估（依 ref side-high 目視：槽口位於車門後、後輪拱前約 8–11 mm，高度約由側裙上緣到腰線下方 14 mm）
const INTAKE_U0 = 0.69;
const INTAKE_U1 = 0.94;
/** 淺盤最深處（唇邊前）往內 mm */
const INTAKE_DISH = 1.8;
/** 槽底往內 mm */
const INTAKE_SLOT = 3.8;
/** 唇邊長度（a 0.35…1.0）與唇邊隆起 mm */
const INTAKE_LIP = 0.5;
/** 淺盤前端距唇邊 mm */
const INTAKE_DISH_LEN = 11;
/** 槽底往後升回車身面的長度 mm */
const INTAKE_RISE = 3.0;
const smooth01 = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
/** @type {(u: number) => number} u → 進氣口截面參數 v（0 上緣、1 下緣） */
const intakeV = (u) => (u - INTAKE_U0) / (INTAKE_U1 - INTAKE_U0);
/** @type {(v: number) => number} 唇邊（槽口前緣）所在 x：上下兩端靠前、中段往後凸，成「)」形 */
const intakeEdgeX = (v) => -14.4 - 3.0 * Math.sin(Math.PI * Math.min(1, Math.max(0, v)));
/** @type {(v: number) => number} 上下兩端的深度包絡（各 18% 平滑淡出） */
const intakeEnv = (v) => smooth01(v / 0.18) * smooth01((1 - v) / 0.18);
/**
 * 側進氣口往內（−|z|）的位移量
 * @type {(x: number, u: number) => number}
 */
const sideIntakeDepth = (x, u) => {
  if (x > 0 || x < -24 || u < INTAKE_U0 || u > INTAKE_U1) {
    return 0;
  }
  const v = intakeV(u);
  const env = intakeEnv(v);
  if (env <= 0) {
    return 0;
  }
  const a = x - intakeEdgeX(v);
  let d = 0;
  if (a >= 1.0) {
    // 淺盤：前端 0 → 唇邊前 INTAKE_DISH
    d = INTAKE_DISH * smooth01((INTAKE_DISH_LEN - a) / (INTAKE_DISH_LEN - 1.0));
  } else if (a >= 0.35) {
    // 唇邊：略往外隆起，形成反光的邊
    d = INTAKE_DISH - INTAKE_LIP * smooth01((1.0 - a) / 0.65);
  } else if (a >= 0) {
    // 唇邊後側陡落入槽底
    d = INTAKE_DISH - INTAKE_LIP + (INTAKE_SLOT - INTAKE_DISH + INTAKE_LIP) * smooth01((0.35 - a) / 0.35);
  } else {
    // 槽底 → 後葉子板前緣升回車身面
    d = INTAKE_SLOT * (1 - smooth01(-a / INTAKE_RISE));
  }
  return d * env;
};

// ---- iter-05：縮短車頭（reviewer「車頭比參考更長更扁」；ref side-high 目視：前懸約 29–30 mm，原模型 33 mm，推估）----
// 輪廓表與所有貼片仍用「設計座標」x，輸出時把 x > 50 的區段漸進壓縮（斜率 1 → 0.82，在 50–62 mm 間 C1 連續過渡，
// 避免反光出現折線）；鼻端 73 → 約 69.9 mm
const NOSE_START = 50;
const NOSE_RAMP = 12;
// iter-12：以擬合相機量 ref side-high（scripts/diag/measure_ref.mjs，推估 ±1 mm）：近側車鼻（大燈前端、下緣角）x ≈ 67.5–68.5 mm，
//   前導輪 x ≈ 70.6–72.0（與本模型 71.5 一致）→ 參考車鼻到前導輪中心約 3–4 mm；本模型車鼻 69.9 → 只剩 1.6 mm。
//   壓縮斜率 0.18 → 0.30：車鼻 69.9 → 67.9 mm（導輪位置是物理規格，不動）
const NOSE_SHRINK = 0.30;
/** @type {(x: number) => number} 設計座標 x → 實際 x（只影響車頭） */
const noseMap = (x) => {
  const d = x - NOSE_START;
  if (d <= 0) {
    return x;
  }
  if (d < NOSE_RAMP) {
    return x - (NOSE_SHRINK * d * d) / (2 * NOSE_RAMP);
  }
  return x - NOSE_SHRINK * (d - NOSE_RAMP / 2);
};

// ---- iter-05（重新套用 iter-04）：引擎蓋 NACA 進氣口真實下凹（ref hood-detail：擋風玻璃前方的深色進氣口）----
// iter-04 的引擎蓋反光扭曲主因是金屬粒子法線貼圖＋細長燈箱（本輪不採用）；下凹本身只影響 x 15–25、u < 0.13 的小區域，
// 本輪把側壁過渡加寬（0.6 → 1.15 倍半寬）並讓下凹在前端以平方曲線淡入，避免周圍曲面出現法向跳動
// iter-16：reviewer iter-15「引擎蓋中央進氣口是小圓筒（參考為往前開的長形導風槽）」（ref_chevalier-ma_hood-detail：騎士徽章後方
//   一道往擋風玻璃加深的長槽，槽尾有凸起的導風罩，深色開口朝前）→ 槽由 x 25…15.5（9.5 mm）拉長為 x 40…22（18 mm，推估：
//   ref hood-detail 槽長約為徽章後緣到擋風玻璃距離），前窄後寬（半寬 u 0.045 → 0.085），深度 2.0 → 2.4 mm；
//   槽底前段是車身色、只有槽尾開口是深色；槽尾後方加 HOOD_LIP_H 高的導風罩（x 21.4…15.3，接到擋風玻璃下緣），罩的前立面為深色
const NACA_X0 = 40;
const NACA_X1 = 22;
const NACA_DEPTH = 2.4;
/** 槽尾導風罩高度（mm，推估） */
const HOOD_LIP_H = 1.5;
/** @type {(x: number) => number} NACA 進氣口在 x 處的半寬（以 u 表示；與深色底面 ribbon 相同） */
const nacaHalfU = (x) => 0.045 + 0.04 * Math.min(1, Math.max(0, (NACA_X0 - x) / (NACA_X0 - NACA_X1)));
/**
 * 進氣口下凹深度：前端 0 → 後端最深（NACA 斜坡），後端 0.6 mm 內立起後牆；兩側 0.6–1.15 倍半寬平滑過渡成側壁
 * @type {(x: number, u: number) => number}
 */
const nacaDepth = (x, u) => {
  if (x > NACA_X0 || x < NACA_X1 - 0.6) {
    return 0;
  }
  const along = Math.min(1, (NACA_X0 - x) / (NACA_X0 - NACA_X1));
  let d = NACA_DEPTH * along * (2 - along);
  if (x < NACA_X1) {
    const t = (NACA_X1 - x) / 0.6;
    d *= 1 - t * t * (3 - 2 * t);
  }
  const r = u / nacaHalfU(x);
  if (r > 1.15) {
    return 0;
  }
  if (r > 0.6) {
    const t = (r - 0.6) / 0.55;
    d *= 1 - t * t * (3 - 2 * t);
  }
  return d;
};

/** 曲面法向（數值微分，朝外） */
export function bodyNormal(x, u, side = 1) {
  const e = 0.05;
  const p = bodyPoint(x, u, side);
  const du = bodyPoint(x, Math.min(1, u + 0.004), side).sub(bodyPoint(x, Math.max(0, u - 0.004), side));
  const dx = bodyPoint(x + e, u, side).sub(bodyPoint(x - e, u, side));
  // 外法向由參數方向決定（右側 du × dx、左側 dx × du）；iter-01 用「遠離 y = 14 軸」判斷，
  // 在車頭低於 14 mm 的引擎蓋區會判反，iter-02 改為直接由繞序決定
  const n = side > 0 ? new THREE.Vector3().crossVectors(du, dx) : new THREE.Vector3().crossVectors(dx, du);
  if (n.lengthSq() < 1e-12) {
    return new THREE.Vector3(0, 1, 0);
  }
  return n.normalize();
}

/** 由格點建立網格（rows × cols，cols 方向為截面） */
function gridGeometry(rows, cols, pointAt) {
  const pos = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const p = pointAt(i / rows, j / cols);
      pos.push(p.x, p.y, p.z);
    }
  }
  const idx = [];
  const row = cols + 1;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** 縱向取樣點：0.5 mm 基本間距，輪拱開口兩端 ±1.5 mm 內加密到 0.08 mm（減少底緣在輪拱端點的鋸齒） */
function hullXs() {
  const xs = new Set();
  for (let x = BODY_FRONT_X; x >= BODY_REAR_X - 1e-6; x -= 0.5) {
    xs.add(Number(x.toFixed(3)));
  }
  xs.add(BODY_REAR_X);
  for (const a of ARCHES) {
    for (const sgn of [-1, 1]) {
      const e = a.x + sgn * a.r;
      for (let d = -1.5; d <= 1.5 + 1e-9; d += 0.08) {
        xs.add(Number((e + d).toFixed(3)));
      }
      xs.add(Number((e - 0.01).toFixed(3)));
      xs.add(Number((e + 0.01).toFixed(3)));
    }
  }
  // iter-16：引擎蓋導風槽槽尾後牆（x 21.3…22.1）陡峭，加密到 0.05 mm
  for (let x = NACA_X1 + 0.1; x >= NACA_X1 - 0.7; x -= 0.05) {
    xs.add(Number(x.toFixed(3)));
  }
  // iter-14：側進氣口唇邊與槽口（x −13.8…−21）陡峭，縱向加密到 0.07 mm
  for (let x = -13.8; x >= -21.5; x -= 0.07) {
    xs.add(Number(x.toFixed(3)));
  }
  return [...xs].filter((x) => x <= BODY_FRONT_X && x >= BODY_REAR_X).sort((p, q) => q - p);
}

/** 車殼主體（左右兩半＋前後封口＋底緣翻邊）；外面車漆、內面深色（從底盤開口往上看不會看到車漆） */
function buildHull(mat, innerMat) {
  const g = new THREE.Group();
  const xs = hullXs();
  const rows = xs.length - 1;
  // iter-05：截面 56 → 96 格（NACA 下凹的側壁需要更細的 u 解析度）
  const cols = 96;
  for (const side of [1, -1]) {
    const geo = gridGeometry(rows, cols, (t, u) => bodyPoint(xs[Math.round(t * rows)], u, side));
    // 解析法向（曲面數值微分）取代 computeVertexNormals，消除俯視反光斑駁
    const nrm = geo.attributes.normal;
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= cols; j++) {
        const n = bodyNormal(xs[i], j / cols, side);
        nrm.setXYZ(i * (cols + 1) + j, n.x, n.y, n.z);
      }
    }
    if (side < 0) {
      // 鏡射後翻轉繞序，維持外法向
      const idx = geo.index.array;
      for (let k = 0; k < idx.length; k += 3) {
        const tmp = idx[k + 1];
        idx[k + 1] = idx[k + 2];
        idx[k + 2] = tmp;
      }
    }
    g.add(new THREE.Mesh(geo, mat));
    g.add(new THREE.Mesh(geo, innerMat));
    // 底緣翻邊（沿底緣往內 1.3 mm、略往上），讓車殼邊緣有厚度，不再是薄片
    const pos = [];
    const idx = [];
    for (let i = 0; i <= rows; i++) {
      const p = bodyPoint(xs[i], 1, side);
      pos.push(p.x, p.y, p.z);
      pos.push(p.x, p.y + 0.5, p.z - side * 1.3);
    }
    for (let i = 0; i < rows; i++) {
      const a0 = i * 2;
      const b0 = (i + 1) * 2;
      idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setIndex(idx);
    fg.computeVertexNormals();
    g.add(new THREE.Mesh(fg, innerMat.userData.flange));
  }
  // 前封口：以截面輪廓做扇形（車尾封口 iter-05 改由 buildRearFascia 做成有內凹開口的立面）
  for (const x of [BODY_FRONT_X]) {
    const shape = new THREE.Shape();
    const n = 40;
    const pts = [];
    for (let j = 0; j <= n; j++) {
      pts.push(bodyPoint(x, j / n, 1));
    }
    for (let j = n; j >= 0; j--) {
      pts.push(bodyPoint(x, j / n, -1));
    }
    shape.moveTo(pts[0].z, pts[0].y);
    for (const p of pts.slice(1)) {
      shape.lineTo(p.z, p.y);
    }
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2);
    const cap = new THREE.Mesh(geo, innerMat.userData.flange);
    cap.position.x = noseMap(x);
    g.add(cap);
  }
  return g;
}

/**
 * 貼在車殼曲面上的薄片（條紋、燈、散熱口）
 * @param {number} x0 起點 x
 * @param {number} x1 終點 x
 * @param {(x: number, s: number) => [number, number]} band 回傳 [uLo, uHi]，s ∈ [0,1] 為 x0→x1 的進度
 * @param {THREE.Material} mat
 * @param {number} side
 * @param {number | ((s: number, v: number) => number)} lift 沿法向抬高（mm）；iter-14 起可傳函式（s：x0→x1 進度、v：截面 0→1），做出隆起的燈罩
 * @param {{ nu?: number, uv?: (s: number, v: number) => [number, number], surf?: { point: Function, normal: Function }, ownNormals?: boolean }} [opts] nu：截面方向細分；uv：貼圖座標（預設 (s, v)）；surf：貼附曲面（預設車殼，iter-03 加座艙）；ownNormals：以自身網格重算法向（隆起曲面用）
 */
function ribbon(x0, x1, band, mat, side, lift = 0.06, opts = {}) {
  const nx = Math.max(4, Math.ceil(Math.abs(x1 - x0) / 0.8));
  const nu = opts.nu ?? 6;
  const uvFn = opts.uv ?? ((s, v) => [s, v]);
  const surfPoint = opts.surf ? opts.surf.point : bodyPoint;
  const surfNormal = opts.surf ? opts.surf.normal : bodyNormal;
  const pos = [];
  const nrm = [];
  const uvs = [];
  for (let i = 0; i <= nx; i++) {
    const s = i / nx;
    const x = x0 + (x1 - x0) * s;
    const [ua, ub] = band(x, s);
    for (let j = 0; j <= nu; j++) {
      const u = ua + ((ub - ua) * j) / nu;
      const n = surfNormal(x, u, side);
      const h = typeof lift === 'function' ? lift(s, j / nu) : lift;
      const p = surfPoint(x, u, side).addScaledVector(n, h);
      pos.push(p.x, p.y, p.z);
      nrm.push(n.x, n.y, n.z);
      const [U, V] = uvFn(s, j / nu);
      uvs.push(U, V);
    }
  }
  const idx = [];
  const row = nu + 1;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nu; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // 繞序與外法向一致（左側或 x0 < x1 時三角形會反向；DoubleSide 會把背面法向翻轉造成發灰）
  {
    const P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
    const mid = Math.floor(nx / 2) * row + Math.floor(nu / 2);
    const fn = new THREE.Vector3().crossVectors(P(mid + row).sub(P(mid)), P(mid + 1).sub(P(mid)));
    const vn = new THREE.Vector3(nrm[mid * 3], nrm[mid * 3 + 1], nrm[mid * 3 + 2]);
    if (fn.dot(vn) < 0) {
      for (let k = 0; k < idx.length; k += 3) {
        const tmp = idx[k + 1];
        idx[k + 1] = idx[k + 2];
        idx[k + 2] = tmp;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  if (opts.ownNormals) {
    geo.computeVertexNormals();
  }
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 1;
  return m;
}

/**
 * 沿車殼曲面上一條邊立起的薄牆（側進氣口前緣的唇邊，做出凹陷深度）
 * @param {number} x 邊所在 x
 * @param {number} u0 起點 u
 * @param {number} u1 終點 u
 * @param {number} h 高度（沿法向，mm）
 * @param {number} lean 牆頂往後（−x）偏移（mm）
 */
function edgeWall(x, u0, u1, h, lean, mat, side) {
  const n = 10;
  const pos = [];
  for (let j = 0; j <= n; j++) {
    const u = u0 + ((u1 - u0) * j) / n;
    const p = bodyPoint(x, u, side);
    const nn = bodyNormal(x, u, side);
    const q = p.clone().addScaledVector(nn, h);
    q.x -= lean;
    pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
  }
  const idx = [];
  for (let j = 0; j < n; j++) {
    const a = j * 2;
    idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/**
 * 貼在車殼曲面上、沿法向凸起的小方塊（立體鰭片）：頂面＋四周側牆，頂面往後（−x）傾斜 lean mm（iter-04 實作，iter-05 重新套用）
 * @type {(x0: number, x1: number, u0: number, u1: number, h: number, lean: number, mat: THREE.Material, side: number) => THREE.Mesh}
 */
/**
 * iter-24：斜向長條鰭片（格柵用）：沿 x0 → x1 前進時 u 中心由 uA 線性移到 uB，截面半寬 hw（u）；
 * 沿法向隆起（截面中央 0.4 mm、四周 0.07 mm 貼回車殼，兩端收回），不懸空、不穿出曲面
 */
function slantSlat(x0, x1, uA, uB, hw, mat, side) {
  return ribbon(x0, x1, (x, s) => {
    const c = uA + (uB - uA) * s;
    return [c - hw, c + hw];
  }, mat, side, (s, v) => 0.07 + 0.33 * Math.sqrt(Math.sin(Math.PI * v)) * Math.min(1, s / 0.12, (1 - s) / 0.12), { nu: 6, ownNormals: true });
}

const raisedPad = (x0, x1, u0, u1, h, lean, mat, side) => {
  const nu = 6;
  // 周邊路徑：x0 邊（u0→u1）→ x1 邊（u1→u0）→ 回到起點
  const ring = [];
  for (let j = 0; j <= nu; j++) ring.push([x0, u0 + ((u1 - u0) * j) / nu]);
  for (let j = nu; j >= 0; j--) ring.push([x1, u0 + ((u1 - u0) * j) / nu]);
  ring.push([x0, u0]);
  const pos = [];
  const idx = [];
  /** @type {(x: number, u: number, k: number) => THREE.Vector3} */
  const lift = (x, u, k) => {
    const p = bodyPoint(x, u, side);
    const n = bodyNormal(x, u, side);
    const q = p.clone().addScaledVector(n, k * h);
    q.x -= k * lean;
    return q;
  };
  for (const [x, u] of ring) {
    const a = lift(x, u, 0);
    const b = lift(x, u, 1);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  for (let k = 0; k < ring.length - 1; k++) {
    const a = k * 2;
    idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const top0 = pos.length / 3;
  for (let j = 0; j <= nu; j++) {
    const u = u0 + ((u1 - u0) * j) / nu;
    for (const x of [x0, x1]) {
      const q = lift(x, u, 1);
      pos.push(q.x, q.y, q.z);
    }
  }
  for (let j = 0; j < nu; j++) {
    const a = top0 + j * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  const m = new THREE.Mesh(flat, mat);
  m.renderOrder = 2;
  return m;
};

/**
 * iter-14：側進氣口槽內的深色腔體：貼在（已凹陷的）車殼曲面上、沿唇邊曲線排列的薄片，
 * 唇邊後側、槽底與後葉子板前緣深處全黑（a 0.3 … −2.2；從前方斜看時看到的是這段），往外升起處以頂點 alpha 淡出（a −2.2 … −3.0），上下兩端隨深度包絡淡出
 * @type {(mat: THREE.Material, side: number) => THREE.Mesh}
 */
const buildIntakeCavity = (mat, side) => {
  const na = 28;
  const nv = 40;
  const aHi = 0.3;
  const aLo = -3.0;
  const pos = [];
  const col = [];
  const idx = [];
  for (let i = 0; i <= nv; i++) {
    const v = 0.04 + (0.92 * i) / nv;
    const u = INTAKE_U0 + v * (INTAKE_U1 - INTAKE_U0);
    const env = intakeEnv(v);
    for (let j = 0; j <= na; j++) {
      const a = aHi + ((aLo - aHi) * j) / na;
      const x = intakeEdgeX(v) + a;
      const p = bodyPoint(x, u, side).addScaledVector(bodyNormal(x, u, side), 0.03);
      pos.push(p.x, p.y, p.z);
      const fade = a > -2.2 ? 1 : 1 - smooth01((-2.2 - a) / 0.8);
      col.push(0.02, 0.022, 0.03, fade * smooth01((env - 0.15) / 0.5));
    }
  }
  const row = na + 1;
  for (let i = 0; i < nv; i++) {
    for (let j = 0; j < na; j++) {
      const k = i * row + j;
      if (side > 0) {
        idx.push(k, k + row, k + 1, k + row, k + row + 1, k + 1);
      } else {
        idx.push(k, k + 1, k + row, k + row, k + 1, k + row + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
};

/**
 * 以 Canvas 繪製貼紙貼圖（只在瀏覽器有 document 時建立；Node 測試環境回傳 null，貼紙略過）
 * @param {number} w
 * @param {number} h
 * @param {(ctx: CanvasRenderingContext2D) => void} draw
 */
function canvasTexture(w, h, draw) {
  if (typeof document === 'undefined') {
    return null;
  }
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx);
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 引擎蓋騎士徽章（ref_chevalier-ma_hood-detail：深灰 V 形底、騎士頭盔、交叉雙劍、CHEVALIER 字樣）。畫布上方 = 車頭 */
function drawHoodEmblem(ctx) {
  ctx.clearRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  // 轉 180°：從車頭往後看時字是正的（字的上方朝擋風玻璃）
  ctx.rotate(Math.PI);
  // 深灰 V 形底（尖端朝車頭）
  ctx.fillStyle = '#23262e';
  ctx.beginPath();
  ctx.moveTo(0, 250);
  ctx.lineTo(-150, -40);
  ctx.lineTo(-100, -250);
  ctx.lineTo(100, -250);
  ctx.lineTo(150, -40);
  ctx.closePath();
  ctx.fill();
  // 交叉雙劍
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineCap = 'round';
  for (const sg of [-1, 1]) {
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(sg * -150, 40);
    ctx.lineTo(sg * 170, -210);
    ctx.stroke();
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(sg * -150 + sg * 20, 40 - 30);
    ctx.lineTo(sg * -150 - sg * 25, 40 + 5);
    ctx.stroke();
  }
  // 騎士頭盔（白色，帶面罩橫縫與頂飾）
  ctx.fillStyle = '#f4f4f4';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(0, -95, 62, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  for (const dy of [-110, -88]) {
    ctx.fillRect(-48, dy, 96, 9);
  }
  ctx.fillRect(-4, -70, 8, 50);
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.moveTo(20, -170);
  ctx.quadraticCurveTo(110, -215, 150, -150);
  ctx.quadraticCurveTo(100, -175, 30, -150);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 肩甲
  ctx.beginPath();
  ctx.ellipse(0, -10, 95, 30, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // CHEVALIER 字樣（白字黑邊，略呈弧形）
  ctx.font = 'bold italic 62px Arial Black, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = 'CHEVALIER';
  const total = ctx.measureText(text).width;
  let cx = -total / 2;
  for (const ch of text) {
    const cw = ctx.measureText(ch).width;
    const xx = cx + cw / 2;
    const yy = 55 + 0.0016 * xx * xx;
    ctx.save();
    ctx.translate(xx, yy);
    ctx.rotate(xx * 0.0012);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#0c0c0c';
    ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cx += cw;
  }
}

/** TAMIYA 標誌（白底、深藍外框、兩個白方塊內的深藍大星、下方深藍 TAMIYA 字） */
function drawTamiya(ctx) {
  // iter-17：改成單色版（透明底、白方塊內鏤空深藍星、白字），材質加 alphaTest，透明處露出車身色
  // iter-20（reviewer iter-19「深底白線，參考為白底方塊深色星，顏色反了」）：ref side-high／front34 放大重看——
  //   整塊貼紙是白底、外圍一圈深色細框；上半兩個白方塊各一顆幾乎頂到方塊邊的深藍星，方塊之間與上下半之間有深色分隔線；
  //   下半是白底深色 TAMIYA 字。整塊外形近正方（ref side-high 約 45 × 40 px），貼片改為 5.6 × 5.1 mm（原 7 × 4.4 mm）
  const navy = '#151b5c';
  ctx.clearRect(0, 0, 256, 256);
  const star = (cx, cy, r) => {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 === 0 ? r : r * 0.4;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  // 白底＋深色外框
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4, 4, 248, 248);
  ctx.strokeStyle = navy;
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 228, 228);
  // 上半兩個方塊：中間直線與上下半分隔線
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(128, 14);
  ctx.lineTo(128, 150);
  ctx.moveTo(14, 150);
  ctx.lineTo(242, 150);
  ctx.stroke();
  ctx.fillStyle = navy;
  for (const cx of [71, 185]) {
    star(cx, 86, 60);
  }
  ctx.font = 'bold 62px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TAMIYA', 128, 200, 214);
}

/** 兩端漸尖的寬度包絡 */
/**
 * iter-24：側條漸層貼圖（ref side-high／front34 放大：條紋上緣橘、往下漸層成黃橘，尖頭前端淡成白藍，下緣另有一道細白線）
 * 畫布 U（左→右）= 條紋 s（x0→x1）；V（上→下）= 截面 v（uLo 上緣 → uHi 下緣；flipY = false）
 * @param {boolean} paleTip 前端（s 小）是否淡成白藍
 */
function drawStripeGradient(ctx, paleTip) {
  const w = 256;
  const h = 64;
  ctx.clearRect(0, 0, w, h);
  // 主色帶：v 0 → 0.74 橘 → 黃橘
  const bandH = Math.round(h * 0.74);
  const g = ctx.createLinearGradient(0, 0, 0, bandH);
  // iter-25：reviewer 指出黃色尾端過飽和、實車以亮橘為主 → 主體全亮橘，只在下緣 15% 極窄過渡到偏暖橘（不出現黃）
  g.addColorStop(0, '#ff5a08');
  g.addColorStop(0.85, '#ff640a');
  g.addColorStop(1, '#ff7c12');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, bandH);
  if (paleTip) {
    // iter-25：白藍尖頭縮短（0.24 → 0.12）、降低不透明度，讓箭形尖頭仍以橘色輪廓為主
    const t = ctx.createLinearGradient(0, 0, w * 0.12, 0);
    t.addColorStop(0, 'rgba(236,242,255,0.75)');
    t.addColorStop(1, 'rgba(236,242,255,0)');
    ctx.fillStyle = t;
    ctx.fillRect(0, 0, w * 0.12, bandH);
  }
  // v 0.74–0.82 透明間隙（alphaTest 透出車身色），v 0.82–0.92 細白線
  ctx.fillStyle = '#f4f6fb';
  ctx.fillRect(0, Math.round(h * 0.82), w, Math.round(h * 0.1));
}

const taper = (s, a = 0.15, b = 0.25) => Math.min(1, s / a, (1 - s) / b);

/** 碳纖網格貼圖（DataTexture，Node 測試環境也能建立） */
function carbonTexture() {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cx = Math.floor(x / 8);
      const cy = Math.floor(y / 8);
      const fx = (x % 8) / 8;
      const fy = (y % 8) / 8;
      const weave = (cx + cy) % 2 === 0 ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
      const hole = fx < 0.12 || fy < 0.12 ? 0.25 : 1;
      const v = Math.round(30 + 70 * weave * hole);
      const k = (y * n + x) * 4;
      data[k] = v;
      data[k + 1] = v;
      data[k + 2] = v + 6;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---- 座艙（獨立玻璃件）：擋風玻璃前緣 x = 15，車頂 x ≈ −8 ~ −28，往後延伸成引擎蓋 ----
const CABIN_X0 = 15;
// iter-03：座艙（車頂塊）在 x = −48 結束並以立面落到後甲板（ref rear34：車頂塊與後甲板分層），
// 後甲板（車殼中線）由 28.8 往車尾降到 21.5，不再是 iter-02 的厚方塊車尾
const CABIN_X1 = -48;
// 車頂板多一層 ROOF_LIFT，座艙面整體降 0.6 mm，使含車頂板與貼紙的最高點維持 SPEC 1.12 外框高 38 mm
// iter-07：座艙後段加高（車頂往後延伸到尾端前才下降，ref side-high），最高點 37.1 mm 不變（全高 38 mm，SPEC 1.2）
// iter-11：擋風玻璃下緣 24.6 → 27.2、x = 0 處 34.0 → 35.0（ref 量測：車頂前緣 x ≈ 0、中線約 34.8），座艙泡往前飽滿；最高點 37.1 不變
// iter-16（reviewer iter-15：座艙頂明顯拱起、擋風玻璃大而立、同相機下模型露出的車頂平面面積遠多於參考）：
//   擋風玻璃 x 15→3 升 8.1 mm（原 15→0 升 7.8 mm，更立）；車頂最高點 37.1 不變，車頂後段 x −30 以後往車尾下降（−48：35.4 → 33.8），
//   讓車頂讀成拱起的泡而不是平台；車頂半寬 19–19.5 → 15–16、座艙底半寬 30–31.5 → 25.5–27.5（推估：ref front34／rear34 車頂寬約為車身寬的 0.38–0.4）
const CABIN_TOP = [[15, 27.2], [9, 32.1], [3, 35.3], [-6, 36.7], [-16, 37.0], [-26, 37.05], [-34, 36.6], [-42, 35.2], [-48, 33.8]];
const CABIN_TOP_W = [[15, 14], [0, 15.5], [-16, 16], [-36, 15.8], [-44, 14.8], [-48, 14.2]];
const CABIN_BASE_W = [[15, 23.5], [0, 25.5], [-16, 26.5], [-36, 27.5], [-44, 27], [-48, 26.5]];
/** iter-16：側窗中段控制點的橫向位置（0 = 車頂邊正下方、1 = 座艙底緣）；0.35 → 0.18 讓側窗更直立 */
const CABIN_SIDE_K = 0.18;
/** 車頂板（車身色、比座艙玻璃面高 0.7 mm 的獨立一層）的 x 範圍與 u 範圍 */
const ROOF_X0 = -6;
const ROOF_U = 0.46;
const ROOF_LIFT = 0.7;

/** 座艙截面上的點；u：0 中線 → 1 與車殼交接處 */
export function cabinPoint(x, u, side = 1) {
  const top = smoothTable(CABIN_TOP, x);
  const base = smoothTable(CENTER_Y, x) - 0.6;
  const tw = smoothTable(CABIN_TOP_W, x);
  const bw = smoothTable(CABIN_BASE_W, x);
  const h = Math.max(0.01, top - base);
  const pts = [
    { z: -tw * 0.5, y: top - 0.1 },
    { z: 0, y: top },
    { z: tw * 0.5, y: top - 0.1 },
    { z: tw, y: top - Math.min(0.9, h * 0.12) },
    { z: tw + (bw - tw) * CABIN_SIDE_K, y: base + h * 0.6 },
    { z: bw, y: base },
  ];
  const q = catmull(pts, (u * 4 + 1) / 5);
  return new THREE.Vector3(x, q.y, side * q.z);
}

/** 座艙曲面法向（數值微分，朝外；參數方向與車殼相同） */
export function cabinNormal(x, u, side = 1) {
  const e = 0.05;
  const du = cabinPoint(x, Math.min(1, u + 0.004), side).sub(cabinPoint(x, Math.max(0, u - 0.004), side));
  const dx = cabinPoint(x + e, u, side).sub(cabinPoint(x - e, u, side));
  const n = side > 0 ? new THREE.Vector3().crossVectors(du, dx) : new THREE.Vector3().crossVectors(dx, du);
  if (n.lengthSq() < 1e-12) {
    return new THREE.Vector3(0, 1, 0);
  }
  return n.normalize();
}

/** 曲面描述：車殼與座艙兩種，供 ribbon 共用 */
const HULL_SURF = { point: bodyPoint, normal: bodyNormal };
const CABIN_SURF = { point: cabinPoint, normal: cabinNormal };

/**
 * 沿座艙曲面上一條路徑立起的薄牆（車頂板的側面／前緣立面）
 * @param {(t: number) => [number, number]} path t ∈ [0,1] → [x, u]
 * @param {number} n 分段數
 * @param {number} h 沿法向高度（mm）
 */
function liftWall(path, n, h, mat, side) {
  const pos = [];
  for (let k = 0; k <= n; k++) {
    const [x, u] = path(k / n);
    const p = cabinPoint(x, u, side);
    const q = p.clone().addScaledVector(cabinNormal(x, u, side), h);
    pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
  }
  const idx = [];
  for (let k = 0; k < n; k++) {
    const a = k * 2;
    idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const matTwo = mat.side === THREE.DoubleSide ? mat : Object.assign(mat.clone(), { side: THREE.DoubleSide });
  return new THREE.Mesh(geo, matTwo);
}

/** 座艙：玻璃（擋風＋側窗）與車身色的車頂／C 柱，依三角形位置分成兩個材質群組 */
function buildCabin(bodyMat, glassMat, trimMat) {
  const g = new THREE.Group();
  const rows = 90;
  const cols = 28;
  for (const side of [1, -1]) {
    const pos = [];
    for (let i = 0; i <= rows; i++) {
      const x = CABIN_X0 + ((CABIN_X1 - CABIN_X0) * i) / rows;
      for (let j = 0; j <= cols; j++) {
        const p = cabinPoint(x, j / cols, side);
        pos.push(p.x, p.y, p.z);
      }
    }
    const glassIdx = [];
    const bodyIdx = [];
    const row = cols + 1;
    for (let i = 0; i < rows; i++) {
      const x = CABIN_X0 + ((CABIN_X1 - CABIN_X0) * (i + 0.5)) / rows;
      for (let j = 0; j < cols; j++) {
        const u = (j + 0.5) / cols;
        const a = i * row + j;
        const b = (i + 1) * row + j;
        const tri = side > 0 ? [a, b, a + 1, b, b + 1, a + 1] : [a, a + 1, b, b, a + 1, b + 1];
        // 擋風玻璃：x > −7；側窗：x ∈ (−31, 13)、u 在車頂邊與腰線之間
        const windshield = x > -7 && u < 0.5;
        const sideWindow = x > -31.5 && x < 12.5 && u >= 0.5 && u < 0.86;
        if (windshield || sideWindow) {
          glassIdx.push(...tri);
        } else {
          bodyIdx.push(...tri);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex([...glassIdx, ...bodyIdx]);
    geo.addGroup(0, glassIdx.length, 0);
    geo.addGroup(glassIdx.length, bodyIdx.length, 1);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, [glassMat, bodyMat]));
  }
  // ---- iter-03：座艙分層（ref front34 / rear34 / side-high）----
  // 1) 車頂板：車身色獨立一層，比座艙面高 ROOF_LIFT，四周有立面 → 座艙玻璃與車頂之間出現分層折線
  // 2) A 柱：擋風玻璃與側窗之間的車身色柱＋黑色窗框細線
  // 3) 側窗黑色窗框（上緣、下緣、後緣）
  // 4) 車頂塊後端立面（落到後甲板）
  const paintTwo = bodyMat.clone();
  paintTwo.side = THREE.DoubleSide;
  // iter-09：clone() 不會複製 onBeforeCompile → 車頂板原本少了珠光視角漸層，與車身色不一致；補上（含金屬片）
  applyPaintFlop(paintTwo);
  const cab = { surf: CABIN_SURF };
  for (const side of [1, -1]) {
    g.add(ribbon(ROOF_X0, CABIN_X1, () => [0, ROOF_U], paintTwo, side, ROOF_LIFT, { ...cab, nu: 12 }));
    // 車頂板側面立面（u = ROOF_U）與前緣立面（x = ROOF_X0）
    g.add(liftWall((t) => [ROOF_X0 + (CABIN_X1 - ROOF_X0) * t, ROOF_U], 60, ROOF_LIFT, trimMat, side));
    g.add(liftWall((t) => [ROOF_X0, ROOF_U * t], 16, ROOF_LIFT, trimMat, side));
    // 車頂板前緣下方的擋風玻璃上框
    g.add(ribbon(ROOF_X0 + 1.4, ROOF_X0, () => [0, ROOF_U + 0.02], trimMat, side, 0.15, { ...cab, nu: 12 }));
    // A 柱（車身色）＋兩側黑色細框
    g.add(ribbon(CABIN_X0 + 0.3, ROOF_X0, () => [0.47, 0.57], paintTwo, side, 0.3, cab));
    g.add(ribbon(CABIN_X0 + 0.3, ROOF_X0, () => [0.445, 0.47], trimMat, side, 0.2, cab));
    g.add(ribbon(12.5, ROOF_X0, () => [0.57, 0.6], trimMat, side, 0.2, cab));
    // 側窗上緣（車頂板下方）、下緣（腰線）、後緣（C 柱前緣，略斜）
    g.add(ribbon(ROOF_X0, -31.5, () => [ROOF_U, 0.5], trimMat, side, 0.2, cab));
    g.add(ribbon(12.5, -31.5, (x, s) => [0.84 - 0.03 * s, 0.88 - 0.02 * s], trimMat, side, 0.2, cab));
    g.add(ribbon(-30, -32.5, (x, s) => [ROOF_U, 0.88], trimMat, side, 0.2, cab));
    // iter-05：分件線（座艙件與車殼之間的細縫，沿座艙底緣）
    g.add(ribbon(CABIN_X0 - 1.2, CABIN_X1, () => [0.975, 1.0], trimMat, side, 0.08, cab));
    // 前緣窗框：擋風玻璃下緣（與引擎蓋交界）
    g.add(ribbon(CABIN_X0 + 0.2, CABIN_X0 - 1.4, () => [0, 0.5], trimMat, side, 0.15, cab));
  }
  // 車頂塊後端立面：以座艙截面（含車頂板高度）在 x = CABIN_X1 做封口
  {
    const shape = new THREE.Shape();
    const n = 30;
    const pts = [];
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      const p = cabinPoint(CABIN_X1, u, 1);
      if (u <= ROOF_U) {
        p.addScaledVector(cabinNormal(CABIN_X1, u, 1), ROOF_LIFT);
      }
      pts.push(p);
    }
    for (let j = n; j >= 0; j--) {
      const p = pts[j].clone();
      p.z = -p.z;
      pts.push(p);
    }
    shape.moveTo(pts[0].z, pts[0].y);
    for (const p of pts.slice(1)) {
      shape.lineTo(p.z, p.y);
    }
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateY(-Math.PI / 2);
    const cap = new THREE.Mesh(geo, paintTwo);
    cap.position.x = CABIN_X1;
    g.add(cap);
  }
  // 車頂後段碳纖網格散熱口（MIDSHIP AERO 位置）
  const carbon = new THREE.MeshStandardMaterial({ map: carbonTexture(), roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pos = [];
  const uvs = [];
  const idx = [];
  const nx = 24;
  const nz = 8;
  for (let i = 0; i <= nx; i++) {
    const x = -12 + (-32 + 12) * (i / nx);
    for (let k = 0; k <= nz; k++) {
      const zz = -10 + 20 * (k / nz);
      const tw = smoothTable(CABIN_TOP_W, x);
      const r = zz / (tw * 0.5);
      // 車頂中段近似拋物面：中線最高，往兩側下降約 0.15 mm（與 cabinPoint 的控制點一致）
      pos.push(x, smoothTable(CABIN_TOP, x) - 0.1 * r * r + ROOF_LIFT + 0.15, zz);
      uvs.push(i / nx, k / nz);
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const a = i * (nz + 1) + k;
      const b = (i + 1) * (nz + 1) + k;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cg.setIndex(idx);
  cg.computeVertexNormals();
  const vent = new THREE.Mesh(cg, carbon);
  g.add(vent);
  return g;
}

/**
 * iter-09：座艙內裝（透過煙燻玻璃看得到的深色內部）
 * 內裝底殼：座艙截面高度壓到 CABIN_TUB_K、寬度縮 8%（必在玻璃面之下、蓋住下方車殼頂面），
 * 再放儀表板、方向盤、兩張座椅（椅背＋頭枕）。尺寸為推估：依座艙內高約 9–10 mm 等比例配置（1/32 比例跑車座艙）
 * @param {THREE.Material} tubMat 內裝底殼（深灰）
 * @param {THREE.Material} seatMat 座椅（略亮的深灰，讓輪廓透過玻璃可辨識）
 */
const CABIN_TUB_K = 0.42;
function buildCabinInterior(tubMat, seatMat) {
  const g = new THREE.Group();
  const x0 = CABIN_X0 - 0.6;
  const x1 = CABIN_X1 + 0.6;
  /** @type {(x: number, u: number, side: number) => THREE.Vector3} 內裝底殼上的點 */
  const tubPoint = (x, u, side) => {
    const p = cabinPoint(x, u, side);
    const base = smoothTable(CENTER_Y, x) - 0.6;
    p.y = base + CABIN_TUB_K * (p.y - base);
    p.z *= 0.92;
    return p;
  };
  for (const side of [1, -1]) {
    g.add(gridGeometryMesh(60, 14, (i, j) => tubPoint(x0 + ((x1 - x0) * i) / 60, j / 14, side), tubMat));
  }
  // iter-12：車門內飾板（深灰）——玻璃改 alpha 半透明後，透過側窗看到的是車殼頂面（藍漆反光），
  // 實車側窗內是深色車門內側。
  // 在玻璃內側 0.25 mm 加一片與側窗平行的內飾板蓋住車殼，透過玻璃看成均勻的深色車門內側（ref side-high 側窗內為均勻深色）
  const doorMat = Object.assign(seatMat.clone(), { side: THREE.DoubleSide });
  for (const side of [1, -1]) {
    const dx0 = -31.2;
    const dx1 = 12.2;
    const doorPoint = (i, j) => {
      const x = dx0 + ((dx1 - dx0) * i) / 40;
      const u = 0.52 + (0.48 * j) / 10;
      return cabinPoint(x, u, side).addScaledVector(cabinNormal(x, u, side), -0.25);
    };
    g.add(gridGeometryMesh(40, 10, doorPoint, doorMat));
  }
  /** @type {(x: number) => number} 中線處底殼高度 */
  const floorY = (x) => tubPoint(x, 0, 1).y;
  // 儀表板：擋風玻璃下緣的橫向圓角塊
  const dash = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2 * smoothTable(CABIN_TOP_W, 9) * 0.95), seatMat);
  dash.position.set(9.5, floorY(9.5) + 1.0, 0);
  dash.rotation.z = -0.35;
  g.add(dash);
  for (const sz of [-1, 1]) {
    // 方向盤（右駕，z > 0）只做一個；座椅左右各一
    if (sz > 0) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.35, 8, 24), seatMat);
      wheel.position.set(6.2, floorY(6.2) + 2.6, 5.6);
      // 圓環軸（z）先轉到 x（朝駕駛），再繞 z 往上仰 0.5 rad
      wheel.rotation.set(0, Math.PI / 2, 0.5, 'ZYX');
      g.add(wheel);
    }
    const seatX = -13.5;
    const fy = floorY(seatX);
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.2, 6.2), seatMat);
    cushion.position.set(seatX + 3.6, fy + 0.4, sz * 5.6);
    g.add(cushion);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.2, 6.2), seatMat);
    back.position.set(seatX, fy + 2.4, sz * 5.6);
    back.rotation.z = 0.28;
    g.add(back);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 3.6), seatMat);
    head.position.set(seatX - 1.3, fy + 5.6, sz * 5.6);
    head.rotation.z = 0.28;
    g.add(head);
  }
  return g;
}

/** 由 (i, j) → 點 的函式建立 rows × cols 格網（雙面材質，不在意繞序） */
function gridGeometryMesh(rows, cols, at, mat) {
  const pos = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const p = at(i, j);
      pos.push(p.x, p.y, p.z);
    }
  }
  const idx = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + cols + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/**
 * 座艙車頂上的貼紙薄片（MIDSHIP AERO 字樣）；車頂近乎水平，沿 +y 抬高
 * @param {number} xa 起點 x（貼圖 U = 0）
 * @param {number} xb 終點 x（貼圖 U = 1）
 * @param {number} ua 內側 u（貼圖 V = 0，字的上方）
 * @param {number} ub 外側 u
 */
function roofDecal(xa, xb, ua, ub, mat, side) {
  const nx = 24;
  const nv = 4;
  const pos = [];
  const uvs = [];
  for (let i = 0; i <= nx; i++) {
    const x = xa + ((xb - xa) * i) / nx;
    for (let j = 0; j <= nv; j++) {
      const p = cabinPoint(x, ua + ((ub - ua) * j) / nv, side);
      pos.push(p.x, p.y + ROOF_LIFT + 0.12, p.z);
      uvs.push(i / nx, j / nv);
    }
  }
  const idx = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nv; j++) {
      const a0 = i * (nv + 1) + j;
      const b0 = (i + 1) * (nv + 1) + j;
      idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
}

/** 車頂 MIDSHIP AERO 字樣（ref_chevalier-ma_hood-detail：碳纖散熱口兩側的白字） */
function drawMidship(ctx) {
  ctx.clearRect(0, 0, 512, 64);
  ctx.fillStyle = '#f2f4f8';
  ctx.font = 'bold italic 44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MIDSHIP AERO', 256, 34);
}

/**
 * 車尾立面（iter-05；ref rear34：車尾是一圈車身色邊框，中下方是看得到黑色底盤的開口，開口下緣有擴散器鰭片）
 * 外框＝車尾截面輪廓，下緣中央挖出往上 U 形開口（寬 ±NOTCH_W、頂端 NOTCH_TOP）；開口四周以深 2.6 mm 的內壁連到深色背板
 * @type {(paintTwo: THREE.Material, wallMat: THREE.Material, darkMat: THREE.Material) => THREE.Group}
 */
const buildRearFascia = (paintTwo, wallMat, darkMat) => {
  const g = new THREE.Group();
  const x = BODY_REAR_X;
  const depth = 2.6;
  const n = 40;
  /** @type {THREE.Vector2[]} 右半輪廓（z, y），中線上緣 → 右下角 */
  const right = [];
  for (let j = 0; j <= n; j++) {
    const p = bodyPoint(x, j / n, 1);
    right.push(new THREE.Vector2(p.z, p.y));
  }
  const yBottom = right[n].y;
  const notchW = 20;
  const notchTop = Math.min(right[0].y - 3.2, yBottom + 7.5);
  const rc = 3;
  /** @type {THREE.Vector2[]} U 形開口（右下 → 右上圓角 → 左上圓角 → 左下） */
  const notch = [new THREE.Vector2(notchW, yBottom)];
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * (Math.PI / 2);
    notch.push(new THREE.Vector2(notchW - rc + rc * Math.cos(a), notchTop - rc + rc * Math.sin(a)));
  }
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI / 2 + (k / 6) * (Math.PI / 2);
    notch.push(new THREE.Vector2(-notchW + rc + rc * Math.cos(a), notchTop - rc + rc * Math.sin(a)));
  }
  notch.push(new THREE.Vector2(-notchW, yBottom));
  const outline = [...right, ...notch, ...right.slice().reverse().map((p) => new THREE.Vector2(-p.x, p.y))];
  const ring = new THREE.ShapeGeometry(new THREE.Shape(outline));
  // 形狀在 (z, y)：轉到面朝 −x
  ring.rotateY(-Math.PI / 2);
  const ringMesh = new THREE.Mesh(ring, paintTwo);
  ringMesh.position.x = x;
  g.add(ringMesh);
  // 開口內壁（沿 U 形邊往車內 depth）
  const pos = [];
  const idx = [];
  for (const p of notch) {
    pos.push(x, p.y, -p.x, x + depth, p.y, -p.x);
  }
  for (let k = 0; k < notch.length - 1; k++) {
    const a = k * 2;
    idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wallGeo.setIndex(idx);
  wallGeo.computeVertexNormals();
  g.add(new THREE.Mesh(wallGeo, wallMat));
  // 深色背板（開口內的齒輪箱後蓋）
  const back = new THREE.ShapeGeometry(new THREE.Shape(notch));
  back.rotateY(-Math.PI / 2);
  const backMesh = new THREE.Mesh(back, darkMat);
  backMesh.position.x = x + depth;
  g.add(backMesh);
  // 擴散器鰭片：開口下緣 5 片直立鰭片，往後凸出 1.2 mm
  for (let k = -2; k <= 2; k++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(depth + 1.2, 3.4, 0.7), darkMat);
    fin.position.set(x + depth / 2 - 0.6, yBottom + 1.7, k * notchW * 0.36);
    g.add(fin);
  }
  return g;
};

/** 輪拱唇邊圓珠半徑（mm，推估：ref side-high／front34 輪拱邊緣有一圈約 1 mm 寬的捲邊高光） */
export const ARCH_LIP_R = 0.45;
/** 圓珠中心相對開口邊緣往上、往內的偏移（mm）：只露出下半圈當作捲邊，避免往下凸出擋住輪胎上緣 */
export const ARCH_LIP_IN = 0.25;

/**
 * 輪拱唇邊（iter-18）：沿車殼輪拱開口邊緣（u = 1）放一條車身色圓管，讓開口邊有捲邊厚度與高光，
 * 路徑 = 前端垂直段（底緣 → 圓心高）＋ 開口圓弧 ＋ 後端垂直段，圓弧在圓心高處切線垂直，與垂直段平順銜接
 * @param {THREE.Material} mat
 */
function buildArchLips(mat) {
  const g = new THREE.Group();
  const wheelY = spec.tire.diameter_mm / 2;
  for (const a of ARCHES) {
    const cy = wheelY + a.lift;
    for (const side of [1, -1]) {
      const pts = [];
      const edgeZ = (x) => bodyPoint(x, 1, side).z - side * ARCH_LIP_IN;
      const xF = a.x + a.r - 0.02;
      const xR = a.x - a.r + 0.02;
      // 底端抬高一個圓珠半徑，封口球不會凸出車殼底緣
      const yLow = BOTTOM_Y + ARCH_LIP_R;
      for (let y = yLow; y < cy; y += 0.6) {
        pts.push(new THREE.Vector3(xF, y, edgeZ(xF)));
      }
      for (let k = 0; k <= 64; k++) {
        const ang = (k / 64) * Math.PI;
        const x = a.x + a.r * Math.cos(ang) * 0.9985;
        const p = bodyPoint(x, 1, side);
        pts.push(new THREE.Vector3(x, cy + (a.r * 0.9985 + ARCH_LIP_IN) * Math.sin(ang), p.z - side * ARCH_LIP_IN));
      }
      for (let y = cy - 0.6; y >= yLow - 1e-6; y -= 0.6) {
        pts.push(new THREE.Vector3(xR, y, edgeZ(xR)));
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const segs = 160;
      const radial = 10;
      const geo = new THREE.TubeGeometry(curve, segs, ARCH_LIP_R, radial, false);
      // 兩端（底緣附近 12% 長度）圓珠漸細到 0，收進車殼邊緣，避免端點像水滴凸出
      const pos = geo.attributes.position;
      const c = new THREE.Vector3();
      const v = new THREE.Vector3();
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const e = Math.min(1, Math.min(t, 1 - t) / 0.12);
        const f = e * e * (3 - 2 * e);
        curve.getPointAt(t, c);
        for (let j = 0; j <= radial; j++) {
          const k = i * (radial + 1) + j;
          v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(f).add(c);
          pos.setXYZ(k, v.x, v.y, v.z);
        }
      }
      // 等比例縮半徑不改法向方向，保留 TubeGeometry 原本的放射狀法向
      g.add(new THREE.Mesh(geo, mat));
    }
  }
  return g;
}

/** 輪拱內側（深色內襯，遮住車殼內面） */
function buildWheelWells(mat) {
  const g = new THREE.Group();
  const wy = spec.tire.diameter_mm / 2;
  for (const a of ARCHES) {
    const ax = a.x;
    for (const side of [1, -1]) {
      const w = smoothTable(HALF_WIDTH, ax);
      const geo = new THREE.CylinderGeometry(a.r - 0.3, a.r - 0.3, 16, 32, 1, true, -Math.PI / 2, Math.PI);
      const m = new THREE.Mesh(geo, mat);
      // 圓柱軸沿 z、開口朝下
      m.rotation.x = -Math.PI / 2;
      m.position.set(ax, wy + a.lift, side * (w - 10));
      g.add(m);
    }
  }
  return g;
}

/**
 * 珠光漆視角顏色漸層（iter-06）：在法線計算後依 N·V 把底色由正視的亮寶藍漸變到掠射的深紫，
 * 只改 diffuseColor，不動法線，因此不會產生 iter-04 那種反光扭曲
 * iter-09：加入細金屬片（metallic flake）——以物件座標切成約 PAINT_FLAKE_MM 的小格，每格一個雜湊值：
 *   (1) 底漆顏色亮度噪點（iter-10：±3%）；(2) 底漆層（非清漆層）法線極低強度隨機偏轉 → 高光區出現細碎閃點。
 *   three.js 的清漆法線取自 nonPerturbedNormal（clearcoat_normal_fragment_begin），
 *   所以清漆層的環境反射（燈箱倒影）仍是平滑曲面、不會扭曲（iter-04 粒子法線貼圖同時擾動兩層才扭曲）
 * @type {(mat: THREE.MeshPhysicalMaterial) => void}
 */
// iter-10：顆粒 0.12 → 0.06 mm、偏轉 0.08 → 0.06（reviewer「顆粒略粗有雜訊感」）
const PAINT_FLAKE_MM = 0.06;
const PAINT_FLAKE_TILT = 0.06;
// iter-19：深色金屬藍（reviewer iter-18「藍色偏亮偏紫像緞面，參考為深色金屬藍、暗部深、反射銳利」）。
//   ref side-high 取樣（sRGB）：車門中間調 #292E80／#202869、暗部 #1E1E64／#141B75、受光面 #3A51D3／#414DBD（G ≥ R，偏藍不偏紫）；
//   iter-18 同位置 #4647BA／#544FB0（亮約 2 倍、R ≈ G 偏紫）→ 正視色 #3352f2 → PAINT_FACE、掠射色 #2a1084（紫）→ PAINT_EDGE（深海軍藍）
const PAINT_FACE = 0x1232bc;
const PAINT_EDGE = 0x060a34;
const applyPaintFlop = (mat) => {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.flopFace = { value: new THREE.Color(PAINT_FACE) };
    shader.uniforms.flopEdge = { value: new THREE.Color(PAINT_EDGE) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFlakePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlakePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 flopFace;\nuniform vec3 flopEdge;\nvarying vec3 vFlakePos;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float ndv = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
          float flop = smoothstep(0.1, 0.9, ndv);
          diffuseColor.rgb = mix(flopEdge, flopFace, flop);
          vec3 cell = floor(vFlakePos / ${PAINT_FLAKE_MM.toFixed(3)});
          vec3 hs = fract(sin(vec3(dot(cell, vec3(127.1, 311.7, 74.7)), dot(cell, vec3(269.5, 183.3, 246.1)), dot(cell, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
          diffuseColor.rgb *= 0.97 + 0.06 * hs.x;
          normal = normalize(normal + ${PAINT_FLAKE_TILT.toFixed(3)} * (hs - 0.5));
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'paintFlop';
};

/**
 * 建立 Chevalier 車殼（含座艙、條紋、燈組、散熱口）
 * @param {object} mats 由 model.js 傳入的共用材質
 */
export function buildChevalierBody(mats) {
  const g = new THREE.Group();
  g.name = 'body';
  // iter-06：金屬珠光漆＋清漆層。不用金屬粒子法線貼圖（iter-04 反光扭曲主因），改用：
  //   底漆層 metalness 0.62／roughness 0.3（金屬底色的柔和寬高光）＋清漆 clearcoat 1.0／clearcoatRoughness 0.12（清楚但不過銳的燈箱反射；0.04 時俯視引擎蓋高光邊緣出現波紋）
  //   iter-10：底漆 roughness 0.3 → 0.24、清漆 clearcoatRoughness 0.12 → 0.03（reviewer「光澤降為半光澤、rear34 反光不夠銳利」；
  //   診斷：0.07 時 PMREM 取樣的燈箱倒影仍明顯糊掉，0.02–0.03 才有清楚邊緣；俯視引擎蓋檢查無 iter-06 的波紋）
  //   ＋視角顏色漸層（applyPaintFlop：正視亮寶藍、掠射轉深紫，珠光漆的 flop 效果）＋溫和 iridescence 與紫色 sheen
  //   iter-19：深色金屬藍——底色見 PAINT_FACE／PAINT_EDGE；拿掉紫色 sheen（緞面感與紫偏的主因之一）、iridescence 0.25 → 0.08；
  //   底漆 metalness 0.62 → 0.75（金屬底色在非反射處更暗）、roughness 0.24 → 0.3（底漆寬高光變淡變散，不再像一片亮緞面）；
  //   清漆 clearcoatRoughness 0.03 → 0.015（燈箱倒影邊緣更銳利）。仍不用粒子法線貼圖（iter-04 教訓），金屬片只擾動底漆層法線
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x1f30a8,
    roughness: 0.5,
    metalness: 0.7,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    envMapIntensity: 0.85,
    iridescence: 0.08,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [260, 420],
    side: THREE.FrontSide,
  });
  applyPaintFlop(paint);
  // 車殼內面（深色）與邊緣翻邊／封口（車漆雙面）
  const inner = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, side: THREE.BackSide });
  inner.userData.flange = paint.clone();
  inner.userData.flange.side = THREE.DoubleSide;
  applyPaintFlop(inner.userData.flange);
  // iter-09：座艙玻璃由不透明褐色金屬片改為透明煙燻玻璃（reviewer：「座艙玻璃不透明褐色片」）：
  //   transmission 0.9＋灰褐色調（color 為透射染色）→ 透過玻璃看得到座艙內裝深色輪廓；
  //   metalness 0、roughness 0.03、clearcoat 1 → 表面仍有棚拍燈箱的清楚倒影
  //   iter-10：色調改回參考的香檳／古銅煙燻（ref_chevalier-ma_front34／side-high）：透射染色 0xc9a67e、暖色 specularColor、
  //   transmission 0.88、metalness 0.08（試過 metalness 0.3／transmission 0.75 → 像不透明卡其色板、看不到內裝，已撤回）
  //   iter-12：reviewer「sidehigh 玻璃內有不明深色斑」。逐項排除（拿掉內裝、玻璃不收／不投陰影、envMapIntensity 0、清漆 0、
  //   厚度 0、紅色測試片放在玻璃內 0.25 mm）後確認：深色橢圓斑出在 transmission 取樣（測試片被斑蓋住，玻璃隱藏時則完整可見）。
  //   改用一般 alpha 半透明（transmission 0、opacity 0.72、深茶色 0x4a3d2e）：斑淡成柔和的倒影漸層，
  //   側窗讀成 ref side-high 那種「深色煙燻＋燈箱倒影」，內側另加深灰車門內飾板（buildCabinInterior）
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x4a3d2e, specularColor: 0xffd3a0, roughness: 0.04, metalness: 0.08, transmission: 0.0, transparent: true, opacity: 0.72, depthWrite: false, ior: 1.5, envMapIntensity: 1.0, clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide });
  const interiorTub = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide });
  const interiorSeat = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.6, metalness: 0.0 });
  const decal = (color, extra = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide, ...extra });
  const orange = decal(0xff6a12);
  // iter-24：側條改橘黃漸層＋細白線（Node 測試環境無 canvas → 退回單色橘）
  const stripeTex = canvasTexture(256, 64, (ctx) => drawStripeGradient(ctx, false));
  const stripeTipTex = canvasTexture(256, 64, (ctx) => drawStripeGradient(ctx, true));
  const stripeMat = stripeTex ? decal(0xffffff, { map: stripeTex, alphaTest: 0.4 }) : orange;
  const stripeTipMat = stripeTipTex ? decal(0xffffff, { map: stripeTipTex, alphaTest: 0.4 }) : orange;
  const silver = decal(0xc9ced6, { metalness: 0.7, roughness: 0.25 });
  const darkGray = decal(0x1a1e28, { roughness: 0.5, clearcoat: 0.3 });
  const black = decal(0x0b0c10, { roughness: 0.6, clearcoat: 0.2 });
  const finMat = new THREE.MeshPhysicalMaterial({ color: 0x5b6070, roughness: 0.45, metalness: 0.3, clearcoat: 0.5, side: THREE.DoubleSide });
  const lamp = decal(0xf4f7ff, { emissive: 0xc8d8ff, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.08 });
  // iter-05：燈罩（半透明灰白、低自發光）與 LED 燈條（高亮）分開，燈具才有層次
  const seam = decal(0x05060a, { roughness: 0.7, clearcoat: 0.0 });
  const lens = decal(0x9aa3b0, { emissive: 0x3a4250, emissiveIntensity: 0.3, metalness: 0.6, roughness: 0.12 });
  const led = decal(0xffffff, { emissive: 0xeaf2ff, emissiveIntensity: 1.0, metalness: 0.0, roughness: 0.2, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  // iter-14：頭燈鍍鉻反射底與透明燈罩
  const reflectorMat = decal(0xdfe4ec, { metalness: 1.0, roughness: 0.14, clearcoat: 0.0 });
  const lampCoverMat = new THREE.MeshPhysicalMaterial({ color: 0xeef3ff, transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.03, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.02, envMapIntensity: 1.6, side: THREE.FrontSide });
  const lipMat = paint.clone();
  lipMat.side = THREE.DoubleSide;
  applyPaintFlop(lipMat);
  const emblemTex = canvasTexture(512, 512, drawHoodEmblem);
  const emblemMat = emblemTex ? decal(0xffffff, { map: emblemTex, alphaTest: 0.3, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }) : null;
  const tamiyaTex = canvasTexture(256, 256, drawTamiya);
  // iter-14：側進氣口槽內腔體（頂點色含 alpha，淡出到後葉子板前緣）
  const cavityMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.85, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  const tamiyaMat = tamiyaTex ? decal(0xffffff, { map: tamiyaTex, alphaTest: 0.4, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }) : null;

  g.add(buildHull(paint, inner));
  g.add(buildCabin(paint, glass, black));
  g.add(buildCabinInterior(interiorTub, interiorSeat));
  const midTex = canvasTexture(512, 64, drawMidship);
  if (midTex) {
    const midMat = decal(0xffffff, { map: midTex, alphaTest: 0.35, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    // 字頭（貼圖 V = 0）都朝車頂中線、從車外側看是正字：
    // 右側（+z）由後往前排字；左側（−z）由前往後排字（iter-02 左側也由後往前 → 俯視呈上下顛倒的鏡像字，reviewer 指出的 bug）
    g.add(roofDecal(-33, -13, 0.33, 0.43, midMat, 1));
    g.add(roofDecal(-13, -33, 0.33, 0.43, midMat, -1));
  }
  g.add(buildWheelWells(new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9, side: THREE.DoubleSide })));
  g.add(buildArchLips(lipMat));

  for (const side of [1, -1]) {
    // 前葉子板稜線外側的橘色條紋：從頭燈往後延伸到擋風玻璃旁
    // iter-24：改橘黃漸層＋細白線（截面 nu 12 讓漸層與白線平順）
    // iter-25：前端斜切由 12% 縮短為 6%，尖頭更銳利的折角箭形
    g.add(ribbon(70, 20, (x, s) => [0.41, 0.41 + 0.075 * taper(s, 0.06, 0.4)], stripeMat, side, 0.06, { nu: 12 }));
    // 橘色條紋內側的銀色細線
    g.add(ribbon(66, 34, (x, s) => [0.37, 0.37 + 0.03 * taper(s, 0.2, 0.3)], silver, side));
    // 側面橘色掃掠條紋：前輪後方低處 → 往後上揚到後葉子板
    // iter-25：前端改尖銳折角箭形（ref side-high／front34）：上緣直線延伸到尖端、下緣在前 10% 斜切收成一點
    //   （原本前 35% 上下對稱漸細，尖頭圓鈍）；後端維持對稱收尖
    g.add(ribbon(22, -36, (x, s) => {
      const c = 0.8 - 0.3 * s;
      const wFull = 0.06 * Math.min(1, (1 - s) / 0.12);
      const front = Math.min(1, s / 0.1);
      const lo = c - wFull;
      return [lo, lo + 2 * wFull * front];
    }, stripeTipMat, side, 0.09, { nu: 12 }));
    // 側面第二道細條紋
    // iter-14：原本 16 → −22 會穿過新的深凹側進氣口（唇邊 x ≈ −14.4…−17.4）→ 路徑不變，終點縮到 x −5（在淺盤前端之前收尖）
    // iter-24：ref side-high 的第二道是主條紋「上方」的細橘尖條（車門前段 → 座艙下方、略上揚），原本主條紋下方的銀線移除
    //   （主條紋下緣已有細白線）；路徑 x 14 → −8、u 中心 0.64 → 0.53，與主條紋上緣保持 ≥ 0.01 間隙，終點在側進氣口唇邊之前
    g.add(ribbon(14, -8, (x, s) => {
      const c = 0.64 - 0.11 * s;
      const w = 0.016 * taper(s, 0.3, 0.45);
      return [c - w, c + w];
    }, orange, side));
    // 後葉子板橘色斜線
    g.add(ribbon(-24, -58, (x, s) => {
      const c = 0.5 - 0.12 * s;
      const w = 0.05 * taper(s, 0.2, 0.3);
      return [c - w, c + w];
      // iter-24：前段與側面主條紋（x −24…−36）重疊合流 → 用無白尖頭版本、抬高 0.05（主條紋 0.09 在上），避免重疊處 z-fighting 碎片
    }, stripeMat, side, 0.05, { nu: 12 }));
    // 頭燈：前葉子板前下緣的細長燈條
    // iter-05：頭燈改「黑色燈殼＋透明燈罩＋縱向 LED 燈條」（ref hood-detail：細長燈罩內沿長邊走的 LED 線）
    //   iter-04 用 3 條橫向分段線，線條歪斜像牙齒（reviewer）→ 改沿燈長方向的連續細線，不再有橫切線
    /** @type {(s: number) => [number, number]} 頭燈帶狀範圍（s：0 = 前端 x 72 → 1 = 後端 x 56） */
    const lampBand = (s) => [0.5 + 0.06 * s, 0.62 + 0.04 * s - (0.05 * Math.max(0, s - 0.7)) / 0.3];
    /** @type {(x: number) => number} x → 燈帶進度 s */
    const lampS = (x) => Math.min(1, Math.max(0, (72 - x) / 16));
    g.add(ribbon(72.6, 55.2, (x) => {
      const [lo, hi] = lampBand(lampS(x));
      return [lo - 0.022, hi + 0.022];
    }, black, side, 0.05, { nu: 8 }));
    // iter-14：立體頭燈（reviewer 各輪「頭燈平貼、缺立體燈罩與導光」；ref hood-detail／front34：透明燈罩下是銀色反射底＋一排分格 LED）
    //   1) 銀色鍍鉻反射底（取代 iter-05 的灰色金屬燈罩貼片）
    g.add(ribbon(72, 56, (x, s) => lampBand(s), reflectorMat, side, 0.1, { nu: 8 }));
    //   2) 下排分格 LED：6 顆凸起 0.35 mm 的發光小塊（每格之間露出鍍鉻反射底，形成反射杯分格），取代原本的連續主 LED 燈條
    for (let k = 0; k < 6; k++) {
      const xa = 70.8 - k * 2.3;
      const xb = xa - 1.6;
      const [lo, hi] = lampBand(lampS(0.5 * (xa + xb)));
      const c = lo + (hi - lo) * 0.32;
      const hw = 0.13 * (hi - lo);
      g.add(raisedPad(xa, xb, c - hw, c + hw, 0.35, 0, led, side));
    }
    // 上方短 LED 燈條（前段）
    g.add(ribbon(70.4, 63.5, (x, s) => {
      const [lo, hi] = lampBand(lampS(x));
      const w = 0.06 * taper(s, 0.1, 0.2);
      const c = lo + (hi - lo) * 0.7;
      return [c - w * (hi - lo), c + w * (hi - lo)];
    }, led, side, 0.24, { nu: 2 }));
    //   3) 透明燈罩：沿法向隆起（中央 0.8 mm、四周 0.07 mm 貼回車殼），以自身網格法向呈現圓弧反光
    g.add(ribbon(72.4, 55.4, (x) => {
      const [lo, hi] = lampBand(lampS(x));
      return [lo - 0.012, hi + 0.012];
    }, lampCoverMat, side, (s, v) => 0.07 + 0.73 * Math.sqrt(Math.sin(Math.PI * v)) * Math.min(1, s / 0.08, (1 - s) / 0.12), { nu: 14, ownNormals: true }));
    // 尾燈（ref_chevalier-ma_rear34：透明白色細長 LED 燈，外圍黑色燈殼）
    // iter-05：尾燈改「黑色燈殼＋燈罩＋2 條縱向 LED」（ref rear34：車尾上緣兩角的細長 LED 尾燈）
    g.add(ribbon(-54.8, BODY_REAR_X, (x, s) => [0.37 + 0.02 * s, 0.62], black, side, 0.06, { nu: 8 }));
    g.add(ribbon(-56.2, BODY_REAR_X, (x, s) => [0.41 + 0.03 * (1 - s), 0.585], lens, side, 0.14, { nu: 8 }));
    g.add(ribbon(-57, BODY_REAR_X - 0.01, (x, s) => [0.455, 0.475], led, side, 0.24, { nu: 2 }));
    g.add(ribbon(-58.5, BODY_REAR_X - 0.01, (x, s) => [0.53, 0.545], led, side, 0.24, { nu: 2 }));
    // 車尾鴨尾擾流：沿車尾上緣立起 1.3 mm、往後傾 1 mm 的唇邊（車身色）
    g.add(edgeWall(BODY_REAR_X + 0.35, 0, 0.36, 1.3, 1.0, lipMat, side));
    // 後甲板散熱口（ref rear34：座艙後方兩側的深色斜鰭片）：深色底板＋3 片鰭片
    g.add(ribbon(-43.5, -52.5, () => [0.2, 0.31], black, side, 0.06));
    for (let k = 0; k < 3; k++) {
      const xc = -45.5 - k * 2.6;
      g.add(raisedPad(xc + 0.5, xc - 0.5, 0.21, 0.3, 0.7, 0.3, finMat, side));
    }
    // 分件線：車尾立面件與車殼之間（x = −60.5，後甲板到側面）
    g.add(ribbon(-60.35, -60.65, () => [0, 0.92], seam, side, 0.05, { nu: 24 }));
    // iter-05（重新套用 iter-04）：百葉改立體鰭片（ref hood-detail：深色凹槽內一排灰色斜鰭片）
    // 前葉子板內側百葉：深色底板＋5 片凸起 0.8 mm 的灰色鰭片
    g.add(ribbon(62, 49.5, () => [0.25, 0.35], black, side, 0.06));
    // iter-24：短方塊鰭片 → 斜向長條（ref front34／side-high：一排「/」形斜長條，內側端往車尾偏）
    for (let k = 0; k < 6; k++) {
      const xa = 61.4 - k * 1.9;
      g.add(slantSlat(xa, xa - 1.8, 0.338, 0.262, 0.013, finMat, side));
    }
    // 前輪後方側面百葉：深色底板＋4 片鰭片
    g.add(ribbon(26.6, 15.8, () => [0.54, 0.65], black, side, 0.06));
    // iter-24：同上改斜向長條（下端在前、上端往車尾偏）
    for (let k = 0; k < 5; k++) {
      const xa = 25.9 - k * 1.95;
      g.add(slantSlat(xa, xa - 1.8, 0.636, 0.554, 0.012, finMat, side));
    }
    // 後輪前方的直立側進氣口（iter-01～13：平貼的黑色漸層內面＋0.45 mm 唇邊＋4 片鰭片，reviewer 一再指出「缺深凹立體側進氣口」）
    // iter-14：改為車殼曲面本身往內凹（sideIntakeDepth：車門淺盤 → 「)」形唇邊 → 3.4 mm 深槽 → 後葉子板前緣升出），
    //   槽內貼深色腔體（buildIntakeCavity）；舊的平貼內面、唇邊牆、鰭片移除
    g.add(buildIntakeCavity(cavityMat, side));
    // 引擎蓋騎士徽章＋CHEVALIER 字樣（Canvas 貼圖；左右兩半各取貼圖一半）
    if (emblemMat) {
      g.add(ribbon(71, 41, () => [0, 0.21], emblemMat, side, 0.1, { nu: 16, uv: (s, v) => [0.5 + side * 0.5 * v, s] }));
    }
    // TAMIYA 標誌（前輪後方下側；右側由後往前、左側由前往後，字才不會反）
    if (tamiyaMat) {
      // iter-20：5.6 × 5.1 mm 近正方（原 x 16.6–23.6、u 0.82–0.97）；上緣 u 0.80 仍在側面橘條紋下緣（x 17 處 u ≈ 0.787）之下
      const xa = side > 0 ? 17.0 : 22.6;
      const xb = side > 0 ? 22.6 : 17.0;
      g.add(ribbon(xa, xb, () => [0.8, 0.97], tamiyaMat, side, 0.1, { nu: 10, uv: (s, v) => [s, v] }));
    }
    // 引擎蓋前方 NACA 進氣口（深色）
    // iter-05：深色底面貼在下凹曲面上（寬度與 nacaHalfU 一致）
    // iter-16：長槽只在槽尾 5 mm 貼深色（開口），前段維持車身色槽底；槽尾後方加導風罩（車身色頂面）＋深色前立面
    g.add(ribbon(NACA_X1 + 5, NACA_X1 - 0.6, (x) => [0, nacaHalfU(x) * 0.8], black, side, 0.07, { nu: 8 }));
    g.add(raisedPad(NACA_X1 - 0.6, CABIN_X0 + 0.3, 0, nacaHalfU(NACA_X1) * 1.1, HOOD_LIP_H, 0, lipMat, side));
    g.add(edgeWall(NACA_X1 - 0.62, 0, nacaHalfU(NACA_X1) * 1.08, HOOD_LIP_H * 0.95, 0, black, side));
  }
  // iter-05：車尾立面（車身色邊框＋內凹開口＋擴散器鰭片），取代 iter-03 的平板封口＋黑色方塊
  g.add(buildRearFascia(lipMat, black, mats.chassisDark));
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
