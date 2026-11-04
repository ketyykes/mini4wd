// 米諾陶洛斯與迷宮（body-minotaur-maze，第八階段神話組・希臘；第九階段 iter-120 改成衝鋒的牛：低鏟頭、後高前低的楔形）：
// 車頭是寬而低的黑色鏟形牛頭（鼻尖離地約 14–17 mm），甲板從鼻尖一路往後升到後輪上方最高（約 40）再短收成截尾——低頭衝鋒的牛；
// 一對金色牛角低伸到鼻頭兩角、往前衝，做成左右前翼分流片（各自分開、角尖往前略上翹，不合成 U 形前鼻）；
// 俯視是「牛的前驅」楔形（iter-124）：寬的鏟形牛頭往後單調收窄到窄臀尖尾，腰部不內凹，側壁下半往內收；
// 甲板用奶油白細牆在赭紅底上畫出方折的同心迷宮（真的走得通），迷宮中心是金色方形凹槽座艙（開放座艙＋金色井壁）；
// 一條金色細線（阿里阿德涅之線）從鼻端穿過迷宮走到座艙；側裙壁畫藍，奶油白連續方折回紋帶從牛鼻貫穿到車尾（單向方螺旋，不組成四臂旋轉單元）。
// 四個 R15.2 輪拱（26 mm 輪）＋輪拱內襯與黑色擋泥唇。
// 設計：shared/design/body-minotaur-maze/DESIGN.md（MYTH_RESEARCH G6、G9、G10、G13：克諾索斯銀幣的直線迷宮、回紋＝線性迷宮、跳牛壁畫的白 / 紅 / 藍 / 黑）。
// 剖面為本檔站位產生器（推估）；塗裝全為自創，不含任何文字、號碼或商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sideDecal, sdRoundRect, mergeGeos, lerp, smoothstep } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/**
 * 站位參數表（x 由後到前，前後軸 x = ±40）。iter-114：「厚平板＋平切車尾」改成流線車殼——
 * 車尾往下斜收成窄尾（俯視淚滴）、甲板中央微拱（不再是平板）、側面肩線圓角；x 50 以前是迷宮甲板，50–66 是牛頭（寬額、往鼻吻收窄），66 以後是鼻吻
 */
const XS = [-70, -64, -58, -50, -40, -28, -14, 0, 14, 28, 40, 46, 50, 54, 60, 66, 71, 75, 77.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 甲板中線（iter-120：評審「車頂從車尾往前做下壓坡度成楔形」）：鏟形牛鼻 19.4 → 前輪上方 33.2 → 座艙 35.4 → 後輪上方最高 37.3（iter-124：腰部加寬後降 1.5 mm 守面數與正面面積）→ 截尾 29.4
  yC: monoCurve(XS, [29.4, 33.6, 36.2, 37.3, 37.3, 36.8, 36.2, 35.4, 34.6, 33.8, 33.2, 32, 30.6, 28.8, 26, 23.4, 21.4, 20, 19.4]),
  // 半寬（俯視，iter-124：評審「俯視沙漏 / 骨頭形、腰部凹槽露底盤」→ 放棄沙漏，回到接近基準的「牛的前驅」楔形平面）：
  // 寬而平的鏟形牛頭（x 40–60 半寬 46–46.4，外框 ≤ 48）往後一路單調收窄（x 8 → 44.5、x −16 → 39.5、後輪拱 36）到窄臀與尖尾（13），腰部不內凹；
  // 和 sleipnir（後寬前尖）、lowline（等寬長板）拉開俯視 IoU 靠的是「前寬後窄」＋寬的鏟形鼻端（x 77.5 仍 36.5）
  // iter-124b：避開新 sleipnir（腰 36.8、前後輪處 47.4）：中段 −28 → 8 加寬 2–3 mm、尾端（x ≤ −60）收窄、鼻端 36.5 → 39.5；俯視 IoU × sleipnir 0.859 → 0.831
  hw: monoCurve([-70, -66, -60, -54, -46, -38, -28, -16, -4, 8, 20, 32, 40, 45, 50, 54, 60, 65, 71, 77.5], [5, 10, 19, 29, 34.5, 37.5, 39.5, 42.5, 44.6, 45.6, 46, 46, 46, 46.2, 46.4, 46.4, 45.8, 44.8, 43, 39.5]),
  // 甲板中央拱起量（中線比甲板邊高）：座艙段 5、牛頭 2.6、鼻吻 1.2、車尾 1.2
  crown: monoCurve(XS, [1.2, 1.8, 2.6, 3.4, 4, 4.6, 5, 5, 4.6, 4, 3.4, 3, 2.8, 2.6, 2.3, 1.9, 1.6, 1.4, 1.2]),
  // 側裙下緣：中段 10.8（底盤側框段由 loft.js 自動讓開）；車尾抬高到 17（擴散器口），鏟形牛鼻下緣 13.6
  yLow: monoCurve(XS, [17, 17.2, 16.6, 13.4, 11.2, 11, 10.8, 10.8, 10.8, 11, 11.2, 12, 12.6, 13.2, 13.8, 14, 14, 14.2, 14.2]),
};

