// 三頭犬（body-cerberus-trihead，神話組・希臘；LG1 F2 擋泥板肌肉型）：不做犬頭，用「三」的重複、冥府之門、鎖鏈與蛇尾的曲線表現。
// 「三」：三道往前刺的陶土色鼻脊刃——中央鼻樑一道、左右前擋泥板脊線各一道（刃尖略超出擋泥板前緣），三道刃的根部各一條餘燼色橫縫頭燈。
// 冥府之門：引擎蓋中央谷地是兩片陶土色門扉（黑框線、白色門釘），中線門縫透出餘燼色火光。
// 鎖鏈：收腰段側壁上緣一條陶土色鎖鏈（正面環與側立環交錯），下方是陶土飾帶上的黑色回紋。
// 蛇尾 → 尾翼：一條從座艙後方貼著背脊往後、在車尾以 S 形升起的陶土色帶狀翼柱，升到頂後往兩側展開成鏟形翼面（一體式尾翼）。
// 四輪擋泥板各自鼓起成肩 / 臀（前低後高），中段收腰，中央一條隆起的直脊（不是 V 形）；座艙罩在中段、壓低的暗紅煙燻罩。
// 設計：shared/design/body-cerberus-trihead/DESIGN.md（MYTH_RESEARCH G3–G5、G12：羅浮宮 E 701 卡厄瑞水罐、「三個犬頭、蛇尾」、黑繪技法）。
// 塗裝：黑繪陶的配色反過來用——半光澤黑釉為主色，陶土色（霧面）做線條、門扉、鼻脊刃與尾翼，白色加彩只點門釘，餘燼色自發光點綴；
// 不用 Black Saber 的黑＋紅灰＋金座艙組合，也沒有架高尾翼與端板；全為自創，不含任何文字或商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-65, -61, -55, -48, -40, -30, -18, -4, 10, 24, 34, 42, 50, 56, 62, 68, 72];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬：後擋泥板（臀）±43.8、收腰 ±27.5（x −18 ~ −4，側壁要蓋住底盤的電池座側桿；後擋泥板在 x −30 就收到 ±34.5，前擋泥板從 x 10 的 ±33 開始鼓出）、前擋泥板（肩）±44；前擋泥板在 x 44 後急收，只留中央鼻樑（±12 → ±4.5）往前伸
  hw: monoCurve(XS, [25, 34, 41.5, 43.6, 43.8, 34.5, 27.5, 27.5, 33, 41.5, 44, 43.6, 24, 12, 9.5, 7.2, 4.5]),
  // 中央直脊頂
  yC: monoCurve(XS, [26.5, 28, 29.6, 30.4, 30.6, 30.2, 29.6, 29.4, 29.6, 30.2, 30.8, 30.4, 28.4, 25.4, 22.6, 20.2, 18.6]),
  // 擋泥板拱頂（在 0.76 半寬處）：後輪 33、前輪 32.4（前低後高），都比中央脊高 → 四個角的量體
  yF: monoCurve(XS, [25, 28, 31.2, 32.9, 33, 31.6, 28.8, 28, 28.4, 30.6, 32.3, 32.4, 30.8, 25, 22, 19.6, 18.2]),
  // 肩線（拱頂外側銳利稜線）：擋泥板處高、收腰處低
  yE: monoCurve(XS, [22.5, 25, 28.6, 30.3, 30.4, 28.6, 24.6, 23.4, 24, 27.8, 29.9, 30, 28, 22.6, 20, 18.4, 17.4]),
  // 側壁下緣
  yLow: monoCurve(XS, [19, 17, 14.4, 13, 12.6, 12.5, 12.5, 12.5, 12.5, 12.5, 12.6, 13, 13.8, 14.6, 15.2, 15.6, 16]),
};

/**
 * 半剖面 8 點：中央直脊（3 點）→ 擋泥板拱頂（2 點）→ 肩稜（銳利）→ 側壁 → 側壁下緣（內收）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yF = P.yF(x);
  const yE = P.yE(x);
  const hw = P.hw(x);
  const yLow = P.yLow(x);
  const yValley = Math.min(yC - 1.1, yF - 0.4);
  return [
    [0, yC],
    [0.06 * hw, yC - 0.3],
    [0.14 * hw, yValley],
    [0.45 * hw, lerp(yValley, yF, 0.7)],
    [0.76 * hw, yF],
    [hw, yE],
    [hw, lerp(yE, yLow, 0.55)],
    [hw - 0.8, yLow],
  ];
};

const STATIONS = buildStations(-65, 72, 1.5, profile);

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 側壁（肩稜以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 0.3;

/** 回紋飾帶（收腰段側壁上的黑色回紋）：帶的上下緣高度 */
const FRIEZE = { y0: 14.2, y1: 19.2 };

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
 * 回紋（鉤形連續回紋，週期 4 單位、高 3 單位，線寬 0.6 單位）：u 沿帶、v 由帶下緣往上（單位 mm × scale）
 * 每個週期：底線全長＋往上的鉤（x+3 上到頂、往回 2 格、下 2 格、往前 1 格）
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

