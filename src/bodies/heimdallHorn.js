// 海姆達爾的號角（body-heimdall-horn，神話組・北歐）：守護彩虹橋 Bifröst、在諸神黃昏吹響加拉爾號角的海姆達爾。
// 造型照四視圖 04：低平的 T 形鼻翼、從引擎罩一路爬升進尾翼的背線、兩側低平的側箱與高起的後輪拱，
// 招牌是跨過後輪的平板橋翼——這裡就是彩虹橋：整片翼面塗成五色彩虹帶（每側由外往內紅、橘、金、綠、藍），到尾翼段跟著往兩側展開，下方兩片拱形支柱讓側視看得到一道橋拱。
// 加拉爾號角長在車身上：引擎蓋中線躺著一支亮金大號角，吹嘴頂著座艙罩、往前張開成朝前的大喇叭口（象牙白箍環、鉻唇）；車尾中央另有一支金色喇叭口從尾翼後緣的凹口露出（裡面五色彩虹環）。
// 橋翼尾段往兩側展開成寬尾翼，兩端是由上往下紅、橘、金、綠、藍的彩虹端板。
// 設計：shared/design/body-heimdall-horn/DESIGN.md（典故：《散文埃達》Gylfaginning；彩虹橋三色見 MYTH_RESEARCH 北歐節 N12）。
// 塗裝全為自創；不用盧恩字母、不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, fenderFloor, smoothMax } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildBellySkirt } from './trojanHorse.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 殼前端（T 形鼻翼前緣）x */
const X_FRONT = 76;
/** @type {number} 殼後端 x */
const X_REAR = -66;

/** @type {number[]} 中脊參數的站位 */
const XS = [-66, -62, -56, -48, -40, -32, -24, -16, -10, -4, 6, 16, 26, 36, 44, 52, 58, 63, 68, 72, 76];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中脊頂：T 形鼻翼 20 → 引擎罩緩升 → 座艙後一路爬升到橋翼前緣下 43（背線直接長進橋翼）→ 橋下引擎蓋降到 31（橋拱下的空間）→ 車尾 28
  yc: monoCurve(XS, [28, 29.5, 30.5, 31, 31, 31, 32, 37, 43.2, 43, 37.5, 33.5, 30, 27.5, 25.5, 24, 23, 22, 21, 20.5, 20]),
  // 中脊半寬：座艙段 9.5、橋下引擎蓋 15（橋翼支柱立在上面），鼻段收到 6
  zs: monoCurve(XS, [13, 15, 15.5, 15.5, 15, 14, 12, 10.5, 10, 9.5, 9.5, 9, 8, 7, 6.5, 6, 6, 6, 6, 6, 6]),
};

/** @type {number[]} 側箱與輪拱參數的站位 */
const XS_HW = [-66, -64, -58, -50, -40, -28, -18, -8, 2, 12, 22, 30, 40, 50, 56, 61, 66, 70, 73, 76];
/** @type {Record<string, (x: number) => number>} */
const Q = {
  // 俯視半寬：寬 T 形鼻翼 32 → 兩前輪之間的窄鼻 22.5（前輪露在外面，像四視圖俯視）→ 後段漸寬 → 後輪拱 34（後輪胎外緣露出）→ 後輪後方往內收成 24 的車尾，車尾收向號角口
  hw: monoCurve(XS_HW, [24, 26.5, 31, 33.5, 34, 34, 33, 30.5, 27, 24.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 29.5, 32, 32, 29.5]),
  // 下緣
  lo: monoCurve(XS_HW, [18, 17.5, 16.5, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16.2, 16.4, 16.6, 16.6, 16.6, 16.6]),
};

/** @type {(x: number) => number} 側箱 / 輪拱頂高：後輪軸上方抬到 R17.5 輪拱之上，其餘是 26 的低側箱（前輪外露，不需要前輪拱） */
const yPod = (x) => {
  const rear = fenderFloor(x, [-40]) + 3.2 - 0.04 * Math.max(0, -x - 52) ** 2;
  // T 形鼻翼：鼻頸以前降到和中脊同高的平板
  const nose = x > 58 ? lerp(26, P.yc(x), Math.min(1, (x - 58) / 6)) : 26;
  return smoothMax(x > 58 ? nose : 26, rear, 1);
};

/** @type {(x: number) => number} 中脊與側箱之間的低谷高度（鼻翼段漸平） */
const yValley = (x) => {
  const depth = x > 60 ? lerp(1.8, 0.3, Math.min(1, (x - 60) / 8)) : 1.8;
  return Math.min(P.yc(x), yPod(x)) - depth;
};

