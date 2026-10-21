// 導輪架板件（FRP / 碳纖）的俯視外形與質量：外形同時給規則檢查（干涉）、質量推導、3D 模型使用（單一來源）
// 座標：底盤座標 x-z 平面（mm）；前導輪架 x > 0，後導輪架以 sx = −1 鏡射

/** @typedef {[number, number]} Pt2 */

/**
 * 前後導輪板外形（左右對稱）：根部（鎖在保桿下方）→ 斜伸臂 → 包住導輪座的圓角墊 → 板前緣
 * @type {(o: { sx: number, rootX: number, rootHalfW: number, rollerX: number, rollerZ: number, padR: number, noseX: number, noseHalfW: number }) => Pt2[]}
 */
export const wingOutline = ({ sx, rootX, rootHalfW, rollerX, rollerZ, padR, noseX, noseHalfW }) => {
  /** @type {Pt2[]} */
  const half = [
    [rootX, -rootHalfW],
    [rollerX - padR * 1.2, -(rollerZ + padR * 0.2)],
    [rollerX - padR * 0.5, -(rollerZ + padR * 0.95)],
    [rollerX + padR * 0.5, -(rollerZ + padR * 0.95)],
    [rollerX + padR, -rollerZ],
    [rollerX + padR * 0.6, -(rollerZ - padR * 1.6)],
    [noseX, -noseHalfW],
  ];
  /** @type {Pt2[]} */
  const mirrored = half.map(([x, z]) => [x, -z]).reverse();
  return [...half, ...mirrored].map(([x, z]) => [sx * x, z]);
};

/** @type {(pts: Pt2[]) => number} 多邊形面積（mm²，鞋帶公式） */
export const polygonArea = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    a += x0 * z1 - x1 * z0;
  }
  return Math.abs(a) / 2;
};

/** @type {(pts: Pt2[]) => Pt2} 多邊形面積形心 */
export const polygonCentroid = (pts) => {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    const c = x0 * z1 - x1 * z0;
    a += c;
    cx += (x0 + x1) * c;
    cz += (z0 + z1) * c;
  }
  return [cx / (3 * a), cz / (3 * a)];
};

/**
 * 板件質量（g）：（外形面積 − 開孔面積）× 厚度 × 密度
 * @type {(outline: Pt2[], holeArea_mm2: number, thickness_mm: number, density_g_cm3: number) => number}
 */
export const plateMass = (outline, holeArea_mm2, thickness_mm, density_g_cm3) =>
  ((polygonArea(outline) - holeArea_mm2) * thickness_mm * density_g_cm3) / 1000;

/**
 * 左右對稱外形：half 為 z ≤ 0 那一半的頂點（由板前緣中線 → 外側 → 板後緣中線，x 取正值），
 * 自動鏡射出 z > 0 那一半；sx = −1 時整個外形鏡射到車尾（−x）
 * @type {(half: Pt2[], sx: number) => Pt2[]}
 */
export const symmetricOutline = (half, sx) => {
  /** @type {Pt2[]} */
  const mirrored = half
    .filter(([, z]) => z !== 0)
    .map(([x, z]) => /** @type {Pt2} */ ([x, -z]))
    .reverse();
  return [...half, ...mirrored].map(([x, z]) => [sx * x, z]);
};

/** @type {(px: number, pz: number, a: number[], b: number[]) => number} 點到線段距離 */
const segDist2 = (px, pz, a, b) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
};

/** @type {(px: number, pz: number, poly: Pt2[]) => boolean} */
const insidePoly2 = (px, pz, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) {
      c = !c;
    }
  }
  return c;
};

/**
 * 沿線段 a → b 以固定間距排一排圓孔（實車導輪板的成排小孔），左右對稱（z 取正負各一排）。
 * 只保留「孔緣離板外形 ≥ minWeb、離已有的孔 ≥ minWeb」的孔，確保板子不會被打穿到邊
 * @type {(outline: Pt2[], a: Pt2, b: Pt2, spacing: number, r: number, existing: { x: number, z: number, r: number }[], minWeb?: number) => { x: number, z: number, r: number }[]}
 */
export const holeRow = (outline, a, b, spacing, r, existing, minWeb = 0.9) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.floor(len / spacing) + 1);
  /** @type {{ x: number, z: number, r: number }[]} */
  const out = [];
  for (const sz of a[1] === 0 && b[1] === 0 ? [1] : [1, -1]) {
    for (let k = 0; k < n; k++) {
      const f = n > 1 ? k / (n - 1) : 0.5;
      const x = a[0] + (b[0] - a[0]) * f;
      const z = sz * (a[1] + (b[1] - a[1]) * f);
      if (!insidePoly2(x, z, outline)) {
        continue;
      }
      let edge = Infinity;
      for (let i = 0; i < outline.length; i++) {
        edge = Math.min(edge, segDist2(x, z, outline[i], outline[(i + 1) % outline.length]));
      }
      if (edge - r < minWeb) {
        continue;
      }
      const all = [...existing, ...out];
      if (all.some((h) => Math.hypot(h.x - x, h.z - z) - h.r - r < minWeb)) {
        continue;
      }
      out.push({ x, z, r });
    }
  }
  return out;
};