/** @type {{ x0: number, x1: number }} 冥府之門（引擎蓋中央谷地的兩片門扉）前後端 */
const GATE = { x0: 21, x1: 46 };
/**
 * 門扉內距：到門扉四邊的最小距離（正值 = 在門扉內）；每片門扉從中線旁 1.4 mm 到 0.29 半寬（谷地外緣），跟著擋泥板內緣往前收窄
 * @type {(x: number, z: number) => number}
 */
const gateInset = (x, z) => Math.min(x - GATE.x0, GATE.x1 - x, Math.abs(z) - 1.4, 0.29 * P.hw(x) - Math.abs(z));

/** @type {number} 鎖鏈中心高度（收腰段側壁，回紋飾帶上方） */
const CHAIN_Y = 21.6;
/**
 * 鎖鏈（週期 6.4 mm）：正面環（長圓形環 5.2 × 3.2、線寬 0.6）與側立環（橫桿 2.6 × 0.7）交錯，橫桿兩端穿進相鄰的環
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
  // 黑釉：黑繪陶的半光澤黑（緞面 roughness 0.56：roughness 0.3 的亮面在 Blender 會出現大片波浪反光），陶土色為霧面
  black: namedMaterial('paint-figure-black', { color: 0x141110, roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.4 }),
  clay: namedMaterial('paint-terracotta-clay', { color: 0xc0623a, roughness: 0.72, clearcoat: 0.0 }),
  clay2: namedMaterial('paint-terracotta-clay', { color: 0xc0623a, roughness: 0.72, clearcoat: 0.0, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1412, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x141110, roughness: 0.7, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x1a1412, roughness: 0.85, side: THREE.DoubleSide }),
  // 暗紅煙燻座艙罩（有色透明 PC：保留色相）
  glass: namedMaterial('pc-tint-garnet-smoke', { color: 0x5a1416, roughness: 0.06, specularIntensity: 0.6, transparent: true, opacity: 0.62, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-dark', { color: 0x1a1412, roughness: 0.8, side: THREE.DoubleSide }),
  // 刻線與鎖鏈：刻穿黑釉露出的陶土色
  dIncised: decalMaterial('decal-incised-clay', { color: 0xc0623a, roughness: 0.72 }),
  dBlack: decalMaterial('decal-figure-black', { color: 0x141110, roughness: 0.4 }),
  // 門釘：陶繪的白色加彩（霧面礦物顏料）
  dWhite: decalMaterial('decal-added-white', { color: 0xeee6d6, roughness: 0.6 }),
  // 門縫與頭燈：冥府餘燼色自發光（強度低，Blender 不過曝）
  dEmber: decalMaterial('decal-ember-glow', { color: 0xff7a2a, emissive: 0xd8501a, emissiveIntensity: 0.8, roughness: 0.4 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯（沿垂直側壁內側裁切，參考 zeppelin 的 buildHullLiner）：只取上半圈，擋住從輪拱看進去的殼內空腔與底盤空隙
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.12;
  const a1 = Math.PI - 0.12;
  const pos = [];
  /** @type {(t: number) => number} 該角度的側壁內面 z */
  const zIn = (t) => P.hw(arch.x + r * Math.cos(t)) - 1.2;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zIn(t0) - depth);
      const B = p(t1, zIn(t1) - depth);
      const C = p(t1, zIn(t1));
      const D = p(t0, zIn(t0));
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
};

/** 座艙罩（暗紅煙燻，收腰段正上方）：x 14 → −22 */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(14, -22, u);
      const halfW = i === 0 || i === n ? 2.2 : 9 * Math.sin(Math.PI * u ** 0.85) ** 0.55;
      const rise = 5.2 * Math.sin(Math.PI * u ** 0.7) ** 0.6;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {number[][]} 蛇尾翼的中心線（側視 S 形）：座艙後方貼著背脊往後，x −48 起往上彎，升到 39.6 後轉平 */
