// 天照鏡（body-amaterasu-mirror，神話組・日本）：照四視圖 22 建模，天照大神只用器物與象徵表現（八咫鏡、日光），
// 不做神像、人形、臉。四視圖 22 留下的造型：圓鏟形低鼻兩側各三片往後掠的薄片、高高包住前輪的圓擋泥板、中段圓頂座艙、
// 側艙往後上斜的切面進氣口、座艙後收腰、車尾伸出兩側的扁翼板。
// 八咫鏡 → 車尾扁翼板上並排立著的兩面銅鏡（鏡面朝後、上緣微微前傾，金色鏡緣）；
// 注連繩 → 鼻面金色板上兩道橫跨車寬的白色水平帶（互相平行，不從任何一點放射，避開旭日旗紋）。
// 配色：日金車身、朱紅側裙與翼柱、白銅鏡面（尾翼雙盤、鼻側鏡刃、引擎蓋八咫鏡）＋漆黑底緣與腰線；不用白底（和九尾狐的白底分開）。
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
const SILL_W = 45;

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
  // 前後輪之間的側裙下緣往外張到 ±45（下半段是往外斜出的朱紅裙邊，上緣停在 ±36），從上面和側面都看不到底盤側框
  const sill = Math.max(h + 1.2 * flare, SILL_W * smoothstep(-24, -16, x) * smoothstep(24, 16, x));
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [Math.max(h + 0.8 * flare, Math.min(sill - 0.4, 36)), lerp(s, lo, 0.42)],
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
 * 車尾鏡翼（四視圖 22）：兩片相連、平躺的橢圓鏡面盤（俯視 8 字形，拋光銅鏡），外緣一圈金色鏡緣，兩支寬扁翼柱撐在兩片盤的中心下方。
 * x / y = 盤心 x 與盤底面高度；a / b = 每片橢圓沿 x / z 的半軸；c = 兩片盤中心的 |z|；thick = 盤厚；pitch = 往後上仰角（度）；
 * n = 超橢圓指數（2 = 正橢圓，略大於 2 讓盤尾比較飽滿）；sweep = 往外每 1 mm 往後掠的量（兩片盤往外後掠成 V 字）
 * @type {{ x: number, y: number, a: number, b: number, c: number, thick: number, pitch: number, n: number, sweep: number }}
 */
const MIRROR_WING = { x: -53, y: 41, a: 11, b: 23.5, c: 22.5, thick: 0.7, pitch: 0, n: 2.6, sweep: 0.3 };

/**
 * 兩片相連超橢圓盤的外框（局部座標 u = 沿 x、w = 沿 z；俯視 8 字形）：右盤取 w ≥ 0 的弧、左盤鏡射，
 * 兩盤在 w = 0 相交處形成前後兩個內凹的腰
 * @type {(a: number, b: number, c: number, n: number, seg: number, grow: number) => number[][]} grow = 外框往外放大的量
 */
