// 伊什塔爾城門的穆修胡修（body-mushussu-gate，第八階段神話組・美索不達米亞）。
// iter-128（第十階段「從頭重塑」，LG1 家族 F4 暗器生物型）：整台車就是伊什塔爾城門釉磚上的蛇龍穆修胡修「低伏前竄」的姿態——
// iter-129（評審：殼面沒變、邊緣下垂像毯子、浮雕不見、尾鰭像飾品）再重塑：
// - 前 1/3：中央從 x 14 起往前壓低成一支長而低的黑藍蛇首鼻錐（夾在兩個獅肩前擋泥板之間，到吻尖 x 74 只剩 15.8 高、半寬 5.5），
//   鼻端兩側各一盞細長亮金頭燈當蛇眼，鼻頂一支往後掠的單支金刀角。
// - 斷面：平順的肩線（車尾 23 → 後臀 32.6 → 腰 30.6 → 前擋泥板 31.6，不再起伏下垂），肩下是幾乎直立的側壁，再往內收 2.4 mm 的瀝青黑裙板。
// - 側壁腰段放回 iter-127 的黃釉龍蛇獸浮雕（同位置、同大小、鱗片與黑眼）；獅爪、鷹爪立板拿掉（浮雕本身有獅足與鷹爪）。
// - 自創暗器：從後甲板中央脊線連續長出、往車尾漸升的金色鰭刀背鰭（根部沿脊線 36 mm 長，埋進殼面），刀尖往後上方勾起；不是針、鉗、牙或蠍尾毒針。
// 釉磚語彙：深青金石藍霧面釉磚殼（錯縫磚縫）、背脊中線白瓣金心玫瑰花飾帶。
// 設計：shared/design/body-mushussu-gate/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 4 節 M1–M5；黑名單 4-3、第 9 節 Dragon Jr. / Beat-Magnum；第十階段段落）。
// 剖面為本檔站位產生器（推估）。圖形全部自繪；不做立體龍頭公仔、不放龍形駕駛、不做紅龍徽章、玫瑰花飾只用圓瓣（不做放射閃電）；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner, profileZAtY } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾封口 x（蛇尾尖） */
const X_REAR = -72;
/** @type {number} 車頭（蛇吻尖）x：和 iter-127 同為 74，不再往前伸 */
const X_FRONT = 74;
/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40） */
const XS = [-72, -68, -60, -50, -40, -28, -14, 0, 14, 28, 40, 48, 54, 58, 62, 66, 70, 74];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 側壁外表面半寬：前後擋泥板 45.2、兩輪之間 45（iter-129：裙板改成內收後側壁就是最寬處；中段不收腰、x 48 起急收成細蛇頸 27 → 12，
  // 俯視 IoU 對 tortoise / halo / lowline 才降到 0.835 內），蛇頭 11.6、吻尖 5.2；車尾收成蛇尾 11
  hw: monoCurve(XS, [11, 18, 33.5, 43.6, 45.2, 45, 45, 45, 45, 45, 45.2, 27, 15, 12, 10.6, 11.6, 9, 5.2]),
  // 背脊中線：後臀最高 35.2，x 14 之後往前壓低成蛇首（x 40：25.8，吻尖 15.8）
  yT: monoCurve(XS, [25.5, 28, 32, 34.5, 35.2, 34.8, 34, 33.2, 32.4, 28.5, 25.8, 24.4, 23, 21.8, 20.8, 19.8, 18.2, 15.8]),
  // 肩線（銳利、平順）：車尾 23 → 後臀 32.6 → 腰 30.6 → 前擋泥板 31.6（R17.5 輪拱頂 30.5 之上）→ 蛇頭兩側 14.6
  yS: monoCurve(XS, [23, 25.5, 29, 31.5, 32.6, 32, 31, 30.6, 30.6, 31, 31.6, 30.6, 27, 20.4, 19.4, 18.4, 16.6, 14.6]),
  // 蛇首半寬（中央壓低的鼻錐在擋泥板之間的寬度）
  head: monoCurve([14, 28, 40, 54, 62, 74], [15, 13, 13.5, 12, 9, 4]),
  // 裙板下緣
  yLow: monoCurve(XS, [16, 15.5, 14.5, 12.5, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11.5, 12.6, 13.2, 13.2, 13, 12.8, 12.8]),
};

