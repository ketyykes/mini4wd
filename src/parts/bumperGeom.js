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

const polygonBounds = new WeakMap();
/** @type {(x: number, z: number, poly: Pt2[]) => boolean} */
export const inBumperPolygon = (x, z, poly) => {
  let bounds = polygonBounds.get(poly);
  if (!bounds) {
    bounds = [Math.min(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])), Math.max(...poly.map((p) => p[1]))];
    polygonBounds.set(poly, bounds);
  }
  if (x < bounds[0] || x > bounds[1] || z < bounds[2] || z > bounds[3]) return false;
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

// Clip the wide plate to the convex bridge. Keeping the whole bridge outline
// would add a small patch of new skin at its corners when cutting off the arms.
function clipToBridge(outline, bridge) {
  const signedArea = bridge.reduce((a, p, i) => a + p[0] * bridge[(i + 1) % bridge.length][1] - bridge[(i + 1) % bridge.length][0] * p[1], 0);
  const sign = Math.sign(signedArea);
  let polygon = outline;
  for (let i = 0; i < bridge.length; i++) {
    const a = bridge[i], b = bridge[(i + 1) % bridge.length];
    const distance = (p) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const next = [];
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j], q = polygon[(j + 1) % polygon.length];
      const dp = distance(p), dq = distance(q);
      if (dp >= 0) next.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        next.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    polygon = next;
  }
  return polygon;
}

/**
 * 保桿幾何
 * @param {any} ch
 * @param {number} sx
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
    webs.push({ x: sx > 0 ? 50 : -60, y: y - 2.2, z: sz * 21.5 - 0.6, top0: sx > 0 ? 1 : 3.2, top1: sx > 0 ? 3.2 : 1, thickness: 1.2 });
  }
  // Estimated injection-molded section: 1 mm skin + remaining rib depth.
  const skinThickness = Math.min(1.0, bt);
  const ribDepth = bt - skinThickness;
  /** @type {number[][][]} */
  const pockets = [
    roundedRectPts(sx * 57.5, 0, 8, 9, 1.5),
    roundedRectPts(sx * 68.5, 0, 6, 8, 1.5),
  ];
  for (const sz of [-1, 1]) {
    pockets.push([[sx * 52.5, sz * 19.2], [sx * 60.5, sz * 17.2], [sx * 52.5, sz * 6.5]]);
    pockets.push([[sx * 63.5, sz * 15.8], [sx * 71.5, sz * 8.6], [sx * 63.5, sz * 6.2]]);
    pockets.push([[sx * 54.5, sz * 5.2], [sx * 61.8, sz * 5.2], [sx * 61.8, sz * 15.5]]);
  }
  const g = { rx, rz, y, bt, bridge, wide, wideHoles, bosses, struts, webs, skinThickness, ribDepth, bridgePockets: pockets };
  // 橋接板範圍（前緣內縮到 rx + 1，確保在寬保桿外形內）
  const bridgeHole = g.bridge.map(([x, z]) => [Math.sign(x) * Math.min(Math.abs(x), g.rx + 1), z]);
  /** @type {number[][][]} */
  const ribHoles = [bridgeHole, ...g.wideHoles.filter((h) => !h.some(([x, z]) => inBumperPolygon(x, z, bridgeHole)))];
  // 沿導輪臂切成一格一格的口袋（每格長 4.6 mm、格間肋 1.0 mm），口袋寬度到臂的外形內 1.0 mm 為止（減重孔落在口袋裡）
  for (const sz of [-1, 1]) {
    const a0 = [53.5, 17];
    const a1 = [g.rx - 5.5, g.rz - 2.5];
    const L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
    const ux = (a1[0] - a0[0]) / L;
    const uz = (a1[1] - a0[1]) / L;
    const nx = -uz;
    const nz = ux;
    const P = (t, v) => [sx * (a0[0] + ux * t + nx * v), sz * (a0[1] + uz * t + nz * v)];
    /** @type {(t: number, dir: number) => number} 臂在 t 處往 ±v 方向到外形邊緣的距離 */
    const reach = (t, dir) => {
      let v = 0;
      while (v < 20) {
        const [x, z] = P(t, dir * (v + 0.1));
        if (!inBumperPolygon(x, z, g.wide) || inBumperPolygon(x, z, bridgeHole)) {
          break;
        }
        v += 0.1;
      }
      return v;
    };
    for (let t0 = 0.5; t0 + 4.6 <= L; t0 += 5.6) {
      const t1 = t0 + 4.6;
      const vp = Math.min(reach(t0, 1), reach(t1, 1), reach((t0 + t1) / 2, 1)) - 1.0;
      const vm = Math.min(reach(t0, -1), reach(t1, -1), reach((t0 + t1) / 2, -1)) - 1.0;
      if (vp + vm < 2.5) {
        continue;
      }
      ribHoles.push([P(t0, -vm), P(t1, -vm), P(t1, vp), P(t0, vp)]);
    }
  }
  // 口袋已涵蓋的減重孔不再單獨列（避免孔重疊）
  for (let i = ribHoles.length - 1; i >= 1; i--) {
    const h = ribHoles[i];
    if (h.length > 4 && ribHoles.some((q, j) => j !== i && q.length === 4 && h.every(([x, z]) => inBumperPolygon(x, z, q)))) {
      ribHoles.splice(i, 1);
    }
  }
  return { ...g, bridgeSkin: clipToBridge(wide, bridge), bridgeHole, ribHoles };
}

