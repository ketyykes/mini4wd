// 哪吒風火（body-nezha-windfire，神話組・中國）：照四視圖 29 建模，哪吒只用《封神演義》裡的法寶表現（風火輪、乾坤圈、混天綾），
// 不做神像、人形、臉、童子造型。四視圖 29 留下的造型：從兩個前擋泥板之間伸出的細長矛頭鼻、從鼻尖一路斜升的長楔形背線、
// 後移的多面切削座艙、前輪後方的大進氣口、紅白藍三色分區（紅色中脊、白色側板、深藍下裙）。四視圖像縮小的超跑，這裡壓低車頂、
// 把前後輪拱外擴，做回四驅車的矮寬感。
// 火尖槍 → 矛頭鼻（頸部收細、槍刃微微鼓起再收成尖，槍刃前段是朱紅火焰、根部一道金色槍箍）；
// 風火輪 → 前後輪拱外圍一圈金色輪圈紋＋往後捲的紅色火舌（輪框是底盤零件，不改）；
// 乾坤圈 → 車尾立起的開放金色橢圓環箍，環的上半圈外緣一排往外捲的金色火焰齒；混天綾 → 兩側白色側板上起伏到車尾的朱紅長帶（金邊）。
// 配色：深紅中脊、珍珠白側板、深藍下裙、金。不模仿動畫電影《哪吒之魔童降世》《哪吒之魔童鬧海》的角色或道具設計。
// 設計：shared/design/body-nezha-windfire/DESIGN.md（來源見該檔；MYTH_RESEARCH 中國節 7-3 的信仰注意事項）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、鼻尖 77 */
const XS = [-70, -64, -56, -48, -40, -25, -10, 5, 20, 30, 40, 50, 58, 64, 70, 74, 77];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-70, -64, -56, -48, -40, -30, -18, -5, 8, 20, 30, 40, 50, 52, 54.2, 55.6, 58, 61, 64, 69, 73, 77];

/** @type {{ x: number, y: number, r: number }} 前擋泥板眉線：以前輪拱圓心為圓心、半徑 18.6 的圓弧（外擴的前輪拱） */
const FRONT_BROW = { x: 40, y: 13, r: 18.6 };

/**
 * 平滑取大值
 * @type {(a: number, b: number, k: number) => number}
 */
const smoothMax = (a, b, k) => (a + b + Math.sqrt((a - b) ** 2 + k * k)) / 2;

/** @type {(x: number) => number} 前擋泥板眉線高度 */
const browY = (x) => {
  const dx = x - FRONT_BROW.x;
  return Math.abs(dx) < FRONT_BROW.r ? FRONT_BROW.y + Math.sqrt(FRONT_BROW.r ** 2 - dx * dx) : 0;
};

/** @type {(x: number) => number} 肩稜線的基本高度：後輪臀 29.4，往前一路斜降到鼻尖 11.4（前輪上方另由眉線拱起） */
const ySBase = monoCurve(XS, [28.4, 29, 29.4, 29.4, 29, 27.6, 26.4, 25.8, 24.6, 23.4, 22, 19.6, 17.2, 15.4, 13.4, 12.2, 11.4]);
/** @type {(x: number) => number} 中線殼頂的基本高度：後甲板 31，從座艙前一路直線斜降到矛尖鼻（鼻尖 11.8） */
const yTopBase = monoCurve(XS, [30.4, 30.8, 31, 31, 30.8, 30.4, 30, 29, 27.4, 25.6, 23.4, 20.8, 18.4, 16.4, 14.2, 12.8, 11.8]);

/** @type {(x: number) => number} 前輪拱圓柱（R17.5）在 x 處的頂高；圓柱外回傳 0 */
const archTopY = (x) => {
  const dx = x - FRONT_BROW.x;
  return Math.abs(dx) < 17.5 ? FRONT_BROW.y + Math.sqrt(17.5 ** 2 - dx * dx) : 0;
};

