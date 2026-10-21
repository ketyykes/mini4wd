// 賽道幾何：中心線（直線＋圓弧）、車道偏移、側牆線段（模型與物理共用）
// 座標：水平面為 (x, z)，y 向上；長度單位 m
// 偏移 d 沿法向量 n = (-sinθ, cosθ)，彎道向 +n 方向轉，所以 d 越大越靠內側
import { spec } from './spec.js';

const MM = 0.001;

/** @typedef {{ type: 'straight', length: number } | { type: 'arc', radius: number, angle: number }} Segment */
/** @typedef {{ x: number, z: number, theta: number }} Pose */
/** @typedef {{ cx: number, cz: number, yaw: number, length: number, thickness: number, height: number, kind: string }} WallBox */

/** 共用賽道尺寸（m） */
export function trackDims() {
  const t = spec.track;
  const laneWidth = t.laneWidth_mm * MM;
  const wallT = t.wallThickness_mm * MM;
  return {
    laneWidth,
    wallT,
    wallH: t.wallHeight_mm * MM,
    pitch: laneWidth + wallT,
    lanes: t.lanes,
  };
}

/** 建立中心線路徑（分段），提供 pose(s) 與 project(x, z) */
export class Path {
  /** @param {Segment[]} segments @param {boolean} closed */
  constructor(segments, closed) {
    this.segments = [];
    this.closed = closed;
    let s = 0;
    let x = 0;
    let z = 0;
    let theta = 0;
    for (const seg of segments) {
      const len = seg.type === 'straight' ? seg.length : seg.radius * seg.angle;
      this.segments.push({ ...seg, s0: s, len, x0: x, z0: z, theta0: theta });
      const end = this._poseInSeg(this.segments[this.segments.length - 1], len);
      x = end.x;
      z = end.z;
      theta = end.theta;
      s += len;
    }
    this.length = s;
  }

  _poseInSeg(seg, ds) {
    const c = Math.cos(seg.theta0);
    const sn = Math.sin(seg.theta0);
    if (seg.type === 'straight') {
      return { x: seg.x0 + c * ds, z: seg.z0 + sn * ds, theta: seg.theta0 };
    }
    // 圓心位於起點 +n 方向 R 處
    const cx = seg.x0 - sn * seg.radius;
    const cz = seg.z0 + c * seg.radius;
    const th = seg.theta0 + ds / seg.radius;
    return { x: cx + Math.sin(th) * seg.radius, z: cz - Math.cos(th) * seg.radius, theta: th };
  }

  /** 正規化 s（封閉路徑取模） */
  wrap(s) {
    if (!this.closed) {
      return s;
    }
    return ((s % this.length) + this.length) % this.length;
  }

  segmentAt(s) {
    const ss = this.wrap(s);
    for (const seg of this.segments) {
      if (ss <= seg.s0 + seg.len + 1e-12) {
        return seg;
      }
    }
    return this.segments[this.segments.length - 1];
  }

  /** @returns {Pose} 中心線姿態 */
  pose(s) {
    const ss = this.wrap(s);
    const seg = this.segmentAt(ss);
    return this._poseInSeg(seg, ss - seg.s0);
  }

  /** 中心線偏移 d 處的世界座標 */
  point(s, d) {
    const p = this.pose(s);
    return { x: p.x - Math.sin(p.theta) * d, z: p.z + Math.cos(p.theta) * d, theta: p.theta };
  }

