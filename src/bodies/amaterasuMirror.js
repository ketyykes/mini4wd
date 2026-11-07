// 天照鏡（body-amaterasu-mirror，神話組・日本）：照四視圖 22 建模，天照大神只用器物與象徵表現（八咫鏡、日光），
// 不做神像、人形、臉。四視圖 22 留下的造型：圓鏟形低鼻兩側各三片往後掠的薄片、高高包住前輪的圓擋泥板、中段圓頂座艙、
// 側艙往後上斜的切面進氣口、座艙後收腰、車尾伸出兩側的扁翼板。
// 八咫鏡 → 車尾扁翼板上並排立著的兩面銅鏡（鏡面朝後、上緣微微前傾，金色鏡緣）；
// 注連繩 → 鼻面金色板上兩道橫跨車寬的白色水平帶（互相平行，不從任何一點放射，避開旭日旗紋）。
// 配色只用白、金、銅（珍珠白車身、金色鼻面板、薄片與描邊、銅鏡）＋漆黑底緣，不用朱紅（和九尾狐的白＋朱紅分開）。
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
  // 俯視半寬（肩稜線）：四視圖 22 的俯視——側艙最寬（±36.5–38，窗形進氣口在這裡）、座艙後收成細腰 ±25.5、
  // 後段收窄（後輪臀 ±31.5、車尾 ±21，後輪胎面露在外側，車尾扁翼板從上方往外伸出車身）、前輪上方 ±35.5；
  // 前擋泥板一路往前延伸、往鼻尖收成圓鏟形短鼻（x 58 ±30、x 64 ±24.5、x 69 ±20.5，鼻尖 ±6）；輪拱開口前緣在擋泥板側壁上（肩稜線比輪拱高 3 mm 以上）
  hw: monoCurve(XS_HW, [21, 25, 29, 31, 31.5, 28, 25.5, 30, 36.5, 38, 36.5, 35.5, 33.4, 33, 32.4, 31.8, 30, 27.5, 24.5, 20.5, 15, 6]),
  // 肩稜線高度：前輪上方沿眉線圓弧高高拱起
  yS: (x) => smoothMax(ySBase(x), browY(x), 1.6),
  // 中線殼頂：前擋泥板之間的引擎蓋比擋泥板低（中線最多比肩稜線低 2.2，形成兩道擋泥板夾著的淺槽），引擎蓋會被輪拱擦到的地方再墊高
  yTop: (x) => smoothMax(yTopBase(x), Math.max(yTopMin(x), smoothMax(ySBase(x), browY(x), 1.6) - 2.2), 0.8),
  // 側裙下緣
  yLow: monoCurve(XS, [14, 12.5, 11, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11, 12, 12.6, 12.8, 12.9]),
};

/** @type {number} 前後輪之間側裙下緣的半寬 */
const SILL_W = 35;

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
  // 前後輪之間的側裙往外張到 ±35、下半段是直立側牆，從上面和側面都看不到底盤側框
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
 * 車尾雙鏡：一片橫跨車寬、伸出車尾兩側的白色扁翼板，上面並排立著兩面銅鏡（鏡面朝後、上緣往前傾）。
 * x0 / x1 = 翼板前後緣；y = 翼板底面高度；halfW = 翼板半寬；thick = 翼板厚；
 * mirrorR = 鏡半徑；mirrorZ = 兩面鏡中心的 |z|；mirrorX = 鏡面 x；tilt = 鏡面上緣往前傾的角度（度）
 * @type {{ x0: number, x1: number, y: number, halfW: number, thick: number, mirrorR: number, mirrorZ: number, mirrorX: number, tilt: number }}
 */
const MIRRORS = { x0: -50, x1: -64, y: 32.6, halfW: 46, thick: 1.0, mirrorR: 7.1, mirrorZ: 13, mirrorX: -58, tilt: 10 };

/**
 * 鼻頭兩側往後掠的薄片（四視圖 22 前輪前方那三片尖片，改成往後掠）：左右各 3 片水平薄片，
 * 根部貼在鼻側（前後兩點），尖端往後外伸到前輪拱前方。y = 高度；xf / xb = 根部前後點；tx / tz = 尖端位置（|z|）
 * @type {{ y: number, xf: number, xb: number, tx: number, tz: number }[]}
 */
