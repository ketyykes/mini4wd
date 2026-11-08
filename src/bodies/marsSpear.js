// 瑪爾斯長矛（body-mars-spear，神話組・羅馬）——照四視圖 03 建模的刀鋒楔形車：細長的矛尖鼻 → 長而低的座艙 → 一路升高的後甲板 → 車尾兩角往上勾的鴨尾。
// 只用瑪爾斯的持物，不做人像：
// 長矛 → 整台車就是一支矛：座艙罩前端起一條凸起的黑色矛桿縱脊，一路通到鼻尖，接銀色套環與往前平伸、置中的一支銀色葉形矛尖；中線黑色矛桿貫穿到車尾的菱形尖鐏。
// 尾唇 → 兩鉤之間的深酒紅尾唇，兩端往外後掠成矛尾倒鉤。
// 圓盾 → 前後輪之間兩側各一面放大的金色浮雕圓盾（R8、黑色外緣、兩圈同心浮雕環、盾心凸起、一圈鉚釘）。
// 羅馬軍團 → 銀色斜切側板（銀色描線）、銀色後肩甲、沿板緣與矛桿兩側的鉚釘列。
// 配色：深酒紅為主（和紅金的 tanngrisnir 拉開）、銀為分割（斜切側板、後肩甲、尾鉤、描線、甲帶）、黑為圖形色（矛桿、側進氣口、下緣），金只留在圓盾。剖面是折線（多稜面），和同為羅馬、圓潤柔和的 venus-scallop 明顯不同。
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
  // 中線（矛桿）頂：車尾尖鐏脊 36 → 後甲板一路降 → 引擎蓋 → 兩叉鼻之間的凹槽底（鼻尖 15.6，比兩叉稜線低 2.6）
  yHood: monoCurve(XS, [36.0, 35.6, 35.2, 34, 33.6, 33, 32.4, 31.8, 31.2, 30.8, 30.2, 29.6, 28.6, 26.4, 22.4, 19, 17.2, 16.2, 15.6]),
  // 擋泥板稜：車尾 34.8（比中線尖鐏脊低，車尾斷面是中央翹起的屋脊形）、後輪 34.4、側艙 27.6、前輪 33.6
  yD: monoCurve(XS, [34.6, 34.2, 33.8, 33.6, 33.4, 32.6, 30.2, 28.4, 27.6, 27.8, 29.6, 32.6, 33.6, 32.4, 29, 25.6, 22.6, 20.2, 18.2]),
  // 半寬：車尾 30、後輪 36.6（剛好包住輪胎），前輪後方外擴成放圓盾的側艙（x 12–24 半寬 46.8），一路延伸到前輪上方（x 34 仍 46.4、x 42 43.6），x 50 起收窄到鼻部（x 57 半寬 18.6、鼻尖 10）
  hw: monoCurve(XS, [30, 31.4, 34, 36.6, 36.6, 36, 36.6, 38.4, 44.6, 46.8, 46.8, 46.4, 43.6, 33.4, 18.6, 14, 12, 10.8, 10]),
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
const STATIONS = buildStations(-70, 63, 2, profile);

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

/** @type {number[][]} 銀斜切側板（側視 x–y 多邊形，前高後低再翹起，沿腰線稜下方） */
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
/** @type {number[][]} 後擋泥板頂的銀肩甲（俯視 x–|z| 多邊形） */
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
/** @type {(x: number, y: number) => number} 到銀斜切側板邊界的有號距離 */
const panelSd = (x, y) => polySd(PANEL, x, y);
/** @type {(x: number, z: number) => number} 到後銀肩甲的有號距離 */
const podSd = (x, z) => polySd(REAR_POD, x, Math.abs(z));

