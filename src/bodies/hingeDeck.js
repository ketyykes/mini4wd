// 鉸接甲板殼（body-hinge-deck，第六階段比賽型，raceType 'body-pivot'）：比賽場上「車殼提燈」（ボディ提灯）做法的寫實呈現——
// 窄而平的 0.4 mm PC 殼（中央縱向脊線＋短封閉座艙），前端兩側有外露的鉸接耳與樞軸銷，殼尾接一片外露的 1.5 mm FRP 板，板上用 2 支螺絲鎖一塊方形黃銅配重。
// 四輪頂部完全外露（殼半寬 ≤ 26.5，輪胎內側在 |z| 25.25 起；輪胎段殼半寬 ≤ 23.5）。
// 物理：本專案的車殼是剛體，不模擬擺動；鉸接只用外形、質量與重心呈現（BODY_RACE_RESEARCH 4.3、第 9 節；GOAL 物理要求）。
// 研究：shared/reference/BODY_RACE_RESEARCH.md 4.3、7.2 (3)；設計：shared/design/body-hinge-deck/DESIGN.md。
// 塗裝全為自創：珍珠白甲板＋鈷藍側裙、螢光黃脊線、黑框煙燻座艙窗、號碼「05」；不含任何廠商名稱、商標或真實車名。
import * as THREE from 'three';
import { makePolyBody, buildDriver, finPlate } from './polyBody.js';
import { namedMaterial, decalMaterial, sdNumber, topDecal, sideDecal, sdRoundRect, mergeGeos } from './loft.js';
import { monoTable } from './fastbackCabin.js';

/** @typedef {import('./loft.js').KeepFn} KeepFn */

/** @type {number} 殼尾 x（殼尾之後是外露的 FRP 板） */
const X_TAIL = -46;
/** @type {number} 鼻端 x */
const X_NOSE = 67;

/** @type {number} FRP 板厚（mm，Tamiya FRP 架官方厚度，BODY_RACE_RESEARCH 4.3） */
const PLATE_T = 1.5;
/** @type {number} FRP 板底面高度（底盤座標）：高於後輪軸中心 13（[REG-JP]【1】-3）、高於後齒輪箱頂 21.4 與後導輪架臂 19.6 */
const PLATE_Y = 22.0;
/** @type {number} FRP 密度（g/cm³，BODY_RACE_RESEARCH 第 3 節：專案取 1.85） */
const RHO_FRP = 1.85;
/** @type {number} 黃銅密度（g/cm³，同 src/parts/options.js 配重推估用的 8.5） */
const RHO_BRASS = 8.5;
/** @type {number} 鋼密度（g/cm³，螺絲、螺帽、樞軸銷） */
const RHO_STEEL = 7.85;
/** @type {number} ABS 密度（g/cm³，鉸接耳，BODY_RACE_RESEARCH 第 3 節 [TOY]） */
const RHO_ABS = 1.05;

/**
 * 方形配重（6 × 6 × 14 mm，[T15472] 官方外形尺寸）：長邊沿 z，2 個 Ø2.9 直通螺絲孔（推估）。
 * 體積 = 504 − 2 × π × 1.45² × 6 ≈ 424.7 mm³ × 黃銅 8.5 ≈ 3.61 g（官方「1本約3.6g」）
 * @type {{ x: number, z: number, len: number, w: number, h: number, holeR: number, holeZ: number }}
 */
const WEIGHT = { x: -58, z: 0, len: 14, w: 6, h: 6, holeR: 1.45, holeZ: 3.5 };

/**
 * 縱向控制表（推估；欄位意義同 fastbackCabin.js 的 cabinStations）：
 * - yC：中線（脊線頂）。甲板 + 1.8 的縱向脊線；座艙段 x 24 → −20 隆起成短封閉座艙，最高 35.6（x 6）
 * - cw / dr：脊線（座艙外）或座艙頂的半寬與弧度
 * - bw / yBelt：甲板內緣（座艙外 = 脊線根部外側；座艙段 = 座艙下緣）與甲板高度
 * - hw / ySh：甲板外緣（最寬處）與肩稜；yLow：短側裙下緣
 * 平面：鼻端半寬 11.5 → 前輪段 23.5 → 中段 26.5（電池 |z| ≤ 26.7 上方）→ 後輪段 23.5 → 殼尾 21；輪胎段 ≤ 23.5 → 四輪頂部完全外露
 * 高度：前齒輪箱（y ≤ 21.4、x ≤ 45）、電池頂（約 18.2）、齒輪蓋（約 21.2）上方都留空間（提燈殼要能上下擺動，殼浮在底盤上方）
 */
