// 天照鏡（body-amaterasu-mirror，神話組・日本）：照四視圖 22 建模，天照大神只用器物與象徵表現（八咫鏡、日光），
// 不做神像、人形、臉。四視圖 22 留下的造型：圓鏟形低鼻、高高包住前輪的圓擋泥板、中段圓頂座艙、座艙後收腰、車尾伸出兩側的扁翼板。
// 八咫鏡 → 車尾一面平躺的大圓銅鏡（八花形金色鏡緣），擱在鳥居形的朱紅鏡台上（兩支立柱＋伸出車身兩側、兩端上翹的笠木橫梁，橫梁兼尾翼）；
// 注連繩 → 鼻面朱紅板上兩道橫跨車寬的白色水平帶，以及兩側腰線上朱紅底、白色斜紋的繩帶（斜紋互相平行，不從任何一點放射，避開旭日旗紋）。
// 配色：銅鏡的暖銅金屬色為主色，下緣深青銅漸層、朱紅與白為圖形色，漆黑底緣。
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
  hw: monoCurve(XS_HW, [16, 20, 25, 30, 31.5, 28, 25.5, 30, 36.5, 38, 36.5, 35.5, 33.4, 33, 32.6, 32.2, 31.4, 30, 28, 24.5, 19, 10]),
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
 * 車尾八咫鏡：一面平躺的大圓銅鏡，外緣是八花形（八個淺圓瓣）金色鏡緣，擱在鳥居形鏡台的笠木橫梁上。
 * x / y = 鏡心 x 與鏡底面高度；r = 鏡面半徑；lobe = 鏡緣圓瓣的深度；thick = 鏡面厚；postZ = 立柱的 |z|
 * @type {{ x: number, y: number, r: number, lobe: number, thick: number, postZ: number }}
 */
const MIRROR = { x: -50.5, y: 40.6, r: 25, lobe: 1.6, thick: 0.5, postZ: 11 };

/**
 * 鳥居形鏡台的笠木橫梁（兼尾翼）：在鏡底下橫跨車寬、伸出車身兩側，兩端上翹。
 * x0 / x1 = 前後緣 x；y = 底面高；thick = 厚；halfSpan = 半展長；tipRise = 兩端上翹高度
 * @type {{ x0: number, x1: number, y: number, thick: number, halfSpan: number, tipRise: number }}
 */
const KASAGI = { x0: -41, x1: -52, y: 39.6, thick: 1.0, halfSpan: 47.5, tipRise: 2.6 };

/**
 * 八花形外框（俯視，點位 [x, z]）：半徑在 r − lobe 與 r 之間，八個圓瓣；grow = 往外放大的量
 * @type {(r: number, lobe: number, seg: number, grow: number) => number[][]}
 */
const lobedOutline = (r, lobe, seg, grow) => {
  /** @type {number[][]} */
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const th = (2 * Math.PI * i) / seg;
    const rr = r - lobe + lobe * Math.abs(Math.cos(4 * th)) ** 0.5 + grow;
    pts.push([MIRROR.x + rr * Math.cos(th), rr * Math.sin(th)]);
  }
  return pts;
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
 * 鼻面朱紅板（前軸前方、兩道擋泥板之間，往鼻尖變寬）
 * @type {(x: number, z: number) => number} 正值 = 在朱紅板內
 */
const sunPanel = (x, z) => Math.min(x - 47, 0.46 * P.hw(x) - Math.abs(z));

/**
 * 鼻面注連繩紋（白，畫在朱紅板上）：兩道橫跨鼻面的水平帶（寬 2.6），和車寬方向平行、互相平行，不收到任何一點
 * @type {(x: number, z: number) => number} 正值 = 在帶上
 */
const ropeBands = (x, z) => Math.max(1.3 - Math.abs(x - 54.5), 1.3 - Math.abs(x - 62));

/** @type {(x: number) => number} 漆黑底緣的高度：前軸之後 2.2 mm，往鼻尖收到 0 */
const baseBand = (x) => 2.2 * smoothstep(73, 58, x);

/** @type {(x: number) => number} 深青銅下緣的高度（底緣以上 4 mm，往鼻尖收窄） */
const bronzeBand = (x) => baseBand(x) + 4 * smoothstep(76, 52, x);