/** @type {(x: number) => number} 低谷外緣 |z|（側箱內稜之前）：輪拱段保持在 17.5，避開 |z| ≥ 21 的輪拱切口 */
const zValley = (x) => Math.min(Math.max(P.zs(x) + 1.4, 17.5), Q.hw(x) - 9);

/**
 * 半剖面 12 點（多切面：除了中線，每一點都是銳利稜線）：中脊頂 → 中脊肩 → 低谷 → 側箱內稜 → 側箱頂的折線 → 外肩 →
 * 側壁往內斜切的腰線（四視圖側面那道深斜切）→ 下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yc = P.yc(x);
  const zs = P.zs(x);
  const hw = Q.hw(x);
  const lo = Q.lo(x);
  const yv = yValley(x);
  const yp = Math.max(yPod(x), yv + 0.6);
  const zv = zValley(x);
  const zr = Math.min(zv + 2.5, hw - 6);
  // 側箱頂中間一道折線（往上 0.8），讓頂面分成兩個斜面
  const zm = (zr + hw - 3) / 2;
  // 側壁腰線：外肩下往內斜切 1.6 mm，再往外回到下緣（側視是一道深陰影線）
  const yWaist = Math.max(lo + 3.2, yp - 7.2);
  return [
    [0, yc],
    [0.55 * zs, yc - 0.25],
    [zs, yc - 1.1],
    [Math.min(zs + 1.2, zv - 0.1), yv],
    [zv, yv],
    [zr, yp - 0.4],
    [zm, yp + 0.8],
    [hw - 3, yp],
    [hw - 0.5, yp - 3.2],
    [hw - 2.1, yWaist],
    [hw - 0.3, lo + 1.2],
    [hw, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = buildStations(X_REAR, X_FRONT, 2, profile);

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm）；前段車身半寬只有 22.5、在輪胎內側，前輪拱實際上不切殼 */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 23 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];

/** @type {{ x0: number, x1: number, hw0: number, hw1: number, y: number, t: number }} 彩虹橋翼：前緣 x −4（座艙後背線長進去）→ 後緣 −70，半寬由 12 往後展開到 19 */
const BRIDGE = { x0: -4, x1: -74, hw0: 12, hw1: 19, y: 43.2, t: 0.6 };
/** @type {{ xRoot: number, xTip: number, hw: number, drop: number }} 寬尾翼：橋翼從 xRoot 起後掠外展到 xTip 的翼端半寬 hw，翼端板往下伸 drop */
const TAIL_WING = { xRoot: -50, xTip: -59, hw: 47.4, drop: 6 };
/** @type {{ x: number, zIn: number, zOut: number }} 尾翼後緣中央的凹口：車尾號角口從這裡露出來；凹口底 x、底部半寬 zIn、開口半寬 zOut（在後緣 BRIDGE.x1） */
const TAIL_NOTCH = { x: -66.5, zIn: 13, zOut: 21 };
/** @type {(x: number) => number} 尾翼凹口在 x 處的半寬（凹口底之前為 0） */
const notchHalfW = (x) => (x >= TAIL_NOTCH.x ? 0 : lerp(TAIL_NOTCH.zIn, TAIL_NOTCH.zOut, (TAIL_NOTCH.x - x) / (TAIL_NOTCH.x - BRIDGE.x1)));
/** @type {(x: number) => number} 橋翼在 x 處的半寬 */
const bridgeHalfW = (x) => lerp(BRIDGE.hw0, BRIDGE.hw1, (BRIDGE.x0 - x) / (BRIDGE.x0 - BRIDGE.x1));

/** @type {{ r1: number, depth: number }} 車尾號角喇叭口：口緣半徑、從車尾直牆往後伸出的深度 */
const TAIL_BELL = { r1: 8.2, depth: 4.6 };

/** @type {string[]} 彩虹細線的材質鍵（由外緣往內）：紅、橘、金、綠、藍 */
const RAINBOW = ['rbRed', 'rbOrange', 'rbGold', 'rbGreen', 'rbBlue'];

/** @type {{ x0: number, x1: number, zOut: number, yTop: number, yBot: number, t: number }} 側箱外殼：前後輪之間每側一片直立板（|z| zOut，在底盤側框外），下緣到底盤上緣、上緣 yTop 用頂板接回殼側壁，兩輪之間整片封起來 */
const SKIRT = { x0: -22.5, x1: 22.5, zOut: 37.4, yTop: 23.6, yBot: 10.5, t: 0.4 };

