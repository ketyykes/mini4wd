// 八足神駒斯雷普尼爾（body-sleipnir-stride，第八階段神話組・北歐）：修長、低伏的奔馬身——
// 後段低伏（車尾 27）、臀與肩隆起；iter-114 拿掉背脊升起的細長馬頸（評審：車頭中央像布料擠壓的折痕），
// 改成引擎蓋中線一道圓潤隆起的長馬臉（額頭 40.6、往前下到鼻端），馬臉後端一對立耳、兩側杏仁眼、鼻端兩個鼻孔；
// 座艙罩在中段；耳後沿中線一列銀色短鬃片排到座艙前，座艙後方的背脊再接一道往後升高的銀鬃冠（mane-crest，尾翼，三片束成一束，尾端不超出車尾）。
// 兩側車身在前後輪之間各有 4 條立體浮雕腿（iter-114 由斜條帶改；前一對、後一對成雙排列，共 8 條腿）：
// 奔跑姿勢，上段粗、有膝 / 跗關節與球節、下段細、蹄是深色楔形；腿沿側壁凸出約 0.95 mm，蹄尖略低於側裙、不碰輪胎。
// 配色：上半身斑點灰（亮面）＋淺色小圓斑貼紙、下半身深藍灰（霧面）、腿淺灰（緞面）＋深色蹄、鬃是銀（金屬）；
// 肩線下一道兩股絞繩紋（深色刻線，0.6 mm；不用 Tjängvide 那種像 Valknut 的編織帶、不用任何盧恩）。沒有翅膀（避開天馬意象）、不放騎士。
// 四個 R17.5 輪拱＋輪拱內襯：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-sleipnir-stride/DESIGN.md（MYTH_RESEARCH N9、N10、N11、N12：《散文埃達》灰色八足馬、哥特蘭圖像石）。
// 剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-74, -68, -62, -56, -48, -40, -28, -14, 0, 14, 28, 40, 48, 56, 62, 68, 72, 76];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 背 / 引擎蓋兩側（頸根外）高度：後輪上方的臀部隆起 37.6、腰背凹 33.6、前輪上方的肩部隆起 38，車尾低伏 27、鼻端 26
  yD: monoCurve(XS, [27, 29, 31, 34, 36.2, 36.4, 34, 32.6, 32.8, 33, 34.2, 36.4, 36.8, 36, 34, 31, 29, 26]),
  // 中線頂：x < 28 是背上細脊（背 + 1.2）；iter-114：x 28 起是引擎蓋上的長馬臉隆起（比兩側高 1.2 → 4.6 mm，額頭 x 56 最高 40.6），往前下到鼻端 27.8
  // （iter-113 是升到 51.6 的細長馬頸，和兩側引擎蓋落差 15 mm，從前方看像布料擠壓的折痕）
  yN: monoCurve(XS, [28.2, 30.2, 32.2, 35.2, 37.4, 37.6, 35.2, 33.8, 34, 34.2, 35.4, 38.2, 40.2, 40.6, 39, 35.4, 32.4, 27.8]),
  // 背脊 / 馬臉半寬（馬臉段 7.5 → 10 → 鼻端 4.5）
  nw: monoCurve(XS, [2.4, 2.6, 2.8, 3, 3, 3, 3, 3, 3, 3.2, 4.5, 7.5, 9.5, 10, 9.5, 8, 6.5, 4.5]),
  // 半寬（俯視馬形）：後輪上方的臀部 → 收細的腰腹（36.8，剛好蓋住底盤側面）→ 前輪上方的肩部 → 收成馬頭；車尾收窄（後導輪處 < 35.5）
  // iter-114：臀 / 肩 48.5 → 47.5（車殼外框含擋泥唇半寬 ≤ 48.0）；鼻段改成較緩的連續收窄（原本 x 56 → 68 由 48.5 急收到 21）、車尾收得更窄（俯視輪廓 IoU）
  hw: monoCurve(XS, [15, 17, 22, 40, 47.5, 47.5, 36.8, 36.8, 36.8, 36.8, 36.8, 44.5, 47.5, 45.5, 36.5, 25, 18.5, 11.5]),
  // 側裙下緣：中段 13.6（蓋住底盤側面上半，底盤側框 9.4 以上）；車尾抬高到後上導輪頂（20.5）之上；車頭逐步抬高
  yLow: monoCurve(XS, [22.6, 22, 20.4, 15.5, 13.4, 13.2, 13.6, 13.6, 13.6, 13.6, 13.6, 13.2, 13.4, 14, 14.8, 17, 18.2, 19.2]),
};

