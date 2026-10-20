// 通用車殼放樣器：讀車殼設計資料（data/<id>.json）→ 外殼、內面、翻邊、封口、輪拱 / 開口 / 凹陷、座艙、尾翼、splitter、卡座
// 資料來源：data/*.json 由 shared/design/<id>/sections.json 複製而來（車殼設計 subagent 以 shared/design/tools/body_sheets.py 產生），
//           app 是獨立 repo，所以複製一份自給自足；要改尺寸請改 shared/design 的尺寸表後重新產生、再複製過來。
// 座標：x 向前、y 向上、z 向右，原點在前後軸中點的地面，單位 mm。
//
// 曲面參數化：S(x, s)，x 為縱向位置（也就是曲面點的 x 座標），s ∈ [−1, 1] 為「左側下緣（−1）→ 中線頂（0）→ 右側下緣（1）」。
// 折線剖面（wedge / skeleton）把 s 切成數個面板（panel），稜線剛好落在面板邊界 → 稜線銳利；平滑剖面（aero-wing）只有一個面板。
// 所有裁切（輪拱、開口、凹陷、塗裝分色、貼紙）都用「保留函式」f(x, y, z, s) ≥ 0 表示，在參數網格上逐三角形裁切，
// 邊界點用二分法求在 f = 0 上，所以開口與分色邊緣是乾淨的曲線，不會有網格鋸齒。
import * as THREE from 'three';

/** @typedef {(x: number, y: number, z: number, s: number) => number} KeepFn 保留函式：≥ 0 保留 */
/** @typedef {{ s0: number, s1: number, n: number }} Panel s 方向的面板與分段數 */
/**
 * @typedef {object} LoftSurface
 * @property {number} xMin
 * @property {number} xMax
 * @property {number[]} xs 網格的 x 座標（含所有站位）
 * @property {Panel[]} panels
 * @property {(x: number, s: number, out: number[]) => void} eval 寫入 out[0] = y、out[1] = z
 */
/** @typedef {{ geometry: THREE.BufferGeometry, mat: string, shell?: boolean, renderOrder?: number, name?: string }} BodyPart */

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** @type {(a: number, b: number, t: number) => number} */
export const lerp = (a, b, t) => a + (b - a) * t;

/** @type {(e0: number, e1: number, x: number) => number} */
export const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * 以遞增節點 xs 找區間與局部參數
 * @type {(xs: number[], x: number) => { k: number, t: number, h: number }}
 */
function bracket(xs, x) {
  const n = xs.length;
  if (x <= xs[0]) {
    return { k: 0, t: 0, h: xs[1] - xs[0] };
  }
  if (x >= xs[n - 1]) {
    return { k: n - 2, t: 1, h: xs[n - 1] - xs[n - 2] };
  }
  let k = 0;
  while (x > xs[k + 1]) {
    k++;
  }
  const h = xs[k + 1] - xs[k];
  return { k, t: (x - xs[k]) / h, h };
}

/**
 * 不等距節點的單調限制斜率（避免 Hermite 內插過衝）
 * @type {(xs: number[], v: number[]) => number[]}
 */
function limitedSlopes(xs, v) {
  const n = xs.length;
  const d = [];
  for (let k = 0; k < n - 1; k++) {
    d.push((v[k + 1] - v[k]) / (xs[k + 1] - xs[k]));
  }
  const m = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) {
      m[k] = 0;
      continue;
    }
    const h0 = xs[k] - xs[k - 1];
    const h1 = xs[k + 1] - xs[k];
    let mk = (d[k - 1] * h1 + d[k] * h0) / (h0 + h1);
    const lim = 3 * Math.min(Math.abs(d[k - 1]), Math.abs(d[k]));
    if (Math.abs(mk) > lim) {
      mk = Math.sign(mk) * lim;
    }
    m[k] = mk;
  }
  return m;
}

/** @type {(t: number) => number[]} Hermite 基底 [h00, h10, h01, h11] */
const hermiteBasis = (t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return [2 * t3 - 3 * t2 + 1, t3 - 2 * t2 + t, -2 * t3 + 3 * t2, t3 - t2];
};

/**
 * 把區間 [a, b] 細分，節點間距不超過 step，並保留所有指定節點
 * @type {(knots: number[], step: number) => number[]}
 */
function subdivide(knots, step) {
  const out = [knots[0]];
  for (let k = 0; k < knots.length - 1; k++) {
    const a = knots[k];
    const b = knots[k + 1];
    const n = Math.max(1, Math.ceil((b - a) / step));
    for (let i = 1; i <= n; i++) {
      out.push(i === n ? b : a + ((b - a) * i) / n);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2D 距離函式（負值 = 在形狀內）
// ---------------------------------------------------------------------------

/**
 * 圓角矩形
 * @type {(px: number, py: number, x0: number, x1: number, y0: number, y1: number, r?: number) => number}
 */
export function sdRoundRect(px, py, x0, x1, y0, y1, r = 0) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = Math.abs(x1 - x0) / 2;
  const hy = Math.abs(y1 - y0) / 2;
  const rr = Math.min(r, hx, hy);
  const qx = Math.abs(px - cx) - (hx - rr);
  const qy = Math.abs(py - cy) - (hy - rr);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - rr;
}

/**
 * 凸多邊形（頂點逆時針或順時針皆可）：各邊半平面距離取最大值，零等值線精確
 * @type {(pts: number[][]) => (px: number, py: number) => number}
 */
export function sdConvexPolygon(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    area += ax * by - bx * ay;
  }
  const sign = area > 0 ? 1 : -1;
  const edges = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    // 外法線
    return { ax: a[0], ay: a[1], nx: (sign * ey) / len, ny: (-sign * ex) / len };
  });
  return (px, py) => {
    let d = -Infinity;
    for (const e of edges) {
      d = Math.max(d, (px - e.ax) * e.nx + (py - e.ay) * e.ny);
    }
    return d;
  };
}

/**
 * 細長條（線段加寬，端點平切）
 * @type {(ax: number, ay: number, bx: number, by: number, w: number) => (px: number, py: number) => number}
 */
export function sdBar(ax, ay, bx, by, w) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  return sdConvexPolygon([
    [ax + (nx * w) / 2, ay + (ny * w) / 2],
    [bx + (nx * w) / 2, by + (ny * w) / 2],
    [bx - (nx * w) / 2, by - (ny * w) / 2],
    [ax - (nx * w) / 2, ay - (ny * w) / 2],
  ]);
}

/** 七段式競賽數字的筆畫（單位方格：寬 1、高 1，原點左下） */
const DIGIT_SEGMENTS = {
  a: [0, 0.83, 1, 1],
  b: [0.7, 0.5, 1, 1],
  c: [0.7, 0, 1, 0.5],
  d: [0, 0, 1, 0.17],
  e: [0, 0, 0.3, 0.5],
  f: [0, 0.5, 0.3, 1],
  g: [0, 0.415, 1, 0.585],
};
/** @type {Record<string, string>} 每個數字用到的筆畫 */
const DIGIT_MAP = {
  0: 'abcdef',
  1: 'bc',
  2: 'abged',
  3: 'abgcd',
  4: 'fgbc',
  5: 'afgcd',
  6: 'afgedc',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcdfg',
};

/**
 * 自創的斜體七段式號碼（只有數字，不含任何文字或商標）；回傳 2D 距離函式，文字中心在 (0, 0)
 * @type {(text: string, opt: { h: number, w: number, gap: number, slant?: number }) => (u: number, v: number) => number}
 */
