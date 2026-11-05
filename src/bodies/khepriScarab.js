// 聖甲蟲凱布利推日（body-khepri-scarab，神話組・埃及；LG1 F2 擋泥板肌肉型）：聖甲蟲與日盤只用元素表現，車上沒有甲蟲的頭、眼、觸角、腳。
// 鞘翅（elytra）→ 面板分割：左右分開的後擋泥板大量體，中間一道鞘翅縫，縫底立一條金色脊線（中央隆起脊），每片 3 道金色縱紋；
// 前擋泥板是綠松石彩陶色的量體，一路延伸到扁鏟鼻尖（鼻錐和前擋泥板同色，不另外做成一顆頭）；兩者之間明顯收腰（俯視 ±44.4 → ±20.5）。
// 有翼日盤 → 尾翼：紅玉髓日盤往後躺在鞘翅縫的尾端，左右各一片展開的翼從鞘翅尾端的殼面長出來（前緣貼著殼面、後緣上翹成鴨尾），
// 翼面是金框鑲嵌的羽格（綠松石、青金石各一排，羽尖鋸齒），日盤和兩翼連成一整片。
// 胸飾（pectoral）鑲嵌 → livery：前擋泥板前緣的金底紅玉髓格帶；鼻尖上一個象形文字框（cartouche）形的號碼牌（金框、青金石底，裡面只有兩道橫槓，不寫字）。
// 收腰段頂面填平，上方是金色不透明小座艙。
// 設計：shared/design/body-khepri-scarab/DESIGN.md（典故與文物對應 MYTH_RESEARCH 埃及節 E1、E2、E3、E7、E8；
// 黑名單 E10 Blue Beetle、Victory Magnum 鍬形蟲：不用 V 形引擎蓋、沒有大顎）。
// 剖面為本檔站位產生器（推估）；塗裝全為自創：青金石珍珠藍鞘翅、綠松石彩陶前段、金色脊線與翼框、紅玉髓日盤、玄武岩黑下車身；
// 不含任何廠商 / 作品名稱、商標、文字或神的人臉。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, sdRoundRect } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：鞘翅尾端 −65、鼻尖 76 */
const XS = [-65, -60, -53, -46, -40, -32, -22, -12, -2, 8, 18, 28, 36, 42, 50, 56, 62, 68, 72, 76];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬：後擋泥板（鞘翅）±44.4、收腰 ±20.5（x 8；x 18 是 ±21）、前擋泥板 ±41.6；鼻錐往前收成扁鏟（鼻尖 ±8）
  hw: monoCurve(XS, [18, 30, 40.5, 44, 44.4, 44.2, 41.5, 33.5, 24.5, 20.5, 21, 33.5, 41.4, 41.6, 35, 26.5, 19.5, 14, 11, 8]),
  // 中央脊線頂（鞘翅縫裡的金脊）：後段 33.8、收腰 32.6、前擋泥板 33，往前降到鼻尖 18
  ySpine: monoCurve(XS, [27, 30.2, 32.8, 33.6, 33.8, 33.6, 33.2, 32.8, 32.6, 32.6, 32.8, 33, 33, 32.4, 30.2, 27.4, 24, 21, 19.4, 18]),
  // 擋泥板量體頂（每片鞘翅 / 前擋泥板的拱頂）：後 39、收腰 33.4、前 36.2；鼻尖 18.2
  yF: monoCurve(XS, [27.2, 33.2, 37.2, 38.8, 39, 38.8, 37.6, 36, 34.2, 33.4, 33.6, 35, 36.2, 36, 34, 30.2, 25.4, 21.4, 19.6, 18.2]),
  // 肩線（拱頂外側的銳利稜線、側壁上緣）：擋泥板處高、收腰處低 → 側視看得到四個角的量體
  yA: monoCurve(XS, [24.5, 25.8, 26.6, 27, 27, 26.8, 26, 24.6, 22.6, 21.4, 22.4, 28.4, 31.2, 31.4, 29.4, 25, 20.6, 17.6, 16.6, 16]),
  // 側裙下緣
  yLow: monoCurve(XS, [21.5, 18, 14, 12.6, 12.4, 12.4, 12.6, 13.2, 13.8, 14, 14, 13.2, 12.4, 12.4, 12.8, 13.8, 14.8, 15.4, 15.8, 16]),
};

