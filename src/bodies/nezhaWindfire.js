// 哪吒風火（body-nezha-windfire，神話組・中國）：照四視圖 29 建模，哪吒只用《封神演義》裡的法寶表現（風火輪、乾坤圈、混天綾），
// 不做神像、人形、臉、童子造型。四視圖 29 留下的造型：俯視細長三角的長尖鼻、從鼻尖一路斜升的長楔形背線、
// 後移的多面切削座艙、前輪後方的大進氣口、紅白藍三色分區（紅色中脊、白色側板、深藍下裙）。四視圖像縮小的超跑，這裡壓低車頂、
// 把前後輪拱外擴，做回四驅車的矮寬感。
// 火尖槍 → 長尖鼻（紅色中脊一路收到鼻尖、鼻尖前段是朱紅火焰）；
// 風火輪 → 前後輪拱外圍一圈金色輪圈紋＋往後捲的紅色火舌（輪框是底盤零件，不改）；
// 乾坤圈 → 直立在車尾口字形框尾翼（深紅側立板＋上板、金色描邊）正中央的金色圓環；混天綾 → 兩側白色側板上起伏到車尾的朱紅長帶（金邊）。
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

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −74、鼻尖 76.6 */
const XS = [-74, -64, -56, -48, -40, -25, -10, 5, 20, 30, 40, 50, 58, 64, 70, 74, 76.6];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-74, -64, -56, -48, -40, -30, -18, -5, 8, 20, 30, 40, 50, 52, 54.2, 55.6, 58, 61, 64, 69, 73, 76.6];

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
const ySBase = monoCurve(XS, [28.4, 29, 29.4, 29.4, 29, 27.6, 26.4, 25.8, 24.6, 23.4, 22, 19.6, 17.2, 15.4, 13.4, 12.4, 11.7]);
/** @type {(x: number) => number} 中線殼頂的基本高度：後甲板 31，從座艙前一路直線斜降到矛尖鼻（鼻尖 11.8） */
const yTopBase = monoCurve(XS, [30.4, 30.8, 31, 31, 30.8, 30.4, 30, 29, 27.4, 25.6, 23.4, 20.8, 18.4, 16.4, 14.4, 12.9, 11.9]);

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
  // 前輪上方 ±36（外擴的前輪拱）；前擋泥板在 x 54.2–55.6 收進輪拱切口邊界以內，之後是四視圖 29 的長尖鼻：俯視從前輪前方一路直線收成細長三角（x 58 ±14.4、x 64 ±8.2、x 69 ±5，鼻尖 ±0.3；頂面、肩稜線、裙邊在鼻尖收成一點，是尖錐）
  hw: monoCurve(XS_HW, [38, 43.5, 44.5, 43, 41.5, 33, 25, 25.4, 28.5, 32.5, 35.5, 36, 32.5, 29, 23.5, 20.2, 14.4, 11, 8.2, 5, 2.4, 0.3]),
  // 肩稜線高度：前輪上方沿眉線圓弧拱起（外擴輪拱）
  yS: (x) => smoothMax(ySBase(x), browY(x), 1.4),
  // 中線殼頂：前輪拱之間的引擎蓋比擋泥板低（最多低 3 mm，兩道輪拱夾著楔形引擎蓋）
  yTop: (x) => smoothMax(yTopBase(x), Math.max(yTopMin(x), smoothMax(ySBase(x), browY(x), 1.4) - 3), 0.8),
  // 側裙下緣：後軸之後往上收到 22（寬車尾的裙邊要高過後導輪頂 20.5）
  yLow: monoCurve(XS, [22, 21.8, 14, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11, 11.6, 11.6, 11.6, 11.4]),
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
const STATIONS = [...buildStations(-74, -60, 1.4, profile).slice(0, -1), ...buildStations(-60, 54, 2.4, profile).slice(0, -1), ...buildStations(54, 76.6, 1.3, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ x0: number, x1: number, peakX: number, rise: number, halfW: number }} 多面切削座艙（四視圖 29：後移、前窗很斜） */
const CANOPY = { x0: 24, x1: -30, peakX: -8, rise: 10, halfW: 13 };