  /** 世界座標投影回 (s, d)，取最近的分段 */
  project(x, z) {
    let best = null;
    for (const seg of this.segments) {
      let ds;
      let d;
      const c = Math.cos(seg.theta0);
      const sn = Math.sin(seg.theta0);
      if (seg.type === 'straight') {
        const dx = x - seg.x0;
        const dz = z - seg.z0;
        ds = dx * c + dz * sn;
        d = -dx * sn + dz * c;
      } else {
        const cx = seg.x0 - sn * seg.radius;
        const cz = seg.z0 + c * seg.radius;
        const rx = x - cx;
        const rz = z - cz;
        const dist = Math.hypot(rx, rz);
        // 點相對圓心的角度 → 中心線上的 θ
        let th = Math.atan2(rx, -rz);
        let rel = th - seg.theta0;
        rel = ((rel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (rel > seg.angle + 0.5 * (2 * Math.PI - seg.angle)) {
          rel -= 2 * Math.PI;
        }
        ds = rel * seg.radius;
        d = seg.radius - dist;
      }
      const outside = ds < -1e-6 ? -ds : ds > seg.len + 1e-6 ? ds - seg.len : 0;
      const score = outside * 10 + Math.abs(d);
      if (!best || score < best.score) {
        best = { s: seg.s0 + Math.min(Math.max(ds, 0), seg.len), d, score, seg };
      }
    }
    return best;
  }
}

/**
 * 側牆線：每條線是 s 的函式 offset(s)，範圍 [sStart, sEnd]；bottom / top 為牆的底面與頂面高度（m，預設 0 與牆高）
 * @typedef {{ sStart: number, sEnd: number, offset: (s: number) => number, kind: string, outward: number, closed?: boolean, bottom?: (s: number) => number, top?: (s: number) => number, widen?: (s: number) => number }} WallLine
 */

/** @typedef {{ vertices: Float32Array, indices: Uint32Array, kind: string }} TrackMesh */

/**
 * 沿中心線掃出的實心斷面（牆、橋板、橫樑都用這個）：每個取樣 s 的斷面是
 * 橫向 [dA, dB]、高度 [y0, y1] 的矩形，相鄰斷面連成封閉的三角網格（Rapier trimesh 與 Three.js 共用同一份頂點）。
 * 一條牆線只產生一個網格，避免多個方塊接縫造成導輪「內部邊緣」碰撞（ghost collision）
 * @type {(path: Path, sList: number[], closed: boolean, section: (s: number) => { dA: number, dB: number, y0: number, y1: number }, kind: string) => TrackMesh}
 */
function sweepMesh(path, sList, closed, section, kind) {
  const count = sList.length;
  const verts = [];
  for (const sv of sList) {
    const sec = section(sv);
    // A 面：朝車道那一側；B 面：另一側
    const a = path.point(sv, sec.dA);
    const bpt = path.point(sv, sec.dB);
    verts.push(a.x, sec.y0, a.z, a.x, sec.y1, a.z, bpt.x, sec.y0, bpt.z, bpt.x, sec.y1, bpt.z);
  }
  const idx = [];
  const v = (i, k) => (i % count) * 4 + k;
  const pt = (i) => [verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2]];
  // 加入一個四邊形，並依內部參考點翻轉成外法向
  const quad = (p0, p1, p2, p3, insideRef) => {
    const [ax, ay, az] = pt(p0);
    const [bx, by, bz] = pt(p1);
    const [cx, cy, cz] = pt(p2);
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const wx = cx - ax;
    const wy = cy - ay;
    const wz = cz - az;
    const nx = uy * wz - uz * wy;
    const ny = uz * wx - ux * wz;
    const nz = ux * wy - uy * wx;
    const dot = nx * (ax - insideRef[0]) + ny * (ay - insideRef[1]) + nz * (az - insideRef[2]);
    if (dot >= 0) {
      idx.push(p0, p1, p2, p0, p2, p3);
    } else {
      idx.push(p0, p2, p1, p0, p3, p2);
    }
  };
  const centerOf = (i) => {
    const c = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const q = pt(v(i, k));
      c[0] += q[0] / 4;
      c[1] += q[1] / 4;
      c[2] += q[2] / 4;
    }
    return c;
  };
  const segs = closed ? count : count - 1;
  for (let i = 0; i < segs; i++) {
    const j = i + 1;
    const c0 = centerOf(i);
    const c1 = centerOf(j);
    const ref = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2];
    quad(v(i, 0), v(j, 0), v(j, 1), v(i, 1), ref); // A 面
    quad(v(i, 2), v(j, 2), v(j, 3), v(i, 3), ref); // B 面
    quad(v(i, 1), v(j, 1), v(j, 3), v(i, 3), ref); // 頂面
    quad(v(i, 0), v(j, 0), v(j, 2), v(i, 2), ref); // 底面
  }
  if (!closed) {
    const c0 = centerOf(0);
    const c1 = centerOf(1);
    quad(v(0, 0), v(0, 1), v(0, 3), v(0, 2), [c1[0], c0[1], c1[2]]);
    const last = count - 1;
    const d1 = centerOf(last - 1);
    quad(v(last, 0), v(last, 1), v(last, 3), v(last, 2), [d1[0], d1[1], d1[2]]);
  }
  return { vertices: new Float32Array(verts), indices: new Uint32Array(idx), kind };
}

