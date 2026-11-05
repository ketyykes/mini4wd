// 蟬翼（body-cicada-veil，LG1 致敬款）：前段寬而平、往前收圓的「頭」（俯視最寬在前輪後方）、頭部外上角一對貼合的扁平多面複眼、鼻端下緣的下顎前唇；
// 後段斷面呈 Λ 字（帳篷形）屋脊、往後漸低；後半車頂是兩片煙燻琥珀透明「脈翅」板（沿屋脊斜放、長格翅脈、看得到底盤），
// 往前延伸蓋住駕駛艙；兩片脈翅尾端超出車尾殼面 14 mm（後緣分叉成左右兩個往後外的翅尖，中間露出炭黑腹節車尾；tent-tail，沒有獨立尾翼）。
// 設計：shared/design/body-cicada-veil/DESIGN.md（HOMAGE_RESEARCH 第 6 節 P6、LG1 語彙 L1-x、和劇中車 / 市售車殼的差異）。
// 剖面為本檔站位產生器（推估，依 31 mm 輪拱、底盤內件高度與外框限制）。
// 塗裝全為自創：炭黑＋煙燻琥珀透明＋薄荷綠（三道聲波弧、簷線細線、頭頂三點單眼符號、車尾腹節環）；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';
import { monoCurve, buildStations, sdCircle } from './gazelleLeap.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 車尾殼面 x */
const X_TAIL = -59;
/** @type {number} 鼻端 x */
const X_NOSE = 60;
/** @type {number} 脈翅翅尖 x（超出車尾殼面 14 mm，分叉的兩個翅尖像蟬翼蓋過腹端） */
const X_TIP = -73;

/** 縱向控制節點（x 由後到前；前後軸 x = ±40） */
const XS = [-59, -54, -49, -40, -30, -20, -8, 4, 12, 18, 24, 30, 40, 46, 50, 54, 57, 60];
/**
 * 縱向控制表（推估）：
 * - yR：屋脊（中線）高度。尾端 29 → 後輪上方 37.8 → 屋脊最高 41（x −8）→ 往前降到頭部 33.4 → 鈍鼻 23（短鼻：鼻端離前軸 20 mm）
 * - yE：屋簷（帳篷斜面與側壁的交線）高度。後輪上方 31.8（31 mm 輪頂 28.5＋間隙＋壁厚）、兩輪之間降到 26.6（帳篷斜面最陡）、
 *   頭部 32.4（幾乎和屋脊同高 → 寬而平的頭）
 * - hw：半寬。俯視最寬 46 在前輪後方（x 4–12，脈翅肩部）、往前收到頭部 37（複眼再往外凸出約 1 mm）、往後收到後輪 37.6、尾端 21
 * - yLow：側壁下緣
 * @type {Record<string, (x: number) => number>}
 */
const P = {
  yR: monoCurve(XS, [29, 32.6, 35, 37.8, 39.6, 40.5, 41, 40.7, 39.2, 37, 34.6, 33.6, 33.4, 33.2, 32.8, 31.6, 29.2, 23]),
  yE: monoCurve(XS, [24, 26.8, 29.2, 31.8, 29.4, 27.2, 26.6, 27.4, 29, 30.8, 31.8, 32.3, 32.4, 32.2, 31.7, 30.5, 27.8, 22]),
  // 頭部前段是往前收圓的「臉」（x 54 → 60：33.5 / 29.5 / 25 / 21），不是方盒；前緣下方另有下顎前唇
  hw: monoCurve([-59, -56, -51, -46, -40, -30, -20, -8, 4, 12, 20, 26, 32, 40, 48, 54, 57, 59, 60], [21, 28, 34, 37, 37.6, 39.5, 42, 44.5, 46, 46, 44, 41, 38.5, 37.2, 36.6, 33.5, 29.5, 25, 21]),
  yLow: monoCurve(XS, [18, 16, 14, 13, 13, 13.5, 14, 14, 13.8, 13.5, 13.5, 13.5, 13.2, 13.2, 13.3, 13.6, 14.2, 15]),
};

