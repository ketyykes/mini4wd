// 稜鏡刻面（body-prism-facet，第六階段 LG2 致敬款）：低多邊形楔形全罩，全身由大平面刻面組成、左右完全對稱；
// 鼻端是一道水平刀口刻面；座艙置中，上面是多刻面無色透明「水晶」座艙罩（看得到駕駛人）；
// 車尾一根三角柱斷面的「分流稜鏡」橫桿（L2-1 外露機能件），兩端由兩片低矮三角側板承托，沒有外伸翼端片。
// 設計：shared/design/body-prism-facet/DESIGN.md（HOMAGE_RESEARCH 第 6 節 P7、LG2 語彙 L2-x、和劇中車 / 市售車殼的差異）。
// 剖面為本檔的折線站位表（推估）：站間直線內插（每 1 mm 一站）→ 每個刻面都是平面，稜線銳利。
// 塗裝全為自創：白殼＋細黑刻面線＋從尾部稜鏡往前散開的六色光譜帶（六色一律完整出現）；不含任何廠商 / 作品名稱、商標、隊徽、國旗或角色圖像。
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
const KEY = [
  { x: -62, pts: [[0, 28.2], [9, 28.2], [20, 27], [27, 22], [26, 17.5]] },
  { x: -54, pts: [[0, 30], [11, 30], [24, 29.1], [31.5, 24], [30.5, 14.5]] },
  { x: -40, pts: [[0, 30.6], [12, 30.6], [29, 30.2], [36.2, 27.8], [35.2, 13]] },
  { x: -20, pts: [[0, 30.8], [12, 30.8], [33, 29], [43, 23.2], [41.8, 13]] },
  { x: 0, pts: [[0, 30.8], [12.5, 30.8], [32, 28.9], [41, 22.8], [39.8, 13.5]] },
  { x: 22, pts: [[0, 30.4], [12.5, 30.4], [30.5, 29.2], [38.8, 23.4], [37.8, 13.5]] },
  { x: 40, pts: [[0, 28.8], [12, 29.3], [29, 30], [36.6, 27.8], [35.8, 13]] },
  { x: 54, pts: [[0, 23.5], [11, 24], [26.5, 23.6], [35, 19.4], [34, 13.5]] },
  { x: 69, pts: [[0, 15.6], [11, 15.6], [24, 15.4], [32, 15], [31.5, 14.4]] },
];
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
  dRed: decalMaterial('decal-spectrum-red', { color: 0xe8262f, roughness: 0.3, clearcoat: 0.6 }),
  dOrange: decalMaterial('decal-spectrum-orange', { color: 0xff8a1c, roughness: 0.3, clearcoat: 0.6 }),
  dYellow: decalMaterial('decal-spectrum-yellow', { color: 0xffd927, roughness: 0.3, clearcoat: 0.6 }),
  dGreen: decalMaterial('decal-spectrum-green', { color: 0x2fc25a, roughness: 0.3, clearcoat: 0.6 }),
  dBlue: decalMaterial('decal-spectrum-blue', { color: 0x2a7ee8, roughness: 0.3, clearcoat: 0.6 }),
  dViolet: decalMaterial('decal-spectrum-violet', { color: 0x8a3fd6, roughness: 0.3, clearcoat: 0.6 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** 六色光譜帶（由上往下 / 由內往外）：材質鍵 */
const SPECTRUM = ['dRed', 'dOrange', 'dYellow', 'dGreen', 'dBlue', 'dViolet'];

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
const buildPrismBar = (halfSpan) => {
  const tri = [
    [-51.4, 32.4],
    [-59.6, 32.4],
    [-55.5, 37.2],
  ];
  /** @type {THREE.Vector3[]} */
  const v = [];
  for (const [x, y] of tri) {
    v.push(new THREE.Vector3(x, y, -halfSpan), new THREE.Vector3(x, y, halfSpan));
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
  theme: '低多邊形平面刻面楔形、水平刀口鼻、置中的多刻面水晶座艙罩、車尾三角柱分流稜鏡橫桿；白殼上六色光譜帶從尾部稜鏡往前散開',
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

    // 分流稜鏡（prism-bar，L2-1 外露機能件）：透明三角柱橫桿＋兩片低矮黑色三角側板（不高過肩線、無外伸翼端片）
    parts.push({ geometry: buildPrismBar(33), mat: 'crystal', solid: true, outline: true, renderOrder: 3, name: 'prism-bar' });
    /** @type {THREE.BufferGeometry[]} */
    const plates = [];
    for (const sg of [-1, 1]) {
      const zc = sg * 25;
      const yDeck = kit.surf.topY(-55.5, 25) - 0.6;
      plates.push(
        finPlate(
          [
            [-48.5, yDeck],
            [-62, yDeck],
            [-59.6, 32.6],
            [-51.4, 32.6],
          ],
          zc,
          1.4,
        ),
      );
    }
    parts.push({ geometry: mergeGeos(plates), mat: 'black2', solid: true, outline: true, name: 'prism-supports' });

    // 細黑刻面線：頂面稜（z1）、肩稜（z2）、側面最寬稜（y3）、關鍵站的橫向轉折線
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        const p = profileAt(x);
        const dTop = Math.min(Math.abs(az - p[1][0]), Math.abs(az - p[2][0]));
        const dSide = az > p[2][0] + 1 ? Math.abs(y - p[3][1]) : 9;
        let dKey = 9;
        for (const kx of [-54, -40, -20, 40, 54]) {
          dKey = Math.min(dKey, Math.abs(x - kx));
        }
        return 0.2 - Math.min(dTop, dSide, dKey);
      }),
      mat: 'dBlack',
      name: 'decal-facet-lines',
    });
    // 六色光譜帶（肩刻面，俯視從尾部稜鏡往前散開）：尾端窄（z 17–22）→ 前端寬（z 13.5–29）
    SPECTRUM.forEach((mat, i) => {
      const zBack = 17.4 + i * 0.85;
      const zFront = 14 + i * 2.9;
      parts.push({
        geometry: kit.decal((x, y, z) => {
          if (x < -49 || x > 36) {
            return -1;
          }
          const t = (x + 49) / 85;
          const zc = lerp(zBack, zFront, t);
          const w = lerp(0.36, 1.15, t);
          return w - Math.abs(Math.abs(z) - zc);
        }, { offset: 0.08 + i * 0.002 }),
        mat,
        name: `decal-spectrum-${i}`,
      });
    });
    // 側面光譜帶（兩輪之間的側刻面）：六色細線從後往前往下散開
    SPECTRUM.forEach((mat, i) => {
      const yBack = 27.4 - i * 0.7;
      const yFront = 27 - i * 2.1;
      parts.push({
        geometry: kit.decal((x, y, z) => {
          if (Math.abs(z) < 32 || x < -24 || x > 25) {
            return -1;
          }
          const t = (x + 24) / 49;
          const yc = lerp(yBack, yFront, t);
          const w = lerp(0.3, 0.85, t);
          return w - Math.abs(y - yc);
        }, { offset: 0.08 + i * 0.002 }),
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
