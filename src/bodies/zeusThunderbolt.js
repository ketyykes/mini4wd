// 宙斯雷霆（body-zeus-thunderbolt，神話組・希臘）：只用宙斯的持物與象徵，車上沒有人像、臉、手或神像。
// 照四視圖 10 建模：細長低楔車頭、前端分岔成兩支往前刺的尖刃（中央鼻較短，俯視是一道叉口）、
// 座艙後隆起一道中脊一路收成車尾尖錐、尖錐上十字交叉的尾鰭。
// 元素：
// (1) 雷霆杖 keraunos → 前端兩支鋸齒閃電形前翼（金）、側面白／電光藍的鋸齒分色切線、引擎蓋中線一道金色閃電；
// (2) 橡樹（多多納的宙斯神諭橡樹）→ 尾翼兩側的橡葉形端板（金，葉緣圓裂片）；
// (3) 大理石神殿柱 → 後中脊上的縱向柱身溝槽（凹槽細線）、大理石白主色。
// 設計：shared/design/body-zeus-thunderbolt/DESIGN.md（典故來源與文物對應寫在 DESIGN.md）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、參數表到 72（殼只做到中央鼻端 NOSE_X，兩支閃電前翼再往前到 77.5） */
const XS = [-70, -66, -60, -52, -40, -28, -16, -5, 5, 15, 25, 35, 45, 52, 58, 63, 68, 72];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-70, -66, -60, -54, -46, -40, -30, -20, -10, 0, 10, 20, 30, 40, 48, 54, 58, 63, 68, 72];

/** @type {{ x: number, y: number, r: number }[]} 擋泥板眉線：以輪拱圓心為圓心、半徑 18.5（R17.5 輪拱外 1 mm）的圓弧 */
const BROWS = [
  { x: 40, y: 13, r: 18.5 },
  { x: -40, y: 13, r: 18.5 },
];

/**
 * 平滑取大值（交接處用半徑 k 的圓角接起來）
 * @type {(a: number, b: number, k: number) => number}
 */
const smoothMax = (a, b, k) => (a + b + Math.sqrt((a - b) ** 2 + k * k)) / 2;

/** @type {(x: number) => number} 擋泥板眉線高度（圓弧外回傳 0） */
const browY = (x) => {
  let y = 0;
  for (const b of BROWS) {
    const dx = x - b.x;
    if (Math.abs(dx) < b.r) {
      y = Math.max(y, b.y + Math.sqrt(b.r ** 2 - dx * dx));
    }
  }
  return y;
};

/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線殼頂：鼻端 14.6 → 前軸 33 的長楔；座艙段 34；座艙後隆起一道中脊（x −28 最高 44.5），往後降成車尾尖錐 33.5
  yTop: monoCurve(XS, [33.5, 35.5, 38, 41, 43.5, 44.5, 43, 37.5, 34.6, 34, 33.6, 33, 32.3, 29.2, 25.2, 21.4, 17.6, 14.6]),
  // 中脊高（中線殼頂 − 中脊兩側甲板）：只在座艙後；座艙前是整片微拱的引擎蓋
  crest: monoCurve(XS, [2.5, 3.5, 5, 7, 9, 10, 9, 3, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02]),
  // 中脊半寬：車尾尖錐 4 → 後軸 10.5
  crestW: monoCurve(XS, [4, 6, 8, 9.5, 10.5, 11, 11, 10, 9, 9, 9, 9, 9, 8, 6, 4.5, 3, 2]),
  // 肩稜線基本高度（前後輪上方再沿眉線拱起）
  yS: monoCurve(XS, [27, 28, 29, 29.5, 30, 30, 29.5, 29, 29, 29, 29.2, 29.5, 27.5, 23.5, 19, 16.2, 14.2, 13]),
  // 俯視半寬：細長車身、輪胎外側露在車身外（四視圖 10 的俯視）——前輪上方 30、座艙兩側收腰 20、後輪上方 31，車尾收成 6 的尖錐，車頭 5.5
  hw: monoCurve(XS_HW, [6, 10, 15, 22, 28.5, 31, 29.5, 25, 21, 20, 20, 22, 27, 30, 27, 21, 17, 12, 8, 5.5]),
  // 側裙下緣：兩輪之間抬到 16，車身浮在底盤上方（四視圖 10 的側視：車身下緣露出黑色底盤）
  yLow: monoCurve(XS, [14, 13.5, 13, 13, 13.5, 15, 16, 16, 16, 16, 15, 13.5, 13, 13, 13, 13, 13, 13]),
};

