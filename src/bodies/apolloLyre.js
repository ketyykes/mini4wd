// 阿波羅七弦琴（body-apollo-lyre，神話組・希臘）：只用阿波羅的持物與象徵，車上沒有人像、臉、手或神像。
// 照四視圖 06 建模，但壓低、加寬輪拱做回四驅車的矮寬感：寬平低鼻上下兩層前擾流片、鼓起的後擋泥板、多面的煙燻金座艙罩，
// 車尾一道從兩側後擋泥板拱起、橫跨車尾的琴框拱（正視是 ∩，側視拱頂往後傾）。
// 元素：
// (1) 七弦琴 → 琴框拱（金）就是琴臂與琴軛，拱下七道金弦立在後甲板的琴橋上；
// (2) 太陽戰車（後期與太陽神赫利俄斯合一）→ 太陽亮黃主色、四個輪拱外圍兩道輪圈弧線；
// (3) 月桂 → 兩側車門上一枝月桂葉形切割（深色葉片沿細莖排列）。
// 設計：shared/design/body-apollo-lyre/DESIGN.md（典故來源與文物對應寫在 DESIGN.md）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, flatPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、鼻端 77 */
const XS = [-70, -64, -56, -48, -40, -30, -18, -5, 8, 20, 30, 40, 50, 58, 64, 69, 73, 77];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-70, -64, -56, -48, -40, -32, -22, -10, 0, 10, 20, 30, 40, 50, 58, 64, 69, 73, 77];

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
  // 中線殼頂：低平——鼻端 15、前軸 32.8、座艙段 33.6、後甲板 30（座艙罩頂約 39.4）
  yTop: monoCurve(XS, [30, 30.6, 31, 31.4, 32, 32.4, 33, 33.4, 33.6, 33.6, 33.4, 32.8, 30.6, 27, 23.6, 20.4, 17.6, 15]),
  // 肩稜線基本高度：兩輪之間低到 26，前後輪上方沿眉線拱起到 31.5（鼓起的擋泥板）
  yS: monoCurve(XS, [26, 27, 27.5, 27.8, 28, 27.5, 26.5, 26, 26, 26.5, 27.5, 28, 26.5, 23.5, 20.5, 18, 16, 14.5]),
  // 俯視半寬：後輪上方外擴到 38.5 的寬擋泥板，C 形環翼跨在上面；兩輪之間的側箱 29（把底盤側框蓋住）；前輪上方收成 16 的窄鼻、前輪外露
  hw: monoCurve(XS_HW, [31, 34, 37, 38.5, 38.5, 36.5, 32, 29.5, 29, 29, 28.5, 22, 16.5, 16, 15.5, 14.5, 13, 11.5, 9.5]),
  // 側裙下緣：兩輪之間壓到 11.5，把底盤側框封起來
  yLow: monoCurve(XS, [12, 11.2, 10.5, 10.5, 11, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 10.5, 10.5, 11, 11.6, 12, 12.3, 12.5]),
  // 金色中央寬條紋半寬（鼻端 → 座艙前、座艙後 → 車尾）
  stripe: monoCurve(XS, [8, 8.5, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8.5, 8, 7, 6, 5, 4.5, 4]),
};

/** @type {(x: number) => number} 肩稜線（含眉線） */
const shoulderY = (x) => smoothMax(P.yS(x), browY(x), 1.2);

/**
 * 半剖面 7 點：中線 → 微圓的頂面 → 肩稜線（銳利）→ 微外張的側裙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const h = P.hw(x);
  const s = Math.min(shoulderY(x), t - 0.5);
  const lo = P.yLow(x);
  const d = t - s;
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [h + 0.7, lerp(s, lo, 0.5)],
    [h + 1.1, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與車鼻每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-70, -62, 1, profile).slice(0, -1), ...buildStations(-62, 60, 2, profile).slice(0, -1), ...buildStations(60, 77, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {number[]} 鼻頭前擾流片底面高度（下層、上層） */
