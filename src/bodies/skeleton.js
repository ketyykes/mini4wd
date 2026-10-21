// 鏤空輕量款（body-skeleton）：煙燻半透明 PC 薄殼，挖掉大面積開口，看得到馬達與電池；螢光萊姆黃補強邊
// 設計：shared/design/body-skeleton/DESIGN.md；尺寸資料：data/body-skeleton.json（複製自 shared/design/body-skeleton/sections.json）
// 塗裝全為自創：號碼「24」、霧黑三角貼紙、萊姆黃邊框；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import data from './data/body-skeleton.json';
import { getPart } from '../parts/index.js';
import { makeLoftKit, cachedBuild, namedMaterial, decalMaterial, buildMountTabs, buildRegion, buildRim, sdNumber, sdConvexPolygon, sdRoundRect, sdBar, sideDecal, topDecal, mergeGeos, smoothstep } from './loft.js';

/** @typedef {import('./types').BodyDef} BodyDef */
/** @typedef {import('./loft.js').BodyPart} BodyPart */
/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 開口 / 輪拱 / 下緣周圍的萊姆黃補強邊寬度（DESIGN.md §3.4：1.2 mm） */
const BAND = 1.2;
/** @type {number} 補強凸緣高出殼面的高度（mm）：iter-36 改成貼著殼面的薄平凸緣（約 1.2 寬 × 0.3 高），不要像圓管 */
const RIB = 0.8;
/** @type {number} 凸緣頂部的倒角階（mm）：外圈 CHAMFER 寬的一階低 CHAMFER 高 */
const CHAMFER = 0.3;

/**
 * 葉子板隆起（iter-34）：讓輪拱切口留在側壁、不再切過肩部斜面；iter-36 改寬緩（σ 13 mm），補強邊沿葉子板不再起伏
 * @type {(x: number, az: number) => number}
 */
const bump = (x, az) =>
  smoothstep(18, 30, az) * 2.0 * (2.2 * Math.exp(-(((x - 46) / 13) ** 2)) + 1.5 * Math.exp(-(((x + 40) / 12) ** 2))) +
  // iter-36：中線拱起 1.6 mm（x −40 ~ 46），車頂不再是平板
  1.6 * (1 - smoothstep(4, 24, az)) * smoothstep(-58, -40, x) * (1 - smoothstep(46, 60, x));

/**
 * 頂面大型多邊形開口（iter-45，俯視 (x, z)，z 為實際座標、左右各自列出）：開口對準內部零件，少而大。
 * 依據 componentLayout：馬達 x −12.5~12.5、|z| < 10；電池 x −25~25、|z| 12~26.4；前 / 後齒輪箱 |x| 15.5~45、z −11~+1；
 * 座艙泡 x 6~32、|z| < 9.5（保留實心當座艙底）；前後卡座 (52, 0)、(−50, 0) 留中央肋；引擎蓋號碼牌 x 33.6~42.4。
 * 開口之間的肋寬 ≥ 2.5 mm（萊姆黃凸緣沿開口一圈 1.2 mm）。
 * @type {{ id: string, pts: number[][] }[]}
 */
const TOP_HOLES = [
  // 前齒輪箱上方：左右兩個往前收尖的五角形（中央留 6 mm 肋給前卡座）
  { id: 'F-L', pts: [[45, -3.2], [60.5, -3.2], [60.5, -9], [53, -17.5], [45, -17.5]] },
  { id: 'F-R', pts: [[45, 3.2], [60.5, 3.2], [60.5, 9], [53, 17.5], [45, 17.5]] },
  // 馬達正上方：跨中線的大六角形（座艙泡後方）
  { id: 'M', pts: [[4.5, -6], [4.5, 6], [-2, 10.4], [-17, 10.4], [-23, 5], [-23, -5], [-17, -10.4], [-2, -10.4]] },
  // 左右電池艙：長六角形（沿電池 x −25~24，|z| 12.9~25.5，前端繞過座艙泡）
  { id: 'B-L', pts: [[-27, -19], [-22, -12.9], [3.5, -12.9], [24, -13.5], [26, -19], [22, -25.5], [-22, -25.5]] },
  { id: 'B-R', pts: [[-27, 19], [-22, 12.9], [3.5, 12.9], [24, 13.5], [26, 19], [22, 25.5], [-22, 25.5]] },
  // 後齒輪箱上方：中央大三角（尖端朝前）＋左右後甲板五角形（中央留肋給後卡座）
  { id: 'R-C', pts: [[-26.5, 0], [-43, 9.5], [-43, -9.5]] },
  { id: 'R-L', pts: [[-45, -3.2], [-50.5, -3.2], [-50.5, -13], [-46, -16.5], [-40, -14]] },
  { id: 'R-R', pts: [[-45, 3.2], [-50.5, 3.2], [-50.5, 13], [-46, 16.5], [-40, 14]] },
].map((h) => ({ ...h, sd: sdConvexPolygon(h.pts) }));

