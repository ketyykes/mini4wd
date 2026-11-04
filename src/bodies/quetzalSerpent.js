// 羽蛇（body-quetzal-serpent，第八階段神話組・阿茲特克 / 馬雅）：特奧蒂瓦坎羽蛇神殿立面伸出的羽蛇頭（頭後一圈羽毛領、眼窩嵌黑曜石），
// 加上阿茲特克綠松石馬賽克雙頭蛇的配色（綠松石面、海菊蛤紅嘴、螺貝白牙）。
// iter-113：原本的寬方頭＋一排白牙像鱷魚，改成羽蛇頭——頭後顎角最寬、往前收成圓尖蛇吻（吻端往上捲）、眼上捲紋、
// 張口（上顎前伸、兩根彎毒牙、紅色口內與分叉蛇信）；頭後一圈環繞頭部的放射狀大羽毛領（外圈長羽＋內圈紅短羽）；細頸（前輪外露）；
// 車身側面是 talud-tablero 式的兩階側壁，上緣稜線沿 x 波浪起伏（蛇身蜿蜒）；中段黑曜石色座艙罩；車尾 5 片側視寬羽扇（綠咬鵑尾羽）。
// 設計：shared/design/body-quetzal-serpent/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 8 節 A1–A3、A6、A7；黑名單 8-3）。剖面為本檔站位產生器（推估）。
// 紋樣與配色取自文物描述、圖形為自繪：綠松石小片馬賽克、連續帶狀階梯回紋（xicalcoliuhqui，不做四向旋轉單元）；
// 不做鷹＋蛇＋仙人掌組合、不用國旗色排列、不做骷髏 / 人祭圖像、不畫神像人臉；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdRoundRect, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -70;
/** @type {number} 蛇頭前臉 x（iter-113：蛇吻往前收成圓尖、往上翹） */
const X_NOSE = 78.5;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-70, -64, -56, -40, -20, 0, 14, 22, 30, 44, 52, 55, 58, 62, 66, 70, 73, 75.5, 77.5, 78.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬（基礎值，另加 halfW 的蛇身波浪）：蛇尾收尖（15）→ 車身罩住後輪（37.5）→ 往前收成細頸（14.5，前輪內側面 25.25 之內）→
  // iter-113：蛇頭不再是平行的寬方頭（原 32.5 寬方頭像鱷魚），改成頭後顎角最寬 20、往前收成圓尖蛇吻（俯視蛇頭的水滴形）
  hw: monoCurve(XS, [15, 25, 34, 37, 35.5, 30, 22.5, 17, 15, 14.5, 14.5, 15.5, 18.5, 20.2, 19.6, 17.2, 14.6, 11.6, 8.6, 6.5]),
  // 中線頂：後段蛇身 33 → 座艙段 31.5 → 細頸下凹 25 → 蛇頭 30（眼上）→ 蛇吻往上翹到 34.2（接上方的捲鼻）
  yTop: monoCurve(XS, [30, 32, 32.8, 33, 32, 31.5, 30, 27.5, 25.5, 25, 25.5, 26.5, 28, 29.5, 30, 30, 30.8, 32, 33.6, 34.2]),
  // 側裙下緣：車身 10.5–13（底盤側框段 ≥ 9.9）；細頸段抬到 18（底盤上方）；蛇頭下顎 12.5；
  // iter-113：下顎在 x 70 收掉、x 73 以前只剩上顎（張口：上顎前伸、兩根毒牙垂在下顎前方）
  yLow: monoCurve(XS, [22, 18, 13, 12, 11, 10.5, 14, 18, 18, 18, 18, 16, 13.5, 12.5, 12.5, 13.4, 18, 18.3, 18.6, 18.8]),
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
const EYE = { x: 64.5, z: 10.8, a: 3.8, b: 2.4 };
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

/**
 * 側視寬羽外形：沿羽軸 spine 兩側偏移（根部窄、中段最寬 wMax、尖端收尖），在 split 比例處切成羽身與羽尖兩段
 * @type {(spine: number[][], wMax: number, split: number) => number[][][]} 回傳 [羽身多邊形, 羽尖多邊形]（側視 x, y）
 */
