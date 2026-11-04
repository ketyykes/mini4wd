// 米諾陶洛斯與迷宮（body-minotaur-maze，第八階段神話組・希臘）：iter-114 改成有車頭、車尾的流線車殼——
// 俯視是「牛的前驅」楔形：前輪到牛肩最寬（47.4），往後收成窄臀與窄尾（車尾斜面），甲板中央微拱、肩線圓角（不再是厚平板）；
// 甲板用奶油白細牆在赭紅底上畫出方折的同心迷宮（各圈缺口前後交錯、每條迴廊一道擋牆 → 真的走得通的迷宮），
// 迷宮中心是方形開放座艙（甲板開口＋往下 4.2 mm 的井壁，看得到底盤）；一條金色細線（阿里阿德涅之線）從鼻端穿過迷宮走到座艙。
// 車頭是黑色牛頭：寬額、往前下斜收窄的鼻吻（逗號形鼻孔）、頭側一對亮黑牛眼（奶油白眼圈）、葉形牛耳，
// 額頂一對往外、往上翹再往前合抱的豎琴形金色牛角（實體件，根部埋進額頂殼面）。
// 側裙是米諾斯壁畫藍，飾一條連續方折回紋帶（單向方螺旋，不組成四臂旋轉單元）；四個 R15.2 輪拱（26 mm 輪）＋輪拱內襯與黑色擋泥唇。
// 設計：shared/design/body-minotaur-maze/DESIGN.md（MYTH_RESEARCH G6、G9、G10、G13：克諾索斯銀幣的直線迷宮、回紋＝線性迷宮、跳牛壁畫的白 / 紅 / 藍 / 黑）。
// 剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, sdRoundRect, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/**
 * 站位參數表（x 由後到前，前後軸 x = ±40）。iter-114：「厚平板＋平切車尾」改成流線車殼——
 * 車尾往下斜收成窄尾（俯視淚滴）、甲板中央微拱（不再是平板）、側面肩線圓角；x 50 以前是迷宮甲板，50–66 是牛頭（寬額、往鼻吻收窄），66 以後是鼻吻
 */
const XS = [-70, -64, -58, -50, -40, -28, -14, 0, 14, 28, 40, 46, 50, 54, 60, 66, 71, 75, 77.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 甲板中線：車尾 21.5（斜尾）→ 後輪上方 31.8 → 中段 32.6–33 → 額頂 34.4（牛角根）→ 額頭往前下斜 → 鼻吻頂 20.6
  yC: monoCurve(XS, [24, 26.5, 28.6, 30.6, 31.8, 32.4, 32.6, 32.8, 33, 33.4, 34, 34.4, 34.2, 33, 30.4, 27, 24.2, 22.2, 20.6]),
  // 半寬（俯視，iter-114）：「牛的前驅」楔形——前輪到牛肩最寬 47.4（外框 ≤ 48），往後收成窄臀（後輪上方 37、車尾 17.5），牛頭往鼻吻收窄；
  // 和其他寬殼拉開俯視輪廓（IoU）靠的是「前寬後窄」＋牛頭兩側到牛角之間的缺口＋往前合抱的豎琴形牛角
  hw: monoCurve([-70, -66, -60, -54, -46, -38, -28, -16, -4, 8, 20, 32, 40, 45, 50, 54, 60, 65, 71, 77.5], [12, 18.5, 24.5, 30.5, 36.5, 37, 36.6, 39, 47.4, 47.4, 47.4, 47.4, 47.4, 44.5, 40.6, 35.5, 29.5, 23.5, 18.4, 14]),
  // 甲板中央拱起量（中線比甲板邊高）：中段 3、牛頭 2.4、鼻吻 1.2、車尾 1.6
  crown: monoCurve(XS, [1.6, 2, 2.6, 3, 3, 3, 3, 3, 3, 3, 3, 2.8, 2.6, 2.4, 2.2, 1.8, 1.5, 1.3, 1.2]),
  // 側裙下緣：中段 10.8（底盤側框段由 loft.js 自動讓開）；車尾、牛頭與鼻吻下緣逐步抬高
  yLow: monoCurve(XS, [22, 19, 17, 13.4, 11.2, 11, 10.8, 10.8, 10.8, 11, 11.2, 12, 12.6, 13.2, 14, 14.6, 15.4, 16, 16.4]),
};

