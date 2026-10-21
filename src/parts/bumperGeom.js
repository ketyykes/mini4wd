// 底盤一體保桿的幾何（前後對稱，sx = +1 前、−1 後；底盤座標 mm）
// 同一份定義給：3D 模型畫保桿（model.js）、裝 FRP / 碳纖導輪板時的「保桿切除」質量與重心扣除（assembly.js）
// 切除範圍 = 一體寬保桿板扣掉中央橋接板範圍（兩側導輪臂）＋兩個導輪座凸台＋兩支三角斜撐＋兩片斜撐補強片

/** @typedef {[number, number]} Pt2 */

/** @type {(cx: number, cz: number, r: number, n?: number) => Pt2[]} 圓（x-z 平面） */
export const circlePts = (cx, cz, r, n = 16) =>
  Array.from({ length: n }, (_, k) => /** @type {Pt2} */ ([cx + r * Math.cos((k / n) * Math.PI * 2), cz + r * Math.sin((k / n) * Math.PI * 2)]));

/** @type {(cx: number, cz: number, lx: number, lz: number, r: number, seg?: number) => Pt2[]} 圓角矩形（x-z 平面） */
export const roundedRectPts = (cx, cz, lx, lz, r, seg = 6) => {
  /** @type {Pt2[]} */
  const pts = [];
  const hx = lx / 2 - r;
  const hz = lz / 2 - r;
  for (const [x, z, a0] of [[hx, hz, 0], [-hx, hz, Math.PI / 2], [-hx, -hz, Math.PI], [hx, -hz, (3 * Math.PI) / 2]]) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + x + Math.cos(a) * r, cz + z + Math.sin(a) * r]);
    }
  }
  return pts;
};

/** @type {(x: number, z: number, poly: Pt2[]) => boolean} */
const inPoly = (x, z, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      c = !c;
    }
  }
  return c;
};

/**
 * 保桿幾何
 * @type {(ch: any, sx: number) => { rx: number, rz: number, y: number, bt: number, bridge: Pt2[], wide: Pt2[], wideHoles: Pt2[][], bosses: { x: number, z: number, r: number, h: number, yc: number }[], struts: { a: Pt2, b: Pt2, w: number, h: number, yc: number }[], webs: { x: number, y: number, z: number, area: number, thickness: number, cy: number }[] }}
 */
export function bumperGeometry(ch, sx) {
  const rx = ch.bumperRollerX_mm;
  const rz = ch.bumperRollerZ_mm;
  const y = ch.bumperBottomY_mm;
  const bt = ch.bumperThickness_mm;
  const floorTop = ch.groundClearanceRef_mm + ch.plateThickness_mm;
  /** @type {Pt2[]} 中央橋接板（底盤前端 → 導輪臂根部） */
  const bridge = [
    [sx * 50, -22],
    [sx * 62, -20],
    [sx * (rx + 3), -9],
    [sx * (rx + 3), 9],
    [sx * 62, 20],
    [sx * 50, 22],
  ];
  // 一體寬保桿外形（俯視，iter-35）：根部 (50, ±22) 以二次曲線往外前方接到導輪座，包住導輪座，前緣內凹
  /** @type {Pt2[]} */
  const outline = [];
  const rootX = 50;
  /** @type {(a: number[], b: number[], c: number[], n: number) => void} */
  const arc = (a, b, c, n) => {
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      outline.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * b[0] + u * u * c[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * b[1] + u * u * c[1]]);
    }
  };
  arc([rootX, -22], [rx - 12, -24], [rx - 2.5, -(rz + 4.4)], 10);
  arc([rx + 1.5, -(rz + 4.6)], [rx + 5.2, -(rz + 3)], [rx + 5, -(rz - 3.5)], 6);
  arc([rx + 3.2, -(rz - 9)], [rx - 1, -12], [rx + 3, -6], 8);
  outline.push([rx + 3, 6]);
  arc([rx - 1 + 4, 6], [rx - 1, 12], [rx + 3.2, rz - 9], 8);
  arc([rx + 5, rz - 3.5], [rx + 5.2, rz + 3], [rx + 1.5, rz + 4.6], 6);
  arc([rx - 2.5, rz + 4.4], [rx - 12, 24], [rootX, 22], 10);
  /** @type {Pt2[]} */
  const wide = outline.map(([X, Z]) => [sx * X, Z]);
  // 減重孔：兩臂各一排長圓孔＋中央一排圓孔
  /** @type {Pt2[][]} */
  const wideHoles = [];
  for (const hx of [56, 62]) {
    wideHoles.push(circlePts(sx * hx, 0, 1.1, 14));
  }
  for (const sz of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const f = 0.22 + k * 0.24;
      wideHoles.push(roundedRectPts(sx * (55 + (rx - 55) * f), sz * (18 + (rz - 18) * f), 3.6, 2.2, 1.0));
    }
    wideHoles.push(circlePts(sx * 54, sz * 13.5, 1.0, 14));
  }
  const bosses = [];
  const struts = [];
  const webs = [];
  for (const sz of [-1, 1]) {
    const ax0 = sx * 54;
    const az0 = sz * 16;
    const ax1 = sx * rx;
    const az1 = sz * rz;
    // 導輪座凸台
    bosses.push({ x: ax1, z: az1, r: 4.6, h: bt + 1.0, yc: y + (bt + 1.0) / 2 - 0.5 });
    // 三角斜撐：臂中段下方往後下方連回底盤側框
    const mx = ax0 + (ax1 - ax0) * 0.45;
    const mz = az0 + (az1 - az0) * 0.45;
    struts.push({ a: /** @type {Pt2} */ ([sx * 44, sz * 22.5]), b: /** @type {Pt2} */ ([mx, mz]), w: 1.6, h: 1.6, yc: (floorTop + y) / 2 + 0.4 });
    // 補強片（梯形，面積 = 10 × (1 + 3.2) / 2）
    webs.push({ x: sx > 0 ? 50 : -60, y: y - 2.2, z: sz * 21.5 - 0.6, area: 21, thickness: 1.2, cy: y - 2.2 + 1.4 });
  }
  return { rx, rz, y, bt, bridge, wide, wideHoles, bosses, struts, webs };
}

