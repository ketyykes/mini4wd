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
const RIB = 0.3;

/**
 * 葉子板隆起（iter-34）：讓輪拱切口留在側壁、不再切過肩部斜面；iter-36 改寬緩（σ 13 mm），補強邊沿葉子板不再起伏
 * @type {(x: number, az: number) => number}
 */
const bump = (x, az) =>
  smoothstep(18, 30, az) * 2.0 * (2.2 * Math.exp(-(((x - 46) / 13) ** 2)) + 1.5 * Math.exp(-(((x + 40) / 12) ** 2))) +
  // iter-36：中線拱起 1.6 mm（x −40 ~ 46），車頂不再是平板
  1.6 * (1 - smoothstep(4, 24, az)) * smoothstep(-58, -40, x) * (1 - smoothstep(46, 60, x));

/** @type {number} 網格骨架寬度（mm，iter-44） */
const STRUT = 2.0;

/** @type {(i: number) => number} 確定性的 0–1 雜湊（種子抖動與開孔選擇用，每次建模結果相同） */
const hash = (i) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * 頂部網格骨架的種子點（俯視 (x, |z|)）：間距約 10.8 × 8.6 mm 的交錯格點加抖動 → Voronoi 胞是不規則的六角 / 五角 / 三角形；
 * 約 1/4 的胞保留成煙燻 PC 面板（closed），其餘挖空
 * @type {{ x: number, z: number, open: boolean }[]}
 */
const SEEDS = (() => {
  const out = [];
  let n = 0;
  for (let row = 0; row < 4; row++) {
    const z0 = 4.5 + row * 8.6;
    const shift = row % 2 === 0 ? 0 : 5.4;
    for (let x = -62 + shift; x <= 66; x += 10.8) {
      n++;
      out.push({ x: x + (hash(n) - 0.5) * 3.2, z: z0 + (hash(n + 97) - 0.5) * 2.6, open: hash(n + 211) > 0.24 });
    }
  }
  return out;
})();

/**
 * 允許挖空的範圍（俯視凸多邊形 (x, |z|)）：引擎蓋、座艙兩側、中段＋後甲板、兩輪拱之間的肩部；
 * 中央 2.2 mm 脊、前後卡座、座艙底、引擎蓋號碼牌、鼻尖、尾端都保留實心
 * @type {((x: number, z: number) => number)[]}
 */
const LATTICE_ALLOWED = [
  [[61, 2.2], [61, 15], [50, 22], [33, 22], [33, 2.2]],
  [[33, 11], [33, 22], [4, 22], [4, 11]],
  [[4, 2.2], [4, 22], [-38, 22], [-60, 17], [-60, 2.2]],
  [[24, 22], [22, 33.5], [-22, 33.5], [-24, 22]],
].map((pts) => sdConvexPolygon(pts));

/** @type {number[][]} 保留實心的方塊 [x0, x1, zMax]：前後卡座、座艙底、引擎蓋號碼牌 */
const LATTICE_SOLID = [
  [46, 58, 5.5],
  [-56, -44, 5.5],
  [5, 33, 10.5],
  [32, 44, 7.5],
];

/**
 * 到最近骨架中線的距離：p 所在 Voronoi 胞 i 與其他胞 j 的平分線距離最小值（直線，邊緣乾淨）
 * @type {(x: number, z: number) => { d: number, open: boolean }}
 */
const voronoiEdge = (x, z) => {
  let i0 = 0;
  let best = Infinity;
  for (let i = 0; i < SEEDS.length; i++) {
    const d2 = (SEEDS[i].x - x) ** 2 + (SEEDS[i].z - z) ** 2;
    if (d2 < best) {
      best = d2;
      i0 = i;
    }
  }
  const a = SEEDS[i0];
  let d = Infinity;
  for (let j = 0; j < SEEDS.length; j++) {
    if (j === i0) {
      continue;
    }
    const b = SEEDS[j];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len > 2 * Math.sqrt(best) + 2 * d) {
      continue;
    }
    const dj2 = (b.x - x) ** 2 + (b.z - z) ** 2;
    d = Math.min(d, (dj2 - best) / (2 * len));
  }
  return { d, open: a.open };
};

/** @type {(x: number, z: number) => number} 允許挖空範圍的距離（負值 = 在範圍內） */
const allowedSd = (x, z) => {
  let d = Infinity;
  for (const f of LATTICE_ALLOWED) {
    d = Math.min(d, f(x, z));
  }
  for (const [x0, x1, zm] of LATTICE_SOLID) {
    d = Math.max(d, -sdRoundRect(x, z, x0, x1, -zm, zm, 1));
  }
  return d;
};

/** @type {(x: number, y: number, z: number) => number} 頂部網格開口（負值 = 挖空） */
const latticeSd = (x, y, z) => {
  const az = Math.abs(z);
  const e = voronoiEdge(x, az);
  if (!e.open) {
    return 10;
  }
  return Math.max(STRUT / 2 - e.d, allowedSd(x, az) + STRUT / 2);
};

/** @type {(x: number, y: number, z: number) => number} 骨架中線距離（> 0 越遠；只在允許範圍內有意義），萊姆黃沿骨架走 */
const strutLime = (x, y, z) => {
  const az = Math.abs(z);
  // 只在允許範圍內縮 STRUT 處畫骨架，避免骨架伸進實心區形成懸空短枝
  if (allowedSd(x, az) > -STRUT / 2 - 0.1) {
    return -1;
  }
  return STRUT / 2 + 0.05 - voronoiEdge(x, az).d;
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
    if (Math.abs(z) < 30) {
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
  openings: [
    { id: 'L 頂部網格骨架', view: 'top', shape: 'fn', sd: latticeSd },
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
    return Math.max(BAND - edgeDist(x, y, z), crease, strutLime(x, y, z));
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
