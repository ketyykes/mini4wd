// 火鳥（body-firebird，第八階段神話組・斯拉夫）：俄羅斯民間故事的火鳥（Zhar-ptitsa）——羽毛全是金的、眼睛像東方水晶，
// 夜裡飛進果園時整座園子像點了許多火；掉下的一根尾羽亮得像紅太陽（Magnus 1916 英譯 Afanasyev〈伊凡王子、光明鳥與灰狼〉）。
// 造型：低而流線的鳥身（俯視是飛鳥：前段展開的寬翅膀、往後掠收成細長鳥身與尾根）、車頭短小的金色鳥喙＋三片往後掠的金色冠羽、
// 中段琥珀色座艙罩（鳥背），車尾 5 根往後上方拖曳的細長尾羽（尾翼 plume-train），羽端是孔雀眼似的金框朱紅圓斑。
// 配色與紋樣取自 Khokhloma 漆器（黑底＋朱紅＋金、捲曲的草葉紋 / 火焰羽紋）：黑漆殼面（亮面）、朱紅（霧面）、金（真金屬實體件 / 金色貼紙）。
// 刻意避開：中國鳳凰（雞冠、卷雲尾）、希臘不死鳥（從火焰中升起的姿態）、Fawkes、寶可夢火焰鳥、Marvel Phoenix 徽章、Stravinsky 芭蕾舞台服。
// 設計：shared/design/body-firebird/DESIGN.md（研究一節列出實際打開的來源）。剖面為本檔站位產生器（推估）。
// 不含任何廠商 / 作品名稱、商標、文字或人臉。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −61、鳥喙尖 75 */
const XS = [-61, -57, -51, -40, -28, -14, 0, 14, 28, 40, 50, 58, 64, 69, 72.5, 75];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 俯視半寬（翅緣）：飛鳥俯視——翅膀長在身體前段（翅尖最寬 46.5 在前輪上方 x 40），翅後緣往後掠收成細長的鳥身（座艙段 24.5–26）
  // 與尾根（後輪上方 23、車尾 12）；翅前緣往前收成鳥頸（x 58：20）與鳥頭、鳥喙尖 1.6。後輪胎外側露在殼外（輪拱 R17.5 切開側裙，間隙照常）
  hw: monoCurve(XS, [12, 15, 18.5, 23, 24, 24.5, 26, 32.5, 43, 46.5, 40, 20, 11.5, 6.6, 3.8, 1.6]),
  // 中線殼頂（鳥背）：前後輪上方 33.6、座艙段 32.4 的低背，往前下斜成鳥頭與鳥喙（喙尖 16.8）
  yTop: monoCurve(XS, [27.5, 30, 32.4, 33.6, 33.2, 32.6, 32.4, 32.6, 33.2, 33.6, 31.6, 28.4, 25.4, 22, 19.2, 16.8]),
  // 翅緣（頂面與側裙交界，銳利稜線）：前後輪上方隆起到 32.4（高過 R17.5 輪拱頂 30.5，輪胎上方有完整的殼面），
  // 中段翅緣往下垂到 26.8（翅後緣收進鳥身處）
  yS: monoCurve(XS, [24, 27, 30.8, 32.4, 30.4, 27.6, 26.8, 27.6, 30.4, 32.4, 30.8, 25.5, 21.8, 18.8, 17.2, 16]),
  // 側裙下緣
  yLow: monoCurve(XS, [15, 13.5, 11.5, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11, 12, 13, 14, 14.8, 15.4]),
};

/**
 * 半剖面 8 點：中線 → 圓背（鳥身）→ 翅根 → 往外緩降的翅面 → 翅緣（銳利）→ 微外張的側裙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  const d = t - s;
  return [
    [0, t],
    [0.2 * h, t - 0.07 * d],
    [0.38 * h, t - 0.3 * d],
    [0.56 * h, t - 0.6 * d],
    [0.8 * h, t - 0.86 * d],
    [h, s],
    [h + 0.6, lerp(s, lo, 0.5)],
    [h + 1.0, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與頭部每 0.75 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-61, -51, 0.75, profile).slice(0, -1), ...buildStations(-51, 58, 2, profile).slice(0, -1), ...buildStations(58, 75, 0.75, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 6、前後半長 19、半寬 10.5） */