/**
 * 中線殼頂的下限：輪拱切口的內側邊界是 |z| = 22.5 的平面，引擎蓋在這個平面上的高度要比輪拱圓柱高 1.1 mm 以上，
 * 輪拱才不會在引擎蓋上擦出一道細長的裂縫。半剖面在 |z| = 22.5 處的高度 = (1 − f)·殼頂 + f·肩稜線（f 依剖面點位內插），
 * 由此反推殼頂的最小值。前擋泥板以外回傳 0
 * @type {(x: number) => number}
 */
const yTopMin = (x) => {
  const c = archTopY(x);
  const h = P.hw(x);
  if (c === 0 || h <= 22.5) {
    return 0;
  }
  const q = 22.5 / h;
  /** @type {number[][]} 剖面點位：[z / 半寬, 往肩稜線的比例 f] */
  const knots = [[0, 0], [0.34, 0.1], [0.64, 0.36], [0.87, 0.72], [1, 1]];
  let f = 1;
  for (let i = 0; i < knots.length - 1; i++) {
    const [q0, f0] = knots[i];
    const [q1, f1] = knots[i + 1];
    if (q >= q0 && q <= q1) {
      f = f0 + ((f1 - f0) * (q - q0)) / (q1 - q0);
    }
  }
  return f >= 0.98 ? 0 : (c + 1.1 - f * P.yS(x)) / (1 - f);
};

/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（肩稜線）：寬方的車尾（後輪臀後方外擴到 ±44.5、車尾仍有 ±38，乾坤圈立在上面）、座艙兩側深收腰 ±25、
  // 前輪上方 ±36（外擴的前輪拱）；前擋泥板在 x 54.2–55.6 收進輪拱切口邊界以內，之後是從兩個擋泥板之間伸出的矛頭鼻（槍頸 x 61 ±6.4、槍刃最寬 x 64 ±7.6，鼻尖 ±0.4）
  hw: monoCurve(XS_HW, [38, 43.5, 44.5, 43, 41.5, 33, 25, 25.4, 28.5, 32.5, 35.5, 36, 32.5, 29, 23.5, 20.2, 8.5, 6.4, 7.6, 5.6, 3, 0.4]),
  // 肩稜線高度：前輪上方沿眉線圓弧拱起（外擴輪拱）
  yS: (x) => smoothMax(ySBase(x), browY(x), 1.4),
  // 中線殼頂：前輪拱之間的引擎蓋比擋泥板低（最多低 3 mm，兩道輪拱夾著楔形引擎蓋）
  yTop: (x) => smoothMax(yTopBase(x), Math.max(yTopMin(x), smoothMax(ySBase(x), browY(x), 1.4) - 3), 0.8),
  // 側裙下緣：後軸之後往上收到 22（寬車尾的裙邊要高過後導輪頂 20.5）
  yLow: monoCurve(XS, [22, 21.8, 14, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11, 12, 12.4, 12.4, 12.4]),
};

/** @type {number} 前後輪之間側裙下緣的半寬 */
const SILL_W = 38;

/**
 * 半剖面 7 點：中線 → 頂面 → 肩稜線（銳利）→ 微外張的側裙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  const d = t - s;
  const flare = smoothstep(1, 8, h);
  // 前後輪之間的側裙往外張到 ±38、下半段是直立側牆，從上面和側面都看不到底盤側框
  const sill = Math.max(h + 1.3 * flare, SILL_W * smoothstep(-24, -16, x) * smoothstep(24, 16, x));
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [Math.max(h + 0.9 * flare, sill - 0.4), lerp(s, lo, 0.42)],
    [sill, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = [...buildStations(-70, -60, 1.4, profile).slice(0, -1), ...buildStations(-60, 54, 2.4, profile).slice(0, -1), ...buildStations(54, 77, 1.3, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ x0: number, x1: number, peakX: number, rise: number, halfW: number }} 多面切削座艙（四視圖 29：後移、前窗很斜） */
const CANOPY = { x0: 24, x1: -30, peakX: -8, rise: 10, halfW: 13 };

