// 索爾的山羊戰車（body-tanngrisnir-chariot，第八階段神話組・北歐）：《散文埃達》中索爾乘坐、由兩頭公山羊 Tanngrisnir 與 Tanngnjóstr 拉的戰車。
// iter-128（第十階段「從頭重塑」，LG1 家族 F1 刀鋒滑翔型）：整檔重寫。戰車不再是「木車斗＋兩隻羊頭擺件」，而是一把低平的刀——
// - 側視：鼻尖細而低（x 72、y 17.6），一條幾乎筆直的刀背線往後緩升到車尾 31.2，只有座艙的小色罩凸出；尾端接一片貼身平板翼（V7、L1-10）。
// - 斷面：上層是 tumblehome 內收的刀身＋銳利肩線，肩線下方往內切 2.6 mm 的陰影線，下層是深色裙板（上下兩層量體，解決「側壁一路蓋到底」）。
// - 神話元素變成車身：左右前擋泥板就是兩頭山羊的頭（擋泥板前緣一對琥珀色眼形頭燈），
//   兩支大山羊角從擋泥板頂長出、往後上掃再往下捲，像被風往後吹的側導流鰭（大件 1）；中央細長鼻＝戰車的車轅。
// - 北歐交織紋（Urnes 風格的兩股交織帶，自繪曲線）做成從鼻尖到車尾的亮黃銅賽車條（大件 2：貫穿全車的速度線）。
// iter-129（評審：羊不見了、尾翼像橫擱木板）：左右前擋泥板前端各伸出一顆山羊頭（長吻、琥珀小眼點、鬍鬚尖），粗角從羊頭頂往後外捲；
// 尾翼改成收在車身寬以內、前緣斜面接後甲板的楔形翼＋往下折的端板；前後擋泥板半寬各收 1.5–2.5 mm（和新 trojan 的俯視 IoU）。
// 不用盧恩字母、不用雙閃電或任何被挪用的符號、不用雷紋（LG1 Spin 系語彙），不放鎚，不畫人，不含文字與商標。
// 設計：shared/design/body-tanngrisnir-chariot/DESIGN.md（第十階段重塑一節）。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, smoothNormals } from './gazelleLeap.js';
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
  // 俯視半寬（肩線）：iter-129 前擋泥板 32.2、後輪 32.5（和新 trojan 俯視 IoU 0.857 → 0.832）；前擋泥板（兩頭羊的寬額），x 44 → 64 急收成兩個羊頭前額＋中間一支 4 ~ 7 mm 的細尖鼻（車轅）；兩輪之間收到 26.8（底盤中段側壁 |z| 27、頂 10.7，裙板下緣 15 在其上方）、後輪 35、車尾收成 25（後掠平板翼蓋過）；
  // iter-128b：和 a 組新 trojan-horse 俯視 IoU 0.864 → 0.831，前擋泥板與後輪段各收 0.6–1 mm、鼻尖收細、尾翼翼展加到 46
  hw: monoCurve(XS, [25, 27, 31.5, 32.5, 27.5, 26.8, 26.8, 28.6, 31.6, 32.2, 31.8, 29, 18, 7, 5.5, 4]),
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
  horn: namedMaterial('paint-goat-horn-ivory', { color: 0xd9c9a3, roughness: 0.4, clearcoat: 0.35 }),
  // iter-129 羊頭：灰白霧面、鬍鬚灰
  goat: namedMaterial('paint-goat-greywhite', { color: 0xe4e0d6, roughness: 0.6, clearcoat: 0.1 }),
  beard: namedMaterial('paint-goat-beard-grey', { color: 0x8f8a80, roughness: 0.7 }),
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
// iter-129 兩顆山羊頭（評審：iter-128 羊不見了，只剩兩條細弧像獠牙）：左右前擋泥板前端各往前伸出一顆羊頭鼻錐
// （長吻、小眼點、下巴鬍鬚尖），羊角從羊頭頂長出，加粗並往後外捲（大件 1）
// ---------------------------------------------------------------------------

/** @type {number} 羊頭中心 |z| */
const HEAD_Z = 20.5;

/**
 * 羊頭中心線：根部埋進前擋泥板前緣（x 53），往前下伸到吻尖 x 67.6（不超過鼻尖 x 72）
 * @type {(sg: number) => number[][]}
 */
const headPath = (sg) =>
  [
    [52.5, 28.2, 20],
    [57, 27.4, 20.4],
    [61.5, 25.2, 20.6],
    [65.5, 22.6, 20.6],
    [67.6, 21.2, 20.5],
  ].map(([x, y, z]) => [x, y, sg * z]);