/** @type {number} 上層側壁往內收的量（tumblehome：肩線比側壁內 1.6） */
const TUMBLE = 1.6;
/** @type {number} 裙板往內收的量 */
const TUCK = 2.4;

/** @type {(x: number) => number} 側壁與裙板之間的折線高度（中段 16.5；鼻端跟著降低） */
const yK = (x) => Math.max(P.yLow(x) + 1.2, Math.min(16.5, P.yS(x) - 3));

/** @type {(x: number) => number} 蛇首半寬（不超過殼半寬的 0.45） */
const headW = (x) => Math.min(0.45 * P.hw(x), P.head(x));

/**
 * 半剖面 9 點：背脊 → 蛇首頂 → 蛇首側緣（前段是頭與擋泥板之間的淺溝）→ 擋泥板頂內緣 → 肩線（銳利）→ 側壁 → 側壁底折線（銳利）→ 內收裙板 → 裙板下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yT(x);
  const s = P.yS(x);
  const h = P.hw(x);
  const hu = h - TUMBLE;
  const k = yK(x);
  const lo = P.yLow(x);
  const zh = headW(x);
  const yF = s + 0.9;
  const z3 = Math.min(zh + 4, hu - 0.6);
  // 前段（中央比擋泥板低）頭側留一道淺溝；後段平滑拱面
  const yV = t < yF ? t - 0.6 : lerp(t, yF, 0.55);
  return [
    [0, t],
    [0.55 * zh, t - 0.25],
    [zh, yV],
    [z3, t < yF ? yF : lerp(t, yF, 0.85)],
    [hu, s],
    [h, lerp(s, k, 0.45)],
    [h, k],
    [h - TUCK, lerp(k, lo, 0.6)],
    [h - TUCK + 0.3, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾與車頭每 0.75–1 mm 一站，中段每 2 mm */
const STATIONS = [...buildStations(X_REAR, -62, 0.75, profile).slice(0, -1), ...buildStations(-62, 52, 2, profile).slice(0, -1), ...buildStations(52, X_FRONT, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 22.5 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 22.5 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, y: number) => number} 側壁外表面在 (x, y) 的 |z| */
const wallZ = (x, y) => profileZAtY(profile(x), y);

/** @type {(x: number, y: number, z: number) => boolean} 側壁（肩線與裙板折線之間） */
const onSideWall = (x, y, z) => y < P.yS(x) - 0.1 && y > yK(x) + 0.1 && Math.abs(z) > P.hw(x) - TUMBLE - 0.3 && x > X_REAR + 1.5 && x < X_FRONT - 1.5;

/** @type {{ x0: number, y0: number, s: number }} 龍蛇獸浮雕的位置與縮放（iter-127 原位置：腰段側壁中段，側視；腳底 y0） */
const BEAST = { x0: 0.6, y0: 13.9, s: 0.74 };

/** @type {(u: number, v: number, ax: number, ay: number, bx: number, by: number, r: number) => number} 圓頭線段（膠囊）距離 */
const capsule = (u, v, ax, ay, bx, by, r) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - ax - t * dx, v - ay - t * dy) - r;
};

/**
 * 穆修胡修側身（iter-114 照伊什塔爾城門釉磚浮雕重畫，M1 / M2）：水平細長鱗身、往前上斜的 S 形長頸、
 * 水平蛇頭＋往後的直角＋頭後捲起的冠、分岔蛇信；前足獅腿（一前一後的步態、圓掌）、後足鷹腿（粗腿、細脛、三爪）；
 * 長尾先水平往後、尾端才往上捲成蝎尾鉤刺。u 往車頭、v 往上，腳底 v = 0；未縮放時長約 34、高約 17 mm
 * @type {number[][]} [ax, ay, bx, by, r]
 */
