// 八足神駒（body-sleipnir-stride，神話組・北歐）：奧丁的灰色八足馬斯雷普尼爾。不做馬頭、馬蹄、腿，只用「八」與奔馳。
// 造型照四視圖 30：俯視是盾形尖鼻（金色盾緣）、修長低伏的楔形車身、座艙偏後、車尾方正並往上翹成整片鴨尾（金色 U 形框＋尾刃）；
// 招牌元素是兩側前後輪之間的「八道腿線」：深色側板上每側 8 道往後斜的金色飾條，等距排開、前後兩組長短交替成奔馳的步幅，一眼數得出八。
// 設計：shared/design/body-sleipnir-stride/DESIGN.md（典故：《散文埃達》Gylfaginning「Sleipnir … has eight feet」，MYTH_RESEARCH 北歐節 N9、N12）。
// 塗裝全為自創；不用盧恩字母、不含文字與商標；不重現 Tjängvide 圖像石的騎士構圖。
import * as THREE from 'three';
import { makePolyBody, flatPlate, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, fenderFloor, smoothMax } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildBellySkirt } from './trojanHorse.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 盾形鼻尖 x */
const X_FRONT = 77;
/** @type {number} 殼後端 x */
const X_REAR = -67;

/** @type {number[]} 中線參數的站位 */
const XS = [-67, -62, -54, -46, -38, -28, -18, -8, 2, 12, 20, 30, 40, 50, 60, 68, 73, 77];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線頂：鼻尖 15 的低刀口 → 引擎罩中央稜線緩升 → 座艙段 32 → 座艙後甲板 33.5 → 車尾鴨尾翹到 38.5
  yc: monoCurve(XS, [38.5, 37, 34.5, 33.5, 33.2, 33, 32.8, 32.5, 32, 31, 30, 28.2, 26.4, 24, 21, 18.2, 16.3, 15]),
};

/** @type {number[]} 俯視與下緣的站位 */
const XS_HW = [-67, -64, -56, -46, -38, -28, -18, -8, 2, 12, 22, 32, 42, 52, 56, 59, 66, 72, 77];
/** @type {Record<string, (x: number) => number>} */
const Q = {
  // 俯視半寬：修長的窄車尾 21–22.5（後輪外露，車尾另有寬尾刃）→ 往前漸寬 → 前輪拱 41 → 盾形尖鼻（直邊收到鼻尖 2）
  hw: monoCurve(XS_HW, [21, 21.5, 22.5, 22.5, 22.5, 22.5, 23, 24, 26.5, 30, 36, 40.5, 41, 40.5, 38, 33.5, 22.5, 11.5, 2]),
  // 下緣
  lo: monoCurve(XS_HW, [17, 16.5, 15.5, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15.2, 15.5, 15.8, 16, 15.6, 15]),
};

/** @type {(x: number) => number} 輪拱頂高：前輪軸上方抬到 R17.5 輪拱之上，其餘 28（後輪外露）；車尾跟著鴨尾翹起 */
const yFender = (x) => {
  const base = smoothMax(28, fenderFloor(x, [40]) + 1.4, 1);
  // 車尾段：輪拱頂往後接上鴨尾的高度
  const tail = x < -50 ? lerp(base, P.yc(x) - 0.6, Math.min(1, (-50 - x) / 14)) : base;
  // 鼻段：輪拱頂往前降到盾形鼻的刀口
  return x > 54 ? Math.min(tail, lerp(base, P.yc(x) - 0.4, Math.min(1, (x - 54) / 18))) : tail;
};

/**
 * 半剖面 7 點：中央稜線 → 引擎罩斜面 → 輪拱內稜 → 輪拱頂 → 外肩 → 側壁 → 下緣
 * 中央稜線是盾形鼻的中脊（銳利），引擎罩兩側是兩片往外下斜的平面
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yc = P.yc(x);
  const hw = Q.hw(x);
  const lo = Q.lo(x);
  const yf = Math.max(yFender(x), lo + 4);
  const zv = Math.min(17, hw * 0.46);
  const yv = Math.min(yc - 1.6, yf - 1.6);
  const zr = Math.min(zv + 3, hw - 6);
  return [
    [0, yc],
    [zv, yv],
    [zr, yf - 0.5],
    [hw - 3.5, yf],
    [hw - 0.7, yf - 2.4],
    [hw, Math.max(lo + 3, yf - 6)],
    [hw, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = buildStations(X_REAR, X_FRONT, 2, profile);

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm）；兩後輪之間車身半寬 22.5、在輪胎內側，後輪拱實際上不切殼 */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 23 },
];

