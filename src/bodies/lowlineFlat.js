// 低平寬殼（body-lowline-flat，比賽型，raceType 'low-flat'）：比賽場上「低くワイドなフォルム」低重心殼的寫實呈現——
// 全組最低（甲板 y 約 25，最高點是擋風片頂約 29）、最長（150）、最寬（半寬 46）；平面是等寬的圓角長方形，鼻端兩角大圓角；
// 四輪葉子板頂部開口（甲板上的圓角長方形開口＋外緣葉子板邊條，31 mm 大徑輪胎頂會從開口露出）；小型開放座艙＋低擋風片；車尾平直斷面、無尾翼；側裙下緣是直線。
// 比賽做法：0.5 mm 真空成形 PC 透明殼，從內側噴漆（shared/reference/BODY_RACE_RESEARCH.md 4.4、7.2 (4)）。
// 設計：shared/design/body-lowline-flat/DESIGN.md。剖面由本檔縱向控制表產生（推估，依外框限制與底盤高度掃描）。
// 塗裝全為自創：深紅甲板＋石墨灰側裙、白色雙細線、白色圓形號碼底「88」；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import { makePolyBody, buildDriver, sweepEllipse } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, sdRoundRect, sideDecal, topDecal, mergeGeos } from './loft.js';
import { monoTable } from './fastbackCabin.js';

/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 車尾 x（車尾往內收，不蓋在後導輪正上方） */
const X_TAIL = -71;
/** @type {number} 鼻端 x（鼻部收斂成圓鼻，不蓋在前導輪正上方） */
const X_NOSE = 72;

/**
 * 縱向控制表（推估）：
 * - yC：甲板中線。尾端 24.8 → 座艙段 25.6 → 前甲板 25.0（前齒輪箱 y ≤ 21.4 上方留 ≥ 3 mm）→ 鼻端緩降到 21.0
 * - hw / ySh：最寬處與肩稜；yLow：側裙下緣（中段 y 10.5 一直線；後輪後方抬高，避開後上導輪頂 20.5）
 * 平面有方向性（等寬長方形平板前後看不出方向、像托盤）：
 * 鼻端圓鼻（x 56 → 72 半寬 44.5 → 21，鼻尖收在前導輪 |z| 36 以內）、車尾收斂（x −62 → −71 半寬 44 → 33）、
 * 前葉子板 46、前後輪之間 44、後葉子板 45（後段略窄於前段，和 halo-orbit 的寬後段拉開俯視 IoU）——仍是全組最寬（92）最低的平甲板，但看得出車頭和車尾
 */
const T = monoTable([-71, -69, -66, -62, -58, -52, -44, -30, -14, 0, 14, 30, 44, 52, 58, 62, 66, 69, 72], {
  // 鼻端沿用側面同一套做法：甲板只緩降（x 58 → 72：24.2 / 23.7 / 23.0 / 22.2 / 21.0），肩稜貼著甲板，
  // 紅色只有甲板＋1.1 mm 薄唇，唇下到側裙下緣全是石墨灰下巴（分色線 splitY 跟著 ySh）→ 正面讀成「薄紅殼蓋在深色底身上」；
  // 甲板在鼻端最後 10 mm 急降（約 31° 斜坡）的話，整片紅色斜坡從正面看是一道厚圓紅邊
  yC: [24.8, 25.3, 25.5, 25.6, 25.6, 25.6, 25.6, 25.6, 25.6, 25.6, 25.6, 25.4, 25.0, 24.6, 24.2, 23.7, 23.0, 22.2, 21.0],
  hw: [33, 38, 41.5, 44, 45, 45, 45, 44.5, 44, 44, 44.5, 45.5, 46, 46, 44.5, 41.5, 36, 30, 21],
  ySh: [22.8, 23.2, 23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.4, 23.2, 22.8, 22.4, 22.1, 21.7, 21.2, 20.6, 19.8],
  // 鼻段側裙下緣往上收（x 58 → 69：13.6 / 15.0 / 16.6 / 16.4），鼻端正面只有薄唇＋窄裙，不顯厚；離前導輪頂 12.5 也留出間隙
  yLow: [22.2, 22.2, 22.0, 21.6, 16.0, 11.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 11.5, 13.6, 15.0, 16.6, 16.4, 15.0],
});

