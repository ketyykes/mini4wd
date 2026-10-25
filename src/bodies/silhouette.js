// 車殼輪廓（silhouette）與輪廓 IoU：量測兩款車殼造型差異（SPEC 第 2 部分 P20）
// 量法：把車殼外形三角形投影到側視（x–y 平面）與俯視（x–z 平面），以 0.5 mm 格點光柵化，
// 再從邊界往內填滿（開口、鏤空不算挖空 → 量的是「外輪廓」），IoU = 交集格數 / 聯集格數。
// 外形三角形 = 標 userData.shell 的 mesh（結構殼）＋標 userData.outline 的 mesh（不計殼面質量但屬外形的件：鰭片、尾翼、尾臂、分流板等）。
// 「計入質量」（shell / solid）和「計入輪廓」（shell / outline）分開標記：改質量算法不會改變 IoU 量法（SPEC P20）。
// 座標用車殼自身座標（底盤座標，所有車殼對齊同一組安裝點），不各自置中。
import * as THREE from 'three';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {{ view: 'side' | 'top' | 'front', cell: number, u0: number, v0: number, nu: number, nv: number, grid: Uint8Array }} Silhouette */

/** @type {number} 格點大小（mm） */
export const SILHOUETTE_CELL_MM = 0.5;

/** 投影視窗（mm，底盤座標）：涵蓋規則外框 165 × 105 × 70 */
const WINDOW = {
  side: { u0: -85, u1: 85, v0: -5, v1: 75 },
  top: { u0: -85, u1: 85, v0: -55, v1: 55 },
  front: { u0: -55, u1: 55, v0: -5, v1: 75 },
};

/** 算質量時用的中性材質（只需要幾何） */
const neutralMat = new THREE.MeshBasicMaterial();
const neutralMats = new Proxy({}, { get: () => neutralMat });

/** @type {(obj: THREE.Object3D) => boolean} 物件自己或祖先標為結構殼或外形件 */
const isOutline = (obj) => {
  for (let o = obj; o; o = o.parent) {
    if (o.userData?.shell || o.userData?.outline) {
      return true;
    }
  }
  return false;
};

/**
 * 在格點上填滿三角形（以格點中心是否在三角形內判定；邊緣含容差，避免細長三角形漏格）
 * @type {(s: Silhouette, a: number[], b: number[], c: number[]) => void}
 */
function fillTriangle(s, a, b, c) {
  const { cell, u0, v0, nu, nv, grid } = s;
  const minU = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - u0) / cell));
  const maxU = Math.min(nu - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - u0) / cell));
  const minV = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) - v0) / cell));
  const maxV = Math.min(nv - 1, Math.ceil((Math.max(a[1], b[1], c[1]) - v0) / cell));
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-9) {
    return;
  }
  const sgn = area > 0 ? 1 : -1;
  // 容差：半個格點寬（邊長正規化後的距離）
  const edges = [
    [a, b],
    [b, c],
    [c, a],
  ].map(([p, q]) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return { p, q, len };
  });
  const tol = s.view === 'front' ? 1e-9 : cell * 0.5;
  for (let iu = minU; iu <= maxU; iu++) {
    const pu = u0 + (iu + 0.5) * cell;
    for (let iv = minV; iv <= maxV; iv++) {
      const pv = v0 + (iv + 0.5) * cell;
      let inside = true;
      for (const { p, q, len } of edges) {
        const cross = ((q[0] - p[0]) * (pv - p[1]) - (q[1] - p[1]) * (pu - p[0])) * sgn;
        if (cross / len < -tol) {
          inside = false;
          break;
        }
      }
      if (inside) {
        grid[iu * nv + iv] = 1;
      }
    }
  }
}

/**
 * 填滿內部空洞：從視窗邊界做洪水填充，碰不到的空格都算輪廓內
 * @type {(s: Silhouette) => void}
 */
function fillHoles(s) {
  const { nu, nv, grid } = s;
  const outside = new Uint8Array(nu * nv);
  /** @type {number[]} */
  const stack = [];
  const push = (iu, iv) => {
    if (iu < 0 || iv < 0 || iu >= nu || iv >= nv) {
      return;
    }
    const k = iu * nv + iv;
    if (grid[k] || outside[k]) {
      return;
    }
    outside[k] = 1;
    stack.push(k);
  };
  for (let iu = 0; iu < nu; iu++) {
    push(iu, 0);
    push(iu, nv - 1);
  }
  for (let iv = 0; iv < nv; iv++) {
    push(0, iv);
    push(nu - 1, iv);
  }
  while (stack.length) {
    const k = stack.pop();
    const iu = Math.floor(k / nv);
    const iv = k % nv;
    push(iu + 1, iv);
    push(iu - 1, iv);
    push(iu, iv + 1);
    push(iu, iv - 1);
  }
  for (let k = 0; k < grid.length; k++) {
    if (!outside[k]) {
      grid[k] = 1;
    }
  }
}

/** @type {Map<string, Silhouette>} */
const cache = new Map();

