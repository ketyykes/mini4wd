// 羽蛇（body-quetzal-serpent，神話組・阿茲特克 / 馬雅）：特奧蒂瓦坎羽蛇神殿的階梯金字塔與綠咬鵑羽。
// 不做蛇頭、眼、牙與蛇信，主題用四種元素表現：
// (1) 階梯金字塔 → 車身：頂面由車尾往鼻尖一階一階下降的平台（座艙後一道階面貼金），側視是一道階梯楔形；側面是 talud-tablero 的立板＋內收斜坡兩階；
//     尾翼的翼端板是階梯金字塔的側影，上下兩片翼面各站在一階上；
// (2) 層疊的羽 → 翼片：尾翼的兩層翼面、後輪上方兩側往外下垂的厚導流片（和車身同色）；
// (3) 紋樣與配色：立板上連續帶狀的階梯回紋（xicalcoliuhqui，不做四向旋轉單元）、座艙以後頂面的綠松石馬賽克小片；深翡翠金屬綠（主色）＋綠松石＋海菊蛤紅＋金；
// (4) 象徵物件：黑曜石刀的刃形做成鼻面一把往前尖出的黃銅單刃（有厚度與倒角）；前擋泥板前緣一對亮金色細縫頭燈；座艙罩是黑曜石色。
// 姿態：四輪都罩住，前擋泥板是兩團壓低的肩部量體、中間夾著低平的通道，鼻段短、寬、扁，車尾階梯往上——前低後高、蓄勢待發。
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
const X_NOSE = 76.5;

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-70, -64, -56, -40, -20, 0, 14, 22, 30, 44, 52, 58, 62, 66, 70, 73, 76.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 半寬（基礎值，另加 halfW 的左右波浪）：平切的車尾（16）→ 車身罩住後輪（37）→ 兩輪之間收腰（x −20 / 0 / 14：32.5 / 27 / 19.5，加上波浪後 x −20 → 0 的實際半寬約 28；底盤側面零件到 |z| 25，再窄會穿出斜坡）→
  // 前擋泥板罩住前輪頂（32，胎面外緣露出約 2 mm；收窄是為了俯視 IoU）→ 鼻段短而寬的鏟形，收到平切的寬鼻尖（17.5）
  hw: monoCurve(XS, [16, 22, 32, 37, 32.5, 27, 19.5, 28, 32, 32, 32, 32.5, 32, 30, 27.5, 23, 17.5]),
  // 側裙下緣：車身 10.5–13（底盤側框段 ≥ 9.9）；前段與鼻段抬到 16.6–18.2（底盤上方），鼻段是一片薄的鑿形鼻（鼻尖厚約 5）
  yLow: monoCurve(XS, [20, 17, 13, 12, 11, 10.5, 14, 18, 18, 18, 18, 17.4, 16.8, 16.6, 16.6, 17.0, 18.2]),
};

