// 八足神駒斯雷普尼爾（body-sleipnir-stride，第八階段神話組・北歐）：修長、低伏的奔馬身——
// 後段低伏（車尾 27）、臀與肩隆起；iter-114 拿掉背脊升起的細長馬頸（評審：車頭中央像布料擠壓的折痕）；
// iter-116（評審：馬頭看不出來）：引擎蓋中線改成往前伸的馬頸＋馬頭隆起（頸頂 44.0、額頭 44.2，比兩側引擎蓋高約 8 mm，鼻樑往前下到鼻端 31），
// 塗炭灰和亮灰引擎蓋分開；頸頂一對往前豎的立耳、額前白斑、兩側杏仁眼、鼻端兩個鼻孔、青銅籠頭與韁繩；
// 座艙罩在中段；耳後沿頸脊一列銀色短鬃片排到座艙前，座艙後方的背脊再接一道往後升高的銀鬃冠（mane-crest，尾翼，三片束成一束，尾端不超出車尾）。
// 兩側車身在前後輪之間各有 8 條立體浮雕腿（iter-116 由平行的爪痕狀改成「飛馳」姿態：前 4 條往前伸、後 4 條往後蹬，角度各不相同）：
// 上段（前臂 / 小腿）粗、腕 / 飛節與球節有關節、管骨細、蹄是青銅楔形；腿沿側壁凸出約 0.95 mm，蹄不碰輪拱與輪胎。
// 配色：上半身深灰（亮面）、下半身與馬頭炭灰（霧面）、腿淺灰 / 中灰（緞面）＋青銅蹄、鬃是銀（金屬）、Urnes 風格銀色交織帶；
// 肩線下一道兩股絞繩紋（深色刻線，0.6 mm；不用 Tjängvide 那種像 Valknut 的編織帶、不用任何盧恩）。沒有翅膀（避開天馬意象）、不放騎士。
// 四個 R17.5 輪拱＋輪拱內襯：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-sleipnir-stride/DESIGN.md（MYTH_RESEARCH N9、N10、N11、N12：《散文埃達》灰色八足馬、哥特蘭圖像石）。
// iter-121（第九階段炫砲化）：前低後高的楔形、馬頭壓低（頂 49.9 → 45.1）、耳朵後貼；上半身改成珍珠銀白 → 金屬銀 → 風暴灰 → 槍鐵深灰的
// 前上斜分段漸層；八條腿改成同一步態週期的 8 個連續相位（前後組錯開半個週期）；頸鬃與鬃冠拉長、壓低往後飄；車頭改寬平切鼻、腰腹 36.8。
// iter-121 第二版：鬃冠後方加一片俯視扇形、後緣鬃尖鋸齒的貼身尾翼（翼頂比座艙罩頂高約 0.6 mm）；八條腿提亮成珍珠銀白 / 淺銀灰，
// 襯在前後輪之間的近黑底襯貼紙上。
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
  // 背 / 引擎蓋兩側（頸根外）高度：後輪上方的臀部隆起 37.6、腰背凹 33.6、前輪上方的肩部隆起 38，車尾低伏 27、鼻端 26
  // iter-121（第九階段，姿態）：車尾抬高 1 mm、肩臀降 0.6–1.0 mm、鼻端降到 24.5（前低後高的楔形）
  yD: monoCurve(XS, [28, 30, 31.6, 34, 35.6, 35.8, 33.6, 32.4, 32.6, 32.8, 33.8, 35.6, 35.8, 35, 33, 29.8, 27.4, 24.5]),
  // 中線頂：x < 14 是背上細脊（背 + 1.2）；iter-116：x 14 起是往前伸的馬頸＋馬頭（側視讀得出馬頭輪廓）——
  // 頸脊從座艙前往前升到耳後的頸頂（x 48，44.0）、額頭（x 56，44.2，比兩側引擎蓋高 8 mm）、鼻樑直線往前下（x 68，39.4）、口鼻圓收到鼻端 31
  // （iter-113 是升到 51.6 的細長馬頸，從前方看像布料擠壓的折痕；iter-114/115 的馬臉只高 4.6 mm，側視看不出馬頭）
  // iter-121：馬頸 / 馬頭壓低 2.6–3 mm（頸頂 41.2、額頭 41.4），鼻樑更平直地往前下衝（鼻端 29），頂高 ≤ 49
  yN: monoCurve(XS, [29.2, 31.2, 33, 35.6, 37.4, 37.6, 35.2, 33.8, 34, 34.4, 36.4, 39.2, 41.2, 41.4, 39.6, 36.6, 33.4, 29]),
  // 背脊 / 馬頸 / 馬頭半寬（頸 5.5 → 7 較窄，頭在額頭最寬 10、往鼻端收到 4.5：頸和頭分得開）
  nw: monoCurve(XS, [2.4, 2.6, 2.8, 3, 3, 3, 3, 3, 3, 3.4, 5.3, 6.6, 8, 9.4, 8.6, 7.2, 5.8, 4.4]),
  // 半寬（俯視馬形）：後輪上方的臀部 → 收細的腰腹（36.8，剛好蓋住底盤側面；iter-116 x −14 → 14 再收到 36.3，抵銷浮雕腿加粗後的俯視面積，IoU）→ 前輪上方的肩部 → 收成馬頭；車尾收窄（後導輪處 < 35.5）
  // iter-114：臀 / 肩 48.5 → 47.5（車殼外框含擋泥唇半寬 ≤ 48.0）；鼻段改成較緩的連續收窄（原本 x 56 → 68 由 48.5 急收到 21）、車尾收得更窄（俯視輪廓 IoU）
  // iter-121：臀 / 肩 47.5 → 47.4；車頭改成寬平切的鼻（鼻端半寬 21：LG1 V3 的平切鼻＋中央馬頭脊）、車尾 x −56 起收窄（35），
  // 俯視和 lowline-flat / owl-hush / tortoise-dome / dartfrog-hop 拉開（iter-121 參數掃描：最大俯視 IoU 0.832，基準 0.843）
  hw: monoCurve(XS, [17, 20, 22.5, 35, 47.4, 47.4, 36.8, 36.8, 36.8, 36.8, 36.8, 44.4, 47.4, 46.5, 43, 36, 29, 21]),
  // 側裙下緣：中段 13.6（蓋住底盤側面上半，底盤側框 9.4 以上）；車尾抬高到後上導輪頂（20.5）之上；車頭逐步抬高
  yLow: monoCurve(XS, [22.6, 22, 20.4, 15.5, 13.4, 13.2, 13.6, 13.6, 13.6, 13.6, 13.6, 13.2, 13.4, 14, 14.8, 17, 18.2, 19.2]),
};

