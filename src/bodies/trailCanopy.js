// 越野座艙罩殼（body-trail-canopy，第六階段比賽型，raceType 'buggy-canopy'）：
// 短楔形鈍頭＋下方滑板、前半部大型曲面透明座艙罩（前緣直切的平面擋風）、中後段電池上方的方形側箱（側面散熱鰭紋）、
// 四輪葉子板頂部開口、尾端單支柱單片低位平板擾流、鼻部下方滑板。只裝 26 mm 輪（輪拱 R15.5）。
// 比賽做法：0.5 mm 真空成形 PC 透明殼，座艙罩留透明、車身從內側噴漆（shared/reference/BODY_RACE_RESEARCH.md 4.1、4.5、7.2 (2)）。
// 設計：shared/design/body-trail-canopy/DESIGN.md。剖面由本檔縱向控制表產生（推估，依外框限制與底盤高度掃描）。
// 塗裝全為自創：沙丘卡其上身＋炭黑側箱與滑板、螢光橘斜線、號碼「09」；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import { makePolyBody, buildDriver, finPlate, flatPlate } from './polyBody.js';
import { monoTable, cabinStations } from './fastbackCabin.js';
import { namedMaterial, decalMaterial, sdNumber, sdRoundRect, sdBar, sideDecal, topDecal, mergeGeos } from './loft.js';

/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 車尾 x */
const X_TAIL = -71;
/** @type {number} 鼻端 x */
const X_NOSE = 64;

/**
 * 縱向控制表（推估；欄位意義同 fastbackCabin.js 的 cabinStations）：
 * - yC：中線。鼻端 x 64 鈍頭（約 18.3，下緣 12）→ 短引擎蓋 → 平面擋風（x 48 → 36 急升）→ 座艙罩頂 41.6（x 24，車殼最高點）→ 罩尾 x 0 落到引擎蓋 30 → 尾端 24.5
 * - cw / dr：座艙罩頂半寬與弧度（擋風段 dr 小 = 平面；罩中段 dr 6 = 曲面）；罩後的引擎蓋段 cw 14、dr 1（中央微隆的馬達蓋）
 * - bw / yBelt：座艙罩下緣（= 側箱頂面內緣）
 * - hw / ySh：最寬處與側箱上稜。鼻端半寬 16、前葉子板 30、側箱 37.5（前窄後寬），後輪後方收成半寬 25.5 的短尾
 * 前齒輪箱（y ≤ 21.4、x ≤ 45）、後齒輪箱（y ≤ 21.4）、後導輪架（x −52、|z| 21–24、y 19.6）上方都留 ≥ 2 mm
 */
const T = monoTable([-71, -66, -60, -52, -42, -30, -18, -6, 2, 10, 18, 26, 34, 40, 46, 52, 58, 62, 66], {
  yC: [24.5, 26.2, 27.8, 29.0, 29.6, 29.8, 29.8, 30.4, 33.6, 38.4, 41.2, 41.6, 40.2, 36.4, 29.8, 25.2, 22.0, 19.6, 17.0],
  cw: [10, 11, 12, 13, 13.5, 14, 14, 15, 17, 18.5, 19, 19, 18.5, 18, 16.5, 14.5, 11.5, 9.5, 7.5],
  dr: [0.4, 0.5, 0.6, 0.8, 0.9, 1.0, 1.0, 1.6, 3.2, 5.0, 6.0, 6.0, 4.6, 2.4, 1.0, 0.7, 0.5, 0.4, 0.3],
  bw: [16, 18.5, 21.5, 23, 23, 23, 23, 23, 22.5, 22.5, 22.5, 22.5, 22.5, 22, 20.5, 17.5, 14, 12, 10],
  yBelt: [23.5, 25.0, 26.4, 27.4, 27.8, 27.8, 27.8, 27.6, 27.0, 26.2, 25.6, 25.4, 25.2, 25.0, 24.6, 23.6, 20.8, 18.8, 16.6],
  hw: [25.5, 31, 35.5, 37.5, 37.5, 37.5, 37, 36, 34.5, 32, 30.5, 30, 30, 30, 28.5, 25, 21, 18.5, 16],
  ySh: [22.0, 23.5, 24.5, 25.6, 26.0, 26.0, 26.0, 25.8, 24.8, 23.2, 22.6, 22.6, 22.6, 22.6, 22.2, 21.0, 19.0, 17.4, 15.8],
  yLow: [20.5, 19.0, 17.0, 14.5, 11.5, 10.0, 9.5, 9.5, 9.5, 9.5, 10.0, 10.5, 11.5, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0],
});

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = cabinStations(T, X_TAIL, X_NOSE);

/** @type {(x: number) => number} 座艙罩下緣高度 */
const beltY = (x) => Math.min(T('yBelt', x), T('yC', x) - T('dr', x) - 0.2);

