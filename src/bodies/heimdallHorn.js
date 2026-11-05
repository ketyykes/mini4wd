// 海姆達爾的號角（body-heimdall-horn，神話組・北歐）：守護彩虹橋的海姆達爾在諸神黃昏吹響的號角 Gjallarhorn。
// 號角融進車身，不是一支躺在車上的樂器：
// (1) 號角的錐形 → 車身中脊：鼻端是一支細而低的尖鼻錐（深色，鼻尖一段金色），接上和兩側輪罩同色的深色細脊，過了座艙前的金環才變成象牙色，
//     往後一路擴張成引擎罩，車尾張開成壓扁的排氣喇叭口（金色環邊＋4 片金色導流片＋兩側刀形端板＝擴散器 / 尾翼一體）；
// (2) 金屬箍環 → 車身上的 6 道金色環帶（貼紙）；
// (3) 彩虹橋 Bifröst → 一道從鼻尖沿中脊掃到車尾、跟著號角變寬的三色條紋（低彩度的銅紅、赭金、青綠），喇叭口內再三道同色細環；
// (4) 兩段 Urnes 風格交織雙股紋（自繪曲線）、深色輪罩圓肩上一條從鼻尖到喇叭口漸粗的金色速度線。
// 號角兩側是低平的深色擋泥側裙（前後輪罩，兩輪之間收腰），蓋住輪胎；前段中脊在兩個輪罩之間懸空。
// 設計：shared/design/body-heimdall-horn/DESIGN.md（典故：《散文埃達》Gylfaginning；語彙：維京時代飲用角的金屬配件、Urnes 交織紋 MYTH_RESEARCH N8）。
// 塗裝全為自創；不用盧恩字母、不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, fenderFloor, smoothMax } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildBellySkirt } from './trojanHorse.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 號角參數的站位（x 由後到前，前後軸 x = ±40）：喇叭口接合處 −63、殼前端 66（再往前是實心鼻錐） */
const XS = [-63, -58, -50, -40, -30, -15, 0, 15, 30, 40, 50, 60, 66];
/** @type {number[]} 側裙半寬的站位 */
const XS_HW = [-63, -60, -50, -40, -28, -18, -5, 10, 20, 28, 40, 50, 56, 60, 66];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 號角中心線高度：由車尾 27 往前降到殼前端 21.5，配合下方 ry，中脊頂由 24 一路升到喇叭口 44——側視是一道往後變粗的楔形
  yc: monoCurve(XS, [27, 27, 26.8, 26.5, 26.2, 25.6, 25, 24.4, 23.8, 23.4, 22.8, 22, 21.5]),
  // 號角斷面半徑（水平 × 垂直）：殼前端 4 × 2.5 → 喇叭口接合處 22 × 17（中脊頂 = yc + ry：24 → 27 → 33.5（前軸）→ 38.5（座艙）→ 42（後軸）→ 44）
  rz: monoCurve(XS, [22, 20, 17.5, 15.2, 13.6, 12.2, 11, 10, 9.2, 8.4, 7, 5.2, 4]),
  ry: monoCurve(XS, [17, 16.6, 16.2, 15.5, 15, 14.4, 13.5, 12.6, 11.2, 10.1, 8.2, 5, 2.5]),
  // 側裙俯視半寬：前後輪罩外張（前 37.5、後 39.2，蓋住輪胎），兩輪之間收成 27.5 的細腰（只剩號角＋窄側裙），車頭收到 11
  hw: monoCurve(XS_HW, [33, 37, 39.2, 39.2, 37.5, 30, 27.5, 28, 32, 37, 37.5, 34, 27, 19, 11]),
  // 側裙下緣
  yLow: monoCurve(XS_HW, [18, 16.5, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15.2, 15.6, 16.2, 17]),
};

/** @type {number[][]} 鼻錐中心線 (x, y)：從殼前端的中脊往前、微往下伸到鼻尖 x 77.5（比殼前端的寬車頭細，俯視是一支細尖鼻） */
const NOSE_PATH = [
  [64.5, 21.5],
  [69, 21.1],
  [73.5, 20.4],
  [77.5, 19.6],
];
/** @type {number} 鼻錐前段換成金色鼻尖套的位置（沿中心線的比例） */
const NOSE_TIP_T = 0.62;

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
 * 號角兩側的前段低谷挖空（俯視開口，x 23 以前）：中脊在兩個前輪罩之間懸空
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

