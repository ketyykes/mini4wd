// 索爾的山羊戰車（body-tanngrisnir-chariot，第八階段神話組・北歐）：《散文埃達》中索爾乘坐、由兩頭公山羊 Tanngrisnir 與 Tanngnjóstr 拉的戰車。
// 車身是低而寬的橡木＋鐵箍戰車車斗（兩輪之間收腰）；iter-115 車斗封上中央拱起的橡木蓋板（tonneau，只留一個小座艙口），車尾高背板改成往下圓收的車尾（後面一條青銅折線紋），
// 輪廓變成「車頭低、蓋板拱起、車尾收圓」的流線車殼（評審 iter-114：開放車斗像容器）；
// iter-116（評審 iter-115：加蓋後像方木箱）：蓋板降低、座艙放大成開放式戰車座艙，兩側加前低後高的弧形橡木護欄＋鍛鐵立柱，側板中央一個 10 輻戰車木輪浮雕，車尾削成斜面；
// 車斗往前收成低平的車轅甲板，甲板中央一支細長車轅（中央脊）伸到車頭，兩側是兩頭並列的抽象山羊頭（往前低伸的短吻＋尖山羊鬍＋往後掃的兩對彎刀形山羊角，iter-115 由捲角改成後掃角，避免看成綿羊），
// 角根融進羊頭、羊頸從前擋泥板內壁長出（擋泥板＝羊的肩），頸上各一圈青銅頸環；車轅兩側是深色橡木甲板，只留兩條窄挽具溝（iter-114 前整段挖空成軛井）。
// 設計：shared/design/body-tanngrisnir-chariot/DESIGN.md（典故 MYTH_RESEARCH N12、N16；車斗語彙 N3 Oseberg 四輪木車；黑名單 H6 不放雷神之鎚、不用盧恩）。
// 塗裝全為自創：橡木棕（霧面）＋鍛鐵黑灰（緞面）＋青銅鉚釘與折線紋（金屬）＋少量暗紅；羊頭灰白、羊角象牙色。
// 不畫人、不放鎚、不用盧恩字母或任何被挪用的符號，不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, buildRegion, featureSd, sdRoundRect } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：背板後面 −63.5、車轅甲板前緣 64 */
const XS = [-63.5, -62, -58, -54, -50, -40, -20, 0, 18, 24, 30, 36, 44, 52, 58, 62, 64];
/** @type {number[]} 俯視半寬的站位（兩輪之間多兩個腰身控制點） */
const XS_HW = [-63.5, -62, -58, -54, -50, -40, -26, -16, 0, 16, 26, 36, 44, 52, 58, 62, 64];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 車斗邊沿 / 前擋泥板頂面高度：車斗 32；iter-116 車尾削成斜面（評審 iter-115：尾端厚台階要削出斜度）：x −50 的 30.6 往後斜降到尾端 21（尾端立面只剩約 3 mm）；
  // 前擋泥板 x 52 之後往下收到車頭 22
  yR: monoCurve(XS, [21, 22.6, 25.8, 28.6, 30.6, 32, 32, 32, 32, 32, 32, 32, 32, 31.6, 29.5, 25.5, 22]),
  // 中央（|z| < 18）高度（iter-115）：車斗加上中央拱起的橡木蓋板（tonneau）——車尾 31.4 → 座艙後方最高 39.6 → 往前順順降到 x 30 的 29，
  // 接回車轅甲板（26.3 → 車頭 20）。整台變成「前低後高、車斗段拱起」的流線輪廓（評審 iter-114：開放車斗不像比賽用車殼）
  // iter-116：蓋板最高 39.6 → 36.6（評審：加蓋後像方木箱），車尾跟著邊沿斜降到 21.6；戰車感改由座艙兩側的弧形護欄撐起（前低後高）
  yA: monoCurve(XS, [21.6, 23.4, 27.4, 31, 33.8, 36.4, 36.6, 35.6, 33.8, 31.6, 28.6, 26.8, 26.3, 25.5, 24, 22, 20]),
  // 俯視半寬：前後輪上方外張成 41（輪罩，蓋住輪胎）、兩輪之間收成 34 的腰（車斗側板內凹）；車尾兩角收圓（避開後導輪）、車頭收到 31
  hw: monoCurve(XS_HW, [31, 34.5, 38, 39.5, 40, 40, 39, 33.5, 32.5, 33.5, 39, 40, 40, 39, 37, 34, 31]),
  // 側壁下緣
  yLow: monoCurve(XS, [18, 17, 16, 15.2, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15.2, 15.4, 15.6]),
};