/** @type {(x: number) => number} 肩線圓角寬度（iter-116：車尾段從 x −50 的 4 收到車尾 1.4，讓尾端收成薄唇；iter-120：鏟形鼻端 x 66 → 77.5 從 4 收到 2，鼻端下緣才不會壓到前導輪） */
const chamferBaseAt = (x) => Math.min(4, 0.25 * P.hw(x), x < -50 ? lerp(1.4, 4, (x + 70) / 20) : 4, x > 66 ? lerp(4, 2, (x - 66) / 11.5) : 4);
/** @type {(x: number) => number} iter-126：牛頭兩側（x 44–66）肩線圓角加大 2.6 mm，赭紅頰板從甲板圓滑地往下包到側壁，不再是一片平蓋子的硬邊 */
const cheekRoundAt = (x) => 2.6 * smoothstep(42, 48, x) * (1 - smoothstep(62, 68, x));
const chamferAt = (x) => chamferBaseAt(x) + cheekRoundAt(x);
/** @type {(x: number) => number} 側壁頂到殼下緣的最小高度（iter-116：車尾段 2 → 1，尾端殼厚 ≈ 3 mm，不再是厚台階） */
const minWallAt = (x) => (x < -56 ? lerp(1, 2, Math.max(0, (x + 70) / 14)) : 2);
/** @type {(x: number) => number} 側壁下半段往內收的量（iter-116：評審「厚平板」→ 側壁下半往內收 ≤ 2.8 mm，側視與斜視的下緣落在陰影裡，車身讀起來變薄；後輪旁與窄車尾的側壁貼著輪胎外緣，維持原本 1 mm） */
const tuckAt = (x) => Math.max(1.2, Math.min(3, P.hw(x) - 35));
/** @type {(x: number) => number} 甲板邊（圓角起點）高度 */
const deckEdgeY = (x) => P.yC(x) - P.crown(x);
/** @type {(x: number) => number} 側壁頂（圓角終點）高度 */
const sideTopY = (x) => deckEdgeY(x) - 0.9 * chamferAt(x);

/**
 * 半剖面 8 點：甲板中線 → 微拱甲板（3 點）→ 肩線圓角 → 側壁頂 → 側壁 → 側裙下緣（內收 1 mm）；只有側裙下緣轉折（6）是銳利稜線
 * @type {(x: number) => number[][]}
 */
/** @type {number} 牛頭中央額脊高度（iter-122：評審「牛頭變成扁平黑板」→ 額脊把眼、角、鼻環集中成一張臉） */
const RIDGE_H = 3.4;
/** @type {(x: number) => number} 額脊強度 0–1：x 50 → 57 隆起、70 → 77.5 降到一半（鼻樑接鼻環） */
const ridgeAt = (x) => {
  const a = Math.min(1, Math.max(0, (x - 50) / 7));
  const b = Math.min(1, Math.max(0, (x - 70) / 7.5));
  return a * a * (3 - 2 * a) * (1 - 0.5 * b * b * (3 - 2 * b));
};

/** @type {{ x: number, h: number, back: number, front: number }} 公牛肩峰（iter-125，評審「側視仍是一塊前後等高的平板」）：峰頂 x、隆起高度、往後 / 往前的坡長 */
const HUMP = { x: 43, h: 5.5, back: 30, front: 10 };
/** @type {(x: number) => number} 肩峰隆起量：牛頭後方陡升（前坡 10 mm）、往後緩緩下收（後坡 30 mm）；只抬甲板中央，甲板邊與側壁不動 */
const humpAt = (x) => {
  if (x >= HUMP.x) {
    return HUMP.h * (1 - smoothstep(HUMP.x, HUMP.x + HUMP.front, x));
  }
  return HUMP.h * smoothstep(HUMP.x - HUMP.back, HUMP.x, x);
};

const profile = (x) => {
  const f = ridgeAt(x);
  const yC = P.yC(x) + humpAt(x);
  const hw = P.hw(x);
  const ch = chamferAt(x);
  const cr = P.crown(x) + humpAt(x);
  const hd = hw - ch;
  const yE = deckEdgeY(x);
  const ySide = sideTopY(x);
  const yLow = Math.min(P.yLow(x), ySide - minWallAt(x));
  return [
    [0, yC + RIDGE_H * f],
    [lerp(0.35 * hd, 5.2, f), yC - 0.12 * cr],
    [0.7 * hd, yC - 0.5 * cr],
    [hd, yE],
    [hw - 0.3 * ch, yE - 0.5 * ch],
    [hw, ySide],
    [hw, lerp(ySide, yLow, 0.5)],
    [hw - tuckAt(x), yLow],
  ];
};

/**
 * 側壁外面在高度 y 的 |z|（沿剖面第 4–7 點的折線內插；y 超出範圍時取端點）
 * iter-116：側壁下半段內收後，輪拱內襯與擋泥唇要跟著側壁走，不能用固定的 hw
 * @type {(x: number, y: number) => number}
 */
const sideZAt = (x, y) => {
  const pts = profile(x);
  for (let i = 4; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (y <= y0 && y >= y1) {
      return lerp(z0, z1, y0 === y1 ? 0 : (y0 - y) / (y0 - y1));
    }
  }
  return y > pts[4][1] ? pts[4][0] : pts[pts.length - 1][0];
};

// 牛頭、鼻吻段每 1 mm 一站，其餘每 2 mm（iter-120：鏟形牛頭曲率小，0.5 → 1 mm 省面數）
const STATIONS = [...buildStations(-70, 44, 2, profile).slice(0, -1), ...buildStations(44, 77.5, 1, profile)];

