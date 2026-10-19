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
const HALF_WIDTH = [[73, 30], [66, 35], [56, 37.5], [46, 39.5], [36, 40], [24, 39.3], [12, 38.2], [0, 38], [-12, 39.4], [-24, 41.8], [-34, 43], [-44, 43], [-52, 41.8], [-58, 39.2], [-63, 34.5]];
/** 中線高度：鼻端（厚）→ 引擎蓋 → 座艙下緣 → 後甲板往車尾下降 */
// iter-07：後甲板加高、車尾不再往下收（ref side-high：座艙後方到車尾近乎水平，尾端厚實）→ −34…−63 中線 +1…+3.5 mm
const CENTER_Y = [[73, 14], [66, 16.5], [56, 18.5], [46, 20.5], [36, 21.8], [24, 23], [12, 24.6], [0, 25.6], [-12, 26.6], [-24, 28.2], [-34, 29.8], [-44, 30.8], [-52, 30.2], [-58, 28.4], [-63, 25.0]];
/** 葉子板稜線高度：前輪上方隆起高於引擎蓋（鼻端仍高），後輪上方再隆起後往車尾下降 */
// iter-07：後葉子板稜線加高（ref side-high：後輪上方隆起約為車頂高的 85–90%）
const FENDER_Y = [[73, 18.5], [66, 24], [56, 28.5], [46, 30.5], [36, 30.5], [24, 28.5], [12, 27.0], [0, 26.8], [-12, 28.4], [-24, 31.2], [-34, 33.4], [-44, 34.0], [-52, 33.0], [-58, 30.6], [-63, 27.0]];
/** 稜線位置（佔半寬的比例） */
const FENDER_Z = [[73, 0.8], [56, 0.76], [36, 0.77], [12, 0.86], [-12, 0.86], [-34, 0.79], [-63, 0.76]];
/** 側面最寬處的高度 */
const SIDE_Y = [[73, 12.5], [66, 13], [56, 13], [46, 14], [-50, 14], [-58, 13.5], [-63, 13]];
/** 車殼底緣：iter-02 為 5.6 mm，與底盤側框之間縫隙偏大 → 4.4 mm（底板上緣 3.7 mm） */
// iter-05：reviewer「車殼底緣離底盤太近像一整塊」（ref side-high：車殼下方露出一層黑色底盤側框）→ 4.4 → 6.4 mm
const BOTTOM_Y = 6.4;
/** 輪拱半徑：iter-02 輪胎外 2.5 mm 間隙偏大 → 1.8 mm */
// iter-05：reviewer「輪胎露出比例小、輪拱開口大」（ref side-high：輪拱開口明顯大於輪胎）→ 1.8 → 2.8 mm
// iter-07：reviewer「輪拱上緣空隙偏大」→ 2.8 → 1.8 mm
const ARCH_R = spec.tire.diameter_mm / 2 + 1.8;

/** 車殼底緣（含前後輪拱開口） */
function bottomAt(x) {
  const archX = spec.chassis.wheelbase_mm / 2;
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
  for (const ax of [-archX, archX]) {
    const dx = x - ax;
    if (Math.abs(dx) < ARCH_R) {
      y = Math.max(y, wheelY + Math.sqrt(ARCH_R * ARCH_R - dx * dx) - 0.5);
    }
  }
  return y;
}

