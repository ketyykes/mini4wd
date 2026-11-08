// 熔岩火山（body-pele-lava，神話組・波利尼西亞）：夏威夷火山女神 Pele 只用自然元素表現——黑曜石、熔岩裂紋、火山口、噴發的弧線。
// 不做神像、人形、臉、頭髮（不做「Pele 之髮」的具象髮絲），也不做提基雕像。照四視圖 16 建模：
// (1) 黑曜石 → 殼面：全車黑曜石色亮面漆，面切成多道銳利稜線（打製黑曜石的貝殼狀斷口感）；
// (2) 熔岩裂紋 → livery：殼面上一張不規則的發光橘紅裂紋網，側面兩道往後掃的熔岩紅斜切色塊；前葉子板側面 4 道直條鰓縫、鼻段兩道往後流的縱向熔岩裂縫，縫底都是發光的熔岩；
// (3) 火山口 → 車頂進氣口：座艙後方一座矮的圓錐形進氣口，口內是發光的熔岩盤；
// (4) 噴發的弧線 → 天鵝頸翼：一支從車尾甲板升起、往後彎下的弧形單柱（四視圖 16 的招牌造型），加兩道從後輪上方往後拱起的熔岩紅噴發弧，三點托住一片黑曜石後掠翼（前緣一道發光熔岩帶）。
// 姿態：低而尖的楔形鼻、前擋泥板兩團肩部量體、長座艙，車尾天鵝頸是全車最高點。
// 設計：shared/design/body-pele-lava/DESIGN.md（來源與四視圖對照）。剖面為本檔站位產生器（推估）。不含任何文字。
import * as THREE from 'three';
import { makePolyBody, flatPlate, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -62;
/** @type {number} 鼻尖 x */
const X_NOSE = 77;

/** @type {{ x: number, depth: number, half: number }[]} 側艙外緣的 V 形熔岩裂口（每側一道）：中心 x、切入深度、半寬（切到半寬 28，仍蓋住底盤側壁 27） */
const FISSURES = [
  { x: -5, depth: 7, half: 11 },
];
/**
 * 俯視半寬要扣掉的裂口深度：每道裂口是往外張開的 V（頂點朝車身內側）
 * @type {(x: number) => number}
 */
const fissureCut = (x) => {
  let d = 0;
  for (const f of FISSURES) {
    d = Math.max(d, f.depth * Math.max(0, 1 - Math.abs(x - f.x) / f.half));
  }
  return d;
};

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40，推估） */
const XS = [-62, -58.5, -53.5, -48, -40, -30, -20, -10, 0, 12, 24, 32, 40, 48, 56, 63, 69, 73, 77];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬：短車尾（30，收在天鵝頸翼前緣底下）→ 後輪段收到 26（後輪胎面往外露出 8 mm，半罩露輪）→ 兩輪之間是全車最寬的黑曜石側艙（35，外緣切一道 V 形裂口）→ 前輪段收到 26（前輪胎面也往外露出）→ 楔形尖鼻（鼻尖 8）
  // 側艙外緣再切進一道寬 V 形熔岩裂口（見 fissureCut）
  hw: ((base) => (x) => base(x) - fissureCut(x))(monoCurve(XS, [30, 29, 26.5, 26, 26, 27.5, 32, 35, 35, 33.5, 29, 26.5, 26, 26, 25.5, 23, 19, 14, 8])),
  // 中線頂：鼻尖 15 → 前擋泥板之間 28 → 座艙段 33 → 車尾甲板 31.5
  yC: monoCurve(XS, [30.5, 31.5, 32, 32.5, 32.5, 33, 33, 33, 33, 32, 30.5, 29, 28, 27, 24.5, 21.5, 18.5, 16.8, 15]),
  // 稜線（z ≈ 0.62 半寬，銳利）：前輪上方 33 高過中線（兩團肩部量體）
  yR: monoCurve(XS, [30.5, 31.5, 32.5, 33, 33, 32.5, 32, 31.5, 31.5, 31.5, 31.5, 32.5, 33, 32.5, 29.5, 25.5, 21.5, 18.5, 15.8]),
  // 肩線（銳利）：前後輪上方 ≥ 32，高過 R17.5 輪拱頂 30.5
  yS: monoCurve(XS, [28.5, 30.5, 31.5, 32.2, 32.3, 31.2, 29.5, 28.5, 28.5, 28.8, 30, 31.6, 32.2, 31.4, 28, 24, 20.5, 17.5, 15]),
  // 側裙下緣：側艙段 10.5（底盤側框 ≥ 9.9）
  yLow: monoCurve(XS, [17, 15, 13, 12, 11.5, 11, 10.5, 10.5, 10.5, 10.5, 11, 12, 12.5, 13, 13, 13, 13, 13, 13]),
};