/** @type {number} 前擋泥板內緣（車轅甲板與擋泥板之間的內壁）|z| */
const Z_FENDER = 22;

/**
 * 半剖面 8 點：中線 → 車轅甲板 → 擋泥板內壁 → 擋泥板頂內緣（銳利）→ 頂外緣 → 圓肩 → 側壁 → 側壁下緣
 * 車斗段 yA = yR，前 5 點都在同一高度（平頂，座艙凹槽另外挖）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yR = P.yR(x);
  const yA0 = P.yA(x);
  const hw = P.hw(x);
  const lo = P.yLow(x);
  // iter-115：蓋板段（中央比邊沿高）是一個平滑拱面，拱高 c；車轅甲板段（中央比擋泥板低）維持原本的凹形
  const c = yA0 - yR;
  if (c > 0) {
    return [
      [0, yA0],
      [Z_FENDER - 4, yR + 0.55 * c],
      [Z_FENDER - 1.6, yR + 0.3 * c],
      [Z_FENDER + 0.6, yR + 0.12 * c],
      [hw - 1.6, yR],
      [hw, yR - 1.8],
      [hw, lerp(yR - 1.8, lo, 0.6)],
      [hw + 0.6, lo],
    ];
  }
  const yA = yA0;
  return [
    [0, yA],
    [Z_FENDER - 4, yA],
    [Z_FENDER - 1.6, lerp(yA, yR, 0.6)],
    [Z_FENDER + 0.6, yR],
    [hw - 1.6, yR],
    [hw, yR - 1.8],
    [hw, lerp(yR - 1.8, lo, 0.6)],
    [hw + 0.6, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 背板段每 0.75 mm 一站（坡度大），其餘每 2 mm */
