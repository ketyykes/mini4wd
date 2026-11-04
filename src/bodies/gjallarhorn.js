// 加拉爾號角（body-gjallarhorn，第八階段神話組・北歐）：守護彩虹橋的海姆達爾在諸神黃昏吹響的號角 Gjallarhorn。
// 整台車是一支平放、微彎的號角：車頭是細的圓斷面吹口（往上翹，金色吹口套）、往後漸粗，側視是一道往上揚的緩弧；
// 車尾是往外張開的喇叭口（bell-flare 尾翼：扁橢圓喇叭＋金色環邊，開口朝後，口內三道細彩環＝彩虹橋的三色）。
// 號角身上 6 道金色箍環、兩段 Urnes 風格交織雙股紋（青銅貼紙，自繪曲線）；座艙罩在中段（煙燻）。
// 號角兩側是低平的深色擋泥側裙（前後輪罩，兩輪之間收腰），蓋住輪胎；前段號角在兩個輪罩之間懸空，俯視是一支獨立的管子。
// 設計：shared/design/body-gjallarhorn/DESIGN.md（典故：《散文埃達》Gylfaginning；語彙：維京時代飲用角的金屬配件、Urnes 交織紋 MYTH_RESEARCH N8）。
// 塗裝全為自創：牛角漸層（吹口深褐近黑 → 車尾奶油象牙，分段在箍環處交接）＋金箍環＋青銅交織紋；不用盧恩字母、不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, buildRegion, buildRim } from './loft.js';
import { monoCurve, buildStations, fenderFloor, smoothMax } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 號角參數的站位（x 由後到前，前後軸 x = ±40）：喇叭口接合處 −63、殼前端（吹口根部）66 */
const XS = [-63, -58, -50, -40, -30, -15, 0, 15, 30, 40, 50, 60, 66];
/** @type {number[]} 側裙半寬的站位 */
const XS_HW = [-63, -60, -50, -40, -28, -18, -5, 10, 20, 28, 40, 50, 56, 60, 66];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 號角中心線高度：吹口端 26 → 車尾 28.5（側視往上揚的緩弧，吹口另外往上翹）
  yc: monoCurve(XS, [28.5, 28.5, 28.5, 28.5, 28.5, 28.5, 28.3, 28, 27.7, 27.3, 26.6, 26, 26]),
  // 號角斷面半徑（水平 / 垂直）：吹口根 4.2 → 喇叭口接合處 21（漸粗＋車尾快速外張）
  rz: monoCurve(XS, [21, 18.5, 16, 14.5, 13.5, 12.5, 11.5, 10.5, 9.5, 8.5, 7, 5.5, 4.2]),
  ry: monoCurve(XS, [14.2, 13.5, 12.9, 12.4, 11.9, 11.2, 10.4, 9.4, 8.4, 7.4, 6, 4.8, 3.8]),
  // 側裙俯視半寬：前後輪罩外張（前 37.5、後 39.2，蓋住輪胎），兩輪之間收成 27.5 的細腰（只剩號角＋窄側裙），車頭收到 11（吹口）
  hw: monoCurve(XS_HW, [33, 37, 39.2, 39.2, 37.5, 30, 27.5, 28, 32, 37, 37.5, 34, 27, 19, 11]),
  // 側裙下緣
  yLow: monoCurve(XS_HW, [18, 16.5, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15.2, 15.6, 16.2, 17]),
};

/** @type {(x: number) => number} 號角兩側的低谷（號角與輪罩之間）高度 */
const yValley = (x) => (x > 56 ? lerp(24.5, 21.5, Math.min(1, (x - 56) / 10)) : 24.5);
/** @type {(x: number) => number} 輪罩頂高度：輪軸上方拋物線抬到 R17.5 輪拱之上，兩輪之間降成 25 的側裙平台 */
const yFender = (x) => smoothMax(25, fenderFloor(x) + 1.6, 1);

/**
 * 號角與低谷交接處的 |z|（號角斷面在低谷高度的寬度；低谷低於中心線時取赤道寬）
 * @type {(x: number) => number}
 */