/** @type {(x: number) => number} 肩線圓角寬度 */
const chamferAt = (x) => Math.min(4, 0.25 * P.hw(x));
/** @type {(x: number) => number} 甲板邊（圓角起點）高度 */
const deckEdgeY = (x) => P.yC(x) - P.crown(x);
/** @type {(x: number) => number} 側壁頂（圓角終點）高度 */
const sideTopY = (x) => deckEdgeY(x) - 0.9 * chamferAt(x);

/**
 * 半剖面 8 點：甲板中線 → 微拱甲板（3 點）→ 肩線圓角 → 側壁頂 → 側壁 → 側裙下緣（內收 1 mm）；只有側裙下緣轉折（6）是銳利稜線
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yC = P.yC(x);
  const hw = P.hw(x);
  const ch = chamferAt(x);
  const cr = P.crown(x);
  const hd = hw - ch;
  const yE = deckEdgeY(x);
  const ySide = sideTopY(x);
  const yLow = Math.min(P.yLow(x), ySide - 2);
  return [
    [0, yC],
    [0.35 * hd, yC - 0.12 * cr],
    [0.7 * hd, yC - 0.5 * cr],
    [hd, yE],
    [hw - 0.3 * ch, yE - 0.5 * ch],
    [hw, ySide],
    [hw, lerp(ySide, yLow, 0.78)],
    [hw - 1, yLow],
  ];
};

// 牛頭、鼻吻段每 0.5 mm 一站（半寬變化大），其餘每 2 mm
const STATIONS = [...buildStations(-70, 44, 2, profile).slice(0, -1), ...buildStations(44, 77.5, 0.5, profile)];

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（側視，26 mm 輪胎半徑 13 + 2.2 mm；側壁在輪拱上方留一條厚板邊，31 mm 大輪不適用） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {number} 牛頭起點（x 大於此值改成黑色牛頭：克諾索斯石雕牛頭角杯的黑色石材） */
const X_HEAD = 49;

/** @type {{ x: number, y: number }} 牛眼位置（頭側，側視） */
const EYE = { x: 57.2, y: 23.6 };

/** @type {(x: number, z: number) => boolean} 側壁（倒角以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 0.25;
/** @type {(x: number, z: number) => boolean} 甲板（倒角以內） */
const onDeck = (x, z) => Math.abs(z) < P.hw(x) - chamferAt(x) - 0.05;

// ── 迷宮（俯視 (x, z) 平面）──────────────────────────────────────────────

/** @type {number} 迷宮中心（座艙中心）x */
const XC = 0;
/** @type {number} 迷宮牆寬（奶油白細線，mm） */
const WALL = 1.2;
/** @type {number} 迷宮圈數 */
const RINGS = 6;
/** @type {{ hx: number, hz: number }[]} 各圈牆的半長 / 半寬（內 → 外；x 向間距 7.1、z 向 4.0） */
const RING = Array.from({ length: RINGS }, (_, k) => ({ hx: 11.5 + 7.1 * k, hz: 11.5 + 4.0 * k }));
/** @type {number} 牆缺口半寬 */
const GAP = 1.9;
/** @type {(k: number) => number} 第 k 圈缺口的方向（+1 = 朝車頭，−1 = 朝車尾）：最外圈朝車頭（迷宮入口），往內前後交錯 */
const gapDir = (k) => ((RINGS - 1 - k) % 2 === 0 ? 1 : -1);
/** @type {(j: number) => number} 第 j 條迴廊（第 j 與 j + 1 圈之間）金線走的那一側（+1 = 右側 z > 0）；另一側中段有擋牆 */
const pathSide = (j) => ((RINGS - 2 - j) % 2 === 0 ? 1 : -1);
/** 座艙開口（俯視方形，迷宮中心） */
const COCKPIT = { x0: XC - 8, x1: XC + 8, hz: 8, r: 1.2 };

/**
 * 矩形外框距離（到框線的距離）
 * @type {(u: number, v: number, hx: number, hz: number) => number}
 */
