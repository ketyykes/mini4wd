// 米諾陶洛斯（body-minotaur-maze，神話組・希臘）：照四視圖 18 的「三層階梯鼻、大型多面座艙罩、高車尾、單柱牛角新月尾翼」建模；車上沒有牛的頭、臉、眼、鼻孔、鼻環。
// 牛角 → 尾翼：一支粗壯的金色牛角（克諾索斯「聖角」的 U 形）橫在車尾後方，中段平、外段急翹成兩支尖角，角根兩道黑色環箍；後掠單柱撐在車尾中線，角尖高過座艙罩頂。
// 迷宮 → 階梯鼻與紋樣：楔形鼻上疊三層同心梯形階梯（正視三圈梯形、側視三階，一圈比一圈小），頂面陶土橘、側面與正面奶油白；座艙罩正前方一道橫向細線迷宮帶；
// 座艙罩後方到車尾的背脊上一整條黑釉底陶土色回紋帶；引擎蓋與後甲板外側斜面各一段黑釉紋樣帶，帶內一列金色雙斧（labrys）；側面下半是亮面黑釉板塊，板塊上陶土色連續回紋帶，上緣一條金色阿里阿德涅之線。
// 設計：shared/design/body-minotaur-maze/DESIGN.md（MYTH_RESEARCH G6、G9、G10、G12、G13）。剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
// 塗裝：陶土橘（半光澤釉面）為主色，黑釉（黑繪陶）做側面下半與紋樣帶，陶土色做黑釉上的留白紋樣，奶油白做階梯側面與描線，金色做牛角與雙斧。
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
  // 半寬：前寬後窄——前擋泥板是 ±42.6 的寬肩，x 46 之後收成 ±15 → ±9.5 的楔形短鼻；收腰 ±31、後擋泥板只到 ±30.6（俯視後輪露在車身外）、車尾 ±25；新月尾翼翼端伸到 ±44，比車尾寬
  hw: monoCurve(XS, [25, 27.4, 30, 30.5, 30.6, 31, 31, 31.4, 36.5, 39.6, 41.6, 42.6, 41, 26, 15, 11.5, 9.5]),
  // 中央頂線：車尾高，往前平順降到鼻端 19
  yC: monoCurve(XS, [33.4, 35.2, 35.8, 35.6, 35, 34.4, 33.6, 32.8, 31.6, 30.4, 29.4, 28.6, 27.6, 25, 22, 20.2, 19]),
  // 擋泥板肩（0.55 半寬）：前擋泥板比引擎蓋高
  yF: monoCurve(XS, [33.2, 35.2, 35.8, 35.6, 35, 33, 29.4, 28.4, 29.2, 31, 31.6, 31.4, 30.2, 26.8, 23, 21, 19.8]),
  // 肩稜（最寬處）
  yE: monoCurve(XS, [29.2, 31.6, 32, 31.8, 31.2, 29, 25, 24, 24.8, 27, 28, 27.8, 27, 24.6, 21.8, 20.2, 19]),
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

/**
 * 雙斧（labrys）：中央一支柄（沿 b 方向），兩側各一片外緣呈弧形的斧刃（沿 a 方向張開），單位 k
 * @type {(a: number, b: number, k: number) => number} 回傳距離（負值 = 圖形內）
 */
const labrysSd = (a, b, k) => {
  const ua = Math.abs(a) / k;
  const ub = b / k;
  // 柄：寬 0.5、長 7
  const handle = Math.max(ua - 0.25, Math.abs(ub) - 3.5);
  // 斧刃：從柄往外 0.5 → 3，半高從 0.7 張到 2.2，外緣是以柄為圓心半徑 3 的弧
  const t = Math.min(1, Math.max(0, (ua - 0.5) / 2.5));
  const blade = Math.max(0.5 - ua, Math.abs(ub) - lerp(0.7, 2.2, t), Math.hypot(ua, ub * 0.55) - 3);
  return Math.min(handle, blade) * k;
};
/** @type {{ x0: number, x1: number, xs: number[], k: number }[]} 引擎蓋／後甲板外側斜面的黑釉紋樣帶：前後端、帶內雙斧的 x、雙斧單位 */
const LABRYS_BANDS = [
  { x0: 1, x1: 35, xs: [7, 18, 29], k: 1.3 },
  { x0: -58, x1: -31, xs: [-52, -43.5, -35], k: 1.05 },
];

/** @type {{ x0: number, hz: number }} 座艙罩前方橫向迷宮帶：帶後緣 x、半寬（線性回紋沿 z 走） */
const MAZE = { x0: 17, hz: 14.4 };

