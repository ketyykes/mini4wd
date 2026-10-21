// 分叉尾翼高速型（body-fork，致敬《爆走兄弟》風格）：極窄的箭形機身＋長刃鼻、外露的車輪、兩支往後伸出的尾樑與外傾的分叉尾鰭。
// 設計：shared/design/body-fork/DESIGN.md（致敬元素、和原作車的差異）。剖面為本檔站位表（推估，依 DESIGN.md 外框限制與底盤高度掃描）。
// 塗裝全為自創：珍珠銀＋電光青＋黑、閃電斜紋、號碼「9」；不含任何廠商 / 作品名稱、商標或角色圖像。
import * as THREE from 'three';
import { makePolyBody, flatPlate, buildDriver, sweepEllipse, airfoilFin } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdBar, sideDecal, topDecal, mergeGeos, lerp } from './loft.js';

/**
 * 機身半剖面站位表（8 點）。車輪外露：輪胎所在的 x 範圍（前 24.5–55.5、後 −55.5–−24.5）半寬 ≤ 23.5，
 * 31 mm 大徑輪（內側面 |z| = 24.75）也留 ≥ 1 mm；兩輪之間的側箱鼓到 30 蓋住電池與開關。
 * 機身在 x −42 結束（再往後是兩支尾樑），尾端下緣 y 22.5 高過後齒輪箱（約 21.4）。
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = [
  [77, [[0, 15.6], [0.6, 15.6], [1.2, 15.5], [1.8, 15.4], [2.4, 15.3], [3, 15.2], [3, 15], [3, 14.6]]],
  [70, [[0, 17.2], [2, 17], [4, 16.6], [5.5, 16.4], [7, 16.2], [8.5, 16], [9, 15.6], [9, 14]]],
  [60, [[0, 20.5], [3, 20.2], [6, 19.5], [8, 19], [10, 18.6], [12, 18.2], [14, 17.6], [14, 13]]],
  [50, [[0, 24], [4, 23.6], [8, 22.8], [10, 22.2], [13, 21.6], [16, 21], [18, 20], [18, 12]]],
  [40, [[0, 26], [4, 25.6], [8, 25], [11, 24.6], [14, 24], [17, 23.4], [20, 22.5], [20, 13]]],
  [29, [[0, 27], [4, 26.8], [9, 26.2], [13, 25.8], [17, 25.2], [20, 24.5], [22.5, 23.5], [22.5, 12]]],
  [21, [[0, 27.6], [4, 27.4], [9, 27], [13, 26.6], [17, 26], [20, 25.3], [22.5, 24.3], [22.5, 11]]],
  [14, [[0, 28], [5, 27.8], [10, 27.4], [15, 27], [20, 26.4], [25, 25.6], [30, 24.2], [30, 9.5]]],
  [0, [[0, 28.6], [5, 28.4], [10, 28], [15, 27.6], [20, 27], [25, 26.2], [30, 24.6], [30, 9]]],
  [-14, [[0, 29.1], [5, 28.9], [10, 28.5], [15, 28.1], [20, 27.5], [25, 26.7], [30, 25.1], [30, 9.5]]],
  [-21, [[0, 28.8], [5, 28.6], [10, 28.1], [14, 27.6], [18, 26.8], [20.5, 25.8], [22.5, 24.8], [22.5, 13]]],
  [-27, [[0, 28.5], [5, 28.3], [10, 27.8], [14, 27.3], [18, 26.5], [20.5, 25.5], [22.5, 24.5], [22.5, 14]]],
  [-34, [[0, 27], [4, 26.8], [8, 26.2], [10, 25.8], [12, 25.2], [14, 24.6], [16, 23.6], [16, 22.6]]],
  [-42, [[0, 25.6], [2, 25.4], [4, 25], [5, 24.6], [6, 24.2], [7, 23.8], [8, 23.2], [8, 22.6]]],
].map(([x, pts]) => ({ x, pts }));

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  silver: namedMaterial('paint-pearl-silver', { color: 0xc9ced6, roughness: 0.2, metalness: 0.55, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  silver2: namedMaterial('paint-pearl-silver', { color: 0xc9ced6, roughness: 0.2, metalness: 0.55, clearcoat: 1.0, side: THREE.DoubleSide }),
  black: namedMaterial('paint-gloss-black', { color: 0x15171b, roughness: 0.3, clearcoat: 0.8 }),
  black2: namedMaterial('paint-gloss-black', { color: 0x15171b, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }),
  cyan2: namedMaterial('paint-electric-cyan', { color: 0x19c6ff, roughness: 0.25, clearcoat: 0.8, side: THREE.DoubleSide }),
  inner: namedMaterial('shell-inner-dark', { color: 0x1f2226, roughness: 0.85, side: THREE.BackSide }),
  edge: namedMaterial('shell-edge-silver', { color: 0x9aa0a8, roughness: 0.45, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  glass: namedMaterial('pc-smoke-tint', { color: 0x1a2a3a, roughness: 0.06, specularIntensity: 0.5, transparent: true, opacity: 0.5, envMapIntensity: 0.4, depthWrite: false }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-cyan', { color: 0x19c6ff, roughness: 0.3, clearcoat: 0.8 }),
  cyan: decalMaterial('decal-electric-cyan', { color: 0x19c6ff, roughness: 0.3, clearcoat: 0.6 }),
  dark: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

/**
 * 尾臂（iter-47）：從側箱後端長出、往後內收的掃掠橢圓管（概念圖的一體流線尾臂），x −14 ~ −72。
 * 後輪範圍（x −55.5 ~ −24.5）內外緣 |z| ≤ 23.5（31 mm 輪胎內側面 24.75）、下緣 y ≥ 24.4（開關頂 23.2）
 * @type {(sg: number) => THREE.BufferGeometry}
 */
