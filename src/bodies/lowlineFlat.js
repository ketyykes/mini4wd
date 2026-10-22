// 低平寬殼（body-lowline-flat，第六階段比賽型，raceType 'low-flat'）：比賽場上「低くワイドなフォルム」低重心殼的寫實呈現——
// 全組最低（甲板 y 約 25，最高點是擋風片頂約 29）、最長（150）、最寬（半寬 46）；平面是等寬的圓角長方形，鼻端兩角大圓角；
// 四輪葉子板頂部開口（甲板上的圓角長方形開口＋外緣葉子板邊條，31 mm 大徑輪胎頂會從開口露出）；小型開放座艙＋低擋風片；車尾平直斷面、無尾翼；側裙下緣是直線。
// 比賽做法：0.5 mm 真空成形 PC 透明殼，從內側噴漆（shared/reference/BODY_RACE_RESEARCH.md 4.4、7.2 (4)）。
// 設計：shared/design/body-lowline-flat/DESIGN.md。剖面由本檔縱向控制表產生（推估，依外框限制與底盤高度掃描）。
// 塗裝全為自創：深紅甲板＋石墨灰側裙、白色雙細線、白色圓形號碼底「88」；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import { makePolyBody, buildDriver } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdRoundRect, sideDecal, topDecal, mergeGeos } from './loft.js';
import { monoTable, cabinStations } from './fastbackCabin.js';

/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 車尾 x */
const X_TAIL = -75;
/** @type {number} 鼻端 x */
const X_NOSE = 75;

/**
 * 縱向控制表（推估；欄位意義同 fastbackCabin.js 的 cabinStations）：
 * - yC：甲板中線。尾端 25.4 平直 → 座艙段 25.6 → 前甲板 25.0（前齒輪箱 y ≤ 21.4 上方留 ≥ 3 mm）→ 鼻端斜降到 16.8
 * - cw / dr：甲板中央平坦區半寬與微拱；bw / yBelt：甲板外側（肩部圓角起點）
 * - hw / ySh：最寬處與肩稜；yLow：側裙下緣（中段 y 10.5 一直線；前後輪後方抬高，避開前導輪頂 12.5、後上導輪頂 20.5）
 * 平面：鼻端半寬 38 → x 68 處 45.5 → 全長大部分 46（等寬，全寬 92）→ 尾端 43（方正的圓角長方形）
 */
const T = monoTable([-75, -72, -68, -64, -60, -54, -44, -30, -14, 0, 14, 30, 44, 54, 62, 68, 72, 75], {
  yC: [25.4, 25.5, 25.6, 25.6, 25.6, 25.6, 25.6, 25.6, 25.6, 25.6, 25.6, 25.4, 25.0, 24.2, 22.6, 20.6, 18.8, 16.8],
  cw: [16, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 17, 16, 14, 11, 8],
  dr: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
  bw: [36, 39, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 39, 36, 30],
  yBelt: [24.8, 24.9, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 24.8, 24.4, 23.6, 22.0, 20.0, 18.2, 16.3],
  hw: [43, 45.5, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 45.5, 43.5, 38],
  ySh: [23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.2, 22.8, 22.0, 20.4, 18.6, 17.0, 15.6],
  yLow: [22.2, 22.2, 22.0, 21.6, 16.0, 11.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11.5, 13.5, 14.0, 14.5, 15.0],
});

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = cabinStations(T, X_TAIL, X_NOSE);

/**
 * 開放座艙（甲板上的凹槽，深 3.5 mm：槽底 y ≈ 22，在齒輪蓋頂約 21.2 之上）：俯視圓角梯形，前寬後窄
 * @type {{ id: string, view: 'top', shape: 'poly', pts: number[][], depth: number }}
 */
const COCKPIT = {
  id: '開放座艙',
  view: 'top',
  shape: 'poly',
  pts: [
    [12, 0],
    [11, 7.5],
    [7, 9.5],
    [-12, 9],
    [-16, 6.5],
    [-17, 0],
  ],
  depth: 3.5,
};

/**
 * 側裙分色：石墨灰下身 / 深紅上身的分色線（直線，y 17.2；鼻端與尾端沿外形收）
 * @type {(x: number) => number}
 */
const splitY = (x) => Math.min(17.2, T('ySh', x) - 2.2);

/**
 * 低擋風片：座艙前緣一片後傾的煙燻 PC 片＋黑框（底寬 21，頂到 y ≈ 29）
 * @type {(x0: number, y0: number) => { glass: THREE.BufferGeometry, frame: THREE.BufferGeometry }}
 */