/**
 * 羊頭斷面：額頭最寬（t 0.25），往前收成長吻，吻端略圓
 * @type {(t: number) => number[]}
 */
const headRad = (t) => {
  const brow = Math.exp(-(((t - 0.22) / 0.2) ** 2));
  const taper = lerp(1, 0.42, t ** 0.9);
  return [3.6 * taper + 0.8 * brow, 3.2 * taper + 0.9 * brow];
};

/**
 * 角的斷面：根粗尖細，沿角 7 道節環（山羊角的橫稜）；iter-129 加粗（根部 4.4 × 5.6）
 * @type {(t: number) => number[]}
 */
const hornRad = (t) => {
  const ridge = 1 + 0.1 * Math.cos(2 * Math.PI * 7 * t);
  const taper = lerp(1, 0.25, t ** 0.8);
  return [2.2 * taper * ridge, 2.8 * taper * ridge];
};

/**
 * 角的中心線：從羊頭頂（額頭後方）長出，往後上掃過前擋泥板，再往外、往下捲（像被風往後吹）
 * @type {(sg: number) => number[][]}
 */
const hornPath = (sg) =>
  [
    [54.5, 29.6, 20.6],
    [50, 33.6, 22],
    [43.5, 36.4, 24.6],
    [36, 37.2, 28.4],
    [29.5, 35.8, 32],
    [26.5, 33.4, 34.2],
    [27.5, 31.4, 35.4],
  ].map(([x, y, z]) => [x, y, sg * z]);

