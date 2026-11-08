// 波賽頓三叉戟（body-poseidon-trident，神話組・希臘）：只用波賽頓的持物與象徵，車上沒有人像、臉、手或神像。
// 照四視圖 11 建模：鈍而高的珍珠白船首、寬方的車身、長座艙、平的後甲板、車尾單柱撐起的尾翼；平面改成前三叉、後魚尾，和其他款拉開。
// 元素：
// (1) 三叉戟 → 鼻頭三支同高的珍珠白尖（中尖從船首下方伸出、兩支外尖往外再往前彎，俯視是往前的 Ψ）；車尾一支三叉戟立柱穿過尾翼（後視 Ψ）；
// (2) 浪花／海 → 魚尾形尾翼（後緣中央 V 形凹口）；側裙下緣往外翻的浪唇，上面一條長浪線捲成兩個大浪；
// (3) 浪峰 → 側面一道起伏的浪形分色線。
// 設計：shared/design/body-poseidon-trident/DESIGN.md（典故來源與文物對應寫在 DESIGN.md）。剖面為本檔站位產生器（推估）。
// 塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −70、殼的鼻端 69（中尖再往前伸到 76.3） */
const XS = [-70, -65, -55, -40, -25, -15, -5, 5, 15, 25, 35, 45, 55, 60, 64, 67, 69];
/** @type {number[]} 俯視半寬的站位 */
const XS_HW = [-70, -65, -55, -40, -30, -15, 0, 10, 25, 40, 55, 61, 66, 69];

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
  // 中線殼頂：船首鼻端高 23.8（鈍而高），往後經 x 60 的 25.8 爬升到座艙段 33；座艙後的後甲板緩緩降到車尾 28.8（尾翼單柱露出更長）
  yTop: monoCurve(XS, [28.8, 29.4, 30.2, 31.1, 32, 32.6, 33, 33, 32.8, 32.8, 32.8, 32.4, 28.4, 25.8, 25.8, 25.2, 23.8]),
  // 肩稜線基本高度（前後輪上方再沿眉線拱起）
  yS: monoCurve(XS, [25, 25.4, 26, 26.4, 26, 25.5, 25.5, 25.5, 26, 27.5, 29.5, 28.5, 25.5, 22.5, 21, 20, 19]),
  // 俯視半寬：前輪上方寬浮筒（37.5），往前收成船首（x 61 有 14、鼻端 6），船首下方伸出三叉戟的中尖，兩側另有兩支外尖；兩輪之間的側箱 27.5（把底盤側框蓋住）、後輪上方 30.5，
  // 車尾收窄到 13，兩側由魚尾形尾翼的兩片尾鰭往後伸出
  hw: monoCurve(XS_HW, [13, 18, 26.5, 30.5, 29, 27.5, 27.5, 27.5, 30.5, 37.5, 24, 14, 9, 6]),
  // 側裙下緣：兩輪之間壓到 10.2（底盤側壁頂 9.4 的正上方），側面看不到車身和底盤之間的縫
  yLow: monoCurve(XS, [13, 12.5, 12, 11.5, 10.6, 10.2, 10.2, 10.2, 10.2, 10.6, 11.5, 11.5, 11.8, 12.2, 12.4, 12.6, 12.8]),
  // 珍珠白中脊半寬（鼻端整支中尖都是白色 → 座艙兩側 → 後甲板收窄）
  spine: monoCurve(XS, [8, 9, 10, 11, 12, 12.5, 12.5, 12.5, 12.5, 12, 11, 10, 9.5, 9.5, 9.5, 9.5, 9.5]),
};

/** @type {(x: number) => number} 肩稜線（含眉線） */
const shoulderY = (x) => smoothMax(P.yS(x), browY(x), 1.2);

/** @type {(x: number) => number} 浪唇側裙往外翻的量（兩輪之間 4.2，靠近輪拱收回 0） */
const sillFlare = (x) => 0 * smoothstep(23, 15, Math.abs(x));

