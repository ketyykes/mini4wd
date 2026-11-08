// 天照鏡（body-amaterasu-mirror，神話組・日本）：照四視圖 22 建模，天照大神只用器物與象徵表現（八咫鏡、勾玉、日光），
// 不做神像、人形、臉。四視圖 22 留下的造型：圓鏟形低鼻、高高包住前輪的圓擋泥板、中段圓頂座艙、座艙後收腰、車尾伸出兩側的扁翼板。
// 八咫鏡 → 車尾翼主板就是一面橫跨車寬、平放的八花形大銅鏡（暗銅鏡背、金色鏡框與連珠紋、墊高的拋光鏡心）；
// 八尺瓊勾玉 → 鏡翼左右兩端的翡翠勾玉形端板；日光 → 側面三道互相平行的金色斜光條（不從任何一點放射）；
// 注連繩 → 鼻面金色板上兩道橫跨車寬的白色水平帶（互相平行，不從任何一點放射，避開旭日旗紋）。
// 配色只用白、金、銅（珍珠白車身、金色鼻面板與描邊、銅鏡）＋翡翠勾玉＋漆黑底緣，不用朱紅（和九尾狐的白＋朱紅分開）。
// 設計：shared/design/body-amaterasu-mirror/DESIGN.md（來源見該檔；MYTH_RESEARCH 日本節 6-3 的信仰注意事項）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody, flatPlate, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −68、鼻尖 76 */
const XS = [-68, -64, -58, -50, -40, -25, -10, 5, 20, 30, 40, 50, 58, 64, 69, 73, 76];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-68, -64, -58, -50, -40, -30, -18, -5, 8, 20, 30, 40, 50, 52, 54.2, 55.6, 58, 61, 64, 69, 73, 76];

/** @type {{ x: number, y: number, r: number }} 前擋泥板眉線：以前輪拱圓心為圓心、半徑 20 的圓弧（四視圖 22 高圓的前擋泥板） */
const FRONT_BROW = { x: 40, y: 13, r: 20 };

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

/** @type {(x: number) => number} 肩稜線的基本高度：後輪臀 28.6、座艙兩側 26.4、鼻尖 16.4（前輪上方另由眉線拱起） */
const ySBase = monoCurve(XS, [27, 27.8, 28.4, 28.6, 28.2, 27, 26.4, 26.4, 26.6, 26.6, 26.2, 24.6, 21.4, 19.6, 18.4, 17.4, 16.4]);
/** @type {(x: number) => number} 中線殼頂的基本高度：後甲板 29.6（壓低，讓尾翼支柱露出來），鼻尖 17.8（短而鈍的鼻，前擋泥板比引擎蓋高） */
const yTopBase = monoCurve(XS, [28.4, 29, 29.4, 29.6, 29.6, 29.8, 30, 30.2, 30.2, 29.8, 28.6, 25.8, 22.8, 21, 19.8, 18.8, 17.8]);

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
  // 俯視半寬（肩稜線）：四視圖 22 的俯視——側艙最寬（±37.5–39.5）、座艙後收成細腰 ±23.5、
  // 後段收窄（後輪臀 ±31.5、車尾 ±21，後輪胎面露在外側，車尾鏡翼從上方往外伸出車身）、前輪上方 ±37；
  // 前擋泥板一路往前延伸、往鼻尖收成寬而鈍的圓鏟形短鼻（x 58 ±31.4、x 64 ±29、x 69 ±27.4，鼻尖 ±19）；輪拱開口前緣在擋泥板側壁上（肩稜線比輪拱高 3 mm 以上）
  hw: monoCurve(XS_HW, [21, 25, 29, 31, 31.5, 25, 23.5, 29, 37.5, 39.5, 38.5, 37, 34.4, 33.6, 33, 32.4, 31.4, 30.2, 29, 27.4, 25, 19]),
  // 肩稜線高度：前輪上方沿眉線圓弧高高拱起
  yS: (x) => smoothMax(ySBase(x), browY(x), 1.6),
  // 中線殼頂：前擋泥板之間的引擎蓋比擋泥板低（中線最多比肩稜線低 2.2，形成兩道擋泥板夾著的淺槽），引擎蓋會被輪拱擦到的地方再墊高
  yTop: (x) => smoothMax(yTopBase(x), Math.max(yTopMin(x), smoothMax(ySBase(x), browY(x), 1.6) - 2.2), 0.8),
  // 側裙下緣
  yLow: monoCurve(XS, [14, 12.5, 11, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11, 12, 12.6, 12.8, 12.9]),
};