/**
 * 透明座艙罩（不噴漆）：x 47.5 → 1，罩下緣以上、罩下緣半寬內側；回傳 > 0 = 在罩內
 * @type {KeepFn}
 */
const canopyKeep = (x, y, z) => Math.min(47.5 - x - 0.25 * (beltY(x) + 0.8 - y), x - 1.5, y - (beltY(x) + 0.8), T('bw', x) - 0.6 - Math.abs(z));

/** @type {KeepFn} 馬達上方的透明檢視窗（比賽 PC 殼常見的「留透明窗」）：引擎蓋中央 x −8 → −40 */
const deckWindowKeep = (x, y, z) => Math.min(-9 - x, x + 40, 9.5 - Math.abs(z), y - 28);

/** @type {(x: number) => number} 炭黑下身 / 沙丘卡其上身的分色線：側箱上稜下 1.6 mm，鼻部降到滑板上緣 */
const splitY = (x) => {
  if (x > 50) {
    return 14.6 + (T('ySh', 50) - 1.6 - 14.6) * Math.max(0, (64 - x) / 14);
  }
  return T('ySh', x) - 1.6;
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  sand: namedMaterial('pc-paint-sand-khaki', { color: 0xc9b48a, roughness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  sand2: namedMaterial('pc-paint-sand-khaki', { color: 0xc9b48a, roughness: 0.3, clearcoat: 1.0, side: THREE.DoubleSide }),
  char: namedMaterial('pc-paint-charcoal', { color: 0x24262a, roughness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
  char2: namedMaterial('pc-paint-charcoal', { color: 0x24262a, roughness: 0.35, clearcoat: 1.0, side: THREE.DoubleSide }),
  // 透明座艙罩、檢視窗（淡煙燻透明 PC）
  clear: namedMaterial('pc-clear-shell', { color: 0xdbe6ef, roughness: 0.04, specularIntensity: 0.5, transparent: true, opacity: 0.2, envMapIntensity: 0.4, depthWrite: false }),
  frame: namedMaterial('pc-paint-black', { color: 0x111214, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  inner: namedMaterial('pc-clear-shell-inner', { color: 0x2a2c30, roughness: 0.6, side: THREE.BackSide }),
  edge: namedMaterial('pc-clear-edge', { color: 0xb8c8d8, roughness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-orange', { color: 0xff6a00, roughness: 0.3, clearcoat: 0.8 }),
  orange: decalMaterial('decal-fluo-orange', { color: 0xff6a00, roughness: 0.3, clearcoat: 0.6 }),
  orange2: namedMaterial('pc-paint-fluo-orange', { color: 0xff6a00, roughness: 0.2, clearcoat: 1.0, side: THREE.DoubleSide }),
  black: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  whiteDecal: decalMaterial('decal-white', { color: 0xf4f4f2, roughness: 0.3 }),
  tailLamp: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

export const trailCanopyBody = makePolyBody({
  id: 'body-trail-canopy',
  name: 'PC 越野座艙罩殼',
  style: 'race',
  // 第六階段分組（shared/reference/BODY_RACE_RESEARCH.md 4.5、7.2 (2)）
  raceType: 'buggy-canopy',
  form: 'buggy-wedge',
  roof: 'canopy',
  wing: 'rear-spoiler',
  theme: '短楔形鈍頭、前半部大型透明座艙罩、方形側箱、單支柱低位平板擾流的越野型透明 PC 殼',
  material: 'PC',
  density_g_cm3: 1.2,
  wallThickness_mm: 0.5,
  stations: STATIONS,
  tuck: 0.8,
  // 平滑剖面；座艙罩下緣（第 3 點）與側箱上稜（第 6 點）為稜線
  hard: [3, 6],
  wheelArches: [
    { x: 40, y: 13, radius: 15.5, cutZFrom: 23.8 },
    { x: -40, y: 13, radius: 15.5, cutZFrom: 23.8 },
  ],
  // 側箱散熱鰭紋：側面前段（前輪後方 x 19 → 2）5 道斜向淺槽（深 0.7 mm）
  recesses: [
    {
      id: '側箱散熱鰭紋',
      view: 'side',
      shape: 'fn',
      sd: (x, y, z) => {
        if (Math.abs(z) < 28 || y < 12.5 || y > 21) {
          return 10;
        }
        let d = 10;
        for (let i = 0; i < 5; i++) {
          // 上端往後傾（和側面螢光橘斜線同方向）
          const xc = 19 - 3.6 * i - 0.35 * (y - 12.5);
          d = Math.min(d, Math.abs(x - xc) - 0.8);
        }
        return d;
      },
      depth: 0.7,
    },
  ],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [
    { mat: 'clear', keep: canopyKeep },
    // 座艙罩外圍 0.8 mm 內噴黑框
    { mat: 'frame', keep: (x, y, z, s) => canopyKeep(x, y, z, s) + 0.8 },
    { mat: 'clear', keep: deckWindowKeep },
    { mat: 'frame', keep: (x, y, z, s) => deckWindowKeep(x, y, z, s) + 0.7 },
    { mat: 'char', keep: (x, y) => splitY(x) - y },
    { mat: 'sand', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'char2', recess: 'char', recessWall: 'char', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    // 透明座艙罩裡的駕駛人（頭盔在 x 20）
    const drv = buildDriver(20, kit.innerYAt(20) - 12.5, 1.2);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });

    // 單支柱單片低位平板擾流（PC，實心件）：平板 x −57 → −68、半翼展 25（翼端後掠），板面 y 34.6（比座艙罩頂低 7 mm，離尾甲板約 7 mm）；
    // 中央單支柱（前後寬 6 mm）插進尾段殼面
    const yPlate = 34.6;
    const plate = flatPlate(
      [
        [-57, -22.5],
        [-57, 22.5],
        [-59.5, 25],
        [-68, 25],
        [-68, -25],
        [-59.5, -25],
      ],
      yPlate,
      0.7,
    );
    parts.push({ geometry: plate, mat: 'sand2', solid: true, outline: true, name: 'spoiler-plate' });
    // 擾流板後緣上翻小唇（螢光橘）
    const lip = new THREE.BoxGeometry(0.7, 1.0, 49.6);
    lip.translate(-67.65, yPlate + 1.0, 0);
    parts.push({ geometry: lip, mat: 'orange2', solid: true, outline: true, name: 'spoiler-lip' });
    const deckY = kit.surf.topY(-62, 0);
    parts.push({
      geometry: finPlate(
        [
          [-58.5, deckY - 1.2],
          [-65.5, deckY - 1.2],
          [-65.5, yPlate + 0.2],
          [-59.5, yPlate + 0.2],
        ],
        0,
        2.2,
      ),
      mat: 'char2',
      solid: true,
      outline: true,
      name: 'spoiler-strut',
    });
    // 鼻部下方滑板（PC 平板，實心件）：比鼻端多伸出 1.5 mm 的薄板，炭黑
    parts.push({
      geometry: flatPlate(
        [
          [65.5, -12],
          [65.5, 12],
          [54, 15],
          [54, -15],
        ],
        11.3,
        0.7,
      ),
      mat: 'char2',
      solid: true,
      outline: true,
      name: 'skid-plate',
    });

    // 側面圖形（依概念圖的排列）：前段散熱鰭紋 → 兩道螢光橘斜線 → 白底黑字號碼牌「09」；引擎蓋另有黑字「09」
    const slash = (x0) => sdBar(x0, 13.6, x0 - 4.2, 22.4, 1.1);
    const s1 = slash(-1.5);
    const s2 = slash(-6.5);
    parts.push({
      geometry: kit.decal((x, y, z) => (Math.abs(z) < 33 ? -1 : -Math.min(s1(x, y), s2(x, y)))),
      mat: 'orange',
      name: 'decal-side-slash',
    });
    const plateSd = (u, v) => sdRoundRect(u, v, -4.6, 4.6, -4.2, 4.2, 1.2);
    parts.push({ geometry: kit.decal(sideDecal(plateSd, { x0: -15.5, y0: 18, zMin: 33 })), mat: 'whiteDecal', name: 'decal-number-plate' });
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('09', { h: 5.0, w: 3.0, gap: 0.8 }), { x0: -15.5, y0: 18, zMin: 33 }), { offset: 0.12 }),
        kit.decal(topDecal(sdNumber('09', { h: 5, w: 3, gap: 0.8 }), { x0: 56, z0: 0, yMin: 18 }), { offset: 0.12 }),
      ]),
      mat: 'black',
      name: 'decal-number',
    });
    // 尾燈：尾板兩側小方燈
    const lampBox = (zc) => {
      const g = new THREE.BoxGeometry(0.5, 1.4, 5);
      g.translate(X_TAIL - 0.15, 22.4, zc);
      return g;
    };
    parts.push({ geometry: mergeGeos([lampBox(-19), lampBox(19)]), mat: 'tailLamp', solid: true, name: 'lamp-tail' });
    return parts;
  },
  src: {
    density_g_cm3: 'BODY_RACE_RESEARCH 第 3 節 [COV]：PC 1.20 g/cm³',
    wallThickness_mm: 'BODY_RACE_RESEARCH 第 3 節：官方 PC 透明殼片材 0.4 mm；本專案 PC 款取 0.5 mm（推估）',
    geometry: '本檔縱向控制表（推估）；外形型態依 BODY_RACE_RESEARCH 4.5（[FD] 越野型 5 款、[T95336] [T95463]）；不做避震器造型',
    spoiler: '擾流板與支柱為 PC 實心件（封閉體積 × 1.20 g/cm³）',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）',
  },
});
