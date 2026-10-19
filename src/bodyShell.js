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
const HALF_WIDTH = [[73, 25], [66, 33], [56, 37], [46, 39.5], [36, 40], [24, 39.3], [12, 38.2], [0, 38], [-12, 39.2], [-24, 41], [-34, 42], [-44, 42], [-52, 41], [-58, 38.5], [-63, 35]];
/** 中線高度：楔形車頭（鼻尖低）→ 引擎蓋 → 座艙下緣 → 車尾鴨尾 */
const CENTER_Y = [[73, 8], [66, 12], [56, 17], [46, 20.3], [36, 21.8], [24, 23], [12, 24.6], [0, 25.6], [-12, 26.6], [-24, 27.8], [-34, 29.4], [-44, 31.0], [-52, 31.8], [-58, 31.0], [-63, 28.0]];
/** 葉子板稜線高度：前輪上方隆起高於引擎蓋，後輪上方再隆起 */
const FENDER_Y = [[73, 11.5], [66, 18], [56, 24], [46, 29], [36, 30], [24, 28.5], [12, 27.0], [0, 26.8], [-12, 28.2], [-24, 31], [-34, 33.2], [-44, 34.0], [-52, 33.4], [-58, 31.4], [-63, 28.4]];
/** 稜線位置（佔半寬的比例） */
const FENDER_Z = [[73, 0.8], [56, 0.76], [36, 0.77], [12, 0.86], [-12, 0.86], [-34, 0.79], [-63, 0.78]];
/** 側面最寬處的高度 */
const SIDE_Y = [[73, 7.5], [66, 10], [56, 12.5], [46, 14], [-58, 14], [-63, 14]];
const BOTTOM_Y = 5.6;
const ARCH_R = spec.tire.diameter_mm / 2 + 2.5;

