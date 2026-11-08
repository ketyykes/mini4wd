// 阿波羅七弦琴（body-apollo-lyre，神話組・希臘）：只用阿波羅的持物與象徵，車上沒有人像、臉、手或神像。
// 照四視圖 06 建模：楔形切面車身（鼻頭壓低、兩道稜線）、鼻頭一片薄下擾流刃、寬後擋泥板、多面的煙燻金座艙罩，
// 車尾一座七弦琴尾翼：兩支從後擋泥板長出、往外彎的琴臂就是端板，頂上的琴軛就是翼板，七道琴弦在兩臂之間。
// 元素：
// (1) 七弦琴 → 金色琴臂端板（後視往外彎的 U）、象牙白琴軛翼板、兩臂之間七道金弦立在後甲板的琴橋上；
// (2) 太陽戰車 → 四個輪拱外圍兩道金色輪圈弧線；
// (3) 月桂 → 月桂綠主色、兩側車門一枝金色月桂枝、象牙白中央條紋兩側各一條金色月桂葉帶。
// 設計：shared/design/body-apollo-lyre/DESIGN.md（典故來源與文物對應寫在 DESIGN.md）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, flatPlate, finPlate } from './polyBody.js';
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
  // 中線殼頂：楔形——後甲板 31 → 座艙段 33.2 最高，往前壓低，前軸 31.6（剛好蓋住輪室）之後急降成楔形鼻、鼻端 13（座艙罩頂約 38.4）
  yTop: monoCurve(XS, [31, 31.6, 32, 32.2, 32.4, 32.6, 33, 33.2, 32.8, 32.2, 31.8, 31.6, 28.6, 24.2, 21, 18.4, 15.8, 13]),
  // 肩稜線基本高度：從車尾 28.5～29 往前斜降成一道直的楔形稜線（後輪上方只靠眉線補足輪拱高度）
  yS: monoCurve(XS, [28.5, 29, 29.2, 29.2, 29.2, 29, 28.8, 28.6, 27.8, 27, 26, 24.8, 22.6, 20.6, 18.6, 16.8, 15, 13.2]),
  // 俯視半寬：後輪上方外擴到 38.5 的寬擋泥板，七弦琴尾翼的兩支琴臂從上面長出；兩輪之間的側箱 29（把底盤側框蓋住）；前輪上方收成 16 的窄鼻、前輪外露
  hw: monoCurve(XS_HW, [26, 31, 36.5, 38.5, 38.5, 36.5, 32, 29.5, 29, 29, 28.5, 22, 16.5, 16, 15.5, 14.5, 13, 11.5, 9.5]),
  // 側裙下緣：兩輪之間壓到 11.5，把底盤側框封起來
  yLow: monoCurve(XS, [12, 11.2, 10.5, 10.5, 11, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 10.5, 10.5, 11, 11.6, 12, 12.3, 12.5]),
  // 金色中央寬條紋半寬（鼻端 → 座艙前、座艙後 → 車尾）
  stripe: monoCurve(XS, [8, 8.5, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8.5, 8, 7, 6, 5, 4.5, 4]),
};

/** @type {(x: number) => number} 肩稜線（含眉線） */
const shoulderY = (x) => smoothMax(P.yS(x), browY(x), 1.2);