const BEAST_SEGS = [
  // 軀幹（細長、後粗前細）
  [-8.4, 8.6, -1.0, 8.8, 2.0],
  [-1.0, 8.8, 4.6, 9.4, 1.8],
  // 長頸（往前上斜的 S 形）
  [4.6, 9.8, 7.4, 12.0, 1.45],
  [7.4, 12.0, 8.8, 13.8, 1.25],
  // 蛇頭（水平、比頸粗）＋吻
  [8.6, 14.2, 12.6, 14.0, 1.3],
  [12.6, 14.0, 14.6, 13.5, 0.8],
  // 頭上往後的直角、頭後捲起的冠
  [10.0, 15.3, 6.6, 16.6, 0.5],
  [9.0, 15.0, 7.9, 16.0, 0.42],
  [7.9, 16.0, 7.3, 15.3, 0.34],
  // 分岔蛇信
  [14.6, 13.5, 16.2, 14.0, 0.3],
  [14.6, 13.5, 16.1, 12.8, 0.3],
  // 前足（獅）：前腳往前邁、後腳垂直；圓掌
  [3.8, 8.0, 5.6, 3.6, 1.15],
  [5.6, 3.6, 6.0, 1.0, 0.75],
  [5.2, 0.75, 7.6, 0.75, 0.75],
  [2.0, 8.0, 1.4, 3.6, 1.05],
  [1.4, 3.6, 1.6, 1.0, 0.7],
  [0.8, 0.7, 3.0, 0.7, 0.7],
  // 後足（鷹）：粗腿、細脛、三爪（兩前一後）
  [-6.0, 8.2, -4.9, 4.0, 1.35],
  [-4.9, 4.0, -5.6, 1.4, 0.55],
  [-5.6, 1.2, -3.2, 0.35, 0.45],
  [-5.6, 1.2, -4.7, 0.1, 0.45],
  [-5.6, 1.2, -7.6, 0.45, 0.45],
  [-8.4, 8.0, -9.0, 4.0, 1.3],
  [-9.0, 4.0, -9.6, 1.4, 0.5],
  [-9.6, 1.2, -7.4, 0.35, 0.42],
  [-9.6, 1.2, -8.8, 0.1, 0.42],
  [-9.6, 1.2, -11.5, 0.45, 0.42],
  // 長尾：水平往後 → 尾端往上捲 → 鉤狀蝎刺
  [-10.2, 8.6, -14.0, 9.0, 1.15],
  [-14.0, 9.0, -16.6, 10.6, 0.9],
  [-16.6, 10.6, -17.4, 13.0, 0.68],
  [-17.4, 13.0, -16.6, 14.6, 0.48],
  [-16.6, 14.6, -15.4, 14.6, 0.34],
];

/** @type {(u: number, v: number) => number} 穆修胡修輪廓距離（未縮放座標） */
const beastSdRaw = (u, v) => {
  let d = Infinity;
  for (const s of BEAST_SEGS) {
    d = Math.min(d, capsule(u, v, s[0], s[1], s[2], s[3], s[4]));
  }
  return d;
};

/** @type {(x: number, y: number, z: number) => number} 穆修胡修在車殼側牆上的距離（只在腰段側牆） */
const beastAt = (x, y, z) => {
  if (Math.abs(z) < 30 || Math.abs(x) > 18) {
    return 10;
  }
  return beastSdRaw((x - BEAST.x0) / BEAST.s, (y - BEAST.y0) / BEAST.s) * BEAST.s;
};

/**
 * 玫瑰花飾（M2：白瓣金心的圓瓣花，不做放射線）：中心圓 r 0.7、8 片圓瓣 r 0.62 繞半徑 1.42（直徑約 4.1）
 * @type {(u: number, v: number) => { petal: number, core: number }}
 */
const rosetteSd = (u, v) => {
  const core = Math.hypot(u, v) - 0.7;
  let petal = Infinity;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    petal = Math.min(petal, Math.hypot(u - 1.42 * Math.cos(a), v - 1.42 * Math.sin(a)) - 0.62);
  }
  return { petal: Math.max(petal, -core - 0.22), core };
};

/**
 * 磚縫（橫向錯縫）：每層高 3.2、磚長 7，上下層錯半塊；線寬 0.6（正值 = 磚縫上）
 * @type {(a: number, y: number) => number} a = 沿牆面的水平座標
 */
