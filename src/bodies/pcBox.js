// PC 透明平頂短尾殼（body-pc-box，常見比賽車殼型式）：真空成形聚碳酸酯薄殼 0.5 mm、平頂、斷尾（尾端垂直切平）、大輪拱。
// 比賽場上常見的「透明殼從內側噴漆、留透明窗」做法：殼體是淡煙燻透明 PC，只有下裙、條紋與號碼是內噴的不透明漆。
// 設計：shared/design/body-pc-box/DESIGN.md。剖面為本檔站位表（推估，依外框限制與底盤高度掃描）。
// 塗裝全為自創：螢光粉＋白條紋、號碼「17」；不含任何廠商名稱、商標。
import * as THREE from 'three';
import { makePolyBody, buildDriver } from './polyBody.js';
import { namedMaterial, decalMaterial, buildRegion, sdNumber, sdRoundRect, sideDecal, topDecal, mergeGeos } from './loft.js';

/** @typedef {import('./loft.js').KeepFn} KeepFn */

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
 * 站位表：短鼻斜面＋低引擎蓋＋擋風玻璃斜面（兩段式車頂），平頂 y 28.5 從 x 24 到 x −48，車頂後緣往下內傾到 x −58 斷尾。
 * 輪拱 R17.6（可裝 31 mm 大徑輪）。
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = [
  // iter-47b 兩段式車頭：短鼻斜面（x 64 → 54）、低平引擎蓋（y ≈ 23–24.6，x 54 → 36）、
  // 擋風玻璃斜面（x 36 → 24 升到車頂 28.5）、平頂。前齒輪箱（y ≤ 21.4、x ≤ 45）上方仍留 ≥ 2 mm
  // iter-123（第九階段，評審「透明箱形輪廓像零件盒」）：前齒輪箱前方（x ≥ 49）的鼻段整段壓低約 4 mm 成楔形
  //（鼻端 17 → 13.3、x 60 20.2 → 16.4、x 54 22.8 → 19.6），x 49 加一站讓楔面一路斜升到引擎蓋；
  // 平頂前段也往前下傾（x 24 28.5 → 27.2、x 0 → 28.0），側視從鼻端到車尾是一條前低後高的斜線
  // iter-125（第二版，主 agent「前 3/4 和側視幾乎和改前一樣」）：楔形再壓低約 1.2–1.4 mm（鼻端 13.3 → 12.95、x 60 16.4 → 15.0、
  // x 54 19.6 → 18.2、x 49 22.2 → 21.2），鼻端下緣 11.5 → 11.2 接加大的黑色分流唇
  { x: 64, pts: box(12.6, 23, 11.2) },
  { x: 60, pts: box(15.0, 31, 11.5) },
  { x: 54, pts: box(18.2, 37.5, 12.3) },
  { x: 49, pts: box(21.2, 38.6, 12) },
  { x: 44, pts: box(24.2, 39, 11) },
  { x: 36, pts: box(24.6, 39, 11) },
  { x: 24, pts: box(27.2, 39, 10) },
  { x: 0, pts: box(28.0, 39, 9) },
  { x: -25, pts: box(28.5, 39, 9.5) },
  { x: -40, pts: box(28.5, 39, 11) },
  // iter-47 斷尾加長到 x −58：尾段下緣抬到後輪胎頂之上，車頂後緣往下內傾（28.4 → 25.4），
  // 尾端再接一片幾乎垂直的透明尾板（extras 的 tailPanel）往下蓋到 y 19.5，從後方不再直接看到齒輪
  // iter-125 鴨尾：原本車頂後緣往下內傾（28.4 → 25.4），改成貼身往上翹的鴨尾（x −49 起 28.4 → 尾端 30.8），尾端 3 mm 內噴黑，
  // 側視尾端由下垂變成上翹，和壓低的楔形鼻連成前低後高的姿態
  { x: -46, pts: box(28.4, 38.5, 20) },
  { x: -49, pts: box(28.4, 38, 26) },
  { x: -53, pts: box(28.8, 37.5, 26.2) },
  { x: -56, pts: box(29.8, 37, 25.6) },
  { x: -58, pts: box(30.8, 36.2, 24.6) },
];