/** @type {(x: number) => number} 臀 / 肩隆起係數（半寬 37 → 47.5 對應 0 → 1） */
const podAt = (x) => Math.min(1, Math.max(0, (P.hw(x) - 37) / 10.5));
/** @type {(x: number) => number} 側面腰線（上半身斑點灰與下半身深藍灰的分界、側壁頂）：臀 / 肩隆起處往下多 2.5 mm（圓鼓的葉子板） */
const ySideAt = (x) => P.yD(x) - 6.5 - 2.5 * podAt(x);

/**
 * 半剖面 9 點：中線頂 → 脊 / 馬臉頂 → 脊 / 馬臉側 → 融進背 / 引擎蓋 → 背肩 → 肩外圓 → 腰線（銳利）→ 側壁 → 側裙下緣（內收）
 * iter-114：馬臉段改成圓潤隆起（不再有脊 / 頸側稜的銳利稜線）
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
    // iter-121：肩部更圓收（tumblehome），正面看上緣兩角削掉
    [Math.max(nw + 3.2, 0.68 * hw), yD - 3.3],
    [hw - 2.2, yS + 0.8],
    [hw, yS],
    [hw, lerp(yS, yLow, 0.45)],
    [hw - 1.4, yLow],
  ];
};

// 馬頸與馬頭段每 0.5 mm 一站（曲率大），其餘每 2 mm
const STATIONS = [...buildStations(-74, 24, 2, profile).slice(0, -1), ...buildStations(24, 76, 0.5, profile)];

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
      // iter-121：座艙罩壓低 9.4 → 6.2（正面面積）
      const rise = 6.2 * Math.sin(Math.PI * u ** 0.8) ** 0.6;
      out.push({ x, yBase: 0, yTop: rise, halfW });
    }
    return out;
  })(),
};

/**
 * 八條腿（iter-115：每側都看得到完整 8 條腿——仿哥特蘭圖像石的側視八足馬，前 4 條一組、後 4 條一組，兩組各是兩對奔跑姿態）：
 * 側視折線 [x, y]（腿根 → 膝 / 跗 → 球節 → 蹄），dir 為蹄尖方向（+1 往前），near = 近側那條（淺灰、凸出多），否則是遠側（深一階、凸出少）
 * iter-116（評審：八條腿像平行的爪痕）：改成古代藝術的「飛馳」姿態——前 4 條都往前伸、後 4 條都往後蹬（第一條後腳撐在身下），
 * 每條伸出角度與膝 / 飛節彎度都不同、蹄的高低錯開；上段（前臂 / 小腿）粗、腕 / 飛節以下細
 * 蹄離前後輪拱切口 ≥ 1.4 mm（iter-114 每側只有 4 條腿＝一般的馬，評審數不出八足）
 * @type {{ pts: number[][], dir: number, near: boolean }[]}
 */
