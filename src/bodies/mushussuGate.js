// 伊什塔爾城門的穆修胡修（body-mushussu-gate，第八階段神話組・美索不達米亞）。
// iter-128（第十階段「從頭重塑」，LG1 家族 F4 暗器生物型）：整台車就是伊什塔爾城門釉磚上的蛇龍穆修胡修「低伏前竄」的姿態——
// 鼻錐是貼地前伸的蛇首（頸部收窄、頭骨微鼓、琥珀發光蛇眼當頭燈），頭上一對直角往後掃過前擋泥板當前分流片（被風壓平、正在往後飛揚）；
// 前輪上方是壓低的獅肩擋泥板、後輪上方是高高拱起的鷹腿後臀（前低後高 = 蹲伏要撲出去），兩輪之間只微收（44 → 41.5，蛇身）；
// 側面一道肩線＋上層側壁往內收（tumblehome）＋腰線外凸的平台＋下層瀝青黑裙板，側視分成上下兩層量體（評審「厚平板」的解法）；
// 下層裙板上，前輪後方是獅爪（3 支圓弧短爪）、後輪後方是鷹爪（3 前 1 後的鉤爪），都往後伸，像正在邁步；
// 自創暗器：蛇尾末端往上後方揚起的一片「鰭刀」尾翼（金色刃緣＋黃釉刀身，彎月形，不是針、鉗、牙或蠍尾毒針）。
// 釉磚語彙：深青金石藍霧面釉磚殼（錯縫磚縫）、背脊中線白瓣金心玫瑰花飾帶、腰線黃釉細邊、頭頂黃釉蛇首紋。
// 設計：shared/design/body-mushussu-gate/DESIGN.md（典故與文物對應 MYTH_RESEARCH 第 4 節 M1–M5；黑名單 4-3、第 9 節 Dragon Jr. / Beat-Magnum；第十階段段落）。
// 剖面為本檔站位產生器（推估）。圖形全部自繪；不做立體龍頭公仔、不放龍形駕駛、不做紅龍徽章、玫瑰花飾只用圓瓣（不做放射閃電）；不含任何文字。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
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
  // 腰線（上下兩層的分界、側視最寬處）的半寬：前後擋泥板 44、兩輪之間 41.5（俯視 IoU：比收腰版低，見 DESIGN 第十階段），
  // 前擋泥板之後急收成細長蛇頸（x 58 半寬 14、x 62 半寬 11.4）再微鼓成蛇頭骨（x 66 半寬 12.4）→ 吻尖 5.5；車尾收成細長蛇尾（11）
  hw: monoCurve(XS, [11, 18, 33, 42.5, 44, 43, 42, 41.5, 42, 43, 44, 34, 21, 14, 11.4, 12.4, 9.5, 5.5]),
  // 背脊中線：前低後高的蹲伏姿態——前擋泥板 31.8、後臀最高 35.0（x −40），往車尾降成蛇尾 25.5；
  // 車頭從獅肩往前下斜成蛇頸（x 62：19.6）、頭骨微隆（x 66：20.6）、吻尖 15.6（LG1 低尖鼻 V3）
  yTop: monoCurve(XS, [25.5, 28, 31.8, 34.3, 35, 34.7, 34.1, 33.4, 32.8, 32.4, 31.8, 29.5, 26, 22, 19.6, 20.6, 18.6, 15.6]),
  // 肩線（頂面與上層側壁的交界，銳利）：前輪上 31.2、腰 28.2、後輪上 32.7（R17.5 輪拱頂 30.5 之上）
  yS: monoCurve(XS, [23.5, 26, 29.5, 32.1, 32.7, 31.3, 29.2, 28.2, 28.6, 30, 31.2, 28.2, 24.4, 20.6, 18.4, 19.2, 17.4, 14.8]),
  // 腰線（上層側壁底、外凸平台）：約 20–22，車頭降到 13.8
  yC: monoCurve(XS, [19.5, 19.5, 21, 22, 22, 21.5, 20.8, 20.4, 20.6, 21, 21.2, 20.4, 18.6, 16.8, 15.8, 16, 15, 13.8]),
  // 下層裙板下緣（腰段 10.5，loft 自動讓開底盤側框）
  yLow: monoCurve(XS, [16, 15.5, 14.5, 12.5, 10.6, 10.5, 10.5, 10.5, 10.5, 10.5, 10.6, 11.5, 12.6, 13.2, 13.2, 13, 12.8, 12.8]),
};