/** @type {number} 鞘翅縫半寬（脊線外側縫底的 z） */
const SEAM_Z = 3.4;
/** @type {number} 縫底比脊頂低多少（後段最深，往前變淺） */
const seamDepth = (x) => lerp(0.5, 0.9, Math.min(1, Math.max(0, (40 - x) / 70)));
/** @type {number} 側裙下緣往內收（肩線挑出側裙＝下半內收 tumblehome） */
const SKIRT_TUCK = 2.6;

/**
 * 半剖面 9 點：脊頂 → 脊肩 → 縫底（銳利）→ 擋泥板拱頂兩點 → 拱外側 → 肩線（銳利）→ 側壁中段 → 側裙下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = P.hw(x);
  const ys = P.ySpine(x);
  const yg = ys - seamDepth(x);
  const yF = Math.max(P.yF(x), yg + 0.4);
  const yA = P.yA(x);
  const zc = 0.6 * hw;
  return [
    [0, ys],
    [1.5, ys - 0.25],
    [SEAM_Z, yg],
    [lerp(SEAM_Z, zc, 0.45), lerp(yg, yF, 0.8)],
    [zc, yF],
    [lerp(zc, hw, 0.6), lerp(yF, yA, 0.4)],
    [hw, yA],
    [hw - SKIRT_TUCK * 0.35, lerp(yA, P.yLow(x), 0.5)],
    [hw - SKIRT_TUCK, P.yLow(x) + 0.8],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 尾端、鼻錐段每 2 mm 一站，中段每 2.5 mm */
const STATIONS = [...buildStations(-65, -57, 2, profile).slice(0, -1), ...buildStations(-57, 62, 2.5, profile).slice(0, -1), ...buildStations(62, 76, 2, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22 },
];

/** @type {number} 分區界線：綠松石前段的後緣 x */
const X_PRONOTUM = 23;
/** @type {{ x: number, rx: number, ry: number, rz: number }} 座艙罩（收腰上方的金色不透明小罩） */
const COCKPIT = { x: 6, rx: 10.5, ry: 5.2, rz: 6.8 };

/** @type {number} 胸飾鑲嵌格帶的中心 x（橫跨前擋泥板前緣） */
const X_INLAY = 56.2;

/** @type {{ x: number, y: number, r: number, thick: number, lean: number }} 日盤（往後躺在鞘翅縫尾端，盤面朝上、後緣上翹 lean 弧度；和兩翼同一個斜面） */
const DISC = { x: -56, y: 35.8, r: 9.6, thick: 1.6, lean: 0.12 };

/**
 * 有翼日盤的單側翼（另一側鏡射）：翼根 z0 接日盤、翼尖 z1；前緣在 x = xLe，沿殼面起伏（貼著殼面，高出 lift）；
 * 弦長由 chord0 收到 chord1，後緣每片羽多伸出 serration（鋸齒羽尖）；整片以前緣為軸往後上翹 pitch 弧度。
 * base / cell = 金色底板與鑲嵌羽格的厚度
 * @type {{ z0: number, z1: number, xLe: number, chord0: number, chord1: number, serration: number, pitch: number, lift: number, feathers: number, base: number, cell: number }}
 */
const WING = { z0: 9, z1: 37, xLe: -50, chord0: 14, chord1: 10.5, serration: 2.6, pitch: 0.12, lift: 0.5, feathers: 5, base: 0.9, cell: 0.45 };

