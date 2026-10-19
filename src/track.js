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
 * 側牆線：每條線是 s 的函式 offset(s)，範圍 [sStart, sEnd]
 * @typedef {{ sStart: number, sEnd: number, offset: (s: number) => number, kind: string, outward: number }} WallLine
 */

/**
 * 把牆線離散成封閉的三角網格（Rapier trimesh 與 Three.js 共用同一份頂點）
 * 一條牆線只產生一個網格，避免多個方塊接縫造成導輪「內部邊緣」碰撞（ghost collision）
 * @param {Path} path
 * @param {WallLine} line
 * @returns {{ vertices: Float32Array, indices: Uint32Array, kind: string }}
 */
function lineToMesh(path, line, dims, step) {
  const span = line.sEnd - line.sStart;
  const closed = line.closed === true;
  const n = Math.max(1, Math.ceil(span / step));
  const count = closed ? n : n + 1;
  const thick = line.kind === 'outer' ? 0.02 : dims.wallT;
  const half = dims.wallT / 2;
  const verts = [];
  for (let i = 0; i < count; i++) {
    const sv = line.sStart + (span * i) / n;
    const off = line.offset(sv);
    // A 面：朝車道那一側；B 面：外側（外牆往外加厚）
    const a = path.point(sv, off - line.outward * half);
    const bpt = path.point(sv, off + line.outward * (thick - half));
    verts.push(a.x, 0, a.z, a.x, dims.wallH, a.z, bpt.x, 0, bpt.z, bpt.x, dims.wallH, bpt.z);
  }
  const idx = [];
  const v = (i, k) => (i % count) * 4 + k;
  const pt = (i) => [verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2]];
  // 加入一個四邊形，並依 outward 參考點翻轉成外法向
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
    quad(v(0, 0), v(0, 1), v(0, 3), v(0, 2), [2 * c0[0] - (2 * c0[0] - c1[0]), c0[1], 2 * c0[2] - (2 * c0[2] - c1[2])]);
    const last = count - 1;
    const d0 = centerOf(last);
    const d1 = centerOf(last - 1);
    quad(v(last, 0), v(last, 1), v(last, 3), v(last, 2), [d1[0], d1[1], d1[2]]);
  }
  return { vertices: new Float32Array(verts), indices: new Uint32Array(idx), kind: line.kind };
}

/** 平滑換道曲線 0→1 */
function smoothShift(u) {
  const t = Math.min(1, Math.max(0, u));
  return (1 - Math.cos(Math.PI * t)) / 2;
}

/**
 * 主賽道：橢圓（兩直線＋兩個 180° 彎道），3 線道、側牆、地面換道段（外側車道走立體橋，iter-00 只做外觀）
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
  const lcStart = t.laneChangerStart_mm * MM;
  const lcLen = t.laneChangerLength_mm * MM;
  const lcEnd = lcStart + lcLen;
  const L = path.length;

  /** @type {WallLine[]} */
  const lines = [];
  // 外側牆：整圈固定在 -1.5P（封閉環）
  lines.push({ sStart: 0, sEnd: L, offset: () => -1.5 * P, kind: 'outer', outward: -1, closed: true });
  // 內側牆＋兩條分隔牆在換道段首尾相接，合成一條「螺旋」牆線：
  // 從換道段結束處 +1.5P 出發，每經過一次換道段往外移一個車道，三圈後併入外牆
  const zoneShift = (s) => {
    let shift = 0;
    for (let j = 1; j <= 3; j++) {
      shift += smoothShift((s - (lcStart + j * L)) / lcLen);
    }
    return shift;
  };
  lines.push({
    sStart: lcEnd,
    sEnd: lcEnd + 3 * L,
    offset: (s) => 1.5 * P - P * zoneShift(s),
    kind: 'divider',
    outward: 1,
  });

  const wallMeshes = lines.map((ln) => lineToMesh(path, ln, dims, 0.02));

  /** 某 s 處所有牆線的偏移（由大到小排序） */
  const lineOffsetsAt = (sq) => {
    const out = [];
    for (const ln of lines) {
      let s = path.wrap(sq);
      while (s < ln.sStart) {
        s += L;
      }
      for (; s <= ln.sEnd; s += L) {
        out.push(ln.offset(s));
        if (ln.closed) {
          break;
        }
      }
    }
    return out.sort((a, b) => b - a);
  };

  return {
    name: 'circuit',
    path,
    dims,
    wallMeshes,
    lineOffsetsAt,
    laneOffset: (lane) => (1 - lane) * P,
    laneOf: (d) => Math.round(1 - d / P),
    laneChanger: { start: lcStart, end: lcEnd },
    bounds: computeBounds(wallMeshes),
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
    lineOffsetsAt: () => [0.5 * P, -0.5 * P],
    laneOffset: () => 0,
    laneOf: () => 0,
    laneChanger: null,
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