/** @type {number} 階面（talud）的水平長度：平台之間以 1.6 mm 的斜面相接 */
const RISER = 1.6;
/** @type {number[][]} 頂面平台 [前緣 x, 平台高]，由後到前逐階下降（最後一階到鼻尖）：後平台 → 座艙平台 → 前擋泥板之間的低通道 → 鼻段 */
const TERRACES = [
  [-26, 34],
  [27, 31],
  [52, 27.5],
  [X_NOSE, 23.5],
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
 * 半寬＝基礎值＋車身段的左右波浪（車尾與前擋泥板前漸消失）
 * @type {(x: number) => number}
 */
const halfW = (x) => {
  const env = smoothstep(-64, -54, x) * (1 - smoothstep(0, 12, x));
  return P.hw(x) + WAVE.amp * env * Math.cos((2 * Math.PI * (x - WAVE.peak)) / WAVE.len);
};

/**
 * 前擋泥板隆起量：前輪上方（x 19 → 60）外側稜線往上抬 6 mm，中央通道維持平台高——兩團壓低的肩部量體罩住前輪
 * @type {(x: number) => number}
 */
const fenderLift = (x) => 6 * smoothstep(19, 29, x) * (1 - smoothstep(51, 60, x));

/**
 * 側壁上緣稜線高度：頂面平台下 3.2 mm，跟著平台一階一階走；前輪上方加上擋泥板隆起
 * @type {(x: number) => number}
 */
const ridgeY = (x) => topY(x) - 3.2 + fenderLift(x);

/**
 * 立板（tablero）下緣：稜線下 8 mm；前段與鼻段側壁矮，夾在下緣上 1.2 mm 與稜線下 1.6 mm 之間
 * @type {(x: number) => number}
 */
const tableroY = (x) => Math.min(ridgeY(x) - 1.6, Math.max(P.yLow(x) + 1.2, ridgeY(x) - 8));

/**
 * 半剖面 8 點：頂面（中線 → 頂面外緣，前輪上方外側隆起成擋泥板）→ 稜線（銳利）→ 立板 tablero（垂直）→ 立板下緣（銳利）→ 內收一階（銳利）→ 斜坡 talud 到下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = halfW(x);
  const yTop = topY(x);
  const yR = ridgeY(x);
  const yT = tableroY(x);
  const yLow = P.yLow(x);
  const lift = fenderLift(x);
  return [
    [0, yTop],
    [0.5 * hw, yTop - 0.35 + 0.85 * lift],
    [hw - 3.5, lerp(yR - lift, yTop, 0.5) + lift],
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
  // 頂面：深翡翠的金屬綠亮面漆（深色殼）；立板：綠松石馬賽克的霧面（roughness > 0.5）；斜坡：海菊蛤紅霧面——亮面金屬漆對石材霧面
  green: namedMaterial('paint-quetzal-green-metallic', { color: 0x0d4f37, roughness: 0.28, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  green2: namedMaterial('paint-quetzal-green-metallic', { color: 0x0d4f37, roughness: 0.28, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  turq: namedMaterial('paint-turquoise-mosaic', { color: 0x2bb3a3, roughness: 0.62, clearcoat: 0.1 }),
  red: namedMaterial('paint-spondylus-red', { color: 0xc2452d, roughness: 0.6, clearcoat: 0.1 }),
  red2: namedMaterial('paint-spondylus-red', { color: 0xc2452d, roughness: 0.6, clearcoat: 0.1, side: THREE.DoubleSide }),
  // 真金屬：尾翼翼端板（Blender 依 -brass 結尾換成金屬）
  gold: namedMaterial('trim-gold-brass', { color: 0xd9b24a, roughness: 0.3, metalness: 0.8, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 細縫頭燈：亮金色，低強度自發光（深色殼上的亮色頭燈）
  lamp: namedMaterial('lamp-slit-gold', { color: 0xffcf4a, emissive: 0xffc640, emissiveIntensity: 0.55, roughness: 0.2, clearcoat: 0.8 }),
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
 * 水平厚板：俯視外形 (x, z) 沿 y 擠出，四周倒角（倒角面會反光，看得出厚度）
 * @type {(outline: number[][], yBottom: number, thick: number, bev: number) => THREE.BufferGeometry}
 */
const bevelSlab = (outline, yBottom, thick, bev) => {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1 });
  // (X, Y, Z) → (X, Z, −Y)：形狀平面轉成水平，厚度朝上
  g.rotateX(-Math.PI / 2);
  g.translate(0, yBottom + bev, 0);
  return g;
};

/** @type {number[][]} 鼻面金色單刃的半邊外形 (x, z)：往前尖出的單刃（刃尖 x 78.6，伸出鼻尖 2.1 mm，仍在 iter-132 鼻尖 79.0 之內），最寬處在 x 62（半寬 7.6），後段收成刃根 */
const NOSE_BLADE = [
  [78.6, 0],
  [70, 4.4],
  [62, 7.6],
  [56, 6.2],
  [51.5, 3],
  [50.5, 0],
];

/**
 * 鼻面單刃：真金屬（黃銅）、厚 1.2、四周倒角 0.45；沿中線躺在鼻段平台上，底面埋進殼面 0.3 mm，刃尖往前伸出鼻尖
 * @type {() => THREE.BufferGeometry}
 */
const buildNoseBlade = () => {
  const half = NOSE_BLADE.slice(1, -1);
  const outline = [NOSE_BLADE[0], ...half, NOSE_BLADE[NOSE_BLADE.length - 1], ...half.slice().reverse().map(([x, z]) => [x, -z])];
  return bevelSlab(outline, topY(66) - 0.3, 1.2, 0.45);
};