/**
 * 均勻取樣 [s0, s1]（步長 ≤ step），並插入指定的斷點
 * @type {(s0: number, s1: number, step: number, closed: boolean, breaks?: number[]) => number[]}
 */
function sampleRange(s0, s1, step, closed, breaks = []) {
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  const count = closed ? n : n + 1;
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push(s0 + ((s1 - s0) * i) / n);
  }
  for (const b of breaks) {
    if (b > s0 + 1e-4 && b < s1 - 1e-4) {
      list.push(b);
    }
  }
  list.sort((p, q) => p - q);
  return list.filter((sv, i) => i === 0 || sv - list[i - 1] > 1e-4);
}

/**
 * 牆線離散成網格
 * @type {(path: Path, line: WallLine, dims: ReturnType<typeof trackDims>, step: number, breaks?: number[]) => TrackMesh}
 */
function lineToMesh(path, line, dims, step, breaks = []) {
  const closed = line.closed === true;
  const thick = line.kind === 'outer' ? 0.02 : dims.wallT;
  const half = dims.wallT / 2;
  const bottom = line.bottom ?? (() => 0);
  const top = line.top ?? (() => dims.wallH);
  // 斜向牆的厚度沿法向（d）放大 1/cosα，使垂直牆面的厚度不變（只有換道橋用）
  const widen = line.widen ?? (() => 1);
  const sList = sampleRange(line.sStart, line.sEnd, step, closed, breaks);
  // A 面：朝車道那一側；B 面：外側（外牆往外加厚）
  const section = (sv) => {
    const off = line.offset(sv);
    const w = widen(sv);
    return { dA: off - line.outward * half * w, dB: off + line.outward * (thick - half) * w, y0: bottom(sv), y1: top(sv) };
  };
  return sweepMesh(path, sList, closed, section, line.kind);
}

/** 平滑換道曲線 0→1 */
function smoothShift(u) {
  const t = Math.min(1, Math.max(0, u));
  return (1 - Math.cos(Math.PI * t)) / 2;
}

/**
 * 換道器（lane changer）立體橋的尺寸。橋面高、坡度依 SPEC 1.10（推估）；其餘為本檔推估：
 * - 橋板厚 4 mm（推估：ABS 射出件板厚 3–5 mm）→ 橋下淨高 80 − 4 = 76 mm ≥ 規則車高上限 70 mm
 * - 坡道上下端用半徑 0.5 m 的豎曲線接平面（推估：直接折 8° 時，車殼底面（離地約 2 mm）在 80 mm 軸距中點會刮到坡頂；
 *   半徑 R 時軸距中點的拱高 = 0.04² / (2R) = 1.6 mm）
 * - 橫樑（下層橋 D 的支架）在平台兩端，樑底 72 mm
 */
export const BRIDGE = {
  slope_deg: 8,
  deckThickness_mm: 4,
  verticalCurveRadius_m: 0.5,
  beamDepth_mm: 4,
  beamWidth_mm: 10,
  postWidth_mm: 10,
};

/**
 * 坡道縱斷面：0 → h（直線坡 θ，兩端接半徑 Rv 的豎曲線），x 為水平距離（m）
 * @type {(h: number, theta: number, Rv: number) => { len: number, a: number, at: (x: number) => number, slopeAt: (x: number) => number }}
 */