/**
 * iter-121（第九階段，評審：八條腿像貼上去的骨頭）：八條腿改成「奔跑相位」——同一個步態週期的 8 個連續相位
 * （像連續攝影的殘影）：前組 4 條由「往前伸 → 著地 → 撐住 → 往後推」依序擺動，後組 4 條比前組晚半個週期，
 * 前後錯開；每條腿由腿根往下三段（上段粗、關節、細管骨、蹄），角度由相位算出，
 * 上段擺角 θ（0 = 垂直向下、正 = 往前），前腳下段在腿往後時折向後（腕關節屈曲）、後腳飛節往後凸。
 * @type {(x0: number, theta: number, fold: number, front: boolean) => number[][]}
 */
const legPose = (x0, theta, fold, front) => {
  const r = (d) => (d * Math.PI) / 180;
  /** @type {number[]} 三段長度：上段、管骨、繫部 */
  const L = front ? [5.0, 4.3, 1.8] : [4.6, 4.5, 1.8];
  const a1 = r(theta);
  // 前腳：腕關節往後折（下段角 = θ − fold）；後腳：飛節往後凸（下段角 = θ + fold 之後再往前收）
  const a2 = front ? r(theta - fold) : r(theta + fold * 0.6);
  const a3 = front ? r(theta - fold * 0.4) : r(theta - fold * 0.3);
  const p0 = [x0, 25];
  const p1 = [p0[0] + L[0] * Math.sin(a1), p0[1] - L[0] * Math.cos(a1)];
  const p2 = [p1[0] + L[1] * Math.sin(a2), p1[1] - L[1] * Math.cos(a2)];
  const p3 = [p2[0] + L[2] * Math.sin(a3), p2[1] - L[2] * Math.cos(a3)];
  return [p0, p1, p2, p3];
};
/**
 * 8 個相位（腿根 x、上段擺角、下段折角、近 / 遠側）：前組腿根 x 11 → 2、後組 −2.4 → −12；
 * 擺角由前伸 +46° 依序擺到後推 −40°，後組再錯開半個週期（由 +20° 開始）
 * @type {{ pts: number[][], dir: number, near: boolean }[]}
 */
const LEGS = [
  { x0: 11, th: 46, fold: 10, front: true, near: true },
  { x0: 8, th: 22, fold: 34, front: true, near: false },
  { x0: 5, th: -6, fold: 52, front: true, near: true },
  { x0: 2, th: -30, fold: 18, front: true, near: false },
  { x0: -2.4, th: 20, fold: 16, front: false, near: false },
  { x0: -5.6, th: -4, fold: 30, front: false, near: true },
  { x0: -8.8, th: -26, fold: 34, front: false, near: false },
  { x0: -12, th: -44, fold: 20, front: false, near: true },
].map((l) => {
  const pts = legPose(l.x0, l.th, l.fold, l.front);
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  return { pts, dir: last[0] >= prev[0] - 0.3 ? 1 : -1, near: l.near };
});

/**
 * 折線每 step mm 插點（iter-116：讓 Catmull-Rom 掃掠幾乎走直線段，腿骨是直的、關節處才轉折，不再像彎爪）
 * @type {(pts: number[][], step: number) => number[][]}
 */
const densify = (pts, step) => {
  /** @type {number[][]} */
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) {
      out.push([lerp(ax, bx, k / n), lerp(ay, by, k / n)]);
    }
  }
  return out;
};

/** @type {(x: number, z: number) => boolean} 側壁（腰線以下的垂直面與內收下緣） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 1.45;
/** @type {(x: number, y: number) => boolean} 下半身（腰線以下） */
const isLower = (x, y) => y < ySideAt(x) + 0.05;