const buildWindscreen = (x0, y0) => {
  /** @type {(hwB: number, hwT: number, h: number, dy: number) => THREE.Shape} */
  const outline = (hwB, hwT, h, dy) => {
    const pth = new THREE.Shape();
    pth.moveTo(-hwB, dy);
    pth.lineTo(hwB, dy);
    pth.quadraticCurveTo(hwT + 0.6, dy + h * 0.9, hwT - 1.2, dy + h);
    pth.lineTo(-hwT + 1.2, dy + h);
    pth.quadraticCurveTo(-hwT - 0.6, dy + h * 0.9, -hwB, dy);
    return pth;
  };
  const outer = outline(10.5, 8.6, 6.4, 0);
  outer.holes.push(outline(9.5, 7.6, 5.3, 0.5));
  /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} shape 在 (z, y) 平面 → x 為厚度方向，再往後傾 */
  const place = (g) => {
    g.rotateY(Math.PI / 2);
    g.rotateZ(0.95);
    g.translate(x0, y0, 0);
    return g;
  };
  return {
    frame: place(new THREE.ExtrudeGeometry(outer, { depth: 0.8, bevelEnabled: false, curveSegments: 10 })),
    glass: place(new THREE.ExtrudeGeometry(outline(9.55, 7.65, 5.35, 0.45), { depth: 0.5, bevelEnabled: false, curveSegments: 10 })),
  };
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 透明 PC 殼的內噴漆（Blender 依名稱對應：pc-paint 類為透明殼內噴漆、pc-smoke 類為煙燻透明片）
  red: namedMaterial('pc-paint-crimson', { color: 0xc4122f, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  graphite: namedMaterial('pc-paint-graphite', { color: 0x2f3338, roughness: 0.25, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  graphite2: namedMaterial('pc-paint-graphite', { color: 0x2f3338, roughness: 0.25, metalness: 0.35, clearcoat: 1.0, side: THREE.DoubleSide }),
  inner: namedMaterial('pc-clear-shell-inner', { color: 0x2a2e33, roughness: 0.6, side: THREE.BackSide }),
  edge: namedMaterial('pc-clear-edge', { color: 0xb8c8d8, roughness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  tub: namedMaterial('cockpit-tub', { color: 0x16171a, roughness: 0.8, side: THREE.DoubleSide }),
  tubWall: namedMaterial('cockpit-dark', { color: 0x26282c, roughness: 0.6, side: THREE.DoubleSide }),
  glass: namedMaterial('pc-smoke-windscreen', { color: 0x2a3138, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  frame: namedMaterial('pc-paint-black', { color: 0x111214, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-white', { color: 0xf2f2ee, roughness: 0.3, clearcoat: 0.8 }),
  whiteDecal: decalMaterial('decal-white', { color: 0xf4f4f2, roughness: 0.3 }),
  black: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  head: decalMaterial('lamp-clear', { color: 0xe8f4ff, emissive: 0x9fc8ff, emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1.0 }),
  tailLamp: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

export const lowlineFlatBody = makePolyBody({
  id: 'body-lowline-flat',
  name: 'PC 低平寬開放座艙殼',
  style: 'race',
  // 第六階段分組（shared/reference/BODY_RACE_RESEARCH.md 4.4、7.2 (4)）
  raceType: 'low-flat',
  form: 'low-wide',
  roof: 'open-cockpit',
  wing: 'none',
  theme: '全組最低最寬的等寬平甲板 PC 殼，葉子板頂切開露出輪胎、小開放座艙＋低擋風片、平直斷尾（可裝 31 mm 輪）',
  material: 'PC',
  density_g_cm3: 1.2,
  wallThickness_mm: 0.5,
  stations: STATIONS,
  tuck: 0.8,
  // 平滑剖面；只保留肩稜（第 6 點）為銳利稜線
  hard: [6],
  // 葉子板頂開口（俯視圓角長方形，x 輪軸 ±13.8、|z| 21.5–37.2、圓角 R3）＋側面輪拱（R17.6、只開到 y 21.2）：
  // 甲板外緣 |z| 37.2–46 留一條葉子板邊條跨過輪胎（離 31 mm 輪胎外側 34.75 有 2.45 mm），31 mm 輪胎頂從甲板開口露出
  wheelArches: [],
  openings: [
    {
      id: '葉子板頂開口 ×4',
      view: 'top',
      shape: 'fn',
      sd: (x, y, z) => (y < 20 ? 10 : Math.min(...[40, -40].map((ax) => sdRoundRect(x, Math.abs(z), ax - 13.8, ax + 13.8, 21.5, 37.2, 3)))),
    },
    {
      id: '側面輪拱 ×4',
      view: 'side',
      shape: 'fn',
      sd: (x, y, z) => (Math.abs(z) < 40 ? 10 : Math.max(Math.min(...[40, -40].map((ax) => Math.hypot(x - ax, y - 13) - 17.6)), y - 21.2)),
    },
  ],
  recesses: [COCKPIT],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [
    // 石墨灰下身（分色線以下）＋鼻端下巴
    { mat: 'graphite', keep: (x, y) => splitY(x) - y },
    { mat: 'red', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'graphite2', recess: 'tub', recessWall: 'tubWall', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    // 擋風片（座艙前緣）與駕駛人
    const ws = buildWindscreen(13.2, T('yC', 13) - 0.6);
    parts.push({ geometry: ws.glass, mat: 'glass', solid: true, outline: true, renderOrder: 3, name: 'windscreen' });
    parts.push({ geometry: ws.frame, mat: 'frame', solid: true, outline: true, name: 'windscreen-frame' });
    const floor = kit.innerYAt(-6) - COCKPIT.depth + kit.t + 0.2;
    const drv = buildDriver(-4, floor, 1.0);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 白色雙細線（自創）：甲板上沿中線兩側 |z| 5.0 / 7.4 由鼻端延伸到車尾，遇座艙中斷
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        const line = Math.max(0.45 - Math.abs(az - 5.0), 0.45 - Math.abs(az - 7.4));
        const outCab = Math.max(x - 13.5, -18.5 - x, az - 10.8);
        return Math.min(line, outCab, 73.5 - x, x + 74.5, y - 20);
      }),
      mat: 'whiteDecal',
      name: 'decal-twin-pinstripes',
    });
    // 側面白色細分色線（沿石墨灰 / 深紅分色線）
    parts.push({ geometry: kit.decal((x, y, z) => (Math.abs(z) < 30 ? -1 : 0.3 - Math.abs(y - splitY(x) - 0.1))), mat: 'whiteDecal', name: 'decal-side-pinstripe' });
    // 號碼 88：側面白色圓形號碼底＋黑字（前後輪拱之間）；前甲板黑字（雙細線外側）
    const roundel = (u, v) => Math.hypot(u, v) - 3.4;
    parts.push({ geometry: kit.decal(sideDecal(roundel, { x0: 0, y0: 19.8, zMin: 30 })), mat: 'whiteDecal', name: 'decal-number-roundel' });
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('88', { h: 3.8, w: 2.2, gap: 0.6 }), { x0: 0, y0: 19.8, zMin: 30 }), { offset: 0.12 }),
        kit.decal(topDecal(sdNumber('88', { h: 6.0, w: 3.4, gap: 0.9 }), { x0: 54, z0: -17, yMin: 20 }), { offset: 0.12 }),
      ]),
      mat: 'black',
      name: 'decal-number',
    });
    // 前甲板白色號碼底（圓角方塊）
    parts.push({
      geometry: kit.decal(topDecal((u, v) => Math.max(Math.abs(u) - 6.4, Math.abs(v) - 4.4), { x0: 54, z0: -17, yMin: 20 })),
      mat: 'whiteDecal',
      name: 'decal-number-plate-top',
    });
    // 鼻端頭燈（貼紙式透明燈片，左右各一條細長燈片）
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(4.2 - Math.abs(Math.abs(z) - 24), 0.9 - Math.abs(x - 69.2), y - 15)),
      mat: 'head',
      name: 'decal-headlamps',
    });
    // 平直斷尾的尾燈條（左右兩段）
    const lampBar = (z0, z1) => {
      const g = new THREE.BoxGeometry(0.5, 1.2, z1 - z0);
      g.translate(X_TAIL - 0.15, 24.0, (z0 + z1) / 2);
      return g;
    };
    parts.push({ geometry: mergeGeos([lampBar(-34, -12), lampBar(12, 34)]), mat: 'tailLamp', solid: true, name: 'lamp-tail' });
    return parts;
  },
  src: {
    density_g_cm3: 'BODY_RACE_RESEARCH 第 3 節 [COV]：PC 1.20 g/cm³',
    wallThickness_mm: 'BODY_RACE_RESEARCH 第 3 節：官方 PC 片材 0.4 mm；本專案 PC 款取 0.5 mm（推估：開口與輪拱周圍的剛性；BODY_RACE_RESEARCH 7.2 (4) 同）',
    geometry: '本檔縱向控制表（推估）；外形型態依 BODY_RACE_RESEARCH 4.4（[T95614]「低くワイドなフォルム」、[T95571] 低く構えたレーシングカースタイル）；葉子板頂開口＋側面輪拱 R17.6 可裝 31 mm 大徑輪',
    cockpit: '開放座艙槽深 3.5 mm（推估：槽底在齒輪蓋頂之上）；擋風片煙燻 PC 0.5 mm＋黑框 0.8 mm',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