/**
 * 乾坤圈：車尾的開放金色橢圓環箍（立在 yz 平面，前後看是一個扁圓環，環內不放翼板）。x / yc = 環心；az / ay = 橫向 / 垂直半軸；tube = 管半徑
 * @type {{ x: number, yc: number, az: number, ay: number, tube: number }}
 */
const RING = { x: -63, yc: 35.6, az: 25, ay: 7, tube: 1.25 };

/**
 * 乾坤圈外緣的火焰齒：上半圈（環角 22°–158°）9 支四角錐，長短交替，齒尖往順時針方向捲 24°（像環在旋轉時甩出的火）
 * @type {{ n: number, from: number, to: number, len: number[], swirl: number, r: number }}
 */
const RING_TEETH = { n: 9, from: 22, to: 158, len: [4, 2.8], swirl: 24, r: 1.2 };

/**
 * 橢圓環管（24 段 × 管斷面 6 段，封閉的環面）
 * @type {(ring: typeof RING) => THREE.BufferGeometry}
 */
const buildRingTube = (ring) => {
  const nu = 24;
  const nv = 6;
  /** @type {(i: number, j: number) => number[]} */
  const pt = (i, j) => {
    const u = (2 * Math.PI * i) / nu;
    const v = (2 * Math.PI * j) / nv;
    const cz = ring.az * Math.cos(u);
    const cy = ring.yc + ring.ay * Math.sin(u);
    // 管斷面在環所在平面的法向（橢圓法線）與 x 方向上展開
    const nz = Math.cos(u) / ring.az;
    const ny = Math.sin(u) / ring.ay;
    const nl = Math.hypot(nz, ny);
    return [ring.x + ring.tube * Math.sin(v), cy + ((ring.tube * Math.cos(v)) * ny) / nl, cz + ((ring.tube * Math.cos(v)) * nz) / nl];
  };
  /** @type {number[]} */
  const pos = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + 1, j + 1);
      const d = pt(i, j + 1);
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @type {{ r0: number, r1: number }} 風火輪的金色輪圈紋：以輪拱圓心為中心的環帶內外半徑 */
const WHEEL_RING = { r0: 18.4, r1: 20.4 };

/**
 * 風火輪的火舌（輪圈紋外側）：火舌外緣半徑 = 20.4 + 舌狀起伏（後輪最高 7、前輪 5.4）；角度隨半徑往後偏，火舌往後上方捲（像輪子往前滾時被風吹向後）
 * @type {(x: number, y: number) => number} 正值 = 在火舌內
 */
const wheelFlame = (x, y) => {
  let best = -Infinity;
  for (const a of ARCHES) {
    const dx = x - a.x;
    const dy = y - a.y;
    const r = Math.hypot(dx, dy);
    if (dy < -1) {
      continue;
    }
    const th = Math.atan2(dy, dx) - 0.08 * (r - 17.5);
    const tongue = (0.5 + 0.5 * Math.cos(7 * th)) ** 2.2;
    const amp = a.x < 0 ? 7 : 5.4;
    best = Math.max(best, WHEEL_RING.r1 + amp * tongue - r);
  }
  return best;
};

/**
 * 風火輪的金色輪圈紋
 * @type {(x: number, y: number) => number} 正值 = 在輪圈紋內
 */
const wheelRing = (x, y) => {
  let best = -Infinity;
  for (const a of ARCHES) {
    const r = Math.hypot(x - a.x, y - a.y);
    if (y - a.y < -1) {
      continue;
    }
    best = Math.max(best, Math.min(r - WHEEL_RING.r0, WHEEL_RING.r1 - r));
  }
  return best;
};

/**
 * 紅色中脊的半寬：車尾 ±22、座艙兩側 ±16.5，前擋泥板之間收成 ±6.2 的槍桿，矛頭鼻整支是紅色
 * @type {(x: number) => number}
 */
const spineW = monoCurve([-70, -50, -30, 0, 20, 36, 56, 61, 77], [23, 22, 17, 16.5, 13, 7, 6.2, 7, 9]);