/** 車殼底緣（含前後輪拱開口） */
function bottomAt(x) {
  const archX = spec.chassis.wheelbase_mm / 2;
  const wheelY = spec.tire.diameter_mm / 2;
  let y = BOTTOM_Y;
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
  return new THREE.Vector3(x, q.y, side * q.z);
}

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
  const cols = 56;
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
  // 前後封口：以截面輪廓做扇形
  for (const x of [BODY_FRONT_X, BODY_REAR_X]) {
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
    cap.position.x = x;
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
 * @param {{ nu?: number, uv?: (s: number, v: number) => [number, number] }} [opts] nu：截面方向細分；uv：貼圖座標（預設 (s, v)）
 */
function ribbon(x0, x1, band, mat, side, lift = 0.06, opts = {}) {
  const nx = Math.max(4, Math.ceil(Math.abs(x1 - x0) / 0.8));
  const nu = opts.nu ?? 6;
  const uvFn = opts.uv ?? ((s, v) => [s, v]);
  const pos = [];
  const nrm = [];
  const uvs = [];
  for (let i = 0; i <= nx; i++) {
    const s = i / nx;
    const x = x0 + (x1 - x0) * s;
    const [ua, ub] = band(x, s);
    for (let j = 0; j <= nu; j++) {
      const u = ua + ((ub - ua) * j) / nu;
      const n = bodyNormal(x, u, side);
      const p = bodyPoint(x, u, side).addScaledVector(n, lift);
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
const CABIN_X1 = -53;
// iter-02：座艙與後段車頂墊高（ref_chevalier-ma_side-high：車頂延伸成 MIDSHIP AERO 後甲板，到後輪上方才下降），最高點維持 ≤ 38 mm（SPEC 1.12 外框高）
const CABIN_TOP = [[15, 24.6], [8, 30.6], [0, 34.9], [-8, 37.0], [-16, 37.7], [-26, 37.7], [-36, 36.9], [-44, 35.2], [-50, 33.4], [-53, 32.3]];
const CABIN_TOP_W = [[15, 17], [0, 19], [-16, 19.5], [-36, 18.5], [-50, 15], [-53, 14]];
const CABIN_BASE_W = [[15, 27], [0, 30], [-16, 31], [-36, 30.5], [-50, 27], [-53, 26]];

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
        const sideWindow = x > -31 && x < 12 && u >= 0.5 && u < 0.86;
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
  // 擋風玻璃黑色窗框（沿 x = −7 的上緣與兩側 A 柱）
  const frame = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < 26; i++) {
      const u0 = i / 26 * 0.5;
      const u1 = (i + 1) / 26 * 0.5;
      const pA = cabinPoint(-7, u0, side);
      const pB = cabinPoint(-7, u1, side);
      frame.push([pA, pB]);
    }
  }
  for (const [a, b] of frame) {
    const len = a.distanceTo(b);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, len + 0.05), trimMat);
    bar.position.copy(a).add(b).multiplyScalar(0.5);
    bar.position.y += 0.1;
    bar.lookAt(b.x, b.y + 0.1, b.z);
    g.add(bar);
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
      pos.push(x, smoothTable(CABIN_TOP, x) - 0.1 * r * r + 0.2, zz);
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
      pos.push(p.x, p.y + 0.12, p.z);
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
 * 建立 Chevalier 車殼（含座艙、條紋、燈組、散熱口）
 * @param {object} mats 由 model.js 傳入的共用材質
 */
export function buildChevalierBody(mats) {
  const g = new THREE.Group();
  g.name = 'body';
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x1d2c9e,
    roughness: 0.38,
    metalness: 0.35,
    clearcoat: 0.7,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.7,
    side: THREE.FrontSide,
  });
  // 車殼內面（深色）與邊緣翻邊／封口（車漆雙面）
  const inner = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, side: THREE.BackSide });
  inner.userData.flange = paint.clone();
  inner.userData.flange.side = THREE.DoubleSide;
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x7d6650, roughness: 0.12, metalness: 0.75, envMapIntensity: 0.8, clearcoat: 1.0, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
  const decal = (color, extra = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide, ...extra });
  const orange = decal(0xff6a12);
  const silver = decal(0xc9ced6, { metalness: 0.7, roughness: 0.25 });
  const darkGray = decal(0x1a1e28, { roughness: 0.5, clearcoat: 0.3 });
  const black = decal(0x0b0c10, { roughness: 0.6, clearcoat: 0.2 });
  const lamp = decal(0xf4f7ff, { emissive: 0xc8d8ff, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.08 });
  const lipMat = paint.clone();
  lipMat.side = THREE.DoubleSide;
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
    // 兩側都由後往前排字（左側若反向會呈鏡像，iter-02 截圖確認過）
    g.add(roofDecal(-33, -13, 0.33, 0.43, midMat, 1));
    g.add(roofDecal(-33, -13, 0.33, 0.43, midMat, -1));
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
    g.add(ribbon(72, 56, (x, s) => [0.5 + 0.06 * s, 0.62 + 0.04 * s - 0.05 * Math.max(0, s - 0.7) / 0.3], lamp, side, 0.08));
    // 尾燈（ref_chevalier-ma_rear34：透明白色細長 LED 燈，外圍黑色燈殼）
    g.add(ribbon(-55.5, -63, (x, s) => [0.37, 0.61], black, side, 0.06));
    g.add(ribbon(-57, -63, (x, s) => [0.42 + 0.03 * (1 - s), 0.56], lamp, side, 0.09));
    // 前葉子板內側百葉散熱口（4 條）
    for (let k = 0; k < 4; k++) {
      const xc = 60 - k * 2.6;
      g.add(ribbon(xc + 0.6, xc - 0.6, () => [0.26, 0.34], darkGray, side, 0.08));
    }
    // 前輪後方側面百葉（4 條）
    for (let k = 0; k < 4; k++) {
      const xc = 25 - k * 2.4;
      g.add(ribbon(xc + 0.7, xc - 0.7, () => [0.55, 0.64], darkGray, side, 0.08));
    }
    // 後輪前方的直立側進氣口：黑色內面＋前緣凸出 1.4 mm 的唇邊（前後立牆＋頂面），做出凹陷深度
    // 內面用由前（唇邊陰影，全黑）往後漸亮的漸層貼圖，表現往內凹的曲面
    g.add(ribbon(-19, -25, (x, s) => [0.6 + 0.05 * s, 0.86 - 0.04 * s], intakeMat ?? black, side, 0.06, { uv: (s2, v) => [s2, v] }));
    g.add(edgeWall(-19.2, 0.57, 0.89, 1.0, 0.6, lipMat, side));
    g.add(edgeWall(-17.4, 0.57, 0.89, 1.0, 0, lipMat, side));
    g.add(ribbon(-17.4, -19.8, () => [0.57, 0.89], lipMat, side, 1.0));
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
    g.add(ribbon(25, 15.5, (x, s) => [0, 0.08 + 0.04 * s], black, side, 0.07));
  }
  // 車尾封口下方的深色擾流（看得到底盤的開口）
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 48), mats.chassisDark);
  diffuser.position.set(BODY_REAR_X - 0.3, 11, 0);
  g.add(diffuser);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