function rampProfile(h, theta, Rv) {
  const a = Rv * Math.sin(theta);
  const y1 = Rv * (1 - Math.cos(theta));
  const lin = (h - 2 * y1) / Math.tan(theta);
  const len = 2 * a + lin;
  const at = (xIn) => {
    const x = Math.min(len, Math.max(0, xIn));
    if (x < a) {
      return Rv - Math.sqrt(Rv * Rv - x * x);
    }
    if (x < a + lin) {
      return y1 + (x - a) * Math.tan(theta);
    }
    const r = len - x;
    return h - (Rv - Math.sqrt(Rv * Rv - r * r));
  };
  const slopeAt = (xIn) => {
    const x = Math.min(len, Math.max(0, xIn));
    if (x < a) {
      return x / Math.sqrt(Rv * Rv - x * x);
    }
    if (x < a + lin) {
      return Math.tan(theta);
    }
    const r = len - x;
    return r / Math.sqrt(Rv * Rv - r * r);
  };
  return { len, a, at, slopeAt };
}

/**
 * 換道器立體橋：外側車道（d = −P）爬上橋 → 橋面上斜向越過另外兩條車道 → 下到內側車道（d = +P）。
 * 下層兩條車道在橋的斜向段正下方往外移一個車道（內 → 中、中 → 外），橋下淨高 76 mm。
 * 順序（沿 s）：上坡引道（橋仍在外側車道正上方，下層車道不動）→ 斜向段（橋面 ≥ 75 mm，橋與下層車道交叉）→ 下坡引道（橋已在內側車道正上方）
 * @type {(path: Path, dims: ReturnType<typeof trackDims>, sStart: number, sEnd: number) => any}
 */
