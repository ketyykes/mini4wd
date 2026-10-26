// 實體干涉（間隙）計算：零件以簡單實體表示（方塊、圓柱、板件稜柱），用「表面取樣點 → 對方實體的有號距離」求最小間隙
// 有號距離（SDF）外部為正、內部為負；兩實體的間隙 = min(A 表面點到 B 的距離, B 表面點到 A 的距離)
// 取樣間距 SAMPLE_MM，凸形之間的誤差 < 0.05 mm（最近點在稜線 / 頂點上，都有取樣）
// 單位 mm，底盤座標（與 bodies/index.js bodyClearance 相同）

/** @typedef {import('./types').Solid} Solid */
/** @typedef {import('./types').Vec3} Vec3 */

const SAMPLE_MM = 0.4;
/** 只在對方外框外擴 MARGIN 內的樣本點計算（更遠的不可能小於判定門檻 1 mm） */
const MARGIN = 2.5;
const profileCache = new WeakMap();
const profilePlate = (s) => {
  if (!profileCache.has(s)) profileCache.set(s, { kind: 'plate', outline: s.outline, holes: s.holes, y0: s.z0, y1: s.z1 });
  return profileCache.get(s);
};

/** Exact swept volume for translation along z. Plates use the union of the
 * two endpoint polygons and each edge's swept quadrilateral; concave outlines
 * therefore keep their recesses rather than becoming bounding rectangles. */
export const sweepZ = (solid, halfStroke) => {
  if (!(halfStroke > 0)) return solid;
  if (solid.kind === 'box') return { ...solid, min: { ...solid.min, z: solid.min.z - halfStroke }, max: { ...solid.max, z: solid.max.z + halfStroke } };
  if (solid.kind === 'cyl' && solid.axis === 'z') return { ...solid, halfLen: solid.halfLen + halfStroke };
  return { kind: 'sweepZ', source: solid, halfStroke };
};

/** @type {(px: number, pz: number, a: number[], b: number[]) => number} 點到線段距離（x-z 平面） */
const segDist = (px, pz, a, b) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
};