const junctionZ = (x) => {
  const yc = P.yc(x);
  const yv = yValley(x);
  const rz = P.rz(x);
  if (yv <= yc) {
    return rz + 0.3;
  }
  const q = Math.min(1, (yv - yc) / P.ry(x));
  return rz * Math.sqrt(1 - q * q) + 0.3;
};

/**
 * 低谷外緣（輪罩內壁起點）的 |z|：一般 20；車頭變窄處（側裙半寬 < 25）往內收，z 保持遞增
 * @type {(x: number) => number}
 */
const valleyOuterZ = (x) => {
  const zJ = junctionZ(x);
  return Math.max(zJ + 0.2, Math.min(Math.max(20, zJ + 0.6), P.hw(x) - 4.6));
};

/**
 * 號角兩側的前段低谷挖空（俯視開口，x 23 以前）：號角在兩個前輪罩之間懸空，俯視是一支獨立的管子
 * @type {any}
 */
const HORN_GAP = {
  id: '號角兩側開口',
  view: 'top',
  shape: 'fn',
  sd: (x, y, z) => Math.max(junctionZ(x) + 0.35 - Math.abs(z), Math.abs(z) - (valleyOuterZ(x) - 0.35), 23 - x),
};

/**
 * 半剖面 10 點：號角上半圓（中線頂 → 赤道）→ 交接 → 低谷 → 輪罩內壁 → 輪罩頂 → 圓肩 → 側裙下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yc = P.yc(x);
  const rz = P.rz(x);
  const ry = P.ry(x);
  const hw = P.hw(x);
  const lo = P.yLow(x);
  const yv = Math.min(yValley(x), yc);
  const zJ = junctionZ(x);
  const zW = valleyOuterZ(x);
  const yF = Math.max(yFender(x), yv + 1.5);
  const zF = Math.max(zW + 0.3, Math.min(zW + 1.6, hw - 3));
  return [
    [0, yc + ry],
    [0.5 * rz, yc + 0.866 * ry],
    [0.866 * rz, yc + 0.5 * ry],
    [rz, yc],
    [zJ, yv],
    [zW, yv],
    [zF, yF],
    [hw - 1.6, yF],
    [hw, yF - 2],
    [hw + 0.4, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾外張段每 0.75 mm 一站，中段每 2 mm，吹口段每 1 mm */
