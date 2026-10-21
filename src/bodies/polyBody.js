// 多點折線剖面車殼的共用組裝流程（iter-46 起的新車殼用）：站位表 → 外殼塗裝分區、內面、厚度面、封口、凹陷、座艙、卡座吊耳
// 每款車殼只要提供站位表、輪拱、塗裝分區、材質與額外零件（鰭片、尾翼、貼紙），其餘交給這裡。
import * as THREE from 'three';
import { getPart } from '../parts/index.js';
import { makeLoftKit, createPolySurface, cachedBuild, buildRegion, buildMountTabs, mergeGeos, lerp } from './loft.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/**
 * @typedef {object} PolyBodyConfig
 * @property {string} id
 * @property {string} name
 * @property {'homage' | 'race'} style 致敬《爆走兄弟》風格 / 常見比賽車殼型式
 * @property {string} theme 一句話主題
 * @property {number} [phase] 上線階段（第四階段新致敬款 = 4）
 * @property {import('./types').BodyDef['roof']} [roof] 車頂型態
 * @property {string} [wing] 尾翼型式
 * @property {'ABS' | 'PC'} material
 * @property {number} density_g_cm3
 * @property {number} wallThickness_mm
 * @property {{ x: number, pts: number[][] }[]} stations 半剖面站位表（見 createPolySurface）
 * @property {number} [tuck] 側裙下緣內收量
 * @property {boolean} [innerSkipRecess] 內面避開凹陷（預設 false）
 * @property {number[]} [hard] 有給時改用平滑剖面（createSmoothPolySurface），只有這些點是銳利稜線
 * @property {{ x: number, y: number, radius: number, cutZFrom: number }[]} wheelArches
 * @property {any[]} [openings]
 * @property {any[]} [recesses]
 * @property {any} [canopy] 座艙泡站位（同 sections.json 的 canopy 格式），null = 無
 * @property {number} [sideZMin] 側視開口 / 凹陷只作用在 |z| ≥ sideZMin
 * @property {(kit: any) => { mat: string, keep: KeepFn }[]} zones 外表面塗裝分區（依序取第一個符合的區）
 * @property {{ outer?: string, inner: string, edge: string, cap: string, recess?: string, recessWall?: string, glass?: string, cockpit?: string, mount: string }} mats 結構件用的材質鍵
 * @property {() => Record<string, THREE.Material>} materials
 * @property {(kit: any) => BodyPart[]} [extras] 鰭片、尾翼、貼紙、燈具等
 * @property {(kit: any) => (x: number) => number} [mountInnerY] 卡座吊耳頂端高度（預設 = 殼內面中線）
 * @property {Record<string, string>} src
 */

/** @type {{ id: string, x: number, y: number, z: number }[]} 底盤車殼安裝點（SPEC 1.14） */
const MOUNTS = getPart('chassis-midship').bodyMounts.map((m) => ({ ...m }));

/**
 * 遞增節點的區間與局部參數
 * @type {(xs: number[], x: number) => { k: number, t: number, h: number }}
 */
const bracket = (xs, x) => {
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
};

/** @type {(t: number) => number[]} Hermite 基底 */
const hermite = (t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return [2 * t3 - 3 * t2 + 1, t3 - 2 * t2 + t, -2 * t3 + 3 * t2, t3 - t2];
};

/**
 * 平滑多點剖面曲面（iter-47，body-fork 用；不影響 loft.js 的 createPolySurface）：
 * - 剖面：只有 hard 列出的點是銳利稜線（面板邊界），其餘點用 Catmull-Rom（張力 0.85）平滑通過 → 反光連續、不像低多邊形
 * - 沿 x：中央差分斜率的 Hermite（不做單調限制，站位處不會出現平台與折痕）
 * @type {(stations: { x: number, pts: number[][] }[], opt: { step?: number, tuck?: number, hard: number[] }) => any}
 */