const figureEightOutline = (a, b, c, n, seg, grow) => {
  const A = a + grow;
  const B = b + grow;
  const e = 2 / n;
  /** @type {(v: number) => number} 保留正負號的次方 */
  const sp = (v) => Math.sign(v) * Math.abs(v) ** e;
  const phi0 = Math.asin(Math.min(1, (c / B) ** (n / 2)));
  /** @type {number[][]} */
  const right = [];
  for (let i = 0; i <= seg; i++) {
    const phi = -phi0 + ((Math.PI + 2 * phi0) * i) / seg;
    right.push([A * sp(Math.cos(phi)), c + B * sp(Math.sin(phi))]);
  }
  const left = right.map(([u, w]) => [-u, -w]);
  return [...right, ...left];
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
 * 鼻頭兩側前伸鏡刃（四視圖 22 鼻頭兩側往前伸的刃）：左右各一片貼著鼻側下緣的平刃，根部沿鼻側一整段埋進車殼，
 * 刃尖往前外伸到鼻尖旁。pts = 俯視外框 [x, |z|]（root 段的 |z| 由車殼半寬算）；y = 底面高；thick = 厚
 * @type {{ rootX0: number, rootX1: number, tip: number[], back: number[], y: number, thick: number }}
 */
const NOSE_BLADE = { rootX0: 58.5, rootX1: 73, tip: [76.4, 27], back: [60.5, 38.5], y: 12.6, thick: 0.8 };

/**
 * 側艙切面進氣口（四視圖 22 側面）：往後上斜的平行四邊形凹口，深 2.6，凹口底塗漆黑、側壁金色
 * @type {{ id: string, view: string, shape: string, pts: number[][], depth: number }}
 */
const SIDE_INTAKE = { id: '側進氣口', view: 'side', shape: 'poly', pts: [[-17, 14.6], [13, 14.6], [21, 22.6], [-7, 22.6]], depth: 2.6 };

/**
 * 引擎蓋八咫鏡（貼在引擎蓋頂面正中、沿車身縱向的橢圓鏡面）：中心 x、x / z 半軸
 * @type {{ x: number, a: number, b: number }}
 */
const HOOD_MIRROR = { x: 47, a: 9.5, b: 5 };

/** @type {(x: number, z: number) => number} 橢圓的正規化距離（< 1 = 在鏡內） */
const hoodMirrorR = (x, z) => Math.hypot((x - HOOD_MIRROR.x) / HOOD_MIRROR.a, z / HOOD_MIRROR.b);

/** @type {(x: number) => number} 朱紅側裙的上緣高度：兩輪之間在裙邊上 6.5 mm，車尾收到 3 mm（前輪拱之前不畫，鼻端全金） */
const skirtTop = (x) => P.yLow(x) + 3 + 3.5 * smoothstep(-66, -46, x) * smoothstep(62, 44, x);

/** @type {(x: number) => number} 漆黑底緣的高度：前軸之後 2.2 mm，往鼻尖收到 0 */
const baseBand = (x) => 2.2 * smoothstep(73, 58, x);

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 朱紅：側裙、翼柱
  vermilion: namedMaterial('paint-shrine-vermilion', { color: 0xd23a22, metalness: 0.1, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // 日金金屬漆：車身主色
  sunGold: namedMaterial('paint-sun-gold', { color: 0xe8b43c, metalness: 0.75, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  // 白銅鏡面：尾翼雙盤、鼻側鏡刃（真金屬；名稱含 -brass → Blender metallic）
  mirror: namedMaterial('trim-white-bronze-mirror-brass', { color: 0xeef0f3, metalness: 0.9, roughness: 0.1, clearcoat: 0.6 }),
  // 朱紅尾翼支柱（緞面射出件）
  pylon: namedMaterial('paint-pylon-vermilion-abs', { color: 0xd23a22, roughness: 0.4 }),
  // 鏡緣、進氣口側壁：金色金屬
  clawGold: namedMaterial('trim-claw-gold-brass', { color: 0xc9a54a, metalness: 0.85, roughness: 0.25 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x2a2730, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  urushi: namedMaterial('paint-urushi-black', { color: 0x141416, roughness: 0.55, clearcoat: 0.2 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x18181b, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x1a1a1e, roughness: 0.7, side: THREE.DoubleSide }),
  dMirror: decalMaterial('decal-white-bronze-mirror', { color: 0xe9ebef, metalness: 0.35, roughness: 0.12, clearcoat: 0.8 }),
  dVermilion: decalMaterial('decal-shrine-vermilion', { color: 0xd23a22, roughness: 0.3, clearcoat: 0.6 }),
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
  theme: '照四視圖 22 建模：圓鏟形低鼻兩側各一片往前伸的白銅鏡刃、高圓前擋泥板、圓頂座艙、側艙切面進氣口、外張的朱紅側裙；車尾兩片相連平躺的白銅鏡盤（八咫鏡，俯視 8 字形、往外後掠）；引擎蓋正中一面縱向橢圓八咫鏡；日金＋朱紅＋白銅',
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
    // 朱紅側裙
    { mat: 'vermilion', keep: (x, y) => Math.min(skirtTop(x) - y, 56 - x) },
    // 日金車身
    { mat: 'sunGold', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'sunGold' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'sunGold', recess: 'vermilion', recessWall: 'clawGold', glass: 'glass', cockpit: 'urushi', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 車尾鏡翼：兩片相連的平躺橢圓鏡面盤＋金色鏡緣（中空環，包住盤緣）＋兩支寬扁翼柱
    const tilt = (MIRROR_WING.pitch * Math.PI) / 180;
    /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} 繞盤心往後上仰（尾端比前端高） */
    const pitchUp = (g) => g.translate(-MIRROR_WING.x, -MIRROR_WING.y, 0).rotateZ(-tilt).translate(MIRROR_WING.x, MIRROR_WING.y, 0);
    const toWorld = (/** @type {number[][]} */ pts) => pts.map(([u, w]) => [MIRROR_WING.x + u - MIRROR_WING.sweep * Math.abs(w), w]);
    const { a, b, c, n } = MIRROR_WING;
    const disc = pitchUp(flatPlate(toWorld(figureEightOutline(a, b, c, n, 28, 0)), MIRROR_WING.y, MIRROR_WING.thick));
    parts.push({ geometry: disc, mat: 'mirror', solid: true, outline: true, name: 'mirror-wing-discs' });
    const rim = pitchUp(
      holedFlatPlate(toWorld(figureEightOutline(a, b, c, n, 28, 0.9)), toWorld(figureEightOutline(a, b, c, n, 28, -0.1)).reverse(), MIRROR_WING.y - 0.3, MIRROR_WING.thick + 0.6),
    );
    parts.push({ geometry: rim, mat: 'clawGold', solid: true, outline: true, name: 'mirror-wing-rim' });
    /** @type {THREE.BufferGeometry[]} */
    const pylons = [];
    for (const side of [-1, 1]) {
      const yDeck = P.yTop(MIRROR_WING.x + 4) - 1.5;
      pylons.push(
        finPlate(
          [
            [MIRROR_WING.x + 10, yDeck],
            [MIRROR_WING.x + 4, MIRROR_WING.y + 0.2],
            [MIRROR_WING.x - 3, MIRROR_WING.y + 0.2],
            [MIRROR_WING.x + 2, yDeck],
          ],
          side * MIRROR_WING.c * 0.62,
          2.0,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(pylons), mat: 'pylon', solid: true, outline: true, name: 'mirror-wing-pylons' });
    // 鼻頭兩側前伸鏡刃：根部沿鼻側 x 58.5～73 埋進車殼 1.5 mm
    /** @type {THREE.BufferGeometry[]} */
    const blades = [];
    for (const side of [-1, 1]) {
      /** @type {number[][]} */
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const x = lerp(NOSE_BLADE.rootX0, NOSE_BLADE.rootX1, i / 6);
        pts.push([x, P.hw(x) - 1.5]);
      }
      pts.push(NOSE_BLADE.tip, NOSE_BLADE.back);
      const ordered = side > 0 ? pts : pts.map(([x, z]) => [x, -z]).reverse();
      blades.push(flatPlate(ordered, NOSE_BLADE.y, NOSE_BLADE.thick));
    }
    parts.push({ geometry: mergeGeos(blades), mat: 'mirror', solid: true, outline: true, name: 'nose-mirror-blades' });

    // ---- 貼紙 ----
    // 座艙框（金，座艙罩外圍 1.2 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > CANOPY.x1 - 1.2 && x < CANOPY.x0 + 1.2 ? Math.min(u + 1.2, 0.05 - u) : -1;
      }),
      mat: 'dVermilion',
      name: 'decal-canopy-frame',
    });
    // 引擎蓋八咫鏡：白銅鏡面＋外圍一圈漆黑細鏡框（兩張貼紙不重疊）
    parts.push({ geometry: kit.decal((x, y, z) => (y < P.yLow(x) + 6 ? -1 : 1 - hoodMirrorR(x, z))), mat: 'dMirror', name: 'decal-hood-mirror' });
    parts.push({
      geometry: kit.decal((x, y, z) => (y < P.yLow(x) + 6 ? -1 : Math.min(hoodMirrorR(x, z) - 1.02, 1.16 - hoodMirrorR(x, z)))),
      mat: 'dUrushi',
      name: 'decal-hood-mirror-rim',
    });
    // 肩稜線下方的漆黑腰線（只畫在側面，前擋泥板 → 後輪臀，線寬 1.2）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.6 - Math.abs(y - (P.yS(x) - 2.6)), 50 - x, x + 64, Math.abs(z) - 0.8 * P.hw(x))), mat: 'dUrushi', name: 'decal-urushi-beltline' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估，造型照 shared/design/body-amaterasu-mirror/fourview.png 四視圖 22 的比例，尺寸照底盤）：殼長 144（車尾 −68 ~ 鼻尖 76）、外框長 144（扁翼板在殼內）；後甲板 31.5、鼻尖 16、前擋泥板頂約 32、座艙頂約 41.5、銅鏡頂 48.2；後輪臀 ±38、細腰 ±26（側裙下緣 ±35）、前輪上方 ±35；前擋泥板眉線為前輪拱同心圓 R19.2',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    wing: '車尾鏡翼（ABS 實心件，推估）：兩片相連平躺的超橢圓盤（俯視 8 字形，每片半軸 11 × 23.5、中心 |z| 22.5、指數 2.6、往外每 1 mm 後掠 0.3），盤心 x −53、底面高 41、厚 0.7，外圈金色鏡緣（寬 1、高 1.3）；兩支扁翼柱在 |z| 14、厚 2.0',
    claws: '鼻頭兩側前伸鏡刃（ABS 實心水平板，厚 0.8，推估）：根部沿鼻側 x 58.5–73 埋進車殼 1.5 mm，刃尖到 x 76.4、|z| 27，後角 x 60.5、|z| 38.5，底面高 12.6（在前輪前方、導輪上方）',
    palette: '日金主色＋朱紅側裙與翼柱＋白銅鏡面（尾翼雙盤、鼻側鏡刃、引擎蓋八咫鏡貼紙）＋漆黑底緣、腰線與鏡框；不用白底（和九尾狐分開）；色碼自訂（推估）：金 #E8B43C、朱紅 #D23A22、白銅 #EEF0F3、漆黑 #141416',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
