// 天照鏡（body-amaterasu-mirror，神話組・日本）：照四視圖 22 建模，天照大神只用器物與象徵表現（八咫鏡、日光），
// 不做神像、人形、臉。四視圖 22 留下的造型：低鼻兩側各三支往前的爪狀尖片、高高包住前輪的圓擋泥板、中段圓頂座艙、
// 側艙往後上斜的切面進氣口、座艙後收腰、車尾寬扁翼柱撐起的「兩片相連橢圓盤」尾翼（俯視 8 字形）。
// 八咫鏡 → 尾翼正中央的大金色圓鏡（鏡背一圈金色凸環與中央鈕，是整台車的主角）；
// 日光 → 鼻面金色板上的白色光線（從鼻尖整條前緣往後散開，不從單點放射、不做紅白相間條紋，避開旭日旗紋）。
// 配色只用白、金（珍珠白車身、金色鼻面板、鏡、爪片與描邊）＋漆黑底緣，不用朱紅（和九尾狐的白＋朱紅分開）。
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
  // 後段收窄（後輪臀 ±31.5、車尾 ±21，後輪胎面露在外側，8 字尾翼從上方往外伸出車身）、前輪上方 ±35.5；
  // 前擋泥板一路往前延伸、往鼻尖收成圓楔形短鼻（x 58 ±30、x 64 ±24，鼻尖 ±3.5）；輪拱開口前緣在擋泥板側壁上（肩稜線比輪拱高 3 mm 以上）
  hw: monoCurve(XS_HW, [21, 25, 29, 31, 31.5, 28, 25.5, 30, 36.5, 38, 36.5, 35.5, 33.4, 33, 32.4, 31.8, 30, 27.5, 24, 17.5, 11, 3.5]),
  // 肩稜線高度：前輪上方沿眉線圓弧高高拱起
  yS: (x) => smoothMax(ySBase(x), browY(x), 1.6),
  // 中線殼頂：前擋泥板之間的引擎蓋比擋泥板低（中線最多比肩稜線低 2.2，形成兩道擋泥板夾著的淺槽），引擎蓋會被輪拱擦到的地方再墊高
  yTop: (x) => smoothMax(yTopBase(x), Math.max(yTopMin(x), smoothMax(ySBase(x), browY(x), 1.6) - 2.2), 0.8),
  // 側裙下緣
  yLow: monoCurve(XS, [14, 12.5, 11, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11, 12, 12.6, 12.8, 12.9]),
};

/** @type {number} 前後輪之間側裙下緣的半寬 */
const SILL_W = 37;

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
  // 前後輪之間的側裙往外張到 ±37、下半段是直立側牆，從上面和側面都看不到底盤側框
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
 * 尾翼：兩片相連的橢圓盤（俯視 8 字形）＋中央大金鏡。x / y = 鏡心位置與翼面高度；mirrorR = 鏡半徑；
 * lobeA / lobeB = 橢圓盤沿 x / z 的半軸；lobeC = 橢圓盤中心的 |z|；pitch = 往後上仰角（度）
 * @type {{ x: number, y: number, mirrorR: number, lobeA: number, lobeB: number, lobeC: number, thick: number, pitch: number }}
 */
const WING = { x: -55, y: 43.6, mirrorR: 12, lobeA: 11, lobeB: 14, lobeC: 12, thick: 0.9, pitch: 9 };

/**
 * 兩片相連橢圓盤的外框（局部座標 u = 沿 x、w = 沿 z；俯視 8 字形）：右盤取 w ≥ 0 的弧、左盤鏡射，
 * 兩盤在 w = 0 相交處形成前後兩個內凹的腰
 * @type {(a: number, b: number, c: number, n: number, grow: number) => number[][]} grow = 外框往外放大的量
 */
const figureEightOutline = (a, b, c, n, grow) => {
  const A = a + grow;
  const B = b + grow;
  const phi0 = Math.asin(Math.min(1, c / B));
  /** @type {number[][]} */
  const right = [];
  for (let i = 0; i <= n; i++) {
    const phi = -phi0 + ((Math.PI + 2 * phi0) * i) / n;
    right.push([A * Math.cos(phi), c + B * Math.sin(phi)]);
  }
  const left = right.map(([u, w]) => [-u, -w]);
  return [...right, ...left];
};