/** @type {{ x: number, y: number, r: number }} 側艙圓盾（側視中心與半徑） */
const SHIELD = { x: 3, y: 20.4, r: 8 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  red: namedMaterial('paint-wine-red', { color: 0x5e0c1e, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 }),
  black: namedMaterial('paint-black-satin', { color: 0x141416, roughness: 0.42, clearcoat: 0.5 }),
  black2: namedMaterial('paint-black-satin', { color: 0x141416, roughness: 0.42, clearcoat: 0.5, side: THREE.DoubleSide }),
  // 金（真金屬，只用在圓盾）／銀（分割件）
  gold: namedMaterial('trim-legion-brass', { color: 0xcf9f45, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  silver: namedMaterial('trim-steel-silver', { color: 0xb9bec6, metalness: 0.85, roughness: 0.28, clearcoat: 0.3 }),
  silver2: namedMaterial('trim-steel-silver', { color: 0xb9bec6, metalness: 0.85, roughness: 0.28, clearcoat: 0.3, side: THREE.DoubleSide }),
  red2: namedMaterial('paint-wine-red', { color: 0x5e0c1e, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
  bronze: namedMaterial('trim-bronze-rivet', { color: 0xa8703a, metalness: 0.85, roughness: 0.32 }),
  canopy: namedMaterial('pc-smoke-tint', { color: 0x1c1416, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1e1a1a, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-wine', { color: 0x5e0c1e, roughness: 0.5, side: THREE.DoubleSide }),
  liner: namedMaterial('shell-wheelwell-wine', { color: 0x3a0c16, roughness: 0.8, side: THREE.DoubleSide }),
  dBlack: decalMaterial('decal-black', { color: 0x121214, roughness: 0.45 }),
  dSilver: decalMaterial('decal-steel-silver', { color: 0xc6cbd2, roughness: 0.28, metalness: 0.8 }),
  dRivet: decalMaterial('decal-steel-rivet', { color: 0x5c6068, roughness: 0.36, metalness: 0.75 }),
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
  theme: '照四視圖 03 的刀鋒楔形車：座艙罩前端起凸起的黑色矛桿縱脊，一路通到鼻尖，接一支往前平伸、置中的銀色葉形矛尖；長而低的煙燻座艙；一路升高的後甲板、車尾兩角往上勾的銀色尖鉤鴨尾與往外後掠的深酒紅尾唇；銀色斜切側板上一面放大的金色浮雕圓盾（黑外緣、兩圈同心浮雕環、盾心凸起、鉚釘），側艙頂面斜向平行的銀色甲帶；深酒紅＋銀分割＋黑，金只在圓盾',
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
    // 銀斜切側板與後擋泥板頂的銀肩甲
    { mat: 'silver', keep: (x, y, z) => (onSide(x, z) ? panelSd(x, y) : -1) },
    { mat: 'silver', keep: (x, y, z) => (onSide(x, z) ? -1 : podSd(x, z)) },
    { mat: 'red', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'edge', mount: 'mount' },
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

    // ── 長矛：座艙罩前端到鼻尖的黑色矛桿縱脊（厚 2.4、高出殼面 1.6）→ 鼻尖銀色套環 → 往前平伸、置中的一支銀色葉形矛尖 ──
    {
      /** @type {number[][]} */
      const ridge = [];
      for (let x = 38; x <= 62; x += 2) {
        ridge.push([x, top(x, 0) + 1.6 * Math.min(1, (63 - x) / 4 + 0.4)]);
      }
      for (let x = 62; x >= 38; x -= 2) {
        ridge.push([x, top(x, 0) - 1]);
      }
      parts.push({ geometry: finPlate(ridge, 0, 2.4), mat: 'black2', solid: true, outline: true, name: 'spear-shaft-ridge' });
      // 矛尖：俯視是葉形（最寬在 x 67.5～68，半寬 4.6），厚 1.0 平放在鼻尖高度，中間一道凸起的中脊
      /** @type {(x: number) => number} 葉形半寬 */
      const leafW = (x) => {
        if (x < 64.5) {
          return 1.6;
        }
        return 4.6 * Math.sin((Math.PI / 2) * Math.min(1, (x - 64.5) / 3)) * Math.min(1, (77.2 - x) / 9.2);
      };
      /** @type {number[][]} */
      const leaf = [];
      for (let x = 61; x < 77; x += 0.4) {
        leaf.push([x, leafW(x)]);
      }
      leaf.push([77.2, 0]);
      for (let k = leaf.length - 2; k >= 0; k--) {
        leaf.push([leaf[k][0], -leaf[k][1]]);
      }
      /** @type {number} 矛尖底面高度（接在矛桿縱脊的延長線上） */
      const yLeaf = 17.4;
      /** @type {number[][]} 中脊側影 */
      const rib = [[62, yLeaf + 0.6], [65.5, yLeaf + 1.8], [76.4, yLeaf + 1.1], [77.2, yLeaf + 0.5], [77.2, yLeaf], [62, yLeaf]];
      // 套環：矛桿接矛尖的銀環
      const socket = new THREE.CylinderGeometry(1.7, 1.9, 2.4, 16);
      socket.rotateZ(Math.PI / 2);
      socket.translate(63.6, yLeaf + 0.6, 0);
      parts.push({ geometry: mergeGeos([flatPlate(leaf, yLeaf, 1.0), finPlate(rib, 0, 1.4), socket]), mat: 'silver2', solid: true, outline: true, name: 'spearhead' });
    }

    // ── 上翹鴨尾：車尾兩角往上勾的銀尖鉤立板＋兩鉤之間往外後掠的深酒紅尾唇 ──
    {
      /** @type {THREE.BufferGeometry[]} */
      const hooks = [];
      for (const sg of [-1, 1]) {
        const z = sg * 29.5;
        hooks.push(finPlate([[-58, top(-58, z) - 0.6], [-66, 38.6], [-71.4, 41], [-71.6, 38], [-70, top(-70, z) - 0.6]], z, 1.2));
      }
      parts.push({ geometry: mergeGeos(hooks), mat: 'silver2', solid: true, outline: true, name: 'ducktail-hooks' });
      parts.push({
        // 俯視是往後掠的寬尾唇：前緣在兩鉤之間，兩端往外後掠到 |z| 45，後緣整條拉到 x −75.4（翼端比車身寬，像矛尾的倒鉤）
        geometry: flatPlate([[-64, -29], [-64, 29], [-66, 34], [-73.4, 45], [-75.4, 45], [-75.4, -45], [-73.4, -45], [-66, -34]], 36.8, 0.6),
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
    // 矛桿兩側的銀色細線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (onCanopy(x, z) || onSide(x, z) || x > 44) {
          return -1;
        }
        return 0.3 - Math.abs(Math.abs(z) - shaftHw(x) - 0.5);
      }, { offset: 0.1 }),
      mat: 'dSilver',
      name: 'decal-shaft-lines',
    });
    // 深灰鉚釘列：側板上緣每 4 mm 一顆、矛桿兩側每 5 mm 一對
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
    // 銀側板與肩甲邊緣的銀色描線（四視圖的切面描線）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const panelEdge = onSide(x, z) ? Math.min(0.35 - Math.abs(panelSd(x, y)), archRingDist(x, y) - 0.5) : 0.35 - Math.abs(podSd(x, z));
        return panelEdge;
      }, { offset: 0.1 }),
      mat: 'dSilver',
      name: 'decal-panel-edge',
    });
    // 側艙頂面的分片甲帶（羅馬軍團板甲的分片）：x −14 → 22 每 6 mm 一道往外斜向後 45° 的銀細帶（寬 1.5，互相平行），帶上兩端各一顆鉚釘
    /** @type {(x: number, z: number) => boolean} 在側艙頂面（座艙罩與矛桿之外、側面以上） */
    const onPodTop = (x, z) => x > -14 && x < 22 && !onSide(x, z) && Math.abs(z) > Math.max(0.3, Math.min(canW(x), P.hw(x) - 7, 0.5 * P.hw(x))) + 3;
    /** @type {(x: number, z: number) => number} 斜向甲帶的相位（0–6；往外側斜向後 45°，帶與帶互相平行） */
    const segPhase = (x, z) => (((x + Math.abs(z) - 27) % 6) + 6) % 6;
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onPodTop(x, z)) {
          return -1;
        }
        const ph = segPhase(x, z);
        return Math.min(0.75 - Math.abs(ph - 3), Math.abs(z) - 13, P.hw(x) - 3.6 - Math.abs(z));
      }, { offset: 0.1 }),
      mat: 'dSilver',
      name: 'decal-segment-bands',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (!onPodTop(x, z)) {
          return -1;
        }
        const ph = segPhase(x, z);
        const ends = Math.min(Math.abs(Math.abs(z) - 14.4), Math.abs(Math.abs(z) - (P.hw(x) - 5)));
        return 0.55 - Math.hypot(ph - 3, ends);
      }, { offset: 0.14 }),
      mat: 'dRivet',
      name: 'decal-segment-rivets',
    });
    // 側板後段的斜切進氣口（黑色，三道銀百葉線）
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
    geometry: '本檔站位產生器 P（推估，比例照四視圖 03）：殼 x −70 → 63（前端深酒紅封面），銀色矛尖伸到 77.2；中線 車尾尖鐏脊 38.8 → 後甲板 → 矛尖 16；座艙罩高出甲板 6（頂 ≈ 37）；擋泥板稜 車尾 37、後輪 34.4、側艙 27.6、前輪 33.6；半寬 車尾 34、後輪 36.6、側艙 45.2、前輪 36.4、x 57 收到 20、x 68 收到 7.5、矛尖 1.2；折線剖面（每點都是稜線）',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm，同 zeppelin / griffin），cutZFrom 21；輪拱內襯用 gazelle 的 buildArchLiner',
    shield: '圓盾：金圓板（R6.2、厚 1.6、16 段）、黑色盾緣環（Torus 24 × 6）、盾心凸起（16 × 10）、8 顆鉚釘（8 × 6），皆為實心 ABS 件，質量 = 封閉體積 × 1.05 g/cm³（推估）',
    symbols: '長矛與盾：Wikipedia〈Mars (mythology)〉——矛是瑪爾斯的持物（Regia 收藏的「瑪爾斯之矛」）、Mars Ultor 右手倚長矛左手持盾；Salii 祭司持 12 面聖盾 ancilia 遊行（Wikipedia〈Ancile〉）。本款依 GOAL 用圓盾，造型皆為抽象化的車身零件與貼紙，不出人像',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
};

/** @type {import('./types').BodyDef} */
export const marsSpearBody = makePolyBody(CONFIG);