/** @type {(x: number) => number} 屋簷的 z（側壁往內 3 mm） */
const zEave = (x) => P.hw(x) - 3;

/**
 * 半剖面 6 點（hard [1, 3]：屋脊 → 屋簷為直線 → 斷面 Λ 字帳篷；屋簷圓角；側壁垂直）
 * @type {(x: number) => number[][]}
 */
const profile = (x) => {
  const yR = P.yR(x);
  const yE = Math.min(P.yE(x), yR - 0.3);
  const hw = P.hw(x);
  const ySh = yE - 3.2;
  const yLow = Math.min(P.yLow(x), ySh - 1);
  return [
    [0, yR],
    [zEave(x), yE],
    [hw - 1.1, yE - 1.1],
    [hw, ySh],
    [hw, lerp(ySh, yLow, 0.5)],
    [hw, yLow],
  ];
};

// 尾端與鈍鼻曲率大：尾端每 1 mm、鈍鼻每 0.75 mm 一站，其餘每 2 mm
const STATIONS = [...buildStations(X_TAIL, -48, 1, profile).slice(0, -1), ...buildStations(-48, 48, 2, profile).slice(0, -1), ...buildStations(48, X_NOSE, 0.75, profile)];

/**
 * 帳篷斜面高度（屋脊 → 屋簷的直線；車尾殼面之後取車尾殼面處同一 |z| 的高度、每 mm 往下 0.45 mm，給超出車尾的脈翅翅尖用）
 * @type {(x: number, z: number) => number}
 */
const tentY = (x, z) => {
  const az = Math.abs(z);
  if (x >= X_TAIL) {
    const yR = P.yR(x);
    const yE = Math.min(P.yE(x), yR - 0.3);
    return yR - ((yR - yE) * az) / zEave(x);
  }
  // 分叉的翅尖不在中線（|z| 最大約 16），所以取車尾殼面處同一 |z| 的斜面高度，再每 mm 往下 0.45 mm（翅尖微下垂）
  const yE0 = Math.min(P.yE(X_TAIL), P.yR(X_TAIL) - 0.3);
  const y0 = P.yR(X_TAIL) - ((P.yR(X_TAIL) - yE0) * Math.min(az, zEave(X_TAIL))) / zEave(X_TAIL);
  return y0 + 0.45 * (x - X_TAIL);
};

/**
 * 脈翅俯視外形：外緣 zOut(x)（翅根在駕駛艙前 x 24；最寬 48.5 在 x −6，越過屋簷往外伸出約 4 mm＝收起的蟬翼比身體寬）。
 * 兩片脈翅不在中線收攏（整片琥珀翅罩蓋住車尾會像甲蟲蓋子），各自往後外收成一個翅尖（x −73、|z| 18.5，超出車尾殼面 14 mm），翅尖往後外分叉；中間露出炭黑腹節車尾
 */
const WING_X = [-73, -69, -64, -59, -54, -46, -34, -20, -6, 6, 14, 20, 24];
const wingOut = monoCurve(WING_X, [18.6, 21.6, 23.4, 24.6, 28.5, 34, 40, 45.5, 48.5, 46, 36, 20, 1.8]);
/** @type {number} 翅後緣開始分叉的 x（此處之後內緣往外斜開） */
const X_FORK = -26;
/**
 * 脈翅內緣（沿屋脊留 1.4 mm 炭黑脊條；x −26 之後內緣往外斜開到翅尖 |z| 18.4 → 兩翅之間是往後張開的 V 形缺口，露出黑色車尾）
 * @type {(x: number) => number}
 */
const wingIn = (x) => (x > X_FORK ? 1.4 : 1.4 + ((X_FORK - x) / (X_FORK - X_TIP)) * 17);
/** @type {number} 脈翅浮在殼面上的高度 */
const WING_GAP = 0.4;