/**
 * 乾坤圈：掛在空心方框尾翼後框條下方的金色圓環（立在 yz 平面，從後面看是框裡的一個圓環），上緣掛在後框條、下緣靠著後甲板。
 * x / yc = 環心；az / ay = 橫向 / 垂直半軸；tube = 管半徑
 * @type {{ x: number, yc: number, az: number, ay: number, tube: number }}
 */
const RING = { x: -68.8, yc: 37.5, az: 6, ay: 5.4, tube: 1.1 };

/**
 * 空心方框尾翼（四視圖 29 車尾）：上框是四根細框條圍成的長方形（俯視中間空），兩側是從後甲板立起、往後掠的空心框形立板
 * （側視中間空），後視是一個「口」字。x0 / x1 = 上框前後緣；y = 上框底面高度；halfW = 側立框的 |z|；thick = 框條厚；bar = 框條寬
 * @type {{ x0: number, x1: number, y: number, halfW: number, thick: number }}
 */
const FRAME = { x0: -55, x1: -70, y: 44, halfW: 25, thick: 1.4, bar: 2.4 };

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
 * 紅色中脊的半寬：車尾 ±22、座艙兩側 ±16.5，前擋泥板之間收成 ±6.2 的槍桿，到鼻尖保持 ±7–9
 * @type {(x: number) => number}
 */
const spineW = monoCurve([-70, -50, -30, 0, 20, 36, 56, 61, 77], [23, 22, 17, 16.5, 13, 7, 6.2, 7, 9]);

/**
 * 深藍下裙的上緣：前後輪之間在裙邊上 8.5 mm，往鼻尖與車尾收到 4.5 mm
 * @type {(x: number) => number}
 */
const navyTop = (x) => P.yLow(x) + 4.5 + 4 * smoothstep(-58, -30, x) * smoothstep(64, 46, x);

/**
 * 火尖槍的槍刃火焰（朱紅，畫在長尖鼻上）：鼻尖到 x 66 是整片火焰，後緣是往後伸的 V 形火舌（中線最長，伸到 x 62）
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

/**
 * 中間挖空的水平板（俯視外框 outer、挖空 inner，點位 [x, z]），底面高 y、厚 thick
 * @type {(outer: number[][], inner: number[][], y: number, thick: number) => THREE.BufferGeometry}
 */