/** @type {(x: number) => number} 肩稜線（含眉線） */
const shoulderY = (x) => smoothMax(P.yS(x), browY(x), 1.2);

/**
 * 半剖面 8 點：中線 → 中脊頂 → 中脊側稜（銳利）→ 甲板 → 引擎蓋外緣 → 肩稜線（銳利）→ 微外張的側裙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const c = P.crest(x);
  const d = t - c;
  const h = P.hw(x);
  const s = Math.min(shoulderY(x), d - 0.3);
  const lo = P.yLow(x);
  const cw = Math.min(P.crestW(x), 0.32 * h);
  // 中脊側稜到甲板的距離：中脊高的地方 1.8（陡的側壁），沒有中脊的引擎蓋段放寬到 3，剖面點間距均勻、殼面不起皺
  const g = lerp(3, 1.8, smoothstep(0.5, 4, c));
  const zIn = cw + g;
  const flare = smoothstep(1, 8, h);
  return [
    [0, t],
    [0.6 * cw, t - 0.12 * c],
    [cw, d + 0.3 * c],
    [zIn, d],
    [lerp(zIn, h, 0.6), d - 0.4 * (d - s)],
    [h, s],
    [h + 0.7 * flare, lerp(s, lo, 0.5)],
    [h + 1.1 * flare, lo],
  ];
};

/** @type {number} 中央鼻端 x：兩支閃電前翼之間留一道深叉口（俯視 V 形缺口） */
const NOSE_X = 64;

/** @type {{ x: number, pts: number[][] }[]} 車尾與車鼻每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-70, -60, 1, profile).slice(0, -1), ...buildStations(-60, 56, 2, profile).slice(0, -1), ...buildStations(56, NOSE_X, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 7、前後半長 18、半寬 10.5） */
const CANOPY = { xc: 7, a: 18, b: 10.5, n: 2.2 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/**
 * 側面鋸齒分色線（雷霆的閃電）：白色上半與電光藍下半的交界，從鼻端往後斜升，中途兩次往下折回，側視是一道往後的閃電
 * @type {number[][]} (x, y) 折點，由前往後
 */
const BOLT_LINE = [
  [73, 15],
  [26, 26],
  [19, 21],
  [-27, 29.5],
  [-34, 24.5],
  [-71, 30.5],
];

/** @type {(x: number) => number} 分色線高度（折線依 x 內插；折回段用較陡的那段） */
const boltY = (x) => {
  for (let i = 0; i < BOLT_LINE.length - 1; i++) {
    const [x0, y0] = BOLT_LINE[i];
    const [x1, y1] = BOLT_LINE[i + 1];
    if (x <= x0 && x >= x1) {
      return lerp(y0, y1, (x0 - x) / (x0 - x1));
    }
  }
  return x > BOLT_LINE[0][0] ? BOLT_LINE[0][1] : BOLT_LINE[BOLT_LINE.length - 1][1];
};

/**
 * 點到折線的最短距離
 * @type {(pl: number[][], u: number, v: number) => number}
 */
const polylineDist = (pl, u, v) => {
  let best = Infinity;
  for (let i = 0; i < pl.length - 1; i++) {
    const [ax, ay] = pl[i];
    const [bx, by] = pl[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(u - ax - t * dx, v - ay - t * dy));
  }
  return best;
};

/** @type {number[][]} 引擎蓋中線的金色閃電 (x, z) 折點（座艙前 → 鼻端） */
const HOOD_BOLT = [
  [27, 1.5],
  [40, 4],
  [43.5, -1.8],
  [56, 1.6],
  [59, -2.4],
  [70, 0],
];

/**
 * 由半剖面反查 |z| 處的殼頂高度（剖面點 z 由中線往外遞增）
 * @type {(x: number, az: number) => number}
 */
const shellYAt = (x, az) => {
  const pts = profile(x);
  for (let i = 0; i < 5; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (az <= z1) {
      return lerp(y0, y1, Math.max(0, (az - z0) / Math.max(1e-6, z1 - z0)));
    }
  }
  return pts[5][1];
};

/**
 * 斜面薄板（俯視多邊形 (x, z)，每個頂點的底面高度由 yFn 給，厚度往上）：順著車鼻斜面的前翼
 * @type {(pts: number[][], yFn: (x: number, z: number) => number, thick: number) => THREE.BufferGeometry}
 */
const drapedPlate = (pts, yFn, thick) => {
  /** @type {THREE.Vector2[]} 邊加密到 1.5 mm，殼面曲率才跟得上 */
  const dense = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
    for (let k = 0; k < n; k++) {
      dense.push(new THREE.Vector2(lerp(ax, bx, k / n), -lerp(az, bz, k / n)));
    }
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(dense), { depth: 1, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, yFn(x, z) + pos.getY(i) * thick);
  }
  g.computeVertexNormals();
  return g;
};