const STATIONS = [...buildStations(-63.5, -50, 0.75, profile).slice(0, -1), ...buildStations(-50, 56, 2, profile).slice(0, -1), ...buildStations(56, 64, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];

/** @type {{ x0: number, x1: number, hz: number, r: number }} 戰車座艙（iter-116 由 18 × 19 小方口放大）：蓋板上的圓角開口（駕車者站位），兩側由弧形護欄圍住 */
const SEAT = { x0: -40, x1: 4, hz: 12.5, r: 5 };

/**
 * 戰車座艙凹槽（iter-115 取代原本整片開放的車斗甲板；iter-116 放大成 44 × 25 mm 的開放式座艙），深 4 mm，底是木條甲板
 * @type {any}
 */
const DECK = {
  id: '戰車座艙',
  view: 'top',
  shape: 'fn',
  sd: (x, y, z) => sdRoundRect(x, Math.abs(z), SEAT.x0, SEAT.x1, -SEAT.hz, SEAT.hz, SEAT.r),
  depth: 4,
};

/** @type {number[]} 挽具溝（iter-114）的 |z| 範圍：車轅（半徑 1.4）兩側到羊頭內側 */
const SLOT_Z = [1.8, 10.2];
/** @type {number} 挽具溝起點 x（車斗前壁之前） */
const SLOT_X0 = 25;

/**
 * 挽具溝（俯視開口，iter-114 取代原本的軛井）：原本車轅兩側 x 27–65、|z| 3.2–21.2 整片挖空，評審看到山羊後面的缺口露出黑色內部與底盤；
 * 現在只在車轅兩側各留一條寬 8.4 mm 的窄溝（|z| 1.8–10.2，兩頭山羊之間），羊頸後方與外側封成深色橡木板面；溝壁另做 4 mm 深的橡木內襯（buildSlotLiner），
 * 從車頭 3/4 視角（仰角約 22°）看進窄溝只看得到木壁、看不到底盤
 * @type {any[]}
 */
const HARNESS_SLOTS = [-1, 1].map((sg) => ({
  id: sg > 0 ? '挽具溝右' : '挽具溝左',
  view: 'top',
  shape: 'poly',
  pts: [
    [SLOT_X0, sg * SLOT_Z[0]],
    [SLOT_X0, sg * SLOT_Z[1]],
    [65, sg * SLOT_Z[1]],
    [65, sg * SLOT_Z[0]],
  ],
}));

/**
 * 挽具溝內襯：沿每條溝三邊（x 27 後壁、內外兩側壁）從車轅甲板往下 4 mm 的直立橡木壁
 * @type {() => THREE.BufferGeometry}
 */
const buildSlotLiner = () => {
  /** @type {number} 溝壁高（甲板面往下；車頭 3/4 視角仰角約 22°，斜看進 8.4 mm 寬的溝最多看到約 4 mm 深） */
  const depth = 4;
  /** @type {number[]} */
  const pos = [];
  /** @type {(a: number[], b: number[], c: number[], d: number[]) => void} */
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  /** @type {(x: number) => number} 溝壁頂（甲板面下 0.1） */
  const top = (x) => P.yA(x) - 0.1;
  /** @type {(x: number) => number} 溝壁底（不低於 y 17.6） */
  const bot = (x) => Math.max(17.6, top(x) - depth);
  for (const sg of [-1, 1]) {
    for (const zw of SLOT_Z) {
      for (let x = SLOT_X0; x < 64; x += 1) {
        const x1 = Math.min(64, x + 1);
        quad([x, top(x), sg * zw], [x1, top(x1), sg * zw], [x1, bot(x1), sg * zw], [x, bot(x), sg * zw]);
      }
    }
    quad([SLOT_X0, top(SLOT_X0), sg * SLOT_Z[0]], [SLOT_X0, top(SLOT_X0), sg * SLOT_Z[1]], [SLOT_X0, bot(SLOT_X0), sg * SLOT_Z[1]], [SLOT_X0, bot(SLOT_X0), sg * SLOT_Z[0]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 橡木：霧面（paint- 且 roughness > 0.5 → Blender 緞面）
  oak: namedMaterial('paint-oak-brown', { color: 0x7a5232, roughness: 0.68, clearcoat: 0.05 }),
  oakDark: namedMaterial('paint-oak-dark', { color: 0x553621, roughness: 0.7, clearcoat: 0.05 }),
  oakDark2: namedMaterial('paint-oak-dark', { color: 0x553621, roughness: 0.7, clearcoat: 0.05, side: THREE.DoubleSide }),
  deck: namedMaterial('paint-oak-deck', { color: 0x6a4529, roughness: 0.72, side: THREE.DoubleSide }),
  // 鍛鐵：緞面黑灰（車斗邊沿、座艙口）
  iron: namedMaterial('paint-forged-iron', { color: 0x45484d, roughness: 0.55, clearcoat: 0.12, clearcoatRoughness: 0.5 }),
  // 少量暗紅（背板頂面、前後封口）
  red: namedMaterial('paint-oxblood-red', { color: 0x6e1f1a, roughness: 0.6, clearcoat: 0.08 }),
  // 真金屬青銅（名稱含 -brass → Blender metallic）：鉚釘、折線紋、車轅頭
  bronze: namedMaterial('trim-bronze-brass', { color: 0x9c6b3c, metalness: 0.8, roughness: 0.34, clearcoat: 0.2 }),
  // 山羊：灰白頭頸（霧面）、象牙色羊角（微光澤）、灰色鬍鬚、琥珀色羊眼
  goat: namedMaterial('paint-goat-greywhite', { color: 0xd6d2c8, roughness: 0.62, clearcoat: 0.05 }),
  horn: namedMaterial('paint-horn-ivory', { color: 0xe6d9bb, roughness: 0.46, clearcoat: 0.3 }),
  beard: namedMaterial('paint-goat-beard-grey', { color: 0x9d988e, roughness: 0.72 }),
  eye: namedMaterial('paint-goat-eye-amber', { color: 0xb8801f, roughness: 0.2, clearcoat: 1.0 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-oak', { color: 0x4a3020, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-iron', { color: 0x2e3034, roughness: 0.7, side: THREE.DoubleSide }),
  dSeam: decalMaterial('decal-oak-seam', { color: 0x2e1c10, roughness: 0.78 }),
  dIron: decalMaterial('decal-iron-band', { color: 0x3f4247, roughness: 0.55, clearcoat: 0.12 }),
  dBronze: decalMaterial('decal-bronze-zigzag', { color: 0xa8743f, metalness: 0.7, roughness: 0.35 }),
  // iter-116 戰車輪浮雕：淺橡木輪輞與輻條
  dWheel: decalMaterial('decal-oak-wheel', { color: 0xa47448, roughness: 0.66 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

// ---------------------------------------------------------------------------
// 山羊頭（實體件）
// ---------------------------------------------------------------------------

/** @type {number} 羊頭中心 |z| */
const GOAT_Z = 14.5;

/**
 * 粗山羊角斷面：根粗尖細，沿角每約 2 mm 一道環節（山羊角的橫稜）
 * @type {(t: number) => number[]}
 */
const hornRad = (t) => {
  const ridge = 1 + 0.1 * Math.cos(2 * Math.PI * 9 * t);
  // iter-114：角根 2.2 → 2.0（封住軛井後整車超過 133 g，減實體件質量）
  const r = lerp(2.0, 0.62, t ** 0.9) * ridge;
  return [r * 0.92, r * 1.08];
};

/**
 * 山羊角中心線（iter-115）：從頭頂往上、再往後掃成一道彎刀形弧線，尖端略往下、往外張（野山羊 / 家山羊的後掃角）；
 * 原本往下捲回半圈的螺旋角被評審看成綿羊角
 * @type {(sg: number, zBase: number, spread: number) => number[][]} spread：往外張的方向（+1 = 遠離羊頭中心）
 */
const hornPath = (sg, zBase, spread) => {
  const z = (dz) => sg * (zBase + spread * dz);
  return [
    [60, 36, z(0)],
    [59.2, 39.6, z(0.25)],
    [57.4, 42.8, z(0.6)],
    [54.6, 45.2, z(1.1)],
    [51, 46.4, z(1.7)],
    [47.4, 46.3, z(2.3)],
    [44.6, 45.4, z(2.8)],
  ];
};

/**
 * 一頭山羊：頸（根部埋進車轅甲板）、頭（往前下斜的短吻）、鼻頭、鬍鬚、兩耳、兩支粗捲角、兩眼
 * @type {(sg: number) => { head: THREE.BufferGeometry, horns: THREE.BufferGeometry, beard: THREE.BufferGeometry, eyes: THREE.BufferGeometry }}
 */
const buildGoat = (sg) => {
  const zc = sg * GOAT_Z;
  const neck = sweepEllipse(
    [
      [44.5, 28.6, sg * 20],
      [49, 29.6, sg * 18.6],
      [54.5, 31.8, sg * 15.6],
      [58, 33, zc],
    ],
    18,
    (t) => [lerp(2.9, 2.8, t), lerp(3.5, 3.3, t)],
    14,
  );
  // 頭：額頭 → 鼻樑往前下斜（羊吻短，前端收窄）
  const skull = sweepEllipse(
    [
      [56.5, 33.6, zc],
      [60.5, 34.2, zc],
      [64.5, 32.4, zc],
      [68.8, 29.4, zc],
    ],
    20,
    (t) => [lerp(3.2, 1.9, t), lerp(3.7, 2.3, t)],
    16,
  );
  const nose = new THREE.SphereGeometry(1, 16, 10);
  nose.scale(1.9, 2.4, 2.1);
  nose.translate(68.9, 29.2, zc);
  // 兩耳：往外下垂的扁葉片
  const ear = new THREE.SphereGeometry(1, 14, 8);
  ear.scale(1.4, 0.75, 2.8);
  ear.rotateX(sg * 0.45);
  ear.translate(58.8, 33.4, zc + sg * 4.6);
  const ear2 = new THREE.SphereGeometry(1, 14, 8);
  ear2.scale(1.4, 0.75, 2.8);
  ear2.rotateX(-sg * 0.45);
  ear2.translate(58.8, 33.4, zc - sg * 4.6);
  // 鬍鬚（iter-115 加長、收尖）：下巴往下、略往後垂的一撮山羊鬍（側視尖楔形，厚 1.8），評審：「下巴加鬍鬚，避免被看成綿羊」
  const beard = finPlate(
    [
      [67.6, 28.8],
      [63.6, 30.2],
      [62.4, 25.6],
      [62.6, 20.4],
      [64.2, 23.6],
      [66.4, 26.4],
    ],
    zc,
    1.8,
  );
  // 兩支粗捲角：一支往外、一支往內（都從頭頂長出）
  const horns = [
    sweepEllipse(hornPath(sg, GOAT_Z + 1.9, 1), 44, hornRad, 14),
    sweepEllipse(hornPath(sg, GOAT_Z - 1.9, -1), 44, hornRad, 14),
  ];
  const eyes = [1, -1].map((side) => {
    const e = new THREE.SphereGeometry(0.85, 12, 8);
    e.scale(1.25, 0.8, 1);
    e.translate(62.2, 34.6, zc + side * 3.15);
    return e;
  });
  return { head: mergeGeos([neck, skull, nose, ear, ear2]), horns: mergeGeos(horns), beard, eyes: mergeGeos(eyes) };
};

/**
 * 單一條橫向折線（閃電形鋸齒）：中心線 y = y0 ± amp，週期 period，回傳到中心線的距離函式（以 z 為橫軸）
 * @type {(y0: number, amp: number, period: number) => (z: number, y: number) => number}
 */
const zigzagDist = (y0, amp, period) => (z, y) => {
  // 鋸齒中心線上離 z 最近的兩段折線
  const k = Math.floor((z + 1000 * period) / period) - 1000;
  let best = Infinity;
  for (let j = k - 1; j <= k + 1; j++) {
    const a = [j * period, y0 - amp];
    const m = [j * period + period / 2, y0 + amp];
    const b = [(j + 1) * period, y0 - amp];
    for (const [p, q] of [
      [a, m],
      [m, b],
    ]) {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const t = Math.max(0, Math.min(1, ((z - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(z - p[0] - t * dx, y - p[1] - t * dy));
    }
  }
  return best;
};

/** @type {number[]} 車斗側面鐵箍的 x（後軸之後 1 道、兩輪之間 2 道；iter-116 中間那道讓給戰車輪浮雕） */
const BAND_X = [-58, -15, 15];
/** @type {number} 鐵箍寬 */
const BAND_W = 2.6;
/** @type {number[]} 側面橡木板縫高度 */
const SEAM_Y = [19.2, 23.6, 28];

/** @type {{ x: number, y: number, r: number, spokes: number }} 側面戰車大木輪浮雕（iter-116）：兩輪之間的側板中央，10 根輻條（不做四輻十字輪） */
const RELIEF_WHEEL = { x: 0, y: 22.6, r: 7.6, spokes: 10 };

/**
 * 戰車輪浮雕的各層距離場（負值在內）：底盤（深色圓盤）、鐵輪箍、木輪輞、輻條、青銅輪轂
 * @type {(x: number, y: number) => { disc: number, tire: number, felloe: number, spoke: number, hub: number }}
 */
const reliefWheelSd = (x, y) => {
  const W = RELIEF_WHEEL;
  const dx = x - W.x;
  const dy = y - W.y;
  const r = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  /** @type {number} 每根輻條的角距 */
  const step = (2 * Math.PI) / W.spokes;
  // 第一根輻條轉半格，讓輻條不落在正上下、正前後（避免讀成十字）
  const k = Math.round((a - step / 2) / step);
  const da = a - step / 2 - k * step;
  const spokeD = Math.max(r * Math.abs(Math.sin(da)) - 0.42, 1.4 - r, r - (W.r - 1.9));
  return {
    disc: r - W.r,
    tire: Math.abs(r - (W.r - 0.55)) - 0.55,
    felloe: Math.abs(r - (W.r - 1.6)) - 0.55,
    spoke: spokeD,
    hub: r - 1.9,
  };
};

/** @type {number} 座艙護欄的 |z|（座艙口 12.5 + 鍛鐵內緣 1.6 之外） */
const RAIL_Z = 16.2;

/**
 * 蓋板在 |z| = RAIL_Z 處的表面高度（剖面第 1、2 點之間線性內插，蓋板段 c > 0）
 * @type {(x: number) => number}
 */
const deckYAtRail = (x) => {
  const yR = P.yR(x);
  const yA = P.yA(x);
  const c = yA - yR;
  if (c <= 0) {
    return yA;
  }
  return lerp(yA, yR + 0.55 * c, RAIL_Z / (Z_FENDER - 4));
};

/** @type {number[][]} 護欄中心線（x, 離蓋板面高度）：前端低（x 6 埋進蓋板）→ 往後拉高到 x −30 的 8.4 → 後端急降埋進車尾（前低後高的弧形戰車護欄） */
const RAIL_PATH = [
  [7, -0.8],
  [3, 2.2],
  [-6, 5.2],
  [-17, 7.4],
  [-30, 8.4],
  [-39, 7.6],
  [-45, 4.6],
  [-48.5, 1.2],
  [-50, -0.8],
];

/** @type {number[]} 護欄鍛鐵立柱的 x */
const RAIL_POSTS = [-6, -18, -31, -41];

/**
 * 座艙兩側的弧形戰車護欄（iter-116）：橡木扶手（斷面 1.5 × 1.8 mm）＋鍛鐵立柱（直徑 1.3 mm）
 * @type {() => { rails: THREE.BufferGeometry, posts: THREE.BufferGeometry }}
 */
const buildRails = () => {
  /** @type {(x: number) => number} 中心線在 x 處離蓋板的高度（RAIL_PATH 線性內插） */
  const railH = (x) => {
    for (let i = 0; i < RAIL_PATH.length - 1; i++) {
      const [xa, ha] = RAIL_PATH[i];
      const [xb, hb] = RAIL_PATH[i + 1];
      if (x <= xa && x >= xb) {
        return lerp(ha, hb, (xa - x) / (xa - xb));
      }
    }
    return 0;
  };
  /** @type {THREE.BufferGeometry[]} */
  const rails = [];
  /** @type {THREE.BufferGeometry[]} */
  const posts = [];
  for (const sg of [-1, 1]) {
    rails.push(
      sweepEllipse(
        RAIL_PATH.map(([x, h]) => [x, deckYAtRail(x) + h, sg * RAIL_Z]),
        48,
        () => [0.75, 0.9],
        10,
      ),
    );
    for (const px of RAIL_POSTS) {
      const y0 = deckYAtRail(px) - 0.6;
      const y1 = deckYAtRail(px) + railH(px);
      const g = new THREE.CylinderGeometry(0.65, 0.65, y1 - y0, 10);
      g.translate(px, (y0 + y1) / 2, sg * RAIL_Z);
      posts.push(g);
    }
  }
  return { rails: mergeGeos(rails), posts: mergeGeos(posts) };
};

export const tanngrisnirChariotBody = makePolyBody({
  id: 'body-tanngrisnir-chariot',
  name: '索爾的山羊戰車',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'thor-goat-chariot',
  form: 'chariot-tub',
  roof: 'open-cockpit',
  wing: 'goat-horns',
  theme: '索爾的山羊戰車：低而寬的橡木＋鐵箍車斗（兩輪之間收腰）封上中央拱起的木條蓋板、開放式戰車座艙兩側弧形護欄，側板 10 輻戰車木輪浮雕，車尾削成斜面、斜面上一條青銅折線紋，車頭兩頭並列山羊（短吻、尖鬍鬚、往後掃的兩對彎刀形角、青銅頸環）夾著細長車轅',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 車轅甲板邊、擋泥板頂內緣、頂外緣是銳利稜線
  hard: [1, 3, 4],
  wheelArches: ARCHES,
  recesses: [DECK],
  // iter-114：原本的軛井大開口改成車轅兩側兩條窄挽具溝（評審：山羊後面的缺口看得到黑色內部與底盤）
  openings: HARNESS_SLOTS,
  innerSkipRecess: true,
  sideZMin: 30,
  zones: () => [
    // 車尾斜面暗紅（iter-116：尾端削成斜面，暗紅帶放寬到 x −55）
    { mat: 'red', keep: (x) => -55 - x },
    // 鍛鐵邊沿：車斗邊沿與擋泥板頂的外緣（圓肩一圈 2.4 mm 寬）
    { mat: 'iron', keep: (x, y, z) => Math.min(y - (P.yR(x) - 2.6), Math.abs(z) - (P.hw(x) - 2.4)) },
    // 鍛鐵內緣：座艙口一圈 1.6 mm 寬
    { mat: 'iron', keep: (x, y, z) => (y > P.yR(x) + 0.5 ? 1.6 - DECK.sd(x, y, z) : -1) },
    // 鍛鐵下緣帶
    { mat: 'iron', keep: (x, y, z) => (Math.abs(z) > 30 ? P.yLow(x) + 2.2 - y : -1) },
    // 車轅甲板：深色橡木
    { mat: 'oakDark', keep: (x, y, z) => Math.min(x - 22, Z_FENDER - 1 - Math.abs(z)) },
    { mat: 'oak', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'red', recess: 'deck', recessWall: 'oakDark2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 33, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    // iter-115：輪胎內側環形擋板（kitsune 的 buildArchWell，|z| 22.9 接內襯內緣成一個輪室；車斗封成蓋板後輪室上方不再有開口）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 兩頭山羊
    const goats = [-1, 1].map((sg) => buildGoat(sg));
    parts.push({ geometry: mergeGeos(goats.map((g) => g.head)), mat: 'goat', solid: true, outline: true, name: 'goat-heads' });
    parts.push({ geometry: mergeGeos(goats.map((g) => g.horns)), mat: 'horn', solid: true, outline: true, name: 'goat-horns' });
    parts.push({ geometry: mergeGeos(goats.map((g) => g.beard)), mat: 'beard', solid: true, outline: true, name: 'goat-beards' });
    parts.push({ geometry: mergeGeos(goats.map((g) => g.eyes)), mat: 'eye', solid: true, name: 'goat-eyes' });
    // 車轅（中央脊）：從車斗前壁沿甲板中線伸到車頭，末端青銅圓頭
    const pole = sweepEllipse(
      [
        [23, 31.5, 0],
        [34, 27.8, 0],
        [50, 26.4, 0],
        [64, 25.4, 0],
        [73.5, 26.2, 0],
      ],
      36,
      // iter-114：斷面 2.5 × 2.8 → 2.1 × 2.4 mm（減質量）
      () => [1.05, 1.2],
      12,
    );
    parts.push({ geometry: pole, mat: 'oakDark', solid: true, outline: true, name: 'chariot-pole' });
    const knob = new THREE.SphereGeometry(1, 16, 12);
    knob.scale(2.4, 2.3, 2.3);
    knob.translate(74.6, 26.4, 0);
    parts.push({ geometry: knob, mat: 'bronze', solid: true, outline: true, name: 'pole-knob' });
    // 頸圈（挽具）：每頭山羊頸部一圈青銅頸環（不做橫跨車轅的軛木，俯視車轅兩側保持開放）
    /** @type {THREE.BufferGeometry[]} */
    const collars = [];
    for (const sg of [-1, 1]) {
      const g = new THREE.TorusGeometry(3.35, 0.7, 8, 28);
      g.scale(1, 1.12, 1);
      g.lookAt(new THREE.Vector3(5.5, 2.2, -sg * 3).normalize());
      g.translate(51.5, 30.6, sg * 17.2);
      collars.push(g);
    }
    parts.push({ geometry: mergeGeos(collars), mat: 'bronze', solid: true, outline: true, name: 'goat-collars' });
    // 車尾斜面的青銅折線紋（iter-116：尾端削成斜面後沒有直立背板，改成斜面上沿 z 走的單一條鋸齒帶）
    const zigTail = zigzagDist(-59.2, 1.4, 7);
    parts.push({
      geometry: kit.decal((x, y, z) => (x < -55.5 && Math.abs(z) < 25 && y > P.yR(x) - 1.2 ? 0.6 - zigTail(z, x) : -1), { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-tail-zigzag',
    });
    // 座艙兩側的弧形戰車護欄（iter-116，評審：找回戰車感）
    const rail = buildRails();
    parts.push({ geometry: rail.rails, mat: 'oakDark', solid: true, outline: true, name: 'chariot-rails' });
    parts.push({ geometry: rail.posts, mat: 'iron', solid: true, name: 'chariot-rail-posts' });
    // 側面戰車大木輪浮雕（iter-116）：深色底盤 → 鐵輪箍 → 淺橡木輪輞與 10 根輻條 → 青銅輪轂，逐層加高
    /** @type {(x: number, z: number) => boolean} 只畫在側板上 */
    const onSide = (x, z) => Math.abs(z) >= P.hw(x) - 1.2;
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? -reliefWheelSd(x, y).disc : -1), { offset: 0.1 }),
      mat: 'dSeam',
      name: 'decal-relief-wheel-disc',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? -reliefWheelSd(x, y).tire : -1), { offset: 0.35 }),
      mat: 'dIron',
      name: 'decal-relief-wheel-tire',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        const w = reliefWheelSd(x, y);
        return -Math.min(w.felloe, w.spoke);
      }, { offset: 0.3 }),
      mat: 'dWheel',
      name: 'decal-relief-wheel-spokes',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? -reliefWheelSd(x, y).hub : -1), { offset: 0.45 }),
      mat: 'dBronze',
      name: 'decal-relief-wheel-hub',
    });
    // 蓋板（tonneau）木條縫（iter-115）：沿 x 的深色細縫，每 5 mm 一道，只畫在蓋板頂面（中央比邊沿高的段）、避開座艙口
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (x > 26 || x < -61 || az > Z_FENDER || y < P.yR(x) + 0.4 || DECK.sd(x, y, z) < 1.2) {
          return -1;
        }
        const u = (az + 2.5) % 5;
        return 0.3 - Math.min(u, 5 - u);
      }),
      mat: 'dSeam',
      name: 'decal-tonneau-seams',
    });
    // 側面橡木板縫（深色細線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        // iter-116：戰車輪浮雕範圍內不畫板縫
        if (Math.abs(z) < P.hw(x) - 1.2 || reliefWheelSd(x, y).disc < 0.8) {
          return -1;
        }
        let d = Infinity;
        for (const sy of SEAM_Y) {
          d = Math.min(d, Math.abs(y - sy));
        }
        return 0.32 - d;
      }),
      mat: 'dSeam',
      name: 'decal-oak-seams',
    });
    // 側面鐵箍（直條，凸起 0.3 mm）與輪拱鐵箍（沿輪拱切口 1.8 mm 寬）
    parts.push({
      geometry: kit.decal(
        (x, y, z) => {
          if (Math.abs(z) < P.hw(x) - 1.2) {
            return -1;
          }
          let d = Infinity;
          for (const bx of BAND_X) {
            d = Math.min(d, Math.abs(x - bx) - BAND_W / 2);
          }
          for (const a of ARCHES) {
            d = Math.min(d, Math.hypot(x - a.x, y - a.y) - a.radius - 1.8);
          }
          return -d;
        },
        { offset: 0.3 },
      ),
      mat: 'dIron',
      name: 'decal-iron-bands',
    });
    // 挽具溝內襯（iter-114）
    parts.push({ geometry: buildSlotLiner(), mat: 'oakDark2', shell: true, name: 'harness-slot-liner' });
    // 車轅甲板木條縫（iter-114，原軛井位置封閉後的板面）：沿 x 的深色細縫，每 4 mm 一道（中央脊與擋泥板內壁之間）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (x < 27 || az < SLOT_Z[1] + 0.4 || az > Z_FENDER - 2.2 || y > P.yA(x) + 0.6) {
          return -1;
        }
        const u = (az - SLOT_Z[1]) % 4;
        return 0.3 - Math.min(u, 4 - u);
      }),
      mat: 'dSeam',
      name: 'decal-yoke-deck-seams',
    });
    // 甲板木條縫（沿 x 的細縫）
    const deckSd = featureSd(DECK);
    parts.push({
      geometry: buildRegion(kit.surf, [...kit.holes, (x, y, z) => -deckSd(x, y, z), (x, y, z) => {
        const u = Math.abs(z) % 5;
        return 0.3 - Math.min(u, 5 - u);
      }], { offset: -DECK.depth + 0.06 }).geometry,
      mat: 'dSeam',
      name: 'decal-deck-seams',
    });
    // 青銅鉚釘：側面鐵箍上每箍 3 顆、輪拱鐵箍上各 5 顆（半埋的小圓頂）
    /** @type {THREE.BufferGeometry[]} */
    const rivets = [];
    /** @type {(x: number, y: number, sg: number) => void} */
    const rivet = (x, y, sg) => {
      const g = new THREE.SphereGeometry(0.7, 10, 6);
      g.scale(0.9, 0.9, 0.7);
      g.translate(x, y, sg * (P.hw(x) + 0.32));
      rivets.push(g);
    };
    for (const sg of [-1, 1]) {
      for (const bx of BAND_X) {
        for (const ry of [17.2, 23.6, 29.4]) {
          // iter-116：車尾斜面段的鐵箍較矮，超出側壁的鉚釘不放
          if (ry > P.yR(bx) - 2.2) {
            continue;
          }
          rivet(bx, ry, sg);
        }
      }
      for (const a of ARCHES) {
        for (const ang of [0.35, 0.95, Math.PI / 2, Math.PI - 0.95, Math.PI - 0.35]) {
          const r = a.radius + 0.9;
          rivet(a.x + r * Math.cos(ang), a.y + r * Math.sin(ang), sg);
        }
      }
    }
    parts.push({ geometry: mergeGeos(rivets), mat: 'bronze', solid: true, name: 'bronze-rivets' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：車殼 x −63.5 ~ 64、車轅頭到 77（長約 141）；車斗邊沿 32、iter-116 蓋板中央最高 36.6（車尾斜面降到 21.6）、護欄頂約 44.6、羊角頂約 47.5（batch4「長約 140–150、高約 44–52」）；輪罩半寬 40 蓋住輪胎、兩輪之間收腰 32.5；車尾兩角收到 31（離後導輪 ≥ 1 mm）',
    cockpit: 'iter-115：原本 x −47 ~ 20 的整片開放車斗（深 4.5 mm）封成拱起的橡木蓋板；iter-116 座艙放大成 x −40 ~ 4、|z| ≤ 12.5（深 4 mm，推估），兩側弧形護欄扶手斷面 1.5 × 1.8、立柱直徑 1.3 mm（推估，≥ 1.2 mm 射出薄件）；輪拱內加 buildArchWell 環形擋板（|z| 22.9）；車轅兩側原本的軛井開口（x 27–65、|z| 3.2–21.2）iter-114 封成深色橡木板面（加縱向木條縫），只留兩條窄挽具溝（x 25–65、|z| 1.8–10.2，溝壁 4 mm 橡木內襯）（評審：缺口露出黑色內部與底盤）',
    goats: '山羊頭頸為實心 ABS 掃掠件（頸斷面約 7 × 8 mm、頭 7 × 8 → 吻 4 × 5 mm）、羊角根部直徑約 4.4 mm 往尖端收到 1.2 mm＋每 2 mm 一道環節、鬍鬚厚 1.6 mm（推估），質量 = 封閉體積 × 1.05 g/cm³；羊頭 |z| 8–21，離前導輪（|z| ≥ 35.5）遠',
    zigzag: '背板折線紋：單一條橫向鋸齒（週期 8、振幅 ±1.7、線寬 1.3 mm），不是雙折線閃電（MYTH_RESEARCH H9），自繪',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；內襯從 |z| 21.5 到殼內面',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