/** @type {{ x: number, y: number, radius: number }[]} 前後輪拱圓（側視，26 mm 輪胎半徑 13 + 2.2 mm；側壁在輪拱上方留一條厚板邊，31 mm 大輪不適用） */
const ARCHES = [
  { x: 40, y: 13, radius: 15.2 },
  { x: -40, y: 13, radius: 15.2 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {number} 牛頭起點（x 大於此值改成黑色牛頭：克諾索斯石雕牛頭角杯的黑色石材） */
const X_HEAD = 49;

/** @type {{ x: number, z: number, r: number, rise: number }} 牛眼位置（iter-124：往前移到 x 63.4，讓出角根；r、rise 已不用，杏仁眼尺寸見下方牛眼段）（iter-122：移到額脊兩側，和角根、鼻環集中成一張臉）（iter-116：從頭側小眼改到額頭兩側肩線圓角上的大眼——正面、側面、俯視都看得到雙眼）：x、離側壁的內縮量、球半徑、突出殼面高度 */
const EYE = { x: 63.4, z: 10.4, r: 2.8, rise: 1.3 };

/** @type {{ x: number, y: number }} 金鼻環中心（鼻吻正面，iter-116） */
const NOSE_RING = { x: 78.1, y: 15.6 };

/** @type {number} 側裙下緣黑色帶上緣高度（iter-116） */
const ROCKER_Y = 13.2;

/** @type {(x: number) => number} 黑色牛臉的半寬（iter-126：評審「赭紅甲板像一片蓋在黑牛頭上的蓋子」→ 甲板前緣沿兩側往前、往下包住牛頭，
 *  黑色只留中央往鼻吻展開的牛臉；x 50 半寬 11（角根、雙眼都在臉內）→ 鼻吻 x 77.5 半寬 34） */
const faceHalfAt = (x) => lerp(11, 34, smoothstep(50, 77.5, x));
/** @type {number} 赭紅頰板（甲板往前包住牛頭兩側）的起點 x：此值以前仍是甲板＋黑框邊 */
const X_CHEEK = 44;
/** @type {(x: number, y: number, z: number) => boolean} 赭紅頰板：牛臉以外的頭側，甲板、肩線倒角整片連到側壁，側壁上沿一條往前下斜的肩線往下包 */
const onCheek = (x, y, z) => {
  if (x < X_CHEEK || Math.abs(z) < faceHalfAt(x) || y < ROCKER_Y) {
    return false;
  }
  if (!onSide(x, z)) {
    return true;
  }
  // 側壁：x 44 從肩線往前下斜，x 約 60 包到側裙黑帶
  return x - X_CHEEK > sideTopY(x) - y;
};

/** @type {(x: number, z: number) => boolean} 側壁（倒角以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 0.25;
/** @type {(x: number, z: number) => boolean} 甲板（倒角以內） */
const onDeck = (x, z) => Math.abs(z) < P.hw(x) - chamferAt(x) - 0.05;

// ── 迷宮（俯視 (x, z) 平面）──────────────────────────────────────────────

/** @type {number} 迷宮中心（座艙中心）x */
const XC = 0;
/** @type {number} 迷宮牆寬（奶油白細線，mm） */
const WALL = 1.2;
/** @type {number} 迷宮圈數 */
const RINGS = 6;
/** @type {{ hx: number, hz: number }[]} 各圈牆的半長 / 半寬（內 → 外；x 向間距 7.1、z 向 4.0） */
const RING = Array.from({ length: RINGS }, (_, k) => ({ hx: 11.5 + 7.1 * k, hz: 11.5 + 4.0 * k }));
/** @type {number} 牆缺口半寬 */
const GAP = 1.9;
/** @type {(k: number) => number} 第 k 圈缺口的方向（+1 = 朝車頭，−1 = 朝車尾）：最外圈朝車頭（迷宮入口），往內前後交錯 */
const gapDir = (k) => ((RINGS - 1 - k) % 2 === 0 ? 1 : -1);
/** @type {(j: number) => number} 第 j 條迴廊（第 j 與 j + 1 圈之間）金線走的那一側（+1 = 右側 z > 0）；另一側中段有擋牆 */
const pathSide = (j) => ((RINGS - 2 - j) % 2 === 0 ? 1 : -1);
/** 座艙開口（俯視方形，迷宮中心） */
const COCKPIT = { x0: XC - 6.5, x1: XC + 6.5, hz: 6.5, r: 1.2 };

/**
 * 矩形外框距離（到框線的距離）
 * @type {(u: number, v: number, hx: number, hz: number) => number}
 */
const rectOutline = (u, v, hx, hz) => {
  const dx = Math.abs(u) - hx;
  const dz = Math.abs(v) - hz;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
  const inside = Math.min(Math.max(dx, dz), 0);
  return Math.abs(outside + inside);
};

/**
 * 線段距離
 * @type {(px: number, pz: number, ax: number, az: number, bx: number, bz: number) => number}
 */
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
};

/**
 * 迷宮牆距離函式（正值 = 牆內）：同心矩形牆＋缺口＋每條迴廊一道擋牆
 * @type {(x: number, z: number) => number}
 */
const mazeWalls = (x, z) => {
  const u = x - XC;
  let best = -Infinity;
  for (let k = 0; k < RINGS; k++) {
    const { hx, hz } = RING[k];
    let d = WALL / 2 - rectOutline(u, z, hx, hz);
    // 缺口：牆在 (±hx, |z| < GAP) 斷開
    if (Math.sign(u) === gapDir(k) && Math.abs(Math.abs(u) - hx) < 2 && Math.abs(z) < GAP) {
      d = Math.min(d, Math.abs(z) - GAP);
    }
    best = Math.max(best, d);
  }
  // 擋牆：第 j 條迴廊在金線不走的那一側、中段（u = 0）橫向封住
  for (let j = 0; j < RINGS - 1; j++) {
    const s = -pathSide(j);
    const d = WALL / 2 - segDist(u, z, 0, s * RING[j].hz, 0, s * RING[j + 1].hz);
    best = Math.max(best, d);
  }
  return best;
};

/**
 * 阿里阿德涅之線（俯視折線）：從牛鼻頂沿中線進最外圈入口，沿每條迴廊中線繞到下一圈缺口，最後進座艙
 * @type {number[][]}
 */
const THREAD = (() => {
  /** @type {number[][]} */
  const pts = [
    [74.5, 0],
    [XC + RING[RINGS - 1].hx, 0],
  ];
  for (let j = RINGS - 2; j >= 0; j--) {
    const mx = (RING[j].hx + RING[j + 1].hx) / 2;
    const mz = (RING[j].hz + RING[j + 1].hz) / 2;
    const s = pathSide(j);
    const inDir = gapDir(j + 1);
    pts.push([XC + inDir * mx, 0], [XC + inDir * mx, s * mz], [XC - inDir * mx, s * mz], [XC - inDir * mx, 0]);
  }
  // 穿過最內圈缺口直走到座艙口邊
  pts.push([XC + gapDir(0) * (COCKPIT.x1 - XC + 0.3), 0]);
  return pts;
})();

/** @type {(x: number, z: number) => number} 到金線的距離 */
const threadDist = (x, z) => {
  let d = Infinity;
  for (let i = 0; i < THREAD.length - 1; i++) {
    d = Math.min(d, segDist(x, z, THREAD[i][0], THREAD[i][1], THREAD[i + 1][0], THREAD[i + 1][1]));
  }
  return d;
};

// ── 側裙回紋帶（側視 (u, v)，u 往車頭為正）────────────────────────────────

/** @type {number} 回紋格距 */
const KEY_G = 1.25;
/** @type {number} 回紋一單元長度（4.6 格） */
const KEY_P = 4.6 * KEY_G;
/** @type {number} 回紋帶下緣高度 */
const KEY_Y0 = 15.6;
/** @type {number} 回紋線寬 */
const KEY_W = 0.75;

/**
 * 連續回紋（方折螺旋鉤，全部同一方向、掛在下邊線上；上邊線另一條）：每單元 (0,0)→(0,3)→(3,3)→(3,1)→(1.5,1)→(1.5,2)
 * @type {(u: number, v: number) => number} 到回紋線的距離（減半線寬）
 */
const greekKey = (u, v) => {
  const g = KEY_G;
  const y = v - KEY_Y0;
  // 上下邊線
  let d = Math.min(Math.abs(y + 0.9), Math.abs(y - 4 * g));
  const k = Math.floor(u / KEY_P);
  for (const kk of [k - 1, k, k + 1]) {
    const u0 = kk * KEY_P;
    /** @type {number[][]} */
    const pts = [
      [0, -0.9],
      [0, 3 * g],
      [3 * g, 3 * g],
      [3 * g, 1 * g],
      [1.5 * g, 1 * g],
      [1.5 * g, 2 * g],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      d = Math.min(d, segDist(u - u0, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    }
  }
  return d - KEY_W / 2;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 壁畫色：赭紅、壁畫藍、奶油白（霧面，像灰泥上的礦物顏料）
  ochre: namedMaterial('paint-fresco-ochre-red', { color: 0xa5452c, roughness: 0.64, clearcoat: 0.05 }),
  blue: namedMaterial('paint-fresco-blue', { color: 0x2e5b85, roughness: 0.62, clearcoat: 0.05 }),
  cream: namedMaterial('paint-fresco-cream', { color: 0xebdfc1, roughness: 0.62, clearcoat: 0.05 }),
  // 牛頭與甲板框邊：亮面黑（少數亮面部位）
  black: namedMaterial('paint-bull-black', { color: 0x1d1b1a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  // 牛角：金色（真金屬：名稱含 -brass）
  gold: namedMaterial('trim-gold-brass', { color: 0xc9a23a, roughness: 0.3, metalness: 0.8, clearcoat: 0.2 }),
  // 牛眼：亮面黑
  // iter-124：牛眼改紅碧玉色鑲嵌眼珠（克諾索斯石雕牛頭角杯的眼睛是水晶＋紅碧玉，造型自創）
  // iter-125（評審：紅碧玉眼珠＋白圈像紅白同心圓標靶）：改成黑曜石色杏仁瞳，外圈是兩端尖的白貝殼杏仁框
  eye: namedMaterial('paint-bull-eye-obsidian', { color: 0x0f0e10, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1a1716, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-black', { color: 0x1d1b1a, roughness: 0.6, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-umber', { color: 0x3a2a22, roughness: 0.8, side: THREE.DoubleSide }),
  // iter-120：迷宮中心金色凹槽座艙（評審「白方塊突兀」）
  goldWell: namedMaterial('trim-gold-brass', { color: 0xc9a23a, roughness: 0.3, metalness: 0.8, clearcoat: 0.2, side: THREE.DoubleSide }),
  dCream: decalMaterial('decal-fresco-cream', { color: 0xefe4c8, roughness: 0.6 }),
  dBlack: decalMaterial('decal-slip-black', { color: 0x1b1918, roughness: 0.5 }),
  dOchre: decalMaterial('decal-fresco-ochre', { color: 0x9c3b26, roughness: 0.6 }),
  dGold: decalMaterial('decal-gold-thread', { color: 0xd4ae45, roughness: 0.3, metalness: 0.75 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 輪拱內襯：輪拱切口後面的上半圈圓柱面（半徑 = 輪拱半徑 + 0.3），z 從殼內面往內 4.5 mm（最深到 |z| 25.5），
 * 擋住從輪拱看進去的殼內空腔與底盤；每個角度的外側界限 = 側壁內面與「殼面高度 ≥ 內襯高度 + 0.9」兩者較小者（不穿出倒角）
 * @type {(kit: any, arch: { x: number, y: number, radius: number }) => THREE.BufferGeometry}
 */
const buildLiner = (kit, arch) => {
  /** @type {number} 內襯從外側往內的深度（只遮住從輪拱斜看進去的殼內空腔，不做整圈輪室，省質量） */
  const LINER_DEPTH = 4.5;
  const r = arch.radius + 0.3;
  const n = 36; // iter-126：44 → 36 段
  const a0 = 0.1;
  const a1 = Math.PI - 0.1;
  const zInner = 25.5;
  /** @type {(t: number) => number} 該角度內襯的外側 z */
  const zOuter = (t) => {
    const x = arch.x + r * Math.cos(t);
    const y = arch.y + r * Math.sin(t);
    const zSide = sideZAt(x, y) - 1.0;
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

/** @type {import('./polyBody.js').PolyBodyConfig & { mythSeries: string, mythTheme: string }} 車殼設定 */
const CONFIG = {
  id: 'body-minotaur-maze',
  name: '米諾陶洛斯迷宮',
  style: 'myth',
  phase: 8,
  mythSeries: 'greek',
  mythTheme: 'minotaur-labyrinth',
  form: 'bull-slab',
  roof: 'open-cockpit',
  wing: 'none',
  theme: '低頭衝鋒的牛（iter-122）：寬低黑色鏟形牛頭中央一道隆起的額脊，額脊兩側黑杏仁瞳＋白貝殼杏仁框的鑲嵌眼、角根、鼻環集中成一張臉，一對粗金角往外橫伸再往前上彎成衝撞的新月形（iter-126 加粗加長）、頸背隆起成公牛肩峰（iter-125）、赭紅甲板往前下包住牛頭兩側成頰板、金色回紋肩線條（iter-126）；甲板從鼻尖往後升到後輪上方的楔形；俯視前寬後窄、腰部不內凹（側壁蓋到底盤側框上方）；甲板＝克諾索斯迷宮（金色阿里阿德涅之線）、金色凹槽座艙；貫穿全車的回紋帶',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 平滑剖面（iter-114）：甲板微拱、肩線圓角都平滑，只有側裙下緣轉折（6）是銳利稜線
  hard: [6],
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 33 },
    // iter-114：車尾收窄（後輪後方半寬 < 34.25 = 輪胎外緣），後輪拱切到 |z| ≥ 26 才不會碰輪胎
    { x: -40, y: 13, radius: 15.2, cutZFrom: 26 },
  ],
  openings: [
    {
      id: '迷宮中心座艙',
      shape: 'fn',
      sd: (x, y, z) => (y < 24 ? 10 : sdRoundRect(x, Math.abs(z), COCKPIT.x0, COCKPIT.x1, -COCKPIT.hz, COCKPIT.hz, COCKPIT.r)),
    },
  ],
  sideZMin: 30,
  zones: () => [
    // iter-126：黑色牛臉（額脊、雙眼、鼻吻）只留中央，往鼻吻展開
    { mat: 'black', keep: (x, y, z) => (x > X_HEAD && Math.abs(z) < faceHalfAt(x) ? 1 : -1) },
    // iter-126：赭紅頰板——甲板前緣往前、往下包住牛頭兩側（公牛低頭時頭兩側的頸肩）
    { mat: 'ochre', keep: (x, y, z) => (onCheek(x, y, z) ? 1 : -1) },
    // 黑色甲板框邊（倒角一圈）
    { mat: 'black', keep: (x, y, z) => (!onDeck(x, z) && !onSide(x, z) ? 1 : -1) },
    // 赭紅甲板（迷宮底色）
    { mat: 'ochre', keep: (x, y, z) => (onDeck(x, z) ? 1 : -1) },
    // iter-116：側裙下緣 3 mm 黑色（像底盤側框的延伸），側視的彩色車身變薄
    { mat: 'black', keep: (x, y) => ROCKER_Y - y },
    // 側裙：壁畫藍
    { mat: 'blue', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 座艙井壁：沿座艙開口往下 4.2 mm 的方形井（0.8 mm 壁，頂端埋進甲板殼內；沒有底，看得到底盤）──
    {
      const t = 0.8;
      const depth = 4.2;
      /** @type {THREE.BufferGeometry[]} */
      const walls = [];
      const yTopAt = (x) => top(x, 0) - 0.3;
      const yBot = Math.min(yTopAt(COCKPIT.x0), yTopAt(COCKPIT.x1)) - depth;
      const yTop = Math.max(yTopAt(COCKPIT.x0), yTopAt(COCKPIT.x1));
      const h = yTop - yBot;
      const lx = COCKPIT.x1 - COCKPIT.x0;
      for (const sg of [-1, 1]) {
        const gz = new THREE.BoxGeometry(lx + 2 * t, h, t);
        gz.translate(XC, yBot + h / 2, sg * (COCKPIT.hz + t / 2));
        walls.push(gz);
        const gx = new THREE.BoxGeometry(t, h, 2 * COCKPIT.hz);
        gx.translate(sg > 0 ? COCKPIT.x1 + t / 2 : COCKPIT.x0 - t / 2, yBot + h / 2, 0);
        walls.push(gx);
      }
      parts.push({ geometry: mergeGeos(walls), mat: 'goldWell', solid: true, name: 'cockpit-well' });
    }

    // ── 牛頭（iter-114：評審「牛頭只靠牛角和兩個鼻孔」→ 加寬額、耳、眼、鼻吻分界）──
    // 牛角：從額頂兩側（x 50、|z| 20）長出，往外、往上翹到車寬邊緣，再往前、往內合抱到鼻吻前方的豎琴形（跳牛壁畫裡往前彎的長牛角，造型自創）；全支金色（克諾索斯石雕牛頭角杯的鍍金木角為現代復原，這裡只借用「黑頭金角」的配色）
    {
      /** @type {(sg: number) => number[][]} 牛角路徑（iter-125：評審「金角垂直立起、尖端扭折，側視與後 3/4 像觸角」→ 改回往前彎的粗新月角）：
       *  根部埋進額脊兩側（x 55.6、|z| 8），先往外略往上橫伸到頭側（|z| 27），再平順地往前、往上彎，角尖在 x 75.5、y 42.6、|z| 31 朝前上
       *  （像低頭衝撞的公牛）；兩角尖左右相距 62 mm，不往內合抱、不成 U 形前鼻（避開 Stier）；路徑點間距均勻、曲率單調，不扭折 */
      const hornPath = (sg) => [
        [55.6, top(55.6, sg * 8) - 1.2, sg * 8],
        [56.0, top(56.0, sg * 13) + 2.0, sg * 13.5],
        [56.4, 35.4, sg * 20],
        [57.8, 36.6, sg * 27.5],
        [60.6, 37.8, sg * 35],
        [64.6, 39.0, sg * 40.4],
        [69.4, 40.4, sg * 42.4],
        [74.2, 42.0, sg * 41.6],
        [78.2, 43.8, sg * 39.2],
        [81.2, 45.4, sg * 36],
      ];
      /** @type {(t: number) => number[]} 角的斷面半徑（iter-124 恢復基準）：根部 2.6 → 角尖 0.75（粗壯的牛角），垂直 0.9 倍 */
      const hornR = (t) => {
        // iter-125：角變長（約 46 mm），根部粗段拉長、尖端才收細（根 2.7 → 尖 0.7）
        // iter-126：評審「角比基準細、短，後 3/4 像觸角」→ 根部 2.7 → 3.5（比基準 2.6 粗）、角長約 46 → 60 mm（基準約 55）；
        // 斷面往尖端收得比基準快（t^0.9），各段半徑仍 ≥ 基準，整車守 133 g
        const r = lerp(3.5, 0.75, Math.pow(t, 0.9));
        return [r, r * 0.9];
      };
      /** @type {THREE.BufferGeometry[]} */
      const horns = [];
      for (const sg of [-1, 1]) {
        horns.push(smoothNormals(sweepEllipse(hornPath(sg), 28, hornR, 8)));
      }
      parts.push({ geometry: mergeGeos(horns), mat: 'gold', solid: true, outline: true, name: 'bull-horns' });
    }
    // 牛耳：牛角根後下方、往外略往後下垂的葉形片（厚 1.4、邊緣 0.25 倒角），根部埋進頭側殼面
    {
      /** @type {THREE.BufferGeometry[]} */
      const ears = [];
      for (const sg of [-1, 1]) {
        const shape = new THREE.Shape();
        // 局部 (a, b)：a 沿耳長（往外）、b 沿耳寬；葉形：根部寬 3、尖端圓
        const L = 7.2;
        const W = 1.9;
        shape.moveTo(0, -W * 0.8);
        shape.quadraticCurveTo(L * 0.55, -W * 1.35, L, 0);
        shape.quadraticCurveTo(L * 0.55, W * 1.35, 0, W * 0.8);
        shape.lineTo(0, -W * 0.8);
        const bev = 0.25;
        const g = new THREE.ExtrudeGeometry(shape, { depth: 1.4 - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 6 }); // iter-124：俯視加寬後殼面增加，耳朵分段 2 / 10 → 1 / 6 守住殼面＋實體 ≤ 1.1 倍
        g.translate(0, 0, -0.7 + bev);
        // 局部 a → 世界 +z（往外）、b → 世界 x、厚度 → 世界 y；再往下垂 18°、往後掠 20°
        g.rotateX(-Math.PI / 2);
        g.rotateY(-Math.PI / 2);
        g.rotateX(-0.31);
        g.rotateY(0.35);
        if (sg < 0) {
          g.scale(1, 1, -1);
        }
        // iter-124：耳根移到角根後外側下方（x 52.5、|z| 18），讓出往外橫伸的粗牛角
        const x0 = 52.5;
        const z0 = 18;
        g.translate(x0, top(x0, z0) - 0.4, sg * z0);
        ears.push(g);
      }
      parts.push({ geometry: mergeGeos(ears), mat: 'black', solid: true, outline: true, name: 'bull-ears' });
    }
    // 牛眼（iter-124：評審「兩顆有眉的圓眼像卡通臉」→ 改成克諾索斯石雕牛頭角杯的鑲嵌眼：細長杏仁形、後端往外上斜，
    // 紅碧玉色亮面眼珠＋一圈 0.5 mm 奶油白貝殼鑲邊，拿掉眉弧）：扁橢球（半軸 3.4 × 1.0 × 1.2），沿殼面法線埋到只突出 0.55 mm
    {
      /** @type {number} 杏仁眼長半軸（沿車長） */
      const AX = 3.4;
      /** @type {number} 杏仁眼短半軸（橫向） */
      const AZ = 1.2;
      /** @type {number} 杏仁眼法向半軸 */
      const AN = 1.0;
      /** @type {number} 突出殼面高度 */
      const RISE = 0.55;
      /** @type {number} 後端往外張的角度（rad） */
      const YAW = 0.38;
      /** @type {THREE.BufferGeometry[]} */
      const eyes = [];
      /** @type {number[][]} 兩眼在殼面上的點 */
      const eyePts = [];
      for (const sg of [-1, 1]) {
        const z = sg * EYE.z;
        const y = top(EYE.x, z);
        // 殼面法線（數值微分）
        const h = 0.05;
        const gx = (top(EYE.x + h, z) - top(EYE.x - h, z)) / (2 * h);
        const gz = (top(EYE.x, z + h) - top(EYE.x, z - h)) / (2 * h);
        const n = new THREE.Vector3(-gx, 1, -gz).normalize();
        const c = new THREE.Vector3(EYE.x, y, z).addScaledVector(n, RISE - AN);
        const e = new THREE.SphereGeometry(1, 10, 6); // iter-126：12 × 8 → 10 × 6 段（面數讓給牛角與頰板分色邊界）
        e.scale(AX, AN, AZ);
        // 後端往上翹（繞 z）再往外張（繞 y）
        e.rotateZ(-0.12);
        e.rotateY(sg * YAW);
        e.translate(c.x, c.y, c.z);
        eyes.push(e);
        eyePts.push([EYE.x, y, z]);
      }
      parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, name: 'bull-eyes' });
      /** @type {number} 殼面交線相對半軸的比例 */
      const k = Math.sqrt(1 - ((AN - RISE) / AN) ** 2);
      /** @type {(x: number, z: number) => number} 杏仁眼正規化半徑（1 = 眼珠邊緣，俯視投影） */
      const eyeQ = (x, z) => {
        const sg = z < 0 ? -1 : 1;
        const p = eyePts[sg < 0 ? 0 : 1];
        const th = sg * YAW;
        const dx = x - p[0];
        const dz = z - p[2];
        const lx = dx * Math.cos(th) - dz * Math.sin(th);
        const lz = dx * Math.sin(th) + dz * Math.cos(th);
        return Math.hypot(lx / (AX * k), lz / (AZ * k));
      };
      /** @type {(x: number, z: number) => number[]} 眼的局部座標 [沿眼長（往前為正）, 橫向]（和 eyeQ 同一個旋轉） */
      const eyeLocal = (x, z) => {
        const sg = z < 0 ? -1 : 1;
        const p = eyePts[sg < 0 ? 0 : 1];
        const th = sg * YAW;
        const dx = x - p[0];
        const dz = z - p[2];
        return [dx * Math.cos(th) - dz * Math.sin(th), dx * Math.sin(th) + dz * Math.cos(th)];
      };
      /** @type {{ front: number, back: number, w: number }} 白貝殼杏仁框：前、後半長（後端拉長成眼尾）與最寬處半寬 */
      const SHELL = { front: 4.5, back: 6.2, w: 1.95 };
      // iter-125：奶油白貝殼鑲嵌框改成兩端尖的杏仁形（拋物線透鏡；寬度上下比瞳孔多 0.9 mm、前後角尖超出瞳孔 1.5 / 3.2 mm），
      // 不再是等寬的同心橢圓圈——黑瞳＋白杏仁框讀成鑲嵌眼，不是標靶
      parts.push({
        geometry: kit.decal((x, y, z) => {
          if (x < 54) {
            return -1;
          }
          const [lx, lz] = eyeLocal(x, z);
          const L = lx >= 0 ? SHELL.front : SHELL.back;
          const u = Math.min(1, Math.abs(lx) / L);
          const lens = SHELL.w * (1 - u * u) - Math.abs(lz);
          return Math.min((eyeQ(x, z) - 1.02) * AZ * k, lens);
        }),
        mat: 'dCream',
        name: 'decal-eye-rings',
      });
    }
    // 金鼻環（iter-116：評審建議加鼻環）：掛在鼻吻正面、環面朝前的 ABS 金色實心環（環半徑 2.7、斷面半徑 0.7），上緣埋進鼻吻
    {
      const ring = new THREE.TorusGeometry(2.2, 0.65, 6, 12); // iter-126：16 → 12 段，讓面數給加長的牛角
      ring.rotateY(Math.PI / 2);
      ring.translate(NOSE_RING.x, NOSE_RING.y, 0);
      parts.push({ geometry: ring, mat: 'gold', solid: true, outline: true, name: 'bull-nose-ring' });
    }

    // iter-124：拿掉 iter-122 的腰部斜裙——俯視不再收腰，殼側壁（壁畫藍）本身就一路蓋到 y 10.8，腰部沒有凹槽、看不到底盤
    // 輪拱內襯（前後）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildLiner(kit, a))), mat: 'liner', shell: true, name: 'arch-liners' });
    // iter-115：輪胎內側環形擋板（kitsune 的 buildArchWell，|z| 22.9、外徑 15.5 = 內襯半徑），把輪室和車身內部隔開
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 15.5, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 輪拱擋泥唇（黑色圓斷面細唇，半徑 0.7，沿側壁上的輪拱切口；只在垂直側壁段，不往外加寬俯視輪廓）
    {
      /** @type {THREE.BufferGeometry[]} */
      const lips = [];
      for (const arch of ARCHES) {
        for (const sg of [-1, 1]) {
          /** @type {number[][]} */
          const pts = [];
          const r = arch.radius + 0.55;
          for (let i = 0; i <= 32; i++) {
            const t = 0.02 + ((Math.PI - 0.04) * i) / 32;
            const x = arch.x + r * Math.cos(t);
            const y = arch.y + r * Math.sin(t);
            // 側壁在輪胎外緣（|z| 34.25）+ 1 mm 以內的地方（收窄的車尾）不做擋泥唇
            if (y < P.yLow(x) + 0.4 || y > sideTopY(x) - 0.5 || P.hw(x) < 36.4) {
              continue;
            }
            pts.push([x, y, sg * (sideZAt(x, y) - 0.35)]);
          }
          if (pts.length > 3) {
            lips.push(sweepEllipse(pts, 12, () => [0.7, 0.7], 4)); // iter-126：20 → 12 段
          }
        }
      }
      parts.push({ geometry: mergeGeos(lips), mat: 'black', solid: true, outline: true, name: 'arch-lips' });
    }

    // ── 貼紙 ──
    // 迷宮牆（奶油白 1.2 mm）：只畫在甲板上
    parts.push({
      geometry: kit.decal((x, y, z) => (onDeck(x, z) && x < 50 ? mazeWalls(x, z) : -1)),
      mat: 'dCream',
      name: 'decal-labyrinth-walls',
    });
    // 座艙口一圈奶油白框（0.9 mm）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = sdRoundRect(x, Math.abs(z), COCKPIT.x0, COCKPIT.x1, -COCKPIT.hz, COCKPIT.hz, COCKPIT.r);
        return y > 24 ? 0.9 - d : -1;
      }),
      mat: 'dGold',
      name: 'decal-cockpit-rim',
    });
    // 阿里阿德涅之線（金色 0.8 mm）：只畫在朝上的面（甲板、額頭、牛鼻頂）
    parts.push({
      geometry: kit.decal((x, y, z) => (y > deckEdgeY(x) - 0.3 && Math.abs(z) < P.hw(x) - chamferAt(x) ? 0.4 - threadDist(x, z) : -1), { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-ariadne-thread',
    });
    // 側裙回紋帶（奶油白）：iter-120 從牛鼻貫穿到車尾（賽車條紋），避開輪拱外 1.2 mm
    /** @type {(u: number, v: number) => number} u = 往車頭為正的 x */
    const keyBand = (u, v) => Math.max(greekKey(u + 80, v), u - 75, -67 - u, 1.2 - archRingDist(u, v));
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(keyBand, { x0: 0, y0: 0, zMin: 30, side: 1 })),
        // 左側：u = −x，回紋方向鏡射（從車頭看左右對稱）
        kit.decal(sideDecal((u, v) => keyBand(-u, v), { x0: 0, y0: 0, zMin: 30, side: -1 })),
      ]),
      mat: 'dCream',
      name: 'decal-meander-band',
    });
    // iter-126：金色肩線賽車條——從牛角根旁的頰板沿肩線倒角往後掃到後輪前（x 58 → −30，寬 1.6 → 0.5 mm 漸細），
    // 帶上每 6.2 mm 一個往後勾的方折回紋缺口（同側裙回紋的單向方折，不組成四臂旋轉單元），避開輪拱 0.6 mm
    {
      /** @type {number} 回紋缺口週期 */
      const STRIPE_P = 6.2;
      parts.push({
        geometry: kit.decal((x, y, z) => {
          if (x > 58 || x < -30 || onSide(x, z) || onDeck(x, z)) {
            return -1;
          }
          const hw = P.hw(x);
          const ch = chamferAt(x);
          const w = lerp(0.25, 0.8, (x + 30) / 88);
          const zMid = hw - 0.62 * ch;
          const band = w - Math.abs(Math.abs(z) - zMid);
          // 方折缺口：每週期在條帶前 1/3 切一道斜口（往後勾），讓長條讀成一串回紋鉤
          const ph = (((x - 58) % STRIPE_P) + STRIPE_P) % STRIPE_P;
          const notch = Math.abs(z) - zMid > -0.15 && ph < 0.9 ? -0.2 : 1;
          return Math.min(band, notch, archRingDist(x, y) - 0.6);
        }),
        mat: 'dGold',
        name: 'decal-gold-shoulder-stripe',
      });
    }
    // 側裙下緣赭紅細帶（0.9 mm，壁畫的分隔線）
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) && x < X_HEAD ? Math.min(0.45 - Math.abs(y - ROCKER_Y) - 0.05, archRingDist(x, y) - 1.2) : -1)),
      mat: 'dOchre',
      name: 'decal-skirt-line',
    });
    // 鼻孔：鼻吻頂前端一對往外斜的逗號形鼻孔（填赭紅，像鼻孔內側），不畫外圈（避免看成一對眼睛）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 69.5 || y < P.yC(x) - 1.6) {
          return -1;
        }
        const u = x - 74.4;
        const v = Math.abs(z) - 5.2;
        // 往外後方斜 35° 的橢圓（長軸 1.9、短軸 0.85）
        const c = Math.cos(0.6);
        const sn = Math.sin(0.6);
        const a = u * c + v * sn;
        const b2 = -u * sn + v * c;
        return 1 - Math.hypot(a / 1.25, b2 / 2.6);
      }),
      mat: 'dOchre',
      name: 'decal-nostrils',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，iter-120）：殼 x −70 → 77.5、牛角尖 x 81.7（外框長 151.7 ≤ 153，SPEC 1.14a）；甲板中線 19.4（鏟形鼻端）→ 33.2（前輪上方）→ 36（座艙）→ 39.8（後輪上方最高）→ 31（截尾）；半寬（iter-124）：鏟形牛頭 46.4（外框半寬 46.8 ≤ 48.0）→ x 8 44.5 → 後輪 36 → 尖尾 13（前寬後窄，不收腰）；甲板頂後輪上方 37.3；牛角尖 y 47.6；鼻端 x 66 起肩線圓角收小，下緣 ≥ 14（前導輪頂 12.5 + 1 mm 以上）；俯視半寬依輪廓 IoU 掃描決定',
    wheelArches: '前後 R15.2（26 mm 輪胎半徑 13 + 2.2 mm，同 cerberus），前 cutZFrom 33、後 26（車尾收窄後側壁在輪胎外緣以內）；31 mm 大輪需切輪拱（第八階段起就是如此）。輪拱內襯從側壁內面往內 4.5 mm；黑色擋泥唇 R0.7（iter-120：30 × 6 段；iter-124：20 × 4 段）',
    labyrinth: '迷宮：克諾索斯銀幣背面的直線迷宮（MYTH_RESEARCH G9）與「回紋是線性形式的迷宮」（G10）；6 圈同心矩形牆、缺口前後交錯、每條迴廊一道擋牆，牆寬 1.2 mm（圈數與尺寸自訂）',
    thread: '阿里阿德涅之線（G6）：金色 0.8 mm 細線沿迷宮解答路徑從牛鼻走到座艙',
    cockpit: '迷宮中心方形開放座艙 13 × 13 mm（iter-120）、井壁深約 4.2 mm（0.8 mm 實心壁），沒有底板（看得到底盤）',
    iter116: 'iter-116（評審 iter-115「厚平板＋尾端厚台階、牛臉太小」）：車尾中線 21.5 → 18.6、尾段圓角收到 1.4 mm、側壁最小高度 1 mm（尾端殼厚約 3 mm 的薄唇）；側壁下半段內收 ≤ 2.8 mm（後輪旁維持 1 mm）＋下緣 13.2 以下黑色；牛眼移到額頭肩線（球半徑 3、突出 1.25，推估）＋奶油白眼白環 1.1 mm；鼻孔放大到 2.5 × 5.2 mm；金鼻環（環半徑 2.7、斷面半徑 0.7，實心 ABS，推估）',
    horns: 'iter-120 牛角為實心 ABS 扁平掃掠件（斷面水平 φ6.4 × 垂直 φ4.0 → 角尖 φ1.6 × φ1.2（iter-120b 加粗、角尖上翹到 y 22.4），24 × 8 段），根部埋進鏟形牛頭肩線（x 54）、沿兩側肩線往前低伸到鼻端前 4 mm（x 81.7）當前翼分流片；牛耳葉形片厚 1.4（0.25 倒角）；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    cockpit120: 'iter-120 迷宮中心座艙縮成 13 × 13 mm、井壁改金色（trim-gold-brass），座艙口框改金色貼紙（評審「白方塊突兀」）',
    head: 'iter-114 牛頭：黑色石材般的頭（克諾索斯石雕牛頭角杯，Minoan art 條目：steatite / serpentine 類軟石，鍍金木角為現代復原）；牛眼、牛耳、鼻孔造型自創',
    iter126: 'iter-126（評審 iter-125「角比基準細短、甲板像蓋子」）：金角根部斷面半徑 2.7 → 3.5（基準 2.6）、角長約 60 mm（基準約 55），往外伸到 |z| 42.4 再往前上彎到 x 81.2、y 45.4，28 × 8 段；甲板前緣沿兩側往前、往下包住牛頭（赭紅頰板，黑色只留中央牛臉，分色邊界從 x 50 半寬 11 展開到鼻吻半寬 34；x 44–66 肩線圓角 4 → 6.6 mm，頰板圓滑往下包）；肩線倒角加金色回紋鉤賽車條（貼紙）；為守殼面＋實體面數，牛眼 10 × 6、擋泥唇 12 段、內襯 36 段、鼻環 12 段',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

// makePolyBody 也會傳遞 mythSeries / mythTheme；這裡再補一次，和其他神話款一致
/** @type {import('./types').BodyDef & { mythSeries: string, mythTheme: string }} */
export const minotaurMazeBody = { ...makePolyBody(CONFIG), mythSeries: CONFIG.mythSeries, mythTheme: CONFIG.mythTheme };
