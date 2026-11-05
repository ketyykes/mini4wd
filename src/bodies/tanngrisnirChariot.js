// 索爾的山羊戰車（body-tanngrisnir-chariot，第八階段神話組・北歐）：《散文埃達》中索爾乘坐、由兩頭公山羊 Tanngrisnir 與 Tanngnjóstr 拉的戰車。
// iter-128（第十階段「從頭重塑」，LG1 家族 F1 刀鋒滑翔型）：整檔重寫。戰車不再是「木車斗＋兩隻羊頭擺件」，而是一把低平的刀——
// - 側視：鼻尖細而低（x 72、y 17.6），一條幾乎筆直的刀背線往後緩升到車尾 31.2，只有座艙的小色罩凸出；尾端接一片貼身平板翼（V7、L1-10）。
// - 斷面：上層是 tumblehome 內收的刀身＋銳利肩線，肩線下方往內切 2.6 mm 的陰影線，下層是深色裙板（上下兩層量體，解決「側壁一路蓋到底」）。
// - 神話元素變成車身：左右前擋泥板就是兩頭山羊的頭（擋泥板前緣一對琥珀色眼形頭燈），
//   兩支大山羊角從擋泥板頂長出、往後上掃再往下捲，像被風往後吹的側導流鰭（大件 1）；中央細長鼻＝戰車的車轅。
// - 北歐交織紋（Urnes 風格的兩股交織帶，自繪曲線）做成從鼻尖到車尾的亮黃銅賽車條（大件 2：貫穿全車的速度線）。
// 不用盧恩字母、不用雙閃電或任何被挪用的符號、不用雷紋（LG1 Spin 系語彙），不放鎚，不畫人，不含文字與商標。
// 設計：shared/design/body-tanngrisnir-chariot/DESIGN.md（第十階段重塑一節）。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, flatPlate, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number} 車尾 x */
const X_TAIL = -66;
/** @type {number} 鼻尖 x（現行版羊頭吻尖 75.2 之內） */
const X_NOSE = 72;

/** @type {number[]} 站位控制點（x 由後到前，前後軸 x = ±40） */
const XS = [X_TAIL, -62, -54, -40, -26, -12, 0, 12, 24, 34, 44, 52, 58, 64, 68, X_NOSE];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線高度（刀背）：鼻尖 17.6 → 前軸 25.5 → 座艙前 29.6 → 車尾 31.2，幾乎筆直的一條斜線（側視像刀）
  yA: monoCurve(XS, [31.2, 31.2, 31, 30.6, 30.2, 29.9, 29.6, 28.6, 27.4, 26.4, 25.4, 24.2, 22.8, 21, 19.6, 17.6]),
  // 擋泥板頂（上層刀身的最高稜）：前後輪上方 32.2（31 mm 輪拱頂 30.5 之上），兩輪之間 31.2 微收腰，鼻端降到 17.6
  yF: monoCurve(XS, [30.6, 31.4, 32.2, 32.2, 31.6, 31.2, 31.2, 31.4, 31.8, 32.2, 32.2, 31.4, 29, 25, 21.6, 17.6]),
  // 俯視半寬（肩線）：前擋泥板 34（兩頭羊的寬額），x 44 → 64 急收成兩個羊頭前額＋中間一支 4 ~ 7 mm 的細尖鼻（車轅）；兩輪之間收到 26.8（底盤中段側壁 |z| 27、頂 10.7，裙板下緣 15 在其上方）、後輪 35、車尾收成 25（後掠平板翼蓋過）；
  // iter-128b：和 a 組新 trojan-horse 俯視 IoU 0.864 → 0.831，前擋泥板與後輪段各收 0.6–1 mm、鼻尖收細、尾翼翼展加到 46
  hw: monoCurve(XS, [25, 28.5, 34, 35, 28.5, 26.8, 26.8, 29, 32.8, 34, 33.4, 29.5, 18, 7, 5.5, 4]),
  // 裙板下緣
  yLow: monoCurve(XS, [17.4, 16.4, 15.2, 15, 15, 15, 15, 15, 15, 15, 15, 15.2, 15.6, 16.2, 16.6, 16.8]),
};

/**
 * 肩線高度：擋泥板頂往下 2.8（鼻端收到 0.8，鼻尖是一片薄刀）
 * @type {(x: number) => number}
 */
const shoulderY = (x) => P.yF(x) - lerp(2.8, 0.8, Math.max(0, Math.min(1, (x - 56) / 16)));