/**
 * Urnes 風格交織帶（iter-115，取代 iter-114 的淺色小圓環——評審看成泡泡）：兩條細長的「蛇形帶」各自沿
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
  // 上半身深灰（亮面：少數亮面部位；iter-115 由淺斑點灰 0x9aa0a6 加深，評審：灰白配色沒有北歐感，可加深灰與銀）
  grey: namedMaterial('paint-storm-grey', { color: 0x737a83, roughness: 0.34, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  // iter-121 漸層：珍珠銀白（車頭）、金屬銀、槍鐵深灰（車尾）——珍珠 / 金屬漆（paint- 且 roughness ≤ 0.5 → Blender 亮面漆）
  pearl: namedMaterial('paint-pearl-silverwhite', { color: 0xe2e5ea, roughness: 0.26, metalness: 0.25, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  silver2: namedMaterial('paint-metallic-silver', { color: 0xaab0b8, roughness: 0.3, metalness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  gunmetal: namedMaterial('paint-gunmetal-deep', { color: 0x3c424a, roughness: 0.36, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
  // 炭灰（下半身、口鼻，霧面；iter-115 由深藍灰改）
  slate: namedMaterial('paint-charcoal-slate', { color: 0x2c3138, roughness: 0.62, clearcoat: 0.05 }),
  slate2: namedMaterial('paint-charcoal-slate', { color: 0x2c3138, roughness: 0.62, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 腿：近側淺銀灰、遠側中灰（緞面）；蹄用青銅（iter-116）
  // iter-121 第二版：腿提亮（近側珍珠銀白、遠側淺銀灰），襯在近黑的底襯上，對比加強
  leg: namedMaterial('paint-leg-pearl', { color: 0xe6e9ed, roughness: 0.3, metalness: 0.2, clearcoat: 0.8 }),
  legFar: namedMaterial('paint-leg-greylight', { color: 0xa9afb6, roughness: 0.4, metalness: 0.2, clearcoat: 0.5 }),
  dBacking: decalMaterial('decal-relief-backing', { color: 0x0d0f12, roughness: 0.7 }),
  // 籠頭與韁繩（真金屬：名稱含 -brass）
  bronze: namedMaterial('trim-bronze-brass', { color: 0xa8763e, roughness: 0.32, metalness: 0.8, clearcoat: 0.2 }),
  dBronze: decalMaterial('decal-bridle-bronze', { color: 0xb07c40, roughness: 0.35, metalness: 0.7 }),
  // 交織帶：銀色貼紙
  dKnot: decalMaterial('decal-interlace-silver', { color: 0xd4d7da, roughness: 0.3, metalness: 0.65 }),
  // 馬眼 / 鼻孔：深色亮面（眼是全車少數亮面）
  eye: namedMaterial('paint-eye-gloss-black', { color: 0x101114, roughness: 0.15, clearcoat: 1.0 }),
  // 銀鬃（真金屬：名稱含 -steel）
  silver: namedMaterial('trim-silver-steel', { color: 0xc4c8cc, roughness: 0.3, metalness: 0.78, clearcoat: 0.2, side: THREE.DoubleSide }),
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
 * 一束鬃（側視多邊形）：鬃根在中線頂 x = a（根部往下埋 1 mm），往後順梳成細長刀形，鬃尖在 (a − len, 中線頂 + h)，上緣微拱
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
 * 一列鬃束（沿中線頂從 x1 往後到 x0，每 step 一束，彼此交疊）
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

/**
 * 側壁外表面的 |z|（腰線以下）：垂直段 = 半寬，側壁中段以下往內收 1.4 mm 到側裙下緣（和 profile 的最後兩點一致，近似）
 * @type {(x: number, y: number) => number}
 */
const sideWallZ = (x, y) => {
  const hw = P.hw(x);
  const yS = ySideAt(x);
  const yLow = Math.min(P.yLow(x), yS - 2);
  const yMid = lerp(yS, yLow, 0.45);
  if (y >= yMid) {
    return hw;
  }
  return hw - 1.4 * Math.min(1, (yMid - y) / Math.max(0.5, yMid - yLow));
};

/**
 * 浮雕管（iter-114 八條腿）：沿側視折線 [x, y] 掃掠扁橢圓斷面——斷面在「切線 ⟂ 平面」內，寬 w(t)（側視看到的腿粗）、
 * 厚 d(t)（往車外凸），中心 |z| = zAt(x, y)；首尾封蓋成封閉網格，最後依有號體積統一繞向朝外（質量用散度定理）
 * @type {(pts: number[][], n: number, w: (t: number) => number, d: (t: number) => number, zAt: (x: number, y: number) => number, sg: number, seg?: number) => THREE.BufferGeometry}
 */
