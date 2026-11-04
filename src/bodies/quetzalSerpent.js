// 羽蛇（body-quetzal-serpent，第八階段神話組・阿茲特克 / 馬雅）：特奧蒂瓦坎羽蛇神殿立面伸出的羽蛇頭（頭後一圈羽毛領、眼窩嵌黑曜石），
// 加上阿茲特克綠松石馬賽克雙頭蛇的配色（綠松石面、海菊蛤紅嘴、螺貝白牙）。
// 車頭是寬而方的蛇頭（平頂、側面垂直、前臉平切的方正上顎，下顎內縮一階）；頭後細頸（前輪外露）＋一圈往後傾的短羽毛領；
// 車身側面是 talud-tablero 式的兩階側壁，上緣稜線沿 x 波浪起伏（蛇身蜿蜒）；中段黑曜石色座艙罩；車尾 7 片扇形直立長羽（綠咬鵑尾羽）。
// 設計：shared/design/body-quetzal-serpent/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 8 節 A1–A3、A6、A7；黑名單 8-3）。剖面為本檔站位產生器（推估）。
// 紋樣與配色取自文物描述、圖形為自繪：綠松石小片馬賽克、連續帶狀階梯回紋（xicalcoliuhqui，不做四向旋轉單元）；
// 不做鷹＋蛇＋仙人掌組合、不用國旗色排列、不做骷髏 / 人祭圖像、不畫神像人臉；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdRoundRect, sdConvexPolygon, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -70;
/** @type {number} 蛇頭前臉 x */
const X_NOSE = 76;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-70, -64, -56, -40, -20, 0, 14, 22, 30, 44, 52, 55, 58, 61, 70, 73, 75, 76];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬（基礎值，另加 halfW 的蛇身波浪）：車身罩住後輪（37.5）→ 往前收成細頸（22，前輪內側面 25.25 之內）→ 蛇頭突然變寬（32.5）、前臉兩角圓收（方正上顎）
  hw: monoCurve(XS, [22, 30, 35.5, 37, 35.5, 30, 22.5, 19, 18, 17.5, 17.5, 18, 29, 32.5, 32.5, 31.5, 29, 25]),
  // 中線頂：後段蛇身 33 → 座艙段 31.5 → 細頸下凹 25 → 蛇頭平頂 27.5
  yTop: monoCurve(XS, [30, 32, 32.8, 33, 32, 31.5, 30, 27.5, 25.5, 25, 25.5, 26.5, 27, 27.5, 27.5, 27.2, 26.8, 26.4]),
  // 側裙下緣：車身 10.5–13（底盤側框段 ≥ 9.9）；細頸段抬到 18（底盤上方）；蛇頭下顎 12
  yLow: monoCurve(XS, [22, 18, 13, 12, 11, 10.5, 14, 18, 18, 18, 18, 16, 13, 12, 12, 12.5, 13, 13]),
};

/** @type {{ y: number, amp: number, len: number, peak: number }} 蛇身波浪稜線：y = 27 ± 2.2，波長 46 mm，波峰落在後輪軸（x −40）上方 */
const WAVE = { y: 27, amp: 2.2, len: 46, peak: -40 };

/**
 * 半寬＝基礎值＋蛇身段的左右波浪（和稜線同相位：稜線波峰處車身也最寬，俯視像一節節蜿蜒的蛇身；車尾與細頸前漸消失）
 * @type {(x: number) => number}
 */
const halfW = (x) => {
  const env = smoothstep(-64, -54, x) * (1 - smoothstep(4, 16, x));
  return P.hw(x) + 3.2 * env * Math.cos((2 * Math.PI * (x - WAVE.peak)) / WAVE.len);
};

/**
 * 側壁上緣稜線高度（蛇身段波浪起伏；往前漸變成蛇頭平頂的邊稜）
 * @type {(x: number) => number}
 */
const ridgeY = (x) => {
  const wave = WAVE.y + WAVE.amp * Math.cos((2 * Math.PI * (x - WAVE.peak)) / WAVE.len);
  const head = P.yTop(x) - 1.8;
  const y = lerp(wave, head, smoothstep(22, 34, x));
  return Math.min(y, P.yTop(x) - 1.2);
};