/** @type {number} 尾翼半翼展 */
const WING_Z = 17;

/** @type {number[][]} 閃電前翼（+z 側）俯視外形 (x, z)：從前擋泥板往前外側刺出，外緣、內緣各折一次，尖端 (77.5, 26.5)；兩翼之間是中央鼻 */
const PRONG = [
  [46, 12],
  [46, 30.5],
  [58.5, 32],
  [60, 28.2],
  [77.5, 26.5],
  [65.5, 22.5],
  [67, 18.6],
  [55, 15.5],
];

/**
 * 橡葉外形（側視多邊形）：沿葉軸從葉柄到葉尖，葉緣是每側 lobes 個圓裂片
 * @type {(base: number[], tip: number[], halfW: number, lobes: number) => number[][]}
 */
const oakLeaf = (base, tip, halfW, lobes) => {
  const [bx, by] = base;
  const [tx, ty] = tip;
  const len = Math.hypot(tx - bx, ty - by);
  const ux = (tx - bx) / len;
  const uy = (ty - by) / len;
  const n = 36;
  /** @type {(t: number) => number} 葉寬：包絡（葉柄窄、中後段最寬）× 裂片 */
  const w = (t) => {
    const env = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.75 * (0.55 + 0.45 * t);
    const lobe = 0.5 + 0.5 * Math.abs(Math.sin(Math.PI * lobes * t)) ** 0.5;
    return Math.max(0.5, halfW * env * lobe * (1 - 0.35 * t * t));
  };
  /** @type {number[][]} */
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = w(t);
    out.push([bx + ux * len * t - uy * s, by + uy * len * t + ux * s]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const t = i / n;
    const s = w(t);
    out.push([bx + ux * len * t + uy * s, by + uy * len * t - ux * s]);
  }
  return out;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 大理石白：緞面（paint- 且 roughness > 0.5 → Blender 緞面）
  marble: namedMaterial('paint-marble-white', { color: 0xeeebe4, roughness: 0.55, clearcoat: 0.3 }),
  marbleSolid: namedMaterial('paint-marble-white', { color: 0xeeebe4, roughness: 0.55, clearcoat: 0.3, side: THREE.DoubleSide }),
  // 電光藍：亮面漆（側面下半、尾鰭）
  blue: namedMaterial('paint-electric-blue', { color: 0x1d5ad8, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  // 暴風海軍藍：側裙底緣（緞面）
  navy: namedMaterial('paint-storm-navy', { color: 0x151d36, roughness: 0.55, clearcoat: 0.25 }),
  // 真金屬金（名稱含 -brass → Blender metallic）：閃電前翼、橡葉端板
  gold: namedMaterial('trim-gold-brass', { color: 0xd6ad45, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1e2433, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x181b22, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1c22, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-navy', { color: 0x151d36, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x161a26, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-line', { color: 0xd6ad45, metalness: 0.75, roughness: 0.3 }),
  // 柱身溝槽：灰藍陰影細線（霧面）
  dFlute: decalMaterial('decal-marble-flute', { color: 0x8f98a8, roughness: 0.7 }),
  // 閃電光：電光青白，低強度自發光（Blender 不過曝）
  dBolt: decalMaterial('decal-lightning-glow', { color: 0x9fe0ff, emissive: 0x4fb4ff, emissiveIntensity: 0.45, roughness: 0.3 }),
});

export const zeusThunderboltBody = makePolyBody({
  id: 'body-zeus-thunderbolt',
  name: '宙斯雷霆',
  style: 'myth',
  phase: 13,
  mythSeries: 'greek',
  mythTheme: 'zeus',
  form: 'thunder-fork',
  roof: 'canopy',
  wing: 'oakleaf-cross',
  theme: '雷霆杖與神殿柱：細長低楔車頭前端分岔成兩支金色閃電前翼，側面白／電光藍的鋸齒閃電分色線，引擎蓋一道金色閃電；座艙後的大理石中脊刻著柱身溝槽，收成車尾尖錐，尖錐上十字交叉的電光藍尾鰭與白色尾翼，兩端是金色橡葉端板',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  step: 0.65,
  // 肩稜線是銳利稜線（中脊兩側用平滑曲面接到甲板，引擎蓋上不留折痕）
  hard: [5],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 座艙罩 x 25 → −11，最寬 10.5、高 6（座艙頂約 40.5，比後中脊低 4 mm）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 28; i++) {
        const u = i / 28;
        const x = lerp(CANOPY.xc + CANOPY.a, CANOPY.xc - CANOPY.a, u);
        out.push({ x, yBase: 0, yTop: 6 * Math.sin(Math.PI * u ** 0.8) ** 0.55, halfW: Math.max(2.2, canopyHalfW(x)) });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 側裙底緣：海軍藍
    { mat: 'navy', keep: (x, y) => P.yLow(x) + 2 - y },
    // 鋸齒分色線以下：電光藍
    { mat: 'blue', keep: (x, y, z) => Math.min(boltY(x) - y, Math.abs(z) - 8) },
    // 大理石白
    { mat: 'marble', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'marble' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'blue', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯與輪胎內側的環形擋板（接成一個輪室）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // ── 閃電前翼（實體，金）：兩支鋸齒形尖刃貼著車鼻斜面往前刺，尖端越過中央鼻端，俯視是一道叉口 ──
    {
      // 前翼是一片平面斜板（射出件不會順著曲面扭曲）：斜率取殼面 (x 50, |z| 16) 與鼻端中線附近 (x 70, |z| 3) 兩點，底面埋進殼面 0.6
      const y50 = shellYAt(50, 16);
      const y70 = shellYAt(70, 3);
      /** @type {(x: number, z: number) => number} */
      const yFn = (x) => y50 - 0.6 + ((y70 - y50) * (x - 50)) / 20;
      const geos = [1, -1].map((sg) => drapedPlate(PRONG.map(([x, z]) => [x, sg * z]), yFn, 1.5));
      parts.push({ geometry: mergeGeos(geos), mat: 'gold', solid: true, outline: true, name: 'thunderbolt-prongs' });
    }

    // ── 車尾十字尾鰭：中脊上一片電光藍閃電鰭（上緣兩折），十字交叉一片白色尾翼，兩端金色橡葉端板 ──
    {
      const fin = [
        [-50, P.yTop(-50) - 1],
        [-61, 46.6],
        [-65, 46],
        [-73, 48.6],
        [-72.4, 41],
        [-70.6, P.yTop(-70) - 1.2],
        [-66, P.yTop(-66) - 1],
        [-60, P.yTop(-60) - 1],
        [-52, P.yTop(-52) - 1],
      ];
      parts.push({ geometry: finPlate(fin, 0, 1.8), mat: 'blue', solid: true, outline: true, name: 'bolt-tail-fin' });
      // 尾翼：前緣後掠，翼展 ±WING_Z（比車尾窄，俯視看得到尖錐尾），貫穿中脊尾錐與尾鰭（十字交叉）
      const wing = [
        [-57, -1],
        [-60.5, -WING_Z],
        [-69.5, -WING_Z],
        [-68, -1],
        [-68, 1],
        [-69.5, WING_Z],
        [-60.5, WING_Z],
        [-57, 1],
      ];
      parts.push({ geometry: flatPlate(wing, 41.2, 1.3), mat: 'marbleSolid', solid: true, outline: true, name: 'tail-wing' });
      // 橡葉端板：葉軸從前下往後上斜，葉尖高過翼面
      const leaf = oakLeaf([-55.5, 34.5], [-72.5, 47.6], 4.8, 4);
      parts.push({ geometry: mergeGeos([finPlate(leaf, WING_Z + 0.6, 1.4), finPlate(leaf, -WING_Z - 0.6, 1.4)]), mat: 'gold', solid: true, outline: true, name: 'oakleaf-endplates' });
    }

    // ---- 貼紙 ----
    // 鋸齒分色線上的金色細邊（線寬 0.8）＋線下一道電光細線
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => polylineDist(BOLT_LINE, side * u, v) - 0.4, { x0: 0, y0: 0, zMin: 8, side })),
        mat: 'dGold',
        name: `decal-bolt-edge-${side}`,
      });
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(polylineDist(BOLT_LINE.map(([x, y]) => [x, y - 2.2]), side * u, v) - 0.35, P.yLow(side * u) + 2.6 - v), { x0: 0, y0: 0, zMin: 14, side })),
        mat: 'dBolt',
        name: `decal-bolt-glow-${side}`,
      });
    }
    // 引擎蓋中線的金色閃電（座艙前 → 鼻端，前細後粗）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const w = lerp(0.5, 1.2, smoothstep(70, 27, x));
        return Math.min(w - polylineDist(HOOD_BOLT, x, z), 70.5 - x, x - 26, -kit.underCanopy(x, z));
      }),
      mat: 'dGold',
      name: 'decal-hood-bolt',
    });
    // 柱身溝槽：後中脊上 5 道縱向細槽（跟著中脊收窄），座艙後 → 尾鰭前
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const cw = Math.min(P.crestW(x), 0.32 * P.hw(x));
        const pitch = (cw * 1.5) / 4.5;
        const k = Math.round(z / pitch);
        const inBand = Math.abs(k) <= 2 ? 0.28 - Math.abs(z - k * pitch) : -1;
        return Math.min(inBand, -20 - x, x + 64, 0.9 * cw - Math.abs(z));
      }),
      mat: 'dFlute',
      name: 'decal-column-flutes',
    });
    // 座艙罩金色細框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > CANOPY.xc - CANOPY.a - 1.2 && x < CANOPY.xc + CANOPY.a + 1.2 ? Math.min(u + 1.0, 0.05 - u) : -1;
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // 細縫頭燈（電光青白）：鼻側肩線下方一道斜縫
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.45 - Math.abs(y - (shoulderY(x) - 1.6 + 0.08 * (x - 62))), x - 60, 69 - x, Math.abs(z) - 4)),
      mat: 'dBolt',
      name: 'lamp-slit-headlights',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    fourview: 'shared/design/fourview-ref/fourview_10_v1.png（AI 參考圖，只取造型：分岔尖鼻、座艙後中脊收成尾錐、十字尾鰭；尺寸以底盤為準）',
    geometry: '本檔站位產生器 P（推估）：殼 x −70 ~ 64（中央鼻端，兩翼之間是叉口）、閃電前翼尖 77.5、尾鰭後緣 −73；中線鼻端 14.6 → 前軸 33、座艙頂約 40.5、後中脊頂 44.5（x −28）、尾鰭頂 48.8（全車最高）；半寬前輪上方 30、座艙兩側 20、後輪上方 31（輪胎外側露在車身外）、車尾 6',
    prongs: '閃電前翼：ABS 實心斜面薄板厚 1.5 mm（斜率同車鼻），x 46 → 77.5、|z| 12–32，外緣與內緣各折一次（推估）',
    tail: '尾鰭厚 1.8、尾翼厚 1.3（翼展 ±17、弦長 11）、橡葉端板厚 1.4（葉長 22、半寬 4.8、每側 4 個圓裂片），皆 ABS 實心件（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
