// 阿波羅七弦琴（body-apollo-lyre，神話組・希臘）：只用阿波羅的持物與象徵，車上沒有人像、臉、手或神像。
// 照四視圖 06 建模，但壓低、加寬輪拱做回四驅車的矮寬感：寬平的鏟形低鼻、鼓起的前後擋泥板、短座艙，
// 車尾一道 C 形環翼（側視是往前勾的 C，正視是跨過整個車寬的門形環）。
// 元素：
// (1) 七弦琴 → C 形環翼就是琴框（兩側立柱 = 琴臂、頂樑 = 琴軛），頂樑到後甲板的琴橋之間拉七道金弦；
// (2) 太陽（後期與太陽神赫利俄斯合一）→ 四個輪拱外圍的金色放射線；
// (3) 月桂 → 兩側車門上一枝月桂葉形切割（深色葉片沿金色細莖排列）。
// 設計：shared/design/body-apollo-lyre/DESIGN.md（典故來源與文物對應寫在 DESIGN.md）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、鼻端 77 */
const XS = [-70, -64, -56, -48, -40, -30, -18, -5, 8, 20, 30, 40, 50, 58, 64, 69, 73, 77];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-70, -64, -56, -48, -40, -32, -22, -10, 0, 10, 20, 30, 40, 50, 58, 64, 69, 73, 77];

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
  // 中線殼頂：低平——鼻端 15、前軸 32.8、座艙段 33.6、後甲板 30（座艙罩頂約 40.5）
  yTop: monoCurve(XS, [30, 30.6, 31, 31.4, 32, 32.4, 33, 33.4, 33.6, 33.6, 33.4, 32.8, 30.6, 27, 23.6, 20.4, 17.6, 15]),
  // 肩稜線基本高度：兩輪之間低到 26，前後輪上方沿眉線拱起到 31.5（鼓起的擋泥板）
  yS: monoCurve(XS, [26, 27, 27.5, 27.8, 28, 27.5, 26.5, 26, 26, 26.5, 27.5, 28, 26.5, 23.5, 20.5, 18, 16, 14.5]),
  // 俯視半寬：前段是窄鼻、前輪外露（半寬 16）；後輪上方外擴到 40 的寬擋泥板，C 形環翼跨在上面——俯視「前窄後寬」的三角形
  hw: monoCurve(XS_HW, [32, 35.5, 38.5, 40, 40, 38, 30, 23, 20, 17.5, 16.5, 16, 16, 16, 15.5, 14.5, 13, 11.5, 9.5]),
  // 側裙下緣：兩輪之間抬到 14
  yLow: monoCurve(XS, [12, 11.2, 10.5, 10.5, 11, 12.5, 14, 14, 14, 13, 11.5, 10.5, 10.5, 11, 11.6, 12, 12.3, 12.5]),
  // 白色中央寬條紋半寬（鼻端 → 座艙前、座艙後 → 車尾）
  stripe: monoCurve(XS, [8, 8.5, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8.5, 8, 7, 6, 5, 4.5, 4]),
};

/** @type {(x: number) => number} 肩稜線（含眉線） */
const shoulderY = (x) => smoothMax(P.yS(x), browY(x), 1.2);

/**
 * 半剖面 7 點：中線 → 微圓的頂面 → 肩稜線（銳利）→ 微外張的側裙
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const h = P.hw(x);
  const s = Math.min(shoulderY(x), t - 0.5);
  const lo = P.yLow(x);
  const d = t - s;
  return [
    [0, t],
    [0.34 * h, t - 0.1 * d],
    [0.64 * h, t - 0.36 * d],
    [0.87 * h, t - 0.72 * d],
    [h, s],
    [h + 0.7, lerp(s, lo, 0.5)],
    [h + 1.1, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與車鼻每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-70, -62, 1, profile).slice(0, -1), ...buildStations(-62, 60, 2, profile).slice(0, -1), ...buildStations(60, 77, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 5、前後半長 20、半寬 11.5） */
const CANOPY = { xc: 5, a: 20, b: 11.5, n: 2.4 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/** @type {number[][]} C 形琴臂的中心線 (x, y)：從後擋泥板頂往後升起、繞過車尾、頂端往前勾成琴軛 */
const ARM_PATH = [
  [-49, 28.4],
  [-58.5, 31],
  [-66, 36.2],
  [-68.2, 41.6],
  [-65.4, 45.8],
  [-58, 46.9],
  [-49, 46.6],
  [-43.5, 44.6],
];
/** @type {number} 琴臂所在的 |z|（坐在後擋泥板頂上） */
const ARM_Z = 36.6;
/** @type {{ x0: number, x1: number, y: number, t: number }} 琴軛（頂樑）：跨過整個車寬的平板 */
const YOKE = { x0: -58.5, x1: -50.5, y: 45.6, t: 1.2 };
/** @type {number} 七道琴弦的 x 位置 */
const STRING_X = -54.5;
/** @type {number[]} 七道琴弦的 z 位置 */
const STRING_Z = [-13.5, -9, -4.5, 0, 4.5, 9, 13.5];

/**
 * 沿中心線取等寬帶狀外形（側視多邊形）：每個頂點往法線兩側各偏 w(t)/2
 * @type {(path: number[][], w: (t: number) => number, n?: number) => number[][]}
 */
const bandOutline = (path, w, n = 40) => {
  const curve = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  /** @type {number[][]} */
  const left = [];
  /** @type {number[][]} */
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const half = w(t) / 2;
    left.push([p.x - tg.y * half, p.y + tg.x * half]);
    right.push([p.x + tg.y * half, p.y - tg.x * half]);
  }
  return [...left, ...right.reverse()];
};