/**
 * 深藍下裙的上緣：前後輪之間在裙邊上 6 mm，往鼻尖與車尾收到 3.5 mm
 * @type {(x: number) => number}
 */
const navyTop = (x) => P.yLow(x) + 3.5 + 2.5 * smoothstep(-58, -30, x) * smoothstep(64, 46, x);

/**
 * 火尖槍的槍刃火焰（朱紅，畫在矛頭鼻上）：鼻尖到 x 66 是整片火焰，後緣是往後伸的 V 形火舌（中線最長，伸到 x 62）
 * @type {(x: number, z: number) => number} 正值 = 在火焰內
 */
const spearFlame = (x, z) => x - 62 - 4 * Math.min(1, Math.abs(z) / Math.max(1, P.hw(x)));

/**
 * 混天綾的中心線：側面段（前輪後方從肩稜線下方起伏，停在後輪的風火輪紋前）
 * @type {{ sideY: (x: number) => number }}
 */
const SASH = {
  sideY: (x) => P.yS(x) - 1.8 - 6 * Math.sin(Math.PI * smoothstep(22, -36, x)) * smoothstep(24, 14, x),
};

/**
 * 混天綾到中心線的距離（mm）：只畫側面段（引擎蓋是紅色中脊）
 * @type {(x: number, y: number, z: number) => number}
 */