const plumeOutline = (spine, wMax, split) => {
  const curve = new THREE.CatmullRomCurve3(spine.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  /** @type {(t: number) => number} 半寬分布 */
  const w = (t) => Math.max(0.12, wMax * Math.sin(Math.PI * (0.1 + 0.9 * t)) ** 0.8 * (t < 0.6 ? 0.55 + 0.45 * (t / 0.6) : 1));
  /** @type {(t0: number, t1: number) => number[][]} */
  const piece = (t0, t1) => {
    /** @type {number[][]} */
    const left = [];
    /** @type {number[][]} */
    const right = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = lerp(t0, t1, i / n);
      const p = curve.getPointAt(t);
      const tg = curve.getTangentAt(t);
      left.push([p.x - tg.y * w(t), p.y + tg.x * w(t)]);
      right.push([p.x + tg.y * w(t), p.y - tg.x * w(t)]);
    }
    return [...left, ...right.reverse()];
  };
  return [piece(0, split), piece(split, 1)];
};

/**
 * 立板（側視多邊形，沿 z 給厚度）以指定支點高度 pivotY 往外傾 tiltDeg（分段上色的各段共用支點，接縫才對得上）
 * @type {(pts: number[][], zc: number, thick: number, tiltDeg: number, pivotY: number) => THREE.BufferGeometry}
 */