/** @type {(sg: number) => { head: THREE.BufferGeometry, beard: THREE.BufferGeometry, eye: THREE.BufferGeometry, nose: THREE.BufferGeometry, horn: THREE.BufferGeometry, tip: THREE.BufferGeometry }} 一頭山羊 */
const buildGoat = (sg) => {
  const head = smoothNormals(sweepEllipse(headPath(sg), 20, headRad, 12));
  // 鼻頭：吻端深灰小圓墊
  const nose = new THREE.SphereGeometry(1.5, 12, 8);
  nose.scale(1.1, 0.9, 1.25);
  nose.translate(68.2, 21.2, sg * HEAD_Z);
  // 眼點：額頭外側一顆琥珀小眼（自發光）
  const eye = new THREE.SphereGeometry(0.75, 10, 6);
  eye.scale(1.7, 0.8, 0.9);
  eye.translate(57.6, 28.4, sg * (HEAD_Z + 3.7));
  // 鬍鬚尖：下巴往下後方的尖楔（厚 1.4）
  const beard = finPlate(
    [
      [64.6, 21.6],
      [61.6, 22.6],
      [62.4, 17.4],
    ],
    sg * HEAD_Z,
    1.4,
  );
  const pts = hornPath(sg);
  const horn = sweepEllipse(pts, 56, hornRad, 10);
  // 角尖段：中心線最後 22% 另外掃一段略粗 0.06 mm 的深色套，讀出角尖顏色漸深
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const tipPts = [];
  for (let i = 0; i <= 6; i++) {
    const p = curve.getPointAt(0.78 + (0.22 * i) / 6);
    tipPts.push([p.x, p.y, p.z]);
  }
  const tip = sweepEllipse(tipPts, 14, (t) => hornRad(0.78 + 0.22 * t).map((r) => r + 0.06), 10);
  return { head, beard, eye, nose, horn, tip };
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

/** @type {number} 尾翼半寬（iter-129：收到車身寬以內） */
const WING_HW = 27;

/**
 * 尾翼（iter-129 重做，評審：iter-128 的金色平板比車身寬、像橫擱的木板）：
 * 側視是從後甲板往後上升的斜面楔形（前緣埋進甲板 y 30.4，後緣翹到 33.4），寬度收在車身內（±27）
 * @type {() => THREE.BufferGeometry}
 */
const buildTailWing = () =>
  finPlate(
    [
      [-55, 30.2],
      [-63, 32.2],
      [-70.5, 33.6],
      [-71.2, 32.4],
      [-66, 31],
      [-58, 29.4],
    ],
    0,
    2 * WING_HW,
  );

/**
 * 尾翼兩端往下折的端板：從翼面外緣往下到 y 26，前緣斜切
 * @type {() => THREE.BufferGeometry}
 */
const buildWingEndPlates = () =>
  mergeGeos(
    [-1, 1].map((sg) =>
      finPlate(
        [
          [-60, 31.4],
          [-70.8, 34],
          [-71.4, 33],
          [-70.4, 26.4],
          [-64.6, 26],
        ],
        sg * (WING_HW - 0.6),
        1.2,
      ),
    ),
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
  theme: '索爾的山羊戰車（第十階段 F1 刀鋒滑翔型）：細低尖鼻往後一條筆直刀背的風暴青灰車身，tumblehome 上層＋肩下陰影線＋鍛鐵裙板兩層量體；左右前擋泥板前端各伸出一顆山羊頭（長吻、琥珀小眼點、鬍鬚尖），粗山羊角從羊頭頂往後上掃再往外捲；鼻尖到車尾一條亮黃銅北歐交織紋賽車條，冰川藍小色罩，車尾從後甲板斜升的黃銅楔形翼＋往下折的端板',
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
    // 大件 1：兩顆往前伸的山羊頭＋從頭頂往後外捲的粗角（iter-129）
    const goats = [-1, 1].map((sg) => buildGoat(sg));
    parts.push({ geometry: mergeGeos(goats.map((g) => g.head)), mat: 'goat', solid: true, outline: true, name: 'goat-heads' });
    parts.push({ geometry: mergeGeos(goats.map((g) => g.nose)), mat: 'hornTip', solid: true, outline: true, name: 'goat-noses' });
    parts.push({ geometry: mergeGeos(goats.map((g) => g.beard)), mat: 'beard', solid: true, outline: true, name: 'goat-beards' });
    parts.push({ geometry: mergeGeos(goats.map((g) => g.eye)), mat: 'eye', solid: true, name: 'goat-eye-lamps' });
    parts.push({ geometry: mergeGeos(goats.map((g) => g.horn)), mat: 'horn', solid: true, outline: true, name: 'goat-horns' });
    parts.push({ geometry: mergeGeos(goats.map((g) => g.tip)), mat: 'hornTip', solid: true, name: 'goat-horn-tips' });
    // 小色罩
    parts.push({ geometry: buildCanopy(), mat: 'canopy', solid: true, outline: true, name: 'canopy-bubble' });
    // 尾翼：斜面楔形翼＋往下折的端板
    parts.push({ geometry: buildTailWing(), mat: 'brass', solid: true, outline: true, name: 'tail-ramp-wing' });
    parts.push({ geometry: buildWingEndPlates(), mat: 'iron', solid: true, outline: true, name: 'tail-wing-endplates' });
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
    geometry: 'iter-128 本檔站位產生器 P（推估）：車殼 x −66 ~ 72（尾翼到 −74）（鼻尖不超過現行版羊頭吻尖 75.2）；刀背中線鼻尖 17.6 → 前軸 25.4 → 座艙前 29.6 → 車尾 31.2；擋泥板頂輪上 32.2（31 mm 輪拱頂 30.5 之上）、兩輪之間 31.2；肩線在擋泥板頂下 2.8、肩下陰影線往內切 2.6；半寬前輪 32.2、收腰 26.8、後輪 32.5、車尾 25，前端 x 44 → 64 急收成 7 的細鼻（iter-129；31 mm 輪胎外側 34.75 從上方略露出）；頂高 / 長度依 HOMAGE_RESEARCH V17 0.22–0.38',
    heads: 'iter-129 羊頭：實心 ABS 掃掠件，根部埋進前擋泥板前緣 x 52.5、|z| 20.5，吻尖 x 68.9（鼻尖 72 之內），額頭斷面約 8.8 × 8.2 mm、吻端 3 × 2.7 mm；鬍鬚尖厚 1.4 mm（推估）',
    horns: 'iter-129 山羊角：實心 ABS 掃掠件，斷面根部 4.4 × 5.6 mm → 尖端約 1.1 × 1.4 mm（56 × 10 段），7 道節環；從羊頭頂（x 54.5、y 29.6）往後上掃到頂約 37.2（x 36），再往外下捲到 x 27.5、|z| 35.4；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    canopy: 'iter-128 座艙罩：x −20 ~ 8、半寬 6.6、高 5.4 的不透明亮面色罩（實心件，推估），V5 / L1-9「有色小座艙」',
    tailWing: 'iter-129 尾翼：黃銅色 ABS 楔形翼，側視前緣 x −55 埋進後甲板、後緣 x −71 翹到 y 33.6，半寬 27（收在車身寬以內），兩端 1.2 mm 端板往下折到 y 26，根部埋進車尾頂面（推估）',
    interlace: '北歐交織紋：兩股寬 1.4 mm 的帶子以半週期 9 mm 交織、交叉處一上一下輪替（Urnes 風格，自繪），外框線寬 0.7 mm；不是盧恩、不是雷紋、不是雙閃電（MYTH_RESEARCH H9）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；內襯從 |z| 33 到殼內面',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
