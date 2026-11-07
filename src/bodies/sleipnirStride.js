// 八足神駒斯雷普尼爾（body-sleipnir-stride，神話組・北歐）：不做馬頭、耳、眼、腿與蹄，「八足」用「八」的重複表現——
// 兩側車身在前後輪之間各 4 道往後上方掃的金色刀形飾條（共 8 道，一道比一道長，下端跨過側裙下緣，像連續攝影的步伐節奏），
// 襯在夜空靛藍的梭形凹槽底襯上；車尾貼身尾翼的後緣是 8 個鋸齒尖。
// 車身是修長、低伏的刀形：前低後高（鼻端 24.5、車尾 28），前後輪上方各一處隆起，鼻段是低而薄的寬平刀口鼻（側視像刀尖）；
// 鬃 → 鋸齒背鰭：引擎蓋中線一列往後梳的銀色鋸齒（停在座艙罩前），座艙後方的背脊再接一道往後升高的鋸齒冠，接到尾翼。
// 配色：上半身是珍珠銀白 → 金屬銀 → 風暴藍 → 夜空靛藍的前上斜分段漸層（亮面，灰馬奔過夜空）、下半身深靛藍（緞面）、八道飾條是金、背鰭與尾翼是銀（金屬）；
// 紋樣：兩側肩上一條 Urnes 風格銀色交織帶、肩線下一道兩股絞繩紋（深色刻線，0.6 mm；不用 Tjängvide 那種像 Valknut 的編織帶、不用任何盧恩）、
// 從鼻尖沿引擎蓋、座艙兩側一路掃到車尾的一對 3 mm 金銅條紋。沒有翅膀（避開天馬意象）、不放騎士。
// 四個 R17.5 輪拱＋輪拱內襯：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-sleipnir-stride/DESIGN.md（MYTH_RESEARCH N9、N10、N11、N12：《散文埃達》灰色八足馬、哥特蘭圖像石）。
// 剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
import * as THREE from 'three';
import { makePolyBody, finPlate, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-74, -68, -62, -56, -48, -40, -28, -14, 0, 14, 28, 40, 48, 56, 62, 68, 72, 76];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 背 / 引擎蓋高度：後輪上方隆起 35.8、腰背凹 32.4、前輪上方隆起 35.8，車尾低伏 28、鼻端 24.5（前低後高的楔形）
  yD: monoCurve(XS, [28, 30, 31.6, 34, 35.6, 35.8, 33.6, 32.4, 32.6, 32.8, 33.8, 35.6, 35.8, 35, 33, 29.8, 27.4, 24.5]),
  // 中線頂：全長一道細脊（背 + 1.2～1.8），往鼻端收平（鼻端只高 0.4）
  yN: monoCurve(XS, [29.2, 31.2, 33, 35.6, 37.4, 37.6, 35.2, 33.8, 34, 34.4, 35.4, 37.2, 37.4, 36.4, 34.2, 30.6, 28, 24.9]),
  // 細脊半寬
  nw: monoCurve(XS, [2.4, 2.6, 2.8, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2.8, 2.4, 2]),
  // 半寬：後輪上方（47.4）→ 收細的腰（36.8，剛好蓋住底盤側面）→ 前輪上方（47.4）→ 連續收窄到寬平切的鼻（鼻端半寬 21）；車尾 x −56 起收窄（35，後導輪處 < 35.5）；
  // 47.4：車殼外框含擋泥唇半寬 ≤ 48.0；鼻端收尖會讓俯視輪廓和其他款的 IoU 超過門檻，所以維持寬平鼻
  hw: monoCurve(XS, [17, 20, 22.5, 35, 47.4, 47.4, 36.8, 36.8, 36.8, 36.8, 36.8, 44.4, 47.4, 46.5, 43, 36, 29, 21]),
  // 側裙下緣：中段 13.6（蓋住底盤側面上半，底盤側框 9.4 以上）；車尾抬高到後上導輪頂（20.5）之上；車頭逐步抬高
  yLow: monoCurve(XS, [22.6, 22, 20.4, 15.5, 13.4, 13.2, 13.6, 13.6, 13.6, 13.6, 13.6, 13.2, 13.4, 14, 14.8, 17, 18.2, 19.2]),
};