/** @type {number} 尾翼翼端板的 |z|（x −66 以前在殼面之內，最後一小段懸在收窄的車尾外側） */
const WING_Z = 20;
/** @type {number[][]} 翼端板側視外形 (x, y)：三階往車尾升高的階梯金字塔側影（每階高 4、階面略斜），底邊埋進後平台與車尾平台 */
const ENDPLATE = [
  [-33, 30],
  [-33, 34.8],
  [-39.5, 37.2],
  [-47, 37.2],
  [-48, 39.6],
  [-56, 39.6],
  [-57, 42],
  [-70.5, 42],
  [-70.5, 38.5],
  [-65, 30],
];
/** @type {{ x0: number, x1: number, y: number, notch: number }[]} 兩層翼面（厚 1.6）：下層站在第二階（頂 39.6）、上層站在第三階（頂 42，比座艙罩頂高 3.5，壓低貼著車尾）；前緣中央往後凹 notch mm 的淺 V */
const WING_PLANES = [
  { x0: -48.5, x1: -56.5, y: 38, notch: 2 },
  { x0: -57.5, x1: -70.5, y: 40.4, notch: 3.5 },
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
  theme: '特奧蒂瓦坎羽蛇神殿的階梯金字塔，不做蛇頭：四輪全罩、前擋泥板是兩團壓低的肩部量體，頂面由車尾往鼻尖一階一階下降（座艙後一道階面貼金），鼻面一把往前尖出的黃銅單刃；側面是立板＋斜坡兩階，立板上一道連續的階梯回紋；尾翼是壓低的階梯金字塔側影金色翼端板＋上下兩層翼面，後輪上方兩側往外下垂的厚導流片；深翡翠金屬綠配綠松石、海菊蛤紅與金，前擋泥板前緣一對亮金色細縫頭燈、黑曜石色座艙罩',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面，稜線（3）、立板下緣（5）、內收階（6）為銳利稜線
  hard: [3, 5, 6],
  // 四輪全罩後殼面表面積變大，網格邊長放寬到 0.55 mm，殼面面數維持不增加
  step: 0.55,
  // 前後輪拱（26 mm 輪：半徑 13 + 2.5）
  wheelArches: [
    { x: -40, y: 13, radius: 15.5, cutZFrom: 25 },
    { x: 40, y: 13, radius: 15.5, cutZFrom: 25 },
  ],
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
    // 金屬綠：頂面（稜線以內；前擋泥板隆起處中央通道比稜線低，所以用 z 判斷）
    { mat: 'green', keep: (x, y, z) => Math.min(halfW(x) - 0.62 - Math.abs(z), y - (tableroY(x) + 0.5)) },
    // 綠松石：立板（稜線到立板下緣）
    { mat: 'turq', keep: (x, y) => y - (tableroY(x) - 0.1) },
    // 海菊蛤紅：內收階以下的斜坡
    { mat: 'red', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'green' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'red', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 腹側裙板（朱紅，接續後段紅色斜坡）：遮住側面外露的電池管——座艙前的窄段（x 2 → 21.5；x < 2 已由紅色斜坡蓋住）每側一片直立外板，
    // 外緣 |z| 35.5（底盤側框外緣）、y 10.5 → 17；棚板只做 2 條寬 2.4 mm 的橫撐（x 3.2 / 11，側壁下緣 < 17 處）接到側壁（半寬 − 1.2）
    parts.push({
      geometry: buildBellySkirt({ x0: 2, x1: 21.5, zIn: (x) => halfW(x) - 1.2, zOut: 35.5, yTop: 17, ribs: [3.2, 11] }),
      mat: 'red2',
      solid: true,
      outline: true,
      name: 'belly-skirt',
    });
    // 前後輪拱內襯
    parts.push({
      geometry: mergeGeos([buildLiner({ x: -40, y: 13, radius: 15.5 }, 3.5), buildLiner({ x: 40, y: 13, radius: 15.5 }, 3.5)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 鼻面單刃（全車唯一的刃）
    parts.push({ geometry: buildNoseBlade(), mat: 'gold', solid: true, outline: true, name: 'nose-blade' });

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

    // 後側導流片（車身色）：每側一片沿稜線下方往外下垂 14° 的厚導流片（厚 1.4、四周倒角 0.5，斷面看得出厚度），x −16 → −60，
    // 外緣是一道平順的弧（後輪處最寬 |z| 46），根部整段埋進立板 1.6 mm；俯視在後輪處外擴成寬的後腰
    /** @type {(x: number) => number} 根部 |z|：埋進立板 1.6 mm（跟著車身波浪，越過後輪胎面外緣） */
    const zr = (x) => halfW(x) - 1.6;
    /** @type {number} 導流片底面高度（後平台稜線下 2.6） */
    const finY = ridgeY(-40) - 2.6;
    /** @type {number[][]} 外緣（由前到後） */
    const finEdge = [
      [-16, zr(-16) + 0.6],
      [-20, 40],
      [-24, 44.8],
      [-30, 46.4],
      [-48, 46.4],
      [-55, 45.2],
      [-58.5, 42],
      [-60.5, zr(-60.5) + 0.6],
    ];
    /** @type {number[][]} 根部（由後到前） */
    const finRoot = [-60.5, -54, -48, -42, -36, -30, -24, -18, -16].map((x) => [x, zr(x)]);
    /** @type {THREE.BufferGeometry[]} */
    const sideVanes = [];
    for (const sg of [-1, 1]) {
      const g = bevelSlab([...finEdge, ...finRoot].map(([x, z]) => [x, sg * z]), finY, 1.4, 0.5);
      // 以根部（|z| 36）為軸往外下垂 14°，順著側壁往外流出去，像擋泥板外擴的唇
      g.translate(0, -finY, -sg * 36);
      g.rotateX((sg * 14 * Math.PI) / 180);
      g.translate(0, finY, sg * 36);
      sideVanes.push(g);
    }
    parts.push({ geometry: mergeGeos(sideVanes), mat: 'green2', solid: true, outline: true, name: 'side-flares' });

    /** @type {number} 頂面貼紙的前緣（鼻尖前留 1.5 mm） */
    const xDecalMax = X_NOSE - 1.5;
    /** @type {(x: number, y: number, z: number, m: number) => boolean} 在頂面（稜線以內 m mm、立板下緣以上） */
    const onTop = (x, y, z, m) => Math.abs(z) < halfW(x) - 0.6 - m && y > tableroY(x) + 0.5;
    // 階面貼金：只貼座艙後那一階（鼻段的金色交給鼻面單刃），其餘階面維持車身色，頂面的綠才連得起來
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y, z, 0.3) || kit.underCanopy(x, z) > -0.6) {
          return -1;
        }
        const edges = [TERRACES[0][0]].map((x0) => x0 + RISER / 2);
        return Math.max(...edges.map((xe) => RISER / 2 + 0.35 - Math.abs(x - xe)));
      }),
      mat: 'dGold',
      name: 'decal-riser-gold',
    });
    // 細縫頭燈：前擋泥板前緣往下收的斜面上，沿外緣內 4 mm 的一對細長光條（x 53 → 59，寬 1.6），跟著鼻段收窄
    parts.push({
      geometry: kit.decal((x, y, z) => (x < 53 || x > 59 || !onTop(x, y, z, 0.3) ? -1 : 0.8 - Math.abs(Math.abs(z) - (halfW(x) - 4.6))), { offset: 0.14 }),
      mat: 'lamp',
      name: 'lamp-nose-slits',
    });
    // 馬賽克小片（頂面，避開座艙）：大片、稀疏的綠松石小片，約佔 16%
    /** @type {(lo: number, hi: number) => import('./loft.js').KeepFn} */
    const tiles = (lo, hi) => (x, y, z) => {
      if (!onTop(x, y, z, 0.4) || x > 20 || kit.underCanopy(x, z) > -0.8) {
        return -1;
      }
      // 小片排成往前尖的箭形列（x 依 |z| 錯開 = 往後掃）、密度由鼻段往車尾遞減（速度感）
      const f = lerp(0.45, 1.25, smoothstep(-60, 60, x));
      return mosaic(x + 0.55 * Math.abs(z), z, lo * f, hi * f);
    };
    parts.push({ geometry: kit.decal(tiles(0, 0.16)), mat: 'dTurqLight', name: 'decal-mosaic-turquoise' });

    // 往後掃的 livery：頂面兩側沿稜線內側的海菊蛤紅寬條（1.8）＋螺貝白細條（0.7），從鼻段一路掃到車尾
    /** @type {(x: number) => number} 紅條中心距稜線的內縮量（鼻段 2.2、車身段 4.2） */
    const stripeIn = (x) => lerp(4.2, 2.2, smoothstep(30, 60, x));
    /** @type {(x: number, y: number, z: number) => boolean} 頂面可貼條紋的範圍 */
    const onDeck = (x, y, z) => onTop(x, y, z, 0.3) && x > X_TAIL + 3 && x < xDecalMax && kit.underCanopy(x, z) < -0.6;
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
    geometry: '本檔站位產生器 P＋topY / ridgeY / tableroY（推估）：鼻尖 x 76.5；頂面平台由後到前 34 → 31 → 27.5 → 23.5（車尾另降一階到 31），階面長 1.6；前擋泥板外側稜線抬高 6；座艙罩頂 38.5、尾翼頂 42（全車最高）；前擋泥板半寬 33（罩住 26 mm 前輪頂）；前後輪拱 R15.5（26 mm 輪半徑 13 + 2.5，只支援 26 mm 輪）',
    wing: '尾翼翼端板（|z| 20、厚 1.6，三階的階梯側影，頂 42）、兩層翼面（厚 1.6，頂面 39.6 / 42）、後側導流片每側 1 片（厚 1.4）、鼻面單刃（厚 1.2）、腹側裙板：ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；根部埋進殼面或相接的零件',
    myth: '階梯金字塔（六層 talud-tablero）、藍底彩繪、黑曜石嵌片：MYTH_RESEARCH A2（特奧蒂瓦坎羽蛇神殿）；綠咬鵑羽：A1；綠松石 / 海菊蛤紅 / 螺貝白：A6（大英博物館雙頭蛇）；階梯回紋：A7',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