/** @type {(x: number, y: number, z: number) => number} 頂面開口的距離（負值 = 挖空；只投影到頂面 / 肩部，不切側壁） */
const topHolesSd = (x, y, z) => {
  if (Math.abs(z) > 27) {
    return 10;
  }
  let d = Infinity;
  for (const h of TOP_HOLES) {
    d = Math.min(d, h.sd(x, z));
  }
  return d;
};

/**
 * 側窗 S1：六角窗以三根斜撐分成三角格（側視 (x, y)），只作用在側壁
 * @type {(x: number, y: number, z: number) => number}
 */
const sideWindowSd = (() => {
  const s1 = data.openings.find((o) => o.view === 'side' && o.shape === 'hex');
  const [x0] = s1.x;
  const x1 = 8.5;
  const [y0, y1] = s1.y;
  const c = (y1 - y0) / 2;
  const hex = sdConvexPolygon([
    [x0, (y0 + y1) / 2],
    [x0 + c, y1],
    [x1 - c, y1],
    [x1, (y0 + y1) / 2],
    [x1 - c, y0],
    [x0 + c, y0],
  ]);
  const xs = [-17.5, -10.5, -3.5, 3.5];
  /** @type {((u: number, v: number) => number)[]} */
  const struts = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const ya = i % 2 === 0 ? y0 - 1 : y1 + 1;
    const yb = i % 2 === 0 ? y1 + 1 : y0 - 1;
    struts.push(sdBar(xs[i], ya, xs[i + 1], yb, 1.6));
  }
  return (x, y, z) => {
    if (Math.abs(z) < 24) {
      return 10;
    }
    let ds = Infinity;
    for (const f of struts) {
      ds = Math.min(ds, f(x, y));
    }
    return Math.max(hex(x, y), -ds);
  };
})();

/**
 * iter-44：頂部 / 肩部的圓角矩形開口（H1–H4）改成 Voronoi 網格骨架；側窗 S1 前端縮到 x 8.5（iter-41 號碼位置）並加三角分格
 * @type {any}
 */