/**
 * 殼面開口（脈翅下方，往內縮 1–1.2 mm，看得到底盤）：負值 = 開口內
 * @type {(x: number, y: number, z: number) => number}
 */
const wingHoleSd = (x, y, z) => {
  if (y < 20) {
    return 10;
  }
  const az = Math.abs(z);
  return Math.max(wingIn(x) + 1.0 - az, az - Math.min(wingOut(x) - 1.2, zEave(x) - 2.5), x - 21, -56.5 - x);
};

/**
 * 單片脈翅（單層曲面，雙面材質）：沿 x 由尖尾到翅根取 nu 段、沿翅寬取 nv 段，高度 = 帳篷斜面 + WING_GAP
 * @type {(side: number, nu?: number, nv?: number) => THREE.BufferGeometry}
 */
const buildWingSheet = (side, nu = 120, nv = 14) => {
  const x0 = X_TIP;
  const x1 = 24;
  /** @type {(i: number, j: number) => number[]} */
  const P2 = (i, j) => {
    const x = lerp(x0, x1, i / nu);
    const zi = wingIn(x);
    const zo = Math.max(zi, wingOut(x));
    const z = lerp(zi, zo, j / nv);
    return [x, tentY(x, z) + WING_GAP, side * z];
  };
  const pos = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = P2(i, j);
      const b = P2(i + 1, j);
      const c = P2(i + 1, j + 1);
      const d = P2(i, j + 1);
      if (side > 0) {
        pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      } else {
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/**
 * 翅脈（細管）：縱脈沿翅長（v 固定）、橫脈沿翅寬（x 固定）→ 長方形翅格（不是放射狀網）
 * @type {(side: number) => { veins: THREE.BufferGeometry, costa: THREE.BufferGeometry }}
 */
const buildVeins = (side) => {
  /** @type {(x: number, v: number) => number[]} 脈翅上 (x, 翅寬比例 v) 的點 */
  const onWing = (x, v) => {
    const zi = wingIn(x);
    const zo = Math.max(zi, wingOut(x));
    const z = lerp(zi, zo, v);
    return [x, tentY(x, z) + WING_GAP + 0.08, side * z];
  };
  /** @type {(v: number, xa: number, xb: number) => number[][]} */
  const along = (v, xa, xb) => {
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      pts.push(onWing(lerp(xa, xb, k / 40), v));
    }
    return pts;
  };
  /** @type {THREE.BufferGeometry[]} */
  const veins = [];
  // 縱脈（翅寬 1/4、1/2、3/4 處，沿翅長）
  for (const v of [0.26, 0.52, 0.77]) {
    veins.push(sweepEllipse(along(v, X_TIP + 6, 18), 80, () => [0.3, 0.19], 6));
  }
  // 橫脈：只在相鄰兩條縱脈之間、前後交錯 → 沿翅長方向的長方形翅格（不連成橫貫全翅的格線）
  /** @type {number[][]} [x, v 起, v 終] */
  const cross = [
    [-42, 0.02, 0.26],
    [-12, 0.02, 0.26],
    [-50, 0.26, 0.52],
    [-24, 0.26, 0.52],
    [3, 0.26, 0.52],
    [-36, 0.52, 0.77],
    [-6, 0.52, 0.77],
    [-52, 0.77, 0.98],
    [-28, 0.77, 0.98],
    [0, 0.77, 0.98],
  ];
  for (const [x, v0, v1] of cross) {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      pts.push(onWing(x, lerp(v0, v1, k / 6)));
    }
    veins.push(sweepEllipse(pts, 12, () => [0.28, 0.19], 6));
  }
  // 前緣脈（翅外緣，較粗）＋內緣脈（沿屋脊）
  const costa = [sweepEllipse(along(0.985, X_TIP + 1.2, 23.2), 120, () => [0.5, 0.3], 8), sweepEllipse(along(0.02, X_TIP + 1.2, 22.5), 120, () => [0.38, 0.24], 6)];
  return { veins: mergeGeos(veins), costa: mergeGeos(costa) };
};