const holedFlatPlate = (outer, inner, y, thick) => {
  const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
  shape.holes.push(new THREE.Path(inner.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
};

/**
 * 中間挖空的直立板（側視外框 outer、挖空 inner，點位 [x, y]），中心 z = zc、厚 thick
 * @type {(outer: number[][], inner: number[][], zc: number, thick: number) => THREE.BufferGeometry}
 */
const holedFinPlate = (outer, inner, zc, thick) => {
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  shape.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, zc - thick / 2);
  return g;
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
  theme: '照四視圖 29 建模並壓低加寬：俯視細長三角的火尖槍長尖鼻（鼻尖朱紅火焰）、長楔形背線、後移多面座艙、外擴輪拱；風火輪化成前後輪拱外圍的金色輪圈紋＋紅色火舌，車尾口字形框尾翼正中央直立金色乾坤圈，混天綾是側板上的朱紅金邊長帶；紅色中脊、白色側板、深藍下裙',
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
    // 深紅中脊（一路到鼻尖）
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

    // 空心方框尾翼：上框（深紅，俯視中間空）＋外緣金色描邊＋兩片空心側立框（深紅，側視中間空）
    const deckAt = (/** @type {number} */ x) => P.yTop(x) - 1.5;
    const B = FRAME.bar;
    const W = FRAME.halfW + 1.2;
    const top = holedFlatPlate(
      [
        [FRAME.x0, -W],
        [FRAME.x0, W],
        [FRAME.x1, W],
        [FRAME.x1, -W],
      ],
      [
        [FRAME.x0 - B, -W + B],
        [FRAME.x1 + B, -W + B],
        [FRAME.x1 + B, W - B],
        [FRAME.x0 - B, W - B],
      ],
      FRAME.y,
      FRAME.thick,
    );
    parts.push({ geometry: top, mat: 'crimson', solid: true, outline: true, name: 'frame-wing-top' });
    const trim = holedFlatPlate(
      [
        [FRAME.x0 + 0.7, -W - 0.7],
        [FRAME.x0 + 0.7, W + 0.7],
        [FRAME.x1 - 0.7, W + 0.7],
        [FRAME.x1 - 0.7, -W - 0.7],
      ],
      [
        [FRAME.x0 - B + 0.4, -W + B - 0.4],
        [FRAME.x1 + B - 0.4, -W + B - 0.4],
        [FRAME.x1 + B - 0.4, W - B + 0.4],
        [FRAME.x0 - B + 0.4, W - B + 0.4],
      ],
      FRAME.y - 0.3,
      0.3,
    );
    parts.push({ geometry: trim, mat: 'ringGold', solid: true, outline: true, name: 'frame-wing-trim' });
    /** @type {THREE.BufferGeometry[]} */
    const uprights = [];
    const dF = deckAt(FRAME.x0 + 6);
    const dR = deckAt(FRAME.x1 + 3);
    for (const side of [-1, 1]) {
      uprights.push(
        holedFinPlate(
          [
            [FRAME.x0 + 6, dF],
            [FRAME.x0, FRAME.y + 0.2],
            [FRAME.x1, FRAME.y + 0.2],
            [FRAME.x1 + 3, dR],
          ],
          [
            [FRAME.x0 + 3.2, dF + 2.4],
            [FRAME.x1 + 5.2, dR + 2.4],
            [FRAME.x1 + 2.6, FRAME.y - 2],
            [FRAME.x0 - 1.6, FRAME.y - 2],
          ],
          side * FRAME.halfW,
          1.6,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(uprights), mat: 'crimson', solid: true, outline: true, name: 'frame-wing-uprights' });
    // 乾坤圈：掛在後框條下方的金色圓環（24×6）
    parts.push({ geometry: buildRingTube(RING), mat: 'ringGold', solid: true, outline: true, name: 'qiankun-ring' });

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
    // 火尖槍：長尖鼻前段的朱紅火焰
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(spearFlame(x, z), y - P.yS(x) + 0.6)), mat: 'dScarlet', name: 'decal-spear-flame' });
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
    geometry: '本檔站位產生器 P（推估，造型照 shared/design/body-nezha-windfire/fourview.png 四視圖 29 的比例，尺寸照底盤；四視圖車頂較高，這裡壓低）：殼長 150.6（車尾 −74 ~ 鼻尖 76.6）；後甲板 31、鼻尖頂 11.8、座艙頂約 40、前輪拱頂約 31.6；寬方車尾：後輪臀後方 ±44.5、車尾 ±38；座艙兩側 ±25（側裙下緣 ±38）、前輪上方 ±36、長尖鼻 x 58 ±15 → x 69 ±6.2 → 鼻尖 ±0.4；前擋泥板眉線為前輪拱同心圓 R18.6',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    ring: '口字框尾翼與乾坤圈（ABS 實心件，推估）：上板 x −55 ~ −70、寬 ±26、底面高 44、厚 1.2（下面墊一片外大 0.8、厚 0.3 的金色描邊板）；兩片側立板在 |z| 25、厚 1.6，從後甲板往後掠到上板；乾坤圈環心 x −63、y 37.4，半軸 6 × 5.4，管半徑 1.1（24×6 段），上下頂住上板與後甲板',
    palette: '紅白藍三色照四視圖 29：深紅中脊（到鼻尖）、框翼與火舌、珍珠白側板、深藍下裙，紅色面積不到一半；金（風火輪輪圈紋、乾坤圈、框翼描邊、分色細線、座艙框）＋朱紅綾帶與鼻尖火焰；框翼深紅；色碼自訂（推估）：深紅 #A3161F、朱紅 #E23A24、深藍 #1C2A52、金 #D8A83C / #C9A54A、白 #F3F1EC',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