function buildBridge(path, dims, sStart, sEnd) {
  const P = dims.pitch;
  const half = dims.wallT / 2;
  const hB = spec.track.bridgeHeight_mm * MM;
  const theta = (BRIDGE.slope_deg * Math.PI) / 180;
  const deckT = BRIDGE.deckThickness_mm * MM;
  const ramp = rampProfile(hB, theta, BRIDGE.verticalCurveRadius_m);
  const total = sEnd - sStart;
  // 斜向段：從上坡頂端的豎曲線開始（橋面 ≥ hB − Rv(1 − cosθ) ≈ 75 mm）到下坡頂端的豎曲線結束
  const latStart = sStart + ramp.len - ramp.a;
  const latEnd = sEnd - ramp.len + ramp.a;
  const flatStart = sStart + ramp.len;
  const flatEnd = sEnd - ramp.len;

  /** @type {(s: number) => number} 橋面高度（m）；範圍外為 0 */
  const height = (s) => {
    const x = s - sStart;
    if (x <= 0 || x >= total) {
      return 0;
    }
    if (x < ramp.len) {
      return ramp.at(x);
    }
    if (x > total - ramp.len) {
      return ramp.at(total - x);
    }
    return hB;
  };
  /** @type {(s: number) => number} 橋面縱向坡度 dy/ds */
  const grade = (s) => {
    const x = s - sStart;
    if (x <= 0 || x >= total) {
      return 0;
    }
    if (x < ramp.len) {
      return ramp.slopeAt(x);
    }
    if (x > total - ramp.len) {
      return -ramp.slopeAt(total - x);
    }
    return 0;
  };
  /** @type {(s: number) => number} 橋上車道中心的偏移 */
  const offset = (s) => -P + 2 * P * smoothShift((s - latStart) / (latEnd - latStart));
  /**
   * 斜向段的橫向放大係數 1/cosα = √(1 + (dd/ds)²)：牆沿賽道法向（d）的間距放大，使垂直於橋走向的車道淨寬維持 115 mm
   * （否則 36° 斜向時淨寬只剩 115·cos36° ≈ 93 mm，比車寬 105 mm 窄，車會卡住）
   * @type {(s: number) => number}
   */
  const widen = (s) => {
    const k = (offset(s + 0.0005) - offset(s - 0.0005)) / 0.001;
    return Math.sqrt(1 + k * k);
  };

  // 橋牆底面：引道段從下層牆頂（牆高）起算（下層牆在同一位置，兩者疊成一道連續的牆）；
  // 斜向段懸空，從橋板底面起算（下層車道的車從下面通過）；兩者之間 3 cm 平滑過渡
  const blend = 0.03;
  const wallBottom = (s) => {
    if (s >= latStart && s <= latEnd) {
      return height(s) - deckT;
    }
    let u = 0;
    if (s < latStart) {
      u = 1 - (latStart - s) / blend;
    } else {
      u = 1 - (s - latEnd) / blend;
    }
    const k = smoothShift(u);
    const target = height(Math.min(Math.max(s, latStart), latEnd)) - deckT;
    return dims.wallH + (target - dims.wallH) * k;
  };
  const wallTop = (s) => height(s) + dims.wallH;
  // 橋牆從橋面高 2 mm 處開始（更低處的引道由下層牆圍住，避免零高度的退化網格）
  const yMin = 0.002;
  const xMin = Math.sqrt(Math.max(0, 2 * BRIDGE.verticalCurveRadius_m * yMin - yMin * yMin));
  const wallS0 = sStart + xMin;
  const wallS1 = sEnd - xMin;
  const breaks = [latStart, latEnd, latStart - blend, latEnd + blend, flatStart, flatEnd, sStart + ramp.a, sEnd - ramp.a];
  /** @type {WallLine[]} */
  const walls = [
    { sStart: wallS0, sEnd: wallS1, offset: (s) => offset(s) + 0.5 * P * widen(s), kind: 'bridge', outward: 1, bottom: wallBottom, top: wallTop, widen },
    { sStart: wallS0, sEnd: wallS1, offset: (s) => offset(s) - 0.5 * P * widen(s), kind: 'bridge', outward: -1, bottom: wallBottom, top: wallTop, widen },
  ];
  const wallMeshes = walls.map((ln) => lineToMesh(path, ln, dims, 0.01, breaks));

  // 橋板（路面）：橫向到兩側牆的中線（板邊埋在牆裡；若與牆面齊平，相鄰下層車道貼牆的導輪會勾到引道板邊而被抬起）；
  // 兩端埋入地面 1 mm，與地板無縫銜接
  const deckSection = (s) => ({
    dA: offset(s) - 0.5 * P * widen(s),
    dB: offset(s) + 0.5 * P * widen(s),
    y0: Math.max(-0.001, height(s) - deckT),
    y1: height(s),
  });
  const deckMesh = sweepMesh(path, sampleRange(sStart, sEnd, 0.01, false, breaks), false, deckSection, 'bridgeDeck');

  // 支架（下層橋 D）：平台兩端各一支橫樑橫跨三條車道，兩端立柱在外牆 / 內牆外側
  const beamW = BRIDGE.beamWidth_mm * MM;
  const postW = BRIDGE.postWidth_mm * MM;
  const beamTop = hB - deckT;
  const beamBottom = beamTop - BRIDGE.beamDepth_mm * MM;
  const dOuter = -1.5 * P - 0.015 - 0.001 - postW;
  const dInner = 1.5 * P + half + 0.001 + postW;
  const supportMeshes = [];
  for (const sc of [flatStart, flatEnd]) {
    const sl = [sc - beamW / 2, sc + beamW / 2];
    supportMeshes.push(sweepMesh(path, sl, false, () => ({ dA: dOuter, dB: dInner, y0: beamBottom, y1: beamTop }), 'bridgeSupport'));
    supportMeshes.push(sweepMesh(path, sl, false, () => ({ dA: dOuter, dB: dOuter + postW, y0: 0, y1: beamBottom }), 'bridgeSupport'));
    supportMeshes.push(sweepMesh(path, sl, false, () => ({ dA: dInner - postW, dB: dInner, y0: 0, y1: beamBottom }), 'bridgeSupport'));
  }

  /**
   * 是否在橋上（橋的車道範圍內，且高度不低於橋板底面下 5 mm；從橋下通過的車不算）
   * @type {(s: number, d: number, y: number) => boolean}
   */
  const isOn = (s, d, y) => {
    if (s <= sStart || s >= sEnd) {
      return false;
    }
    if (Math.abs(d - offset(s)) > 0.5 * P * widen(s)) {
      return false;
    }
    return y >= height(s) - deckT - 0.005;
  };

  return {
    sStart,
    sEnd,
    latStart,
    latEnd,
    flatStart,
    flatEnd,
    rampLength: ramp.len,
    deckHeight: hB,
    deckThickness: deckT,
    clearance: hB - deckT,
    supportClearance: beamBottom,
    slope_deg: BRIDGE.slope_deg,
    height,
    grade,
    offset,
    widen,
    isOn,
    wallLines: walls,
    wallMeshes,
    deckMesh,
    supportMeshes,
  };
}

