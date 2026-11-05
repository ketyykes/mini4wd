// 越野座艙罩殼（body-trail-canopy，比賽型，raceType 'buggy-canopy'）：
// 短楔形鈍頭＋下方滑板、前半部大型曲面透明座艙罩（前緣直切的平面擋風）、中後段電池上方的方形側箱（側面散熱鰭紋）、
// 四輪葉子板頂部開口、尾端單支柱單片低位平板擾流、鼻部下方滑板；後甲板有散熱格柵、檢修蓋分件線與固定扣。只裝 26 mm 輪（輪拱 R15.5）。
// 比賽做法：0.5 mm 真空成形 PC 透明殼，座艙罩留透明、車身從內側噴漆（shared/reference/BODY_RACE_RESEARCH.md 4.1、4.5、7.2 (2)）。
// 設計：shared/design/body-trail-canopy/DESIGN.md。剖面由本檔縱向控制表產生（推估，依外框限制與底盤高度掃描）。
// 塗裝全為自創：沙丘卡其上身＋炭黑側箱與滑板、螢光橘斜線、號碼「09」；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import { makePolyBody, buildDriver, finPlate, flatPlate } from './polyBody.js';
import { monoTable, cabinStations } from './fastbackCabin.js';
import { namedMaterial, decalMaterial, sdNumber, sdRoundRect, sideDecal, topDecal, mergeGeos } from './loft.js';

/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 車尾 x */
const X_TAIL = -71;
/** @type {number} 鼻端 x */
const X_NOSE = 64;

/**
 * 縱向控制表（推估；欄位意義同 fastbackCabin.js 的 cabinStations）：
 * - yC：中線。鼻端 x 64 鈍頭（約 18.3，下緣 12）→ 短引擎蓋 → 平面擋風（x 48.5 → 31 一直線斜升，約 40°，
 *   前緣 x 49 與上緣 x 31 兩道折線）→ 座艙罩頂 41.5（x 26–18 幾乎水平）→ 罩尾 x 0 落到引擎蓋 30 → 尾端 24.5
 * - cw / dr：座艙罩頂半寬與弧度（擋風段 dr ≤ 1 = 平面、往上略收窄成梯形；罩頂 dr 3.2 = 淺曲面，dr 6 會是圓泡）；
 *   罩後的引擎蓋段 cw 14、dr 1（中央微隆的馬達蓋）
 * - bw / yBelt：座艙罩下緣（= 側箱頂面內緣）
 * - hw / ySh：最寬處與側箱上稜。鼻端半寬 16、前葉子板 30、側箱 37.5（前窄後寬），後輪後方收成半寬 25.5 的短尾
 * 前齒輪箱（y ≤ 21.4、x ≤ 45）、後齒輪箱（y ≤ 21.4）、後導輪架（x −52、|z| 21–24、y 19.6）上方都留 ≥ 2 mm
 */
const T = monoTable([-71, -66, -60, -52, -42, -30, -18, -6, 2, 10, 18, 26, 31, 34, 40, 46, 49, 52, 58, 62, 66], {
  yC: [24.5, 26.2, 27.8, 29.0, 29.6, 29.8, 29.8, 30.4, 34.0, 39.2, 41.4, 41.5, 41.0, 38.5, 33.6, 28.65, 26.3, 25.2, 22.0, 19.6, 17.0],
  cw: [10, 11, 12, 13, 13.5, 14, 14, 15, 16, 16.5, 16.5, 16.5, 16.3, 16.5, 17, 17.5, 15.6, 14.5, 11.5, 9.5, 7.5],
  dr: [0.4, 0.5, 0.6, 0.8, 0.9, 1.0, 1.0, 1.6, 2.4, 3.0, 3.2, 3.2, 2.7, 1.0, 0.8, 0.7, 0.7, 0.7, 0.5, 0.4, 0.3],
  bw: [16, 18.5, 21.5, 23, 23, 23, 23, 23, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22, 20.5, 19.15, 17.5, 14, 12, 10],
  yBelt: [23.5, 25.0, 26.4, 27.4, 27.8, 27.8, 27.8, 27.6, 27.0, 26.2, 25.6, 25.4, 25.28, 25.2, 25.0, 24.6, 24.21, 23.6, 20.8, 18.8, 16.6],
  hw: [25.5, 31, 35.5, 37.5, 37.5, 37.5, 37, 36, 34.5, 32, 30.5, 30, 30, 30, 30, 28.5, 26.95, 25, 21, 18.5, 16],
  ySh: [22.0, 23.5, 24.5, 25.6, 26.0, 26.0, 26.0, 25.8, 24.8, 23.2, 22.6, 22.6, 22.6, 22.6, 22.6, 22.2, 21.71, 21.0, 19.0, 17.4, 15.8],
  yLow: [20.5, 19.0, 17.0, 14.5, 11.5, 10.0, 9.5, 9.5, 9.5, 9.5, 10.0, 10.5, 11.13, 11.5, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0],
});

