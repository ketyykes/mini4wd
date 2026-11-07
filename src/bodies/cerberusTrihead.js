// 三頭犬（body-cerberus-trihead，神話組・希臘）：照四視圖 07 的「從前輪往前伸成細長尖刺的匕首鼻、多面切削的側面、低座艙、高車尾、兩端 Z 字閃電折線的尾翼、俯視 W 形尾」建模，不做犬頭。
// 「三」：匕首鼻兩側三條等長平行的青銅金速度線；尾翼後緣三個等長尖齒（俯視 W 形尾）。
// 黑繪陶 livery：黑釉為主色，陶土色做擋泥板頂面色塊、刃狀稜、尾翼與描線（切面折線上的對比色描線），白色加彩細線鑲邊；
// 側面上層是陶土色鎖鏈（冥府的鎖鏈），下層收腰段是陶土飾帶上的黑色回紋（羅浮宮 E 701 卡厄瑞水罐的黑繪陶語彙）。
// 側面多面切削：肩稜下的上層側壁往下內收到一道腰折線，折線下是往外的裙板，兩輪之間的裙板一路蓋到底盤側框上緣。
// 設計：shared/design/body-cerberus-trihead/DESIGN.md（MYTH_RESEARCH G3–G5、G12）。全為自創，不含任何文字或商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { buildProfileLiner } from './khepriScarab.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40；x 46 以前是細長匕首鼻，鼻尖 x 77） */
const XS = [-64, -58, -52, -44, -36, -26, -14, -2, 10, 22, 32, 40, 46, 52, 58, 64, 70, 77];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬：車尾 ±30、後擋泥板 ±42、收腰 ±30.6、前擋泥板 ±42；前擋泥板之後收成俯視細長三角的匕首鼻（x 52 ±17 → x 64 ±5.6 → 鼻尖 ±0.8）
  hw: monoCurve(XS, [30, 38, 41.4, 42, 39.6, 34, 31, 30.6, 32, 36, 40, 42, 34, 17, 10, 5.6, 2.6, 0.8]),
  // 中央背脊頂：車尾高、往前一路降到扁平的匕首鼻尖（16.8）
  yC: monoCurve(XS, [33, 34.4, 34.8, 34.4, 33.6, 32.4, 31, 30, 28.8, 27, 25.6, 24, 22, 20, 18.6, 17.8, 17.2, 16.8]),
  // 刻面艙頂（0.5 半寬）：後艙最高（前低後高），前艙比背脊高；匕首鼻段和背脊同高（扁平）
  yF: monoCurve(XS, [33.4, 35.4, 36, 35.6, 34.4, 31.4, 27, 26, 27.4, 29.8, 30.4, 29.6, 27, 21.4, 19.2, 18.2, 17.4, 16.9]),
  // 肩稜（最寬處）
  yE: monoCurve(XS, [29.4, 31.4, 32, 31.6, 30.4, 27.4, 24.4, 23.8, 24.4, 26.6, 27.8, 27.6, 25.6, 20.4, 18.6, 17.8, 17.1, 16.6]),
  // 裙板下緣：兩輪之間降到 10.4（底盤側框頂 9.9 之上），匕首鼻段抬高
  yLow: monoCurve(XS, [18, 15, 13.4, 12.8, 12.6, 11, 10.4, 10.4, 10.4, 11.2, 12.4, 12.8, 13.2, 14, 14.8, 15.4, 16, 16.6]),
};

/** @type {(x: number) => number} 腰折線高度：肩稜與裙板下緣之間 42% 處 */
const creaseY = (x) => lerp(P.yE(x), P.yLow(x), 0.42);