/**
 * 半剖面 8 點：中線 → 微圓的頂面 → 肩稜線（銳利）→ 微外張的側裙 → 下緣往外翻的浪唇（兩輪之間）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const h = P.hw(x);
  const s = Math.min(shoulderY(x), t - 0.5);
  const lo = P.yLow(x);
  const d = t - s;
  const f = sillFlare(x);
  return [
    [0, t],
    [0.34 * h, t - 0.08 * d],
    [0.64 * h, t - 0.3 * d],
    [0.87 * h, t - 0.68 * d],
    [h, s],
    [h + 0.8, lerp(s, lo, 0.45)],
    [h + 1.1 + 0.35 * f, lerp(s, lo, 0.78)],
    [h + 1.2 + f, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與車鼻每 1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(-70, -62, 1, profile).slice(0, -1), ...buildStations(-62, 58, 2, profile).slice(0, -1), ...buildStations(58, 69, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];

/** @type {{ xc: number, a: number, b: number, n: number }} 座艙罩俯視外形（超橢圓：中心 x 4、前後半長 23、半寬 10） */
const CANOPY = { xc: 4, a: 23, b: 10, n: 2.8 };

/** @type {(x: number) => number} 座艙罩俯視半寬 */
const canopyHalfW = (x) => {
  const q = Math.min(1, Math.abs(x - CANOPY.xc) / CANOPY.a);
  return CANOPY.b * (1 - q ** CANOPY.n) ** (1 / CANOPY.n);
};

/** @type {(x: number) => number} 側面浪形分色線（深海藍下半與海藍上半）：兩道往後推的浪，越往後越高 */
const waveY = (x) => {
  const base = lerp(17, 23.5, smoothstep(72, -68, x));
  return base + 2.6 * Math.sin(((x + 8) / 38) * Math.PI * 2);
};

/** @type {number} 鼻頭三叉的底面高度 */
const TINE_Y = 15.5;

/** @type {number[][]} 鼻頭中尖俯視外形 (x, z)：從船首下方往前伸，兩側倒鉤，尖端 (76.3, 0) */
const SPEAR = [
  [60, -4],
  [70, -4],
  [69.5, -7.5],
  [76.3, 0],
  [69.5, 7.5],
  [70, 4],
  [60, 4],
];

/** @type {number[][]} 鼻頭外尖（+z 側）俯視外形 (x, z)：從前輪前方往外再往前彎，外側一個倒鉤（|z| 42），尖端 (74.5, 35)；和中尖合成往前的 Ψ */
const TINE = [
  [56, 13],
  [56, 23],
  [60, 32],
  [63.5, 42],
  [65.5, 38],
  [74.5, 35],
  [66, 30],
  [60.5, 21],
  [58.5, 13],
];

/** @type {number[][]} 魚尾形尾翼（+z 半邊）俯視外形 (x, z)：前緣往後掠到翼尖，後緣往前收成中央的 V 形凹口 */
const FLUKE = [
  [-54.5, 0],
  [-57.5, 13],
  [-60.5, 27],
  [-64.5, 39],
  [-69.5, 46],
  [-75, 46.4],
  [-75.4, 41.5],
  [-74, 32],
  [-71, 20],
  [-69, 9],
  [-68.5, 0],
];

/** @type {{ x: number, y: number, t: number, rim: number }} 車尾尾翼（三叉戟立柱 x、高度、厚度、外緣圓管半徑） */
const DISC = { x: -62, y: 35.2, t: 0.5, rim: 1 };

/** @type {number} 三叉戟頭的橫樑底高（立柱從後甲板穿過尾翼到這裡，尾翼上方露出約 2.5） */
const TRIDENT_BAR_Y = 38.4;

/**
 * 三叉戟頭外形（後視 (z, y)，Ψ 字：橫樑上三支帶倒鉤的尖；寬 ±21、高 10，是車尾的主角）
 * @type {number[][]}
 */