/**
 * 半剖面 6 點：中線 → 平的頂面 → 頂面外緣稜線（銳利）→ 斜切的上側面 → 肩稜線（銳利）→ 微外張的側裙
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
    [0.45 * h, t - 0.1 * d],
    [0.76 * h, t - 0.45 * d],
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

/** @type {number} 鼻頭下擾流刃底面高度 */
const FRONT_WING_Y = 11.2;

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 4、前後半長 15、半寬 10.5） */
const CANOPY = { xc: 4, a: 15, b: 10.5, n: 2.4 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/**
 * 琴臂端板側視外形 (x, y)：底部寬、從後擋泥板長出，往上收窄並往後彎成角形，頂端往後翹（像七弦琴的兩支彎臂）
 * @type {number[][]}
 */
const LYRE_ARM = [
  [-47, 29],
  [-48.5, 35],
  [-51, 41],
  [-54, 45.5],
  [-58, 47.6],
  [-61.5, 48],
  [-61, 45.6],
  [-59, 44.2],
  [-58, 40],
  [-57.5, 34],
  [-58.5, 29],
];

/** @type {number} 琴臂端板中心 |z|（板底） */
const ARM_Z = 33;

/** @type {number} 琴臂端板往外張的角度（度）：後視兩臂往上張開成 U */
const ARM_SPLAY = 10;

/** @type {number} 琴軛翼板的底面高度 */
const YOKE_Y = 42.6;

/** @type {number[][]} 琴軛翼板俯視外形 (x, z)：前緣微拱、後緣中央內凹，兩端接進琴臂 */
const YOKE = [
  [-53, 0],
  [-53.8, 20],
  [-55, 35.5],
  [-60.5, 35.5],
  [-61, 20],
  [-59.5, 0],
  [-61, -20],
  [-60.5, -35.5],
  [-55, -35.5],
  [-53.8, -20],
];

/** @type {number} 琴弦所在的 x（琴軛翼板中段） */
const STRING_X = -57;

/** @type {number[]} 七道琴弦的 z 位置 */
const STRING_Z = [-18, -12, -6, 0, 6, 12, 18];

/** @type {number} 琴弦在琴橋上收攏的比例（上寬下窄，像真的七弦琴弦收到音箱上的弦座） */
const STRING_PINCH = 0.55;

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
  // 月桂綠：主色（帶一點金屬感的亮面）
  sun: namedMaterial('paint-laurel-green', { color: 0x2f6a35, metalness: 0.3, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 象牙白：中央條紋（亮面）
  white: namedMaterial('paint-ivory-white', { color: 0xf6f2e8, roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  // 深墨綠底緣（緞面）
  onyx: namedMaterial('paint-forest-black', { color: 0x13241a, roughness: 0.55, clearcoat: 0.25 }),
  // 真金屬金：琴臂、琴弦、前擾流片（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xd9ab3c, metalness: 0.85, roughness: 0.26, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x3a2a0c, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x1c1915, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1915, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-onyx', { color: 0x16130f, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-onyx', { color: 0x1a1713, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-line', { color: 0xc99a2e, metalness: 0.75, roughness: 0.3 }),
  // 月桂葉：金箔（金屬）
  dLeaf: decalMaterial('decal-laurel-gold', { color: 0xe0b445, metalness: 0.8, roughness: 0.28 }),
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
  theme: '七弦琴、太陽戰車與月桂：月桂綠的楔形切面車身（鼻頭壓低、頂面外緣與肩線兩道稜線）、鼻頭一片薄金色下擾流刃、象牙白中央條紋兩側各一條金色月桂葉帶、多面的煙燻金座艙罩；車尾一座七弦琴尾翼：兩支從後擋泥板長出、往外彎的金色琴臂端板，頂上象牙白琴軛翼板，兩臂之間七道金弦立在後甲板琴橋上；四個輪拱外圍兩道金色輪圈弧線，兩側車門一枝金色月桂枝',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  step: 0.7,
  // 肩稜線是銳利稜線
  // 頂面外緣與肩線兩道銳利稜線（切面楔形車身）
  hard: [2, 3],
  wheelArches: ARCHES,
  canopy: {
    section: 'trapezoid',
    // 多面的煙燻金座艙罩 x 19 → −11，最寬 10.5、高 5.2（座艙頂約 38.4）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const x = lerp(CANOPY.xc + CANOPY.a, CANOPY.xc - CANOPY.a, u);
        out.push({ x, yBase: 0, yTop: 5.2 * Math.sin(Math.PI * u ** 0.8) ** 0.55, halfW: Math.max(2.2, canopyHalfW(x)) });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 深墨綠底緣
    { mat: 'onyx', keep: (x, y) => P.yLow(x) + 1.8 - y },
    // 象牙白中央條紋
    { mat: 'white', keep: (x, y, z) => P.stripe(x) - Math.abs(z) },
    // 月桂綠
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

    // ── 七弦琴尾翼：兩支金色琴臂端板從後擋泥板長出，頂上象牙白琴軛翼板（厚 2.2），兩臂之間七道金弦從琴軛斜收到後甲板的琴橋 ──
    {
      // 琴臂：厚 3 的彎角形端板，從後擋泥板長出，往外張 ARM_SPLAY 度
      const arms = [1, -1].map((sg) => finPlate(LYRE_ARM, sg * ARM_Z, 3, -sg * ARM_SPLAY));
      parts.push({ geometry: mergeGeos(arms), mat: 'gold', solid: true, outline: true, name: 'lyre-arms' });
      parts.push({ geometry: flatPlate(YOKE, YOKE_Y, 2.2), mat: 'white', solid: true, outline: true, name: 'lyre-yoke-wing' });
      const yDeck = P.yTop(STRING_X);
      const bridgeTop = yDeck + 1.4;
      // 琴弦：上端在琴軛、下端收攏到琴橋（上寬下窄的斜弦）
      const strings = STRING_Z.map((z) => {
        const top = new THREE.Vector3(STRING_X, YOKE_Y + 0.3, z);
        const bottom = new THREE.Vector3(STRING_X, bridgeTop - 0.3, z * STRING_PINCH);
        const len = top.distanceTo(bottom);
        const g = new THREE.CylinderGeometry(0.5, 0.5, len, 8);
        g.rotateX(Math.atan2(bottom.z - top.z, top.y - bottom.y));
        g.translate(STRING_X, (top.y + bottom.y) / 2, (top.z + bottom.z) / 2);
        return g;
      });
      const bridge = new THREE.BoxGeometry(3.6, 2.4, 24);
      bridge.translate(STRING_X, yDeck + 0.2, 0);
      parts.push({ geometry: mergeGeos([...strings, bridge]), mat: 'gold', solid: true, outline: true, name: 'lyre-strings' });
    }
    // ── 鼻頭一片薄金色下擾流刃：和壓低的鼻端之間留一道細長橫縫 ──
    {
      const blade = [
        [66, -23],
        [71, -24.5],
        [77, -21],
        [77, 21],
        [71, 24.5],
        [66, 23],
      ];
      parts.push({ geometry: flatPlate(blade, FRONT_WING_Y, 1), mat: 'gold', solid: true, outline: true, name: 'front-splitter-blade' });
    }

    // ---- 貼紙 ----
    // 輪拱外圍兩道金色輪圈弧線（戰車車輪的輪圈，上半圈）
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
        // 只畫在側面（肩稜線以下）
        return Math.min(best, y - P.yLow(x) - 2, shoulderY(x) - 1 - y);
      }),
      mat: 'dGold',
      name: 'decal-wheel-rim-arcs',
    });
    // 兩側車門的金色月桂枝（葉片＋細莖）
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.min(laurel(side * u, v).leaf, laurel(side * u, v).stem), { x0: 0, y0: 0, zMin: 22, side })),
        mat: 'dLeaf',
        name: `decal-laurel-branch-${side}`,
      });
    }
    // 象牙白中央條紋兩側的金色月桂葉帶：每 4.4 mm 一片尖橢圓葉，左右交錯斜出（座艙罩除外）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const pitch = 4.4;
        const k = Math.round(x / pitch);
        const lu = x - k * pitch;
        const lv = Math.abs(z) - P.stripe(x) - 2.3;
        const ang = (k % 2 === 0 ? 1 : -1) * 0.6;
        const a = lu * Math.cos(ang) + lv * Math.sin(ang);
        const b = -lu * Math.sin(ang) + lv * Math.cos(ang);
        const leaf = 1 - Math.hypot(a / 2.1, b / 0.75);
        return Math.min(leaf, 74 - x, x + 68, -kit.underCanopy(x, z) - 1.5);
      }),
      mat: 'dLeaf',
      name: 'decal-laurel-band',
    });
    // 白色條紋兩側的金色細邊
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - P.stripe(x) - 0.45), 76.5 - x, x + 69.5, -kit.underCanopy(x, z) - 0.5)),
      mat: 'dGold',
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
    geometry: '本檔站位產生器 P（推估）：殼 x −70 ~ 77；楔形中線：後甲板 31、座艙段 33.2、前軸 31.6、鼻端 13；頂面外緣與肩線兩道稜線；座艙罩頂約 38.4、琴臂頂 48（全車最高）；半寬前段 16（前輪外露）、兩輪之間 29（側箱蓋住底盤側框）、後輪上方 38.5、鼻端 9.5、車尾收到 26；兩輪之間下緣 11.5',
    lyre: '琴臂端板：ABS 實心板厚 3，側視彎角形（底 x −47 → −58.5、高 29 起，頂 48），板底 |z| 33、往外張 10°；琴軛翼板 ABS 厚 2.2、底面高 42.6、x −53 → −61、|z| 35.5；七道金弦 r 0.5（8 段），上端間距 6、下端收到 0.55 倍，立在 3.6 × 2.4 × 24 的琴橋上（推估）',
    frontSpoilers: '前下擾流刃：ABS 實心平板厚 1、底面高 11.2、x 66 → 77、半寬 24.5（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