/** @type {Map<string, any>} */
const trimCache = new Map();

/**
 * 保桿切除的體積、質量、重心：寬保桿板在中央橋接板以外的部分（扣減重孔，0.1 mm 格點積分）× 板厚，
 * 加上凸台、斜撐、補強片；質量 = 體積 × 底盤材料密度
 * @type {(ch: any, sx: number) => { volume_mm3: number, mass_g: number, com_mm: { x: number, y: number, z: number } }}
 */
export function bumperTrim(ch, sx) {
  const key = `${ch.id}|${sx}|${ch.bumperRollerX_mm}|${ch.bumperRollerZ_mm}|${ch.bumperThickness_mm}|${ch.density_g_cm3}`;
  const hit = trimCache.get(key);
  if (hit) {
    return hit;
  }
  const g = bumperGeometry(ch, sx);
  const step = 0.1;
  const xs = g.wide.map((p) => p[0]);
  const zs = g.wide.map((p) => p[1]);
  let area = 0;
  let mx = 0;
  let mz = 0;
  for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) {
    for (let z = Math.min(...zs) + step / 2; z < Math.max(...zs); z += step) {
      if (!inPoly(x, z, g.wide) || inPoly(x, z, g.bridge) || g.wideHoles.some((h) => inPoly(x, z, h))) {
        continue;
      }
      area += step * step;
      mx += x * step * step;
      mz += z * step * step;
    }
  }
  /** @type {{ v: number, x: number, y: number, z: number }[]} 各塊的體積與形心 */
  const pieces = [{ v: area * g.bt, x: mx / area, y: g.y + g.bt / 2, z: mz / area }];
  for (const b of g.bosses) {
    pieces.push({ v: Math.PI * b.r * b.r * b.h, x: b.x, y: b.yc, z: b.z });
  }
  for (const s of g.struts) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    pieces.push({ v: len * s.w * s.h, x: (s.a[0] + s.b[0]) / 2, y: s.yc, z: (s.a[1] + s.b[1]) / 2 });
  }
  for (const w of g.webs) {
    pieces.push({ v: w.area * w.thickness, x: w.x + 5, y: w.cy, z: w.z + w.thickness / 2 });
  }
  const volume = pieces.reduce((a, p) => a + p.v, 0);
  const com = { x: 0, y: 0, z: 0 };
  for (const p of pieces) {
    com.x += (p.v * p.x) / volume;
    com.y += (p.v * p.y) / volume;
    com.z += (p.v * p.z) / volume;
  }
  const result = { volume_mm3: volume, mass_g: (volume * ch.density_g_cm3) / 1000, com_mm: com };
  trimCache.set(key, result);
  return result;
}
