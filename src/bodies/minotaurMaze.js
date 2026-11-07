// 米諾陶洛斯（body-minotaur-maze，神話組・希臘）：照四視圖 18 的「階梯鼻、大座艙、高車尾、單柱牛角新月尾翼」重新建模；車上沒有牛的頭、臉、眼、鼻孔、鼻環。
// 牛角 → 尾翼：一片新月形的尾翼，中央最低、兩端往上翹並往前彎（後視、俯視都是新月），單柱撐在車尾中線。
// 迷宮 → 階梯鼻與鼻面回圈：鼻子是往上疊兩階的平台（側視三層階梯），鼻面上四道同心 U 形黑線一圈套一圈（四視圖鼻面的同心線，讀成克諾索斯方形迷宮的迴圈）；
// 側裙是黑底上的奶油白連續回紋帶（線性迷宮），從收腰往車尾斜升的黑色板塊收在後輪前；一條金色阿里阿德涅之線沿黑色板塊上緣從鼻端走到車尾。
// 設計：shared/design/body-minotaur-maze/DESIGN.md（MYTH_RESEARCH G6、G9、G10、G12、G13）。剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
// 塗裝：陶土橘（霧面）為主色，黑繪泥釉黑（緞面）做側裙板塊、座艙框與尾翼，奶油白做回紋與鼻面細線之外的描邊，金線點綴。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, sdRoundRect, mergeGeos, lerp } from './loft.js';
import { buildProfileLiner } from './khepriScarab.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40；鼻端兩道階梯的豎面在 x 52 與 59） */
const XS = [-64, -58, -52, -46, -38, -28, -16, -4, 8, 20, 30, 40, 46, 51.4, 52.6, 58.6, 59.8, 63, 66];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬：前寬後窄——前擋泥板是 ±44 的寬肩，x 46 之後急收成 ±14 → ±9 的階梯短鼻；收腰 ±33、後擋泥板只到 ±32（俯視後輪露在車身外）、車尾 ±25；新月尾翼翼端伸到 ±44，比車尾寬
  hw: monoCurve(XS, [25, 27.4, 30, 32, 32.2, 32.6, 32.8, 33, 36.5, 40, 42.8, 44, 42, 28, 24.4, 14, 12, 11, 9]),
  // 中央頂線：車尾高；鼻端兩階（27.4 → 24.2 於 x 52、23.4 → 20.4 於 x 59）
  yC: monoCurve(XS, [33.4, 35.2, 35.8, 35.6, 35, 34.4, 33.6, 32.8, 31.6, 30.4, 29.4, 28.6, 28, 27.4, 24.2, 23.4, 20.4, 19.8, 19]),
  // 擋泥板肩（0.55 半寬）：前擋泥板比引擎蓋高，鼻端跟著兩階
  yF: monoCurve(XS, [34, 36.2, 36.8, 36.4, 35.4, 33, 29.4, 28.4, 29.2, 31, 31.6, 31.4, 30.4, 30, 27, 25.8, 22.2, 21.4, 20.4]),
  // 肩稜（最寬處）
  yE: monoCurve(XS, [30, 32.6, 33, 32.6, 31.6, 29, 25, 24, 24.8, 27, 28, 27.8, 27.2, 26.8, 24, 23, 20.2, 19.6, 18.8]),
  // 側壁下緣
  yLow: monoCurve(XS, [16.4, 14.6, 13.6, 13, 12.9, 12.7, 12.5, 12.5, 12.5, 12.5, 12.6, 13, 13.4, 13.6, 13.6, 14.2, 14.4, 14.8, 15.2]),
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

const STATIONS = [...buildStations(-64, 46, 1.5, profile).slice(0, -1), ...buildStations(46, 66, 0.6, profile)];

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（26 mm 輪胎半徑 13 + 2.2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 側壁（肩稜以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 0.3;

/**
 * 側面黑色板塊的上緣高度：鼻端 17.6、收腰段 22，從 x −14 往車尾斜升到 29.4（四視圖 18 從收腰斜升到車尾的色塊）
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

/** @type {{ apex: number, hz: number }[]} 鼻面三道同心 U 形線：頂點 x 與半寬 */
const NOSE_RINGS = [
  { apex: 65, hz: 7.6 },
  { apex: 61.4, hz: 5.2 },
  { apex: 57.8, hz: 2.8 },
];