/** @type {{ x0: number, x1: number, xBell: number, r0: number, r1: number, rBell: number, lift: number }} 引擎蓋上的加拉爾大號角：吹嘴在座艙罩前 x0，沿引擎蓋中線往前一路張開到 x1，之後外張成朝前的喇叭口（口緣 xBell）；lift = 軸心高出殼面的比例（乘半徑） */
const HOOD_HORN = { x0: 27, x1: 56, xBell: 69, r0: 1.5, r1: 4.2, rBell: 7.6, lift: 0.85 };

/** @type {(x: number) => { y: number, r: number }} 引擎蓋大號角在 x 處的軸心高度與半徑（貼著引擎蓋背線彎，前段外張成喇叭口） */
const hoodHornAt = (x) => {
  /** @type {number} */
  let r;
  if (x <= HOOD_HORN.x1) {
    r = lerp(HOOD_HORN.r0, HOOD_HORN.r1, ((x - HOOD_HORN.x0) / (HOOD_HORN.x1 - HOOD_HORN.x0)) ** 1.2);
  } else {
    r = lerp(HOOD_HORN.r1, HOOD_HORN.rBell, ((x - HOOD_HORN.x1) / (HOOD_HORN.xBell - HOOD_HORN.x1)) ** 2.2);
  }
  return { y: P.yc(x) + HOOD_HORN.lift * r, r };
};

/**
 * 引擎蓋大號角（圓管薄殼，口端開放朝前）：沿 x 逐段畫圓環、接成錐管
 * @type {() => THREE.BufferGeometry}
 */