/** @type {(x: number) => number} 臀 / 肩隆起係數（半寬 37 → 47.5 對應 0 → 1） */
const podAt = (x) => Math.min(1, Math.max(0, (P.hw(x) - 37) / 10.5));
/** @type {(x: number) => number} 側面腰線（上半身斑點灰與下半身深藍灰的分界、側壁頂）：臀 / 肩隆起處往下多 2.5 mm（圓鼓的葉子板） */
const ySideAt = (x) => P.yD(x) - 6.5 - 2.5 * podAt(x);

/**
 * 半剖面 9 點：中線頂 → 脊 / 馬臉頂 → 脊 / 馬臉側 → 融進背 / 引擎蓋 → 背肩 → 肩外圓 → 腰線（銳利）→ 側壁 → 側裙下緣（內收）
 * iter-114：馬臉段改成圓潤隆起（不再有脊 / 頸側稜的銳利稜線）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yN = P.yN(x);
  const yD = P.yD(x);
  const hw = P.hw(x);
  const yS = ySideAt(x);
  const yLow = Math.min(P.yLow(x), yS - 2);
  const nw = Math.min(P.nw(x), 0.3 * hw);
  const h = Math.max(0.1, yN - yD);
  return [
    [0, yN],
    [0.45 * nw, yN - 0.15 * h],
    [0.85 * nw, yN - 0.55 * h],
    [nw + 2, yD + 0.08 * h],
    [Math.max(nw + 3.2, 0.72 * hw), yD - 2.2],
    [hw - 1.2, yS + 1.5],
    [hw, yS],
    [hw, lerp(yS, yLow, 0.45)],
    [hw - 1.4, yLow],
  ];
};

// 馬頸與馬頭段每 0.5 mm 一站（曲率大），其餘每 2 mm
const STATIONS = [...buildStations(-74, 24, 2, profile).slice(0, -1), ...buildStations(24, 76, 0.5, profile)];

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（側視，31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5 },
  { x: -40, y: 13, radius: 17.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number) => number} 座艙罩半寬（x −32 → 8；罩外為 −1） */
const canopyHalfW = (x) => {
  if (x <= -32 || x >= 8) {
    return -1;
  }
  const u = (8 - x) / 40;
  return 12.5 * Math.sin(Math.PI * u ** 0.85) ** 0.55;
};

/** 座艙罩（中段，橢圓斷面） */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(8, -32, u);
      const halfW = i === 0 || i === n ? 2.5 : canopyHalfW(x);
      const rise = 9.4 * Math.sin(Math.PI * u ** 0.8) ** 0.6;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/**
 * 八條腿（iter-114：每側 4 條立體浮雕腿，前一對、後一對成雙；奔跑姿勢）：側視折線 [x, y]（腿根 → 膝 / 跗 → 球節 → 蹄），dir 為蹄尖方向（+1 往前）
 * 前腿：外側那條往前伸、內側那條收在身下；後腿：一條踏在身下、一條往後蹬；蹄離前後輪拱切口 ≥ 1.4 mm
 * @type {{ pts: number[][], dir: number }[]}
 */
const LEGS = [
  { pts: [[15, 25.2], [18.6, 19.6], [19.6, 15], [19, 13.4]], dir: 1 },
  { pts: [[10.5, 25.2], [12.4, 19.4], [10.4, 15.2], [8.8, 13.9]], dir: 1 },
  { pts: [[-10, 25.2], [-8.2, 20.6], [-11.4, 16.6], [-9.8, 13.6]], dir: 1 },
  { pts: [[-14.8, 25.2], [-15.4, 20.6], [-18.8, 17.2], [-19.4, 14.2]], dir: -1 },
];

/** @type {(x: number, z: number) => boolean} 側壁（腰線以下的垂直面與內收下緣） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 1.45;
/** @type {(x: number, y: number) => boolean} 下半身（腰線以下） */
const isLower = (x, y) => y < ySideAt(x) + 0.05;

