// 宙斯雷霆（body-zeus-thunderbolt，神話組・希臘）：只用宙斯的持物與象徵，車上沒有人像、臉、手或神像。
// 照四視圖 10 建模：細長低楔車頭、鼻頭一整片水平前翼往前伸出兩支翼端（中央鼻較短，俯視是一道叉口）、
// 座艙後隆起一道中脊，車尾伸出一支錐形尖尾，尖尾末端十字交叉的尾鰭（雷霆杖的柄頭）。
// 元素：
// (1) 雷霆杖 keraunos → 側面一條金邊電光藍鋸齒閃電帶、座艙前一道鋸齒閃電立刃、鼻頭電光藍閃電前翼、車尾金色長飛鏢尾＋電光藍十字小鰭；
// (2) 神殿柱 → 大理石白車身與淡灰大理石紋、側箱下段與後中脊的縱向柱身溝槽。
// 設計：shared/design/body-zeus-thunderbolt/DESIGN.md（典故來源與文物對應寫在 DESIGN.md）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：殼尾 −62（飛鏢尾再往後伸到 −75.2）、參數表到 72（殼只做到中央鼻端 NOSE_X，前翼兩支閃電翼端再往前到 77.5） */
const XS = [-62, -59, -55, -50, -40, -28, -16, -5, 5, 15, 25, 35, 45, 52, 58, 63, 68, 72];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-62, -59, -55, -50, -46, -40, -30, -20, -10, 0, 10, 20, 30, 40, 48, 54, 58, 63, 68, 72];

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
  // 中線殼頂：鼻端 14.6 → 前軸 33 的長楔；座艙段 34；座艙後隆起一道中脊（x −28 最高 44.5），往後急降成殼尾 31，殼尾收進飛鏢尾
  yTop: monoCurve(XS, [31, 33.5, 37, 40.5, 43.5, 44.5, 43, 37.5, 34.6, 34, 33.6, 33, 32.3, 29.2, 25.2, 21.4, 17.6, 14.6]),
  // 中脊高（中線殼頂 − 中脊兩側甲板）：只在座艙後；座艙前是整片微拱的引擎蓋
  crest: monoCurve(XS, [1.5, 2.5, 4, 6.5, 9, 10, 9, 3, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02]),
  // 中脊半寬：車尾尖錐 4 → 後軸 10.5
  crestW: monoCurve(XS, [2.5, 4, 6, 8.5, 10.5, 11, 11, 10, 9, 9, 9, 9, 9, 8, 6, 4.5, 3, 2]),
  // 肩稜線基本高度（前後輪上方再沿眉線拱起）
  yS: monoCurve(XS, [28.5, 28.5, 29, 29.5, 30, 30, 29.5, 29, 29, 29, 29.2, 29.5, 27.5, 23.5, 19, 16.2, 14.2, 13]),
  // 俯視半寬：兩輪之間的側箱 27（把底盤側框蓋住），前後輪上方 31，殼尾收成 14 的鈍尾（把尾端齒輪箱蓋住），飛鏢尾從殼尾上緣伸出；中央鼻在前翼兩支翼端之間只做到 x 60（半寬 15）
  hw: monoCurve(XS_HW, [14, 17, 21, 25, 28.5, 31, 29.5, 27.5, 27, 27, 27, 28.5, 31, 31, 29, 24.5, 16, 9.5, 6, 4.5]),
  // 側裙下緣：兩輪之間壓到 11.5，把底盤側框封起來；殼尾下緣 15.5，尾端封住
  yLow: monoCurve(XS, [15.5, 14, 13, 12.5, 12, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 12, 12.5, 13, 13, 13, 13, 13]),
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

/** @type {number} 中央鼻端 x：前翼兩支翼端之間留一道深叉口（俯視 V 形缺口） */
const NOSE_X = 60;

/** @type {{ x: number, pts: number[][] }[]} 車尾與車鼻每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-62, -54, 1, profile).slice(0, -1), ...buildStations(-54, 56, 2, profile).slice(0, -1), ...buildStations(56, NOSE_X, 1, profile)];

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
  [73, 13],
  [30, 27.5],
  [21, 18.5],
  [-24, 29.5],
  [-33, 20.5],
  [-63, 31],
];

/** @type {number} 側面閃電帶的半寬（到折線的距離） */
const BOLT_HALF = 3.4;

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

/**
 * 車頂閃電立刃側視外形 (x, y)：上緣是往前落下、中途兩次往回折的鋸齒，下緣埋進引擎蓋
 * @type {number[][]}
 */
const ROOF_BOLT = [
  [26, 31.5],
  [26, 38.6],
  [42, 36.8],
  [39.5, 34.8],
  [52.5, 32.2],
  [50, 31.6],
  [60.5, 25.4],
  [59.5, 22.5],
  [50, 27.5],
  [40, 31],
];

