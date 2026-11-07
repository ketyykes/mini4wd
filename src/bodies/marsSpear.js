// 瑪爾斯長矛（body-mars-spear，神話組・羅馬）——照四視圖 03 建模的刀鋒楔形車：細長的矛尖鼻 → 長而低的座艙 → 一路升高的後甲板 → 車尾兩角往上勾的鴨尾。
// 只用瑪爾斯的持物，不做人像：
// 長矛 → 整台車就是一支矛：座艙罩前端起一條凸起的黑色矛桿縱脊，接上兩叉鼻中央凹槽裡的金色葉形矛尖（中脊凸起、銎口套環），中線黑色矛桿貫穿到車尾的菱形尖鐏。
// 圓盾 → 前後輪之間兩側各一面放大的金色浮雕圓盾（R8、黑色外緣、兩圈同心浮雕環、盾心凸起、一圈鉚釘）。
// 羅馬軍團 → 黑色斜切側板（金色描線）、金色後肩甲、沿板緣與矛桿兩側的金色鉚釘列。
// 配色：深紅為主、黑為圖形色（斜切側板、矛桿、鼻部凹槽）、金為點綴（矛尖、圓盾浮雕、尾鉤、後肩甲、鉚釘），羅馬軍團的紅黑金。剖面是折線（多稜面），和同為羅馬、圓潤柔和的 venus-scallop 明顯不同。
// 四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-mars-spear/DESIGN.md。剖面為本檔站位產生器（推估）。塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody, finPlate, flatPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, buildArchLiner } from './gazelleLeap.js';
import { buildBellySkirt } from './trojanHorse.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）；車尾 −70、鼻尖 77.5 */
const XS = [-70, -66, -60, -52, -44, -36, -26, -14, 0, 12, 24, 34, 42, 50, 57, 63, 68, 73, 77.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線（矛桿）頂：車尾尖鐏脊 37.4 → 後甲板一路降 → 引擎蓋 → 兩叉鼻之間的凹槽底（鼻尖 15.6，比兩叉稜線低 2.6）
  yHood: monoCurve(XS, [37.4, 36.4, 35.6, 34, 33.6, 33, 32.4, 31.8, 31.2, 30.8, 30.2, 29.6, 28.6, 26.4, 22.4, 19, 17.2, 16.2, 15.6]),
  // 擋泥板稜：車尾 34.8（比中線尖鐏脊低，車尾斷面是中央翹起的屋脊形）、後輪 34.4、側艙 27.6、前輪 33.6
  yD: monoCurve(XS, [34.6, 34.2, 33.8, 33.6, 33.4, 32.6, 30.2, 28.4, 27.6, 27.8, 29.6, 32.6, 33.6, 32.4, 29, 25.6, 22.6, 20.2, 18.2]),
  // 半寬：車尾 30、後輪 36.6（剛好包住輪胎），前輪後方外擴成放圓盾的側艙（x 12–24 半寬 45.8，往前延伸到 x 34 仍 42）、前輪 36.4，從 x 46 起收成兩叉鼻（x 57 半寬 18.6、鼻尖 10，中央是放矛尖的凹槽）
  hw: monoCurve(XS, [30, 31.4, 34, 36.6, 36.6, 36, 36.6, 38.4, 44, 45.8, 45.8, 42, 36.4, 28.4, 18.6, 14, 12, 10.8, 10]),
  yLow: monoCurve(XS, [26, 22.6, 17, 13.6, 13, 13.4, 14.6, 15.6, 15.8, 15.8, 15, 13, 13, 13.6, 14, 14.4, 14.6, 14.8, 15]),
};