/** @type {number} 外緣薄唇的厚度（肩稜往下 1.1 mm 就往內收） */
const LIP_T = 1.1;
/** @type {number} 側面號碼圓底中心高度（落在內收側裙的垂直段） */
const ROUNDEL_Y = 16.4;

/** @type {number[]} 前後輪軸 x */
const AXLES = [40, -40];
/** @type {number} 葉子板隆起高度（輪軸正上方，比甲板高 4.2 mm） */
const FENDER_RISE = 4.2;

/**
 * 葉子板隆起係數：輪軸正上方 1，離輪軸 19 mm 以外 0（餘弦過渡）
 * @type {(x: number) => number}
 */
const fenderFactor = (x) => {
  let f = 0;
  for (const ax of AXLES) {
    const u = Math.abs(x - ax) / 19;
    if (u < 1) {
      f = Math.max(f, (Math.cos(Math.PI * u) + 1) / 2);
    }
  }
  return f;
};

/**
 * 甲板中段起伏係數（讓甲板中段不是一片平板）：前後輪之間 1，靠近輪軸、鼻端、車尾漸減到 0
 * @type {(x: number) => number}
 */
const deckFactor = (x) => {
  const u = Math.min(1, Math.max(0, (24 - Math.abs(x)) / 10));
  return (1 - fenderFactor(x)) * (0.5 - 0.5 * Math.cos(Math.PI * u));
};
/** @type {number} 中線隆起（mm） */
const SPINE_RISE = 1.4;
/** @type {number} 兩側淺溝深度（mm） */
const CHANNEL_DEPTH = 1.0;

/**
 * 半剖面站位（每 2 mm 一站，8 點）：甲板中線、甲板 1/2、甲板平坦區外緣、葉子板內坡、葉子板頂（|z| 31，輪胎中心面）、
 * 葉子板外坡、肩稜、側裙下緣。輪軸附近葉子板頂隆起 FENDER_RISE，前後輪之間回到甲板高度（平甲板）。
 * 鼻端變窄時各點 z 依半寬等比內縮（維持由內往外單調）
 * @type {{ x: number, pts: number[][] }[]}
 */
const STATIONS = (() => {
  const xs = [];
  for (let x = X_TAIL; x < X_NOSE; x += 2) {
    xs.push(x);
  }
  xs.push(X_NOSE);
  return xs.map((x) => {
    const yC = T('yC', x);
    const hw = T('hw', x);
    const ySh = Math.min(T('ySh', x), yC - 1);
    const yLow = Math.min(T('yLow', x), ySh - 0.6);
    const f = fenderFactor(x);
    const cw = Math.min(17, 0.37 * hw);
    const zIn = Math.min(21.5, 0.5 * hw);
    const zCr = Math.min(31, 0.7 * hw);
    const zOut = hw - 1.6;
    const yCr = yC - 0.4 + FENDER_RISE * f;
    // 外緣是薄唇＋下沿內收倒角（鼻、尾、側緣若是厚而方的邊會像托盤）——
    // 唇口只比肩稜低 LIP_T（側視 1.1 mm 厚的薄邊），唇下側裙往內收 tuckIn（最多 2.6 mm）再垂直往下，
    // 唇下形成一道陰影線；俯視最外緣仍是 hw（不影響俯視輪廓）
    const yLip = Math.max(ySh - LIP_T, yLow + 0.3);
    const tuckIn = Math.min(2.6, 0.06 * hw);
    const yChamfer = Math.max(yLip - 1.6, yLow + 0.2);
    const m = deckFactor(x);
    const pts = [
      [0, yC + SPINE_RISE * m],
      [0.5 * cw, yC - 0.08 + 0.25 * SPINE_RISE * m],
      [cw, yC - 0.3 - CHANNEL_DEPTH * m],
      [zIn, yC - 0.3 + 0.9 * f],
      [zCr, yCr],
      [zOut, ySh + 0.62 * (yCr - ySh)],
      [hw, ySh],
      [hw, yLip],
      [hw - tuckIn, yChamfer],
      [hw - tuckIn, yLow],
    ];
    return { x, pts };
  });
})();

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
 * 鼻端頭燈凹槽（讓燈片有深度，不是貼平的白片）：俯視細長圓角梯形，深 0.9 mm，槽內放透明燈片
 * @type {{ id: string, view: 'top', shape: 'poly', pts: number[][], depth: number }[]}
 */
