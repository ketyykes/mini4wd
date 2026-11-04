// 索爾的山羊戰車（body-tanngrisnir-chariot，第八階段神話組・北歐）：《散文埃達》中索爾乘坐、由兩頭公山羊 Tanngrisnir 與 Tanngnjóstr 拉的戰車。
// 車身是低而寬的橡木＋鐵箍戰車車斗（開放座艙：木條甲板，兩輪之間收腰），車尾一塊短而高的背板（上緣單一條橫向折線紋）；
// 車斗往前收成低平的車轅甲板，甲板中央一支細長車轅（中央脊）伸到車頭，兩側是兩頭並列的抽象山羊頭（往前低伸的短吻＋鬍鬚＋往後捲的兩對粗山羊角），
// 角根融進羊頭、羊頸從前擋泥板內壁長出（擋泥板＝羊的肩），頸上各一圈青銅頸環；車轅兩側的甲板挖空成軛井。
// 設計：shared/design/body-tanngrisnir-chariot/DESIGN.md（典故 MYTH_RESEARCH N12、N16；車斗語彙 N3 Oseberg 四輪木車；黑名單 H6 不放雷神之鎚、不用盧恩）。
// 塗裝全為自創：橡木棕（霧面）＋鍛鐵黑灰（緞面）＋青銅鉚釘與折線紋（金屬）＋少量暗紅；羊頭灰白、羊角象牙色。
// 不畫人、不放鎚、不用盧恩字母或任何被挪用的符號，不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, buildRegion, featureSd } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：背板後面 −63.5、車轅甲板前緣 64 */
const XS = [-63.5, -62, -58, -54, -50, -40, -20, 0, 18, 24, 30, 36, 44, 52, 58, 62, 64];
/** @type {number[]} 俯視半寬的站位（兩輪之間多兩個腰身控制點） */
const XS_HW = [-63.5, -62, -58, -54, -50, -40, -26, -16, 0, 16, 26, 36, 44, 52, 58, 62, 64];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 車斗邊沿 / 前擋泥板頂面高度：車斗 34；車尾背板（x −63.5 ~ −58）升到 43；前擋泥板 x 52 之後往下收到車頭 22
  yR: monoCurve(XS, [40, 40.5, 40, 35.5, 33.3, 33, 33, 33, 33, 33, 33, 33, 33, 32.3, 29.5, 25.5, 22]),
  // 中央（|z| < 18）高度：車斗段和邊沿同高（座艙是凹槽）；x 22 之後降成車轅甲板（26.5 → 車頭 20）
  yA: monoCurve(XS, [40, 40.5, 40, 35.5, 33.3, 33, 33, 33, 33, 32, 28.5, 26.8, 26.3, 25.5, 24, 22, 20]),
  // 俯視半寬：前後輪上方外張成 41（輪罩，蓋住輪胎）、兩輪之間收成 34 的腰（車斗側板內凹）；車尾兩角收圓（避開後導輪）、車頭收到 31
  hw: monoCurve(XS_HW, [31, 34.5, 38, 39.5, 40, 40, 39, 33.5, 32.5, 33.5, 39, 40, 40, 39, 37, 34, 31]),
  // 側壁下緣
  yLow: monoCurve(XS, [18, 17, 16, 15.2, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15.2, 15.4, 15.6]),
  // 座艙凹槽半寬：後輪上方 23（輪胎內側，留出輪罩平台）、兩輪之間 27.5–28
  cockpit: monoCurve([-47, -26, -18, 0, 14, 20], [23, 23, 26, 26.5, 27, 27]),
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
  const yA = Math.min(P.yA(x), yR);
  const hw = P.hw(x);
  const lo = P.yLow(x);
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

/**
 * 開放座艙（車斗甲板）：深 5.5 mm（甲板 27.5）；後輪上方縮到 |z| ≤ 23（31 mm 輪胎內側 24.75 之內，甲板不碰輪胎），兩輪之間放寬到 27
 * @type {any}
 */
const DECK = {
  id: '車斗甲板',
  view: 'top',
  shape: 'fn',
  sd: (x, y, z) => Math.max(Math.abs(z) - P.cockpit(x), x - 20, -47 - x),
  depth: 5.5,
};

/**
 * 車轅兩側的軛井（俯視開口）：車轅甲板在中央脊（|z| < 4）與擋泥板內壁（|z| 21.5）之間挖空，羊頸從擋泥板內壁伸出、羊頭懸在井上
 * @type {any}
 */
const YOKE_WELL = {
  id: '軛井',
  view: 'top',
  shape: 'poly',
  pts: [
    [27, 3.2],
    [27, 21.2],
    [65, 21.2],
    [65, 3.2],
  ],
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
  const r = lerp(2.2, 0.62, t ** 0.9) * ridge;
  return [r * 0.92, r * 1.08];
};

/**
 * 山羊角中心線：從頭頂往上、往後彎，再往下捲回來（半圈），尖端往外張
 * @type {(sg: number, zBase: number, spread: number) => number[][]} spread：往外張的方向（+1 = 遠離羊頭中心）
 */
