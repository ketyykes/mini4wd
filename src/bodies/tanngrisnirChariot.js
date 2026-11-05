// 索爾的山羊戰車（body-tanngrisnir-chariot，神話組・北歐）：《散文埃達》中索爾乘坐、由兩頭公山羊 Tanngrisnir 與 Tanngnjóstr 拉的戰車。
// 車上不做山羊本體，只取「戰車」「羊角螺旋」「雷」三個元素做成賽車零件與塗裝：
// 車身是低平的刀形車身（F1 刀鋒滑翔型）——前輪上方是隆起的擋泥板（輪上 32.3）、兩輪之間收腰（27.6）、後段收成窄車斗讓後輪整顆外露，
// 前擋泥板之間伸出一支細長的轅桿鼻（鼻尖 x 72、頂高 18.4、半寬 13.5），引擎蓋從鼻尖一路升到座艙後 34.6；
// 戰車 → 雙轅：兩根鍛銀轅桿從車斗座艙兩側沿引擎蓋往前收攏到鼻尖，兩桿之間是鍛鐵黑的凹槽與一道雷光藍細線；
//          （座艙後方接兩道鍛銀條到車尾，雙轅貫穿整台車）
//          軛：鼻尖上橫跨雙轅的青銅雙拱前翼（左右各一道套頸的拱）；車斗：只留 24 × 18 mm 小開口的橡木低座艙；
//          輪：窄車斗兩側外露的後輪就是戰車的大輪，側面兩輪之間再放一面 10 輻戰車輪徽記（號碼牌位置）。
// 羊角螺旋 → 尾翼端板：車尾一片後緣鋸齒的貼身平板翼，兩端各一面帶節環的青銅螺旋端板（直徑 18 mm、捲 1.5 圈，horn-volute 尾翼）。
// 雷 → 鋸齒切割塗裝：側面上半暗紅、下半鍛鐵黑，分界是一排往後倒的鋸齒，沿鋸齒一道鍛銀邊；輪拱內緣一道雷光藍發光縫。
// 設計：shared/design/body-tanngrisnir-chariot/DESIGN.md（典故 MYTH_RESEARCH N12、N16；車斗語彙 N3 Oseberg 四輪木車；黑名單 H6 不放雷神之鎚、不用盧恩）。
// 塗裝全為自創：暗紅亮面漆＋鍛鐵黑灰（緞面）＋鍛銀與青銅（金屬）＋橡木座艙（霧面）＋少量雷光藍；
// 不畫人、不放鎚、不用盧恩字母或任何被挪用的符號（鋸齒是單一道鋸齒邊，不是雙折線閃電），不含文字與商標。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp, sdRoundRect } from './loft.js';
import { monoCurve, buildStations } from './gazelleLeap.js';
import { buildProfileLiner } from './khepriScarab.js';
import { buildArchWell, chassisBlockedNearArch } from './kitsuneNinetail.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）：車尾 −63.5、前擋泥板前端約 60、轅桿鼻尖 72 */
const XS = [-63.5, -62, -58, -54, -50, -40, -20, 0, 18, 24, 30, 36, 44, 50, 55, 58, 60, 62, 66, 72];
/** @type {number[]} 俯視半寬的站位（兩輪之間多兩個腰身控制點） */
const XS_HW = [-63.5, -62, -58, -54, -50, -40, -26, -16, 0, 16, 26, 36, 44, 50, 55, 58, 60, 62, 66, 72];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 擋泥板頂面 / 邊沿高度：前輪上方是 32.3 的擋泥板隆起（31 mm 輪拱頂 30.5 之上）、後段是 32.4 的車斗邊沿，
  // 兩輪之間降到 27.6 成腰線（V1 / L1-2）；前擋泥板在 x 50 → 60 斜降收掉，再往前是轅桿鼻的邊沿（17.6）
  yR: monoCurve(XS, [28.6, 29, 30.5, 32, 32.4, 32.4, 28.6, 27.6, 28.2, 29, 31, 32.3, 32.3, 31, 28, 24.5, 21.5, 19.8, 18.6, 17.6]),
  // 中央高度：從鼻尖 18.4 一路往後升的連續斜面引擎蓋（車頭到座艙沒有垂直面，V3），座艙後方最高 34.6，
  // 車尾最後 4 mm 從 31.2 微微上翹到 31.8（鴨尾）
  yA: monoCurve(XS, [31.8, 31.2, 31.2, 32, 33, 34.4, 34.6, 33.6, 31.6, 30.4, 29, 27.6, 25.6, 23.8, 22.4, 21.4, 20.8, 20.2, 19.4, 18.4]),
  // 俯視半寬：前擋泥板最寬 38，兩輪之間 33.5，後段收成半寬 23 的窄車斗（後輪整顆露在車斗兩側，像戰車的外露大輪）；
  // 前擋泥板從 x 44 起往前斜收（前輪胎前外角露在殼外），剩中央一支半寬 18 → 13.5 的轅桿鼻
  hw: monoCurve(XS_HW, [22, 22.6, 23, 23, 23, 23, 26, 31, 33.5, 34, 36.5, 38, 38, 35, 28.5, 23, 20, 18, 15.5, 13.5]),
  // 側壁下緣
  yLow: monoCurve(XS, [18, 17, 16, 15.2, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15.2, 15.4, 15.5, 15.6, 15.6, 15.6]),
};