/** @type {number[]} 八道腿線飾條的下端 x（由前往後；前四道一組、後四道一組，中間空一格成步幅） */
const LEG_X = [22, 18.4, 14.8, 11.2, 5.6, 2, -1.6, -5.2];
/** @type {number} 腿線飾條下端高度（底盤側框以上，側視不被擋住） */
const LEG_Y0 = 18.8;
/** @type {number[]} 各飾條的頂高（前後兩組各自由短到長，像前腳與後腳的跨步；都在外肩以下） */
const LEG_TOP = [24.4, 24.8, 25.2, 25.5, 24.4, 24.8, 25.2, 25.5];

/**
 * 北歐交織帶（兩條 8 字互繞的帶子，交叉處上下輪流、下面那條留缺口）：回傳 (x, v) → SDF（正值 = 帶內）
 * v 是帶子的橫向座標（這裡用 |z|），x0–x1 是帶子的範圍，a 是打圈週期、b 是打圈半高
 * @type {(cfg: { a: number, b: number, v0: number, x0: number, x1: number }) => (x: number, v: number) => number}
 */
const makeKnot = (cfg) => {
  const ribbons = [1, -1].map((flip) => {
    const phase = flip > 0 ? 0 : Math.PI;
    /** @type {number[][]} [u, v, 半寬] */
    const pts = [];
    for (let t = (cfg.x0 - 6) / cfg.a; t <= (cfg.x1 + 6) / cfg.a; t += 0.06) {
      pts.push([cfg.a * (t + phase) - cfg.b * Math.sin(t), cfg.v0 + flip * cfg.b * Math.cos(t), 0.42 + 0.2 * (0.5 + 0.5 * Math.sin(0.5 * t + phase))]);
    }
    /** @type {Map<number, number[]>} 桶寬 2 mm → 線段起點索引 */
    const buckets = new Map();
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = Math.floor(Math.min(pts[i][0], pts[i + 1][0]) / 2); k <= Math.floor(Math.max(pts[i][0], pts[i + 1][0]) / 2); k++) {
        if (!buckets.has(k)) {
          buckets.set(k, []);
        }
        buckets.get(k).push(i);
      }
    }
    return { pts, buckets };
  });
  /** @type {(r: { pts: number[][], buckets: Map<number, number[]> }, u: number, v: number) => { d: number, hw: number }} */
  const dist = (r, u, v) => {
    let best = 9;
    let hw = 0;
    const k0 = Math.floor(u / 2);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      for (const i of r.buckets.get(k) ?? []) {
        const [ax, ay, ah] = r.pts[i];
        const [bx, by, bh] = r.pts[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const L2 = dx * dx + dy * dy;
        const t = L2 > 0 ? Math.min(1, Math.max(0, ((u - ax) * dx + (v - ay) * dy) / L2)) : 0;
        const d = Math.hypot(u - (ax + t * dx), v - (ay + t * dy));
        if (d < best) {
          best = d;
          hw = lerp(ah, bh, t);
        }
      }
    }
    return { d: best, hw };
  };
  return (x, v) => {
    if (x < cfg.x0 || x > cfg.x1 || Math.abs(v - cfg.v0) > cfg.b + 1.5) {
      return -1;
    }
    const r0 = dist(ribbons[0], x, v);
    const r1 = dist(ribbons[1], x, v);
    const over = Math.floor((x - cfg.x0) / (Math.PI * cfg.a)) % 2;
    const s0 = r0.hw - r0.d;
    const s1 = r1.hw - r1.d;
    const g0 = over === 1 ? Math.min(s0, r1.d - r1.hw - 0.35) : s0;
    const g1 = over === 0 ? Math.min(s1, r0.d - r0.hw - 0.35) : s1;
    return Math.min(Math.max(g0, g1), Math.min(x - cfg.x0, cfg.x1 - x) / 3);
  };
};

