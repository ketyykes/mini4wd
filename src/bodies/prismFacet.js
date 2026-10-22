// 稜鏡刻面（body-prism-facet，第六階段 LG2 致敬款）：低多邊形楔形全罩，全身由大平面刻面組成、左右完全對稱；
// 鼻端是寬箭頭鼻＋中線稜（iter-70；原為水平刀口刻面）；座艙置中，上面是多刻面無色透明「水晶」座艙罩（看得到駕駛人）；
// 車尾一根架高的三角柱斷面「分流稜鏡」橫桿（L2-1 外露機能件，淡青透明外殼＋內部發光分光芯），兩端由兩片黑色三角側板承托（iter-73；原為內側兩根支柱），沒有外伸翼端片。
// 設計：shared/design/body-prism-facet/DESIGN.md（HOMAGE_RESEARCH 第 6 節 P7、LG2 語彙 L2-x、和劇中車 / 市售車殼的差異）。
// 剖面為本檔的折線站位表（推估）：站間直線內插（每 1 mm 一站）→ 每個刻面都是平面，稜線銳利。
// 塗裝全為自創：白殼＋少數大刻面分件線＋從尾部稜鏡往前散開的冷色分光色塊（青 → 粉 6 塊、黑分隔線、不等寬，iter-70 起不用紅橙黃綠藍紫）；不含任何廠商 / 作品名稱、商標、隊徽、國旗或角色圖像。
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { makePolyBody, finPlate, sweepEllipse, buildDriver } from './polyBody.js';
import { namedMaterial, decalMaterial, mergeGeos, lerp } from './loft.js';

/** @typedef {import('./loft.js').BodyPart} BodyPart */

/**
 * 關鍵站（x 由後到前；前後軸 x = ±40）：半剖面 5 點 = 中央頂面稜 → 肩稜 → 側面最寬稜 → 側壁下緣（往內收的下刻面）
 * 每點 [z, y]；站與站之間直線內插 → 刻面為平面（推估，依 26 mm 輪拱 R15.2 與底盤內件高度）
 * 俯視是拉長的六角形：最寬 43 在 x −20（側面最寬稜的轉折點），往前直線收到前軸 36.6、寬刀口鼻 32；往後收到尾面 27
 * @type {{ x: number, pts: number[][] }[]}
 */
// iter-70 精修：
// - 鼻部由寬平刀口（鼻端半寬 32）改成寬箭頭鼻：新增 x 62、67 站，x 67 處仍寬 60（箭頭兩翼），再以 V 形收到 x 74 的鼻尖；
//   中線稜（中央頂點高過肩稜 0.7–2.5 mm）從前軸一路拉到鼻尖；
// - 車尾加寬（x −62 半寬 27 → 32）、x 22 側面稜 38.8 → 40：俯視和 zeppelin（細長雪茄）、halo、cicada 的輪廓 IoU 都壓在 0.85 以下
//   車尾 x ≤ −40 也有低中線稜（座艙段保持平頂，水晶座艙罩坐在上面）
// - 前後輪拱上方的側面最寬稜 27.8 → 29.0：舊版剛好落在輪拱頂（28.2）之下，輪拱切口在稜線上切出鋸齒小缺口
const KEY5 = [
  { x: -62, pts: [[0, 29], [10, 28.2], [23, 27], [32, 22], [31, 17.5]] },
  { x: -54, pts: [[0, 31], [11, 30], [26, 29.1], [35, 24], [34, 14.5]] },
  { x: -40, pts: [[0, 31.3], [12, 30.6], [29, 30.2], [36.2, 29], [35.2, 13]] },
  { x: -20, pts: [[0, 30.8], [12, 30.8], [33, 29], [43, 23.2], [41.8, 13]] },
  { x: 0, pts: [[0, 30.8], [12.5, 30.8], [32, 28.9], [41, 22.8], [39.8, 13.5]] },
  { x: 22, pts: [[0, 30.4], [12.5, 30.4], [31, 29.2], [40, 23.4], [39, 13.5]] },
  { x: 40, pts: [[0, 30], [12, 29.3], [29, 30], [36.6, 29], [35.8, 13]] },
  { x: 54, pts: [[0, 26.5], [11, 24], [26.5, 23.6], [35, 19.4], [34, 13.5]] },
  { x: 62, pts: [[0, 22.8], [9.5, 21], [24.5, 20.2], [32.5, 17.8], [32, 13.8]] },
  { x: 67, pts: [[0, 20.4], [8.5, 18.6], [22, 17.8], [30, 16.2], [29.6, 14.2]] },
  { x: 74, pts: [[0, 16.8], [2, 16.4], [4, 16.1], [5.5, 15.7], [5.4, 15]] },
];
/**
 * 刻面加倍：在肩稜（2）與側面最寬稜（3）之間插入一條往外凸 0.8 mm 的新稜線 → 每站半剖面 6 點（上側刻面一分為二）
 * @type {(pts: number[][]) => number[][]}
 */