/**
 * 月桂枝：一條往後上升的細莖，兩側交錯排列尖橢圓葉（u = 從該側看過去的水平座標、v = 高度；回傳 { leaf, stem } 距離）
 * @type {(u: number, v: number) => { leaf: number, stem: number }}
 */
const laurel = (u, v) => {
  // 細莖：從 u 16（前輪後方）往後升到 u −20
  const stemY = (uu) => 16.6 + 0.2 * (16 - uu);
  const stem = u < -20.5 || u > 16.5 ? 9 : Math.abs(v - stemY(u)) - 0.4;
  let leaf = 9;
  for (let k = 0; k < 6; k++) {
    const uc = 12 - k * 6.2;
    const side = k % 2 === 0 ? 1 : -1;
    // 葉子從莖往後斜出 35°，長 7、最寬 2.6
    const ang = side * 0.62;
    const cx = uc - 2.6 * Math.cos(ang);
    const cy = stemY(uc) + 2.6 * Math.sin(ang) * 1.0 + side * 0.6;
    const du = u - cx;
    const dv = v - cy;
    const a = -du * Math.cos(ang) + dv * Math.sin(ang);
    const b = du * Math.sin(ang) + dv * Math.cos(ang);
    const L = 3.6;
    const W = 1.3 * Math.max(0, 1 - (a / L) ** 2);
    leaf = Math.min(leaf, Math.max(Math.abs(a) - L, Math.abs(b) - W));
  }
  return { leaf, stem };
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 太陽金黃：主色（亮面）
  sun: namedMaterial('paint-sun-yellow', { color: 0xf3b21a, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  // 象牙白：中央寬條紋、C 形環翼（亮面）
  white: namedMaterial('paint-ivory-white', { color: 0xf6f2e8, roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  whiteSolid: namedMaterial('paint-ivory-white', { color: 0xf6f2e8, roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  // 黑曜底緣（緞面）
  onyx: namedMaterial('paint-onyx-black', { color: 0x16130f, roughness: 0.55, clearcoat: 0.25 }),
  // 真金屬金：琴弦、琴橋（名稱含 -brass → Blender metallic）
  gold: namedMaterial('trim-gold-brass', { color: 0xd9ab3c, metalness: 0.85, roughness: 0.26, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x2a2620, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x1c1915, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1915, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-onyx', { color: 0x16130f, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-onyx', { color: 0x1a1713, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-ray', { color: 0xb07a1e, metalness: 0.75, roughness: 0.3 }),
  // 月桂葉切割：深橄欖黑（霧面）
  dCut: decalMaterial('decal-laurel-cut', { color: 0x1d2014, roughness: 0.7 }),
  // 頭燈：琥珀色低強度自發光（Blender 不過曝）
  dLamp: decalMaterial('decal-amber-lamp', { color: 0xffd36a, emissive: 0xffa526, emissiveIntensity: 0.45, roughness: 0.3 }),
});

export const apolloLyreBody = makePolyBody({
  id: 'body-apollo-lyre',
  name: '阿波羅七弦琴',
  style: 'myth',
  phase: 13,
  mythSeries: 'greek',
  mythTheme: 'apollo',
  form: 'sun-shovel',
  roof: 'canopy',
  wing: 'lyre-hoop',
  theme: '七弦琴、太陽與月桂：壓低加寬的金黃車身、寬平鏟形低鼻、鼓起的前後擋泥板與白色中央寬條紋；車尾一道白色 C 形環翼當琴框，頂樑到後甲板琴橋之間拉七道金弦；四個輪拱外圍金色放射線，兩側車門一枝深色月桂葉形切割',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  step: 0.65,
  // 肩稜線是銳利稜線
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 短座艙罩 x 25 → −15，最寬 11.5、高 7（座艙頂約 40.6）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 28; i++) {
        const u = i / 28;
        const x = lerp(CANOPY.xc + CANOPY.a, CANOPY.xc - CANOPY.a, u);
        out.push({ x, yBase: 0, yTop: 7 * Math.sin(Math.PI * u ** 0.8) ** 0.55, halfW: Math.max(2.2, canopyHalfW(x)) });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 黑曜底緣
    { mat: 'onyx', keep: (x, y) => P.yLow(x) + 1.8 - y },
    // 白色中央寬條紋
    { mat: 'white', keep: (x, y, z) => P.stripe(x) - Math.abs(z) },
    // 太陽金黃
    { mat: 'sun', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'sun' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'onyx', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯與輪胎內側的環形擋板（接成一個輪室）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // ── C 形環翼（琴框）：兩側 C 形琴臂（白，厚 2.2）＋琴軛頂樑（白），根部埋進後擋泥板 ──
    {
      const arm = bandOutline(ARM_PATH, (t) => lerp(3.8, 2.8, t));
      parts.push({ geometry: mergeGeos([finPlate(arm, ARM_Z, 2.2), finPlate(arm, -ARM_Z, 2.2)]), mat: 'whiteSolid', solid: true, outline: true, name: 'lyre-arms' });
      const yoke = [
        [YOKE.x1, -ARM_Z],
        [YOKE.x0, -ARM_Z],
        [YOKE.x0, ARM_Z],
        [YOKE.x1, ARM_Z],
      ];
      parts.push({ geometry: flatPlate(yoke, YOKE.y, YOKE.t), mat: 'whiteSolid', solid: true, outline: true, name: 'lyre-yoke' });
    }
    // ── 七道金弦（實體細圓柱 r 0.45、8 段）與後甲板上的金色琴橋 ──
    {
      const yDeck = P.yTop(STRING_X);
      const bridgeTop = yDeck + 1.4;
      const strings = STRING_Z.map((z) => {
        const len = YOKE.y - bridgeTop + 0.3;
        const g = new THREE.CylinderGeometry(0.45, 0.45, len, 8);
        g.translate(STRING_X, bridgeTop - 0.15 + len / 2, z);
        return g;
      });
      const bridge = new THREE.BoxGeometry(3, 2.4, 31);
      bridge.translate(STRING_X, yDeck + 0.2, 0);
      parts.push({ geometry: mergeGeos([...strings, bridge]), mat: 'gold', solid: true, outline: true, name: 'lyre-strings' });
    }

    // ---- 貼紙 ----
    // 輪拱外圍的太陽放射線：每個輪拱上半圈 11 道金線（內緣寬、往外收尖），內緣再一道金色弧線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < 26) {
          return -1;
        }
        let best = -1;
        for (const a of ARCHES) {
          const dx = x - a.x;
          const dy = y - a.y;
          const r = Math.hypot(dx, dy);
          const th = Math.atan2(dy, dx);
          if (th < 0.3 || th > Math.PI - 0.3) {
            continue;
          }
          const rim = 0.35 - Math.abs(r - 19.1);
          const k = Math.round((th - 0.3) / ((Math.PI - 0.6) / 10));
          const thk = 0.3 + (k * (Math.PI - 0.6)) / 10;
          const q = (r - 19.6) / 5.2;
          const ray = q < 0 || q > 1 ? -1 : lerp(0.75, 0.15, q) - Math.abs(th - thk) * r;
          best = Math.max(best, rim, ray);
        }
        return Math.min(best, y - P.yLow(x) - 2);
      }),
      mat: 'dGold',
      name: 'decal-sun-rays',
    });
    // 兩側車門的月桂葉形切割（深色葉片）＋金色細莖
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => laurel(side * u, v).leaf, { x0: 0, y0: 0, zMin: 22, side })),
        mat: 'dCut',
        name: `decal-laurel-leaves-${side}`,
      });
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(laurel(side * u, v).stem, -laurel(side * u, v).leaf - 0.05), { x0: 0, y0: 0, zMin: 22, side })),
        mat: 'dGold',
        name: `decal-laurel-stem-${side}`,
      });
    }
    // 白色條紋兩側的金色細邊
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - P.stripe(x) - 0.45), 76.5 - x, x + 69.5, -kit.underCanopy(x, z) - 0.5)),
      mat: 'dGold',
      name: 'decal-stripe-edge',
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
    // 細縫頭燈：鏟形鼻兩側肩線下一道長縫
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.5 - Math.abs(y - (shoulderY(x) - 1.5)), x - 62, 75.5 - x, Math.abs(z) - 9)),
      mat: 'dLamp',
      name: 'lamp-slit-headlights',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    fourview: 'shared/design/fourview-ref/fourview_06_v1.png（AI 參考圖，只取造型：寬平低鼻、鼓起的擋泥板、短座艙、車尾 C 形環翼；四視圖偏超跑，已壓低車身、加寬輪拱；尺寸以底盤為準）',
    geometry: '本檔站位產生器 P（推估）：殼 x −70 ~ 77；中線鼻端 15、座艙段 33.6、後甲板 30、座艙頂約 40.6、環翼頂約 48.3（全車最高）；半寬前段 16（前輪外露）、後輪上方 40、鼻端 9.5、車尾 32',
    lyre: 'C 形琴臂：ABS 實心帶狀板，寬 3.8 → 2.8、厚 2.2，|z| 36.6；琴軛頂樑 x −58.5 ~ −50.5、厚 1.2、跨 ±36.6；七道琴弦為 r 0.45 的實心圓柱（8 段），間距 4.5；琴橋 3 × 2.4 × 31（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
