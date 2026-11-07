// 鯤鵬（body-kunpeng，神話組・中國）：《莊子・逍遙遊》「北冥有魚，其名為鯤……化而為鳥，其名為鵬」。
// 不做魚頭、鳥頭、鯨臉與眼睛，「化」用三種元素表現在四視圖 14（shared/design/body-kunpeng/fourview.png）的造型上：
// 造型：平滑流線的低趴全罩——細長低鼻、一路直線斜升的平順楔形引擎蓋（前擋泥板不鼓起）、中段透明窗、座艙後是一路緩降到圓收車尾的長甲板；
//       俯視是修長前尖的鯤身，前後輪上方微微隆起；側面前輪後方一組鰓狀斜百葉、後甲板一整片橫向百葉。
// (1) 鯤的鰓 → 前輪後方三道往後斜的鰓狀進氣縫（深色縫配珍珠銀唇線）；
// (2) 鵬的羽 → 後甲板五片層疊的橫向羽片百葉（實體薄片，後緣上翹、一片比一片高，像疊起的飛羽）、後擋泥板頂上往外後展開的一對鵬翼、車尾一片三叉羽尾；
// (3) 水 → 風的兩色 livery：前下半北冥深藍、後上半扶搖淺灰，中間一條往前上斜切的乾淨分界，分界上一條珍珠銀細線（水擊三千里）；
//     羽片、羽尾、鵬翼用同一個深藍，襯在淺灰的後甲板上。
// 設計：shared/design/body-kunpeng/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 7 節 Z1–Z4；黑名單 7-3）。剖面為本檔站位產生器（推估）。
// 不寫任何文字（含「Kunpeng」字樣）、不做晶片紋、不做紅色魚身 / 海豚形、不做龍角龍鬚。
import * as THREE from 'three';
import { makePolyBody, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位節點（x 由後到前；前後軸 x = ±40；車尾 −72、鼻尖 77.5） */
const XS = [-72, -68, -61, -52, -40, -28, -16, -6, 4, 14, 26, 40, 52, 62, 70, 77.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂（含座艙泡）：鼻尖 16 → 一路直線斜升的楔形鼻 → 座艙頂 36.6（x −2）→ 長甲板緩降到車尾 25.6（快背）
  yC: monoCurve(XS, [25.6, 27.4, 29, 30.4, 31.8, 33.2, 35.2, 36.6, 36.2, 34.2, 32.2, 31.3, 26.8, 22.6, 19.2, 16]),
  // 引擎蓋 / 甲板線（座艙泡兩側的高度）：鼻尖 15.4 直線斜升到前軸 30.8（楔形，31 mm 輪胎上方仍有間隙）
  yH: monoCurve(XS, [25.2, 27, 28.6, 30, 31.2, 31.8, 32, 31.8, 31.6, 31.4, 31.2, 30.8, 26.3, 22.1, 18.7, 15.4]),
  // 擋泥板稜：前段削平、只比引擎蓋高 0.3–0.6 mm（和楔形鼻接成一個面）；後輪 33.2（31 mm 輪拱頂 30.5 之上）
  yF: monoCurve(XS, [25.4, 28, 31, 32.8, 33.2, 32.2, 31.2, 31, 31, 31.2, 31.4, 31.2, 26.6, 22.4, 19, 15.7]),
  // 座艙泡（點 1）半寬
  cw: monoCurve(XS, [7, 8, 8.8, 9.4, 9.8, 10.4, 11.2, 11.8, 11.6, 10.6, 8.6, 6.8, 5.6, 4.6, 3.6, 2.6]),
  // 半寬：修長的鯤身——鼻尖 5 → 前輪 31 → 中段 33（側壁蓋到底盤側框外）→ 後輪 31 → 收尖車尾 15（輪胎外緣露在殼外）
  hw: monoCurve(XS, [15, 21, 27, 30, 31, 31.5, 32.5, 33, 33, 33, 32, 31, 27.5, 21, 12.5, 5]),
  // 最寬處高度
  yS: monoCurve(XS, [21.6, 21.4, 21, 20.6, 20.2, 20, 19.8, 19.8, 19.8, 19.8, 20, 20, 19.4, 17.8, 16.2, 14.8]),
  // 側壁下緣：比一般全罩低一截的深腹（鯤身），兩端往上收
  yLow: monoCurve(XS, [15.4, 13.6, 12, 11, 10.6, 10.6, 10.6, 10.6, 10.6, 10.6, 10.6, 10.8, 11.6, 12.6, 13.4, 13.8]),
};

/** @type {number} 座艙泡前端 x */
const CANOPY_X1 = 27;
/** @type {number} 座艙泡後端 x */
const CANOPY_X0 = -20;

/**
 * 半剖面 7 點：座艙頂 → 座艙泡邊（稜線）→ 引擎蓋外緣 → 擋泥板隆起 → 圓肩 → 最寬處 → 側壁下緣（內收）；
 * 只有座艙泡邊是稜線，其餘平滑（流線的鯤身）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const hw = P.hw(x);
  const yS = P.yS(x);
  const yF = P.yF(x);
  return [
    [0, P.yC(x)],
    [P.cw(x), P.yH(x)],
    [0.46 * hw, P.yH(x) - 0.4],
    [0.68 * hw, yF],
    [0.93 * hw, lerp(yF, yS, 0.45)],
    [hw, yS],
    [hw - 2.2, P.yLow(x)],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 鼻段每 1.5 mm 一站，其餘每 2 mm */
const STATIONS = [...buildStations(-72, 62, 2, profile).slice(0, -1), ...buildStations(62, 77.5, 1.5, profile)];

/**
 * 外殼在 (x, y) 高度的 |z|（沿剖面折線內插），給輪拱內襯定位用
 * @type {(x: number, y: number) => number}
 */
const shellZAt = (x, y) => {
  const pts = profile(x);
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (y >= lo && y <= hi && hi - lo > 1e-6) {
      return lerp(z0, z1, (y - y0) / (y1 - y0));
    }
  }
  return y > pts[0][1] ? 0 : pts[pts.length - 1][0];
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 水 → 風兩色：前下半北冥深藍（亮面珍珠漆），後上半扶搖淺灰，一條斜切分界
  deep: namedMaterial('paint-abyss-blue-pearl', { color: 0x0b2456, roughness: 0.28, metalness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  mist: namedMaterial('paint-wind-light-grey', { color: 0xc4ccd2, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  // 羽片百葉、羽尾板、鵬翼：同一個北冥深藍（實體件），襯在淺灰的後甲板上
  wing: namedMaterial('paint-abyss-blue-feather', { color: 0x0b2456, roughness: 0.4, metalness: 0.08, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  // 透明窗：淡青煙燻 PC（半透明，看得到殼內）
  canopy: namedMaterial('pc-smoke-tint', { color: 0x2a4652, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.7, envMapIntensity: 0.6, side: THREE.DoubleSide }),
  windowFloor: namedMaterial('shell-window-floor-dark', { color: 0x0c1a24, roughness: 0.6, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x16181b, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-ink', { color: 0x2a2e33, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-slate', { color: 0x2c3a44, roughness: 0.65, side: THREE.DoubleSide }),
  // 分界線與鰓唇：珍珠銀細線
  dLine: decalMaterial('decal-pearl-silver-line', { color: 0xe3e8ec, roughness: 0.3, metalness: 0.6 }),
  dGill: decalMaterial('decal-gill-dark', { color: 0x081420, roughness: 0.75 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

// ---------------------------------------------------------------------------
// 水 → 風的漸變色帶、鰓、羽片
// ---------------------------------------------------------------------------

/**
 * 漸變座標：沿車身往後上方斜掃（每升 1 mm 往後 0.9 mm），值愈大愈靠車頭、愈低
 * @type {(x: number, y: number) => number}
 */
const flowS = (x, y) => x - 0.9 * (y - 20);

/** @type {number} 深藍 / 淺灰的分界（flowS 值）：一條往後下、往前上的斜切線 */
const SPLIT_S = 2;

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23.5 },
];

/** @type {(x: number, z: number) => boolean} 側面（擋泥板隆起以外） */
const onSide = (x, z) => Math.abs(z) > 0.86 * P.hw(x);

/** @type {number[]} 鰓縫中心 x（在 y 17 的位置；往上往後斜） */
const GILL_X = [21, 16.2, 11.4];

/**
 * 鰓縫（側視）：每道從 (cx, 15) 斜到 (cx − 3.2, 22.2) 的弧縫，寬 1.4 mm；回傳正值 = 在縫內
 * @type {(x: number, y: number) => number}
 */
const gillSd = (x, y) => {
  let best = -1;
  for (const cx of GILL_X) {
    const t = Math.max(0, Math.min(1, (y - 15) / 7.2));
    // 微弧：中段往前凸 0.5 mm
    const xc = cx - 3.2 * t + 0.5 * Math.sin(Math.PI * t);
    const inY = Math.min(y - 15, 22.2 - y);
    best = Math.max(best, Math.min(0.7 - Math.abs(x - xc), inY));
  }
  return best;
};

/**
 * 鰓縫後緣的珍珠銀唇線（每道縫後方 0.5 mm、寬 0.5 mm）
 * @type {(x: number, y: number) => number}
 */
const gillLipSd = (x, y) => {
  let best = -1;
  for (const cx of GILL_X) {
    const t = Math.max(0, Math.min(1, (y - 15) / 7.2));
    const xc = cx - 3.2 * t + 0.5 * Math.sin(Math.PI * t) - 1.45;
    const inY = Math.min(y - 15.4, 21.8 - y);
    best = Math.max(best, Math.min(0.28 - Math.abs(x - xc), inY));
  }
  return best;
};

/**
 * 後甲板羽片百葉（5 片）：前緣 x、弦長、後緣抬高量（一片比一片高，層疊的飛羽），半寬 hz（跟著甲板收窄）
 * @type {{ x: number, chord: number, lift: number, hz: number }[]}
 */
const FEATHERS = [
  { x: -24, chord: 5.4, lift: 1.4, hz: 15.5 },
  { x: -31, chord: 5.6, lift: 1.8, hz: 16 },
  { x: -38, chord: 5.8, lift: 2.2, hz: 16 },
  { x: -45, chord: 6, lift: 2.6, hz: 15.5 },
  { x: -52, chord: 6.4, lift: 3, hz: 14.5 },
];

/**
 * 一片羽片：側視是前緣貼甲板、後緣上翹的薄楔（厚 0.9 mm），橫跨 |z| ≤ hz，後緣中央往後凸成羽尖；底面埋進甲板 1 mm
 * @type {(f: { x: number, chord: number, lift: number, hz: number }, topY: (x: number, z: number) => number) => THREE.BufferGeometry}
 */
const buildFeather = (f, topY) => {
  const n = 8;
  /** @type {number[]} */
  const pos = [];
  /** @type {(u: number, w: number) => number[][]} 在 (後退比例 u, 橫向比例 w) 的上下兩點 */
  const pt = (u, w) => {
    const z = w * f.hz;
    // 後緣中央往後凸 1.6 mm（羽尖），兩端齊平
    const back = f.chord + 1.6 * (1 - w * w);
    const x = f.x - u * back;
    const ySurf = topY(x, z);
    const yTop = ySurf + 0.2 + f.lift * u * u + 0.9 * (1 - u) * 0.3;
    return [
      [x, yTop, z],
      [x, Math.min(yTop - 0.9, ySurf - 1), z],
    ];
  };
  /** @type {number[][][][]} [u][w] → [上, 下] */
  const grid = [];
  for (let i = 0; i <= n; i++) {
    const row = [];
    for (let j = 0; j <= 2 * n; j++) {
      row.push(pt(i / n, -1 + j / n));
    }
    grid.push(row);
  }
  /** @type {(a: number[], b: number[], c: number[]) => void} */
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 2 * n; j++) {
      const a = grid[i][j];
      const b = grid[i + 1][j];
      const c = grid[i + 1][j + 1];
      const d = grid[i][j + 1];
      // 上面（法線朝上）、下面（法線朝下）
      tri(a[0], d[0], c[0]);
      tri(a[0], c[0], b[0]);
      tri(a[1], c[1], d[1]);
      tri(a[1], b[1], c[1]);
    }
  }
  // 四周側壁
  for (let i = 0; i < n; i++) {
    for (const j of [0, 2 * n]) {
      const a = grid[i][j];
      const b = grid[i + 1][j];
      if (j === 0) {
        tri(a[0], b[0], b[1]);
        tri(a[0], b[1], a[1]);
      } else {
        tri(a[0], b[1], b[0]);
        tri(a[0], a[1], b[1]);
      }
    }
  }
  for (let j = 0; j < 2 * n; j++) {
    for (const i of [0, n]) {
      const a = grid[i][j];
      const d = grid[i][j + 1];
      if (i === 0) {
        tri(a[0], d[1], d[0]);
        tri(a[0], a[1], d[1]);
      } else {
        tri(a[0], d[0], d[1]);
        tri(a[0], d[1], a[1]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 輪拱內襯（參考 zeppelin-xtail 的 buildHullLiner）：輪拱切口後面上半圈圓柱面，z 從殼內面（外殼 |z| − 1.2）往內 depth
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 16;
  /** @type {number[]} */
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = 0.2 + ((Math.PI - 0.4) * i) / n;
      const t1 = 0.2 + ((Math.PI - 0.4) * (i + 1)) / n;
      const x0 = arch.x + r * Math.cos(t0);
      const y0 = arch.y + r * Math.sin(t0);
      const x1 = arch.x + r * Math.cos(t1);
      const y1 = arch.y + r * Math.sin(t1);
      if (y0 < P.yLow(x0) + 0.4 || y1 < P.yLow(x1) + 0.4) {
        continue;
      }
      const zo0 = shellZAt(x0, y0) - 1.2;
      const zo1 = shellZAt(x1, y1) - 1.2;
      // 殼面在輪拱切口起點（|z| 23.5）以內的地方沒有被切開，不需要內襯
      if (zo0 < 24 || zo1 < 24) {
        continue;
      }
      const A = [x0, y0, sg * Math.max(23.5, zo0 - depth)];
      const B = [x1, y1, sg * Math.max(23.5, zo1 - depth)];
      const C = [x1, y1, sg * zo1];
      const D = [x0, y0, sg * zo0];
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
 * 車尾羽尾板（俯視）：從車尾殼面下伸出的一片薄板，後緣是三道分叉的羽尖（中間最長），半寬 15
 * @type {number[][]} 每點 [x, z]
 */
const TAIL_FEATHER = [
  [-66, -15],
  [-66, 15],
  [-73.4, 15],
  [-71.6, 9],
  [-74.4, 5.4],
  [-73.2, 2.6],
  [-75, 0],
  [-73.2, -2.6],
  [-74.4, -5.4],
  [-71.6, -9],
  [-73.4, -15],
];

/**
 * 鵬翼（俯視，|z| 側）：後擋泥板頂上往外後方展開的一對薄翼，翼根埋進殼面，後緣三道羽尖；
 * 翼底 y 31.6，比 31 mm 後輪頂 28.5 高 3 mm
 * @type {number[][]} 每點 [x, |z|]
 */
const PENG_WING = [
  [-22, 20],
  [-38, 38],
  [-49, 47],
  [-58, 47.5],
  [-55, 42],
  [-61, 41],
  [-58, 35],
  [-64, 33],
  [-62, 20],
];

export const kunpengBody = makePolyBody({
  id: 'body-kunpeng',
  name: '鯤鵬',
  style: 'myth',
  phase: 8,
  mythSeries: 'chinese',
  mythTheme: 'kunpeng',
  form: 'gill-teardrop',
  roof: 'clear',
  wing: 'feather-louver-deck',
  theme: '鯤鵬（鰓羽長身）：平滑流線的低趴全罩，細長低鼻一路直線斜升成平順楔形（前擋泥板不鼓起）到中段透明窗，座艙後一路緩降到圓收車尾的長甲板；俯視是修長、前尖的鯤身。前輪後方三道往後斜的鰓狀進氣縫（鯤的鰓），後甲板五片層疊上翹的深藍羽片百葉、車尾一片三叉羽尖的羽尾板、後擋泥板頂上往外後展開的一對深藍鵬翼（鵬的羽）；塗裝前下半北冥深藍、後上半扶搖淺灰，一條往前上斜切的分界加珍珠銀細線',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格邊長 0.7 mm（長車身表面積大，放寬網格讓碰撞格耗時壓在 1000 ms 內）
  step: 0.7,
  // 只有座艙泡邊是稜線
  hard: [1],
  wheelArches: ARCHES,
  sideZMin: 30,
  zones: () => [
    {
      mat: 'canopy',
      keep: (x, y, z) => Math.min(P.cw(x) - 0.4 - Math.abs(z), x - CANOPY_X0, CANOPY_X1 - x, y - P.yH(x) - 0.25),
    },
    // 前下半深藍、後上半淺灰
    { mat: 'deep', keep: (x, y) => flowS(x, y) - SPLIT_S },
    { mat: 'mist', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'deep', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 後甲板的層疊羽片百葉
    parts.push({
      geometry: mergeGeos(FEATHERS.map((f) => buildFeather(f, kit.surf.topY))),
      mat: 'wing',
      solid: true,
      outline: true,
      name: 'feather-louvers',
    });
    // 車尾羽尾板（厚 1.2 mm，頂面貼在車尾殼面下 0.4 mm）
    parts.push({
      geometry: flatPlate(TAIL_FEATHER, kit.surf.topY(-66, 0) - 1.6, 1.2),
      mat: 'wing',
      solid: true,
      outline: true,
      name: 'feather-tail',
    });
    // 透明窗下的深色底板（窗內看到的是深色，不是底盤）：沿窗框內縮 0.6 mm 的平板，y 27
    /** @type {number[][]} */
    const floor = [];
    for (let x = CANOPY_X1 - 0.6; x >= CANOPY_X0 + 0.6; x -= 2) {
      floor.push([x, P.cw(x) - 0.6]);
    }
    for (let x = CANOPY_X0 + 0.6; x <= CANOPY_X1 - 0.6; x += 2) {
      floor.push([x, -(P.cw(x) - 0.6)]);
    }
    parts.push({ geometry: flatPlate(floor, 27, 0.6), mat: 'windowFloor', name: 'window-floor' });
    // 鵬翼：左右一對薄翼（厚 1.2 mm）
    parts.push({
      geometry: mergeGeos([1, -1].map((sg) => flatPlate(sg > 0 ? PENG_WING.map(([x, z]) => [x, z]) : PENG_WING.map(([x, z]) => [x, -z]).reverse(), 31.6, 1.2))),
      mat: 'wing',
      solid: true,
      outline: true,
      name: 'peng-wings',
    });
    // 深藍 / 淺灰分界的珍珠銀細線（0.7 mm）；座艙泡上不畫
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < P.cw(x) && x > CANOPY_X0 && x < CANOPY_X1) {
          return -1;
        }
        return 0.35 - Math.abs(flowS(x, y) - SPLIT_S);
      }, { offset: 0.1 }),
      mat: 'dLine',
      name: 'decal-wave-lines',
    });
    // 鯤的鰓：前輪後方三道斜縫
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? gillSd(x, y) : -1), { offset: 0.08 }),
      mat: 'dGill',
      name: 'decal-gill-slots',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? gillLipSd(x, y) : -1), { offset: 0.12 }),
      mat: 'dLine',
      name: 'decal-gill-lips',
    });
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildLiner(a, 3))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P（推估，比例取自四視圖 14 後縮到底盤）：車殼 x −72 ~ 77.5；中線鼻尖 16 → 楔形引擎蓋前軸 30.8 → 座艙頂 36.6（x −2）→ 車尾 25.6；擋泥板稜前 31.2（削平）/ 後 33.2（31 mm 輪拱頂 30.5 之上）；側壁下緣 10.6；半寬鼻尖 5、前輪 31、中段 33、後輪 31、車尾 15',
    feathers: '羽片百葉為實心 ABS 薄楔（厚 0.9 mm），5 片前緣 x −24 / −31 / −38 / −45 / −52、弦長 5.4–6.4 mm＋中央羽尖 1.6 mm、後緣抬高 1.4 → 3 mm、半寬 14.5–16 mm（推估）',
    pengWings: '鵬翼為實心 ABS 薄板（厚 1.2 mm），翼根 x −22 ~ −62、|z| 20 埋進殼面，翼尖到 |z| 47.5、x −58，翼底 y 31.6（推估）',
    featherTail: '羽尾板為實心 ABS 薄板（厚 1.2 mm），x −66 ~ −75、半寬 15，後緣三道羽尖（推估）',
    livery: '深藍 / 淺灰分界沿 x − 0.9 (y − 20) = 2 斜切，分界銀線 0.7 mm；鰓縫 3 道寬 1.4 mm、高 7.2 mm，唇線 0.56 mm；皆為自繪（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），切口從 |z| 23.5 起（輪胎內側 |z| 24.7）＋3 mm 深內襯',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