/** @type {{ x: number }} 方形迷宮徽記中心（車尾甲板中線） */
const MAZE = { x: -42 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 陶土橘（霧面）：主色
  clay: namedMaterial('paint-terracotta-clay', { color: 0xc4652f, roughness: 0.7, clearcoat: 0.04 }),
  // 黑繪泥釉黑（緞面）
  black: namedMaterial('paint-slip-black', { color: 0x1b1817, roughness: 0.52, clearcoat: 0.15, clearcoatRoughness: 0.4 }),
  black2: namedMaterial('paint-slip-black', { color: 0x1b1817, roughness: 0.52, clearcoat: 0.15, clearcoatRoughness: 0.4, side: THREE.DoubleSide }),
  // 尾翼頂面的陶土色新月條
  clay2: namedMaterial('paint-terracotta-clay', { color: 0xc4652f, roughness: 0.7, clearcoat: 0.04, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1716, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x1b1817, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x1a1716, roughness: 0.85, side: THREE.DoubleSide }),
  // 煙燻座艙罩（有色透明 PC，帶一點赭色）
  glass: namedMaterial('pc-tint-umber-smoke', { color: 0x3a2a22, roughness: 0.06, specularIntensity: 0.6, transparent: true, opacity: 0.66, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-umber', { color: 0x2a201b, roughness: 0.8, side: THREE.DoubleSide }),
  dCream: decalMaterial('decal-fresco-cream', { color: 0xefe4c8, roughness: 0.6 }),
  dBlack: decalMaterial('decal-slip-black', { color: 0x1b1918, roughness: 0.5 }),
  // 阿里阿德涅之線：微微發光的金線
  dThread: decalMaterial('decal-ariadne-glow', { color: 0xf2c24e, emissive: 0xffb428, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.4 }),
  lamp: namedMaterial('lamp-warm-white', { color: 0xfff1d0, emissive: 0xffe2a0, emissiveIntensity: 0.7, roughness: 0.15 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** 座艙罩（大而後傾，四視圖 18 的大座艙）：x 30 → −26 */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(30, -26, u);
      const halfW = i === 0 || i === n ? 2.4 : 11.6 * Math.sin(Math.PI * u ** 0.75) ** 0.5;
      const rise = 7.6 * Math.sin(Math.PI * u ** 0.62) ** 0.7;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {{ xMid: number, yMid: number, span: number, sweep: number, lift: number }} 新月尾翼：中央 (x, y)、半翼展、翼端往前彎的量、翼端上翹的量 */
const HORN = { xMid: -61, yMid: 39.8, span: 44, sweep: 8, lift: 7 };
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
  theme: '陶土橘四驅車：前寬後窄的車身：±44 的寬肩前擋泥板、往上疊兩階的階梯短鼻與鼻面三道同心 U 形黑線（方形迷宮的迴圈）、大而後傾的煙燻座艙罩、窄而高的車尾（俯視後輪外露）；側裙黑色板塊從收腰往車尾斜升，板塊上奶油白連續回紋帶，上緣一條發光金線（阿里阿德涅之線）；車尾單柱撐起黑色牛角新月尾翼，中央最低、兩端上翹前彎，頂面一道陶土色新月條',
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
    // 側裙黑色板塊
    { mat: 'black', keep: (x, y, z) => (onSide(x, z) ? splitY(x) - y : -1) },
    // 座艙框：座艙罩四周一圈黑（中線兩側 0.2 半寬、x −30 ~ 34）
    { mat: 'black', keep: (x, y, z) => (onSide(x, z) ? -1 : Math.min(0.24 * P.hw(x) - Math.abs(z), x + 30, 34 - x)) },
    { mat: 'clay', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'clay', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // ── 牛角新月尾翼（黑）：扁橢圓斷面沿新月中心線掃掠，弦長中央 12 → 翼端 1.4、厚 1.8 → 0.8 ──
    /** @type {(t: number) => number} 從中央到翼端的比例（0 中央、1 翼端） */
    const fromMid = (t) => Math.abs(2 * t - 1);
    parts.push({
      geometry: smoothNormals(sweepEllipse(HORN_PATH, 32, (t) => [lerp(6, 0.7, fromMid(t) ** 1.25), lerp(0.9, 0.4, fromMid(t))], 10)),
      mat: 'black2',
      solid: true,
      outline: true,
      name: 'horn-crescent-wing',
    });
    // 頂面一道陶土色新月條（弦長約 1/3、貼在翼頂上方 0.6 mm）
    parts.push({
      geometry: smoothNormals(
        sweepEllipse(
          HORN_PATH.map(([x, y, z]) => [x, y + 0.6, z]),
          32,
          (t) => [lerp(2, 0.3, fromMid(t) ** 1.25), 0.35],
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
          [-57.4, HORN.yMid + 0.4],
          [-63.4, HORN.yMid + 0.4],
          [-63.4, deckY(-63.4) - 1],
        ],
        0,
        2.4,
      );
      parts.push({ geometry: pylon, mat: 'black2', solid: true, name: 'horn-wing-pylon' });
    }

    // 輪拱內襯（前後，R15.2）：每個角度的外緣取該高度的殼內面，不會從擋泥板頂冒出來
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.4, profile))), mat: 'liner', shell: true, name: 'arch-liners' });

    // ── 貼紙 ──
    // 鼻面三道同心 U 形黑線（寬 0.9）：只畫在第一道階梯之前（x 53.4 以前）的頂面，和兩道階梯一起讀成一圈套一圈的迷宮
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z) || x < 53.4) {
          return -1;
        }
        let d = Infinity;
        for (const r of NOSE_RINGS) {
          d = Math.min(d, Math.abs(sdRoundRect(x, z, 20, r.apex, -r.hz, r.hz, 5)));
        }
        return 0.45 - d;
      }, { offset: 0.1 }),
      mat: 'dBlack',
      name: 'decal-labyrinth-rings',
    });
    // 方形迷宮徽記（克諾索斯銀幣背面的方折迷宮）：座艙後方的車尾甲板上，四圈同心方框、每圈在相反側留一個缺口，黑線寬 0.9
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z)) {
          return -1;
        }
        let d = Infinity;
        for (let k = 1; k <= 4; k++) {
          const h = 2.6 * k;
          const ring = Math.abs(sdRoundRect(x, z, MAZE.x - h, MAZE.x + h, -h, h, 0.6));
          // 缺口：奇數圈開在車頭側、偶數圈開在車尾側（寬 2 mm）
          const gapX = k % 2 ? MAZE.x + h : MAZE.x - h;
          const inGap = Math.abs(z) < 1 && Math.abs(x - gapX) < 0.8;
          d = Math.min(d, inGap ? Infinity : ring);
        }
        return 0.45 - d;
      }, { offset: 0.1 }),
      mat: 'dBlack',
      name: 'decal-knossos-maze',
    });
    // 側裙回紋帶（奶油白，黑底上）：兩輪拱之間
    for (const side of [-1, 1]) {
      const opt = { x0: 0, y0: 0, zMin: 26, side };
      /** @type {(u: number, v: number) => number} */
      const key = (u, v) => Math.max(greekKey(u + 60, v), 2.2 - archRingDist(side * u, v), Math.abs(u) - 22.6);
      parts.push({ geometry: kit.decal(sideDecal(key, opt), { offset: 0.1 }), mat: 'dCream', name: `decal-greek-key-${side}` });
    }
    // 阿里阿德涅之線：沿黑色板塊上緣上方 0.9 mm 的金線（寬 0.7），避開輪拱
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? Math.min(0.35 - Math.abs(y - splitY(x) - 0.9), archRingDist(x, y) - 1) : -1), { offset: 0.12 }),
      mat: 'dThread',
      name: 'decal-ariadne-thread',
    });
    // 頭燈：鼻端一整條橫向燈條（單一條，不做成一對燈眼）
    parts.push({ geometry: new THREE.BoxGeometry(0.8, 1, 13).translate(66.2, 17.6, 0), mat: 'lamp', solid: true, name: 'lamp-head-bar' })
    // 尾燈：車尾左右一對細長紅燈
    {
      /** @type {THREE.BufferGeometry[]} */
      const lamps = [];
      for (const sg of [-1, 1]) {
        const l = new THREE.BoxGeometry(0.8, 1.4, 8);
        l.translate(-64.2, 27, sg * 12);
        lamps.push(l);
      }
      parts.push({ geometry: mergeGeos(lamps), mat: 'tail', solid: true, name: 'lamp-tail' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，造型比例取自 shared/design/body-minotaur-maze/fourview.png 與 fourview_trace.txt，縮到底盤尺寸）：殼長 130（−64 ~ 鼻端 66）；鼻端兩階（中線 27.4 → 24.2 於 x 52、23.4 → 20.4 於 x 59）、中央頂 35.8、座艙罩頂約 38.6、新月尾翼中央 39.8 → 翼端約 46.8；寬：前擋泥板 ±44、收腰 ±33、後擋泥板 ±32、車尾 ±25、鼻端 ±9；新月尾翼 ±44',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm）',
    wing: '新月尾翼：ABS 扁橢圓斷面實體件（弦長 12 → 1.4、厚 1.8 → 0.8，推估），半翼展 44、翼端前彎 8、上翹 7；中央單柱厚 2.4',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

export const minotaurMazeBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