/** @type {(px: number, pz: number, poly: number[][]) => boolean} 點在多邊形內（射線法） */
const insidePoly = (px, pz, poly) => {
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

/** @type {(inner: number, along: number) => number} 兩個方向的距離合成（兩者 ≤ 0 時在內部） */
const combine = (a, b) => {
  if (a <= 0 && b <= 0) {
    return Math.max(a, b);
  }
  return Math.hypot(Math.max(a, 0), Math.max(b, 0));
};

/**
 * 點到實體的有號距離
 * @type {(s: Solid, x: number, y: number, z: number) => number}
 */
export const sdf = (s, x, y, z) => {
  if (s.kind === 'profileZ') return sdf(profilePlate(s), x, z, y);
  if (s.kind === 'sweepZ') {
    const { source: q, halfStroke: h } = s;
    if (q.kind === 'cyl') {
      const dz = Math.max(0, Math.abs(z - q.c.z) - h);
      return combine(Math.hypot(x - q.c.x, dz) - q.r, Math.abs(y - q.c.y) - q.halfLen);
    }
    let d = Math.min(sdf(q, x, y, z - h), sdf(q, x, y, z + h));
    for (let i = 0; i < q.outline.length; i++) {
      const a = q.outline[i], b = q.outline[(i + 1) % q.outline.length];
      // Edges parallel to the motion sweep a line, not an area.
      if (Math.abs(a[0] - b[0]) < 1e-12) continue;
      const edge = { kind: 'plate', y0: q.y0, y1: q.y1, outline: [[a[0], a[1] - h], [b[0], b[1] - h], [b[0], b[1] + h], [a[0], a[1] + h]] };
      d = Math.min(d, sdf(edge, x, y, z));
    }
    return d;
  }
  if (s.kind === 'box') {
    const dx = Math.max(s.min.x - x, x - s.max.x);
    const dy = Math.max(s.min.y - y, y - s.max.y);
    const dz = Math.max(s.min.z - z, z - s.max.z);
    if (dx <= 0 && dy <= 0 && dz <= 0) {
      return Math.max(dx, dy, dz);
    }
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
  }
  if (s.kind === 'cyl') {
    const c = s.c;
    if (s.axis === 'z') {
      return combine(Math.hypot(x - c.x, y - c.y) - s.r, Math.abs(z - c.z) - s.halfLen);
    }
    return combine(Math.hypot(x - c.x, z - c.z) - s.r, Math.abs(y - c.y) - s.halfLen);
  }
  // 板件：俯視多邊形 × y 範圍
  let d = Infinity;
  const o = s.outline;
  for (let i = 0; i < o.length; i++) {
    d = Math.min(d, segDist(x, z, o[i], o[(i + 1) % o.length]));
  }
  let d2 = insidePoly(x, z, o) ? -d : d;
  for (const hole of s.holes ?? []) {
    let hd = Infinity;
    for (let i = 0; i < hole.length; i++) hd = Math.min(hd, segDist(x, z, hole[i], hole[(i + 1) % hole.length]));
    d2 = Math.max(d2, insidePoly(x, z, hole) ? hd : -hd);
  }
  return combine(d2, Math.max(s.y0 - y, y - s.y1));
};

/**
 * 實體的外框
 * @type {(s: Solid) => { min: Vec3, max: Vec3 }}
 */
export const solidBox = (s) => {
  if (s.kind === 'profileZ') {
    const b = solidBox(profilePlate(s));
    return { min: { x: b.min.x, y: b.min.z, z: b.min.y }, max: { x: b.max.x, y: b.max.z, z: b.max.y } };
  }
  if (s.kind === 'sweepZ') {
    const b = solidBox(s.source);
    return { min: { ...b.min, z: b.min.z - s.halfStroke }, max: { ...b.max, z: b.max.z + s.halfStroke } };
  }
  if (s.kind === 'box') {
    return { min: s.min, max: s.max };
  }
  if (s.kind === 'cyl') {
    const c = s.c;
    if (s.axis === 'z') {
      return { min: { x: c.x - s.r, y: c.y - s.r, z: c.z - s.halfLen }, max: { x: c.x + s.r, y: c.y + s.r, z: c.z + s.halfLen } };
    }
    return { min: { x: c.x - s.r, y: c.y - s.halfLen, z: c.z - s.r }, max: { x: c.x + s.r, y: c.y + s.halfLen, z: c.z + s.r } };
  }
  const xs = s.outline.map((p) => p[0]);
  const zs = s.outline.map((p) => p[1]);
  return { min: { x: Math.min(...xs), y: s.y0, z: Math.min(...zs) }, max: { x: Math.max(...xs), y: s.y1, z: Math.max(...zs) } };
};

/** @type {(n: number) => number[]} 0..1 等分 n 段（含兩端） */
const steps = (len) => {
  const n = Math.max(1, Math.ceil(len / SAMPLE_MM));
  return Array.from({ length: n + 1 }, (_, i) => i / n);
};

/** @type {WeakMap<Solid, Float64Array>} */
const sampleCache = new WeakMap();

/**
 * 實體表面取樣點（扁平陣列 x,y,z,...）
 * @type {(s: Solid) => Float64Array}
 */
export const surfaceSamples = (s) => {
  const hit = sampleCache.get(s);
  if (hit) {
    return hit;
  }
  if (s.kind === 'profileZ') {
    const source = surfaceSamples(profilePlate(s));
    const out = Float64Array.from(source);
    for (let i = 0; i < out.length; i += 3) { out[i + 1] = source[i + 2]; out[i + 2] = source[i + 1]; }
    sampleCache.set(s, out);
    return out;
  }
  /** @type {number[]} */
  const out = [];
  if (s.kind === 'sweepZ') {
    const pts = surfaceSamples(s.source);
    for (const t of steps(2 * s.halfStroke)) {
      const dz = (2 * t - 1) * s.halfStroke;
      for (let i = 0; i < pts.length; i += 3) out.push(pts[i], pts[i + 1], pts[i + 2] + dz);
    }
  } else if (s.kind === 'box') {
    const { min, max } = s;
    const ux = steps(max.x - min.x);
    const uy = steps(max.y - min.y);
    const uz = steps(max.z - min.z);
    const X = (t) => min.x + (max.x - min.x) * t;
    const Y = (t) => min.y + (max.y - min.y) * t;
    const Z = (t) => min.z + (max.z - min.z) * t;
    for (const a of ux) {
      for (const b of uy) {
        out.push(X(a), Y(b), min.z, X(a), Y(b), max.z);
      }
      for (const c of uz) {
        out.push(X(a), min.y, Z(c), X(a), max.y, Z(c));
      }
    }
    for (const b of uy) {
      for (const c of uz) {
        out.push(min.x, Y(b), Z(c), max.x, Y(b), Z(c));
      }
    }
  } else if (s.kind === 'cyl') {
    const nA = Math.max(12, Math.ceil((2 * Math.PI * s.r) / SAMPLE_MM));
    const ua = steps(2 * s.halfLen);
    const ur = steps(s.r);
    for (let k = 0; k < nA; k++) {
      const ang = (k / nA) * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      /** @type {(rad: number, h: number) => void} */
      const push = (rad, h) => {
        if (s.axis === 'z') {
          out.push(s.c.x + rad * ca, s.c.y + rad * sa, s.c.z + h);
        } else {
          out.push(s.c.x + rad * ca, s.c.y + h, s.c.z + rad * sa);
        }
      };
      for (const t of ua) {
        push(s.r, -s.halfLen + 2 * s.halfLen * t);
      }
      for (const t of ur) {
        push(s.r * t, -s.halfLen);
        push(s.r * t, s.halfLen);
      }
    }
  } else {
    // 板件：上下面（多邊形內部格點）＋側面（沿邊取樣，上下與中間高度）
    const b = solidBox(s);
    const ys = steps(s.y1 - s.y0).map((t) => s.y0 + (s.y1 - s.y0) * t);
    for (const o of [s.outline, ...(s.holes ?? [])]) for (let i = 0; i < o.length; i++) {
      const p0 = o[i];
      const p1 = o[(i + 1) % o.length];
      for (const t of steps(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]))) {
        const x = p0[0] + (p1[0] - p0[0]) * t;
        const z = p0[1] + (p1[1] - p0[1]) * t;
        for (const y of ys) {
          out.push(x, y, z);
        }
      }
    }
    for (let x = b.min.x; x <= b.max.x; x += SAMPLE_MM * 2) {
      for (let z = b.min.z; z <= b.max.z; z += SAMPLE_MM * 2) {
        if (insidePoly(x, z, s.outline) && !(s.holes ?? []).some((hole) => insidePoly(x, z, hole))) {
          out.push(x, s.y0, z, x, s.y1, z);
        }
      }
    }
  }
  const arr = new Float64Array(out);
  sampleCache.set(s, arr);
  return arr;
};