const hornPath = (sg, zBase, spread) => {
  const z = (dz) => sg * (zBase + spread * dz);
  return [
    [60, 36, z(0)],
    [58.6, 40.6, z(0.4)],
    [55.6, 43.9, z(1)],
    [51.6, 45.3, z(1.9)],
    [47.9, 43.7, z(2.8)],
    [46.7, 40.7, z(3.4)],
    [48.4, 38.6, z(3.7)],
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
  // 鬍鬚：下巴往下垂的一撮（側視五邊形，厚 1.6）
  const beard = finPlate(
    [
      [67.2, 28.6],
      [63.8, 29.8],
      [63.1, 25.4],
      [64.4, 21.9],
      [65.7, 25.6],
    ],
    zc,
    1.6,
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

/**
 * 背板後面的折線紋實體條（青銅，厚 0.6 mm，貼在後封口外）：沿 z 的單一條鋸齒帶
 * @type {(xFace: number, y0: number, zHalf: number) => THREE.BufferGeometry}
 */
const buildZigzagStrip = (xFace, y0, zHalf) => {
  const amp = 1.7;
  const period = 8;
  const w = 1.3;
  /** @type {number[][]} 中心線頂點 */
  const mid = [];
  for (let z = -zHalf; z <= zHalf + 1e-6; z += period / 2) {
    const i = Math.round((z + zHalf) / (period / 2));
    mid.push([z, y0 + (i % 2 === 0 ? -amp : amp)]);
  }
  const top = mid.map(([z, y]) => [z, y + w / 2]);
  const bot = mid.map(([z, y]) => [z, y - w / 2]);
  const shape = new THREE.Shape([...top, ...bot.reverse()].map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
  // shape 在 (z, y) 平面、擠出沿 +z → 轉成厚度沿 x（x 0 ~ 0.6），再移到後封口外 [xFace − 0.6, xFace]
  g.rotateY(Math.PI / 2);
  g.translate(xFace - 0.6, 0, 0);
  return g;
};

/** @type {number[]} 車斗側面鐵箍的 x（後軸之後 1 道、兩輪之間 3 道） */
const BAND_X = [-60.5, -15, 0, 15];
/** @type {number} 鐵箍寬 */
const BAND_W = 2.6;
/** @type {number[]} 側面橡木板縫高度 */
const SEAM_Y = [19.2, 23.6, 28];

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
  theme: '索爾的山羊戰車：低而寬的橡木＋鐵箍車斗（開放座艙木條甲板、兩輪之間收腰）、車尾高背板上一條青銅折線紋，車頭兩頭並列山羊（短吻、鬍鬚、往後捲的兩對粗角、青銅頸環）夾著細長車轅',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 車轅甲板邊、擋泥板頂內緣、頂外緣是銳利稜線
  hard: [1, 3, 4],
  wheelArches: ARCHES,
  recesses: [DECK],
  openings: [YOKE_WELL],
  innerSkipRecess: true,
  sideZMin: 30,
  zones: () => [
    // 背板頂面暗紅
    { mat: 'red', keep: (x, y) => Math.min(-55.5 - x, y - 38) },
    // 鍛鐵邊沿：車斗邊沿與擋泥板頂的外緣（圓肩一圈 2.4 mm 寬）
    { mat: 'iron', keep: (x, y, z) => Math.min(y - (P.yR(x) - 2.6), Math.abs(z) - (P.hw(x) - 2.4)) },
    // 鍛鐵內緣：座艙凹槽口一圈 1.6 mm 寬
    { mat: 'iron', keep: (x, y, z) => (y > P.yR(x) - 0.5 ? 1.6 - DECK.sd(x, y, z) : -1) },
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
      () => [1.25, 1.4],
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
    // 背板後面的青銅折線紋（單一條橫向鋸齒，實體條）
    parts.push({ geometry: buildZigzagStrip(-63.5, 39.2, 32), mat: 'bronze', solid: true, name: 'backboard-zigzag' });
    // 背板前面（朝座艙的斜面）同一條折線紋（貼紙）
    const zig = zigzagDist(39.4, 1.5, 8);
    parts.push({
      geometry: kit.decal((x, y, z) => (x > -59.5 && x < -52 && Math.abs(z) < 34 ? 0.6 - zig(z, y) : -1), { offset: 0.1 }),
      mat: 'dBronze',
      name: 'decal-backboard-zigzag',
    });
    // 側面橡木板縫（深色細線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < P.hw(x) - 1.2) {
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
    geometry: '本檔站位產生器 P（推估）：車殼 x −63.5 ~ 64、車轅頭到 77（長約 141）；車斗邊沿 33、背板 40.5、羊角頂約 47（batch4「長約 140–150、高約 44–52」）；輪罩半寬 40 蓋住輪胎、兩輪之間收腰 32.5；車尾兩角收到 31（離後導輪 ≥ 1 mm）',
    cockpit: '開放座艙：甲板凹槽深 5.5 mm（後輪上方 |z| ≤ 23 在輪胎內側、兩輪之間 |z| ≤ 27，推估）；車轅兩側的軛井（x 27 以前、|z| 3.2–21.2）挖空，俯視可看到底盤前段（batch4「看得到底盤的一部分或甲板」）',
    goats: '山羊頭頸為實心 ABS 掃掠件（頸斷面約 7 × 8 mm、頭 7 × 8 → 吻 4 × 5 mm）、羊角根部直徑約 4.4 mm 往尖端收到 1.2 mm＋每 2 mm 一道環節、鬍鬚厚 1.6 mm（推估），質量 = 封閉體積 × 1.05 g/cm³；羊頭 |z| 8–21，離前導輪（|z| ≥ 35.5）遠',
    zigzag: '背板折線紋：單一條橫向鋸齒（週期 8、振幅 ±1.7、線寬 1.3 mm），不是雙折線閃電（MYTH_RESEARCH H9），自繪',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；內襯從 |z| 21.5 到殼內面',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