/** @type {{ x: number, pts: number[][] }[]} 車尾外張段每 1.1 mm 一站，其餘每 2 mm */
const STATIONS = [...buildStations(-63, -52, 1.1, profile).slice(0, -1), ...buildStations(-52, 66, 2, profile)];

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

/** @type {number[]} 金色環帶中心 x（由前往後）：鼻段兩道，x 26 那一道是深色鼻段和象牙色引擎罩的交界 */
const HOOP_X = [61, 47, 26, -19, -41, -56];
/** @type {number} 環帶寬 */
const HOOP_W = 2;
/** @type {number} 象牙色引擎罩的前緣 x（這裡以前的中脊和輪罩同色） */
const IVORY_X = HOOP_X[2];

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 鼻段中脊：深褐近黑（緞面）；引擎罩到喇叭口：奶油象牙（緞面：paint- 且 roughness > 0.5 → Blender 緞面）
  hornDark: namedMaterial('paint-horn-umber-black', { color: 0x2a1d15, roughness: 0.52, clearcoat: 0.25 }),
  hornDarkSolid: namedMaterial('paint-horn-umber-black', { color: 0x2a1d15, roughness: 0.52, clearcoat: 0.25, side: THREE.DoubleSide }),
  ivory: namedMaterial('paint-horn-ivory', { color: 0xe8dcc0, roughness: 0.52, clearcoat: 0.25 }),
  ivory2: namedMaterial('paint-horn-ivory', { color: 0xe8dcc0, roughness: 0.52, clearcoat: 0.25, side: THREE.DoubleSide }),
  // 擋泥側裙：深煙褐（霧面）
  skirt: namedMaterial('paint-smoked-umber', { color: 0x2c2520, roughness: 0.66, clearcoat: 0.05 }),
  // 真金屬：鼻尖套、喇叭口環邊與導流片（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xd2a83e, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
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
  // 彩虹橋三色（《散文埃達》：彩虹橋「有三種顏色」，色相自訂、低彩度的金屬色）：中脊條紋與喇叭口內的細環共用，
  // 帶低強度自發光（Blender 不過曝）
  bifrost1: decalMaterial('decal-bifrost-red', { color: 0xa8382c, roughness: 0.4, metalness: 0.45, emissive: 0xa8382c, emissiveIntensity: 0.3 }),
  bifrost2: decalMaterial('decal-bifrost-ochre', { color: 0xd8a23c, roughness: 0.4, metalness: 0.45, emissive: 0xd8a23c, emissiveIntensity: 0.25 }),
  bifrost3: decalMaterial('decal-bifrost-teal', { color: 0x2f7f76, roughness: 0.4, metalness: 0.45, emissive: 0x2f7f76, emissiveIntensity: 0.3 }),
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
 * 一段交織帶：兩股細帶沿號角側面以正弦互相纏繞（交叉處一上一下交替），後端一股捲成小渦；中心高度 yMid(u) 跟著號角中心線，振幅 amp(u) 跟著號角半徑
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
    // 小渦：半徑 1.6 的圓環（線寬同股）
    const dTail = Math.abs(Math.hypot(u - tail[0] + 1.5, v - tail[1]) - 1.5) - w / 2;
    return Math.min(d0, d1, dTail);
  };
};

/** @type {((u: number, v: number) => number)[]} 兩段交織帶：前段（深色鼻段，環帶 47 與 26 之間）、後段（象牙色引擎罩，環帶 −19 與 −41 之間） */
const BANDS = [interlaceBand(29, 43.5, 3), interlaceBand(-38, -22, 3)];

// ---------------------------------------------------------------------------
// 實體件：喇叭口
// ---------------------------------------------------------------------------

/** @type {number} 喇叭口軸心高度 */
const BELL_Y = 27;
/** @type {number} 喇叭口接合處的水平半徑（同殼面車尾 rz） */
const BELL_R0 = 22;
/** @type {number} 喇叭口接合處的垂直 / 水平比例（同殼面車尾斷面 ry / rz） */
const BELL_K = 17 / 22;
/**
 * @type {number} 喇叭口環邊的垂直 / 水平比例（往後橫向外張、垂直收扁成車尾擴散器 / 尾翼一體的扁口）
 */
