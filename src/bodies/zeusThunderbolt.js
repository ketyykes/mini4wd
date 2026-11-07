// 宙斯雷霆（body-zeus-thunderbolt，神話組・希臘）：只用宙斯的持物與象徵，車上沒有人像、臉、手或神像。
// 照四視圖 10 建模：細長低楔車頭、前端分岔成兩支往前伸的水平叉刃（中央鼻較短，俯視是一道叉口）、
// 座艙後隆起一道中脊，車尾伸出一支錐形尖尾，尖尾末端十字交叉的尾鰭（雷霆杖的柄頭）。
// 元素：
// (1) 雷霆杖 keraunos → 前端兩支鋸齒形水平叉刃（金）、車尾錐形尖尾＋十字鰭、側面鈷藍／白的鋸齒閃電折線（金色寬邊）、引擎蓋中線一道金色閃電；
// (2) 橡樹（多多納的宙斯神諭橡樹）→ 後擋泥板頂面一對金色橡葉（葉緣圓裂片）；
// (3) 神殿柱 → 後中脊上的縱向柱身溝槽（淺色細線）。
// 設計：shared/design/body-zeus-thunderbolt/DESIGN.md（典故來源與文物對應寫在 DESIGN.md）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、參數表到 72（殼只做到中央鼻端 NOSE_X，兩支閃電前翼再往前到 77.5） */
const XS = [-70, -66, -60, -52, -40, -28, -16, -5, 5, 15, 25, 35, 45, 52, 58, 63, 68, 72];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-70, -66, -60, -54, -46, -40, -30, -20, -10, 0, 10, 20, 30, 40, 48, 54, 58, 63, 68, 72];

/** @type {{ x: number, y: number, r: number }[]} 擋泥板眉線：以輪拱圓心為圓心、半徑 18.5（R17.5 輪拱外 1 mm）的圓弧 */
const BROWS = [
  { x: 40, y: 13, r: 18.5 },
  { x: -40, y: 13, r: 18.5 },
];

/**
 * 平滑取大值（交接處用半徑 k 的圓角接起來）
 * @type {(a: number, b: number, k: number) => number}
 */
const smoothMax = (a, b, k) => (a + b + Math.sqrt((a - b) ** 2 + k * k)) / 2;

/** @type {(x: number) => number} 擋泥板眉線高度（圓弧外回傳 0） */
const browY = (x) => {
  let y = 0;
  for (const b of BROWS) {
    const dx = x - b.x;
    if (Math.abs(dx) < b.r) {
      y = Math.max(y, b.y + Math.sqrt(b.r ** 2 - dx * dx));
    }
  }
  return y;
};

/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線殼頂：鼻端 14.6 → 前軸 33 的長楔；座艙段 34；座艙後隆起一道中脊（x −28 最高 44.5），往後降成車尾 31.5，接上錐形尖尾
  yTop: monoCurve(XS, [31.5, 34.5, 38, 41, 43.5, 44.5, 43, 37.5, 34.6, 34, 33.6, 33, 32.3, 29.2, 25.2, 21.4, 17.6, 14.6]),
  // 中脊高（中線殼頂 − 中脊兩側甲板）：只在座艙後；座艙前是整片微拱的引擎蓋
  crest: monoCurve(XS, [2.5, 3.5, 5, 7, 9, 10, 9, 3, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02]),
  // 中脊半寬：車尾尖錐 4 → 後軸 10.5
  crestW: monoCurve(XS, [4, 6, 8, 9.5, 10.5, 11, 11, 10, 9, 9, 9, 9, 9, 8, 6, 4.5, 3, 2]),
  // 肩稜線基本高度（前後輪上方再沿眉線拱起）
  yS: monoCurve(XS, [27, 28, 29, 29.5, 30, 30, 29.5, 29, 29, 29, 29.2, 29.5, 27.5, 23.5, 19, 16.2, 14.2, 13]),
  // 俯視半寬：兩輪之間的側箱一路寬到 30（把底盤側框蓋住），前後輪上方 31，車尾收成 6 的尖錐，車頭 5.5
  hw: monoCurve(XS_HW, [6, 10, 15, 22, 28, 31, 31, 30.5, 30, 30, 30, 30.5, 31, 31, 29, 24.5, 20, 13.5, 8, 5.5]),
  // 側裙下緣：兩輪之間壓到 11.5，把底盤側框封起來；後輪後方往上收（車尾下緣 24），尾段收進錐形尖尾
  yLow: monoCurve(XS, [24, 20, 15.5, 12.5, 12, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 12, 12.5, 13, 13, 13, 13, 13]),
};