/** @type {number[]} 座艙罩前後端 x（長而低） */
const CAN_X = [-20, 40];
/** @type {(x: number) => number} */
const canRaw = monoCurve([-20, -12, 0, 10, 22, 32, 40], [0, 4, 5.8, 6, 4.4, 1.8, 0]);
/** @type {(x: number) => number} 座艙罩高出甲板的量 */
const canH = (x) => (x <= CAN_X[0] || x >= CAN_X[1] ? 0 : Math.max(0, canRaw(x)));
/** @type {(x: number) => number} 座艙罩半寬（前端收尖，像矛頭的延伸） */
const canW = monoCurve([-20, -10, 4, 18, 30, 40], [6.5, 10, 10.6, 9, 6, 2.5]);

/** @type {(x: number) => number} 腰線稜高度 */
const beltY = (x) => P.yD(x) - Math.min(4.6, 0.42 * (P.yD(x) - P.yLow(x)));

/**
 * 半剖面 8 點（折線、每點都是稜線）：中線 → 座艙罩肩 → 座艙罩底緣 → 甲板斜面 → 擋泥板稜 → 腰線稜（最寬）→ 下半側面內收稜 → 下緣
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yc = P.yHood(x);
  const h = canH(x);
  const hw = P.hw(x);
  const cw = Math.max(0.3, Math.min(canW(x), hw - 7, 0.5 * hw));
  const yD = P.yD(x);
  const yLow = P.yLow(x);
  const yBelt = beltY(x);
  const sh = Math.min(4.4, 0.3 * (hw - cw));
  return [
    [0, yc + h],
    [0.55 * cw, yc + 0.8 * h],
    [cw, yc + 0.05 * h],
    [cw + 0.5 * (hw - sh - cw), lerp(yc, yD, 0.5)],
    [hw - sh, yD],
    [hw, yBelt],
    [hw - 1.6, lerp(yBelt, yLow, 0.5)],
    [hw - 2.6, yLow],
  ];
};

/** @type {{ x: number, pts: number[][] }[]} 每 2 mm 一站（最後一站在矛尖 77.5） */
const STATIONS = buildStations(-70, 77.5, 2, profile);

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後輪拱（31 mm 輪胎半徑 15.5 + 2 mm） */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];
/** @type {(x: number, y: number) => number} 側視到最近輪拱圓周的距離（正值 = 在輪拱切口外） */
const archRingDist = (x, y) => Math.min(...ARCHES.map((a) => Math.hypot(x - a.x, y - a.y) - a.radius));

/** @type {(x: number, z: number) => boolean} 在座艙罩上 */
const onCanopy = (x, z) => canH(x) > 0.5 && Math.abs(z) < Math.max(0.3, Math.min(canW(x), P.hw(x) - 7, 0.5 * P.hw(x))) - 0.3;
/** @type {(x: number, z: number) => boolean} 側面（腰線稜附近以下） */
const onSide = (x, z) => Math.abs(z) > P.hw(x) - 3.2;

/**
 * 矛桿半寬：矛頭段是中脊兩側 1.6、桿身 2.4，車尾 x −50 以後放寬成菱形的尖鐏（最寬 6.5 在 x −61，車尾收到 1）
 * @type {(x: number) => number}
 */
const shaftHw = (x) => {
  if (x > 50) {
    return 1.6;
  }
  if (x > -50) {
    return 2.4;
  }
  if (x > -61) {
    return lerp(2.4, 6.5, (-50 - x) / 11);
  }
  return lerp(6.5, 1, (-61 - x) / 9);
};

/** @type {number[][]} 金斜切側板（側視 x–y 多邊形，前高後低再翹起，沿腰線稜下方） */
const PANEL = [
  [54, 25.6],
  [30, 27.4],
  [-16, 26.6],
  [-30, 30],
  [-36, 22],
  [-24, 13.2],
  [22, 12.6],
  [48, 17],
];
/** @type {number[][]} 後擋泥板頂的金肩甲（俯視 x–|z| 多邊形） */
const REAR_POD = [
  [-28, 34],
  [-40, 27],
  [-58, 27],
  [-69, 33],
  [-69, 40],
  [-28, 40],
];

