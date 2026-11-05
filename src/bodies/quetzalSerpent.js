// 羽蛇（body-quetzal-serpent，神話組・阿茲特克 / 馬雅）：特奧蒂瓦坎羽蛇神殿的階梯金字塔與綠咬鵑羽。
// 不做蛇頭、眼、牙與蛇信，主題用四種元素表現：
// (1) 階梯金字塔 → 車身：頂面由車尾往鼻尖一階一階下降的平台（階面貼金），側視是一道階梯楔形；側面是 talud-tablero 的立板＋內收斜坡兩階；
//     尾翼的翼端板是階梯金字塔的側影，上下兩片翼面各站在一階上；
// (2) 層疊的羽 → 翼片：尾翼的兩層翼面、車身兩側各 3 片往後掠的金色短翼片；
// (3) 紋樣與配色：立板上連續帶狀的階梯回紋（xicalcoliuhqui，不做四向旋轉單元）、頂面的馬賽克小片；綠咬鵑金屬綠＋綠松石＋海菊蛤紅＋金；
// (4) 黑曜石：鼻端最前一階與前輪擋泥板後緣往後伸的一對鰭刀是亮面黑曜石色。
// 細頸（前輪外露，上方有擋泥板）、中段黑曜石色座艙罩。
// 設計：shared/design/body-quetzal-serpent/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 8 節 A1、A2、A6、A7；黑名單 8-3）。剖面為本檔站位產生器（推估）。
// 不做鷹＋蛇＋仙人掌組合、不用國旗色排列、不做骷髏 / 人祭圖像、不畫神像人臉；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, flatPlate, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sdRoundRect, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve } from './gazelleLeap.js';
import { buildBellySkirt } from './trojanHorse.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -70;
/** @type {number} 鼻尖 x（平切的鑿形鼻） */
const X_NOSE = 78.5;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-70, -64, -56, -40, -20, 0, 14, 22, 30, 44, 52, 58, 62, 66, 70, 74, 78.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬（基礎值，另加 halfW 的左右波浪）：平切的車尾（16）→ 車身罩住後輪（37）→ 往前收成細頸（14.5，前輪內側面 25.25 之內）→
  // 鼻段放寬成一塊平台（20.5）再收到平切鼻尖（13）；兩輪之間收窄（x −20 / 0 / 14：33.5 / 28.5 / 19.5），再窄會從 front34 看進電池艙
  hw: monoCurve(XS, [16, 22, 32, 37, 33.5, 28.5, 19.5, 17, 15, 14.5, 14.5, 17.5, 20, 20.5, 19, 16.5, 13]),
  // 側裙下緣：車身 10.5–13（底盤側框段 ≥ 9.9）；細頸與鼻段抬到 16.6–18.6（底盤上方），鼻段是一片薄的鑿形鼻（鼻尖厚約 4）
  yLow: monoCurve(XS, [20, 17, 13, 12, 11, 10.5, 14, 18, 18, 18, 18, 17.4, 16.8, 16.6, 16.6, 17.2, 18.6]),
};

/** @type {number} 階面（talud）的水平長度：平台之間以 1.6 mm 的斜面相接 */
const RISER = 1.6;
/** @type {number[][]} 頂面平台 [前緣 x, 平台高]，由後到前逐階下降（最後一階到鼻尖）：後平台 → 座艙平台 → 細頸 → 鼻段 → 鼻端 */
const TERRACES = [
  [-26, 34],
  [27, 31],
  [51, 28],
  [65, 25.4],
  [X_NOSE, 22.8],
];
/** @type {{ x: number, drop: number }} 車尾再往下一階（金字塔背面）：x −60 以後低 3 mm */
const TAIL_STEP = { x: -60, drop: 3 };

/** @type {(x: number, x0: number) => number} 階面斜坡：x0 之前為 1，往前 RISER mm 線性降到 0 */
const riser = (x, x0) => 1 - Math.min(1, Math.max(0, (x - x0) / RISER));

/**
 * 中線頂高：階梯平台（前低後高的楔形由一階一階的平台組成）
 * @type {(x: number) => number}
 */
const topY = (x) => {
  let y = TERRACES[TERRACES.length - 1][1];
  for (let i = 0; i < TERRACES.length - 1; i++) {
    y += (TERRACES[i][1] - TERRACES[i + 1][1]) * riser(x, TERRACES[i][0]);
  }
  return y - TAIL_STEP.drop * riser(-x, -TAIL_STEP.x);
};