/** @type {number} 前擋泥板內緣（引擎蓋與擋泥板之間的內壁）|z| */
const Z_FENDER = 22;

/**
 * 半剖面 8 點：中線 → 引擎蓋 → 擋泥板內壁 → 擋泥板頂內緣（銳利）→ 頂外緣 → 圓肩 → 側壁 → 側壁下緣。
 * 轅桿鼻段半寬不到擋泥板內緣，內緣位置跟著半寬縮（半寬 − 4.4）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yR = P.yR(x);
  const yA = P.yA(x);
  const hw = P.hw(x);
  const lo = P.yLow(x);
  const zf = Math.min(Z_FENDER, hw - 4.4);
  // 中央比邊沿高的段是一個平滑拱面，拱高 c；中央比擋泥板低的段是凹形
  const c = yA - yR;
  if (c > 0) {
    return [
      [0, yA],
      [zf - 4, yR + 0.55 * c],
      [zf - 1.6, yR + 0.3 * c],
      [zf + 0.6, yR + 0.12 * c],
      [hw - 1.6, yR],
      [hw, yR - 1.8],
      [hw, lerp(yR - 1.8, lo, 0.6)],
      [hw + 0.6, lo],
    ];
  }
  return [
    [0, yA],
    [zf - 4, yA],
    [zf - 1.6, lerp(yA, yR, 0.6)],
    [zf + 0.6, yR],
    [hw - 1.6, yR],
    [hw, yR - 1.8],
    [hw, lerp(yR - 1.8, lo, 0.6)],
    [hw + 0.6, lo],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 車尾段每 0.75 mm 一站（坡度大）、鼻段每 1 mm，其餘每 2 mm */
const STATIONS = [...buildStations(-63.5, -50, 0.75, profile).slice(0, -1), ...buildStations(-50, 54, 2, profile).slice(0, -1), ...buildStations(54, 72, 1, profile)];

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（R17.5：31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];

/** @type {{ x0: number, x1: number, hz: number, r: number }} 車斗座艙（有蓋低座艙：24 × 18 mm 的小開口） */
const SEAT = { x0: -30, x1: -6, hz: 9, r: 4 };

/**
 * 車斗座艙凹槽，深 4 mm，底是橡木甲板
 * @type {any}
 */
const DECK = {
  id: '戰車座艙',
  view: 'top',
  shape: 'fn',
  sd: (x, y, z) => sdRoundRect(x, Math.abs(z), SEAT.x0, SEAT.x1, -SEAT.hz, SEAT.hz, SEAT.r),
  depth: 4,
};