export function sdNumber(text, { h, w, gap, slant = 0.18 }) {
  const total = text.length * w + (text.length - 1) * gap;
  /** @type {{ x0: number, boxes: number[][] }[]} 每個字的位置與筆畫 */
  const glyphs = [...text].map((ch, i) => {
    const x0 = -total / 2 + i * (w + gap);
    const boxes = [];
    /** @type {((u: number, v: number) => number)[]} 斜筆等非方塊筆畫 */
    const extra = [];
    if (ch === '7') {
      // 7：加長的頂橫 + 從右上斜到左下的斜筆，避免被看成 1
      boxes.push([x0, x0 + w, h / 2 - 0.19 * h, h / 2]);
      extra.push(sdBar(x0 + w - 0.2 * w, h / 2 - 0.1 * h, x0 + 0.3 * w, -h / 2 - 0.05 * h, 0.34 * w));
    } else {
      for (const seg of DIGIT_MAP[ch] ?? '') {
        const [a, b, c, d] = DIGIT_SEGMENTS[seg];
        boxes.push([x0 + a * w, x0 + c * w, -h / 2 + b * h, -h / 2 + d * h]);
      }
    }
    return { x0, boxes, extra, round: ch !== '7' };
  });
  // 外框圓角（約 0.38 字寬）：讓 0 / 8 圓潤、和字母區隔
  const rOuter = 0.38 * w;
  return (u, v) => {
    const uu = u - slant * v;
    let d = Infinity;
    for (const g of glyphs) {
      let dg = Infinity;
      for (const [x0, x1, y0, y1] of g.boxes) {
        dg = Math.min(dg, sdRoundRect(uu, v, x0, x1, y0, y1, 0.12));
      }
      for (const f of g.extra) {
        dg = Math.min(dg, f(uu, v));
      }
      dg = Math.max(dg, sdRoundRect(uu, v, g.x0, g.x0 + w, -h / 2, h / 2, g.round ? rOuter : 0.12));
      d = Math.min(d, dg);
    }
    return d;
  };
}

/**
 * 側面貼紙：2D 圖形畫在側視 (x, y) 平面，投影到車身側面；u 為從該側看過去的水平座標（左側 u = −(x − x0)）
 * @type {(sd: (u: number, v: number) => number, opt: { x0: number, y0: number, zMin: number, side?: number }) => KeepFn}
 */
export function sideDecal(sd, { x0, y0, zMin, side = 0 }) {
  return (x, y, z) => {
    if (Math.abs(z) < zMin || (side !== 0 && Math.sign(z) !== side)) {
      return -1;
    }
    const u = z < 0 ? -(x - x0) : x - x0;
    return -sd(u, y - y0);
  };
}

/**
 * 上面貼紙：2D 圖形畫在俯視 (x, z) 平面，從車頭方向看是正的（u = −z、v = −(x − x0)）
 * @type {(sd: (u: number, v: number) => number, opt: { x0: number, z0?: number, yMin: number }) => KeepFn}
 */
export function topDecal(sd, { x0, z0 = 0, yMin }) {
  return (x, y, z) => {
    if (y < yMin) {
      return -1;
    }
    return -sd(-(z - z0), -(x - x0));
  };
}

// ---------------------------------------------------------------------------
// 車身曲面
// ---------------------------------------------------------------------------

/**
 * 由設計資料建立車身外表面
 * - mode 'linear'：用 stationParams 的 4 點折線（中線頂 → 肩稜 → 最寬處 → 下緣），站間線性內插，稜線為面板邊界
 * - mode 'smooth'：用 stations[].halfProfile（已 Chaikin 平滑的 32 點），站間單調 Hermite（Catmull-Rom 類），剖面內 Catmull-Rom
 * - bump(x, |z|)：額外的高度修飾（葉子板隆起等），兩種模式都會加在 y 上
 * @type {(data: any, mode: 'linear' | 'smooth', step?: number, bump?: ((x: number, az: number) => number) | null) => LoftSurface & { ctrl: (x: number) => any }}
 */
export function createBodySurface(data, mode, step = 0.5, bump = null, extra = {}) {
  const params = data.stationParams.slice().sort((a, b) => a.x - b.x);
  const sx = params.map((p) => p.x);
  const xMin = sx[0];
  const xMax = sx[sx.length - 1];
  const xs = subdivide(sx, step);
  /** @type {number} 側裙下緣往內收的量（mm，iter-35） */
  const tuck = extra.tuck ?? 0;
  /** @type {(t: number) => number} 側壁參數 t（0 = 肩部、1 = 下緣）對應的內收量：下 65% 以二次曲線往內收 */
  const tuckAt = (t) => {
    const k = Math.max(0, (t - 0.35) / 0.65);
    return tuck * k * k;
  };
  /** @type {((x: number, y: number) => number) | null} 側壁的內縮修飾（iter-37：側面斜向折線 / 導流雕塑），只作用在側壁面板 */
  const sideIn = extra.sideIn ?? null;
  /** @type {string[]} */
  const ctrlKeys = ['yTop', 'zF', 'yF', 'halfW', 'yShoulder', 'yLow'];
  /** @type {Record<string, number[]>} xSmooth 用的單調 Hermite 斜率 */
  const ctrlSlopes = {};
  if (extra.xSmooth) {
    for (const key of ctrlKeys) {
      ctrlSlopes[key] = limitedSlopes(
        sx,
        params.map((p) => p[key]),
      );
    }
  }

  /** @type {(x: number) => any} 控制點內插（預設線性；xSmooth 時用單調 Hermite，站位處不再有折痕，稜線仍由面板邊界保留） */
  const ctrl = (x) => {
    const { k, t, h } = bracket(sx, x);
    const a = params[k];
    const b = params[k + 1];
    if (extra.xSmooth) {
      const hb = hermiteBasis(t);
      /** @type {Record<string, number>} */
      const o = {};
      for (const key of ctrlKeys) {
        o[key] = hb[0] * a[key] + hb[1] * h * ctrlSlopes[key][k] + hb[2] * b[key] + hb[3] * h * ctrlSlopes[key][k + 1];
      }
      return o;
    }
    return {
      yTop: lerp(a.yTop, b.yTop, t),
      zF: lerp(a.zF, b.zF, t),
      yF: lerp(a.yF, b.yF, t),
      halfW: lerp(a.halfW, b.halfW, t),
      yShoulder: lerp(a.yShoulder, b.yShoulder, t),
      yLow: lerp(a.yLow, b.yLow, t),
    };
  };

  if (mode === 'linear') {
    // 三段長度的平均值決定面板在 s 上的比例
    let l1 = 0;
    let l2 = 0;
    let l3 = 0;
    for (const p of params) {
      l1 += Math.hypot(p.zF, p.yF - p.yTop);
      l2 += Math.hypot(p.halfW - p.zF, p.yShoulder - p.yF);
      l3 += Math.abs(p.yShoulder - p.yLow);
    }
    const L = l1 + l2 + l3;
    const b1 = l1 / L;
    const b2 = (l1 + l2) / L;
    const nSeg = (len) => Math.max(4, Math.ceil(len / params.length / step));
    const n1 = nSeg(l1);
    const n2 = nSeg(l2);
    const n3 = nSeg(l3);
    return {
      xMin,
      xMax,
      xs,
      ctrl,
      breaks: [b1, b2],
      topY(x, z) {
        const c = ctrl(x);
        const az = Math.abs(z);
        const b = bump ? bump(x, Math.min(az, c.halfW)) : 0;
        if (az <= c.zF) {
          return lerp(c.yTop, c.yF, az / c.zF) + b;
        }
        if (az <= c.halfW) {
          return lerp(c.yF, c.yShoulder, (az - c.zF) / Math.max(1e-6, c.halfW - c.zF)) + b;
        }
        return c.yShoulder + b;
      },
      panels: [
        { s0: -1, s1: -b2, n: n3 },
        { s0: -b2, s1: -b1, n: n2 },
        { s0: -b1, s1: 0, n: n1 },
        { s0: 0, s1: b1, n: n1 },
        { s0: b1, s1: b2, n: n2 },
        { s0: b2, s1: 1, n: n3 },
      ],
      eval(x, s, out) {
        const c = ctrl(x);
        const u = Math.abs(s);
        let z;
        let y;
        if (u <= b1) {
          const t = u / b1;
          z = c.zF * t;
          y = lerp(c.yTop, c.yF, t);
        } else if (u <= b2) {
          const t = (u - b1) / (b2 - b1);
          z = lerp(c.zF, c.halfW, t);
          y = lerp(c.yF, c.yShoulder, t);
        } else {
          const t = (u - b2) / (1 - b2);
          y = lerp(c.yShoulder, c.yLow, t);
          z = c.halfW - tuckAt(t) - (sideIn ? sideIn(x, y) : 0);
        }
        out[0] = bump ? y + bump(x, z) : y;
        out[1] = s < 0 ? -z : z;
      },
    };
  }

  // smooth：halfProfile 32 點（z ≥ 0，由中線頂到下緣）
  /**
   * iter-37：可改用站位控制點直接做 Chaikin 3 次（不依弧長重取樣）。重取樣會讓第 i 點在各站對應到不同位置，
   * 沿 x 內插時取樣點滑動，殼面反光出現波紋；Chaikin 點數與拓樸固定，第 i 點在每站都對應同一個幾何位置。
   * @type {(p: any) => number[][]}
   */
  const chaikinProfile = (p) => {
    let pts = [
      [0, p.yTop],
      [p.zF, p.yF],
      [p.halfW, p.yShoulder],
      [p.halfW, p.yLow],
    ];
    for (let it = 0; it < 3; it++) {
      const next = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        next.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by], [0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
      }
      next.push(pts[pts.length - 1]);
      pts = next;
    }
    return pts;
  };
  const st = extra.chaikin ? params.map((p) => ({ x: p.x, halfProfile: chaikinProfile(p) })) : data.stations.slice().sort((a, b) => a.x - b.x);
  const nP = st[0].halfProfile.length;
  /** @type {number[][]} 每個取樣點沿 x 的 z、y 值 */
  const Z = [];
  const Y = [];
  const MZ = [];
  const MY = [];
  for (let i = 0; i < nP; i++) {
    const zv = st.map((s) => s.halfProfile[i][0]);
    const yv = st.map((s) => s.halfProfile[i][1]);
    Z.push(zv);
    Y.push(yv);
    MZ.push(limitedSlopes(sx, zv));
    MY.push(limitedSlopes(sx, yv));
  }
  const tmp = [0, 0];
  /** @type {(i: number, k: number, hb: number[], h: number) => void} 取樣點 i 在 x 的值（寫入 tmp） */
  const sampleAt = (i, k, hb, h) => {
    let idx = i;
    let mirror = 1;
    if (idx < 0) {
      idx = -idx;
      mirror = -1;
    }
    const ext = idx > nP - 1 ? idx - (nP - 1) : 0;
    if (ext > 0) {
      idx = nP - 1;
    }
    const zz = hb[0] * Z[idx][k] + hb[1] * h * MZ[idx][k] + hb[2] * Z[idx][k + 1] + hb[3] * h * MZ[idx][k + 1];
    const yy = hb[0] * Y[idx][k] + hb[1] * h * MY[idx][k] + hb[2] * Y[idx][k + 1] + hb[3] * h * MY[idx][k + 1];
    tmp[0] = zz * mirror;
    tmp[1] = yy;
    if (ext > 0) {
      // 下緣外插：沿最後一段方向延伸
      const k2 = nP - 2;
      const zp = hb[0] * Z[k2][k] + hb[1] * h * MZ[k2][k] + hb[2] * Z[k2][k + 1] + hb[3] * h * MZ[k2][k + 1];
      const yp = hb[0] * Y[k2][k] + hb[1] * h * MY[k2][k] + hb[2] * Y[k2][k + 1] + hb[3] * h * MY[k2][k + 1];
      tmp[0] = zz + (zz - zp) * ext;
      tmp[1] = yy + (yy - yp) * ext;
    }
  };
  const p0 = [0, 0];
  const p1 = [0, 0];
  const p2 = [0, 0];
  const p3 = [0, 0];
  const nS = Math.ceil(60 / step);
  return {
    xMin,
    xMax,
    xs,
    ctrl,
    breaks: [],
    panels: [{ s0: -1, s1: 1, n: 2 * nS }],
    eval(x, s, out) {
      const { k, t, h } = bracket(sx, x);
      const hb = hermiteBasis(t);
      const f = Math.min(nP - 1 - 1e-9, Math.abs(s) * (nP - 1));
      const i = Math.floor(f);
      const tt = f - i;
      sampleAt(i - 1, k, hb, h);
      p0[0] = tmp[0];
      p0[1] = tmp[1];
      sampleAt(i, k, hb, h);
      p1[0] = tmp[0];
      p1[1] = tmp[1];
      sampleAt(i + 1, k, hb, h);
      p2[0] = tmp[0];
      p2[1] = tmp[1];
      sampleAt(i + 2, k, hb, h);
      p3[0] = tmp[0];
      p3[1] = tmp[1];
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * tt + (2 * a - 5 * b + 4 * c - d) * tt * tt + (-a + 3 * b - 3 * c + d) * tt * tt * tt);
      const yRaw = cr(p0[1], p1[1], p2[1], p3[1]);
      const sideW = sideIn ? smoothstep(0.5, 0.62, Math.abs(s)) * sideIn(x, yRaw) : 0;
      const z = cr(p0[0], p1[0], p2[0], p3[0]) - tuckAt((Math.abs(s) - 0.62) / 0.38) - sideW;
      out[0] = yRaw + (bump ? bump(x, Math.abs(z)) : 0);
      out[1] = s < 0 ? -z : z;
    },
  };
}