/** @type {(a: number, b: number, x: number) => number} 0 → 1 平滑過渡 */
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** @type {{ x: number, pts: number[][] }[]} */
/**
 * 側窗微弧：在第 2 點（罩頂邊）與第 3 點（罩下緣）之間插入一點，沿外法線鼓出 0.7 mm（x 4 → 38 全量，後端 0–4、前端 38–47.5 平滑漸收）。
 * 側窗若是兩個稜線點之間的直線 → 平面，Blender 側視把燈光整片反射成白色長方形；微弧讓反光縮成一道漸層帶。
 * 共用的 cabinStations 不動，只在本檔對它的結果插點（第 3 點以後的索引 +1）
 * @type {(x: number) => number}
 */
// 微弧要一路做到側窗前端（x 47.5，見 sideWindowKeep），兩端用 smoothstep 收尾（不留折線）：
// 中途線性收掉、往前接平面的話，曲面轉平面的折線會在 A 柱旁留下一條直立的亮帶（側窗反光），平面段把燈箱反成一整片
const sideBulge = (x) => 0.7 * smoothstep(0, 4, x) * (1 - smoothstep(38, 47.5, x));

/** @type {{ x: number, pts: number[][] }[]} */
const STATIONS = cabinStations(T, X_TAIL, X_NOSE).map(({ x, pts }) => {
  const [z2, y2] = pts[2];
  const [z3, y3] = pts[3];
  const len = Math.hypot(z3 - z2, y3 - y2) || 1;
  const b = sideBulge(x);
  // 外法線（朝外、朝上）：(−dy, dz) / len
  const mid = [(z2 + z3) / 2 + (b * -(y3 - y2)) / len, (y2 + y3) / 2 + (b * (z3 - z2)) / len];
  return { x, pts: [...pts.slice(0, 3), mid, ...pts.slice(3)] };
});

/** @type {(x: number) => number} 座艙罩下緣高度 */
const beltY = (x) => Math.min(T('yBelt', x), T('yC', x) - T('dr', x) - 0.2);

/**
 * 透明座艙罩（不噴漆）：x 47.5 → 1，罩下緣以上、罩下緣半寬內側；回傳 > 0 = 在罩內
 * @type {KeepFn}
 */
const canopyKeep = (x, y, z) => Math.min(47.5 - x - 0.25 * (beltY(x) + 0.8 - y), x - 1.5, y - (beltY(x) + 0.8), T('bw', x) - 0.6 - Math.abs(z));

/**
 * 擋風玻璃框：上緣橫樑（x 30.2–31.6）＋兩側 A 柱（沿罩頂邊稜線 |z| = cw ± 0.6，x 31 → 47.5），內噴黑；
 * 讓前緣的平面擋風和後方的曲面罩頂分成兩塊，讀得出「直切平面擋風」
 * @type {KeepFn}
 */
const shieldFrameKeep = (x, y, z) => {
  const header = Math.min(0.7 - Math.abs(x - 30.9), T('cw', x) + 0.6 - Math.abs(z));
  const pillar = Math.min(0.6 - Math.abs(Math.abs(z) - T('cw', x)), x - 30.2, 47.5 - x);
  return Math.min(canopyKeep(x, y, z), Math.max(header, pillar));
};

/**
 * 側窗：罩頂邊稜線（A 柱）外側的座艙罩側面整片用淡煙燻 PC（Blender 依名稱 pc-smoke → glass 薄殼煙燻材質），
 * 和透明的擋風、罩頂分開；回傳 > 0 = 在側窗內
 * @type {KeepFn}
 */