const TAIL_PATH = [
  [-18, 29.2, 0],
  [-30, 30.4, 0],
  [-42, 30.9, 0],
  [-48, 31.4, 0],
  [-53, 33.6, 0],
  [-56.5, 37.4, 0],
  [-60.5, 39.6, 0],
  [-67, 39.4, 0],
];
/**
 * 蛇尾翼斷面（扁橢圓）：翼柱段半寬 2.6 → 3.6，最後 22% 弧長往兩側展開到半寬 23（鏟形翼面），厚 1.8 → 1.2
 * @type {(t: number) => number[]}
 */
const tailRadius = (t) => {
  const flare = Math.max(0, (t - 0.78) / 0.22);
  return [t < 0.78 ? lerp(2.6, 3.6, t / 0.78) : lerp(3.6, 23, flare ** 0.8), lerp(0.9, 0.6, t)];
};

/** @type {number} 左右鼻脊刃的 z 位置（前擋泥板拱頂） */
const BLADE_Z = 33;

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-cerberus-trihead',
  name: '冥府三頭犬',
  style: 'myth',
  phase: 8,
  mythSeries: 'greek',
  mythTheme: 'cerberus',
  form: 'tri-ridge',
  roof: 'canopy',
  wing: 's-stem-spade',
  theme: '黑釉擋泥板肌肉車：三道往前刺的陶土色鼻脊刃（中央鼻樑與左右前擋泥板各一道）配三條餘燼色橫縫頭燈、引擎蓋中央兩片陶土色門扉與發光門縫（冥府之門）、收腰段側壁的陶土色鎖鏈與回紋飾帶；四輪擋泥板鼓成肩與臀、中段收腰、中央直脊；收腰上方壓低的暗紅煙燻座艙罩；從背脊以 S 形升起、頂端展開成鏟形翼面的陶土色蛇尾翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 0.8,
  // 肩稜（5）是銳利稜線
  hard: [5],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  canopy: CANOPY,
  sideZMin: 28,
  zones: () => [
    // 陶土飾帶：收腰段側壁下半（回紋的底色），前後離輪拱 2 mm
    { mat: 'clay', keep: (x, y, z) => (onSide(x, z) ? Math.min(FRIEZE.y1 + 0.5 - y, 22.6 - Math.abs(x), archRingDist(x, y) - 2) : -1) },
    // 冥府之門：兩片陶土色門扉
    { mat: 'clay', keep: (x, y, z) => (onSide(x, z) ? -1 : gateInset(x, z)) },
    // 其餘全部是黑釉
    { mat: 'black', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 三道鼻脊刃（實體件，厚 1.8）：根部埋進殼面 1 mm，後端最高（高出殼面 4.8 mm）、上緣一路斜降到刃尖 ──
    {
      /** @type {(x: number) => number} 前擋泥板拱頂的殼面高度 */
      const tf = (x) => kit.surf.topY(x, BLADE_Z);
      /** @type {number[][]} 左右刃：根部在前擋泥板拱頂（x 27 → 45），刃尖只比擋泥板前緣多伸 3 mm（x 50.4） */
      const side = [[27, tf(27) - 1], [28.4, tf(28.4) + 4.8], [43, tf(43) + 2.4], [50.4, 28.2], [49.8, 27], [45, tf(45) - 1.6], [36, tf(36) - 1]];
      /** @type {number[][]} 中央刃：沿鼻樑直脊（x 44 → 70.6） */
      const centre = [[44, P.yC(44) - 1], [45.4, P.yC(45.4) + 4.8], [70.6, P.yC(70.6) + 0.4], [70.6, P.yC(70.6) - 0.8], [57, P.yC(57) - 1]];
      parts.push({
        geometry: mergeGeos([finPlate(centre, 0, 1.8), finPlate(side, BLADE_Z, 1.8), finPlate(side, -BLADE_Z, 1.8)]),
        mat: 'clay2',
        solid: true,
        outline: true,
        name: 'tri-ridge-blades',
      });
    }

    // ── 蛇尾翼（大件）：扁橢圓斷面沿 S 形中心線掃掠，翼柱和鏟形翼面是同一件 ──
    parts.push({
      geometry: smoothNormals(sweepEllipse(TAIL_PATH, 30, tailRadius, 12)),
      mat: 'clay2',
      solid: true,
      outline: true,
      name: 'serpent-tail-wing',
    });

    // 輪拱內襯（前後，R15.2）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(a, 2.2))), mat: 'liner', shell: true, name: 'arch-liners' });

    // ── 貼紙（黑繪陶紋樣）──
    // 回紋飾帶：收腰段側壁陶土飾帶上的黑色鉤形回紋，帶上下各一條黑邊線
    /** @type {(u: number, v: number) => number} */
    const frieze = (u, v) => {
      if (archRingDist(u, v) < 2.4 || u > 22 || u < -22) {
        return 1;
      }
      const edgeLines = Math.min(Math.abs(v - FRIEZE.y0 + 0.2), Math.abs(v - FRIEZE.y1 - 0.2)) - 0.3;
      const key = v > FRIEZE.y0 + 0.4 && v < FRIEZE.y1 - 0.4 ? meanderSd(u + 64, v - (FRIEZE.y0 + 0.9), 1.05) : 1;
      return Math.min(edgeLines, key);
    };
    /** @type {(u: number, v: number) => number} 鎖鏈：飾帶上方、兩個輪拱之間 */
    const chain = (u, v) => Math.max(chainSd(u, v - CHAIN_Y), Math.abs(u) - 22.4, 2.2 - archRingDist(u, v));
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 26, side };
      parts.push({ geometry: kit.decal(sideDecal((u, v) => frieze(side * u, v), opt), { offset: 0.1 }), mat: 'dBlack', name: `decal-meander-frieze-${side}` });
      parts.push({ geometry: kit.decal(sideDecal(chain, opt), { offset: 0.12 }), mat: 'dIncised', name: `decal-chain-${side}` });
    }
    // 刻線：擋泥板量體內緣一道陶土色細線（黑繪陶的刻線，讓四個角的量體輪廓清楚）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z) || x > 54) {
          return -1;
        }
        return 0.32 - Math.abs(Math.abs(z) - 0.34 * P.hw(x) - 0.5);
      }, { offset: 0.1 }),
      mat: 'dIncised',
      name: 'decal-incised-fender-line',
    });
    // 冥府之門：門扉內縮 1.2 mm 的黑框線、每片門扉 2 排白色門釘、中線門縫的餘燼色火光
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? -1 : 0.28 - Math.abs(gateInset(x, z) - 1.2)), { offset: 0.1 }),
      mat: 'dBlack',
      name: 'decal-gate-frame',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z) || gateInset(x, z) < 2.1) {
          return -1;
        }
        const dx = Math.abs((((x - 26) % 5) + 5) % 5 - 2.5) - 2.5;
        const az = Math.abs(z);
        return 0.55 - Math.hypot(dx, Math.min(Math.abs(az - 4.4), Math.abs(az - 8)));
      }, { offset: 0.14 }),
      mat: 'dWhite',
      name: 'decal-gate-studs',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.6 - Math.abs(z), x - GATE.x0 + 0.5, GATE.x1 + 0.5 - x), { offset: 0.14 }),
      mat: 'dEmber',
      name: 'decal-gate-ember-seam',
    });
    // 三條餘燼色橫縫頭燈：三道鼻脊刃的根部各一條（中央鼻樑 x 64、左右前擋泥板前緣 x 45.4），寬 1.4 mm
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z)) {
          return -1;
        }
        const az = Math.abs(z);
        const hw = P.hw(x);
        const nose = Math.min(0.7 - Math.abs(x - 64), 0.62 * hw - az, az - 1.2);
        const fender = Math.min(0.7 - Math.abs(x - 45.4), az - 0.45 * hw, 0.9 * hw - az);
        return Math.max(nose, fender);
      }, { offset: 0.14 }),
      mat: 'dEmber',
      name: 'decal-ember-slit-lamps',
    });
    // 尾燈：車尾左右一對細長紅燈（貼在尾端封口上方）
    {
      /** @type {THREE.BufferGeometry[]} */
      const lamps = [];
      for (const sg of [-1, 1]) {
        const l = new THREE.BoxGeometry(0.8, 1.4, 9);
        l.translate(-64.9, 22.4, sg * 13);
        lamps.push(l);
      }
      parts.push({ geometry: mergeGeos(lamps), mat: 'tail', solid: true, name: 'lamp-tail' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：殼長 137（−65 ~ 鼻尖 72），含蛇尾翼後緣（−67）的外框長約 139；擋泥板拱頂後 33 / 前 32.4、中央直脊 30.8、座艙罩頂約 34.5、蛇尾翼頂約 40.3；寬：臀 ±43.8、肩 ±44、收腰 ±27.5',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm）',
    blades: '三道鼻脊刃：ABS 實心立板（厚 1.8 mm，推估），中央刃沿鼻樑 x 44 → 70.6（高 4.8 → 0.4），左右刃根部在前擋泥板拱頂 x 27 → 45、刃尖到 x 50.4',
    tail: '蛇尾翼：ABS 扁橢圓斷面實體件（翼柱 5.2 × 1.8 → 7.2 × 1.3，鏟形翼面翼展 46、厚 1.2，推估），中心線側視 S 形：貼背脊 y 30.4–31.4 → 升到 39.6',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

export const cerberusTriheadBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