/** @type {(h: number) => number} 上層側壁往內收的量（tumblehome；肩線比腰線內縮，最多 2.6 mm） */
const tumble = (h) => Math.min(2.6, 0.2 * h);
/** @type {(h: number) => number} 腰線平台往外凸的量（下層裙板比上層側壁外 1.2 mm） */
const ledge = (h) => Math.min(1.2, 0.09 * h);

/**
 * 半剖面 9 點：背脊中線 → 微圓的頂面 → 肩線（銳利）→ 往外下斜的上層側壁（tumblehome）→ 腰線（銳利）→ 外凸平台（銳利）→ 直立的下層裙板 → 裙板下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const t = P.yTop(x);
  const s = P.yS(x);
  const c = P.yC(x);
  const lo = P.yLow(x);
  const h = P.hw(x);
  const hu = h - tumble(h);
  const e = h + ledge(h);
  const d = t - s;
  return [
    [0, t],
    [0.33 * hu, t - 0.12 * d],
    [0.66 * hu, t - 0.45 * d],
    [hu, s],
    [h - 0.35 * tumble(h), lerp(s, c, 0.62)],
    [h, c],
    [e, c - 0.5],
    [e, lerp(c - 0.5, lo, 0.5)],
    [e + 0.3, lo],
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

/** @type {(x: number) => number} 下層裙板外表面 |z| */
const skirtZ = (x) => P.hw(x) + ledge(P.hw(x));