// 實車結構：A 柱（罩頂邊稜線）以外的側面整片都是淡煙燻側窗，透明只留在 A 柱之間的擋風與罩頂。
// 擋風兩側（x 30.2–47.5）的側面若留透明 PC（反射全量），夾在煙燻側窗（反射 × 0.15，見 render/showcase.py thin_pc_material）
// 與 A 柱之間會反成一道直立白條；剩下的折線反光見 sideBulge
const sideWindowKeep = (x, y, z) => Math.min(canopyKeep(x, y, z), Math.abs(z) - T('cw', x) - 0.6);
/**
 * 側窗分格窗框：x 14 一道 1 mm 寬的直框，把側窗分成前後兩格（內噴黑）
 * @type {KeepFn}
 */
const sideMullionKeep = (x, y, z) => Math.min(sideWindowKeep(x, y, z) + 0.6, 0.5 - Math.abs(x - 14));

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
  // 沙丘卡其取較深的 0x8c7a56（較淺的 0xc9b48a 在畫面上偏象牙白）
  sand: namedMaterial('pc-paint-sand-khaki', { color: 0x8c7a56, roughness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
  sand2: namedMaterial('pc-paint-sand-khaki', { color: 0x8c7a56, roughness: 0.3, clearcoat: 1.0, side: THREE.DoubleSide }),
  char: namedMaterial('pc-paint-charcoal', { color: 0x24262a, roughness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.08 }),
  char2: namedMaterial('pc-paint-charcoal', { color: 0x24262a, roughness: 0.35, clearcoat: 1.0, side: THREE.DoubleSide }),
  // 透明座艙罩、檢視窗（淡煙燻透明 PC）
  // 側窗淡煙燻 PC：app 裡比擋風略深，Blender 走 glass（煙燻薄殼、反射色 0.7、粗糙 0.1），不會整片反白
  sideGlass: namedMaterial('pc-smoke-side-window', { color: 0x6f7c88, roughness: 0.08, specularIntensity: 0.4, transparent: true, opacity: 0.42, envMapIntensity: 0.3, depthWrite: false }),
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
  clip: namedMaterial('metal-clip-steel', { color: 0x9a9ea4, roughness: 0.3, metalness: 0.85 }),
  tailLamp: namedMaterial('lamp-red', { color: 0xd0142a, emissive: 0x900010, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

export const trailCanopyBody = makePolyBody({
  id: 'body-trail-canopy',
  name: 'PC 越野座艙罩殼',
  style: 'race',
  // 比賽型分類（shared/reference/BODY_RACE_RESEARCH.md 4.5、7.2 (2)）
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
  // 平滑剖面；罩頂邊（第 2 點）、座艙罩下緣（第 4 點）與側箱上稜（第 7 點）為稜線（索引已含插入的側窗微弧點）
  // （罩頂邊稜線：罩頂淺曲面與側窗之間有折線，不是圓泡；側窗是 0.7 mm 微弧）
  hard: [2, 4, 7],
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
    {
      // 後甲板細節：透明檢視窗兩側的散熱格柵（每側 5 道橫向淺槽，x −15 → −31、|z| 11.5–17.5，深 0.6 mm）
      id: '後甲板散熱格柵',
      view: 'top',
      shape: 'fn',
      sd: (x, y, z) => {
        const az = Math.abs(z);
        if (y < 25 || az < 11.5 || az > 17.5) {
          return 10;
        }
        let d = 10;
        for (let i = 0; i < 5; i++) {
          d = Math.min(d, Math.abs(x - (-15 - 4 * i)) - 0.65);
        }
        return Math.max(d, 11.5 - az, az - 17.5, -x - 32);
      },
      depth: 0.6,
    },
  ],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [
    { mat: 'frame', keep: shieldFrameKeep },
    { mat: 'frame', keep: sideMullionKeep },
    { mat: 'sideGlass', keep: sideWindowKeep },
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


    // 單支柱單片平板擾流（PC，實心件）：平板 x −57 → −68、半翼展 25（翼端後掠）；中央單支柱（前後寬 6 mm）插進尾段殼面。
    // 板面 y 38.0（離尾甲板約 10.5 mm，仍比座艙罩頂 41.5 低），
    // 兩端加螢光橘端板（前低後高的後掠梯形）
    const yPlate = 38.0;
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
    // 端板（PC 實心件 0.8 mm，螢光橘內噴）：前緣貼著平板前緣、往後下斜到板下 4.5 mm，後緣高出板面 3 mm
    const endplatePts = [
      [-57.2, yPlate + 0.7],
      [-57.8, yPlate - 2.2],
      [-68.6, yPlate - 4.5],
      [-68.6, yPlate + 3.0],
      [-62, yPlate + 1.6],
    ];
    parts.push({
      geometry: mergeGeos([finPlate(endplatePts, -25.4, 0.8), finPlate(endplatePts, 25.4, 0.8)]),
      mat: 'orange2',
      solid: true,
      outline: true,
      name: 'spoiler-endplates',
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

    // 側面圖形：前段散熱鰭紋 → 白底黑字號碼牌「09」；引擎蓋另有黑字「09」。
    // 一條橘色長楔形斜條——
    // 從前輪拱後緣（x 24.5、y 15）往後上掃到後輪拱前上方（x −27、y 22–27），前細 1.6 mm、後粗 4.7 mm；下緣再一道 0.7 mm 黑細線
    /** @type {(x: number) => number} 斜條下緣 */
    const slashLow = (x) => 15.0 + 0.15 * (24.5 - x);
    /** @type {(x: number) => number} 斜條上緣 */
    const slashHigh = (x) => 16.6 + 0.21 * (24.5 - x);
    // 只投影在側面：|z| 超過該站最寬處 − 3.5（前段側箱較窄，x 24 半寬只有 30）
    /** @type {(x: number, z: number) => boolean} */
    const offSide = (x, z) => Math.abs(z) < T('hw', x) - 3.5;
    /** @type {KeepFn} */
    const slashKeep = (x, y, z) => (offSide(x, z) ? -1 : Math.min(24.5 - x, x + 27, y - slashLow(x), slashHigh(x) - y));
    /** @type {KeepFn} */
    const pinKeep = (x, y, z) => (offSide(x, z) ? -1 : Math.min(24 - x, x + 27, slashLow(x) - 0.55 - y, y - (slashLow(x) - 1.25)));
    parts.push({ geometry: kit.decal(slashKeep), mat: 'orange', name: 'decal-side-slash' });
    parts.push({ geometry: kit.decal(pinKeep), mat: 'black', name: 'decal-side-slash-pin' });
    // 號碼牌移到斜條下方（x −17、y 14.8）
    const plateSd = (u, v) => sdRoundRect(u, v, -4.6, 4.6, -4.2, 4.2, 1.2);
    parts.push({ geometry: kit.decal(sideDecal(plateSd, { x0: -17, y0: 14.8, zMin: 33 })), mat: 'whiteDecal', name: 'decal-number-plate' });
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('09', { h: 5.0, w: 3.0, gap: 0.8 }), { x0: -17, y0: 14.8, zMin: 33 }), { offset: 0.12 }),
        kit.decal(topDecal(sdNumber('09', { h: 5, w: 3, gap: 0.8 }), { x0: 56, z0: 0, yMin: 18 }), { offset: 0.12 }),
      ]),
      mat: 'black',
      name: 'decal-number',
    });
    // 後甲板檢修蓋：x −43 → −56、|z| ≤ 13 的分件線（黑色 0.35 mm 細線，圓角 2）＋四角固定扣（金屬小圓扣）
    const hatchSd = (u, v) => Math.abs(sdRoundRect(u, v, -13, 13, -6.5, 6.5, 2)) - 0.175;
    parts.push({ geometry: kit.decal(topDecal(hatchSd, { x0: -49.5, z0: 0, yMin: 24 })), mat: 'black', name: 'decal-hatch-seam' });
    const clips = [];
    for (const cx of [-45, -54]) {
      for (const cz of [-10.5, 10.5]) {
        const g = new THREE.CylinderGeometry(0.9, 0.9, 0.7, 16);
        g.translate(cx, kit.surf.topY(cx, cz) + 0.1, cz);
        clips.push(g);
      }
    }
    parts.push({ geometry: mergeGeos(clips), mat: 'clip', solid: true, name: 'hatch-clips' });
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