const SKELETON_DATA = {
  ...data,
  // iter-46：改成真正的「低趴短尾窄殼」——長度 x −53 ~ 62（短尾，後導輪架外露）、半寬 30（輪胎頂部外露），
  // 和其他款的俯視輪廓明顯不同（P20）。數值為推估，依底盤高度掃描：電池 |z| ≤ 26.4、後齒輪箱 y ≤ 21.4、x −52 處 |z| 21–24 有 y 19.6 的導輪架
  stationParams: [
    [62, 16.5, 10, 16.5, 16, 16, 15],
    [56, 19.5, 16, 19.5, 25, 17.5, 15],
    [50, 23, 20, 23.5, 28.5, 20, 13],
    [40, 24.5, 22, 26, 30, 24.5, 12],
    [30, 24.5, 22, 25.5, 30, 23, 10],
    [15, 25, 23, 24.5, 30, 21, 9.5],
    [0, 26, 23, 24.5, 30, 21, 9.5],
    [-15, 26, 23, 24.5, 30, 21, 9.5],
    [-30, 25.5, 22, 25, 30, 23, 10],
    [-40, 26, 22, 26, 30, 24.5, 12],
    [-48, 25, 20, 24.5, 28, 22.5, 18],
    [-53, 23.5, 17, 23.3, 24, 22.6, 21.5],
  ].map(([x, yTop, zF, yF, halfW, yShoulder, yLow]) => ({ x, yTop, zF, yF, halfW, yShoulder, yLow })),
  openings: [
    { id: 'T 頂面大型多邊形開口 ×8', view: 'top', shape: 'fn', sd: topHolesSd },
    { id: 'S1 側窗（三角分格）', view: 'side', shape: 'fn', sd: sideWindowSd },
  ],
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
  // iter-44：淺煙燻透明泡罩（降低鏡面與環境反射，不再讀成灰色實心塊）
  glass: namedMaterial('pc-clear', { color: 0x5c6670, roughness: 0.08, specularIntensity: 0.4, transparent: true, opacity: 0.22, envMapIntensity: 0.25, depthWrite: false }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-lime', { color: 0xc8f31d, roughness: 0.3, clearcoat: 0.8 }),
  black: decalMaterial('decal-matte-black', { color: 0x111111, roughness: 0.8 }),
  limeDecal: decalMaterial('decal-lime', { color: 0xc8f31d, roughness: 0.4, emissive: 0xc8f31d, emissiveIntensity: 0.05 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/** @type {() => BodyPart[]} */
const compose = () => {
  const kit = makeLoftKit(SKELETON_DATA, { mode: 'linear', sideZMin: 24, bump, tuck: 2.0, xSmooth: true });
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
  // iter-45：凸緣高 RIB = 0.8 mm、頂部外圈一階 CHAMFER 倒角（外圈 0.3 mm 寬的環低 0.3 mm）
  /** @type {KeepFn} */
  const limeTop = (x, y, z, s) => lime(x, y, z, s) - CHAMFER;
  const limeStep = buildRegion(surf, [...kit.holes, lime, (x, y, z, s) => -limeTop(x, y, z, s)], { offset: RIB - CHAMFER, smoothOffset: true });
  const limeRib = buildRegion(surf, [...kit.holes, limeTop], { offset: RIB, smoothOffset: true });
  parts.push({ geometry: limeRib.geometry, mat: 'lime', shell: true, name: 'shell-lime-frame' });
  parts.push({ geometry: limeStep.geometry, mat: 'limeEdge', name: 'shell-lime-chamfer' });
  parts.push({ geometry: mergeGeos([buildRim(limeStep, 0, RIB - CHAMFER), buildRim(limeRib, RIB - CHAMFER, RIB)]), mat: 'limeEdge', name: 'shell-lime-rib-wall' });
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
  // 座艙內裝（iter-44）：後傾椅背＋駕駛人剪影（萊姆黃頭盔、深色肩部與軀幹），透過泡罩看得到
  const deck = (x) => kit.innerYAt(x) + kit.t;
  const seatBack = new THREE.CapsuleGeometry(2.2, 2.0, 4, 12);
  seatBack.scale(0.35, 1, 1.1);
  seatBack.rotateZ(0.55);
  seatBack.translate(9.6, deck(10) + 1.4, 0);
  const shoulders = new THREE.CapsuleGeometry(0.9, 3.6, 4, 12);
  shoulders.rotateX(Math.PI / 2);
  shoulders.translate(12, deck(12) + 1.2, 0);
  const torso = new THREE.CapsuleGeometry(1.2, 4.0, 4, 12);
  torso.rotateZ(Math.PI / 2 - 0.35);
  torso.scale(1, 0.7, 1.4);
  torso.translate(15, deck(15) + 0.5, 0);
  parts.push({ geometry: mergeGeos([seatBack, shoulders, torso]), mat: 'driver', name: 'cockpit-driver' });
  const helmet = new THREE.SphereGeometry(1.55, 20, 14);
  helmet.scale(1.12, 1, 0.95);
  helmet.translate(13.6, deck(13.6) + 2.9, 0);
  parts.push({ geometry: helmet, mat: 'helmet', name: 'cockpit-helmet' });

  // ---- 貼紙 ----
  // iter-44：頂部霧黑三角拿掉（會被網格骨架切碎），只保留側面三角
  // 側面三角：六角側窗前端與前輪拱之間（側視 x–y）
  const triSide = sdConvexPolygon([
    [20.6, 10.9],
    [23.8, 10.9],
    [23.8, 19.6],
  ]);
  parts.push({
    geometry: mergeGeos([
      kit.decal(sideDecal((u, v) => triSide(u, v) + 0.5, { x0: 0, y0: 0, zMin: 24, side: 1 }), { offset: 0.12 }),
      kit.decal(sideDecal((u, v) => triSide(-u, v) + 0.5, { x0: 0, y0: 0, zMin: 24, side: -1 }), { offset: 0.12 }),
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
      kit.decal(sideDecal(sidePlate, { x0: 15.25, y0: 16.2, zMin: 24 })),
      // 側面三角的萊姆黃外框（黑三角內縮 0.5 mm 疊在上面）
      kit.decal(sideDecal((u, v) => triSide(u, v), { x0: 0, y0: 0, zMin: 24, side: 1 })),
      kit.decal(sideDecal((u, v) => triSide(-u, v), { x0: 0, y0: 0, zMin: 24, side: -1 })),
    ]),
    mat: 'limeDecal',
    name: 'decal-number-plate',
  });
  parts.push({
    geometry: mergeGeos([
      kit.decal(topDecal(sdNumber('24', { h: 6.2, w: 3.5, gap: 1.0 }), { x0: 38, yMin: 20 }), { offset: 0.12 }),
      kit.decal(sideDecal(sdNumber('24', { h: 4.2, w: 2.6, gap: 0.8, slant: 0.12 }), { x0: 15.25, y0: 16.2, zMin: 24 }), { offset: 0.12 }),
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
  style: 'race',
  theme: '低趴鏤空輕量殼：煙燻 PC、大型多邊形開口看得到馬達與電池',
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
