// 伊什塔爾城門的穆修胡修（body-mushussu-gate，神話組・美索不達米亞）：一台低矮流線的比賽用車殼（不做方塊城牆）——
// 楔形的細長頸鼻、座艙段的低駝峰、車尾收尾、前後輪上方微鼓的翼子板與 R17.5 輪拱，側裙一路包到底盤側框（不露電池管）；
// 城門的語彙全部移到表面：青金石藍釉磚（錯縫磚縫）、側牆上下兩道黃釉磚邊框（黑細線）、車頂中線一列白瓣金心的玫瑰花飾賽車條紋、
// 側牆中段的黃釉穆修胡修浮雕（鱗片、頭上的角與冠、獅爪前腳、鷹爪後腳、往上捲的蝎尾；實體件凸出 0.9 mm）、
// 頸鼻頂面的黃釉蛇首與一對金色導流角、輪拱黃釉拱框；城垛只留在車尾後掠雙層翼兩側的階梯城垛形端板（crenel-tail）。
// 設計：shared/design/body-mushussu-gate/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 4 節 M1–M5；黑名單 4-3、第 9 節 Dragon Jr. / Beat-Magnum）。剖面為本檔站位產生器（推估）。
// 配色取自 M2 / 4-2（青金石釉藍、黃釉、黑白金邊框與玫瑰花飾）；圖形全部自繪；不做龍頭車身、不放龍形駕駛、不做紅龍徽章、玫瑰花飾只用圓瓣（不做放射閃電）；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾封口 x */
const X_REAR = -72;
/** @type {number} 車頭（鼻端封口）x（往前伸出細長的頸鼻） */
const X_FRONT = 74;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-72, -68, -60, -50, -40, -28, -14, 0, 14, 28, 40, 48, 55, 60, 66, 70, 74];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：前後輪上方微鼓的翼子板 44、腰 41；長尾（後軸往後 32 mm 的長尾段收到 22，尾翼架在上面）；
  // 前輪拱之後收成細長的頸鼻（穆修胡修的長頸蛇首，x 60 → 74 半寬 22 → 6.5）
  hw: monoCurve(XS, [22, 28, 33.5, 40, 44, 42.5, 41.5, 41, 41.5, 42.5, 44, 40.5, 31, 22, 13.5, 9.5, 6.5]),
  // 中線殼頂：座艙段低駝峰 34.6（x 0），往後緩降成長尾（25）；
  // 車頭到座艙是一條連續斜面，一路下到頸鼻尖 15.4（LG1 低尖鼻 V3）
  yTop: monoCurve(XS, [25, 26.5, 28.4, 30, 31.2, 32.9, 34.2, 34.6, 33.9, 32, 29.8, 27.3, 24.6, 22.4, 19.6, 17.6, 15.4]),
  // 肩稜線（頂面與側牆交界，銳利）：輪上 30、腰 28.5（R17.5 輪拱頂 30.5 切進肩線，俯視在四個輪位留下缺口，同 kitsune 做法）
  yS: monoCurve(XS, [22.5, 24, 26.2, 28.4, 30, 29.5, 28.5, 28.5, 28.8, 29.6, 29.4, 26.6, 23.2, 20.6, 17.8, 16.2, 14.4]),
  // 側裙下緣（腰段 10.5，loft 自動讓開底盤側框）
  yLow: monoCurve(XS, [16, 15.5, 14.5, 12.5, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11.5, 13, 13.4, 13, 12.8, 12.8]),
};

/** @type {number} 側牆往下的外張量（牆腳比肩線外 0.6 mm） */
const FLARE = 0.6;

/**
 * 半剖面 7 點：中線 → 微圓的頂面 → 肩稜線（銳利）→ 幾乎直立的側牆（浮雕、花飾帶的牆面）→ 側裙下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  const d = t - s;
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [h + FLARE / 2, lerp(s, lo, 0.5)],
    [h + FLARE, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與鼻端每 0.75 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -62, 0.75, profile).slice(0, -1), ...buildStations(-62, 52, 2, profile).slice(0, -1), ...buildStations(52, X_FRONT, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/**
 * 側牆外表面在 (x, y) 的 |z|（肩線 → 牆腳線性外張）
 * @type {(x: number, y: number) => number}
 */