/**
 * 找車身表面在 (x, |z|) 處的高度（頂面部分；z 超過最寬處時回傳最寬處高度）
 * @type {(surf: LoftSurface, x: number, z: number) => number}
 */
export function surfaceTopY(surf, x, z) {
  if (surf.topY) {
    return surf.topY(x, z);
  }
  const o = [0, 0];
  const az = Math.abs(z);
  let lo = 0;
  let hi = 1;
  surf.eval(x, 1, o);
  // 找 z(s) ≥ az 的最小 s
  for (let it = 0; it < 26; it++) {
    const m = (lo + hi) / 2;
    surf.eval(x, m, o);
    if (o[1] >= az) {
      hi = m;
    } else {
      lo = m;
    }
  }
  surf.eval(x, hi, o);
  return o[0];
}

/**
 * 座艙罩曲面：剖面 trapezoid（頂寬 = 0.55 × 底寬）或 ellipse；底緣貼在車身表面（略沉 0.1 mm）
 * @type {(canopy: any, body: LoftSurface, smooth: boolean, step?: number) => LoftSurface & { halfWAt: (x: number) => number }}
 */
export function createCanopySurface(canopy, body, smooth, step = 0.5) {
  const st = canopy.stations.slice().sort((a, b) => a.x - b.x);
  const sx = st.map((s) => s.x);
  const keys = ['yBase', 'yTop', 'halfW'];
  /** @type {Record<string, number[]>} */
  const slopes = {};
  for (const key of keys) {
    slopes[key] = limitedSlopes(
      sx,
      st.map((s) => s[key]),
    );
  }
  /** @type {(x: number) => Record<string, number>} */
  const at = (x) => {
    const { k, t, h } = bracket(sx, x);
    const o = {};
    // iter-36：梯形罩也用 Hermite 沿 x 平滑（只保留平頂與斜窗交界的稜線），消除站位處的 low-poly 折面
    if (smooth || canopy.section === 'trapezoid') {
      const hb = hermiteBasis(t);
      for (const key of keys) {
        o[key] = hb[0] * st[k][key] + hb[1] * h * slopes[key][k] + hb[2] * st[k + 1][key] + hb[3] * h * slopes[key][k + 1];
      }
    } else {
      for (const key of keys) {
        o[key] = lerp(st[k][key], st[k + 1][key], t);
      }
    }
    return o;
  };
  const trap = canopy.section === 'trapezoid';
  const nS = Math.ceil(20 / step);
  return {
    xMin: sx[0],
    xMax: sx[sx.length - 1],
    xs: subdivide(sx, step),
    breaks: trap ? [0.4] : [],
    halfWAt: (x) => (x < sx[0] || x > sx[sx.length - 1] ? 0 : at(x).halfW),
    panels: trap
      ? [
          { s0: -1, s1: -0.4, n: nS },
          { s0: -0.4, s1: 0.4, n: nS },
          { s0: 0.4, s1: 1, n: nS },
        ]
      : [{ s0: -1, s1: 1, n: 2 * nS }],
    eval(x, s, out) {
      const c = at(x);
      const u = Math.abs(s);
      const rise = Math.max(0, c.yTop - c.yBase);
      let z;
      let y;
      if (trap) {
        // 低平梯形罩（iter-35）：水平平頂（頂寬 0.55 × 底寬）＋兩側斜窗，平頂與斜窗交界是銳利稜線（面板邊界）
        const roofY = surfaceTopY(body, x, 0) - 0.1 + rise;
        if (u <= 0.4) {
          z = 0.55 * c.halfW * (u / 0.4);
          y = roofY;
        } else {
          const t = (u - 0.4) / 0.6;
          z = c.halfW * lerp(0.55, 1, t);
          y = lerp(roofY, surfaceTopY(body, x, z) - 0.1, t);
        }
      } else {
        const th = (1 - u) * (Math.PI / 2);
        z = c.halfW * Math.cos(th);
        y = surfaceTopY(body, x, z) - 0.1 + rise * Math.sin(th);
      }
      out[0] = y;
      out[1] = s < 0 ? -z : z;
    },
  };
}