/** @type {(x: number, v: number) => number} 引擎蓋兩側的交織帶（鼻與前輪拱之間的白色斜面） */
const knotHood = makeKnot({ a: 3.4, b: 3.6, v0: 21.5, x0: 24, x1: 58 });
/** @type {(x: number, v: number) => number} 座艙後窄車尾甲板兩側的交織帶 */
const knotTail = makeKnot({ a: 3.0, b: 3.0, v0: 11.5, x0: -63, x1: -30 });

/** @type {number[][]} 車尾馬蹄鐵金邊（右半，[x, y, z]）：從後輪前的側壁長出，往外跨過外露的後輪，繞過車尾接到另一側 */
const HORSESHOE = [
  [-21, 26.8, 22.6],
  [-27, 29.6, 29],
  [-35, 30.9, 32.6],
  [-46, 31.2, 33.4],
  [-56, 33.6, 32],
  [-64, 36.6, 26],
  [-69.5, 38.2, 13],
  [-70.4, 38.4, 0],
];

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 主色：珍珠銀白（上半身）；輔色：深靛藍（側壁與下緣）；金：真金屬（名稱含 -brass → Blender metallic）
  navy: namedMaterial('paint-pearl-silverwhite', { color: 0xe3e6eb, roughness: 0.26, metalness: 0.25, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  navyDark: namedMaterial('paint-deep-indigo', { color: 0x1a2462, roughness: 0.4, metalness: 0.2, clearcoat: 0.6 }),
  fin: namedMaterial('trim-diffuser-steel', { color: 0x8d949e, metalness: 0.8, roughness: 0.35 }),
  gold: namedMaterial('trim-gold-brass', { color: 0xd6aa3c, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  goldSolid: namedMaterial('trim-gold-brass', { color: 0xd6aa3c, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1c2030, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x14161e, roughness: 0.7, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x12152a, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-indigo', { color: 0x1a2462, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x10173f, roughness: 0.7, side: THREE.DoubleSide }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  // 斯雷普尼爾是灰馬：銀灰細線
  dSilver: decalMaterial('decal-grey-steed-line', { color: 0xb8c0cc, metalness: 0.6, roughness: 0.32 }),
  dGold: decalMaterial('decal-gold-line', { color: 0xd6aa3c, metalness: 0.75, roughness: 0.3 }),
  dKnot: decalMaterial('decal-interlace-indigo', { color: 0x24348c, roughness: 0.35, metalness: 0.3 }),
});

export const sleipnirStrideBody = makePolyBody({
  id: 'body-sleipnir-stride',
  name: '八足神駒',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'sleipnir',
  form: 'eightfold-shield',
  roof: 'canopy',
  wing: 'gilt-ducktail',
  theme: '八足神駒用「八」與奔馳表現，不做馬頭與腿：盾形尖鼻（中央稜線、金色盾緣）、修長低伏的楔形車身、座艙偏後，車尾整片往上翹成鴨尾（金色 U 形框＋金色尾刃）；兩側前後輪之間深色側板上各 8 道往後斜的金色飾條，前後兩組各自由短到長，像奔馳的步幅；珍珠銀白為主、深靛藍側壁為輔，金色 V 形前緣、車尾馬蹄鐵金邊，引擎蓋與車尾甲板上深靛藍北歐交織帶，車尾直牆下段鋼色擴散器鰭片',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格 0.7 mm：車身表面積大，放寬網格讓面數留在效能預算內
  step: 0.7,
  hard: [0, 1, 2, 4],
  wheelArches: ARCHES,
  canopy: {
    section: 'trapezoid',
    // 偏後的座艙罩 x 16 → −26（多面切的低平罩）
    stations: (() => {
      /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
      const out = [];
      for (let i = 0; i <= 21; i++) {
        const u = i / 21;
        const x = lerp(16, -26, u);
        out.push({ x, yBase: 0, yTop: 6.4 * Math.sin(Math.PI * u ** 0.75) ** 0.45, halfW: Math.max(1.5, 11 * Math.sin(Math.PI * u ** 0.85) ** 0.4) });
      }
      return out;
    })(),
  },
  sideZMin: 26,
  zones: () => {
    /** @type {(x: number, y: number, z: number) => number} 盾緣＝四視圖的金色 V 形前緣：盾形鼻外緣 3.6 mm 寬的金邊（x 48 以前） */
    const shieldRim = (x, y, z) => Math.min(x - 48, Math.abs(z) - (Q.hw(x) - 3.6), y - (Q.lo(x) + 1.2));
    /** @type {(x: number, y: number, z: number) => number} 車尾 U 形金框：輪拱頂外緣（x −30 以後）＋車尾上緣 */
    const tailFrame = (x, y, z) => Math.max(Math.min(-30 - x, Math.abs(z) - (Q.hw(x) - 3.2), y - (yFender(x) - 2.2)), Math.min(-63.5 - x, y - (P.yc(x) - 3)));
    /** @type {(x: number, y: number, z: number) => number} 前輪拱後上方的金色斜片（四視圖的金色側翼） */
    const frontFlash = (x, y, z) => Math.min(Math.abs(z) - (Q.hw(x) - 6), 30 - x, x - 14 + 0.9 * (y - 26), y - 24.5);
    /** @type {(x: number, y: number, z: number) => number} 後輪拱前下方的金色斜片 */
    const rearFlash = (x, y, z) => Math.min(Math.abs(z) - (Q.hw(x) - 0.8), -22 - x + 0.0 * y, x + 30 - 1.1 * (y - 15), 21.5 - y, y - 16.5);
    /** @type {(x: number) => number} 白藍分色線：側壁上由前往後斜升（前 x 50 處 y 20 → 車尾 27） */
    const splitY = (x) => lerp(27, 20, Math.min(1, Math.max(0, (x + 67) / 117)));
    return [
      { mat: 'navyDark', keep: (x, y, z) => Math.max(Q.lo(x) + 1.2 - y, Math.min(Math.abs(z) - (Q.hw(x) - 1), splitY(x) - y, 50 - x)) },
      { mat: 'gold', keep: (x, y, z) => Math.max(shieldRim(x, y, z), tailFrame(x, y, z), frontFlash(x, y, z), rearFlash(x, y, z)) },
      { mat: 'navy', keep: () => 1 },
    ];
  },
  mats: { inner: 'inner', edge: 'edge', cap: 'navyDark', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({
      geometry: buildProfileLiner(ARCHES[0], 31, profile),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // ── 八道腿線：每側 8 道往後斜的金色飾條（側視平行四邊形，下寬 1.8、上寬 1.2，往後傾約 39°），貼在深色側板上 ──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < Q.hw(x) - 1.5 || y < LEG_Y0) {
          return -1;
        }
        let best = -1;
        LEG_X.forEach((x0, i) => {
          const y1 = LEG_TOP[i];
          const t = (y - LEG_Y0) / (y1 - LEG_Y0);
          const xc = x0 - 0.8 * (y1 - LEG_Y0) * t;
          const half = lerp(0.9, 0.6, Math.min(1, Math.max(0, t)));
          best = Math.max(best, Math.min(half - Math.abs(x - xc), y1 - y));
        });
        return best;
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-eight-stride-lines',
    });
    // 中央稜線上一道銀灰細線（鼻尖 → 座艙前）
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(z), x - 17, 75 - x), { offset: 0.1 }),
      mat: 'dSilver',
      name: 'decal-spine-line',
    });
    // 座艙罩金色細框
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const u = kit.underCanopy(x, z);
        return x > -27.5 && x < 17.5 ? Math.min(u + 1.0, 0.05 - u) : -1;
      }),
      mat: 'dGold',
      name: 'decal-canopy-frame',
    });
    // ── 側裙：前後輪之間每側一片深靛藍直立板（|z| 37.4，在底盤側框外），把兩輪之間的底盤側框蓋住 ──
    parts.push({
      geometry: buildBellySkirt({ x0: -22.5, x1: 9, zIn: (x) => Q.hw(x) - 1, zOut: 37.4, yTop: 16.2, t: 0.8 }),
      mat: 'navyDark',
      solid: true,
      outline: true,
      name: 'side-skirts',
    });
    // ── 北歐交織帶（深靛藍）：引擎蓋兩側白色斜面＋座艙後窄車尾甲板 ──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (kit.underCanopy(x, z) > -0.6 || Math.abs(z) > Q.hw(x) - 4) {
          return -1;
        }
        return Math.max(knotHood(x, Math.abs(z)), knotTail(x, Math.abs(z)));
      }, { offset: 0.1 }),
      mat: 'dKnot',
      name: 'decal-norse-interlace',
    });
    // ── 金色 V 形前緣的內線：盾緣內 2 mm 再一道 1 mm 金線，正面看是兩層 V ──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = Math.abs(z) - (Q.hw(x) - 6.6);
        return Math.min(0.5 - Math.abs(d), x - 50, 75.5 - x);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-chevron-inner',
    });
    // ── 車尾馬蹄鐵金邊：圓斷面金管從兩側後輪前的側壁長出、往外跨過外露的後輪、繞過車尾（俯視是 U 形馬蹄鐵） ──
    {
      const path = [...HORSESHOE, ...HORSESHOE.slice(0, -1).reverse().map(([x, y, z]) => [x, y, -z])];
      parts.push({ geometry: sweepEllipse(path, 220, () => [1.1, 1.1], 10), mat: 'goldSolid', solid: true, name: 'horseshoe-rim' });
    }
    // ── 車尾擴散器格柵：車尾直牆下段 5 片往後伸的鋼色直立鰭 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const fins = [];
      for (const zc of [-14, -7, 0, 7, 14]) {
        fins.push(finPlate([[X_REAR + 0.6, 17.4], [X_REAR - 3.2, 17.4], [X_REAR - 3.2, 22.5], [X_REAR + 0.6, 27]], zc, 1.0));
      }
      fins.push(finPlate([[X_REAR + 0.6, 17.4], [X_REAR - 3.2, 17.4], [X_REAR - 3.2, 18.4], [X_REAR + 0.6, 18.4]], 0, 30));
      parts.push({ geometry: mergeGeos(fins), mat: 'fin', solid: true, name: 'rear-diffuser-fins' });
    }
    // ── 鴨尾尾刃：車尾上緣往後伸出的金色薄刃，後緣 8 個鋸齒尖（找回舊版的金色齒列） ──
    {
      const y = P.yc(X_REAR) - 1.4;
      /** @type {number[][]} */
      const pts = [];
      /** @type {(z: number) => number} 齒根連線（俯視微微內凹的弧） */
      const root = (z) => X_REAR - 1.2 - 1.2 * (z / 36.5) ** 2;
      // 後緣 8 個金色鋸齒尖（又一個「八」）：齒根之間往後伸 3 mm 的尖
      const teeth = 8;
      for (let i = 0; i < teeth; i++) {
        const za = lerp(-36.5, 36.5, i / teeth);
        const zm = lerp(-36.5, 36.5, (i + 0.5) / teeth);
        pts.push([root(za), za], [root(zm) - 3, zm]);
      }
      pts.push([root(36.5), 36.5]);
      pts.push([X_REAR + 3.5, 36.5], [X_REAR + 3.5, -36.5]);
      parts.push({ geometry: flatPlate(pts, y, 1.2), mat: 'goldSolid', solid: true, outline: true, name: 'gilt-ducktail-blade' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器（推估，比例取自四視圖 30）：殼 x −67 ~ 77、盾形鼻尖頂 15；中央稜線 → 座艙段 32、座艙罩頂約 38.5；車尾鴨尾翹到 38.5；俯視盾形鼻、前輪拱半寬 41、往後收成修長車尾 22.5（後輪外露）、尾刃半寬 36.5',
    blades: '八道腿線：每側 8 道金色貼紙飾條（下寬 1.8、上寬 1.2、高 5.6–6.7 mm、後傾約 39°，貼在深色側板上），下端 x 22 ~ −5.2、前後兩組各 4 道（推估）',
    ducktail: '鴨尾尾刃：ABS 平板厚 1.2、半寬 36.5，後緣 8 個往後伸 3 mm 的鋸齒尖（推估）',
    wheelArches: '前 R17.5（31 mm 輪胎半徑 15.5 + 2 mm）；後輪在修長車尾外側外露（車身半寬 22.5 < 輪胎內側 24.75），可裝 26 / 31 mm 輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