const buildArm = (sg) =>
  sweepEllipse(
    [
      [0, 25.2, sg * 23],
      [-12, 26.4, sg * 23.2],
      [-24, 27.1, sg * 19.6],
      [-40, 27.6, sg * 17.6],
      [-56, 27.6, sg * 17],
      [-72, 26.8, sg * 17],
    ],
    56,
    // 前段從側箱裡長出來（半徑由小漸大，前端埋在殼內），後段漸細
    (t) => {
      const grow = Math.min(1, t / 0.22);
      return [lerp(1.6, 4.2, grow) - 1.0 * Math.max(0, t - 0.22), lerp(0.8, 3, grow) - 0.7 * Math.max(0, t - 0.22)];
    },
  );

export const forkBody = makePolyBody({
  id: 'body-fork',
  name: '分叉尾翼高速型',
  style: 'homage',
  theme: '極窄箭形機身＋長刃鼻、外露車輪、雙尾樑與外傾分叉尾鰭的高速型',
  material: 'ABS',
  density_g_cm3: 1.05,
  wallThickness_mm: 0.8,
  stations: STATIONS,
  tuck: 1.2,
  // iter-47：平滑剖面，只保留側箱肩稜（第 6 點）為銳利稜線
  hard: [6],
  // 車輪外露：機身避開輪胎，不需要輪拱
  wheelArches: [],
  canopy: {
    section: 'ellipse',
    stations: [
      { x: 30, yBase: 0, yTop: 0, halfW: 3 },
      { x: 25, yBase: 0, yTop: 3.6, halfW: 6.5 },
      { x: 16, yBase: 0, yTop: 5.6, halfW: 8 },
      { x: 6, yBase: 0, yTop: 5.2, halfW: 7.5 },
      { x: -2, yBase: 0, yTop: 3, halfW: 5.5 },
      { x: -6, yBase: 0, yTop: 0, halfW: 3 },
    ],
  },
  sideZMin: 24,
  zones: () => [
    // 黑色下半＋尖鼻黑色刀面
    { mat: 'black', keep: (x, y) => 21.5 - 0.05 * x - y },
    { mat: 'silver', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'black', cockpit: 'cockpit', glass: 'glass', mount: 'mount' },
  materials,
  mountInnerY: (kit) => (x) => (x < -44 ? 27.2 : kit.innerYAt(x)),
  extras: (kit) => {
    const parts = [];
    // 雙尾臂（實心管，以表面積 × 壁厚近似質量）
    parts.push({ geometry: mergeGeos([buildArm(-1), buildArm(1)]), mat: 'silver2', shell: true, name: 'tail-arms' });
    // 尾樑之間的橋板（後卡座吊在這裡）
    parts.push({
      geometry: flatPlate(
        [
          [-46, -14.5],
          [-46, 14.5],
          [-58, 14.5],
          [-58, -14.5],
        ],
        27.2,
        1.4,
      ),
      mat: 'black2',
      shell: true,
      name: 'tail-bridge',
    });
    // 分叉尾鰭（iter-47）：尾臂上外傾 14° 的後掠薄翼型鰭（前緣圓、後緣尖）
    const fins = [];
    for (const sg of [-1, 1]) {
      fins.push(airfoilFin([-49, -70, 29.2], [-66, -74.5, 47], 1.5, sg * 17, sg * 14));
    }
    parts.push({ geometry: mergeGeos(fins), mat: 'cyan2', outline: true, name: 'fork-fins' });
    // 刃鼻下方的黑色前翼（細長分流板，往前尖出）
    parts.push({
      geometry: flatPlate(
        [
          [58, -22],
          [66, -12],
          [76, -2],
          [76, 2],
          [66, 12],
          [58, 22],
          [56, 20],
          [56, -20],
        ],
        13.6,
        0.8,
      ),
      mat: 'black2',
      outline: true,
      name: 'front-wing',
    });
    // 座艙內裝
    const drv = buildDriver(12, kit.innerYAt(12) + kit.t, 0.95);
    parts.push({ geometry: drv.body, mat: 'driver', name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', name: 'cockpit-helmet' });
    // 閃電斜紋（側箱）與機身中線細線
    const bolt = [sdBar(20, 23.5, 8, 17, 1.4), sdBar(8, 17, 2, 22, 1.4), sdBar(2, 22, -16, 13.5, 1.4)];
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal((u, v) => Math.min(...bolt.map((f) => f(u, v))), { x0: 0, y0: 0, zMin: 24, side: 1 })),
        kit.decal(sideDecal((u, v) => Math.min(...bolt.map((f) => f(-u, v))), { x0: 0, y0: 0, zMin: 24, side: -1 })),
        kit.decal((x, y, z) => (x < 34 || x > 74 ? -1 : 0.5 - Math.abs(z))),
      ]),
      mat: 'cyan',
      name: 'decal-bolt',
    });
    parts.push({
      geometry: kit.decal(topDecal(sdNumber('9', { h: 6, w: 3.4, gap: 0 }), { x0: 46, yMin: 20 })),
      mat: 'dark',
      name: 'decal-number',
    });
    return parts;
  },
  src: {
    density_g_cm3: 'SPEC 1.14：ABS 約 1.05 g/cm³（推估）',
    wallThickness_mm: '推估：射出 ABS 殼 0.8 mm',
    geometry: '本檔 STATIONS（推估）：輪胎範圍內機身半寬 ≤ 23.5，26 / 31 mm 輪胎都留 ≥ 1 mm',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）；後卡座吊在尾樑橋板下',
  },
});
