// 鏤空輕量款（body-skeleton）：煙燻半透明 PC 薄殼，挖掉大面積開口，看得到馬達與電池；螢光萊姆黃補強邊
// 設計：shared/design/body-skeleton/DESIGN.md；尺寸資料：data/body-skeleton.json（複製自 shared/design/body-skeleton/sections.json）
// 塗裝全為自創：號碼「24」、霧黑三角貼紙、萊姆黃邊框；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import data from './data/body-skeleton.json';
import { getPart } from '../parts/index.js';
import { makeLoftKit, cachedBuild, namedMaterial, decalMaterial, buildMountTabs, buildRegion, buildRim, sdNumber, sdConvexPolygon, sdRoundRect, sideDecal, topDecal, mergeGeos, smoothstep } from './loft.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 開口 / 輪拱 / 下緣周圍的萊姆黃補強邊寬度（DESIGN.md §3.4：1.2 mm） */
const BAND = 1.2;
/** @type {number} 補強凸緣高出殼面的高度（mm）：iter-36 改成貼著殼面的薄平凸緣（約 1.2 寬 × 0.3 高），不要像圓管 */
const RIB = 0.3;

/**
 * 葉子板隆起（iter-34）：讓輪拱切口留在側壁、不再切過肩部斜面；iter-36 改寬緩（σ 13 mm），補強邊沿葉子板不再起伏
 * @type {(x: number, az: number) => number}
 */
const bump = (x, az) =>
  smoothstep(18, 30, az) * 2.0 * (2.2 * Math.exp(-(((x - 46) / 13) ** 2)) + 1.5 * Math.exp(-(((x + 40) / 12) ** 2))) +
  // iter-36：中線拱起 1.6 mm（x −40 ~ 46），車頂不再是平板
  1.6 * (1 - smoothstep(4, 24, az)) * smoothstep(-58, -40, x) * (1 - smoothstep(46, 60, x));

/**
 * iter-41：六角側窗 S1 前端從 x 20 縮到 x 8.5，空出 x 9.5–21 的平直側板放橫排號碼「24」（設計資料其餘不變）
 * @type {any}
 */
const SKELETON_DATA = {
  ...data,
  openings: data.openings.map((o) => (o.view === 'side' && o.shape === 'hex' ? { ...o, x: [o.x[0], 8.5] } : o)),
};