/**
 * 側面斜切稜線（銳利）：肩線下方，往下內收成一道斜面
 * @type {(x: number) => number}
 */
const yChine = (x) => lerp(P.yLow(x), P.yS(x), 0.48);

/**
 * 半剖面 7 點：中線 → 頂面 → 稜線（銳利）→ 肩線（銳利）→ 外傾側壁 → 斜切稜線（銳利）→ 內收下裙；多道銳利稜線切出黑曜石斷口般的面
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const h = P.hw(x);
  const yC = P.yC(x);
  const yR = P.yR(x);
  const yS = P.yS(x);
  return [
    [0, yC],
    [0.3 * h, lerp(yC, yR, 0.45)],
    [0.62 * h, yR],
    [h - 1, yS],
    [h, lerp(yS, yChine(x), 0.45)],
    [h - 0.3, yChine(x)],
    [h - 2, P.yLow(x)],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 站位表：車尾與鼻段每 1.5 mm、中段每 2.5 mm */
const STATIONS = [...buildStations(X_TAIL, -56, 1.5, profile).slice(0, -1), ...buildStations(-56, 61, 2.5, profile).slice(0, -1), ...buildStations(61, X_NOSE, 1.5, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23 },
];

/**
 * 可重現的格點雜湊（0–1）
 * @type {(i: number, j: number, k: number) => number}
 */