/**
 * 把封閉路徑上的查詢 s 展開到牆線的參數範圍（螺旋牆線跨 3 圈）
 * @type {(path: Path, ln: WallLine, sq: number) => number[]}
 */
function lineParamsAt(path, ln, sq) {
  const L = path.length;
  const out = [];
  let s = path.wrap(sq);
  while (s < ln.sStart) {
    s += L;
  }
  for (; s <= ln.sEnd; s += L) {
    out.push(s);
    if (ln.closed) {
      break;
    }
  }
  return out;
}

/**
 * 主賽道：橢圓（兩直線＋兩個 180° 彎道），3 線道、側牆，第二條直線是換道器（立體橋，見 buildBridge）
 */
export function buildCircuit() {
  const dims = trackDims();
  const t = spec.track;
  const ls = t.straightLength_mm * MM;
  const r = t.curveRadiusMidLane_mm * MM;
  const path = new Path(
    [
      { type: 'straight', length: ls },
      { type: 'arc', radius: r, angle: Math.PI },
      { type: 'straight', length: ls },
      { type: 'arc', radius: r, angle: Math.PI },
    ],
    true,
  );
  const P = dims.pitch;
  const L = path.length;
  // 換道器佔滿第二條直線（SPEC 1.10：上下引道 F 各約一片直線長、橋 E 在中間；兩端各留 1 cm 不壓到彎道）
  const seg2 = path.segments[2];
  const lcStart = seg2.s0 + 0.01;
  const lcEnd = seg2.s0 + seg2.len - 0.01;
  const bridge = buildBridge(path, dims, lcStart, lcEnd);
  // 下層車道往外移一個車道的區間 = 橋的斜向段
  const g0 = bridge.latStart;
  const g1 = bridge.latEnd;
  const gLen = g1 - g0;

  /** @type {WallLine[]} */
  const lines = [];
  // 外側牆：整圈固定在 -1.5P（封閉環）
  lines.push({ sStart: 0, sEnd: L, offset: () => -1.5 * P, kind: 'outer', outward: -1, closed: true });
  // 內側牆＋兩條分隔牆在換道段首尾相接，合成一條「螺旋」牆線：
  // 從換道段結束處 +1.5P 出發，每經過一次換道段往外移一個車道，三圈後併入外牆
  const zoneShift = (s) => {
    let shift = 0;
    for (let j = 1; j <= 3; j++) {
      shift += smoothShift((s - (g0 + j * L)) / gLen);
    }
    return shift;
  };
  lines.push({
    sStart: g1,
    sEnd: g1 + 3 * L,
    offset: (s) => 1.5 * P - P * zoneShift(s),
    kind: 'divider',
    outward: 1,
  });

  // 牆（地面層＋橋牆＋支架）全部列入 wallMeshes（物理上都是牆）；橋板是路面，另列 roadMeshes
  const wallMeshes = [...lines.map((ln) => lineToMesh(path, ln, dims, 0.02)), ...bridge.wallMeshes, ...bridge.supportMeshes];
  const roadMeshes = [bridge.deckMesh];

  const half = dims.wallT / 2;
  /** @type {(fn: (s: number) => number, s: number) => number} 牆線橫向斜率 dd/ds */
  const slopeOf = (fn, s) => (fn(s + 0.0005) - fn(s - 0.0005)) / 0.001;

  /**
   * 某 s 處、某一層（地面 / 橋上）的牆線：偏移 d、橫向斜率 slope（dd/ds）、牆面到牆線沿 d 的距離 half、是否為橋牆（由 d 大到小排序）
   * @type {(sq: number, level?: 'ground' | 'bridge') => { d: number, slope: number, half: number, bridge?: boolean }[]}
   */
  const wallsAt = (sq, level = 'ground') => {
    const ss = path.wrap(sq);
    const out = [];
    if (level === 'bridge' && ss > bridge.sStart && ss < bridge.sEnd) {
      for (const ln of bridge.wallLines) {
        out.push({ d: ln.offset(ss), slope: slopeOf(ln.offset, ss), half: half * bridge.widen(ss), bridge: true });
      }
    } else {
      for (const ln of lines) {
        for (const s of lineParamsAt(path, ln, ss)) {
          out.push({ d: ln.offset(s), slope: slopeOf(ln.offset, s), half });
        }
      }
    }
    return out.sort((a, b) => b.d - a.d);
  };

  /** @type {(sq: number, level?: 'ground' | 'bridge') => number[]} 某 s 處某一層所有牆線的偏移（由大到小排序） */
  const lineOffsetsAt = (sq, level = 'ground') => wallsAt(sq, level).map((w) => w.d);

  /**
   * 世界座標點（車體參考點）所在的層：在橋的車道範圍內、且不低於橋板底面 → 'bridge'；其餘 → 'ground'
   * @type {(x: number, y: number, z: number) => 'ground' | 'bridge'}
   */
  const levelAt = (x, y, z) => {
    const pr = path.project(x, z);
    if (bridge.isOn(pr.s, pr.d, y)) {
      return 'bridge';
    }
    return 'ground';
  };

  /**
   * 某層在 s 處的路面高度（m）：橋上 = 橋面高，地面 = 0
   * @type {(s: number, level?: 'ground' | 'bridge') => number}
   */
  const roadHeight = (s, level = 'ground') => {
    if (level === 'bridge') {
      return bridge.height(path.wrap(s));
    }
    return 0;
  };

  return {
    name: 'circuit',
    path,
    dims,
    wallMeshes,
    roadMeshes,
    lineOffsetsAt,
    wallsAt,
    levelAt,
    roadHeight,
    laneOffset: (lane) => (1 - lane) * P,
    laneOf: (d) => Math.round(1 - d / P),
    // 依佈局：經過換道器一次，內 → 中、中 → 外（下層斜移）、外 → 內（走立體橋）
    nextLane: (lane) => (lane + 1) % 3,
    laneChanger: { start: lcStart, end: lcEnd, shiftStart: g0, shiftEnd: g1 },
    bridge,
    bounds: computeBounds([...wallMeshes, ...roadMeshes]),
  };
}