const T = monoTable([-46, -42, -36, -28, -20, -14, -8, 0, 6, 12, 18, 24, 30, 38, 46, 52, 58, 63, 67], {
  yC: [27.2, 27.4, 27.6, 27.8, 28.4, 30.6, 33.4, 35.2, 35.6, 35.0, 32.4, 28.8, 27.4, 27.0, 26.4, 25.2, 23.2, 20.6, 18.0],
  cw: [3.0, 3.2, 3.5, 3.5, 4.5, 7.5, 9.0, 9.5, 9.5, 9.5, 9.0, 6.0, 3.8, 3.5, 3.5, 3.5, 3.2, 3.0, 2.5],
  dr: [1.2, 1.2, 1.3, 1.3, 1.4, 1.6, 1.8, 1.8, 1.8, 1.8, 1.8, 1.5, 1.3, 1.3, 1.3, 1.2, 1.1, 1.0, 0.8],
  bw: [16, 17, 18.5, 19, 15, 14, 14, 14, 14, 14, 14, 15, 19, 19.5, 19.5, 19, 16.5, 13, 9],
  yBelt: [25.4, 25.6, 25.8, 26.0, 26.2, 26.3, 26.4, 26.4, 26.4, 26.3, 26.1, 25.8, 25.6, 25.2, 24.6, 23.4, 21.4, 18.8, 16.2],
  hw: [21, 22.5, 23.5, 23.5, 25.5, 26.5, 26.5, 26.5, 26.5, 26.5, 26, 24.3, 23.5, 23.5, 23.5, 23, 20.5, 16.5, 11.5],
  ySh: [24.8, 24.8, 24.8, 25.0, 25.2, 25.3, 25.4, 25.4, 25.4, 25.3, 25.1, 24.8, 24.6, 24.2, 23.6, 22.4, 20.4, 17.8, 15.4],
  yLow: [24.0, 23.0, 21.5, 20.5, 20.0, 19.8, 19.6, 19.6, 19.6, 19.6, 19.6, 19.8, 19.0, 18.0, 17.0, 16.0, 15.5, 14.6, 14.0],
});

/** @type {number} 甲板外側斜面的額外落差（iter-70：肩稜比原表再低 1.4 mm，甲板外側成為一道斜切面） */
const CHAMFER_DROP = 1.4;

/**
 * 半剖面站位（每 2 mm 一站，8 點；點的意義同 fastbackCabin.js 的 cabinStations）。
 * iter-70（評審 iter-68「殼面平順泛用，和概念圖的折面造型差很多」）：第 4 點（甲板寬度 55% 處）改成幾乎和甲板內緣等高，
 * 之後到肩稜一口氣斜切下去（肩稜再低 CHAMFER_DROP），第 4 點設為硬稜 → 甲板左右各多一道從鼻端到殼尾的縱向折線
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
    const cw = T('cw', x);
    const dr = T('dr', x);
    const bw = Math.max(T('bw', x), cw + 1);
    const yBelt = Math.min(T('yBelt', x), yC - dr - 0.2);
    const hw = Math.max(T('hw', x), bw + 2);
    const ySh = Math.min(T('ySh', x) - CHAMFER_DROP, yBelt - 1.2);
    const yLow = Math.min(T('yLow', x), ySh - 0.6);
    const zCrease = bw + 0.55 * (hw - bw);
    const yCrease = yBelt - 0.1 * (yBelt - ySh);
    const pts = [
      [0, yC],
      [0.5 * cw, yC - 0.28 * dr],
      [cw, yC - dr],
      [bw, yBelt],
      [zCrease, yCrease],
      [hw - 0.5, ySh + 0.12 * (yCrease - ySh)],
      [hw, ySh],
      [hw, yLow],
    ];
    return { x, pts };
  });
})();

/** @type {(x: number) => number} 甲板高度（座艙下緣） */
const deckY = (x) => Math.min(T('yBelt', x), T('yC', x) - T('dr', x) - 0.2);
/** @type {(x: number) => number} 座艙頂邊線高度 */
const roofEdgeY = (x) => T('yC', x) - T('dr', x);