/** @type {number} 前後輪之間側裙下緣的半寬 */
const SILL_W = 30;

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
  // 前後輪之間的側裙往外張到 ±30、下半段是直立側牆，從側面看不到底盤側框
  const sill = Math.max(h + 1.2 * flare, SILL_W * smoothstep(-24, -16, x) * smoothstep(24, 16, x));
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [Math.max(h + 0.8 * flare, sill - 0.4), lerp(s, lo, 0.42)],
    [sill, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = [...buildStations(-68, -58, 1.4, profile).slice(0, -1), ...buildStations(-58, 54, 2.4, profile).slice(0, -1), ...buildStations(54, 76, 1.3, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ x0: number, x1: number, peakX: number, rise: number, halfW: number }} 圓頂座艙（四視圖 22：前移、蛋形） */
const CANOPY = { x0: 32, x1: -16, peakX: 10, rise: 10.5, halfW: 13.5 };

/**
 * 車尾鏡翼（八咫鏡）：一面橫跨車尾、平放的八花形大銅鏡就是尾翼主板——俯視為橫向拉長的八角形，八條邊各微微外鼓成一瓣；
 * 暗銅鏡背底板外緣一圈金色鏡框，往內一圈金色連珠紋，中間墊高一塊拋光鏡心並圍一圈金色內框；
 * 兩支白色寬扁翼柱撐在鏡下，兩端各立一片翡翠勾玉形端板。
 * x / y = 鏡心 x 與鏡底面高度；a / b = 八角形沿 x / z 的半徑；cx / cz = 斜切角在 x / z 方向保留的比例；
 * lobe = 每瓣往外鼓的深度；thick = 鏡背底板厚
 * @type {{ x: number, y: number, a: number, b: number, cx: number, cz: number, lobe: number, thick: number }}
 */
const MIRROR_WING = { x: -58.5, y: 43.5, a: 15.5, b: 44.5, cx: 0.45, cz: 0.5, lobe: 1.0, thick: 0.6 };

/** @type {number} 拋光鏡心比鏡緣往內縮的量（中間是暗銅鏡背帶與連珠紋） */
const MIRROR_FACE_INSET = 5.6;

/**
 * 八花形鏡的外框（局部座標 u = 沿 x、w = 沿 z）：八角形的每條邊換成往外鼓的圓弧瓣，grow = 外框往外放大的量
 * @type {(grow: number, segPerLobe: number) => number[][]}
 */
const lobedOctagonOutline = (grow, segPerLobe) => {
  const { a, b, cx, cz, lobe } = MIRROR_WING;
  const A = a + grow;
  const B = b + grow;
  /** @type {number[][]} 八角形頂點（逆時針，從前緣右端開始） */
  const verts = [
    [A, cz * B], [cx * A, B], [-cx * A, B], [-A, cz * B],
    [-A, -cz * B], [-cx * A, -B], [cx * A, -B], [A, -cz * B],
  ];
  /** @type {number[][]} */
  const out = [];
  for (let i = 0; i < verts.length; i++) {
    const [u0, w0] = verts[i];
    const [u1, w1] = verts[(i + 1) % verts.length];
    const len = Math.hypot(u1 - u0, w1 - w0);
    // 往外的法向（八角形中心在原點）
    let nu = w1 - w0;
    let nw = -(u1 - u0);
    if (nu * (u0 + u1) + nw * (w0 + w1) < 0) {
      nu = -nu;
      nw = -nw;
    }
    const depth = Math.min(lobe, 0.2 * len);
    for (let k = 0; k < segPerLobe; k++) {
      const t = k / segPerLobe;
      const bulge = depth * Math.sin(Math.PI * t);
      out.push([u0 + (u1 - u0) * t + (nu / len) * bulge, w0 + (w1 - w0) * t + (nw / len) * bulge]);
    }
  }
  return out;
};

/**
 * 勾玉形端板的側視外框（x, y）：太極魚形構圖——半徑 2R 的大半圓為背、半徑 R 的上圓為頭、下圓切出往後下方收尖的尾巴；
 * 整體轉 rot 度，讓圓頭朝前上方、尾尖朝後下方。cx / cy = 大圓中心
 * @type {(cx: number, cy: number, r: number, rot: number) => number[][]}
 */
const magatamaOutline = (cx, cy, r, rot) => {
  /** @type {number[][]} 局部座標（p, q），頭在 +q */
  const local = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const th = Math.PI / 2 + (Math.PI * i) / n;
    local.push([2 * r * Math.cos(th), 2 * r * Math.sin(th)]);
  }
  for (let i = 0; i < n / 2; i++) {
    const th = -Math.PI / 2 - (Math.PI * i) / (n / 2);
    local.push([r * Math.cos(th), -r + r * Math.sin(th)]);
  }
  for (let i = 0; i < n / 2; i++) {
    const th = -Math.PI / 2 + (Math.PI * i) / (n / 2);
    local.push([r * Math.cos(th), r + r * Math.sin(th)]);
  }
  const c = Math.cos((rot * Math.PI) / 180);
  const s = Math.sin((rot * Math.PI) / 180);
  return local.map(([p, q]) => [cx + p * c - q * s, cy + p * s + q * c]);
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
 * 側面日光條紋（金，貼紙）：前後輪之間三道往前上方斜的平行光條（互相平行，不從任何一點放射），
 * 前兩道較長、最後一道較短；u = 沿斜向的座標中心
 * @type {{ u: number, yTop: number }[]}
 */
const SIDE_RAYS = [
  { u: 10, yTop: 23.6 },
  { u: 1, yTop: 23.6 },
  { u: -8, yTop: 21 },
];

/** @type {(x: number, y: number) => number} 側面日光條紋：正值 = 在條紋上（條寬 3.2、斜率 1） */
const sideRays = (x, y) => {
  let v = -1;
  for (const r of SIDE_RAYS) {
    const u = x - (y - 14) - r.u;
    v = Math.max(v, Math.min(1.6 - Math.abs(u), r.yTop - y, y - 13.2));
  }
  return v;
};

/**
 * 白色下裙板以上的分區界線：鼻面金色板（前軸前方、兩道擋泥板之間，往鼻尖變寬）
 * @type {(x: number, z: number) => number} 正值 = 在金色板內
 */
const sunPanel = (x, z) => Math.min(x - 47, 0.46 * P.hw(x) - Math.abs(z));

/**
 * 鼻面注連繩紋（白，畫在金色板上）：兩道橫跨鼻面的水平帶（寬 2.6），和車寬方向平行、互相平行，不收到任何一點
 * @type {(x: number, z: number) => number} 正值 = 在帶上
 */
const ropeBands = (x, z) => Math.max(1.3 - Math.abs(x - 54.5), 1.3 - Math.abs(x - 62));

/** @type {(x: number) => number} 漆黑底緣的高度：前軸之後 2.2 mm，往鼻尖收到 0 */
const baseBand = (x) => 2.2 * smoothstep(73, 58, x);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 珍珠白：車身主色
  white: namedMaterial('paint-pearl-white', { color: 0xf6f4ee, metalness: 0.15, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 金色金屬漆：鼻面板
  sunGold: namedMaterial('paint-sun-gold', { color: 0xd6b157, metalness: 0.6, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
  // 銅鏡（真金屬；名稱含 -brass → Blender metallic）
  mirror: namedMaterial('trim-bronze-mirror-brass', { color: 0xf0c470, metalness: 0.8, roughness: 0.14, clearcoat: 0.6 }),
  // 鏡背底板：暗銅（名稱含 -brass → Blender metallic）
  bronzeBack: namedMaterial('trim-bronze-patina-brass', { color: 0x6e4f2a, metalness: 0.75, roughness: 0.4 }),
  // 勾玉端板：翡翠綠
  jade: namedMaterial('paint-magatama-jade', { color: 0x1f7a55, metalness: 0.2, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  // 白色尾翼支柱（緞面射出件）
  pylon: namedMaterial('paint-pylon-white-abs', { color: 0xeeebe3, roughness: 0.55 }),
  // 鼻側薄片、翼板描邊、鏡緣：金色金屬漆
  clawGold: namedMaterial('trim-claw-gold-brass', { color: 0xc9a54a, metalness: 0.85, roughness: 0.25 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x2a2730, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  urushi: namedMaterial('paint-urushi-black', { color: 0x141416, roughness: 0.55, clearcoat: 0.2 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x18181b, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x1a1a1e, roughness: 0.7, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-gold-leaf', { color: 0xd4b052, metalness: 0.75, roughness: 0.3 }),
  dWhite: decalMaterial('decal-pearl-white', { color: 0xfaf8f2, roughness: 0.3, clearcoat: 0.6 }),
  dUrushi: decalMaterial('decal-urushi-black', { color: 0x141416, roughness: 0.5, clearcoat: 0.2 }),
});

export const amaterasuMirrorBody = makePolyBody({
  id: 'body-amaterasu-mirror',
  name: '天照鏡',
  style: 'myth',
  phase: 13,
  mythSeries: 'japanese',
  mythTheme: 'amaterasu',
  form: 'sun-mirror-dome',
  roof: 'canopy',
  wing: 'magatama-mirror',
  theme: '照四視圖 22 建模：寬鈍的圓鏟形低鼻、高圓前擋泥板、圓頂座艙、座艙後收腰；車尾翼主板是一面橫跨車寬、平放的八花形大銅鏡（八咫鏡：暗銅鏡背、金色鏡框與連珠紋、拋光鏡心），兩端翡翠勾玉端板；側面三道平行金色光條；鼻面金色板上兩道白色注連繩水平帶，珍珠白＋金＋銅',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格邊長 1.0 mm（壓低殼面面數與碰撞格耗時）
  step: 1.0,
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 32;
      for (let i = 0; i <= n; i++) {
        const x = lerp(CANOPY.x0, CANOPY.x1, i / n);
        const front = x >= CANOPY.peakX;
        const t = front ? (CANOPY.x0 - x) / (CANOPY.x0 - CANOPY.peakX) : (x - CANOPY.x1) / (CANOPY.peakX - CANOPY.x1);
        const rise = CANOPY.rise * Math.sin((Math.PI / 2) * t) ** 0.6;
        const q = front ? (x - CANOPY.peakX) / (CANOPY.x0 - CANOPY.peakX) : (CANOPY.peakX - x) / (CANOPY.peakX - CANOPY.x1);
        const halfW = Math.max(2.4, CANOPY.halfW * (1 - q ** 2.2) ** 0.5);
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 28,
  zones: () => [
    // 漆黑底緣
    { mat: 'urushi', keep: (x, y) => P.yLow(x) + baseBand(x) - y },
    // 鼻面金色板
    { mat: 'sunGold', keep: (x, y, z) => sunPanel(x, z) },
    // 珍珠白車身
    { mat: 'white', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'white' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'white', recess: 'urushi', recessWall: 'clawGold', glass: 'glass', cockpit: 'urushi', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 車尾鏡翼（平放）：暗銅鏡背底板＋外緣金色鏡框（中空環，包住鏡緣）＋一圈金色連珠紋＋墊高的拋光鏡心＋鏡心外圍的金色內框
    /** @type {(pts: number[][]) => number[][]} */
    const toWorld = (pts) => pts.map(([u, w]) => [MIRROR_WING.x + u, w]);
    /** @type {number} 每瓣的分段數 */
    const seg = 5;
    const { y: wy, thick: wt } = MIRROR_WING;
    // 鏡背底板只做外圈（中間由鏡心板蓋住，挖空減重）
    const disc = holedFlatPlate(toWorld(lobedOctagonOutline(0, seg)), toWorld(lobedOctagonOutline(-MIRROR_FACE_INSET - 0.6, seg)).reverse(), wy, wt);
    parts.push({ geometry: disc, mat: 'bronzeBack', solid: true, outline: true, name: 'mirror-wing-disc' });
    const face = flatPlate(toWorld(lobedOctagonOutline(-MIRROR_FACE_INSET, seg)), wy + wt - 0.1, 0.45);
    parts.push({ geometry: face, mat: 'mirror', solid: true, outline: true, name: 'mirror-wing-face' });
    const rim = holedFlatPlate(toWorld(lobedOctagonOutline(1.0, seg)), toWorld(lobedOctagonOutline(-0.6, seg)).reverse(), wy - 0.25, wt + 0.5);
    const innerRim = holedFlatPlate(
      toWorld(lobedOctagonOutline(-MIRROR_FACE_INSET + 0.9, seg)),
      toWorld(lobedOctagonOutline(-MIRROR_FACE_INSET - 0.3, seg)).reverse(),
      wy + wt,
      0.6,
    );
    // 連珠紋：沿鏡框與內框中間的八花形路徑等距排列的小珠（球心在鏡背面上、下半埋進板裡；互相等距，不從鏡心放射）
    const beadPath = toWorld(lobedOctagonOutline(-(MIRROR_FACE_INSET + 0.6) / 2, 24));
    /** @type {THREE.BufferGeometry[]} */
    const beads = [];
    for (let i = 0; i < beadPath.length; i += 4) {
      const [bx, bz] = beadPath[i];
      beads.push(new THREE.SphereGeometry(1.0, 8, 5).translate(bx, wy + wt, bz));
    }
    parts.push({ geometry: mergeGeos([rim, innerRim, ...beads]), mat: 'clawGold', solid: true, outline: true, name: 'mirror-wing-rim' });
    /** @type {THREE.BufferGeometry[]} */
    const pylons = [];
    for (const side of [-1, 1]) {
      const yDeck = P.yTop(MIRROR_WING.x + 4) - 1.5;
      pylons.push(
        finPlate(
          [
            [MIRROR_WING.x + 10, yDeck],
            [MIRROR_WING.x + 5, wy + 0.4],
            [MIRROR_WING.x - 4, wy + 0.4],
            [MIRROR_WING.x + 1, yDeck],
          ],
          side * 15,
          2.0,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(pylons), mat: 'pylon', solid: true, outline: true, name: 'mirror-wing-pylons' });
    // 勾玉端板（翡翠）：立在鏡的左右兩端，圓頭朝前上方、尾尖往後下方
    /** @type {THREE.BufferGeometry[]} */
    const magatama = [];
    for (const side of [-1, 1]) {
      magatama.push(finPlate(magatamaOutline(MIRROR_WING.x, MIRROR_WING.y - 3.5, 3.8, -30), side * (MIRROR_WING.b + 1.6), 1.1));
    }
    parts.push({ geometry: mergeGeos(magatama), mat: 'jade', solid: true, outline: true, name: 'magatama-endplates' });

    // ---- 貼紙 ----
    // 座艙框（金，座艙罩外圍 1.2 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > CANOPY.x1 - 1.2 && x < CANOPY.x0 + 1.2 ? Math.min(u + 1.2, 0.05 - u) : -1;
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // 鼻面注連繩紋（白，畫在金色板上）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(ropeBands(x, z), sunPanel(x, z) - 0.6)), mat: 'dWhite', name: 'decal-rope-bands' });
    // 肩稜線下方的金色腰線（前擋泥板 → 後輪臀，線寬 1.4）
    parts.push({ geometry: kit.decal((x, y) => Math.min(0.7 - Math.abs(y - (P.yS(x) - 2.6)), 50 - x, x + 64)), mat: 'dGold', name: 'decal-gold-beltline' });
    // 側面日光條紋（金）
    parts.push({ geometry: kit.decal((x, y) => sideRays(x, y)), mat: 'dGold', name: 'decal-side-rays' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估，造型照 shared/design/body-amaterasu-mirror/fourview.png 四視圖 22 的比例，尺寸照底盤）：殼長 144（車尾 −68 ~ 鼻尖 76）、外框長 152（鏡翼伸到 x −76）；後甲板約 30、鼻尖 17.8、前擋泥板頂約 33、座艙頂約 41、鏡翼頂約 45.4、勾玉頂 47.8；後輪臀 ±31.5、細腰 ±23.5（側裙下緣 ±30）、側艙 ±39.5、鼻尖 ±19；前擋泥板眉線為前輪拱同心圓 R20',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    wing: '八花形鏡翼（ABS 實心件，推估）：鏡心 x −58.5、俯視為拉長的八角形（沿 x 半徑 15.5、沿 z 半徑 44.5，斜切角保留 0.45 / 0.5，每邊外鼓 1.0），底面高 43.5；暗銅鏡背外圈厚 0.6、金色鏡框外大 1.0 厚 1.1、內縮 5.6 的拋光鏡心厚 0.45＋金色內框、48 顆 R1.0 連珠；兩支白色扁翼柱在 |z| 15、厚 2.0；兩端翡翠勾玉端板厚 1.1（勾玉大圓 R7.6）',
    palette: '珍珠白主色＋金色鼻面板、薄片、翼板描邊、鏡緣與進氣口側壁＋銅鏡＋漆黑底緣；不用朱紅（和九尾狐的白＋朱紅分開）；色碼參考 MYTH_RESEARCH 6-2（白 #F7F5F0、金 #C9A54A，推估），實際用 #F6F4EE、#D6B157、#C9A54A',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