/** @type {{ amp: number, len: number, peak: number }} 車身左右波浪：振幅 3.2、波長 46 mm，波峰落在後輪軸（x −40）——後輪處外擴、兩輪之間收腰 */
const WAVE = { amp: 3.2, len: 46, peak: -40 };

/**
 * 半寬＝基礎值＋車身段的左右波浪（車尾與細頸前漸消失）
 * @type {(x: number) => number}
 */
const halfW = (x) => {
  const env = smoothstep(-64, -54, x) * (1 - smoothstep(0, 12, x));
  return P.hw(x) + WAVE.amp * env * Math.cos((2 * Math.PI * (x - WAVE.peak)) / WAVE.len);
};

/**
 * 側壁上緣稜線高度：頂面平台下 3.2 mm，跟著平台一階一階走
 * @type {(x: number) => number}
 */
const ridgeY = (x) => topY(x) - 3.2;

/**
 * 立板（tablero）下緣：稜線下 8 mm；細頸與鼻段側壁矮，夾在下緣上 1.2 mm 與稜線下 1.6 mm 之間
 * @type {(x: number) => number}
 */
const tableroY = (x) => Math.min(ridgeY(x) - 1.6, Math.max(P.yLow(x) + 1.2, ridgeY(x) - 8));

/**
 * 半剖面 8 點：頂面（中線 → 頂面外緣）→ 稜線（銳利）→ 立板 tablero（垂直）→ 立板下緣（銳利）→ 內收一階（銳利）→ 斜坡 talud 到下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = halfW(x);
  const yTop = topY(x);
  const yR = ridgeY(x);
  const yT = tableroY(x);
  const yLow = P.yLow(x);
  return [
    [0, yTop],
    [0.5 * hw, yTop - 0.35],
    [hw - 3.5, lerp(yR, yTop, 0.5)],
    [hw - 0.6, yR],
    [hw, yR - 1],
    [hw, yT],
    [hw - 1.5, yT - 0.5],
    [hw - 0.4, yLow],
  ];
};

/** @type {number[]} 站位 x：每 2 mm 一站，另在每道階面的兩端各放一站（階面才是一道平的斜面，不會被相鄰站位抹平） */
const STATION_XS = (() => {
  const edges = [...TERRACES.slice(0, -1).flatMap(([x0]) => [x0, x0 + RISER]), TAIL_STEP.x - RISER, TAIL_STEP.x];
  const xs = [...edges, X_NOSE];
  for (let x = X_TAIL; x < X_NOSE - 0.7; x += 2) {
    if (edges.every((e) => Math.abs(e - x) > 0.7)) {
      xs.push(x);
    }
  }
  return xs.sort((a, b) => a - b);
})();
/** @type {{ x: number, pts: number[][] }[]} 站位表 */
const STATIONS = STATION_XS.map((x) => ({ x, pts: profile(x) }));

/**
 * 可重現的格點雜湊（0–1）
 * @type {(i: number, j: number) => number}
 */
const hash2 = (i, j) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * 綠松石馬賽克：5.2 mm 方格（格子太小時頂面紋樣會細碎得像雜訊），依雜湊挑出一部分格子畫成內縮 0.6 mm 的小片（深 / 淺兩色各一組）
 * @type {(x: number, z: number, lo: number, hi: number) => number} 回傳正值 = 在被挑中的小片內
 */