/**
 * 立板（tablero）下緣：蛇頭段 = 口線（17.5），車身段 = 稜線下 8 mm；並夾在下緣之上
 * @type {(x: number) => number}
 */
const tableroY = (x) => {
  const body = ridgeY(x) - 8;
  const y = lerp(body, 17.5, smoothstep(54, 58, x));
  return Math.max(P.yLow(x) + 2.2, Math.min(y, ridgeY(x) - 2));
};

/**
 * 半剖面 8 點：頂面（中線 → 頂面外緣）→ 稜線（銳利）→ 立板 tablero（垂直）→ 立板下緣（銳利）→ 內收一階（銳利）→ 斜坡 talud 到下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = halfW(x);
  const yTop = P.yTop(x);
  const yR = ridgeY(x);
  const yT = tableroY(x);
  const yLow = P.yLow(x);
  return [
    [0, yTop],
    [0.5 * hw, yTop - 0.35],
    [hw - 3.5, Math.max(yR + 0.9, lerp(yR, yTop, 0.5))],
    [hw - 0.6, yR],
    [hw, yR - 1],
    [hw, yT],
    [hw - 1.5, yT - 0.5],
    [hw - 0.4, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 站位表（蛇頭與車尾段加密：蛇頭外擴、前臉圓角曲率大） */
const STATIONS = [
  ...buildStations(X_TAIL, -60, 1, profile).slice(0, -1),
  ...buildStations(-60, 50, 2, profile).slice(0, -1),
  ...buildStations(50, X_NOSE, 0.5, profile),
];

/** @type {{ x: number, z: number, a: number, b: number }} 黑曜石眼窩（蛇頭頂面兩側的橢圓凹窩） */
const EYE = { x: 64.5, z: 21.5, a: 4.2, b: 2.5 };
/** @type {(x: number, y: number, z: number) => number} 眼窩距離（負值 = 凹窩內） */
const eyeSd = (x, y, z) => (y < 22 ? 10 : (Math.hypot((x - EYE.x) / (EYE.a / EYE.b), Math.abs(z) - EYE.z) - EYE.b));

/**
 * 可重現的格點雜湊（0–1）
 * @type {(i: number, j: number) => number}
 */
const hash2 = (i, j) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * 綠松石馬賽克：2.6 mm 方格，依雜湊挑出一部分格子畫成內縮 0.35 mm 的小片（深 / 淺兩色各一組）
 * @type {(x: number, z: number, lo: number, hi: number) => number} 回傳正值 = 在被挑中的小片內
 */
const mosaic = (x, z, lo, hi) => {
  const c = 2.6;
  const i = Math.floor(x / c);
  const j = Math.floor(z / c);
  const h = hash2(i, j);
  if (h < lo || h >= hi) {
    return -1;
  }
  return -sdRoundRect(x, z, i * c + 0.35, (i + 1) * c - 0.35, j * c + 0.35, (j + 1) * c - 0.35, 0.3);
};

/**
 * 線段距離
 * @type {(px: number, py: number, ax: number, ay: number, bx: number, by: number) => number}
 */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** @type {number} 階梯回紋單元寬（xicalcoliuhqui，自繪）：寬 10.4、高 5.2 的帶內，一道三階梯往上接一個往內捲的方鉤；單元往同一方向連續重複 */
const FRET_W = 10.4;
/** @type {number[][]} 折線頂點（單元座標 u, v） */
const FRET_PATH = [
  [-0.8, 0.6],
  [2, 0.6],
  [2, 1.9],
  [3.6, 1.9],
  [3.6, 3.3],
  [5.2, 3.3],
  [5.2, 4.6],
  [9.6, 4.6],
  [9.6, 1.6],
  [7.2, 1.6],
  [7.2, 3.1],
  [8.2, 3.1],
];

/**
 * 階梯回紋帶距離（u 沿帶、v 由帶下緣往上，線寬 0.66 mm）
 * @type {(u: number, v: number) => number}
 */