// ---------------------------------------------------------------------------
// 參數網格與裁切
// ---------------------------------------------------------------------------

/** @type {WeakMap<object, any>} 每個曲面的網格快取 */
const gridCache = new WeakMap();

/**
 * 曲面法線（有限差分，限制在同一面板內 → 稜線兩側各自的法線）
 * @type {(surf: LoftSurface, panel: Panel, x: number, s: number, out: number[]) => void}
 */
function surfNormal(surf, panel, x, s, out) {
  const hx = 0.05;
  const hs = (panel.s1 - panel.s0) * 0.002;
  const xa = Math.max(surf.xMin, x - hx);
  const xb = Math.min(surf.xMax, x + hx);
  const sa = Math.max(panel.s0, s - hs);
  const sb = Math.min(panel.s1, s + hs);
  const a = [0, 0];
  const b = [0, 0];
  surf.eval(xa, s, a);
  surf.eval(xb, s, b);
  const dxx = xb - xa;
  const dxy = b[0] - a[0];
  const dxz = b[1] - a[1];
  surf.eval(x, sa, a);
  surf.eval(x, sb, b);
  const dsy = b[0] - a[0];
  const dsz = b[1] - a[1];
  // n = dS/ds × dS/dx（dS/ds 的 x 分量為 0）
  const nx = dsy * dxz - dsz * dxy;
  const ny = dsz * dxx;
  const nz = -dsy * dxx;
  const len = Math.hypot(nx, ny, nz) || 1;
  out[0] = nx / len;
  out[1] = ny / len;
  out[2] = nz / len;
}

/** @type {(surf: LoftSurface) => any} */
function getGrid(surf) {
  let g = gridCache.get(surf);
  if (g) {
    return g;
  }
  const o = [0, 0];
  const n = [0, 0, 0];
  g = surf.panels.map((panel) => {
    const ss = [];
    for (let j = 0; j <= panel.n; j++) {
      ss.push(j === panel.n ? panel.s1 : panel.s0 + ((panel.s1 - panel.s0) * j) / panel.n);
    }
    const nx = surf.xs.length;
    const ns = ss.length;
    const P = new Float64Array(nx * ns * 3);
    const N = new Float64Array(nx * ns * 3);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ns; j++) {
        const v = i * ns + j;
        surf.eval(surf.xs[i], ss[j], o);
        P[3 * v] = surf.xs[i];
        P[3 * v + 1] = o[0];
        P[3 * v + 2] = o[1];
        surfNormal(surf, panel, surf.xs[i], ss[j], n);
        N[3 * v] = n[0];
        N[3 * v + 1] = n[1];
        N[3 * v + 2] = n[2];
      }
    }
    return { panel, ss, P, N, nx, ns };
  });
  gridCache.set(surf, g);
  return g;
}

/**
 * 在曲面上建立一個區域（所有保留函式都 ≥ 0 的部分），沿法線偏移 offset（負值往內）
 * @type {(surf: LoftSurface, fns: KeepFn[], opt?: { offset?: number, smoothOffset?: boolean, color?: (x: number, y: number, z: number) => number[] }) => { geometry: THREE.BufferGeometry, meta: any }}
 */