const FRONT_WING_Y = [13.4, 18];

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 4、前後半長 15、半寬 10.5） */
const CANOPY = { xc: 4, a: 15, b: 10.5, n: 2.4 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/** @type {{ zs: number, y0: number, h: number, x0: number, lean: number }} 琴框拱：兩腳立在後擋泥板頂（|z| zs、高 y0），拱頂高 y0 + h，拱頂往後傾 lean */
const LYRE_ARCH = { zs: 33, y0: 29, h: 17, x0: -50, lean: 8 };

/** @type {(th: number) => number[]} 琴框拱上角度 th（0 = 右腳、π/2 = 拱頂、π = 左腳）的點 (x, y, z) */
const archPoint = (th) => {
  const sn = Math.max(0, Math.sin(th));
  return [LYRE_ARCH.x0 - LYRE_ARCH.lean * sn, LYRE_ARCH.y0 + LYRE_ARCH.h * sn ** 0.6, LYRE_ARCH.zs * Math.cos(th)];
};

/** @type {number[]} 七道琴弦的 z 位置 */
const STRING_Z = [-13.5, -9, -4.5, 0, 4.5, 9, 13.5];

/**
 * 月桂枝：一條往後上升的細莖，兩側交錯排列尖橢圓葉（u = 從該側看過去的水平座標、v = 高度；回傳 { leaf, stem } 距離）
 * @type {(u: number, v: number) => { leaf: number, stem: number }}
 */
const laurel = (u, v) => {
  // 細莖：從 u 16（前輪後方）往後升到 u −20
  const stemY = (uu) => 16.6 + 0.2 * (16 - uu);
  const stem = u < -20.5 || u > 16.5 ? 9 : Math.abs(v - stemY(u)) - 0.4;
  let leaf = 9;
  for (let k = 0; k < 6; k++) {
    const uc = 12 - k * 6.2;
    const side = k % 2 === 0 ? 1 : -1;
    // 葉子從莖往後斜出 35°，長 7、最寬 2.6
    const ang = side * 0.62;
    const cx = uc - 2.6 * Math.cos(ang);
    const cy = stemY(uc) + 2.6 * Math.sin(ang) * 1.0 + side * 0.6;
    const du = u - cx;
    const dv = v - cy;
    const a = -du * Math.cos(ang) + dv * Math.sin(ang);
    const b = du * Math.sin(ang) + dv * Math.cos(ang);
    const L = 3.6;
    const W = 1.3 * Math.max(0, 1 - (a / L) ** 2);
    leaf = Math.min(leaf, Math.max(Math.abs(a) - L, Math.abs(b) - W));
  }
  return { leaf, stem };
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 太陽亮黃：主色（亮面）
  sun: namedMaterial('paint-sun-yellow', { color: 0xffc414, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 象牙白：中央條紋（亮面）
  white: namedMaterial('paint-ivory-white', { color: 0xf6f2e8, roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  // 黑曜底緣（緞面）
  onyx: namedMaterial('paint-onyx-black', { color: 0x16130f, roughness: 0.55, clearcoat: 0.25 }),
  // 真金屬金：C 形琴臂、琴軛、琴弦、琴橋、前擾流片（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xd9ab3c, metalness: 0.85, roughness: 0.26, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x3a2a0c, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x1c1915, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1915, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-onyx', { color: 0x16130f, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-onyx', { color: 0x1a1713, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-line', { color: 0xc99a2e, metalness: 0.75, roughness: 0.3 }),
  // 黑曜細線：亮黃車身上的描線（霧面）
  dOnyx: decalMaterial('decal-onyx-line', { color: 0x1a1612, roughness: 0.6 }),
  // 月桂葉切割：深橄欖黑（霧面）
  dCut: decalMaterial('decal-laurel-cut', { color: 0x1d2014, roughness: 0.7 }),
  // 頭燈：琥珀色低強度自發光（Blender 不過曝）
  dLamp: decalMaterial('decal-amber-lamp', { color: 0xffd36a, emissive: 0xffa526, emissiveIntensity: 0.45, roughness: 0.3 }),
});

export const apolloLyreBody = makePolyBody({
  id: 'body-apollo-lyre',
  name: '阿波羅七弦琴',
  style: 'myth',
  phase: 13,
  mythSeries: 'greek',
  mythTheme: 'apollo',
  form: 'sun-shovel',
  roof: 'canopy',
  wing: 'lyre-hoop',
  theme: '七弦琴、太陽戰車與月桂：壓低的太陽亮黃車身、低鼻上下兩層金色前擾流片、鼓起的後擋泥板與象牙白中央條紋、多面的煙燻金座艙罩；車尾一道金色琴框拱從兩側後擋泥板拱起、橫跨車尾，拱下七道金弦立在後甲板琴橋上；四個輪拱外圍兩道輪圈弧線，兩側車門一枝深色月桂葉形切割',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  step: 0.7,
  // 肩稜線是銳利稜線
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'trapezoid',
    // 多面的煙燻金座艙罩 x 19 → −11，最寬 10.5、高 5.8（座艙頂約 39.4）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const x = lerp(CANOPY.xc + CANOPY.a, CANOPY.xc - CANOPY.a, u);
        out.push({ x, yBase: 0, yTop: 5.8 * Math.sin(Math.PI * u ** 0.8) ** 0.55, halfW: Math.max(2.2, canopyHalfW(x)) });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 黑曜底緣
    { mat: 'onyx', keep: (x, y) => P.yLow(x) + 1.8 - y },
    // 象牙白中央條紋
    { mat: 'white', keep: (x, y, z) => P.stripe(x) - Math.abs(z) },
    // 太陽亮黃
    { mat: 'sun', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'sun' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'sun', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯與輪胎內側的環形擋板（接成一個輪室）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // ── 琴框拱（金）：從兩側後擋泥板頂拱起、橫跨車尾、拱頂往後傾；拱下七道金弦立在後甲板的琴橋上 ──
    {
      /** @type {number[][]} */
      const path = [];
      for (let i = 0; i <= 20; i++) {
        path.push(archPoint(Math.PI * (i / 20)));
      }
      parts.push({ geometry: sweepEllipse(path, 28, () => [1.9, 1.6], 8), mat: 'gold', solid: true, outline: true, name: 'lyre-arch' });
      const bridgeX = LYRE_ARCH.x0 - LYRE_ARCH.lean * 0.96;
      const yDeck = P.yTop(bridgeX);
      const bridgeTop = yDeck + 1.4;
      const strings = STRING_Z.map((z) => {
        const th = Math.acos(z / LYRE_ARCH.zs);
        const [ax, ay] = archPoint(th);
        const len = ay - 1.2 - bridgeTop + 0.3;
        const g = new THREE.CylinderGeometry(0.45, 0.45, len, 8);
        g.translate(ax, bridgeTop - 0.15 + len / 2, z);
        return g;
      });
      const bridge = new THREE.BoxGeometry(3.4, 2.4, 31);
      bridge.translate(bridgeX, yDeck + 0.2, 0);
      parts.push({ geometry: mergeGeos([...strings, bridge]), mat: 'gold', solid: true, outline: true, name: 'lyre-strings' });
    }
    // ── 鼻頭上下兩層前擾流片（金）：下層寬、上層窄，兩端往後掠，都在鼻端前緣之內 ──
    {
      const lower = [
        [64, -23],
        [70, -24.5],
        [77, -20],
        [77, 20],
        [70, 24.5],
        [64, 23],
      ];
      const upper = [
        [63, -17.5],
        [68, -18.5],
        [74, -15],
        [74, 15],
        [68, 18.5],
        [63, 17.5],
      ];
      parts.push({ geometry: mergeGeos([flatPlate(lower, FRONT_WING_Y[0], 1.1), flatPlate(upper, FRONT_WING_Y[1], 1.1)]), mat: 'gold', solid: true, outline: true, name: 'front-spoiler-pair' });
    }

    // ---- 貼紙 ----
    // 輪拱外圍兩道黑曜輪圈弧線（戰車車輪的輪圈，上半圈）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 26) {
          return -1;
        }
        let best = -1;
        for (const a of ARCHES) {
          const r = Math.hypot(x - a.x, y - a.y);
          const th = Math.atan2(y - a.y, x - a.x);
          if (th < 0.25 || th > Math.PI - 0.25) {
            continue;
          }
          best = Math.max(best, 0.4 - Math.abs(r - 19.2), 0.3 - Math.abs(r - 21.2));
        }
        // 只畫在側面（肩稜線以下），不在擋泥板頂面糊成黑塊
        return Math.min(best, y - P.yLow(x) - 2, shoulderY(x) - 1 - y);
      }),
      mat: 'dOnyx',
      name: 'decal-wheel-rim-arcs',
    });
    // 兩側車門的月桂葉形切割（深色葉片）＋黑曜細莖
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => laurel(side * u, v).leaf, { x0: 0, y0: 0, zMin: 22, side })),
        mat: 'dCut',
        name: `decal-laurel-leaves-${side}`,
      });
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(laurel(side * u, v).stem, -laurel(side * u, v).leaf - 0.05), { x0: 0, y0: 0, zMin: 22, side })),
        mat: 'dOnyx',
        name: `decal-laurel-stem-${side}`,
      });
    }
    // 白色條紋兩側的黑曜細邊
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - P.stripe(x) - 0.45), 76.5 - x, x + 69.5, -kit.underCanopy(x, z) - 0.5)),
      mat: 'dOnyx',
      name: 'decal-stripe-edge',
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
    // 細縫頭燈：鏟形鼻兩側肩線下一道長縫
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.5 - Math.abs(y - (shoulderY(x) - 1.5)), x - 62, 75.5 - x, Math.abs(z) - 9)),
      mat: 'dLamp',
      name: 'lamp-slit-headlights',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    fourview: 'shared/design/fourview-ref/fourview_06_v1.png（AI 參考圖，只取造型：寬平低鼻、鼓起的擋泥板、短座艙、車尾 C 形環翼；四視圖偏超跑，已壓低車身、加寬輪拱；尺寸以底盤為準）',
    geometry: '本檔站位產生器 P（推估）：殼 x −70 ~ 77；中線鼻端 15、座艙段 33.6、後甲板 30、座艙罩頂約 39.4、琴框拱頂 46（全車最高）；半寬前段 16（前輪外露）、兩輪之間 29（側箱蓋住底盤側框）、後輪上方 38.5、鼻端 9.5、車尾 31；兩輪之間下緣 11.5',
    lyre: '琴框拱：ABS 實心管，斷面橢圓 3.8 × 3.2（sweep 28 × 8 段），兩腳在 |z| 33、高 29，拱頂高 46、往後傾 8；七道琴弦為 r 0.45 的實心圓柱（8 段），間距 4.5，立在 3.4 × 2.4 × 31 的琴橋上（推估）',
    frontSpoilers: '前擾流片：ABS 實心平板厚 1.1；下層底面高 13.4、x 64 → 77、半寬 24.5；上層底面高 18、x 63 → 74、半寬 18.5（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