/** @type {(x: number) => number} 肩稜線（含眉線） */
const shoulderY = (x) => smoothMax(P.yS(x), browY(x), 1.2);

/**
 * 半剖面 8 點：中線 → 中脊頂 → 中脊側稜（銳利）→ 甲板 → 引擎蓋外緣 → 肩稜線（銳利）→ 微外張的側裙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const c = P.crest(x);
  const d = t - c;
  const h = P.hw(x);
  const s = Math.min(shoulderY(x), d - 0.3);
  const lo = P.yLow(x);
  const cw = Math.min(P.crestW(x), 0.32 * h);
  // 中脊側稜到甲板的距離：中脊高的地方 1.8（陡的側壁），沒有中脊的引擎蓋段放寬到 3，剖面點間距均勻、殼面不起皺
  const g = lerp(3, 1.8, smoothstep(0.5, 4, c));
  const zIn = cw + g;
  const flare = smoothstep(1, 8, h);
  return [
    [0, t],
    [0.6 * cw, t - 0.12 * c],
    [cw, d + 0.3 * c],
    [zIn, d],
    [lerp(zIn, h, 0.6), d - 0.4 * (d - s)],
    [h, s],
    [h + 0.7 * flare, lerp(s, lo, 0.5)],
    [h + 1.1 * flare, lo],
  ];
};

/** @type {number} 中央鼻端 x：兩支閃電前翼之間留一道深叉口（俯視 V 形缺口） */
const NOSE_X = 64;