const sashDist = (x, y, z) => {
  const az = Math.abs(z);
  let d = Infinity;
  if (x < 22 && x > -21 && az > P.hw(x) - 1) {
    d = Math.min(d, Math.abs(y - SASH.sideY(x)));
  }
  return d;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 深紅：車身主色（亮面漆）
  crimson: namedMaterial('paint-crimson-red', { color: 0xa3161f, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 金色金屬漆：風火輪輪圈紋
  flameGold: namedMaterial('paint-flame-gold', { color: 0xd8a83c, metalness: 0.6, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
  // 真金屬（乾坤圈；名稱含 -brass → Blender metallic）
  ringGold: namedMaterial('trim-ring-gold-brass', { color: 0xc9a54a, metalness: 0.85, roughness: 0.25, clearcoat: 0.3 }),
  // 珍珠白：側板
  white: namedMaterial('paint-pearl-white', { color: 0xf3f1ec, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  // 深藍：下裙
  navy: namedMaterial('paint-navy-blue', { color: 0x1c2a52, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  ink: namedMaterial('paint-ink-black', { color: 0x15151a, roughness: 0.5, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x24242c, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x18181b, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x1a1a1e, roughness: 0.7, side: THREE.DoubleSide }),
  dScarlet: decalMaterial('decal-sash-scarlet', { color: 0xe23a24, roughness: 0.35, clearcoat: 0.6 }),
  dGold: decalMaterial('decal-gold-line', { color: 0xd4b052, metalness: 0.75, roughness: 0.3 }),
  dInk: decalMaterial('decal-ink-black', { color: 0x15151a, roughness: 0.5, clearcoat: 0.2 }),
});

/**
 * 側面大進氣口（四視圖 29 前輪後方的斜格柵進氣口，黑）：前緣往後傾的梯形
 * @type {(x: number, y: number) => number} 正值 = 在進氣口內
 */
const sideIntake = (x, y) => {
  const lo = P.yLow(x) + 2.4;
  const hi = Math.min(21.5, SASH.sideY(x) - 3.4);
  const shear = 0.7 * (y - lo);
  return Math.min(16 - shear - x, x + 12 + 0.3 * shear, y - lo, hi - y, wheelFlame(x, y) < 0 ? 1 : -1);
};

export const nezhaWindfireBody = makePolyBody({
  id: 'body-nezha-windfire',
  name: '哪吒風火',
  style: 'myth',
  phase: 13,
  mythSeries: 'chinese',
  mythTheme: 'nezha',
  form: 'spear-wedge-flare',
  roof: 'canopy',
  wing: 'qiankun-hoop',
  theme: '照四視圖 29 建模並壓低加寬：從兩個前擋泥板之間伸出的火尖槍矛頭鼻（朱紅槍刃火焰、金槍箍）、長楔形背線、後移多面座艙、外擴輪拱；風火輪化成前後輪拱外圍的金色輪圈紋＋紅色火舌，乾坤圈是車尾開放的金色橢圓環箍（上半圈外緣火焰齒），混天綾是側板上的朱紅金邊長帶；紅色中脊、白色側板、深藍下裙',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  step: 1.0,
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'trapezoid',
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 32;
      for (let i = 0; i <= n; i++) {
        const x = lerp(CANOPY.x0, CANOPY.x1, i / n);
        const front = x >= CANOPY.peakX;
        const t = front ? (CANOPY.x0 - x) / (CANOPY.x0 - CANOPY.peakX) : (x - CANOPY.x1) / (CANOPY.peakX - CANOPY.x1);
        const rise = CANOPY.rise * Math.sin((Math.PI / 2) * t) ** (front ? 0.9 : 0.6);
        // 俯視前尖後方：前端 2.5 → x −2 最寬 → 後端 8
        const halfW = x >= -2 ? lerp(CANOPY.halfW, 2.5, smoothstep(-2, CANOPY.x0, x) ** 1.2) : lerp(CANOPY.halfW, 8, smoothstep(-14, CANOPY.x1, x));
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 22,
  zones: () => [
    // 風火輪：金色輪圈紋＋紅色火舌（只在側壁）
    { mat: 'flameGold', keep: (x, y, z) => Math.min(wheelRing(x, y), Math.abs(z) - P.hw(x) + 1.2) },
    { mat: 'crimson', keep: (x, y, z) => Math.min(wheelFlame(x, y), Math.abs(z) - P.hw(x) + 1.2) },
    // 深藍下裙
    { mat: 'navy', keep: (x, y) => Math.min(navyTop(x) - y, 56 - x) },
    // 深紅中脊（含整支矛頭鼻）
    { mat: 'crimson', keep: (x, y, z) => spineW(x) - Math.abs(z) },
    // 珍珠白側板
    { mat: 'white', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'crimson' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'crimson', glass: 'glass', cockpit: 'ink', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 乾坤圈：金色橢圓環箍（24×6），底部壓進後甲板
    parts.push({ geometry: buildRingTube(RING), mat: 'ringGold', solid: true, outline: true, name: 'qiankun-hoop' });
    // 環的兩支短柱（金，16 段）：環下弧接到後甲板
    /** @type {THREE.BufferGeometry[]} */
    const posts = [];
    for (const side of [-1, 1]) {
      const zc = side * 17;
      const yRing = RING.yc - RING.ay * Math.sqrt(1 - (zc / RING.az) ** 2);
      const yDeck = P.yTop(RING.x) - 2;
      const post = new THREE.CylinderGeometry(1.1, 1.3, yRing - yDeck, 16);
      post.translate(RING.x, (yRing + yDeck) / 2, zc);
      posts.push(post);
    }
    parts.push({ geometry: mergeGeos(posts), mat: 'ringGold', solid: true, outline: true, name: 'qiankun-posts' });
    // 乾坤圈外緣的火焰齒（金，四角錐 4 段）：齒根貼在環管外緣，沿橢圓外法線往外、再往順時針方向捲
    /** @type {THREE.BufferGeometry[]} */
    const teeth = [];
    for (let k = 0; k < RING_TEETH.n; k++) {
      const u = ((RING_TEETH.from + ((RING_TEETH.to - RING_TEETH.from) * k) / (RING_TEETH.n - 1)) * Math.PI) / 180;
      const nz0 = Math.cos(u) / RING.az;
      const ny0 = Math.sin(u) / RING.ay;
      const nl = Math.hypot(nz0, ny0);
      const baseZ = RING.az * Math.cos(u) + (RING.tube * 0.6 * nz0) / nl;
      const baseY = RING.yc + RING.ay * Math.sin(u) + (RING.tube * 0.6 * ny0) / nl;
      const len = RING_TEETH.len[k % 2];
      const th = Math.atan2(nz0, ny0) - (RING_TEETH.swirl * Math.PI) / 180;
      const tooth = new THREE.ConeGeometry(RING_TEETH.r, len, 4);
      tooth.translate(0, len / 2, 0);
      tooth.scale(0.7, 1, 1);
      tooth.rotateX(th);
      tooth.translate(RING.x, baseY, baseZ);
      teeth.push(tooth);
    }
    parts.push({ geometry: mergeGeos(teeth), mat: 'ringGold', solid: true, outline: true, name: 'qiankun-flame-teeth' });

    // ---- 貼紙 ----
    // 座艙框（金）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > CANOPY.x1 - 1.2 && x < CANOPY.x0 + 1.2 ? Math.min(u + 1.0, 0.05 - u) : -1;
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // 混天綾：金邊（寬 5.6）＋朱紅帶身（寬 4.4）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(2.8 - sashDist(x, y, z), -kit.underCanopy(x, z) - 0.5)), mat: 'dGold', name: 'decal-sash-edge' });
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(2.2 - sashDist(x, y, z), -kit.underCanopy(x, z) - 0.5), { offset: 0.1 }), mat: 'dScarlet', name: 'decal-sash' });
    // 火尖槍：槍刃前段的朱紅火焰＋槍頸的金色槍箍（線寬 1.4）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(spearFlame(x, z), y - P.yS(x) + 0.6)), mat: 'dScarlet', name: 'decal-spear-flame' });
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.7 - Math.abs(x - 59.5), 9 - Math.abs(z), y - P.yLow(x) - 0.6)), mat: 'dGold', name: 'decal-spear-collar' });
    // 紅色中脊與白色側板交界的金色細線（線寬 0.9，只在頂面）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.45 - Math.abs(Math.abs(z) - spineW(x) - 0.45), 56 - x, x + 69, y - P.yS(x) + 0.3)), mat: 'dGold', name: 'decal-spine-line' });
    // 深藍下裙上緣的金色細線（線寬 0.8）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.4 - Math.abs(y - navyTop(x) - 0.4), Math.abs(z) - 14, wheelRing(x, y) < 0 && wheelFlame(x, y) < 0 ? 1 : -1)), mat: 'dGold', name: 'decal-navy-line' });
    // 側面大進氣口（黑）
    parts.push({ geometry: kit.decal((x, y, z) => (Math.abs(z) < 22 ? -1 : sideIntake(x, y))), mat: 'dInk', name: 'decal-side-intake' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估，造型照 shared/design/body-nezha-windfire/fourview.png 四視圖 29 的比例，尺寸照底盤；四視圖車頂較高，這裡壓低）：殼長 147（車尾 −70 ~ 鼻尖 77）；後甲板 31、鼻尖頂 11.8、座艙頂約 40、前輪拱頂約 31.6；寬方車尾：後輪臀後方 ±44.5、車尾 ±38；座艙兩側 ±25（側裙下緣 ±38）、前輪上方 ±36、矛頭鼻槍頸 ±6.4、槍刃 ±7.6 → ±0.4；前擋泥板眉線為前輪拱同心圓 R18.6',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    ring: '乾坤圈（ABS 實心件，推估）：橢圓環心 x −63、y 35.6，半軸 25 × 7，管半徑 1.25（24×6 段），環內不放翼板；兩支短柱 R1.1–1.3（16 段）；上半圈外緣 9 支火焰齒（四角錐，底 1.7 × 2.4、長 4 / 2.8 交替、往順時針捲 24°）',
    palette: '紅白藍三色照四視圖 29：深紅中脊（含矛頭鼻）與火舌、珍珠白側板、深藍下裙，紅色面積不到一半；金（風火輪輪圈紋、乾坤圈、槍箍、分色細線、座艙框）＋朱紅綾帶與槍刃火焰；色碼自訂（推估）：深紅 #A3161F、朱紅 #E23A24、深藍 #1C2A52、金 #D8A83C / #C9A54A、白 #F3F1EC',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