const wallZ = (x, y) => {
  const s = P.yS(x);
  const t = Math.min(1, Math.max(0, (s - y) / (s - P.yLow(x))));
  return P.hw(x) + FLARE * t;
};

/** @type {(x: number, y: number, z: number) => boolean} 側牆（肩線以下、靠近側牆外表面） */
const onSideWall = (x, y, z) => y < P.yS(x) + 0.05 && Math.abs(z) > wallZ(x, y) - 0.35 && x > X_REAR + 1.5 && x < X_FRONT - 1.5;

/** @type {(x: number) => number} 上緣黃釉磚邊框的上 / 下緣（肩線下 0.5 → 2.1） */
const topBandHi = (x) => P.yS(x) - 0.5;
/** @type {(x: number) => number} */
const topBandLo = (x) => P.yS(x) - 2.1;
/** @type {(x: number) => number} 下緣黃釉磚邊框（牆腳黑帶 1.6 之上，高 1.4） */
const lowBandLo = (x) => P.yLow(x) + 1.6;
/** @type {(x: number) => number} */
const lowBandHi = (x) => P.yLow(x) + 3.0;

/** @type {{ x0: number, y0: number, s: number }} 穆修胡修浮雕的位置與縮放（腰段側牆中段，側視；腳底 y0） */
const BEAST = { x0: 0.6, y0: 13.9, s: 0.74 };

/** @type {(u: number, v: number, ax: number, ay: number, bx: number, by: number, r: number) => number} 圓頭線段（膠囊）距離 */
const capsule = (u, v, ax, ay, bx, by, r) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - ax - t * dx, v - ay - t * dy) - r;
};

/**
 * 穆修胡修側身（照伊什塔爾城門釉磚浮雕畫，M1 / M2）：水平細長鱗身、往前上斜的 S 形長頸、
 * 水平蛇頭＋往後的直角＋頭後捲起的冠、分岔蛇信；前足獅腿（一前一後的步態、圓掌）、後足鷹腿（粗腿、細脛、三爪）；
 * 長尾先水平往後、尾端才往上捲成蝎尾鉤刺。u 往車頭、v 往上，腳底 v = 0；未縮放時長約 34、高約 17 mm
 * @type {number[][]} [ax, ay, bx, by, r]
 */
const BEAST_SEGS = [
  // 軀幹（細長、後粗前細）
  [-8.4, 8.6, -1.0, 8.8, 2.0],
  [-1.0, 8.8, 4.6, 9.4, 1.8],
  // 長頸（往前上斜的 S 形）
  [4.6, 9.8, 7.4, 12.0, 1.45],
  [7.4, 12.0, 8.8, 13.8, 1.25],
  // 蛇頭（水平、比頸粗）＋吻
  [8.6, 14.2, 12.6, 14.0, 1.3],
  [12.6, 14.0, 14.6, 13.5, 0.8],
  // 頭上往後的直角、頭後捲起的冠
  [10.0, 15.3, 6.6, 16.6, 0.5],
  [9.0, 15.0, 7.9, 16.0, 0.42],
  [7.9, 16.0, 7.3, 15.3, 0.34],
  // 分岔蛇信
  [14.6, 13.5, 16.2, 14.0, 0.3],
  [14.6, 13.5, 16.1, 12.8, 0.3],
  // 前足（獅）：前腳往前邁、後腳垂直；圓掌
  [3.8, 8.0, 5.6, 3.6, 1.15],
  [5.6, 3.6, 6.0, 1.0, 0.75],
  [5.2, 0.75, 7.6, 0.75, 0.75],
  [2.0, 8.0, 1.4, 3.6, 1.05],
  [1.4, 3.6, 1.6, 1.0, 0.7],
  [0.8, 0.7, 3.0, 0.7, 0.7],
  // 後足（鷹）：粗腿、細脛、三爪（兩前一後）
  [-6.0, 8.2, -4.9, 4.0, 1.35],
  [-4.9, 4.0, -5.6, 1.4, 0.55],
  [-5.6, 1.2, -3.2, 0.35, 0.45],
  [-5.6, 1.2, -4.7, 0.1, 0.45],
  [-5.6, 1.2, -7.6, 0.45, 0.45],
  [-8.4, 8.0, -9.0, 4.0, 1.3],
  [-9.0, 4.0, -9.6, 1.4, 0.5],
  [-9.6, 1.2, -7.4, 0.35, 0.42],
  [-9.6, 1.2, -8.8, 0.1, 0.42],
  [-9.6, 1.2, -11.5, 0.45, 0.42],
  // 長尾：水平往後 → 尾端往上捲 → 鉤狀蝎刺
  [-10.2, 8.6, -14.0, 9.0, 1.15],
  [-14.0, 9.0, -16.6, 10.6, 0.9],
  [-16.6, 10.6, -17.4, 13.0, 0.68],
  [-17.4, 13.0, -16.6, 14.6, 0.48],
  [-16.6, 14.6, -15.4, 14.6, 0.34],
];