const HEADLAMP_RECESSES = [1, -1].map((sg) => ({
  id: sg > 0 ? '右頭燈槽' : '左頭燈槽',
  view: 'top',
  shape: 'poly',
  pts: [[67.6, 17.6], [67.9, 21.0], [67.2, 24.2], [65.4, 24.6], [64.9, 21.0], [65.2, 17.4]].map(([x, z]) => [x, sg * z]),
  depth: 0.9,
}));

/**
 * 側裙分色：石墨灰下身 / 深紅上身的分色線（在薄唇正下方，跟著肩稜 ySh 走）
 * @type {(x: number) => number}
 */
// 深紅只留甲板＋薄唇，唇下內收的側裙整段石墨灰，讀成「薄殼蓋在深色底身上」
const splitY = (x) => T('ySh', x) - LIP_T - 0.3;

/**
 * 擋風片：座艙前緣一片後傾的煙燻 PC 片＋黑框（底寬 22，頂到 y ≈ 31）
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
  // 高 9.6、底寬 22（太矮會只是一條細片）
  const outer = outline(11, 9.2, 9.6, 0);
  outer.holes.push(outline(10, 8.2, 8.4, 0.6));
  /** @type {(g: THREE.BufferGeometry) => THREE.BufferGeometry} shape 在 (z, y) 平面 → x 為厚度方向，再往後傾 */
  const place = (g) => {
    g.rotateY(Math.PI / 2);
    g.rotateZ(0.95);
    g.translate(x0, y0, 0);
    return g;
  };
  return {
    frame: place(new THREE.ExtrudeGeometry(outer, { depth: 0.8, bevelEnabled: false, curveSegments: 10 })),
    glass: place(new THREE.ExtrudeGeometry(outline(10.05, 8.25, 8.45, 0.55), { depth: 0.5, bevelEnabled: false, curveSegments: 10 })),
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
  // 比賽型分類（shared/reference/BODY_RACE_RESEARCH.md 4.4、7.2 (4)）
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
  // 平滑剖面；肩稜（第 6 點）、薄唇下緣（第 7 點）、內收倒角底（第 8 點）為銳利稜線
  hard: [6, 7, 8],
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
  recesses: [COCKPIT, ...HEADLAMP_RECESSES],
  sideZMin: 30,
  innerSkipRecess: true,
  zones: () => [
    // 石墨灰下身（分色線以下）＋鼻端下巴
    { mat: 'graphite', keep: (x, y) => splitY(x) - y },
    { mat: 'red', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'graphite2', recess: 'tub', recessWall: 'tubWall', mount: 'mount' },
  // 前封口照側面同一條分色線分段：上段深紅（薄唇）、白色細線（同側面 decal-side-pinstripe 的 y 範圍）、下段石墨灰下巴；
  // 前封口整片石墨灰的話，側面只有分色線以下是灰，鼻角會變成垂直切口，正面紅黑分界也沒有白線
  capFrontBands: [
    { yMin: splitY(72) + 0.4, mat: 'red' },
    { yMin: splitY(72) - 0.2, mat: 'whiteDecal' },
    { mat: 'graphite2' },
  ],
  materials,
  extras: (kit) => {
    const parts = [];
    // 擋風片（座艙前緣）與駕駛人
    const ws = buildWindscreen(13.2, T('yC', 13) - 0.6);
    parts.push({ geometry: ws.glass, mat: 'glass', solid: true, outline: true, renderOrder: 3, name: 'windscreen' });
    parts.push({ geometry: ws.frame, mat: 'frame', solid: true, outline: true, name: 'windscreen-frame' });
    // 座艙圍邊（座艙小，加圍邊才看得見）：沿座艙槽外緣 0.9 mm 一圈黑色橢圓斷面圍邊（高 1.3 mm）
    /** @type {number[][]} */
    const rimPts = [];
    const half = COCKPIT.pts.slice(0, -1);
    const loop = [...half, ...half.slice(1).reverse().map(([x, z]) => [x, -z]), [-17, 0]].reverse();
    for (const [x, z] of [...loop.map(([px, pz]) => [px, pz]), loop[0]]) {
      const cx = -2.5;
      const len = Math.hypot(x - cx, z) || 1;
      const ox = x + ((x - cx) / len) * 0.9;
      const oz = z + (z / len) * 0.9;
      rimPts.push([ox, kit.surf.topY(ox, oz) + 0.2, oz]);
    }
    parts.push({ geometry: sweepEllipse(rimPts, 120, () => [0.9, 1.3], 12), mat: 'frame', solid: true, name: 'cockpit-rim' });
    const floor = kit.innerYAt(-6) - COCKPIT.depth + kit.t + 0.2;
    const drv = buildDriver(-4, floor, 1.15);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 白色雙細線（自創）：甲板上沿中線兩側 |z| 5.0 / 7.4 由鼻端延伸到車尾，遇座艙中斷
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        const line = Math.max(0.45 - Math.abs(az - 5.0), 0.45 - Math.abs(az - 7.4));
        const outCab = Math.max(x - 13.5, -18.5 - x, az - 10.8);
        return Math.min(line, outCab, 69 - x, x + 70.2, y - 20);
      }),
      mat: 'whiteDecal',
      name: 'decal-twin-pinstripes',
    });
    // 側面白色細分色線（沿石墨灰 / 深紅分色線）
    // 只畫離側緣 5 mm 以內的區域（分色線所在的側裙離側緣 ≤ 2.6 mm），一路畫到鼻端，接上前封口的白線；
    // 用固定的 |z| ≥ 30 篩選的話，鼻端半寬收到 21–30 mm 那段沒有線，白線會在鼻角斷開
    parts.push({ geometry: kit.decal((x, y, z) => (Math.abs(z) < T('hw', x) - 5 ? -1 : 0.3 - Math.abs(y - splitY(x) - 0.1))), mat: 'whiteDecal', name: 'decal-side-pinstripe' });
    // 側面號碼圓底放在唇下內收側裙的垂直段（y 16.4），不跨過倒角折線
    // 號碼 42（不用 88，避免和 aero-wing 重號）：側面白色圓形號碼底＋黑字（前後輪拱之間）；前甲板黑字（雙細線外側）
    const roundel = (u, v) => Math.hypot(u, v) - 3.4;
    parts.push({ geometry: kit.decal(sideDecal(roundel, { x0: 0, y0: ROUNDEL_Y, zMin: 30 })), mat: 'whiteDecal', name: 'decal-number-roundel' });
    parts.push({
      geometry: mergeGeos([
        kit.decal(sideDecal(sdNumber('42', { h: 3.8, w: 2.2, gap: 0.6 }), { x0: 0, y0: ROUNDEL_Y, zMin: 30 }), { offset: 0.12 }),
        kit.decal(topDecal(sdNumber('42', { h: 6.0, w: 3.4, gap: 0.9 }), { x0: 54, z0: -17, yMin: 20 }), { offset: 0.12 }),
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
    // 鼻端頭燈：凹槽裡的透明燈片（槽底往上 0.35 mm，沿鼻端斜面傾斜），槽壁深色 → 看得出深度
    const lens = [1, -1].map((sg) => {
      const x0 = 66.4;
      const z0 = sg * 21;
      const slope = (kit.surf.topY(x0 + 0.5, z0) - kit.surf.topY(x0 - 0.5, z0)) / 1;
      const g = new THREE.BoxGeometry(2.0, 0.3, 6.2);
      g.rotateZ(Math.atan(slope));
      g.translate(x0, kit.surf.topY(x0, z0) - 0.9 + 0.35 + 0.15, z0);
      return g;
    });
    parts.push({ geometry: mergeGeos(lens), mat: 'head', solid: true, name: 'lamp-headlamps' });
    // 平直斷尾的尾燈條（左右兩段）
    const lampBar = (z0, z1) => {
      const g = new THREE.BoxGeometry(0.5, 1.2, z1 - z0);
      g.translate(X_TAIL - 0.15, 23.6, (z0 + z1) / 2);
      return g;
    };
    parts.push({ geometry: mergeGeos([lampBar(-24, -10), lampBar(10, 24)]), mat: 'tailLamp', solid: true, name: 'lamp-tail' });
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