/** @type {(x: number, y: number, z: number) => boolean} 上層側壁（肩線與腰線之間） */
const onUpperWall = (x, y, z) => y < P.yS(x) - 0.1 && y > P.yC(x) + 0.1 && Math.abs(z) > P.hw(x) - tumble(P.hw(x)) - 0.3 && x > X_REAR + 1.5 && x < X_FRONT - 1.5;

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
  eye: namedMaterial('lamp-mushussu-eye-amber', { color: 0xffc04a, emissive: 0xff9a10, emissiveIntensity: 0.9, roughness: 0.15, clearcoat: 1.0 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x131a26, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-lapis', { color: 0x122c5e, roughness: 0.55, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-navy', { color: 0x14284a, roughness: 0.75, side: THREE.DoubleSide }),
  dJoint: decalMaterial('decal-brick-joint-navy', { color: 0x0d2250, roughness: 0.6 }),
  dYellow: decalMaterial('decal-yellow-glaze', { color: 0xd9a441, roughness: 0.4 }),
  dBlack: decalMaterial('decal-black-glaze', { color: 0x1a1a1a, roughness: 0.45 }),
  dWhite: decalMaterial('decal-white-glaze', { color: 0xf2efe6, roughness: 0.4 }),
  dGold: decalMaterial('decal-gold', { color: 0xd0a94e, roughness: 0.3, metalness: 0.75 }),
  dNavy: decalMaterial('decal-gate-shadow-navy', { color: 0x0b1c3d, roughness: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 爪形分件（實體件，貼在下層裙板外表面、厚 1.2 mm）：一塊掌墊＋數支往後伸的爪，側視多邊形
 * @type {(claws: number[][][], pad: number[][]) => THREE.BufferGeometry} claws：每支爪的 (x, y) 多邊形；pad：掌墊多邊形
 */
const buildPaw = (claws, pad) => {
  /** @type {THREE.BufferGeometry[]} */
  const geos = [];
  for (const sg of [-1, 1]) {
    for (const poly of [pad, ...claws]) {
      const xm = poly.reduce((s, p) => s + p[0], 0) / poly.length;
      // 中心在裙板外表面外 0.45 mm → 內 0.15 mm 埋進殼面
      geos.push(finPlate(poly, sg * (skirtZ(xm) + 0.45), 1.2));
    }
  }
  return mergeGeos(geos);
};

/**
 * 一支往後彎的爪（彎月形多邊形）：根部 (x0, y0)、往後伸長 len、往下彎 drop、根寬 w
 * @type {(x0: number, y0: number, len: number, drop: number, w: number) => number[][]}
 */
const claw = (x0, y0, len, drop, w) => {
  /** @type {number[][]} */
  const top = [];
  /** @type {number[][]} */
  const bot = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = x0 - len * u;
    const yc = y0 - drop * u * u;
    const hwid = (w / 2) * (1 - u) + 0.15;
    top.push([x, yc + hwid]);
    bot.push([x, yc - hwid]);
  }
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
  theme: '伊什塔爾城門的蛇龍低伏前竄：貼地前伸的蛇首鼻錐（琥珀蛇眼頭燈）、往後掃的金色直角前分流片、壓低的獅肩前擋泥板與拱起的鷹腿後臀、微收的蛇身、肩線＋內收上層側壁＋瀝青黑下層裙板上的獅爪與鷹爪，蛇尾末端揚起金刃鰭刀尾翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 肩線、腰線、平台外緣是銳利稜線
  hard: [3, 5, 6],
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    // 下層裙板（腰線平台以下）：瀝青黑
    { mat: 'bitumen', keep: (x, y) => P.yC(x) - 0.3 - y },
    { mat: 'lapis', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'lapis2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 輪拱內襯（前後）＋輪胎內側環形擋板（kitsune-ninetail 的 buildArchWell）
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 22.9, profile))), mat: 'liner', shell: true, name: 'arch-liners' });
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))), mat: 'liner', shell: true, name: 'arch-wells' });

    // 輪拱拱框：上層側壁上一道黃釉細框（城門拱的釉磚邊框）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onUpperWall(x, y, z)) {
          return -1;
        }
        const d = archDist(x, y);
        return Math.min(d - 0.3, 1.4 - d);
      }),
      mat: 'dYellow',
      name: 'decal-arch-band',
    });
    // 腰線黃釉細邊（腰線上方 0.3 → 1.3 mm，貫穿全車的速度線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onUpperWall(x, y, z) || archDist(x, y) < 0.3 || x > 70) {
          return -1;
        }
        const dy = y - P.yC(x);
        return Math.min(dy - 0.3, 1.3 - dy);
      }),
      mat: 'dYellow',
      name: 'decal-waist-pinstripe',
    });
    // 上層側壁的錯縫磚縫（避開拱框與腰線細邊）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onUpperWall(x, y, z) || y < P.yC(x) + 1.9 || y > P.yS(x) - 0.5 || archDist(x, y) < 2 || x > 56) {
          return -1;
        }
        return brickJoint(x, y);
      }),
      mat: 'dJoint',
      name: 'decal-brick-joints',
    });
    // 頂面磚縫（背脊花飾帶兩側，像鱗片般沿車身排列的釉磚）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (y < P.yS(x) + 0.1 || az < 6 || az > P.hw(x) - tumble(P.hw(x)) - 1 || x < X_REAR + 2 || x > 56) {
          return -1;
        }
        return brickJoint(x, az + 1);
      }),
      mat: 'dJoint',
      name: 'decal-roof-joints',
    });

    // 背脊中線的玫瑰花飾帶（M2 花飾帶 → 蛇龍的背脊；V12 / V13 中線賽車條）：深藍底＋白瓣金心花飾＋黃釉邊＋黑細線，從頭後一路到蛇尾
    /** @type {(x: number, y: number) => boolean} 背脊帶（肩線以上；頭後 x 57 到尾） */
    const onStripe = (x, y) => y > P.yS(x) + 0.5 && x > X_REAR + 1.5 && x < 57.5;
    parts.push({ geometry: kit.decal((x, y, z) => (onStripe(x, y) ? 3.3 - Math.abs(z) : -1)), mat: 'dNavy', name: 'decal-rosette-stripe-base' });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y) ? Math.min(Math.abs(z) - 3.3, 4.5 - Math.abs(z)) : -1)),
      mat: 'dYellow',
      name: 'decal-rosette-stripe-borders',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (onStripe(x, y) ? Math.min(Math.abs(z) - 4.5, 5.1 - Math.abs(z)) : -1)),
      mat: 'dBlack',
      name: 'decal-rosette-stripe-lines',
    });
    /** @type {number} 花飾間距 */
    const ROS_STEP = 6.2;
    /** @type {(x: number, z: number) => { petal: number, core: number }} 最近的一朵玫瑰花飾（帶中線上） */
    const nearestRosette = (x, z) => {
      const xc = Math.min(54, Math.max(-68, Math.round(x / ROS_STEP) * ROS_STEP));
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

    // 蛇首頂面的黃釉紋（M1 的細長蛇首）＋黑描邊：頸後 x 57 到吻尖
    /** @type {(x: number, z: number) => number} 蛇首紋輪廓距離（正值 = 外）：半寬為殼半寬的 0.55 */
    const headSd = (x, z) => Math.max(57 - x, Math.abs(z) - 0.55 * P.hw(x));
    /** @type {(x: number, y: number) => boolean} 頭頸頂面 */
    const onSnout = (x, y) => x > 55 && y > P.yS(x) + 0.05;
    parts.push({ geometry: kit.decal((x, y, z) => (onSnout(x, y) ? -headSd(x, z) : -1)), mat: 'dYellow', name: 'decal-snake-head' });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSnout(x, y)) {
          return -1;
        }
        const d = headSd(x, z);
        return Math.min(d, 0.6 - d);
      }),
      mat: 'dBlack',
      name: 'decal-snake-head-outline',
    });

    // 蛇眼頭燈（實體件）：頭骨兩側上層側壁上的細長斜眼，往後上挑（x 63.5–68.5），半埋進殼面
    {
      /** @type {THREE.BufferGeometry[]} */
      const eyes = [];
      for (const sg of [-1, 1]) {
        const ex = 66;
        const ey = lerp(P.yS(ex), P.yC(ex), 0.45);
        const ez = P.hw(ex) - 0.6 * tumble(P.hw(ex));
        const g = new THREE.SphereGeometry(1, 14, 8);
        g.scale(2.8, 0.9, 0.9);
        g.rotateZ(-0.22);
        g.rotateY(sg * 0.28);
        g.translate(ex, ey, sg * ez);
        eyes.push(g);
      }
      parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, name: 'mushussu-eye-lamps' });
    }

    // 大件 1：蛇首的一對直角（M1：頭上往後的直角）→ 往後掃過前擋泥板的前分流片（金屬金）：
    // 角根在頭骨頂（x 64、|z| 4.5），往後外掃到前輪上方（x 43、|z| 24），貼著殼面略往上翹（像被迎風壓向後飛揚）；
    // 斷面橫向扁（刀片狀分流片），根 2.6 × 1.3 → 尖 0.9 × 0.6 mm
    {
      /** @type {THREE.BufferGeometry[]} */
      const horns = [];
      for (const sg of [-1, 1]) {
        /** @type {number[][]} */
        const pts = [];
        for (let i = 0; i <= 8; i++) {
          const u = i / 8;
          const x = lerp(64, 43, u);
          const z = sg * lerp(4.5, 24, u ** 1.15);
          const y = kit.surf.topY(x, z) - 0.5 + 1.0 + 2.6 * u ** 1.6;
          pts.push([x, y, z]);
        }
        horns.push(sweepEllipse(pts, 16, (t) => [lerp(1.3, 0.45, t), lerp(0.65, 0.3, t)], 6));
      }
      parts.push({ geometry: mergeGeos(horns), mat: 'gold', solid: true, outline: true, name: 'horn-splitters' });
    }

    // 前段獅爪（下層裙板、前輪後方）：掌墊緊貼輪拱後緣，3 支圓弧短爪往後伸（邁步）；黃釉
    {
      const x0 = 21.5;
      const pad = [[x0 + 1.2, 19.6], [x0 - 3.5, 19.4], [x0 - 4.5, 13.8], [x0 + 1.6, 12.6]];
      const claws = [claw(x0 - 3.2, 18.4, 8.5, 1.0, 1.9), claw(x0 - 4, 16.2, 9.5, 1.4, 1.9), claw(x0 - 4, 13.9, 7.5, 1.1, 1.7)];
      parts.push({ geometry: buildPaw(claws, pad), mat: 'yellow', solid: true, outline: true, name: 'lion-paw-claws' });
    }
    // 後段鷹爪（下層裙板、後輪後方）：3 支長鉤爪往後下彎＋1 支往前的後趾（鷹爪三前一後）；黃釉
    {
      const x0 = -58;
      const pad = [[x0 + 1.4, 20.2], [x0 - 2.4, 20], [x0 - 2.8, 15.4], [x0 + 1.2, 14.6]];
      const claws = [claw(x0 - 2.2, 19.2, 7.5, 2.4, 1.6), claw(x0 - 2.6, 17.2, 7.2, 2.2, 1.6), claw(x0 - 2.6, 15.6, 5.2, 0.9, 1.4)];
      parts.push({ geometry: buildPaw(claws, pad), mat: 'yellow', solid: true, outline: true, name: 'eagle-talons' });
    }

    // 大件 2（自創暗器）：蛇尾末端的「鰭刀」尾翼——從尾背往後上方揚起的彎月形刀片（根部埋進尾背 4 mm 長的脊），
    // 金屬金刃緣（外形）＋黃釉刀身（內縮 1.1 mm、較厚），刀尖往後上指（x −77、y 41），像甩尾時正要揮出的鰭刀
    {
      /** @type {(x: number) => number} 尾背中線（埋進 0.8 mm） */
      const root = (x) => kit.surf.topY(x, 0) - 0.8;
      /** @type {number[][]} 外形：前緣從尾背 x −52 彎月形掃到刀尖，後緣內凹回到尾尖 */
      const blade = [
        [-52, root(-52)],
        [-58, root(-58) + 2.2],
        [-64, 33.2],
        [-69.5, 37.2],
        [-74, 39.8],
        [-77, 41],
        [-75.2, 37.6],
        [-73.6, 33.6],
        [-72.6, 29.6],
        [-71.4, root(-71.4)],
        [-66, root(-66)],
        [-60, root(-60)],
      ];
      parts.push({ geometry: finPlate(blade, 0, 1.0), mat: 'gold', solid: true, outline: true, name: 'tail-fin-blade-edge' });
      /** @type {number[][]} 刀身（內縮）：較厚 1.7 mm，蓋住金刃中段，只露出前緣與刀尖的金刃 */
      const core = [
        [-55, root(-55)],
        [-59.6, root(-59.6) + 1.6],
        [-64.6, 31.8],
        [-69.6, 35.6],
        [-73.6, 37.9],
        [-74.2, 36.6],
        [-73, 33.2],
        [-72.2, 29.6],
        [-71.2, root(-71.2)],
        [-62, root(-62)],
      ];
      parts.push({ geometry: finPlate(core, 0, 1.7), mat: 'yellow', solid: true, name: 'tail-fin-blade-core' });
      // 鰭刀的橫刃：立刃根部往兩側展開的彎月形刀片（俯視兩端刀尖往後勾），貼在尾背上方、壓在後臀高度以下（正視被車身擋住，不增加正面面積）
      /** @type {(outline: number[][], y0: number, t: number) => THREE.BufferGeometry} 平面 (x, z) 的刀片，沿 y 擠出厚度 t */
      const plate = (outline, y0, t) => {
        const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
        const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
        // 局部 (x, y, z) → 世界 (x, z, −y)：形狀平面躺平、擠出方向朝上
        g.rotateX(-Math.PI / 2);
        g.translate(0, y0, 0);
        return g;
      };
      /** @type {(sz: number, k: number) => number[][]} 彎月形刀片外形：前緣中線 x −63 → 刀尖 (−77, ±sz)，後緣微往前弓（刀尖往後勾）回到中線 x −70.5；k 為內縮量 */
      const crescent = (sz, k) => {
        /** @type {number[][]} 半邊（z ≥ 0）：前緣由中線到刀尖，再由後緣回到中線 */
        const half = [];
        const n = 10;
        const tipX = -77 + 1.4 * k;
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          half.push([lerp(-63 - k, tipX, u) + 3.2 * Math.sin(Math.PI * u) * (1 - 0.3 * u), sz * u]);
        }
        for (let i = n - 1; i >= 0; i--) {
          const u = i / n;
          half.push([lerp(-70.5 + k, tipX, u) + 1.2 * Math.sin(Math.PI * u), (sz - 0.6 * k) * u]);
        }
        // 左右對稱：半邊（中線 → 刀尖 → 中線）接上鏡射半邊（中線 → 負側刀尖 → 中線）
        const mirror = half.slice(1, -1).map(([x, z]) => [x, -z]).reverse();
        return [...half, ...mirror];
      };
      parts.push({ geometry: plate(crescent(31, 0), 32.4, 1.0), mat: 'gold', solid: true, outline: true, name: 'tail-blade-wing-edge' });
      parts.push({ geometry: plate(crescent(28.5, 1.1), 32.2, 1.5), mat: 'yellow', solid: true, name: 'tail-blade-wing-core' });
    }
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他款）',
    geometry:
      '本檔站位產生器 P（推估，iter-128 第十階段重塑）：殼 x −72 → 74（吻尖不超過 iter-127）；腰線半寬 擋泥板 44、兩輪之間 41.5、x 48 起急收成蛇頸（x 58：14、x 62：11.4）、蛇頭 12.4、吻尖 5.5、蛇尾 11，下層裙板再外 1.2（外框半寬 ≤ 48.0，iter-113 擦牆教訓）；背脊 前擋泥板 31.8、後臀 35.0、吻尖 15.6、尾 25.5；肩線 28.2–32.7（R17.5 輪拱頂 30.5 之上）；上層側壁內收 2.6（tumblehome）；腰線 20–22；裙板下緣 10.5（包住電池管）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），不切輪拱可裝；輪拱內襯＋輪胎內側環形擋板（buildArchWell）',
    horns: '前分流片蛇角：掃掠件 9 點 × 16 段 × 6 邊，斷面根 2.6 × 1.3 → 尖 0.9 × 0.6 mm（≥ 0.6 mm 射出薄件，推估）；ABS 實心件，質量 = 封閉體積 × 1.05 g/cm³',
    claws: '獅爪 / 鷹爪：厚 1.2 mm 立板（貼在裙板外 0.45 mm、內 0.15 mm 埋進殼面），爪根寬 1.4–1.9 mm、尖端 0.3 mm（推估）',
    tailBlade: '鰭刀尾翼：金刃外形厚 1.0、黃釉刀身厚 1.7 mm 的立板，根部埋進尾背 0.8 mm；刀尖 x −77、y 41（和 iter-127 尾翼後端 −77.1 相同，不加長外框）',
    myth: '穆修胡修的長頸蛇首、頭上直角、前獅足後鷹爪、長尾（MYTH_RESEARCH M1）；伊什塔爾城門青金石藍釉磚、黃釉框、白瓣金心玫瑰花飾（M2、M3）。鰭刀尾翼為自創暗器（不是蠍尾毒針）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