export function createSmoothPolySurface(stations, opt) {
  const step = opt.step ?? 0.5;
  const tuck = opt.tuck ?? 0;
  const st = stations.slice().sort((a, b) => a.x - b.x);
  const sx = st.map((p) => p.x);
  const nPt = st[0].pts.length;
  /** @type {(v: number[]) => number[]} */
  const central = (v) =>
    v.map((_, k) => {
      const a = Math.max(0, k - 1);
      const b = Math.min(v.length - 1, k + 1);
      return (v[b] - v[a]) / (sx[b] - sx[a]);
    });
  /** @type {number[][][]} [點][座標][站] 斜率 */
  const slopes = [];
  for (let i = 0; i < nPt; i++) {
    slopes.push([0, 1].map((c) => central(st.map((p) => p.pts[i][c]))));
  }
  const segLen = [];
  for (let i = 0; i < nPt - 1; i++) {
    let l = 0;
    for (const p of st) {
      l += Math.hypot(p.pts[i + 1][0] - p.pts[i][0], p.pts[i + 1][1] - p.pts[i][1]);
    }
    segLen.push(Math.max(0.5, l / st.length));
  }
  const total = segLen.reduce((a, b) => a + b, 0);
  const brk = [0];
  for (const l of segLen) {
    brk.push(brk[brk.length - 1] + l / total);
  }
  brk[brk.length - 1] = 1;
  const hard = [...new Set([0, nPt - 1, ...opt.hard])].sort((a, b) => a - b);
  /** @type {(i: number) => number[]} 線段 i 所在的平滑區段 [h0, h1] */
  const runOf = (i) => {
    let h0 = 0;
    let h1 = nPt - 1;
    for (const h of hard) {
      if (h <= i) {
        h0 = h;
      }
      if (h > i) {
        h1 = h;
        break;
      }
    }
    return [h0, h1];
  };
  const half = [];
  for (let r = 0; r < hard.length - 1; r++) {
    let n = 0;
    for (let i = hard[r]; i < hard[r + 1]; i++) {
      n += Math.max(3, Math.ceil(segLen[i] / step));
    }
    half.push({ s0: brk[hard[r]], s1: brk[hard[r + 1]], n });
  }
  const panels = [...half.map((p) => ({ s0: -p.s1, s1: -p.s0, n: p.n })).reverse(), ...half];
  /** @type {(x: number) => number[][]} */
  const at = (x) => {
    const { k, t, h } = bracket(sx, x);
    const hb = hermite(t);
    const out = [];
    for (let i = 0; i < nPt; i++) {
      const a = st[k].pts[i];
      const b = st[k + 1].pts[i];
      out.push([0, 1].map((c) => hb[0] * a[c] + hb[1] * h * slopes[i][c][k] + hb[2] * b[c] + hb[3] * h * slopes[i][c][k + 1]));
    }
    return out;
  };
  let cacheX = NaN;
  let cacheP = null;
  const atCached = (x) => {
    if (x !== cacheX) {
      cacheX = x;
      cacheP = at(x);
    }
    return cacheP;
  };
  const xs = [sx[0]];
  for (let k = 0; k < sx.length - 1; k++) {
    const n = Math.max(1, Math.ceil((sx[k + 1] - sx[k]) / step));
    for (let i = 1; i <= n; i++) {
      xs.push(i === n ? sx[k + 1] : sx[k] + ((sx[k + 1] - sx[k]) * i) / n);
    }
  }
  const surf = {
    xMin: sx[0],
    xMax: sx[sx.length - 1],
    xs,
    breaks: brk.slice(1, -1),
    panels,
    profileAt: at,
    ctrl: (x) => {
      const p = atCached(x);
      return { yTop: p[0][1], zF: p[nPt - 3][0], yF: p[nPt - 3][1], halfW: p[nPt - 1][0], yShoulder: p[nPt - 2][1], yLow: p[nPt - 1][1] };
    },
    topY(x, z) {
      const az = Math.abs(z);
      const o = [0, 0];
      let lo = 0;
      let hi = brk[nPt - 2];
      surf.eval(x, hi, o);
      if (az >= o[1]) {
        return o[0];
      }
      for (let it = 0; it < 30; it++) {
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
    },
    eval(x, s, out) {
      const p = atCached(x);
      const u = Math.abs(s);
      let i = 0;
      while (i < nPt - 2 && u > brk[i + 1]) {
        i++;
      }
      const t = (u - brk[i]) / (brk[i + 1] - brk[i]);
      const [h0, h1] = runOf(i);
      /** @type {(j: number) => number[]} 區段外反射外插（中線用鏡射點 → 中線切線水平） */
      const P = (j) => {
        if (j < h0) {
          return h0 === 0 ? [-p[1][0], p[1][1]] : [2 * p[h0][0] - p[h0 + 1][0], 2 * p[h0][1] - p[h0 + 1][1]];
        }
        if (j > h1) {
          return [2 * p[h1][0] - p[h1 - 1][0], 2 * p[h1][1] - p[h1 - 1][1]];
        }
        return p[j];
      };
      let z;
      let y;
      if (h1 - h0 === 1) {
        z = lerp(p[i][0], p[i + 1][0], t);
        y = lerp(p[i][1], p[i + 1][1], t);
      } else {
        const a = P(i - 1);
        const b = P(i + 2);
        const hb = hermite(t);
        const kk = 0.5 * 0.85;
        z = hb[0] * p[i][0] + hb[1] * kk * (p[i + 1][0] - a[0]) + hb[2] * p[i + 1][0] + hb[3] * kk * (b[0] - p[i][0]);
        y = hb[0] * p[i][1] + hb[1] * kk * (p[i + 1][1] - a[1]) + hb[2] * p[i + 1][1] + hb[3] * kk * (b[1] - p[i][1]);
      }
      if (i === nPt - 2 && tuck > 0) {
        const q = Math.max(0, (t - 0.35) / 0.65);
        z -= tuck * q * q;
      }
      out[0] = y;
      out[1] = s < 0 ? -z : z;
    },
  };
  return surf;
}

/**
 * 沿空間曲線掃掠橢圓斷面（尾臂等管狀件）
 * @type {(pts: number[][], n: number, radius: (t: number) => number[], seg?: number) => THREE.BufferGeometry} radius(t) 回傳 [水平半徑（z 向）, 垂直半徑]
 */
export function sweepEllipse(pts, n, radius, seg = 16) {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
  const frames = curve.computeFrenetFrames(n, false);
  const pos = [];
  const rings = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = curve.getPointAt(t);
    const tg = frames.tangents[i];
    // 側向 = 切線 × 上；垂直 = 側向 × 切線（避免 Frenet 扭轉）
    const side = new THREE.Vector3().crossVectors(tg, up).normalize();
    const vert = new THREE.Vector3().crossVectors(side, tg).normalize();
    const [rz, ry] = radius(t);
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg;
      ring.push(c.clone().addScaledVector(side, Math.cos(a) * rz).addScaledVector(vert, Math.sin(a) * ry));
    }
    rings.push(ring);
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < seg; k++) {
      const a = rings[i][k];
      const b = rings[i][(k + 1) % seg];
      const c = rings[i + 1][(k + 1) % seg];
      const d = rings[i + 1][k];
      pos.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    }
  }
  // 端蓋繞向（iter-49 修正）：起點蓋朝後、終點蓋朝前，和側面一致（封閉網格才能用散度定理算體積）
  for (const [ring, flip] of [
    [rings[0], false],
    [rings[n], true],
  ]) {
    const cx = ring.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / seg);
    for (let k = 0; k < seg; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % seg];
      if (flip) {
        pos.push(cx.x, cx.y, cx.z, b.x, b.y, b.z, a.x, a.y, a.z);
      } else {
        pos.push(cx.x, cx.y, cx.z, a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * 薄翼型立板（側視以弦線與厚度分布畫出，沿 z 為厚度方向）：前緣圓、後緣尖的尾鰭
 * 以兩個側面（±thick/2 × 厚度分布）組成；root / tip 為 [x前緣, x後緣, y]
 * opt.pivotY：外傾支點高度（預設鰭根高度；分段上色時各段要用同一支點）；opt.taper：[根部, 鰭頂] 厚度比例（預設 [1, 0.6]）
 * @type {(root: number[], tip: number[], thick: number, zc: number, tiltDeg: number, nc?: number, ns?: number, opt?: { pivotY?: number, taper?: number[] }) => THREE.BufferGeometry}
 */
/** @type {number} 鰭面封蓋要反轉繞向的那一端（0 = 鰭根） */
const CAP_FLIP_J = 0;

export function airfoilFin(root, tip, thick, zc, tiltDeg, nc = 16, ns = 10, opt = {}) {
  const pos = [];
  /** @type {(u: number) => number} NACA 對稱厚度（0–1 弦長，回傳半厚比例，最大 1） */
  const tdist = (u) => (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4) / 0.1;
  const yBase = opt.pivotY ?? root[2];
  const [tp0, tp1] = opt.taper ?? [1, 0.6];
  const tilt = (tiltDeg * Math.PI) / 180;
  /** @type {(i: number, j: number, side: number) => number[]} */
  const P = (i, j, side) => {
    const s = j / ns;
    const xl = lerp(root[0], tip[0], s);
    const xt = lerp(root[1], tip[1], s);
    const y = lerp(root[2], tip[2], s);
    const u = (1 - Math.cos((Math.PI * i) / nc)) / 2;
    const x = lerp(xl, xt, u);
    const zLocal = side * (thick / 2) * tdist(u) * lerp(tp0, tp1, s);
    // 外傾：以鰭根高度為支點繞 x 軸旋轉
    const dy = y - yBase;
    return [x, yBase + dy * Math.cos(tilt) - zLocal * Math.sin(tilt), zc + dy * Math.sin(tilt) + zLocal * Math.cos(tilt)];
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < nc; i++) {
      for (let j = 0; j < ns; j++) {
        const a = P(i, j, side);
        const b = P(i + 1, j, side);
        const c = P(i + 1, j + 1, side);
        const d = P(i, j + 1, side);
        // iter-49 修正：側面繞向改為朝外（原本朝內，和封蓋不一致）
        if (side < 0) {
          pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        } else {
          pos.push(...a, ...c, ...b, ...a, ...d, ...c);
        }
      }
    }
  }
  // 鰭頂與鰭根封面（iter-49 修正：兩端繞向相反，封閉網格才能用散度定理算體積）
  for (const j of [0, ns]) {
    for (let i = 0; i < nc; i++) {
      const a = P(i, j, -1);
      const b = P(i + 1, j, -1);
      const c = P(i + 1, j, 1);
      const d = P(i, j, 1);
      if (j === CAP_FLIP_J) {
        pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      } else {
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * 建立車殼模組
 * @type {(cfg: PolyBodyConfig) => BodyDef & { style: 'homage' | 'race', theme: string }}
 */
export function makePolyBody(cfg) {
  const data = {
    wallThickness_mm: cfg.wallThickness_mm,
    wheelArches: cfg.wheelArches,
    openings: cfg.openings ?? [],
    recesses: cfg.recesses ?? [],
    canopy: cfg.canopy ?? null,
  };
  /** @type {() => BodyPart[]} */
  const compose = () => {
    const surf = cfg.hard
      ? createSmoothPolySurface(cfg.stations, { step: 0.5, tuck: cfg.tuck ?? 0, hard: cfg.hard })
      : createPolySurface(cfg.stations, { step: 0.5, tuck: cfg.tuck ?? 0 });
    const kit = makeLoftKit(data, { mode: 'linear', sideZMin: cfg.sideZMin ?? 26, surface: surf });
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {KeepFn} 座艙底 */
    const cab = (x, y, z) => kit.underCanopy(x, z);
    const zones = cfg.zones(kit);
    // 塗裝分區：第 i 區 = 自己的條件成立且前面各區都不成立（座艙底另外分出）
    zones.forEach((zone, i) => {
      /** @type {KeepFn[]} */
      const fns = [(x, y, z, s) => -cab(x, y, z, s), zone.keep];
      for (let k = 0; k < i; k++) {
        const prev = zones[k].keep;
        fns.push((x, y, z, s) => -prev(x, y, z, s));
      }
      // 最後一區包含其餘所有面，不需要自己的條件
      if (i === zones.length - 1) {
        fns.splice(1, 1);
      }
      parts.push({ geometry: kit.outer(fns), mat: zone.mat, shell: true, name: `shell-${zone.mat}-${i}` });
    });
    if (kit.canopy) {
      parts.push({ geometry: kit.outer([cab]), mat: cfg.mats.cockpit ?? cfg.mats.inner, shell: true, name: 'shell-cockpit' });
    }
    const st = kit.structure();
    // innerSkipRecess（iter-51 新增選項，預設關閉＝原行為）：內面避開凹陷，Blender 雙面算圖時內面不會擋在凹腔前面
    const innerGeo = cfg.innerSkipRecess ? buildRegion(surf, [...kit.holes, kit.notRecess], { offset: -kit.t }).geometry : st.inner;
    parts.push({ geometry: innerGeo, mat: cfg.mats.inner, name: 'shell-inner' });
    parts.push({ geometry: st.rim, mat: cfg.mats.edge, name: 'shell-edge' });
    parts.push({ geometry: mergeGeos([st.capFront, st.capRear]), mat: cfg.mats.cap, shell: true, name: 'caps' });
    parts.push({ geometry: mergeGeos([st.capFrontIn, st.capRearIn]), mat: cfg.mats.inner, name: 'cap-inner' });
    st.recessFloor.forEach((g, i) => parts.push({ geometry: g, mat: cfg.mats.recess ?? cfg.mats.inner, shell: true, name: `recess-floor-${i}` }));
    st.recessWall.forEach((g, i) => parts.push({ geometry: g, mat: cfg.mats.recessWall ?? cfg.mats.recess ?? cfg.mats.inner, shell: true, name: `recess-wall-${i}` }));
    if (kit.canopy && cfg.mats.glass) {
      parts.push({ geometry: buildRegion(kit.canopy, []).geometry, mat: cfg.mats.glass, shell: true, renderOrder: 3, name: 'canopy' });
    }
    if (cfg.extras) {
      parts.push(...cfg.extras(kit));
    }
    const innerY = cfg.mountInnerY ? cfg.mountInnerY(kit) : (x) => kit.innerYAt(x);
    parts.push({ geometry: buildMountTabs(MOUNTS, innerY), mat: cfg.mats.mount, solid: true, name: 'mount-tabs' });
    return parts;
  };
  return {
    id: cfg.id,
    category: 'body',
    style: cfg.style,
    theme: cfg.theme,
    phase: cfg.phase,
    roof: cfg.roof,
    wing: cfg.wing,
    name: cfg.name,
    material: cfg.material,
    density_g_cm3: cfg.density_g_cm3,
    wallThickness_mm: cfg.wallThickness_mm,
    mounts: MOUNTS.map((m) => ({ ...m })),
    build: cachedBuild(compose, cfg.materials),
    src: cfg.src,
  };
}

/**
 * 立板（側視多邊形 (x, y)，沿 z 給厚度，帶小倒角）：鰭片、角、尾鰭
 * @type {(pts: number[][], zc: number, thick: number, tiltDeg?: number) => THREE.BufferGeometry}
 */
export function finPlate(pts, zc, thick, tiltDeg = 0) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const bev = Math.min(0.2, thick / 4);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 });
  g.translate(0, 0, -thick / 2 + bev);
  if (tiltDeg !== 0) {
    // 繞 x 軸外傾（以板底高度為支點）
    const yBase = Math.min(...pts.map((p) => p[1]));
    g.translate(0, -yBase, 0);
    g.rotateX((-tiltDeg * Math.PI) / 180);
    g.translate(0, yBase, 0);
  }
  g.translate(0, 0, zc);
  return g;
}

/**
 * 水平薄板（俯視多邊形 (x, z)，厚度往上）：分流板、尾部橋板
 * @type {(pts: number[][], y: number, thick: number) => THREE.BufferGeometry}
 */
export function flatPlate(pts, y, thick) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/**
 * 座艙內裝：後傾椅背＋駕駛人剪影（頭盔、肩、軀幹），x0 為頭盔位置、deckY 為座艙地板高度
 * @type {(x0: number, deckY: number, scale?: number) => { body: THREE.BufferGeometry, helmet: THREE.BufferGeometry }}
 */
export function buildDriver(x0, deckY, scale = 1) {
  const seat = new THREE.CapsuleGeometry(2.2 * scale, 2 * scale, 4, 12);
  seat.scale(0.35, 1, 1.1);
  seat.rotateZ(0.55);
  seat.translate(x0 - 4 * scale, deckY + 1.4 * scale, 0);
  const shoulders = new THREE.CapsuleGeometry(0.9 * scale, 3.6 * scale, 4, 12);
  shoulders.rotateX(Math.PI / 2);
  shoulders.translate(x0 - 1.6 * scale, deckY + 1.2 * scale, 0);
  const torso = new THREE.CapsuleGeometry(1.2 * scale, 4 * scale, 4, 12);
  torso.rotateZ(Math.PI / 2 - 0.35);
  torso.scale(1, 0.7, 1.4);
  torso.translate(x0 + 1.4 * scale, deckY + 0.5 * scale, 0);
  const helmet = new THREE.SphereGeometry(1.55 * scale, 20, 14);
  helmet.scale(1.12, 1, 0.95);
  helmet.translate(x0, deckY + 2.9 * scale, 0);
  return { body: mergeGeos([seat, shoulders, torso]), helmet };
}