/** @type {(x: number) => number} 輪上隆起係數（半寬 37 → 47.5 對應 0 → 1） */
const podAt = (x) => Math.min(1, Math.max(0, (P.hw(x) - 37) / 10.5));
/** @type {(x: number) => number} 側面腰線（上半身漸層漆與下半身深靛藍的分界、側壁頂）：輪上隆起處往下多 2.5 mm（圓鼓的葉子板） */
const ySideAt = (x) => P.yD(x) - 6.5 - 2.5 * podAt(x);

/**
 * 半剖面 9 點：中線頂 → 細脊頂 → 細脊側 → 融進背 / 引擎蓋 → 背肩 → 肩外圓 → 腰線（銳利）→ 側壁 → 側裙下緣（內收）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yN = P.yN(x);
  const yD = P.yD(x);
  const hw = P.hw(x);
  const yS = ySideAt(x);
  const yLow = Math.min(P.yLow(x), yS - 2);
  const nw = Math.min(P.nw(x), 0.3 * hw);
  const h = Math.max(0.1, yN - yD);
  return [
    [0, yN],
    [0.45 * nw, yN - 0.15 * h],
    [0.85 * nw, yN - 0.55 * h],
    [nw + 2, yD + 0.08 * h],
    // 肩部圓收（tumblehome），正面看上緣兩角削掉
    [Math.max(nw + 3.2, 0.68 * hw), yD - 3.3],
    [hw - 2.2, yS + 0.8],
    [hw, yS],
    [hw, lerp(yS, yLow, 0.45)],
    [hw - 1.4, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 站位表（每 2 mm 一站） */
const STATIONS = buildStations(-74, 76, 2, profile);

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（側視，31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5 },
  { x: -40, y: 13, radius: 17.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number) => number} 座艙罩半寬（x −32 → 8；罩外為 −1） */
const canopyHalfW = (x) => {
  if (x <= -32 || x >= 8) {
    return -1;
  }
  const u = (8 - x) / 40;
  return 12.5 * Math.sin(Math.PI * u ** 0.85) ** 0.55;
};