/** @type {(x: number) => number} 腰線注連繩帶的中心高度（肩稜線下 3.4 mm） */
const ropeY = (x) => P.yS(x) - 3.4;

/**
 * 腰線注連繩帶的範圍（前擋泥板 → 後輪臀，帶高 3.2；只畫在肩稜線外側的側面，不畫上引擎蓋）
 * @type {(x: number, y: number, z: number) => number} 正值 = 在帶內
 */
const ropeBelt = (x, y, z) => Math.min(1.6 - Math.abs(y - ropeY(x)), 52 - x, x + 64, Math.abs(z) - P.hw(x) + 0.3);

/**
 * 繩帶上的白色斜紋（間距 3.2、線寬 1.4，全部互相平行，像絞繩）
 * @type {(x: number, y: number) => number} 正值 = 在白紋上
 */
const ropeTwist = (x, y) => {
  const u = x + 1.1 * (y - ropeY(x));
  const m = ((u % 3.2) + 3.2) % 3.2;
  return 0.7 - Math.abs(m - 0.7);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 暖銅金屬漆：車身主色（銅鏡的顏色）
  copper: namedMaterial('paint-warm-copper-metallic', { color: 0xc07a45, metalness: 0.7, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
  // 深青銅金屬漆：下緣漸層
  bronze: namedMaterial('paint-dark-bronze-metallic', { color: 0x86512c, metalness: 0.7, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.1 }),
  // 朱紅漆：鼻面板、鏡下立柱、鏡底盤
  shu: namedMaterial('paint-shu-vermilion', { color: 0xd23a22, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  // 銅鏡面（真金屬；名稱含 -brass → Blender metallic）
  mirror: namedMaterial('trim-bronze-mirror-brass', { color: 0xe9b866, metalness: 0.9, roughness: 0.1, clearcoat: 0.6 }),
  // 八花形鏡緣：金
  rimGold: namedMaterial('trim-mirror-rim-gold-brass', { color: 0xd8b04e, metalness: 0.85, roughness: 0.22 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x2a2730, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  urushi: namedMaterial('paint-urushi-black', { color: 0x141416, roughness: 0.55, clearcoat: 0.2 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x18181b, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x1a1a1e, roughness: 0.7, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-gold-leaf', { color: 0xd4b052, metalness: 0.75, roughness: 0.3 }),
  dWhite: decalMaterial('decal-pearl-white', { color: 0xfaf8f2, roughness: 0.3, clearcoat: 0.6 }),
  dShu: decalMaterial('decal-shu-vermilion', { color: 0xd23a22, roughness: 0.3, clearcoat: 0.6 }),
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
  theme: '照四視圖 22 建模：圓鏟形低鼻、高圓前擋泥板、圓頂座艙；車尾兩支朱紅立柱撐起一面平躺的八花形大圓銅鏡（八咫鏡）；鼻面朱紅板上兩道白色注連繩水平帶、腰線朱紅白斜紋繩帶，暖銅金屬色車身＋深青銅下緣',
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
    // 深青銅下緣
    { mat: 'bronze', keep: (x, y) => P.yLow(x) + bronzeBand(x) - y },
    // 鼻面朱紅板
    { mat: 'shu', keep: (x, y, z) => sunPanel(x, z) },
    // 暖銅車身
    { mat: 'copper', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'copper' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'copper', recess: 'urushi', recessWall: 'rimGold', glass: 'glass', cockpit: 'urushi', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 車尾八咫鏡：拋光銅鏡面＋八花形金色鏡緣（中空環，包住鏡緣）＋兩支朱紅立柱
    const seg = 64;
    parts.push({ geometry: flatPlate(lobedOutline(MIRROR.r, MIRROR.lobe, seg, 0), MIRROR.y, MIRROR.thick), mat: 'mirror', solid: true, outline: true, name: 'yata-mirror-face' });
    const rim = holedFlatPlate(lobedOutline(MIRROR.r, MIRROR.lobe, seg, 1.0), lobedOutline(MIRROR.r, MIRROR.lobe, seg, -0.2).reverse(), MIRROR.y - 0.4, MIRROR.thick + 0.8);
    parts.push({ geometry: rim, mat: 'rimGold', solid: true, outline: true, name: 'yata-mirror-rim' });
    /** @type {THREE.BufferGeometry[]} */
    const posts = [];
    for (const side of [-1, 1]) {
      const xc = (KASAGI.x0 + KASAGI.x1) / 2;
      const yDeck = P.yTop(xc) - 1.5;
      posts.push(
        finPlate(
          [
            [xc + 6.5, yDeck],
            [xc + 3, KASAGI.y + 0.5],
            [xc - 3, KASAGI.y + 0.5],
            [xc - 6, yDeck],
          ],
          side * MIRROR.postZ,
          2.4,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(posts), mat: 'shu', solid: true, outline: true, name: 'yata-mirror-posts' });
    // 笠木橫梁：俯視是兩端略往後掠的長板，兩端各一塊上翹的端塊
    const { x0, x1, halfSpan: hs } = KASAGI;
    /** @type {number[][]} */
    const beamPts = [
      [x0, 0],
      [x0 + 0.6, hs - 4],
      [x0 + 1.4, hs],
      [x1 + 0.6, hs],
      [x1, hs - 4],
      [x1, -(hs - 4)],
      [x1 + 0.6, -hs],
      [x0 + 1.4, -hs],
      [x0 + 0.6, -(hs - 4)],
    ];
    /** @type {THREE.BufferGeometry[]} */
    const beam = [flatPlate(beamPts, KASAGI.y, KASAGI.thick)];
    const yb = KASAGI.y + KASAGI.thick;
    for (const side of [-1, 1]) {
      beam.push(
        finPlate(
          [
            [x0 + 1.4, yb - 0.4],
            [x0 + 2.2, yb + KASAGI.tipRise],
            [x0 - 1, yb + KASAGI.tipRise - 0.6],
            [x1 + 1.5, yb + KASAGI.tipRise - 0.6],
            [x1 + 0.6, yb - 0.4],
          ],
          side * (hs - 1.4),
          2.4,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(beam), mat: 'shu', solid: true, outline: true, name: 'yata-kasagi-beam' });

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
    // 鼻面注連繩紋（白，畫在朱紅板上）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(ropeBands(x, z), sunPanel(x, z) - 0.6)), mat: 'dWhite', name: 'decal-rope-bands' });
    // 鼻面朱紅板的金色描邊（寬 0.8）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.4 - Math.abs(sunPanel(x, z) + 0.4), y - P.yLow(x) - 3)), mat: 'dGold', name: 'decal-sun-panel-rim' });
    // 腰線注連繩帶：朱紅底＋白色平行斜紋（兩份貼紙互補，不重疊）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(ropeBelt(x, y, z), -ropeTwist(x, y))), mat: 'dShu', name: 'decal-rope-belt' });
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(ropeBelt(x, y, z), ropeTwist(x, y))), mat: 'dWhite', name: 'decal-rope-twist' });
    // 繩帶上下的金色細邊
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(y - ropeY(x)) - 1.95), 52 - x, x + 64, Math.abs(z) - P.hw(x) + 0.3)), mat: 'dGold', name: 'decal-rope-edge' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估，造型照 shared/design/body-amaterasu-mirror/fourview.png 四視圖 22 的比例，尺寸照底盤）：殼長 144（車尾 −68 ~ 鼻尖 76）；後甲板 31.5、鼻尖 16、前擋泥板頂約 32、座艙頂約 41.5；後輪臀 ±38、細腰 ±26（側裙下緣 ±35）、前輪上方 ±35；前擋泥板眉線為前輪拱同心圓 R19.2',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    wing: '車尾八咫鏡與鳥居形鏡台（ABS 實心件，推估）：銅鏡面 R25（八花形，瓣深 1.6，鏡心 x −50.5）、厚 0.5、底面高 40.6，金色鏡緣環寬 1.2、高 1.3；笠木橫梁 x −41 ~ −52、半展 47.5、厚 1.0、底面高 39.6，兩端上翹 2.6；兩支立柱 |z| 11、厚 2.4',
    palette: '暖銅金屬漆主色 #C07A45＋深青銅下緣 #86512C＋朱紅 #D23A22（鼻面板、腰線繩帶、鏡台）＋白（注連繩紋）＋金（鏡緣、座艙框、繩帶細邊）＋銅鏡面＋漆黑底緣；朱紅與白參考 MYTH_RESEARCH 日本節（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