/**
 * 鼻頭兩側的爪狀尖片（四視圖 22 側面前輪前方那三支往前的尖片）：左右各 3 支，越下面越前、越短
 * rx / ry / rz = 根部位置（|z|）；len = 長度；yaw = 往外撇角（度）
 * @type {{ rx: number, ry: number, rz: number, len: number, yaw: number }[]}
 */
const NOSE_CLAWS = [
  { rx: 57, ry: 25, rz: 29, len: 12, yaw: 6 },
  { rx: 60, ry: 20.5, rz: 27.5, len: 11, yaw: 4 },
  { rx: 63, ry: 16, rz: 25.5, len: 10, yaw: 2 },
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
 * 鼻面光線（白，畫在金色板上）：9 道細光線的起點沿鼻尖前緣排開，往後幾乎平行地延伸（只微微張開，不從單點放射）、越往後越細
 * @type {(x: number, z: number) => number} 正值 = 在光線上
 */
const sunRays = (x, z) => {
  let best = -Infinity;
  for (let k = -4; k <= 4; k++) {
    const z0 = 2.4 * k;
    const z1 = 3.1 * k;
    const x0 = 74 - 0.25 * k * k;
    const x1 = 50 + 0.4 * Math.abs(k);
    const t = (x0 - x) / (x0 - x1);
    if (t < 0 || t > 1) {
      continue;
    }
    const zc = lerp(z0, z1, t);
    best = Math.max(best, lerp(0.55, 0.25, t) - Math.abs(z - zc));
  }
  return best;
};

/** @type {(x: number) => number} 漆黑底緣的高度：前軸之後 2.2 mm，往鼻尖收到 0 */
const baseBand = (x) => 2.2 * smoothstep(73, 58, x);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 珍珠白：車身主色
  white: namedMaterial('paint-pearl-white', { color: 0xf6f4ee, metalness: 0.15, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 金色金屬漆：鼻面板
  sunGold: namedMaterial('paint-sun-gold', { color: 0xd6b157, metalness: 0.6, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
  // 真金屬（鏡；名稱含 -brass → Blender metallic）
  mirror: namedMaterial('trim-mirror-gold-brass', { color: 0xc9a54a, metalness: 0.9, roughness: 0.18, clearcoat: 0.3 }),
  // 白色尾翼支柱（緞面射出件）
  pylon: namedMaterial('paint-pylon-white-abs', { color: 0xeeebe3, roughness: 0.55 }),
  // 爪片與尾翼描邊：金色金屬漆
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
  theme: '照四視圖 22 建模：低鼻兩側各三支金色爪片、高圓前擋泥板、圓頂座艙、側艙切面進氣口；車尾寬扁翼柱撐起兩片相連的白色橢圓盤（俯視 8 字形、金色描邊），正中央大金鏡八咫鏡；鼻面金色板上白色日光線，珍珠白＋金',
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

    // 寬扁翼柱：側視是從後甲板往後上掠的板、後視是寬 7 mm 的扁柱，頂端托住 8 字盤
    const deckY = P.yTop(WING.x + 4) - 1.2;
    const pylon = finPlate(
      [
        [WING.x + 12, deckY],
        [WING.x + 5, WING.y - 4],
        [WING.x + 2.5, WING.y + 0.2],
        [WING.x - 3, WING.y + 0.2],
        [WING.x - 1.5, WING.y - 4],
        [WING.x + 4, deckY],
      ],
      0,
      7,
    );
    parts.push({ geometry: pylon, mat: 'pylon', solid: true, outline: true, name: 'wing-pylon' });
    /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} 繞鏡心往後上仰（尾端比前端高，側視是一片後仰的翼） */
    const pitchUp = (g) => g.translate(-WING.x, -WING.y, 0).rotateZ((-WING.pitch * Math.PI) / 180).translate(WING.x, WING.y, 0);
    // 8 字盤：白色上盤＋往外大 0.8 的金色下盤（從上面和側面看是一圈金色描邊）
    const toWorld = (/** @type {number[][]} */ pts) => pts.map(([u, w]) => [WING.x + u, w]);
    const lobe = pitchUp(flatPlate(toWorld(figureEightOutline(WING.lobeA, WING.lobeB, WING.lobeC, 20, 0)), WING.y, WING.thick));
    parts.push({ geometry: lobe, mat: 'white', solid: true, outline: true, name: 'wing-figure-eight' });
    const rim = pitchUp(flatPlate(toWorld(figureEightOutline(WING.lobeA, WING.lobeB, WING.lobeC, 20, 0.8)), WING.y - 0.4, 0.4));
    parts.push({ geometry: rim, mat: 'clawGold', solid: true, outline: true, name: 'wing-figure-eight-rim' });
    // 八咫鏡：大金色圓盤（16 段）蓋在兩盤相連的腰上＋鏡背金色凸環（24×6）＋中央鈕
    const disc = new THREE.CylinderGeometry(WING.mirrorR, WING.mirrorR, 1.0, 16);
    disc.translate(WING.x, WING.y + WING.thick + 0.5, 0);
    parts.push({ geometry: pitchUp(disc), mat: 'mirror', solid: true, outline: true, name: 'wing-mirror-disc' });
    const ring = new THREE.TorusGeometry(WING.mirrorR * 0.7, 0.55, 6, 24);
    ring.rotateX(Math.PI / 2);
    ring.translate(WING.x, WING.y + WING.thick + 1.1, 0);
    parts.push({ geometry: pitchUp(ring), mat: 'clawGold', solid: true, name: 'wing-mirror-ring' });
    const knob = new THREE.SphereGeometry(1, 12, 8);
    knob.scale(2.6, 1.3, 2.6);
    knob.translate(WING.x, WING.y + WING.thick + 1.1, 0);
    parts.push({ geometry: pitchUp(knob), mat: 'mirror', solid: true, name: 'wing-mirror-knob' });
    // 鼻頭兩側爪片：四角錐（4 段）壓扁成水平尖片，根部埋進前擋泥板側面
    /** @type {THREE.BufferGeometry[]} */
    const claws = [];
    for (const c of NOSE_CLAWS) {
      for (const side of [-1, 1]) {
        const g = new THREE.ConeGeometry(2.2, c.len, 4);
        g.translate(0, c.len / 2, 0);
        g.rotateZ(-Math.PI / 2);
        g.scale(1, 0.55, 1);
        g.rotateY((-side * c.yaw * Math.PI) / 180);
        g.translate(c.rx, c.ry, side * c.rz);
        claws.push(g);
      }
    }
    parts.push({ geometry: mergeGeos(claws), mat: 'clawGold', solid: true, outline: true, name: 'nose-claws' });

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
    // 鼻面日光線（白，畫在金色板上）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(sunRays(x, z), sunPanel(x, z) - 0.6)), mat: 'dWhite', name: 'decal-sun-rays' });
    // 肩稜線下方的金色腰線（前擋泥板 → 後輪臀，線寬 1.4）
    parts.push({ geometry: kit.decal((x, y) => Math.min(0.7 - Math.abs(y - (P.yS(x) - 2.6)), 50 - x, x + 64)), mat: 'dGold', name: 'decal-gold-beltline' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估，造型照 shared/design/body-amaterasu-mirror/fourview.png 四視圖 22 的比例，尺寸照底盤）：殼長 144（車尾 −68 ~ 鼻尖 76）、外框長 144（8 字盤尾端在殼內）；後甲板 31.5、鼻尖 16、前擋泥板頂約 32、座艙頂約 41.5、翼面 43–47.4；後輪臀 ±38、細腰 ±26（側裙下緣 ±37）、前輪上方 ±35；前擋泥板眉線為前輪拱同心圓 R19.2',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    wing: '尾翼（ABS 實心件，推估）：寬扁翼柱（後視寬 7、側視往後上掠）；8 字盤為兩個半軸 11 × 14 的橢圓、中心 |z| 12（全寬 ±26、厚 0.9）＋外大 0.8、厚 0.4 的金色下盤；八咫鏡圓盤 R12、厚 1.0（16 段）、鏡背凸環 R8.4（24×6）、中央鈕；翼面高 43.6、繞鏡心往後上仰 9°',
    claws: '鼻頭爪片（ABS 實心四角錐，推估）：左右各 3 支，根部 x 57 / 60 / 63、高 25 / 20.5 / 16、長 12 / 11 / 10、根部寬 4.4、往外撇 6 / 4 / 2°',
    palette: '珍珠白主色＋金色鼻面板、鏡、爪片、8 字盤描邊與進氣口側壁＋漆黑底緣；不用朱紅（和九尾狐的白＋朱紅分開）；色碼參考 MYTH_RESEARCH 6-2（白 #F7F5F0、金 #C9A54A，推估），實際用 #F6F4EE、#D6B157、#C9A54A',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