/** @type {{ x: number, pts: number[][] }[]} 車尾與車鼻每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-70, -60, 1, profile).slice(0, -1), ...buildStations(-60, 56, 2, profile).slice(0, -1), ...buildStations(56, NOSE_X, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 5、前後半長 21、半寬 10.5） */
const CANOPY = { xc: 5, a: 21, b: 10.5, n: 2.2 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/**
 * 側面鋸齒分色線（雷霆的閃電）：白色上半與電光藍下半的交界，從鼻端往後斜升，中途兩次往下折回，側視是一道往後的閃電
 * @type {number[][]} (x, y) 折點，由前往後
 */
const BOLT_LINE = [
  [73, 15],
  [26, 26],
  [19, 21],
  [-27, 29.5],
  [-34, 24.5],
  [-71, 30.5],
];

/** @type {(x: number) => number} 分色線高度（折線依 x 內插；折回段用較陡的那段） */
const boltY = (x) => {
  for (let i = 0; i < BOLT_LINE.length - 1; i++) {
    const [x0, y0] = BOLT_LINE[i];
    const [x1, y1] = BOLT_LINE[i + 1];
    if (x <= x0 && x >= x1) {
      return lerp(y0, y1, (x0 - x) / (x0 - x1));
    }
  }
  return x > BOLT_LINE[0][0] ? BOLT_LINE[0][1] : BOLT_LINE[BOLT_LINE.length - 1][1];
};

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

/** @type {number[][]} 引擎蓋中線的金色閃電 (x, z) 折點（座艙前 → 鼻端） */
const HOOD_BOLT = [
  [27, 1.5],
  [40, 4],
  [43.5, -1.8],
  [56, 1.6],
  [59, -2.4],
  [70, 0],
];

/** @type {number} 十字鰭水平片半翼展 */
const CROSS_Z = 16;

/** @type {{ x0: number, x1: number, y: number, r: number }} 車尾錐形尖尾（實體）：x0 錐底、x1 錐尖、軸心高 y、錐底半徑 r */
const TAIL_CONE = { x0: -57, x1: -75.2, y: 29, r: 6.4 };

/** @type {number} 水平叉刃的底面高度 */
const PRONG_Y = 17.2;

/** @type {number[][]} 水平叉刃（+z 側）俯視外形 (x, z)：從前擋泥板前緣（前輪前方）伸出，外緣、內緣各折一次，尖端 (77.5, 25)；兩刃之間是中央鼻 */
const PRONG = [
  [57.5, 13],
  [57.5, 28],
  [60.5, 32.5],
  [63, 29.5],
  [77.5, 25],
  [67, 20.5],
  [68.5, 16.5],
  [60, 13],
];

/**
 * 橡葉外形（側視多邊形）：沿葉軸從葉柄到葉尖，葉緣是每側 lobes 個圓裂片
 * @type {(base: number[], tip: number[], halfW: number, lobes: number) => number[][]}
 */
const oakLeaf = (base, tip, halfW, lobes) => {
  const [bx, by] = base;
  const [tx, ty] = tip;
  const len = Math.hypot(tx - bx, ty - by);
  const ux = (tx - bx) / len;
  const uy = (ty - by) / len;
  const n = 36;
  /** @type {(t: number) => number} 葉寬：包絡（葉柄窄、中後段最寬）× 裂片 */
  const w = (t) => {
    const env = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.75 * (0.55 + 0.45 * t);
    const lobe = 0.5 + 0.5 * Math.abs(Math.sin(Math.PI * lobes * t)) ** 0.5;
    return Math.max(0.5, halfW * env * lobe * (1 - 0.35 * t * t));
  };
  /** @type {number[][]} */
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = w(t);
    out.push([bx + ux * len * t - uy * s, by + uy * len * t + ux * s]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const t = i / n;
    const s = w(t);
    out.push([bx + ux * len * t + uy * s, by + uy * len * t - ux * s]);
  }
  return out;
};

/**
 * 點到多邊形的帶號距離（多邊形內為負）
 * @type {(poly: number[][], u: number, v: number) => number}
 */
const sdPolygon = (poly, u, v) => {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2)) : 0;
    d = Math.min(d, Math.hypot(u - ax - t * dx, v - ay - t * dy));
    if (by > v !== ay > v && u < ((ax - bx) * (v - by)) / (ay - by) + bx) {
      inside = !inside;
    }
  }
  return inside ? -d : d;
};