/** 某 x 截面的半邊控制點（中線 → 底緣） */
function sectionPoints(x) {
  const w = smoothTable(HALF_WIDTH, x);
  const yc = smoothTable(CENTER_Y, x);
  const yb = bottomAt(x);
  const ys = Math.max(smoothTable(SIDE_Y, x), yb + 1.2);
  const shoulder = Math.max(smoothTable(FENDER_Y, x) - 3.2, ys + 1.0);
  const yf = Math.max(smoothTable(FENDER_Y, x), shoulder + 0.8);
  const zf = w * smoothTable(FENDER_Z, x);
  // 引擎蓋中央隆起（power bulge，ref_chevalier-ma_hood-detail：中央高、兩側凹槽、再到葉子板稜線）
  const bulgeT = Math.max(0, 1 - Math.abs(x - 40) / 24);
  const bulge = 1.8 * bulgeT * bulgeT * (3 - 2 * bulgeT);
  return [
    { z: 0, y: yc + bulge },
    { z: zf * 0.5, y: yc + 0.12 * (yf - yc) - 0.4 * bulgeT },
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
  return new THREE.Vector3(noseMap(x), q.y - nacaDepth(x, u), side * q.z);
}

// ---- iter-05：縮短車頭（reviewer「車頭比參考更長更扁」；ref side-high 目視：前懸約 29–30 mm，原模型 33 mm，推估）----
// 輪廓表與所有貼片仍用「設計座標」x，輸出時把 x > 50 的區段漸進壓縮（斜率 1 → 0.82，在 50–62 mm 間 C1 連續過渡，
// 避免反光出現折線）；鼻端 73 → 約 69.9 mm
const NOSE_START = 50;
const NOSE_RAMP = 12;
const NOSE_SHRINK = 0.18;
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
const NACA_X0 = 25;
const NACA_X1 = 15.5;
const NACA_DEPTH = 2.0;
/** @type {(x: number) => number} NACA 進氣口在 x 處的半寬（以 u 表示；與深色底面 ribbon 相同） */
const nacaHalfU = (x) => 0.08 + 0.04 * Math.min(1, Math.max(0, (NACA_X0 - x) / (NACA_X0 - NACA_X1)));
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
  const archX = spec.chassis.wheelbase_mm / 2;
  for (const ax of [-archX, archX]) {
    for (const sgn of [-1, 1]) {
      const e = ax + sgn * ARCH_R;
      for (let d = -1.5; d <= 1.5 + 1e-9; d += 0.08) {
        xs.add(Number((e + d).toFixed(3)));
      }
      xs.add(Number((e - 0.01).toFixed(3)));
      xs.add(Number((e + 0.01).toFixed(3)));
    }
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
 * @param {number} lift 沿法向抬高（mm）
 * @param {{ nu?: number, uv?: (s: number, v: number) => [number, number], surf?: { point: Function, normal: Function } }} [opts] nu：截面方向細分；uv：貼圖座標（預設 (s, v)）；surf：貼附曲面（預設車殼，iter-03 加座艙）
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
      const p = surfPoint(x, u, side).addScaledVector(n, lift);
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

/** TAMIYA 標誌（白底黑框、雙星、TAMIYA 字） */
function drawTamiya(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 242);
  const star = (cx, cy, r, fill) => {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 === 0 ? r : r * 0.45;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.stroke();
  };
  star(100, 100, 62, '#d71920');
  star(156, 100, 62, '#1f3a93');
  ctx.fillStyle = '#111';
  ctx.font = 'bold 56px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TAMIYA', 128, 205);
}

/** 兩端漸尖的寬度包絡 */
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
const CABIN_TOP = [[15, 24.6], [8, 29.8], [0, 34.0], [-8, 36.2], [-16, 37.0], [-26, 37.1], [-36, 36.9], [-44, 36.2], [-48, 35.4]];
const CABIN_TOP_W = [[15, 17], [0, 19], [-16, 19.5], [-36, 19.2], [-44, 17.8], [-48, 17.0]];
const CABIN_BASE_W = [[15, 27], [0, 30], [-16, 31], [-36, 31.5], [-44, 30], [-48, 29.5]];
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
    { z: tw + (bw - tw) * 0.35, y: base + h * 0.6 },
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

/** 輪拱內側（深色內襯，遮住車殼內面） */
function buildWheelWells(mat) {
  const g = new THREE.Group();
  const archX = spec.chassis.wheelbase_mm / 2;
  const wy = spec.tire.diameter_mm / 2;
  for (const ax of [-archX, archX]) {
    for (const side of [1, -1]) {
      const w = smoothTable(HALF_WIDTH, ax);
      const geo = new THREE.CylinderGeometry(ARCH_R - 0.3, ARCH_R - 0.3, 16, 32, 1, true, -Math.PI / 2, Math.PI);
      const m = new THREE.Mesh(geo, mat);
      // 圓柱軸沿 z、開口朝下
      m.rotation.x = -Math.PI / 2;
      m.position.set(ax, wy - 0.5, side * (w - 10));
      g.add(m);
    }
  }
  return g;
}

/**
 * 珠光漆視角顏色漸層（iter-06）：在法線計算後依 N·V 把底色由正視的亮寶藍漸變到掠射的深紫，
 * 只改 diffuseColor，不動法線，因此不會產生 iter-04 那種反光扭曲
 * @type {(mat: THREE.MeshPhysicalMaterial) => void}
 */