/** @type {(x: number, z: number) => number} 號碼牌的象形文字框外形（俯視長圓框，x 60.6–73.2、半寬 4）：負值在框內 */
const cartoucheSd = (x, z) => sdRoundRect(x, z, 60.6, 73.2, -4, 4, 4);
/** @type {(x: number, z: number) => number} 框內兩道橫槓（抽象記號，不是文字）：正值在槓上 */
const cartoucheMarks = (x, z) => Math.min(-cartoucheSd(x, z) - 1, Math.max(0.45 - Math.abs(x - 64.6), 0.45 - Math.abs(x - 67.6)));

/**
 * 由半剖面折線反查某高度的殼外表面 z（剖面點 z 由中線往外遞增、y 由上往下遞減）
 * @type {(pts: number[][], y: number) => number} 高於殼頂回傳 0，低於下緣回傳下緣 z
 */
export const profileZAtY = (pts, y) => {
  if (y >= pts[0][1]) {
    return 0;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) {
      const t = Math.abs(y1 - y0) < 1e-6 ? 0 : (y - y0) / (y1 - y0);
      return lerp(z0, z1, t);
    }
  }
  return pts[pts.length - 1][0];
};

/**
 * 輪拱內襯（參考 zeppelin-xtail 的 buildHullLiner）：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3，只取上半圈），
 * 每個角度的 z 範圍 = [zFrom, 殼內面]；殼內面 z 由該站剖面反查（外表面 − inset）。擋住從輪拱看進去的殼內空腔與底盤空隙
 * @type {(arch: { x: number, y: number, radius: number }, zFrom: number, profileFn: (x: number) => number[][], inset?: number) => THREE.BufferGeometry}
 */