/** 座艙罩（中段，橢圓斷面） */
const CANOPY = {
  section: 'ellipse',
  stations: (() => {
    /** @type {{ x: number, yBase: number, yTop: number, halfW: number }[]} */
    const out = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(8, -32, u);
      const halfW = i === 0 || i === n ? 2.5 : canopyHalfW(x);
      // 座艙罩高 6.2（壓低以減少正面面積）
      const rise = 6.2 * Math.sin(Math.PI * u ** 0.8) ** 0.6;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/** @type {(x: number, z: number) => boolean} 側壁（腰線以下的垂直面與內收下緣） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 1.45;
/** @type {(x: number, y: number) => boolean} 下半身（腰線以下） */
const isLower = (x, y) => y < ySideAt(x) + 0.05;

/**
 * Urnes 風格交織帶（不用淺色小圓環，會被看成泡泡）：兩條細長的「蛇形帶」各自沿
 * 長擺線（prolate cycloid）前進、每 20 mm 打一個圈，彼此相位差半圈互相穿繞，帶寬一粗一細交替（Urnes 的粗細線對比）；
 * 兩帶交叉處依位置輪流「上 / 下」，下面那條在交叉點留 0.35 mm 缺口，讀得出編織。
 * 座標：u = x、v = |z| + 0.6 y（同時鋪在背頂與肩側）。純自繪曲線，不構成三角結、Valknut 或任何收錄圖形。
 * @type {{ a: number, b: number, v0: number, x0: number, x1: number }}
 */
const KNOT = { a: 3.8, b: 4.8, v0: 42, x0: -66, x1: 40 };

/**
 * 交織帶取樣成折線（每條：點陣列＋每點半寬），x 方向分桶加速最近距離查詢
 * @type {{ pts: number[][], buckets: Map<number, number[]> }[]}
 */
const KNOT_RIBBONS = [1, -1].map((flip) => {
  /** @type {number} 第二條帶往後錯開半個打圈週期、圈口朝下（和第一條上下鏡射），兩條互相穿繞成 8 字鏈 */
  const phase = flip > 0 ? 0 : Math.PI;
  /** @type {number[][]} [u, v, 半寬] */
  const pts = [];
  const tMin = (KNOT.x0 - 6) / KNOT.a;
  const tMax = (KNOT.x1 + 6) / KNOT.a;
  for (let t = tMin; t <= tMax; t += 0.06) {
    const u = KNOT.a * (t + phase) - KNOT.b * Math.sin(t);
    const v = KNOT.v0 + flip * KNOT.b * Math.cos(t);
    // 帶寬 0.7 → 1.15 mm（半寬 0.35 → 0.58），沿帶緩慢粗細交替
    pts.push([u, v, 0.35 + 0.23 * (0.5 + 0.5 * Math.sin(0.5 * t + phase))]);
  }
  /** @type {Map<number, number[]>} 桶寬 2 mm（u）→ 線段起點索引 */
  const buckets = new Map();
  for (let i = 0; i < pts.length - 1; i++) {
    const lo = Math.floor(Math.min(pts[i][0], pts[i + 1][0]) / 2);
    const hi = Math.floor(Math.max(pts[i][0], pts[i + 1][0]) / 2);
    for (let k = lo; k <= hi; k++) {
      if (!buckets.has(k)) {
        buckets.set(k, []);
      }
      buckets.get(k).push(i);
    }
  }
  return { pts, buckets };
});

/**
 * 點到某條交織帶中心線的距離與該處半寬（只查 ±2 mm 內的線段；找不到回傳 { d: 9, hw: 0 }）
 * @type {(r: { pts: number[][], buckets: Map<number, number[]> }, u: number, v: number) => { d: number, hw: number }}
 */
const ribbonDist = (r, u, v) => {
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

/**
 * 交織帶 SDF（正值 = 帶內）：交叉處上下輪流（以 u 每半個打圈週期換一次），下面那條留缺口
 * @type {(x: number, y: number, z: number) => number}
 */
const knotSd = (x, y, z) => {
  if (x < KNOT.x0 || x > KNOT.x1) {
    return -1;
  }
  const v = Math.abs(z) + 0.6 * y;
  if (Math.abs(v - KNOT.v0) > KNOT.b + 1.5) {
    return -1;
  }
  const r0 = ribbonDist(KNOT_RIBBONS[0], x, v);
  const r1 = ribbonDist(KNOT_RIBBONS[1], x, v);
  const over = Math.floor((x - KNOT.x0) / (Math.PI * KNOT.a)) % 2;
  const s0 = r0.hw - r0.d;
  const s1 = r1.hw - r1.d;
  // 每條在「被壓在下面」的交叉處，離上面那條 0.35 mm 內挖掉
  const g0 = over === 1 ? Math.min(s0, r1.d - r1.hw - 0.35) : s0;
  const g1 = over === 0 ? Math.min(s1, r0.d - r0.hw - 0.35) : s1;
  // 兩端在 x0 / x1 前 3 mm 收尖
  const taper = Math.min(x - KNOT.x0, KNOT.x1 - x) / 3;
  return Math.min(Math.max(g0, g1), taper);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 漸層四段（亮面珍珠 / 金屬漆，paint- 且 roughness ≤ 0.5 → Blender 亮面漆）：珍珠銀白（車頭）→ 金屬銀 → 風暴藍 → 夜空靛藍（車尾）
  pearl: namedMaterial('paint-pearl-silverwhite', { color: 0xe2e5ea, roughness: 0.26, metalness: 0.25, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  silver2: namedMaterial('paint-metallic-silver', { color: 0xaab0b8, roughness: 0.3, metalness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  stormBlue: namedMaterial('paint-storm-blue', { color: 0x3d5296, roughness: 0.32, metalness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  night: namedMaterial('paint-night-indigo', { color: 0x1b2360, roughness: 0.32, metalness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
  // 下半身：深靛藍（緞面，比上半身的夜空靛藍再暗一階），和銀白上身、金色飾條強對比
  indigo: namedMaterial('paint-deep-indigo', { color: 0x161c4a, roughness: 0.45, clearcoat: 0.4 }),
  indigo2: namedMaterial('paint-deep-indigo', { color: 0x161c4a, roughness: 0.45, clearcoat: 0.4, side: THREE.DoubleSide }),
  // 飾條底襯：最深的夜空色淺凹槽＋上緣陰影帶＋銀色細邊
  dBacking: decalMaterial('decal-relief-groove', { color: 0x0e1230, roughness: 0.6 }),
  dGrooveShade: decalMaterial('decal-relief-groove-shade', { color: 0x080a1c, roughness: 0.7 }),
  dGrooveEdge: decalMaterial('decal-groove-edge-silver', { color: 0xc9cdd2, roughness: 0.28, metalness: 0.65 }),
  // 從鼻尖掃到車尾的金銅條紋
  dBronze: decalMaterial('decal-stripe-gold-bronze', { color: 0xc8963c, roughness: 0.32, metalness: 0.75 }),
  // 交織帶：銀色貼紙
  dKnot: decalMaterial('decal-interlace-silver', { color: 0xd4d7da, roughness: 0.3, metalness: 0.65 }),
  // 鋸齒背鰭、尾翼（真金屬：名稱含 -steel）
  silver: namedMaterial('trim-silver-steel', { color: 0xc4c8cc, roughness: 0.3, metalness: 0.78, clearcoat: 0.2, side: THREE.DoubleSide }),
  // 八道刀形飾條（真金屬：名稱以 -brass 結尾）
  gold: namedMaterial('trim-gold-brass', { color: 0xd2a544, roughness: 0.28, metalness: 0.82, clearcoat: 0.3, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1d22, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-slate', { color: 0x2b3442, roughness: 0.6, side: THREE.DoubleSide }),
  cockpit: namedMaterial('shell-inner-dark', { color: 0x1a1d22, roughness: 0.85, side: THREE.DoubleSide }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x26303c, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-slate', { color: 0x2e3744, roughness: 0.75, side: THREE.DoubleSide }),
  dIncise: decalMaterial('decal-incised-dark', { color: 0x2a313b, roughness: 0.6 }),
  dStone: decalMaterial('decal-limestone', { color: 0xd8d1c1, roughness: 0.7 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯：輪拱切口後面的上半圈圓柱面（半徑 = 輪拱半徑 + 0.3），z 從殼內面往內 3.5 mm（最深到 |z| 25.5）；
 * 外側界限 = 側壁內面與「殼面高度 ≥ 內襯高度 + 0.9」兩者較小者（不穿出肩部曲面）
 * @type {(kit: any, arch: { x: number, y: number, radius: number }) => THREE.BufferGeometry}
 */
const buildLiner = (kit, arch) => {
  /** @type {number} 內襯從外側往內的深度（只遮住從輪拱斜看進去的殼內空腔，不做整圈輪室，省質量） */
  const LINER_DEPTH = 3.5;
  const r = arch.radius + 0.3;
  const n = 44;
  const a0 = 0.1;
  const a1 = Math.PI - 0.1;
  const zInner = 25.5;
  /** @type {(t: number) => number} 該角度內襯的外側 z */
  const zOuter = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    const zSide = P.hw(x) - 1.0;
    if (kit.surf.topY(x, zSide) >= y + 0.9) {
      return zSide;
    }
    let lo = zInner;
    let hi = zSide;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (kit.surf.topY(x, m) >= y + 0.9) {
        lo = m;
      } else {
        hi = m;
      }
    }
    return Math.max(zInner + 0.5, lo);
  };
  const pos = [];
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const o0 = zOuter(t0);
      const o1 = zOuter(t1);
      const A = p(t0, Math.max(zInner, o0 - LINER_DEPTH));
      const B = p(t1, Math.max(zInner, o1 - LINER_DEPTH));
      const C = p(t1, o1);
      const D = p(t0, o0);
      // 法線朝輪心
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
 * 一片鋸齒（側視多邊形）：根在中線頂 x = a（根部往下埋 1 mm），往後順梳成細長刀形，尖端在 (a − len, 中線頂 + h)，上緣微拱
 * @type {(a: number, len: number, h: number) => number[][]}
 */
const maneStrand = (a, len, h) => [
  [a, P.yN(a) - 1],
  [a - 0.2, P.yN(a) + 0.7],
  [a - 0.45 * len, P.yN(a - 0.45 * len) + 0.92 * h],
  [a - len, P.yN(a - len) + h],
  [a - 0.55 * len, P.yN(a - 0.55 * len) + 0.42 * h],
  [a - 2.6, P.yN(a - 2.6) - 1],
];

/**
 * 一列鋸齒（沿中線頂從 x1 往後到 x0，每 step 一片，彼此交疊）
 * @type {(x1: number, x0: number, step: number, len: number, h: (x: number) => number, zc: number, thick: number, tiltDeg: number) => THREE.BufferGeometry}
 */
const maneRow = (x1, x0, step, len, h, zc, thick, tiltDeg) => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (let a = x1; a >= x0 - 1e-6; a -= step) {
    geos.push(finPlate(maneStrand(a, len, h(a)), zc, thick, tiltDeg));
  }
  return mergeGeos(geos);
};

/** @type {number} 每側刀形飾條數（左右共 8 道＝八足） */
const STRAKES_PER_SIDE = 4;

/** @type {number} 刀形飾條下端高度：比兩輪之間的側裙下緣（13.6）低 1.2，飾條跨過側裙下緣 */
const STRAKE_Y0 = 12.4;

/**
 * 第 i 道刀形飾條的側視外形 (x, y)（i = 0 最前）：下端寬 6.6、往後上方約 45° 收成一個尖；越後面的越長
 * （下端 x 17 → −5.5、每 7.5 mm 一道；尖端 x 8 → −18.7、高 23 → 25.7，都在腰線 26 以下、離前後輪拱 ≥ 4 mm）
 * 4 道幾乎一樣大、間距相等，一側一眼數得出 4、兩側合計 8
 * @type {(i: number) => number[][]}
 */
const strakeOutline = (i) => {
  const x0 = 17 - 7.5 * i;
  return [
    [x0 + 1.4, STRAKE_Y0],
    [x0 - 9 - 1.4 * i, 23 + 0.9 * i],
    [x0 - 7.4, 17.4],
    [x0 - 5.2, STRAKE_Y0],
  ];
};

/** @type {number[][]} 貼身尾翼俯視外形 [x, z]（右半，左右鏡射）：前緣圓弧、後緣每半邊 4 個鋸齒尖（共 8 個） */
const TAIL_WING_HALF = [
  [-58, 0],
  [-58.5, 7.5],
  [-61, 14.5],
  [-64.5, 19],
  [-72.4, 20.5],
  [-69.8, 17.6],
  [-73, 15],
  [-70.2, 12.2],
  [-73.4, 9.4],
  [-70.4, 6.4],
  [-73.6, 3.6],
  [-71, 0],
];

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-sleipnir-stride',
  name: '八足神駒',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'sleipnir',
  form: 'strider',
  roof: 'canopy',
  wing: 'mane-crest',
  theme: '八足神駒用「八」的重複表現，不做馬頭與腿：修長低伏的刀形車身、低而薄的寬平刀口鼻，兩側前後輪之間各 4 道往後上方掃、下端跨過側裙下緣的金色刀形飾條（共 8 道，一道比一道長）、引擎蓋與背脊上往後梳的銀色鋸齒背鰭、後緣 8 個鋸齒尖的貼身尾翼；珍珠銀白到夜空靛藍的斜分段漸層上身＋深靛藍下身，肩上一條銀色交織帶，一對從鼻尖掃到車尾的 3 mm 金銅條紋',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面：只有腰線（6）是銳利稜線
  hard: [6],
  wheelArches: [
    { x: 40, y: 13, radius: 17.5, cutZFrom: 30 },
    { x: -40, y: 13, radius: 17.5, cutZFrom: 30 },
  ],
  canopy: CANOPY,
  // 座艙罩底下的殼面開口（罩緣內 0.8 mm）：透過煙燻罩看得到底盤，也不讓罩底多一層殼面
  openings: [{ id: '座艙罩底開口', shape: 'fn', sd: (x, y, z) => (y < 30 ? 10 : Math.abs(z) - (canopyHalfW(x) - 0.8)) }],
  sideZMin: 30,
  zones: () => [
    // 下半身（腰線以下）深靛藍
    { mat: 'indigo', keep: (x, y) => (isLower(x, y) ? 1 : -1) },
    // 塗裝：上半身由車頭珍珠銀白 → 金屬銀 → 風暴藍 → 車尾夜空靛藍的四段漸層，
    // 分段線往前上斜（x − 0.9·(y − 30)），像被風拉出的速度斜紋
    { mat: 'pearl', keep: (x, y) => x - 0.9 * (y - 30) - 26 },
    { mat: 'silver2', keep: (x, y) => x - 0.9 * (y - 30) - 2 },
    { mat: 'stormBlue', keep: (x, y) => x - 0.9 * (y - 30) + 24 },
    { mat: 'night', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'indigo', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];

    // ── 引擎蓋鋸齒背鰭：沿中線（x 46 → 17）每 3.6 mm 一片、彼此交疊的細長刀形，往後順梳 9.5 mm，高 2.0–2.8 mm（厚 1.3，根部埋進殼面 1 mm），停在座艙罩前 ──
    parts.push({
      geometry: maneRow(46, 17, 3.625, 9.5, (x) => lerp(2.0, 2.8, (x - 17) / 29), 0, 1.3, 0),
      mat: 'silver',
      solid: true,
      outline: true,
      name: 'hood-saw-fin',
    });
    // ── 鋸齒冠（mane-crest）：座艙後方背脊（x −34 → −72）三列交疊的長刀形（中列 + 兩側外傾 16° 的短列），往後越來越高（中列最高約 8.6 mm），尖端往後順梳、不超出車尾 ──
    {
      /** @type {(x: number) => number} 鋸齒冠高度：前端 1.4 → x −62 起 8.6 */
      const crestH = (x) => lerp(1.4, 8.6, Math.pow(Math.min(1, (-34 - x) / 28), 1.2));
      parts.push({
        geometry: mergeGeos([
          maneRow(-34, -58, 4, 13, crestH, 0, 1.3, 0),
          maneRow(-44, -58, 7, 12, (x) => 0.7 * crestH(x), -1.9, 1.1, 16),
          maneRow(-44, -58, 7, 12, (x) => 0.7 * crestH(x), 1.9, 1.1, -16),
        ]),
        mat: 'silver',
        solid: true,
        outline: true,
        name: 'mane-crest-wing',
      });
      // 貼身尾翼——俯視是往後散開的扇形（後緣 8 個鋸齒尖），厚 1.2，
      // 翼面 y 39.6 → 40.8（翼頂比座艙罩頂約 40.2 高 0.6 mm，V7），中央壓在鋸齒冠尖上
      {
        const pts = [...TAIL_WING_HALF, ...TAIL_WING_HALF.slice(1, -1).reverse().map(([x, z]) => [x, -z])];
        /** @type {number[][]} 深藍翼面的半邊外形：前緣比金色底板內縮約 0.6 mm，後緣停在鋸齒根部前（8 個鋸齒尖整個留金色） */
        const TOP_HALF = [
          [-58.7, 0],
          [-59.2, 7.2],
          [-61.6, 13.8],
          [-64.8, 17.8],
          [-69.2, 18.6],
          [-69.2, 0],
        ];
        const topPts = [...TOP_HALF, ...TOP_HALF.slice(1, -1).reverse().map(([x, z]) => [x, -z])];
        /**
         * 翼板：外形 (x, z)，厚 depth、底面在翼板座標 y0
         * @type {(outline: number[][], y0: number, depth: number) => THREE.BufferGeometry}
         */
        const plate = (outline, y0, depth) => {
          const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
          const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
          // (X, Y, Z) → (X, Z, −Y)：形狀平面轉成水平，厚度朝上
          g.rotateX(-Math.PI / 2);
          g.translate(0, y0, 0);
          // 後緣微翹 2°
          g.translate(58, 0, 0);
          g.rotateZ((-2 * Math.PI) / 180);
          g.translate(-58, 39.6, 0);
          return g;
        };
        // 金色底板（外形全尺寸）＋上面一片深藍翼面：俯視是深藍底、前緣與兩端一圈金邊，後緣 8 個金色鋸齒尖
        parts.push({ geometry: plate(pts, 0, 1.2), mat: 'gold', solid: true, outline: true, name: 'saw-tail-wing' });
        parts.push({ geometry: plate(topPts, 1.2, 0.3), mat: 'night', solid: true, outline: true, name: 'saw-tail-wing-top' });
      }
    }

    // ── 八道刀形飾條（每側 4 道）：直立薄板（厚 1.6）貼在兩輪之間的側壁上，外面比側壁凸出約 0.9 mm ──
    {
      /** @type {number} 飾條中心 |z|：兩輪之間側壁半寬 36.8 */
      const zc = 36.9;
      /** @type {THREE.BufferGeometry[]} */
      const strakes = [];
      for (const sg of [-1, 1]) {
        for (let i = 0; i < STRAKES_PER_SIDE; i++) {
          strakes.push(finPlate(strakeOutline(i), sg * zc, 1.6));
        }
      }
      parts.push({ geometry: mergeGeos(strakes), mat: 'gold', solid: true, outline: true, name: 'eight-strakes' });
    }

    // ── 金銅條紋（貼紙 3 mm）：一對從鼻尖往後掃、在引擎蓋上漸漸分開、經過座艙罩兩側一路到車尾的貫穿條紋（座艙罩底下不畫） ──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < -70 || x > 74 || y < P.yD(x) - 3 || kit.underCanopy(x, z) >= 0) {
          return -1;
        }
        return 1.5 - Math.abs(Math.abs(z) - Math.min(13.5, 0.42 * P.hw(x)));
      }, { offset: 0.14 }),
      mat: 'dBronze',
      name: 'decal-through-stripes',
    });

    // 輪拱內襯（前後，31 mm 大輪拱）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(kit, a))), mat: 'liner', shell: true, name: 'arch-liners' });
    // 輪胎內側的環形擋板（kitsune 的 buildArchWell，|z| 22.9），擋住從輪拱斜看進車身內部的視線
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });
    // 輪拱擋泥唇（深藍灰細唇 R0.55，沿側壁上的輪拱切口）
    {
      /** @type {THREE.BufferGeometry[]} */
      const lips = [];
      for (const arch of ARCHES) {
        for (const sg of [-1, 1]) {
          /** @type {number[][]} */
          const pts = [];
          const r = arch.radius + 0.5;
          for (let i = 0; i <= 64; i++) {
            const t = 0.02 + ((Math.PI - 0.04) * i) / 64;
            const x = arch.x + r * Math.cos(t);
            const y = arch.y + r * Math.sin(t);
            if (y < P.yLow(x) + 2.5 || y > ySideAt(x) - 0.4) {
              continue;
            }
            pts.push([x, y, sg * (P.hw(x) - 0.3)]);
          }
          if (pts.length > 3) {
            lips.push(sweepEllipse(pts, 60, () => [0.55, 0.55], 10));
          }
        }
      }
      parts.push({ geometry: mergeGeos(lips), mat: 'indigo2', solid: true, outline: true, name: 'arch-lips' });
    }

    // ── 貼紙 ──
    // 飾條底襯：跟著腰線與輪拱走的淺凹槽（沒有邊框的硬邊黑方塊在側視會像車身開洞、和底盤連成一片）：
    // 上緣沿腰線下 0.8、下緣中段在側裙上 0.8 並往前後兩端往上收、前後端沿輪拱外 2.0 mm
    // 收成圓角尖端（側視是一條梭形），角落用 smooth max 倒圓（半徑 2.4）；槽內是最深的夜空色（不是純黑）、上緣內側一道陰影帶像腰線下的凹階，
    // 外圍一圈 0.55 mm 銀色細邊，把槽和下方黑色底盤分開
    /** @type {(a: number, b: number, k: number) => number} 平滑 max（倒圓角半徑 k） */
    const smax = (a, b, k) => {
      const h = Math.max(k - Math.abs(a - b), 0) / k;
      return Math.max(a, b) + (h * h * k) / 4;
    };
    /** @type {(x: number, y: number) => number} 凹槽距離場（負值 = 槽內） */
    const groove = (x, y) => {
      const yTopG = ySideAt(x) - 0.8;
      // 下緣：中段貼側裙上 0.8，往前後兩端以 (|x| / 31)^4 往上收，和上緣在 |x| ≈ 31 會合（梭形）
      const yBotG = lerp(P.yLow(x) + 0.8, yTopG, Math.min(1, (Math.abs(x) / 31) ** 4));
      let d = smax(y - yTopG, yBotG - y, 2.4);
      d = smax(d, 2.0 - archRingDist(x, y), 2.4);
      return smax(d, Math.abs(x) - 34, 2.4);
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) && Math.abs(x) < 36 ? -groove(x, y) : -1), { offset: 0.06 }),
      mat: 'dBacking',
      name: 'decal-relief-groove',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) && Math.abs(x) < 36 ? Math.min(-groove(x, y), y - (ySideAt(x) - 1.7)) : -1), { offset: 0.08 }),
      mat: 'dGrooveShade',
      name: 'decal-relief-groove-shade',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) && Math.abs(x) < 37 ? 0.28 - Math.abs(groove(x, y) + 0.05) : -1), { offset: 0.1 }),
      mat: 'dGrooveEdge',
      name: 'decal-relief-groove-edge',
    });
    // Urnes 風格交織帶：上半身兩側各一條，從車尾沿肩走到前輪上方（避開背脊、座艙與腰線以下）
    parts.push({
      geometry: kit.decal((x, y, z) => (!isLower(x, y) && Math.abs(z) > P.nw(x) + 1.4 && kit.underCanopy(x, z) < 0 ? knotSd(x, y, z) : -1)),
      mat: 'dKnot',
      name: 'decal-urnes-interlace',
    });
    // 兩股絞繩紋（深色刻線 0.6 mm）：腰線上方 1.9 mm 沿肩走，兩條相位差半週期的正弦
    /** @type {(u: number, v: number) => number} u = 往車頭為正的 x */
    const cable = (u, v) => {
      const yc = ySideAt(u) + 1.9;
      const a = 0.75;
      const k = (2 * Math.PI) / 5.2;
      const d1 = Math.abs(v - (yc + a * Math.sin(k * u)));
      const d2 = Math.abs(v - (yc - a * Math.sin(k * u)));
      return Math.max(Math.min(d1, d2) - 0.3, u - 58, -62 - u, 1.2 - archRingDist(u, v));
    };
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(cable, { x0: 0, y0: 0, zMin: 30, side: 1 })),
        kit.decal(sideDecal((u, v) => cable(-u, v), { x0: 0, y0: 0, zMin: 30, side: -1 })),
      ]),
      mat: 'dIncise',
      name: 'decal-cable-band',
    });
    // 圖像石框線：側壁下緣上方一道石灰岩色細線（0.7 mm），避開輪拱與飾條
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        // 前後輪之間是刀形飾條，框線只留在前後懸（不從飾條中間穿過）
        return Math.min(0.35 - Math.abs(y - (P.yLow(x) + 3.2)), archRingDist(x, y) - 1.4, x + 64, 66 - x, Math.abs(x) - 23);
      }),
      mat: 'dStone',
      name: 'decal-frame-line',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：殼 x −74 → 76（扇形尾翼尖 −73.6，不超出車尾）、背 28（車尾）→ 後輪上 35.8 / 腰 32.4 / 前輪上 35.8 → 鼻端 24.5、中線細脊高 1.2–1.8、座艙罩頂約 40；半寬：前後輪上方 47.4、腰 36.8（蓋住輪胎與底盤側面）、鼻端 21（寬平刀口鼻）；SPEC 1.14a 車殼外框長 ≤ 153 mm、半寬 ≤ 48.0',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin / trojan），cutZFrom 30；輪拱內襯從側壁內面往內 3.5 mm；深靛藍擋泥唇 R0.55',
    strakes: '八足：《散文埃達》「he has eight feet」（MYTH_RESEARCH N12）、哥特蘭圖像石的八足馬（N9、N10、N11）；改用「八」的重複——每側 4 道刀形飾條（厚 1.6 mm 的實心 ABS 直立薄板，下端 y 12.4（跨過側裙下緣 13.6）、尖端 y 19.5–25.5，外凸約 0.9 mm，金色）與後緣 8 個鋸齒尖的尾翼，形狀與位置自創',
    mane: '引擎蓋鋸齒背鰭、鋸齒冠與貼身尾翼為實心 ABS 刀形板（厚 1.1–1.3 mm，彼此交疊處體積重複計入，偏保守），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    color: '灰色：原典「grey foal with eight legs」（N12）；灰馬留在珍珠銀白到金屬銀的前半身；往車尾轉成風暴藍、夜空靛藍的分段漸層、深靛藍下身、金色飾條、銀色背鰭、金銅條紋為自創',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 也會傳遞 mythSeries / mythTheme；這裡再補一次，和其他神話款一致
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const sleipnirStrideBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