/** @type {(u: number, v: number) => number} 穆修胡修輪廓距離（未縮放座標） */
const beastSdRaw = (u, v) => {
  let d = Infinity;
  for (const s of BEAST_SEGS) {
    d = Math.min(d, capsule(u, v, s[0], s[1], s[2], s[3], s[4]));
  }
  return d;
};

/** @type {(x: number, y: number, z: number) => number} 穆修胡修在車殼側牆上的距離（只在腰段側牆） */
const beastAt = (x, y, z) => {
  if (Math.abs(z) < 30 || Math.abs(x) > 18) {
    return 10;
  }
  return beastSdRaw((x - BEAST.x0) / BEAST.s, (y - BEAST.y0) / BEAST.s) * BEAST.s;
};

/**
 * 玫瑰花飾（M2：白瓣金心的圓瓣花，不做放射線）：中心圓 r 0.7、8 片圓瓣 r 0.62 繞半徑 1.42（直徑約 4.1）
 * @type {(u: number, v: number) => { petal: number, core: number }}
 */
const rosetteSd = (u, v) => {
  const core = Math.hypot(u, v) - 0.7;
  let petal = Infinity;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    petal = Math.min(petal, Math.hypot(u - 1.42 * Math.cos(a), v - 1.42 * Math.sin(a)) - 0.62);
  }
  return { petal: Math.max(petal, -core - 0.22), core };
};

/**
 * 磚縫（橫向錯縫）：每層高 4、磚長 8，上下層錯半塊；線寬 0.6（正值 = 磚縫上）
 * @type {(a: number, y: number) => number} a = 沿牆面的水平座標
 */