const hash = (i, j, k) => {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Voronoi 裂紋：抖動格點（cell mm）的最近兩點距離差，回傳到裂紋中心線的距離（mm）
 * @type {(u: number, v: number, cell: number, seed: number) => number}
 */
const crackDist = (u, v, cell, seed) => {
  const i0 = Math.floor(u / cell);
  const j0 = Math.floor(v / cell);
  let d1 = Infinity;
  let d2 = Infinity;
  for (let i = i0 - 1; i <= i0 + 1; i++) {
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const px = (i + 0.15 + 0.7 * hash(i, j, seed)) * cell;
      const py = (j + 0.15 + 0.7 * hash(j, i, seed + 1)) * cell;
      const d = Math.hypot(u - px, v - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return (d2 - d1) / 2;
};

/**
 * 側面熔岩紅斜切色塊：前輪後方往車尾斜升的一道 Z 形帶（四視圖 16 側面的紅色斜切），回傳正值 = 色塊內
 * @type {(x: number, y: number) => number}
 */
const lavaSlashSd = (x, y) => {
  // 下緣：x 22 處貼近斜切稜線，往後斜升到 x −58 的肩線下 1 mm
  const t = smoothstep(22, -58, x);
  const yBot = lerp(yChine(x) + 0.4, P.yS(x) - 1.2, t ** 0.8);
  const yTop = P.yS(x) + 2;
  return Math.min(y - yBot, yTop - y, x + 60, 24 - x - 0.9 * (y - yChine(x)));
};

/** @type {{ x: number, z: number, r0: number, r1: number, h: number }} 火山口進氣口：座艙後方 x −25.5，底半徑 10.5、口半徑 5.8、高 2.6 的矮錐（火山的寬緩坡） */
const CRATER = { x: -25.5, z: 0, r0: 10.5, r1: 5.8, h: 2.6 };

/**
 * 火山口：寬而矮的圓錐（外坡 → 口緣 → 往內斜下的口壁 → 底），旋轉 20 段的封閉實體；底面埋進殼面
 * @type {(yBase: number) => THREE.BufferGeometry}
 */
const buildCrater = (yBase) => {
  const { r0, r1, h } = CRATER;
  const pts = [
    [r1 - 1.4, yBase + h - 1.6],
    [r1 - 1.4, yBase - 1.2],
    [r0, yBase - 1.2],
    [r0, yBase],
    [r1 + 0.7, yBase + h],
    [r1, yBase + h],
    [r1 - 1.4, yBase + h - 1.6],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 20);
  g.translate(CRATER.x, 0, CRATER.z);
  return g;
};

/** @type {number[][]} 天鵝頸單柱中心線 (x, y)：車尾甲板 x −40 升起，往後拱過頂點（中心線 y 45，外緣 48.4），再往後下彎到翼面 */
const NECK = [
  [-40, 30.5],
  [-41.5, 35.3],
  [-44, 39.8],
  [-48, 42.6],
  [-53, 44.6],
  [-58, 45],
  [-62.5, 44.3],
  [-65.5, 43.5],
  [-67.5, 42.7],
];

/**
 * 天鵝頸單柱：沿中心線掃出的扁橢圓斷面（側向半厚 2.6，弦向半寬由根部 5.5 收到頂部 3.4）
 * @type {() => THREE.BufferGeometry}
 */
const buildNeck = () => {
  const pts = NECK.map(([x, y]) => [x, y, 0]);
  return sweepEllipse(pts, 30, (t) => [2.6, lerp(5.5, 3.4, Math.min(1, t * 1.6))], 12);
};

/** @type {number[][]} 中央脊鰭側視外形 (x, y)：火山口後緣沿車尾中線隆起、往後升高接進天鵝頸根部；底邊埋進殼面 */
const SPINE = [
  [-35.5, 30.5],
  [-38, 33],
  [-41, 36.6],
  [-43.5, 38.6],
  [-45, 36],
  [-44.5, 30.5],
];

/** @type {number} 翼面底高 */
const WING_Y = 41.6;
/** @type {number} 翼面厚 */
const WING_T = 2.4;
/** @type {number[][]} 翼面半邊外形 (x, z)：前緣後掠（往兩側噴開的熔岩）、翼梢往後尖出，後緣中央 V 形缺口 */
const WING_HALF = [
  [-61.5, 0],
  [-62.5, 18],
  [-66.5, 34],
  [-74, 47.5],
  [-75, 43],
  [-75, 16],
  [-69.5, 0],
];

/**
 * 左右對稱的水平板：半邊外形 (x, z) 鏡射成整片
 * @type {(half: number[][], y: number, t: number) => THREE.BufferGeometry}
 */
const mirroredPlate = (half, y, t) => {
  const left = half.slice(1, -1).reverse().map(([x, z]) => [x, -z]);
  return flatPlate([...half, ...left], y, t);
};

/** @type {() => THREE.BufferGeometry} 翼面（黑曜石） */
const buildWing = () => mirroredPlate(WING_HALF, WING_Y, WING_T);

/** @type {number[][]} 翼面前緣的熔岩發光帶半邊外形 (x, z)：沿前緣、寬 2.4 */
const WING_GLOW_HALF = [
  [-61.4, 0],
  [-62.4, 18],
  [-66.4, 34],
  [-73.2, 45.6],
  [-74.2, 44.6],
  [-68.6, 34],
  [-64.6, 18],
  [-63.8, 0],
];

/** @type {number[][]} 噴發弧中心線 (x, y, z)：從後輪上方的肩部升起，往後拱起，末端埋進翼面（右側） */
const ARC = [
  [-37.5, 30.6, 20],
  [-43.5, 36.8, 20.6],
  [-51, 40.8, 21.2],
  [-58.5, 42.4, 21.8],
  [-66.5, 42, 22.4],
];

/**
 * 噴發弧：沿中心線掃出的橢圓斷面（半厚 2.3、半高由根部 2.6 收到 1.8），左右各一支，像兩道往後噴出的熔岩弧
 * @type {() => THREE.BufferGeometry}
 */
const buildArcs = () => {
  /** @type {(sg: number) => THREE.BufferGeometry} */
  const one = (sg) => sweepEllipse(ARC.map(([x, y, z]) => [x, y, sg * z]), 24, (t) => [2.3, lerp(2.6, 1.8, t)], 10);
  return mergeGeos([one(1), one(-1)]);
};

/** @type {number[]} 前葉子板側面鰓縫的 x（前輪拱後緣 57.5 之前的側壁，4 道間距 2.6） */
const GILL_X = [59, 61.6, 64.2, 66.8];
/** @type {number} 鼻段縱向熔岩裂縫的後端 x */
const NOSE_CRACK_X0 = 58;

/**
 * 輪拱內襯：輪拱切口後面的一段圓柱面（只取上半圈），z 從側壁內面往內 depth
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 32;
  const a0 = 0.3;
  const a1 = Math.PI - 0.3;
  const pos = [];
  /** @type {(t: number) => number} */
  const zIn = (t) => P.hw(arch.x + r * Math.cos(t)) - 2.2;
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

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  obsidian: namedMaterial('paint-obsidian-black', { color: 0x121114, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
  obsidian2: namedMaterial('paint-obsidian-black', { color: 0x121114, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
  basalt: namedMaterial('paint-basalt-matte', { color: 0x2a2726, roughness: 0.7, clearcoat: 0.05 }),
  lava: namedMaterial('paint-lava-red', { color: 0xc8261a, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  lava2: namedMaterial('paint-lava-red', { color: 0xb01e14, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.15, side: THREE.DoubleSide }),
  // 熔岩發光：火山口內的熔岩盤
  glow: namedMaterial('lamp-lava-glow', { color: 0xff6a1a, emissive: 0xff4a08, emissiveIntensity: 0.6, roughness: 0.4 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x141215, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-basalt', { color: 0x221f1f, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x161214, roughness: 0.6 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x2a1c18, roughness: 0.05, specularIntensity: 0.7, transparent: true, opacity: 0.8, envMapIntensity: 0.6, depthWrite: false }),
  // 裂紋：橘紅低強度自發光貼紙（Blender 不過曝）
  dCrack: decalMaterial('decal-lava-crack', { color: 0xff5a14, emissive: 0xff3c00, emissiveIntensity: 0.45, roughness: 0.5 }),
  dSlot: decalMaterial('decal-fissure-black', { color: 0x050505, roughness: 0.8 }),
  dSilver: decalMaterial('decal-ash-silver', { color: 0xc9c6c0, roughness: 0.35, metalness: 0.5 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-basalt', { color: 0x1c1a1a, roughness: 0.7, side: THREE.DoubleSide }),
});

export const peleLavaBody = makePolyBody({
  id: 'body-pele-lava',
  name: '熔岩火山',
  style: 'myth',
  phase: 13,
  mythSeries: 'polynesian',
  mythTheme: 'pele',
  form: 'obsidian-shard',
  roof: 'canopy',
  wing: 'eruption-swan-neck',
  theme: '夏威夷火山女神 Pele 只用自然元素：黑曜石亮黑殼面切出多道銳利稜線，殼面一張發光的橘紅熔岩裂紋網、側面兩道往後斜升的熔岩紅色塊、前葉子板側面 4 道直條鰓縫、鼻段兩道往後流的縱向熔岩裂縫（縫底發光）；座艙後方一座圓錐形火山口進氣口，口內是發光熔岩；車尾一支往後彎下的天鵝頸單柱（噴發的弧線）吊著熔岩紅後掠翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 稜線（2）、肩線（3）、斜切稜線（5）是銳利稜線
  hard: [2, 3, 5],
  step: 0.68,
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 長座艙罩：x 34 → −18，最寬 13、最高 6（罩頂約 39），前端收尖
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = lerp(34, -18, u);
        const halfW = i === 0 || i === n ? 2 : 13 * Math.sin(Math.PI * u ** 1.35) ** 0.5;
        const rise = 6 * Math.sin(Math.PI * u ** 1.25) ** 0.6;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 20,
  zones: () => [
    // 下裙（斜切稜線以下）：玄武岩霧面
    { mat: 'basalt', keep: (x, y) => yChine(x) - 0.05 - y },
    // 側面熔岩紅斜切色塊
    { mat: 'lava', keep: (x, y, z) => (Math.abs(z) > P.hw(x) * 0.62 + 0.5 ? lavaSlashSd(x, y) : -1) },
    { mat: 'obsidian', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'obsidian' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'basalt', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({
      geometry: mergeGeos([buildLiner(ARCHES[0], 3.5), buildLiner(ARCHES[1], 3.5)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 火山口進氣口與口內熔岩盤
    const craterBase = P.yC(CRATER.x) - 0.2;
    parts.push({ geometry: buildCrater(craterBase), mat: 'basalt', solid: true, outline: true, name: 'crater-intake' });
    const lavaPool = new THREE.CylinderGeometry(CRATER.r1 - 1.2, CRATER.r1 - 1.2, 0.5, 20);
    lavaPool.translate(CRATER.x, craterBase + CRATER.h - 1.2, CRATER.z);
    parts.push({ geometry: lavaPool, mat: 'glow', solid: true, name: 'crater-lava' });
    // 天鵝頸單柱與後掠翼
    parts.push({ geometry: mergeGeos([buildNeck(), finPlate(SPINE, 0, 3.6)]), mat: 'obsidian2', solid: true, outline: true, name: 'swan-neck-pylon' });
    parts.push({ geometry: buildWing(), mat: 'obsidian2', solid: true, outline: true, name: 'swan-neck-wing' });
    parts.push({ geometry: mirroredPlate(WING_GLOW_HALF, WING_Y + WING_T, 0.3), mat: 'glow', solid: true, outline: true, name: 'wing-lava-edge' });
    // 兩道噴發弧：從後輪上方升起，托住翼梢端板
    parts.push({ geometry: buildArcs(), mat: 'lava2', solid: true, outline: true, name: 'eruption-arcs' });

    /** @type {(x: number, z: number) => boolean} 在側壁上（肩線以外） */
    const onSide = (x, z) => Math.abs(z) > P.hw(x) - 1.3;
    /** @type {(x: number, y: number, z: number) => boolean} 在熔岩紅色塊內 */
    const inSlash = (x, y, z) => Math.abs(z) > P.hw(x) * 0.62 + 0.5 && lavaSlashSd(x, y) > -0.3;
    // 熔岩裂紋網：以火山口為中心往外蔓延，越遠越細（0.62 → 0.3）、離火山口 64 mm 以外不畫（鼻段保持乾淨的黑曜石）；
    // 頂面用 (x, z)、側面用 (x, y) 的 Voronoi 裂紋，避開座艙、紅色塊、下裙與火山口
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < yChine(x) + 0.4 || kit.underCanopy(x, z) > -0.8 || inSlash(x, y, z) || x < X_TAIL + 1.5) {
          return -1;
        }
        const r = Math.hypot(x - CRATER.x, z - CRATER.z);
        if (r < CRATER.r0 + 1 || r > 64) {
          return -1;
        }
        const side = onSide(x, z);
        const d = side ? crackDist(x, y + (z > 0 ? 0 : 50), 13, 3) : crackDist(x, z, 15, 7);
        const w = 0.3 + 0.32 * (1 - r / 64);
        return w - d;
      }),
      mat: 'dCrack',
      name: 'decal-lava-cracks',
    });
    // 熔岩紅色塊上緣的灰白細邊（四視圖的銀線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < P.hw(x) * 0.62 + 0.5 || x < -60 || x > 24) {
          return -1;
        }
        const s = lavaSlashSd(x, y);
        return s > 0.35 ? -1 : 0.35 - Math.abs(s);
      }),
      mat: 'dSilver',
      name: 'decal-slash-edge',
    });
    // 前葉子板側面的直條鰓縫：前輪後方的側壁上 4 道直立黑縫，縫中央一道發光熔岩線
    /** @type {(x: number, y: number, z: number) => number} 到最近一道鰓縫中心線的距離；Infinity = 不在鰓縫區 */
    const gillDist = (x, y, z) => {
      if (!onSide(x, z) || x < GILL_X[0] - 1.5 || x > GILL_X[GILL_X.length - 1] + 1.5) {
        return Infinity;
      }
      if (y < yChine(x) + 1.2 || y > P.yS(x) - 1.4) {
        return Infinity;
      }
      return Math.min(...GILL_X.map((gx) => Math.abs(x - gx)));
    };
    parts.push({ geometry: kit.decal((x, y, z) => 0.6 - gillDist(x, y, z)), mat: 'dSlot', name: 'decal-gill-slots' });
    parts.push({ geometry: kit.decal((x, y, z) => 0.22 - gillDist(x, y, z), { offset: 0.12 }), mat: 'dCrack', name: 'decal-gill-glow' });
    // 鼻段兩道縱向往後流的熔岩裂縫：從鼻尖兩側往後、微微外張並不規則緩彎（不做橫向線條）
    /** @type {(x: number, z: number) => number} 到最近一道縱向裂縫的距離；Infinity = 不在範圍 */
    const noseCrackDist = (x, z) => {
      if (x < NOSE_CRACK_X0 || x > X_NOSE - 0.8) {
        return Infinity;
      }
      const t = (X_NOSE - x) / (X_NOSE - NOSE_CRACK_X0);
      const zc = lerp(2.2, 7.5, t) + 0.5 * Math.sin(x * 0.7 + 0.4) + 0.25 * Math.sin(x * 1.9);
      return Math.abs(Math.abs(z) - zc);
    };
    parts.push({ geometry: kit.decal((x, y, z) => 0.45 - noseCrackDist(x, z)), mat: 'dSlot', name: 'decal-nose-crack' });
    parts.push({ geometry: kit.decal((x, y, z) => 0.2 - noseCrackDist(x, z), { offset: 0.12 }), mat: 'dCrack', name: 'decal-nose-crack-glow' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry: '本檔站位產生器 P（推估），比例取自四視圖 16（shared/design/body-pele-lava/fourview_trace.txt）縮到底盤：鼻尖 x 77（離地 15）、車尾 −62；半寬車尾 30 / 後輪 26（後輪露出）/ 側艙 35（x −5 切進 7 mm 的 V 形裂口）/ 前輪 26（前輪露出）/ 鼻尖 8；肩線 32 高過 R17.5 輪拱；座艙罩頂約 39；天鵝頸頂 48.4（全車最高）',
    wing: '天鵝頸單柱（扁橢圓斷面 5.2 × 11 → 6.8，前面接中線脊鰭厚 3.6）、黑曜石後掠翼（半展 47.5、厚 2.4，往後伸到 x −75，後緣中央 V 形缺口到 x −69.5；前緣發光熔岩帶寬 2.4、厚 0.3）、兩道噴發弧（橢圓斷面半厚 2.3、半高 2.6 → 1.8，|z| 20 → 22.4，從 x −37.5 拱到翼面下）、火山口進氣口（底半徑 10.5、高 2.6 的旋轉體）：ABS 實心件（推估），質量 = 封閉體積 × 1.05 g/cm³；單柱、噴發弧與火山口底部埋進殼面',
    myth: 'Pele 與火山、熔岩、黑曜石的關聯：見 shared/design/body-pele-lava/DESIGN.md 列出的來源；只用自然元素，不做神像與人形',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