/** @type {Map<string, any>} */
const trimCache = new Map();

/**
 * 保桿切除的體積、質量、重心：上蓋、鏤空肋格、凸台、斜撐與補強片的聯集，
 * 扣除保留的中央橋接板與前緣立邊，以 0.1 mm 格點積分；質量 = 體積 × 密度。
 * @type {(ch: any, sx: number) => { volume_mm3: number, mass_g: number, com_mm: { x: number, y: number, z: number } }}
 */
export function bumperTrim(ch, sx) {
  if (sx < 0) {
    const front = bumperTrim(ch, 1);
    return { ...front, com_mm: { ...front.com_mm, x: -front.com_mm.x } };
  }
  const key = JSON.stringify([ch.bumperRollerX_mm, ch.bumperRollerZ_mm, ch.bumperBottomY_mm, ch.bumperThickness_mm, ch.groundClearanceRef_mm, ch.plateThickness_mm]);
  const hit = trimCache.get(key);
  if (hit) return { ...hit, mass_g: hit.volume_mm3 * ch.density_g_cm3 / 1000 };
  const g = bumperGeometry(ch, sx);
  // Integrate the union, subtracting the retained bridge and lip. In particular,
  // a roller boss overlapping the skin is counted once, rather than twice.
  const step = 0.1;
  const xs = [...g.wide.map((p) => p[0]), ...g.struts.flatMap((s) => [s.a[0] - s.w, s.a[0] + s.w, s.b[0] - s.w, s.b[0] + s.w])];
  const zs = [...g.wide.map((p) => p[1]), ...g.struts.flatMap((s) => [s.a[1] - s.w, s.a[1] + s.w, s.b[1] - s.w, s.b[1] + s.w])];
  let volume = 0;
  const mom = { x: 0, y: 0, z: 0 };
  for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) {
    for (let z = Math.min(...zs) + step / 2; z < Math.max(...zs); z += step) {
      const full = bumperIntervals(g, x, z, false);
      const keep = bumperIntervals(g, x, z, true);
      for (const interval of full) {
        let removed = [interval];
        for (const [lo, hi] of keep) {
          removed = removed.flatMap(([a, b]) => {
            if (hi <= a || lo >= b) return [[a, b]];
            const out = [];
            if (a < lo) out.push([a, lo]);
            if (hi < b) out.push([hi, b]);
            return out;
          });
        }
        for (const [a, b] of removed) {
          const v = (b - a) * step * step;
          volume += v;
          mom.x += x * v;
          mom.y += (a + b) / 2 * v;
          mom.z += z * v;
        }
      }
    }
  }
  const result = {
    volume_mm3: volume, mass_g: volume * ch.density_g_cm3 / 1000,
    com_mm: { x: mom.x / volume, y: mom.y / volume, z: mom.z / volume },
  };
  trimCache.set(key, result);
  return result;
}

/** Vertical material intervals in the shared nominal geometry (mm).
 * Bevels, screw heads and the pocket tint are visual details, not extra plastic.
 */
export function bumperIntervals(g, x, z, trimmed = false) {
  const intervals = [];
  const hole = g.wideHoles.some((p) => inBumperPolygon(x, z, p));
  const outline = trimmed ? g.bridgeSkin : g.wide;
  if (inBumperPolygon(x, z, outline) && !hole) intervals.push([g.y + g.ribDepth, g.y + g.bt]);
  if (inBumperPolygon(x, z, g.bridge) && !g.bridgePockets.some((p) => inBumperPolygon(x, z, p))) {
    intervals.push([g.y, g.y + g.ribDepth]);
  }
  // The front lip survives cutting off both arms.
  if (Math.abs(Math.abs(x) - (g.rx + 2.4)) <= 0.7 && Math.abs(z) <= 9) intervals.push([g.y, g.y + 4.2]);
  if (!trimmed) {
    if (inBumperPolygon(x, z, g.wide) && !g.ribHoles.some((p) => inBumperPolygon(x, z, p))) intervals.push([g.y, g.y + g.ribDepth]);
    for (const b of g.bosses) {
      if (Math.hypot(x - b.x, z - b.z) <= b.r) intervals.push([b.yc - b.h / 2, b.yc + b.h / 2]);
    }
    for (const s of g.struts) {
      const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1];
      const len = Math.hypot(dx, dz);
      const along = ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / len;
      const across = ((x - s.a[0]) * dz - (z - s.a[1]) * dx) / len;
      if (along >= 0 && along <= len && Math.abs(across) <= s.w / 2) intervals.push([s.yc - s.h / 2, s.yc + s.h / 2]);
    }
    for (const w of g.webs) {
      if (x >= w.x && x <= w.x + 10 && z >= w.z && z <= w.z + w.thickness) intervals.push([w.y, w.y + w.top0 + (x - w.x) / 10 * (w.top1 - w.top0)]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const union = [];
  for (const [a, b] of intervals) {
    const last = union[union.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else union.push([a, b]);
  }
  return union;
}