/**
 * 半剖面 8 點：中央背脊（2 點）→ 谷 → 刻面艙頂內稜 → 艙頂外稜 → 肩稜 → 腰折線（往內收 2.2）→ 裙板下緣（往外回到 −1.2）
 * 艙頂內外稜、肩稜、腰折線都是銳利刻面稜線
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yF = P.yF(x);
  const yE = P.yE(x);
  const hw = P.hw(x);
  const yValley = Math.min(yC - 0.6, yF - 1.2);
  // 匕首鼻段（x 50 以後）側壁很矮，折線內收量跟著縮小
  const inset = lerp(2.2, 0.6, Math.min(1, Math.max(0, (x - 50) / 14)));
  return [
    [0, yC],
    [0.1 * hw, yC - 0.2],
    [0.3 * hw, yValley],
    [0.5 * hw, yF],
    [0.8 * hw, lerp(yF, yE, 0.35)],
    [hw, yE],
    [hw - inset, creaseY(x)],
    [hw - inset * 0.55, P.yLow(x)],
  ];
};

const STATIONS = buildStations(-64, 77, 1.5, profile);

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 側壁（肩稜以下，含折線下的裙板） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 2.6;

/**
 * 擋泥板頂面陶土色塊內距（正值 = 在色塊內）：艙頂內稜（0.5 半寬）到外稜（0.8 半寬）之間，x −60 → 46
 * @type {(x: number, z: number) => number}
 */
const podBandInset = (x, z) => Math.min(Math.abs(z) - 0.5 * P.hw(x), 0.8 * P.hw(x) - Math.abs(z), x + 60, 46 - x);

/** 回紋飾帶（收腰段裙板上的陶土飾帶）：前後端 */
const FRIEZE = { x0: -23, x1: 23 };

/**
 * 線段距離（膠囊）
 * @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number}
 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/**
 * 回紋（鉤形連續回紋，週期 4 單位、高 3 單位，線寬 0.6 單位）：u 沿帶、v 由帶下緣往上
 * @type {(u: number, v: number, unit: number) => number} 回傳距離（負值 = 線內）
 */
const meanderSd = (u, v, unit) => {
  const uu = u / unit;
  const vv = v / unit;
  const p = Math.floor(uu / 4) * 4;
  const lu = uu - p;
  /** @type {number[][]} 單一週期的折線（含相鄰週期的端點避免接縫斷線） */
  const segs = [
    [-4, 0, 8, 0],
    [3, 0, 3, 3],
    [3, 3, 1, 3],
    [1, 3, 1, 1],
    [1, 1, 2, 1],
    [-1, 0, -1, 3],
    [-1, 3, -3, 3],
    [7, 0, 7, 3],
    [7, 3, 5, 3],
    [5, 3, 5, 1],
    [5, 1, 6, 1],
  ];
  let d = Infinity;
  for (const [ax, ay, bx, by] of segs) {
    d = Math.min(d, segDist(lu, vv, ax, ay, bx, by));
  }
  return (d - 0.3) * unit;
};

/**
 * 鎖鏈（週期 6.4 mm）：正面環（長圓形環、線寬 0.6）與側立環（橫桿）交錯
 * @type {(u: number, v: number) => number} 回傳距離（負值 = 線內）
 */