/** @type {() => Record<string, THREE.Material>} */
const makeMaterials = () => ({
  smoke: namedMaterial('pc-smoke', { color: 0x3a3f44, roughness: 0.1, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false }),
  smokeInner: namedMaterial('pc-smoke-inner', { color: 0x2c3034, roughness: 0.2, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.BackSide }),
  edge: namedMaterial('pc-smoke-edge', { color: 0x3a3f44, roughness: 0.2, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
  lime: namedMaterial('paint-lime', { color: 0xc8f31d, roughness: 0.4, emissive: 0xc8f31d, emissiveIntensity: 0.05, clearcoat: 0.5 }),
  limeInner: namedMaterial('paint-lime', { color: 0x9cbd16, roughness: 0.5, side: THREE.BackSide }),
  limeEdge: namedMaterial('paint-lime', { color: 0xb4dc18, roughness: 0.45, side: THREE.DoubleSide }),
  seat: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  glass: namedMaterial('pc-clear', { color: 0xc8d4e0, roughness: 0.02, transparent: true, opacity: 0.12, envMapIntensity: 0.35, depthWrite: false }),
  black: decalMaterial('decal-matte-black', { color: 0x111111, roughness: 0.8 }),
  limeDecal: decalMaterial('decal-lime', { color: 0xc8f31d, roughness: 0.4, emissive: 0xc8f31d, emissiveIntensity: 0.05 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {() => BodyPart[]} */
const compose = () => {
  const kit = makeLoftKit(SKELETON_DATA, { mode: 'linear', sideZMin: 30, bump, tuck: 2.0, xSmooth: true });
  const { surf } = kit;
  /** @type {BodyPart[]} */
  const parts = [];

  /** @type {(x: number, y: number, z: number) => number} 到開口、輪拱、下緣的距離（近似） */
  const edgeDist = (x, y, z) => {
    let d = kit.openingDist(x, y, z);
    // 輪拱用「到實際切口邊界的 3D 距離」：葉子板頂面幾乎貼著切割圓柱，用圓柱距離會變成星形色塊（iter-33 reviewer）
    d = Math.min(d, kit.archEdgeDist(x, y, z));
    d = Math.min(d, kit.sideRail(x, y, z, 0));
    return Math.min(d, y - surf.ctrl(x).yLow);
  };
  /** @type {KeepFn} 萊姆黃區：開口補強邊 ∪ 肩稜細線 */
  const lime = (x, y, z) => {
    const c = surf.ctrl(x);
    const az = Math.abs(z);
    const crease = Math.min(az - (c.zF - 1.9), c.zF - 0.7 - az, x + 58, 64 - x);
    return Math.max(BAND - edgeDist(x, y, z), crease);
  };
  /** @type {KeepFn} */
  const cab = (x, y, z) => kit.underCanopy(x, z);

  // 萊姆黃補強凸緣：沿開口、輪拱、下緣與肩稜，平頂、高出殼面 RIB mm，側面用窄牆接回殼面
  const limeRib = buildRegion(surf, [...kit.holes, lime], { offset: RIB, smoothOffset: true });
  parts.push({ geometry: limeRib.geometry, mat: 'lime', shell: true, name: 'shell-lime-frame' });
  parts.push({ geometry: buildRim(limeRib, 0, RIB), mat: 'limeEdge', name: 'shell-lime-rib-wall' });
  parts.push({ geometry: kit.outer([(x, y, z, s) => -lime(x, y, z, s), (x, y, z, s) => -cab(x, y, z, s)]), mat: 'smoke', shell: true, renderOrder: 2, name: 'shell-smoke' });
  parts.push({ geometry: kit.outer([(x, y, z, s) => -lime(x, y, z, s), cab]), mat: 'seat', shell: true, name: 'shell-cockpit' });

  const st = kit.structure();
  // 內面：萊姆黃補強邊在內面也塗（真空成形 PC 從內側塗裝），其餘煙燻
  const innerLime = buildRegion(surf, [...kit.holes, lime], { offset: -kit.t }).geometry;
  const innerSmoke = buildRegion(surf, [...kit.holes, (x, y, z, s) => -lime(x, y, z, s)], { offset: -kit.t }).geometry;
  parts.push({ geometry: innerLime, mat: 'limeInner', name: 'shell-inner-lime' });
  parts.push({ geometry: innerSmoke, mat: 'smokeInner', renderOrder: 1, name: 'shell-inner' });
  parts.push({ geometry: st.rim, mat: 'limeEdge', name: 'shell-edge' });
  parts.push({ geometry: mergeGeos([st.capFront, st.capRear]), mat: 'smoke', shell: true, renderOrder: 2, name: 'caps' });
  parts.push({ geometry: mergeGeos([st.capFrontIn, st.capRearIn]), mat: 'smokeInner', renderOrder: 1, name: 'cap-inner' });

  // 座艙泡（透明 PC）
  parts.push({ geometry: buildRegion(kit.canopy, []).geometry, mat: 'glass', shell: true, renderOrder: 3, name: 'canopy' });

  // ---- 貼紙 ----
  // 霧黑三角：前肩、後甲板兩側
  const triFront = sdConvexPolygon([
    [41, 18],
    [27, 18],
    [27, 26.5],
  ]);
  const triRear = sdConvexPolygon([
    [-44, 20],
    [-44, 27.5],
    [-57, 20],
  ]);
  // 側面三角：六角側窗前端與前輪拱之間（側視 x–y）
  const triSide = sdConvexPolygon([
    [20.6, 10.9],
    [23.8, 10.9],
    [23.8, 19.6],
  ]);
  parts.push({
    geometry: mergeGeos([
      kit.decal((x, y, z) => -triFront(x, Math.abs(z))),
      kit.decal((x, y, z) => -triRear(x, Math.abs(z))),
      kit.decal(sideDecal((u, v) => triSide(u, v) + 0.5, { x0: 0, y0: 0, zMin: 30, side: 1 }), { offset: 0.12 }),
      kit.decal(sideDecal((u, v) => triSide(-u, v) + 0.5, { x0: 0, y0: 0, zMin: 30, side: -1 }), { offset: 0.12 }),
    ]),
    mat: 'black',
    name: 'decal-triangles',
  });
  // 號碼 24：引擎蓋上的萊姆黃底板 + 黑字
  // 側面號碼 24（DESIGN.md §4）：側面大半被六角側窗佔滿，放在側窗前端上方、前輪拱後方的側壁＋肩部
  // iter-41：橫排號碼放在側窗前方的平直側板（x 10.5–20、y 13.4–19），底板 9.5 × 5.6
  const sidePlate = (u, v) => sdRoundRect(u, v, -4.75, 4.75, -2.8, 2.8, 0.8);
  parts.push({
    geometry: mergeGeos([
      kit.decal((x, y, z) => -sdRoundRect(x, z, 33.6, 42.4, -6.4, 6.4, 1.2)),
      kit.decal(sideDecal(sidePlate, { x0: 15.25, y0: 16.2, zMin: 30 })),
      // 側面三角的萊姆黃外框（黑三角內縮 0.5 mm 疊在上面）
      kit.decal(sideDecal((u, v) => triSide(u, v), { x0: 0, y0: 0, zMin: 30, side: 1 })),
      kit.decal(sideDecal((u, v) => triSide(-u, v), { x0: 0, y0: 0, zMin: 30, side: -1 })),
    ]),
    mat: 'limeDecal',
    name: 'decal-number-plate',
  });
  parts.push({
    geometry: mergeGeos([
      kit.decal(topDecal(sdNumber('24', { h: 6.2, w: 3.5, gap: 1.0 }), { x0: 38, yMin: 20 }), { offset: 0.12 }),
      kit.decal(sideDecal(sdNumber('24', { h: 4.2, w: 2.6, gap: 0.8, slant: 0.12 }), { x0: 15.25, y0: 16.2, zMin: 30 }), { offset: 0.12 }),
    ]),
    mat: 'black',
    name: 'decal-number',
  });

  parts.push({ geometry: buildMountTabs(MOUNTS, (x) => kit.innerYAt(x)), mat: 'mount', name: 'mount-tabs' });
  return parts;
};

/** @type {{ id: string, x: number, y: number, z: number }[]} */
const MOUNTS = getPart('chassis-midship').bodyMounts.map((m) => ({ ...m }));

/** @type {BodyDef} */
export const skeletonBody = {
  id: 'body-skeleton',
  category: 'body',
  name: '鏤空輕量款',
  material: 'PC',
  density_g_cm3: 1.2,
  wallThickness_mm: SKELETON_DATA.wallThickness_mm,
  mounts: MOUNTS.map((m) => ({ ...m })),
  build: cachedBuild(compose, makeMaterials),
  src: {
    density_g_cm3: 'SPEC 1.14：聚碳酸酯（PC）約 1.20 g/cm³（推估）',
    wallThickness_mm: 'shared/design/body-skeleton/DESIGN.md §5：真空成形 PC 殼約 0.4 mm，取 0.5 讓開口周圍不會太軟（推估）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）；卡座為獨立 ABS 小零件，不計入殼面積質量',
    geometry: 'shared/design/body-skeleton/sections.json（複製到 src/bodies/data/body-skeleton.json）',
  },
};