const splitUpperSide = (pts) => {
  const [a, b] = [pts[2], pts[3]];
  const dz = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.max(1e-6, Math.hypot(dz, dy));
  const mid = [(a[0] + b[0]) / 2 - (dy / len) * 0.8, (a[1] + b[1]) / 2 + (dz / len) * 0.8];
  return [pts[0], pts[1], a, mid, b, pts[4]];
};
const KEY = KEY5.map((k) => ({ x: k.x, pts: splitUpperSide(k.pts) }));
/** @type {number} 車尾 x（垂直切平的尾面） */
const X_TAIL = KEY[0].x;
/** @type {number} 鼻端 x（水平刀口） */
const X_NOSE = KEY[KEY.length - 1].x;

/**
 * 在 x 處的半剖面（關鍵站之間直線內插）
 * @type {(x: number) => number[][]}
 */
const profileAt = (x) => {
  let k = 0;
  while (k < KEY.length - 2 && x > KEY[k + 1].x) {
    k++;
  }
  const a = KEY[k];
  const b = KEY[k + 1];
  const t = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
  return a.pts.map((p, i) => [lerp(p[0], b.pts[i][0], t), lerp(p[1], b.pts[i][1], t)]);
};

/** 站位：每 1 mm 一站，並且一定包含關鍵站（刻面的轉折線） */
const STATIONS = (() => {
  /** @type {Set<number>} */
  const xs = new Set(KEY.map((k) => k.x));
  for (let x = X_TAIL; x < X_NOSE; x += 1) {
    xs.add(x);
  }
  return [...xs].sort((a, b) => a - b).map((x) => ({ x, pts: profileAt(x) }));
})();

/** @type {(x: number, i: number) => number[]} 第 i 點在 x 處的 [z, y] */
const ptAt = (x, i) => profileAt(x)[i];