const NOSE_FINS = [
  { y: 24, xf: 64, xb: 58, tx: 56.5, tz: 34 },
  { y: 20, xf: 66, xb: 60, tx: 58, tz: 33 },
  { y: 16, xf: 68, xb: 62, tx: 59.5, tz: 31.5 },
];

/**
 * 側艙切面進氣口（四視圖 22 側面）：往後上斜的平行四邊形凹口，深 2.6，凹口底塗漆黑、側壁金色
 * @type {{ id: string, view: string, shape: string, pts: number[][], depth: number }}
 */
const SIDE_INTAKE = { id: '側進氣口', view: 'side', shape: 'poly', pts: [[-17, 14.6], [13, 14.6], [21, 22.6], [-7, 22.6]], depth: 2.6 };

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
  mirror: namedMaterial('trim-bronze-mirror-brass', { color: 0xd2a062, metalness: 0.8, roughness: 0.34, clearcoat: 0.3 }),
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
  theme: '照四視圖 22 建模：圓鏟形低鼻兩側各三片往後掠的金色薄片、高圓前擋泥板、圓頂座艙、側艙切面進氣口；車尾伸出兩側的白色扁翼板上並排立著兩面銅鏡（八咫鏡，鏡面朝後）；鼻面金色板上兩道白色注連繩水平帶，珍珠白＋金＋銅',
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
  recesses: [SIDE_INTAKE],
  innerSkipRecess: true,
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

    // 車尾扁翼板（白，伸出車尾兩側）＋兩支扁支柱
    const plate = flatPlate(
      [
        [MIRRORS.x0, -MIRRORS.halfW],
        [MIRRORS.x0, MIRRORS.halfW],
        [MIRRORS.x1 + 2, MIRRORS.halfW],
        [MIRRORS.x1, MIRRORS.halfW - 3],
        [MIRRORS.x1, -MIRRORS.halfW + 3],
        [MIRRORS.x1 + 2, -MIRRORS.halfW],
      ],
      MIRRORS.y,
      MIRRORS.thick,
    );
    parts.push({ geometry: plate, mat: 'white', solid: true, outline: true, name: 'mirror-wing-plate' });
    const edge = flatPlate(
      [
        [MIRRORS.x0 + 0.7, -MIRRORS.halfW - 0.7],
        [MIRRORS.x0 + 0.7, MIRRORS.halfW + 0.7],
        [MIRRORS.x1 + 1.6, MIRRORS.halfW + 0.7],
        [MIRRORS.x1 - 0.7, MIRRORS.halfW - 3],
        [MIRRORS.x1 - 0.7, -MIRRORS.halfW + 3],
        [MIRRORS.x1 + 1.6, -MIRRORS.halfW - 0.7],
      ],
      MIRRORS.y - 0.3,
      0.3,
    );
    parts.push({ geometry: edge, mat: 'clawGold', solid: true, outline: true, name: 'mirror-wing-edge' });
    /** @type {THREE.BufferGeometry[]} */
    const struts = [];
    for (const side of [-1, 1]) {
      const zc = side * 21;
      const yDeck = P.yTop(-57) - 1.5;
      struts.push(
        finPlate(
          [
            [MIRRORS.x0 - 2, yDeck],
            [MIRRORS.x0 - 3, MIRRORS.y + 0.2],
            [MIRRORS.x1 + 4, MIRRORS.y + 0.2],
            [MIRRORS.x1 + 6, yDeck],
          ],
          zc,
          2.4,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(struts), mat: 'pylon', solid: true, outline: true, name: 'mirror-wing-struts' });
    // 兩面銅鏡（八咫鏡）：鏡身圓盤（16 段、軸沿 x、鏡面朝後）＋金色鏡緣環（24×6）＋鏡前的三角托架
    const tilt = (MIRRORS.tilt * Math.PI) / 180;
    const cy = MIRRORS.y + MIRRORS.thick + MIRRORS.mirrorR + 0.3;
    /** @type {THREE.BufferGeometry[]} */
    const discs = [];
    /** @type {THREE.BufferGeometry[]} */
    const rims = [];
    /** @type {THREE.BufferGeometry[]} */
    const brackets = [];
    for (const side of [-1, 1]) {
      const zc = side * MIRRORS.mirrorZ;
      const disc = new THREE.CylinderGeometry(MIRRORS.mirrorR, MIRRORS.mirrorR, 1.2, 16);
      disc.rotateZ(Math.PI / 2);
      disc.rotateZ(-tilt);
      disc.translate(MIRRORS.mirrorX, cy, zc);
      discs.push(disc);
      const rim = new THREE.TorusGeometry(MIRRORS.mirrorR - 0.2, 0.45, 6, 24);
      rim.rotateY(Math.PI / 2);
      rim.rotateZ(-tilt);
      rim.translate(MIRRORS.mirrorX - 0.5, cy, zc);
      rims.push(rim);
      brackets.push(
        finPlate(
          [
            [MIRRORS.mirrorX + 0.4, MIRRORS.y + MIRRORS.thick - 0.2],
            [MIRRORS.mirrorX + 6, MIRRORS.y + MIRRORS.thick - 0.2],
            [MIRRORS.mirrorX + 0.4 + 0.6 * MIRRORS.mirrorR * Math.sin(tilt), cy + 0.6 * MIRRORS.mirrorR],
          ],
          zc,
          1.6,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(discs), mat: 'mirror', solid: true, outline: true, name: 'bronze-mirrors' });
    parts.push({ geometry: mergeGeos(rims), mat: 'clawGold', solid: true, outline: true, name: 'bronze-mirror-rims' });
    parts.push({ geometry: mergeGeos(brackets), mat: 'pylon', solid: true, outline: true, name: 'bronze-mirror-brackets' });
    // 鼻頭兩側往後掠的金色薄片（水平板，厚 0.8）
    /** @type {THREE.BufferGeometry[]} */
    const fins = [];
    for (const f of NOSE_FINS) {
      for (const side of [-1, 1]) {
        const pts = [
          [f.xf, side * (P.hw(f.xf) - 1.2)],
          [f.tx, side * f.tz],
          [f.xb, side * (P.hw(f.xb) - 1.2)],
        ];
        fins.push(flatPlate(side > 0 ? pts : pts.slice().reverse(), f.y - 0.4, 0.8));
      }
    }
    parts.push({ geometry: mergeGeos(fins), mat: 'clawGold', solid: true, outline: true, name: 'nose-swept-fins' });

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
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估，造型照 shared/design/body-amaterasu-mirror/fourview.png 四視圖 22 的比例，尺寸照底盤）：殼長 144（車尾 −68 ~ 鼻尖 76）、外框長 144（扁翼板在殼內）；後甲板 31.5、鼻尖 16、前擋泥板頂約 32、座艙頂約 41.5、銅鏡頂 48.2；後輪臀 ±38、細腰 ±26（側裙下緣 ±35）、前輪上方 ±35；前擋泥板眉線為前輪拱同心圓 R19.2',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    wing: '車尾雙鏡（ABS 實心件，推估）：扁翼板 x −50 ~ −64、半寬 46（伸出車尾兩側）、底面高 32.6、厚 1.0＋外大 0.7、厚 0.3 的金色描邊板；兩支扁支柱在 |z| 21、厚 2.4；兩面銅鏡 R7.1、厚 1.2（16 段）、中心 |z| 13、鏡面朝後、上緣前傾 10°，金色鏡緣環（24×6），鏡前三角托架厚 1.6',
    claws: '鼻頭往後掠薄片（ABS 實心水平板，厚 0.8，推估）：左右各 3 片，高 24 / 20 / 16，根部貼鼻側 x 64–58 / 66–60 / 68–62，尖端往後外伸到 x 56.5 / 58 / 59.5、|z| 34 / 33 / 31.5（在前輪拱前方）',
    palette: '珍珠白主色＋金色鼻面板、薄片、翼板描邊、鏡緣與進氣口側壁＋銅鏡＋漆黑底緣；不用朱紅（和九尾狐的白＋朱紅分開）；色碼參考 MYTH_RESEARCH 6-2（白 #F7F5F0、金 #C9A54A，推估），實際用 #F6F4EE、#D6B157、#C9A54A',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