/** @type {{ x0: number, x1: number, hz: number }} 背脊回紋帶：前後端與半寬（座艙罩後緣到車尾） */
const SPINE = { x0: -64, x1: -27, hz: 4.2 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 陶土橘（半光澤釉面）：主色
  clay: namedMaterial('paint-terracotta-clay', { color: 0xc8662e, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.3 }),
  // 黑釉（亮面）：側面下半，黑繪陶的光亮黑釉
  glaze: namedMaterial('paint-slip-black-gloss', { color: 0x161312, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
  // 階梯鼻的側面與正面：奶油白
  cream2: namedMaterial('paint-fresco-cream', { color: 0xefe4c8, roughness: 0.55, side: THREE.DoubleSide }),
  black2: namedMaterial('paint-slip-black', { color: 0x1b1817, roughness: 0.52, clearcoat: 0.15, clearcoatRoughness: 0.4, side: THREE.DoubleSide }),
  // 牛角新月尾翼：金
  gold: namedMaterial('trim-horn-brass', { color: 0xd2a23c, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }),
  // 尾翼頂面的陶土色新月條
  clay2: namedMaterial('paint-terracotta-clay', { color: 0xc8662e, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.3, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x14100e, roughness: 0.9, side: THREE.DoubleSide }),
  // 大型多面座艙罩：深茶色煙燻 PC
  glass: namedMaterial('pc-tint-umber-smoke', { color: 0x2a1c14, roughness: 0.06, specularIntensity: 0.6, transparent: true, opacity: 0.84, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1716, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x1b1817, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-umber', { color: 0x2a201b, roughness: 0.8, side: THREE.DoubleSide }),
  dCream: decalMaterial('decal-fresco-cream', { color: 0xefe4c8, roughness: 0.6 }),
  dBlack: decalMaterial('decal-slip-black', { color: 0x1b1918, roughness: 0.5 }),
  // 黑釉底上的陶土色紋樣（留白的陶土）
  dClay: decalMaterial('decal-reserved-clay', { color: 0xd8773a, roughness: 0.45 }),
  // 金色雙斧
  dGold: decalMaterial('decal-labrys-gold', { color: 0xe0b04a, metalness: 0.8, roughness: 0.3 }),
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

/** @type {{ xMid: number, yMid: number, span: number, sweep: number, lift: number }} 牛角尾翼：中央 (x, y)、半翼展、角尖往前彎的量、角尖上翹的量 */
const HORN = { xMid: -66, yMid: 37.4, span: 45, sweep: 6, lift: 10.6 };
/** @type {(s: number) => number[]} 牛角尾翼中心線（s = −1 ~ 1，左角尖 → 右角尖）：中段平、外段急翹（克諾索斯「聖角」的 U 形） */
const hornPoint = (s) => [HORN.xMid + HORN.sweep * Math.abs(s) ** 2.4, HORN.yMid + HORN.lift * Math.abs(s) ** 2.8, HORN.span * s];
/** @type {number[][]} 牛角尾翼中心線取樣 */
const HORN_PATH = Array.from({ length: 15 }, (_, i) => hornPoint(-1 + (2 * i) / 14));

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
  theme: '陶土橘＋黑釉黑繪陶四驅車：±42.6 的寬肩前擋泥板、疊在楔形鼻上的三層同心梯形階梯（頂面陶土橘、側面與正面奶油白，一圈比一圈小）、座艙罩正前方的橫向細線迷宮帶、大型梯形剖面深茶色座艙罩、窄而高的車尾（俯視後輪外露）；擋泥板肩稜上奶油白描線，座艙罩後方到車尾的背脊一整條黑釉底陶土色回紋帶，引擎蓋與後甲板外側斜面的黑釉紋樣帶上一列金色雙斧；側面下半亮面黑釉板塊從收腰往車尾斜升，板塊上陶土色連續回紋帶，上緣一條發光金線（阿里阿德涅之線）；車尾後掠單柱撐起一支粗壯的金色牛角（U 形聖角：中段平、外段急翹成兩支尖角，角根黑色環箍），角尖高過座艙罩頂',
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
  sideZMin: 28,
  zones: () => [
    // 側面下半黑釉板塊
    { mat: 'glaze', keep: (x, y, z) => (onSide(x, z) ? splitY(x) - y : -1) },
    { mat: 'clay', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'clay', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 牛角尾翼（金）：圓潤的橢圓斷面沿 U 形中心線掃掠，中央粗（前後 12.8、高 3.2）往角尖收成尖錐 ──
    /** @type {(t: number) => number} 從中央到角尖的比例（0 中央、1 角尖） */
    const fromMid = (t) => Math.abs(2 * t - 1);
    /** @type {(t: number) => number} 斷面縮放：中段保持粗壯，外段收尖 */
    const taper = (t) => 1 - fromMid(t) ** 1.6;
    parts.push({
      geometry: smoothNormals(sweepEllipse(HORN_PATH, 40, (t) => [lerp(0.35, 6.4, taper(t)), lerp(0.35, 1.6, taper(t))], 12)),
      mat: 'gold',
      solid: true,
      outline: true,
      name: 'horn-crescent-wing',
    });
    // 角根兩道黑色環箍（角身的年輪紋，也是陶器上的黑釉色）
    for (const sg of [-1, 1]) {
      for (const s0 of [0.34, 0.44]) {
        const c = hornPoint(sg * s0);
        const t = 0.5 + (sg * s0) / 2;
        const ring = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);
        ring.scale(lerp(0.35, 6.4, taper(t)) + 0.12, 0.7, lerp(0.35, 1.6, taper(t)) + 0.12);
        // 圓柱軸轉到 z（翼展方向），再依中心線斜度微傾
        ring.rotateX(Math.PI / 2);
        const d = hornPoint(sg * (s0 + 0.02));
        const tilt = Math.atan2(d[1] - c[1], Math.abs(d[2] - c[2]));
        ring.rotateX(-sg * tilt);
        ring.translate(c[0], c[1], c[2]);
        parts.push({ geometry: ring, mat: 'black2', solid: true, outline: true, name: `horn-ring-${sg}-${s0}` });
      }
    }
    // 中央單柱（黑，厚 2.4）：從車尾殼面升到翼底
    {
      /** @type {(x: number) => number} 中線殼面高度 */
      const deckY = (x) => kit.surf.topY(x, 0);
      const pylon = finPlate(
        [
          [-53.6, deckY(-53.6) - 1],
          [-57.4, HORN.yMid + 0.4],
          [-66.4, HORN.yMid + 0.4],
          [-63.4, deckY(-63.4) - 1],
        ],
        0,
        2.4,
      );
      parts.push({ geometry: pylon, mat: 'black2', solid: true, outline: true, name: 'horn-wing-pylon' });
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
    // 座艙罩正前方一道橫向細線迷宮帶（黑色連續回紋沿 z 走，帶寬約 5.7）
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) || Math.abs(z) > MAZE.hz ? -1 : -greekKey(z + MAZE.hz, x - MAZE.x0 + KEY_Y0 + 0.9)), { offset: 0.1 }),
      mat: 'dBlack',
      name: 'decal-maze-band',
    });
    // 擋泥板肩稜（0.55 半寬的銳利稜線）上一道奶油白描線（寬 0.7），從鼻端第一階走到車尾
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) || x > 50.4 || x < -62 ? -1 : 0.35 - Math.abs(Math.abs(z) - 0.55 * P.hw(x))), { offset: 0.1 }),
      mat: 'dCream',
      name: 'decal-shoulder-lines',
    });
    // 背脊回紋帶：黑釉底（寬 8.4）上的陶土色連續回紋（含上下邊線），從座艙罩後緣到車尾
    parts.push({
      geometry: kit.decal((x, y, z) => (x > SPINE.x0 && x < SPINE.x1 ? SPINE.hz - Math.abs(z) : -1), { offset: 0.1 }),
      mat: 'dBlack',
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
      mat: 'dClay',
      name: 'decal-spine-key',
    });
    // 側裙回紋帶（陶土色，黑釉底上）：兩輪拱之間
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 26, side };
      /** @type {(u: number, v: number) => number} */
      const key = (u, v) => Math.max(greekKey(u + 60, v), 2.2 - archRingDist(side * u, v), Math.abs(u) - 22.6);
      parts.push({ geometry: kit.decal(sideDecal(key, opt), { offset: 0.1 }), mat: 'dClay', name: `decal-greek-key-${side}` });
    }
    // 引擎蓋與後甲板外側斜面上的黑釉紋樣帶（黑繪陶的帶狀裝飾），帶內一列留白的金色雙斧，雙斧柄沿車寬方向
    for (const band of LABRYS_BANDS) {
      parts.push({
        geometry: kit.decal((x, y, z) => {
          if (onSide(x, z) || x < band.x0 || x > band.x1) {
            return -1;
          }
          const az = Math.abs(z) / P.hw(x);
          return Math.min(az - 0.62, 0.94 - az) * P.hw(x);
        }, { offset: 0.1 }),
        mat: 'dBlack',
        name: `decal-labrys-band-${band.x0}`,
      });
      parts.push({
        geometry: kit.decal((x, y, z) => {
          if (onSide(x, z)) {
            return -1;
          }
          let d = Infinity;
          for (const ax of band.xs) {
            d = Math.min(d, labrysSd(x - ax, Math.abs(z) - 0.78 * P.hw(ax), band.k));
          }
          return -d;
        }, { offset: 0.13 }),
        mat: 'dGold',
        name: `decal-labrys-row-${band.x0}`,
      });
    }
    // 阿里阿德涅之線：沿黑釉板塊上緣上方 1.1 mm 的金線（寬 1.1），避開輪拱
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
    geometry: '本檔站位產生器 P（推估，造型比例取自 shared/design/body-minotaur-maze/fourview.png 與 fourview_trace.txt，縮到底盤尺寸）：殼長 130（−64 ~ 鼻端 66）；鼻端楔形中線 27.6 → 19，上面疊三層階梯（每層高 1.5，前端 x 65.4 / 60 / 54.4、後端半寬 16 / 12 / 8）、中央頂 35.8、座艙罩頂約 37.8、牛角中央 37.4 → 角尖約 48；寬：前擋泥板 ±42.6、收腰 ±31、後擋泥板 ±30.6、車尾 ±25、鼻端 ±9.5；牛角 ±45',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm）',
    wing: '牛角尾翼：ABS 橢圓斷面實體件（中央前後 12.8、高 3.2，往角尖收到 0.7，推估），中心 x −66、半翼展 45、角尖前彎 6、上翹 10.6；後掠中央單柱厚 2.4；角根環箍 ABS 0.7 mm 寬',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

export const minotaurMazeBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