const buildHoodHorn = () => {
  const nx = 36;
  const na = 18;
  /** @type {number[]} */
  const pos = [];
  /** @type {(i: number, k: number) => number[]} */
  const at = (i, k) => {
    const x = lerp(HOOD_HORN.x0, HOOD_HORN.xBell, i / nx);
    const { y, r } = hoodHornAt(x);
    const a = (2 * Math.PI * k) / na;
    return [x, y + r * Math.sin(a), r * Math.cos(a)];
  };
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < na; k++) {
      const a = at(i, k);
      const b = at(i + 1, k);
      const c = at(i + 1, k + 1);
      const d = at(i, k + 1);
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 主色：珍珠白（側箱、輪拱）；冰藍（中脊、鼻翼、後輪拱外側斜面、橋翼）
  frost: namedMaterial('paint-frost-pearl-white', { color: 0xeef3f7, roughness: 0.32, clearcoat: 0.8 }),
  ice: namedMaterial('paint-ice-blue', { color: 0x8fc7e6, roughness: 0.3, clearcoat: 0.8 }),
  iceSolid: namedMaterial('paint-ice-blue', { color: 0x8fc7e6, roughness: 0.3, clearcoat: 0.8 }),
  // 下半部側壁與下緣：深石墨藍（和珍珠白、冰藍對比）
  navy: namedMaterial('paint-cobalt-metallic', { color: 0x234a86, metalness: 0.5, roughness: 0.28, clearcoat: 1.0 }),
  throat: namedMaterial('paint-night-navy', { color: 0x1a2438, roughness: 0.45, clearcoat: 0.4, side: THREE.DoubleSide }),
  frostSide: namedMaterial('paint-frost-pearl-white', { color: 0xeef3f7, roughness: 0.32, clearcoat: 0.8, side: THREE.DoubleSide }),
  chrome: namedMaterial('trim-chrome-brass', { color: 0xe4eaf0, metalness: 1.0, roughness: 0.08 }),
  ivory: namedMaterial('paint-horn-ivory', { color: 0xf1e8d2, roughness: 0.4, clearcoat: 0.5 }),
  // 真金屬（名稱含 -brass → Blender metallic）：號角箍環與喇叭口
  gold: namedMaterial('trim-gold-brass', { color: 0xd8b04a, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  // 號角：亮金（偏淺、低粗糙度）
  hornGold: namedMaterial('trim-horn-gold-brass', { color: 0xf0c85a, metalness: 0.9, roughness: 0.18, clearcoat: 0.5, emissive: 0x5a4010, emissiveIntensity: 0.35, side: THREE.DoubleSide }),
  // 橋翼支柱：拋光銀
  silver: namedMaterial('trim-silver-brass', { color: 0xc9d2da, metalness: 0.8, roughness: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x223040, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x161c24, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1f26, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-frost', { color: 0xdfe6ec, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x1a2232, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-line', { color: 0xd8b04a, metalness: 0.75, roughness: 0.3 }),
  dWhite: decalMaterial('decal-bridge-edge-white', { color: 0xf6f8fa, roughness: 0.35 }),
  dSilver: decalMaterial('decal-intake-slat-silver', { color: 0xc9d2da, metalness: 0.7, roughness: 0.3 }),
  // 彩虹細線（低強度自發光，Blender 不過曝）
  rbRed: decalMaterial('decal-bifrost-red', { color: 0xe8302a, roughness: 0.3, emissive: 0xe8302a, emissiveIntensity: 0.4 }),
  rbOrange: decalMaterial('decal-bifrost-orange', { color: 0xf5841e, roughness: 0.3, emissive: 0xf5841e, emissiveIntensity: 0.4 }),
  rbGold: decalMaterial('decal-bifrost-yellow', { color: 0xf7d21e, roughness: 0.3, emissive: 0xf7d21e, emissiveIntensity: 0.35 }),
  rbGreen: decalMaterial('decal-bifrost-green', { color: 0x22b35a, roughness: 0.3, emissive: 0x22b35a, emissiveIntensity: 0.4 }),
  rbBlue: decalMaterial('decal-bifrost-blue', { color: 0x2f5fe8, roughness: 0.3, emissive: 0x2f5fe8, emissiveIntensity: 0.45 }),
});

/** @type {(x: number, zc: number) => number} 支柱位置的中脊頂高（往下 1 mm 埋進殼面） */
const deckAt = (x, zc) => {
  const q = Math.min(1, Math.abs(zc) / P.zs(x));
  return P.yc(x) - 1.1 * q * q - 1;
};

/** @type {{ xa: number, xb: number, w: number }} 橋拱拱肋：從 x −17 的背線起拱、拱頂頂住橋翼底、落在 x −66 的車尾，肋寬 1.8 */
const ARCH_RIB = { xa: -17, xb: -66, w: 1.8 };

/** @type {(x: number, zc: number) => number} 拱肋上緣高度（拱頂在兩端中點、貼橋翼底） */
const ribTopY = (x, zc) => {
  const u = (x - ARCH_RIB.xb) / (ARCH_RIB.xa - ARCH_RIB.xb);
  return lerp(deckAt(x, zc) + 1, BRIDGE.y + 0.2, Math.sin(Math.PI * u) ** 0.7);
};

/**
 * 橋拱拱肋（側視，立板厚 0.6）：貼在腹板外側的一道銀色拱肋，讀成一座拱橋
 * @type {(zc: number) => THREE.BufferGeometry}
 */
const buildArchPier = (zc) => {
  /** @type {number[][]} */
  const upper = [];
  /** @type {number[][]} */
  const lower = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const x = lerp(ARCH_RIB.xb, ARCH_RIB.xa, i / n);
    const yt = Math.min(ribTopY(x, zc), BRIDGE.y + 0.2);
    upper.push([x, yt]);
    lower.push([x, Math.max(deckAt(x, zc), yt - ARCH_RIB.w)]);
  }
  /** @type {THREE.BufferGeometry[]} */
  return finPlate([...upper, ...lower.reverse()], zc, 0.6);
};

/** @type {(x: number) => number} 座艙罩俯視半寬（同 canopy 站位） */
const canopyHalfW = (x) => {
  if (x > 25 || x < 1) {
    return 0;
  }
  const u = (25 - x) / 24;
  return Math.max(1.5, 8 * Math.sin(Math.PI * u ** 0.9) ** 0.5);
};

export const heimdallHornBody = makePolyBody({
  id: 'body-heimdall-horn',
  name: '海姆達爾的號角',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'heimdall-horn',
  form: 'bifrost-deck',
  roof: 'canopy',
  wing: 'bridge-plank',
  theme: '彩虹橋與加拉爾號角：低平 T 形鼻翼、背線從引擎罩爬升直接長進跨過後輪的冰藍平板橋翼（下方兩片拱形銀支柱撐出一道橋拱），整片橋翼塗成五色彩虹帶、到尾翼段往兩側展開，兩端彩虹漸層端板；引擎蓋中線一支亮金加拉爾大號角、喇叭口朝前，車尾從尾翼凹口露出金色喇叭口（鉻唇、彩虹環）；珍珠白配冰藍、鈷藍金屬漆下半部',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格 0.7 mm：車身表面積大，放寬網格讓面數留在效能預算內
  step: 0.7,
  hard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  wheelArches: ARCHES,
  canopy: {
    section: 'ellipse',
    // 低矮座艙罩 x 25 → 1（貼在爬升的背線上）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        const x = lerp(25, 1, u);
        out.push({ x, yBase: 0, yTop: 3.6 * Math.sin(Math.PI * u ** 0.8) ** 0.6, halfW: canopyHalfW(x) });
      }
      return out;
    })(),
  },
  sideZMin: 26,
  zones: () => {
    /** @type {(x: number, y: number, z: number) => number} 中脊（中脊肩以內）與 T 形鼻翼 */
    const spine = (x, y, z) => Math.max(P.zs(x) + 0.4 - Math.abs(z), x - 63);
    /** @type {(x: number, y: number, z: number) => number} 後輪拱外側斜面（四視圖的冰藍後側面）：外肩以下、斜線之後 */
    const rearFacet = (x, y, z) => Math.min(Math.abs(z) - (Q.hw(x) - 0.8), -8 - 0.55 * (y - 15) - x);
    /** @type {(x: number, y: number, z: number) => number} 下半部（外肩斜面以下的側壁）：深石墨藍 */
    const lower = (x, y, z) => Math.min(Math.abs(z) - (Q.hw(x) - 2.4), yPod(x) - 3.6 - y, 62 - x);
    return [
      { mat: 'navy', keep: (x, y, z) => Math.max(Math.min(Q.lo(x) + 2.2 - y, 62 - x), lower(x, y, z)) },
      { mat: 'ice', keep: (x, y, z) => Math.max(spine(x, y, z), rearFacet(x, y, z)) },
      { mat: 'frost', keep: () => 1 },
    ];
  },
  mats: { inner: 'inner', edge: 'edge', cap: 'ice', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({
      geometry: buildProfileLiner(ARCHES[1], 31, profile),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // ── 彩虹橋翼：冰藍平板（梯形，四角倒角）＋整片五色彩虹帶 ──
    {
      const c = 2.5;
      // 橋翼尾段往兩側展開成寬尾翼（後掠前緣），兩端立彩虹端板
      const outline = [
        [BRIDGE.x0, BRIDGE.hw0 - c],
        [BRIDGE.x0 - c, BRIDGE.hw0],
        [TAIL_WING.xRoot, bridgeHalfW(TAIL_WING.xRoot)],
        [TAIL_WING.xTip, TAIL_WING.hw],
        [BRIDGE.x1 + c, TAIL_WING.hw],
        [BRIDGE.x1, TAIL_WING.hw - c],
        [BRIDGE.x1, TAIL_NOTCH.zOut],
        [TAIL_NOTCH.x, TAIL_NOTCH.zIn],
        [TAIL_NOTCH.x, -TAIL_NOTCH.zIn],
        [BRIDGE.x1, -TAIL_NOTCH.zOut],
        [BRIDGE.x1, -TAIL_WING.hw + c],
        [BRIDGE.x1 + c, -TAIL_WING.hw],
        [TAIL_WING.xTip, -TAIL_WING.hw],
        [TAIL_WING.xRoot, -bridgeHalfW(TAIL_WING.xRoot)],
        [BRIDGE.x0 - c, -BRIDGE.hw0],
        [BRIDGE.x0, -BRIDGE.hw0 + c],
      ];
      parts.push({ geometry: flatPlate(outline, BRIDGE.y, BRIDGE.t), mat: 'iceSolid', solid: true, outline: true, name: 'bifrost-bridge-wing' });
      const yTop = BRIDGE.y + BRIDGE.t + 0.03;
      const xa = BRIDGE.x0 - 4;
      const xb = BRIDGE.x1 + 3;
      // 寬尾翼兩端的端板：五段橫向疊起的立板，由上往下紅、橘、金、綠、藍（彩虹橋漸層）
      const yTopPlate = BRIDGE.y + BRIDGE.t + 1.2;
      const band = (yTopPlate - (BRIDGE.y - TAIL_WING.drop)) / RAINBOW.length;
      RAINBOW.forEach((mat, i) => {
        const y1 = yTopPlate - i * band;
        const y0 = y1 - band;
        /** @type {(y: number) => number} 端板前緣（下段往後收） */
        const xFront = (y) => lerp(TAIL_WING.xTip + 4, TAIL_WING.xTip + 1, (y - (BRIDGE.y - TAIL_WING.drop)) / (yTopPlate - (BRIDGE.y - TAIL_WING.drop)));
        /** @type {THREE.BufferGeometry[]} */
        const plates = [];
        for (const sg of [-1, 1]) {
          plates.push(finPlate([[xFront(y1), y1], [BRIDGE.x1 - 0.5, y1], [BRIDGE.x1 - 0.5, y0], [xFront(y0), y0]], sg * (TAIL_WING.hw + 0.3), 0.4));
        }
        parts.push({ geometry: mergeGeos(plates), mat, solid: true, outline: true, name: `tail-wing-endplate-${i}` });
      });
      // 整片橋翼塗成五色彩虹帶：每側由外緣往中線紅、橘、金、綠、藍，順著翼面外形走，到尾翼段跟著往兩側展開（中線留一道白線）
      /** @type {(x: number) => number} 翼面在 x 處的可塗半寬（尾翼段外展到翼端） */
      const deckHalfW = (x) => {
        if (x >= TAIL_WING.xRoot) {
          return bridgeHalfW(x) - 0.5;
        }
        if (x >= TAIL_WING.xTip) {
          return lerp(bridgeHalfW(TAIL_WING.xRoot), TAIL_WING.hw, (TAIL_WING.xRoot - x) / (TAIL_WING.xRoot - TAIL_WING.xTip)) - 0.5;
        }
        return TAIL_WING.hw - 0.5;
      };
      /** @type {number} 中線白線半寬 */
      const zMid = 0.7;
      /** @type {(i: number, j: number, x: number) => number} 第 i 道色帶在 x 處、內（j=1）外（j=0）緣的 |z| */
      const bandZ = (i, j, x) => Math.max(lerp(deckHalfW(x), zMid, (i + j) / RAINBOW.length), notchHalfW(x) + 0.4);
      /** @type {number} 色帶沿 x 的分段數 */
      const nSeg = 40;
      RAINBOW.forEach((mat, i) => {
        /** @type {THREE.BufferGeometry[]} */
        const gs = [];
        for (const s of [-1, 1]) {
          /** @type {number[][]} */
          const outer = [];
          /** @type {number[][]} */
          const inner = [];
          for (let k = 0; k <= nSeg; k++) {
            const x = lerp(xa, xb, k / nSeg);
            outer.push([x, s * bandZ(i, 0, x)]);
            inner.push([x, s * bandZ(i, 1, x)]);
          }
          const pts = [...outer, ...inner.reverse()];
          gs.push(flatPlate(s < 0 ? pts.reverse() : pts, yTop, 0.02));
        }
        parts.push({ geometry: mergeGeos(gs), mat, name: `decal-bifrost-band-${i}` });
      });
      const xc = TAIL_NOTCH.x - 0.4;
      parts.push({ geometry: flatPlate([[xa, zMid], [xc, zMid], [xc, -zMid], [xa, -zMid]], yTop, 0.02), mat: 'dWhite', name: 'decal-bridge-centerline' });
    }
    // ── 橋翼支撐：左右兩片冰藍薄腹板把橋翼和橋下引擎蓋整片接起來（側視不再透空，厚 0.4），外側貼一道銀色拱肋，側視是一座拱橋 ──
    {
      const zc = 11;
      /** @type {(z: number) => THREE.BufferGeometry} 腹板：下緣沿引擎蓋、上緣頂住橋翼底 */
      const web = (z) => {
        /** @type {number[][]} */
        const lower = [];
        for (let i = 0; i <= 16; i++) {
          const x = lerp(-66, -6, i / 16);
          lower.push([x, deckAt(x, z)]);
        }
        return finPlate([...lower, [-6, BRIDGE.y + 0.3], [-66, BRIDGE.y + 0.3]], z, 0.4);
      };
      parts.push({ geometry: mergeGeos([web(zc), web(-zc)]), mat: 'iceSolid', solid: true, outline: true, name: 'bridge-webs' });
      parts.push({
        geometry: mergeGeos([buildArchPier(zc + 0.55), buildArchPier(-zc - 0.55)]),
        mat: 'silver',
        solid: true,
        outline: true,
        name: 'bridge-arch-piers',
      });
    }
    // ── 側面彩虹細線：沿外肩斜面從鼻頸掃到車尾（三道：紅、金、藍），下方接深色下半部 ──
    {
      /** @type {[string, number][]} */
      const lanes = [
        ['rbRed', 0],
        ['rbGold', 1],
        ['rbBlue', 2],
      ];
      for (const [mat, k] of lanes) {
        parts.push({
          geometry: kit.decal((x, y, z) => {
            const yLine = yPod(x) - 0.9 - k * 0.95;
            return Math.min(0.36 - Math.abs(y - yLine), Math.abs(z) - (Q.hw(x) - 3.1), 60 - x, x + 64);
          }, { offset: 0.1 }),
          mat,
          name: `decal-side-bifrost-${k}`,
        });
      }
    }
    // T 形鼻翼上橫跨全寬的三道彩虹細線（紅、金、藍）
    for (const [mat, xc] of [['rbRed', 73.6], ['rbGold', 72.4], ['rbBlue', 71.2]]) {
      parts.push({
        geometry: kit.decal((x, y, z) => Math.min(0.45 - Math.abs(x - xc), y - (Q.lo(x) + 2), Q.hw(x) - 1.6 - Math.abs(z)), { offset: 0.1 }),
        mat,
        name: `decal-nose-bifrost-${mat}`,
      });
    }
    // 後輪拱前的斜切進氣口：深色下半部上四道銀色橫向百葉（號角喇叭口吹進來的位置）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < Q.hw(x) - 2.6 || x > -2 || x < -22) {
          return -1;
        }
        // 進氣口前緣斜切：越低越往後
        const front = -2 - 0.9 * (25 - y) - x;
        let best = -1;
        for (const yl of [17.4, 18.9, 20.4, 21.9]) {
          best = Math.max(best, 0.32 - Math.abs(y - yl));
        }
        return Math.min(best, front, x + 21.5);
      }, { offset: 0.1 }),
      mat: 'dSilver',
      name: 'decal-intake-slats',
    });
    // 座艙罩金色細框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > -0.5 && x < 26.5 ? Math.min(u + 0.9, 0.05 - u) : -1;
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // ── 車尾號角口：車尾直牆中央一圈金色唇邊＋五道同心彩虹環（由外往內紅、橘、金、綠、藍），中心深色喉部——號角吹出的那一端 ──
    {
      const yc = 22.6;
      const xr = X_REAR - 0.06;
      /** @type {(r0: number, r1: number) => THREE.BufferGeometry} 車尾直牆上朝後的平面圓環 */
      const annulus = (r0, r1) => {
        const g = new THREE.RingGeometry(r0, r1, 40);
        g.rotateY(-Math.PI / 2);
        g.translate(xr, yc, 0);
        return g;
      };
      RAINBOW.forEach((mat, i) => {
        const r1 = 4.5 - i * 0.55;
        parts.push({ geometry: annulus(r1 - 0.45, r1), mat, name: `decal-bell-rainbow-${i}` });
      });
      parts.push({ geometry: annulus(0, 4.5 - 5 * 0.55), mat: 'throat', name: 'decal-bell-throat' });
      // 喇叭口：從車尾直牆的圓環（半徑 5）往後外張成半徑 TAIL_BELL.r1 的金色喇叭，口緣捲一圈拋光鉻唇
      /** @type {THREE.Vector2[]} */
      const prof = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        prof.push(new THREE.Vector2(lerp(5.0, TAIL_BELL.r1, u ** 2.2), -u * TAIL_BELL.depth));
      }
      const bell = new THREE.LatheGeometry(prof, 32);
      bell.rotateZ(-Math.PI / 2);
      bell.translate(X_REAR + 0.2, yc, 0);
      parts.push({ geometry: bell, mat: 'hornGold', shell: true, outline: true, name: 'gjallarhorn-tail-bell' });
      const rim = new THREE.TorusGeometry(TAIL_BELL.r1, 0.55, 6, 32);
      rim.rotateY(Math.PI / 2);
      rim.translate(X_REAR + 0.2 - TAIL_BELL.depth, yc, 0);
      parts.push({ geometry: rim, mat: 'chrome', solid: true, outline: true, name: 'gjallarhorn-tail-rim' });
    }
    // ── 側箱外殼：前後輪之間每側一片珍珠白直立板＋頂板，把兩輪之間的底盤整片封起來；下緣一條拋光鉻飾條 ──
    parts.push({
      geometry: buildBellySkirt({ x0: SKIRT.x0, x1: SKIRT.x1, zIn: (x) => Q.hw(x) - 1, zOut: SKIRT.zOut, yTop: SKIRT.yTop, yBot: SKIRT.yBot, t: SKIRT.t }),
      mat: 'frostSide',
      solid: true,
      outline: true,
      name: 'side-skirts',
    });
    {
      /** @type {THREE.BufferGeometry[]} */
      const trims = [];
      for (const sg of [-1, 1]) {
        const bar = new THREE.BoxGeometry(SKIRT.x1 - SKIRT.x0 - 2, 0.8, 0.4);
        bar.translate((SKIRT.x0 + SKIRT.x1) / 2, SKIRT.yBot + 1.2, sg * (SKIRT.zOut + 0.1));
        trims.push(bar);
      }
      parts.push({ geometry: mergeGeos(trims), mat: 'chrome', solid: true, outline: true, name: 'side-skirt-chrome-trim' });
    }
    // ── 側箱外殼上的彩虹橋拱：每側一道橫跨整片側箱的五色扁拱（由外往內紅、橘、金、綠、藍），拱腳落在側箱前後兩端的下緣，像一座橋 ──
    {
      /** @type {{ xc: number, yFoot: number, rx: number, ry: number, dx: number, dy: number }} 拱心 x、拱腳高度、最外圈半長 / 半高、每色往內縮的量 */
      const ARC = { xc: 0, yFoot: 11.6, rx: 20.6, ry: 11.2, dx: 1.5, dy: 1.15 };
      RAINBOW.forEach((mat, i) => {
        /** @type {(k: number, j: number) => number[]} 第 i 道色帶第 j 圈（0 外、1 內）的第 k 個點 */
        const at = (k, j) => {
          const a = (Math.PI * k) / 24;
          return [ARC.xc + (ARC.rx - (i + j) * ARC.dx) * Math.cos(a), ARC.yFoot + (ARC.ry - (i + j) * ARC.dy) * Math.sin(a)];
        };
        /** @type {number[][]} */
        const pts = [];
        for (let k = 0; k <= 24; k++) {
          pts.push(at(k, 0));
        }
        for (let k = 24; k >= 0; k--) {
          pts.push(at(k, 1));
        }
        parts.push({
          geometry: mergeGeos([finPlate(pts, SKIRT.zOut + 0.25, 0.1), finPlate(pts, -SKIRT.zOut - 0.25, 0.1)]),
          mat,
          name: `decal-skirt-bifrost-arc-${i}`,
        });
      });
    }
    // ── 加拉爾大號角：躺在引擎蓋中線上的亮金號角，吹嘴頂著座艙罩、往前張開成朝前的大喇叭口；三道象牙白箍環、口緣拋光鉻唇、喉部深色 ──
    {
      parts.push({ geometry: buildHoodHorn(), mat: 'hornGold', shell: true, outline: true, name: 'gjallarhorn-hood' });
      /** @type {(x: number, grow: number, tube: number) => THREE.BufferGeometry} 套在大號角外的整圈箍環 */
      const hoop = (x, grow, tube) => {
        const { y, r } = hoodHornAt(x);
        const g = new THREE.TorusGeometry(r + grow, tube, 6, 24);
        g.rotateY(Math.PI / 2);
        g.translate(x, y, 0);
        return g;
      };
      parts.push({ geometry: mergeGeos([hoop(33, 0.2, 0.45), hoop(42, 0.2, 0.45), hoop(51, 0.2, 0.45)]), mat: 'ivory', solid: true, outline: true, name: 'gjallarhorn-hood-rings' });
      parts.push({ geometry: hoop(HOOD_HORN.xBell, 0.1, 0.6), mat: 'chrome', solid: true, outline: true, name: 'gjallarhorn-hood-rim' });
      const { y, r } = hoodHornAt(HOOD_HORN.x1 + 4);
      const throat = new THREE.CircleGeometry(r * 0.98, 24);
      throat.rotateY(Math.PI / 2);
      throat.translate(HOOD_HORN.x1 + 4, y, 0);
      parts.push({ geometry: throat, mat: 'throat', name: 'gjallarhorn-hood-throat' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器（推估，比例取自四視圖 04）：殼 x −66 ~ 76、橋翼後緣 −74；T 形鼻翼半寬 32、頂 20、厚約 3.4；兩前輪之間窄鼻半寬 22.5（前輪外露）、後輪拱 34、車尾收到 24（後輪胎外緣露出）；兩輪之間側裙 |z| 37.4；中脊從鼻翼 17.5 爬升到橋翼前緣 43、橋下降到 31，橋翼頂 44.2 為全車最高',
    bridge: '彩虹橋翼：ABS 平板厚 0.6，x −4 → −74、半寬 12 → 19，x −50 起後掠外展到翼端半寬 47.4（x −59 ~ −74），兩端彩虹端板厚 0.4、往下伸 6；後緣中央凹口 x −66.5、半寬 13 → 21；左右各一道拱肋（肋寬 1.8）＋兩根立柱，立板厚 1.2、位於 |z| 11；翼面五色彩虹帶每側均分、中線白線寬 1.4 mm（推估）',
    horn: '引擎蓋大號角：ABS 圓管薄殼（壁厚同殼 0.8），軸心沿引擎蓋背線，吹嘴 x 27 半徑 1.5 → x 56 半徑 4.2 → 外張到 x 69 半徑 7.6 的朝前喇叭口，下半埋進引擎蓋；三道象牙白箍環、口緣鉻唇。車尾喇叭口：薄殼，從車尾直牆半徑 5 往後 4.6 mm 外張到半徑 8.2，口緣拋光鉻唇（推估）',
    skirt: '側箱外殼：ABS 直立板＋頂板，厚 0.5，|z| 37.4、x −22.5 ~ 22.5、y 10.5 ~ 23.6（下緣離底盤側框頂約 1 mm，推估）',
    wheelArches: '後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm）；前輪在窄鼻外側外露（車身半寬 22.5 < 輪胎內側 24.75），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
