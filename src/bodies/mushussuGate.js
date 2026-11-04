// 伊什塔爾城門的穆修胡修（body-mushussu-gate，第八階段神話組・美索不達米亞）：iter-115 依評審「方塊城牆、不像比賽用車殼」改成一台低矮流線車殼——
// 楔形鼻端、座艙段的低駝峰、車尾收尾、前後輪上方微鼓的翼子板與 R17.5 輪拱，側裙一路包到底盤側框（不露電池管）；
// 城門的語彙全部移到表面：青金石藍釉磚（錯縫磚縫）、側牆上下兩道黃釉磚邊框（黑細線）、肩線上兩列白瓣金心的玫瑰花飾帶、
// 側牆中段的黃釉穆修胡修浮雕（鱗片、頭上的角與冠、獅爪前腳、鷹爪後腳、往上捲的蝎尾；實體件凸出 0.9 mm）、
// 車頂中線黃黑磚遊行大道、輪拱黃釉拱框；城垛只留在車尾尾翼上緣的一排兩階小齒（crenel-tail）。
// 設計：shared/design/body-mushussu-gate/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 4 節 M1–M5；黑名單 4-3、第 9 節 Dragon Jr. / Beat-Magnum）。剖面為本檔站位產生器（推估）。
// 配色取自 M2 / 4-2（青金石釉藍、黃釉、黑白金邊框與玫瑰花飾）；圖形全部自繪；不做龍頭車身、不放龍形駕駛、不做紅龍徽章、玫瑰花飾只用圓瓣（不做放射閃電）；不含任何文字。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾封口 x */
const X_REAR = -72;
/** @type {number} 車頭（鼻端封口）x */
const X_FRONT = 60;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-72, -68, -60, -50, -40, -28, -14, 0, 14, 28, 40, 48, 55, 60];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：前後輪上方微鼓的翼子板 44、腰 41；短鼻（輪胎前緣往前 7 mm，鼻端 22）、長尾（後軸往後 32 mm 的長尾段收到 22，尾翼架在上面）
  hw: monoCurve(XS, [22, 28, 33.5, 40, 44, 42.5, 41.5, 41, 41.5, 42.5, 44, 40.5, 31, 22]),
  // 中線殼頂：座艙段低駝峰 37.8（x 0），往前一路下斜成楔形鼻端（21），往後緩降成長尾（25）
  yTop: monoCurve(XS, [25, 26.5, 28.5, 30.2, 31.8, 34.5, 37.2, 37.8, 36.6, 33, 30.6, 28.2, 24.5, 21]),
  // 肩稜線（頂面與側牆交界，銳利）：輪上 30、腰 28.5（R17.5 輪拱頂 30.5 切進肩線，俯視在四個輪位留下缺口，同 kitsune 做法）
  yS: monoCurve(XS, [22.5, 24, 26.2, 28.4, 30, 29.5, 28.5, 28.5, 28.8, 29.6, 30, 28.2, 24, 20.5]),
  // 側裙下緣（腰段 10.5，loft 自動讓開底盤側框）
  yLow: monoCurve(XS, [16, 15.5, 14.5, 12.5, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11.5, 13, 14.5]),
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
const STATIONS = [...buildStations(X_REAR, -62, 0.75, profile).slice(0, -1), ...buildStations(-62, 52, 2, profile).slice(0, -1), ...buildStations(52, X_FRONT, 0.75, profile)];

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
 * 穆修胡修側身（iter-114 照伊什塔爾城門釉磚浮雕重畫，M1 / M2）：水平細長鱗身、往前上斜的 S 形長頸、
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
 * 在 (z, y) 平面畫的形狀沿 +x 擠出 depth（城垛等直立板，邊緣 0.2 mm 倒角）
 * @type {(outer: number[][], x0: number, depth: number) => THREE.BufferGeometry}
 */
const extrudeFront = (outer, x0, depth) => {
  const bev = 0.2;
  const shape = new THREE.Shape(outer.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 12 });
  g.translate(0, 0, bev);
  // 擠出方向（局部 z）轉成車頭方向 +x；局部 x → 世界 −z（形狀左右對稱，不影響）
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
};

/**
 * 階梯形城垛（單一垛口）：(a, y) 兩階或三階，底寬 w、每階高 h、每階兩側各內收 s
 * @type {(ac: number, y0: number, w: number, h: number, steps: number, s: number) => number[][]}
 */