const CANOPY = { xc: 6, a: 19, b: 10.5, n: 2.4 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/** @type {number} 金色鳥喙的起點 x */
const X_BEAK = 70.2;
/** @type {(x: number) => number} 朱紅裙帶上緣（側裙下緣往上 2.4 mm） */
const yRedBand = (x) => P.yLow(x) + 2.4;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // Khokhloma 黑漆：亮面（全車主要的亮面部位）
  black: namedMaterial('paint-khokhloma-black', { color: 0x0e0b0a, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  black2: namedMaterial('paint-khokhloma-black', { color: 0x0e0b0a, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
  // 朱紅：霧面（roughness > 0.5 → Blender 緞面）
  cinnabar: namedMaterial('paint-cinnabar-red', { color: 0xb3261e, roughness: 0.56, clearcoat: 0.1 }),
  // 火焰橘（iter-118：翼面 / 尾羽的紅 → 橘 → 金漸層中段；亮面漆）
  orange: namedMaterial('paint-flame-orange', { color: 0xe8661a, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  // 金：真金屬（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xd1a23e, metalness: 0.8, roughness: 0.3, clearcoat: 0.3 }),
  // 琥珀色座艙罩（火光透過鳥背）
  glass: namedMaterial('pc-smoke-tint', { color: 0x4a2a0e, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x161212, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x120e0c, roughness: 0.5, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-wheelwell-black', { color: 0x15110f, roughness: 0.7, side: THREE.DoubleSide }),
  // 「眼睛像東方水晶」：淡冰色水晶燈片
  eye: namedMaterial('lamp-crystal', { color: 0xf4f8ff, emissive: 0xd8e6ff, emissiveIntensity: 0.35, roughness: 0.06, clearcoat: 1.0 }),
  dGold: decalMaterial('decal-gold-khokhloma', { color: 0xd6a640, metalness: 0.75, roughness: 0.3 }),
  dRed: decalMaterial('decal-cinnabar', { color: 0xc0281c, roughness: 0.5 }),
  dBlack: decalMaterial('decal-lacquer-black', { color: 0x0e0b0a, roughness: 0.3, clearcoat: 0.6 }),
});

/** @type {number} 尾羽根數 */
const PLUME_COUNT = 5;

/** @type {number[][]} 各根尾羽的羽端圓斑中心 [x, y, |z|]（依 |k| = 0 … 2）：中央最長最高，兩側較短較低、往外張 */
const PLUME_EYES = [
  [-67.4, 45.2, 0],
  [-65.6, 42.6, 5.6],
  [-62.8, 39.6, 10.8],
];

/**
 * 單根尾羽中心線（k = −2 … 2）：羽根錯開排在後甲板中線兩側（z = 2.4k），先貼著後甲板往後拖、後段再往上揚到羽端圓斑
 * @type {(k: number) => number[][]} 33 個點（s = 0 … 1）
 */
const plumePath = (k) => {
  const n = 32;
  const ak = Math.abs(k);
  const sg = Math.sign(k);
  const xr = -30 - 1.2 * ak;
  const zr = 2.4 * k;
  const yr = P.yTop(xr) - 0.9 - 0.03 * zr * zr;
  const [xe, ye, aze] = PLUME_EYES[ak];
  const ze = sg * aze;
  /** @type {number[][]} */
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const x = lerp(xr, xe, s);
    const z = lerp(zr, ze, s * s);
    // 拖曳：前段貼近殼面（低升幅），後段才往上揚
    const y = yr + (ye - yr) * (0.18 * s + 0.82 * s ** 2.4);
    pts.push([x, y, z]);
  }
  return pts;
};

/** @type {(s: number) => number[]} 尾羽斷面半徑 [橫向, 垂直]：直立的細長羽片（厚 1.3、高 1.8 → 3.4），根部稍粗 */
const plumeRadius = (s) => [lerp(0.75, 0.6, s), lerp(1.0, 1.7, s) + 0.25 * Math.sin(Math.PI * s)];

/** @type {[number, number, string][]} 尾羽分段上色：[s0, s1, 材質鍵]（iter-118 火焰漸層：朱紅羽根 → 火焰橘羽身 → 金色羽梢，不再用黑漆） */
const PLUME_SEGMENTS = [
  [0, 0.3, 'cinnabar'],
  [0.3, 0.66, 'orange'],
  [0.66, 1, 'gold'],
];

/**
 * 翼面火焰漸層（iter-118）：從翅緣往內依序 金 → 橘 → 朱紅，各帶內緣是往後甩的火舌（鋸齒），再往內才是黑漆鳥身；
 * 頭部（x > 46）漸縮回黑漆。回傳「距翅緣的距離 − 該帶門檻」（負值 = 在該帶內）。只作用在翅緣以上的頂面。
 * @type {(band: number) => (x: number, y: number, z: number) => number}
 */
const flameBand = (band) => (x, y, z) => {
  if (y < P.yS(x) - 0.4) {
    return 1;
  }
  const w = P.hw(x) - Math.abs(z);
  // 門檻 [金, 橘, 朱紅]（mm）
  const base = [3, 7.5, 14][band];
  // 火舌：每 11 mm 一舌、圓滑的火焰尖往內舔（相位隨帶錯開，三層火舌交錯）
  const ph = 0.5 + 0.5 * Math.sin((2 * Math.PI * (x + 3.7 * band)) / 11);
  const tongue = 4.2 * ph ** 1.8;
  // 頭部收回：x 46 → 54 門檻縮到 0
  const fade = Math.max(0, Math.min(1, (54 - x) / 8));
  return w - (base + tongue) * fade;
};

/**
 * 側視橢圓立板（羽端圓斑的各層）：中心 (cx, cy)、半軸 a × b、長軸轉 rot（弧度）、沿 z 厚 thick
 * @type {(cx: number, cy: number, a: number, b: number, rot: number, zc: number, thick: number) => THREE.BufferGeometry}
 */
const ellipsePlate = (cx, cy, a, b, rot, zc, thick) => {
  /** @type {number[][]} */
  const pts = [];
  const n = 36;
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const u = a * Math.cos(t);
    const v = b * Math.sin(t);
    pts.push([cx + u * Math.cos(rot) - v * Math.sin(rot), cy + u * Math.sin(rot) + v * Math.cos(rot)]);
  }
  return finPlate(pts, zc, thick);
};

/**
 * 五根尾羽＋羽端孔雀眼圓斑（金框 → 朱紅 → 黑漆瞳），依材質分組合併
 * @type {() => Record<string, THREE.BufferGeometry[]>}
 */
const buildPlumes = () => {
  /** @type {Record<string, THREE.BufferGeometry[]>} */
  const byMat = {};
  for (let k = -(PLUME_COUNT - 1) / 2; k <= (PLUME_COUNT - 1) / 2; k++) {
    const path = plumePath(k);
    const n = path.length - 1;
    for (const [s0, s1, mat] of PLUME_SEGMENTS) {
      const i0 = Math.round(s0 * n);
      const i1 = Math.round(s1 * n);
      const g = sweepEllipse(path.slice(i0, i1 + 1), Math.max(6, (i1 - i0) * 2), (t) => plumeRadius(lerp(s0, s1, t)), 12);
      (byMat[mat] ??= []).push(smoothNormals(g));
    }
    // 羽端圓斑：長軸沿羽梢方向（往後上），三層同心橢圓立板，越內層越厚 → 側看是凸起的孔雀眼
    const [xe, ye] = path[n];
    const [xp, yp] = path[n - 2];
    const rot = Math.atan2(ye - yp, xe - xp);
    const ze = path[n][2];
    // 外圈往羽梢方向偏 1 mm（像羽片包著圓斑）
    const ox = Math.cos(rot) * 0.8;
    const oy = Math.sin(rot) * 0.8;
    (byMat.gold ??= []).push(ellipsePlate(xe + ox, ye + oy, 4.4, 3.1, rot, ze, 1.1));
    (byMat.cinnabar ??= []).push(ellipsePlate(xe, ye, 2.9, 2.1, rot, ze, 1.5));
    (byMat.black2 ??= []).push(ellipsePlate(xe - ox * 0.4, ye - oy * 0.4, 1.3, 1.1, rot, ze, 1.9));
  }
  return byMat;
};

/**
 * 頭頂冠羽：三片往後掠、羽尖微翹的金色薄羽（中片 + 兩側往外張 14°），根部埋進頭頂 1 mm
 * @type {(top: (x: number, z: number) => number) => THREE.BufferGeometry}
 */
const buildCrest = (top) => {
  /** @type {(x0: number, len: number, rise: number, zc: number) => number[][]} */
  const feather = (x0, len, rise, zc) => {
    const yb = top(x0, zc) - 1;
    const yb2 = top(x0 - 3.2, zc) - 1;
    return [
      [x0, yb],
      [x0 - 0.6, yb + rise * 0.55],
      [x0 - len * 0.55, yb + rise * 0.92],
      [x0 - len, yb + rise],
      [x0 - len * 0.82, yb + rise * 0.62],
      [x0 - 3.2, yb2 + 1.1],
      [x0 - 3.2, yb2],
    ];
  };
  return mergeGeos([
    finPlate(feather(66.5, 10.5, 6.2, 0), 0, 1.3),
    finPlate(feather(65, 8.6, 4.8, 1.9), 1.9, 1.1, -14),
    finPlate(feather(65, 8.6, 4.8, -1.9), -1.9, 1.1, 14),
  ]);
};

/**
 * 側面火焰羽紋（Khokhloma 的捲草 / 火焰羽）：從前方低處往後上方甩出的長羽舌，羽尖往上捲；回傳到羽形邊界的近似距離（負值 = 在羽內）
 * @type {(x: number, y: number) => number}
 */
const flameFeathers = (x, y) => {
  let best = Infinity;
  // [羽根 x, 羽根 y, 長, 最大半寬]
  for (const [x0, y0, len, w] of [
    [21.5, 12.6, 21, 3.1],
    [9.5, 13.4, 20, 2.9],
    [-2.5, 12.8, 19.5, 3],
    [-13.5, 13.6, 13, 2.4],
  ]) {
    // 局部座標：a 沿羽（往後上 16°），b 垂直
    const ang = (16 * Math.PI) / 180;
    const dx = x0 - x;
    const dy = y - y0;
    const a = dx * Math.cos(ang) + dy * Math.sin(ang);
    const b0 = -dx * Math.sin(ang) + dy * Math.cos(ang);
    const t = a / len;
    // 羽尖往上捲
    const b = b0 - 3.2 * Math.max(0, t) ** 2.2;
    const tc = Math.max(0, Math.min(1, t));
    const half = w * Math.sin(Math.PI * tc ** 0.7) ** 0.8;
    const d = Math.max(Math.abs(b) - half, -a, a - len);
    best = Math.min(best, d);
  }
  return best;
};

export const firebirdBody = makePolyBody({
  id: 'body-firebird',
  name: '火鳥',
  style: 'myth',
  phase: 8,
  mythSeries: 'slavic',
  mythTheme: 'zhar-ptitsa',
  form: 'firebird-glide',
  roof: 'canopy',
  wing: 'plume-train',
  theme: '低而流線的鳥身＋前段展開往後掠的寬翅膀（俯視飛鳥形）、金色短喙與三片冠羽、琥珀座艙罩；車尾 5 根往後上方拖曳的長尾羽，羽端金框朱紅孔雀眼；Khokhloma 黑漆＋朱紅＋金的火焰羽紋',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 翅緣是銳利稜線
  hard: [5],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 超橢圓座艙：x 25 → −13（每 1.27 mm 一站）；最寬 10.5、最高 8.4（座艙頂約 39.9）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = lerp(25, -13, u);
        const halfW = Math.max(2.4, canopyHalfW(x));
        const rise = 8.4 * Math.sin(Math.PI * u ** 0.75) ** 0.6;
        out.push({ x, yBase: 0, yTop: rise, halfW });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 金色鳥喙
    { mat: 'gold', keep: (x) => x - X_BEAK },
    // 朱紅裙帶（側裙最下 2.4 mm）
    { mat: 'cinnabar', keep: (x, y) => yRedBand(x) - y },
    // 側裙下半火焰橘（iter-118）：上緣是起伏的火舌，頭部（x > 50）維持黑漆
    {
      mat: 'orange',
      keep: (x, y) => Math.min(50 - x, yRedBand(x) + 0.5 * (P.yS(x) - yRedBand(x)) + 1.4 * Math.sin((2 * Math.PI * x) / 9) - y),
    },
    // 翼面火焰漸層（iter-118）：翅緣金 → 橘 → 朱紅火舌
    { mat: 'gold', keep: (x, y, z) => -flameBand(0)(x, y, z) },
    { mat: 'orange', keep: (x, y, z) => -flameBand(1)(x, y, z) },
    { mat: 'cinnabar', keep: (x, y, z) => -flameBand(2)(x, y, z) },
    // 黑漆
    { mat: 'black', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', glass: 'glass', cockpit: 'black', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 23.4, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // 冠羽（金，實體件）
    parts.push({ geometry: buildCrest(top), mat: 'gold', solid: true, outline: true, name: 'firebird-crest' });
    // 五根尾羽＋孔雀眼羽端（實體件，依段上色）
    for (const [mat, geos] of Object.entries(buildPlumes())) {
      parts.push({ geometry: mergeGeos(geos), mat, solid: true, outline: true, name: `plume-train-${mat}` });
    }
    // 尾羽根座：金色扁橢球，把五根羽根和後甲板接成一體
    const boss = new THREE.SphereGeometry(1, 32, 16);
    boss.scale(5.2, 1.8, 7.6);
    boss.translate(-31.8, P.yTop(-31.8) - 0.4, 0);
    parts.push({ geometry: boss, mat: 'gold', solid: true, outline: true, name: 'plume-root-boss' });

    // ---- 貼紙 ----
    // 座艙框（金，座艙罩外圍 1.2 mm）＋座艙到羽根座的金色背脊線＋座艙到冠羽的金色頸線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        const ring = x > -14.2 && x < 26.2 ? Math.min(u + 1.2, 0.05 - u) : -1;
        const spine = Math.min(0.5 - Math.abs(z), -12.5 - x, x + 30);
        const neck = Math.min(0.45 - Math.abs(z), x - 25.8, 58 - x);
        return Math.max(ring, spine, neck);
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // 翅緣金線（沿翅緣稜線內側 0.7 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - (P.hw(x) - 1.2)), X_BEAK - 1 - x, x + 59, y - P.yS(x) + 0.1)),
      mat: 'dGold',
      name: 'decal-wing-edge',
    });
    // 翅面羽鱗：往後疊的扇形羽片（金色弧線 0.6 mm），翅根到翅緣、座艙兩側
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (x < -24 || x > 47 || az < canopyHalfW(x) + 3.2 || az > P.hw(x) - 2.6) {
          return -1;
        }
        const R = 3.4;
        const row = Math.round((az - 6) / (1.6 * R));
        const zc = 6 + row * 1.6 * R;
        const off = row % 2 === 0 ? 0 : R;
        const xc = Math.round((x - off) / (2 * R)) * 2 * R + off;
        // 羽片弧：圓心在 (xc + R·0.6, zc)，只取後半圈（x < 圓心）
        const cx = xc + 0.6 * R;
        const r = Math.hypot(x - cx, az - zc);
        if (x > cx) {
          return -1;
        }
        return 0.3 - Math.abs(r - R);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-wing-scales',
    });
    // 側面火焰羽紋：朱紅羽舌＋金色外框（線寬 0.7）
    /** @type {(x: number, y: number, z: number) => boolean} 側裙（翅緣以下、輪拱外） */
    const onSkirt = (x, y, z) => Math.abs(z) > P.hw(x) - 0.2 && y < P.yS(x) - 0.6 && y > yRedBand(x) + 0.3 && archRingDist(x, y) > 1.2;
    parts.push({
      geometry: kit.decal((x, y, z) => (onSkirt(x, y, z) ? -flameFeathers(x, y) : -1), { offset: 0.1 }),
      mat: 'dRed',
      name: 'decal-flame-feathers-red',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSkirt(x, y, z) ? 0.36 - Math.abs(flameFeathers(x, y) + 0.1) : -1), { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-flame-feathers-gold',
    });
    // 側面金色細捲鬚（Khokhloma「草紋」）：羽舌之間的小金點（漿果）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSkirt(x, y, z)) {
          return -1;
        }
        let d = Infinity;
        for (const [bx, by] of [[15.6, 21], [3.4, 21.4], [-8.6, 21], [-19.5, 20.4], [26.5, 19.6]]) {
          d = Math.min(d, Math.hypot(x - bx, y - by) - 0.75);
        }
        return -d;
      }, { offset: 0.12 }),
      mat: 'dRed',
      name: 'decal-berries',
    });
    // 鳥眼：水晶燈片＋金色眼框（頭部兩側上面）
    /** @type {(grow: number) => (x: number, y: number, z: number) => number} */
    const eye = (grow) => (x, y, z) => {
      if (y < 18 || x < 58) {
        return -1;
      }
      return grow + 1 - Math.hypot((x - 63.2) / 2.1, (Math.abs(z) - 0.62 * P.hw(63.2)) / 1.45);
    };
    parts.push({ geometry: kit.decal(eye(0), { offset: 0.12 }), mat: 'eye', name: 'lamp-crystal-eyes' });
    const eyeIn = eye(0);
    const eyeOut = eye(0.42);
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(eyeOut(x, y, z), -eyeIn(x, y, z)), { offset: 0.1 }), mat: 'dGold', name: 'decal-eye-rims' });
    // 鳥頭的朱紅頰羽（眼後往後下的一道羽紋）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 50 || x > 61 || y < 17) {
          return -1;
        }
        const zc = 0.62 * P.hw(x) + 0.12 * (61 - x);
        return Math.min(1.1 - Math.abs(Math.abs(z) - zc) - 0.06 * (61 - x), x - 50.5);
      }, { offset: 0.1 }),
      mat: 'dRed',
      name: 'decal-cheek-plume',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）；座艙罩同厚度以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估）：殼面 x −61 ~ 75（鳥喙尖），尾羽孔雀眼尖約 x −72（batch5 規格「長約 145–153」）；殼頂 32.4–33.6、座艙頂約 40.8、尾羽頂約 50（batch5「高約 40–50（尾羽頂）」）；前段翅膀半寬 46.5 + 側裙外張 1.0（外框 ±46.6）（車殼外框半寬 ≤ 48，避免碰撞體寬過導輪外緣 ±48.5）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；輪拱內襯擋住殼內空腔',
    plumes: '尾羽：5 根 ABS 實心掃掠件（厚約 1.3、高 2–3.4 mm，推估），羽端三層同心橢圓立板（金 8.8 × 6.2 × 1.1、朱紅 5.8 × 4.2 × 1.5、黑 2.6 × 2.2 × 1.9 mm）；根部錯開 2.4 mm 排在後甲板＋金色根座',
    crest: '冠羽：3 片金色立板（厚 1.1–1.3，中片長 10.5、高 6.2；兩側外張 14°，推估），質量 = 封閉體積 × 1.05 g/cm³',
    palette: 'Khokhloma 漆器的黑＋朱紅＋金（研究來源見 DESIGN.md）；色碼自訂（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