const TRIDENT_HEAD = (() => {
  const bar = TRIDENT_BAR_Y + 1.8;
  /** @type {(zc: number, w: number, top: number) => number[][]} 一支尖（由右側往上、繞過尖端、左側往下），尖頭長 5、倒鉤外伸 2.8 */
  const prong = (zc, w, top) => [
    [zc + w, bar],
    [zc + w, top - 5],
    [zc + w + 2.8, top - 6.2],
    [zc, top],
    [zc - w - 2.8, top - 6.2],
    [zc - w, top - 5],
    [zc - w, bar],
  ];
  // 底邊由左到右，再依序繞過右、中、左三支尖回到左下角
  return [[-21, TRIDENT_BAR_Y], [21, TRIDENT_BAR_Y], ...prong(17.5, 2, 47.6), ...prong(0, 2.4, 48.6), ...prong(-17.5, 2, 47.6)];
})();

/** @type {number} 側裙長浪線的週期（兩輪之間只有 2 個浪峰，各捲一個大浪） */
const SURF_PERIOD = 24;

/**
 * 捲浪螺線：從浪峰底部往後、往上再往前捲進中心的 1.7 圈內縮螺線（2D 距離，負值 = 在紋樣內）
 * @type {(x: number, v: number, xc: number, vc: number, r0: number, w: number) => number}
 */
const curlDist = (x, v, xc, vc, r0, w) => {
  const rho = Math.hypot(x - xc, v - vc);
  // 由正下方起算、順時針（往後 → 上 → 前）的角度
  const a0 = Math.atan2(v - vc, x - xc);
  let th = (-Math.PI / 2 - a0) % (Math.PI * 2);
  if (th < 0) {
    th += Math.PI * 2;
  }
  const span = Math.PI * 1.7;
  let best = 9;
  for (const t of [th, th + Math.PI * 2]) {
    if (t <= span) {
      const rs = r0 * (1 - 0.62 * (t / span));
      best = Math.min(best, Math.abs(rho - rs) - w * (1 - 0.35 * (t / span)));
    }
  }
  return best;
};

/**
 * 側裙長浪線：一條長週期的起伏流線，兩個浪峰（x −12、12）各捲成一個大浪（x 為車身座標，負值 = 在紋樣內）
 * @type {(x: number, v: number, v0: number) => number}
 */