const merlonOutline = (ac, y0, w, h, steps, s) => {
  const half = w / 2;
  /** @type {number[][]} */
  const right = [];
  for (let i = 0; i < steps; i++) {
    right.push([ac + half - i * s, y0 + i * h], [ac + half - i * s, y0 + (i + 1) * h]);
  }
  const left = right.map(([a, y]) => [2 * ac - a, y]).reverse();
  return [[ac - half, y0], ...right.slice(0, 1).map(([a]) => [a, y0]), ...right, ...left].filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);
};

/**
 * 穆修胡修浮雕（實體件）：每段膠囊沿 z 壓扁成凸起 RELIEF_H 的半膠囊，中心貼在側牆外表面（內半埋進殼裡）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildBeastRelief = (sg) => {
  /** @type {number} 浮雕凸起高度（評審建議 0.6–1 mm） */
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
    const g = new THREE.CapsuleGeometry(r, len, 4, 14);
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
 * 穆修胡修的鱗片（iter-115 評審「做回有鱗片」）：在浮雕軀幹、長頸、尾根（膠囊半徑 ≥ 0.9）的表面排一層小圓鱗（扁球，凸出約 0.25 mm），
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
        const g = new THREE.SphereGeometry(0.36, 8, 6);
        g.scale(1, 1, 0.55);
        g.translate(x, y, sg * (wallZ(x, y) + top - 0.05));
        geos.push(g);
      }
    }
  }
  return mergeGeos(geos);
};