const rectOutline = (u, v, hx, hz) => {
  const dx = Math.abs(u) - hx;
  const dz = Math.abs(v) - hz;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
  const inside = Math.min(Math.max(dx, dz), 0);
  return Math.abs(outside + inside);
};

/**
 * 線段距離
 * @type {(px: number, pz: number, ax: number, az: number, bx: number, bz: number) => number}
 */
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
};

/**
 * 迷宮牆距離函式（正值 = 牆內）：同心矩形牆＋缺口＋每條迴廊一道擋牆
 * @type {(x: number, z: number) => number}
 */
const mazeWalls = (x, z) => {
  const u = x - XC;
  let best = -Infinity;
  for (let k = 0; k < RINGS; k++) {
    const { hx, hz } = RING[k];
    let d = WALL / 2 - rectOutline(u, z, hx, hz);
    // 缺口：牆在 (±hx, |z| < GAP) 斷開
    if (Math.sign(u) === gapDir(k) && Math.abs(Math.abs(u) - hx) < 2 && Math.abs(z) < GAP) {
      d = Math.min(d, Math.abs(z) - GAP);
    }
    best = Math.max(best, d);
  }
  // 擋牆：第 j 條迴廊在金線不走的那一側、中段（u = 0）橫向封住
  for (let j = 0; j < RINGS - 1; j++) {
    const s = -pathSide(j);
    const d = WALL / 2 - segDist(u, z, 0, s * RING[j].hz, 0, s * RING[j + 1].hz);
    best = Math.max(best, d);
  }
  return best;
};

/**
 * 阿里阿德涅之線（俯視折線）：從牛鼻頂沿中線進最外圈入口，沿每條迴廊中線繞到下一圈缺口，最後進座艙
 * @type {number[][]}
 */
const THREAD = (() => {
  /** @type {number[][]} */
  const pts = [
    [74.5, 0],
    [XC + RING[RINGS - 1].hx, 0],
  ];
  for (let j = RINGS - 2; j >= 0; j--) {
    const mx = (RING[j].hx + RING[j + 1].hx) / 2;
    const mz = (RING[j].hz + RING[j + 1].hz) / 2;
    const s = pathSide(j);
    const inDir = gapDir(j + 1);
    pts.push([XC + inDir * mx, 0], [XC + inDir * mx, s * mz], [XC - inDir * mx, s * mz], [XC - inDir * mx, 0]);
  }
  // 穿過最內圈缺口直走到座艙口邊
  pts.push([XC + gapDir(0) * (COCKPIT.x1 - XC + 0.3), 0]);
  return pts;
})();

/** @type {(x: number, z: number) => number} 到金線的距離 */
const threadDist = (x, z) => {
  let d = Infinity;
  for (let i = 0; i < THREAD.length - 1; i++) {
    d = Math.min(d, segDist(x, z, THREAD[i][0], THREAD[i][1], THREAD[i + 1][0], THREAD[i + 1][1]));
  }
  return d;
};

// ── 側裙回紋帶（側視 (u, v)，u 往車頭為正）────────────────────────────────

/** @type {number} 回紋格距 */
const KEY_G = 1.25;
/** @type {number} 回紋一單元長度（4.6 格） */
const KEY_P = 4.6 * KEY_G;
/** @type {number} 回紋帶下緣高度 */
const KEY_Y0 = 15.6;
/** @type {number} 回紋線寬 */
const KEY_W = 0.75;

/**
 * 連續回紋（方折螺旋鉤，全部同一方向、掛在下邊線上；上邊線另一條）：每單元 (0,0)→(0,3)→(3,3)→(3,1)→(1.5,1)→(1.5,2)
 * @type {(u: number, v: number) => number} 到回紋線的距離（減半線寬）
 */