const reliefTube = (pts, n, w, d, zAt, sg, seg = 12) => {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  /** @type {THREE.Vector3[][]} */
  const rings = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const nx = -tg.y;
    const ny = tg.x;
    const zc = sg * zAt(c.x, c.y);
    /** @type {THREE.Vector3[]} */
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (2 * Math.PI * k) / seg;
      ring.push(new THREE.Vector3(c.x + nx * Math.cos(a) * w(t), c.y + ny * Math.cos(a) * w(t), zc + sg * Math.sin(a) * d(t)));
    }
    rings.push(ring);
  }
  /** @type {THREE.Vector3[][]} 三角形 */
  const tris = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < seg; k++) {
      const a = rings[i][k];
      const b = rings[i][(k + 1) % seg];
      const c = rings[i + 1][(k + 1) % seg];
      const e = rings[i + 1][k];
      tris.push([a, e, c], [a, c, b]);
    }
  }
  for (const [ring, flip] of [[rings[0], false], [rings[n], true]]) {
    const cen = ring.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / seg);
    for (let k = 0; k < seg; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % seg];
      tris.push(flip ? [cen, b, a] : [cen, a, b]);
    }
  }
  // 有號體積 < 0 → 整體翻轉繞向
  let vol = 0;
  for (const [a, b, c] of tris) {
    vol += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
  }
  /** @type {number[]} */
  const pos = [];
  for (const [a, b, c] of tris) {
    if (vol >= 0) {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    } else {
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

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
  theme: '修長低伏的奔馬身：引擎蓋中線往前伸的炭灰馬頸與馬頭（頸頂立耳、額前白斑、杏仁眼、鼻孔、青銅籠頭）、中段低座艙罩、往後飄的頸鬃與鬃冠尾翼；兩側前後輪之間各 8 條「奔跑相位」立體浮雕腿（同一步態週期的 8 個連續姿勢，前後組錯開，青銅蹄）、珍珠銀白到槍鐵深灰的斜分段漸層上身＋炭灰下身',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面：只有腰線（6）是銳利稜線（iter-114 拿掉脊 / 頸側稜，馬臉是圓潤隆起）
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
    // 口鼻炭灰（iter-115：由鼻尖 2.8 mm 擴大到籠頭鼻帶前 x 69，深色口鼻是灰馬的特徵）
    { mat: 'slate', keep: (x) => x - 69 },
    // iter-116：馬頸與馬頭隆起（x 26 起、中線兩側到隆起邊緣）塗炭灰，在亮灰引擎蓋上讀得出一顆往前伸的馬頭
    { mat: 'slate', keep: (x, y, z) => Math.min(x - 26, P.nw(x) + 1.4 - Math.abs(z)) },
    // 下半身（腰線以下）深藍灰
    { mat: 'slate', keep: (x, y) => (isLower(x, y) ? 1 : -1) },
    // iter-121（塗裝＋材質）：上半身由車頭珍珠銀白 → 金屬銀 → 風暴灰 → 車尾槍鐵深灰的四段漸層，
    // 分段線往前上斜（x − 0.9·(y − 30)），像被風拉出的速度斜紋
    { mat: 'pearl', keep: (x, y) => x - 0.9 * (y - 30) - 26 },
    { mat: 'silver2', keep: (x, y) => x - 0.9 * (y - 30) - 2 },
    { mat: 'grey', keep: (x, y) => x - 0.9 * (y - 30) + 24 },
    { mat: 'gunmetal', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'slate', glass: 'glass', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];

    // ── 頸鬃（iter-114）：從兩耳之間沿中線（x 46 → 17）每 3.2 mm 一束、彼此交疊的細長刀形鬃，往後順梳 7 mm，鬃高 2.4 → 3.0 mm（厚 1.3，根部埋進殼面 1 mm），停在座艙罩前 ──
    parts.push({
      // iter-121：鬃束拉長到 9.5 mm、壓低到 2.0–2.8 mm，讀成被風往後梳的鬃
      geometry: maneRow(46, 17, 3.2, 9.5, (x) => lerp(2.0, 2.8, (x - 17) / 29), 0, 1.3, 0),
      mat: 'silver',
      solid: true,
      outline: true,
      name: 'neck-mane',
    });
    // ── 鬃冠尾翼（mane-crest）：座艙後方背脊（x −34 → −72）三列交疊的長鬃束（中列 + 兩側外傾 16° 的短列），往後越來越高（中列最高約 8.6 mm），鬃尖往後順梳、不超出車尾 ──
    {
      /** @type {(x: number) => number} 鬃冠高度：前端 1.4 → x −62 起 6.6（iter-121 由 8.6 壓低，鬃束拉長往後飄） */
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
      // iter-121 第二版：鬃冠往後拉成貼身尾翼——俯視是往後散開的鬃束扇形（後緣 5 個鬃尖鋸齒），厚 1.2，
      // 翼面 y 39.6 → 40.8（翼頂比座艙罩頂約 40.2 高 0.6 mm，V7），中央壓在鬃冠尖上
      {
        /** @type {number[][]} 俯視外形 [x, z]（右半，左右鏡射） */
        const half = [[-58, 0], [-58.5, 7.5], [-61, 14.5], [-64.5, 19], [-72.4, 20.5], [-69.6, 15.5], [-73.2, 10.5], [-70.2, 5.5], [-73.6, 0]];
        const pts = [...half, ...half.slice(1, -1).reverse().map(([x, z]) => [x, -z])];
        const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
        const wing = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
        // (X, Y, Z) → (X, Z, −Y)：形狀平面轉成水平，厚度朝上
        wing.rotateX(-Math.PI / 2);
        // 後緣微翹 2°
        wing.translate(58, 0, 0);
        wing.rotateZ((-2 * Math.PI) / 180);
        wing.translate(-58, 39.6, 0);
        parts.push({ geometry: wing, mat: 'silver', solid: true, outline: true, name: 'mane-tail-wing' });
      }
    }

    // ── 八條腿（iter-115：每側 8 條立體浮雕腿，前後各 4 條＝各兩對）：扁橢圓斷面沿腿線掃掠（上段寬 2.5 → 下段 1.45 mm），近側淺灰、遠側深一階，膝 / 跗與球節是關節球，蹄是深色楔形 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const legs = [];
      /** @type {THREE.BufferGeometry[]} */
      const hooves = [];
      /** @type {THREE.BufferGeometry[]} */
      const legsFar = [];
      for (const sg of [-1, 1]) {
        for (const leg of LEGS) {
          // 近側腿凸出 1.0 mm、遠側腿 0.7 mm（中心往內 0.25），兩條一對看得出前後層次
          const zOff = leg.near ? 0.2 : 0.45;
          const out = leg.near ? legs : legsFar;
          // iter-116：上段（前臂 / 小腿肌肉）半寬 2.3 → 腕 / 飛節 0.95 → 管骨 0.62，讀得出粗大腿到細腿的收細；
          // 相鄰腿根的肌肉彼此重疊，前 4 條合成一塊肩胸、後 4 條合成一塊臀部
          out.push(reliefTube(densify(leg.pts, 0.5), 28, (t) => (t < 0.4 ? 0.95 + 1.35 * (1 - t / 0.4) ** 1.6 : lerp(0.95, 0.62, (t - 0.4) / 0.6)), () => (leg.near ? 1.15 : 0.95), (x, y) => sideWallZ(x, y) - zOff, sg));
          // 關節：膝 / 跗（第 2 點）、球節（第 3 點）
          for (const [k, r] of [[1, 1.0], [2, 0.85]]) {
            const [jx, jy] = leg.pts[k];
            const j = new THREE.SphereGeometry(1, 12, 8);
            j.scale(r, r, leg.near ? 1.05 : 0.9);
            j.translate(jx, jy, sg * (sideWallZ(jx, jy) - zOff));
            out.push(j.toNonIndexed());
          }
          // 蹄：側視梯形（底寬 2.9、高 2.0，前緣斜），厚 1.8；iter-116 改青銅色（蹄鐵），在深色下半身上看得出每條腿的腳尖
          const [hx, hy] = leg.pts[leg.pts.length - 1];
          const d = leg.dir;
          const hoofPts = [
            [hx - 1.2 * d, hy - 1.1],
            [hx + 1.7 * d, hy - 1.1],
            [hx + 0.8 * d, hy + 0.9],
            [hx - 1.0 * d, hy + 0.9],
          ];
          hooves.push(finPlate(d > 0 ? hoofPts : hoofPts.reverse(), sg * (sideWallZ(hx, hy) - zOff), 1.8));
        }
      }
      parts.push({ geometry: mergeGeos(legsFar), mat: 'legFar', solid: true, outline: true, name: 'eight-legs-far' });
      parts.push({ geometry: mergeGeos(legs), mat: 'leg', solid: true, outline: true, name: 'eight-legs' });
      parts.push({ geometry: mergeGeos(hooves), mat: 'bronze', solid: true, outline: true, name: 'hooves' });
    }

    // ── 馬耳（iter-114）：馬臉後端一對往後微傾的立耳（側視葉形，厚 1.6 mm、0.2 mm 倒角，外張 12°），耳根埋進殼面 1 mm ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const ears = [];
      for (const sg of [-1, 1]) {
        // iter-116：耳朵移到頸頂（x 48.5）；iter-121：奔馳時耳朵往後貼（尖端往後上，高 5.4，原 7.6 往前豎），頂高 ≤ 49
        const ex = 48.5;
        const ez = 3.6;
        const y0 = kit.surf.topY(ex, ez) - 1;
        const pts = [
          [ex + 1.9, y0],
          [ex + 1.5, y0 + 2.8],
          [ex - 2.8, y0 + 5.4],
          [ex - 1.4, y0 + 2.4],
          [ex - 1.7, y0],
        ];
        ears.push(finPlate(pts, sg * ez, 1.6, sg * 10));
      }
      parts.push({ geometry: mergeGeos(ears), mat: 'slate', solid: true, outline: true, name: 'horse-ears' });
    }
    // ── 馬眼與鼻孔（iter-114，貼紙）：馬臉兩側杏仁眼（長 4.4、寬 2.0，外眼角往後上挑）；鼻端兩個斜橢圓鼻孔 ──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < P.yD(x) - 0.3) {
          return -1;
        }
        const az = Math.abs(z);
        // iter-116：眼睛隨馬頭隆起移到額頭兩側斜面（x 57.5、|z| 8.6），側視看得到
        const u = (x - 57.5) * Math.cos(0.35) + (az - 8.6) * Math.sin(0.35);
        const v = -(x - 57.5) * Math.sin(0.35) + (az - 8.6) * Math.cos(0.35);
        return 1 - Math.hypot(u / 2.2, v / 1.0);
      }, { offset: 0.1 }),
      mat: 'eye',
      name: 'decal-horse-eyes',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        // iter-116：鼻孔放大（1.1 × 0.75），往鼻端外側斜開
        const u = (x - 74) * Math.cos(0.5) - (az - 2.5) * Math.sin(0.5);
        const v = (x - 74) * Math.sin(0.5) + (az - 2.5) * Math.cos(0.5);
        return 1 - Math.hypot(u / 1.1, v / 0.75);
      }, { offset: 0.1 }),
      mat: 'eye',
      name: 'decal-nostrils',
    });
    // ── 額前白斑（iter-116，石灰岩色貼紙）：沿馬頭中線從額頭（寬 3.4）往鼻樑收細（寬 1.6）到鼻孔前，從正面看得出馬臉中線 ──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 52 || x > 72.6 || y < P.yN(x) - 2.5) {
          return -1;
        }
        const half = x < 56 ? lerp(0.6, 1.7, (x - 52) / 4) : lerp(1.7, 0.8, (x - 56) / 16.6);
        return Math.min(half - Math.abs(z), 72.6 - x);
      }, { offset: 0.08 }),
      mat: 'dStone',
      name: 'decal-face-blaze',
    });

    // ── 籠頭（iter-115，青銅貼紙 0.8–0.9 mm）：鼻帶（x 69 繞口鼻）、額帶（x 50.5，兩耳前）、頰帶（鼻帶 → 耳根，從眼睛內側經過）──
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (y < P.yD(x) - 1.5) {
          return -1;
        }
        const az = Math.abs(z);
        const nose = Math.min(0.45 - Math.abs(x - 69.4), P.nw(x) + 2.2 - az);
        const brow = Math.min(0.42 - Math.abs(x - 51.8), 11.2 - az);
        // 頰帶：(69.4, 8.8) → (51.8, 10.8) 線段（iter-116 隨馬頭加寬外移，從眼睛下方經過）
        const t = Math.min(1, Math.max(0, (69.4 - x) / 17.6));
        const cheek = 0.42 - Math.hypot(x - lerp(69.4, 51.8, t), az - lerp(8.8, 10.8, t));
        return Math.max(nose, brow, cheek);
      }, { offset: 0.12 }),
      mat: 'dBronze',
      name: 'decal-bridle',
    });
    // ── 韁繩（iter-115，實體青銅細繩 Ø1.3 mm，下緣埋進殼面 0.2 mm）：從鼻帶兩側沿馬臉、引擎蓋往後拉到座艙罩前 ──
    {
      /** @type {number[][]} 韁繩路徑 [x, |z|] */
      const path = [[69.4, 9.2], [65, 10.4], [60, 12.6], [54, 13.8], [44, 14.2], [32, 14], [20, 13.4], [10.5, 12.8]];
      /** @type {THREE.BufferGeometry[]} */
      const reins = [];
      for (const sg of [-1, 1]) {
        const pts = path.map(([x, az]) => [x, kit.surf.topY(x, az) + 0.45, sg * az]);
        reins.push(sweepEllipse(pts, 60, () => [0.65, 0.65], 10));
      }
      parts.push({ geometry: mergeGeos(reins), mat: 'bronze', solid: true, outline: true, name: 'reins' });
    }

    // 輪拱內襯（前後，31 mm 大輪拱）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(kit, a))), mat: 'liner', shell: true, name: 'arch-liners' });
    // iter-115：輪胎內側的環形擋板（kitsune 的 buildArchWell，|z| 22.9），擋住從輪拱斜看進車身內部的視線
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
      parts.push({ geometry: mergeGeos(lips), mat: 'slate2', solid: true, outline: true, name: 'arch-lips' });
    }

    // ── 貼紙 ──
    // iter-121 第二版：八條腿的近黑底襯（前後輪之間、腰線下 0.6 到側裙下緣上 0.4，避開輪拱），把淺色腿襯出來
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 24 || x < -24) {
          return -1;
        }
        return Math.min(ySideAt(x) - 0.6 - y, y - P.yLow(x) - 0.4, archRingDist(x, y) - 1.0, 23 - Math.abs(x));
      }, { offset: 0.06 }),
      mat: 'dBacking',
      name: 'decal-relief-backing',
    });
    // Urnes 風格交織帶（iter-115）：上半身兩側各一條，從車尾沿肩走到馬臉前（避開背脊、座艙與腰線以下）
    parts.push({
      geometry: kit.decal((x, y, z) => (!isLower(x, y) && Math.abs(z) > P.nw(x) + 1.4 && kit.underCanopy(x, z) < 0 ? knotSd(x, y, z) : -1)),
      mat: 'dKnot',
      name: 'decal-urnes-interlace',
    });
    // 兩股絞繩紋（深色刻線 0.6 mm）：腰線上方 1.8 mm 沿肩走，兩條相位差半週期的正弦
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
    // 圖像石框線：側壁下緣上方一道石灰岩色細線（0.7 mm），避開輪拱與腿
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        // iter-114：前後輪之間是浮雕腿，框線只留在前後懸（不從腿中間穿過）
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
    geometry: '本檔站位產生器 P（推估）：殼 x −74 → 76（鬃冠尖 −74.1）、背 27（車尾）→ 臀 36.4 / 腰 32.6 / 肩 36.8、馬頭額頭 44.2、頸頂 44.0（iter-116；iter-114/115 為 40.6，原馬頸頂 51.6 拿掉）、座艙罩頂約 44；半寬：臀與肩 47.5（iter-114，原 48.5）、腰 36.8（蓋住輪胎與底盤側面）；SPEC 1.14a 車殼外框長 ≤ 153 mm、半寬 ≤ 48.0',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin / trojan），cutZFrom 30；輪拱內襯從側壁內面往內 3.5 mm；深藍灰擋泥唇 R0.55',
    legs: '八條腿：《散文埃達》「he has eight feet」（MYTH_RESEARCH N12）、哥特蘭圖像石的八足馬（N9、N10、N11）；iter-116 每側 8 條、飛馳姿態（前腳前伸、後腳後蹬，上段半寬 2.3 → 管骨 0.62，青銅蹄），姿勢自創；iter-114 原為每側 4 條立體浮雕腿（扁橢圓斷面寬 3.0 → 1.7、厚 2.3 mm、外凸約 0.95 mm 的實心 ABS 掃掠件＋關節球＋厚 2 mm 楔形蹄），前一對、後一對成雙、奔跑姿勢；蹄底 y 12.3–13.1（高於底盤側框 9.4），位置與姿勢自創',
    mane: '頸鬃與鬃冠尾翼為實心 ABS 刀形鬃束板（厚 1.1–1.3 mm，鬃束彼此交疊處體積重複計入，偏保守），質量 = 封閉體積 × 1.05 g/cm³（推估）',
    color: '灰色：原典「grey foal with eight legs」（N12）；斑點、藍灰、銀、淺灰腿、深色蹄為自創（iter-113 的石灰岩米白腿改掉）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 也會傳遞 mythSeries / mythTheme；這裡再補一次，和其他神話款一致
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const sleipnirStrideBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