/** @type {(poly: number[][], x: number, y: number) => number} 到多邊形邊界的有號距離（正值 = 在多邊形內） */
const polySd = (poly, x, y) => {
  let inside = false;
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    const dx = xj - xi;
    const dy = yj - yi;
    const t = Math.max(0, Math.min(1, ((x - xi) * dx + (y - yi) * dy) / (dx * dx + dy * dy)));
    d = Math.min(d, Math.hypot(x - xi - t * dx, y - yi - t * dy));
  }
  return inside ? d : -d;
};
/** @type {(x: number, y: number) => number} 到金斜切側板邊界的有號距離 */
const panelSd = (x, y) => polySd(PANEL, x, y);
/** @type {(x: number, z: number) => number} 到前後金肩甲的有號距離 */
const podSd = (x, z) => polySd(REAR_POD, x, Math.abs(z));

/** @type {{ x: number, y: number, r: number }} 側艙圓盾（側視中心與半徑） */
const SHIELD = { x: 3, y: 20.4, r: 8 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  red: namedMaterial('paint-deep-red', { color: 0x860e16, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 }),
  black: namedMaterial('paint-black-satin', { color: 0x141416, roughness: 0.42, clearcoat: 0.5 }),
  black2: namedMaterial('paint-black-satin', { color: 0x141416, roughness: 0.42, clearcoat: 0.5, side: THREE.DoubleSide }),
  // 金（真金屬）
  gold: namedMaterial('trim-legion-brass', { color: 0xcf9f45, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  gold2: namedMaterial('trim-legion-brass', { color: 0xcf9f45, metalness: 0.85, roughness: 0.28, clearcoat: 0.3, side: THREE.DoubleSide }),
  red2: namedMaterial('paint-deep-red', { color: 0x860e16, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  bronze: namedMaterial('trim-bronze-rivet', { color: 0xa8703a, metalness: 0.85, roughness: 0.32 }),
  canopy: namedMaterial('pc-smoke-tint', { color: 0x1c1416, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1a1a, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-red', { color: 0x8a1218, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-dark', { color: 0x1a1616, roughness: 0.8, side: THREE.DoubleSide }),
  dBlack: decalMaterial('decal-black', { color: 0x121214, roughness: 0.45 }),
  dGold: decalMaterial('decal-legion-gold', { color: 0xd6a84c, roughness: 0.28, metalness: 0.8 }),
  dRivet: decalMaterial('decal-gold-rivet', { color: 0x8a6424, roughness: 0.36, metalness: 0.75 }),
  // 矛頭兩側的斜縫頭燈：暖白低強度自發光
  dLamp: decalMaterial('decal-lamp-slit', { color: 0xfff0dc, emissive: 0xffe2b8, emissiveIntensity: 0.5, roughness: 0.25 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {import('./polyBody.js').PolyBodyConfig} */
const CONFIG = {
  id: 'body-mars-spear',
  name: '瑪爾斯長矛',
  style: 'myth',
  phase: 13,
  mythSeries: 'roman',
  mythTheme: 'mars',
  form: 'spear-wedge',
  roof: 'canopy',
  wing: 'spike-ducktail',
  theme: '照四視圖 03 的刀鋒楔形車：座艙罩前端起凸起的黑色矛桿縱脊，鼻部做成兩叉、中央黑色凹槽裡躺著一支有中脊的金色葉形矛尖；長而低的煙燻座艙；一路升高的後甲板、車尾兩角往上勾的金色尖鉤鴨尾與深紅尾唇；黑色斜切側板上一面放大的金色浮雕圓盾（黑外緣、兩圈同心浮雕環、盾心凸起、鉚釘）；矛桿兩側與板緣的金色鉚釘列；折線多稜面剖面；羅馬軍團的紅＋黑＋金',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  // 殼面網格放寬到 0.6 mm（維持面數與碰撞格耗時）
  step: 0.6,
  wheelArches: ARCHES,
  sideZMin: 22,
  zones: () => [
    { mat: 'canopy', keep: (x, y, z) => (onCanopy(x, z) ? 1 : -1) },
    // 黑色下緣（腰線以下 3 mm 以下的裙板）
    { mat: 'black', keep: (x, y, z) => (onSide(x, z) && y < P.yLow(x) + 2.2 ? 1 : -1) },
    // 金斜切側板與前後擋泥板頂的金肩甲
    { mat: 'black', keep: (x, y, z) => (onSide(x, z) ? panelSd(x, y) : -1) },
    { mat: 'gold', keep: (x, y, z) => (onSide(x, z) ? -1 : podSd(x, z)) },
    // 兩叉鼻之間的中央凹槽（黑，矛尖躺在裡面）
    { mat: 'black', keep: (x, y, z) => (x > 52 && !onSide(x, z) ? Math.min(0.62 * P.hw(x) - Math.abs(z), x - 52) : -1) },
    { mat: 'red', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];

    // ── 圓盾浮雕：金色盾面（24 段圓板，厚 1.6，半埋進側壁）＋黑色外緣環＋兩圈同心金色浮雕環＋盾心凸起＋一圈 8 顆鉚釘 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const face = [];
      /** @type {THREE.BufferGeometry[]} */
      const rim = [];
      /** @type {THREE.BufferGeometry[]} */
      const studs = [];
      const zw = P.hw(SHIELD.x) - 1.1;
      for (const sg of [-1, 1]) {
        const disc = new THREE.CylinderGeometry(SHIELD.r, SHIELD.r, 1.6, 24);
        disc.rotateX(Math.PI / 2);
        disc.translate(SHIELD.x, SHIELD.y, sg * (zw + 0.3));
        face.push(disc);
        const ring = new THREE.TorusGeometry(SHIELD.r - 0.4, 0.8, 6, 32);
        ring.translate(SHIELD.x, SHIELD.y, sg * (zw + 1.1));
        rim.push(ring);
        const ring2 = new THREE.TorusGeometry(0.55 * SHIELD.r, 0.45, 6, 28);
        ring2.translate(SHIELD.x, SHIELD.y, sg * (zw + 1.3));
        studs.push(ring2);
        const ring3 = new THREE.TorusGeometry(0.3 * SHIELD.r + 1.2, 0.35, 6, 24);
        ring3.translate(SHIELD.x, SHIELD.y, sg * (zw + 1.15));
        studs.push(ring3);
        const boss = new THREE.SphereGeometry(2.4, 16, 10);
        boss.scale(1, 1, 0.6);
        boss.translate(SHIELD.x, SHIELD.y, sg * (zw + 1.1));
        studs.push(boss);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
          const st = new THREE.SphereGeometry(0.6, 8, 6);
          st.translate(SHIELD.x + 0.78 * SHIELD.r * Math.cos(a), SHIELD.y + 0.78 * SHIELD.r * Math.sin(a), sg * (zw + 1.15));
          studs.push(st);
        }
      }
      parts.push({ geometry: mergeGeos(face), mat: 'gold', solid: true, outline: true, name: 'shield-face' });
      parts.push({ geometry: mergeGeos(rim), mat: 'black', solid: true, outline: true, name: 'shield-rims' });
      parts.push({ geometry: mergeGeos(studs), mat: 'gold', solid: true, outline: true, name: 'shield-relief' });
    }

    /** @type {(x: number, z: number) => number} 殼面高度 */
    const top = (x, z) => kit.surf.topY(x, z);

    // ── 長矛：座艙罩前端到鼻部的黑色矛桿縱脊（厚 2.4、高出殼面 1.6）＋金葉形矛尖（中脊高 1.4，尖端到鼻尖） ──
    {
      /** @type {number[][]} */
      const ridge = [];
      for (let x = 38; x <= 54; x += 2) {
        ridge.push([x, top(x, 0) + 1.6]);
      }
      for (let x = 54; x >= 38; x -= 2) {
        ridge.push([x, top(x, 0) - 1]);
      }
      parts.push({ geometry: finPlate(ridge, 0, 2.4), mat: 'black2', solid: true, name: 'spear-shaft-ridge' });
      /** @type {number[][]} */
      const rib = [];
      for (let x = 53; x <= 75; x += 2) {
        rib.push([x, top(x, 0) + 1.4 * Math.min(1, (76.6 - x) / 6)]);
      }
      rib.push([76.6, top(76.6, 0)]);
      for (let x = 75; x >= 53; x -= 2) {
        rib.push([x, top(x, 0) - 0.8]);
      }
      // 矛頭銎口：矛桿接矛尖的套環
      const socket = new THREE.BoxGeometry(2.2, 2.6, 4.2);
      socket.translate(54, top(54, 0) + 0.6, 0);
      parts.push({ geometry: mergeGeos([finPlate(rib, 0, 1.4), socket]), mat: 'gold2', solid: true, name: 'spearhead-midrib' });
    }

    // ── 上翹鴨尾：車尾兩角往上勾的金尖鉤立板＋兩鉤之間的深紅尾唇 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const hooks = [];
      for (const sg of [-1, 1]) {
        const z = sg * 29.5;
        hooks.push(finPlate([[-58, top(-58, z) - 0.6], [-66, 38.6], [-71.4, 41], [-71.6, 38], [-70, top(-70, z) - 0.6]], z, 1.2));
      }
      parts.push({ geometry: mergeGeos(hooks), mat: 'gold2', solid: true, outline: true, name: 'ducktail-hooks' });
      parts.push({
        geometry: flatPlate([[-64, -29], [-64, 29], [-71.4, 29], [-71.4, -29]], 37.2, 0.6),
        mat: 'red2',
        solid: true,
        outline: true,
        name: 'ducktail-lip',
      });
    }

    // ── 下緣內襯：兩輪之間、側艙下方的黑色封板，擋住底盤側框與電池艙 ──
    parts.push({
      geometry: buildBellySkirt({ x0: -21, x1: 21, zIn: (x) => P.hw(x) - 1.2, zOut: 38, yTop: Math.min(P.yLow(-21), P.yLow(21)) - 0.4, t: 0.5 }),
      mat: 'black2',
      solid: true,
      name: 'belly-liner',
    });

    // 輪拱內襯（前後）
    parts.push({
      geometry: mergeGeos([buildArchLiner(ARCHES[0], 21, 33.4, 0.35, Math.PI - 0.35), buildArchLiner(ARCHES[1], 21, 34.4, 0.35, Math.PI - 0.35)]),
      mat: 'liner',
      shell: true,
      name: 'arch-liners',
    });

    // ── 貼紙 ──
    // 矛桿：中線黑帶，從矛尖貫穿到車尾（座艙罩上斷開）
    parts.push({
      geometry: kit.decal((x, y, z) => (onCanopy(x, z) || x > 76 ? -1 : shaftHw(x) - Math.abs(z))),
      mat: 'dBlack',
      name: 'decal-spear-shaft',
    });
    // 矛頭：x 44 → 76 整片金葉形矛尖（最寬在 x 56，半寬 9）＋矛桿兩側的金細線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onCanopy(x, z) || onSide(x, z) || x > 76.5) {
          return -1;
        }
        const az = Math.abs(z);
        // 矛尖葉形：x 44 → 76（最寬在 x 56，半寬 9）
        const t = (x - 44) / 32;
        const leaf = t > 0 && t < 1 ? 9 * Math.sin(Math.PI * Math.pow(1 - t, 0.75)) : -9;
        const blade = t > 0 && t < 1 ? leaf - az : -1;
        const edge = x < 44 ? 0.3 - Math.abs(az - shaftHw(x) - 0.5) : -1;
        return Math.max(blade, edge);
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-spearhead-lines',
    });
    // 金色鉚釘列：側板上緣每 4 mm 一顆、矛桿兩側每 5 mm 一對
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onCanopy(x, z)) {
          return -1;
        }
        if (onSide(x, z)) {
          const d = panelSd(x, y);
          if (d < 0.8 || d > 2.8) {
            return -1;
          }
          const ph = ((x % 4) + 4) % 4;
          return Math.min(0.55 - Math.hypot(Math.min(ph, 4 - ph), d - 1.8), archRingDist(x, y) - 0.8);
        }
        if (x > 44 || x < -66) {
          return -1;
        }
        const ph = ((x % 5) + 5) % 5;
        return 0.5 - Math.hypot(Math.min(ph, 5 - ph), Math.abs(z) - shaftHw(x) - 2);
      }, { offset: 0.12 }),
      mat: 'dRivet',
      name: 'decal-legion-rivets',
    });
    // 金側板與肩甲邊緣的金色描線（四視圖的切面描線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const panelEdge = onSide(x, z) ? Math.min(0.35 - Math.abs(panelSd(x, y)), archRingDist(x, y) - 0.5) : 0.35 - Math.abs(podSd(x, z));
        return panelEdge;
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-panel-edge',
    });
    // 側艙頂面的分片甲帶（羅馬軍團板甲的分片）：x −14 → 22 每 6 mm 一道金帶（寬 2.6），帶上兩端各一顆鉚釘
    /** @type {(x: number, z: number) => boolean} 在側艙頂面（座艙罩與矛桿之外、側面以上） */
    const onPodTop = (x, z) => x > -14 && x < 22 && !onSide(x, z) && Math.abs(z) > Math.max(0.3, Math.min(canW(x), P.hw(x) - 7, 0.5 * P.hw(x))) + 3;
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onPodTop(x, z)) {
          return -1;
        }
        const ph = (((x + 14) % 6) + 6) % 6;
        return Math.min(1.3 - Math.abs(ph - 3), Math.abs(z) - 13, P.hw(x) - 3.6 - Math.abs(z));
      }, { offset: 0.1 }),
      mat: 'dGold',
      name: 'decal-segment-bands',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onPodTop(x, z)) {
          return -1;
        }
        const ph = (((x + 14) % 6) + 6) % 6;
        const ends = Math.min(Math.abs(Math.abs(z) - 14.4), Math.abs(Math.abs(z) - (P.hw(x) - 5)));
        return 0.55 - Math.hypot(ph - 3, ends);
      }, { offset: 0.14 }),
      mat: 'dRivet',
      name: 'decal-segment-rivets',
    });
    // 側板後段的斜切進氣口（黑色，三道金百葉線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onSide(x, z)) {
          return -1;
        }
        const inBox = Math.min(x + 31, -16 - x, y - 16, 23.5 - y - 0.45 * (x + 16));
        return Math.min(inBox, panelSd(x, y) - 1);
      }, { offset: 0.1 }),
      mat: 'dBlack',
      name: 'decal-side-intake',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，比例照四視圖 03）：殼 x −70 → 77.5；中線 車尾尖鐏脊 38.8 → 後甲板 → 矛尖 16；座艙罩高出甲板 6（頂 ≈ 37）；擋泥板稜 車尾 37、後輪 34.4、側艙 27.6、前輪 33.6；半寬 車尾 34、後輪 36.6、側艙 45.2、前輪 36.4、x 57 收到 20、x 68 收到 7.5、矛尖 1.2；折線剖面（每點都是稜線）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯用 gazelle 的 buildArchLiner',
    shield: '圓盾：金圓板（R6.2、厚 1.6、16 段）、黑色盾緣環（Torus 24 × 6）、盾心凸起（16 × 10）、8 顆鉚釘（8 × 6），皆為實心 ABS 件，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    symbols: '長矛與盾：Wikipedia〈Mars (mythology)〉——矛是瑪爾斯的持物（Regia 收藏的「瑪爾斯之矛」）、Mars Ultor 右手倚長矛左手持盾；Salii 祭司持 12 面聖盾 ancilia 遊行（Wikipedia〈Ancile〉）。本款依 GOAL 用圓盾，造型皆為抽象化的車身零件與貼紙，不出人像',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

/** @type {import('./types').BodyDef} */
export const marsSpearBody = makePolyBody(CONFIG);