export function buildRegion(surf, fns, opt = {}) {
  const offset = opt.offset ?? 0;
  const grid = getGrid(surf);
  const nf = fns.length;
  /** @type {number[]} */
  const pos = [];
  /** @type {number[]} */
  const nrm = [];
  /** @type {number[]} */
  const col = [];
  /** @type {number[]} */
  const index = [];
  // 未偏移的位置 / 法線 / 參數（翻邊用）
  /** @type {number[]} */
  const raw = [];
  /** @type {number[]} */
  const prm = [];
  /** @type {Map<string | number, number>} */
  const vmap = new Map();
  const o = [0, 0];
  const nn = [0, 0, 0];

  /** @type {(px: number, py: number, pz: number, nx: number, ny: number, nz: number, x: number, s: number, pi: number) => number} */
  const fullPanel = { s0: -1, s1: 1, n: 1 };
  const sn = [0, 0, 0];
  const emit = (px, py, pz, nx, ny, nz, x, s, pi) => {
    if (opt.smoothOffset) {
      // 凸起件用跨面板的平滑法線偏移：稜線兩側的頂點偏移到同一點，不會裂開
      surfNormal(surf, fullPanel, x, s, sn);
      [nx, ny, nz] = sn;
    }
    // 偏移後不可超出曲面前後端（避免內面從封口後方露出）
    const ox = Math.min(surf.xMax, Math.max(surf.xMin, px + offset * nx));
    pos.push(ox, py + offset * ny, pz + offset * nz);
    nrm.push(nx, ny, nz);
    raw.push(px, py, pz, nx, ny, nz);
    prm.push(x, s, pi);
    if (opt.color) {
      col.push(...opt.color(px, py, pz));
    }
    return pos.length / 3 - 1;
  };

  grid.forEach((G, pi) => {
    const { ss, P, N, nx, ns, panel } = G;
    // 保留函式值延遲計算（多數三角形只要看最後一個、通常最挑剔的函式就能整片丟掉）
    const F = new Float64Array(nx * ns * Math.max(1, nf)).fill(NaN);
    /** @type {(v: number, k: number) => number} */
    const fv = (v, k) => {
      let val = F[v * nf + k];
      if (Number.isNaN(val)) {
        val = fns[k](P[3 * v], P[3 * v + 1], P[3 * v + 2], ss[v % ns]);
        F[v * nf + k] = val;
      }
      return val;
    };
    /** @type {(v: number) => number} */
    const gridVertex = (v) => {
      const key = pi * 1e8 + v;
      let id = vmap.get(key);
      if (id === undefined) {
        id = emit(P[3 * v], P[3 * v + 1], P[3 * v + 2], N[3 * v], N[3 * v + 1], N[3 * v + 2], P[3 * v], ss[v % ns], pi);
        vmap.set(key, id);
      }
      return id;
    };
    /** @type {(x: number, s: number) => { x: number, s: number, f: Float64Array, p: number[] }} */
    const evalPoint = (x, s) => {
      surf.eval(x, s, o);
      const f = new Float64Array(nf);
      for (let k = 0; k < nf; k++) {
        f[k] = fns[k](x, o[0], o[1], s);
      }
      return { x, s, f, p: [x, o[0], o[1]] };
    };
    /** @type {(pt: { x: number, s: number, p: number[], v?: number }) => number} */
    const pointVertex = (pt) => {
      if (pt.v !== undefined) {
        return gridVertex(pt.v);
      }
      const key = `${pi}:${Math.round(pt.x * 1e5)}:${Math.round(pt.s * 1e8)}`;
      let id = vmap.get(key);
      if (id === undefined) {
        surfNormal(surf, panel, pt.x, pt.s, nn);
        id = emit(pt.p[0], pt.p[1], pt.p[2], nn[0], nn[1], nn[2], pt.x, pt.s, pi);
        vmap.set(key, id);
      }
      return id;
    };
    /** @type {(a: any, b: any, k: number) => any} a 在內（f ≥ 0）、b 在外，二分法求邊界點 */
    const intersect = (a, b, k) => {
      let lo = 0;
      let hi = 1;
      let t = a.f[k] / (a.f[k] - b.f[k]);
      for (let it = 0; it < 14; it++) {
        const x = lerp(a.x, b.x, t);
        const s = lerp(a.s, b.s, t);
        surf.eval(x, s, o);
        if (fns[k](x, o[0], o[1], s) >= 0) {
          lo = t;
        } else {
          hi = t;
        }
        t = (lo + hi) / 2;
      }
      return evalPoint(lerp(a.x, b.x, lo), lerp(a.s, b.s, lo));
    };
    const tri = [0, 0, 0];
    for (let i = 0; i < nx - 1; i++) {
      for (let j = 0; j < ns - 1; j++) {
        const v00 = i * ns + j;
        const v10 = (i + 1) * ns + j;
        const v11 = (i + 1) * ns + j + 1;
        const v01 = i * ns + j + 1;
        for (let q = 0; q < 2; q++) {
          tri[0] = v00;
          tri[1] = q === 0 ? v10 : v11;
          tri[2] = q === 0 ? v11 : v01;
          let drop = false;
          let allIn = true;
          for (let k = nf - 1; k >= 0 && !drop; k--) {
            let neg = 0;
            for (const v of tri) {
              if (fv(v, k) < 0) {
                neg++;
              }
            }
            if (neg === 3) {
              drop = true;
            } else if (neg > 0) {
              allIn = false;
            }
          }
          if (drop) {
            continue;
          }
          /** @type {number[]} */
          let ids;
          if (allIn) {
            ids = tri.map(gridVertex);
            pushPolygon(ids);
            continue;
          }
          let poly = tri.map((v) => {
            const f = new Float64Array(nf);
            for (let k = 0; k < nf; k++) {
              f[k] = fv(v, k);
            }
            return { x: P[3 * v], s: ss[v % ns], f, p: [P[3 * v], P[3 * v + 1], P[3 * v + 2]], v };
          });
          for (let k = 0; k < nf && poly.length >= 3; k++) {
            if (poly.every((pt) => pt.f[k] >= 0)) {
              continue;
            }
            const next = [];
            for (let e = 0; e < poly.length; e++) {
              const a = poly[e];
              const b = poly[(e + 1) % poly.length];
              const ain = a.f[k] >= 0;
              const bin = b.f[k] >= 0;
              if (ain) {
                next.push(a);
              }
              if (ain && !bin) {
                next.push(intersect(a, b, k));
              } else if (!ain && bin) {
                next.push(intersect(b, a, k));
              }
            }
            poly = next;
          }
          if (poly.length >= 3) {
            pushPolygon(poly.map(pointVertex));
          }
        }
      }
    }
  });

  /** 扇形三角化並依法線決定繞向 */
  function pushPolygon(ids) {
    for (let k = 1; k < ids.length - 1; k++) {
      const a = ids[0];
      const b = ids[k];
      const c = ids[k + 1];
      if (a === b || b === c || a === c) {
        continue;
      }
      const ux = raw[6 * b] - raw[6 * a];
      const uy = raw[6 * b + 1] - raw[6 * a + 1];
      const uz = raw[6 * b + 2] - raw[6 * a + 2];
      const vx = raw[6 * c] - raw[6 * a];
      const vy = raw[6 * c + 1] - raw[6 * a + 1];
      const vz = raw[6 * c + 2] - raw[6 * a + 2];
      const fx = uy * vz - uz * vy;
      const fy = uz * vx - ux * vz;
      const fz = ux * vy - uy * vx;
      const d = fx * (raw[6 * a + 3] + raw[6 * b + 3] + raw[6 * c + 3]) + fy * (raw[6 * a + 4] + raw[6 * b + 4] + raw[6 * c + 4]) + fz * (raw[6 * a + 5] + raw[6 * b + 5] + raw[6 * c + 5]);
      if (d >= 0) {
        index.push(a, b, c);
      } else {
        index.push(a, c, b);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  if (opt.color) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  geometry.setIndex(index);
  return { geometry, meta: { raw, prm, index, surf } };
}

/**
 * 區域的邊界邊（排除面板內部稜線與前後端），在兩個偏移量之間做出牆面（開口邊緣厚度、下緣翻邊、凹陷側壁）
 * @type {(region: { meta: any }, o1: number, o2: number) => THREE.BufferGeometry}
 */
export function buildRim(region, o1, o2) {
  const { raw, prm, index, surf } = region.meta;
  /** @type {Map<number, number[]>} */
  const edges = new Map();
  for (let t = 0; t < index.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = index[t + e];
      const b = index[t + ((e + 1) % 3)];
      const key = a < b ? a * 4194304 + b : b * 4194304 + a;
      const hit = edges.get(key);
      if (hit) {
        hit[2]++;
      } else {
        edges.set(key, [a, b, 1]);
      }
    }
  }
  const innerBreaks = surf.panels.flatMap((p) => [p.s0, p.s1]).filter((s) => Math.abs(s) < 1);
  /** @type {(v: number) => number} */
  const sOf = (v) => prm[3 * v + 1];
  /** @type {(v: number) => number} */
  const xOf = (v) => prm[3 * v];
  /** @type {number[]} */
  const pos = [];
  /** @type {(v: number, o: number) => number[]} */
  const at = (v, o) => [raw[6 * v] + o * raw[6 * v + 3], raw[6 * v + 1] + o * raw[6 * v + 4], raw[6 * v + 2] + o * raw[6 * v + 5]];
  for (const [a, b, cnt] of edges.values()) {
    if (cnt !== 1) {
      continue;
    }
    const onBreak = innerBreaks.some((bs) => sOf(a) === bs && sOf(b) === bs);
    const onEnd = (xOf(a) === surf.xMin && xOf(b) === surf.xMin) || (xOf(a) === surf.xMax && xOf(b) === surf.xMax);
    if (onBreak || onEnd) {
      continue;
    }
    const a1 = at(a, o1);
    const b1 = at(b, o1);
    const a2 = at(a, o2);
    const b2 = at(b, o2);
    pos.push(...a1, ...b1, ...b2, ...a1, ...b2, ...a2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * 前 / 後端封口：在 x = xEnd 的剖面多邊形（含底部直線）；offset 往車內偏移（內封口用），dir 為朝外方向（+1 前、−1 後）
 * @type {(surf: LoftSurface, xEnd: number, dir: number, inset?: number) => THREE.BufferGeometry}
 */
export function buildCap(surf, xEnd, dir, inset = 0) {
  const o = [0, 0];
  const n = [0, 0, 0];
  /** @type {THREE.Vector2[]} */
  const contour = [];
  const x = xEnd - dir * inset;
  surf.panels.forEach((panel, pi) => {
    const last = pi === surf.panels.length - 1;
    for (let j = 0; j <= panel.n; j++) {
      if (j === panel.n && !last) {
        continue;
      }
      const s = panel.s0 + ((panel.s1 - panel.s0) * j) / panel.n;
      surf.eval(x, s, o);
      let z = o[1];
      let y = o[0];
      if (inset > 0) {
        surfNormal(surf, panel, x, s, n);
        z -= inset * n[2];
        y -= inset * n[1];
      }
      contour.push(new THREE.Vector2(z, y));
    }
  });
  // 去除重複點
  const pts = contour.filter((p, i) => i === 0 || p.distanceTo(contour[i - 1]) > 1e-6);
  const faces = THREE.ShapeUtils.triangulateShape(pts, []);
  const pos = [];
  for (const [a, b, c] of faces) {
    const tri = [pts[a], pts[b], pts[c]];
    // 依朝向決定繞向：法線 = (dir, 0, 0)
    const cross = (tri[1].x - tri[0].x) * (tri[2].y - tri[0].y) - (tri[1].y - tri[0].y) * (tri[2].x - tri[0].x);
    // 在 (z, y) 平面上逆時針（cross > 0）→ 法線指向 −x
    const order = cross * -dir > 0 ? [0, 1, 2] : [0, 2, 1];
    for (const k of order) {
      pos.push(x, tri[k].y, tri[k].x);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// 裁切函式產生器
// ---------------------------------------------------------------------------

/**
 * 輪拱：沿 z 的圓柱切割，只切 |z| ≥ cutZFrom；回傳保留函式（值近似到切口邊緣的距離）
 * @type {(arch: { x: number, y: number, radius: number, cutZFrom: number }) => KeepFn}
 */
export const archKeep = (arch) => (x, y, z) => Math.max(Math.hypot(x - arch.x, y - arch.y) - arch.radius, arch.cutZFrom - Math.abs(z));

/**
 * 開口 / 凹陷的 2D 形狀距離函式（負值 = 在開口內），依 view 投影
 * - view 'top'：(x, |z|) 平面；view 'side'：(x, y) 平面，只作用在側壁（|z| ≥ sideZMin）
 * @type {(o: any, sideZMin?: number) => (x: number, y: number, z: number) => number}
 */
export function featureSd(o, sideZMin = 20) {
  const [x0, x1] = o.x;
  if (o.view === 'top') {
    const [z0, z1] = o.z;
    if (o.shape === 'trapezoid') {
      // 外側邊往前收 2 mm
      const poly = sdConvexPolygon([
        [x0, z0],
        [x1, z0],
        [x1 - 2, z1],
        [x0, z1],
      ]);
      return (x, y, z) => poly(x, Math.abs(z));
    }
    if (o.shape === 'slots') {
      // 每側 3 條沿 x 的長槽
      const n = 3;
      const gap = 1.9;
      const w = (z1 - z0 - (n - 1) * gap) / n;
      return (x, y, z) => {
        let d = Infinity;
        for (let i = 0; i < n; i++) {
          const a = z0 + i * (w + gap);
          d = Math.min(d, sdRoundRect(x, Math.abs(z), x0, x1, a, a + w, w / 2));
        }
        return d;
      };
    }
    return (x, y, z) => sdRoundRect(x, Math.abs(z), x0, x1, z0, z1, o.r ?? 0);
  }
  const [y0, y1] = o.y;
  /** @type {(x: number, y: number) => number} */
  let sd2;
  if (o.shape === 'hex') {
    const c = (y1 - y0) / 2;
    sd2 = sdConvexPolygon([
      [x0, (y0 + y1) / 2],
      [x0 + c, y1],
      [x1 - c, y1],
      [x1, (y0 + y1) / 2],
      [x1 - c, y0],
      [x0 + c, y0],
    ]);
  } else if (o.shape === 'trapezoid') {
    // 上邊兩端各內縮 4 mm
    sd2 = sdConvexPolygon([
      [x0, y0],
      [x1, y0],
      [x1 - 4, y1],
      [x0 + 4, y1],
    ]);
  } else {
    sd2 = (x, y) => sdRoundRect(x, y, x0, x1, y0, y1, o.r ?? 0);
  }
  return (x, y, z) => (Math.abs(z) < sideZMin ? 10 : sd2(x, y));
}

// ---------------------------------------------------------------------------
// 實心零件：尾翼、端板、鵝頸支柱、splitter、卡座
// ---------------------------------------------------------------------------

/**
 * 尾翼主翼（對稱翼型，攻角往後緣抬高）、端板、鵝頸支柱
 * @type {(wing: any) => { wing: THREE.BufferGeometry, endplates: THREE.BufferGeometry, stays: THREE.BufferGeometry }}
 */
export function buildWingParts(wing) {
  const chord = Math.abs(wing.xLE - wing.xTE);
  const aoa = (wing.aoa_deg * Math.PI) / 180;
  const tr = wing.thickness / chord;
  const yChordLE = wing.yLower + wing.thickness / 2;
  /** @type {THREE.Vector2[]} */
  const upper = [];
  /** @type {THREE.Vector2[]} */
  const lower = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const xi = (1 - Math.cos((Math.PI * i) / N)) / 2;
    // NACA 4 位數厚度分布（後緣閉合版）
    const yt = 5 * tr * chord * (0.2969 * Math.sqrt(xi) - 0.126 * xi - 0.3516 * xi * xi + 0.2843 * xi ** 3 - 0.1036 * xi ** 4);
    const c = xi * chord;
    const camber = 0.35 * Math.sin(Math.PI * xi);
    const px = wing.xLE - c * Math.cos(aoa);
    const py = yChordLE + c * Math.sin(aoa);
    upper.push(new THREE.Vector2(px - (camber + yt) * Math.sin(aoa), py + (camber + yt) * Math.cos(aoa)));
    lower.push(new THREE.Vector2(px - (camber - yt) * Math.sin(aoa), py + (camber - yt) * Math.cos(aoa)));
  }
  const shape = new THREE.Shape([...upper, ...lower.reverse().slice(1, -1)]);
  const half = wing.span / 2;
  const wingGeo = new THREE.ExtrudeGeometry(shape, { depth: wing.span, bevelEnabled: false, curveSegments: 4 });
  wingGeo.translate(0, 0, -half);

  // 端板：前緣斜切的板子
  const ep = wing.endplate;
  const exTE = Math.min(wing.xLE, wing.xTE);
  const ex0 = exTE;
  const ex1 = exTE + ep.length;
  // iter-35：端板改成前低後高的後掠板（下緣斜切），側視不再是一大塊矩形
  const yTopEp = ep.yBottom + ep.height;
  const epShape = new THREE.Shape([
    new THREE.Vector2(ex0, ep.yBottom + 2.5),
    new THREE.Vector2(ex1 - 5, ep.yBottom + 4.6),
    new THREE.Vector2(ex1, ep.yBottom + 6.4),
    new THREE.Vector2(ex1, yTopEp - 1.4),
    new THREE.Vector2(ex1 - 4, yTopEp),
    new THREE.Vector2(ex0, yTopEp),
  ]);
  // 端板倒角：bevel 0.3 mm（形狀本身內縮 0.3，外形尺寸不變）
  const bev = 0.3;
  const epShapeIn = new THREE.Shape(
    epShape.getPoints().map((pt) => {
      const cx = (ex0 + ex1) / 2;
      const cy = ep.yBottom + ep.height / 2;
      return new THREE.Vector2(pt.x - Math.sign(pt.x - cx) * bev, pt.y - Math.sign(pt.y - cy) * bev);
    }),
  );
  const epR = new THREE.ExtrudeGeometry(epShapeIn, { depth: ep.thickness - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2 });
  epR.translate(0, 0, half + bev);
  const epL = epR.clone();
  epL.translate(0, 0, -half * 2 - ep.thickness);
  const endplates = mergeGeos([epR, epL]);

  // 鵝頸支柱：從尾甲板往上、越過前緣後往下接到翼面上方
  const st = wing.stays;
  const [bx, by] = st.base;
  const [tx, ty] = st.top;
  // 控制點：先幾乎垂直往上，越過前緣上方後往後彎，從翼面上方落到 (tx, ty)
  // iter-35：鵝頸弧度加大，明顯高過翼面再往後下彎、從翼面上方吊住
  const ctrl = [
    new THREE.Vector3(bx, by - 0.6, 0),
    new THREE.Vector3(bx - 0.4, by + 7, 0),
    new THREE.Vector3(bx - 1.4, ty - 1.0, 0),
    new THREE.Vector3(bx - 3.0, ty + 2.6, 0),
    new THREE.Vector3(bx - 6.5, ty + 3.6, 0),
    new THREE.Vector3(tx + 2.2, ty + 2.8, 0),
    new THREE.Vector3(tx + 0.4, ty + 1.2, 0),
    new THREE.Vector3(tx, ty - 0.2, 0),
  ];
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const staysGeos = [];
  for (const zc of [-st.z, st.z]) {
    // iter-36：支柱改細改扁（z 向厚 1 mm、沿流向寬約 2.5 → 1.8 mm 的倒角扁斷面），原設計斷面 secZ × secN 只當上限
    // iter-37：板狀鵝頸支柱（側視寬 7 → 5 mm、厚 1.1 mm 的倒角板），從翼面上方吊掛
    // 立柱段寬（3.5 → 2.6 mm 半寬），越過翼面上方的鉤段收窄到 1.3，避免鉤內側填成實心半圓
    staysGeos.push(sweepRect(curve, 72, 0.55, (t) => (t < 0.5 ? lerp(3.5, 2.6, t / 0.5) : lerp(2.6, 1.3, smoothstep(0.5, 0.75, t))), zc));
  }
  return { wing: wingGeo, endplates, stays: mergeGeos(staysGeos) };
}

/**
 * 沿平面曲線（在 x–y 平面）掃掠矩形斷面
 * @type {(curve: THREE.Curve<THREE.Vector3>, n: number, hz: number, hn: (t: number) => number, zc: number) => THREE.BufferGeometry}
 */
function sweepRect(curve, n, hz, hn, zc) {
  const pos = [];
  const rings = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    // 平面內法向 = z × T
    const nx = -tg.y;
    const ny = tg.x;
    const a = hn(t);
    // 倒角斷面（八角形）：倒角量取短邊一半的 45%
    const c = 0.45 * Math.min(a, hz);
    /** @type {number[][]} 斷面 (法向偏移, z 偏移) */
    const sec = [
      [a, -hz + c],
      [a, hz - c],
      [a - c, hz],
      [-a + c, hz],
      [-a, hz - c],
      [-a, -hz + c],
      [-a + c, -hz],
      [a - c, -hz],
    ];
    rings.push(sec.map(([en, ez]) => [p.x + nx * en, p.y + ny * en, zc + ez]));
  }
  const m = rings[0].length;
  for (let i = 0; i < n; i++) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    for (let k = 0; k < m; k++) {
      const a = r0[k];
      const b = r0[(k + 1) % m];
      const c = r1[(k + 1) % m];
      const d = r1[k];
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  for (const r of [rings[0], rings[n]]) {
    for (let k = 1; k < m - 1; k++) {
      pos.push(...r[0], ...r[k], ...r[k + 1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // 繞向未逐面校正，支柱請用雙面材質
  return g;
}

/**
 * 尾部裙板：把車身尾段的下緣往下延伸到 yBottom（兩側直條 + 尾端平板），封住從後方看進去的底盤空隙
 * @type {(surf: LoftSurface, opt: { xFrom: number, yBottom: number }) => THREE.BufferGeometry}
 */
export function buildTailValance(surf, { xFrom, yBottom }) {
  const o = [0, 0];
  const pos = [];
  const xs = subdivide([surf.xMin, xFrom], 0.5);
  /** @type {(x: number) => number[]} 右側下緣點 [y, z] */
  const edge = (x) => {
    surf.eval(x, 1, o);
    return [o[0], o[1]];
  };
  for (let i = 0; i < xs.length - 1; i++) {
    const [ya, za] = edge(xs[i]);
    const [yb, zb] = edge(xs[i + 1]);
    if (ya <= yBottom && yb <= yBottom) {
      continue;
    }
    const ta = Math.max(ya, yBottom);
    const tb = Math.max(yb, yBottom);
    for (const sg of [-1, 1]) {
      pos.push(xs[i], ta, sg * za, xs[i + 1], tb, sg * zb, xs[i + 1], yBottom, sg * zb);
      pos.push(xs[i], ta, sg * za, xs[i + 1], yBottom, sg * zb, xs[i], yBottom, sg * za);
    }
  }
  const [ye, ze] = edge(surf.xMin);
  if (ye > yBottom) {
    const x = surf.xMin;
    pos.push(x, yBottom, -ze, x, yBottom, ze, x, ye, ze, x, yBottom, -ze, x, ye, ze, x, ye, -ze);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // 繞向未逐面校正，請用雙面材質
  return g;
}

/**
 * 前下擾流板：俯視圓角板，厚度沿 y
 * @type {(sp: any) => THREE.BufferGeometry}
 */
export function buildSplitter(sp) {
  const [x0, x1] = sp.x;
  const hw = sp.halfW;
  const r = 4;
  const shape = new THREE.Shape();
  // shape 座標 (x, z)
  shape.moveTo(x0, -hw);
  shape.lineTo(x1 - r - 1.5, -hw);
  shape.quadraticCurveTo(x1 - 1.5, -hw, x1 - 0.5, -hw + r);
  shape.lineTo(x1, -6);
  shape.quadraticCurveTo(x1 + 0.6, 0, x1, 6);
  shape.lineTo(x1 - 0.5, hw - r);
  shape.quadraticCurveTo(x1 - 1.5, hw, x1 - r - 1.5, hw);
  shape.lineTo(x0, hw);
  shape.lineTo(x0, -hw);
  const g = new THREE.ExtrudeGeometry(shape, { depth: sp.thickness, bevelEnabled: false, curveSegments: 8 });
  // (x, zShape, e) → 繞 x 軸轉 −90° → (x, e, −zShape)；板子左右對稱，z 反號不影響
  g.rotateX(-Math.PI / 2);
  g.translate(0, sp.yBottom, 0);
  return g;
}

/**
 * 前後卡座吊耳：從殼內面往下到底盤卡榫點
 * - 前：寬 6（z）、厚 1.2（x）板片，末端開 2 mm 卡槽
 * - 後：Ø4 圓柱 + 前後補強肋
 * @type {(mounts: { id: string, x: number, y: number, z: number }[], innerYAt: (x: number) => number) => THREE.BufferGeometry}
 */
export function buildMountTabs(mounts, innerYAt) {
  const geos = [];
  for (const m of mounts) {
    // 吊耳頂端取足跡範圍內最低的殼內面高度，避免斜面處從殼外露出
    const top = Math.min(innerYAt(m.x - 3.6), innerYAt(m.x), innerYAt(m.x + 3.6)) + 0.2;
    const len = top - m.y;
    if (m.id === 'front') {
      const main = new THREE.BoxGeometry(1.2, len - 2, 6);
      main.translate(m.x, m.y + 2 + (len - 2) / 2, m.z);
      geos.push(main);
      for (const zc of [-2.25, 2.25]) {
        const prong = new THREE.BoxGeometry(1.2, 2, 1.5);
        prong.translate(m.x, m.y + 1, m.z + zc);
        geos.push(prong);
      }
    } else {
      const cyl = new THREE.CylinderGeometry(2, 2, len, 20);
      cyl.translate(m.x, m.y + len / 2, m.z);
      geos.push(cyl);
      const rib = new THREE.BoxGeometry(7, Math.max(1, len - 3), 0.8);
      rib.translate(m.x, top - (len - 3) / 2, m.z);
      geos.push(rib);
    }
  }
  return mergeGeos(geos);
}

/**
 * 合併幾何（全部轉成非索引）
 * @type {(geos: THREE.BufferGeometry[]) => THREE.BufferGeometry}
 */
export function mergeGeos(geos) {
  /** @type {number[]} */
  const pos = [];
  /** @type {number[]} */
  const nrm = [];
  /** @type {number[]} */
  const col = [];
  const withColor = geos.every((g) => g.attributes.color);
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) {
      g.computeVertexNormals();
    }
    // 用迴圈複製，避免大陣列展開超過呼叫堆疊上限
    for (const v of g.attributes.position.array) {
      pos.push(v);
    }
    for (const v of g.attributes.normal.array) {
      nrm.push(v);
    }
    if (withColor) {
      for (const v of g.attributes.color.array) {
        col.push(v);
      }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  if (withColor) {
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 共用的車殼組裝流程
// ---------------------------------------------------------------------------

/**
 * 底盤側框禁入區（iter-33 由 chassis 模型量測：x ±28.9、|z| ≤ 38.8、y ≤ 9.4 的側框上緣）。
 * 車殼側裙下緣在這一段往上讓開到 y = 9.9（留 0.5 mm），兩端圓角 R1.5。
 * @type {{ x: number[], yTop: number, zFrom: number, r: number }}
 */
export const CHASSIS_SIDE_RAIL = { x: [-30.4, 30.4], yTop: 9.9, zFrom: 33, r: 1.5 };

/** @type {KeepFn} 側裙避開底盤側框 */
const sideRailKeep = (x, y, z) => {
  if (Math.abs(z) < CHASSIS_SIDE_RAIL.zFrom) {
    return 10;
  }
  return sdRoundRect(x, y, CHASSIS_SIDE_RAIL.x[0], CHASSIS_SIDE_RAIL.x[1], -20, CHASSIS_SIDE_RAIL.yTop, CHASSIS_SIDE_RAIL.r);
};

/**
 * 建立放樣工具組：車身曲面、座艙曲面、輪拱 / 開口 / 凹陷函式
 * @type {(data: any, opt: { mode: 'linear' | 'smooth', step?: number, sideZMin?: number }) => any}
 */
export function makeLoftKit(data, opt) {
  const surf = createBodySurface(data, opt.mode, opt.step ?? 0.5, opt.bump ?? null, { tuck: opt.tuck ?? 0, xSmooth: opt.xSmooth ?? false, sideIn: opt.sideIn ?? null, chaikin: opt.chaikin ?? false });
  const t = data.wallThickness_mm;
  const canopy = data.canopy ? createCanopySurface(data.canopy, surf, opt.mode === 'smooth', 0.35) : null;
  const arches = (data.wheelArches ?? []).map(archKeep);
  const openingSds = (data.openings ?? []).map((o) => featureSd(o, opt.sideZMin ?? 20));
  const holes = [...arches, ...openingSds.map((sd) => (x, y, z) => sd(x, y, z)), sideRailKeep];
  const recesses = (data.recesses ?? []).map((r) => ({ sd: featureSd(r, opt.sideZMin ?? 20), depth: r.depth, id: r.id }));
  /** @type {KeepFn} 不在任何凹陷內 */
  const notRecess = (x, y, z) => {
    let d = Infinity;
    for (const r of recesses) {
      d = Math.min(d, r.sd(x, y, z));
    }
    return d;
  };
  /** @type {(x: number, y: number, z: number) => number} 到最近開口（含輪拱）的距離近似值 */
  const openingDist = (x, y, z) => {
    let d = Infinity;
    for (const sd of openingSds) {
      d = Math.min(d, sd(x, y, z));
    }
    return d;
  };
  /** @type {(x: number, z: number) => number} 座艙投影：正值 = 在座艙底下 */
  const underCanopy = (x, z) => {
    if (!canopy) {
      return -1;
    }
    const hw = canopy.halfWAt(x);
    return hw - Math.abs(z) - 0.2;
  };
  /** @type {{ cell: number, map: Map<string, number[]> } | null} 輪拱切口邊界點的空間雜湊（延遲建立） */
  let archHash = null;
  /** 從實際裁切後的網格取出輪拱切口邊界（加密到 0.25 mm），用來畫沿切口等寬的補強邊 */
  const buildArchHash = () => {
    const reg = buildRegion(surf, holes, { offset: 0 });
    const { raw, index } = reg.meta;
    /** @type {Map<number, number>} */
    const count = new Map();
    for (let i = 0; i < index.length; i += 3) {
      for (let e = 0; e < 3; e++) {
        const a = index[i + e];
        const b = index[i + ((e + 1) % 3)];
        const key = a < b ? a * 4194304 + b : b * 4194304 + a;
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    }
    const cell = 2;
    /** @type {Map<string, number[]>} */
    const map = new Map();
    const P = (v) => [raw[6 * v], raw[6 * v + 1], raw[6 * v + 2]];
    const onArch = (p) => arches.some((f) => Math.abs(f(p[0], p[1], p[2], 0)) < 0.02);
    for (const [key, cnt] of count) {
      if (cnt !== 1) {
        continue;
      }
      const a = P(Math.floor(key / 4194304));
      const b = P(key % 4194304);
      if (!onArch(a) || !onArch(b)) {
        continue;
      }
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const n = Math.max(1, Math.ceil(len / 0.25));
      for (let k = 0; k <= n; k++) {
        const q = [lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n), lerp(a[2], b[2], k / n)];
        const hk = `${Math.floor(q[0] / cell)},${Math.floor(q[1] / cell)},${Math.floor(q[2] / cell)}`;
        let arr = map.get(hk);
        if (!arr) {
          arr = [];
          map.set(hk, arr);
        }
        arr.push(q[0], q[1], q[2]);
      }
    }
    return { cell, map };
  };
  /** @type {(x: number, y: number, z: number) => number} 到輪拱切口邊界的 3D 距離（最多查 2 格，超過回傳 4） */
  const archEdgeDist = (x, y, z) => {
    // 離所有輪拱圓柱都遠的點直接略過
    if ((data.wheelArches ?? []).every((a) => Math.hypot(x - a.x, y - a.y) > a.radius + 4 || Math.abs(z) < a.cutZFrom - 4)) {
      return 16;
    }
    if (!archHash) {
      archHash = buildArchHash();
    }
    const { cell, map } = archHash;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    let best = 16;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          const arr = map.get(`${cx + i},${cy + j},${cz + k}`);
          if (!arr) {
            continue;
          }
          for (let q = 0; q < arr.length; q += 3) {
            const d2 = (arr[q] - x) ** 2 + (arr[q + 1] - y) ** 2 + (arr[q + 2] - z) ** 2;
            if (d2 < best) {
              best = d2;
            }
          }
        }
      }
    }
    return Math.sqrt(best);
  };
  return {
    data,
    surf,
    canopy,
    t,
    holes,
    arches,
    archEdgeDist,
    sideRail: sideRailKeep,
    openingSds,
    recesses,
    notRecess,
    openingDist,
    underCanopy,
    /** 外表面上的一個塗裝區域（自動扣掉輪拱、開口、凹陷） */
    outer(fns, o = {}) {
      return buildRegion(surf, [...holes, ...(recesses.length ? [notRecess] : []), ...fns], o).geometry;
    },
    /** 貼紙（外表面往外偏移，不標 shell） */
    decal(fn, o = {}) {
      return buildRegion(surf, [...holes, ...(recesses.length ? [notRecess] : []), fn], { offset: 0.06, ...o }).geometry;
    },
    /** 殼內面、開口與下緣的厚度面、前後封口、凹陷 */
    structure() {
      const inner = buildRegion(surf, holes, { offset: -t });
      const rim = buildRim(inner, 0, -t);
      const parts = {
        inner: inner.geometry,
        rim,
        capFront: buildCap(surf, surf.xMax, 1),
        capRear: buildCap(surf, surf.xMin, -1),
        capFrontIn: buildCap(surf, surf.xMax, 1, t),
        capRearIn: buildCap(surf, surf.xMin, -1, t),
        recessFloor: [],
        recessWall: [],
      };
      for (const r of recesses) {
        const inside = (x, y, z) => -r.sd(x, y, z);
        const floor = buildRegion(surf, [...holes, inside], { offset: -r.depth });
        parts.recessFloor.push(floor.geometry);
        parts.recessWall.push(buildRim(floor, 0, -r.depth));
      }
      return parts;
    },
    /** 殼內面中線在 x 的高度 */
    innerYAt(x) {
      const o = [0, 0];
      surf.eval(x, 0, o);
      return o[0] - t;
    },
  };
}

/**
 * 把「零件清單產生器」包成 BodyDef.build：幾何與材質只算一次，之後每次 build 只建立新的 Mesh
 * @type {(compose: () => BodyPart[], makeMaterials: () => Record<string, THREE.Material>) => (mats?: any) => THREE.Group}
 */
export function cachedBuild(compose, makeMaterials) {
  /** @type {BodyPart[] | null} */
  let parts = null;
  /** @type {Record<string, THREE.Material> | null} */
  let materials = null;
  return () => {
    if (!parts) {
      parts = compose();
    }
    if (!materials) {
      materials = makeMaterials();
    }
    const g = new THREE.Group();
    g.name = 'body';
    for (const p of parts) {
      const mat = materials[p.mat];
      if (!mat) {
        throw new Error(`車殼材質未定義：${p.mat}`);
      }
      const mesh = new THREE.Mesh(p.geometry, mat);
      mesh.name = p.name ?? p.mat;
      if (p.shell) {
        mesh.userData.shell = true;
      }
      if (p.renderOrder !== undefined) {
        mesh.renderOrder = p.renderOrder;
      }
      // 透明度高的件（座艙玻璃、透明泡）不投影，避免陰影把它畫成實心
      const transparent = mat.transparent === true;
      mesh.castShadow = !transparent || mat.opacity >= 0.4;
      mesh.receiveShadow = !transparent;
      g.add(mesh);
    }
    return g;
  };
}

/**
 * 建立有名稱的實體材質（Blender 管線靠名稱對應寫實材質）
 * @type {(name: string, params: THREE.MeshPhysicalMaterialParameters) => THREE.MeshPhysicalMaterial}
 */
export function namedMaterial(name, params) {
  const m = new THREE.MeshPhysicalMaterial(params);
  m.name = name;
  return m;
}

/**
 * 貼紙材質：用 polygonOffset 避免與車身 z-fighting
 * @type {(name: string, params: THREE.MeshPhysicalMaterialParameters) => THREE.MeshPhysicalMaterial}
 */
export function decalMaterial(name, params) {
  return namedMaterial(name, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, ...params });
}