/**
 * 車殼的側視或俯視填滿輪廓
 * front projects onto z–y and preserves openings for aerodynamic area.
 * @type {(body: BodyDef, view: 'side' | 'top' | 'front', cell?: number) => Silhouette}
 */
export function bodySilhouette(body, view, cell = SILHOUETTE_CELL_MM) {
  const key = `${body.id}:${view}:${cell}`;
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const w = WINDOW[view];
  const nu = Math.ceil((w.u1 - w.u0) / cell);
  const nv = Math.ceil((w.v1 - w.v0) / cell);
  /** @type {Silhouette} */
  const s = { view, cell, u0: w.u0, v0: w.v0, nu, nv, grid: new Uint8Array(nu * nv) };
  const g = body.build(neutralMats);
  g.updateMatrixWorld(true);
  const p = new THREE.Vector3();
  /** @type {(v: THREE.Vector3) => number[]} */
  const proj = view === 'front' ? (v) => [v.z, v.y] : view === 'side' ? (v) => [v.x, v.y] : (v) => [v.x, v.z];
  g.traverse((o) => {
    if (!o.isMesh || !isOutline(o)) {
      return;
    }
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const nTri = idx ? idx.count / 3 : pos.count / 3;
    /** @type {number[][]} */
    const pts = [];
    for (let i = 0; i < pos.count; i++) {
      pts.push(proj(p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)));
    }
    for (let t = 0; t < nTri; t++) {
      const i0 = idx ? idx.getX(3 * t) : 3 * t;
      const i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1;
      const i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
      fillTriangle(s, pts[i0], pts[i1], pts[i2]);
    }
  });
  if (view !== 'front') fillHoles(s);
  cache.set(key, s);
  return s;
}

/**
 * Union of the shell's frontal projection and installed components' projected
 * boxes. Count overlapping pixels once. Boxes use the static position, so slide
 * travel and damper sweep do not inflate aerodynamic area. C_d remains estimated.
 * @param {BodyDef | null} body
 * @param {{min: {y: number, z: number}, max: {y: number, z: number}}[]} boxes
 * @param {number} lift Shell translation from reference chassis coordinates (mm).
 */
export function frontalArea(body, boxes, lift = 0) {
  const shell = body ? bodySilhouette(body, 'front') : null;
  const cell = SILHOUETTE_CELL_MM;
  const minZ = Math.min(...boxes.map((b) => b.min.z), shell ? shell.u0 : Infinity);
  const maxZ = Math.max(...boxes.map((b) => b.max.z), shell ? shell.u0 + shell.nu * cell : -Infinity);
  const minY = Math.min(...boxes.map((b) => b.min.y), shell ? shell.v0 + lift : Infinity);
  const maxY = Math.max(...boxes.map((b) => b.max.y), shell ? shell.v0 + shell.nv * cell + lift : -Infinity);
  let pixels = 0;
  for (let iz = Math.floor(minZ / cell); iz < Math.ceil(maxZ / cell); iz++) {
    const z = (iz + 0.5) * cell;
    for (let iy = Math.floor(minY / cell); iy < Math.ceil(maxY / cell); iy++) {
      const y = (iy + 0.5) * cell;
      const u = shell ? Math.floor((z - shell.u0) / cell) : -1;
      const v = shell ? Math.floor((y - lift - shell.v0) / cell) : -1;
      const inShell = shell && u >= 0 && u < shell.nu && v >= 0 && v < shell.nv && shell.grid[u * shell.nv + v];
      if (inShell || boxes.some((b) => z >= b.min.z && z < b.max.z && y >= b.min.y && y < b.max.y)) pixels++;
    }
  }
  return pixels * cell * cell;
}

/**
 * 兩個同視角輪廓的 IoU（交集 / 聯集）
 * @type {(a: Silhouette, b: Silhouette) => number}
 */
export function silhouetteIoU(a, b) {
  let inter = 0;
  let uni = 0;
  for (let k = 0; k < a.grid.length; k++) {
    const x = a.grid[k];
    const y = b.grid[k];
    if (x && y) {
      inter++;
    }
    if (x || y) {
      uni++;
    }
  }
  return uni > 0 ? inter / uni : 0;
}

/**
 * 兩款車殼的側視與俯視輪廓 IoU
 * @type {(a: BodyDef, b: BodyDef) => { side: number, top: number }}
 */
export function bodyIoU(a, b) {
  return {
    side: silhouetteIoU(bodySilhouette(a, 'side'), bodySilhouette(b, 'side')),
    top: silhouetteIoU(bodySilhouette(a, 'top'), bodySilhouette(b, 'top')),
  };
}

/**
 * 輪廓面積（mm²）與外框，供回報 / 除錯
 * @type {(s: Silhouette) => { area_mm2: number }}
 */
export function silhouetteArea(s) {
  let n = 0;
  for (const v of s.grid) {
    n += v;
  }
  return { area_mm2: n * s.cell * s.cell };
}