/**
 * 半剖面 7 點：中線 → 刀背邊 → 擋泥板頂內緣（tumblehome 起點）→ 肩線（銳利）→ 肩下陰影線（銳利，往內切）→ 裙板 → 裙板下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yA = P.yA(x);
  const yF = P.yF(x);
  const w = P.hw(x);
  const lo = P.yLow(x);
  const yS = shoulderY(x);
  // 鼻端斷面變薄，陰影線切口跟著縮小
  const cut = lerp(2.6, 0.6, Math.max(0, Math.min(1, (x - 58) / 14)));
  const ySkirt = Math.max(lo + 0.8, yS - 2.2);
  // 擋泥板頂內緣 |z| 21.5（輪胎內側之外都在輪拱頂之上）；鼻端很窄時按比例往中線收
  const zF = Math.max(w * 0.55, Math.min(21.5, w - 6.5));
  return [
    [0, yA],
    [Math.max(zF * 0.5, zF - 3.5), lerp(yA, yF, 0.15)],
    [zF, yF],
    [w, yS],
    [w - cut, ySkirt],
    [w - cut + 0.5, lerp(ySkirt, lo, 0.6)],
    [w - cut + 1.2, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 每 2 mm 一站，鼻端每 1 mm */
const STATIONS = [...buildStations(X_TAIL, 60, 2, profile).slice(0, -1), ...buildStations(60, X_NOSE, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 主色：風暴青灰（霧面偏緞面，paint- 且 roughness > 0.5）
  slate: namedMaterial('paint-storm-slate', { color: 0x6a7884, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
  // 下層裙板：鍛鐵黑（緞面）
  iron: namedMaterial('paint-forged-iron', { color: 0x26282c, roughness: 0.58, clearcoat: 0.1, clearcoatRoughness: 0.5 }),
  // 車尾封口
  cap: namedMaterial('paint-forged-iron', { color: 0x26282c, roughness: 0.58, clearcoat: 0.1, clearcoatRoughness: 0.5 }),
  // 山羊角：象牙到灰褐的角質（微光澤）
  horn: namedMaterial('paint-goat-horn-ivory', { color: 0xe2d6b8, roughness: 0.4, clearcoat: 0.35 }),
  hornTip: namedMaterial('paint-goat-horn-dark', { color: 0x5e4c38, roughness: 0.45, clearcoat: 0.3 }),
  // 有色不透明小座艙罩（V5 / L1-9）：冰川藍亮面
  canopy: namedMaterial('paint-canopy-glacier', { color: 0x6fb2d4, roughness: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
  // 尾翼平板：黃銅（真金屬）
  brass: namedMaterial('trim-gold-brass', { color: 0xd6a648, metalness: 0.85, roughness: 0.24, clearcoat: 0.3 }),
  // 羊眼頭燈：琥珀色自發光（lamp- 前綴 → Blender 保留發光）
  eye: namedMaterial('lamp-goat-eye-amber', { color: 0xffb340, emissive: 0xff8a00, emissiveIntensity: 0.9, roughness: 0.12, clearcoat: 1.0 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x16181b, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-slate', { color: 0x3a434b, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-iron', { color: 0x202226, roughness: 0.7, side: THREE.DoubleSide }),
  // 交織紋賽車條：亮黃銅（金屬貼紙）＋鍛鐵底帶
  dBrass: decalMaterial('decal-interlace-brass', { color: 0xe0b050, metalness: 0.85, roughness: 0.2, clearcoat: 0.4 }),
  dBand: decalMaterial('decal-iron-band', { color: 0x2a2d32, roughness: 0.5, clearcoat: 0.2 }),
  // 肩線黃銅細線
  dLine: decalMaterial('decal-shoulder-brass', { color: 0xd8a84a, metalness: 0.8, roughness: 0.25 }),
  // 下層裙板進氣口（深色）
  dIntake: decalMaterial('decal-intake-black', { color: 0x0c0d0f, roughness: 0.4, clearcoat: 0.3 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

// ---------------------------------------------------------------------------
// 山羊角（大件 1）：從前擋泥板頂長出，往後上掃、再往下往內捲，像被風往後吹的側導流鰭
// ---------------------------------------------------------------------------

/**
 * 角的斷面：扁刀形（垂直厚、側向薄），根粗尖細，沿角 7 道節環（山羊角的橫稜）
 * @type {(t: number) => number[]}
 */
const hornRad = (t) => {
  const ridge = 1 + 0.12 * Math.cos(2 * Math.PI * 7 * t);
  const taper = lerp(1, 0.22, t ** 0.85);
  return [1.25 * taper * ridge, 2.6 * taper * ridge];
};

/**
 * 角的中心線（左右對稱，sg = ±1）：根部埋進擋泥板頂（x 31、y 31.2；和 31 mm 輪胎留 2 mm），往後上掃到頂約 37.2，再往下捲，尖端停在 x −9.5、y 33.4（懸空，不回接車身）
 * @type {(sg: number) => number[][]}
 */
const hornPath = (sg) =>
  [
    [31, 31.2, 31.2],
    [25.5, 34, 32],
    [17, 36, 32.8],
    [7, 37.2, 33.4],
    [-2, 36.9, 33.6],
    [-7.5, 35.3, 33.4],
    [-9.5, 33.4, 32.8],
  ].map(([x, y, z]) => [x, y, sg * z]);

/** @type {(sg: number) => { horn: THREE.BufferGeometry, tip: THREE.BufferGeometry, web: THREE.BufferGeometry }} 角身（象牙）＋角尖段（深灰褐） */
const buildHorn = (sg) => {
  const pts = hornPath(sg);
  const all = sweepEllipse(pts, 56, hornRad, 8);
  // 角尖段：用同一條中心線的最後 22% 另外掃一段略粗 0.06 mm 的深色套，讀出角尖顏色漸深
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const tipPts = [];
  for (let i = 0; i <= 6; i++) {
    const p = curve.getPointAt(0.78 + (0.22 * i) / 6);
    tipPts.push([p.x, p.y, p.z]);
  }
  const tip = sweepEllipse(tipPts, 14, (t) => hornRad(0.78 + 0.22 * t).map((r) => r + 0.06), 8);
  // 角下方的導流鰭腹板：從角根到角身中段往下接到肩線（角＝鰭的前緣，角下不留空隙，不會讀成提把）
  const web = finPlate(
    [
      [31, 30.6],
      [25.5, 33.4],
      [21, 35],
      [18, 35.5],
      [22, shoulderY(22) - 0.6],
      [30, shoulderY(30) - 0.6],
    ],
    sg * 32.3,
    0.9,
  );
  return { horn: all, tip, web };
};

// ---------------------------------------------------------------------------
// 北歐交織紋賽車條（大件 2）：兩股帶子沿 x 交織，交叉處一上一下輪替（Urnes 風格，自繪）
// ---------------------------------------------------------------------------

/** @type {number} 賽車條前端 x */
const STRIPE_X1 = 68;
/** @type {number} 賽車條後端 x */
const STRIPE_X0 = -63;
/** @type {number} 交織週期（兩次交叉之間的 x 距離） */
const BRAID_HALF = 9;
/** @type {number} 帶子半寬 */
const STRAND_W = 0.7;

/**
 * 交織振幅：鼻端窄、車身中段寬
 * @type {(x: number) => number}
 */
const braidAmp = (x) => {
  if (x > 40) {
    return lerp(3.4, 1.6, (x - 40) / (STRIPE_X1 - 40));
  }
  return 3.4;
};

/**
 * 交織紋距離場（負值在帶子內）：回傳 [帶子, 外框線]；座艙罩範圍不畫
 * @type {(x: number, z: number) => { braid: number, frame: number, band: number }}
 */
const braidSd = (x, z) => {
  const A = braidAmp(x);
  const k = Math.PI / BRAID_HALF;
  const ph = k * (x - STRIPE_X0);
  const s = Math.sin(ph);
  const slope = Math.sqrt(1 + (A * k * Math.cos(ph)) ** 2);
  const dA = Math.abs(z - A * s) / slope - STRAND_W;
  const dB = Math.abs(z + A * s) / slope - STRAND_W;
  // 最近交叉點的序號決定哪一股在上：偶數 A 在上、奇數 B 在上；在下的那股在上股兩側留 0.45 mm 縫
  const n = Math.round(ph / Math.PI);
  const aOver = n % 2 === 0;
  const over = aOver ? dA : dB;
  const under = aOver ? dB : dA;
  const underCut = Math.max(under, -(over - 0.45));
  const braid = Math.min(over, underCut);
  const wOut = A + 2.0;
  const frame = Math.abs(Math.abs(z) - wOut) - 0.35;
  const band = Math.abs(z) - (wOut + 0.9);
  return { braid, frame, band };
};

/** @type {{ x0: number, x1: number, hw: number, h: number }} 座艙罩（前低後高的小水滴，刀背上唯一凸起） */
const CANOPY = { x0: -20, x1: 8, hw: 6.6, h: 5.4 };

/**
 * 座艙罩：沿 x 掃掠的扁橢圓斷面，根部埋進刀背 0.8 mm
 * @type {() => THREE.BufferGeometry}
 */
const buildCanopy = () => {
  const n = 9;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = lerp(CANOPY.x1, CANOPY.x0, i / n);
    pts.push([x, P.yA(x) - 0.8, 0]);
  }
  return sweepEllipse(pts, 28, (t) => {
    // 前端細、最高點在 t 0.62（偏後），尾端收尖
    const bump = Math.sin(Math.PI * Math.min(1, t ** 0.8)) ** 0.7;
    return [Math.max(0.3, CANOPY.hw * bump), Math.max(0.3, CANOPY.h * bump)];
  }, 14);
};

/**
 * 羊眼頭燈：擋泥板前緣的斜長眼形燈（扁橢球，埋一半在殼裡）
 * @type {() => THREE.BufferGeometry}
 */
const buildEyes = () => {
  /** @type {THREE.BufferGeometry[]} */
  const eyes = [];
  for (const sg of [-1, 1]) {
    const x = 55;
    const g = new THREE.SphereGeometry(1, 14, 8);
    g.scale(3.4, 0.9, 1.6);
    g.rotateY(sg * 0.55);
    g.rotateZ(-0.32);
    g.translate(x, shoulderY(x) + 0.4, sg * (P.hw(x) - 3.2));
    eyes.push(g);
  }
  return mergeGeos(eyes);
};

/**
 * 貼身平板尾翼：刀背延伸出的一片後掠薄板（俯視像刀柄護手往後掠），根部埋進車尾頂面
 * @type {() => THREE.BufferGeometry}
 */
const buildTailBlade = () =>
  flatPlate(
    [
      [-57, -6],
      [-60, -31],
      [-63.5, -45.5],
      [-74, -46],
      [-68, -27],
      [-66.6, -6],
      [-66.6, 6],
      [-68, 27],
      [-74, 46],
      [-63.5, 45.5],
      [-60, 31],
      [-57, 6],
    ],
    30.4,
    1.4,
  );

export const tanngrisnirChariotBody = makePolyBody({
  id: 'body-tanngrisnir-chariot',
  name: '索爾的山羊戰車',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'thor-goat-chariot',
  form: 'goat-blade',
  roof: 'canopy',
  wing: 'goat-horns',
  theme: '索爾的山羊戰車（第十階段 F1 刀鋒滑翔型）：細低尖鼻往後一條筆直刀背的風暴青灰車身，tumblehome 上層＋肩下陰影線＋鍛鐵裙板兩層量體；左右前擋泥板是兩頭山羊的頭（琥珀眼形頭燈），兩支大山羊角從擋泥板往後上掃再下捲成被風吹的側導流鰭；鼻尖到車尾一條亮黃銅北歐交織紋賽車條，冰川藍小色罩，車尾貼身後掠黃銅平板翼',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 擋泥板頂、肩線、肩下陰影線是銳利稜線
  hard: [2, 3, 4],
  wheelArches: ARCHES,
  sideZMin: 26,
  zones: () => [
    // 下層：肩下陰影線以下全是鍛鐵裙板
    { mat: 'iron', keep: (x, y, z) => Math.min(shoulderY(x) - 0.3 - y, Math.abs(z) - (P.hw(x) - 3.5)) },
    { mat: 'slate', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'cap', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildProfileLiner(a, 33, profile))),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 大件 1：兩支風吹後掃的山羊角
    const horns = [-1, 1].map((sg) => buildHorn(sg));
    parts.push({ geometry: mergeGeos(horns.map((h) => h.horn)), mat: 'horn', solid: true, outline: true, name: 'goat-horn-fins' });
    parts.push({ geometry: mergeGeos(horns.map((h) => h.tip)), mat: 'hornTip', solid: true, name: 'goat-horn-tips' });
    parts.push({ geometry: mergeGeos(horns.map((h) => h.web)), mat: 'slate', solid: true, outline: true, name: 'goat-horn-webs' });
    // 羊眼頭燈
    parts.push({ geometry: buildEyes(), mat: 'eye', solid: true, name: 'goat-eye-lamps' });
    // 小色罩
    parts.push({ geometry: buildCanopy(), mat: 'canopy', solid: true, outline: true, name: 'canopy-bubble' });
    // 貼身平板尾翼
    parts.push({ geometry: buildTailBlade(), mat: 'brass', solid: true, outline: true, name: 'tail-blade-wing' });
    /** @type {(x: number, y: number, z: number) => boolean} 刀背頂面（中央、座艙罩外） */
    const onTop = (x, y, z) => {
      if (x > STRIPE_X1 || x < STRIPE_X0 || y < P.yA(x) - 1.5) {
        return false;
      }
      if (x > CANOPY.x0 - 1 && x < CANOPY.x1 + 1 && Math.abs(z) < CANOPY.hw + 1) {
        return false;
      }
      return Math.abs(z) < P.hw(x) - 7;
    };
    // 大件 2：北歐交織紋賽車條（鍛鐵底帶＋黃銅雙股交織＋黃銅外框線）
    parts.push({
      geometry: kit.decal((x, y, z) => (onTop(x, y, z) ? -braidSd(x, z).band : -1), { offset: 0.1 }),
      mat: 'dBand',
      name: 'decal-interlace-band',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onTop(x, y, z)) {
          return -1;
        }
        const d = braidSd(x, z);
        return -Math.min(d.braid, d.frame);
      }, { offset: 0.22 }),
      mat: 'dBrass',
      name: 'decal-interlace-brass',
    });
    // 肩線黃銅細線（沿肩線上緣 0.7 mm，從鼻端到車尾，速度線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (x > 66 || x < -64 || Math.abs(z) < P.hw(x) - 2.4) {
          return -1;
        }
        return 0.35 - Math.abs(y - (shoulderY(x) + 0.6));
      }, { offset: 0.12 }),
      mat: 'dLine',
      name: 'decal-shoulder-line',
    });
    // 下層裙板進氣口：前輪後方往後收尖的深色斜口（側視讀成兩層之間的進氣道）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < P.hw(x) - 3.4 || x < 2 || x > 21) {
          return -1;
        }
        const top = shoulderY(x) - 3.2;
        const bot = lerp(top - 0.8, 17, (x - 2) / 19);
        return Math.min(top - y, y - bot, x - 2, 21 - x);
      }, { offset: 0.1 }),
      mat: 'dIntake',
      name: 'decal-skirt-intake',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: 'iter-128 本檔站位產生器 P（推估）：車殼 x −66 ~ 72（尾翼到 −74）（鼻尖不超過現行版羊頭吻尖 75.2）；刀背中線鼻尖 17.6 → 前軸 25.4 → 座艙前 29.6 → 車尾 31.2；擋泥板頂輪上 32.2（31 mm 輪拱頂 30.5 之上）、兩輪之間 31.2；肩線在擋泥板頂下 2.8、肩下陰影線往內切 2.6；半寬前輪 34、收腰 26.8、後輪 35、車尾 25，前端 x 44 → 64 急收成 7 的細鼻（iter-128b）；頂高 / 長度依 HOMAGE_RESEARCH V17 0.22–0.38',
    horns: 'iter-128 山羊角：實心 ABS 掃掠件，扁刀形斷面根部 2.5 × 5.2 mm → 尖端約 0.55 × 1.1 mm（56 × 8 段），7 道節環；根部埋進前擋泥板頂（x 31、y 31.2、|z| 31.2；離 31 mm 輪胎 ≥ 2 mm），頂約 37.2，尖端捲到 x −9.5、y 33.4；角根到 x 18 之間有 0.9 mm 腹板接到肩線；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    canopy: 'iter-128 座艙罩：x −20 ~ 8、半寬 6.6、高 5.4 的不透明亮面色罩（實心件，推估），V5 / L1-9「有色小座艙」',
    tailWing: 'iter-128 平板尾翼：黃銅色 ABS 板厚 1.4 mm、y 30.4、x −57 ~ −74、半寬 46 的後掠刀柄形（翼端往後掠；iter-128b 由 42 加寬），根部埋進車尾頂面（推估）',
    interlace: '北歐交織紋：兩股寬 1.4 mm 的帶子以半週期 9 mm 交織、交叉處一上一下輪替（Urnes 風格，自繪），外框線寬 0.7 mm；不是盧恩、不是雷紋、不是雙閃電（MYTH_RESEARCH H9）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；內襯從 |z| 33 到殼內面',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