/** @type {number[][]} 後擋泥板頂面的橡葉 (x, |z|)：葉柄在前、葉尖往後 */
const OAK_LEAF = oakLeaf([-25, 25.5], [-55, 24], 4.2, 4);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 大理石白：緞面（paint- 且 roughness > 0.5 → Blender 緞面），閃電折線以下的側箱
  marble: namedMaterial('paint-marble-white', { color: 0xeeebe4, roughness: 0.55, clearcoat: 0.3 }),
  // 鈷藍：亮面漆（主色）
  blue: namedMaterial('paint-cobalt-blue', { color: 0x1a3696, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 暴風海軍藍：側裙底緣（緞面）
  navy: namedMaterial('paint-storm-navy', { color: 0x151d36, roughness: 0.55, clearcoat: 0.25 }),
  // 真金屬金（名稱含 -brass → Blender metallic）：水平叉刃、十字鰭
  gold: namedMaterial('trim-gold-brass', { color: 0xd6ad45, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1e2433, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x181b22, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1c22, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-navy', { color: 0x151d36, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x161a26, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-line', { color: 0xd6ad45, metalness: 0.75, roughness: 0.3 }),
  // 柱身溝槽：鈷藍上的淺灰藍細線（霧面）
  dFlute: decalMaterial('decal-marble-flute', { color: 0xb8c4e2, roughness: 0.7 }),
  // 閃電光：電光青白，低強度自發光（Blender 不過曝）
  dBolt: decalMaterial('decal-lightning-glow', { color: 0x9fe0ff, emissive: 0x4fb4ff, emissiveIntensity: 0.45, roughness: 0.3 }),
});

export const zeusThunderboltBody = makePolyBody({
  id: 'body-zeus-thunderbolt',
  name: '宙斯雷霆',
  style: 'myth',
  phase: 13,
  mythSeries: 'greek',
  mythTheme: 'zeus',
  form: 'thunder-fork',
  roof: 'canopy',
  wing: 'oakleaf-cross',
  theme: '雷霆杖、橡葉與神殿柱：鈷藍細長低楔車頭前端分岔成兩支往前伸的金色水平叉刃，側面鈷藍／白之間一道金色寬邊的鋸齒閃電折線，引擎蓋一道金色閃電；座艙後的中脊刻著柱身溝槽，車尾伸出錐形尖尾，末端是金色十字鰭（雷霆杖柄頭）；後擋泥板頂面一對金色橡葉',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  step: 0.72,
  // 肩稜線是銳利稜線（中脊兩側用平滑曲面接到甲板，引擎蓋上不留折痕）
  hard: [5],
  wheelArches: ARCHES,
  canopy: {
    section: 'trapezoid',
    // 多面的梯形斷面座艙罩 x 26 → −16，最寬 10.5、高 5（座艙頂約 39.5，比後中脊低 5 mm）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 28; i++) {
        const u = i / 28;
        const x = lerp(CANOPY.xc + CANOPY.a, CANOPY.xc - CANOPY.a, u);
        out.push({ x, yBase: 0, yTop: 5 * Math.sin(Math.PI * u ** 0.8) ** 0.55, halfW: Math.max(2.2, canopyHalfW(x)) });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 側裙底緣：海軍藍
    { mat: 'navy', keep: (x, y) => P.yLow(x) + 2 - y },
    // 鋸齒閃電折線以下：大理石白側箱
    { mat: 'marble', keep: (x, y, z) => Math.min(boltY(x) - y, Math.abs(z) - 8) },
    // 鈷藍
    { mat: 'blue', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'blue' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'blue', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯與輪胎內側的環形擋板（接成一個輪室）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // ── 水平叉刃（實體，金）：兩支鋸齒形平板從前擋泥板前緣往前伸，尖端越過中央鼻端，俯視是一道叉口 ──
    parts.push({ geometry: mergeGeos([1, -1].map((sg) => flatPlate(PRONG.map(([x, z]) => [x, sg * z]), PRONG_Y, 1.6))), mat: 'gold', solid: true, outline: true, name: 'thunderbolt-prongs' });

    // ── 車尾：錐形尖尾（大理石白，和鈷藍車身分開）＋末端金色十字鰭（雷霆杖柄頭） ──
    {
      const len = TAIL_CONE.x0 - TAIL_CONE.x1;
      const cone = new THREE.CylinderGeometry(0.3, TAIL_CONE.r, len, 16, 1);
      // 圓柱軸 +y 轉到 −x（錐尖朝後）
      cone.rotateZ(Math.PI / 2);
      cone.translate((TAIL_CONE.x0 + TAIL_CONE.x1) / 2, TAIL_CONE.y, 0);
      parts.push({ geometry: cone, mat: 'marble', solid: true, outline: true, name: 'tail-cone' });
      // 直立鰭：從中脊尾段升起，上緣後掠到 48.5，往下穿過尖尾到 19（十字的直立臂）；後緣 x −69，錐尖再往後伸出 6
      const fin = [
        [-50, P.yTop(-50) - 1],
        [-61.5, 45.6],
        [-66.5, 48.5],
        [-69, 47.4],
        [-69, 20.5],
        [-67.2, 19],
        [-64.5, 21.5],
        [-62.5, 27],
        [-56, P.yTop(-56) - 1],
      ];
      parts.push({ geometry: finPlate(fin, 0, 1.6), mat: 'gold', solid: true, outline: true, name: 'cross-fin-vertical' });
      // 水平鰭：在尖尾軸心高度，前緣後掠，翼展 ±CROSS_Z（十字的水平臂）
      const wing = [
        [-60.5, -1],
        [-65.5, -CROSS_Z],
        [-69, -CROSS_Z],
        [-69, 1],
        [-69, CROSS_Z],
        [-65.5, CROSS_Z],
        [-60.5, 1],
      ];
      parts.push({ geometry: flatPlate(wing, TAIL_CONE.y - 0.65, 1.3), mat: 'gold', solid: true, outline: true, name: 'cross-fin-horizontal' });
    }

    // ---- 貼紙 ----
    // 鋸齒閃電折線的金色寬邊（線寬 1.6）＋線下一道電光細線
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => polylineDist(BOLT_LINE, side * u, v) - 0.8, { x0: 0, y0: 0, zMin: 8, side })),
        mat: 'dGold',
        name: `decal-bolt-edge-${side}`,
      });
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(polylineDist(BOLT_LINE.map(([x, y]) => [x, y - 2.2]), side * u, v) - 0.35, P.yLow(side * u) + 2.6 - v), { x0: 0, y0: 0, zMin: 14, side })),
        mat: 'dBolt',
        name: `decal-bolt-glow-${side}`,
      });
    }
    // 引擎蓋中線的金色閃電（座艙前 → 鼻端，前細後粗）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const w = lerp(0.5, 1.2, smoothstep(70, 27, x));
        return Math.min(w - polylineDist(HOOD_BOLT, x, z), 70.5 - x, x - 26, -kit.underCanopy(x, z));
      }),
      mat: 'dGold',
      name: 'decal-hood-bolt',
    });
    // 柱身溝槽：後中脊上 5 道縱向細槽（跟著中脊收窄），座艙後 → 尾鰭前
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const cw = Math.min(P.crestW(x), 0.32 * P.hw(x));
        const pitch = (cw * 1.5) / 4.5;
        const k = Math.round(z / pitch);
        const inBand = Math.abs(k) <= 2 ? 0.28 - Math.abs(z - k * pitch) : -1;
        return Math.min(inBand, -20 - x, x + 64, 0.9 * cw - Math.abs(z));
      }),
      mat: 'dFlute',
      name: 'decal-column-flutes',
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
    // 後擋泥板頂面的金色橡葉（左右各一片）
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(-sdPolygon(OAK_LEAF, x, Math.abs(z)), y - 26)),
      mat: 'dGold',
      name: 'decal-oak-leaves',
    });
    // 細縫頭燈（電光青白）：鼻側肩線下方一道斜縫
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.45 - Math.abs(y - (shoulderY(x) - 1.6 + 0.08 * (x - 62))), x - 60, 69 - x, Math.abs(z) - 4)),
      mat: 'dBolt',
      name: 'lamp-slit-headlights',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    fourview: 'shared/design/fourview-ref/fourview_10_v1.png（AI 參考圖，只取造型：分岔尖鼻、座艙後中脊收成尾錐、十字尾鰭；尺寸以底盤為準）',
    geometry: '本檔站位產生器 P（推估）：殼 x −70 ~ 64（中央鼻端，兩刃之間是叉口）、水平叉刃尖 77.5、錐形尖尾尖 −75.2；中線鼻端 14.6 → 前軸 33、座艙頂約 39.5、後中脊頂 44.5（x −28）、十字鰭頂 48.5（全車最高）；半寬前後輪上方 31、兩輪之間 30（側箱蓋住底盤側框）、車尾 6；兩輪之間下緣 11.5',
    prongs: '水平叉刃：ABS 實心平板厚 1.6 mm、底面高 17.2，x 57.5 → 77.5、|z| 13–32.5，外緣與內緣各折一次（推估）',
    tail: '錐形尖尾 x −57 → −75.2、錐底半徑 6.4（軸心高 29）；十字鰭直立片厚 1.6（頂 48.5、底 19）、水平片厚 1.3（翼展 ±16），皆 ABS 實心件（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