/**
 * 座艙段站位（梯形剖面）：前擋風斜面 x 24 → 18、平頂段到 x −2、斜背後窗 x −2 → −14（往後收窄）
 * @type {{ x: number, yBase: number, yTop: number, halfW: number }[]}
 */
const CABIN = [
  // iter-50：座艙縮短到約 2/3（56 → 38 mm）、後段改成往後收窄的斜背，不再像小廂型車
  { x: 24, yBase: 0, yTop: 0, halfW: 21 },
  { x: 18, yBase: 0, yTop: 3.6, halfW: 25 },
  { x: -2, yBase: 0, yTop: 3.6, halfW: 24 },
  { x: -14, yBase: 0, yTop: 0, halfW: 17 },
];

/** @type {(x: number) => number} 座艙罩底部半寬（站間線性，同 createCanopySurface 的 trapezoid） */
const cabinHalfW = (x) => {
  if (x > CABIN[0].x || x < CABIN[CABIN.length - 1].x) {
    return 0;
  }
  let i = 0;
  while (x < CABIN[i + 1].x) {
    i++;
  }
  const a = CABIN[i];
  const b = CABIN[i + 1];
  return a.halfW + ((b.halfW - a.halfW) * (a.x - x)) / (a.x - b.x);
};

/** @type {(x: number, y: number, z: number) => number} 座艙底開口（負值 = 挖掉）：座艙罩下緣往內 0.8 mm，且只在平頂（y ≥ 22） */
const cabinHoleSd = (x, y, z) => (y < 22 ? 10 : Math.max(Math.abs(z) - (cabinHalfW(x) - 0.8), CABIN[CABIN.length - 1].x + 1.5 - x, x - (CABIN[0].x - 1.5)));