const brickJoint = (a, y) => {
  const course = 4;
  const len = 8;
  const j = Math.floor((y - 1) / course);
  const ph = (((y - 1) % course) + course) % course;
  const dh = Math.min(ph, course - ph);
  const shift = (((j % 2) + 2) % 2) * (len / 2);
  const pa = (((a - shift) % len) + len) % len;
  const dv = Math.min(pa, len - pa);
  return 0.3 - Math.min(dh, dv);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 青金石藍釉磚（亮面釉：roughness ≤ 0.4）
  lapis: namedMaterial('paint-lapis-glaze', { color: 0x1f4e9c, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
  lapis2: namedMaterial('paint-lapis-glaze', { color: 0x1f4e9c, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.15, side: THREE.DoubleSide }),
  // 牆腳瀝青黑（霧面；新巴比倫以瀝青作砌磚灰漿，推估）
  bitumen: namedMaterial('paint-bitumen-black-matte', { color: 0x1a1a1a, roughness: 0.72, clearcoat: 0.05 }),
  // 黃釉（穆修胡修浮雕）
  yellow: namedMaterial('paint-yellow-glaze', { color: 0xd9a441, roughness: 0.36, clearcoat: 0.6 }),
  // 未上釉的日曬泥磚（城垛，霧面）
  mud2: namedMaterial('paint-mud-brick-matte', { color: 0xa07f5b, roughness: 0.78, clearcoat: 0.0, side: THREE.DoubleSide }),
  // 金邊（真金屬：-brass 結尾）
  gold2: namedMaterial('trim-gold-brass', { color: 0xc8a24a, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 浮雕眼睛（黑釉）
  eye: namedMaterial('paint-black-glaze', { color: 0x161616, roughness: 0.3, clearcoat: 0.6 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x131a26, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x173b78, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x14284a, roughness: 0.75, side: THREE.DoubleSide }),
  dJoint: decalMaterial('decal-brick-joint-navy', { color: 0x12306a, roughness: 0.5 }),
  dYellow: decalMaterial('decal-yellow-glaze', { color: 0xd9a441, roughness: 0.36 }),
  dBlack: decalMaterial('decal-black-glaze', { color: 0x1a1a1a, roughness: 0.4 }),
  dWhite: decalMaterial('decal-white-glaze', { color: 0xf2efe6, roughness: 0.38 }),
  dGold: decalMaterial('decal-gold', { color: 0xc8a24a, roughness: 0.32, metalness: 0.7 }),
  dNavy: decalMaterial('decal-gate-shadow-navy', { color: 0x0f2347, roughness: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 穆修胡修浮雕（實體件）：每段膠囊沿 z 壓扁成凸起 RELIEF_H 的半膠囊，中心貼在側牆外表面（內半埋進殼裡）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildBeastRelief = (sg) => {
  /** @type {number} 浮雕凸起高度（取 0.6–1 mm 之間） */
  const RELIEF_H = 0.9;
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const [ax, ay, bx, by, r0] of BEAST_SEGS) {
    const r = r0 * BEAST.s;
    const x0 = BEAST.x0 + ax * BEAST.s;
    const y0 = BEAST.y0 + ay * BEAST.s;
    const x1 = BEAST.x0 + bx * BEAST.s;
    const y1 = BEAST.y0 + by * BEAST.s;
    const len = Math.hypot(x1 - x0, y1 - y0);
    // 低分段（cap 3、徑向 10）
    const g = new THREE.CapsuleGeometry(r, len, 3, 10);
    // 膠囊預設沿 y 軸 → 轉到線段方向
    g.rotateZ(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2);
    g.scale(1, 1, Math.min(1, RELIEF_H / r));
    const xm = (x0 + x1) / 2;
    const ym = (y0 + y1) / 2;
    g.translate(xm, ym, sg * (wallZ(xm, ym) - 0.05));
    geos.push(g);
  }
  return mergeGeos(geos);
};

/**
 * 穆修胡修的鱗片：在浮雕軀幹、長頸、尾根（膠囊半徑 ≥ 0.9）的表面排一層小圓鱗（扁球，凸出約 0.25 mm），
 * 沿每段每 0.9 mm 一列、上下兩排錯開，像釉磚浮雕上刻出的鱗紋
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildBeastScales = (sg) => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  /** @type {number} 浮雕外表面離牆面的高度（同 buildBeastRelief 的 RELIEF_H − 0.05） */
  const top = 0.85;
  for (const [ax, ay, bx, by, r0] of BEAST_SEGS) {
    if (r0 < 0.9) {
      continue;
    }
    const x0 = BEAST.x0 + ax * BEAST.s;
    const y0 = BEAST.y0 + ay * BEAST.s;
    const x1 = BEAST.x0 + bx * BEAST.s;
    const y1 = BEAST.y0 + by * BEAST.s;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const r = r0 * BEAST.s;
    const n = Math.max(1, Math.floor(len / 0.9));
    for (let i = 0; i <= n; i++) {
      const q = i / n;
      for (const off of r > 1.1 ? [-0.42, 0.42] : [0]) {
        const o = off * r + (i % 2 === 0 ? 0 : 0.12 * r);
        const x = lerp(x0, x1, q) + nx * o;
        const y = lerp(y0, y1, q) + ny * o;
        // 低分段（6 × 4）
        const g = new THREE.SphereGeometry(0.36, 6, 4);
        g.scale(1, 1, 0.55);
        g.translate(x, y, sg * (wallZ(x, y) + top - 0.05));
        geos.push(g);
      }
    }
  }
  return mergeGeos(geos);
};

/** @type {{ yMain: number, yFlap: number, thick: number, half: number }} 尾翼（crenel-tail，後掠雙層翼）：主翼底 y 32.4、厚 1.4；副翼底 y 34.6；半翼展 24（端板外緣 25.2） */
const WING = { yMain: 32.4, yFlap: 34.6, thick: 1.4, half: 24 };

export const mushussuGateBody = makePolyBody({
  id: 'body-mushussu-gate',
  name: '伊什塔爾城門的穆修胡修',
  style: 'myth',
  phase: 8,
  mythSeries: 'mesopotamian',
  mythTheme: 'mushussu',
  form: 'brick-gate',
  roof: 'closed',
  wing: 'crenel-tail',
  theme: '低矮流線車殼披上伊什塔爾城門的釉磚：青金石藍釉磚車身、側牆上下黃釉磚邊框、車頂中線一列白瓣金心玫瑰花飾賽車條紋、側牆中段黃釉穆修胡修浮雕（鱗片、角、獅爪前腳、鷹爪後腳、蝎尾）、細長頸鼻頂面的黃釉蛇首與一對金色導流角、輪拱黃釉拱框、車尾後掠雙層翼＋兩側階梯城垛形端板',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  hard: [4],
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    // 牆腳一道瀝青黑（側牆最下 1.6 mm）
    { mat: 'bitumen', keep: (x, y, z) => (Math.abs(z) > wallZ(x, y) - 0.4 ? P.yLow(x) + 1.6 - y : -1) },
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'lapis2', mount: 'mount' },
  materials: () => ({
    ...materials(),
    // 鱗片：只比浮雕深一點的黃釉（避免深色圓點讀成豹紋），靠凸起與較霧的釉面看出鱗紋
    scale: namedMaterial('paint-yellow-glaze-scale', { color: 0xc99335, roughness: 0.48, clearcoat: 0.3 }),
  }),
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）＋輪胎內側環形擋板（kitsune-ninetail 的 buildArchWell）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 輪拱拱框：黃釉寬帶＋外側黑細線（城門拱的釉磚邊框）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = archDist(x, y);
        return Math.min(d, 1.5 - d);
      }),
      mat: 'dYellow',
      name: 'decal-arch-band',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = archDist(x, y);
        return Math.min(d - 1.5, 2.15 - d);
      }),
      mat: 'dBlack',
      name: 'decal-arch-line',
    });

    // 側牆上下兩道黃釉磚邊框（M2：城門釉磚飾帶的黃框）＋內側黑細線；避開輪拱拱框
    /** @type {(x: number, y: number, z: number) => number} 黃框（正值 = 在框內） */
    const bandAt = (x, y, z) => {
      if (!onSideWall(x, y, z) || archDist(x, y) < 2.15) {
        return -1;
      }
      return Math.max(Math.min(y - topBandLo(x), topBandHi(x) - y), Math.min(y - lowBandLo(x), lowBandHi(x) - y));
    };
    parts.push({ geometry: kit.decal(bandAt), mat: 'dYellow', name: 'decal-wall-bands' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || archDist(x, y) < 2.15) {
          return -1;
        }
        return Math.max(0.3 - Math.abs(y - (topBandLo(x) - 0.3)), 0.3 - Math.abs(y - (lowBandHi(x) + 0.3)));
      }),
      mat: 'dBlack',
      name: 'decal-wall-band-lines',
    });

    // 肩線只留一道黃釉細邊（沿肩稜線內側 0.3 → 1.5 mm）；玫瑰花飾在車頂中線當貫穿全車的賽車條紋（見下方）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < P.yS(x) + 0.05 || x < X_REAR + 2 || x > 58 || archDist(x, y) < 0.8) {
          return -1;
        }
        const dz = P.hw(x) - Math.abs(z);
        return Math.min(dz - 0.3, 1.5 - dz);
      }),
      mat: 'dYellow',
      name: 'decal-crest-pinstripe',
    });

    // 磚縫：側牆（兩道黃框之間，避開拱框、穆修胡修）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || y < lowBandHi(x) + 0.8 || y > topBandLo(x) - 0.8) {
          return -1;
        }
        if (archDist(x, y) < 2.6 || beastAt(x, y, z) < 1.2) {
          return -1;
        }
        return brickJoint(x, y);
      }),
      mat: 'dJoint',
      name: 'decal-brick-joints',
    });
    // 車頂磚縫（肩線細邊與中線花飾條紋之間）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (y < P.yS(x) + 0.05 || az > P.hw(x) - 2.2 || az < 6 || x < X_REAR + 2 || x > 57) {
          return -1;
        }
        return brickJoint(x, az + 1);
      }),
      mat: 'dJoint',
      name: 'decal-roof-joints',
    });

    // 穆修胡修：牆上黑色描邊（浮雕外擴 0.55）＋黃釉浮雕實體件＋鱗片＋黑眼
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = beastAt(x, y, z);
        return Math.min(0.55 - d, d + 0.1);
      }),
      mat: 'dBlack',
      name: 'decal-mushussu-outline',
    });
    parts.push({ geometry: mergeGeos([buildBeastRelief(1), buildBeastRelief(-1)]), mat: 'yellow', solid: true, outline: true, name: 'mushussu-relief' });
    parts.push({ geometry: mergeGeos([buildBeastScales(1), buildBeastScales(-1)]), mat: 'scale', solid: true, name: 'mushussu-scales' });
    {
      const ex = BEAST.x0 + 11.4 * BEAST.s;
      const ey = BEAST.y0 + 14.5 * BEAST.s;
      /** @type {THREE.BufferGeometry[]} */
      const eyes = [];
      for (const sg of [-1, 1]) {
        const e = new THREE.SphereGeometry(0.4, 12, 8);
        e.scale(1, 1, 0.8);
        e.translate(ex, ey, sg * (wallZ(ex, ey) + 0.85));
        eyes.push(e);
      }
      parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, name: 'mushussu-eyes' });
    }

    // 車頂中線的玫瑰花飾賽車條紋（M2 花飾帶採 V12 / V13 配置：從頸鼻上的蛇首一路往後貫穿到車尾）——
    // 深藍底（|z| < 3.3）＋一列白瓣金心玫瑰花飾（每 6.2 mm 一朵）＋兩側黃釉邊（3.3 → 4.5）＋黑細線（4.5 → 5.1）
    /** @type {(x: number, y: number) => boolean} 車頂中線帶（肩線以上；蛇首後緣 x 57 到車尾） */
    const onStripe = (x, y) => y > P.yS(x) + 0.5 && x > X_REAR + 1.5 && x < 57.5;
    parts.push({ geometry: kit.decal((x, y, z) => (onStripe(x, y) ? 3.3 - Math.abs(z) : -1)), mat: 'dNavy', name: 'decal-rosette-stripe-base' });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y) ? Math.min(Math.abs(z) - 3.3, 4.5 - Math.abs(z)) : -1)),
      mat: 'dYellow',
      name: 'decal-rosette-stripe-borders',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y) ? Math.min(Math.abs(z) - 4.5, 5.1 - Math.abs(z)) : -1)),
      mat: 'dBlack',
      name: 'decal-rosette-stripe-lines',
    });
    /** @type {number} 花飾間距 */
    const ROS_STEP = 6.2;
    /** @type {(x: number, z: number) => { petal: number, core: number }} 最近的一朵玫瑰花飾（條紋中線上） */
    const nearestRosette = (x, z) => {
      const xc = Math.min(54, Math.max(-68, Math.round(x / ROS_STEP) * ROS_STEP));
      return rosetteSd(x - xc, z);
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y) ? -nearestRosette(x, z).petal : -1), { offset: 0.12 }),
      mat: 'dWhite',
      name: 'decal-rosette-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y) ? -nearestRosette(x, z).core : -1), { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-rosette-cores',
    });

    // 頸鼻頂面的穆修胡修蛇首（黃釉、黑描邊、黑眼；M1 的細長蛇首，只做平面圖形，不做立體龍頭）
    /** @type {(x: number, z: number) => number} 蛇首輪廓距離（正值 = 外）：x 57 → 鼻尖，半寬為殼半寬的 0.62 */
    const headSd = (x, z) => Math.max(57 - x, Math.abs(z) - 0.62 * P.hw(x));
    /** @type {(x: number, y: number) => boolean} 頸鼻頂面 */
    const onSnout = (x, y) => x > 55 && y > P.yS(x) + 0.05;
    parts.push({ geometry: kit.decal((x, y, z) => (onSnout(x, y) ? -headSd(x, z) : -1)), mat: 'dYellow', name: 'decal-snake-head' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSnout(x, y)) {
          return -1;
        }
        const d = headSd(x, z);
        return Math.min(d, 0.6 - d);
      }),
      mat: 'dBlack',
      name: 'decal-snake-head-outline',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSnout(x, y) ? 0.85 - Math.hypot(x - 65.5, Math.abs(z) - 0.36 * P.hw(65.5)) : -1), { offset: 0.12 }),
      mat: 'dBlack',
      name: 'decal-snake-eyes',
    });

    // 蛇首的一對直角（M1：頭上往後的直角）做成頸鼻頂面往後上方掃的導流角（實體件、金屬金）：角根在 x 66、往後掃到 x 52，
    // 根粗 R1.1 → 角尖 R0.6（直徑 ≥ 1.2）；低分段（12 × 6）
    {
      /** @type {THREE.BufferGeometry[]} */
      const horns = [];
      for (const sg of [-1, 1]) {
        /** @type {number[][]} */
        const pts = [];
        for (let i = 0; i <= 6; i++) {
          const u = i / 6;
          const x = lerp(66.5, 51.5, u);
          const z = sg * lerp(4.2, 10.5, u ** 1.2);
          const y = kit.surf.topY(x, z) - 0.4 + 3.2 * u ** 1.4;
          pts.push([x, y, z]);
        }
        horns.push(sweepEllipse(pts, 12, (t) => {
          const r = lerp(1.1, 0.6, t);
          return [r, r];
        }, 6));
      }
      parts.push({ geometry: mergeGeos(horns), mat: 'gold2', solid: true, outline: true, name: 'snout-horns' });
    }

    // 車尾尾翼（crenel-tail）：後掠雙層翼——主翼板（黃釉）＋上後方的副翼（藍釉）＋兩側階梯城垛形端板（泥磚色，往車尾一階階升高）；
    // 城垛語彙集中在端板；兩片藍釉支柱從車尾頂面立起接主翼
    {
      const { half, thick } = WING;
      /** @type {(outline: number[][], y0: number, t: number) => THREE.BufferGeometry} 平面 (x, z) 的翼板，沿 y 擠出厚度 t */
      const plate = (outline, y0, t) => {
        const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
        const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
        // 局部 (x, y, z) → 世界 (x, z, −y)：形狀平面躺平、擠出方向朝上
        g.rotateX(-Math.PI / 2);
        g.translate(0, y0, 0);
        return g;
      };
      // 主翼：中線弦 x −63 → −70、翼端（z ±half）弦 x −67 → −73（後掠）
      const main = plate([[-63, 0], [-67, half], [-73, half], [-70, 0], [-73, -half], [-67, -half]], WING.yMain, thick);
      // 副翼：主翼上後方 2.2 mm，中線弦 x −68.5 → −72.5、翼端 x −71.5 → −75.5
      const flap = plate([[-68.5, 0], [-71.5, half - 0.6], [-75.5, half - 0.6], [-72.5, 0], [-75.5, -(half - 0.6)], [-71.5, -(half - 0.6)]], WING.yFlap, 1.2);
      parts.push({ geometry: main, mat: 'yellow', solid: true, outline: true, name: 'wing-main' });
      parts.push({ geometry: flap, mat: 'lapis2', solid: true, outline: true, name: 'wing-flap' });
      // 主翼前緣金線
      /** @type {THREE.BufferGeometry[]} */
      const gilt = [];
      for (const sg of [-1, 1]) {
        const len = Math.hypot(4, half);
        const b = new THREE.BoxGeometry(len, 0.5, 0.7);
        b.rotateY(-sg * Math.atan2(half, 4) + sg * Math.PI / 2);
        b.translate(-65, WING.yMain + thick + 0.2, sg * half / 2);
        gilt.push(b);
      }
      parts.push({ geometry: mergeGeos(gilt), mat: 'gold2', solid: true, name: 'wing-gilt' });
      // 端板：側視為往車尾升高的兩階城垛（底 y 30.6、前階頂 = 主翼頂 + 0.6、後階頂 = 副翼頂 + 0.8），厚 1.2
      /** @type {THREE.BufferGeometry[]} */
      const ends = [];
      const yA = WING.yMain + thick + 0.6;
      const yB = WING.yFlap + 1.2 + 0.8;
      for (const sg of [-1, 1]) {
        const sh = new THREE.Shape([
          [-66, 30.6], [-66, yA], [-70.6, yA], [-70.6, yB], [-76, yB], [-76, 32.8], [-73.5, 30.6],
        ].map(([x, y]) => new THREE.Vector2(x, y)));
        const g = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false });
        g.translate(0, 0, sg * (half + 0.6) - 0.6);
        ends.push(g);
      }
      parts.push({ geometry: mergeGeos(ends), mat: 'mud2', solid: true, outline: true, name: 'wing-crenel-endplates' });
      // 支柱：車尾頂面 → 主翼底（z ±12）
      /** @type {THREE.BufferGeometry[]} */
      const struts = [];
      for (const sg of [-1, 1]) {
        const xs0 = -69.5;
        const xs1 = -64.5;
        const yb0 = kit.surf.topY(xs0, 12) - 0.8;
        const yb1 = kit.surf.topY(xs1, 12) - 0.8;
        const sh = new THREE.Shape([new THREE.Vector2(xs0, yb0), new THREE.Vector2(xs1, yb1), new THREE.Vector2(xs1 - 1.6, WING.yMain + 0.2), new THREE.Vector2(xs0 - 0.4, WING.yMain + 0.2)]);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false });
        g.translate(0, 0, sg * 12 - 0.7);
        struts.push(g);
      }
      parts.push({ geometry: mergeGeos(struts), mat: 'lapis2', solid: true, outline: true, name: 'wing-struts' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry:
      '本檔站位產生器 P（推估，低矮流線車殼）：殼 x −72 → 74（細長頸鼻、長尾），尾翼端板後緣 −76；肩線半寬 翼子板 44、腰 41（＋牆腳外張 0.6，外框半寬 ≤ 48.0）、頸鼻 22（x 60）→ 鼻端 6.5、車尾 22；駝峰 34.6、鼻端 15.4、車尾 25，尾翼端板頂 36.6（全車最高）；肩線 28.5–30；側裙下緣 10.5（包住電池管）、鼻端 12.8、車尾 16',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    crenels: '尾翼：後掠雙層翼——兩片 1.4 mm 支柱（z ±12）、主翼板厚 1.4（弦 6–7、翼展 48 mm，頂面 y 33.8）、上後方的副翼厚 1.2（弦 4、翼展 46.8 mm）、主翼前緣金線、兩側往車尾升高的兩階城垛形端板（厚 1.2）；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    relief: '穆修胡修浮雕：32 段膠囊沿牆面法向壓扁成凸起 0.9 mm 的半膠囊（實體件），縮放 0.74 → 長約 25、高約 12.6 mm；軀幹 / 頸 / 尾根上排一層 R0.36 扁球鱗片（凸出約 0.2 mm）',
    myth: '穆修胡修的鱗身、長頸、蛇信、頭角與頭冠、前獅足後鷹爪、蝎尾（MYTH_RESEARCH M1）；伊什塔爾城門青金石藍釉磚、黃框、黑白金邊框與玫瑰花飾、遊行大道黃黑磚、城垛（M2、M3）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