/** 單一車道的長直線測試賽道（P01、P03、P04 用） */
export function buildStraight(length = 40) {
  const dims = trackDims();
  const path = new Path([{ type: 'straight', length }], false);
  const P = dims.pitch;
  /** @type {WallLine[]} */
  const lines = [
    { sStart: -0.5, sEnd: length, offset: () => 0.5 * P, kind: 'outer', outward: 1 },
    { sStart: -0.5, sEnd: length, offset: () => -0.5 * P, kind: 'outer', outward: -1 },
  ];
  const wallMeshes = lines.map((ln) => lineToMesh(path, ln, dims, 1000));
  return {
    name: 'straight',
    path,
    dims,
    wallMeshes,
    roadMeshes: [],
    lineOffsetsAt: () => [0.5 * P, -0.5 * P],
    wallsAt: () => [
      { d: 0.5 * P, slope: 0, half: dims.wallT / 2 },
      { d: -0.5 * P, slope: 0, half: dims.wallT / 2 },
    ],
    levelAt: () => 'ground',
    roadHeight: () => 0,
    laneOffset: () => 0,
    laneOf: () => 0,
    nextLane: () => 0,
    laneChanger: null,
    bridge: null,
    bounds: computeBounds(wallMeshes),
  };
}

function computeBounds(meshes) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const m of meshes) {
    for (let i = 0; i < m.vertices.length; i += 3) {
      minX = Math.min(minX, m.vertices[i]);
      maxX = Math.max(maxX, m.vertices[i]);
      minZ = Math.min(minZ, m.vertices[i + 2]);
      maxZ = Math.max(maxZ, m.vertices[i + 2]);
    }
  }
  return { minX, maxX, minZ, maxZ };
}