/** @type {(x: number) => number} 粉紅 / 透明的斜分割線（iter-123）：前低後高，鼻端 y 12.5、x 0 y 19.5、車尾 x −58 y 25.9 */
const splitY = (x) => 19.5 - 0.11 * x;

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 淡煙燻透明 PC（Blender 依名稱對應透明聚碳酸酯）
  // iter-48：更通透（顏色更淡、不透明度與環境反射降低，減少灰霧）
  clear: namedMaterial('pc-clear-shell', { color: 0xdbe6ef, roughness: 0.04, specularIntensity: 0.5, transparent: true, opacity: 0.18, envMapIntensity: 0.35, depthWrite: false }),
  clearIn: namedMaterial('pc-clear-shell-inner', { color: 0xc8d6e2, roughness: 0.06, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.BackSide }),
  // 座艙段：煙燻車窗、內噴黑色窗框
  // iter-125：前半內噴煙燻（比車窗淡，看得到裡面的齒輪輪廓）
  smoke: namedMaterial('pc-smoke-tint-front', { color: 0x30363f, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.5, envMapIntensity: 0.45, depthWrite: false }),
  window: namedMaterial('pc-smoke-window', { color: 0x262c34, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false }),
  frame: namedMaterial('pc-paint-black', { color: 0x111214, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  edge: namedMaterial('pc-clear-edge', { color: 0xb8c8d8, roughness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  clearDouble: namedMaterial('pc-clear-shell', { color: 0xdbe6ef, roughness: 0.04, specularIntensity: 0.5, transparent: true, opacity: 0.18, envMapIntensity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
  tailLamp: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  // 內噴不透明漆
  pink: namedMaterial('pc-paint-fluo-pink', { color: 0xff2e88, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  white: namedMaterial('pc-paint-white', { color: 0xf4f4f2, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-pink', { color: 0xff2e88, roughness: 0.3, clearcoat: 0.8 }),
  black: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  whiteDecal: decalMaterial('decal-white', { color: 0xf4f4f2, roughness: 0.3 }),
  pinkDecal: decalMaterial('decal-fluo-pink', { color: 0xff2e88, roughness: 0.3 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

export const pcBoxBody = makePolyBody({
  id: 'body-pc-box',
  name: 'PC 透明平頂短尾殼',
  style: 'race',
  // 第六階段分組（shared/reference/BODY_RACE_RESEARCH.md）
  raceType: 'clear-pc',
  form: 'box',
  roof: 'clear',
  wing: 'none',
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
  // iter-48 座艙段：平頂中段再隆起 3.6 mm 的梯形座艙（前擋風斜面 x 26 → 20、側窗、後窗斜面 x −22 → −30），
  // 側視有「車頭 → 座艙 → 車尾」的層次；座艙下方的殼面維持透明
  canopy: { section: 'trapezoid', stations: CABIN },
  // 座艙罩取代那片平頂：真空成形 PC 殼只有一層，座艙底下的平頂在幾何上挖掉（留 0.8 mm 和座艙罩下緣重疊）
  openings: [{ id: '座艙底開口', view: 'top', shape: 'fn', sd: cabinHoleSd }],
  zones: () => [
    // iter-123：粉紅下裙改成前下往後上的斜分割（splitY：鼻端 y 12.5 → 車尾 y 25.9），後段側面整片內噴粉紅、前段留透明；
    // 分割線上方的白色細線做成貼紙（extras 的 decal-split-line），不再多切一條殼面分區線（殼面面數維持改前）。白色中線寬條紋與兩側粉紅細條紋照舊
    // iter-125：鴨尾上翹段（x < −55）整段內噴黑，側視和後 3/4 看得出一道黑色尾唇
    { mat: 'frame', keep: (x) => -55 - x },
    { mat: 'pink', keep: (x, y) => splitY(x) - y },
    // iter-125：原本的白色中線＋兩道細粉紅線，改成兩條寬 6 mm 的粉紅賽車條（|z| 3.2–9.2），從鼻端楔面一路到鴨尾，中間 6.4 mm 留透明
    { mat: 'pink', keep: (x, y, z) => Math.min(Math.abs(z) - 3.2, 9.2 - Math.abs(z), y - 14) },
    // iter-125：前半內噴煙燻（分界線上緣在後：車頂 y 28 在 x 14、下緣 y 12 在 x 30，往後傾的斜線），後半留透明
    { mat: 'smoke', keep: (x, y) => x + y - 42 },
    { mat: 'clear', keep: () => 1 },
  ],
  mats: { inner: 'clearIn', edge: 'edge', cap: 'pink', cockpit: 'clear', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    // 座艙段分區：內噴黑框（下緣、平頂邊、A / B / C 柱）、煙燻車窗（側窗、前擋、後窗）、平頂透明＋白色中線
    const cs = kit.canopy;
    /** @type {KeepFn} */
    const frame = (x, y, z, s) => {
      const u = Math.abs(s);
      return Math.max(u - 0.93, 0.035 - Math.abs(u - 0.41), 0.6 - Math.abs(x - 18.4), 0.6 - Math.abs(x - 8), 0.6 - Math.abs(x + 2.4));
    };
    /** @type {KeepFn} */
    const glass = (x, y, z, s) => Math.max(Math.abs(s) - 0.445, x - 19, -3 - x);
    const notFrame = (x, y, z, s) => -frame(x, y, z, s);
    parts.push({ geometry: buildRegion(cs, [frame]).geometry, mat: 'frame', shell: true, name: 'cabin-frame' });
    parts.push({ geometry: buildRegion(cs, [notFrame, glass]).geometry, mat: 'window', shell: true, renderOrder: 3, name: 'cabin-windows' });
    parts.push({ geometry: buildRegion(cs, [notFrame, (x, y, z, s) => -glass(x, y, z, s), (x, y, z) => Math.min(Math.abs(z) - 3.2, 9.2 - Math.abs(z))]).geometry, mat: 'pink', shell: true, name: 'cabin-roof-stripe' });
    parts.push({ geometry: buildRegion(cs, [notFrame, (x, y, z, s) => -glass(x, y, z, s), (x, y, z) => Math.max(3.2 - Math.abs(z), Math.abs(z) - 9.2)]).geometry, mat: 'clear', shell: true, renderOrder: 2, name: 'cabin-roof' });
    // 透明殼裡看得到的座艙與駕駛人
    const drv = buildDriver(6, kit.innerYAt(6) - 5.8, 1.1);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 內傾透明尾板（iter-47）：從尾端下緣 (x −58, y 24.6) 往下、略往前收到 (x −57.4, y 19.5)；
    // x ≤ −57.4 離後輪軸 ≥ 17.4 mm，31 mm 輪胎（半徑 15.5）仍留 ≥ 1 mm
    const tail = [];
    const zs = [-35.2, 35.2];
    const top = 24.9;
    const bot = 19.5;
    tail.push(-58, top, zs[0], -58, top, zs[1], -57.4, bot, zs[1], -58, top, zs[0], -57.4, bot, zs[1], -57.4, bot, zs[0]);
    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute('position', new THREE.Float32BufferAttribute(tail, 3));
    tailGeo.computeVertexNormals();
    parts.push({ geometry: tailGeo, mat: 'clearDouble', shell: true, renderOrder: 2, name: 'tail-panel' });
    // 尾燈條（內噴粉紅＋紅色燈條）
    const lampBar = (z0, z1) => {
      const g = new THREE.BoxGeometry(0.5, 1.6, z1 - z0);
      g.translate(-58.2, 23.2, (z0 + z1) / 2);
      return g;
    };
    parts.push({ geometry: mergeGeos([lampBar(-33, -14), lampBar(14, 33)]), mat: 'tailLamp', solid: true, name: 'lamp-tail' });
    const band = new THREE.BoxGeometry(0.4, 0.9, 70);
    band.translate(-58.1, 21.2, 0);
    parts.push({ geometry: band, mat: 'pink', name: 'tail-band' });

    // 輪拱弧線（iter-47b）：沿輪拱外緣的粉紅內噴弧帶（半徑 18.2–19.4，只在側面）
    // iter-123：後輪拱落在粉紅斜分割裡，弧帶改白色（前輪拱在透明區，維持粉紅）
    /** @type {(ax: number) => KeepFn} */
    const archLine = (ax) => (x, y, z) => {
      if (Math.abs(z) < 30 || y < 12) {
        return -1;
      }
      const r = Math.hypot(x - ax, y - 13);
      return Math.min(r - 18.2, 19.4 - r);
    };
    parts.push({ geometry: kit.decal(archLine(40)), mat: 'pinkDecal', name: 'decal-arch-lines' });
    parts.push({ geometry: kit.decal(archLine(-40)), mat: 'whiteDecal', name: 'decal-arch-lines-rear' });

    // iter-125 修正：拿掉鼻下分流唇、擋板與前緣粉紅線。分流唇會改變碰撞外包絡與質量分布，P17 的 pc-box 組裝跑圈穿牆超過 1 mm
    // （31 mm 輪 1.497 mm；收回車鼻範圍後 p7-demo 起跑擾動 1.051 mm）；拿掉後 p7-demo 最差 0.945、31 mm 輪 0.819 mm（基準 0.734 / 0.204）
    // 斜分割線上方 1.4 mm 白色細線（iter-123，只在側面與肩部）
    parts.push({ geometry: kit.decal((x, y, z) => (Math.abs(z) < 30 ? -1 : Math.min(y - splitY(x), splitY(x) + 1.4 - y))), mat: 'whiteDecal', name: 'decal-split-line' });
    // 擋風玻璃下緣折線（白色細線，x ≈ 36）
    parts.push({ geometry: kit.decal((x, y, z) => Math.min(0.45 - Math.abs(x - 35.6), 30 - Math.abs(z))), mat: 'whiteDecal', name: 'decal-windshield-line' });

    // 號碼 17：側面白底黑字、車頂黑字
    const plate = (u, v) => sdRoundRect(u, v, -5, 5, -3.2, 3.2, 1);
    parts.push({
      geometry: kit.decal(sideDecal(plate, { x0: -8, y0: 16.6, zMin: 30 })),
      mat: 'whiteDecal',
      name: 'decal-number-plate',
    });
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('17', { h: 4.6, w: 2.8, gap: 0.8 }), { x0: -8, y0: 16.6, zMin: 30 }), { offset: 0.12 }),
      ]),
      mat: 'black',
      name: 'decal-number',
    });
    // iter-125：引擎蓋號碼落在煙燻區，改白字，並移到粉紅賽車條外側（z 14）
    parts.push({
      geometry: kit.decal(topDecal(sdNumber('17', { h: 5.4, w: 3.1, gap: 0.8 }), { x0: 45, z0: 14, yMin: 22 }), { offset: 0.12 }),
      mat: 'whiteDecal',
      name: 'decal-number-top',
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
