// 瑪爾斯長矛（body-mars-spear，神話組・羅馬）——照四視圖 03 建模的刀鋒楔形車：細長的矛尖鼻 → 長而低的座艙 → 一路升高的後甲板 → 車尾整片上翹的尖鉤鴨尾。
// 只用瑪爾斯的持物，不做人像：
// 長矛 → 整台車就是一支矛：鼻部是有中脊的葉形矛頭（俯視收成尖），中線一條黑色矛桿從矛頭貫穿到車尾，車尾上翹的鴨尾是矛桿末端的尖鐏。
// 圓盾 → 前後輪之間兩側各一面紅銅圓盾面板（盾心凸起、黑色盾緣、一圈鉚釘）。
// 羅馬軍團 → 紅銅斜切側板、沿板緣與矛桿兩側的紅銅鉚釘列。
// 配色：戰紅為主、黑為圖形色、紅銅為點綴（金屬）。剖面是折線（多稜面），和同為羅馬、圓潤柔和的 venus-scallop 明顯不同。
// 四個 R17.5 輪拱：31 mm 大輪不切輪拱也能裝。
// 設計：shared/design/body-mars-spear/DESIGN.md。剖面為本檔站位產生器（推估）。塗裝全為自創，不含任何廠商 / 作品名稱、商標或文字。
import * as THREE from 'three';
import { makePolyBody } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, buildArchLiner } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/** @type {number[]} 站位參數表（x 由後到前，前後軸 x = ±40）；車尾 −70、鼻尖 77.5 */
const XS = [-70, -66, -60, -52, -44, -36, -26, -14, 0, 12, 24, 34, 42, 50, 57, 63, 68, 73, 77.5];
/** @type {Record<string, (x: number) => number>} */
const P = {
  // 中線（矛桿）頂：車尾尖鐏脊 38.8（矛桿末端在中線翹起）→ 後甲板一路降 → 引擎蓋 → 矛尖 16
  yHood: monoCurve(XS, [38.8, 37.2, 35.6, 34, 33.6, 33, 32.4, 31.8, 31.2, 30.8, 30.2, 29.6, 28.6, 26.4, 23.2, 20.6, 18.6, 17.2, 16]),
  // 擋泥板稜：車尾 34.8（比中線尖鐏脊低，車尾斷面是中央翹起的屋脊形）、後輪 34.4、側艙 27.6、前輪 33.6
  yD: monoCurve(XS, [34.8, 34.8, 34.6, 34.6, 34.4, 33, 30.2, 28.4, 27.6, 27.8, 29.6, 32.6, 33.6, 32.4, 28, 23.6, 20.4, 17.8, 16]),
  // 半寬：車尾 34、後輪 36.6（剛好包住輪胎），前輪後方外擴成放圓盾的側艙（x 12–24 半寬 45.2，往前延伸到 x 34 仍 41.4）、前輪 36.4，從 x 46 起收成細長的葉形矛頭（x 57 半寬 20、x 68 半寬 7.5、鼻尖 1.2）
  hw: monoCurve(XS, [34, 35, 36, 36.6, 36.6, 36, 36.6, 38.4, 43, 45.2, 45.2, 41.4, 36.4, 31.6, 20, 12, 7.5, 4.2, 1.2]),
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

/** @type {number[][]} 紅銅斜切側板（側視 x–y 多邊形，前高後低再翹起，沿腰線稜下方） */
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
/** @type {number[][]} 前擋泥板頂的紅銅肩甲（俯視 x–|z| 多邊形） */
const FRONT_POD = [
  [46, 23],
  [57, 17.5],
  [66, 11],
  [63, 20],
  [54, 33],
  [46, 35],
];
/** @type {number[][]} 後擋泥板頂的紅銅肩甲（俯視 x–|z| 多邊形） */
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
/** @type {(x: number, y: number) => number} 到紅銅斜切側板邊界的有號距離 */
const panelSd = (x, y) => polySd(PANEL, x, y);
/** @type {(x: number, z: number) => number} 到前後紅銅肩甲的有號距離 */
const podSd = (x, z) => Math.max(polySd(FRONT_POD, x, Math.abs(z)), polySd(REAR_POD, x, Math.abs(z)));

/** @type {{ x: number, y: number, r: number }} 側艙圓盾（側視中心與半徑） */
const SHIELD = { x: 10, y: 21, r: 6.2 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  red: namedMaterial('paint-war-red', { color: 0xa3141c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 }),
  black: namedMaterial('paint-black-satin', { color: 0x141416, roughness: 0.42, clearcoat: 0.5 }),
  black2: namedMaterial('paint-black-satin', { color: 0x141416, roughness: 0.42, clearcoat: 0.5, side: THREE.DoubleSide }),
  // 紅銅（真金屬：名稱以 -copper 結尾）
  copper: namedMaterial('trim-red-copper', { color: 0xc06a3c, metalness: 0.85, roughness: 0.3, clearcoat: 0.3 }),
  canopy: namedMaterial('pc-smoke-tint', { color: 0x1c1416, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1a1a, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-red', { color: 0x8a1218, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-dark', { color: 0x1a1616, roughness: 0.8, side: THREE.DoubleSide }),
  dBlack: decalMaterial('decal-black', { color: 0x121214, roughness: 0.45 }),
  dCopper: decalMaterial('decal-copper', { color: 0xc8743f, roughness: 0.3, metalness: 0.8 }),
  dRivet: decalMaterial('decal-copper-rivet', { color: 0x6e3a1e, roughness: 0.38, metalness: 0.7 }),
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
  theme: '照四視圖 03 的刀鋒楔形車：有中脊的葉形矛頭鼻、長而低的煙燻座艙、一路升高到車尾整片上翹的尖鐏鴨尾；中線黑色矛桿從矛頭貫穿到車尾；紅銅斜切側板上一面凸起盾心、黑盾緣、一圈鉚釘的圓盾；板緣與矛桿兩側的紅銅鉚釘列；折線多稜面剖面；戰紅＋黑＋紅銅',
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
    // 紅銅斜切側板與前後擋泥板頂的紅銅肩甲
    { mat: 'copper', keep: (x, y, z) => (onSide(x, z) ? panelSd(x, y) : podSd(x, z)) },
    { mat: 'red', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];

    // ── 圓盾：紅銅盾面（16 段圓板，厚 1.6，半埋進側壁）＋黑色盾緣環＋盾心凸起＋一圈 8 顆鉚釘 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const face = [];
      /** @type {THREE.BufferGeometry[]} */
      const rim = [];
      /** @type {THREE.BufferGeometry[]} */
      const studs = [];
      const zw = P.hw(SHIELD.x) - 1.1;
      for (const sg of [-1, 1]) {
        const disc = new THREE.CylinderGeometry(SHIELD.r, SHIELD.r, 1.6, 16);
        disc.rotateX(Math.PI / 2);
        disc.translate(SHIELD.x, SHIELD.y, sg * (zw + 0.3));
        face.push(disc);
        const ring = new THREE.TorusGeometry(SHIELD.r - 0.3, 0.7, 6, 24);
        ring.translate(SHIELD.x, SHIELD.y, sg * (zw + 1.1));
        rim.push(ring);
        const boss = new THREE.SphereGeometry(2.6, 16, 10);
        boss.scale(1, 1, 0.55);
        boss.translate(SHIELD.x, SHIELD.y, sg * (zw + 1.1));
        studs.push(boss);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
          const s = new THREE.SphereGeometry(0.55, 8, 6);
          s.translate(SHIELD.x + 3.9 * Math.cos(a), SHIELD.y + 3.9 * Math.sin(a), sg * (zw + 1.15));
          studs.push(s);
        }
      }
      parts.push({ geometry: mergeGeos(face), mat: 'copper', solid: true, outline: true, name: 'shield-face' });
      parts.push({ geometry: mergeGeos(rim), mat: 'black', solid: true, name: 'shield-rim' });
      parts.push({ geometry: mergeGeos(studs), mat: 'copper', solid: true, name: 'shield-boss-studs' });
    }

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
    // 矛頭：中脊兩側往鼻尖收的紅銅葉形鑲邊（矛頭刃線）＋矛桿兩側的紅銅細線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onCanopy(x, z) || onSide(x, z) || x > 76.5) {
          return -1;
        }
        const az = Math.abs(z);
        // 矛頭刃線：x 44 → 76 的葉形曲線（最寬在 x 56，半寬 9）
        const t = (x - 44) / 32;
        const leaf = t > 0 && t < 1 ? 9 * Math.sin(Math.PI * Math.pow(1 - t, 0.75)) : -9;
        const blade = t > 0 && t < 1 ? 0.45 - Math.abs(az - leaf) : -1;
        const edge = x < 44 ? 0.3 - Math.abs(az - shaftHw(x) - 0.5) : -1;
        return Math.max(blade, edge);
      }, { offset: 0.1 }),
      mat: 'dCopper',
      name: 'decal-spearhead-lines',
    });
    // 紅銅鉚釘列：側板上緣每 4 mm 一顆、矛桿兩側每 5 mm 一對
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
    // 側板與肩甲邊緣的黑色細線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const panelEdge = onSide(x, z) ? Math.min(0.35 - Math.abs(panelSd(x, y)), archRingDist(x, y) - 0.5) : 0.35 - Math.abs(podSd(x, z));
        return panelEdge;
      }, { offset: 0.1 }),
      mat: 'dBlack',
      name: 'decal-panel-edge',
    });
    // 側艙頂面的分片甲帶（羅馬軍團板甲的分片）：x −14 → 22 每 6 mm 一道紅銅帶（寬 2.6），帶上兩端各一顆鉚釘
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
      mat: 'dCopper',
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
    // 側板後段的斜切進氣口（黑色，三道紅銅百葉線）
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
    // 矛頭兩側的斜縫頭燈
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onSide(x, z) || x < 49 || x > 58) {
          return -1;
        }
        const az = Math.abs(z);
        const t = (x - 49) / 9;
        const c = lerp(25, 15.5, t);
        return Math.min(0.9 - Math.abs(az - c), x - 49.5, 57.5 - x);
      }, { offset: 0.12 }),
      mat: 'dLamp',
      name: 'decal-slit-lamps',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他車殼）',
    geometry: '本檔站位產生器 P（推估，比例照四視圖 03）：殼 x −70 → 77.5；中線 車尾尖鐏脊 38.8 → 後甲板 → 矛尖 16；座艙罩高出甲板 6（頂 ≈ 37）；擋泥板稜 車尾 37、後輪 34.4、側艙 27.6、前輪 33.6；半寬 車尾 34、後輪 36.6、側艙 45.2、前輪 36.4、x 57 收到 20、x 68 收到 7.5、矛尖 1.2；折線剖面（每點都是稜線）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯用 gazelle 的 buildArchLiner',
    shield: '圓盾：紅銅圓板（R6.2、厚 1.6、16 段）、黑色盾緣環（Torus 24 × 6）、盾心凸起（16 × 10）、8 顆鉚釘（8 × 6），皆為實心 ABS 件，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    symbols: '長矛與盾：Wikipedia〈Mars (mythology)〉——矛是瑪爾斯的持物（Regia 收藏的「瑪爾斯之矛」）、Mars Ultor 右手倚長矛左手持盾；Salii 祭司持 12 面聖盾 ancilia 遊行（Wikipedia〈Ancile〉）。本款依 GOAL 用圓盾，造型皆為抽象化的車身零件與貼紙，不出人像',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

/** @type {import('./types').BodyDef} */
export const marsSpearBody = makePolyBody(CONFIG);