const STATIONS = [...buildStations(-63, -52, 0.75, profile).slice(0, -1), ...buildStations(-52, 56, 2, profile).slice(0, -1), ...buildStations(56, 66, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 4、前後半長 17、半寬 6.6） */
const CANOPY = { xc: 4, a: 17, b: 6.6, n: 2.4 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/** @type {number[]} 金箍環中心 x（由前往後；同時是牛角漸層分段的交接處） */
const HOOP_X = [61, 47, 26, -19, -41, -56];
/** @type {number} 箍環寬 */
const HOOP_W = 2;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 牛角漸層（緞面：paint- 且 roughness > 0.5 → Blender 緞面）：吹口端深褐近黑 → 褐 → 琥珀 → 蜜色 → 奶油象牙
  horn0: namedMaterial('paint-horn-umber-black', { color: 0x2a1d15, roughness: 0.52, clearcoat: 0.25 }),
  horn1: namedMaterial('paint-horn-brown', { color: 0x5b3a22, roughness: 0.52, clearcoat: 0.25 }),
  horn2: namedMaterial('paint-horn-amber', { color: 0x98673a, roughness: 0.52, clearcoat: 0.25 }),
  horn3: namedMaterial('paint-horn-honey', { color: 0xc6a06a, roughness: 0.52, clearcoat: 0.25 }),
  horn4: namedMaterial('paint-horn-ivory', { color: 0xe8dcc0, roughness: 0.52, clearcoat: 0.25 }),
  horn4d: namedMaterial('paint-horn-ivory', { color: 0xe8dcc0, roughness: 0.52, clearcoat: 0.25, side: THREE.DoubleSide }),
  // 擋泥側裙：深煙褐（霧面）
  skirt: namedMaterial('paint-smoked-umber', { color: 0x2c2520, roughness: 0.66, clearcoat: 0.05 }),
  // 真金屬：金箍環、吹口套、喇叭口環邊（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xd2a83e, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  gold2: namedMaterial('trim-gold-brass', { color: 0xd2a83e, metalness: 0.85, roughness: 0.28, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 喇叭口內的深色喉部
  throat: namedMaterial('paint-horn-throat-black', { color: 0x16110d, roughness: 0.7 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x2a2a30, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x1b1715, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1613, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-umber', { color: 0x2c2520, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-umber', { color: 0x24201c, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dBronze: decalMaterial('decal-bronze-interlace', { color: 0x8a5a2b, metalness: 0.7, roughness: 0.35 }),
  dGold: decalMaterial('decal-gold-line', { color: 0xd2a83e, metalness: 0.75, roughness: 0.3 }),
  // 彩虹橋三色細環（《散文埃達》：彩虹橋「有三種顏色」，色相自訂、低彩度）
  ring1: decalMaterial('decal-bifrost-red', { color: 0xa8382c, roughness: 0.5 }),
  ring2: decalMaterial('decal-bifrost-ochre', { color: 0xd8a23c, roughness: 0.5 }),
  ring3: decalMaterial('decal-bifrost-teal', { color: 0x2f7f76, roughness: 0.5 }),
});

// ---------------------------------------------------------------------------
// Urnes 風格交織雙股紋（號角側面帶狀貼紙）
// ---------------------------------------------------------------------------

/**
 * 點到折線的最短距離
 * @type {(pl: number[][], u: number, v: number) => number}
 */
const polylineDist = (pl, u, v) => {
  let best = Infinity;
  for (let i = 0; i < pl.length - 1; i++) {
    const [ax, ay] = pl[i];
    const [bx, by] = pl[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(u - ax - t * dx, v - ay - t * dy));
  }
  return best;
};

/**
 * 一段交織帶：兩股細長獸身沿號角側面以正弦互相纏繞（交叉處一上一下交替），前端一股收成 Urnes 式杏仁形獸頭（眼睛留空），
 * 後端另一股捲成小渦；中心高度 yMid(u) 跟著號角中心線，振幅 amp(u) 跟著號角半徑
 * u = 往車頭為正的 x、v = y；回傳距離函式（負值 = 在紋樣內）
 * @type {(u0: number, u1: number, waves: number) => (u: number, v: number) => number}
 */
const interlaceBand = (u0, u1, waves) => {
  const n = 120;
  /** @type {number[][][]} 兩股的中心線 */
  const strands = [[], []];
  /** @type {number[]} 交叉點的 u */
  const crossings = [];
  for (let i = 0; i <= n; i++) {
    const u = lerp(u0, u1, i / n);
    const ph = (Math.PI * waves * (u - u0)) / (u1 - u0);
    const mid = P.yc(u) - 0.05 * P.ry(u);
    const amp = 0.36 * P.ry(u);
    strands[0].push([u, mid + amp * Math.sin(ph)]);
    strands[1].push([u, mid - amp * Math.sin(ph)]);
  }
  for (let k = 1; k < waves; k++) {
    crossings.push(u0 + ((u1 - u0) * k) / waves);
  }
  const w = 0.95;
  const gap = 0.5;
  // 獸頭（前端，第 0 股的終點附近）：杏仁形，往前上方
  const head = strands[0][n];
  // 小渦（後端，第 1 股的起點）
  const tail = strands[1][0];
  return (u, v) => {
    if (u < u0 - 6 || u > u1 + 6) {
      return 10;
    }
    const d0c = polylineDist(strands[0], u, v);
    const d1c = polylineDist(strands[1], u, v);
    let d0 = d0c - w / 2;
    let d1 = d1c - w / 2;
    crossings.forEach((cu, k) => {
      if (Math.abs(u - cu) > 3) {
        return;
      }
      if (k % 2 === 0) {
        d1 = Math.max(d1, w / 2 + gap - d0c);
      } else {
        d0 = Math.max(d0, w / 2 + gap - d1c);
      }
    });
    const hx = (u - head[0] - 2.4) / 3;
    const hy = (v - head[1] - 0.3) / 1.35;
    const dHead = Math.max((Math.hypot(hx, hy) - 1) * 1.35, -(Math.hypot(u - head[0] - 3.1, v - head[1] - 0.45) - 0.42));
    // 小渦：半徑 1.6 的圓環（線寬同股）
    const dTail = Math.abs(Math.hypot(u - tail[0] + 1.5, v - tail[1]) - 1.5) - w / 2;
    return Math.min(d0, d1, dHead, dTail);
  };
};

/** @type {((u: number, v: number) => number)[]} 兩段交織帶：前段（褐色段，箍環 47 與 26 之間）、後段（蜜色段，箍環 −19 與 −41 之間） */
const BANDS = [interlaceBand(29, 43.5, 3), interlaceBand(-38, -22, 3)];

// ---------------------------------------------------------------------------
// 實體件：吹口、喇叭口
// ---------------------------------------------------------------------------

/** @type {number} 喇叭口軸心高度 */
const BELL_Y = 28.5;
/** @type {number} 喇叭口接合處的垂直 / 水平比例（同殼面車尾斷面 ry / rz） */
const BELL_K = 14.2 / 21;
/** @type {number} 喇叭口環邊的垂直 / 水平比例（往後越扁：喇叭口寬、高度不超過 46） */
const BELL_K_END = 0.55;
/** @type {number} 喇叭口長度（x −63 → −70.5） */
const BELL_LEN = 7.5;
/** @type {number} 喇叭口環邊半徑（水平） */
const BELL_R = 31;

/**
 * 喇叭口外張薄殼（繞 x 軸，橢圓斷面：y 方向比例由 BELL_K 漸變到 BELL_K_END）：pts 為 [半徑, 往後的距離]
 * @type {(pts: number[][], seg?: number) => THREE.BufferGeometry}
 */
const bellShell = (pts, seg = 72) => {
  /** @type {number[]} */
  const pos = [];
  /** @type {(i: number, j: number) => number[]} 第 i 圈、第 j 個角度的頂點 */
  const P3 = (i, j) => {
    const [r, a] = pts[i];
    const k = lerp(BELL_K, BELL_K_END, a / BELL_LEN);
    const t = (2 * Math.PI * j) / seg;
    return [-63 - a, BELL_Y + r * k * Math.sin(t), r * Math.cos(t)];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const A = P3(i, j);
      const B = P3(i, j + 1);
      const C = P3(i + 1, j + 1);
      const D = P3(i + 1, j);
      pos.push(...A, ...B, ...C, ...A, ...C, ...D);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @type {(a: number) => number} 喇叭口外張曲線（a = 往後距離 0 → BELL_LEN） */
const bellR = (a) => 21 + (BELL_R - 21) * (a / BELL_LEN) ** 2.2;

/**
 * 吹口：殼前端往前、往上翹的細管（金色吹口套＋杯形唇）
 * @type {() => { tube: THREE.BufferGeometry, cup: THREE.BufferGeometry }}
 */
const buildMouthpiece = () => {
  const tube = sweepEllipse(
    [
      [64.5, 26, 0],
      [69, 26.6, 0],
      [72.6, 28, 0],
      [75, 30, 0],
    ],
    24,
    (t) => [lerp(4, 2.3, t), lerp(3.6, 2.2, t)],
    18,
  );
  // 杯形唇：短的外張圓環（實心旋轉體），軸沿吹口末端切線
  const cupPts = [
    [1.6, 0],
    [2.5, 0],
    [3.1, 1.5],
    [3.3, 2.1],
    [2.6, 2.1],
    [1.6, 0.8],
    [1.6, 0],
  ].map(([r, a]) => new THREE.Vector2(r, a));
  const cup = new THREE.LatheGeometry(cupPts, 28);
  // 軸 y → 吹口末端切線方向（往前上方約 40°）
  cup.rotateZ(-Math.PI / 2 + 0.7);
  cup.translate(74.6, 29.6, 0);
  return { tube, cup };
};

export const gjallarhornBody = makePolyBody({
  id: 'body-gjallarhorn',
  name: '加拉爾號角',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'gjallarhorn',
  form: 'horn-bell',
  roof: 'canopy',
  wing: 'bell-flare',
  theme: '加拉爾號角：整台車是一支平放的微彎號角——上翹的細吹口往後漸粗，車尾橢圓喇叭口開口朝後（金環邊＋口內三色細環），牛角深褐到象牙的漸層、6 道金箍環與青銅交織雙股紋，兩側深色低輪罩蓋住輪胎',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 號角與低谷的交接、輪罩頂內緣是銳利稜線
  hard: [4, 6, 7],
  wheelArches: ARCHES,
  openings: [HORN_GAP],
  canopy: {
    section: 'ellipse',
    // 座艙罩 x 21 → −13，最寬 6.6、高 5.8（坐在號角頂上）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 28; i++) {
        const u = i / 28;
        const x = lerp(CANOPY.xc + CANOPY.a, CANOPY.xc - CANOPY.a, u);
        out.push({ x, yBase: 0, yTop: 5.8 * Math.sin(Math.PI * u ** 0.85) ** 0.6, halfW: Math.max(1.8, canopyHalfW(x)) });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => {
    /** @type {(x: number, y: number, z: number) => number} 號角區（交接線以上） */
    const onHorn = (x, y, z) => Math.min(y - (Math.min(yValley(x), P.yc(x)) + 0.25), junctionZ(x) + 0.1 - Math.abs(z));
    return [
      { mat: 'horn0', keep: (x, y, z) => Math.min(onHorn(x, y, z), x - HOOP_X[1]) },
      { mat: 'horn1', keep: (x, y, z) => Math.min(onHorn(x, y, z), x - HOOP_X[2]) },
      { mat: 'horn2', keep: (x, y, z) => Math.min(onHorn(x, y, z), x - HOOP_X[3]) },
      { mat: 'horn3', keep: (x, y, z) => Math.min(onHorn(x, y, z), x - HOOP_X[4]) },
      { mat: 'horn4', keep: onHorn },
      { mat: 'skirt', keep: () => 1 },
    ];
  },
  mats: { inner: 'inner', edge: 'edge', cap: 'throat', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後，淺：只遮住殼內空腔）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 31, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 金箍環：號角殼面上凸起 0.45 mm 的環帶（只在號角區，避開座艙罩）
    const hoopKeep = (x, y, z) => {
      let d = Infinity;
      for (const hx of HOOP_X) {
        d = Math.min(d, Math.abs(x - hx) - HOOP_W / 2);
      }
      return Math.min(-d, y - (Math.min(yValley(x), P.yc(x)) + 0.25), junctionZ(x) + 0.1 - Math.abs(z), -kit.underCanopy(x, z));
    };
    const hoops = buildRegion(kit.surf, [...kit.holes, hoopKeep], { offset: 0.45 });
    parts.push({ geometry: hoops.geometry, mat: 'gold', shell: true, name: 'gold-hoops' });
    parts.push({ geometry: buildRim(hoops, 0, 0.45), mat: 'gold2', name: 'gold-hoops-wall' });
    // 座艙罩金色細框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > CANOPY.xc - CANOPY.a - 1.2 && x < CANOPY.xc + CANOPY.a + 1.2 ? Math.min(u + 1.0, 0.05 - u) : -1;
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // 號角側面交織雙股紋，左右鏡射（獸頭都朝車頭）：前段在深褐段用金色、後段在蜜色段用青銅（只貼在號角區，不貼到輪罩）
    for (const [band, mat, side] of [
      [BANDS[0], 'dGold', -1],
      [BANDS[0], 'dGold', 1],
      [BANDS[1], 'dBronze', -1],
      [BANDS[1], 'dBronze', 1],
    ]) {
      const keepSide = sideDecal(
        (u, v) => {
          const yLo = Math.min(yValley(u), P.yc(u)) + 1;
          if (v < yLo) {
            return 10;
          }
          return band(u, v);
        },
        { x0: 0, y0: 0, zMin: 4, side },
      );
      parts.push({
        geometry: kit.decal((x, y, z) => Math.min(keepSide(x, y, z), junctionZ(x) - 0.2 - Math.abs(z))),
        mat,
        name: `decal-urnes-interlace-${mat}-${side}`,
      });
    }
    // 輪罩頂的金色細腰線（沿輪罩外緣，線寬 0.7）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        const hw = P.hw(x);
        return Math.min(0.35 - Math.abs(az - (hw - 2.6)), y - yFender(x) + 0.6, 62 - x, x + 62);
      }),
      mat: 'dGold',
      name: 'decal-fender-line',
    });
    // 吹口（實體，金色吹口套）
    const mp = buildMouthpiece();
    parts.push({ geometry: mergeGeos([mp.tube, mp.cup]), mat: 'gold', solid: true, outline: true, name: 'mouthpiece' });
    // 喇叭口：外張的薄殼（象牙，雙面）＋金色環邊（實心環）
    /** @type {number[][]} */
    const flare = [];
    for (let i = 0; i <= 16; i++) {
      const a = (BELL_LEN * i) / 16;
      flare.push([bellR(a), a]);
    }
    parts.push({ geometry: bellShell(flare), mat: 'horn4d', shell: true, outline: true, name: 'bell-flare' });
    const rim = new THREE.TorusGeometry(BELL_R + 0.2, 0.95, 10, 72);
    // 環面在 (x, y) 平面 → 轉到 (z, y) 平面，再壓成橢圓
    rim.rotateY(Math.PI / 2);
    rim.scale(1, BELL_K_END, 1);
    rim.translate(-63 - BELL_LEN, BELL_Y, 0);
    parts.push({ geometry: rim, mat: 'gold', solid: true, outline: true, name: 'bell-rim' });
    // 喇叭口內：後封口上的三色細環（彩虹橋）與中央深色喉部（環在後封口外 0.08 mm）
    /** @type {(r0: number, r1: number) => THREE.BufferGeometry} */
    const ring = (r0, r1) => {
      const g = new THREE.RingGeometry(r0, r1, 72);
      g.rotateY(-Math.PI / 2);
      g.scale(1, BELL_K, 1);
      g.translate(-63.08, BELL_Y, 0);
      return g;
    };
    parts.push({ geometry: ring(16.2, 17.1), mat: 'ring1', name: 'decal-bifrost-ring-1' });
    parts.push({ geometry: ring(14.6, 15.5), mat: 'ring2', name: 'decal-bifrost-ring-2' });
    parts.push({ geometry: ring(13, 13.9), mat: 'ring3', name: 'decal-bifrost-ring-3' });
    // 喇叭口內緣一圈金色細線（後封口上，喇叭接合處）
    parts.push({ geometry: ring(19.6, 20.4), mat: 'dGold', name: 'decal-bell-throat-line' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；喇叭口外張片、金箍環以殼面積 × 壁厚計入質量',
    geometry: '本檔站位產生器 P（推估）：殼 x −63 ~ 66、吹口到 78.3、喇叭口到 −71.4（長 149.7，batch4「長約 146–153」）；號角頂 29 → 43、喇叭口頂 46.2（batch4「高約 40–46」）；輪罩半寬前 37.5、後 39.2（蓋住輪胎），兩輪之間收腰 27.5，車頭收到 11；前輪罩與號角之間（x 23 以前）挖空，號角在兩輪罩間懸空',
    horn: '號角斷面：水平半徑 4.2（吹口根）→ 21（喇叭接合處）、垂直半徑 3.8 → 14.2；中心線高度 26 → 28.5（推估，側視緩弧）',
    bell: '喇叭口：橢圓外張薄殼（垂直 / 水平比例由接合處 0.68 漸變到環邊 0.55），長 7.5、環邊水平半徑 31（車寬內、離後導輪 ≥ 3 mm）、金色實心環邊管徑 1.9 mm（推估）；口內三色細環線寬 0.9 mm',
    hoops: '6 道金箍環：寬 2、凸起 0.45 mm（推估：飲用角的金屬箍以殼面凸帶表現）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；內襯從 |z| 31 到殼內面',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
