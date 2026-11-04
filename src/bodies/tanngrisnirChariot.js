// 索爾的山羊戰車（body-tanngrisnir-chariot，第八階段神話組・北歐）：《散文埃達》中索爾乘坐、由兩頭公山羊 Tanngrisnir 與 Tanngnjóstr 拉的戰車。
// iter-120（第九階段「炫砲化＋LG1 低風阻車身」）：整台改成 LG1 風格的楔形全罩——車頭 18 往後一路升到座艙後 34.6 的連續斜面引擎蓋（原本是低平車轅甲板＋挽具溝＋中央車轅），
// 前後輪上方是獨立隆起的擋泥板（輪上 32.3）、兩輪之間收腰（邊沿 27.6、半寬 31），俯視前窄（35.4）後寬（37.5）；
// 兩頭山羊從前擋泥板頂長出、低頭往前下伸成左右兩支衝角鼻（吻尖 x 79.5，像正在拉車往前衝），羊角沿擋泥板往後掃成貼身導流角（頂 35.8，原本 47.5），琥珀發光羊眼；
// 車斗收成只留 24 × 18 mm 小開口的有蓋低座艙，原本兩側高護欄＋立柱改成座艙後一支低矮後傾的 U 形鍛鐵防滾架（頂 40.2）；側面一條從車頭往後上升的暗紅＋青銅折線賽車條。
// 沿用：橡木＋鍛鐵邊沿＋青銅鉚釘的材質分區、側面 10 輻戰車木輪浮雕（縮小）、車尾青銅折線紋、輪拱內襯與環形擋板。
// 歷史：iter-114 軛井封成窄挽具溝；iter-115 車斗加蓋板、角改後掃；iter-116 開放座艙＋弧形護欄＋車尾斜面。
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

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −63.5、引擎蓋前緣 60（iter-120：原本 64，車頭前方讓給兩支羊頭衝角） */
const XS = [-63.5, -62, -58, -54, -50, -40, -20, 0, 18, 24, 30, 36, 44, 50, 55, 58.5, 60];
/** @type {number[]} 俯視半寬的站位（兩輪之間多兩個腰身控制點） */
const XS_HW = [-63.5, -62, -58, -54, -50, -40, -26, -16, 0, 16, 26, 36, 44, 50, 55, 58.5, 60];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 車斗邊沿 / 擋泥板頂面高度（iter-120 第九階段：LG1 楔形）：前後輪上方維持 32.3 的獨立擋泥板隆起（31 mm 輪拱頂 30.5 之上），
  // 兩輪之間降到 27.6 成腰線（側視讀得出前後兩個擋泥板量體＋收腰，V1 / L1-2）；車頭擋泥板往前斜降到 23，車尾收成 28.6 的平尾（原本斜降到 21）
  yR: monoCurve(XS, [28.6, 29, 30.5, 32, 32.4, 32.4, 28.6, 27.6, 28.2, 29, 31, 32.3, 32.3, 31, 28, 25, 23]),
  // 中央（|z| < 18）高度：iter-120 改成從車頭 18 一路往後升的連續斜面引擎蓋（車頭到座艙沒有垂直面，V3），座艙後方最高 34.6，
  // 車尾最後 4 mm 從 31.2 微微上翹到 31.8（鴨尾）；原本 x 30 前是低平的車轅甲板＋挽具溝、車斗段拱起到 36.6
  yA: monoCurve(XS, [31.8, 31.2, 31.2, 32, 33, 34.4, 34.6, 33.6, 31.6, 30.4, 29, 27.6, 25.6, 23.5, 21.5, 19.5, 18]),
  // 俯視半寬（iter-120b：改成「前寬後窄」的戰車平面，和前窄後寬的 yaga-hut 拉開俯視輪廓）：前擋泥板（羊的肩、拉車的前端）最寬 38，
  // 兩輪之間 33.5，後輪上方收到 29（後輪胎外側露出，像戰車的外露車輪）、車斗往後收成 25 的窄尾；車頭收到 30.5
  hw: monoCurve(XS_HW, [25, 25.8, 27.2, 28, 28.5, 29, 31.5, 33, 33.5, 34, 36.5, 38, 38, 37.4, 35.5, 33, 30.5]),
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
const STATIONS = [...buildStations(-63.5, -50, 0.75, profile).slice(0, -1), ...buildStations(-50, 54, 2, profile).slice(0, -1), ...buildStations(54, 60, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];

/** @type {{ x0: number, x1: number, hz: number, r: number }} 戰車座艙（iter-120 收成有蓋低座艙：44 × 25 → 24 × 18 mm 的小開口，後方一支低矮後傾防滾架） */
const SEAT = { x0: -30, x1: -6, hz: 9, r: 4 };

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
  // iter-120b：羊角由象牙白改成深灰褐（白色長條被讀成獠牙 / 叉子；山羊角是帶節環的灰褐角質）
  horn: namedMaterial('paint-horn-greybrown', { color: 0x6e5d48, roughness: 0.5, clearcoat: 0.25 }),
  beard: namedMaterial('paint-goat-beard-grey', { color: 0x9d988e, roughness: 0.72 }),
  // iter-120：羊眼改成琥珀色自發光（炫砲手法 5），lamp- 前綴 → Blender 保留發光
  eye: namedMaterial('lamp-goat-eye-amber', { color: 0xffb340, emissive: 0xff8a00, emissiveIntensity: 0.6, roughness: 0.15, clearcoat: 1.0 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-oak', { color: 0x4a3020, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-iron', { color: 0x2e3034, roughness: 0.7, side: THREE.DoubleSide }),
  // iter-120 側面賽車條紋：暗紅底帶＋青銅折線
  dRed: decalMaterial('decal-oxblood-stripe', { color: 0x7a2018, roughness: 0.55, clearcoat: 0.15 }),
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

/** @type {number} 羊頭中心 |z|（iter-120：從車轅兩側 14.5 移到左右前擋泥板頂上，擋泥板＝羊的肩） */
const GOAT_Z = 28.5;

/**
 * 山羊角斷面（iter-120b）：根粗尖細＋沿角 6 道節環（山羊角的橫稜；24 段掃掠、每道環 4 段看得出起伏），6 邊斷面
 * @type {(t: number) => number[]}
 */
const hornRad = (t) => {
  const ridge = 1 + 0.14 * Math.cos(2 * Math.PI * 6 * t);
  const r = lerp(1.75, 0.6, t ** 0.9) * ridge;
  return [r * 1.05, r * 0.95];
};

/**
 * 山羊角中心線（iter-120b，主 agent 看圖：原本沿擋泥板的兩對長直角讀成叉子 / 獠牙）：從頭頂往上長出、往後彎成一道彎刀弧，
 * 尖端往下收向擋泥板（頂約 39，仍貼近車身）；兩支角一支往外張、一支往內收
 * @type {(sg: number, zBase: number, spread: number) => number[][]} spread：往外張的方向（+1 = 遠離羊頭中心）
 */
const hornPath = (sg, zBase, spread) => {
  const z = (dz) => sg * (zBase + spread * dz);
  return [
    [63.2, 33.2, z(0)],
    [61.4, 36.2, z(0.25)],
    [58.4, 38.2, z(0.6)],
    [54.6, 38.4, z(1)],
    [51.4, 37, z(1.35)],
    [49.6, 34.8, z(1.6)],
  ];
};

/**
 * 一頭山羊（iter-120b 重做頭部量體）：短頸從前擋泥板頂長出 → 明顯的頭骨（額頭）→ 往前下收的吻部 → 鼻頭，下巴一撮短鬍鬚，
 * 兩耳往後側貼、兩支節環彎角從頭頂往後掃；琥珀發光眼。整顆頭往前下伸（低頭拉車往前衝），仍貼在擋泥板上當衝角鼻
 * @type {(sg: number) => { head: THREE.BufferGeometry, horns: THREE.BufferGeometry, eyes: THREE.BufferGeometry, beard: THREE.BufferGeometry }}
 */
const buildGoat = (sg) => {
  const zc = sg * GOAT_Z;
  /** @type {(r: number[], c: number[], rot: number) => THREE.BufferGeometry} 橢球（16 × 10 段） */
  const ellipsoid = (r, c, rot) => {
    const g = new THREE.SphereGeometry(1, 16, 10);
    g.scale(r[0], r[1], r[2]);
    g.rotateZ(rot);
    g.translate(c[0], c[1], c[2] ?? zc);
    return g;
  };
  // 短頸：根部埋進擋泥板頂
  const neck = sweepEllipse(
    [
      [45, 31.6, zc],
      [51, 32.4, zc],
      [57, 32, zc],
    ],
    8,
    (t) => [lerp(3.4, 3.2, t), lerp(3.0, 3.3, t)],
    8,
  );
  // 頭骨（額頭）：頭部最大的量體，寬 7.6、高 7.2
  const skull = ellipsoid([5.2, 3.6, 3.8], [62.4, 30.6], -0.3);
  // 吻部：往前下收窄
  const muzzle = ellipsoid([5, 2.4, 2.6], [68.8, 26.6], -0.5);
  // 鼻頭
  const nose = ellipsoid([1.9, 1.7, 2.1], [73.4, 23.7], -0.5);
  // 兩耳：往後側貼的扁葉片（被風壓向後）
  /** @type {THREE.BufferGeometry[]} */
  const ears = [];
  for (const side of [1, -1]) {
    const ear = ellipsoid([2.4, 0.65, 1.2], [59.2, 32.4, zc + side * 3.9], 0.3);
    ears.push(ear);
  }
  const horns = [
    sweepEllipse(hornPath(sg, GOAT_Z + 1.4, 1), 24, hornRad, 6),
    sweepEllipse(hornPath(sg, GOAT_Z - 1.4, -1), 24, hornRad, 6),
  ];
  // 短山羊鬍：下巴往下、略往後的尖楔（厚 1.6，側視 4.5 mm 長）
  const beard = finPlate(
    [
      [69.6, 25.2],
      [66.2, 25.6],
      [66.4, 21.4],
      [68.2, 23.2],
    ],
    zc,
    1.6,
  );
  const eyes = [1, -1].map((side) => ellipsoid([1.2, 0.6, 0.6], [64.6, 31.0, zc + side * 3.25], -0.35));
  return { head: mergeGeos([neck, skull, muzzle, nose, ...ears]), horns: mergeGeos(horns), eyes: mergeGeos(eyes), beard };
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

/** @type {{ x: number, y: number, r: number, spokes: number }} 側面戰車大木輪浮雕（iter-116；iter-120 配合收腰縮小 r 7.6 → 5.2）：兩輪之間的側板中央，10 根輻條（不做四輻十字輪） */
const RELIEF_WHEEL = { x: 0, y: 20.6, r: 5.2, spokes: 10 };

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
  const spokeD = Math.max(r * Math.abs(Math.sin(da)) - 0.34, 1.0 - r, r - (W.r - 1.9));
  return {
    disc: r - W.r,
    tire: Math.abs(r - (W.r - 0.55)) - 0.55,
    felloe: Math.abs(r - (W.r - 1.6)) - 0.55,
    spoke: spokeD,
    hub: r - 1.4,
  };
};

/**
 * 蓋板在 (x, |z|) 的表面高度（剖面第 0、1 點之間線性內插；|z| ≤ Z_FENDER − 4）
 * @type {(x: number, az: number) => number}
 */
const deckYAt = (x, az) => {
  const yR = P.yR(x);
  const yA = P.yA(x);
  const c = yA - yR;
  if (c <= 0) {
    return yA;
  }
  return lerp(yA, yR + 0.55 * c, Math.min(1, az / (Z_FENDER - 4)));
};

/** @type {number} 防滾架腳的 x（座艙後緣之後） */
const ROLL_X = -32;
/** @type {number} 防滾架腳的 |z| */
const ROLL_Z = 11;

/**
 * 低矮後傾的 U 形防滾架（iter-120，取代原本座艙兩側高 8 mm 的弧形護欄＋立柱）：兩腳埋進蓋板（x −32、|z| 11），
 * 往後上方傾到 x −37.5、頂高 39.4（只比蓋板高約 5 mm），斷面 2 × 1.8 mm 的鍛鐵管
 * @type {() => THREE.BufferGeometry}
 */
const buildRollBar = () => {
  const yb = deckYAt(ROLL_X, ROLL_Z) - 0.8;
  return sweepEllipse(
    [
      [ROLL_X, yb, -ROLL_Z],
      [ROLL_X - 3.2, 37.6, -ROLL_Z + 0.6],
      [ROLL_X - 5.2, 39.1, -6],
      [ROLL_X - 5.6, 39.4, 0],
      [ROLL_X - 5.2, 39.1, 6],
      [ROLL_X - 3.2, 37.6, ROLL_Z - 0.6],
      [ROLL_X, yb, ROLL_Z],
    ],
    24,
    () => [1.0, 0.9],
    6,
  );
};

/**
 * 側面賽車條紋的中心高度（iter-120）：從車頭 x 66 的 y 19.5（條紋實際從 x 60 擋泥板前端起畫）一路往後上升到車尾 x −62 的 y 26（前低後高的速度線，貫穿兩個擋泥板與收腰）
 * @type {(x: number) => number}
 */
const stripeY = (x) => lerp(26, 19.5, (x + 62) / 128);

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
  theme: '索爾的山羊戰車：LG1 楔形全罩——車頭往後連續升起的橡木斜面引擎蓋、前後獨立隆起的鍛鐵邊沿擋泥板與收腰、有蓋低座艙＋後傾鍛鐵防滾架，兩頭山羊從前擋泥板低頭前伸成左右衝角鼻（琥珀發光眼、青銅頸環），羊角沿擋泥板後掃成導流角，側面暗紅＋青銅折線賽車條與 10 輻戰車輪浮雕',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 車轅甲板邊、擋泥板頂內緣、頂外緣是銳利稜線
  hard: [1, 3, 4],
  wheelArches: ARCHES,
  recesses: [DECK],
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
    parts.push({ geometry: mergeGeos(goats.map((g) => g.eyes)), mat: 'eye', solid: true, name: 'goat-eyes' });
    parts.push({ geometry: mergeGeos(goats.map((g) => g.beard)), mat: 'beard', solid: true, outline: true, name: 'goat-beards' });
    // 頸圈（挽具）：每頭山羊頸部一圈青銅頸環（iter-120 跟著羊頭移到擋泥板上，6 × 16 段）
    /** @type {THREE.BufferGeometry[]} */
    const collars = [];
    for (const sg of [-1, 1]) {
      const g = new THREE.TorusGeometry(3.5, 0.7, 6, 16);
      g.scale(1, 1.05, 1);
      g.lookAt(new THREE.Vector3(6, 1.6, 0).normalize());
      g.translate(48, 32.1, sg * GOAT_Z);
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
    // 座艙後方低矮後傾的 U 形防滾架（iter-120，取代弧形護欄＋立柱）
    parts.push({ geometry: buildRollBar(), mat: 'iron', solid: true, outline: true, name: 'roll-bar' });
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
    // 側面賽車條紋（iter-120，炫砲手法 4）：從羊鼻下方的擋泥板前端往後上升、貫穿前後擋泥板與收腰到車尾的暗紅帶（寬 3.2 mm），
    // 帶中一條青銅折線（自繪單一鋸齒，不是雙折線閃電），戰車輪浮雕範圍內斷開
    /** @type {(x: number, y: number, z: number) => boolean} 條紋可畫的範圍：側板、浮雕輪外 */
    const stripeOk = (x, y, z) => onSide(x, z) && x < 60 && x > -62 && reliefWheelSd(x, y).disc > 0.7;
    parts.push({
      geometry: kit.decal((x, y, z) => (stripeOk(x, y, z) ? 1.6 - Math.abs(y - stripeY(x)) : -1), { offset: 0.12 }),
      mat: 'dRed',
      name: 'decal-side-stripe',
    });
    const zigSide = zigzagDist(0, 0.8, 5);
    parts.push({
      geometry: kit.decal((x, y, z) => (stripeOk(x, y, z) ? 0.36 - zigSide(x, y - stripeY(x)) : -1), { offset: 0.2 }),
      mat: 'dBronze',
      name: 'decal-side-zigzag',
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
    geometry: '本檔站位產生器 P（推估）：iter-120 車殼 x −63.5 ~ 60、羊頭衝角鼻到 79.5（長 143）；引擎蓋中線從車頭 18 升到座艙後 34.6、車尾 31.8；擋泥板邊沿輪上 32.3（31 mm 輪拱頂 30.5 之上）、兩輪之間 27.6；半寬前輪 35.4、後輪 37.5（仍蓋住 31 mm 輪胎外側面 34.75）、收腰 31；車殼頂高 40.2（防滾架），頂高 / 長度 0.28（HOMAGE_RESEARCH V17：0.22–0.38）',
    cockpit: 'iter-120：座艙開口 x −30 ~ −6、|z| ≤ 9（深 4 mm，推估），原本 44 × 25 mm 開放座艙＋兩側弧形護欄拿掉；後傾 U 形防滾架斷面 2.0 × 1.8 mm 鍛鐵管（≥ 1.2 mm 射出薄件，推估），腳埋進蓋板 x −32、頂 x −37.6 / y 40.2；車轅、挽具溝（openings）與溝壁內襯全部拿掉，車頭封成連續斜面；輪拱內 buildArchWell 環形擋板（|z| 22.9）沿用',
    goats: 'iter-120：山羊頭頸為一條實心 ABS 掃掠件（根部斷面 8.4 × 6.4 mm → 吻 5.2 × 3.8 mm，24 × 6 段），根部埋進前擋泥板頂（x 44.5、|z| 28.5），吻尖 x 79.5、y 22；羊角根直徑 3.4 → 尖端 1.26 mm（24 × 6 段，頂 35.8）；質量 = 封閉體積 × 1.05 g/cm³（推估）；羊頭 |z| 24.3–32.7，body-check 導輪間隙 5.24 mm',
    zigzag: '車尾折線紋：單一條橫向鋸齒（週期 7、振幅 ±1.4、線寬 1.2 mm）；iter-120 側面賽車條：暗紅帶寬 3.2 mm、帶中青銅單一鋸齒（週期 5、振幅 ±0.8、線寬 0.72 mm），不是雙折線閃電（MYTH_RESEARCH H9），自繪',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；內襯從 |z| 21.5 到殼內面',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