/** @type {(a: { min: Vec3, max: Vec3 }, b: { min: Vec3, max: Vec3 }) => number} 兩外框的間距（重疊為 0） */
const boxGap = (a, b) =>
  Math.hypot(
    Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x),
    Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y),
    Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z),
  );

/** @type {(pts: ArrayLike<number>, target: Solid, box: { min: Vec3, max: Vec3 }) => number} 點集合到實體的最小有號距離（只算外框附近的點） */
const minDistTo = (pts, target, box) => {
  let d = Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i];
    const y = pts[i + 1];
    const z = pts[i + 2];
    if (x < box.min.x - MARGIN || x > box.max.x + MARGIN || y < box.min.y - MARGIN || y > box.max.y + MARGIN || z < box.min.z - MARGIN || z > box.max.z + MARGIN) {
      continue;
    }
    d = Math.min(d, sdf(target, x, y, z));
  }
  return d;
};

/**
 * 兩實體的間隙（mm，負值為穿透深度的近似）；外框相距超過 MARGIN 時回傳外框間距（一定 ≥ 判定門檻）
 * @type {(a: Solid, b: Solid) => number}
 */
export const solidGap = (a, b) => {
  const ba = solidBox(a);
  const bb = solidBox(b);
  const g = boxGap(ba, bb);
  if (g > MARGIN - 0.5) {
    return g;
  }
  const d = Math.min(minDistTo(surfaceSamples(a), b, bb), minDistTo(surfaceSamples(b), a, ba));
  return Number.isFinite(d) ? d : g;
};

/**
 * 車殼頂點到實體的最小有號距離（車殼頂點來自 bodies/index.js bodyMassProps(...).vertices，底盤座標）
 * 只檢查實體外框附近的頂點；都很遠時回傳 Infinity
 * @type {(vertices: Float32Array, s: Solid) => number}
 */
export const verticesGap = (vertices, s) => minDistTo(vertices, s, solidBox(s));