/** @type {{ x0: number, x1: number, yPlate: number, thick: number, half: number }} 尾翼（crenel-tail）：弦 x −71 → −62、板頂 y 36.4、厚 1.4、半翼展 28 */
const WING = { x0: -71, x1: -62, yPlate: 36.4, thick: 1.4, half: 28 };

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
  theme: '低矮流線車殼披上伊什塔爾城門的釉磚：青金石藍釉磚車身、側牆上下黃釉磚邊框、肩線兩列白瓣金心玫瑰花飾帶、側牆中段黃釉穆修胡修浮雕（鱗片、角、獅爪前腳、鷹爪後腳、蝎尾）、車頂黃黑磚遊行大道、車尾一排小城垛齒的尾翼',
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

    // 肩線上的玫瑰花飾帶（M2：黑邊框裡一列白瓣金心圓瓣花）：沿車頂外緣（肩線往內 0.8 → 6.2 mm），每 6.2 mm 一朵
    /** @type {number} 花飾間距 */
    const ROS_STEP = 6.2;
    /** @type {(x: number, y: number, z: number) => boolean} 花飾帶（車頂外緣） */
    const onCrest = (x, y, z) => y > P.yS(x) + 0.05 && Math.abs(z) > P.hw(x) - 6.4 && x > -68 && x < 52 && archDist(x, y) > 0.8;
    /** @type {(x: number) => number} 花飾中線的 |z| */
    const rosZ = (x) => P.hw(x) - 3.5;
    /** @type {(x: number, z: number) => { petal: number, core: number }} 最近的一朵玫瑰花飾 */
    const nearestRosette = (x, z) => {
      const xc = Math.round(x / ROS_STEP) * ROS_STEP;
      return rosetteSd(x - xc, Math.abs(z) - rosZ(x));
    };
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onCrest(x, y, z)) {
          return -1;
        }
        const dz = Math.abs(Math.abs(z) - rosZ(x));
        return 0.35 - Math.abs(dz - 2.65);
      }),
      mat: 'dBlack',
      name: 'decal-rosette-band-lines',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onCrest(x, y, z) ? -nearestRosette(x, z).petal : -1), { offset: 0.12 }),
      mat: 'dWhite',
      name: 'decal-rosette-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onCrest(x, y, z) ? -nearestRosette(x, z).core : -1), { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-rosette-cores',
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
    // 車頂磚縫（花飾帶與遊行大道之間）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (y < P.yS(x) + 0.05 || az > P.hw(x) - 6.8 || az < 6 || x < X_REAR + 2 || x > X_FRONT - 3) {
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

    // 車頂中線：遊行大道（M2：黃黑釉磚）
    /** @type {(x: number, y: number, z: number) => boolean} 車頂中線帶 */
    const onRoof = (x, y, z) => y > P.yS(x) + 1 && Math.abs(z) < 6 && x > X_REAR + 2 && x < X_FRONT - 3;
    parts.push({
      geometry: kit.decal((x, y, z) => (onRoof(x, y, z) ? 4.4 - Math.abs(z) : -1)),
      mat: 'dYellow',
      name: 'decal-procession-way',
    });
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          if (!onRoof(x, y, z)) {
            return -1;
          }
          const az = Math.abs(z);
          if (az > 4.4) {
            return Math.min(az - 4.4, 5.3 - az);
          }
          // 磚縫：沿 x 每 5 mm 一道、中線一道（兩列錯縫）
          const row = z > 0 ? 1 : 0;
          const ph = (((x + row * 2.5) % 5) + 5) % 5;
          return Math.max(0.3 - Math.min(ph, 5 - ph), 0.3 - az);
        },
        { offset: 0.12 },
      ),
      mat: 'dBlack',
      name: 'decal-procession-joints',
    });

    // 鼻端封口：一朵金色玫瑰花飾（8 片圓瓣，凸出 0.5）
    {
      const yRos = (P.yLow(X_FRONT) + P.yTop(X_FRONT)) / 2;
      /** @type {THREE.BufferGeometry[]} */
      const petals = [];
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const c = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 14);
        c.rotateZ(Math.PI / 2);
        c.translate(X_FRONT + 0.2, yRos + 1.42 * Math.sin(a), 1.42 * Math.cos(a));
        petals.push(c);
      }
      parts.push({ geometry: mergeGeos(petals), mat: 'gold2', solid: true, name: 'nose-rosette' });
    }

    // 車尾尾翼（crenel-tail）：兩片直立支柱（藍釉）＋弦 9 mm 的翼板（未上釉泥磚色）＋翼板後緣一排 9 個兩階小城垛齒＋前緣金線
    {
      const { x0, x1, yPlate, thick, half } = WING;
      /** @type {THREE.BufferGeometry[]} */
      const struts = [];
      for (const sg of [-1, 1]) {
        const xs0 = -69.5;
        const xs1 = -64;
        const yb = P.yTop(xs1) - 1.2 - 0.004 * 14 * 14;
        const sh = new THREE.Shape([new THREE.Vector2(xs0, yb - 0.6), new THREE.Vector2(xs1, yb), new THREE.Vector2(xs1 - 1.2, yPlate - thick + 0.2), new THREE.Vector2(xs0 - 0.6, yPlate - thick + 0.2)]);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false });
        g.translate(0, 0, sg * 14 - 0.7);
        struts.push(g);
      }
      parts.push({ geometry: mergeGeos(struts), mat: 'lapis2', solid: true, outline: true, name: 'wing-struts' });
      const plate = new THREE.BoxGeometry(x1 - x0, thick, 2 * half);
      plate.translate((x0 + x1) / 2, yPlate - thick / 2, 0);
      /** @type {THREE.BufferGeometry[]} */
      const teeth = [plate];
      for (let i = 0; i < 9; i++) {
        const zc = lerp(-half + 3, half - 3, i / 8);
        teeth.push(extrudeFront(merlonOutline(zc, yPlate - 0.1, 3.6, 0.9, 2, 0.8), x0, 1.6));
      }
      parts.push({ geometry: mergeGeos(teeth), mat: 'mud2', solid: true, outline: true, name: 'crenel-tail' });
      const gilt = new THREE.BoxGeometry(0.6, 0.5, 2 * half - 0.4);
      gilt.translate(x1 - 0.2, yPlate + 0.15, 0);
      parts.push({ geometry: gilt, mat: 'gold2', solid: true, name: 'crenel-gilt' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry:
      '本檔站位產生器 P（推估，iter-115 改成低矮流線車殼）：殼 x −72 → 60（短鼻長尾）；肩線半寬 翼子板 44、腰 41（＋牆腳外張 0.6，外框半寬 ≤ 48.0，iter-113 擦牆教訓）、鼻端 22、車尾 22；駝峰 37.8、鼻端 21、車尾 25；肩線 28.5–30；側裙下緣 10.5（包住電池管）、鼻端 14.5、車尾 16',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    crenels: '尾翼：兩片 1.4 mm 支柱（z ±14）、9 × 1.4 × 56 mm 翼板、9 個兩階城垛齒（底寬 3.6、每階 0.9、厚 1.6）；ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    relief: '穆修胡修浮雕：32 段膠囊沿牆面法向壓扁成凸起 0.9 mm 的半膠囊（實體件），縮放 0.74 → 長約 25、高約 12.6 mm；軀幹 / 頸 / 尾根上排一層 R0.36 扁球鱗片（凸出約 0.2 mm）',
    myth: '穆修胡修的鱗身、長頸、蛇信、頭角與頭冠、前獅足後鷹爪、蝎尾（MYTH_RESEARCH M1）；伊什塔爾城門青金石藍釉磚、黃框、黑白金邊框與玫瑰花飾、遊行大道黃黑磚、城垛（M2、M3）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