const tiltPlate = (pts, zc, thick, tiltDeg, pivotY) => {
  const g = finPlate(pts, 0, thick);
  g.translate(0, -pivotY, 0);
  g.rotateX((-tiltDeg * Math.PI) / 180);
  g.translate(0, pivotY, zc);
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
  theme: '特奧蒂瓦坎羽蛇神殿的羽蛇頭：上捲蛇吻＋彎毒牙的蛇頭、環繞頭部一圈的放射狀大羽毛領、細頸、兩階側壁的波浪稜線蛇身、黑曜石座艙罩、車尾綠咬鵑寬羽扇',
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

    // ── 羽毛領（iter-113 放大，最主要的辨識特徵）：特奧蒂瓦坎羽蛇頭像那種環繞頭部一圈的放射狀大羽片 ──
    // 外圈 17 片長羽（長 20、寬 10；綠松石 / 翡翠綠交替、羽尖螺貝白）、內圈 16 片短羽（海菊蛤紅，錯開半格、在外圈前方），
    // 以頭後斷面中心 (x 57, y 20) 往外放射，從兩側略低於水平（−10°）繞過頭頂到另一側；上方羽片往後傾 22°（側視也看得到一片羽冠）
    /** @type {{ x: number, yc: number, A: number, B: number, L: number, w: number, n: number, th0: number, th1: number, lean: number }} */
    const RUFF = { x: 57, yc: 20, A: 17.4, B: 7.4, L: 20, w: 5.0, n: 17, th0: -10, th1: 190, lean: 22 };
    /** @type {THREE.BufferGeometry[][]} [綠松石, 翡翠綠, 羽尖, 內圈紅] */
    const ruff = [[], [], [], []];
    /** @type {(th: number, k: number) => number[]} 羽根點：頭後斷面橢圓上（埋入比例 k） */
    const ruffRoot = (th, k) => {
      const t = (th * Math.PI) / 180;
      const rEll = 1 / Math.hypot(Math.cos(t) / RUFF.A, Math.sin(t) / RUFF.B);
      return [RUFF.x, RUFF.yc + k * rEll * Math.sin(t), k * rEll * Math.cos(t)];
    };
    for (let i = 0; i < RUFF.n; i++) {
      const th = lerp(RUFF.th0, RUFF.th1, i / (RUFF.n - 1));
      const root = ruffRoot(th, 0.9);
      // 扇形角：羽片沿放射方向（從 +y 往 +z 倒 90° − θ）
      const fan = 90 - th;
      ruff[i % 2].push(placeFeather(featherOutline(RUFF.L, RUFF.w, 0, 0.78 * RUFF.L), 1.1, fan, RUFF.lean, root));
      ruff[2].push(placeFeather(featherOutline(RUFF.L, RUFF.w, 0.78 * RUFF.L, RUFF.L), 1.1, fan, RUFF.lean, root));
    }
    for (let i = 0; i < RUFF.n - 1; i++) {
      const th = lerp(RUFF.th0, RUFF.th1, (i + 0.5) / (RUFF.n - 1));
      const root = ruffRoot(th, 0.95);
      root[0] += 1.2;
      ruff[3].push(placeFeather(featherOutline(7.5, 3.0, 0, 7.5), 1.0, 90 - th, RUFF.lean, root));
    }
    parts.push({ geometry: mergeGeos(ruff[0]), mat: 'turq2', solid: true, outline: true, name: 'feather-ruff-a' });
    parts.push({ geometry: mergeGeos(ruff[1]), mat: 'jade2', solid: true, outline: true, name: 'feather-ruff-b' });
    parts.push({ geometry: mergeGeos(ruff[2]), mat: 'shell', solid: true, outline: true, name: 'feather-ruff-tips' });
    parts.push({ geometry: mergeGeos(ruff[3]), mat: 'red2', solid: true, outline: true, name: 'feather-ruff-inner' });

    // ── 蛇吻往上捲（實體件，翡翠綠）：從吻端頂面往前上捲起再往後收，像羽蛇頭像上翹的鼻端 ──
    parts.push({
      geometry: smoothNormals(
        sweepEllipse(
          [
            [68, top(68) - 1.6, 0],
            [73.5, top(73.5) - 1.0, 0],
            [77.4, top(77.4) + 0.4, 0],
            [79, 36.8, 0],
            [78.2, 39.6, 0],
            [75.8, 40.4, 0],
            [74, 39.2, 0],
            [74.4, 37.4, 0],
          ],
          48,
          (t) => [lerp(5.6, 3, t), lerp(2.3, 1.3, t)],
          20,
        ),
      ),
      mat: 'jade2',
      solid: true,
      outline: true,
      name: 'snout-curl',
    });
    // 眼上捲紋（海菊蛤紅實體細條）：從眼後沿眼上方往前、尾端往下捲成小鉤
    {
      /** @type {THREE.BufferGeometry[]} */
      const scrolls = [];
      for (const sg of [-1, 1]) {
        /** @type {(x: number, dz: number, dy: number) => number[]} 眼窩外側 dz、殼面上方 dy 的點 */
        const at = (x, dz, dy) => {
          const z = EYE.z + dz;
          return [x, kit.surf.topY(x, z) + dy, sg * z];
        };
        scrolls.push(
          sweepEllipse(
            [at(59.2, 1.6, -0.4), at(62, 2.8, 0.2), at(65.4, 2.9, 0.5), at(68.4, 1.4, 0.5), at(69, -0.6, 0.3), at(67.6, -1.6, 0.1), at(66.4, -0.6, 0)],
            28,
            (t) => [lerp(0.95, 0.65, t), lerp(1.2, 0.8, t)],
            10,
          ),
        );
      }
      parts.push({ geometry: mergeGeos(scrolls), mat: 'red2', solid: true, outline: true, name: 'eye-scrolls' });
    }
    // 兩根彎曲毒牙（螺貝白實體件）：上顎前角往下、往後彎（不做整排牙）
    {
      /** @type {THREE.BufferGeometry[]} */
      const fangs = [];
      for (const sg of [-1, 1]) {
        fangs.push(
          sweepEllipse(
            [
              [73.6, 18.6, sg * 6.2],
              [74.6, 16.4, sg * 6.4],
              [74.4, 13.8, sg * 6.6],
              [73, 11.9, sg * 6.6],
            ],
            20,
            (t) => [lerp(1.25, 0.18, t ** 0.9), lerp(1.25, 0.18, t ** 0.9)],
            12,
          ),
        );
      }
      parts.push({ geometry: mergeGeos(fangs), mat: 'shell', solid: true, outline: true, name: 'serpent-fangs' });
    }
    // 口內（海菊蛤紅）：上顎下方的口頂板（封住上顎殼內，張口處看到紅色口腔）＋往前伸的分叉蛇信
    {
      /** @type {number[][]} 口頂板外形（俯視 x, z）：沿上顎內側 */
      const roof = [];
      for (let i = 0; i <= 10; i++) {
        const x = lerp(69.5, 78, i / 10);
        roof.push([x, halfW(x) - 0.9]);
      }
      const roofPts = [...roof, ...roof.map(([x, z]) => [x, -z]).reverse()];
      parts.push({ geometry: flatPlate(roofPts, 17.7, 0.6), mat: 'red2', solid: true, name: 'mouth-roof' });
      // 蛇信：從下顎前緣（x 69）往前伸到 x 80，前端分叉（厚 0.8，寬 2.2）
      const tongue = [
        [68.5, 1.1],
        [76.6, 1.1],
        [80.4, 2.4],
        [80.6, 1.6],
        [77.8, 0.3],
        [77.8, -0.3],
        [80.6, -1.6],
        [80.4, -2.4],
        [76.6, -1.1],
        [68.5, -1.1],
      ];
      parts.push({ geometry: flatPlate(tongue, 15.2, 0.8), mat: 'red2', solid: true, outline: true, name: 'forked-tongue' });
    }

    // 車尾綠咬鵑長羽扇（iter-113 加寬、改成側視看得到的羽面）：5 片側視寬羽（xy 平面立板），以往外傾角 ±24°、±48° 張成扇形
    // （後視是一把扇、側視是一束往後上掠的寬羽）；中央最長，羽尖一段綠松石
    /** @type {{ x: number, tilts: number[], scale: number[] }} */
    const FAN = { x: -55, tilts: [-48, -24, 0, 24, 48], scale: [0.72, 0.88, 1, 0.88, 0.72] };
    /** @type {THREE.BufferGeometry[]} */
    const plumes = [];
    /** @type {THREE.BufferGeometry[]} */
    const plumeTips = [];
    const yRoot = top(FAN.x) - 1.2;
    FAN.tilts.forEach((tilt, i) => {
      const sc = FAN.scale[i];
      /** @type {number[][]} 羽軸（側視，根 → 尖）：往後上掠、尖端微往後垂 */
      const spine = [
        [FAN.x, yRoot],
        [FAN.x - 4 * sc, yRoot + 7 * sc],
        [FAN.x - 9 * sc, yRoot + 13.5 * sc],
        [FAN.x - 13.5 * sc, yRoot + 18.5 * sc],
        [FAN.x - 16 * sc, yRoot + 21 * sc],
      ];
      const [body, tip] = plumeOutline(spine, 3.4 * sc + 0.6, 0.76);
      plumes.push(tiltPlate(body, 0, 1.2, tilt, yRoot));
      plumeTips.push(tiltPlate(tip, 0, 1.2, tilt, yRoot));
    });
    parts.push({ geometry: mergeGeos(plumes), mat: 'plume', solid: true, outline: true, name: 'quetzal-plume-fan' });
    parts.push({ geometry: mergeGeos(plumeTips), mat: 'turq2', solid: true, outline: true, name: 'quetzal-plume-tips' });
    // 長羽根部的束帶（海菊蛤紅橫向圓肋，根部融進殼面）
    const bandPts = [];
    for (let k = 0; k <= 8; k++) {
      const z = lerp(-7, 7, k / 8);
      bandPts.push([FAN.x - 1.2, kit.surf.topY(FAN.x - 1.2, z) - 0.4, z]);
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
      // iter-113：羽片往外加長（外伸 5.6 → 7.8），俯視一列更明顯的羽齒
      const pts = [
        [xc + 3.2, zr],
        [xc + 1.4, zr + 4.6],
        [xc - 3.4, zr + 7.8],
        [xc - 6.6, zr + 7.2],
        [xc - 3.4, zr + 3.2],
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
      geometry: kit.decal((x, y, z) => (y < 24 ? -1 : 0.9 - Math.hypot((x - 69.6) / 1.5, Math.abs(z) - 4.2))),
      mat: 'dObsidian',
      name: 'decal-nostrils',
    });
    // 嘴線（黑曜石色）：蛇頭側面口線，後端往上捲（嘴角上揚的羽蛇頭像）；iter-113 取代原本整排白牙
    parts.push({
      geometry: kit.decal(
        sideDecal(
          (u, v) => {
            if (u < 58 || u > 79) {
              return 1;
            }
            const line = Math.max(Math.abs(v - 17.6) - 0.45, 61.4 - u);
            // 嘴角：口線後端往上繞半圈的鉤（圓心 (61.4, 20.2)、半徑 2.6）
            const corner = Math.max(Math.abs(Math.hypot(u - 61.4, v - 20.2) - 2.6) - 0.45, u - 61.4);
            return Math.min(line, corner);
          },
          { x0: 0, y0: 0, zMin: 3 },
        ),
      ),
      mat: 'dObsidian',
      name: 'decal-mouth-line',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P＋ridgeY / tableroY（推估）：外框長 152.0（車尾長羽尖 x −71.3 → 蛇信 x 80.6 / 捲鼻 80.7，≤ 153）、殼頂約 33、蛇頭頂 30 → 吻端 34.2、捲鼻頂約 42、羽毛領頂約 45.5、座艙罩頂約 38.5、中央長羽尖約 52.9；細頸半寬 14.5（26 mm 前輪內側面 25.25 之內）；後輪拱 R15.5（26 mm 輪半徑 13 + 2.5，只支援 26 mm 輪）',
    feathers: '羽毛領外圈 17 片（長 20、寬 10、厚 1.1）＋內圈 16 片（長 7.5、厚 1.0）、車尾寬羽 5 片（厚 1.2）、捲鼻、眼上捲紋、毒牙、口頂板、蛇信：ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；根部埋進殼面',
    myth: '羽蛇頭＋羽毛領、黑曜石眼窩、藍底彩繪：MYTH_RESEARCH A2（特奧蒂瓦坎羽蛇神殿）、A3（Met 00.5.111 羽蛇頭）；綠松石 / 海菊蛤紅 / 螺貝白牙：A6（大英博物館雙頭蛇）；階梯回紋：A7',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
