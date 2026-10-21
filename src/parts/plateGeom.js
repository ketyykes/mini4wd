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