/**
 * 座艙玻璃（留煙燻透明的部分）：擋風玻璃、左右側窗、後窗；回傳 > 0 = 在玻璃內
 * @type {KeepFn}
 */
const glassKeep = (x, y, z) => {
  const az = Math.abs(z);
  const cw = T('cw', x);
  const above = y - (deckY(x) + 0.8);
  // 擋風玻璃：x 22 → 12.5，座艙頂邊線內側
  const shield = Math.min(22 - x, x - 12.5, cw - 1.4 - az, above);
  // 側窗：座艙頂邊線以下、甲板以上，x 16 → −12（前後緣隨高度斜切）
  const side = Math.min(az - cw - 0.6, roofEdgeY(x) - 0.5 - y, above, 16 - x - 0.5 * (y - deckY(x)), x + 12 - 0.6 * (y - deckY(x)));
  // 後窗：x −9 → −17
  const rear = Math.min(-9 - x, x + 17, cw - 1.6 - az, above);
  return Math.max(shield, side, rear);
};

/**
 * 外露 FRP 板的俯視外形（半邊，x 由前往後；推估自訂形狀，不照抄任何市售 FRP 板輪廓）：
 * 前端窄（藏在殼尾下方，和殼面重疊 2 mm）、後輪後方加寬成寬尾板；後輪段（x ≥ −53）半寬 ≤ 23，離輪胎內側 ≥ 2.2 mm
 * @type {number[][]}
 */
const PLATE_HALF = [
  [-44, 0],
  [-44, 15.5],
  [-45, 17],
  [-48, 20.5],
  [-53, 23],
  [-56, 26.5],
  [-59, 28.5],
  [-62.5, 28.5],
  [-64.5, 26.5],
  [-65, 22],
  [-65, 0],
];

/**
 * 水平板件（俯視多邊形 (x, z)，可帶孔），厚度往上：FRP 板、配重
 * @type {(outline: number[][], holes: number[][][], y: number, thick: number) => THREE.BufferGeometry}
 */
const holedPlate = (outline, holes, y, thick) => {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 16 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
};

/** @type {(cx: number, cz: number, r: number, n?: number) => number[][]} 圓孔（逆向，給 Path 用） */
const circle = (cx, cz, r, n = 20) => {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (-2 * Math.PI * i) / n;
    pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts;
};