const chainSd = (u, v) => {
  const lu = (((u % 6.4) + 6.4) % 6.4) - 3.2;
  const ring = Math.abs(Math.hypot(Math.max(Math.abs(lu) - 1.0, 0), v) - 1.3) - 0.3;
  const bar = Math.max(Math.abs(Math.abs(lu) - 3.2) - 1.3, Math.abs(v) - 0.35);
  return Math.min(ring, bar);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 黑釉（緞面）：黑繪陶的半光澤黑
  black: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.4 }),
  black2: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.4, side: THREE.DoubleSide }),
  // 背脊頂面霧面黑：掠射角不反成亮面
  deck: namedMaterial('shell-deck-dark-matte', { color: 0x141110, roughness: 0.85 }),
  // 陶土色（霧面）
  clay: namedMaterial('paint-terracotta-clay', { color: 0xa8502c, roughness: 0.7, clearcoat: 0.0 }),
  clay2: namedMaterial('paint-terracotta-clay', { color: 0xa8502c, roughness: 0.7, clearcoat: 0.0, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1412, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x141110, roughness: 0.7, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x0c0a0a, roughness: 0.9, side: THREE.DoubleSide }),
  // 深色煙燻座艙罩（幾乎不透明的黑色 PC，看不到座艙內的東西）
  glass: namedMaterial('pc-tint-black-smoke', { color: 0x120d0c, roughness: 0.08, specularIntensity: 0.5, transparent: true, opacity: 0.88, envMapIntensity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-dark', { color: 0x1a1412, roughness: 0.8, side: THREE.DoubleSide }),
  // 刻線、鎖鏈、描線：陶土色
  dClay: decalMaterial('decal-incised-clay', { color: 0xa8502c, roughness: 0.7 }),
  // 第三色青銅金：匕首鼻脊稜、速度線、尾翼、翼端閃電（名稱含 -brass → 金屬）
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb08d4a, metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide }),
  dBronze: decalMaterial('decal-bronze-leaf', { color: 0xb8954f, metalness: 0.75, roughness: 0.34 }),
  dBlack: decalMaterial('decal-figure-black', { color: 0x141110, roughness: 0.4 }),
  // 白色加彩細線（霧面礦物顏料）
  dWhite: decalMaterial('decal-added-white', { color: 0xeee6d6, roughness: 0.6 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 刃狀稜（實體件）：沿殼面一條直線（俯視 a → b）立起的三角斷面稜，高度 h 往終點收到 0.3，寬 w 往終點收窄；平面法線（刻面反光）
 * @type {(top: (x: number, z: number) => number, a: number[], b: number[], w: number, h: number, n?: number) => THREE.BufferGeometry}
 */
const ridgeStrip = (top, a, b, w, h, n = 10) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  // 俯視上垂直於稜線的方向
  const px = -dz / len;
  const pz = dx / len;
  /** @type {number[][][]} */
  const secs = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = lerp(a[0], b[0], t);
    const z = lerp(a[1], b[1], t);
    const ww = lerp(w, 0.15, t ** 1.4);
    const hh = lerp(h, 0.3, t ** 1.2);
    const y = top(x, z);
    secs.push([
      [x - px * ww, y - 0.6, z - pz * ww],
      [x, y + hh, z],
      [x + px * ww, y - 0.6, z + pz * ww],
    ]);
  }
  /** @type {number[]} */
  const pos = [];
  /** @type {(p: number[], q: number[], r: number[]) => void} */
  const tri = (p, q, r) => pos.push(...p, ...q, ...r);
  for (let i = 0; i < n; i++) {
    const A = secs[i];
    const B = secs[i + 1];
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      tri(A[k], B[k], B[k2]);
      tri(A[k], B[k2], A[k2]);
    }
  }
  const R = secs[0];
  const E = secs[n];
  tri(R[0], R[2], R[1]);
  tri(E[0], E[1], E[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** 座艙罩（深色煙燻，壓低拉長）：x 14 → −28 */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(14, -28, u);
      const halfW = i === 0 || i === n ? 2.2 : 9.6 * Math.sin(Math.PI * u ** 0.8) ** 0.45;
      const rise = 4.6 * Math.sin(Math.PI * u ** 0.75) ** 0.6;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {number[]} 匕首鼻兩側三條平行速度線的 z（等長、等寬，x 32 → 54） */
const SPEED_ZS = [4, 6.8, 9.6];
/** @type {number[]} 匕首鼻脊稜的起點與尖端 x */
const DAGGER_X = [40, 76.6];

/** @type {number} 尾翼板底面高度 */
const WING_Y = 40.2;
/** @type {number[][]} 尾翼平面（俯視 x, z）：前緣微後掠，後緣三個等長尖齒，翼端 ±46 */
const WING_PLAN = [
  [-51, -46],
  [-49.6, -22],
  [-49, 0],
  [-49.6, 22],
  [-51, 46],
  [-59.6, 46],
  [-66, 31],
  [-58, 15.5],
  [-66, 0],
  [-58, -15.5],
  [-66, -31],
  [-59.6, -46],
];
/** @type {number[][]} 翼端閃電（後視 (z, y) 多邊形，右側）：從翼端往上、往外折兩段的 Z 字閃電，前後厚 1.6，立在翼弦中段 */
const BOLT = [
  [38.6, 40.2],
  [46.4, 40.2],
  [43.6, 43.6],
  [47.6, 43.6],
  [42.6, 48.6],
  [44, 44.8],
  [40.4, 44.8],
];
/** @type {number} 翼端閃電所在的 x（翼弦中段） */
const BOLT_X = -55.2;

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-cerberus-trihead',
  name: '冥府三頭犬',
  style: 'myth',
  phase: 13,
  mythSeries: 'greek',
  mythTheme: 'cerberus',
  form: 'trispike-shovel',
  roof: 'canopy',
  wing: 'trifang-zigzag-plate',
  theme: '黑釉多面切削四驅車：從前輪往前伸成細長尖刺的匕首鼻（中線青銅金脊稜收尖到鼻尖），兩側三條等長平行的青銅金速度線；擋泥板頂面陶土色塊、白色加彩鑲邊，肩稜與腰折線上的陶土色描線；側面上層陶土色鎖鏈、收腰裙板上陶土飾帶的黑色回紋；壓低拉長的深色煙燻座艙罩；高車尾單柱撐起後緣三尖齒（俯視 W 形）的青銅金尾翼，兩端往上折成青銅金 Z 字閃電',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 0.6,
  step: 0.8,
  // 艙頂內稜（3）、外稜（4）、肩稜（5）、腰折線（6）是銳利刻面稜線
  hard: [3, 4, 5, 6],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  canopy: CANOPY,
  sideZMin: 26,
  zones: () => [
    // 收腰段裙板（腰折線以下）的陶土飾帶：回紋的底色，前後離輪拱 2 mm
    { mat: 'clay', keep: (x, y, z) => (onSide(x, z) ? Math.min(creaseY(x) - 0.4 - y, y - P.yLow(x) - 0.6, FRIEZE.x1 - x, x - FRIEZE.x0, archRingDist(x, y) - 2) : -1) },
    // 擋泥板頂面陶土色塊
    { mat: 'clay', keep: (x, y, z) => (onSide(x, z) ? -1 : podBandInset(x, z)) },
    // 左右色塊之間的頂面（背脊）霧面黑
    { mat: 'deck', keep: (x, y, z) => (onSide(x, z) ? -1 : 0.5 * P.hw(x) - Math.abs(z)) },
    { mat: 'black', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 匕首鼻脊稜（青銅金實體件）：中線一道三角斷面稜，從引擎蓋一路收尖到鼻尖 x 76.6 ──
    parts.push({ geometry: ridgeStrip(top, [DAGGER_X[0], 0], [DAGGER_X[1], 0], 1.8, 1.6, 16), mat: 'bronze', solid: true, outline: true, name: 'dagger-spine' });

    // ── 尾翼：後緣三尖齒的青銅金平板、中央黑色單柱、兩端往上折的青銅金 Z 字閃電 ──
    parts.push({ geometry: flatPlate(WING_PLAN, WING_Y, 1), mat: 'bronze', solid: true, outline: true, name: 'trifang-wing' });
    {
      /** @type {(x: number) => number} 中線殼面高度 */
      const deckY = (x) => top(x, 0);
      const pylon = finPlate(
        [
          [-51.6, deckY(-51.6) - 1],
          [-50.6, WING_Y + 0.6],
          [-57.4, WING_Y + 0.6],
          [-61.6, deckY(-61.6) - 1],
        ],
        0,
        2.4,
      );
      parts.push({ geometry: pylon, mat: 'black2', solid: true, outline: true, name: 'wing-pylon' });
    }
    {
      /** @type {THREE.BufferGeometry[]} */
      const bolts = [];
      for (const sg of [-1, 1]) {
        // finPlate 的 (x, y) 當成後視 (z, y)；繞 y 轉 −90° 後 x → z、厚度方向 → x
        const pts = sg > 0 ? BOLT : BOLT.map(([z, y]) => [-z, y]).reverse();
        const g = finPlate(pts, 0, 1.6);
        g.rotateY(-Math.PI / 2);
        g.translate(BOLT_X, 0, 0);
        bolts.push(g);
      }
      parts.push({ geometry: mergeGeos(bolts), mat: 'bronze', solid: true, outline: true, name: 'zigzag-bolt-tips' });
    }

    // 輪拱內襯（前後，R15.2）：每個角度的外緣取該高度的殼內面
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.4, profile))), mat: 'liner', shell: true, name: 'arch-liners' });

    // ── 貼紙（黑繪陶）──
    // 陶土色描線：肩稜下 0.5 mm 與腰折線上 0.5 mm 各一條（寬 0.7），整車長
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || archRingDist(x, y) < 0.8) {
          return -1;
        }
        return Math.max(0.35 - Math.abs(y - (P.yE(x) - 0.7)), 0.35 - Math.abs(y - (creaseY(x) + 0.7)));
      }, { offset: 0.1 }),
      mat: 'dClay',
      name: 'decal-crease-lines',
    });
    // 擋泥板頂面色塊兩側的白色加彩細線（離色塊 0.5 mm、寬 0.5 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) || x > 46 || x < -60 ? -1 : 0.25 - Math.abs(Math.min(Math.abs(z) - 0.5 * P.hw(x), 0.8 * P.hw(x) - Math.abs(z)) + 0.75)), { offset: 0.1 }),
      mat: 'dWhite',
      name: 'decal-pod-band-edges',
    });
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 26, side };
      // 回紋：收腰裙板陶土飾帶上的黑色鉤形回紋
      /** @type {(u: number, v: number) => number} */
      const frieze = (u, v) => {
        const x = side * u;
        if (x < FRIEZE.x0 + 0.6 || x > FRIEZE.x1 - 0.6 || archRingDist(x, v) < 2.6) {
          return 1;
        }
        const y0 = P.yLow(x) + 1.6;
        return meanderSd(u + 64, v - y0, 1.5);
      };
      parts.push({ geometry: kit.decal(sideDecal(frieze, opt), { offset: 0.1 }), mat: 'dBlack', name: `decal-meander-frieze-${side}` });
      // 鎖鏈：上層側壁（肩稜與腰折線之間）的陶土色鎖鏈，兩輪拱之間
      /** @type {(u: number, v: number) => number} */
      const chain = (u, v) => {
        const x = side * u;
        const yc = (P.yE(x) + creaseY(x)) / 2;
        return Math.max(chainSd(u, v - yc), Math.abs(x) - 22.4, 2.2 - archRingDist(x, v));
      };
      parts.push({ geometry: kit.decal(sideDecal(chain, opt), { offset: 0.12 }), mat: 'dClay', name: `decal-chain-${side}` });
    }
    // 匕首鼻兩側三條平行速度線（陶土色，等長、寬 1.2）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z) || x < 32 || x > 54) {
          return -1;
        }
        let d = -1;
        for (const zz of SPEED_ZS) {
          d = Math.max(d, 0.6 - Math.abs(Math.abs(z) - zz));
        }
        return d;
      }, { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-speed-lines',
    });
    // 尾燈：車尾一整條橫貫的細長紅燈條（不做成左右一對燈點）
    parts.push({ geometry: new THREE.BoxGeometry(0.8, 1.2, 36).translate(-64.2, 25.6, 0), mat: 'tail', solid: true, outline: true, name: 'lamp-tail' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，造型比例取自 shared/design/body-cerberus-trihead/fourview.png 與 fourview_trace.txt，縮到底盤尺寸）：殼長 141（−64 ~ 鼻尖 77），尾翼後緣 x −66；後刻面艙頂 36、中央背脊 34.8、座艙罩頂約 34.6、尾翼頂約 41.2、翼端閃電頂 48.6；寬：車尾 ±30、後擋泥板 ±42、收腰 ±30.6、前擋泥板 ±42、匕首鼻 x 52 ±17 → x 64 ±5.6；兩輪之間裙板下緣 10.4',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm）',
    ridges: '匕首鼻脊稜：ABS 三角斷面實體件，根部寬 3.6、高 1.6，往鼻尖收到 0.3（推估），x 40 → 76.6',
    wing: '尾翼：ABS 平板厚 1 mm（推估），y 40.2，翼展 92、後緣三尖齒 x −66；中央單柱厚 2.4；翼端 Z 字閃電厚 1.6，往上往外折兩段到 y 48.6',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

export const cerberusTriheadBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