const brickJoint = (a, y) => {
  const course = 3.2;
  const len = 7;
  const j = Math.floor((y - 1) / course);
  const ph = (((y - 1) % course) + course) % course;
  const dh = Math.min(ph, course - ph);
  const shift = (((j % 2) + 2) % 2) * (len / 2);
  const pa = (((a - shift) % len) + len) % len;
  const dv = Math.min(pa, len - pa);
  return 0.3 - Math.min(dh, dv);
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 深青金石藍釉磚（霧面：paint- 且 roughness > 0.5 → Blender 緞面；第十階段改深、改霧，和亮金拉開）
  lapis: namedMaterial('paint-lapis-glaze-deep', { color: 0x15346f, roughness: 0.6, clearcoat: 0.1, clearcoatRoughness: 0.5 }),
  lapis2: namedMaterial('paint-lapis-glaze-deep', { color: 0x15346f, roughness: 0.6, clearcoat: 0.1, clearcoatRoughness: 0.5, side: THREE.DoubleSide }),
  // 下層裙板：瀝青黑（霧面；新巴比倫以瀝青作砌磚灰漿，推估）
  bitumen: namedMaterial('paint-bitumen-black-matte', { color: 0x16171a, roughness: 0.72, clearcoat: 0.05 }),
  // 黃釉（爪、鰭刀刀身）
  yellow: namedMaterial('paint-yellow-glaze', { color: 0xd9a441, roughness: 0.42, clearcoat: 0.5 }),
  // 真金屬金（-brass 結尾 → Blender metallic）：蛇角、鰭刀刃緣
  gold: namedMaterial('trim-gold-brass', { color: 0xd0a94e, roughness: 0.28, metalness: 0.82, clearcoat: 0.3 }),
  // 蛇眼頭燈：琥珀色自發光（lamp- 前綴 → Blender 保留發光；V14 / L1-6 深色殼配亮色頭燈）
  // iter-129：蛇眼頭燈改成亮金色自發光（lamp- 前綴 → Blender 保留發光）
  eye: namedMaterial('lamp-mushussu-eye-gold', { color: 0xffd36a, emissive: 0xffb020, emissiveIntensity: 1.1, roughness: 0.12, clearcoat: 1.0 }),
  // iter-129：蛇首（前 1/3 中央）黑藍釉
  night: namedMaterial('paint-lapis-night', { color: 0x0b1733, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.4 }),
  // 浮雕眼睛（黑釉）
  beastEye: namedMaterial('paint-black-glaze', { color: 0x161616, roughness: 0.3, clearcoat: 0.6 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x131a26, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x122c5e, roughness: 0.55, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x14284a, roughness: 0.75, side: THREE.DoubleSide }),
  // 龍蛇獸鱗片（只比浮雕深一點的黃釉）
  scale: namedMaterial('paint-yellow-glaze-scale', { color: 0xc99335, roughness: 0.48, clearcoat: 0.3 }),
  dJoint: decalMaterial('decal-brick-joint-navy', { color: 0x0d2250, roughness: 0.6 }),
  dYellow: decalMaterial('decal-yellow-glaze', { color: 0xd9a441, roughness: 0.4 }),
  dBlack: decalMaterial('decal-black-glaze', { color: 0x1a1a1a, roughness: 0.45 }),
  dWhite: decalMaterial('decal-white-glaze', { color: 0xf2efe6, roughness: 0.4 }),
  dGold: decalMaterial('decal-gold', { color: 0xd0a94e, roughness: 0.3, metalness: 0.75 }),
  dNavy: decalMaterial('decal-gate-shadow-navy', { color: 0x0b1c3d, roughness: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 穆修胡修浮雕（實體件）：每段膠囊沿 z 壓扁成凸起 RELIEF_H 的半膠囊，中心貼在側牆外表面（內半埋進殼裡）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildBeastRelief = (sg) => {
  /** @type {number} 浮雕凸起高度（評審建議 0.6–1 mm） */
  const RELIEF_H = 0.9;
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const [ax, ay, bx, by, r0] of BEAST_SEGS) {
    const r = r0 * BEAST.s;
    const x0 = BEAST.x0 + ax * BEAST.s;
    const y0 = BEAST.y0 + ay * BEAST.s;
    const x1 = BEAST.x0 + bx * BEAST.s;
    const y1 = BEAST.y0 + by * BEAST.s;
    const len = Math.hypot(x1 - x0, y1 - y0);
    // iter-121：低分段（cap 3、徑向 10；原本 4 × 14）
    const g = new THREE.CapsuleGeometry(r, len, 3, 10);
    // 膠囊預設沿 y 軸 → 轉到線段方向
    g.rotateZ(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2);
    g.scale(1, 1, Math.min(1, RELIEF_H / r));
    const xm = (x0 + x1) / 2;
    const ym = (y0 + y1) / 2;
    g.translate(xm, ym, sg * (wallZ(xm, ym) - 0.05));
    geos.push(g);
  }
  return mergeGeos(geos);
};

/**
 * 穆修胡修的鱗片（iter-115 評審「做回有鱗片」）：在浮雕軀幹、長頸、尾根（膠囊半徑 ≥ 0.9）的表面排一層小圓鱗（扁球，凸出約 0.25 mm），
 * 沿每段每 0.9 mm 一列、上下兩排錯開，像釉磚浮雕上刻出的鱗紋
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildBeastScales = (sg) => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  /** @type {number} 浮雕外表面離牆面的高度（同 buildBeastRelief 的 RELIEF_H − 0.05） */
  const top = 0.85;
  for (const [ax, ay, bx, by, r0] of BEAST_SEGS) {
    if (r0 < 0.9) {
      continue;
    }
    const x0 = BEAST.x0 + ax * BEAST.s;
    const y0 = BEAST.y0 + ay * BEAST.s;
    const x1 = BEAST.x0 + bx * BEAST.s;
    const y1 = BEAST.y0 + by * BEAST.s;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const r = r0 * BEAST.s;
    const n = Math.max(1, Math.floor(len / 0.9));
    for (let i = 0; i <= n; i++) {
      const q = i / n;
      for (const off of r > 1.1 ? [-0.42, 0.42] : [0]) {
        const o = off * r + (i % 2 === 0 ? 0 : 0.12 * r);
        const x = lerp(x0, x1, q) + nx * o;
        const y = lerp(y0, y1, q) + ny * o;
        // iter-121：低分段（6 × 4；原本 8 × 6）
        const g = new THREE.SphereGeometry(0.36, 6, 4);
        g.scale(1, 1, 0.55);
        g.translate(x, y, sg * (wallZ(x, y) + top - 0.05));
        geos.push(g);
      }
    }
  }
  return mergeGeos(geos);
};


/**
 * 鼻頂單支刀角（中線立板，厚 1.2）：根部沿蛇首頂面 x 67 → 52 埋進殼面，刀身往後上掠，刀尖 x 39、比頭頂高 7.2
 * @type {() => THREE.BufferGeometry}
 */
const buildBladeHorn = () =>
  finPlate(
    [
      [67, P.yT(67) - 0.7],
      [63, P.yT(63) + 1.6],
      [55, P.yT(55) + 4.2],
      [46, P.yT(46) + 6.4],
      [39, P.yT(39) + 7.2],
      [45, P.yT(45) + 3.6],
      [52, P.yT(52) + 0.6],
      [52, P.yT(52) - 0.7],
    ],
    0,
    1.2,
  );

/**
 * 自創暗器「脊線鰭刀」外形（中線立板）：從後甲板脊線 x −30 起和殼面一起長出、往車尾漸升，刀尖往後上方勾起；
 * 底緣沿脊線埋進殼面 0.7 mm，不是立在甲板上的飾品
 * @type {(inset: number) => number[][]} inset：往內縮的量（金刃 0、黃釉刀身 1.1）
 */
const finOutline = (inset) => {
  /** @type {number[][]} */
  const top = [];
  /** @type {number[][]} */
  const bot = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = lerp(-30, -71, u);
    // 鰭高：從 0 平順長到車尾的 9.5，再加刀尖勾起
    const hgt = 9.5 * u ** 1.6 - inset;
    top.push([x, P.yT(x) + Math.max(0.15, hgt)]);
    bot.push([x, P.yT(x) - 0.7]);
  }
  // 刀尖：往後上方勾起（x −76、比尾端脊線高 13）
  top.push([-76 + inset, P.yT(-71) + 13 - inset * 1.5]);
  top.push([-73.5 + inset * 0.5, P.yT(-72) + 6]);
  return [...top, ...bot.reverse()];
};