const fretSd = (u, v) => {
  const k = Math.floor(u / FRET_W);
  let d = Infinity;
  for (const off of [k - 1, k]) {
    const lu = u - off * FRET_W;
    for (let i = 0; i < FRET_PATH.length - 1; i++) {
      const [ax, ay] = FRET_PATH[i];
      const [bx, by] = FRET_PATH[i + 1];
      d = Math.min(d, segDist(lu, v, ax, ay, bx, by));
    }
  }
  return d - 0.33;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 綠松石馬賽克面、翡翠綠立板、海菊蛤紅斜坡：石材 / 貝殼感用霧面（roughness > 0.5）
  turq: namedMaterial('paint-turquoise-mosaic', { color: 0x2bb3a3, roughness: 0.62, clearcoat: 0.1 }),
  turq2: namedMaterial('paint-turquoise-mosaic', { color: 0x2bb3a3, roughness: 0.62, clearcoat: 0.1, side: THREE.DoubleSide }),
  jade: namedMaterial('paint-jade-green', { color: 0x1e7f4e, roughness: 0.56, clearcoat: 0.15 }),
  jade2: namedMaterial('paint-jade-green', { color: 0x1e7f4e, roughness: 0.56, clearcoat: 0.15, side: THREE.DoubleSide }),
  red: namedMaterial('paint-spondylus-red', { color: 0xc2452d, roughness: 0.6, clearcoat: 0.1 }),
  red2: namedMaterial('paint-spondylus-red', { color: 0xc2452d, roughness: 0.6, clearcoat: 0.1, side: THREE.DoubleSide }),
  shell: namedMaterial('paint-shell-white', { color: 0xf1ebdd, roughness: 0.58, clearcoat: 0.1, side: THREE.DoubleSide }),
  // 綠咬鵑長羽：全車少數的亮面金屬漆（羽毛的金屬綠光澤）
  plume: namedMaterial('paint-quetzal-green-metallic', { color: 0x168a5a, roughness: 0.28, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  // 黑曜石：亮面黑（眼窩、鼻孔）
  obsidian: namedMaterial('paint-obsidian-gloss', { color: 0x1c1c22, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x15201c, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-jade', { color: 0x17603c, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x121416, roughness: 0.6 }),
  // 黑曜石色煙燻座艙罩
  glass: namedMaterial('pc-smoke-tint', { color: 0x16161c, roughness: 0.05, specularIntensity: 0.7, transparent: true, opacity: 0.8, envMapIntensity: 0.6, depthWrite: false }),
  dTurqDark: decalMaterial('decal-turquoise-dark', { color: 0x16857a, roughness: 0.6 }),
  dTurqLight: decalMaterial('decal-turquoise-light', { color: 0x7fd8c8, roughness: 0.6 }),
  dShell: decalMaterial('decal-shell-white', { color: 0xf3ede0, roughness: 0.55 }),
  dRed: decalMaterial('decal-spondylus-red', { color: 0xc2452d, roughness: 0.55 }),
  dObsidian: decalMaterial('decal-obsidian', { color: 0x18181d, roughness: 0.2, clearcoat: 0.8 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-jade', { color: 0x123f2b, roughness: 0.7, side: THREE.DoubleSide }),
});

/**
 * 輪拱內襯（後輪）：輪拱切口後面的一段圓柱面（只取上半圈），z 從側壁內面往內 depth
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.3;
  const a1 = Math.PI - 0.3;
  const pos = [];
  /** @type {(t: number) => number} */
  const zIn = (t) => halfW(arch.x + r * Math.cos(t)) - 1.8;
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

/**
 * 羽片外形（局部座標：a 沿羽長 0–L、b 為半寬方向）：根部窄、中段最寬、尖端收尖；取 a ∈ [a0, a1] 一段
 * @type {(L: number, wMax: number, a0: number, a1: number) => number[][]} 回傳 [b, a] 多邊形
 */
const featherOutline = (L, wMax, a0, a1) => {
  /** @type {(a: number) => number} */
  const w = (a) => Math.max(0.15, wMax * Math.sin(Math.PI * (0.12 + (0.88 * a) / L)) ** 0.7);
  const n = 10;
  /** @type {number[][]} */
  const right = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    right.push([w(a), a]);
  }
  const left = right.map(([b, a]) => [-b, a]).reverse();
  return [...right, ...left];
};

/**
 * 立在 yz 平面的羽片（厚度沿 x）：先在局部平面畫外形，再依扇形角 fanDeg（0 = 直立、正值往 +z 倒）與後傾角 leanDeg 擺到根點
 * @type {(outline: number[][], thick: number, fanDeg: number, leanDeg: number, root: number[]) => THREE.BufferGeometry}
 */
const placeFeather = (outline, thick, fanDeg, leanDeg, root) => {
  const g = finPlate(outline, 0, thick);
  // 外形 (b, a) → (z, y)，厚度轉到 x
  g.rotateY(Math.PI / 2);
  g.rotateX((fanDeg * Math.PI) / 180);
  g.rotateZ((leanDeg * Math.PI) / 180);
  g.translate(root[0], root[1], root[2]);
  return g;
};

export const quetzalSerpentBody = makePolyBody({
  id: 'body-quetzal-serpent',
  name: '羽蛇',
  style: 'myth',
  phase: 8,
  mythSeries: 'mesoamerican',
  mythTheme: 'feathered-serpent',
  form: 'serpent',
  roof: 'canopy',
  wing: 'feather-fan',
  theme: '特奧蒂瓦坎羽蛇神殿的羽蛇頭：寬方蛇頭＋頭後羽毛領、細頸、兩階側壁的波浪稜線蛇身、黑曜石座艙罩、車尾綠咬鵑長羽扇',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面，稜線（3）、立板下緣（5）、內收階（6）為銳利稜線
  hard: [3, 5, 6],
  // 只有後輪拱（26 mm 輪：半徑 13 + 2.5）；前輪在細頸外側外露
  wheelArches: [{ x: -40, y: 13, radius: 15.5, cutZFrom: 25 }],
  canopy: {
    section: 'ellipse',
    // 中段座艙罩：x 24 → −16，最寬 11.5、最高 7.5（罩頂約 38.5）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 27;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(24, -16, u);
        const halfW = i === 0 || i === n ? 2.5 : 11.5 * Math.sin(Math.PI * u ** 0.85) ** 0.55;
        const rise = 7.5 * Math.sin(Math.PI * u ** 0.8) ** 0.65;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  recesses: [{ id: '黑曜石眼窩', view: 'top', shape: 'fn', sd: eyeSd, depth: 0.9 }],
  sideZMin: 20,
  innerSkipRecess: true,
  zones: () => [
    // 綠松石：頂面（稜線以上）
    { mat: 'turq', keep: (x, y) => y - (ridgeY(x) + 0.02) },
    // 翡翠綠：立板（稜線到立板下緣）
    { mat: 'jade', keep: (x, y) => y - (tableroY(x) - 0.1) },
    // 海菊蛤紅：內收階以下的斜坡（蛇頭段 = 下顎）
    { mat: 'red', keep: () => 1 },
  ],
  // 前臉：口線以上翡翠綠、以下海菊蛤紅（下顎）
  capFrontBands: [{ yMin: 17.5, mat: 'jade' }, { mat: 'red' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'red', recess: 'obsidian', recessWall: 'obsidian', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number) => number} 中線頂面高度 */
    const top = (x) => kit.surf.topY(x, 0);

    // 後輪拱內襯
    parts.push({ geometry: buildLiner({ x: -40, y: 13, radius: 15.5 }, 3.5), mat: 'liner', shell: true, name: 'arch-liners' });

    // 羽毛領：蛇頭後方一圈 13 片短羽（往前傾 12°，像從羽毛領中伸出的蛇頭；不往後傾以免碰到前輪），以細頸斷面中心 (y 18) 往外放射；綠松石 / 翡翠綠交替，羽尖螺貝白
    /** @type {{ x: number, yc: number, A: number, B: number, L: number, n: number, th0: number, th1: number, lean: number }} */
    const COLLAR = { x: 55.6, yc: 19, A: 20, B: 7.5, L: 11, n: 13, th0: 4, th1: 176, lean: -12 };
    /** @type {THREE.BufferGeometry[][]} [綠松石, 翡翠綠, 羽尖] */
    const collar = [[], [], []];
    for (let i = 0; i < COLLAR.n; i++) {
      const th = lerp(COLLAR.th0, COLLAR.th1, i / (COLLAR.n - 1));
      const t = (th * Math.PI) / 180;
      // 根點：細頸斷面橢圓上（埋入 8%）
      const rEll = 1 / Math.hypot(Math.cos(t) / COLLAR.A, Math.sin(t) / COLLAR.B);
      const r0 = 0.92 * rEll;
      const root = [COLLAR.x, COLLAR.yc + r0 * Math.sin(t), r0 * Math.cos(t)];
      // 扇形角：羽片沿放射方向（從 +y 往 +z 倒 90° − θ）
      const fan = 90 - th;
      collar[i % 2].push(placeFeather(featherOutline(COLLAR.L, 3.0, 0, 0.72 * COLLAR.L), 1.3, fan, COLLAR.lean, root));
      collar[2].push(placeFeather(featherOutline(COLLAR.L, 3.0, 0.72 * COLLAR.L, COLLAR.L), 1.3, fan, COLLAR.lean, root));
    }
    parts.push({ geometry: mergeGeos(collar[0]), mat: 'turq2', solid: true, outline: true, name: 'feather-collar-a' });
    parts.push({ geometry: mergeGeos(collar[1]), mat: 'jade2', solid: true, outline: true, name: 'feather-collar-b' });
    parts.push({ geometry: mergeGeos(collar[2]), mat: 'shell', solid: true, outline: true, name: 'feather-collar-tips' });

    // 車尾綠咬鵑長羽扇：7 片，扇形角 ±66°；中央往後傾 32°、往外側漸減到 9°（側視也看得到一把張開的扇）；中央最長（羽尖約 y 49.5），羽尖一段綠松石
    /** @type {{ x: number, fans: number[], lens: number[], lean: number }} */
    const FAN = { x: -58, fans: [-66, -44, -22, 0, 22, 44, 66], lens: [15, 18, 20.5, 21.5, 20.5, 18, 15], lean: 32 };
    const yRoot = top(FAN.x) - 1.6;
    /** @type {THREE.BufferGeometry[]} */
    const plumes = [];
    /** @type {THREE.BufferGeometry[]} */
    const plumeTips = [];
    FAN.fans.forEach((fan, i) => {
      const L = FAN.lens[i];
      const root = [FAN.x, yRoot, 0];
      const lean = FAN.lean - 0.35 * Math.abs(fan);
      plumes.push(placeFeather(featherOutline(L, 3.8, 0, 0.8 * L), 1.3, fan, lean, root));
      plumeTips.push(placeFeather(featherOutline(L, 3.8, 0.8 * L, L), 1.3, fan, lean, root));
    });
    parts.push({ geometry: mergeGeos(plumes), mat: 'plume', solid: true, outline: true, name: 'quetzal-plume-fan' });
    parts.push({ geometry: mergeGeos(plumeTips), mat: 'turq2', solid: true, outline: true, name: 'quetzal-plume-tips' });
    // 長羽根部的束帶（海菊蛤紅橫向圓肋，根部融進殼面）
    const bandPts = [];
    for (let k = 0; k <= 8; k++) {
      const z = lerp(-7, 7, k / 8);
      bandPts.push([FAN.x - 0.2, kit.surf.topY(FAN.x, z) - 0.4, z]);
    }
    parts.push({ geometry: sweepEllipse(bandPts, 24, () => [1.6, 1.4], 12), mat: 'red2', solid: true, outline: true, name: 'plume-binding' });

    // 蛇身側羽：沿兩側稜線下方伸出的短羽片（羽蛇身上的羽毛），每側 5 片、往後掠，根部埋進立板；俯視外緣成一列羽齒
    /** @type {number[]} 側羽中心 x */
    const SIDE_FEATHERS = [-52, -37, -22, -7, 8];
    /** @type {THREE.BufferGeometry[]} */
    const sideFeathers = [];
    for (const xc of SIDE_FEATHERS) {
      const zr = halfW(xc) - 1.6;
      const y = ridgeY(xc) - 2.6;
      const pts = [
        [xc + 3.2, zr],
        [xc + 1.2, zr + 3.4],
        [xc - 3.4, zr + 5.6],
        [xc - 6.2, zr + 5.2],
        [xc - 3.2, zr + 2.4],
        [xc - 3.4, zr],
      ];
      for (const sg of [-1, 1]) {
        sideFeathers.push(flatPlate(pts.map(([x, z]) => [x, sg * z]), y, 1.2));
      }
    }
    parts.push({ geometry: mergeGeos(sideFeathers), mat: 'plume', solid: true, outline: true, name: 'serpent-side-feathers' });

    // 綠松石馬賽克小片（頂面，避開座艙與眼窩）：深色 22%、淺色 14%
    /** @type {(lo: number, hi: number) => import('./loft.js').KeepFn} */
    const tiles = (lo, hi) => (x, y, z) => {
      if (y < ridgeY(x) + 0.4 || kit.underCanopy(x, z) > -0.8 || eyeSd(x, y, z) < 1.2) {
        return -1;
      }
      return mosaic(x, z, lo, hi);
    };
    parts.push({ geometry: kit.decal(tiles(0, 0.22)), mat: 'dTurqDark', name: 'decal-mosaic-dark' });
    parts.push({ geometry: kit.decal(tiles(0.22, 0.36)), mat: 'dTurqLight', name: 'decal-mosaic-light' });

    // 稜線下方的海菊蛤紅細線（沿波浪稜線，蛇身蜿蜒）
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < halfW(x) - 0.5 || x < X_TAIL + 2 ? -1 : 0.35 - Math.abs(y - (ridgeY(x) - 1.5)))),
      mat: 'dRed',
      name: 'decal-ridge-line',
    });
    // 階梯回紋帶（螺貝白，連續帶）：車身立板上，x −66 → 20，帶高 5.2（立板下緣往上 0.9 起）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < halfW(x) - 0.5 || x < -66 || x > 20) {
          return -1;
        }
        // 左側 u 反向，兩側紋樣都往車頭方向前進
        const u = z < 0 ? -x : x;
        return -fretSd(u - 1000, y - (tableroY(x) + 0.9));
      }),
      mat: 'dShell',
      name: 'decal-step-fret',
    });

    // 黑曜石眼窩外的螺貝白眼圈
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = eyeSd(x, y, z);
        return d > 5 ? -1 : Math.min(d - 0.15, 0.85 - d);
      }),
      mat: 'dShell',
      name: 'decal-eye-ring',
    });
    // 鼻孔：前臉上方兩個黑曜石小橢圓
    parts.push({
      geometry: kit.decal((x, y, z) => (y < 24 ? -1 : 1.1 - Math.hypot((x - 72.5) / 1.6, Math.abs(z) - 7))),
      mat: 'dObsidian',
      name: 'decal-nostrils',
    });
    // 螺貝白牙：蛇頭側面口線下一排小三角（往下尖）
    parts.push({
      geometry: kit.decal(
        sideDecal(
          (u, v) => {
            if (u < 61 || u > 75.2) {
              return 1;
            }
            const c = Math.round((u - 61.6) / 2.7) * 2.7 + 61.6;
            return sdConvexPolygon([
              [c - 0.9, 0],
              [c + 0.9, 0],
              [c, -2.0],
            ])(u, v);
          },
          { x0: 0, y0: 16.9, zMin: 20 },
        ),
      ),
      mat: 'dShell',
      name: 'decal-shell-teeth',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P＋ridgeY / tableroY（推估）：長 146（前臉 x 76、車尾 x −70，≤ 153）、殼頂約 33、座艙罩頂約 38.5、中央長羽尖約 49；細頸半寬 22（26 mm 前輪內側面 25.25 之內）；後輪拱 R15.5（26 mm 輪半徑 13 + 2.5，只支援 26 mm 輪）',
    feathers: '羽毛領 12 片、車尾長羽 7 片：厚 1.3 mm 的 ABS 實心羽片（推估），質量 = 封閉體積 × 1.05 g/cm³；根部埋進殼面',
    myth: '羽蛇頭＋羽毛領、黑曜石眼窩、藍底彩繪：MYTH_RESEARCH A2（特奧蒂瓦坎羽蛇神殿）、A3（Met 00.5.111 羽蛇頭）；綠松石 / 海菊蛤紅 / 螺貝白牙：A6（大英博物館雙頭蛇）；階梯回紋：A7',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