/** 座艙槽（俯視六角形，深 5 mm） */
const COCKPIT = {
  id: '座艙槽',
  view: 'top',
  shape: 'poly',
  pts: [
    [24, 0],
    [19.5, 8.6],
    [-15.5, 8.6],
    [-21, 0],
  ],
  depth: 5,
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  white: namedMaterial('paint-bright-white', { color: 0xf4f5f7, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  white2: namedMaterial('paint-bright-white', { color: 0xf4f5f7, roughness: 0.2, clearcoat: 1.0, side: THREE.DoubleSide }),
  black2: namedMaterial('paint-gloss-black', { color: 0x16171a, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1b1c1f, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-white', { color: 0xc9ccd2, roughness: 0.5, side: THREE.DoubleSide }),
  tub: namedMaterial('cockpit-tub', { color: 0x16171a, roughness: 0.8, side: THREE.DoubleSide }),
  tubWall: namedMaterial('cockpit-dark', { color: 0x26282c, roughness: 0.6, side: THREE.DoubleSide }),
  // 無色透明水晶（Blender 依名稱 pc-clear → 透明 lens 材質）
  crystal: namedMaterial('pc-clear-crystal', { color: 0xeef6ff, roughness: 0.02, specularIntensity: 0.9, transparent: true, opacity: 0.32, envMapIntensity: 1.0, depthWrite: false, side: THREE.DoubleSide }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-white', { color: 0xe9ebef, roughness: 0.3, clearcoat: 0.8 }),
  lamp: namedMaterial('lamp-ice', { color: 0xf2fbff, emissive: 0xbfe6ff, emissiveIntensity: 0.6, roughness: 0.08, clearcoat: 1.0 }),
  tail: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  dBlack: decalMaterial('decal-black', { color: 0x141518, roughness: 0.4 }),
  // iter-70：光譜帶改成「冷色分光」連續漸層（青 → 天藍 → 藍 → 靛 → 紫 → 洋紅 → 粉），相鄰色帶緊貼、不等寬；
  // 不再是紅橙黃綠藍紫六色等寬（評審：和六色彩虹旗排列相同）
  // iter-73：色帶改成 6 塊高飽和、有黑色分隔線的刻面色塊（不再是 7 條細帶的柔和漸層）；
  // 色相仍是冷色範圍（青 → 藍 → 靛 → 紫 → 洋紅 → 粉），但藍系寬度比例下降、紫 / 洋紅 / 粉加寬（不往更藍走）
  dS0: decalMaterial('decal-spectrum-cyan', { color: 0x00c2e8, roughness: 0.25, clearcoat: 0.8 }),
  dS2: decalMaterial('decal-spectrum-blue', { color: 0x1f4fff, roughness: 0.25, clearcoat: 0.8 }),
  dS3: decalMaterial('decal-spectrum-indigo', { color: 0x4a1fe0, roughness: 0.25, clearcoat: 0.8 }),
  dS4: decalMaterial('decal-spectrum-violet', { color: 0x8c10e0, roughness: 0.25, clearcoat: 0.8 }),
  dS5: decalMaterial('decal-spectrum-magenta', { color: 0xdc0cae, roughness: 0.25, clearcoat: 0.8 }),
  dS6: decalMaterial('decal-spectrum-pink', { color: 0xff1f6e, roughness: 0.25, clearcoat: 0.8 }),
  // 稜鏡橫桿：淡青透明 PC 外殼（Blender 依名稱 pc-clear → 透明 lens）＋內部發光的分光芯（lamp-* → 自發光，Blender 也看得到）
  prism: namedMaterial('pc-clear-prism', { color: 0xd8f6ff, roughness: 0.02, specularIntensity: 1.0, transparent: true, opacity: 0.42, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide }),
  core0: namedMaterial('lamp-prism-cyan', { color: 0x7ff0ff, emissive: 0x18c8e8, emissiveIntensity: 0.9, roughness: 0.1 }),
  core1: namedMaterial('lamp-prism-blue', { color: 0x7fa0ff, emissive: 0x3060f0, emissiveIntensity: 0.9, roughness: 0.1 }),
  core2: namedMaterial('lamp-prism-violet', { color: 0xb08aff, emissive: 0x7a38e0, emissiveIntensity: 0.9, roughness: 0.1 }),
  core3: namedMaterial('lamp-prism-magenta', { color: 0xff8ad8, emissive: 0xd0309a, emissiveIntensity: 0.9, roughness: 0.1 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** 冷色分光色塊（由後往前，靠近尾部稜鏡的是青）：材質鍵＋相對寬度（iter-73：6 塊，藍系 43%、紫紅系 57%） */
const SPECTRUM = ['dS0', 'dS2', 'dS3', 'dS4', 'dS5', 'dS6'];
const SPECTRUM_W = [0.8, 0.9, 0.9, 1.1, 1.2, 1.1];
/** @type {number} 色塊之間的黑色分隔線半寬（mm） */
const BLOCK_GAP = 0.3;
/** @type {number[]} 每條色帶在 [0, 1] 內的起訖（累積寬度正規化） */
const SPECTRUM_EDGES = (() => {
  const total = SPECTRUM_W.reduce((a, b) => a + b, 0);
  const out = [0];
  for (const w of SPECTRUM_W) {
    out.push(out[out.length - 1] + w / total);
  }
  return out;
})();

/**
 * 多刻面水晶座艙罩：凸包（ConvexGeometry）→ 每個面都是平面
 * 底緣六角形在車身頂面（y 30.5）之下 0.3 mm，頂部是兩片小平台
 * @type {() => THREE.BufferGeometry}
 */
const buildCrystalCanopy = () => {
  const y0 = 30.2;
  const pts = [
    [25, y0, 0],
    [20, y0, 9.4],
    [-16, y0, 9.4],
    [-22, y0, 0],
    [18.5, 34.6, 7.4],
    [-9, 36.2, 8],
    [-17.5, 33.6, 5.2],
    [22.5, 33.2, 0],
    [9, 38, 4.2],
    [-4, 38, 4.6],
  ];
  /** @type {THREE.Vector3[]} */
  const v = [];
  for (const [x, y, z] of pts) {
    v.push(new THREE.Vector3(x, y, z));
    if (z !== 0) {
      v.push(new THREE.Vector3(x, y, -z));
    }
  }
  return new ConvexGeometry(v);
};

/**
 * 分流稜鏡橫桿：三角柱（底面水平、尖端朝上），沿 z 跨 ±halfSpan
 * @type {(halfSpan: number) => THREE.BufferGeometry}
 */
/** @type {number[][]} 稜鏡三角斷面（iter-70：架高 6 mm、斷面放大，底 38.4 → 頂 44.4） */
const PRISM_TRI = [
  [-51, 38.4],
  [-60.4, 38.4],
  [-55.7, 44.4],
];
/** @type {(halfSpan: number, shrink?: number, z0?: number) => THREE.BufferGeometry} shrink：往形心縮放（給內部分光芯）；z0 → halfSpan 為 z 範圍 */
const buildPrismBar = (halfSpan, shrink = 1, z0 = -halfSpan) => {
  const cx = (PRISM_TRI[0][0] + PRISM_TRI[1][0] + PRISM_TRI[2][0]) / 3;
  const cy = (PRISM_TRI[0][1] + PRISM_TRI[1][1] + PRISM_TRI[2][1]) / 3;
  const tri = PRISM_TRI.map(([x, y]) => [cx + (x - cx) * shrink, cy + (y - cy) * shrink]);
  /** @type {THREE.Vector3[]} */
  const v = [];
  for (const [x, y] of tri) {
    v.push(new THREE.Vector3(x, y, z0), new THREE.Vector3(x, y, halfSpan));
  }
  return new ConvexGeometry(v);
};

export const prismFacetBody = makePolyBody({
  id: 'body-prism-facet',
  name: '稜鏡刻面',
  style: 'homage',
  phase: 6,
  homageSeries: 'lg2',
  form: 'faceted',
  roof: 'clear',
  wing: 'prism-bar',
  theme: '低多邊形平面刻面楔形、寬箭頭鼻＋中線稜、置中的多刻面水晶座艙罩、車尾架高的發光分流稜鏡橫桿；白殼上冷色分光漸層帶從尾部稜鏡往前散開',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  wheelArches: [
    { x: 40, y: 13, radius: 15.2, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.2, cutZFrom: 23.8 },
  ],
  recesses: [COCKPIT],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [{ mat: 'white', keep: () => 1 }],
  mats: { inner: 'inner', edge: 'edge', cap: 'white2', recess: 'tub', recessWall: 'tubWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    /** @type {BodyPart[]} */
    const parts = [];
    // 水晶座艙罩（clear）：以面積 × 壁厚計入殼面質量
    parts.push({ geometry: buildCrystalCanopy(), mat: 'crystal', shell: true, renderOrder: 3, name: 'crystal-canopy' });
    // 座艙罩底框（黑細框，沿六角形底緣）
    const rim = [
      [25, 30.5, 0],
      [20, 30.5, 9.4],
      [-16, 30.5, 9.4],
      [-22, 30.5, 0],
      [-16, 30.5, -9.4],
      [20, 30.5, -9.4],
      [25, 30.5, 0],
    ];
    /** @type {THREE.BufferGeometry[]} */
    const rimGeos = [];
    for (let i = 0; i < rim.length - 1; i++) {
      rimGeos.push(sweepEllipse([rim[i], rim[i + 1]], 2, () => [0.45, 0.35], 6));
    }
    parts.push({ geometry: mergeGeos(rimGeos), mat: 'black2', name: 'canopy-rim' });
    // 駕駛人（座艙槽底）
    const deck = kit.innerYAt(0) - COCKPIT.depth + kit.t + 0.2;
    const drv = buildDriver(-2, deck, 1.15);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });

    // 分流稜鏡（prism-bar，L2-1 外露機能件）：架高的淡青透明三角柱橫桿＋兩端黑色三角側板（無外伸翼端片）
    parts.push({ geometry: buildPrismBar(33), mat: 'prism', solid: true, outline: true, renderOrder: 3, name: 'prism-bar' });
    // 內部分光芯（iter-70）：縮小 0.5 倍的三角柱，沿 z 分段、從中央青往兩端藍 → 紫 → 洋紅（左右對稱）；外觀件，不計質量
    const CORE = [
      { z0: 0, z1: 9, mat: 'core0' },
      { z0: 9, z1: 17, mat: 'core1' },
      { z0: 17, z1: 25, mat: 'core2' },
      { z0: 25, z1: 32, mat: 'core3' },
    ];
    for (const c of CORE) {
      const segs = [buildPrismBar(c.z1, 0.5, c.z0), buildPrismBar(-c.z0, 0.5, -c.z1)];
      parts.push({ geometry: mergeGeos(segs), mat: c.mat, name: `prism-core-${c.mat}` });
    }
    // iter-73：承托改成兩端的三角側板（iter-70 評審：內側兩根黑支柱讓它讀成一般 GT 翼）；
    // 側板在橫桿兩端（|z| 31.5，橫桿伸出側板外 1 mm），上緣就是稜鏡三角斷面，不高過稜鏡頂；下緣埋進尾段肩刻面
    /** @type {THREE.BufferGeometry[]} */
    const plates = [];
    for (const sg of [-1, 1]) {
      const zc = sg * 31.5;
      // 下緣沿尾段肩刻面往後斜降（前 28.2 → 後 22.7），再往下 0.6 mm 埋進殼面
      const yFront = kit.surf.topY(-49.5, 31.5) - 0.6;
      const yRear = kit.surf.topY(-61.5, 31.5) - 0.6;
      plates.push(
        finPlate(
          [
            [-49.5, yFront],
            [-61.5, yRear],
            [PRISM_TRI[1][0], PRISM_TRI[1][1]],
            [PRISM_TRI[2][0], PRISM_TRI[2][1]],
            [PRISM_TRI[0][0], PRISM_TRI[0][1]],
          ],
          zc,
          1.2,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(plates), mat: 'black2', solid: true, outline: true, name: 'prism-supports' });

    // 刻面分件線（iter-73：拿掉滿佈的細黑格線，只留大刻面的主要分件稜線，約 24 面）：
    // 縱向：鼻 / 尾中線稜、頂面平台邊（p1）、肩稜（p2）、側面最寬稜（y p4）；橫向：只在前後軸（x ±40）與鼻部箭頭轉折（x 62）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        const p = profileAt(x);
        // 中線稜只畫在座艙槽前後（座艙段是平頂）
        const dRidge = x > 26 || x < -24 ? az : 9;
        const dTop = Math.min(Math.abs(az - p[1][0]), Math.abs(az - p[2][0]), dRidge);
        const dSide = az > p[4][0] - 1.5 ? Math.abs(y - p[4][1]) : 9;
        let dKey = 9;
        for (const kx of [-40, 40, 62]) {
          dKey = Math.min(dKey, Math.abs(x - kx));
        }
        return 0.26 - Math.min(dTop, dSide, dKey);
      }),
      mat: 'dBlack',
      name: 'decal-facet-lines',
    });
    // 分光色塊（肩刻面，俯視從尾部稜鏡往前散開的帶狀區）：區內以斜切線分成 6 塊單色色塊，色塊之間與外框是黑色分隔線
    /** @type {(x: number, az: number) => number} 肩刻面色帶區的有號距離（> 0 在區內） */
    const topRegion = (x, az) => {
      const t = (x + 49) / 85;
      return Math.min(az - lerp(17.4, 13.4, t), lerp(22.5, 30.8, t) - az, x + 49, 36 - x);
    };
    /** @type {(x: number, az: number) => number} 肩刻面色塊的斜切座標（往前、往外增加）→ 正規化到 [0, 1] */
    const topS = (x, az) => (x + 49 + 0.9 * (az - 13.4)) / (85 + 0.9 * 17.4);
    /** @type {(x: number, y: number) => number} 側刻面色帶區的有號距離 */
    const sideRegion = (x, y) => {
      const t = (x + 24) / 49;
      return Math.min(lerp(27.7, 27.6, t) - y, y - lerp(23.2, 14.6, t), x + 24, 25 - x);
    };
    /** @type {(x: number, y: number) => number} 側刻面色塊的斜切座標（往前、往下增加） */
    const sideS = (x, y) => (x + 24 + 1.1 * (27.7 - y)) / (49 + 1.1 * 13.1);
    // 黑底（外框＋分隔線）：比色帶區外擴一條分隔線寬
    parts.push({
      geometry: kit.decal((x, y, z) => (topRegion(x, Math.abs(z)) + BLOCK_GAP), { offset: 0.07 }),
      mat: 'dBlack',
      name: 'decal-spectrum-frame',
    });
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < 32 ? -1 : sideRegion(x, y) + BLOCK_GAP), { offset: 0.07 }),
      mat: 'dBlack',
      name: 'decal-side-spectrum-frame',
    });
    // 每塊色塊：區內、且斜切座標落在該塊起訖之間（兩側各內縮分隔線半寬）
    SPECTRUM.forEach((mat, i) => {
      const e0 = SPECTRUM_EDGES[i];
      const e1 = SPECTRUM_EDGES[i + 1];
      parts.push({
        geometry: kit.decal((x, y, z) => {
          const az = Math.abs(z);
          const s = topS(x, az) * 100;
          return Math.min(topRegion(x, az), s - e0 * 100 - BLOCK_GAP, e1 * 100 - BLOCK_GAP - s);
        }, { offset: 0.09 + i * 0.002 }),
        mat,
        name: `decal-spectrum-${i}`,
      });
      parts.push({
        geometry: kit.decal((x, y, z) => {
          if (Math.abs(z) < 32) {
            return -1;
          }
          const s = sideS(x, y) * 60;
          return Math.min(sideRegion(x, y), s - e0 * 60 - BLOCK_GAP, e1 * 60 - BLOCK_GAP - s);
        }, { offset: 0.09 + i * 0.002 }),
        mat,
        name: `decal-side-spectrum-${i}`,
      });
    });
    // 刀口鼻上的細縫頭燈（每側一道往外後斜的長條）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (x < 58 || x > 66.5 || y < 14) {
          return -1;
        }
        const zc = lerp(13.5, 9.5, (x - 58) / 8.5);
        return 0.75 - Math.abs(az - zc);
      }, { offset: 0.1 }),
      mat: 'lamp',
      name: 'lamp-slits',
    });
    // 尾燈：尾段肩刻面的紅色短條
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (x > -59.5) {
          return -1;
        }
        return Math.min(0.9 - Math.abs(az - ptAt(x, 2)[0] + 3), x + 61.6);
      }, { offset: 0.1 }),
      mat: 'tail',
      name: 'lamp-tail',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm（同其他致敬款）；水晶座艙罩同厚度，以殼面積計入質量',
    geometry: '本檔關鍵站表 KEY（推估，依 HOMAGE_RESEARCH 6-5-2 P7：長約 131、座艙頂 38）；站間直線內插 → 平面刻面',
    wheelArches: '前後 R15.2：只對應 26 mm 輪（半徑 13＋2.2 mm）；31 mm 輪不支援（低車身）',
    prism: '分流稜鏡橫桿（透明 PC）與三角側板視為實心件（推估），質量 = 封閉體積 × 1.05 g/cm³',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