const greekKey = (u, v) => {
  const g = KEY_G;
  const y = v - KEY_Y0;
  // 上下邊線
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

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 壁畫色：赭紅、壁畫藍、奶油白（霧面，像灰泥上的礦物顏料）
  ochre: namedMaterial('paint-fresco-ochre-red', { color: 0xa5452c, roughness: 0.64, clearcoat: 0.05 }),
  blue: namedMaterial('paint-fresco-blue', { color: 0x2e5b85, roughness: 0.62, clearcoat: 0.05 }),
  cream: namedMaterial('paint-fresco-cream', { color: 0xebdfc1, roughness: 0.62, clearcoat: 0.05 }),
  // 牛頭與甲板框邊：亮面黑（少數亮面部位）
  black: namedMaterial('paint-bull-black', { color: 0x1d1b1a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  // 牛角：金色（真金屬：名稱含 -brass）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a23a, roughness: 0.3, metalness: 0.8, clearcoat: 0.2 }),
  // 牛眼：亮面黑
  eye: namedMaterial('paint-bull-eye-black', { color: 0x0e0d0c, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1716, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x1d1b1a, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-umber', { color: 0x3a2a22, roughness: 0.8, side: THREE.DoubleSide }),
  well: namedMaterial('paint-fresco-cream', { color: 0xebdfc1, roughness: 0.62, clearcoat: 0.05, side: THREE.DoubleSide }),
  dCream: decalMaterial('decal-fresco-cream', { color: 0xefe4c8, roughness: 0.6 }),
  dBlack: decalMaterial('decal-slip-black', { color: 0x1b1918, roughness: 0.5 }),
  dOchre: decalMaterial('decal-fresco-ochre', { color: 0x9c3b26, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-thread', { color: 0xd4ae45, roughness: 0.3, metalness: 0.75 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯：輪拱切口後面的上半圈圓柱面（半徑 = 輪拱半徑 + 0.3），z 從殼內面往內 4.5 mm（最深到 |z| 25.5），
 * 擋住從輪拱看進去的殼內空腔與底盤；每個角度的外側界限 = 側壁內面與「殼面高度 ≥ 內襯高度 + 0.9」兩者較小者（不穿出倒角）
 * @type {(kit: any, arch: { x: number, y: number, radius: number }) => THREE.BufferGeometry}
 */
const buildLiner = (kit, arch) => {
  /** @type {number} 內襯從外側往內的深度（只遮住從輪拱斜看進去的殼內空腔，不做整圈輪室，省質量） */
  const LINER_DEPTH = 4.5;
  const r = arch.radius + 0.3;
  const n = 44;
  const a0 = 0.1;
  const a1 = Math.PI - 0.1;
  const zInner = 25.5;
  /** @type {(t: number) => number} 該角度內襯的外側 z */
  const zOuter = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    const zSide = P.hw(x) - 1.0;
    if (kit.surf.topY(x, zSide) >= y + 0.9) {
      return zSide;
    }
    let lo = zInner;
    let hi = zSide;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (kit.surf.topY(x, m) >= y + 0.9) {
        lo = m;
      } else {
        hi = m;
      }
    }
    return Math.max(zInner + 0.5, lo);
  };
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const o0 = zOuter(t0);
      const o1 = zOuter(t1);
      const A = p(t0, Math.max(zInner, o0 - LINER_DEPTH));
      const B = p(t1, Math.max(zInner, o1 - LINER_DEPTH));
      const C = p(t1, o1);
      const D = p(t0, o0);
      // 法線朝輪心
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

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-minotaur-maze',
  name: '米諾陶洛斯迷宮',
  style: 'myth',
  phase: 8,
  mythSeries: 'greek',
  mythTheme: 'minotaur-labyrinth',
  form: 'bull-slab',
  roof: 'open-cockpit',
  wing: 'none',
  theme: '低寬平頂厚板＝俯視的克諾索斯迷宮（赭紅底、奶油白方折迷宮牆、金色阿里阿德涅之線），迷宮中心方形開放座艙；前高後低的黑色牛頭肩、牛鼻衝角與一對前彎短牛角，側裙壁畫藍回紋帶',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面（iter-114）：甲板微拱、肩線圓角都平滑，只有側裙下緣轉折（6）是銳利稜線
  hard: [6],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 33 },
    // iter-114：車尾收窄（後輪後方半寬 < 34.25 = 輪胎外緣），後輪拱切到 |z| ≥ 26 才不會碰輪胎
    { x: -40, y: 13, radius: 15.2, cutZFrom: 26 },
  ],
  openings: [
    {
      id: '迷宮中心座艙',
      shape: 'fn',
      sd: (x, y, z) => (y < 24 ? 10 : sdRoundRect(x, Math.abs(z), COCKPIT.x0, COCKPIT.x1, -COCKPIT.hz, COCKPIT.hz, COCKPIT.r)),
    },
  ],
  sideZMin: 30,
  zones: () => [
    // 黑色牛頭（額頭、頰面、牛鼻）
    { mat: 'black', keep: (x) => x - X_HEAD },
    // 黑色甲板框邊（倒角一圈）
    { mat: 'black', keep: (x, y, z) => (!onDeck(x, z) && !onSide(x, z) ? 1 : -1) },
    // 赭紅甲板（迷宮底色）
    { mat: 'ochre', keep: (x, y, z) => (onDeck(x, z) ? 1 : -1) },
    // 側裙：壁畫藍
    { mat: 'blue', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 座艙井壁：沿座艙開口往下 4.2 mm 的方形井（0.8 mm 壁，頂端埋進甲板殼內；沒有底，看得到底盤）──
    {
      const t = 0.8;
      const depth = 4.2;
      /** @type {THREE.BufferGeometry[]} */
      const walls = [];
      const yTopAt = (x) => top(x, 0) - 0.3;
      const yBot = Math.min(yTopAt(COCKPIT.x0), yTopAt(COCKPIT.x1)) - depth;
      const yTop = Math.max(yTopAt(COCKPIT.x0), yTopAt(COCKPIT.x1));
      const h = yTop - yBot;
      const lx = COCKPIT.x1 - COCKPIT.x0;
      for (const sg of [-1, 1]) {
        const gz = new THREE.BoxGeometry(lx + 2 * t, h, t);
        gz.translate(XC, yBot + h / 2, sg * (COCKPIT.hz + t / 2));
        walls.push(gz);
        const gx = new THREE.BoxGeometry(t, h, 2 * COCKPIT.hz);
        gx.translate(sg > 0 ? COCKPIT.x1 + t / 2 : COCKPIT.x0 - t / 2, yBot + h / 2, 0);
        walls.push(gx);
      }
      parts.push({ geometry: mergeGeos(walls), mat: 'well', solid: true, name: 'cockpit-well' });
    }

    // ── 牛頭（iter-114：評審「牛頭只靠牛角和兩個鼻孔」→ 加寬額、耳、眼、鼻吻分界）──
    // 牛角：從額頂兩側（x 50、|z| 20）長出，往外、往上翹到車寬邊緣，再往前、往內合抱到鼻吻前方的豎琴形（跳牛壁畫裡往前彎的長牛角，造型自創）；全支金色（克諾索斯石雕牛頭角杯的鍍金木角為現代復原，這裡只借用「黑頭金角」的配色）
    {
      /** @type {(sg: number) => number[][]} */
      const hornPath = (sg) => [
        [49.4, top(49.4, 20) - 1.4, sg * 19.6],
        [52, 37.6, sg * 26],
        [55, 40.4, sg * 34],
        [60, 42.2, sg * 43],
        [65, 42.8, sg * 45.5],
        [71, 43.2, sg * 45.2],
        [77, 43.8, sg * 40.8],
        [81.6, 44.4, sg * 33.6],
      ];
      /** @type {(t: number) => number[]} 角的斷面半徑：根部 2.6 → 中段 1.85 → 角尖 0.75（粗壯的牛角） */
      const hornR = (t) => {
        const r = lerp(2.6, 0.75, Math.pow(t, 1.3));
        return [r, r * 0.9];
      };
      /** @type {THREE.BufferGeometry[]} */
      const horns = [];
      for (const sg of [-1, 1]) {
        horns.push(smoothNormals(sweepEllipse(hornPath(sg), 64, hornR, 16)));
      }
      parts.push({ geometry: mergeGeos(horns), mat: 'gold', solid: true, outline: true, name: 'bull-horns' });
    }
    // 牛耳：牛角根後下方、往外略往後下垂的葉形片（厚 1.4、邊緣 0.25 倒角），根部埋進頭側殼面
    {
      /** @type {THREE.BufferGeometry[]} */
      const ears = [];
      for (const sg of [-1, 1]) {
        const shape = new THREE.Shape();
        // 局部 (a, b)：a 沿耳長（往外）、b 沿耳寬；葉形：根部寬 3、尖端圓
        const L = 7.2;
        const W = 1.9;
        shape.moveTo(0, -W * 0.8);
        shape.quadraticCurveTo(L * 0.55, -W * 1.35, L, 0);
        shape.quadraticCurveTo(L * 0.55, W * 1.35, 0, W * 0.8);
        shape.lineTo(0, -W * 0.8);
        const bev = 0.25;
        const g = new THREE.ExtrudeGeometry(shape, { depth: 1.4 - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 10 });
        g.translate(0, 0, -0.7 + bev);
        // 局部 a → 世界 +z（往外）、b → 世界 x、厚度 → 世界 y；再往下垂 18°、往後掠 20°
        g.rotateX(-Math.PI / 2);
        g.rotateY(-Math.PI / 2);
        g.rotateX(-0.31);
        g.rotateY(0.35);
        if (sg < 0) {
          g.scale(1, 1, -1);
        }
        const x0 = 51.6;
        const z0 = P.hw(x0) - 2.6;
        g.translate(x0, sideTopY(x0) + 1.2, sg * z0);
        ears.push(g);
      }
      parts.push({ geometry: mergeGeos(ears), mat: 'black', solid: true, outline: true, name: 'bull-ears' });
    }
    // 牛眼：頭側一對亮面黑半球（壓扁），外圍奶油白眼圈貼紙
    {
      /** @type {THREE.BufferGeometry[]} */
      const eyes = [];
      for (const sg of [-1, 1]) {
        const e = new THREE.SphereGeometry(1.5, 16, 12);
        e.scale(1.15, 1, 0.55);
        e.translate(EYE.x, EYE.y, sg * (P.hw(EYE.x) - 0.15));
        eyes.push(e);
      }
      parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, name: 'bull-eyes' });
      parts.push({
        geometry: kit.decal((x, y, z) => (onSide(x, z) ? 0.45 - Math.abs(Math.hypot((x - EYE.x) / 1.15, y - EYE.y) - 2.1) : -1)),
        mat: 'dCream',
        name: 'decal-eye-rings',
      });
    }

    // 輪拱內襯（前後）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(kit, a))), mat: 'liner', shell: true, name: 'arch-liners' });
    // 輪拱擋泥唇（黑色圓斷面細唇，半徑 0.7，沿側壁上的輪拱切口；只在垂直側壁段，不往外加寬俯視輪廓）
    {
      /** @type {THREE.BufferGeometry[]} */
      const lips = [];
      for (const arch of ARCHES) {
        for (const sg of [-1, 1]) {
          /** @type {number[][]} */
          const pts = [];
          const r = arch.radius + 0.55;
          for (let i = 0; i <= 64; i++) {
            const t = 0.02 + ((Math.PI - 0.04) * i) / 64;
            const x = arch.x + r * Math.cos(t);
            const y = arch.y + r * Math.sin(t);
            // 側壁在輪胎外緣（|z| 34.25）+ 1 mm 以內的地方（收窄的車尾）不做擋泥唇
            if (y < P.yLow(x) + 0.4 || y > sideTopY(x) - 0.5 || P.hw(x) < 36.4) {
              continue;
            }
            pts.push([x, y, sg * (P.hw(x) - 0.35)]);
          }
          if (pts.length > 3) {
            lips.push(sweepEllipse(pts, 60, () => [0.7, 0.7], 10));
          }
        }
      }
      parts.push({ geometry: mergeGeos(lips), mat: 'black', solid: true, outline: true, name: 'arch-lips' });
    }

    // ── 貼紙 ──
    // 迷宮牆（奶油白 1.2 mm）：只畫在甲板上
    parts.push({
      geometry: kit.decal((x, y, z) => (onDeck(x, z) && x < 50 ? mazeWalls(x, z) : -1)),
      mat: 'dCream',
      name: 'decal-labyrinth-walls',
    });
    // 座艙口一圈奶油白框（0.9 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = sdRoundRect(x, Math.abs(z), COCKPIT.x0, COCKPIT.x1, -COCKPIT.hz, COCKPIT.hz, COCKPIT.r);
        return y > 24 ? 0.9 - d : -1;
      }),
      mat: 'dCream',
      name: 'decal-cockpit-rim',
    });
    // 阿里阿德涅之線（金色 0.8 mm）：只畫在朝上的面（甲板、額頭、牛鼻頂）
    parts.push({
      geometry: kit.decal((x, y, z) => (y > deckEdgeY(x) - 0.3 && Math.abs(z) < P.hw(x) - chamferAt(x) ? 0.4 - threadDist(x, z) : -1), { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-ariadne-thread',
    });
    // 側裙回紋帶（奶油白）：避開輪拱外 1.2 mm 與牛頭段
    /** @type {(u: number, v: number) => number} u = 往車頭為正的 x */
    const keyBand = (u, v) => Math.max(greekKey(u + 80, v), u - (X_HEAD - 2), -56 - u, 1.2 - archRingDist(u, v));
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(keyBand, { x0: 0, y0: 0, zMin: 30, side: 1 })),
        // 左側：u = −x，回紋方向鏡射（從車頭看左右對稱）
        kit.decal(sideDecal((u, v) => keyBand(-u, v), { x0: 0, y0: 0, zMin: 30, side: -1 })),
      ]),
      mat: 'dCream',
      name: 'decal-meander-band',
    });
    // 側裙下緣赭紅細帶（0.9 mm，壁畫的分隔線）
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) && x < X_HEAD ? Math.min(0.45 - Math.abs(y - 12.6), archRingDist(x, y) - 1.2) : -1)),
      mat: 'dBlack',
      name: 'decal-skirt-line',
    });
    // 鼻孔：鼻吻頂前端一對往外斜的逗號形鼻孔（填赭紅，像鼻孔內側），不畫外圈（避免看成一對眼睛）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 70.5 || y < P.yC(x) - 1.2) {
          return -1;
        }
        const u = x - 74.6;
        const v = Math.abs(z) - 4.3;
        // 往外後方斜 35° 的橢圓（長軸 1.9、短軸 0.85）
        const c = Math.cos(0.6);
        const sn = Math.sin(0.6);
        const a = u * c + v * sn;
        const b2 = -u * sn + v * c;
        return 1 - Math.hypot(a / 0.85, b2 / 1.9);
      }),
      mat: 'dOchre',
      name: 'decal-nostrils',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，iter-114）：殼 x −70 → 77.5、牛角尖 x 82.2（外框長 152.2 ≤ 153，SPEC 1.14a）；甲板中線 24（車尾）→ 33（中段，中央拱 3 mm）→ 34.4（額頂）→ 20.6（鼻吻）；半寬：車尾 12 → 後輪 37 → 牛肩 47.4（外框半寬 ≤ 48.0）→ 鼻吻 14；俯視半寬依輪廓 IoU 掃描決定',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm，同 cerberus），前 cutZFrom 33、後 26（車尾收窄後側壁在輪胎外緣以內）；31 mm 大輪需切輪拱。輪拱內襯從側壁內面往內 4.5 mm；黑色擋泥唇 R0.7',
    labyrinth: '迷宮：克諾索斯銀幣背面的直線迷宮（MYTH_RESEARCH G9）與「回紋是線性形式的迷宮」（G10）；6 圈同心矩形牆、缺口前後交錯、每條迴廊一道擋牆，牆寬 1.2 mm（圈數與尺寸自訂）',
    thread: '阿里阿德涅之線（G6）：金色 0.8 mm 細線沿迷宮解答路徑從牛鼻走到座艙',
    cockpit: '迷宮中心方形開放座艙 16 × 16 mm、井壁深約 4.2 mm（0.8 mm 實心壁），沒有底板（看得到底盤）',
    horns: '牛角為實心 ABS 掃掠件（根部 φ5.2 → 角尖 φ1.5，往外翹到 |z| 45.5、往前合抱到 x 82），牛耳葉形片厚 1.4（0.25 倒角），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    head: 'iter-114 牛頭：黑色石材般的頭（克諾索斯石雕牛頭角杯，Minoan art 條目：steatite / serpentine 類軟石，鍍金木角為現代復原）；牛眼、牛耳、鼻孔造型自創',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 也會傳遞 mythSeries / mythTheme；這裡再補一次，和其他神話款一致
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const minotaurMazeBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