const BELL_K_END = 0.5;
/** @type {number} 喇叭口長度（x −63 → −70.5） */
const BELL_LEN = 7.5;
/** @type {number} 喇叭口環邊半徑（水平；不做太大，避免喇叭口像樂器擺件） */
const BELL_R = 27;

/**
 * 喇叭口外張薄殼（繞 x 軸，橢圓斷面：y 方向比例由 BELL_K 漸變到 BELL_K_END）：pts 為 [半徑, 往後的距離]
 * @type {(pts: number[][], seg?: number) => THREE.BufferGeometry}
 */
const bellShell = (pts, seg = 40) => {
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
const bellR = (a) => BELL_R0 + (BELL_R - BELL_R0) * (a / BELL_LEN) ** 2.2;

export const heimdallHornBody = makePolyBody({
  id: 'body-heimdall-horn',
  name: '海姆達爾的號角',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'heimdall-horn',
  form: 'horn-bell',
  roof: 'canopy',
  wing: 'bell-flare',
  theme: '加拉爾號角融進車身：細而低的深色尖鼻錐（金色鼻尖）往後擴張成象牙色引擎罩，車尾壓扁的喇叭口當擴散器（金環邊＋金色導流片＋口內三色細環）；彩虹橋是一道從鼻尖沿中脊掃到車尾、越往後越寬的銅紅、赭金、青綠三色條紋；6 道金色環帶、交織雙股紋，深色輪罩肩上一條從鼻尖到喇叭口的金色速度線，兩側深色低輪罩蓋住輪胎',
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
    // 座艙罩 x 21 → −13，最寬 6.6、高 5.0（坐在號角頂上）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 28; i++) {
        const u = i / 28;
        const x = lerp(CANOPY.xc + CANOPY.a, CANOPY.xc - CANOPY.a, u);
        out.push({ x, yBase: 0, yTop: 5.0 * Math.sin(Math.PI * u ** 0.85) ** 0.6, halfW: Math.max(1.8, canopyHalfW(x)) });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => {
    /** @type {(x: number, y: number, z: number) => number} 號角區（交接線以上） */
    const onHorn = (x, y, z) => Math.min(y - (Math.min(yValley(x), P.yc(x)) + 0.25), junctionZ(x) + 0.1 - Math.abs(z));
    return [
      { mat: 'hornDark', keep: (x, y, z) => Math.min(onHorn(x, y, z), x - IVORY_X) },
      { mat: 'ivory', keep: onHorn },
      { mat: 'skirt', keep: () => 1 },
    ];
  },
  mats: { inner: 'inner', edge: 'edge', cap: 'throat', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 腹側裙板（燻黑褐，和側裙同色）：前後輪拱之間 x −21.5 → 21.5、外緣 |z| 35.5（底盤側框外緣）、
    // y 10.5 → 15.6，頂部棚板從側裙下緣內側（半寬 − 1.2）接出，把側裙下緣到底盤側框之間的電池艙側面封住
    parts.push({
      geometry: buildBellySkirt({ x0: -21.5, x1: 21.5, zIn: (x) => P.hw(x) - 1.2, zOut: 35.5, yTop: 15.6 }),
      mat: 'skirt',
      solid: true,
      outline: true,
      name: 'belly-skirt',
    });
    // 輪拱內襯（前後，淺：只遮住殼內空腔）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 31, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    /** @type {(x: number, y: number, z: number) => number} 號角區且不在座艙罩下（正值 = 可貼） */
    const onHornDeck = (x, y, z) => Math.min(y - (Math.min(yValley(x), P.yc(x)) + 0.25), junctionZ(x) + 0.1 - Math.abs(z), -kit.underCanopy(x, z));
    // 彩虹橋條紋：沿中脊頂從鼻尖掃到喇叭口的三道並排色帶（銅紅、赭金、青綠），每道寬 = 號角水平半徑的 0.16 倍（最細 0.6），越往後越寬
    /** @type {[string, number][]} [材質, 色帶中心相對中線的道數] */
    const lanes = [
      ['bifrost1', -1],
      ['bifrost2', 0],
      ['bifrost3', 1],
    ];
    for (const [mat, lane] of lanes) {
      parts.push({
        geometry: kit.decal((x, y, z) => {
          const w = Math.max(0.6, 0.16 * P.rz(x));
          return Math.min(onHornDeck(x, y, z), y - P.yc(x), w / 2 - Math.abs(z - lane * w));
        }),
        mat,
        name: `decal-bifrost-stripe-${lane + 1}`,
      });
    }
    // 金色環帶：號角上 6 道橫向環帶（只在號角區，避開座艙罩），蓋在彩虹橋條紋上面
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(onHornDeck(x, y, z), ...[HOOP_W / 2 - Math.min(...HOOP_X.map((hx) => Math.abs(x - hx)))]), { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-gold-hoops',
    });
    // 座艙罩金色細框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > CANOPY.xc - CANOPY.a - 1.2 && x < CANOPY.xc + CANOPY.a + 1.2 ? Math.min(u + 1.0, 0.05 - u) : -1;
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // 號角側面交織雙股紋，左右鏡射：前段在深色鼻段用金色、後段在象牙色引擎罩用青銅（只貼在號角區，不貼到輪罩）
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
    // 金色速度線——沿深色輪罩外緣的圓肩，從殼前端（x 64，寬 0.6）一路往後漸粗到喇叭口（x −63，寬 1.8），
    // 跟著輪罩俯視的收腰外擴走
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        const hw = P.hw(x);
        const half = lerp(0.9, 0.3, Math.min(1, Math.max(0, (x + 63) / 127)));
        return Math.min(half - Math.abs(az - (hw - 1.1)), y - yFender(x) + 2.6, 64 - x, x + 63);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-gold-speed-line',
    });
    // 鼻錐（實心）：圓斷面由 3.4 × 2.8 收到 1.5，後段深色、前段金色鼻尖套；根部埋進殼前端
    {
      /** @type {(t: number) => number[]} 沿中心線比例 t 的斷面半徑（水平, 垂直） */
      const noseR = (t) => [lerp(3.4, 1.5, t), lerp(2.8, 1.5, t)];
      /** @type {(t0: number, t1: number) => THREE.BufferGeometry} 鼻錐的一段 */
      const noseSeg = (t0, t1) => {
        const pts = [0, 1 / 3, 2 / 3, 1].map((k) => {
          const t = lerp(t0, t1, k) * (NOSE_PATH.length - 1);
          const i = Math.min(NOSE_PATH.length - 2, Math.floor(t));
          return [lerp(NOSE_PATH[i][0], NOSE_PATH[i + 1][0], t - i), lerp(NOSE_PATH[i][1], NOSE_PATH[i + 1][1], t - i), 0];
        });
        return sweepEllipse(pts, 6, (k) => noseR(lerp(t0, t1, k)), 12);
      };
      parts.push({ geometry: noseSeg(0, NOSE_TIP_T), mat: 'hornDarkSolid', solid: true, outline: true, name: 'nose-cone' });
      parts.push({ geometry: noseSeg(NOSE_TIP_T - 0.02, 1), mat: 'gold', solid: true, outline: true, name: 'nose-cone-tip' });
    }
    // 喇叭口：外張的薄殼（象牙，雙面）＋金色環邊（實心環）
    /** @type {number[][]} */
    const flare = [];
    for (let i = 0; i <= 8; i++) {
      const a = (BELL_LEN * i) / 8;
      flare.push([bellR(a), a]);
    }
    parts.push({ geometry: bellShell(flare), mat: 'ivory2', shell: true, outline: true, name: 'bell-flare' });
    const rim = new THREE.TorusGeometry(BELL_R + 0.2, 0.95, 8, 40);
    // 環面在 (x, y) 平面 → 轉到 (z, y) 平面，再壓成橢圓
    rim.rotateY(Math.PI / 2);
    rim.scale(1, BELL_K_END, 1);
    rim.translate(-63 - BELL_LEN, BELL_Y, 0);
    parts.push({ geometry: rim, mat: 'gold', solid: true, outline: true, name: 'bell-rim' });
    // 喇叭口內：後封口上的三色細環（彩虹橋）與中央深色喉部（環在後封口外 0.08 mm）
    /** @type {(r0: number, r1: number) => THREE.BufferGeometry} */
    const ring = (r0, r1) => {
      const g = new THREE.RingGeometry(r0, r1, 40);
      g.rotateY(-Math.PI / 2);
      g.scale(1, BELL_K, 1);
      g.translate(-63.08, BELL_Y, 0);
      return g;
    };
    parts.push({ geometry: ring(17, 18), mat: 'bifrost1', name: 'decal-bifrost-ring-1' });
    parts.push({ geometry: ring(15.3, 16.3), mat: 'bifrost2', name: 'decal-bifrost-ring-2' });
    parts.push({ geometry: ring(13.6, 14.6), mat: 'bifrost3', name: 'decal-bifrost-ring-3' });
    // 喇叭口內緣一圈金色細線（後封口上，喇叭接合處）
    parts.push({ geometry: ring(20.4, 21.3), mat: 'dGold', name: 'decal-bell-throat-line' });
    // ── 擴散器導流片（實體，金色）：喇叭口下半部 4 片縱向導流片（厚 1.2、高 4.2），從後封口往後拉到環邊，
    // 喇叭口讀成車尾擴散器（號角＝排氣 / 擴散器）──
    {
      /** @type {THREE.BufferGeometry[]} */
      const strakes = [];
      for (const zc of [-13, -5, 5, 13]) {
        /** @type {(a: number) => number} 該 z 處喇叭口內面的底高（往上 0.3 埋進殼面） */
        const floorY = (a) => {
          const r = bellR(a);
          const k = lerp(BELL_K, BELL_K_END, a / BELL_LEN);
          return BELL_Y - k * Math.sqrt(Math.max(0, r * r - zc * zc)) + 0.3;
        };
        const pts = [
          [-63.2, floorY(0)],
          [-63 - BELL_LEN + 0.4, floorY(BELL_LEN - 0.4)],
          [-63 - BELL_LEN + 0.4, floorY(BELL_LEN - 0.4) + 2.4],
          [-63.2, floorY(0) + 4.2],
        ];
        strakes.push(finPlate(pts, zc, 1.2));
      }
      parts.push({ geometry: mergeGeos(strakes), mat: 'gold', solid: true, outline: true, name: 'bell-diffuser-strakes' });
    }
    // ── 喇叭口兩側的貼身端板（深煙褐、厚 1.2，金色環邊外 0.4 mm），側視是刀形：前緣從號角側面斜升、後緣垂直，
    // 喇叭口＋端板讀成車尾擴散器 / 尾翼的一體造型 ──
    {
      const zc = BELL_R + 1.6;
      const plate = [
        [-62.5, 28],
        [-66.5, 37],
        [-71.9, 38],
        [-71.9, 21],
        [-67.5, 21.5],
      ];
      parts.push({
        geometry: mergeGeos([finPlate(plate, zc, 1.2), finPlate(plate, -zc, 1.2)]),
        mat: 'skirt',
        solid: true,
        outline: true,
        name: 'bell-endplates',
      });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；喇叭口外張片以殼面積 × 壁厚計入質量',
    geometry: '本檔站位產生器 P（推估）：殼 x −63 ~ 66、實心鼻錐到 77.5、喇叭口環邊到 −71.4、端板到 −72.1（外框長約 149.6）；中脊頂 24（殼前端）→ 44（喇叭口接合處，全車最高）、座艙罩頂約 43；輪罩半寬前 37.5、後 39.2（蓋住輪胎），兩輪之間收腰 27.5，車頭收到 11；前輪罩與中脊之間（x 23 以前）挖空，中脊在兩輪罩間懸空',
    horn: '號角斷面：水平半徑 4（殼前端）→ 22（喇叭接合處）、垂直半徑 2.5 → 17；中心線高度 21.5 → 27（推估，側視緩弧）；鼻錐為 ABS 實心件，圓斷面 3.4 × 2.8 → 1.5，長 13',
    bell: '喇叭口：橢圓外張薄殼（垂直 / 水平比例由接合處 0.77 漸變到環邊 0.5），長 7.5、環邊水平半徑 27、金色實心環邊管徑 1.9 mm；下半部 4 片擴散器導流片厚 1.2、高 2.4–4.2 mm（推估）；兩側刀形貼身端板厚 1.2 mm；口內三色細環線寬 1.0 mm',
    hoops: '6 道金色環帶：寬 2 的貼紙（推估：飲用角的金屬箍以環帶表現）；彩虹橋條紋每道寬 = 號角水平半徑 × 0.16（0.6–3.5 mm）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；內襯從 |z| 31 到殼內面',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