const applyPaintFlop = (mat) => {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.flopFace = { value: new THREE.Color(0x3352f2) };
    shader.uniforms.flopEdge = { value: new THREE.Color(0x2a1084) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 flopFace;\nuniform vec3 flopEdge;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float ndv = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
          float flop = smoothstep(0.1, 0.9, ndv);
          diffuseColor.rgb = mix(flopEdge, flopFace, flop);
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
  //   ＋視角顏色漸層（applyPaintFlop：正視亮寶藍、掠射轉深紫，珠光漆的 flop 效果）＋溫和 iridescence 與紫色 sheen
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x1f30a8,
    roughness: 0.3,
    metalness: 0.62,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.85,
    iridescence: 0.25,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [260, 420],
    sheen: 0.25,
    sheenColor: new THREE.Color(0x7a5cff),
    sheenRoughness: 0.5,
    side: THREE.FrontSide,
  });
  applyPaintFlop(paint);
  // 車殼內面（深色）與邊緣翻邊／封口（車漆雙面）
  const inner = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, side: THREE.BackSide });
  inner.userData.flange = paint.clone();
  inner.userData.flange.side = THREE.DoubleSide;
  applyPaintFlop(inner.userData.flange);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x7d6650, roughness: 0.12, metalness: 0.75, envMapIntensity: 0.8, clearcoat: 1.0, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
  const decal = (color, extra = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide, ...extra });
  const orange = decal(0xff6a12);
  const silver = decal(0xc9ced6, { metalness: 0.7, roughness: 0.25 });
  const darkGray = decal(0x1a1e28, { roughness: 0.5, clearcoat: 0.3 });
  const black = decal(0x0b0c10, { roughness: 0.6, clearcoat: 0.2 });
  const finMat = new THREE.MeshPhysicalMaterial({ color: 0x5b6070, roughness: 0.45, metalness: 0.3, clearcoat: 0.5, side: THREE.DoubleSide });
  const lamp = decal(0xf4f7ff, { emissive: 0xc8d8ff, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.08 });
  // iter-05：燈罩（半透明灰白、低自發光）與 LED 燈條（高亮）分開，燈具才有層次
  const seam = decal(0x05060a, { roughness: 0.7, clearcoat: 0.0 });
  const lens = decal(0x9aa3b0, { emissive: 0x3a4250, emissiveIntensity: 0.3, metalness: 0.6, roughness: 0.12 });
  const led = decal(0xffffff, { emissive: 0xeaf2ff, emissiveIntensity: 1.0, metalness: 0.0, roughness: 0.2, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const lipMat = paint.clone();
  lipMat.side = THREE.DoubleSide;
  applyPaintFlop(lipMat);
  const emblemTex = canvasTexture(512, 512, drawHoodEmblem);
  const emblemMat = emblemTex ? decal(0xffffff, { map: emblemTex, alphaTest: 0.3, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }) : null;
  const tamiyaTex = canvasTexture(256, 256, drawTamiya);
  const intakeTex = canvasTexture(128, 16, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 128, 0);
    grd.addColorStop(0, '#000000');
    grd.addColorStop(0.35, '#05060a');
    grd.addColorStop(1, '#3a4152');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 16);
  });
  const intakeMat = intakeTex ? decal(0xffffff, { map: intakeTex, roughness: 0.7, clearcoat: 0.1 }) : null;
  const tamiyaMat = tamiyaTex ? decal(0xffffff, { map: tamiyaTex, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }) : null;

  g.add(buildHull(paint, inner));
  g.add(buildCabin(paint, glass, black));
  const midTex = canvasTexture(512, 64, drawMidship);
  if (midTex) {
    const midMat = decal(0xffffff, { map: midTex, alphaTest: 0.35, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    // 字頭（貼圖 V = 0）都朝車頂中線、從車外側看是正字：
    // 右側（+z）由後往前排字；左側（−z）由前往後排字（iter-02 左側也由後往前 → 俯視呈上下顛倒的鏡像字，reviewer 指出的 bug）
    g.add(roofDecal(-33, -13, 0.33, 0.43, midMat, 1));
    g.add(roofDecal(-13, -33, 0.33, 0.43, midMat, -1));
  }
  g.add(buildWheelWells(new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9, side: THREE.DoubleSide })));

  for (const side of [1, -1]) {
    // 前葉子板稜線外側的橘色條紋：從頭燈往後延伸到擋風玻璃旁
    g.add(ribbon(70, 20, (x, s) => [0.41, 0.41 + 0.075 * taper(s, 0.12, 0.4)], orange, side));
    // 橘色條紋內側的銀色細線
    g.add(ribbon(66, 34, (x, s) => [0.37, 0.37 + 0.03 * taper(s, 0.2, 0.3)], silver, side));
    // 側面橘色掃掠條紋：前輪後方低處 → 往後上揚到後葉子板
    g.add(ribbon(22, -36, (x, s) => {
      const c = 0.8 - 0.3 * s;
      const w = 0.06 * taper(s, 0.35, 0.12);
      return [c - w, c + w];
    }, orange, side));
    // 側面第二道細條紋（銀）
    g.add(ribbon(16, -22, (x, s) => {
      const c = 0.88 - 0.2 * s;
      const w = 0.025 * taper(s, 0.3, 0.2);
      return [c - w, c + w];
    }, silver, side));
    // 後葉子板橘色斜線
    g.add(ribbon(-24, -58, (x, s) => {
      const c = 0.5 - 0.12 * s;
      const w = 0.05 * taper(s, 0.2, 0.3);
      return [c - w, c + w];
    }, orange, side));
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
    g.add(ribbon(72, 56, (x, s) => lampBand(s), lens, side, 0.14, { nu: 8 }));
    // 主 LED 燈條：燈帶下緣算起 25%–42%，兩端漸尖
    g.add(ribbon(71.2, 57.2, (x, s) => {
      const [lo, hi] = lampBand(lampS(x));
      const w = 0.085 * taper(s, 0.06, 0.12);
      const c = lo + (hi - lo) * 0.34;
      return [c - w * (hi - lo), c + w * (hi - lo)];
    }, led, side, 0.24, { nu: 2 }));
    // 上方短 LED 燈條（前段）
    g.add(ribbon(70.4, 63.5, (x, s) => {
      const [lo, hi] = lampBand(lampS(x));
      const w = 0.06 * taper(s, 0.1, 0.2);
      const c = lo + (hi - lo) * 0.7;
      return [c - w * (hi - lo), c + w * (hi - lo)];
    }, led, side, 0.24, { nu: 2 }));
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
    for (let k = 0; k < 5; k++) {
      const xc = 60.6 - k * 2.4;
      g.add(raisedPad(xc + 0.45, xc - 0.45, 0.26, 0.34, 0.8, 0.35, finMat, side));
    }
    // 前輪後方側面百葉：深色底板＋4 片鰭片
    g.add(ribbon(26.6, 15.8, () => [0.54, 0.65], black, side, 0.06));
    for (let k = 0; k < 4; k++) {
      const xc = 25 - k * 2.4;
      g.add(raisedPad(xc + 0.5, xc - 0.5, 0.555, 0.635, 0.7, 0.3, finMat, side));
    }
    // 後輪前方的直立側進氣口：黑色內面＋前緣凸出 1.4 mm 的唇邊（前後立牆＋頂面），做出凹陷深度
    // 內面用由前（唇邊陰影，全黑）往後漸亮的漸層貼圖，表現往內凹的曲面
    // iter-06：reviewer「車門後方突兀的黑色垂直板」→ 唇邊由 1.0 mm 降到 0.45 mm、去掉唇邊頂面板；
    // 內面縮小並加 4 片橫向灰色鰭片（與前輪後方百葉同一語彙），讀起來是進氣格柵而不是黑色立板
    g.add(ribbon(-19.4, -24.2, (x, s) => [0.62 + 0.04 * s, 0.84 - 0.03 * s], intakeMat ?? black, side, 0.06, { uv: (s2, v) => [s2, v] }));
    g.add(edgeWall(-19.3, 0.6, 0.86, 0.45, 0.3, lipMat, side));
    for (let k = 0; k < 4; k++) {
      const uc = 0.655 + k * 0.05;
      g.add(raisedPad(-19.9, -23.4, uc, uc + 0.014, 0.45, 0, finMat, side));
    }
    // 引擎蓋騎士徽章＋CHEVALIER 字樣（Canvas 貼圖；左右兩半各取貼圖一半）
    if (emblemMat) {
      g.add(ribbon(71, 41, () => [0, 0.21], emblemMat, side, 0.1, { nu: 16, uv: (s, v) => [0.5 + side * 0.5 * v, s] }));
    }
    // TAMIYA 標誌（前輪後方下側；右側由後往前、左側由前往後，字才不會反）
    if (tamiyaMat) {
      const xa = side > 0 ? 16.6 : 23.6;
      const xb = side > 0 ? 23.6 : 16.6;
      g.add(ribbon(xa, xb, () => [0.82, 0.97], tamiyaMat, side, 0.1, { nu: 8, uv: (s, v) => [s, v] }));
    }
    // 引擎蓋前方 NACA 進氣口（深色）
    // iter-05：深色底面貼在下凹曲面上（寬度與 nacaHalfU 一致）
    g.add(ribbon(NACA_X0, NACA_X1 - 0.6, (x) => [0, nacaHalfU(x) * 0.8], black, side, 0.07, { nu: 8 }));
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