/** @type {(x0: number, x1: number, cz: number, r: number, n?: number) => number[][]} 長圓孔（沿 x） */
const slot = (x0, x1, cz, r, n = 10) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 - (Math.PI * i) / n;
    pts.push([x1 + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 - (Math.PI * i) / n;
    pts.push([x0 + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts.reverse();
};

/** @type {() => THREE.BufferGeometry} FRP 板（外露尾板＋減重孔：左右長圓孔、尾角圓孔） */
const buildPlate = () => {
  const right = PLATE_HALF;
  const left = PLATE_HALF.slice().reverse().map(([x, z]) => [x, -z]);
  const outline = [...right, ...left.slice(1, -1)];
  const holes = [slot(-53.5, -47.5, 12, 1.6), slot(-53.5, -47.5, -12, 1.6), circle(-61.5, 22, 2.2), circle(-61.5, -22, 2.2)];
  return holedPlate(outline, holes, PLATE_Y, PLATE_T);
};

/** @type {() => THREE.BufferGeometry} 方形黃銅配重（2 個直通螺絲孔） */
const buildWeight = () => {
  const { x, z, len, w, h, holeR, holeZ } = WEIGHT;
  const outline = [
    [x + w / 2, z - len / 2],
    [x + w / 2, z + len / 2],
    [x - w / 2, z + len / 2],
    [x - w / 2, z - len / 2],
  ];
  return holedPlate(outline, [circle(x, z - holeZ, holeR), circle(x, z + holeZ, holeR)], PLATE_Y + PLATE_T, h);
};

/**
 * 2 組 M2 沉頭螺絲（iter-70，評審：「配重頂上兩顆圓頭像積木凸點」）：頭部是倒錐（頂 Ø3.8 → 底 Ø2.0、高 1.0），
 * 頂面只比配重頂面高 0.05 mm（沉進配重的錐形沉孔）；桿＋板下六角螺帽同前。內六角孔另外做成黑色件（buildScrewSockets）
 * @type {() => THREE.BufferGeometry}
 */
const buildScrews = () => {
  const geos = [];
  const yTop = PLATE_Y + PLATE_T + WEIGHT.h;
  for (const zc of [WEIGHT.z - WEIGHT.holeZ, WEIGHT.z + WEIGHT.holeZ]) {
    const head = new THREE.CylinderGeometry(1.9, 1.0, 1.0, 24);
    head.translate(WEIGHT.x, yTop - 0.45, zc);
    const shank = new THREE.CylinderGeometry(1.0, 1.0, yTop - PLATE_Y, 12);
    shank.translate(WEIGHT.x, (yTop + PLATE_Y) / 2 - 0.5, zc);
    const nut = new THREE.CylinderGeometry(2.0, 2.0, 1.6, 6);
    nut.translate(WEIGHT.x, PLATE_Y - 0.8, zc);
    geos.push(head, shank, nut);
  }
  return mergeGeos(geos);
};

/** @type {(x: number, y: number, z: number, axis: 'y' | 'z') => THREE.BufferGeometry} 內六角孔（黑色六角薄片，對邊 1.5 mm） */
const hexSocket = (x, y, z, axis) => {
  const g = new THREE.CylinderGeometry(0.87, 0.87, 0.12, 6);
  if (axis === 'z') {
    g.rotateX(Math.PI / 2);
  }
  g.translate(x, y, z);
  return g;
};

/** @type {() => THREE.BufferGeometry} 配重沉頭螺絲頂面的內六角孔 */
const buildScrewSockets = () => {
  const yTop = PLATE_Y + PLATE_T + WEIGHT.h;
  return mergeGeos([WEIGHT.z - WEIGHT.holeZ, WEIGHT.z + WEIGHT.holeZ].map((zc) => hexSocket(WEIGHT.x, yTop + 0.06, zc, 'y')));
};

/** @type {number} 樞軸中心 x（殼前端，前卡座之前；iter-70：58.5 → 59.5） */
const PIVOT_X = 59.5;
/** @type {number} 樞軸中心 y（iter-70：15.4 → 14.2，鉸接耳往下伸出側裙，側視看得到圓頭） */
const PIVOT_Y = 14.2;
/** @type {number} 鉸接耳板厚（mm，ABS） */
const LUG_T = 1.8;
/** @type {number} 鉸接耳下端圓頭半徑（iter-70：2.4 → 3.6） */
const LUG_R = 3.6;
/** @type {() => number} 鉸接耳中心面 |z|：貼在殼外側（iter-70：原本在側裙內側 hw − 0.9，從外面幾乎看不到） */
const lugZ = () => T('hw', PIVOT_X) + LUG_T / 2 + 0.1;

/**
 * 鉸接耳（左右各一片 1.8 mm ABS 立板，iter-70 移到殼外側並放大）：上緣貼著側裙外側往上蓋 2.2 mm，
 * 下端以 R3.6 圓頭包住樞軸（側視圓頭整個在側裙下方）
 * @type {() => THREE.BufferGeometry}
 */
const buildHingeLugs = () => {
  const geos = [];
  const pts = [];
  const top = T('yLow', PIVOT_X) + 2.2;
  pts.push([PIVOT_X - 4.6, top], [PIVOT_X + 3.8, top]);
  for (let i = 0; i <= 14; i++) {
    const a = (Math.PI * i) / 14;
    pts.push([PIVOT_X + LUG_R * Math.cos(a), PIVOT_Y - LUG_R * Math.sin(a)]);
  }
  for (const s of [-1, 1]) {
    geos.push(finPlate(pts, s * lugZ(), LUG_T));
  }
  return mergeGeos(geos);
};

/**
 * 樞軸銷（左右各一支 Ø2.4 鋼銷穿過鉸接耳、插進底盤前端的銷座；外側 Ø5.2 × 1.2 圓頭外露，頭上有內六角孔）
 * @type {() => THREE.BufferGeometry}
 */
const buildPivotPin = () => {
  const zl = lugZ();
  const geos = [];
  for (const s of [-1, 1]) {
    const pin = new THREE.CylinderGeometry(1.2, 1.2, 5.0, 14);
    pin.rotateX(Math.PI / 2);
    pin.translate(PIVOT_X, PIVOT_Y, s * (zl - 1.6));
    geos.push(pin);
    const cap = new THREE.CylinderGeometry(2.6, 2.6, 1.2, 24);
    cap.rotateX(Math.PI / 2);
    cap.translate(PIVOT_X, PIVOT_Y, s * (zl + LUG_T / 2 + 0.6));
    geos.push(cap);
  }
  return mergeGeos(geos);
};

/** @type {() => THREE.BufferGeometry} 樞軸銷頭外側的內六角孔 */
const buildPinSockets = () => {
  const z = lugZ() + LUG_T / 2 + 1.2 + 0.06;
  return mergeGeos([-1, 1].map((s) => hexSocket(PIVOT_X, PIVOT_Y, s * z, 'z')));
};

/** @type {() => Record<string, THREE.Material>} */
const materials = () => ({
  // 透明 PC 殼的內噴漆（Blender 依名稱對應：pearl → 珍珠漆、pc-paint 類為透明殼內噴漆、pc-smoke 為煙燻透明窗）
  pearl: namedMaterial('pc-paint-pearl-white', { color: 0xf1efe8, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  pearl2: namedMaterial('pc-paint-pearl-white', { color: 0xf1efe8, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide }),
  cobalt: namedMaterial('pc-paint-cobalt', { color: 0x1f4fd6, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  cobalt2: namedMaterial('pc-paint-cobalt', { color: 0x1f4fd6, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide }),
  yellow: namedMaterial('pc-paint-fluo-yellow', { color: 0xffd60a, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.03 }),
  frame: namedMaterial('pc-paint-black', { color: 0x111214, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  window: namedMaterial('pc-smoke-window', { color: 0x1c2128, roughness: 0.05, specularIntensity: 0.6, transparent: true, opacity: 0.8, envMapIntensity: 0.5, depthWrite: false }),
  inner: namedMaterial('pc-clear-shell-inner', { color: 0x2a2e33, roughness: 0.6, side: THREE.BackSide }),
  edge: namedMaterial('pc-clear-edge', { color: 0xb8c8d8, roughness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  cockpit: namedMaterial('cockpit-dark', { color: 0x16181b, roughness: 0.6 }),
  driver: namedMaterial('cockpit-driver', { color: 0x3a3d44, roughness: 0.45, clearcoat: 0.4 }),
  helmet: namedMaterial('cockpit-helmet-yellow', { color: 0xffd60a, roughness: 0.3, clearcoat: 0.8 }),
  // 實體件：FRP 板（Blender 依 frp- 前綴換 FRP 材質）、黃銅配重、鋼螺絲 / 樞軸、ABS 鉸接耳
  frp: namedMaterial('frp-plate-gray', { color: 0x7c8488, roughness: 0.62, metalness: 0.0, clearcoat: 0.25, clearcoatRoughness: 0.45 }),
  brass: namedMaterial('metal-brass-weight', { color: 0xc9a046, roughness: 0.3, metalness: 0.9 }),
  steel: namedMaterial('steel-screw', { color: 0xc3c8ce, roughness: 0.3, metalness: 0.85 }),
  hinge: namedMaterial('abs-hinge-black', { color: 0x1d1e21, roughness: 0.45 }),
  whiteDecal: decalMaterial('decal-white', { color: 0xf4f4f2, roughness: 0.3 }),
  black: decalMaterial('decal-black', { color: 0x111214, roughness: 0.5 }),
  yellowDecal: decalMaterial('decal-fluo-yellow', { color: 0xffd60a, roughness: 0.3 }),
  head: decalMaterial('lamp-clear', { color: 0xe8f4ff, emissive: 0x9fc8ff, emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1.0 }),
  mount: namedMaterial('abs-mount-black', { color: 0x222326, roughness: 0.6 }),
});

export const hingeDeckBody = makePolyBody({
  id: 'body-hinge-deck',
  name: 'PC 鉸接甲板提燈殼',
  style: 'race',
  // 第六階段分組（shared/reference/BODY_RACE_RESEARCH.md 4.3、7.2 (3)）
  raceType: 'body-pivot',
  form: 'pivot-slab',
  roof: 'closed',
  wing: 'none',
  theme: '前端鉸接的窄平 PC 殼＋外露 FRP 尾板與方形配重（車殼提燈），四輪頂部外露',
  material: 'PC',
  density_g_cm3: 1.2,
  wallThickness_mm: 0.4,
  stations: STATIONS,
  tuck: 0.6,
  // 平滑剖面；脊線根部（第 2 點）、甲板內緣（第 3 點）、甲板折線（第 4 點，iter-70）、肩稜（第 6 點）為銳利稜線
  hard: [2, 3, 4, 6],
  // 殼半寬在輪胎段 ≤ 23.5，不需要輪拱
  wheelArches: [],
  sideZMin: 18,
  zones: () => [
    { mat: 'window', keep: glassKeep },
    { mat: 'frame', keep: (x, y, z, s) => glassKeep(x, y, z, s) + 0.8 },
    // 鈷藍側裙（甲板外緣 1.2 mm 以外，含肩稜與側裙）
    { mat: 'cobalt', keep: (x, y, z) => Math.abs(z) - (T('hw', x) - 1.2) },
    // 螢光黃脊線（中線 ±1.6）
    { mat: 'yellow', keep: (x, y, z) => 1.6 - Math.abs(z) },
    { mat: 'pearl', keep: () => 1 },
  ],
  mats: { inner: 'inner', edge: 'edge', cap: 'cobalt2', cockpit: 'cockpit', mount: 'mount' },
  materials,
  extras: (kit) => {
    const parts = [];
    // 煙燻座艙窗裡看得到的駕駛人
    const drv = buildDriver(2, kit.innerYAt(2) - 9.0, 1.05);
    parts.push({ geometry: drv.body, mat: 'driver', solid: true, name: 'cockpit-driver' });
    parts.push({ geometry: drv.helmet, mat: 'helmet', solid: true, name: 'cockpit-helmet' });
    // 外露 FRP 尾板（1.5 mm，FRP 1.85）＋方形黃銅配重＋M2 螺絲：都是實體件（體積 × 密度），也算外形
    parts.push({ geometry: buildPlate(), mat: 'frp', solid: { density_g_cm3: RHO_FRP }, outline: true, name: 'pivot-plate-frp' });
    parts.push({ geometry: buildWeight(), mat: 'brass', solid: { density_g_cm3: RHO_BRASS }, outline: true, name: 'pivot-weight-brass' });
    parts.push({ geometry: buildScrews(), mat: 'steel', solid: { density_g_cm3: RHO_STEEL }, name: 'pivot-weight-screws' });
    // 前端鉸接耳（ABS）＋樞軸銷（鋼）
    parts.push({ geometry: buildHingeLugs(), mat: 'hinge', solid: { density_g_cm3: RHO_ABS }, outline: true, name: 'hinge-lugs' });
    parts.push({ geometry: buildPivotPin(), mat: 'steel', solid: { density_g_cm3: RHO_STEEL }, outline: true, name: 'hinge-pin' });
    // 內六角孔（黑色薄片，視覺件，不計質量）
    parts.push({ geometry: mergeGeos([buildScrewSockets(), buildPinSockets()]), mat: 'hinge', name: 'screw-sockets' });
    // 甲板外緣黑色細線（鈷藍側裙內側，沿全長）
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(0.35 - Math.abs(Math.abs(z) - (T('hw', x) - 2.2)), x + 44, 62 - x, -(glassKeep(x, y, z, 0) + 0.8))),
      mat: 'black',
      name: 'decal-deck-pinstripe',
    });
    // 號碼 05：前甲板左右（脊線兩側）黑底圓角牌＋白字（珍珠白甲板上白底牌看不出來）
    const plate = (u, v) => sdRoundRect(u, v, -4.6, 4.6, -3.2, 3.2, 1.0);
    for (const zc of [-11.5, 11.5]) {
      parts.push({ geometry: kit.decal(topDecal(plate, { x0: 39, z0: zc, yMin: 22 })), mat: 'black', name: `decal-number-plate-${zc > 0 ? 'r' : 'l'}` });
      parts.push({
        geometry: kit.decal(topDecal(sdNumber('05', { h: 4.4, w: 2.6, gap: 0.7 }), { x0: 39, z0: zc, yMin: 22 }), { offset: 0.12 }),
        mat: 'whiteDecal',
        name: `decal-number-${zc > 0 ? 'r' : 'l'}`,
      });
    }
    // 後甲板：螢光黃斜紋三道（自創）
    parts.push({
      geometry: kit.decal((x, y, z) => {
        const az = Math.abs(z);
        if (az < 6 || az > T('hw', x) - 3) {
          return -1;
        }
        const u = x + 0.6 * az;
        let d = -1;
        for (const c of [-24, -29, -34]) {
          d = Math.max(d, 1.0 - Math.abs(u - c));
        }
        return d;
      }),
      mat: 'yellowDecal',
      name: 'decal-rear-chevrons',
    });
    // 鼻端小頭燈（貼紙式透明燈片）
    parts.push({
      geometry: kit.decal((x, y, z) => Math.min(1.6 - Math.abs(Math.abs(z) - 7.5) , 0.9 - Math.abs(x - 62.6))),
      mat: 'head',
      name: 'decal-headlamps',
    });
    // 側裙號碼（小，白字）
    parts.push({
      geometry: kit.decal(sideDecal(sdNumber('05', { h: 3.0, w: 1.8, gap: 0.5 }), { x0: -4, y0: 22.0, zMin: 24 }), { offset: 0.12 }),
      mat: 'whiteDecal',
      name: 'decal-side-number',
    });
    return parts;
  },
  // 後卡座：殼尾在 x −46 結束，後卡座（x −50）改為撐在 FRP 尾板底面（提燈殼的後端擱架）
  mountInnerY: (kit) => (x) => (x < -40 ? PLATE_Y - 0.2 : kit.innerYAt(x)),
  src: {
    density_g_cm3: 'BODY_RACE_RESEARCH 第 3 節 [COV]：PC 1.20 g/cm³',
    wallThickness_mm: 'BODY_RACE_RESEARCH 第 3 節：官方 PC 透明殼片材 0.4 mm（[T95611] 等）',
    plate: 'BODY_RACE_RESEARCH 4.3：FRP 1.5 mm（Tamiya FRP 架官方厚度）、密度 1.85（PARTS_RESEARCH 3.1）；外形為本專案自訂（推估）',
    weight: 'BODY_RACE_RESEARCH 4.3 [T15472]：方形配重 6×6×14 mm、1 支約 3.6 g；材質黃銅 8.5 g/cm³、2 個 Ø2.9 螺絲孔為推估（體積 × 密度 ≈ 3.61 g）',
    geometry: '本檔縱向控制表（推估）；外形型態依 BODY_RACE_RESEARCH 4.3 [GETNAVI]（車殼前端為支點、後段掛配重）；車殼為剛體，不模擬擺動',
    mounts: '對齊 chassis-midship 的車殼安裝點（SPEC 1.14）；後卡座撐在 FRP 尾板底面',
  },
});