/** @type {(t: number) => number} 夾在 0–1 */
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 主色：暗紅亮面漆（paint- 且 roughness ≤ 0.5 → Blender 亮面漆）
  red: namedMaterial('paint-oxblood-red', { color: 0x8a1f1b, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
  // 鍛鐵：緞面黑灰（側面下半、雙轅之間的凹槽、座艙口、尾翼平板與支柱）
  iron: namedMaterial('paint-forged-iron', { color: 0x34363b, roughness: 0.55, clearcoat: 0.12, clearcoatRoughness: 0.5 }),
  // 橡木車斗（霧面）：座艙地板與內壁
  deck: namedMaterial('paint-oak-deck', { color: 0x6a4529, roughness: 0.72, side: THREE.DoubleSide }),
  oakDark2: namedMaterial('paint-oak-dark', { color: 0x553621, roughness: 0.7, clearcoat: 0.05, side: THREE.DoubleSide }),
  // 真金屬：鍛銀轅桿（名稱含 steel → Blender metallic）、青銅軛與螺旋端板（含 -brass）
  steel: namedMaterial('trim-forged-silver-steel', { color: 0xc9cdd3, metalness: 0.85, roughness: 0.25, clearcoat: 0.3 }),
  bronze: namedMaterial('trim-bronze-brass', { color: 0xb07a3e, metalness: 0.8, roughness: 0.3, clearcoat: 0.2 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1c1712, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-iron', { color: 0x2e3034, roughness: 0.7, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-iron', { color: 0x2e3034, roughness: 0.7, side: THREE.DoubleSide }),
  // 貼紙：鋸齒銀邊、戰車輪徽記（深色底盤、銀輪箍、青銅輪輞與輻條）、雷光藍發光縫
  dSilver: decalMaterial('decal-forged-silver', { color: 0xd4d8de, metalness: 0.8, roughness: 0.24, clearcoat: 0.3 }),
  dBronze: decalMaterial('decal-bronze-spoke', { color: 0xb07a3e, metalness: 0.7, roughness: 0.35 }),
  dDark: decalMaterial('decal-wheel-disc-dark', { color: 0x1d1e21, roughness: 0.7 }),
  dGlow: decalMaterial('decal-thunder-glow', { color: 0x58b4ff, emissive: 0x2f8cff, emissiveIntensity: 0.9, roughness: 0.3 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

// ---------------------------------------------------------------------------
// 雙轅與軛
// ---------------------------------------------------------------------------

/** @type {number} 轅桿後端 x（座艙後緣旁） */
const POLE_X0 = -31;
/** @type {number} 轅桿前端 x（鼻尖後 1 mm） */
const POLE_X1 = 71;

/**
 * 轅桿中心線 |z|：座艙兩側平行（11.6，在座艙口鐵圈外），座艙前緣之後往前收攏到鼻尖 4.4
 * @type {(x: number) => number}
 */
const poleZ = (x) => (x < SEAT.x1 ? 11.6 : lerp(11.6, 4.4, clamp01((x - SEAT.x1) / (POLE_X1 - SEAT.x1)) ** 0.9));

/** @type {number} 軛的 x（鼻尖後 6 mm） */
const YOKE_X = 66;

// ---------------------------------------------------------------------------
// 螺旋端板（羊角螺旋）
// ---------------------------------------------------------------------------

/** @type {{ x: number, y: number, r: number, pitch: number, turns: number, z: number }} 螺旋中心、外半徑、每圈內縮量、圈數、端板中心 |z| */
const VOLUTE = { x: -59.5, y: 31.6, r: 9, pitch: 4.4, turns: 1.5, z: 29.8 };

/**
 * 螺旋端板的側視輪廓：一條由粗到細的帶子（寬 3.0 → 1.4 mm）從上前方的翼端起、往後往下捲 1.5 圈收到中心，
 * 外緣前 0.7 段有 11 道節環起伏（羊角的橫稜，振幅 0.35 mm 往內遞減）
 * @type {() => number[][]}
 */
const voluteOutline = () => {
  const n = 48;
  /** @type {number[][]} */
  const outer = [];
  /** @type {number[][]} */
  const inner = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = (70 * Math.PI) / 180 + 2 * Math.PI * VOLUTE.turns * s;
    const ridge = 0.35 * Math.max(0, 1 - s / 0.7) * Math.cos(2 * Math.PI * 11 * (s / 0.7));
    const ro = VOLUTE.r - VOLUTE.pitch * VOLUTE.turns * s;
    const ri = ro - lerp(3.0, 1.4, s);
    outer.push([VOLUTE.x + (ro + ridge) * Math.cos(a), VOLUTE.y + (ro + ridge) * Math.sin(a)]);
    inner.push([VOLUTE.x + ri * Math.cos(a), VOLUTE.y + ri * Math.sin(a)]);
  }
  return [...outer, ...inner.reverse()];
};

// ---------------------------------------------------------------------------
// 鋸齒切割塗裝與戰車輪徽記
// ---------------------------------------------------------------------------

/** @type {number} 鋸齒間距（mm） */
const SAW_PERIOD = 11;

/**
 * 側面紅 / 鐵分界高度：車頭 17 → 車尾 23 往後上升，疊一排往後倒的鋸齒（每 11 mm 一齒：往後慢慢升 2.4 mm、到齒尖後急降）
 * @type {(x: number) => number}
 */
const cutY = (x) => {
  const u = (((60 - x) / SAW_PERIOD) % 1 + 1) % 1;
  const saw = u < 0.85 ? u / 0.85 : (1 - u) / 0.15;
  return lerp(17, 23, clamp01((60 - x) / 122)) + 2.4 * saw;
};

/** @type {(x: number, z: number) => boolean} 側板 */
const onSide = (x, z) => Math.abs(z) >= P.hw(x) - 1.2;

/** @type {{ x: number, y: number, r: number, spokes: number }} 側面戰車輪徽記：兩輪之間的側板中央，10 根輻條（不做四輻十字輪） */
const EMBLEM = { x: 0, y: 20.6, r: 5.2, spokes: 10 };

/**
 * 戰車輪徽記的各層距離場（負值在內）：底盤（深色圓盤）、銀輪箍、青銅輪輞、輻條、輪轂
 * @type {(x: number, y: number) => { disc: number, tire: number, felloe: number, spoke: number, hub: number }}
 */
const emblemSd = (x, y) => {
  const W = EMBLEM;
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

export const tanngrisnirChariotBody = makePolyBody({
  id: 'body-tanngrisnir-chariot',
  name: '索爾的山羊戰車',
  style: 'myth',
  phase: 8,
  mythSeries: 'norse',
  mythTheme: 'thor-goat-chariot',
  form: 'twin-pole',
  roof: 'open-cockpit',
  wing: 'horn-volute',
  theme: '索爾的山羊戰車（雙轅刀形）：暗紅低平刀形車身，前擋泥板隆起、中段收腰、後段是後輪外露的窄車斗，前擋泥板之間伸出細長轅桿鼻；兩根鍛銀轅桿從橡木車斗座艙兩側沿引擎蓋收攏到鼻尖、鼻尖上橫跨一支青銅雙拱軛形前翼，車尾後緣鋸齒的貼身鍛鐵平板翼兩端是帶節環的青銅羊角螺旋端板；側面暗紅 / 鍛鐵黑以一排後倒鋸齒加鍛銀邊切開，中央一面 10 輻戰車輪徽記，輪拱與轅間凹槽有雷光藍發光縫',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 引擎蓋邊、擋泥板頂內緣、頂外緣是銳利稜線
  hard: [1, 3, 4],
  wheelArches: ARCHES,
  recesses: [DECK],
  innerSkipRecess: true,
  sideZMin: 30,
  zones: () => [
    // 鍛鐵座艙口：座艙開口一圈 1.6 mm 寬
    { mat: 'iron', keep: (x, y, z) => (y > P.yR(x) + 0.5 ? 1.6 - DECK.sd(x, y, z) : -1) },
    // 鍛鐵凹槽：座艙前緣到鼻尖、兩根轅桿之間
    { mat: 'iron', keep: (x, y, z) => (x > SEAT.x1 ? poleZ(x) - 0.4 - Math.abs(z) : -1) },
    // 鍛鐵下半：側板鋸齒分界以下
    { mat: 'iron', keep: (x, y, z) => (onSide(x, z) && x < 60 ? cutY(x) - y : -1) },
    { mat: 'red', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'iron', recess: 'deck', recessWall: 'oakDark2', mount: 'mount' },
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
    // 輪胎內側環形擋板（kitsune 的 buildArchWell，|z| 22.9 接內襯內緣成一個輪室）
    parts.push({
      geometry: mergeGeos(ARCHES.map((a) => buildArchWell(a, 22.9, 12.3, 17.8, chassisBlockedNearArch))),
      mat: 'liner',
      shell: true,
      name: 'arch-wells',
    });
    // 雙轅：兩根鍛銀扁桿（斷面 2.6 × 1.6 mm，半埋在殼面上）從座艙兩側沿引擎蓋往前收攏到鼻尖
    /** @type {number[]} */
    const poleXs = [POLE_X0, -22, -13, -5, 6, 18, 30, 42, 52, 60, 66, POLE_X1];
    const poles = [-1, 1].map((sg) =>
      sweepEllipse(
        poleXs.map((x) => [x, kit.surf.topY(x, poleZ(x)) + 0.3, sg * poleZ(x)]),
        24,
        () => [1.3, 0.8],
        6,
      ),
    );
    parts.push({ geometry: mergeGeos(poles), mat: 'steel', solid: true, outline: true, name: 'twin-poles' });
    // 軛形前翼：橫跨雙轅的青銅雙拱橫桿（扁斷面：弦長 4、厚 1.8 mm），中段壓在兩根轅桿上，左右各一道套頸的拱，翼尖微微上翹
    const yokeY = kit.surf.topY(YOKE_X, poleZ(YOKE_X)) + 1.4;
    /** @type {number[][]} 軛的半邊中心線 (|z|, 相對高度) */
    const yokeHalf = [
      [0, 0.2],
      [4.8, 0],
      [9.6, 1.8],
      [14.6, -0.9],
      [19.5, 0.4],
    ];
    /** @type {number[][]} */
    const yokePts = [...yokeHalf.slice(1).reverse().map(([z, dy]) => [YOKE_X, yokeY + dy, -z]), ...yokeHalf.map(([z, dy]) => [YOKE_X, yokeY + dy, z])];
    parts.push({ geometry: sweepEllipse(yokePts, 24, () => [2.0, 0.9], 6), mat: 'bronze', solid: true, outline: true, name: 'yoke-front-wing' });
    // 尾翼：貼身鍛鐵平板翼（厚 1.2 mm，翼面 y 37.6–38.8；前緣後掠、後緣左右各三支往後倒的鋸齒）
    // ＋兩端的青銅羊角螺旋端板（厚 1.6 mm，掛在翼端，在外露後輪的後上方）
    const zTip = VOLUTE.z - 0.8;
    /** @type {number[][]} 後緣鋸齒（右半，由翼端往中線）：(x, |z| / 翼端 |z|) */
    const teeth = [
      [-67, 1],
      [-63.5, 0.67],
      [-66, 0.67],
      [-63, 0.33],
      [-65.5, 0.33],
    ];
    parts.push({
      geometry: flatPlate(
        [
          [-56, -zTip],
          [-53, 0],
          [-56, zTip],
          ...teeth.map(([x, f]) => [x, f * zTip]),
          [-62.5, 0],
          ...[...teeth].reverse().map(([x, f]) => [x, -f * zTip]),
        ],
        37.6,
        1.2,
      ),
      mat: 'iron',
      solid: true,
      outline: true,
      name: 'rear-wing-plate',
    });
    // 尾翼支柱：車斗尾端左右各一片後傾薄板（厚 1.4 mm），從蓋板撐到翼面下
    parts.push({
      geometry: mergeGeos(
        [-1, 1].map((sg) =>
          finPlate(
            [
              [-56, 30.4],
              [-54.5, 37.8],
              [-61, 37.8],
              [-62, 30.4],
            ],
            sg * 12,
            1.4,
          ),
        ),
      ),
      mat: 'iron',
      solid: true,
      outline: true,
      name: 'rear-wing-struts',
    });
    const volute = voluteOutline();
    parts.push({
      geometry: mergeGeos([-1, 1].map((sg) => finPlate(volute, sg * VOLUTE.z, 1.6))),
      mat: 'bronze',
      solid: true,
      outline: true,
      name: 'horn-volute-endplates',
    });
    // 鋸齒分界上的鍛銀邊（0.9 mm，貼著鋸齒走，徽記範圍內斷開）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z) || x > 60 || x < -62 || emblemSd(x, y).disc < 0.7) {
          return -1;
        }
        const d = y - cutY(x);
        return Math.min(d, 0.9 - d);
      }, { offset: 0.12 }),
      mat: 'dSilver',
      name: 'decal-saw-cut-edge',
    });
    // 轅桿往後的延伸線：座艙後緣到車尾左右各一道 2 mm 鍛銀條（接在轅桿後端，尾翼支柱就立在這兩道線上），讓雙轅貫穿整台車
    parts.push({
      geometry: kit.decal((x, y, z) => (x < POLE_X0 && x > -62 ? 1.0 - Math.abs(Math.abs(z) - poleZ(x)) : -1), { offset: 0.12 }),
      mat: 'dSilver',
      name: 'decal-pole-tail-stripes',
    });
    // 戰車輪徽記：深色底盤 → 銀輪箍 → 青銅輪輞與 10 根輻條 → 銀輪轂，逐層加高
    parts.push({
      geometry: kit.decal((x, y, z) => (onSide(x, z) ? -emblemSd(x, y).disc : -1), { offset: 0.1 }),
      mat: 'dDark',
      name: 'decal-wheel-emblem-disc',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        const w = emblemSd(x, y);
        return -Math.min(w.tire, w.hub);
      }, { offset: 0.35 }),
      mat: 'dSilver',
      name: 'decal-wheel-emblem-tire',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        const w = emblemSd(x, y);
        return -Math.min(w.felloe, Math.max(w.spoke, -w.hub));
      }, { offset: 0.3 }),
      mat: 'dBronze',
      name: 'decal-wheel-emblem-spokes',
    });
    // 雷光藍發光縫：前後輪拱切口外緣一道 0.9 mm 的發光線，加上雙轅之間凹槽中線一道 0.8 mm 細線（座艙前緣到軛）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z)) {
          let d = Infinity;
          for (const a of ARCHES) {
            d = Math.min(d, Math.abs(Math.hypot(x - a.x, y - a.y) - a.radius - 0.6) - 0.45);
          }
          return -d;
        }
        if (x > SEAT.x1 + 4 && x < YOKE_X - 4) {
          return 0.4 - Math.abs(z);
        }
        return -1;
      }, { offset: 0.2 }),
      mat: 'dGlow',
      name: 'decal-thunder-glow',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估）：車殼 x −63.5 ~ 72；引擎蓋中線從鼻尖 18.4 升到座艙後 34.6、車尾 31.8；擋泥板邊沿輪上 32.3（31 mm 輪拱頂 30.5 之上）、兩輪之間 27.6；半寬前擋泥板 38（蓋住 31 mm 輪胎外側面 34.75）、兩輪之間 33.5、後段窄車斗 23（後輪外露）、車尾 22、轅桿鼻 18 → 13.5',
    cockpit: '座艙開口 x −30 ~ −6、|z| ≤ 9（深 4 mm，推估）；車頭是沒有開口的連續斜面引擎蓋',
    poles: '雙轅為實心 ABS 扁桿（斷面 2.6 × 1.6 mm，24 × 6 段），x −31 ~ 71，|z| 從座艙兩側 11.6 收攏到鼻尖 4.4，中心線在殼面上 0.3 mm（半埋），座艙後緣到車尾接兩道 2 mm 鍛銀貼紙條；質量 = 封閉體積 × 1.05 g/cm³（推估）',
    yoke: '軛形前翼為實心 ABS 扁桿（弦長 4、厚 1.8 mm，24 × 6 段），x 66、翼展 ±19.5，中段壓在轅桿上，兩側各一道高 1.8 mm 的拱；不超出鼻尖、不在鼻子下方（推估）',
    wing: '尾翼平板為實心 ABS（厚 1.2 mm，x −67 ~ −53、翼展 ±29、翼面 y 37.6–38.8，後緣左右各三支鋸齒）；螺旋端板為實心 ABS 片（厚 1.6 mm，中心 x −59.5 / y 31.6、外半徑 9、每圈內縮 4.4、捲 1.5 圈、帶寬 3.0 → 1.4 mm、11 道節環），|z| 29–30.6，離 31 mm 後輪胎面約 2.4 mm；支柱 2 片厚 1.4 mm、|z| 12（推估）',
    livery: '側面紅 / 鐵分界 y 17（車頭）→ 23（車尾），鋸齒間距 11 mm、齒高 2.4 mm，鍛銀邊 0.9 mm；單一道鋸齒邊，不是雙折線閃電（MYTH_RESEARCH H9）；戰車輪徽記半徑 5.2、10 輻；雷光藍發光縫 0.8–0.9 mm；皆為自繪（推估）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm），可裝 26 / 31 mm 輪；內襯從 |z| 33 到殼內面，輪胎內側另有 buildArchWell 環形擋板（|z| 22.9）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