/**
 * 鼻頭閃電前翼俯視外形 (x, z)：一整片水平翼穿過鼻頭，兩側往前伸出閃電形翼端，外緣各有一道往回折的鋸齒
 * @type {number[][]}
 */
const NOSE_BLADE = [
  [59, 0],
  [66, 10.5],
  [77.2, 21],
  [69, 25.5],
  [71, 27.5],
  [62, 31],
  [56, 22],
  [50, 20.5],
  [50, 10],
  [57, 9],
  [56, 0],
  [57, -9],
  [50, -10],
  [50, -20.5],
  [56, -22],
  [62, -31],
  [71, -27.5],
  [69, -25.5],
  [77.2, -21],
  [66, -10.5],
];

/** @type {number} 鼻頭閃電前翼的底面高度 */
const NOSE_BLADE_Y = 18.5;

/** @type {number} 飛鏢尾末端十字小鰭水平片半翼展 */
const CROSS_Z = 32;

/** @type {{ x0: number, x1: number, y: number, r: number }} 飛鏢尾（薄殼長錐）：x0 錐底（埋在後中脊裡）、x1 錐尖、軸心高 y、錐底半徑 r；殼尾 −62 之後伸出 14.5 mm */
const TAIL_CONE = { x0: -44, x1: -76.5, y: 30, r: 11 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 大理石白：主色（亮面）
  marble: namedMaterial('paint-marble-white', { color: 0xefece4, roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  // 電光藍：側面鋸齒閃電帶、車頂閃電立刃、十字尾鰭（亮面）
  bolt: namedMaterial('paint-electric-blue', { color: 0x1f6dff, roughness: 0.24, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 金：飛鏢尾（金屬）
  gold: namedMaterial('paint-olympian-gold', { color: 0xd6a73c, metalness: 0.75, roughness: 0.28 }),
  // 暴風石板灰：側裙底緣（緞面）
  navy: namedMaterial('paint-storm-slate', { color: 0x2c3342, roughness: 0.55, clearcoat: 0.25 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1e2433, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x181b22, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1c22, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-navy', { color: 0x151d36, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x161a26, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-line', { color: 0xd6a73c, metalness: 0.7, roughness: 0.3 }),
  // 柱身溝槽：大理石白上的暖灰細槽（霧面）
  dFlute: decalMaterial('decal-marble-flute', { color: 0xa9a59b, roughness: 0.7 }),
  // 大理石紋：淡灰細紋（霧面）
  dVein: decalMaterial('decal-marble-vein', { color: 0xbdb8ad, roughness: 0.5 }),
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
  theme: '雷霆杖與神殿柱：大理石白細長低楔車身帶淡灰大理石紋，鼻頭一整片電光藍水平前翼（兩支翼端越過鼻端，外緣一道鋸齒），座艙前一道電光藍鋸齒閃電立刃，側面一條金邊電光藍鋸齒閃電帶（中心一道電光細線），側箱下段與後中脊刻著柱身溝槽；車尾伸出一支金色長飛鏢尾，末端是電光藍十字尾鰭（水平片翼展 ±32；雷霆杖柄頭）',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  step: 0.72,
  // 引擎蓋外緣與肩線是兩道銳利稜線（切面車身）；中脊兩側用平滑曲面接到甲板
  hard: [4, 5],
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
    // 側面鋸齒閃電帶：電光藍（寬 2 × BOLT_HALF）
    { mat: 'bolt', keep: (x, y, z) => Math.min(BOLT_HALF - polylineDist(BOLT_LINE, x, y), Math.abs(z) - 8) },
    // 大理石白
    { mat: 'marble', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'marble' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'marble', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯與輪胎內側的環形擋板（接成一個輪室）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // ── 車頂閃電：座艙前一道鋸齒閃電立刃（電光藍，厚 2.4），從引擎蓋長出、往前折兩次落到鼻端 ──
    parts.push({ geometry: finPlate(ROOF_BOLT, 0, 2.4), mat: 'bolt', solid: true, outline: true, name: 'roof-thunderbolt' });
    // ── 鼻頭閃電前翼：一整片電光藍水平翼（厚 2.2）穿過鼻頭，中段埋進鼻子 ──
    parts.push({ geometry: flatPlate(NOSE_BLADE, NOSE_BLADE_Y, 2.2), mat: 'bolt', solid: true, outline: true, name: 'nose-bolt-blade' });

    // ── 車尾：長飛鏢尾（亮黃薄殼錐，錐底埋在後中脊、殼尾之後伸出 14.5 mm）＋末端寶藍十字小鰭（雷霆杖柄頭） ──
    {
      const len = TAIL_CONE.x0 - TAIL_CONE.x1;
      const cone = new THREE.CylinderGeometry(0.3, TAIL_CONE.r, len, 20, 1, true);
      // 圓柱軸 +y 轉到 −x（錐尖朝後）
      cone.rotateZ(Math.PI / 2);
      cone.translate((TAIL_CONE.x0 + TAIL_CONE.x1) / 2, TAIL_CONE.y, 0);
      parts.push({ geometry: cone, mat: 'gold', shell: true, outline: true, name: 'dart-tail' });
      // 十字小鰭：殼尾後方的飛鏢尾上，錐尖再往後伸出 5；直立片上下各伸出（上 42、下 20.5），水平片翼展 ±CROSS_Z，前緣都往後掠
      const fin = [
        [-63.5, TAIL_CONE.y],
        [-68.5, 42],
        [-71.5, 42],
        [-71.5, 20.5],
        [-68.5, 20.5],
      ];
      parts.push({ geometry: finPlate(fin, 0, 1.2), mat: 'bolt', solid: true, outline: true, name: 'cross-fin-vertical' });
      const wing = [
        [-62.5, -1],
        [-69.5, -CROSS_Z],
        [-75, -CROSS_Z],
        [-73, -6],
        [-73, 6],
        [-75, CROSS_Z],
        [-69.5, CROSS_Z],
        [-62.5, 1],
      ];
      parts.push({ geometry: flatPlate(wing, TAIL_CONE.y - 0.6, 1), mat: 'bolt', solid: true, outline: true, name: 'cross-fin-horizontal' });
    }

    // ---- 貼紙 ----
    for (const side of [-1, 1]) {
      // 閃電帶兩側的金色邊線（線寬 0.8）
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.abs(polylineDist(BOLT_LINE, side * u, v) - BOLT_HALF - 0.4) - 0.4, { x0: 0, y0: 0, zMin: 8, side })),
        mat: 'dGold',
        name: `decal-bolt-gold-${side}`,
      });
      // 閃電帶中心的電光細線（線寬 1.2）
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => polylineDist(BOLT_LINE, side * u, v) - 0.6, { x0: 0, y0: 0, zMin: 8, side })),
        mat: 'dBolt',
        name: `decal-bolt-core-${side}`,
      });
      // 側箱下段的神殿柱溝槽：3 道縱向細槽，前後輪之間、閃電帶以下
      parts.push({
        geometry: kit.decal(
          sideDecal((u, v) => {
            const x = side * u;
            const k = Math.round((v - P.yLow(x) - 3.2) / 1.9);
            const groove = k >= 0 && k <= 2 ? Math.abs(v - P.yLow(x) - 3.2 - k * 1.9) - 0.35 : 9;
            return Math.max(groove, Math.abs(x) - 21, BOLT_HALF + 1.4 - polylineDist(BOLT_LINE, x, v));
          }, { x0: 0, y0: 0, zMin: 8, side }),
        ),
        mat: 'dFlute',
        name: `decal-side-flutes-${side}`,
      });
    }
    // 大理石紋：引擎蓋、肩面與後甲板上的淡灰細紋（避開座艙罩與閃電帶）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const f = Math.sin(0.19 * x + 1.7 * Math.sin(0.15 * z + 0.05 * x) + 0.6 * Math.sin(0.08 * x - 0.23 * z));
        const vein = 0.07 - Math.abs(f);
        return Math.min(vein, polylineDist(BOLT_LINE, x, y) - BOLT_HALF - 1.2, -kit.underCanopy(x, z) - 1.2, x + 60, 59 - x, y - 22, Math.abs(z) - 2);
      }),
      mat: 'dVein',
      name: 'decal-marble-veins',
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
    // 細縫頭燈（電光青白）：鼻側肩線下方一道斜縫
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.45 - Math.abs(y - (shoulderY(x) - 1.6 + 0.08 * (x - 62))), x - 55, 59.5 - x, Math.abs(z) - 4)),
      mat: 'dBolt',
      name: 'lamp-slit-headlights',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    fourview: 'shared/design/fourview-ref/fourview_10_v1.png（AI 參考圖，只取造型：分岔尖鼻、座艙後中脊收成尾錐、十字尾鰭；尺寸以底盤為準）',
    geometry: '本檔站位產生器 P（推估）：殼 x −62 ~ 60（中央鼻端，兩支翼端之間是叉口）、前翼翼端尖 77.2、飛鏢尾尖 −75.2；中線鼻端 14.6 → 前軸 33、座艙頂約 39.5、後中脊頂 44.5（x −28）；半寬前後輪上方 31、兩輪之間 28.5（側箱蓋住底盤側框）、殼尾 14（下緣 15.5）；兩輪之間下緣 11.5',
    noseBlade: '鼻頭前翼：ABS 實心平板厚 2.2、底面高 18.5，x 50 → 77.2、|z| ≤ 31，中段埋進鼻子（推估）',
    roofBolt: '車頂閃電立刃：ABS 實心板厚 2.4，x 26 → 60.5、上緣比引擎蓋高 2～5（推估）',
    tail: '飛鏢尾：實心長錐 x −44 → −75.2、錐底半徑 9、軸心高 29.5（Cylinder 16 段）；十字小鰭直立片厚 1.4（上 40、下 21.5）、水平片厚 1.2（翼展 ±15），皆 ABS 實心件（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
