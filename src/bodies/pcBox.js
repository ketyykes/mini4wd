// PC 透明平頂短尾殼（body-pc-box，常見比賽車殼型式）：真空成形聚碳酸酯薄殼 0.5 mm、平頂、斷尾（尾端垂直切平）、大輪拱。
// 比賽場上常見的「透明殼從內側噴漆、留透明窗」做法：殼體是淡煙燻透明 PC，只有下裙、條紋與號碼是內噴的不透明漆。
// 設計：shared/design/body-pc-box/DESIGN.md。剖面為本檔站位表（推估，依外框限制與底盤高度掃描）。
// 塗裝全為自創：螢光粉＋白條紋、號碼「17」；不含任何廠商名稱、商標。
import * as THREE from 'three';
import { makePolyBody, buildDriver } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdRoundRect, sideDecal, topDecal, mergeGeos } from './loft.js';

/** @type {(yRoof: number, halfW: number, yLow: number) => number[][]} 平頂箱形半剖面（8 點）：平頂 → 圓角肩 → 直立側面（下緣高時各點不低於下緣，剖面保持單調） */
const box = (yRoof, halfW, yLow) =>
  [
    [0, yRoof],
    [halfW * 0.33, yRoof],
    [halfW * 0.55, yRoof - 0.3],
    [halfW * 0.7, yRoof - 0.9],
    [halfW * 0.81, yRoof - 2],
    [halfW * 0.91, yRoof - 3.6],
    [halfW, yRoof - 6.5],
    [halfW, yLow],
  ].map(([z, y], i) => [z, i < 7 ? Math.max(y, yLow + 0.25 * (7 - i)) : y]);

/**
 * 站位表：鼻部短斜面 x 64 → 46，平頂 y 28.5 從 x 46 一路到 x −48，x −52 斷尾。
 * 輪拱 R17.6（可裝 31 mm 大徑輪）。
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = [
  { x: 64, pts: box(17, 24, 14.5) },
  { x: 60, pts: box(20.5, 32, 14) },
  { x: 54, pts: box(24.8, 38, 13) },
  { x: 46, pts: box(28.5, 39, 11) },
  { x: 40, pts: box(28.5, 39, 11) },
  { x: 25, pts: box(28.5, 39, 9.5) },
  { x: 0, pts: box(28.5, 39, 9) },
  { x: -25, pts: box(28.5, 39, 9.5) },
  { x: -40, pts: box(28.5, 39, 11) },
  // 斷尾：尾段下緣抬到 y 26（後輪胎頂之上），尾端是一片窄的垂直斷面，後輪從下方外露
  { x: -46, pts: box(28.4, 38.5, 20) },
  { x: -49, pts: box(28.3, 38, 26) },
  { x: -52, pts: box(28.2, 37.5, 26.2) },
];

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 淡煙燻透明 PC（Blender 依名稱對應透明聚碳酸酯）
  clear: namedMaterial('pc-clear-shell', { color: 0x9fb4c8, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.28, envMapIntensity: 0.5, depthWrite: false }),
  clearIn: namedMaterial('pc-clear-shell-inner', { color: 0x8aa0b4, roughness: 0.08, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.BackSide }),
  edge: namedMaterial('pc-clear-edge', { color: 0xb8c8d8, roughness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  // 內噴不透明漆
  pink: namedMaterial('pc-paint-fluo-pink', { color: 0xff2e88, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  white: namedMaterial('pc-paint-white', { color: 0xf4f4f2, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-pink', { color: 0xff2e88, roughness: 0.3, clearcoat: 0.8 }),
  black: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  whiteDecal: decalMaterial('decal-white', { color: 0xf4f4f2, roughness: 0.3 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

export const pcBoxBody = makePolyBody({
  id: 'body-pc-box',
  name: 'PC 透明平頂短尾殼',
  style: 'race',
  theme: '真空成形透明 PC 薄殼、平頂、斷尾、大輪拱（可裝 31 mm 輪）的比賽殼',
  material: 'PC',
  density_g_cm3: 1.2,
  wallThickness_mm: 0.5,
  stations: STATIONS,
  tuck: 1.0,
  wheelArches: [
    { x: 40, y: 13, radius: 17.6, cutZFrom: 23.3 },
    { x: -40, y: 13, radius: 17.6, cutZFrom: 23.3 },
  ],
  canopy: null,
  zones: () => [
    // 內噴粉紅下裙（前低後高）＋白色中線寬條紋，其餘透明
    { mat: 'pink', keep: (x, y) => 15.5 + 0.03 * x - y },
    { mat: 'white', keep: (x, y, z) => Math.min(3.2 - Math.abs(z), y - 26) },
    { mat: 'pink', keep: (x, y, z) => Math.min(Math.abs(z) - 5, 7 - Math.abs(z), y - 26) },
    { mat: 'clear', keep: () => 1 },
  ],
  mats: { inner: 'clearIn', edge: 'edge', cap: 'pink', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    // 透明殼裡看得到的座艙與駕駛人
    const drv = buildDriver(6, kit.innerYAt(6) - 5.8, 1.1);
    parts.push({ geometry: drv.body, mat: 'driver', name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', name: 'cockpit-helmet' });
    // 號碼 17：側面白底黑字、車頂黑字
    const plate = (u, v) => sdRoundRect(u, v, -5, 5, -3.2, 3.2, 1);
    parts.push({
      geometry: kit.decal(sideDecal(plate, { x0: -8, y0: 17.5, zMin: 30 })),
      mat: 'whiteDecal',
      name: 'decal-number-plate',
    });
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('17', { h: 4.6, w: 2.8, gap: 0.8 }), { x0: -8, y0: 17.5, zMin: 30 }), { offset: 0.12 }),
        kit.decal(topDecal(sdNumber('17', { h: 6, w: 3.4, gap: 0.9 }), { x0: -30, yMin: 27 }), { offset: 0.12 }),
      ]),
      mat: 'black',
      name: 'decal-number',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：聚碳酸酯（PC）約 1.20 g/cm³（推估）',
    wallThickness_mm: 'GOAL：PC 透明薄殼真空成形 0.4–0.5 mm，取 0.5（推估）',
    geometry: '本檔 STATIONS（推估）；輪拱 R17.6 以容納 31 mm 大徑輪',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
