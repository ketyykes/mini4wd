// 米諾陶洛斯（body-minotaur-maze，神話組・希臘）：照四視圖 18 的「三層階梯鼻、大型多面座艙罩、高車尾、單柱牛角新月尾翼」建模；車上沒有牛的頭、臉、眼、鼻孔、鼻環。
// 牛角 → 尾翼：一片加粗的金色新月形尾翼，中央最低、兩端往上翹並往前彎（後視、俯視都是新月），單柱撐在車尾中線，整片高過座艙罩頂。
// 迷宮 → 階梯鼻與紋樣：楔形鼻上疊三層同心梯形階梯（正視三圈梯形、側視三階，一圈比一圈小），頂面陶土橘、側面與正面奶油白；座艙罩正前方一道橫向細線迷宮帶；
// 座艙罩後方到車尾的背脊上一整條壁畫藍底奶油白回紋帶；側面下半是壁畫藍板塊，板塊上奶油白連續回紋帶，上緣一條金色阿里阿德涅之線。
// 設計：shared/design/body-minotaur-maze/DESIGN.md（MYTH_RESEARCH G6、G9、G10、G12、G13）。剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
// 塗裝：陶土橘（霧面）為主色，克諾索斯壁畫藍（緞面）做側面下半，奶油白做回紋與描線，金色做尾翼與細線。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { buildProfileLiner } from './khepriScarab.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40；殼面鼻端是平順的楔形，三層階梯另外疊在上面） */
const XS = [-64, -58, -52, -46, -38, -28, -16, -4, 8, 20, 30, 40, 46, 52, 58, 62, 66];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬：前寬後窄——前擋泥板是 ±42.8 的寬肩，x 46 之後收成 ±22.6 → ±11.5 → ±8 的楔形尖鼻；座艙段深收腰 ±26.5、後擋泥板只到 ±30.6（俯視後輪露在車身外）、車尾收窄到 ±21；新月尾翼翼端伸到 ±44，比車尾寬
  hw: monoCurve(XS, [21, 23, 27, 30.6, 30.5, 27, 26.5, 27, 37.5, 41, 42.4, 42.8, 41.6, 22.6, 11.5, 11.5, 8]),
  // 中央頂線：車尾高，往前平順降到鼻端 19
  yC: monoCurve(XS, [33.4, 35.2, 35.8, 35.6, 35, 34.4, 33.6, 32.8, 31.6, 30.4, 29.4, 28.6, 27.6, 25, 22, 20.2, 19]),
  // 擋泥板肩（0.55 半寬）：前擋泥板比引擎蓋高
  yF: monoCurve(XS, [34, 36.2, 36.8, 36.4, 35.4, 33, 29.4, 28.4, 29.2, 31, 31.6, 31.4, 30.2, 26.8, 23, 21, 19.8]),
  // 肩稜（最寬處）
  yE: monoCurve(XS, [30, 32.6, 33, 32.6, 31.6, 29, 25, 24, 24.8, 27, 28, 27.8, 27, 24.6, 21.8, 20.2, 19]),
  // 側壁下緣
  yLow: monoCurve(XS, [16.4, 14.6, 13.6, 13, 12.9, 12.7, 12.5, 12.5, 12.5, 12.5, 12.6, 13, 13.4, 13.6, 14.2, 14.6, 15]),
};

/**
 * 半剖面 7 點：中央頂（2 點）→ 引擎蓋平台 → 擋泥板肩稜 → 外側斜面 → 肩稜 → 側壁下緣（內收）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const yF = P.yF(x);
  const yE = P.yE(x);
  const hw = P.hw(x);
  return [
    [0, yC],
    [0.12 * hw, yC - 0.15],
    [0.36 * hw, Math.min(yC - 0.4, yF - 0.6)],
    [0.55 * hw, yF],
    [0.8 * hw, lerp(yF, yE, 0.4)],
    [hw, yE],
    [hw - 0.8, P.yLow(x)],
  ];
};

const STATIONS = buildStations(-64, 66, 1.5, profile);

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 側壁（肩稜以下，含往內收 0.8 的下緣） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 1.6;

/**
 * 側面壁畫藍板塊的上緣高度：鼻端 17.6、收腰段 22，從 x −14 往車尾斜升到 29.4（四視圖 18 從收腰斜升到車尾的色塊）
 * @type {(x: number) => number}
 */
