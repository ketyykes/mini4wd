// 波賽頓三叉戟（body-poseidon-trident，神話組・希臘）：只用波賽頓的持物與象徵，車上沒有人像、臉、手或神像。
// 照四視圖 11 建模：鈍而高的車鼻正中一個圓形進氣環、寬方的車身、長座艙、平的後甲板、車尾單柱撐起的橢圓盤翼。
// 元素：
// (1) 三叉戟 → 車尾橢圓盤翼上立一支三叉尾鰭（後視是 Ψ，三支尖端各帶倒鉤），和鼻頭的進氣環前後呼應；
// (2) 浪花 → 圓形進氣環裡一道青綠色渦捲（浪花渦形）；側裙下緣一條希臘波浪捲紋（running wave）；
// (3) 浪峰 → 鼻部中線 S 形斷面（鼻唇微翹的浪峰 → 浪谷 → 往座艙爬升）、側面一道起伏的浪形分色線。
// 設計：shared/design/body-poseidon-trident/DESIGN.md（典故來源與文物對應寫在 DESIGN.md）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、鼻端 74 */
const XS = [-70, -65, -55, -40, -25, -15, -5, 5, 15, 25, 35, 45, 55, 62, 67, 71, 74];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-70, -65, -55, -40, -30, -15, 0, 10, 25, 40, 55, 64, 70, 74];

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
  // 中線殼頂：鼻部 S 形——鼻唇 28.2（x 71）翹起成浪峰、x 62 落到 25.2 的浪谷，再往座艙爬升到 34.4；後甲板 32 平平收到車尾
  yTop: monoCurve(XS, [31.5, 32, 32.4, 32.8, 33.4, 34, 34.4, 34.4, 34.2, 34, 33.6, 32.4, 28.4, 25.2, 26.4, 28.2, 26.6]),
  // 肩稜線基本高度（前後輪上方再沿眉線拱起）
  yS: monoCurve(XS, [28.5, 29, 29.5, 29.5, 29, 28.5, 28.5, 28.5, 28.5, 29, 29.5, 28.5, 25.5, 23, 21.5, 20.5, 19]),
  // 俯視半寬：前輪上方一對寬浮筒（35），寬鈍鼻 23（進氣環在正中）；座艙兩側收成 16 的窄船身，後段 22 的窄艉、後輪外露，
  // 車尾由比車身寬的橢圓盤翼（±38）蓋住——俯視是「前寬、腰細、尾圓」
  hw: monoCurve(XS_HW, [18, 20, 21.5, 22, 21, 17.5, 16, 16.5, 30, 35, 34, 31.5, 28, 23]),
  // 側裙下緣：兩輪之間抬到 18（窄船身浮在底盤上方）
  yLow: monoCurve(XS, [12.5, 12, 11.5, 11.5, 14, 17.5, 18, 18, 17, 13.5, 11.5, 11.5, 11.8, 12.2, 12.4, 12.6, 12.8]),
  // 珍珠白中脊半寬（鼻端包住進氣環 → 座艙兩側 → 後甲板收窄）
  spine: monoCurve(XS, [8, 9, 10, 11, 12, 12.5, 12.5, 12.5, 12.5, 12, 11, 10, 9.5, 9.5, 9.5, 9.5, 9.5]),
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
    [0.34 * h, t - 0.08 * d],
    [0.64 * h, t - 0.3 * d],
    [0.87 * h, t - 0.68 * d],
    [h, s],
    [h + 0.8, lerp(s, lo, 0.5)],
    [h + 1.2, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與車鼻每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-70, -62, 1, profile).slice(0, -1), ...buildStations(-62, 58, 2, profile).slice(0, -1), ...buildStations(58, 74, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 4、前後半長 23、半寬 10） */
const CANOPY = { xc: 4, a: 23, b: 10, n: 2.8 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/** @type {(x: number) => number} 側面浪形分色線（青綠下半與海藍上半）：兩道往後推的浪，越往後越高 */
const waveY = (x) => {
  const base = lerp(17, 23.5, smoothstep(72, -68, x));
  return base + 2.6 * Math.sin(((x + 8) / 38) * Math.PI * 2);
};

/** @type {{ x: number, y: number, r: number, tube: number }} 鼻端進氣環（環心、環半徑、管半徑） */
const RING = { x: 74.4, y: 19.4, r: 5.4, tube: 1.25 };

/** @type {{ x: number, y: number, ax: number, az: number, t: number }} 車尾橢圓盤翼（中心、x / z 半軸、厚度） */
const DISC = { x: -60, y: 38.2, ax: 11, az: 38, t: 1 };

/**
 * 三叉尾鰭外形（後視 (z, y)，Ψ 字：底部橫樑接三支帶倒鉤的尖）
 * @type {number[][]}
 */
const TRIDENT = (() => {
  const y0 = DISC.y + DISC.t - 0.4;
  const bar = y0 + 2.2;
  /** @type {(zc: number, w: number, top: number) => number[][]} 一支尖（由右側往上、繞過尖端、左側往下），尖頭長 4.2、倒鉤外伸 1.8 */
  const prong = (zc, w, top) => [
    [zc + w, bar],
    [zc + w, top - 4.2],
    [zc + w + 1.8, top - 4.8],
    [zc, top],
    [zc - w - 1.8, top - 4.8],
    [zc - w, top - 4.2],
    [zc - w, bar],
  ];
  // 底邊由左到右，再依序繞過右、中、左三支尖回到左下角
  return [[-19.9, y0], [19.9, y0], ...prong(18.5, 1.4, 47.2), ...prong(0, 1.5, 48.7), ...prong(-18.5, 1.4, 47.2)];
})();

/**
 * 希臘波浪捲紋（running wave）：底線＋每格一個往後捲的半圓渦（2D 距離，負值 = 在紋樣內）
 * @type {(u: number, v: number, v0: number, period: number) => number}
 */
const runningWave = (u, v, v0, period) => {
  const w = 0.35;
  const k = Math.floor(u / period);
  const lu = u - (k + 0.5) * period;
  const r = period * 0.3;
  const cv = v0 + r + 0.3;
  // 渦：從底線往上繞 3/4 圈的圓弧
  const ang = Math.atan2(v - cv, lu);
  const arcOk = ang > -Math.PI / 2 && ang < Math.PI * 0.95;
  const dArc = arcOk ? Math.abs(Math.hypot(lu, v - cv) - r) - w : 9;
  // 底線（每格從前一個渦的底部拉到這個渦的起點）
  const dBase = Math.abs(v - v0) - w;
  return Math.min(dArc, dBase);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 愛琴海藍：主色（亮面）
  sea: namedMaterial('paint-aegean-blue', { color: 0x1670c2, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  // 青綠：浪形分色線以下、盤翼（亮面）
  teal: namedMaterial('paint-sea-teal', { color: 0x12a196, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  tealSolid: namedMaterial('paint-sea-teal', { color: 0x12a196, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
  // 珍珠白：中脊、進氣環、三叉尾鰭
  pearl: namedMaterial('paint-pearl-white', { color: 0xf3f0e8, metalness: 0.2, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  // 深海軍藍：側裙底緣（緞面）
  navy: namedMaterial('paint-deep-navy', { color: 0x0f2140, roughness: 0.55, clearcoat: 0.25 }),
  // 進氣環內的深色喉部
  throat: namedMaterial('paint-abyss-black', { color: 0x0b1018, roughness: 0.7 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1c2a36, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x141c24, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x141a22, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-navy', { color: 0x0f2140, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x111824, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dPearl: decalMaterial('decal-pearl-line', { color: 0xf3f0e8, roughness: 0.35, clearcoat: 0.6 }),
  // 浪花青光：低強度自發光（Blender 不過曝）
  dFoam: decalMaterial('decal-foam-glow', { color: 0x8ff2e6, emissive: 0x3fd8c8, emissiveIntensity: 0.4, roughness: 0.3 }),
});

export const poseidonTridentBody = makePolyBody({
  id: 'body-poseidon-trident',
  name: '波賽頓三叉戟',
  style: 'myth',
  phase: 13,
  mythSeries: 'greek',
  mythTheme: 'poseidon',
  form: 'wave-ring',
  roof: 'canopy',
  wing: 'trident-disc',
  theme: '三叉戟與浪：鈍而高的車鼻正中一個珍珠白圓形進氣環，環內一道青綠浪花渦捲；鼻部中線是浪峰 → 浪谷 → 爬升的 S 形斷面，珍珠白中脊從進氣環一路到車尾；海藍車身、側面起伏的浪形分色線下是青綠，側裙底緣一條希臘波浪捲紋；車尾單柱撐起青綠橢圓盤翼，盤上立一支三叉尾鰭',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  step: 0.7,
  // 肩稜線是銳利稜線
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 長座艙罩 x 27 → −19，最寬 10、高 6.4（座艙頂約 40.8）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = lerp(CANOPY.xc + CANOPY.a, CANOPY.xc - CANOPY.a, u);
        out.push({ x, yBase: 0, yTop: 6.4 * Math.sin(Math.PI * u ** 0.75) ** 0.5, halfW: Math.max(2.2, canopyHalfW(x)) });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 側裙底緣：深海軍藍（希臘波浪捲紋貼在這一圈上）
    { mat: 'navy', keep: (x, y) => P.yLow(x) + 4.6 - y },
    // 珍珠白中脊
    { mat: 'pearl', keep: (x, y, z) => P.spine(x) - Math.abs(z) },
    // 浪形分色線以下：青綠
    { mat: 'teal', keep: (x, y) => waveY(x) - y },
    // 海藍
    { mat: 'sea', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'pearl' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'navy', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯與輪胎內側的環形擋板（接成一個輪室）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // ── 鼻端圓形進氣環：珍珠白環（實心）＋深色喉部圓盤＋環內青綠浪花渦捲 ──
    {
      const ring = new THREE.TorusGeometry(RING.r, RING.tube, 8, 24);
      ring.rotateY(Math.PI / 2);
      ring.translate(RING.x, RING.y, 0);
      parts.push({ geometry: ring, mat: 'pearl', solid: true, outline: true, name: 'intake-ring' });
      const throat = new THREE.CylinderGeometry(RING.r, RING.r, 1.2, 24);
      throat.rotateZ(Math.PI / 2);
      throat.translate(RING.x - 0.8, RING.y, 0);
      parts.push({ geometry: throat, mat: 'throat', solid: true, name: 'intake-throat' });
      // 浪花渦捲：從環內緣往中心捲 1.4 圈的螺線（管徑 0.55）
      /** @type {number[][]} */
      const spiral = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        const a = Math.PI * 0.6 + u * Math.PI * 2 * 1.4;
        const r = lerp(RING.r - 1.0, 0.9, u);
        spiral.push([RING.x + 0.15, RING.y + r * Math.sin(a), r * Math.cos(a)]);
      }
      parts.push({ geometry: sweepEllipse(spiral, 40, (u) => [lerp(0.6, 0.35, u), lerp(0.6, 0.35, u)], 8), mat: 'tealSolid', solid: true, name: 'intake-wave-curl' });
    }

    // ── 車尾：單柱（珍珠白）撐起青綠橢圓盤翼，盤上立三叉尾鰭（珍珠白，後視 Ψ）──
    {
      const yDeck = P.yTop(-58) - 1;
      const pylon = [
        [-51, yDeck],
        [-54.5, DISC.y + 0.2],
        [-64.5, DISC.y + 0.2],
        [-63, P.yTop(-63) - 1],
      ];
      parts.push({ geometry: finPlate(pylon, 0, 2.2), mat: 'pearl', solid: true, outline: true, name: 'disc-pylon' });
      /** @type {number[][]} 橢圓盤翼俯視外形 */
      const disc = [];
      for (let i = 0; i < 32; i++) {
        const a = (2 * Math.PI * i) / 32;
        disc.push([DISC.x + DISC.ax * Math.cos(a), DISC.az * Math.sin(a)]);
      }
      parts.push({ geometry: flatPlate(disc, DISC.y, DISC.t), mat: 'tealSolid', solid: true, outline: true, name: 'disc-wing' });
      const trident = finPlate(TRIDENT, 0, 2);
      trident.rotateY(Math.PI / 2);
      trident.translate(-61.5, 0, 0);
      parts.push({ geometry: trident, mat: 'pearl', solid: true, outline: true, name: 'trident-fin' });
    }

    // ---- 貼紙 ----
    // 中脊兩側的珍珠白細邊已由分區做出；分區交界加一道浪花青光細線（線寬 0.7），從進氣環兩側一路拉到車尾
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - P.spine(x) - 0.6), 73 - x, x + 69.5, -kit.underCanopy(x, z) - 0.6)),
      mat: 'dFoam',
      name: 'decal-spine-foam-line',
    });
    // 浪形分色線上的珍珠白細線
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(Math.abs(v - waveY(side * u) - 0.35) - 0.35, v - shoulderY(side * u) + 0.6), { x0: 0, y0: 0, zMin: 12, side })),
        mat: 'dPearl',
        name: `decal-wave-line-${side}`,
      });
      // 側裙底緣的希臘波浪捲紋（珍珠白，前後輪之間）
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(runningWave(u + 40, v, P.yLow(side * u) + 0.9, 5.2), Math.abs(u) - 22), { x0: 0, y0: 0, zMin: 12, side })),
        mat: 'dPearl',
        name: `decal-running-wave-${side}`,
      });
    }
    // 座艙罩珍珠白細框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > CANOPY.xc - CANOPY.a - 1.2 && x < CANOPY.xc + CANOPY.a + 1.2 ? Math.min(u + 0.9, 0.05 - u) : -1;
      }),
      mat: 'dPearl',
      name: 'decal-canopy-frame',
    });
    // 細縫頭燈（浪花青光）：鼻端進氣環兩側各一道橫縫
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.5 - Math.abs(y - (shoulderY(x) - 1.4)), x - 66, 73.5 - x, Math.abs(z) - 10)),
      mat: 'dFoam',
      name: 'lamp-slit-headlights',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    fourview: 'shared/design/fourview-ref/fourview_11_v1.png（AI 參考圖，只取造型：鈍鼻正中的圓形進氣環、寬方車身、長座艙、車尾單柱橢圓盤翼；尺寸以底盤為準）',
    geometry: '本檔站位產生器 P（推估）：殼 x −70 ~ 74、進氣環前緣約 75.7；中線鼻唇 28.2、浪谷 25.2、座艙段 34.4、後甲板 32、座艙頂約 40.8、三叉尾鰭頂 48.7（全車最高）；半寬前輪上方 35、座艙兩側收成 16 的窄船身、後段 22（後輪外露）、鼻端 23、車尾 18；兩輪之間下緣 18',
    ring: '進氣環：ABS 實心環，環半徑 5.4、管半徑 1.25（Torus 8×24 段）；喉部圓盤厚 1.2；浪花渦捲為管徑 1.2 → 0.7 的螺線（推估）',
    tail: '單柱厚 2.2、橢圓盤翼半軸 11 × 38（比車身寬）、厚 1；三叉尾鰭厚 2、寬 ±19.9、中尖頂 48.7（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