const surfDist = (x, v, v0) => {
  const amp = 0.7;
  const yMain = v0 + amp * Math.sin((2 * Math.PI * (x + 18)) / SURF_PERIOD);
  // 主浪線：線寬 0.9，兩端收細
  const dMain = Math.max(Math.abs(v - yMain) - 0.45 * smoothstep(23, 18, Math.abs(x)) - 0.05, Math.abs(x) - 22.5);
  const r0 = 1.5;
  let dCurl = 9;
  for (const xc of [-12, 12]) {
    dCurl = Math.min(dCurl, curlDist(x, v, xc, v0 + amp + r0, r0, 0.45));
  }
  return Math.min(dMain, dCurl);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 愛琴海藍：主色（亮面）
  sea: namedMaterial('paint-aegean-blue', { color: 0x1670c2, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  // 深海藍：浪形分色線以下（亮面）
  deep: namedMaterial('paint-deep-sea-blue', { color: 0x163f86, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  deepSolid: namedMaterial('paint-deep-sea-blue', { color: 0x163f86, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
  // 珍珠白：中脊、鼻頭三叉、三叉戟
  pearl: namedMaterial('paint-pearl-white', { color: 0xf3f0e8, metalness: 0.2, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  // 深海軍藍：側裙底緣（緞面）
  navy: namedMaterial('paint-deep-navy', { color: 0x0f2140, roughness: 0.55, clearcoat: 0.25 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1c2a36, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x141c24, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x141a22, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-navy', { color: 0x0f2140, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x111824, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dPearl: decalMaterial('decal-pearl-line', { color: 0xf3f0e8, roughness: 0.35, clearcoat: 0.6 }),
  // 浪花青光：低強度自發光（Blender 不過曝）
  dFoam: decalMaterial('decal-foam-glow', { color: 0x8ff2e6, emissive: 0x3fd8c8, emissiveIntensity: 0.4, roughness: 0.3 }),
});

export const poseidonTridentBody = makePolyBody({
  id: 'body-poseidon-trident',
  name: '波賽頓三叉戟',
  style: 'myth',
  phase: 13,
  mythSeries: 'greek',
  mythTheme: 'poseidon',
  form: 'wave-ring',
  roof: 'canopy',
  wing: 'trident-disc',
  theme: '三叉戟與浪：鈍而高的珍珠白船首，下方與兩側伸出三支同高的珍珠白尖（俯視是往前的 Ψ）；珍珠白中脊從船首一路到車尾；海藍車身、側面起伏的浪形分色線下是深海藍，側裙下緣往外翻成浪唇、壓到底盤側壁正上方，浪唇上一條長浪線捲成兩個大浪；車尾收窄，單柱撐起白邊深海藍魚尾形尾翼（後緣中央 V 形凹口），一支大三叉戟立柱從尾翼中央穿出',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  step: 0.7,
  // 肩稜線是銳利稜線
  hard: [4],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 長座艙罩 x 27 → −19，最寬 10、高 6.4（座艙頂約 40.8）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = lerp(CANOPY.xc + CANOPY.a, CANOPY.xc - CANOPY.a, u);
        out.push({ x, yBase: 0, yTop: 6.4 * Math.sin(Math.PI * u ** 0.75) ** 0.5, halfW: Math.max(2.2, canopyHalfW(x)) });
      }
      return out;
    })(),
  },
  sideZMin: 30,
  zones: () => [
    // 側裙浪唇：深海軍藍（長浪線與捲浪貼在這一圈上）
    { mat: 'navy', keep: (x, y) => P.yLow(x) + 6.8 - y },
    // 珍珠白中脊
    { mat: 'pearl', keep: (x, y, z) => P.spine(x) - Math.abs(z) },
    // 浪形分色線以下：深海藍
    { mat: 'deep', keep: (x, y) => waveY(x) - y },
    // 海藍
    { mat: 'sea', keep: () => 1 },
  ],
  capFrontBands: [{ mat: 'pearl' }],
  mats: { inner: 'inner', edge: 'edge', cap: 'navy', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯與輪胎內側的環形擋板（接成一個輪室）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // ── 鼻頭三叉（珍珠白，厚 3.2）：中尖從船首下方往前伸到 76.3，兩支外尖往外再往前彎，三支同高，俯視與正視都是往前的 Ψ ──
    const tines = [1, -1].map((sg) => flatPlate(TINE.map(([x, z]) => [x, sg * z]), TINE_Y, 3.2));
    parts.push({ geometry: mergeGeos([...tines, flatPlate(SPEAR, TINE_Y, 3.2)]), mat: 'pearl', solid: true, outline: true, name: 'trident-nose-tines' });

    // ── 車尾：單柱（珍珠白）撐起深海藍魚尾形尾翼，三叉戟立柱從尾翼中央穿出（珍珠白，後視 Ψ）──
    {
      // 單柱做成一道浪峰立板：前緣是往上捲的浪面，後緣越過車尾往下收
      /** @type {(x: number) => number} 後甲板中線高度（埋進殼面 1 mm） */
      const deckY = (x) => P.yTop(Math.max(x, -70)) - 1;
      const pylon = [
        [-48.5, deckY(-48.5)],
        [-52.5, deckY(-52.5) + 1.8],
        [-55.2, DISC.y - 0.6],
        [-56.5, DISC.y + 0.2],
        [-72.8, DISC.y + 0.2],
        [-73.4, 33.2],
        [-71.6, 30.4],
        [-69.6, deckY(-69.6)],
      ];
      parts.push({ geometry: finPlate(pylon, 0, 2), mat: 'pearl', solid: true, outline: true, name: 'disc-pylon' });
      /** @type {number[][]} 魚尾形尾翼整圈外形（+z 半邊往後繞到 −z 半邊） */
      const fluke = [...FLUKE, ...FLUKE.slice(1, -1).reverse().map(([x, z]) => [x, -z])];
      parts.push({ geometry: flatPlate(fluke, DISC.y, DISC.t), mat: 'deepSolid', solid: true, outline: true, name: 'fluke-wing' });
      // 尾翼外緣一圈珍珠白圓管（直徑 2），讓尾翼看起來有厚度
      /** @type {number[][]} */
      const rimPath = [...fluke, fluke[0]].map(([x, z]) => [x, DISC.y + DISC.t / 2, z]);
      parts.push({ geometry: sweepEllipse(rimPath, 120, () => [DISC.rim, DISC.rim], 8), mat: 'pearl', solid: true, outline: true, name: 'fluke-rim' });
      // 三叉戟：一支立柱（4.6 × 3.4）從後甲板穿過尾翼中央往上，頂端是 Ψ 形三叉頭（左右對稱、置中）
      const yShaft = P.yTop(DISC.x) - 1;
      const shaft = new THREE.BoxGeometry(4.6, TRIDENT_BAR_Y + 0.4 - yShaft, 3.4);
      shaft.translate(DISC.x, (yShaft + TRIDENT_BAR_Y + 0.4) / 2, 0);
      const head = finPlate(TRIDENT_HEAD, 0, 1.8);
      head.rotateY(Math.PI / 2);
      head.translate(DISC.x, 0, 0);
      parts.push({ geometry: mergeGeos([shaft, head]), mat: 'pearl', solid: true, outline: true, name: 'trident-staff' });
    }

    // ---- 貼紙 ----
    // 中脊兩側的珍珠白細邊已由分區做出；分區交界加一道浪花青光細線（線寬 0.7），從進氣口兩側一路拉到車尾
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - P.spine(x) - 0.6), 68.5 - x, x + 69.5, -kit.underCanopy(x, z) - 0.6)),
      mat: 'dFoam',
      name: 'decal-spine-foam-line',
    });
    // 浪形分色線上的珍珠白細線
    for (const side of [-1, 1]) {
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => Math.max(Math.abs(v - waveY(side * u) - 0.35) - 0.35, v - shoulderY(side * u) + 0.6), { x0: 0, y0: 0, zMin: 12, side })),
        mat: 'dPearl',
        name: `decal-wave-line-${side}`,
      });
      // 側裙浪唇上的長浪線與兩個捲浪（珍珠白，前後輪之間）
      parts.push({
        geometry: kit.decal(sideDecal((u, v) => surfDist(side * u, v, P.yLow(side * u) + 4.5), { x0: 0, y0: 0, zMin: 12, side })),
        mat: 'dPearl',
        name: `decal-surf-wave-${side}`,
      });
    }
    // 座艙罩珍珠白細框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > CANOPY.xc - CANOPY.a - 1.2 && x < CANOPY.xc + CANOPY.a + 1.2 ? Math.min(u + 0.9, 0.05 - u) : -1;
      }),
      mat: 'dPearl',
      name: 'decal-canopy-frame',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    fourview: 'shared/design/fourview-ref/fourview_11_v1.png（AI 參考圖，只取造型：鈍而高的鼻、寬方車身、長座艙、車尾單柱尾翼；鼻頭圓筒被評審讀成眼睛，已改成三叉；尺寸以底盤為準）',
    geometry: '本檔站位產生器 P（推估）：殼 x −70 ~ 69、鼻頭中尖到 76.3；中線船首 23.8、座艙段 33、後甲板 32、三叉戟頂 48.9（全車最高）；半寬前輪上方 37.5、兩輪之間 27.5（側箱蓋住底盤側框）、後輪上方 30.5、車尾 13；兩輪之間下緣 11.5',
    tines: '鼻頭三叉：ABS 實心平板厚 3.2、底面高 15.5；中尖 x 60 → 76.3、倒鉤 ±7.5；外尖從 x 56 往外再往前彎，倒鉤到 |z| 42、尖端 (74.5, ±35)（推估）',
    tail: '單柱厚 1.8；魚尾形尾翼厚 0.5、高 35.2，翼尖 x −75、|z| 46.4，後緣中央凹口 x −68.5，外緣珍珠白圓管直徑 2；三叉戟立柱 4.6 × 3.4 從後甲板穿過尾翼到 38.8，三叉頭厚 1.8、寬 ±21（含倒鉤 ±22.3）、中尖頂 48.6（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