export function buildProfileLiner(arch, zFrom, profileFn, inset = 1.2) {
  const r = arch.radius + 0.3;
  const n = 48;
  const a0 = 0.12;
  const a1 = Math.PI - 0.12;
  const pos = [];
  /** @type {(t: number) => number} 該角度的殼內面 z */
  const zIn = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    return Math.max(zFrom, profileZAtY(profileFn(x), y) - inset);
  };
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zFrom);
      const B = p(t1, zFrom);
      const C = p(t1, zIn(t1));
      const D = p(t0, zIn(t0));
      // 法線朝輪心（內襯面向輪胎）
      if (sg > 0) {
        pos.push(...A, ...C, ...B, ...A, ...D, ...C);
      } else {
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 青金石珍珠漆（亮面清漆＋微金屬）：鞘翅量體、翼面外排羽格
  lapis: namedMaterial('paint-lapis-pearl', { color: 0x1f4f96, roughness: 0.26, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  // 玄武岩黑：收腰與側裙（霧面）
  basalt: namedMaterial('paint-basalt-black', { color: 0x1c1e23, roughness: 0.66 }),
  // 彩陶綠松石（亮面釉）：前擋泥板到鼻尖、翼面內排羽格
  faience: namedMaterial('paint-faience-turquoise', { color: 0x2f9e98, roughness: 0.34, clearcoat: 0.6 }),
  // 真金屬金（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a227, metalness: 0.82, roughness: 0.32, clearcoat: 0.3 }),
  // 座艙罩：金色不透明（名稱含 -brass → Blender 金屬）
  cockpitGold: namedMaterial('trim-gold-canopy-brass', { color: 0xd4ad3a, metalness: 0.8, roughness: 0.22, clearcoat: 0.6 }),
  // 紅玉髓：拋光寶石（亮面，只用在日盤盤心與鑲嵌格）
  carnelian: namedMaterial('paint-carnelian-red', { color: 0xb1342a, roughness: 0.28, clearcoat: 0.8 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1b1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x1d4a78, roughness: 0.6, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-basalt', { color: 0x2a2c31, roughness: 0.7, side: THREE.DoubleSide }),
  dGold: decalMaterial('decal-gold-leaf', { color: 0xd1aa35, metalness: 0.75, roughness: 0.34 }),
  dCarnelian: decalMaterial('decal-carnelian', { color: 0xb1342a, roughness: 0.32, clearcoat: 0.7 }),
  dTurquoise: decalMaterial('decal-turquoise', { color: 0x3fb8af, roughness: 0.55 }),
  dLapis: decalMaterial('decal-lapis', { color: 0x1f4f96, roughness: 0.3, clearcoat: 0.6 }),
  dVoid: decalMaterial('decal-intake-void', { color: 0x07080a, roughness: 0.95 }),
});

/**
 * 殼頂面在 (x, z) 的高度（沿半剖面折線內插，只看脊頂到肩線；超出肩線回傳肩線高度）
 * @type {(x: number, z: number) => number}
 */
const hullTopY = (x, z) => {
  const pts = profile(x).slice(0, 7);
  const az = Math.abs(z);
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (az >= z0 && az <= z1) {
      return lerp(y0, y1, (az - z0) / (z1 - z0));
    }
  }
  return pts[pts.length - 1][1];
};

/**
 * 由一串斷面環（每環點數相同）建封閉網格：相鄰環之間補四邊形、頭尾各補一個扇形封口，
 * 再依帶號體積統一繞向（法線朝外，質量用封閉體積計算）。頂點不共用 → 平面著色，稜線清楚
 * @type {(rings: number[][][]) => THREE.BufferGeometry}
 */
const closedLoft = (rings) => {
  const m = rings[0].length;
  /** @type {number[]} */
  const pos = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < m; k++) {
      const a = rings[i][k];
      const b = rings[i][(k + 1) % m];
      const c = rings[i + 1][(k + 1) % m];
      const d = rings[i + 1][k];
      pos.push(...a, ...d, ...c, ...a, ...c, ...b);
    }
  }
  for (const [ring, flip] of /** @type {[number[][], boolean][]} */ ([
    [rings[0], false],
    [rings[rings.length - 1], true],
  ])) {
    const cx = [0, 1, 2].map((j) => ring.reduce((acc, p) => acc + p[j], 0) / m);
    for (let k = 0; k < m; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % m];
      if (flip) {
        pos.push(...cx, ...b, ...a);
      } else {
        pos.push(...cx, ...a, ...b);
      }
    }
  }
  let vol = 0;
  for (let i = 0; i < pos.length; i += 9) {
    vol +=
      pos[i] * (pos[i + 4] * pos[i + 8] - pos[i + 5] * pos[i + 7]) -
      pos[i + 1] * (pos[i + 3] * pos[i + 8] - pos[i + 5] * pos[i + 6]) +
      pos[i + 2] * (pos[i + 3] * pos[i + 7] - pos[i + 4] * pos[i + 6]);
  }
  if (vol < 0) {
    for (let i = 0; i < pos.length; i += 9) {
      for (let j = 0; j < 3; j++) {
        const tmp = pos[i + 3 + j];
        pos[i + 3 + j] = pos[i + 6 + j];
        pos[i + 6 + j] = tmp;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 翼面上的點：u = 翼展比例（0 翼根、1 翼尖）、f = 弦向比例（0 前緣、1 後緣）、up = 離翼面基準的高度、sg = 左右
 * @type {(u: number, f: number, up: number, sg: number) => number[]}
 */
const wingPoint = (u, f, up, sg) => {
  const z = lerp(WING.z0, WING.z1, u);
  const ph = (u * WING.feathers) % 1;
  // 每片羽中央的後緣最長、羽與羽之間最短 → 鋸齒羽尖
  const chord = lerp(WING.chord0, WING.chord1, u) + WING.serration * (1 - Math.abs(2 * ph - 1));
  const x = WING.xLe - f * chord;
  return [x, hullTopY(WING.xLe, z) + WING.lift + (WING.xLe - x) * Math.tan(WING.pitch) + up, sg * z];
};

/**
 * 兩片翼：金色底板（沿翼展每半片羽一站，後緣自然成鋸齒）＋疊在上面的鑲嵌羽格（每片羽 2 格：內排綠松石、外排青金石），
 * 羽格四周比羽片內縮，露出的金底就是鑲嵌的金框
 * @type {() => { base: THREE.BufferGeometry, turquoise: THREE.BufferGeometry, lapis: THREE.BufferGeometry }}
 */
const buildWings = () => {
  /** @type {THREE.BufferGeometry[]} */
  const base = [];
  /** @type {THREE.BufferGeometry[]} */
  const turquoise = [];
  /** @type {THREE.BufferGeometry[]} */
  const lapis = [];
  const top = WING.base - 0.4;
  /** @type {(u: number, f0: number, f1: number, y0: number, y1: number, sg: number) => number[][]} 弦向一段的矩形斷面環 */
  const ring = (u, f0, f1, y0, y1, sg) => [wingPoint(u, f0, y0, sg), wingPoint(u, f0, y1, sg), wingPoint(u, f1, y1, sg), wingPoint(u, f1, y0, sg)];
  for (const sg of [-1, 1]) {
    /** @type {number[][][]} */
    const rings = [];
    for (let j = 0; j <= 2 * WING.feathers; j++) {
      rings.push(ring(j / (2 * WING.feathers), 0, 1, -0.4, top, sg));
    }
    base.push(closedLoft(rings));
    for (let k = 0; k < WING.feathers; k++) {
      const us = [k + 0.09, k + 0.91].map((v) => v / WING.feathers);
      turquoise.push(closedLoft(us.map((u) => ring(u, 0.22, 0.5, top - 0.05, top + WING.cell, sg))));
      lapis.push(closedLoft(us.map((u) => ring(u, 0.56, 0.86, top - 0.05, top + WING.cell, sg))));
    }
  }
  return { base: mergeGeos(base), turquoise: mergeGeos(turquoise), lapis: mergeGeos(lapis) };
};

export const khepriScarabBody = makePolyBody({
  id: 'body-khepri-scarab',
  name: '聖甲蟲凱布利',
  style: 'myth',
  phase: 8,
  mythSeries: 'egyptian',
  mythTheme: 'khepri-scarab',
  form: 'scarab-dome',
  roof: 'closed',
  wing: 'sun-disc',
  theme: '推日的聖甲蟲用元素表現的擋泥板肌肉車：兩片青金石鞘翅＝分開的後擋泥板大量體、中央金縫線相合，綠松石前擋泥板一路收成扁鏟鼻尖，中段深收腰上一個金色小座艙；車尾是有翼日盤尾翼（紅玉髓日盤＋左右兩片金框鑲嵌羽格的翼，從鞘翅尾端長出來、後緣上翹），鼻尖一個象形文字框形的號碼牌',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 縫底與肩線是銳利稜線
  hard: [2, 6],
  wheelArches: ARCHES,
  sideZMin: 26,
  zones: () => [
    // 中央脊（鞘翅縫裡的脊頂）：金，一路到鼻尖
    { mat: 'gold', keep: (x, y, z) => Math.min(0.9 - Math.abs(z), x + 63) },
    // 肩線以下的側裙：玄武岩黑
    { mat: 'basalt', keep: (x, y) => P.yA(x) - 0.12 - y },
    // 前擋泥板到鼻尖（X_PRONOTUM 以前）：綠松石彩陶
    { mat: 'faience', keep: (x) => x - X_PRONOTUM },
    // 鞘翅與收腰段頂面：青金石藍
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'basalt', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.4, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 有翼日盤尾翼：兩片翼的前緣貼著鞘翅尾端的殼面，後緣上翹；日盤在中央和翼根相接，盤前緣埋進鞘翅縫
    const wings = buildWings();
    parts.push({ geometry: wings.base, mat: 'gold', solid: true, outline: true, name: 'disc-wings' });
    parts.push({ geometry: wings.turquoise, mat: 'faience', solid: true, name: 'disc-wing-cells-turquoise' });
    parts.push({ geometry: wings.lapis, mat: 'lapis', solid: true, name: 'disc-wing-cells-lapis' });
    /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} 盤軸（y）往前傾 lean（盤面後緣上翹），再移到鞘翅縫尾端 */
    const placeDisc = (g) => {
      g.rotateZ(-DISC.lean);
      g.translate(DISC.x, DISC.y, 0);
      return g;
    };
    parts.push({ geometry: placeDisc(new THREE.CylinderGeometry(DISC.r, DISC.r, DISC.thick, 20)), mat: 'gold', solid: true, outline: true, name: 'sun-disc' });
    {
      // 盤面上的紅玉髓盤心＋金色圓環盤緣
      const core = new THREE.CylinderGeometry(6.4, 6.4, 0.4, 20);
      core.translate(0, DISC.thick / 2 + 0.1, 0);
      parts.push({ geometry: placeDisc(core), mat: 'carnelian', solid: true, name: 'sun-disc-core' });
      const rim = new THREE.TorusGeometry(DISC.r, 0.7, 5, 20);
      rim.rotateX(Math.PI / 2);
      parts.push({ geometry: placeDisc(rim), mat: 'gold', solid: true, outline: true, name: 'sun-disc-rim' });
    }
    // 座艙：收腰正上方一個小的金色不透明座艙罩（橢球，下半埋進殼內）
    {
      const dome = new THREE.SphereGeometry(1, 16, 10);
      dome.scale(COCKPIT.rx, COCKPIT.ry, COCKPIT.rz);
      dome.translate(COCKPIT.x, P.ySpine(COCKPIT.x) - 0.8, 0);
      parts.push({ geometry: dome, mat: 'cockpitGold', solid: true, outline: true, name: 'cockpit-dome' });
    }

    // ---- 貼紙 ----
    // 鞘翅縱紋：每片鞘翅 3 道金色細線（寬 0.7 mm），沿擋泥板拱頂往車尾收攏
    const STRIAE = [0.36, 0.6, 0.8];
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > -4 || x < -62) {
          return -1;
        }
        const h = P.hw(x);
        const az = Math.abs(z);
        let d = Infinity;
        for (const f of STRIAE) {
          d = Math.min(d, Math.abs(az - f * h));
        }
        return Math.min(0.35 - d, y - P.yA(x) - 1.2, -4 - x, x + 62);
      }),
      mat: 'dGold',
      name: 'decal-elytra-striae',
    });

    // 肩線金邊（擋泥板量體外緣，收腰段斷開；前段一路到鼻尖）＋ 縫邊綠松石細線。
    // 金邊只畫在外側半邊（|z| > 半寬的一半）：鞘翅縫的谷底和肩線差不多高，不限制的話谷底也會畫出一圈金線
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.42 - Math.abs(y - (P.yA(x) + 0.5)), 75 - x, x + 63, Math.max(-1 - x, x - 23), Math.abs(z) - 0.5 * P.hw(x))),
      mat: 'dGold',
      name: 'decal-fender-borders',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.36 - Math.abs(Math.abs(z) - (SEAM_Z + 0.9)), -1 - x, x + 46), { offset: 0.1 }),
      mat: 'dTurquoise',
      name: 'decal-seam-pinstripes',
    });
    // 胸飾鑲嵌格帶（E2 胸飾的金框鑲嵌語彙）：橫跨前擋泥板前緣的金底帶＋紅玉髓小格
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(1.6 - Math.abs(x - X_INLAY), y - P.yA(x) - 0.8, Math.abs(z) - SEAM_Z)), mat: 'dGold', name: 'decal-inlay-band' });
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          const ph = ((Math.abs(z) % 3.4) + 3.4) % 3.4;
          return Math.min(Math.min(ph, 3.4 - ph) - 0.4, 0.9 - Math.abs(x - X_INLAY), y - P.yA(x) - 1.4, Math.abs(z) - SEAM_Z - 0.6);
        },
        { offset: 0.12 },
      ),
      mat: 'dCarnelian',
      name: 'decal-inlay-cells',
    });
    // 鼻尖的象形文字框號碼牌：金框（線寬 0.8）＋框尾一道橫槓＋框內兩道金槓；框內其餘是青金石底（兩片貼紙不重疊）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < P.yA(x) + 0.3) {
          return -1;
        }
        const frame = 0.4 - Math.abs(cartoucheSd(x, z));
        const bar = Math.min(0.45 - Math.abs(x - 59.7), 5 - Math.abs(z));
        return Math.max(frame, bar, cartoucheMarks(x, z));
      }),
      mat: 'dGold',
      name: 'decal-cartouche-frame',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (y < P.yA(x) + 0.3 ? -1 : Math.min(-cartoucheSd(x, z) - 0.4, -cartoucheMarks(x, z)))),
      mat: 'dLapis',
      name: 'decal-cartouche-fill',
    });
    // 側面兩層量體：收腰段側壁下緣的黑色進氣口（往後上掃的平行四邊形）＋金色上緣線
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 26, side };
      /** @type {(u: number, v: number) => number} 進氣口（u = x、v = y）：下緣 13.4、上緣隨 x 往後升高 */
      const intake = (u, v) => Math.max(-6 - u, u - 21, 13.6 - v, v - lerp(19.2, 17.4, (u + 6) / 27));
      parts.push({ geometry: kit.decal(sideDecal(intake, opt)), mat: 'dVoid', name: `decal-side-intake-${side}` });
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(-6 - u, u - 21, Math.abs(v - lerp(19.2, 17.4, (u + 6) / 27) - 0.55) - 0.35), opt), { offset: 0.1 }),
        mat: 'dGold',
        name: `decal-intake-lip-${side}`,
      });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：殼長 141（鞘翅尾端 −65 ~ 鼻尖 76），含日盤外框 x −66.3 ~ 76.2（142.5）；鞘翅量體頂 39、前擋泥板量體頂 36.2、收腰頂 33.4（頂面填平）、翼面後緣頂約 40.8（全車最高）；寬：鞘翅 ±44.4、前擋泥板 ±41.6、收腰 ±20.5、鼻尖 ±8',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），可裝 26 / 31 mm 輪',
    disc: '有翼日盤尾翼：日盤是金色實心 ABS 電鍍盤 R9.6 × 1.6 mm（20 段）、往後躺 0.12 弧度（約 6.9°），中心 x −56、y 35.8，盤前緣埋進鞘翅縫；盤面紅玉髓盤心 R6.4；盤緣金色圓環（管半徑 0.7）。兩片翼：翼根 |z| 9 接日盤、翼尖 |z| 37，前緣在 x −50 沿殼面起伏（高出殼面 0.5 mm），弦長 14 → 10.5 mm、每片羽尖再多 2.6 mm（每側 5 片羽），和日盤同一個斜度往後上翹；金色底板厚 0.9 mm，上面每片羽 2 格鑲嵌（綠松石、青金石，厚 0.45 mm）。座艙罩：金色實心橢球 21 × 10.4 × 13.6 mm（下半埋進殼內）。質量 = 封閉體積 × 1.05 g/cm³（推估）',
    palette: '色碼取 MYTH_RESEARCH 3-2（推估，E2 Met 16.1.3 胸飾材質）：金 #C9A227、青金石 #26619C（鞘翅珍珠漆用較深的 #1F4F96）、紅玉髓 #B1342A、綠松石 #3FB8AF（前段彩陶釉用 #2F9E98）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