export const mushussuGateBody = makePolyBody({
  id: 'body-mushussu-gate',
  name: '伊什塔爾城門的穆修胡修',
  style: 'myth',
  phase: 8,
  mythSeries: 'mesopotamian',
  mythTheme: 'mushussu',
  form: 'serpent-crouch',
  roof: 'closed',
  wing: 'fin-blade-tail',
  theme: '伊什塔爾城門的蛇龍低伏前竄：兩個獅肩前擋泥板之間往前壓低成長而低的黑藍蛇首鼻錐（鼻端兩側亮金細長眼燈、鼻頂往後掠的單支金刀角），平順肩線＋直立側壁＋內收瀝青黑裙板，側壁腰段黃釉龍蛇獸浮雕，從後甲板脊線長出、往車尾漸升的金色鰭刀背鰭',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 肩線、側壁底折線是銳利稜線
  hard: [4, 6],
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    // 內收裙板：瀝青黑
    { mat: 'bitumen', keep: (x, y) => yK(x) - 0.3 - y },
    // 蛇首（x 16 起中央壓低的鼻錐）：黑藍；後緣做成往後指的箭形（中線 x 16、兩側 x 30），不是一條橫切的直線（iter-129：光柵圖上像一塊方塊）
    { mat: 'night', keep: (x, y, z) => Math.min(x - 16 - (14 * Math.abs(z)) / (headW(x) + 1.2), headW(x) + 1.2 - Math.abs(z), y - P.yS(x) + 0.8) },
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'lapis2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });
    // 輪拱拱框：側壁上一道黃釉細框（城門拱的釉磚邊框）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z)) {
          return -1;
        }
        const d = archDist(x, y);
        return Math.min(d - 0.3, 1.4 - d);
      }),
      mat: 'dYellow',
      name: 'decal-arch-band',
    });
    // 肩線下黃釉細邊（貫穿全車的速度線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || archDist(x, y) < 0.3 || x > 70) {
          return -1;
        }
        const dy = P.yS(x) - y;
        return Math.min(dy - 0.5, 1.4 - dy);
      }),
      mat: 'dYellow',
      name: 'decal-shoulder-pinstripe',
    });
    // 側壁錯縫磚縫（避開拱框、浮雕）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSideWall(x, y, z) || y > P.yS(x) - 1.9 || archDist(x, y) < 2 || x > 56 || beastAt(x, y, z) < 1.2) {
          return -1;
        }
        return brickJoint(x, y);
      }),
      mat: 'dJoint',
      name: 'decal-brick-joints',
    });
    // 龍蛇獸：牆上黑色描邊＋黃釉浮雕實體件＋鱗片＋黑眼（iter-127 原樣放回）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const d = beastAt(x, y, z);
        return Math.min(0.55 - d, d + 0.1);
      }),
      mat: 'dBlack',
      name: 'decal-mushussu-outline',
    });
    parts.push({ geometry: mergeGeos([buildBeastRelief(1), buildBeastRelief(-1)]), mat: 'yellow', solid: true, outline: true, name: 'mushussu-relief' });
    parts.push({ geometry: mergeGeos([buildBeastScales(1), buildBeastScales(-1)]), mat: 'scale', solid: true, name: 'mushussu-scales' });
    {
      const ex = BEAST.x0 + 11.4 * BEAST.s;
      const ey = BEAST.y0 + 14.5 * BEAST.s;
      /** @type {THREE.BufferGeometry[]} */
      const eyes = [];
      for (const sg of [-1, 1]) {
        const e = new THREE.SphereGeometry(0.4, 12, 8);
        e.scale(1, 1, 0.8);
        e.translate(ex, ey, sg * (wallZ(ex, ey) + 0.85));
        eyes.push(e);
      }
      parts.push({ geometry: mergeGeos(eyes), mat: 'beastEye', solid: true, name: 'mushussu-relief-eyes' });
    }
    // 背脊中線的玫瑰花飾帶（脊線鰭刀之前、蛇首之後：x −28 → 14）
    /** @type {(x: number, y: number) => boolean} */
    const onStripe = (x, y) => y > P.yS(x) + 0.5 && x > -28 && x < 14;
    parts.push({ geometry: kit.decal((x, y, z) => (onStripe(x, y) ? 3.3 - Math.abs(z) : -1)), mat: 'dNavy', name: 'decal-rosette-stripe-base' });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y) ? Math.min(Math.abs(z) - 3.3, 4.5 - Math.abs(z)) : -1)),
      mat: 'dYellow',
      name: 'decal-rosette-stripe-borders',
    });
    /** @type {number} 花飾間距 */
    const ROS_STEP = 6.2;
    /** @type {(x: number, z: number) => { petal: number, core: number }} 最近的一朵玫瑰花飾 */
    const nearestRosette = (x, z) => {
      const xc = Math.min(12.4, Math.max(-24.8, Math.round(x / ROS_STEP) * ROS_STEP));
      return rosetteSd(x - xc, z);
    };
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y) ? -nearestRosette(x, z).petal : -1), { offset: 0.12 }),
      mat: 'dWhite',
      name: 'decal-rosette-petals',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y) ? -nearestRosette(x, z).core : -1), { offset: 0.14 }),
      mat: 'dGold',
      name: 'decal-rosette-cores',
    });
    // 蛇首兩側的金色細邊（頭與擋泥板之間的淺溝旁）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x < 18 || x > 72) {
          return -1;
        }
        return 0.45 - Math.abs(Math.abs(z) - headW(x) - 0.4);
      }, { offset: 0.12 }),
      mat: 'dGold',
      name: 'decal-head-gold-edge',
    });
    // 蛇眼頭燈（實體件）：鼻端兩側的細長亮金眼燈，往後上挑，半埋進殼面
    {
      /** @type {THREE.BufferGeometry[]} */
      const eyes = [];
      for (const sg of [-1, 1]) {
        const ex = 66.5;
        const ey = P.yS(ex) - 0.9;
        const ez = P.hw(ex) - 0.5;
        const g = new THREE.SphereGeometry(1, 14, 8);
        g.scale(3.6, 0.75, 0.9);
        g.rotateZ(-0.2);
        g.rotateY(sg * 0.3);
        g.translate(ex, ey, sg * ez);
        eyes.push(g);
      }
      parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, name: 'mushussu-eye-lamps' });
    }
    // 鼻頂單支刀角
    parts.push({ geometry: buildBladeHorn(), mat: 'gold', solid: true, outline: true, name: 'blade-horn' });
    // 自創暗器：脊線鰭刀（金刃＋黃釉刀身）
    parts.push({ geometry: finPlate(finOutline(0), 0, 1.0), mat: 'gold', solid: true, outline: true, name: 'spine-fin-blade-edge' });
    parts.push({ geometry: finPlate(finOutline(1.1), 0, 1.6), mat: 'yellow', solid: true, name: 'spine-fin-blade-core' });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry:
      '本檔站位產生器 P（推估，iter-129 再重塑）：殼 x −72 → 74（吻尖不超過 iter-127）；側壁半寬 擋泥板 45.2、兩輪之間 45、x 48 起急收成蛇頸（27 → 12）、蛇頭 11.6、吻尖 5.2、蛇尾 11（外框半寬 ≤ 48.0）；背脊 後臀 35.2、x 14 起往前壓低成蛇首（x 40：25.8、吻尖 15.8），蛇首半寬 13–15；肩線 23 → 32.6 → 30.6 → 31.6（R17.5 輪拱頂 30.5 之上）；肩線內收 1.6、側壁底折線 16.5、裙板內收 2.4、下緣 10.5',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    horn: '鼻頂刀角：厚 1.2 mm 中線立板，根部沿蛇首頂面 x 52–67 埋進殼面 0.7 mm，刀尖 x 39、比頭頂高 7.2（推估）',
    relief: '龍蛇獸浮雕：iter-127 原樣（32 段膠囊沿牆面法向壓扁成凸起 0.9 mm 的半膠囊實體件，縮放 0.74 → 長約 25、高約 12.6 mm；鱗片 R0.36 扁球）',
    spineFin: '脊線鰭刀：金刃厚 1.0、黃釉刀身厚 1.6 mm 的中線立板，底緣沿脊線 x −30 → −71 埋進殼面 0.7 mm，高度從 0 平順長到 9.5、刀尖勾到 x −76（推估）',
    myth: '穆修胡修的長頸蛇首、頭上的角、前獅足後鷹爪、長尾（MYTH_RESEARCH M1）；伊什塔爾城門青金石藍釉磚、黃釉、白瓣金心玫瑰花飾（M2、M3）。脊線鰭刀為自創暗器（不是蠍尾毒針）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