/**
 * 輪拱內襯（沿殼側壁內側裁切）：輪拱切口後面的一段圓柱面（半徑 = 輪拱半徑 + 0.3，只取上半圈），擋住從側面看進去的殼內空腔
 * @type {(arch: { x: number, y: number, radius: number }, depth: number) => THREE.BufferGeometry}
 */
const buildClippedLiner = (arch, depth) => {
  const r = arch.radius + 0.3;
  const n = 40;
  const a0 = 0.3;
  const a1 = Math.PI - 0.3;
  const pos = [];
  /** @type {(t: number) => number} 該角度的側壁內面 z */
  const zIn = (t) => P.hw(arch.x + r * Math.cos(t)) - 1.4;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = lerp(a0, a1, i / n);
      const t1 = lerp(a0, a1, (i + 1) / n);
      const p = (t, z) => [arch.x + r * Math.cos(t), arch.y + r * Math.sin(t), sg * z];
      const A = p(t0, zIn(t0) - depth);
      const B = p(t1, zIn(t1) - depth);
      const C = p(t1, zIn(t1));
      const D = p(t0, zIn(t0));
      // 法線朝輪心（內襯面向輪胎）
      if (sg > 0) {
        pos.push(...A, ...C, ...B, ...A, ...D, ...C);
      } else {
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
};

/** @type {{ x: number, y: number, radius: number, cutZFrom: number }[]} 前後 31 mm 輪拱 */
const ARCHES = [
  { x: 40, y: 13, radius: 17.5, cutZFrom: 21 },
  { x: -40, y: 13, radius: 17.5, cutZFrom: 21 },
];

/** 聲波弧中心（側視，兩輪之間的側壁） */
const SOUND = { x: -1, y: 19.2 };

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  charcoal: namedMaterial('paint-charcoal-black', { color: 0x25272b, roughness: 0.26, metalness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  charcoal2: namedMaterial('paint-charcoal-black', { color: 0x25272b, roughness: 0.26, metalness: 0.2, clearcoat: 0.9, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x18191b, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-charcoal', { color: 0x3a3d42, roughness: 0.5, side: THREE.DoubleSide }),
  slot: namedMaterial('plastic-gill-black', { color: 0x08090a, roughness: 0.9, side: THREE.DoubleSide }),
  // 半透明煙燻琥珀脈翅（0xa8691c、不透明度 0.42）：名稱以 pc-tint- 開頭，Blender 依名稱 pc-tint → 有色透明 PC 薄殼材質 glass_tint
  // （保留色相、不加煙燻灰；以 pc-smoke 開頭會被當煙燻 PC 而變成黑玻璃）
  amber: namedMaterial('pc-tint-amber-smoke', { color: 0xa8691c, roughness: 0.03, specularIntensity: 0.9, transparent: true, opacity: 0.42, envMapIntensity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  vein: namedMaterial('paint-vein-umber', { color: 0x2b1b0d, roughness: 0.35, clearcoat: 0.6 }),
  mint2: namedMaterial('paint-bright-mint-green', { color: 0x5fe0b0, roughness: 0.22, clearcoat: 1.0, side: THREE.DoubleSide }),
  eye: namedMaterial('lamp-mint', { color: 0x8affd6, emissive: 0x2fd59a, emissiveIntensity: 0.65, roughness: 0.08, clearcoat: 1.0 }),
  dMint: decalMaterial('decal-mint-green', { color: 0x5fe0b0, roughness: 0.3, clearcoat: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
  liner: namedMaterial('shell-inner-dark', { color: 0x18191b, roughness: 0.85, side: THREE.DoubleSide }),
});

export const cicadaVeilBody = makePolyBody({
  id: 'body-cicada-veil',
  name: '蟬翼帳篷',
  style: 'homage',
  phase: 6,
  homageSeries: 'lg1',
  form: 'tent-back',
  roof: 'clear',
  wing: 'tent-tail',
  theme: '往前收圓的寬頭＋貼合頭角的扁平多面複眼＋下顎前唇、後段 Λ 字帳篷屋脊、兩片琥珀透明長格脈翅沿屋脊斜放並在車尾外收攏成低矮尖尾；安靜蟄伏、一出手就很快的對手',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.0,
  hard: [1, 3],
  wheelArches: ARCHES,
  openings: [{ id: '脈翅下開口', shape: 'fn', sd: wingHoleSd }],
  recesses: [
    // 頭側導流槽（V10）：頭頂外側每側兩道往後外斜的淺槽，指向複眼燈
    { id: '頭側導流槽-內', view: 'top', shape: 'poly', pts: [[54, 14.5], [54, 17.5], [42, 21.5], [42, 18.5]], depth: 1.0 },
    { id: '頭側導流槽-外', view: 'top', shape: 'poly', pts: [[54, 20.5], [54, 23.5], [42, 27.5], [42, 24.5]], depth: 1.0 },
  ],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [{ mat: 'charcoal', keep: () => 1 }],
  mats: { inner: 'inner', edge: 'edge', cap: 'charcoal2', recess: 'slot', recessWall: 'charcoal2', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 兩片琥珀透明脈翅（clear 車頂＋tent-tail 尖尾）：單層曲面，以面積 × 壁厚計入殼面質量
    parts.push({ geometry: mergeGeos([buildWingSheet(1), buildWingSheet(-1)]), mat: 'amber', shell: true, renderOrder: 3, name: 'veil-wings' });
    const vR = buildVeins(1);
    const vL = buildVeins(-1);
    parts.push({ geometry: mergeGeos([vR.veins, vL.veins]), mat: 'vein', name: 'wing-veins' });
    parts.push({ geometry: mergeGeos([vR.costa, vL.costa]), mat: 'vein', name: 'wing-costa' });

    // 複眼：貼合頭部外上角的扁平多面複眼（20 面體細分一次的 80 個平面小眼面，只凸出殼面約 1 mm），
    // 沿屋簷角往外上傾 29°；和 mantis / dartfrog 的外突圓頂眼燈區隔
    /** @type {THREE.BufferGeometry[]} */
    const eyes = [];
    const EYE = { x: 48, rx: 5.6, ry: 3.4, rz: 2.0 };
    for (const sg of [-1, 1]) {
      const g = new THREE.IcosahedronGeometry(1, 1);
      g.scale(EYE.rx, EYE.ry, EYE.rz);
      g.rotateX(-sg * 0.5);
      g.translate(EYE.x, P.yE(EYE.x) - 1.6, sg * (P.hw(EYE.x) - 1.1));
      g.computeVertexNormals();
      eyes.push(g);
    }
    parts.push({ geometry: mergeGeos(eyes), mat: 'eye', solid: true, outline: true, name: 'compound-eye-facets' });
    // 下顎前唇：鼻端下緣往前伸 3.5 mm 的薄板，中央有一道 V 形口器缺口（讓頭部前緣不是平切方塊）
    const lip = new THREE.Shape();
    lip.moveTo(55, -19);
    lip.lineTo(60, -15.5);
    lip.lineTo(63.5, -6.5);
    lip.lineTo(61.6, -1.4);
    lip.lineTo(61.6, 1.4);
    lip.lineTo(63.5, 6.5);
    lip.lineTo(60, 15.5);
    lip.lineTo(55, 19);
    lip.lineTo(55, -19);
    const lipGeo = new THREE.ExtrudeGeometry(lip, { depth: 1.4, bevelEnabled: false });
    lipGeo.rotateX(Math.PI / 2);
    lipGeo.translate(0, 17.0, 0);
    parts.push({ geometry: lipGeo, mat: 'charcoal2', solid: true, outline: true, name: 'mandible-lip' });

    // 輪拱內襯（31 mm 大輪拱）：擋住從側面看進去的殼內空腔
    parts.push({ geometry: mergeGeos(ARCHES.map((a) => buildClippedLiner(a, 3))), mat: 'liner', shell: true, name: 'arch-liners' });

    // 屋脊薄荷綠細線（從翅根到車尾，沿炭黑脊條）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.45 - Math.abs(z), x + 57.5, 20 - x)), mat: 'dMint', name: 'decal-ridge-line' });
    // 兩翅分叉處露出的炭黑車尾上，3 道往前彎的薄荷綠腹節環（蟬的腹節；V 尖朝前、越往後越短），只畫在兩翅內緣之間
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (x > X_FORK - 4 || az > wingIn(x) - 1.6) {
          return -1;
        }
        let band = -Infinity;
        for (const xc of [-36, -44, -52]) {
          band = Math.max(band, 0.55 - Math.abs(x - xc + 0.35 * az));
        }
        return band;
      }),
      mat: 'dMint',
      name: 'decal-abdomen-rings',
    });
    // 簷線下方的薄荷綠細線（側壁，頭部到車尾）
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < P.hw(x) - 0.6 ? -1 : Math.min(0.32 - Math.abs(y - (P.yE(x) - 4.3)), x + 55, 56 - x))),
      mat: 'dMint',
      name: 'decal-eave-line',
    });
    // 三道聲波弧（兩輪之間的側壁，弧口朝後 → 往車尾傳出的蟬鳴）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        if (Math.abs(z) < P.hw(x) - 0.6) {
          return -1;
        }
        const dx = x - SOUND.x;
        const dy = y - SOUND.y;
        const r = Math.hypot(dx, dy);
        let band = -Infinity;
        for (const R of [3.2, 6, 8.8]) {
          band = Math.max(band, 0.55 - Math.abs(r - R));
        }
        // 只留朝後的扇形（±60°），並且在簷線細線之下、側壁下緣之上
        return Math.min(band, -dx - 0.55 * Math.abs(dy), P.yE(x) - 5.6 - y, y - P.yLow(x) - 1.2);
      }),
      mat: 'dMint',
      name: 'decal-sound-arcs',
    });
    // 聲波源：弧心的薄荷綠小圓點
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < P.hw(x) - 0.6 ? -1 : -sdCircle(SOUND.x + 0.6, SOUND.y, 1.1)(x, y))),
      mat: 'dMint',
      name: 'decal-sound-dot',
    });
    // 頭頂自創符號（L1-8 位置）：三顆排成倒三角的薄荷綠小圓點（單眼意象）
    parts.push({
      geometry: kit.decal((x, y, z) => (y < 28 ? -1 : -Math.min(sdCircle(52, 0, 1.25)(x, z), sdCircle(48.5, 2.9, 1.05)(x, z), sdCircle(48.5, -2.9, 1.05)(x, z)))),
      mat: 'dMint',
      name: 'decal-ocelli',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他致敬款）；透明脈翅同厚度，以殼面積計入質量',
    geometry: '本檔站位產生器 P（推估，依 HOMAGE_RESEARCH 6-5-2 P6）：殼長 119（x −59 → 60）、含脈翅翅尖（x −73）與下顎前唇（x 63.5）的外框長 136.5、屋脊最高 41；屋脊 → 屋簷為直線（hard 1）＝ Λ 字帳篷斷面',
    wheelArches: '前後 R17.5（31 mm 輪胎半徑 15.5 + 2 mm）；屋簷在後輪上方抬到 31.8（輪頂 28.5＋間隙＋壁厚）',
    wings: '脈翅為單層透明曲面（帳篷斜面上方 0.4 mm），超出車尾殼面 14 mm、後緣分叉成兩個翅尖；翅脈細管只是外觀，不計質量；複眼燈與下顎前唇視為 ABS 實心件（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