const splitY = (x) => {
  if (x > 26) {
    return lerp(22, 17.6, Math.min(1, (x - 26) / 48));
  }
  if (x > -14) {
    return 22;
  }
  return lerp(22, 29.4, Math.min(1, (-14 - x) / 52));
};

/**
 * 線段距離
 * @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number}
 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** @type {number} 回紋格距 */
const KEY_G = 1.2;
/** @type {number} 回紋一單元長度 */
const KEY_P = 4.6 * KEY_G;
/** @type {number} 回紋帶下緣高度 */
const KEY_Y0 = 15;
/** @type {number} 回紋線寬 */
const KEY_W = 0.7;

/**
 * 連續回紋（方折螺旋鉤，掛在下邊線上；上邊線另一條）：每單元 (0,0)→(0,3)→(3,3)→(3,1)→(1.5,1)→(1.5,2)
 * @type {(u: number, v: number) => number} 到回紋線的距離（減半線寬）
 */
const greekKey = (u, v) => {
  const g = KEY_G;
  const y = v - KEY_Y0;
  let d = Math.min(Math.abs(y + 0.9), Math.abs(y - 4 * g));
  const k = Math.floor(u / KEY_P);
  for (const kk of [k - 1, k, k + 1]) {
    const u0 = kk * KEY_P;
    /** @type {number[][]} */
    const pts = [
      [0, -0.9],
      [0, 3 * g],
      [3 * g, 3 * g],
      [3 * g, 1 * g],
      [1.5 * g, 1 * g],
      [1.5 * g, 2 * g],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      d = Math.min(d, segDist(u - u0, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    }
  }
  return d - KEY_W / 2;
};

/**
 * 三層階梯鼻（實體件，疊在殼面鼻端上）：每層的後端 x、前端 x、後端半寬、前端半寬、色；每層高 1.5，後端 10 mm 斜升接進引擎蓋
 * 頂面陶土橘，側面與正面奶油白：正視三圈同心梯形、側視三階，一圈比一圈小（迷宮的方折迴圈）
 * @type {{ xr: number, xf: number, wr: number, wf: number, mat: string }[]}
 */
const TIERS = [
  { xr: 34, xf: 65.4, wr: 16, wf: 7.6, mat: 'clay' },
  { xr: 36, xf: 60, wr: 12, wf: 6.2, mat: 'clay' },
  { xr: 38, xf: 54.4, wr: 8, wf: 4, mat: 'clay' },
];
/** @type {number} 每層高度 */
const TIER_H = 1.5;

/** @type {{ x0: number, hz: number }} 座艙罩前方橫向迷宮帶：帶後緣 x、半寬（線性回紋沿 z 走） */
const MAZE = { x0: 17, hz: 14.4 };

/** @type {{ x0: number, x1: number, hz: number }} 背脊回紋帶：前後端與半寬（座艙罩後緣到車尾） */
const SPINE = { x0: -64, x1: -27, hz: 4.2 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 陶土橘（霧面）：主色
  clay: namedMaterial('paint-terracotta-clay', { color: 0xc4652f, roughness: 0.7, clearcoat: 0.04 }),
  // 克諾索斯壁畫藍（緞面）：側面下半
  blue: namedMaterial('paint-fresco-blue', { color: 0x2e5b85, roughness: 0.48, clearcoat: 0.2, clearcoatRoughness: 0.35 }),
  // 階梯鼻的側面與正面：奶油白
  cream2: namedMaterial('paint-fresco-cream', { color: 0xefe4c8, roughness: 0.55, side: THREE.DoubleSide }),
  black2: namedMaterial('paint-slip-black', { color: 0x1b1817, roughness: 0.52, clearcoat: 0.15, clearcoatRoughness: 0.4, side: THREE.DoubleSide }),
  // 牛角新月尾翼：金
  gold: namedMaterial('trim-horn-brass', { color: 0xd2a23c, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }),
  // 尾翼頂面的陶土色新月條
  clay2: namedMaterial('paint-terracotta-clay', { color: 0xc4652f, roughness: 0.7, clearcoat: 0.04, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x14100e, roughness: 0.9, side: THREE.DoubleSide }),
  // 大型多面座艙罩：深茶色煙燻 PC
  glass: namedMaterial('pc-tint-umber-smoke', { color: 0x2a1c14, roughness: 0.06, specularIntensity: 0.6, transparent: true, opacity: 0.84, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1716, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x1b1817, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-umber', { color: 0x2a201b, roughness: 0.8, side: THREE.DoubleSide }),
  dCream: decalMaterial('decal-fresco-cream', { color: 0xefe4c8, roughness: 0.6 }),
  // 迷宮紋的底色：克諾索斯壁畫藍
  dBlue: decalMaterial('decal-fresco-blue', { color: 0x2e5b85, roughness: 0.5 }),
  // 阿里阿德涅之線：微微發光的金線
  dThread: decalMaterial('decal-ariadne-glow', { color: 0xf2c24e, emissive: 0xffb428, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.4 }),
  lamp: namedMaterial('lamp-warm-white', { color: 0xfff1d0, emissive: 0xffe2a0, emissiveIntensity: 0.7, roughness: 0.15 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** 大型多面座艙罩（梯形剖面：平頂＋兩側斜窗，銳利稜線）：x 16 → −28，尖頭、最高點在 x −8 */
const CANOPY = {
  section: 'trapezoid',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(16, -28, u);
      const halfW = i === 0 || i === n ? 1.6 : 12.4 * Math.sin(Math.PI * u ** 0.85) ** 0.5;
      const rise = 5 * Math.sin(Math.PI * u ** 0.62) ** 0.55;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {{ xMid: number, yMid: number, span: number, sweep: number, lift: number }} 新月尾翼：中央 (x, y)、半翼展、翼端往前彎的量、翼端上翹的量 */
const HORN = { xMid: -61, yMid: 41.2, span: 44, sweep: 8, lift: 5.6 };
/** @type {(s: number) => number[]} 新月尾翼中心線（s = −1 ~ 1，左翼端 → 右翼端） */
const hornPoint = (s) => [HORN.xMid + HORN.sweep * s * s, HORN.yMid + HORN.lift * Math.abs(s) ** 2.2, HORN.span * s];
/** @type {number[][]} 新月尾翼中心線取樣 */
const HORN_PATH = Array.from({ length: 11 }, (_, i) => hornPoint(-1 + (2 * i) / 10));

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-minotaur-maze',
  name: '米諾陶洛斯迷宮',
  style: 'myth',
  phase: 13,
  mythSeries: 'greek',
  mythTheme: 'minotaur',
  form: 'stepped-labyrinth-nose',
  roof: 'canopy',
  wing: 'horn-crescent-mono',
  theme: '陶土橘＋壁畫藍雙色四驅車：±42.8 的寬肩前擋泥板、疊在楔形鼻上的三層同心梯形階梯（頂面陶土橘、側面與正面奶油白，一圈比一圈小）、座艙罩正前方的壁畫藍底奶油白橫向迷宮帶、大型梯形剖面深茶色座艙罩、窄而高的車尾（俯視後輪外露）；擋泥板肩稜上奶油白描線，座艙罩後方到車尾的背脊一整條壁畫藍底奶油白回紋帶；側面下半壁畫藍板塊從收腰往車尾斜升，板塊上奶油白連續回紋帶，上緣一條發光金線（阿里阿德涅之線）；車尾單柱撐起加粗的金色牛角新月尾翼，高過座艙罩頂，中央最低、兩端上翹前彎，頂面一道陶土色新月條',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 0.8,
  step: 0.8,
  // 擋泥板肩稜（3）、肩稜（5）是銳利稜線
  hard: [3, 5],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  canopy: CANOPY,
  sideZMin: 21,
  zones: () => [
    // 側面下半壁畫藍板塊
    { mat: 'blue', keep: (x, y, z) => (onSide(x, z) ? splitY(x) - y : -1) },
    { mat: 'clay', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'clay', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 牛角新月尾翼（金）：扁橢圓斷面沿新月中心線掃掠，弦長中央 24 → 翼端 2.4、厚 2.2 → 1.0 ──
    /** @type {(t: number) => number} 從中央到翼端的比例（0 中央、1 翼端） */
    const fromMid = (t) => Math.abs(2 * t - 1);
    parts.push({
      geometry: smoothNormals(sweepEllipse(HORN_PATH, 32, (t) => [lerp(12, 1.2, fromMid(t) ** 1.25), lerp(1.1, 0.5, fromMid(t))], 10)),
      mat: 'gold',
      solid: true,
      outline: true,
      name: 'horn-crescent-wing',
    });
    // 頂面一道陶土色新月條（弦長約 1/3、貼在翼頂）
    parts.push({
      geometry: smoothNormals(
        sweepEllipse(
          HORN_PATH.map(([x, y, z]) => [x, y + 0.8, z]),
          32,
          (t) => [lerp(3.6, 0.4, fromMid(t) ** 1.25), 0.4],
          8,
        ),
      ),
      mat: 'clay2',
      solid: true,
      name: 'horn-crescent-stripe',
    });
    // 中央單柱（黑，厚 2.4）：從車尾殼面升到翼底
    {
      /** @type {(x: number) => number} 中線殼面高度 */
      const deckY = (x) => kit.surf.topY(x, 0);
      const pylon = finPlate(
        [
          [-53.6, deckY(-53.6) - 1],
          [-56.4, HORN.yMid + 0.4],
          [-64.4, HORN.yMid + 0.4],
          [-63.4, deckY(-63.4) - 1],
        ],
        0,
        2.4,
      );
      parts.push({ geometry: pylon, mat: 'black2', solid: true, name: 'horn-wing-pylon' });
    }

    // ── 三層階梯鼻：每層一片 0.8 mm 殼板（頂面、兩側、正面；奶油白，側面與正面露出白邊），頂面另貼一層陶土橘色片（裝飾，浮 0.05 mm）──
    {
      /** @type {(arr: number[]) => THREE.BufferGeometry} 三角形頂點陣列 → 平面法線幾何 */
      const geo = (arr) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        g.computeVertexNormals();
        return g;
      };
      /** @type {(arr: number[], a: number[], b: number[], c: number[], d: number[]) => void} 四邊形拆兩個三角形 */
      const quad = (arr, a, b, c, d) => arr.push(...a, ...b, ...c, ...a, ...c, ...d);
      /** @type {THREE.BufferGeometry[]} */
      const solids = [];
      /** @type {Record<string, number[]>} 各色頂面色片 */
      const tops = { clay: [] };
      TIERS.forEach((t, i) => {
        const n = 16;
        /** @type {number[][][]} 每個斷面 [左下, 左上, 右上, 右下] */
        const secs = [];
        for (let k = 0; k <= n; k++) {
          const x = lerp(t.xr, t.xf, k / n);
          const w = lerp(t.wr, t.wf, k / n);
          const ramp = Math.min(1, (x - t.xr) / 10);
          const base = Math.max(kit.surf.topY(x, 0), kit.surf.topY(x, w));
          const yTop = base - 0.2 + (TIER_H * (i + 1) + 0.2) * ramp;
          // 下緣埋到下一層頂面（或殼面）以下 1 mm
          const yBot = Math.min(kit.surf.topY(x, w + 0.6), base) - 1 + TIER_H * i * ramp;
          secs.push([
            [x, yBot, -(w + 0.5)],
            [x, yTop, -w],
            [x, yTop, w],
            [x, yBot, w + 0.5],
          ]);
        }
        /** @type {number[]} */
        const arr = [];
        for (let k = 0; k < n; k++) {
          const A = secs[k];
          const B = secs[k + 1];
          // 左側、頂面、右側（底面埋在殼內，不做）
          for (let j = 0; j < 3; j++) {
            quad(arr, A[j], A[j + 1], B[j + 1], B[j]);
          }
          /** @type {(p: number[]) => number[]} 頂面色片往上浮 0.05 mm */
          const lift = (p) => [p[0], p[1] + 0.05, p[2]];
          quad(tops[t.mat], lift(A[1]), lift(A[2]), lift(B[2]), lift(B[1]));
        }
        const F = secs[n];
        quad(arr, F[0], F[1], F[2], F[3]);
        solids.push(geo(arr));
      });
      parts.push({ geometry: mergeGeos(solids), mat: 'cream2', shell: true, outline: true, name: 'nose-steps' });
      parts.push({ geometry: geo(tops.clay), mat: 'clay2', name: 'nose-step-tops-clay' });
    }

    // 輪拱內襯（前後，R15.2）：每個角度的外緣取該高度的殼內面，不會從擋泥板頂冒出來
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.4, profile))), mat: 'liner', shell: true, name: 'arch-liners' });

    // ── 貼紙 ──
    // 座艙罩正前方一道橫向細線迷宮帶：壁畫藍底條上的奶油白連續回紋（沿 z 走，帶寬約 5.7）
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? -1 : Math.min(MAZE.hz + 0.8 - Math.abs(z), x - MAZE.x0 + 0.6, MAZE.x0 + 6.3 - x)), { offset: 0.08 }),
      mat: 'dBlue',
      name: 'decal-maze-band-ground',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) || Math.abs(z) > MAZE.hz ? -1 : -greekKey(z + MAZE.hz, x - MAZE.x0 + KEY_Y0 + 0.9)), { offset: 0.12 }),
      mat: 'dCream',
      name: 'decal-maze-band',
    });
    // 擋泥板肩稜（0.55 半寬的銳利稜線）上一道奶油白描線（寬 0.7），從鼻端第一階走到車尾
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) || x > 50.4 || x < -62 ? -1 : 0.35 - Math.abs(Math.abs(z) - 0.55 * P.hw(x))), { offset: 0.1 }),
      mat: 'dCream',
      name: 'decal-shoulder-lines',
    });
    // 背脊回紋帶：壁畫藍底（寬 8.4）上的奶油白連續回紋（含上下邊線），從座艙罩後緣到車尾
    parts.push({
      geometry: kit.decal((x, y, z) => (x > SPINE.x0 && x < SPINE.x1 ? SPINE.hz - Math.abs(z) : -1), { offset: 0.1 }),
      mat: 'dBlue',
      name: 'decal-spine-band',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x <= SPINE.x0 || x >= SPINE.x1 || Math.abs(z) > SPINE.hz) {
          return -1;
        }
        // 回紋帶的上下邊線在 v = −0.9 與 4.8，中心 1.95 對齊車身中線
        return -greekKey(x, z + KEY_Y0 + 1.95);
      }, { offset: 0.12 }),
      mat: 'dCream',
      name: 'decal-spine-key',
    });
    // 側裙回紋帶（奶油白，壁畫藍底上）：兩輪拱之間
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 21, side };
      /** @type {(u: number, v: number) => number} */
      const key = (u, v) => Math.max(greekKey(u + 60, v), 2.2 - archRingDist(side * u, v), Math.abs(u) - 22.6);
      parts.push({ geometry: kit.decal(sideDecal(key, opt), { offset: 0.1 }), mat: 'dCream', name: `decal-greek-key-${side}` });
    }
    // 阿里阿德涅之線：沿壁畫藍板塊上緣上方 1.1 mm 的金線（寬 1.1），避開輪拱
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? Math.min(0.55 - Math.abs(y - splitY(x) - 1.1), archRingDist(x, y) - 1) : -1), { offset: 0.12 }),
      mat: 'dThread',
      name: 'decal-ariadne-thread',
    });
    // 頭燈：鼻端一整條橫向燈條（單一條，不做成一對燈眼）
    parts.push({ geometry: new THREE.BoxGeometry(0.8, 1, 13).translate(66.2, 17.6, 0), mat: 'lamp', solid: true, outline: true, name: 'lamp-head-bar' });
    // 尾燈：車尾一整條橫貫的細長紅燈條（不做成左右一對燈點）
    parts.push({ geometry: new THREE.BoxGeometry(0.8, 1.2, 30).translate(-64.2, 27, 0), mat: 'tail', solid: true, outline: true, name: 'lamp-tail' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，造型比例取自 shared/design/body-minotaur-maze/fourview.png 與 fourview_trace.txt，縮到底盤尺寸）：殼長 130（−64 ~ 鼻端 66）；鼻端楔形中線 27.6 → 19，上面疊三層階梯（每層高 1.5，前端 x 65.4 / 60 / 54.4、後端半寬 16 / 12 / 8）、中央頂 35.8、座艙罩頂約 37.8、新月尾翼中央 41.2 → 翼端約 46.8；寬：前擋泥板 ±42.8、收腰 ±26.5、後擋泥板 ±30.6、車尾 ±21、鼻端 ±8；新月尾翼 ±44',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm）',
    wing: '新月尾翼：ABS 扁橢圓斷面實體件（弦長 24 → 2.4、厚 2.2 → 1.0，推估），半翼展 44、翼端前彎 8、上翹 5.6；中央單柱厚 2.4',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

export const minotaurMazeBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