const mosaic = (x, z, lo, hi) => {
  const c = 5.2;
  const i = Math.floor(x / c);
  const j = Math.floor(z / c);
  const h = hash2(i, j);
  if (h < lo || h >= hi) {
    return -1;
  }
  return -sdRoundRect(x, z, i * c + 0.6, (i + 1) * c - 0.6, j * c + 0.6, (j + 1) * c - 0.6, 0.6);
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
  // 頂面：綠咬鵑羽的金屬綠亮面漆；立板：綠松石馬賽克的霧面（roughness > 0.5）；斜坡：海菊蛤紅霧面——亮面金屬漆對石材霧面
  green: namedMaterial('paint-quetzal-green-metallic', { color: 0x168a5a, roughness: 0.28, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  green2: namedMaterial('paint-quetzal-green-metallic', { color: 0x168a5a, roughness: 0.28, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  turq: namedMaterial('paint-turquoise-mosaic', { color: 0x2bb3a3, roughness: 0.62, clearcoat: 0.1 }),
  turq2: namedMaterial('paint-turquoise-mosaic', { color: 0x2bb3a3, roughness: 0.62, clearcoat: 0.1, side: THREE.DoubleSide }),
  red: namedMaterial('paint-spondylus-red', { color: 0xc2452d, roughness: 0.6, clearcoat: 0.1 }),
  red2: namedMaterial('paint-spondylus-red', { color: 0xc2452d, roughness: 0.6, clearcoat: 0.1, side: THREE.DoubleSide }),
  // 真金屬：尾翼翼端板與側翼片（Blender 依 -brass 結尾換成金屬）
  gold: namedMaterial('trim-gold-brass', { color: 0xd9b24a, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 黑曜石：亮面黑（鼻端一階、鰭刀）
  obsidian: namedMaterial('paint-obsidian-gloss', { color: 0x1c1c22, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  obsidian2: namedMaterial('paint-obsidian-gloss', { color: 0x1c1c22, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x15201c, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-jade', { color: 0x17603c, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x121416, roughness: 0.6 }),
  // 黑曜石色煙燻座艙罩
  glass: namedMaterial('pc-smoke-tint', { color: 0x16161c, roughness: 0.05, specularIntensity: 0.7, transparent: true, opacity: 0.8, envMapIntensity: 0.6, depthWrite: false }),
  dTurqLight: decalMaterial('decal-turquoise-light', { color: 0x7fd8c8, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-leaf', { color: 0xe0bd55, roughness: 0.3, metalness: 0.7 }),
  dShell: decalMaterial('decal-shell-white', { color: 0xf3ede0, roughness: 0.55 }),
  dRed: decalMaterial('decal-spondylus-red', { color: 0xc2452d, roughness: 0.55 }),
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
 * 前輪擋泥板參數：前輪要有輪拱遮蓋，每個前輪上方一片厚 1.3 mm 的弧形擋泥板（以前軸為圓心、內半徑 16.4，
 * 26 mm 輪胎頂上留 3.4 mm、厚 1.25），z 26.5 → 36.4 蓋住胎面外側 8 mm 並外伸 2 mm（26 mm 輪 25.25–34.25；往外偏是為了俯視 IoU），前後各蓋到輪頂兩側 35°（x 30–50；俯視 IoU 每一 x 只看最寬處，擋泥板再長會和 marlin-sail 的 IoU 超過 0.82）；
 * 擋泥板用一片斜撐板接到細頸側面（只在 x 36–44，細頸與擋泥板之間其餘保持鏤空——細頸的俯視輪廓不變寬）
 * @type {{ x: number, y: number, rIn: number, t: number, a0: number, a1: number, z0: number, z1: number, bev: number }}
 */
const FENDER = { x: 40, y: 13, rIn: 16.4, t: 1.25, a0: 55, a1: 125, z0: 26.5, z1: 36.4, bev: 0.5 };

/**
 * 一片前輪擋泥板（側視圓環扇形沿 z 擠出，四周倒 0.5 mm 圓角）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildFender = (sg) => {
  const f = FENDER;
  const a0 = (f.a0 * Math.PI) / 180;
  const a1 = (f.a1 * Math.PI) / 180;
  const shape = new THREE.Shape();
  shape.absarc(f.x, f.y, f.rIn + f.t, a0, a1, false);
  shape.absarc(f.x, f.y, f.rIn, a1, a0, true);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: f.z1 - f.z0 - 2 * f.bev,
    bevelEnabled: true,
    bevelThickness: f.bev,
    bevelSize: f.bev,
    bevelOffset: -f.bev,
    // 16 段（面數預算；弧長 20 mm，16 段已看不出折角）
    bevelSegments: 2,
    curveSegments: 16,
  });
  g.translate(0, 0, (sg > 0 ? f.z0 : -f.z1) + f.bev);
  return g;
};

/**
 * 擋泥板斜撐：從細頸側面（|z| 11.5，埋進殼內）斜上到擋泥板內側（|z| 27.2，埋進擋泥板），x 37.5–42.5，垂直厚 1.4 mm（板法向厚約 1.28）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildFenderStay = (sg) => {
  /** @type {number[][]} 斷面（z, y） */
  const sec = [
    [11.5, 22.6],
    [27.2, 29.3],
    [27.2, 30.6],
    [11.5, 24.0],
  ];
  const shape = new THREE.Shape(sec.map(([z, y]) => new THREE.Vector2(sg * z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelOffset: -0.3, bevelSegments: 2 });
  // 斷面 (z, y) 擠出沿 −x：rotateY(−90°) 把形狀 x → 世界 z、擠出 z → 世界 −x
  g.rotateY(-Math.PI / 2);
  g.translate(42.5, 0, 0);
  return g;
};

/** @type {number} 尾翼翼端板的 |z|（x −66 以前在殼面之內，最後一小段懸在收窄的車尾外側） */
const WING_Z = 20;
/** @type {number[][]} 翼端板側視外形 (x, y)：三階往車尾升高的階梯金字塔側影（每階高 4、階面略斜），底邊埋進後平台與車尾平台 */
const ENDPLATE = [
  [-33, 30],
  [-33, 33.5],
  [-39.5, 38],
  [-47, 38],
  [-48, 42],
  [-56, 42],
  [-57, 46],
  [-70.5, 46],
  [-70.5, 41.5],
  [-65, 30],
];
/** @type {{ x0: number, x1: number, y: number, notch: number }[]} 兩層翼面（厚 1.6）：下層站在第二階（頂 42）、上層站在第三階（頂 46，比座艙罩頂高 7.5）；前緣中央往後凹 notch mm 的淺 V */
const WING_PLANES = [
  { x0: -48.5, x1: -56.5, y: 40.4, notch: 2 },
  { x0: -57.5, x1: -70.5, y: 44.4, notch: 3.5 },
];

/**
 * 一層翼面：俯視是前緣中央淺 V 的長板，兩端埋進翼端板
 * @type {(p: { x0: number, x1: number, y: number, notch: number }) => THREE.BufferGeometry}
 */
const buildWingPlane = (p) =>
  flatPlate(
    [
      [p.x0, WING_Z + 0.4],
      [p.x0 - p.notch, 0],
      [p.x0, -WING_Z - 0.4],
      [p.x1, -WING_Z - 0.4],
      [p.x1, WING_Z + 0.4],
    ],
    p.y,
    1.6,
  );

/** @type {number[][]} 黑曜石鰭刀側視外形 (x, y)：接在前輪擋泥板後緣（x 30–33），往後收成一個尖（x 6），厚 1.4 */
const BLADE = [
  [33, 29],
  [22, 30.2],
  [6, 27.2],
  [20, 26.6],
  [30.5, 25.6],
];

export const quetzalSerpentBody = makePolyBody({
  id: 'body-quetzal-serpent',
  name: '羽蛇',
  style: 'myth',
  phase: 8,
  mythSeries: 'mesoamerican',
  mythTheme: 'feathered-serpent',
  form: 'step-pyramid',
  roof: 'canopy',
  wing: 'terrace-wing',
  theme: '特奧蒂瓦坎羽蛇神殿的階梯金字塔，不做蛇頭：頂面由車尾往鼻尖一階一階下降的平台（階面貼金）、側面是立板＋斜坡兩階，立板上一道連續的階梯回紋；尾翼是階梯金字塔側影的金色翼端板＋上下兩層翼面，車身兩側各 3 片後掠的金色短翼片；綠咬鵑金屬綠配綠松石、海菊蛤紅與金，鼻端一階與擋泥板後緣的一對鰭刀是黑曜石色；細頸露出前輪、黑曜石色座艙罩',
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
    // 中段座艙罩：x 24 → −16（座艙平台上），最寬 11.5、最高 7.5（罩頂約 38.5）
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
  sideZMin: 20,
  zones: () => [
    // 黑曜石：鼻端最前一階
    { mat: 'obsidian', keep: (x) => x - (TERRACES[3][0] + RISER) },
    // 金屬綠：頂面（稜線以上）
    { mat: 'green', keep: (x, y) => y - (ridgeY(x) + 0.02) },
    // 綠松石：立板（稜線到立板下緣）
    { mat: 'turq', keep: (x, y) => y - (tableroY(x) - 0.1) },
    // 海菊蛤紅：內收階以下的斜坡
    { mat: 'red', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'obsidian' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'red', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 腹側裙板（朱紅，接續後段紅色斜坡）：遮住側面外露的電池管——細頸段（x 2 → 21.5；x < 2 已由紅色斜坡蓋住）每側一片直立外板，
    // 外緣 |z| 35.5（底盤側框外緣）、y 10.5 → 17；棚板只做 2 條寬 2.4 mm 的橫撐（x 3.2 / 11，細頸側壁下緣 < 17 處）接到細頸側壁（半寬 − 1.2）
    parts.push({
      geometry: buildBellySkirt({ x0: 2, x1: 21.5, zIn: (x) => halfW(x) - 1.2, zOut: 35.5, yTop: 17, ribs: [3.2, 11] }),
      mat: 'red2',
      solid: true,
      outline: true,
      name: 'belly-skirt',
    });
    // 後輪拱內襯
    parts.push({ geometry: buildLiner({ x: -40, y: 13, radius: 15.5 }, 3.5), mat: 'liner', shell: true, name: 'arch-liners' });
    // 前輪擋泥板＋接到細頸的斜撐
    parts.push({ geometry: mergeGeos([buildFender(1), buildFender(-1)]), mat: 'green2', solid: true, outline: true, name: 'front-fenders' });
    parts.push({ geometry: mergeGeos([buildFenderStay(1), buildFenderStay(-1)]), mat: 'turq2', solid: true, outline: true, name: 'front-fender-stays' });
    // 黑曜石鰭刀：擋泥板後緣往後伸的一對直立薄刃（在擋泥板寬度中央）
    const bladeZ = (FENDER.z0 + FENDER.z1) / 2;
    parts.push({
      geometry: mergeGeos([finPlate(BLADE, bladeZ, 1.4), finPlate(BLADE, -bladeZ, 1.4)]),
      mat: 'obsidian2',
      solid: true,
      outline: true,
      name: 'obsidian-fin-blades',
    });

    // 階梯尾翼：金色翼端板（階梯金字塔側影）＋兩層翼面（下層海菊蛤紅、上層金屬綠），翼端板底邊埋進殼面
    parts.push({
      geometry: mergeGeos([finPlate(ENDPLATE, WING_Z, 1.6), finPlate(ENDPLATE, -WING_Z, 1.6)]),
      mat: 'gold',
      solid: true,
      outline: true,
      name: 'terrace-wing-endplates',
    });
    parts.push({ geometry: buildWingPlane(WING_PLANES[0]), mat: 'red2', solid: true, outline: true, name: 'terrace-wing-lower' });
    parts.push({ geometry: buildWingPlane(WING_PLANES[1]), mat: 'green2', solid: true, outline: true, name: 'terrace-wing-upper' });

    // 側翼片：沿兩側稜線下方伸出的短翼片（層疊的羽），每側 3 片、往後掠，根部埋進立板；俯視外緣成一列齒
    /** @type {number[]} 側翼片中心 x（兩輪之間的收腰段不放，俯視的腰身才收得進去） */
    const SIDE_VANES = [-52, -37, -22];
    /** @type {THREE.BufferGeometry[]} */
    const sideVanes = [];
    for (const xc of SIDE_VANES) {
      const zr = halfW(xc) - 1.6;
      const y = ridgeY(xc) - 2.6;
      const pts = [
        [xc + 3.2, zr],
        [xc + 1.4, zr + 4.6],
        [xc - 3.4, zr + 7.8],
        [xc - 6.6, zr + 7.2],
        [xc - 3.4, zr + 3.2],
        [xc - 3.4, zr],
      ];
      for (const sg of [-1, 1]) {
        sideVanes.push(flatPlate(pts.map(([x, z]) => [x, sg * z]), y, 1.2));
      }
    }
    parts.push({ geometry: mergeGeos(sideVanes), mat: 'gold', solid: true, outline: true, name: 'side-vanes' });

    /** @type {number} 貼紙只貼到黑曜石鼻端之前 */
    const xDecalMax = TERRACES[3][0] - 0.4;
    // 階面貼金：每一道階面（含車尾那一階）橫貫頂面的金帶，讓平台一階一階讀得出來
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < ridgeY(x) + 0.3 || kit.underCanopy(x, z) > -0.6) {
          return -1;
        }
        const edges = [...TERRACES.slice(0, -1).map(([x0]) => x0 + RISER / 2), TAIL_STEP.x - RISER / 2];
        return Math.max(...edges.map((xe) => RISER / 2 + 0.35 - Math.abs(x - xe)));
      }),
      mat: 'dGold',
      name: 'decal-riser-gold',
    });
    // 馬賽克小片（頂面，避開座艙與階面）：大片、稀疏——綠松石 16%、金 10%
    /** @type {(lo: number, hi: number) => import('./loft.js').KeepFn} */
    const tiles = (lo, hi) => (x, y, z) => {
      if (y < ridgeY(x) + 0.4 || x > xDecalMax || kit.underCanopy(x, z) > -0.8) {
        return -1;
      }
      // 小片排成往前尖的箭形列（x 依 |z| 錯開 = 往後掃）、密度由鼻段往車尾遞減（速度感）
      const f = lerp(0.45, 1.25, smoothstep(-60, 60, x));
      return mosaic(x + 0.55 * Math.abs(z), z, lo * f, hi * f);
    };
    parts.push({ geometry: kit.decal(tiles(0, 0.16)), mat: 'dTurqLight', name: 'decal-mosaic-turquoise' });
    parts.push({ geometry: kit.decal(tiles(0.16, 0.26)), mat: 'dGold', name: 'decal-mosaic-gold' });

    // 往後掃的 livery：頂面兩側沿稜線內側的海菊蛤紅寬條（1.8）＋螺貝白細條（0.7），從鼻段一路掃到車尾
    /** @type {(x: number) => number} 紅條中心距稜線的內縮量（鼻段 2.2、車身段 4.2） */
    const stripeIn = (x) => lerp(4.2, 2.2, smoothstep(30, 60, x));
    /** @type {(x: number, y: number, z: number) => boolean} 頂面可貼條紋的範圍 */
    const onDeck = (x, y, z) => y > ridgeY(x) + 0.3 && x > X_TAIL + 3 && x < xDecalMax && kit.underCanopy(x, z) < -0.6;
    parts.push({
      geometry: kit.decal((x, y, z) => (onDeck(x, y, z) ? 0.9 - Math.abs(Math.abs(z) - (halfW(x) - stripeIn(x))) : -1)),
      mat: 'dRed',
      name: 'decal-sweep-red',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onDeck(x, y, z) ? 0.35 - Math.abs(Math.abs(z) - (halfW(x) - stripeIn(x) - 1.8)) : -1)),
      mat: 'dShell',
      name: 'decal-sweep-white',
    });
    // 稜線下方的海菊蛤紅細線（沿階梯稜線）
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < halfW(x) - 0.5 || x < X_TAIL + 2 || x > xDecalMax ? -1 : 0.35 - Math.abs(y - (ridgeY(x) - 1.5)))),
      mat: 'dRed',
      name: 'decal-ridge-line',
    });
    // 階梯回紋帶（螺貝白，連續帶）：車身立板上，x −68 → 20，帶高 5.2（立板下緣往上 0.9 起）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < halfW(x) - 0.5 || x < -68 || x > 20) {
          return -1;
        }
        // 左側 u 反向，兩側紋樣都往車頭方向前進
        const u = z < 0 ? -x : x;
        return -fretSd(u - 1000, y - (tableroY(x) + 0.9));
      }),
      mat: 'dShell',
      name: 'decal-step-fret',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P＋topY / ridgeY / tableroY（推估）：外框長 149（車尾翼端板 x −70.5 → 鼻尖 x 78.5，≤ 153）；頂面平台由後到前 34 → 31 → 28 → 25.4 → 22.8（車尾另降一階到 31），階面長 1.6；座艙罩頂 38.5、尾翼頂 46（全車最高）；細頸半寬 14.5（26 mm 前輪內側面 25.25 之內）；後輪拱 R15.5（26 mm 輪半徑 13 + 2.5，只支援 26 mm 輪）',
    wing: '尾翼翼端板（|z| 20、厚 1.6，三階的階梯側影，頂 46）、兩層翼面（厚 1.6，頂面 42 / 46）、側翼片每側 3 片（厚 1.2）、黑曜石鰭刀（厚 1.4，接在擋泥板後緣）、前輪擋泥板與斜撐、腹側裙板：ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；根部埋進殼面或相接的零件',
    myth: '階梯金字塔（六層 talud-tablero）、藍底彩繪、黑曜石嵌片：MYTH_RESEARCH A2（特奧蒂瓦坎羽蛇神殿）；綠咬鵑羽：A1；綠松石 / 海菊蛤紅 / 螺貝白：A6（大英博物館雙頭蛇）；階梯回紋：A7',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