/** 斑點灰的圓斑格距（偽隨機分布） */
const DAPPLE_CELL = 5.6;

/**
 * 雜湊（0–1）
 * @type {(i: number, j: number, k: number) => number}
 */
const hash = (i, j, k) => {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * 斑點灰（dapple）：淺色小圓環（外徑 1.1–1.8、環寬 0.6），越往車頭越稀（x > 30 起機率遞減、頸與頭不畫），
 * 用 (x, |z| + 0.6 y) 平面分布，頂面與側肩都有
 * @type {(x: number, y: number, z: number) => number} 正值 = 環內
 */
const dappleRing = (x, y, z) => {
  const v = Math.abs(z) + 0.6 * y;
  const i0 = Math.floor(x / DAPPLE_CELL);
  const j0 = Math.floor(v / DAPPLE_CELL);
  let best = -Infinity;
  for (let i = i0 - 1; i <= i0 + 1; i++) {
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const cx = (i + 0.2 + 0.6 * hash(i, j, 1)) * DAPPLE_CELL;
      const keep = Math.min(1, Math.max(0, (36 - cx) / 30));
      if (hash(i, j, 4) > 0.25 + 0.75 * keep) {
        continue;
      }
      const cv = (j + 0.2 + 0.6 * hash(i, j, 2)) * DAPPLE_CELL;
      const r = 1.1 + 0.7 * hash(i, j, 3);
      best = Math.max(best, 0.3 - Math.abs(Math.hypot(x - cx, v - cv) - r));
    }
  }
  return best;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 斑點灰（上半身，亮面：少數亮面部位）
  grey: namedMaterial('paint-dapple-grey', { color: 0x9aa0a6, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
  // 深藍灰（下半身、鼻端，霧面）
  slate: namedMaterial('paint-slate-bluegrey', { color: 0x37455a, roughness: 0.62, clearcoat: 0.05 }),
  slate2: namedMaterial('paint-slate-bluegrey', { color: 0x37455a, roughness: 0.62, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 腿：淺灰（緞面；iter-113 是石灰岩米白斜條帶，評審看成綁帶）、蹄：深色緞面
  leg: namedMaterial('paint-leg-greylight', { color: 0xb3b8be, roughness: 0.55, clearcoat: 0.1 }),
  hoof: namedMaterial('paint-hoof-dark', { color: 0x24272c, roughness: 0.55, clearcoat: 0.15 }),
  // 馬眼 / 鼻孔：深色亮面（眼是全車少數亮面）
  eye: namedMaterial('paint-eye-gloss-black', { color: 0x101114, roughness: 0.15, clearcoat: 1.0 }),
  // 銀鬃（真金屬：名稱含 -steel）
  silver: namedMaterial('trim-silver-steel', { color: 0xc4c8cc, roughness: 0.3, metalness: 0.78, clearcoat: 0.2, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1d22, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-slate', { color: 0x2b3442, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x1a1d22, roughness: 0.85, side: THREE.DoubleSide }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x26303c, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-slate', { color: 0x2e3744, roughness: 0.75, side: THREE.DoubleSide }),
  dSpot: decalMaterial('decal-dapple-light', { color: 0xd3d6d9, roughness: 0.45 }),
  dIncise: decalMaterial('decal-incised-dark', { color: 0x2a313b, roughness: 0.6 }),
  dStone: decalMaterial('decal-limestone', { color: 0xd8d1c1, roughness: 0.7 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯：輪拱切口後面的上半圈圓柱面（半徑 = 輪拱半徑 + 0.3），z 從殼內面往內 3.5 mm（最深到 |z| 25.5）；
 * 外側界限 = 側壁內面與「殼面高度 ≥ 內襯高度 + 0.9」兩者較小者（不穿出肩部曲面）
 * @type {(kit: any, arch: { x: number, y: number, radius: number }) => THREE.BufferGeometry}
 */
const buildLiner = (kit, arch) => {
  /** @type {number} 內襯從外側往內的深度（只遮住從輪拱斜看進去的殼內空腔，不做整圈輪室，省質量） */
  const LINER_DEPTH = 3.5;
  const r = arch.radius + 0.3;
  const n = 44;
  const a0 = 0.1;
  const a1 = Math.PI - 0.1;
  const zInner = 25.5;
  /** @type {(t: number) => number} 該角度內襯的外側 z */
  const zOuter = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    const zSide = P.hw(x) - 1.0;
    if (kit.surf.topY(x, zSide) >= y + 0.9) {
      return zSide;
    }
    let lo = zInner;
    let hi = zSide;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (kit.surf.topY(x, m) >= y + 0.9) {
        lo = m;
      } else {
        hi = m;
      }
    }
    return Math.max(zInner + 0.5, lo);
  };
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const o0 = zOuter(t0);
      const o1 = zOuter(t1);
      const A = p(t0, Math.max(zInner, o0 - LINER_DEPTH));
      const B = p(t1, Math.max(zInner, o1 - LINER_DEPTH));
      const C = p(t1, o1);
      const D = p(t0, o0);
      // 法線朝輪心
      if (sg > 0) {
        pos.push(...A, ...C, ...B, ...A, ...D, ...C);
      } else {
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 一束鬃（側視多邊形）：鬃根在中線頂 x = a（根部往下埋 1 mm），往後順梳成細長刀形，鬃尖在 (a − len, 中線頂 + h)，上緣微拱
 * @type {(a: number, len: number, h: number) => number[][]}
 */
const maneStrand = (a, len, h) => [
  [a, P.yN(a) - 1],
  [a - 0.2, P.yN(a) + 0.7],
  [a - 0.45 * len, P.yN(a - 0.45 * len) + 0.92 * h],
  [a - len, P.yN(a - len) + h],
  [a - 0.55 * len, P.yN(a - 0.55 * len) + 0.42 * h],
  [a - 2.6, P.yN(a - 2.6) - 1],
];

/**
 * 一列鬃束（沿中線頂從 x1 往後到 x0，每 step 一束，彼此交疊）
 * @type {(x1: number, x0: number, step: number, len: number, h: (x: number) => number, zc: number, thick: number, tiltDeg: number) => THREE.BufferGeometry}
 */
const maneRow = (x1, x0, step, len, h, zc, thick, tiltDeg) => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (let a = x1; a >= x0 - 1e-6; a -= step) {
    geos.push(finPlate(maneStrand(a, len, h(a)), zc, thick, tiltDeg));
  }
  return mergeGeos(geos);
};

/**
 * 側壁外表面的 |z|（腰線以下）：垂直段 = 半寬，側壁中段以下往內收 1.4 mm 到側裙下緣（和 profile 的最後兩點一致，近似）
 * @type {(x: number, y: number) => number}
 */
const sideWallZ = (x, y) => {
  const hw = P.hw(x);
  const yS = ySideAt(x);
  const yLow = Math.min(P.yLow(x), yS - 2);
  const yMid = lerp(yS, yLow, 0.45);
  if (y >= yMid) {
    return hw;
  }
  return hw - 1.4 * Math.min(1, (yMid - y) / Math.max(0.5, yMid - yLow));
};

/**
 * 浮雕管（iter-114 八條腿）：沿側視折線 [x, y] 掃掠扁橢圓斷面——斷面在「切線 ⟂ 平面」內，寬 w(t)（側視看到的腿粗）、
 * 厚 d(t)（往車外凸），中心 |z| = zAt(x, y)；首尾封蓋成封閉網格，最後依有號體積統一繞向朝外（質量用散度定理）
 * @type {(pts: number[][], n: number, w: (t: number) => number, d: (t: number) => number, zAt: (x: number, y: number) => number, sg: number, seg?: number) => THREE.BufferGeometry}
 */
const reliefTube = (pts, n, w, d, zAt, sg, seg = 12) => {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  /** @type {THREE.Vector3[][]} */
  const rings = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const nx = -tg.y;
    const ny = tg.x;
    const zc = sg * zAt(c.x, c.y);
    /** @type {THREE.Vector3[]} */
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg;
      ring.push(new THREE.Vector3(c.x + nx * Math.cos(a) * w(t), c.y + ny * Math.cos(a) * w(t), zc + sg * Math.sin(a) * d(t)));
    }
    rings.push(ring);
  }
  /** @type {THREE.Vector3[][]} 三角形 */
  const tris = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < seg; k++) {
      const a = rings[i][k];
      const b = rings[i][(k + 1) % seg];
      const c = rings[i + 1][(k + 1) % seg];
      const e = rings[i + 1][k];
      tris.push([a, e, c], [a, c, b]);
    }
  }
  for (const [ring, flip] of [[rings[0], false], [rings[n], true]]) {
    const cen = ring.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / seg);
    for (let k = 0; k < seg; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % seg];
      tris.push(flip ? [cen, b, a] : [cen, a, b]);
    }
  }
  // 有號體積 < 0 → 整體翻轉繞向
  let vol = 0;
  for (const [a, b, c] of tris) {
    vol += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
  }
  /** @type {number[]} */
  const pos = [];
  for (const [a, b, c] of tris) {
    if (vol >= 0) {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    } else {
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-sleipnir-stride',
  name: '八足神駒',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'sleipnir',
  form: 'strider',
  roof: 'canopy',
  wing: 'mane-crest',
  theme: '修長低伏的奔馬身：引擎蓋中線圓潤隆起的長馬臉（立耳、杏仁眼、鼻孔）、中段座艙罩、耳後銀色頸鬃與往後升高的鬃冠尾翼；兩側前後輪之間各 4 條奔跑姿勢的立體浮雕腿（關節、深色蹄，共 8 條腿）、斑點灰上身＋深藍灰下身',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面：只有腰線（6）是銳利稜線（iter-114 拿掉脊 / 頸側稜，馬臉是圓潤隆起）
  hard: [6],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 30 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 30 },
  ],
  canopy: CANOPY,
  // 座艙罩底下的殼面開口（罩緣內 0.8 mm）：透過煙燻罩看得到底盤，也不讓罩底多一層殼面
  openings: [{ id: '座艙罩底開口', shape: 'fn', sd: (x, y, z) => (y < 30 ? 10 : Math.abs(z) - (canopyHalfW(x) - 0.8)) }],
  sideZMin: 30,
  zones: () => [
    // 鼻端深藍灰
    { mat: 'slate', keep: (x) => x - 73.2 },
    // 下半身（腰線以下）深藍灰
    { mat: 'slate', keep: (x, y) => (isLower(x, y) ? 1 : -1) },
    // 上半身斑點灰
    { mat: 'grey', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'slate', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];

    // ── 頸鬃（iter-114）：從兩耳之間沿中線（x 46 → 17）每 3.2 mm 一束、彼此交疊的細長刀形鬃，往後順梳 7 mm，鬃高 2.4 → 3.0 mm（厚 1.3，根部埋進殼面 1 mm），停在座艙罩前 ──
    parts.push({
      geometry: maneRow(46, 17, 3.2, 7, (x) => lerp(2.4, 3.0, (x - 17) / 29), 0, 1.3, 0),
      mat: 'silver',
      solid: true,
      outline: true,
      name: 'neck-mane',
    });
    // ── 鬃冠尾翼（mane-crest）：座艙後方背脊（x −34 → −72）三列交疊的長鬃束（中列 + 兩側外傾 16° 的短列），往後越來越高（中列最高約 8.6 mm），鬃尖往後順梳、不超出車尾 ──
    {
      /** @type {(x: number) => number} 鬃冠高度：前端 1.6 → x −62 起 8.6 */
      const crestH = (x) => lerp(1.6, 8.6, Math.pow(Math.min(1, (-34 - x) / 28), 1.2));
      parts.push({
        geometry: mergeGeos([
          maneRow(-34, -62, 4, 10, crestH, 0, 1.3, 0),
          maneRow(-44, -58, 7, 9, (x) => 0.68 * crestH(x), -1.9, 1.1, 16),
          maneRow(-44, -58, 7, 9, (x) => 0.68 * crestH(x), 1.9, 1.1, -16),
        ]),
        mat: 'silver',
        solid: true,
        outline: true,
        name: 'mane-crest-wing',
      });
    }

    // ── 八條腿（每側 4 條立體浮雕腿）：扁橢圓斷面沿腿線掃掠（上段寬 3.0 → 下段 1.7 mm、外凸約 0.95 mm），膝 / 跗與球節是略大的關節球，蹄是深色楔形 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const legs = [];
      /** @type {THREE.BufferGeometry[]} */
      const hooves = [];
      for (const sg of [-1, 1]) {
        for (const leg of LEGS) {
          legs.push(reliefTube(leg.pts, 28, (t) => lerp(1.5, 0.85, Math.min(1, t * 1.6)), () => 1.15, (x, y) => sideWallZ(x, y) - 0.2, sg));
          // 關節：膝 / 跗（第 2 點）、球節（第 3 點）
          for (const [k, r] of [[1, 1.2], [2, 1.0]]) {
            const [jx, jy] = leg.pts[k];
            const j = new THREE.SphereGeometry(1, 14, 10);
            j.scale(r, r, 1.1);
            j.translate(jx, jy, sg * (sideWallZ(jx, jy) - 0.2));
            legs.push(j.toNonIndexed());
          }
          // 蹄：側視梯形（底寬 2.8、高 2，前緣斜），厚 2.0
          const [hx, hy] = leg.pts[leg.pts.length - 1];
          const d = leg.dir;
          const hoofPts = [
            [hx - 1.3 * d, hy - 1.1],
            [hx + 1.6 * d, hy - 1.1],
            [hx + 0.8 * d, hy + 0.9],
            [hx - 1.0 * d, hy + 0.9],
          ];
          hooves.push(finPlate(d > 0 ? hoofPts : hoofPts.reverse(), sg * (sideWallZ(hx, hy) - 0.2), 2.0));
        }
      }
      parts.push({ geometry: mergeGeos(legs), mat: 'leg', solid: true, outline: true, name: 'eight-legs' });
      parts.push({ geometry: mergeGeos(hooves), mat: 'hoof', solid: true, outline: true, name: 'hooves' });
    }

    // ── 馬耳（iter-114）：馬臉後端一對往後微傾的立耳（側視葉形，厚 1.6 mm、0.2 mm 倒角，外張 12°），耳根埋進殼面 1 mm ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const ears = [];
      for (const sg of [-1, 1]) {
        const ex = 47.5;
        const ez = 4.6;
        const y0 = kit.surf.topY(ex, ez) - 1;
        const pts = [
          [ex + 2.2, y0],
          [ex + 1.4, y0 + 3.4],
          [ex - 0.6, y0 + 6.2],
          [ex - 1.4, y0 + 4.6],
          [ex - 2.0, y0],
        ];
        ears.push(finPlate(pts, sg * ez, 1.6, sg * 12));
      }
      parts.push({ geometry: mergeGeos(ears), mat: 'grey', solid: true, outline: true, name: 'horse-ears' });
    }
    // ── 馬眼與鼻孔（iter-114，貼紙）：馬臉兩側杏仁眼（長 4.4、寬 2.0，外眼角往後上挑）；鼻端兩個斜橢圓鼻孔 ──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < P.yD(x) - 0.3) {
          return -1;
        }
        const az = Math.abs(z);
        const u = (x - 58.5) * Math.cos(0.35) + (az - 9.6) * Math.sin(0.35);
        const v = -(x - 58.5) * Math.sin(0.35) + (az - 9.6) * Math.cos(0.35);
        return 1 - Math.hypot(u / 2.2, v / 1.0);
      }, { offset: 0.1 }),
      mat: 'eye',
      name: 'decal-horse-eyes',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        return 1 - Math.hypot((x - 73.6) / 0.85, (az - 2.6) / 0.55);
      }, { offset: 0.1 }),
      mat: 'eye',
      name: 'decal-nostrils',
    });

    // 輪拱內襯（前後，31 mm 大輪拱）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(kit, a))), mat: 'liner', shell: true, name: 'arch-liners' });
    // 輪拱擋泥唇（深藍灰細唇 R0.55，沿側壁上的輪拱切口）
    {
      /** @type {THREE.BufferGeometry[]} */
      const lips = [];
      for (const arch of ARCHES) {
        for (const sg of [-1, 1]) {
          /** @type {number[][]} */
          const pts = [];
          const r = arch.radius + 0.5;
          for (let i = 0; i <= 64; i++) {
            const t = 0.02 + ((Math.PI - 0.04) * i) / 64;
            const x = arch.x + r * Math.cos(t);
            const y = arch.y + r * Math.sin(t);
            if (y < P.yLow(x) + 2.5 || y > ySideAt(x) - 0.4) {
              continue;
            }
            pts.push([x, y, sg * (P.hw(x) - 0.3)]);
          }
          if (pts.length > 3) {
            lips.push(sweepEllipse(pts, 60, () => [0.55, 0.55], 10));
          }
        }
      }
      parts.push({ geometry: mergeGeos(lips), mat: 'slate2', solid: true, outline: true, name: 'arch-lips' });
    }

    // ── 貼紙 ──
    // 斑點灰：上半身淺色小圓環（後半身密、往前漸稀；避開馬頸、馬頭、背脊與座艙）
    parts.push({
      geometry: kit.decal((x, y, z) => (!isLower(x, y) && x < 44 && Math.abs(z) > P.nw(x) + 1.4 && kit.underCanopy(x, z) < 0 ? dappleRing(x, y, z) : -1)),
      mat: 'dSpot',
      name: 'decal-dapple-spots',
    });
    // 兩股絞繩紋（深色刻線 0.6 mm）：腰線上方 1.8 mm 沿肩走，兩條相位差半週期的正弦
    /** @type {(u: number, v: number) => number} u = 往車頭為正的 x */
    const cable = (u, v) => {
      const yc = ySideAt(u) + 1.9;
      const a = 0.75;
      const k = (2 * Math.PI) / 5.2;
      const d1 = Math.abs(v - (yc + a * Math.sin(k * u)));
      const d2 = Math.abs(v - (yc - a * Math.sin(k * u)));
      return Math.max(Math.min(d1, d2) - 0.3, u - 58, -62 - u, 1.2 - archRingDist(u, v));
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(cable, { x0: 0, y0: 0, zMin: 30, side: 1 })),
        kit.decal(sideDecal((u, v) => cable(-u, v), { x0: 0, y0: 0, zMin: 30, side: -1 })),
      ]),
      mat: 'dIncise',
      name: 'decal-cable-band',
    });
    // 圖像石框線：側壁下緣上方一道石灰岩色細線（0.7 mm），避開輪拱與腿
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        // iter-114：前後輪之間是浮雕腿，框線只留在前後懸（不從腿中間穿過）
        return Math.min(0.35 - Math.abs(y - (P.yLow(x) + 3.2)), archRingDist(x, y) - 1.4, x + 64, 66 - x, Math.abs(x) - 23);
      }),
      mat: 'dStone',
      name: 'decal-frame-line',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：殼 x −74 → 76（鬃冠尖 −74.1）、背 27（車尾）→ 臀 36.4 / 腰 32.6 / 肩 36.8、馬臉額頭 40.6（iter-114，原馬頸頂 51.6 拿掉）、座艙罩頂約 44；半寬：臀與肩 47.5（iter-114，原 48.5）、腰 36.8（蓋住輪胎與底盤側面）；SPEC 1.14a 車殼外框長 ≤ 153 mm、半寬 ≤ 48.0',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin / trojan），cutZFrom 30；輪拱內襯從側壁內面往內 3.5 mm；深藍灰擋泥唇 R0.55',
    legs: '八條腿：《散文埃達》「he has eight feet」（MYTH_RESEARCH N12）、哥特蘭圖像石的八足馬（N9、N10、N11）；iter-114 改成每側 4 條立體浮雕腿（扁橢圓斷面寬 3.0 → 1.7、厚 2.3 mm、外凸約 0.95 mm 的實心 ABS 掃掠件＋關節球＋厚 2 mm 楔形蹄），前一對、後一對成雙、奔跑姿勢；蹄底 y 12.3–13.1（高於底盤側框 9.4），位置與姿勢自創',
    mane: '頸鬃與鬃冠尾翼為實心 ABS 刀形鬃束板（厚 1.1–1.3 mm，鬃束彼此交疊處體積重複計入，偏保守），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    color: '灰色：原典「grey foal with eight legs」（N12）；斑點、藍灰、銀、淺灰腿、深色蹄為自創（iter-113 的石灰岩米白腿改掉）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 也會傳遞 mythSeries / mythTheme；這裡再補一次，和其他神話款一致
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const sleipnirStrideBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
